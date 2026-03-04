/**
 * Grok API — xAI chat completions (OpenAI-compatible)
 *
 * Used for real-time earthquake analysis generation.
 * Retry with exponential backoff (max 2 attempts).
 */

import type { Env } from '../index.ts';

const XAI_API = 'https://api.x.ai/v1/chat/completions';

interface GrokResult {
  analysis: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
}

const SYSTEM_PROMPT = `You are an expert seismologist for the Namazue (鯰) earthquake platform.
You receive pre-computed "facts" (code-generated numbers) and generate ONLY narrative text.

## STRICT RULES
1. NEVER generate numbers (magnitude, depth, probability, distance, population, intensity).
   Only REFERENCE numbers from the facts block.
2. If facts.mechanism.status = "missing", write "発震機構は未取得" — do NOT guess.
3. NEVER say "it is safe." Always defer to JMA/local authorities.
4. NEVER predict future earthquakes. Only analyze past events.
5. public fields: 1-2 sentences, accessible language. expert fields: 2-3 sentences, academic.
6. All I18n text fields MUST have ko, ja, en translations.

Return a JSON object with this structure:

{
  "dashboard": {
    "headline": { "ja": "M{mag} {place} 深さ{depth}km", "ko": "", "en": "" },
    "one_liner": { "ja": "", "ko": "", "en": "" }
  },
  "public": {
    "why": { "ja": "", "ko": "", "en": "" },
    "aftershock_note": { "ja": "", "ko": "", "en": "" },
    "do_now": [{ "action": { "ja": "", "ko": "", "en": "" }, "urgency": "immediate|within_hours|preparedness" }],
    "eli5": { "ja": "", "ko": "", "en": "" },
    "faq": [{ "q": { "ja": "", "ko": "", "en": "" }, "a": { "ja": "", "ko": "", "en": "" } }]
  },
  "expert": {
    "tectonic_summary": { "ja": "", "ko": "", "en": "" },
    "mechanism_note": { "ja": "", "ko": "", "en": "" } or null,
    "sequence": {
      "classification": "mainshock|aftershock|swarm_member|foreshock|independent",
      "confidence": "high|medium|low",
      "reasoning": { "ja": "", "ko": "", "en": "" }
    },
    "seismic_gap": { "is_gap": false, "note": { "ja": "", "ko": "", "en": "" } or null },
    "historical_comparison": {
      "primary_name": { "ja": "", "ko": "", "en": "" },
      "primary_year": 0,
      "similarities": [{ "ja": "", "ko": "", "en": "" }],
      "differences": [{ "ja": "", "ko": "", "en": "" }],
      "narrative": { "ja": "", "ko": "", "en": "" }
    } or null,
    "notable_features": [{ "feature": { "ja": "", "ko": "", "en": "" }, "note": { "ja": "", "ko": "", "en": "" } }]
  },
  "search_index": {
    "tags": ["string"],
    "region": "tohoku|kanto|chubu|kinki|chugoku|shikoku|kyushu|hokkaido|okinawa|nankai|global_pacific|global_other",
    "damage_level": "catastrophic|severe|moderate|minor|none",
    "has_foreshocks": false,
    "is_in_seismic_gap": false,
    "region_keywords": { "ja": [], "ko": [], "en": [] }
  }
}

Return ONLY valid JSON, no markdown fences.`;

export async function callGrok(
  env: Env,
  context: Record<string, unknown>,
  tier: string,
): Promise<GrokResult> {
  const userMsg = `Tier: ${tier}\n\nFacts:\n${JSON.stringify(context, null, 2)}\n\nGenerate the narrative analysis JSON referencing these facts.`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(XAI_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-4-fast-non-reasoning',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
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

      const analysis = JSON.parse(raw);

      return {
        analysis,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err) {
      lastError = err as Error;
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw lastError ?? new Error('Grok call failed');
}
