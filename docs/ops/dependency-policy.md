# Dependency And Vulnerability Policy

Last updated: 2026-03-06  
Owner: `codex`  
Scope: npm workspaces and GitHub Actions dependencies.

## Automation Baseline

- Dependabot runs weekly for:
  - `npm` dependencies (repo root workspace graph)
  - `github-actions` dependencies
- Dependabot PRs use `dependencies` and `security` labels.
- Grouped minor/patch npm updates are allowed to reduce PR noise.

## CI Gate Rules

- CI includes `Dependency Audit (High/Critical)` job.
- Gate command: `npm audit --audit-level=high`.
- `critical` and `high` vulnerabilities are merge-blocking.
- `moderate` and `low` are non-blocking in phase 1, but must be triaged and tracked.

## Severity SLA

| Severity | Triage Start | Remediation Target | Merge Policy |
| --- | --- | --- | --- |
| critical | within 24h | within 72h | blocked until fix or approved exception |
| high | within 2 business days | within 7 days | blocked until fix or approved exception |
| moderate | within 7 days | within 30 days | warning only (phase 1) |
| low | within 14 days | next planned dependency sweep | warning only (phase 1) |

## Ownership And Assignment

- Initial owner follows `CODEOWNERS` for impacted package paths.
- If ownership is ambiguous, assign to repository maintainer `@yunsu`.
- Security-related dependency issues require one additional reviewer beyond author.

## Triage Workflow

1. Capture advisory details (ID, affected package, current version, fixed version, severity).
2. Create or update a tracking issue with owner and due date based on SLA.
3. Choose disposition:
   - upgrade package,
   - apply temporary mitigation,
   - accept risk with expiration.
4. Link remediation PR and include verification output (`npm run check` + audit result).
5. Close tracking issue only after deploy confirmation.

## Exception Process

- Exceptions for `high/critical` require:
  - explicit rationale,
  - compensating control,
  - expiry date,
  - approver recorded in PR description.
- Expired exceptions immediately return to blocking state.
