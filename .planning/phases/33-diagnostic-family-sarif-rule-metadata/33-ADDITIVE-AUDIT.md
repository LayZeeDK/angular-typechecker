# Phase 33: Additive-only audit (D-12) versus `angular-typechecker@0.2.3`

**Audited:** 2026-07-21
**Requirement:** D-12 (v0.2.4 SARIF-only boundary + additive-only charter; RULE-01..04)
**Baseline tag:** `angular-typechecker@0.2.3` (confirmed via `git rev-parse
angular-typechecker@0.2.3^{commit}`; resolves to `f12775c` -- the last shipped version)
**HEAD:** `974524b` (41 commits since the tag)
**Scope:** the whole Phase 33 (plans 33-01 + 33-02) -- the SOLE release-bearing change in
milestone v0.2.4: the SARIF reporter's flip from a fixed 18-NG8xxx catalog to an ON-DEMAND
catalog (one rule per DISTINCT fired ruleId) where each rule carries `properties.tags` (the
diagnostic family), `defaultConfiguration.level`, and `help.text`; the new pure
`diagnostic-family.ts` classifier; the corrected `sarif-report.ts` header comment; and this
plan's real-fixture integration proof across all four families plus the regenerated
integration snapshot.
**Method:** full local battery (all green) + `git diff angular-typechecker@0.2.3..HEAD` per
published-surface path + the plugin-manifest dependency-diff + the unified
`nx release --dry-run` bump check. Mirrors the shipped `32-ADDITIVE-AUDIT.md` method.

## Verdict

**ADDITIVE-ONLY HOLDS.** Versus `angular-typechecker@0.2.3`, the change is confined to the
SARIF path. Every do-not-touch surface -- the JSON reporter (`json-report.ts`), the human
formatter (`format-report.ts`), the shared projection (`diagnostic-record.ts`), the extended
catalog (`extended-catalog.ts`), the public barrel (`src/index.ts`), and the barrel drift
tripwire (`src/index.drift.ts`) -- is **byte-unchanged**, as are the published manifest, every
executor/builder/generator schema, `project.json`, and every `*.json` plugin descriptor. The
observable changes are all **additive**: the SARIF `rules[]` array now reflects the ACTUAL run
(one rule per fired ruleId, replacing the always-18-NG catalog) and each rule gained the
OPTIONAL `properties.tags` / `defaultConfiguration.level` / `help.text` fields, while every
result gained the OPTIONAL `ruleIndex` (auto-emitted by `node-sarif-builder`'s
`completeRunFields()` now that every fired ruleId is cataloged). No field was removed, no
ruleId was renamed, the `ruleId === code` contract stands, and the SARIF payload stays
schema-valid over every real fixture (`validateSarif` green). The published `dependencies`
block gained **nothing** (still `@nx/devkit`, `node-sarif-builder`, `nx`, `tslib`) and the
package `version` stays `0.2.3`. No breaking change exists, so the milestone remains on the
**0.2.x** line -- **v0.3.0 is NOT triggered**. The unified `nx release --dry-run` derives a
**PATCH** bump `0.2.3 -> 0.2.4` from the conventional-commit history (the `0.2.3 -> 0.2.4`
cut + tag + npm publish are the separate human-gated Release-PR flow, NOT this phase).

## 1. Full local battery (all green)

Every gate below exited 0. Counts are from the cached Nx task output at HEAD `974524b`.

