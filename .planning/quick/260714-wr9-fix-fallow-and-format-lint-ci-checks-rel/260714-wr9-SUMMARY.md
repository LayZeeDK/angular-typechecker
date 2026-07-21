---
status: complete
phase: 260714-wr9
plan: 01
subsystem: ci-config
tags: [fallow, prettier, format-lint, release-pr, config-only]
requires:
  - The 260714-sl6 e2e-CI fix (bd2d243), which unblocked the dress-rehearsal PR that surfaced these two blockers
provides:
  - A GREEN nx format:check --base origin/main (zero unformatted files)
  - A PASS fallow audit --base origin/main (zero gating findings on the feature->main diff)
affects:
  - The v0.2.1 Release-PR ci check (unblocks it)
tech-stack:
  added: []
  patterns:
    - "fallow false positives are DECLARED in .fallowrc.jsonc (entry / ignoreDependencies / rules off / health.ignore / duplicates.ignore), never fixed by refactoring tested code (CLAUDE.md fallow guidance)"
    - "committed real-CLI-output fixtures are .prettierignore'd (root-anchored) to preserve fidelity"
key-files:
  created: []
  modified:
    - .fallowrc.jsonc
    - .prettierignore
    - packages/angular-typechecker/src/core/angular-cli-wiring.spec.ts
decisions:
  - "@angular-devkit/architect stays an INTENTIONAL optional peerDependency; the test-only-dependencies rule is turned off rather than moving it to devDependencies"
  - "The two fallow clone groups (verbatim Verdaccio bootstraps + mirrored walk accumulation tails) are suppressed via duplicates.ignore, NOT extracted -- extraction of the 38-line core tail was assessed and rejected as a risky core refactor (threads 4 mutable accumulators across two hot paths)"
  - "The ng-cli-workspace fixture is .prettierignore'd (leading-slash root-anchored) rather than reformatted, preserving ng new / ng g library fidelity"
metrics:
  duration: ~9 min
  completed: 2026-07-14
  tasks: 2
  files: 3
---

# Quick Task 260714-wr9: Fix fallow + format-lint CI checks Summary

Config-only + one whitespace-only Prettier pass that clears the two Release-PR-blocking CI
checks (`fallow` audit + `format-lint`) surfaced by the 260714-sl6 dress-rehearsal PR #35;
no product-logic change and no `package.json` version mutation.

## What was done

### Task 1 -- config + format edits

**`.fallowrc.jsonc` (five additive, documented edits):**

- **FAL-07 `entry` +5** -- five config-only-reachable files (same false-positive class as the
  existing drift tripwires + install-e2e global-setup): the ng-cli-e2e vitest `globalSetup`,
  `src/index.drift.ts` (tsconfig.drift.json `files`), the two `schematics/*/schematic.ts`
  convertNxGenerator re-exports (collection.json string refs), and the `node`-run e2e-timing
  CLI tool. Each is reached by config/string reference, never the import graph.
- **FAL-08 `ignoreDependencies` +2** -- `@angular-devkit/core`, `@angular-devkit/schematics`
  (Angular-CLI-provided, type-only imports by the 24-06 vanilla ng-add schematic, erased at
  compile). Same package-level `unlisted-dependencies` false positive as `@angular/core`;
  @nx/dependency-checks already ignores `@angular-devkit/schematics` and gates the manifest.
- **FAL-09 `rules.test-only-dependencies: "off"`** -- `@angular-devkit/architect` is an
  INTENTIONAL optional peerDependency (23-02, the Architect `ng run` builder peer), imported
  by `builder.integration.spec`. Not moved to devDependencies. Documented `ignoreDependencies`
  fallback if a future fallow ever ignores the toggle.
- **FAL-10 `health.ignore` +4 globs** -- `core/run-typecheck.ts`,
  `generators/configuration/generator.ts`, `schematics/ng-add/schematic.ts`, `tools/**`.
  Reviewed essential-complexity functions, same review-blessed class as `walk-references.ts`.
  Declared, not refactored (CLAUDE.md fallow guidance).
- **FAL-11 new `duplicates.ignore` block** -- suppresses both clone groups: the two
  byte-identical Verdaccio-bootstrap global-setups (install-e2e + ng-cli-e2e) and the
  deliberately-mirrored run-typecheck.ts / walk-references.ts 38-line accumulation tails.
  `ignore` is additive over the built-in generated-framework ignores.

**`.prettierignore`:** ignored the committed `ng new` + `ng g library` fixture dir
`/e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/` (leading-slash root-anchored
for precedent consistency), with a comment matching the existing fixture/lockfile style. Not
Prettier-owned -- reformatting would destroy Angular CLI output fidelity.

**`angular-cli-wiring.spec.ts`:** `nx format:write` on the one real Prettier-owned source. The
sole change is Prettier reflowing one over-long `resolveTsConfigOverride(...)` call to
multi-line and adding a trailing comma (Prettier 3 `trailingComma: "all"` for multi-line
constructs). Formatting-only, semantically a no-op.

### Task 2 -- full local CI-parity verification

Ran the exact CI commands locally on the feature branch (main checkout, no worktree). All
green. The `test-only-dependencies: off` toggle cleared `@angular-devkit/architect` without
needing the `ignoreDependencies` fallback.

## Verification (exact CI commands, all GREEN / PASS)

| Command | Result |
|---------|--------|
| `NX_DAEMON=false npx nx format:check --base origin/main` | GREEN, exit 0, zero files listed |
| `npx fallow audit --format human --base origin/main` | verdict PASS, exit 0 -- "No issues in 333 changed files" |
| `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 372 tests / 39 files passed, exit 0 (all guards incl. ci-e2e-coverage-guard green) |
| `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | "All files pass linting", exit 0 (maxWarnings:0, @nx/dependency-checks unaffected) |

- Source change is whitespace-only: `git diff -w` shows only a Prettier line-reflow; stripping
  all whitespace leaves exactly one difference -- a Prettier-added trailing comma on the
  multi-line call (a formatting artifact, no token/logic change).
- `packages/angular-typechecker/package.json` version unchanged (`0.2.0`).
- `@angular-devkit/architect` still an optional peerDependency (not moved).
- The `ng-cli-workspace` fixture dir has zero diff (preserved verbatim).
- fallow's tsconfig-chain WARNs are pre-existing intentional broken-chain fixtures
  (`solution-style-broken-ref` / `solution-style-selfref`), not gating findings.

## Deviations from Plan

None -- plan executed exactly as written. The plan's three INFO notes were folded in as
directed: the leading-slash `.prettierignore` path was used; the plan's "25 fixture files"
count is cosmetic (the dir ignore catches all regardless -- fallow/format now report zero);
the stray duplicate closing tag in the plan was ignored. The `test-only-dependencies` toggle
cleared `@angular-devkit/architect` on the first try, so the documented `ignoreDependencies`
fallback was not needed.

## Commit

- `3cfa12d` -- `chore(ci): satisfy fallow + format-lint gates for the v0.2.1 Release PR`
  (`.fallowrc.jsonc`, `.prettierignore`, `angular-cli-wiring.spec.ts`)

Docs artifacts (this SUMMARY, STATE.md, PLAN) are left uncommitted for the orchestrator's docs
commit, per task constraints. ROADMAP.md not touched.

## Self-Check: PASSED

- `.fallowrc.jsonc`, `.prettierignore`, `angular-cli-wiring.spec.ts` all present and modified in commit `3cfa12d`.
- Commit `3cfa12d` exists in git log.
- All four verification commands exited 0.
