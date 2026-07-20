# Phase 32: Additive-only audit (ADD-01) versus `angular-typechecker@0.2.2`

**Audited:** 2026-07-19
**Requirement:** ADD-01 (v0.2.3 ADDITIVE-ONLY charter)
**Baseline tag:** `angular-typechecker@0.2.2` (confirmed present via `git tag -l`; resolves to
`6d3214d` -- the last shipped version)
**HEAD:** `6ca7628` (91 commits since the tag)
**Scope:** the whole v0.2.3 milestone (Phases 30-32) -- the Phase-30 widened `renderReport`
seam + the zero-dependency JSON reporter + the threaded `--format`/`--quiet`/`--color` +
the optional `CoreResult.totalFilesCount`; the Phase-31 lazy-`import()`ed `node-sarif-builder`
SARIF 2.1.0 reporter + the 18-NG8xxx catalog; and Phase-32's verification tier + docs.
**Method:** standing-guard cross-check (all green) + `git diff angular-typechecker@0.2.2..HEAD`
per published-surface path + `git ls-tree` net-new confirmation + the plugin-manifest
dependency-diff.

## Verdict

**ADDITIVE-ONLY HOLDS.** Across Phases 30-32, the Nx executor id
(`angular-typechecker:typecheck`), the `src/index.ts` public barrel (the five exports
`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`,
`SkippedReference`), the Angular CLI builder (`src/builders/typecheck/builder.ts` +
`builders.json`), and every pre-existing generator schema are **byte-unchanged** vs
`0.2.2`. The only consumer-observable changes are **widen-only** (the OPTIONAL `format`
enum added to the executor and builder `schema.json`/`schema.d.ts`, with `required` and
`additionalProperties` unchanged) and **additive** (the OPTIONAL `CoreResult.totalFilesCount`
field; the net-new reporter modules `src/core/{json-report,sarif-report,diagnostic-record,
extended-catalog}.ts`, all 0 files at the tag). `renderReport`, `formatJsonReport`, and
`formatSarifReport` are NOT in the public barrel. The plugin `dependencies` gained **exactly
one** entry since `@0.2.2` -- `node-sarif-builder@^4.1.0`; the SARIF-schema validator
(`ajv`/`ajv-formats`) is a ROOT devDependency only and never reaches the shipped manifest.
Nothing was narrowed, removed, or renamed. No breaking change exists, so the milestone stays
on the **0.2.x** line -- **v0.3.0 is NOT triggered**. The package `version` stays `0.2.2`
(the `0.2.2 -> 0.2.3` bump is the human-gated Release-PR flow, not this phase).

## 1. Guard cross-check map

Additive-only is ENFORCED by standing guards carried forward from prior phases, joined by
the v0.2.3 reporter-surface guards. All are present and green in this phase's `nx test`
(51 files / 534 tests), `nx typecheck` (3 tsc commands), and `nx lint` (`maxWarnings:0`)
runs, plus the sibling-plan integration tier (32-01: 24 files / 139 tests) and the shipped-
tarball e2e (32-02: `install-e2e` 11 files / 40 tests).

| Additive-only surface | Standing guard | Status |
|-----------------------|----------------|--------|
| `executors` unchanged; `angular-typechecker:typecheck` executor id stays; `builders` field additive | `src/builders/typecheck/nx-surface-regression.spec.ts` | present + green |
| `generators`/`schematics` unchanged; `ng-add` present in `collection.json` yet ABSENT from `generators.json` (so `nx add` stays `<pkg>:init`) | `src/schematics/configuration/nx-generators-surface-regression.spec.ts` | present + green |
| Executor schema parity (keys, `required`, `additionalProperties`, defaults incl. the new `format` enum) | `src/executors/typecheck/schema-parity.spec.ts` | present + green |
| Sanitized builder schema parity (mirrors the executor schema incl. `format`) | `src/builders/typecheck/schema-parity.spec.ts` | present + green |
| Configuration generator schema parity | `src/generators/configuration/schema-parity.spec.ts` | present + green |
| Init generator schema parity | `src/generators/init/schema-parity.spec.ts` | present + green |
| Static published-manifest contract (peers, optional peers, `builders`/`schematics` fields, `ng-add.save`, files, engines, `nx` direct dep) | `src/package-manifest.spec.ts` | present + green |
| Public barrel export set (`src/index.ts`) locked -- all five exports incl. the three type-only | `src/index.drift.ts` (rides the `typecheck` drift `tsc --noEmit -p tsconfig.drift.json`) | present + green |
| `@nx/dependency-checks` -- no missing/obsolete/mismatched dep; `node-sarif-builder` correctly classified with NO `ignoredDependencies` entry (A1) | `nx lint angular-typechecker` (`maxWarnings:0`) | green |
| Docs claims drift-locked against `HELP_TEXT` + the payload shape; CHANGELOG 0.2.3 hygiene | `src/machine-readable-docs.spec.ts` (32-04) | present + green |
| VER-02: real-compiler JSON + SARIF payloads schema-valid + byte-stable across the 6-cell matrix | `src/core/machine-reporters-{json,sarif}.integration.spec.ts` (32-01) | present + green |
| VER-03: the shipped tarball emits parseable JSON + schema-valid SARIF across all three adapters with exit-code parity | `e2e/*/...` cli-exit-codes / ng-add-ng-run / install-smoke `--format` blocks (32-02) | present + green |

