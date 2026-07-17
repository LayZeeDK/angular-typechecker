# Phase 27: Additive-only audit (ADD-01) versus `angular-typechecker@0.2.1`

**Audited:** 2026-07-16
**Requirement:** ADD-01 (v0.2.2 ADDITIVE-ONLY charter)
**Baseline tag:** `angular-typechecker@0.2.1` (confirmed present via `git tag -l`; the last
shipped version -- NOT `0.2.0`, since v0.2.1 shipped after Phase 24)
**HEAD:** `77a55d3`
**Scope:** the whole v0.2.2 milestone (Phases 25-27) -- the Phase-25 executor logger swap,
the Phase-26 net-new `src/cli/` core, and Phase-27's `bin` field + `src/cli/**`.
**Method:** standing-guard cross-check (all green) + `git diff angular-typechecker@0.2.1..HEAD`
per public-surface path + `git cat-file`/`git ls-tree` net-new confirmation.

## Verdict

**ADDITIVE-ONLY HOLDS.** Across Phases 25-27, the Nx executor id
(`angular-typechecker:typecheck`), the `src/index.ts` public barrel (the five exports
`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`,
`SkippedReference`), the Angular CLI builder, and every pre-existing executor / builder /
generator schema (both `schema.json` and `schema.d.ts`) are **byte-unchanged** vs
`0.2.1` -- nothing was narrowed, removed, or renamed. The only additions are **net-new
files** (the whole `src/cli/**` tree -- 0 files at the tag, 8 at HEAD) and a **net-new
manifest field** (`bin`), neither of which alters any prior contract. The one non-public
implementation change (the Phase-25 executor logger swap in `executor.ts`) is internal and
observably identical (same advisory notices, now emitted through an injected `Logger`). No
breaking change exists, so the milestone stays on the **0.2.x** line -- **v0.3.0 is NOT
triggered**. The package `version` stays `0.2.1` (the bump is the human-gated Release-PR
flow, not this phase).

## 1. Guard cross-check map

Additive-only is ENFORCED by standing guards carried forward from prior phases, joined by
the Phase-27 packaging guards. All are present and green in this phase's `nx test`
(43 files / 435 tests) + `nx typecheck` (3 tsc commands) + `nx e2e install-e2e`
(11 files / 40 tests) runs.

| Additive-only surface | Standing guard | Status |
|-----------------------|----------------|--------|
| `executors` unchanged; `angular-typechecker:typecheck` executor id stays; `builders` field additive | `src/builders/typecheck/nx-surface-regression.spec.ts` | present + green |
| `generators`/`schematics` unchanged; `ng-add` present in `collection.json` yet ABSENT from `generators.json` (so `nx add` stays `<pkg>:init`) | `src/schematics/configuration/nx-generators-surface-regression.spec.ts` | present + green |
| Executor schema parity | `src/executors/typecheck/schema-parity.spec.ts` | present + green |
| Configuration generator schema parity | `src/generators/configuration/schema-parity.spec.ts` | present + green |
| Init generator schema parity | `src/generators/init/schema-parity.spec.ts` | present + green |
| Sanitized builder schema parity (mirrors the executor schema) | `src/builders/typecheck/schema-parity.spec.ts` | present + green |
| Static published-manifest contract (peers, optional peers, `builders`/`schematics` fields, `ng-add.save`, files, engines) | `src/package-manifest.spec.ts` | present + green |
| ENG-01 single-string path + Nx path byte-unchanged (real compiler) | `src/core/multi-tsconfig.integration.spec.ts` | present + green |
| Public barrel export set (`src/index.ts`) locked -- all five exports incl. type-only | `src/index.drift.ts` (rides the `typecheck` drift `tsc --noEmit -p tsconfig.drift.json`) | present + green |
| Built `bin.js` has a `\r`-free `#!/usr/bin/env node` shebang AND an nx-free require graph (VER-03, Phase-27 net-new guard) | `src/cli/bin-static.spec.ts` | present + green |
| Packed tarball maps both bin names to a shipped `./src/cli/bin.js` with a clean shebang; `publint --strict` covers the bin (PKG-01, Phase-27 net-new guard) | `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` (CLI-01/PKG-01 block) | present + green |

The barrel-drift tripwire (`src/index.drift.ts`, run under `tsconfig.drift.json`) is the
authoritative ADD-01 leg (a): a removed or renamed barrel export fails `tsc --noEmit`
LOUDLY. This phase's `nx typecheck angular-typechecker` ran all three tsc commands
(`tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json`) and succeeded, so the
five exports are proven byte-intact.

## 2. Git-diff verdict per audited path

Commands run against the `0.2.1` baseline (leg b):

```
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/index.ts
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/executors/typecheck/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/executors/typecheck/schema.d.ts
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/builders/typecheck/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/builders/typecheck/schema.d.ts
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/builders/typecheck/builder.ts
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/generators/configuration/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/generators/init/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/executors.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/generators.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/builders.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/collection.json
```

