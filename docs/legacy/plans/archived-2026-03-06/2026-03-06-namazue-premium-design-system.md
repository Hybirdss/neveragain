# Namazue Premium Service And Lab Surface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `namazue.dev` root and `/lab` as a Japanese-first, operator-grade, dynamic design system with shared state, localized copy, and a premium `Maritime Metro Command` visual language.

**Architecture:** Keep the existing route split (`/`, `/lab`, `/legacy`) but move the new shell onto a typed UI-state layer, a locale-aware content registry, pure render-model adapters, and tokenized CSS. `app.ts` should only bind DOM events and trigger rerenders. `templates.ts` should render from localized view models rather than hard-coded English text. `/lab` should inspect the same grammar that powers `/`, not a disconnected documentation mock.

**Tech Stack:** Vite, TypeScript, vanilla DOM rendering, CSS custom properties, Vitest

---

### Task 1: Add Shared Namazue UI State

**Files:**
- Create: `apps/globe/src/namazue/state.ts`
- Create: `apps/globe/src/namazue/__tests__/state.test.ts`
- Modify: `apps/globe/src/namazue/app.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createUiState, setConsoleState, setLabTab, setLocale } from '../state';

describe('createUiState', () => {
  it('defaults to Japanese and calm mode', () => {
    const state = createUiState('service', '/');
    expect(state.locale).toBe('ja');
    expect(state.consoleState).toBe('calm');
    expect(state.labTab).toBe('console');
  });

  it('resolves the requested lab tab from the current pathname', () => {
    const state = createUiState('lab', '/lab/voice');
    expect(state.labTab).toBe('voice');
  });

  it('returns new immutable state objects when controls change', () => {
    const state = createUiState('lab', '/lab');
    const next = setLocale(setConsoleState(setLabTab(state, 'components'), 'scenario'), 'en');
    expect(next).toMatchObject({ locale: 'en', consoleState: 'scenario', labTab: 'components' });
    expect(next).not.toBe(state);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/state.test.ts
```

Expected: FAIL because `state.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/namazue/state.ts`:

```ts
import type { ConsoleStateId } from './content';
import type { AppRoute, LabTabId } from './routeModel';
import { resolveLabTab } from './routeModel';

export type LocaleId = 'ja' | 'en' | 'ko';

export interface NamazueUiState {
  locale: LocaleId;
  consoleState: ConsoleStateId;
  labTab: LabTabId;
}

export function createUiState(route: Exclude<AppRoute, 'legacy'>, pathname: string): NamazueUiState {
  return {
    locale: 'ja',
    consoleState: 'calm',
    labTab: route === 'lab' ? resolveLabTab(pathname) : 'console',
  };
}

export function setLocale(state: NamazueUiState, locale: LocaleId): NamazueUiState {
  return { ...state, locale };
}

export function setConsoleState(state: NamazueUiState, consoleState: ConsoleStateId): NamazueUiState {
  return { ...state, consoleState };
}

export function setLabTab(state: NamazueUiState, labTab: LabTabId): NamazueUiState {
  return { ...state, labTab };
}
```

Update `apps/globe/src/namazue/app.ts` to create and mutate this state with the helper functions instead of storing a raw inline object.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/state.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/state.ts apps/globe/src/namazue/__tests__/state.test.ts apps/globe/src/namazue/app.ts
git commit -m "feat(globe): add namazue ui state model"
```

### Task 2: Refactor Content Into A Locale-Aware Registry

**Files:**
- Modify: `apps/globe/src/namazue/content.ts`
- Create: `apps/globe/src/namazue/__tests__/content.test.ts`
- Modify: `apps/globe/src/namazue/templates.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getLocalizedCopy } from '../content';