The barrel-drift tripwire (`src/index.drift.ts`, run under `tsconfig.drift.json`) is the
authoritative ADD-01 leg (a): a removed or renamed barrel export fails `tsc --noEmit`
LOUDLY. This phase's `nx typecheck angular-typechecker` ran all three tsc commands
(`tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json`) and succeeded, so the
five exports are proven byte-intact. `nx lint` (leg c) is the standing dependency-checks
guard: it passes at `maxWarnings:0` with `node-sarif-builder` NOT in `ignoredDependencies`
(the ignore list is only `nx`, `@angular-devkit/architect`, `@angular-devkit/schematics`,
`rxjs`), proving the lazy `await import('node-sarif-builder')` is SEEN and correctly
classified (A1, resolved in Phase 31 31-01, re-confirmed here).

## 2. Git-diff verdict per audited path

Commands run against the `0.2.2` baseline (leg b), e.g.
`git diff angular-typechecker@0.2.2..HEAD -- packages/angular-typechecker/src/index.ts`:

| Audited path | Diff verdict | Detail |
|--------------|--------------|--------|
| `src/index.ts` (public barrel) | **UNCHANGED** | Empty diff. The five exports (`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`) are the same names in the same shape; `renderReport`/`formatJsonReport`/`formatSarifReport` are NOT exported. Also locked by the `src/index.drift.ts` tripwire. |
| `src/core/run-typecheck.ts` (`CoreResult`/`CoreOptions`/`runTypecheck`) | **ADDITIVE** | The ONLY public-API change is `CoreResult.totalFilesCount?: number` (OPTIONAL, Phase 30 OBS-01, added via the value-presence spread idiom). `CoreOptions` is unchanged; `runTypecheck`'s signature is unchanged. The rest of the diff is module-private plumbing (`finalizeUnion`/`handleSolutionWalk`/`handleMultiTsConfig` thread the count) -- not public surface. `index.drift.ts` still compiles = the type-level proof. |
| `src/executors/typecheck/schema.json` | **WIDEN-ONLY** | Added ONE optional property `format` (`enum ["human","json","sarif"]`, `default "human"`). Every pre-existing option is unchanged; `required` stays `["tsConfig"]` and `additionalProperties` is unchanged. Omitting `format` yields the byte-identical `0.2.2` human output. |
| `src/executors/typecheck/schema.d.ts` | **WIDEN-ONLY** | Added the optional `format?: 'human' \| 'json' \| 'sarif'` member to `TypecheckExecutorOptions`. No pre-existing member changed. |
| `src/builders/typecheck/schema.json` | **WIDEN-ONLY** | Mirrors the executor: added the same optional `format` enum; `required`/`additionalProperties` unchanged. |
| `src/builders/typecheck/schema.d.ts` | **UNCHANGED** | Empty diff. The builder reuses `TypecheckExecutorOptions` (the executor `schema.d.ts`), so the `format?` widening flows through without editing this file. |
| `src/builders/typecheck/builder.ts` | **UNCHANGED** | Empty diff. The `convertNxExecutor(typecheckExecutor)` builder is byte-identical (the additive-only charter names it explicitly). |
| `executors.json` | **UNCHANGED** | Empty diff. Still declares the `typecheck` executor -> `./src/executors/typecheck/executor`, so `nx run <project>:typecheck` stays resolvable and the executor id is unchanged. |
| `generators.json` | **UNCHANGED** | Empty diff. Still declares `configuration` + `init`; `ng-add` intentionally NOT here (only in `collection.json`), so `nx add angular-typechecker` continues to run `<pkg>:init`. |
| `builders.json` | **UNCHANGED** | Empty diff. Still declares the `typecheck` builder for the Angular CLI. |
| `collection.json` | **UNCHANGED** | Empty diff. Schematics collection (`configuration`, `init`, `ng-add`) intact. |
| `src/generators/{configuration,init}/schema.json` + `schema.d.ts` | **UNCHANGED** | Empty diff. Generator option contracts byte-identical. |
| `packages/angular-typechecker/package.json` | **ADDITIVE (deps): ONLY `node-sarif-builder`** | THE critical dependency proof -- see Section 2a. |
| `packages/angular-typechecker/project.json` | **NON-BREAKING (build-config only)** | Added `ignore: ["**/__snapshots__/**"]` to the build asset glob (32-02 packaging fix). This is NOT a published-surface, public-API, schema, dependency, or version change -- it stops dev-only Vitest `*.snap` files from being copied into `dist/` and packed. `@0.2.2`'s tarball carried no reporter snapshots (they arrived unreleased in Phases 30/31), so excluding them RESTORES the tarball to `@0.2.2`'s clean shape. A regression fix, not a breaking change. |

### 2a. The dependency proof (the ADD-01 crux)