| Audited path | Diff verdict | Detail |
|--------------|--------------|--------|
| `src/index.ts` (public barrel) | **UNCHANGED** | Empty diff. The five exports (`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`) are the same names in the same shape; also locked by the `src/index.drift.ts` tripwire. |
| `src/executors/typecheck/schema.json` | **UNCHANGED** | Empty diff. Executor option contract intact. |
| `src/executors/typecheck/schema.d.ts` | **UNCHANGED** | Empty diff. Executor option TS type intact. |
| `src/builders/typecheck/schema.json` | **UNCHANGED** | Empty diff. Angular CLI builder option contract intact. |
| `src/builders/typecheck/schema.d.ts` | **UNCHANGED** | Empty diff. Builder option TS type intact. |
| `src/builders/typecheck/builder.ts` | **UNCHANGED** | Empty diff. The `convertNxExecutor` builder is byte-identical. |
| `src/generators/configuration/schema.json` | **UNCHANGED** | Empty diff. |
| `src/generators/init/schema.json` | **UNCHANGED** | Empty diff. |
| `executors.json` | **UNCHANGED** | Empty diff. Still declares the `typecheck` executor -> `./src/executors/typecheck/executor`, so `nx run <project>:typecheck` stays resolvable and the executor id is unchanged. |
| `generators.json` | **UNCHANGED** | Empty diff. Still declares `configuration` + `init`; `ng-add` intentionally NOT here (only in `collection.json`), so `nx add angular-typechecker` continues to run `<pkg>:init`. |
| `builders.json` | **UNCHANGED** | Empty diff. Still declares the `typecheck` builder for the Angular CLI. |
| `collection.json` | **UNCHANGED** | Empty diff. Schematics collection (`configuration`, `init`, `ng-add`) intact. |

### Internal (non-public-surface) change: the Phase-25 logger swap

| Path | Diff | Disposition |
|------|------|-------------|
| `src/executors/typecheck/executor.ts` | CHANGED (+13 / -195) | **Internal refactor, observably identical -- NOT public surface.** The advisory-notice logic (`warnBundlerQueryImports` + the inline `logger.warn`/`logger.info` calls) was extracted into `../../core/emit-advisory-notices` and the executor now calls `emitAdvisoryNotices(result, logger)`, injecting its `@nx/devkit` `logger`. Same notices, same order, same behaviour; the extraction is the Phase-25 `Logger`-seam work that lets the CLI adapter reuse the notice logic nx-free. The executor id, its `schema.json`/`schema.d.ts`, and the `executors.json` mapping are all byte-unchanged, so no consumer-observable contract changed. |

## 3. New-file additions (additive by construction)

The entire `src/cli/` tree did not exist at the `0.2.1` tag (`git ls-tree -r
angular-typechecker@0.2.1 -- packages/angular-typechecker/src/cli/` returns 0 files; HEAD
has 8). These add surface without altering any prior contract. The `bin` field was likewise
absent from the `0.2.1` manifest (`git show angular-typechecker@0.2.1:.../package.json`
has no `"bin"`).

| New addition | Provides | Net-new proof |
|--------------|----------|---------------|
| `src/cli/bin.ts` | The flush-safe OS shell (shebang + `run().then/.catch`, the only `process.exitCode`/stream-write site). | `git cat-file -e angular-typechecker@0.2.1:.../src/cli/bin.ts` -> absent at tag. |
| `src/cli/bin-static.spec.ts` | The `test`-tier static guard (shebang + nx-free require graph, VER-03). | `git cat-file -e angular-typechecker@0.2.1:.../src/cli/bin-static.spec.ts` -> absent at tag. |
| `package.json` `bin` field | Two names (`angular-typechecker` + `atc`) -> the one compiled `./src/cli/bin.js` (CLI-01). | No `"bin"` in the `0.2.1` manifest. |
| Rest of `src/cli/**` (Phase-26 core: `main.ts`, `run()` + support + specs) | The pure `run(argv, env)` CLI core the `bin.ts` shell wraps. | `src/cli/` tree absent at tag (0 files). |

The compiled `bin.js` ships under `src/`, already whitelisted in `files: ["src", ...]`, so
no `files` change was needed -- the tarball audit (Section 1) confirms `src/cli/bin.js`
ships with both bin names mapped and a clean shebang.

## 4. ADD-01 disposition

- **No executor-id break:** `angular-typechecker:typecheck` is unchanged (`executors.json`
  byte-identical).
- **No barrel break:** `src/index.ts` is byte-unchanged since `0.2.1` and is locked by the
  `src/index.drift.ts` standing tripwire (green this phase).
- **No builder break:** `builders.json`, `src/builders/typecheck/builder.ts`,
  `schema.json`, and `schema.d.ts` are all byte-unchanged.
- **No schema break:** every pre-existing executor / builder / generator schema
  (`schema.json` and `schema.d.ts`) is byte-unchanged.
- **Only additive changes:** the whole `src/cli/**` tree and the `bin` manifest field are
  net-new; the sole implementation change (`executor.ts`) is an internal, observably
  identical logger swap on unreleased-behaviour-equivalent code, not a
  narrowing/removal/rename of released surface.
- **Charter satisfied:** ADDITIVE-ONLY holds. There is no breaking change, so the milestone
  remains on the **0.2.x** line and does NOT re-version to v0.3.0; the v0.3.0 breaking-change
  escape hatch stays **untriggered**.

---

*Phase: 27-bin-shell-cross-platform-packaging*
*Audited: 2026-07-16 against `angular-typechecker@0.2.1` (HEAD `77a55d3`)*
