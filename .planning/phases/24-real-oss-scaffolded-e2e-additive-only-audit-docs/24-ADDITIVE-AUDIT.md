# Phase 24: Additive-only audit (ACP-02) versus `angular-typechecker@0.2.0`

**Audited:** 2026-07-11
**Requirement:** ACP-02 (v0.2.1 ADDITIVE-ONLY charter)
**Baseline tag:** `angular-typechecker@0.2.0` (confirmed present via `git tag -l`)
**Method:** standing-guard cross-check (all green) + `git diff angular-typechecker@0.2.0..HEAD` per public-surface path.

## Verdict

**ADDITIVE-ONLY HOLDS.** Across the Angular CLI work landed in Phases 21-23, the Nx
executor id, the `src/index.ts` public barrel, and every pre-existing schema are
**widened-only or byte-unchanged** -- nothing was narrowed, removed, or renamed. The
Angular CLI surface (builder + schematics collections + their schemas) is a set of
**new files** with no `0.2.0` baseline, so it is additive by construction. No breaking
change exists, so the milestone stays on the **0.2.x** line -- **v0.3.0 is NOT
triggered**.

## 1. Guard cross-check map

Additive-only is ENFORCED by standing guards Phases 21-23 shipped, now joined by the
Phase-24 barrel drift tripwire (Plan 24-01, Task 2). All are present and green in the
`nx test` (314 tests) + `nx typecheck` runs recorded this phase.

| Additive-only surface | Standing guard | Status |
|-----------------------|----------------|--------|
| `executors ?? builders` unchanged; `angular-typechecker:typecheck` executor id stays; `builders` field is additive | `src/builders/typecheck/nx-surface-regression.spec.ts` | present + green |
| `generators ?? schematics` unchanged; `ng-add` present in `collection.json` yet ABSENT from `generators.json` (so `nx add` stays `<pkg>:init`) | `src/schematics/configuration/nx-generators-surface-regression.spec.ts` | present + green |
| Executor schema parity (incl. the ENG-01 `tsConfig` `oneOf string\|array` widening) | `src/executors/typecheck/schema-parity.spec.ts` | present + green |
| Configuration generator schema parity | `src/generators/configuration/schema-parity.spec.ts` | present + green |
| Init generator schema parity | `src/generators/init/schema-parity.spec.ts` | present + green |
| Sanitized builder schema parity (mirrors the executor schema, incl. the `tsConfig` widening) | `src/builders/typecheck/schema-parity.spec.ts` | present + green |
| Static published-manifest contract (peers, optional peers, `builders`/`schematics` fields, `ng-add.save`, files, engines) | `src/package-manifest.spec.ts` | present + green |
| ENG-01 single-string path + Nx path byte-unchanged (real compiler) | `src/core/multi-tsconfig.integration.spec.ts` | present + green |
| **Public barrel export set (`src/index.ts`) locked (all five exports incl. type-only)** | **`src/index.drift.ts` (NEW this phase; rides the `typecheck` drift `tsc --noEmit`)** | **present + green** |

Before Phase 24 the `src/index.ts` barrel was the one additive-only seam with no
standing automated guard (only a manual diff covered it). Plan 24-01 Task 2 closes that
gap with the drift tripwire, so every additive-only surface now has a standing guard.

## 2. Git-diff verdict per audited path

Commands run against the `0.2.0` baseline:

```
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/src/index.ts
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/src/executors/typecheck/schema.json
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/src/generators/configuration/schema.json \
                                            packages/angular-typechecker/src/generators/init/schema.json
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/executors.json packages/angular-typechecker/generators.json
```

| Audited path | Diff verdict | Detail |
|--------------|--------------|--------|
| `src/index.ts` (public barrel) | **UNCHANGED** | Byte-identical to `0.2.0`. The five exports (`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`) are the same names in the same shape. |
| `src/executors/typecheck/schema.json` | **WIDEN-ONLY** | The ONLY change is the ENG-01 `tsConfig` property: `{ "type": "string" }` -> `{ "oneOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" }, "minItems": 1 } ] }` (plus a description update). A bare string still validates against the `oneOf`, so every pre-existing invocation stays valid. `required` and `additionalProperties` are unchanged; no property was removed or renamed. |
| `src/generators/configuration/schema.json` | **UNCHANGED** | Empty diff. |
| `src/generators/init/schema.json` | **UNCHANGED** | Empty diff. |
| `executors.json` | **UNCHANGED** | Empty diff. Still declares the `typecheck` executor -> `./src/executors/typecheck/executor`, so `nx run <project>:typecheck` stays resolvable and the executor id is unchanged. |
| `generators.json` | **UNCHANGED** | Empty diff. Still declares `configuration` + `init`; `ng-add` is intentionally NOT here (it lives only in `collection.json`), so `nx add angular-typechecker` continues to run `<pkg>:init`. |

## 3. New-file additions (additive by construction)

These Angular CLI surface files did not exist at the `0.2.0` tag (confirmed absent via
`git cat-file -e angular-typechecker@0.2.0:<path>` -> "exists on disk, but not in
`angular-typechecker@0.2.0`"), so they add surface without altering any prior contract:

| New file | Provides |
|----------|----------|
| `builders.json` | The Angular CLI builders collection (declares the `typecheck` builder). |
| `collection.json` | The Angular CLI schematics collection (`configuration`, `init`, `ng-add`). |
| `src/builders/typecheck/{builder,schema.json,schema.d.ts}` | The `convertNxExecutor` builder + its sanitized schema (thin re-export over the same executor). |
| `src/schematics/{configuration,init,ng-add}/*` | The `convertNxGenerator` schematic re-exports + the first-party `ng-add`. |

## 4. ACP-02 disposition

- **No executor-id break:** `angular-typechecker:typecheck` is unchanged.
- **No barrel break:** `src/index.ts` is byte-unchanged since `0.2.0` and is now locked
  by the `src/index.drift.ts` standing tripwire.
- **No schema break:** the only pre-existing-schema change is the additive `tsConfig`
  `oneOf string|array` widening; every other schema is byte-unchanged; the Angular CLI
  schemas are new files.
- **Charter satisfied:** ADDITIVE-ONLY holds. There is no breaking change, so the
  milestone remains on the **0.2.x** line and does NOT re-version to v0.3.0.

Phase 24 itself adds only test/e2e projects, the barrel tripwire, this audit, and docs
prose -- no production engine/core/generator/schematic surface -- so ACP-02 is trivially
true by construction for the phase's own changes; this audit confirms the Phases 21-23
additions that DID add surface stayed additive.