`git diff angular-typechecker@0.2.2..HEAD -- packages/angular-typechecker/package.json`
shows the `dependencies` block gained **exactly one** entry:

```
   "dependencies": {
     "@nx/devkit": "23.0.1",
+    "node-sarif-builder": "^4.1.0",
     "nx": "^23.0.0",
     "tslib": "^2.3.0"
   },
```

The full HEAD `dependencies` set is `@nx/devkit`, `node-sarif-builder`, `nx`, `tslib` --
`node-sarif-builder` is the only addition since `@0.2.2` (`nx` was already a direct dep
since v0.2.1). No dev-only validator leaked into the shipped manifest:

```
git show HEAD:packages/angular-typechecker/package.json | rg -q 'ajv'   # NO match (idiom passes)
```

`ajv@^8.20.0` and `ajv-formats@^3.0.1` appear ONLY in the ROOT `package.json`
`devDependencies` (the root manifest is `"private": true`, never published), where they back
the dev-only SARIF 2.1.0 schema validator in `libs/test-util`. `libs/test-util` is
path-aliased (`@workspace/test-util`) and never published, so the committed 109 KB schema
fixture never ships either.

## 3. New-file additions (additive by construction)

The v0.2.3 reporter modules did not exist at the `0.2.2` tag
(`git ls-tree -r angular-typechecker@0.2.2 -- <path>` returns 0 files; HEAD has 1 each).
These add surface without altering any prior contract, and none is exported from the public
barrel.

| New addition | Provides | Net-new proof (files at tag -> HEAD) |
|--------------|----------|--------------------------------------|
| `src/core/diagnostic-record.ts` | The ONE shared pure projection (`toDiagnosticRecord`, `relativizePath`) both reporters reuse (Phase 30). | 0 -> 1 |
| `src/core/json-report.ts` | `formatJsonReport` -- the zero-dependency JSON payload (Phase 30). | 0 -> 1 |
| `src/core/sarif-report.ts` | `formatSarifReport` -- the lazy-`import()`ed SARIF 2.1.0 reporter (Phase 31). | 0 -> 1 |
| `src/core/extended-catalog.ts` | The dependency-free enum-keyed 18-NG8xxx member -> ngCode catalog (Phase 31). | 0 -> 1 |

All four are reached module-to-module through the widened `renderReport` seam and their unit
specs, integration specs, and e2e coverage; none is on the `src/index.ts` barrel. The
`--format` flag that dispatches them was added widen-only to the executor/builder schemas
(Section 2) and to the CLI `parse-args.ts` (`HELP_TEXT`, not a published schema).

## 4. ADD-01 disposition

- **No executor-id break:** `angular-typechecker:typecheck` is unchanged (`executors.json`
  byte-identical), and `nx run <project>:typecheck` stays resolvable via `executors ?? builders`.
- **No barrel break:** `src/index.ts` is byte-unchanged since `0.2.2` and is locked by the
  `src/index.drift.ts` standing tripwire (green this phase); the three net-new reporters and
  `renderReport` are NOT exported.
- **No builder break:** `builders.json`, `src/builders/typecheck/builder.ts`, and its
  `schema.d.ts` are byte-unchanged; the builder `schema.json` only widened by the optional
  `format` enum (mirroring the executor).
- **No schema break:** every pre-existing executor / builder / generator option is unchanged;
  the executor and builder schemas gained ONLY the OPTIONAL `format` enum
  (`required`/`additionalProperties` unchanged), and `CoreResult` gained ONLY the OPTIONAL
  `totalFilesCount` -- both widen-only/additive under 0.x semver.
- **No CLI flag-set break:** `--format` is an additive optional flag; omitting it preserves
  the byte-identical `0.2.2` human output and the identical exit code across formats
  (evaluate-result / toExitCode are the sole verdict owners, verified by the VER-03 exit-code
  parity e2e).
- **One new runtime dependency, correctly classified:** the plugin `dependencies` gained
  EXACTLY `node-sarif-builder@^4.1.0`; `@nx/dependency-checks` SEES its lazy `import()` and
  needs NO `ignoredDependencies` entry (A1). `ajv`/`ajv-formats` are dev-only ROOT
  devDependencies and never reach the shipped manifest.
- **Packaging correction, not a contract change:** the `project.json` asset-glob
  `ignore: ["**/__snapshots__/**"]` restores the tarball to `@0.2.2`'s clean file set; no
  public API / executor id / schema / dependency / version change.
- **Charter satisfied:** ADDITIVE-ONLY holds. There is no breaking change, so the milestone
  remains on the **0.2.x** line and does NOT re-version to v0.3.0; the v0.3.0 breaking-change
  escape hatch stays **UNTRIGGERED**. The package `version` stays `0.2.2` -- this phase cuts
  NO release; the `0.2.2 -> 0.2.3` bump + tag + npm publish are the later human-gated
  Release-PR flow (AGENTS.md).

---

*Phase: 32-verification-docs-additive-audit*
*Audited: 2026-07-19 against `angular-typechecker@0.2.2` (baseline `6d3214d`, HEAD `6ca7628`)*
