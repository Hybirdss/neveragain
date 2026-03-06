/**
 * Q&A route — POST /api/ask
 *
 * Accepts a question about a specific earthquake event,
 * retrieves the latest analysis, and answers using
 * canonical facts + approved public guidance only.
 */

import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { checkRateLimit } from '../lib/rateLimit.ts';
import { prepareAnalysisForDelivery } from '../lib/analysisDelivery.ts';
import { analyses, earthquakes } from '@namazue/db';
import { eq, and, desc } from 'drizzle-orm';
import {
  ASK_SYSTEM_PROMPT,
  buildAskPromptPayload,
  buildDeterministicAskFallback,
  parseAskResponse,
} from '../lib/askSupport.ts';

export const askRoute = new Hono<{ Bindings: Env }>();

const XAI_API = 'https://api.x.ai/v1/chat/completions';

const MAX_QUESTION_LENGTH = 200;

interface AskBody {
  event_id: string;
  question: string;
}

interface AskResponse {
  answer: { ja: string; ko: string; en: string };
  refs: string[];
}

askRoute.post('/', async (c) => {
  // Rate limit
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, 'ask');
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded', remaining: 0, limit: rl.limit }, 429);
  }

  // Parse & validate body
  let body: AskBody;
  try {
    body = await c.req.json<AskBody>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { event_id, question } = body;

  if (!event_id || typeof event_id !== 'string') {
    return c.json({ error: 'event_id is required' }, 400);
  }

  if (!question || typeof question !== 'string') {
    return c.json({ error: 'question is required' }, 400);
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return c.json({ error: `question exceeds ${MAX_QUESTION_LENGTH} characters` }, 400);
  }

  // Fetch latest analysis
  const db = createDb(c.env.DATABASE_URL);
  const rows = await db
    .select({
      analysis: analyses.analysis,
      magnitude: earthquakes.magnitude,
      depth_km: earthquakes.depth_km,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      place: earthquakes.place,
      place_ja: earthquakes.place_ja,
    })
    .from(analyses)
    .innerJoin(earthquakes, eq(earthquakes.id, analyses.event_id))
    .where(and(eq(analyses.event_id, event_id), eq(analyses.is_latest, true)))
    .orderBy(desc(analyses.created_at))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'No analysis found for this event' }, 404);
  }

  const analysisData = prepareAnalysisForDelivery(rows[0].analysis, {
    magnitude: rows[0].magnitude,
    depth_km: rows[0].depth_km,
    lat: rows[0].lat,
    lng: rows[0].lng,
    place: rows[0].place,
    place_ja: rows[0].place_ja,
  });
  const safePromptPayload = buildAskPromptPayload(analysisData);
  const fallback = buildDeterministicAskFallback(analysisData, question);

  if (!c.env.XAI_API_KEY) {
    return c.json(fallback);
  }

  // Call Grok with canonical facts + approved public guidance only.
  const userMsg = `Canonical context:\n${JSON.stringify(safePromptPayload, null, 2)}\n\nQuestion: ${question}`;

  const resp = await fetch(XAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-reasoning',
      messages: [
        { role: 'system', content: ASK_SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      stream: false,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error(`Grok API error: ${resp.status} ${errBody.slice(0, 200)}`);
    return c.json(fallback);
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    return c.json(fallback);
  }

  const parsed = parseAskResponse(raw);
  if (!parsed) {
    console.error('Failed to validate Grok response:', raw.slice(0, 200));
    return c.json(fallback);
  }

  return c.json(parsed);
});
