# Focus Location Relevance Design

## Goal

Make the app answer `what does this mean for me?` by letting a user pick a place and immediately seeing incident relevance for that place.

## Problem

The app now explains incidents clearly at the national/event level, but it still does not connect that incident to the user's own city or current area. A user can search a place on the globe, but that search only moves the camera. It does not change the meaning layer.

That leaves the most important user question unanswered:

- `How relevant is this incident for where I am watching from?`

## Recommended Approach

Promote the searched place into shared UI state as a `focus location`, then use a pure presentation helper to translate the selected or hero incident into place-specific meaning.

This keeps the implementation aligned with the current product direction:

- general meaning first
- personal relevance next
- evidence still available on demand

## Scope

### In scope

- Persist a focus location when the user selects a geocoder result.
- Compute distance and rough expected shaking at that focus location.
- Show that relevance in the hero card and detail panel.

### Out of scope for this pass

- Automatic browser geolocation
- Persisting focus location across reloads
- Region-specific evacuation routing or municipal hazard overlays

## State Model

Add `focusLocation` to app state:

- `label`
- `lat`
- `lng`
- `source`

For this pass, `source` only needs to distinguish search-based focus from future device-based focus.

## Presentation Rule

If a focus location exists:

- show distance from epicenter to that place
- show estimated shaking at that place
- phrase it in plain language

If no focus location exists:

- render nothing extra

The UI should not nag the user. Relevance appears only when it can be grounded in a chosen place.

## Copy Rule

The relevance layer should sound like a calm operational summary, not a dramatic alert.

Examples:

- `Tokyo is about 42 km from the epicenter. Around JMA 4 shaking is possible there.`
- `오사카는 진원에서 약 35km 떨어져 있으며, 현지에서는 JMA 3 정도의 흔들림이 예상됩니다.`

## Testing Strategy

Use TDD around a pure builder in `presentation.ts`:

1. No focus location returns `null`.
2. A nearby focus location returns distance plus estimated JMA severity.
3. Hero/detail summaries surface that relevance block when focus exists.

Then wire the geocoder so search selection updates the shared focus state and verify the hero/detail views react.
