/**
 * Ask Panel — Unified AI + Search tab for the "Ask" pane.
 *
 * Natural language interface: user asks anything about earthquakes,
 * AI uses tool calling to search/analyze/visualize.
 * Mounts into the left panel's "ask" pane via getTabPane('ask').
 */

import { store } from '../store/appState';
import type { ChatMessage } from '../types';
import { t, onLocaleChange } from '../i18n/index';
import { getTabPane } from './leftPanel';

// ── DOM refs ──

let askEl: HTMLElement;
let messagesEl: HTMLElement;
let inputEl: HTMLTextAreaElement;
let sendBtn: HTMLButtonElement;
let unsubChat: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;

const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? 'https://api.namazue.dev' : '');

// ── Helpers ──

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Build UI ──

function buildMessages(): HTMLElement {
  messagesEl = el('div', 'ask__messages');

  // Welcome + suggestions
  const welcome = el('div', 'ask__welcome');
  const title = el('div', 'ask__welcome-title', t('ask.welcome.title'));
  const desc = el('div', 'ask__welcome-desc', t('ask.welcome.desc'));
  welcome.appendChild(title);
  welcome.appendChild(desc);

  const suggestions = el('div', 'ask__suggestions');
  const prompts = [
    t('ask.suggest.recent'),
    t('ask.suggest.compare'),
    t('ask.suggest.region'),
    t('ask.suggest.analysis'),
  ];
  for (const prompt of prompts) {
    const chip = el('button', 'ask__suggestion', prompt);
    chip.type = 'button';
    chip.addEventListener('click', () => sendMessage(prompt));
    suggestions.appendChild(chip);
  }
  welcome.appendChild(suggestions);
  messagesEl.appendChild(welcome);

  return messagesEl;
}

function buildInputArea(): HTMLElement {
  const area = el('div', 'ask__input-area');

  inputEl = document.createElement('textarea');
  inputEl.className = 'ask__input';
  inputEl.rows = 1;
  inputEl.placeholder = t('ask.input.placeholder');
  inputEl.setAttribute('aria-label', t('ask.input.label'));

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value.trim());
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
  });

  sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'ask__send-btn';
  sendBtn.setAttribute('aria-label', t('ask.input.send'));
  sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L14 2L8 14L7 9L2 8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  sendBtn.addEventListener('click', () => sendMessage(inputEl.value.trim()));

  area.appendChild(inputEl);
  area.appendChild(sendBtn);

  return area;
}

// ── Message Rendering ──

function renderMessage(msg: ChatMessage): HTMLElement {
  const bubble = el('div', `ask__bubble ask__bubble--${msg.role}`);

  if (msg.content) {
    const text = el('div', 'ask__bubble-text');
    text.textContent = msg.content;
    bubble.appendChild(text);
  }

  if (msg.toolResults && msg.toolResults.length > 0) {
    for (const tr of msg.toolResults) {
      const card = el('div', 'ask__tool-result');
      const header = el('div', 'ask__tool-header', tr.name);
      card.appendChild(header);

      const body = el('div', 'ask__tool-body');
      if (tr.name === 'search_earthquakes' && Array.isArray(tr.result)) {
        renderSearchResults(body, tr.result);
      } else {
        body.textContent = typeof tr.result === 'string'
          ? tr.result
          : JSON.stringify(tr.result, null, 2);
      }
      card.appendChild(body);
      bubble.appendChild(card);
    }
  }

  if (msg.toolCalls && msg.toolCalls.length > 0) {
    for (const tc of msg.toolCalls) {
      const tag = el('div', 'ask__tool-tag', `\u2699 ${tc.name}`);
      bubble.appendChild(tag);
    }
  }

  return bubble;
}