describe('getLocalizedCopy', () => {
  it('returns Japanese service copy by default', () => {
    expect(getLocalizedCopy('ja').service.brand).toBe('namazue.dev');
    expect(getLocalizedCopy('ja').tabs.console).toBe('コンソール');
  });

  it('returns translated labels for English and Korean', () => {
    expect(getLocalizedCopy('en').tabs.voice).toBe('Voice');
    expect(getLocalizedCopy('ko').tabs.voice).toBe('보이스');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/content.test.ts
```

Expected: FAIL because `getLocalizedCopy` does not exist yet.

**Step 3: Write minimal implementation**

Refactor `apps/globe/src/namazue/content.ts` so it exports:

```ts
export interface LocalizedCopy {
  service: { brand: string; routeLabels: { service: string; lab: string; legacy: string } };
  tabs: Record<LabTabId, string>;
  shell: { localeLabel: string; localeNames: Record<LocaleId, string> };
}

const COPY: Record<LocaleId, LocalizedCopy> = { ... };

export function getLocalizedCopy(locale: LocaleId): LocalizedCopy {
  return COPY[locale];
}
```

Move Japanese copy into the primary source object and add real English/Korean translations for shell labels, tab labels, panel labels, and voice samples. Update `templates.ts` so it pulls labels from `getLocalizedCopy(...)` instead of hard-coded English strings.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/content.test.ts src/namazue/__tests__/state.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/content.ts apps/globe/src/namazue/__tests__/content.test.ts apps/globe/src/namazue/templates.ts
git commit -m "feat(globe): add localized namazue content registry"
```

### Task 3: Add Render Models For Service And Lab

**Files:**
- Create: `apps/globe/src/namazue/viewModel.ts`
- Create: `apps/globe/src/namazue/__tests__/viewModel.test.ts`
- Modify: `apps/globe/src/namazue/templates.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/viewModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServiceViewModel, buildLabViewModel } from '../viewModel';

describe('buildServiceViewModel', () => {
  it('creates a Japanese command bar and route labels', () => {
    const model = buildServiceViewModel({ locale: 'ja', consoleState: 'live', labTab: 'console' });
    expect(model.commandBar.cityLabel).toBe('東京メトロ');
    expect(model.commandBar.routeLabels.lab).toBe('ラボ');
  });
});

describe('buildLabViewModel', () => {
  it('shares locale and console state across tabs', () => {
    const model = buildLabViewModel({ locale: 'ko', consoleState: 'scenario', labTab: 'voice' });
    expect(model.activeTabId).toBe('voice');
    expect(model.console.statusTone).toBe('scenario');
    expect(model.tabs.find((tab) => tab.id === 'voice')?.label).toBe('보이스');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/viewModel.test.ts
```

Expected: FAIL because `viewModel.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/namazue/viewModel.ts` with pure adapters that combine:

- localized shell copy from `content.ts`
- console state data from `CONSOLE_STATES`
- active lab tab metadata from `LAB_TABS`

Example skeleton:

```ts
import { CONSOLE_STATES, LAB_TABS, getLocalizedCopy } from './content';
import type { NamazueUiState } from './state';

export function buildServiceViewModel(state: NamazueUiState) { ... }
export function buildLabViewModel(state: NamazueUiState) { ... }
```

Update `templates.ts` to accept a view model rather than reaching into all content exports directly.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/viewModel.test.ts src/namazue/__tests__/content.test.ts src/namazue/__tests__/state.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/viewModel.ts apps/globe/src/namazue/__tests__/viewModel.test.ts apps/globe/src/namazue/templates.ts
git commit -m "feat(globe): add namazue render view models"
```

### Task 4: Rebuild The Root Service Shell Around The Premium Console Layout

**Files:**
- Modify: `apps/globe/src/namazue/templates.ts`
- Create: `apps/globe/src/namazue/__tests__/serviceView.test.ts`
- Modify: `apps/globe/src/namazue/app.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/serviceView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderServiceView } from '../templates';

describe('renderServiceView', () => {
  it('renders Japanese command bar controls and operational panels', () => {
    const html = renderServiceView({ locale: 'ja', consoleState: 'live', labTab: 'console' });
    expect(html).toContain('東京メトロ');
    expect(html).toContain('イベント概要');
    expect(html).toContain('今すぐ確認');
    expect(html).toContain('リプレイ');
  });

  it('includes locale controls on the service route', () => {
    const html = renderServiceView({ locale: 'ja', consoleState: 'calm', labTab: 'console' });
    expect(html).toContain('data-locale="ja"');
    expect(html).toContain('data-locale="en"');
    expect(html).toContain('data-locale="ko"');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/serviceView.test.ts
```

Expected: FAIL because `renderServiceView` does not yet accept the UI state or localized labels.

**Step 3: Write minimal implementation**

Update `renderServiceView` to:

- accept `NamazueUiState`
- render a Japanese-first command bar
- include locale controls
- preserve the four main operational blocks
- prepare a right-side context rail shell for focused asset and scenario inspection

Bind `[data-locale]` buttons in `app.ts` so locale changes rerender the root shell without a full page load.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/serviceView.test.ts src/namazue/__tests__/viewModel.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/templates.ts apps/globe/src/namazue/__tests__/serviceView.test.ts apps/globe/src/namazue/app.ts
git commit -m "feat(globe): rebuild service shell with premium console layout"
```

### Task 5: Turn `/lab` Into A Shared-State Dynamic Workbench

**Files:**
- Modify: `apps/globe/src/namazue/templates.ts`
- Create: `apps/globe/src/namazue/__tests__/labView.test.ts`
- Modify: `apps/globe/src/namazue/app.ts`
- Modify: `apps/globe/src/namazue/routeModel.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/labView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderLabView } from '../templates';

describe('renderLabView', () => {
  it('renders the Japanese workbench rail and shared state controls', () => {
    const html = renderLabView({ locale: 'ja', consoleState: 'scenario', labTab: 'components' });
    expect(html).toContain('ワークベンチ');
    expect(html).toContain('コンソール');
    expect(html).toContain('コンポーネント');
    expect(html).toContain('シナリオ');
  });

  it('keeps locale controls available inside lab', () => {
    const html = renderLabView({ locale: 'en', consoleState: 'focus', labTab: 'voice' });
    expect(html).toContain('data-locale="ja"');
    expect(html).toContain('data-locale="en"');
    expect(html).toContain('data-locale="ko"');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/labView.test.ts
```

Expected: FAIL because the current lab view does not render a premium workbench shell or localized controls.

**Step 3: Write minimal implementation**

Rebuild `renderLabView` so it renders:

- Workbench Rail
- shared console-state controls
- shared locale controls
- Active Review Surface
- Spec Drawer

Update `app.ts` so lab tab changes and locale changes rerender the same state object. Keep direct deep links working through `routeModel.ts`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/labView.test.ts src/namazue/__tests__/serviceView.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/templates.ts apps/globe/src/namazue/__tests__/labView.test.ts apps/globe/src/namazue/app.ts apps/globe/src/namazue/routeModel.ts
git commit -m "feat(globe): rebuild lab as dynamic workbench shell"
```

### Task 6: Build The Components, Architecture, And Voice Inspectors

**Files:**
- Modify: `apps/globe/src/namazue/content.ts`
- Modify: `apps/globe/src/namazue/templates.ts`
- Create: `apps/globe/src/namazue/__tests__/inspectors.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/inspectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderLabView } from '../templates';

describe('lab inspectors', () => {
  it('renders component inspector metadata labels', () => {
    const html = renderLabView({ locale: 'en', consoleState: 'calm', labTab: 'components' });
    expect(html).toContain('Role');
    expect(html).toContain('Contains');
    expect(html).toContain('Priority');
    expect(html).toContain('Avoid');
  });

  it('renders architecture and voice review content in the selected locale', () => {
    const architecture = renderLabView({ locale: 'ja', consoleState: 'calm', labTab: 'architecture' });
    const voice = renderLabView({ locale: 'ko', consoleState: 'calm', labTab: 'voice' });
    expect(architecture).toContain('状態所有権');
    expect(voice).toContain('좋은 표현');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/inspectors.test.ts
```

Expected: FAIL because the current tabs do not yet expose the premium inspector structure or translated labels.

**Step 3: Write minimal implementation**

Upgrade the remaining lab tabs so they render:

- Components inspector with Role / Contains / Priority / Avoid
- Architecture map with route split, shell hierarchy, state ownership, ops pipeline, file ownership
- Voice review board with locale-aware good/bad examples

Extend `content.ts` with localized inspector labels and localized voice examples so the workbench can review actual copy quality.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/inspectors.test.ts src/namazue/__tests__/labView.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/content.ts apps/globe/src/namazue/templates.ts apps/globe/src/namazue/__tests__/inspectors.test.ts
git commit -m "feat(globe): add premium lab inspectors"
```

### Task 7: Split The CSS Into Maintainable Token And Surface Layers

**Files:**
- Create: `apps/globe/src/namazue/styles/tokens.css`
- Create: `apps/globe/src/namazue/styles/shell.css`
- Create: `apps/globe/src/namazue/styles/panels.css`
- Create: `apps/globe/src/namazue/styles/lab.css`
- Modify: `apps/globe/src/namazue/styles.css`
- Create: `apps/globe/src/namazue/__tests__/stylesContract.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/namazue/__tests__/stylesContract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

describe('styles contract', () => {
  it('defines the premium font and severity tokens', () => {
    expect(tokens).toContain('--font-ui: "Noto Sans JP"');
    expect(tokens).toContain('--font-data: "IBM Plex Mono"');
    expect(tokens).toContain('--tone-priority');
    expect(tokens).toContain('--tone-critical');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/stylesContract.test.ts
```

Expected: FAIL because the split CSS files do not exist yet.

**Step 3: Write minimal implementation**

Create layered CSS files and update `styles.css` to import them:

```css
@import './styles/tokens.css';
@import './styles/shell.css';
@import './styles/panels.css';
@import './styles/lab.css';
```

Use `tokens.css` to define:

- font families
- spacing scale
- panel radii
- line colors
- calm/watch/priority/critical tones

Move the existing shell and panel rules into the new files and restyle them to match the approved `Maritime Metro Command` direction.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/stylesContract.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/styles.css apps/globe/src/namazue/styles apps/globe/src/namazue/__tests__/stylesContract.test.ts
git commit -m "feat(globe): add premium namazue visual system"
```

### Task 8: Final Verification And Manual Cloudflare Deploy

**Files:**
- Modify: `docs/current/product/live-development-todo.md`
- Modify: `docs/current/review/live-shell-architecture.md`

**Step 1: Write the failing test**

Add a checklist item to `docs/current/product/live-development-todo.md` describing the expected visible milestone:

```md
- [ ] Root service and `/lab` share the premium Japanese-first shell and locale controls.
```

**Step 2: Run verification before changes are claimed**

Run:

```bash
npm run test -w @namazue/globe -- src/namazue/__tests__/state.test.ts src/namazue/__tests__/content.test.ts src/namazue/__tests__/viewModel.test.ts src/namazue/__tests__/serviceView.test.ts src/namazue/__tests__/labView.test.ts src/namazue/__tests__/inspectors.test.ts src/namazue/__tests__/stylesContract.test.ts src/namazue/__tests__/routeModel.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 3: Update docs to reflect the shipped architecture**

Update:

- `docs/current/product/live-development-todo.md`
- `docs/current/review/live-shell-architecture.md`

Document:

- shared locale state
- premium shell split
- dynamic `/lab`
- manual deployment milestone

**Step 4: Deploy manually**

Run:

```bash
npx wrangler pages deploy apps/globe/dist --project-name namazue --branch main
```

Expected: a live Pages deployment URL and a healthy `https://namazue.dev` response.

**Step 5: Commit**

```bash
git add docs/current/product/live-development-todo.md docs/current/review/live-shell-architecture.md
git commit -m "docs(globe): record premium shell rollout"
git push origin main
```
