/**
 * Chat Route — /api/chat
 *
 * Conversational AI with tool calling (Grok + xAI OpenAI-compatible API).
 * Executes a tool-call loop (max 3 iterations) to resolve queries.
 */

import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { checkRateLimit } from '../lib/rateLimit.ts';
import { TOOL_DEFINITIONS, executeTool, type ToolResult } from '../lib/tools.ts';

export const chatRoute = new Hono<{ Bindings: Env }>();

const XAI_API = 'https://api.x.ai/v1/chat/completions';
const MAX_TOOL_ITERATIONS = 3;
const REQUEST_TIMEOUT_MS = 30_000;

const CHAT_SYSTEM_PROMPT = `You are Namazue AI, an expert seismologist assistant for the Namazue earthquake visualization platform.

You help users explore earthquake data through conversation. You have access to tools that can:
- Search the earthquake database (60,000+ events)
- Fetch detailed AI analysis of specific earthquakes
- Compare multiple earthquakes
- Generate activity reports
- Visualize results on the 3D globe

Guidelines:
- Use tools proactively when the user asks about specific earthquakes, regions, or time periods.
- Always call search_earthquakes when the user asks about finding or listing earthquakes.
- When presenting search results, include magnitude, location, depth, and date.
- Use visualize_on_globe to highlight relevant events or fly to locations when appropriate.
- Respond in the same language the user writes in (Japanese, Korean, or English).
- Be concise but informative. Cite specific data from tool results.
- For M6+ events, suggest getting a detailed analysis if the user seems interested.
- Never invent earthquake data — only report what the tools return.`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
}

chatRoute.post('/', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? '0.0.0.0';
  const rl = await checkRateLimit(c.env.RATE_LIMIT, ip, 'chat');
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const body = await c.req.json<{ messages?: { role: string; content: string }[] }>().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: 'messages array is required' }, 400);
  }

  // Validate and sanitize messages
  const userMessages: ChatMessage[] = body.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-10) // Keep last 10 messages for context
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content || '').slice(0, 2000),
    }));

  if (userMessages.length === 0) {
    return c.json({ error: 'At least one user message is required' }, 400);
  }

  // Build message history with system prompt
  const messages: ChatMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...userMessages,
  ];

  try {
    const result = await runToolLoop(c.env, messages);
    return c.json(result);
  } catch (err) {
    console.error('[chat] Error:', err);
    return c.json({ error: 'Chat failed' }, 500);
  }
});

interface ChatResult {
  message: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
  toolResults?: ToolResult[];
}

async function runToolLoop(
  env: Env,
  messages: ChatMessage[],
): Promise<ChatResult> {
  const allToolResults: ToolResult[] = [];
  const allToolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await callGrokChat(env, messages);

    // If no tool calls, return the final message
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return {
        message: response.content || '',
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      };
    }

    // Execute tool calls
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    };
    messages.push(assistantMsg);

    for (const tc of response.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      allToolCalls.push({
        id: tc.id,
        name: tc.function.name,
        arguments: args,
      });

      // Execute the tool (server-side) or pass through (client-side)
      const result = await executeTool(env, tc.function.name, args);
      allToolResults.push(result);

      // Feed result back to Grok
      messages.push({
        role: 'tool',
        content: JSON.stringify(result.result),
        tool_call_id: tc.id,
      });
    }
  }

  // Max iterations reached — return what we have
  const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
  return {
    message: lastAssistant?.content || 'I found the results above.',
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    toolResults: allToolResults.length > 0 ? allToolResults : undefined,
  };
}

interface GrokChatResponse {
  content: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
}

async function callGrokChat(
  env: Env,
  messages: ChatMessage[],
): Promise<GrokChatResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(XAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        messages: messages.map(m => {
          const msg: Record<string, unknown> = { role: m.role, content: m.content };
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
          return msg;
        }),
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Grok API error ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json() as {
      choices: {
        message: {
          content: string | null;
          tool_calls?: {
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }[];
        };
      }[];
    };

    const choice = data.choices[0]?.message;
    return {
      content: choice?.content || '',
      tool_calls: choice?.tool_calls,
    };
  } finally {
    clearTimeout(timeout);
  }
}
