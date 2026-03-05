import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAskBody } from '../src/lib/askValidation.ts';

test('parseAskBody accepts valid payload and trims fields', () => {
  const parsed = parseAskBody({
    event_id: '  us7000abcd  ',
    question: '  Why was this event felt widely?  ',
  });
  assert.ok('value' in parsed);
  if ('error' in parsed) return;
  assert.deepEqual(parsed.value, {
    event_id: 'us7000abcd',
    question: 'Why was this event felt widely?',
  });
});

test('parseAskBody rejects empty event_id', () => {
  const parsed = parseAskBody({
    event_id: '   ',
    question: 'Is this a foreshock?',
  });
  assert.deepEqual(parsed, { error: 'event_id is required' });
});

test('parseAskBody rejects empty question', () => {
  const parsed = parseAskBody({
    event_id: 'us7000abcd',
    question: '   ',
  });
  assert.deepEqual(parsed, { error: 'question is required' });
});

test('parseAskBody rejects too-long question', () => {
  const parsed = parseAskBody({
    event_id: 'us7000abcd',
    question: 'x'.repeat(201),
  });
  assert.deepEqual(parsed, { error: 'question exceeds 200 characters' });
});

test('parseAskBody rejects too-long event_id', () => {
  const parsed = parseAskBody({
    event_id: 'a'.repeat(129),
    question: 'Will there be aftershocks?',
  });
  assert.deepEqual(parsed, { error: 'event_id exceeds 128 characters' });
});
