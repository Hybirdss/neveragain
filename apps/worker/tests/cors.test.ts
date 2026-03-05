import test from 'node:test';
import assert from 'node:assert/strict';
import { createOriginPolicy, isOriginAllowed } from '../src/lib/cors.ts';

test('empty origin policy preserves allow-all behavior', () => {
  const policy = createOriginPolicy(undefined);

  assert.equal(policy.allowAll, true);
  assert.equal(isOriginAllowed('https://any-origin.example', policy), true);
});

test('origin policy allows exact origins and wildcard Pages preview origins', () => {
  const policy = createOriginPolicy('https://namazue.dev, https://*.namazue.pages.dev');

  assert.equal(isOriginAllowed('https://namazue.dev', policy), true);
  assert.equal(isOriginAllowed('https://2eebd9b0.namazue.pages.dev', policy), true);
  assert.equal(isOriginAllowed('https://codex-consumer-evidence-layer.namazue.pages.dev', policy), true);
});

test('origin policy rejects lookalike hosts outside wildcard suffix', () => {
  const policy = createOriginPolicy('https://*.namazue.pages.dev');

  assert.equal(isOriginAllowed('https://namazue.pages.dev', policy), false);
  assert.equal(isOriginAllowed('https://2eebd9b0.namazue.pages.dev.evil.com', policy), false);
  assert.equal(isOriginAllowed('https://evil.example', policy), false);
});
