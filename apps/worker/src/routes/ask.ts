/**
 * Q&A route — POST /api/ask
 *
 * Accepts a question about a specific earthquake event,
 * retrieves the latest analysis, and asks Grok to answer
 * based solely on that analysis.
 */

import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { checkRateLimit } from '../lib/rateLimit.ts';
import { analyses } from '@namazue/db';
import { eq, and, desc } from 'drizzle-orm';
import { parseAskBody } from '../lib/askValidation.ts';
import { AppError, jsonError } from '../lib/errors.ts';
import { ensureRequestId, logRequestError } from '../lib/requestContext.ts';

export const askRoute = new Hono<{ Bindings: Env }>();

const XAI_API = 'https://api.x.ai/v1/chat/completions';

const SYSTEM_PROMPT = `You are Namazue's earthquake Q&A assistant.
Given a pre-generated earthquake analysis, answer the user's question.
Rules:
1. Reference ONLY facts/data from the provided analysis. Never invent numbers.
2. Never predict future earthquakes. Never say "safe."
3. Max 3 sentences per language.
4. Return JSON: { "answer": { "ja": "...", "ko": "...", "en": "..." }, "refs": ["facts:...", "seismology:..."] }
Return ONLY valid JSON.`;

interface AskResponse {
  answer: { ja: string; ko: string; en: string };
  refs: string[];
}

askRoute.post('/', async (c) => {
  const requestId = ensureRequestId(c);

  // Rate limit
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, 'ask');
  if (!rl.allowed) {
    return jsonError(c, 429, 'RATE_LIMITED', 'Rate limit exceeded');
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return jsonError(c, 400, 'BAD_REQUEST', 'Invalid JSON body');
  }

  const parsedBody = parseAskBody((body ?? {}) as Record<string, unknown>);
  if ('error' in parsedBody) {
    return jsonError(c, 400, 'BAD_REQUEST', parsedBody.error);
  }
  const { event_id, question } = parsedBody.value;

  // Fetch latest analysis
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select({ analysis: analyses.analysis })
    .from(analyses)
    .where(and(eq(analyses.event_id, event_id), eq(analyses.is_latest, true)))
    .orderBy(desc(analyses.created_at))
    .limit(1);

  if (rows.length === 0) {
    return jsonError(c, 404, 'NOT_FOUND', 'No analysis found for this event');
  }

  const analysisData = rows[0].analysis;

  // Call Grok
  const userMsg = `Analysis:\n${JSON.stringify(analysisData, null, 2)}\n\nQuestion: ${question}`;

  const resp = await fetch(XAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-reasoning',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      stream: false,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  }).catch((err) => {
    throw new AppError(502, 'UPSTREAM_FAILURE', `AI request failed: ${(err as Error).message}`);
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    logRequestError('ask.upstream_error', requestId, errBody, { status: resp.status, event_id });
    return jsonError(c, 502, 'UPSTREAM_FAILURE', 'AI service unavailable');
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    return jsonError(c, 502, 'UPSTREAM_FAILURE', 'Empty AI response');
  }

  let parsed: AskResponse;
  try {
    parsed = JSON.parse(raw) as AskResponse;
  } catch {
    logRequestError('ask.invalid_ai_json', requestId, raw.slice(0, 200), { event_id });
    return jsonError(c, 502, 'UPSTREAM_FAILURE', 'Invalid AI response format');
  }

  return c.json(parsed);
});
