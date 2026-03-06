import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = readFileSync(path.resolve(__dirname, "../../namazue-console-review.html"), "utf8");

test("console review page includes required top-level sections", () => {
  assert.match(html, /id="manifest"/);
  assert.match(html, /id="canonical-console"/);
  assert.match(html, /id="state-views"/);
  assert.match(html, /id="component-spec"/);
  assert.match(html, /id="interaction-logic"/);
  assert.match(html, /id="visual-system"/);
  assert.match(html, /id="voice-system"/);
});

test("manifest includes north-star language and review rail links", () => {
  assert.match(html, /Tokyo-first earthquake operations console/);
  assert.match(html, /href="#canonical-console"/);
  assert.match(html, /href="#voice-system"/);
});

test("canonical console includes required state controls and launch asset content", () => {
  assert.match(html, /data-console-state="calm"/);
  assert.match(html, /data-console-state="live"/);
  assert.match(html, /data-console-state="focus"/);
  assert.match(html, /data-console-state="scenario"/);
  assert.match(html, /Event Snapshot/);
  assert.match(html, /Asset Exposure/);
  assert.match(html, /Check These Now/);
  assert.match(html, /Replay Rail/);
  assert.match(html, /Port of Tokyo/);
});

test("state views include the four required product states", () => {
  assert.match(html, /Calm Mode/);
  assert.match(html, /Event Lock/);
  assert.match(html, /Focused Asset/);
  assert.match(html, /Scenario Shift/);
});

test("component spec includes all required console components", () => {
  assert.match(html, /Event Snapshot/);
  assert.match(html, /Asset Exposure/);
  assert.match(html, /Check These Now/);
  assert.match(html, /Replay Rail/);
  assert.match(html, /Analyst Note/);
  assert.match(html, /Role/);
  assert.match(html, /Avoid/);
});

test("page includes logic, visual, and voice review rules", () => {
  assert.match(html, /navigation by focus, not by page/i);
  assert.match(html, /Deep Navy/i);
  assert.match(html, /Forbidden phrases/i);
  assert.match(html, /trusted analyst/i);
});
