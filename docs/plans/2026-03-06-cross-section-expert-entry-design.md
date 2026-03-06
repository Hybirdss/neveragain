# Cross-Section Expert Entry Design

**Problem:** The product is intended to be consumer-first, but the Cross Section expert tool can still leak into the initial experience through always-mounted UI, persistent `viewPreset` state, and non-explicit activation paths. This breaks the intended "meaning first, evidence on demand" hierarchy.

**Goal:** Keep Cross Section available for expert users while making the default journey strictly judgment-first for general users.

---

## Product Intent

- The first screen should answer "am I okay?" before showing any expert tooling.
- Expert tooling must require explicit intent.
- Expert mode must never persist across unrelated user flows.

## Interaction Rules

### Default entry

- App boot always starts in overview.
- `viewPreset` must resolve to `default` unless the user explicitly activates an expert tool.
- Cross Section overlay must be hidden from the initial visual and accessibility tree.

### Activation

- User selects an earthquake.
- User opens `Advanced tools`.
- User chooses `Cross Section`.

Only then may the overlay become visible and `viewPreset` move to `crossSection`.

### Exit and reset

- Deselect earthquake: force `viewPreset` back to `default`.
- Select a different earthquake while Cross Section is active: force `viewPreset` back to `default`.
- Collapse mobile sheet back to `peek`: force `viewPreset` back to `default`.
- `Escape` may still close an already-open Cross Section.

### Non-goals

- No separate expert mode routing.
- No new settings surface.
- No redesign of the cross-section chart itself in this pass.

## Technical Approach

- Add a small pure helper module that centralizes "should expert preset reset?" logic.
- Use `hidden`/`aria-hidden`/`inert` style gating so the overlay is absent from the initial UX and accessibility flow until explicitly opened.
- Remove the global keyboard shortcut that can open Cross Section without the intended UI path.

## Verification

- Unit tests for preset reset behavior on deselect, event switch, and mobile peek.
- Browser verification that initial load does not expose Cross Section text or close controls.
- Existing globe test suite and production build stay green.
