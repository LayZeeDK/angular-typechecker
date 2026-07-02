---
slug: pr15-review-triage
created: 2026-07-02
kind: quick
validate: true
---

# Quick task: PR #15 review triage + fixes

Merge, deduplicate, audit, and triage three PR #15 code-review reports
(`/pr-review-toolkit:review-pr all`, `/code-review:code-review`, `/code-review max`),
then address every triaged finding. Fixes land on the PR branch
`gsd/v0.1.0-configuration-init-generators-and-executor-rename`.

## Triage outcome

29 raw findings -> 21 unique. See the session triage table. CONFIRMED items get a
code fix; F7 is a recorded decision (no behavior change); F20/F12 are deferred with
rationale (F20 gets a portability doc note).

## Commit groups (atomic)

1. `fix(core)` engine: F1 (parsed.errors kept), F2 (all-not-found union), F3+F14
   (per-leaf/existing-leaf 500 -> infra rethrow), F8 (boundary over-keep), F4
   (`'duplicate'` reason), F11a (extract `EMIT_NEUTRALIZING_OPTIONS`). + unit/integration tests.
2. `fix(executor)` F5: conditional skipped-reference advisory wording.
3. `fix(generators)` F9a (flat tsconfig fallback), F21 (empty targetName), F10
   (dead tasks), F16/F20 (schema doc). + resolveTsConfig tests (F9b).
4. `test(core)` F6 (schema-parity keyof binding), F13 (member uniqueness), F15
   (drift comments), F17 (guard message), F19 (target-defaults drift test).
5. `ci` F18: `formatlint` path filter so non-`.planning` doc PRs run format-lint.
6. `docs(core)` F7 decision record + nested-solution limitation note.

## Validation (--validate)

`nx test angular-typechecker`, `nx typecheck-drift`, `nx run-many -t lint`,
`nx format:check`, `nx build angular-typechecker`. actionlint on ci.yml if available.