function renderSearchResults(container: HTMLElement, results: unknown[]): void {
  const items = results.slice(0, 5);
  for (const item of items) {
    const r = item as Record<string, unknown>;
    const row = el('button', 'ask__search-result');
    row.type = 'button';

    const mag = el('span', 'ask__search-mag', `M${Number(r.magnitude || 0).toFixed(1)}`);
    const place = el('span', 'ask__search-place', String(r.place || ''));
    row.append(mag, place);

    row.addEventListener('click', () => {
      if (typeof r.id === 'string' && r.id) {
        store.set('selectedEvent', {
          id: r.id,
          lat: Number(r.lat || 0),
          lng: Number(r.lng || 0),
          depth_km: Number(r.depth_km || 10),
          magnitude: Number(r.magnitude || 0),
          time: typeof r.time === 'number' ? r.time : Date.now(),
          faultType: (r.fault_type as 'crustal' | 'interface' | 'intraslab') ?? 'crustal',
          tsunami: r.tsunami === true,
          place: { text: String(r.place || '') },
        });
        store.set('activePanel', 'live');
        store.set('route', { ...store.get('route'), tab: 'live', eventId: r.id as string });
      }
    });

    container.appendChild(row);
  }

  if (results.length > 5) {
    container.appendChild(el('div', 'ask__search-more', `+${results.length - 5} more`));
  }
}

function syncMessages(messages: ChatMessage[]): void {
  if (messages.length > 0) {
    messagesEl.querySelector('.ask__welcome')?.remove();
  }

  const existingIds = new Set<string>();
  for (const child of Array.from(messagesEl.children)) {
    const id = (child as HTMLElement).dataset.msgId;
    if (id) existingIds.add(id);
  }

  for (const msg of messages) {
    if (existingIds.has(msg.id)) continue;
    const bubble = renderMessage(msg);
    bubble.dataset.msgId = msg.id;
    messagesEl.appendChild(bubble);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Send Message ──

async function sendMessage(text: string): Promise<void> {
  if (!text) return;

  const chat = store.get('chat');
  if (chat.isStreaming) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';

  const userMsg: ChatMessage = {
    id: generateId(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  };

  store.set('chat', {
    ...chat,
    messages: [...chat.messages, userMsg],
    isStreaming: true,
    error: null,
  });

  try {
    const resp = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: store.get('chat').messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!resp.ok) throw new Error(`Chat failed: ${resp.status}`);
    const data = await resp.json();

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: data.message || '',
      toolCalls: data.toolCalls,
      toolResults: data.toolResults,
      timestamp: Date.now(),
    };

    if (data.toolResults) {
      for (const tr of data.toolResults) {
        if (tr.name === 'visualize_on_globe') {
          executeVisualization(tr.result);
        }
      }
    }

    const current = store.get('chat');
    store.set('chat', {
      ...current,
      messages: [...current.messages, assistantMsg],
      isStreaming: false,
    });
  } catch (err) {
    const current = store.get('chat');
    store.set('chat', {
      ...current,
      isStreaming: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

function executeVisualization(result: unknown): void {
  if (typeof result !== 'object' || result === null) return;
  const r = result as Record<string, unknown>;

  if (r.action === 'fly_to' && typeof r.lat === 'number' && typeof r.lng === 'number') {
    console.log('[ask] fly_to', r.lat, r.lng);
  }

  if (r.action === 'highlight_events' && Array.isArray(r.event_ids)) {
    console.log('[ask] highlight_events', r.event_ids);
  }
}

// ── Public API ──

export function initAskPanel(): void {
  const pane = getTabPane('ask');
  if (!pane) return;

  askEl = el('div', 'ask-panel');
  askEl.appendChild(buildMessages());
  askEl.appendChild(buildInputArea());
  pane.appendChild(askEl);

  unsubChat = store.subscribe('chat', (chat) => {
    syncMessages(chat.messages);
    sendBtn.disabled = chat.isStreaming;
    sendBtn.classList.toggle('ask__send-btn--loading', chat.isStreaming);

    if (chat.error) {
      const errEl = el('div', 'ask__error', chat.error);
      messagesEl.appendChild(errEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  store.subscribe('activePanel', (tab) => {
    if (tab === 'ask') {
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  unsubLocale = onLocaleChange(() => {
    inputEl.placeholder = t('ask.input.placeholder');
    inputEl.setAttribute('aria-label', t('ask.input.label'));
    sendBtn.setAttribute('aria-label', t('ask.input.send'));
  });
}

export function focusAskInput(): void {
  inputEl?.focus();
}

export function disposeAskPanel(): void {
  unsubChat?.();
  unsubChat = null;
  unsubLocale?.();
  unsubLocale = null;
}
