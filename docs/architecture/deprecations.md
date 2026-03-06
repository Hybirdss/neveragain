# Deprecations

This registry tracks temporary compatibility shims and the dates when they must stop accepting imports.

The JSON block below is machine-read by `tools/check-deprecations.mjs`.

```json
{
  "enforced": [
    {
      "path": "apps/worker/src/lib/consoleOps.ts",
      "replacement": "@namazue/application-console",
      "freezeOn": "2026-03-07",
      "removeBy": "2026-03-21",
      "owner": "worker"
    },
    {
      "path": "apps/globe/src/core/shell.ts",
      "replacement": "apps/globe/src/shell/consoleShell.ts",
      "freezeOn": "2026-03-07",
      "removeBy": "2026-03-21",
      "owner": "globe"
    }
  ],
  "planned": [
    {
      "path": "apps/worker/src/lib/db.ts",
      "replacement": "@namazue/adapters-storage",
      "freezeOn": null,
      "removeBy": "2026-03-28",
      "owner": "worker"
    },
    {
      "path": "apps/globe/src/data/eventEnvelope.ts",
      "replacement": "@namazue/domain-earthquake/eventEnvelope",
      "freezeOn": null,
      "removeBy": "2026-03-28",
      "owner": "globe"
    },
    {
      "path": "apps/globe/src/ops/replayMilestones.ts",
      "replacement": "@namazue/domain-replay",
      "freezeOn": null,
      "removeBy": "2026-03-28",
      "owner": "globe"
    },
    {
      "path": "apps/globe/src/ops/scenarioDelta.ts",
      "replacement": "@namazue/domain-scenario/scenarioDelta",
      "freezeOn": null,
      "removeBy": "2026-03-28",
      "owner": "globe"
    }
  ]
}
```

## Policy

1. `enforced` entries must have zero inbound imports outside the shim file itself.
2. `planned` entries may still have importers, but each one needs a concrete replacement path and removal date.
3. Any shim that survives past `removeBy` blocks CI until it is removed or its date is explicitly renegotiated.
