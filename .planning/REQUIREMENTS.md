# Requirements: angular-typechecker — v0.1.0 (configuration + init generators, nx add support, and the typecheck executor rename)

**Defined:** 2026-07-01
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests — faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Strategy basis:** Unanimous 8-lens Opus board (5 constructive + 3 adversarial), fact-only, 2 rounds to consensus — `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`.
**Re-scoped 2026-07-01 (spikes):** spikes 001-005 (`.planning/spikes/`, all VALIDATED — see `MANIFEST.md`) proved runtime solution-tsconfig reference-walking feasible on the existing `performCompilation` engine. Added **WALK-01/02** (engine) and reshaped **GEN-01/02/03** (the generator now wires ONE `typecheck` target at the solution `tsconfig.json`). This supersedes the D-03a solution-style short-circuit and the board's decision-B "no executor change" assumption (D1 in-memory generator tests unchanged; the executor changes, not the generator).
**Re-scoped 2026-07-01 (v0.1.0):** milestone re-versioned **v0.0.4 → v0.1.0** — the shipped executor is renamed `angular-typechecker:angular-typecheck` → **`angular-typechecker:typecheck`** (EXEC-01, a breaking change that drives the 0.x minor bump). Scope expanded from a single config generator to a generator SUITE: `typecheck-configuration` is renamed **`configuration`**; a standalone **`init`** generator seeds `nx.json` `targetDefaults` (GEN-07) and is invoked by `configuration` (GEN-08); and **`nx add angular-typechecker`** runs `init` on install (GEN-09). Nx's `nx add` is promoted out of the deferred set; `ng add` (Angular CLI) stays deferred (GEN-FUT-02). Milestone re-scope confirmed against first-party Nx 23 conventions (`@nx/eslint:lint-project` → `lintInitGenerator`; `@nx/vitest:configuration` → `init`).

## Milestone v0.1.0 Requirements

### WALK — solution-tsconfig reference-walking (engine)

*Added 2026-07-01 (spikes 001-005 GO). Prerequisite for the reshaped GEN-02/03. Supersedes the D-03a solution-style short-circuit.*

