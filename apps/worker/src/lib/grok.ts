/**
 * Grok API — xAI chat completions (OpenAI-compatible)
 *
 * Used for real-time earthquake analysis generation.
 * Retry with exponential backoff (max 2 attempts).
 * Returns only low-risk AI hints; final stored analysis is code-canonicalized.
 */

import {
  ANALYSIS_HINT_SYSTEM_PROMPT,
  type AnalysisAiHints,
  buildAnalysisHintUserPrompt,
  normalizeAnalysisHints,
} from '@namazue/db';
import type { Env } from '../index.ts';

const XAI_API = 'https://api.x.ai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;

interface GrokResult {
  analysis: AnalysisAiHints;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callGrok(
  env: Env,
  context: Record<string, unknown>,
  tier: string,
): Promise<GrokResult> {
  if (!env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const userMsg = buildAnalysisHintUserPrompt(context, tier);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const resp = await fetch(XAI_API, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-4-1-fast-reasoning',
          messages: [
            { role: 'system', content: ANALYSIS_HINT_SYSTEM_PROMPT },
            { role: 'user', content: userMsg },
          ],
          stream: false,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Grok API ${resp.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await resp.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error('Empty Grok response');

      const analysis = normalizeAnalysisHints(JSON.parse(raw));

      return {
        analysis,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error(`Grok request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      } else {
        lastError = err as Error;
      }
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('Grok call failed');
}
