---
quick_id: 260721-vm1
type: quick
slug: fix-red-ci-fallow-job-reduce-buildruleme
status: complete
files_modified:
  - packages/angular-typechecker/src/core/sarif-report.ts
commits:
  - 439532f
---

# Quick 260721-vm1: Reduce buildRuleMeta complexity to clear the fallow CI gate

## One-liner

Split `buildRuleMeta` in `sarif-report.ts` into four per-family metadata builders behind a thin dispatch, dropping its cyclomatic count under fallow's default threshold while keeping the emitted SARIF byte-identical.

## What changed

`buildRuleMeta(record, family)` previously computed `level`/`ruleId` once, then ran four inline `if (family === ...)` branches (extended-diagnostics, tool, template-type-check, typescript) -- 11 cyclomatic / 8 cognitive / CRAP 37.1, over fallow's default complexity threshold, which turned the required `ci` aggregate red on PR #55.

Refactor (extraction only, no fallback config needed):

- Added four helpers, each returning a `RuleMeta` with its own `family` literal, each a verbatim copy of the corresponding original branch body (family literal, level, shortDescription, helpUri, helpText, and every `??` fallback preserved):
  - `buildExtendedRuleMeta(level, ruleId)` -- `EXTENDED_BY_RULE_ID` / `HELP_URI_BASE` / `INFORMATION_URI`.
  - `buildToolRuleMeta(level, ruleId)` -- `TOOL_RULE_TEXT` / `INFORMATION_URI`.
  - `buildTemplateRuleMeta(level, ruleId)` -- `TEMPLATE_TYPE_CHECK_HELP_URI`.
  - `buildTypeScriptRuleMeta(level, ruleId)` -- `TYPESCRIPT_HELP_URI`.
- Rewrote `buildRuleMeta` to compute `level`/`ruleId` once and dispatch: three `if (family === ...)` returns plus a `return buildTypeScriptRuleMeta(...)` fall-through (the `'typescript'` case; `Family` is exactly four literals, so the fall-through was always `'typescript'`).
- Helper `level` param typed as `RuleMeta['level']`; per-branch explanatory comment (the extended-diagnostics `??`-keeps-it-total note) carried onto its helper.
- `formatSarifReport` (incl. its PASS-2 file-less-location ternary, G-35-01 territory), `toSarifLevel`, `fingerprintOf`, and the module header are UNTOUCHED.

Behavior is byte-identical: the `RuleMeta` values are identical to the prior branch outputs, and `RuleMeta` is an internal interface consumed field-by-field, so object key order does not affect the SARIF JSON.

## Verification

| Check | Result |
|-------|--------|
| `npx nx test angular-typechecker` | PASS -- 575 tests / 56 files, incl. the drift-lock `machine-reporters-sarif.integration.spec.ts` UNCHANGED (proves byte-identical SARIF) |
| `npx nx run-many -t lint` (maxWarnings:0) | PASS -- all 3 projects clean |
| `npx nx format:check` | PASS (exit 0) |
| `npx fallow audit --format human --base origin/main` | PASS (exit 0) -- `No issues in 76 changed files (14.47s)`; the `buildRuleMeta` CRAP 37.1 / 11-cyclomatic complexity finding on `sarif-report.ts` is GONE |
| `git diff --stat` | Only `packages/angular-typechecker/src/core/sarif-report.ts` staged/committed; `formatSarifReport` untouched |

The extraction alone cleared fallow, so the documented `.fallowrc.jsonc` complexity-entry fallback was NOT used.

## Deviations from plan

None -- plan executed exactly as written. The extraction cleared the fallow gate without the `.fallowrc.jsonc` fallback (the plan's preferred outcome).

## Commit

- `439532f` refactor(core): split buildRuleMeta into per-family builders to clear the fallow complexity gate (scope `core`, not a phase-35 plan id)

Note: `.planning/config.json` shows as modified in the working tree but was already modified before this task (session-start snapshot) and is orchestrator-tracked; it was NOT staged.

## Self-Check: PASSED

- File `packages/angular-typechecker/src/core/sarif-report.ts` exists and is committed.
- Commit `439532f` exists on `gsd/v0.2.4-enhanced-sarif-reporting-for-github-code-scanning`.