- [x] **WALK-01**: The `angular-typecheck` engine (`runTypecheck`) accepts a solution / references-only `tsconfig.json` and type-checks each IN-PROJECT referenced leaf in one call: it resolves `references[]` to leaf tsconfigs, runs `performCompilation` per leaf, UNIONs the raw per-leaf diagnostics into a single `finalize` pass (dedupe by `ts.sortAndDeduplicateDiagnostics` value identity — `file.path`+start+length+code+`messageText`; explicit post-dedupe `DiagnosticCategory` counts, never `length - errorCount`; basePath = the solution tsconfig's directory). A reference-resolution-layer **module-boundary guard** SKIPS out-of-project references (skip-with-notice, path-containment under the project dir), orthogonal to and composable with the existing `filter-diagnostics` + `includeDeps` (which continue to govern imported *source* diagnostics unchanged). The **D-03a zero-rootNames guard splits three-way**: references present + ≥1 in-project leaf → walk; references present + 0 in-project → new synthesized error (code 90001, distinct message); no references → unchanged empty-project error. `rootNames > 0` direct-leaf path untouched; no branch gates on TS18003. `rootNamesCount` = sum over walked leaves. The locked `config-resolution.integration.spec.ts:124-130` assertion is rewritten, and `fixtures/solution-style` gains a KNOWN diagnostic + a real `tsconfig.spec.json` leaf so the walk assertion proves type-checking occurred.
- [x] **WALK-02**: A walk target's Nx `targetDefaults` inputs use the `default` named input (the lib+spec source union), NOT `production` (which excludes `*.spec.ts` and would under-hash spec sources → stale PASS); `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default` are retained. Any leaf/dep change busts the (coarse) single-target cache. README consumer guidance updated to the walk recipe. *(DEFERRED synergy, tracked below: project references / `NgtscProgram` incremental declaration-reuse to collapse the double-compile tax — additive, not blocking.)*

### EXEC — executor rename (breaking; drives 0.1.0)

*Added 2026-07-01 (v0.1.0 re-scope). The breaking change that carries the 0.x minor bump.*

- [x] **EXEC-01**: The published Nx executor is renamed from `angular-typecheck` (id `angular-typechecker:angular-typecheck`) to **`typecheck`** (id **`angular-typechecker:typecheck`**): the `executors.json` key, the executor implementation directory + `implementation`/`schema` paths, and the schema `$id` are renamed, and EVERY internal reference is updated consistently — `nx.json` `targetDefaults` keys (both the local `angular-typechecker:typecheck` and the scoped `@angular-typechecker/angular-typechecker:typecheck`), all fixture `project.json` executor refs (and their target names), `nx-target-defaults.spec.ts` keys, the integration/unit specs that name the executor id, and the README consumer recipe. Executor BEHAVIOR is unchanged — only the id/name moves. This is a BREAKING change for consumers, so it drives the milestone's 0.x minor bump to **0.1.0** (a `feat!` / `BREAKING CHANGE:` commit touching the package).

### GEN — `configuration` + `init` generators, nx add

- [x] **GEN-01**: A developer can run `nx g angular-typechecker:configuration <project>` to wire a `typecheck` target (executor `angular-typechecker:typecheck`) into the project's `project.json` (edits configuration via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`; no `generateFiles`, no file emission). Caching config is NOT inlined on the target — it is seeded into `nx.json` `targetDefaults` by the `init` generator (GEN-07/08), so the generator additionally reads/writes `nx.json` (`readNxJson`/`updateNxJson`, through `init`); still no file emission.
- [x] **GEN-02**: The generator wires ONE target pointed at the project's **solution `tsconfig.json`** (relying on WALK-01 to type-check its in-project referenced leaves), with an explicit `--tsConfig` override and a **flat-project fallback** (point at the leaf `tsconfig.app.json`/`tsconfig.lib.json` when the project has no solution tsconfig / no `references`; select the leaf by Nx `projectType` with an existence probe, error clearly when none resolves). Per-project-type `tsConfig` detection is obviated by the walk. Configurable `targetName` (default `typecheck`). *(Nx workspaces only; Angular CLI `angular.json` layouts deferred; prod tsconfigs e.g. `tsconfig.lib.prod.json` are not referenced by the solution tsconfig and so are not walked — no-emit.)*
- [x] **GEN-03**: Spec-tsconfig (`tsconfig.spec.json`) type-checking is automatic via WALK-01 (the spec tsconfig is an in-project referenced leaf the engine walks) — no separate target or `configuration` is wired. In the flat-project fallback (no solution tsconfig), spec checking is out of the single leaf target's scope and left to the consumer.
- [x] **GEN-04**: Re-running the `configuration` generator on an already-wired project is idempotent (no duplicate target, no clobbered config); an existing NON-ours target of the same name (executor ≠ `angular-typechecker:typecheck`) is not clobbered — the generator errors with a clear, located message instead.
- [x] **GEN-05**: The plugin ships hand-authored `schema.json` + `schema.d.ts` for BOTH the `configuration` and `init` generators, registered via `generators.json` (each entry keyed with `factory`) and the published `package.json` `generators` field; the generators + schemas are included in the tarball `files` set (the root `generators.json` is globbed into the build output alongside `executors.json`; the `schema.json` files under `src/generators/**` are copied by the existing non-`.ts` asset glob).
- [x] **GEN-06**: Generator unit tests run on the public in-memory `createTreeWithEmptyWorkspace` substrate and assert the `configuration` generator's written target for the solution-tsconfig case AND the flat-project fallback case plus idempotency; a schema-parity spec asserts each generator's `schema.json` property keys === its `schema.d.ts` interface.
- [x] **GEN-07**: A standalone `nx g angular-typechecker:init` generator idempotently seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the WALK-02 cacheable block (`cache: true`, `outputs: []`, the `default`-based input set — never `production`, which would under-hash `*.spec.ts` → stale PASS), keyed by the **unscoped published** executor id, and never clobbers an existing / user-customized entry (per-key `??=` merge). In-memory `createTreeWithEmptyWorkspace` unit tests assert the seeded shape, an idempotent re-run, don't-clobber, and `default`-not-`production`.
- [x] **GEN-08**: The `configuration` generator invokes `init` as part of its run, so a single `nx g angular-typechecker:configuration <project>` both seeds the workspace `targetDefaults` (via `init`) and wires the project's minimal `typecheck` target — the idiomatic first-party pattern (`@nx/eslint:lint-project` → `lintInitGenerator`, `@nx/vitest:configuration` → `init`).
- [x] **GEN-09**: `nx add angular-typechecker` auto-runs the `init` generator on install (Nx invokes the package's registered `init` generator), seeding `targetDefaults` so a freshly-added plugin is cacheable without a manual edit. `ng add` (Angular CLI) remains deferred (GEN-FUT-02).

### CAT — extended-diagnostic catalog

- [x] **CAT-01**: The integration suite asserts all 18 `ExtendedTemplateDiagnosticName` members by exact code + `DiagnosticCategory` + count, against the real `@angular/compiler-cli` over committed fixtures.
- [x] **CAT-02**: At least one severity-promotion case proves `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"` flips a warning-default diagnostic to an error (NG8011 excepted: out-of-band / not promotable — assert its observed category).
- [x] **CAT-03**: The baseline TS/NG codes (TS2322, TS2339, NG2003, NG2005, NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) are asserted by exact code.
- [x] **CAT-04**: The catalog is a single data-driven `it.each` table keyed on the enum members (introduction-version is a row field, not a per-version file split); any member not reproducible by a static fixture under Angular 22.0.4 is `it.skip` with a written reason (the row remains in the catalog).
- [x] **CAT-05**: `research/DIAGNOSTIC-CATALOG.md` is corrected to the authoritative 18-member set (the `ExtendedTemplateDiagnosticName` enum incl. NG8011 + NG8021, both outside the 81xx range; NG8110 + NG8118 noted as `ErrorCode`s that are NOT configurable extended diagnostics).

### DRIFT — completeness tripwire

- [x] **DRIFT-01**: A completeness tripwire asserts the catalog's covered-code set equals the `ExtendedTemplateDiagnosticName` enum, so an Angular release that adds/renames/removes a member fails CI loudly. Runs in the `test` (or `typecheck-drift`) job; consumes the enum at build/test time.

### GE2E — generator end-to-end (folded into `angular-typechecker-install-e2e`)

- [ ] **GE2E-01**: The plugin ships `generators.json`; the `install-e2e` consumer fixture gains a project WITHOUT a pre-wired target; an e2e scenario installs the tarball, runs `nx g angular-typechecker:configuration` on that project, and asserts the resulting `project.json` target (executor `angular-typechecker:typecheck`) AND the `init`-seeded `nx.json` `targetDefaults["angular-typechecker:typecheck"]`.
- [ ] **GE2E-02**: The same scenario then runs `nx run <proj>:typecheck --skip-nx-cache` and asserts the verdict end-to-end (clean → success; an injected template/type error → failure with the diagnostic code visible). No Verdaccio; no new e2e project.
- [ ] **GE2E-03**: An e2e proves `nx add angular-typechecker` runs the `init` generator and seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` on install (proves GEN-09). No Verdaccio; no new e2e project.

### GUARD — CI self-audit

- [x] **GUARD-01**: A guard test asserts the `e2e` job's explicit `-p` project list equals the set of `e2e/*` projects in the workspace graph, converting a forgotten-`-p` silent skip into a loud, located failure.

## Future Requirements (deferred, tracked)

### FsTree real-disk testing

- **FSTREE-01**: Bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers (quarantined `nx/src/generators/tree` deep import + drift tripwire) — only if a future generator emits files a real compiler must read back. Not needed for a `project.json`-edit generator.

### Generator surface expansion

- **GEN-FUT-01**: Angular CLI (`angular.json`) workspace support for the generators (via `convertNxGenerator`).
- **GEN-FUT-02**: `ng add` (Angular CLI) install schematic. *(Nx's `nx add` is now in scope — GEN-09; only the Angular CLI `ng add` path remains deferred.)*

### Engine / performance (WALK follow-ups)

- **WALK-FUT-01**: `createNodesV2` inference of GRANULAR per-leaf `typecheck` targets (one per referenced tsconfig) so a single `nx run-many -t typecheck` fans out to independently-cached tasks — the granular counterpart to the coarse single walk target (WALK-02). Carried-forward INF deferral (PROJECT.md Out of Scope; "next milestone").
- **WALK-FUT-02**: Project references / `NgtscProgram` incremental declaration-reuse to compile a shared dependency once and reuse its declarations across walked leaves, collapsing the walk's double-compile tax toward zero (spike 003: ~1 extra `performCompilation` per leaf; the tax grows at the PROJECT.md ~15s scale). Additive, not blocking; requires the deferred `NgtscProgram` engine (Approach B).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bespoke `createFsTree` real-disk test helper | Board Option A: zero value for a `project.json`-edit generator; prior-art FsTree lived only in an executor e2e; non-public deep import. Tracked as FSTREE-01. |
| Mid-tier executor-vs-workspace test | `context.root`→`tsConfig` is already unit-covered (`normalize-options.spec.ts`); a hand-built `ExecutorContext` risks a false-green fiction. |
| Verdaccio local-registry e2e | Second mechanism with Windows-arm64 `execFileSync` issues; the existing `npm pack` + tmp-install tarball harness suffices. |
| jscodeshift error-injection toolkit | Committed static fixtures reproduce the diagnostics; no AST-mutation apparatus warranted. |
| Nx cache / `dependsOn`-ordering correctness tests | Already covered by `cache-busts-on-dep-error`; no new gap. |
| Quiet / errors-only executor mode + its tests | Mode is not in this milestone's scope. |
| `ng add` (Angular CLI) install schematic; Angular CLI workspace generator | Deferred (GEN-FUT-01/02). Nx's `nx add` IS in scope (GEN-09). |
| Machine-readable reporters (JSON/SARIF), `NgtscProgram` incremental/`--watch`, `createNodesV2` inference, Jest, Storybook story type-check, standalone CLI | Carried-forward deferrals (PROJECT.md Out of Scope). |

## Traceability

Each requirement maps to exactly one phase (v0.1.0 phases continue from v0.0.3's last phase 11; Phase 13.1 is the inserted breaking-rename phase).

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-01 | Phase 12 | Complete |
| CAT-02 | Phase 12 | Complete |
| CAT-03 | Phase 12 | Complete |
| CAT-04 | Phase 12 | Complete |
| CAT-05 | Phase 12 | Complete |
| DRIFT-01 | Phase 12 | Complete |
| WALK-01 | Phase 13 | Complete |
| WALK-02 | Phase 13 | Complete |
| EXEC-01 | Phase 13.1 | Complete |
| GEN-01 | Phase 14 | Complete |
| GEN-02 | Phase 14 | Complete |
| GEN-03 | Phase 14 | Complete |
| GEN-04 | Phase 14 | Complete |
| GEN-05 | Phase 14 | Complete |
| GEN-06 | Phase 14 | Complete |
| GEN-07 | Phase 14 | Complete |
| GEN-08 | Phase 14 | Complete |
| GEN-09 | Phase 14 | Complete |
| GE2E-01 | Phase 15 | Pending |
| GE2E-02 | Phase 15 | Pending |
| GE2E-03 | Phase 15 | Pending |
| GUARD-01 | Phase 15 | Complete |

**Coverage:**
- v0.1.0 requirements: 22 total
- Mapped to phases: 22 (Phase 12: 6 · Phase 13: 2 · Phase 13.1: 1 · Phase 14: 9 · Phase 15: 4)
- Unmapped: 0

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 — v0.1.0 re-scope: re-versioned v0.0.4 → v0.1.0 (breaking executor rename EXEC-01); renamed the generator to `configuration`; added the standalone `init` generator (GEN-07), `configuration`-calls-`init` (GEN-08), and `nx add` support (GEN-09); reshaped GE2E-01/02 + added GE2E-03 (nx add e2e). Now 22 requirements across Phases 12-15 (incl. inserted 13.1). Prior update 2026-07-01: v0.0.4 re-scoped after spikes 001-005 GO (added WALK-01/02; reshaped GEN-01/02/03).*