| # | Gate | Command | Exit | Result |
|---|------|---------|------|--------|
| 1 | Unit tier | `npx nx test angular-typechecker` | 0 | 53 files / 565 tests passed (incl. the re-aimed `sarif-report.spec.ts`, the new `diagnostic-family.spec.ts`, and the untouched JSON payload key drift-lock). |
| 2 | Integration tier | `npx nx integration angular-typechecker` | 0 | 24 files / 152 tests passed (incl. `machine-reporters-sarif.integration.spec.ts`, now 21 tests: schema-valid + family tags across all four families over real cold-compiler fixtures). |
| 3 | Typecheck | `npx nx typecheck angular-typechecker` | 0 | All 3 tsc projects (`tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json`) -- the barrel-drift tripwire proves the five public exports are byte-intact. |
| 4 | Spec type-check | `npx tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` | 0 | The widened local SARIF interfaces (rule tags/level/help, result `ruleIndex`) type-check; `nx test` (esbuild) alone would green-mask a spec type error. |
| 5 | Lint | `npx nx lint angular-typechecker` | 0 | maxWarnings 0; `@nx/dependency-checks` active -- no missing/obsolete/mismatched dependency, `node-sarif-builder` correctly classified, NO new dependency (D-09). |
| 6 | Format | `npx nx format:check` | 0 | Prettier clean across the changed files. (The plan text names `nx run angular-typechecker:format:check`, but that target does NOT exist in this project; `npx nx format:check` is the repo's real gate, matching how Wave 1 verified -- see Deviations in 33-01-SUMMARY and 33-02-SUMMARY.) |
| 7 | Build | `npx nx build angular-typechecker` | 0 | `@nx/js:tsc` emits the CommonJS `.js` + `.d.ts`. |

**Battery note (plan-command accuracy):** the plan `<verification>` battery and the orchestrator
brief both describe `npx nx test angular-typechecker` as running "unit plus integration."
It does NOT: `packages/angular-typechecker/vitest.config.mts` explicitly excludes
`**/*.integration.spec.ts`, and the real-compiler specs run under the SEPARATE `integration`
target (`vitest.integration.config.mts`). The integration tier -- where this plan's SARIF
integration spec and its regenerated snapshot live -- is therefore gated by `npx nx
integration angular-typechecker` (gate 2 above), which was run in addition to the six
plan-listed checks. Both tiers are green.

## 2. Git-diff verdict per audited path

### 2a. The changed-file table (the D-12 crux)

`git diff --stat angular-typechecker@0.2.3..HEAD -- packages/angular-typechecker/` lists
EXACTLY seven files -- and the same seven when scoped to `packages/angular-typechecker/src/`
-- so nothing else in the whole published package changed:

| Path | Classification | Plan | Why additive |
|------|----------------|------|--------------|
| `src/core/diagnostic-family.ts` | **NEW** | 33-01 | Pure `familyOf(record): Family` + the `Family` union; reads only `rawCode` + `file`, adds NO field to `DiagnosticRecord`, imported by `sarif-report.ts` only, NOT re-exported from the barrel. 0 files at the tag -> 1 at HEAD. |
| `src/core/diagnostic-family.spec.ts` | **NEW** | 33-01 | Test tier only; never shipped. |
| `src/core/sarif-report.ts` | **MODIFIED (additive)** | 33-01 | Replaced the unconditional 18-NG loop with a PASS-1 `Map<ruleId, RuleMeta>` fold + one decorated rule per distinct fired ruleId; added `properties.tags`/`defaultConfiguration.level`/`help.text` via the `.rule` mutation escape hatch (no cast, no new dependency); corrected the stale header comment. `formatSarifReport`'s signature is unchanged and it is NOT barrel-exported. The emitted `rules[]` widened in shape and shrank to the fired set; no field was removed. |
| `src/core/sarif-report.spec.ts` | **MODIFIED** | 33-01 | Re-aimed the "18 rules always present" assertions to "rules match the fired ruleIds, each with tags/level/help"; test tier only. |
| `src/core/__snapshots__/sarif-report.spec.ts.snap` | **REGENERATED SNAPSHOT** | 33-01 | `rules[]` collapsed 18 -> `[TS2322, ATC90001]`, each carrying tags/level/help; both results gained a correct `ruleIndex`. Test artifact; never shipped. |
| `src/core/machine-reporters-sarif.integration.spec.ts` | **MODIFIED** | 33-02 | Added family-tag assertions across all four families over real fixtures + a widened local SARIF interface chain + a loud rule-by-id lookup. Test tier only. |
| `src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap` | **REGENERATED SNAPSHOT** | 33-02 | `layout-b-host` `rules[]` collapsed 18 -> `[NG8002 (template-type-check), TS2322 (typescript)]` with results at `ruleIndex` 0/1; `global-diagnostics` collapsed 18 -> `[TS2318 (typescript)]` with all ten results at `ruleIndex` 0. Each rule carries tags/level/help; every URI stays repo-relative forward-slash (no drive letter / backslash). Test artifact; never shipped. |

This is precisely the set the plan permits. No unexpected path appeared: no boundary breach.

### 2b. Do-not-touch surfaces (empty diff)

`git diff --stat angular-typechecker@0.2.3..HEAD -- <path>` is EMPTY for each:

| Audited path | Diff verdict |
|--------------|--------------|
| `src/core/json-report.ts` | **UNCHANGED** (empty diff) |
| `src/core/format-report.ts` | **UNCHANGED** (empty diff) |
| `src/core/diagnostic-record.ts` | **UNCHANGED** (empty diff -- `DiagnosticRecord` gained no field, D-01) |
| `src/core/extended-catalog.ts` | **UNCHANGED** (empty diff -- D-10 schema untouched; NG `help.text` seeds from the existing `shortDescription`) |
| `src/index.ts` (public barrel) | **UNCHANGED** (empty diff -- the five exports intact) |
| `src/index.drift.ts` (barrel tripwire) | **UNCHANGED** (empty diff; compiles under `tsconfig.drift.json` in gate 3) |
| `src/core/json-report.spec.ts` + `__snapshots__/json-report.spec.ts.snap` | **UNCHANGED** (empty diff -- the JSON payload key drift-lock and snapshot) |
| `src/core/format-report.spec.ts` + `__snapshots__/format-report.spec.ts.snap` | **UNCHANGED** (empty diff -- the human snapshot) |

Because the `src/`-scoped `--stat` diff lists ONLY the seven files in 2a, every other file
under `src/` (all other reporters, adapters, generators, and specs) is byte-unchanged by
construction.

### 2c. The dependency proof (the D-09 crux)

`git diff angular-typechecker@0.2.3..HEAD -- packages/angular-typechecker/package.json` is
EMPTY -- the manifest is byte-unchanged. The `dependencies` block at HEAD is:

```
"dependencies": {
  "@nx/devkit": "23.0.1",
  "node-sarif-builder": "^4.1.0",
  "nx": "^23.0.0",
  "tslib": "^2.3.0"
}
```

The set is identical to `@0.2.3` -- Phase 33 added NOTHING (D-09). No dev-only validator
leaked into the shipped manifest: the HEAD manifest contains no `ajv` token
(`node -e "...JSON.stringify(p).includes('ajv')"` -> `false`); `ajv`/`ajv-formats` remain ROOT
devDependencies backing the dev-only SARIF schema validator in the never-published
`@workspace/test-util`. Gate 5 (`nx lint` at maxWarnings 0) ran `@nx/dependency-checks` with
no finding, cross-confirming the dependency classification.

## 3. Remaining boundary claims (D-12)

| Claim | Evidence |
|-------|----------|
| `FORMAT_VERSION` stays `1` | `json-report.ts:31` = `const FORMAT_VERSION = 1;` and `:118` writes it into the payload; the module is byte-unchanged (2b). |
| JSON payload key drift-lock passes unedited | `json-report.spec.ts` + its snapshot are byte-unchanged (2b) and green in gate 1 (unit tier). `DiagnosticRecord` gained no field (D-01), so the 9-key contract is intact. |
| JSON + human snapshots unchanged | `__snapshots__/json-report.spec.ts.snap` and `__snapshots__/format-report.spec.ts.snap` show an empty diff vs baseline (2b). |

## 4. Release shape (no cut performed)

- **Bump:** `npx nx release --dry-run` (the UNIFIED command -- NOT the `nx release version`
  subcommand, which rejects this repo's top-level `release.git` block per AGENTS.md) resolved
  the current version as `0.2.3` from the `angular-typechecker@0.2.3` tag, derived the
  specifier as `patch` from the conventional-commit history, and proposed new version
  **`0.2.4`** (a PATCH bump). The `feat(core)` catalog commits map to a patch under the
  repo's pre-1.0 `adjustSemverBumpsForZeroMajorVersion` shift.
- **No breaking marker:** the commit log since the baseline tag carries NO breaking-change
  signal -- `git log angular-typechecker@0.2.3..HEAD` has no subject with `!` before the
  colon and no `BREAKING CHANGE:` footer. So the bump is not shifted or capped, and the
  additive-only charter holds.
- **Nothing mutated:** the dry run wrote nothing -- `packages/angular-typechecker/package.json`
  `version` is still `0.2.3`, `CHANGELOG.md` is unchanged, and no `angular-typechecker@0.2.4`
  git tag exists. This phase performs NO release cut (the cut is the separate human-gated
  Release-PR flow; `main` is PR-only).

## 5. D-12 disposition + closing verdict

- **SARIF-only boundary proven:** the JSON reporter, human formatter, shared diagnostic
  record, extended catalog, public barrel, and barrel drift tripwire are all byte-unchanged
  (2b); `FORMAT_VERSION` stays `1` and the JSON/human snapshots are untouched (3).
- **Additive-only proven:** the whole-package diff vs `@0.2.3` lists exactly the seven
  SARIF-path files (2a); the SARIF `rules[]`/`ruleIndex` changes are additive/widen-only and
  stay schema-valid over every real fixture; no public API, executor id, schema, dependency,
  or version was narrowed, removed, or renamed.
- **No new dependency:** the published `dependencies` gained nothing and no dev-only validator
  leaked into the manifest (2c), cross-confirmed by the dependency-checks lint gate.
- **Charter satisfied:** ADDITIVE-ONLY **HOLDS**. There is no breaking change, so the
  milestone stays on the **0.2.x** line and the **v0.3.0 breaking-change escape hatch stays
  UNTRIGGERED**. The unified release dry run confirms the additive **patch** bump
  `0.2.3 -> 0.2.4`. The package `version` stays `0.2.3` -- this phase cuts NO release.

---

*Phase: 33-diagnostic-family-sarif-rule-metadata*
*Audited: 2026-07-21 against `angular-typechecker@0.2.3` (baseline `f12775c`, HEAD `974524b`)*
