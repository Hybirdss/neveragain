export interface AskBody {
  event_id?: unknown;
  question?: unknown;
}

export interface ParsedAskBody {
  event_id: string;
  question: string;
}

export const MAX_QUESTION_LENGTH = 200;
export const MAX_EVENT_ID_LENGTH = 128;

export function parseAskBody(body: AskBody): { value: ParsedAskBody } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid JSON body' };
  }

  const eventIdRaw = body.event_id;
  if (typeof eventIdRaw !== 'string') {
    return { error: 'event_id is required' };
  }
  const event_id = eventIdRaw.trim();
  if (!event_id) {
    return { error: 'event_id is required' };
  }
  if (event_id.length > MAX_EVENT_ID_LENGTH) {
    return { error: `event_id exceeds ${MAX_EVENT_ID_LENGTH} characters` };
  }

  const questionRaw = body.question;
  if (typeof questionRaw !== 'string') {
    return { error: 'question is required' };
  }
  const question = questionRaw.trim();
  if (!question) {
    return { error: 'question is required' };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return { error: `question exceeds ${MAX_QUESTION_LENGTH} characters` };
  }

  return { value: { event_id, question } };
}
