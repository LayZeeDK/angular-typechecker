# Requirements: angular-typechecker — v0.0.4 (typecheck-configuration generator and extended testing strategy)

**Defined:** 2026-07-01
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests — faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Strategy basis:** Unanimous 8-lens Opus board (5 constructive + 3 adversarial), fact-only, 2 rounds to consensus — `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`.
**Re-scoped 2026-07-01:** spikes 001-005 (`.planning/spikes/`, all VALIDATED — see `MANIFEST.md`) proved runtime solution-tsconfig reference-walking feasible on the existing `performCompilation` engine. Added **WALK-01/02** (engine) and reshaped **GEN-01/02/03** (the generator now wires ONE `typecheck` target at the solution `tsconfig.json`). This supersedes the D-03a solution-style short-circuit and the board's decision-B "no executor change" assumption (D1 in-memory generator tests unchanged; the executor changes, not the generator).

## Milestone v0.0.4 Requirements

### WALK — solution-tsconfig reference-walking (engine)

*Added 2026-07-01 (spikes 001-005 GO). Prerequisite for the reshaped GEN-02/03. Supersedes the D-03a solution-style short-circuit.*

- [x] **WALK-01**: The `angular-typecheck` engine (`runTypecheck`) accepts a solution / references-only `tsconfig.json` and type-checks each IN-PROJECT referenced leaf in one call: it resolves `references[]` to leaf tsconfigs, runs `performCompilation` per leaf, UNIONs the raw per-leaf diagnostics into a single `finalize` pass (dedupe by `ts.sortAndDeduplicateDiagnostics` value identity — `file.path`+start+length+code+`messageText`; explicit post-dedupe `DiagnosticCategory` counts, never `length - errorCount`; basePath = the solution tsconfig's directory). A reference-resolution-layer **module-boundary guard** SKIPS out-of-project references (skip-with-notice, path-containment under the project dir), orthogonal to and composable with the existing `filter-diagnostics` + `includeDeps` (which continue to govern imported *source* diagnostics unchanged). The **D-03a zero-rootNames guard splits three-way**: references present + ≥1 in-project leaf → walk; references present + 0 in-project → new synthesized error (code 90001, distinct message); no references → unchanged empty-project error. `rootNames > 0` direct-leaf path untouched; no branch gates on TS18003. `rootNamesCount` = sum over walked leaves. The locked `config-resolution.integration.spec.ts:124-130` assertion is rewritten, and `fixtures/solution-style` gains a KNOWN diagnostic + a real `tsconfig.spec.json` leaf so the walk assertion proves type-checking occurred.
- [x] **WALK-02**: A walk target's Nx `targetDefaults` inputs use the `default` named input (the lib+spec source union), NOT `production` (which excludes `*.spec.ts` and would under-hash spec sources → stale PASS); `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default` are retained. Any leaf/dep change busts the (coarse) single-target cache. README consumer guidance updated to the walk recipe. *(DEFERRED synergy, tracked below: project references / `NgtscProgram` incremental declaration-reuse to collapse the double-compile tax — additive, not blocking.)*

### GEN — `typecheck-configuration` generator

- [ ] **GEN-01**: A developer can run `nx g angular-typechecker:typecheck-configuration <project>` to wire a `typecheck` target (executor `angular-typechecker:angular-typecheck`) into the project's `project.json` (edits configuration only via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`; no `generateFiles`, no file emission).
- [ ] **GEN-02**: The generator wires ONE target pointed at the project's **solution `tsconfig.json`** (relying on WALK-01 to type-check its in-project referenced leaves), with an explicit `--tsConfig` override and a **flat-project fallback** (point at the leaf `tsconfig.app.json`/`tsconfig.lib.json` when the project has no solution tsconfig / no `references`). Per-project-type `tsConfig` detection is obviated by the walk. Configurable `targetName` (default `typecheck`). *(Nx workspaces only; Angular CLI `angular.json` layouts deferred; prod tsconfigs e.g. `tsconfig.lib.prod.json` are not referenced by the solution tsconfig and so are not walked — no-emit.)*
- [ ] **GEN-03**: Spec-tsconfig (`tsconfig.spec.json`) type-checking is automatic via WALK-01 (the spec tsconfig is an in-project referenced leaf the engine walks) — no separate target or `configuration` is wired. In the flat-project fallback (no solution tsconfig), spec checking is out of the single leaf target's scope and left to the consumer.
- [ ] **GEN-04**: Re-running the generator on an already-wired project is idempotent (no duplicate target, no clobbered config).
- [ ] **GEN-05**: The generator ships a hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` and the published `package.json` `generators` field; the generator + schema are included in the tarball `files` set.
- [ ] **GEN-06**: Generator unit tests run on the public in-memory `createTreeWithEmptyWorkspace` substrate and assert the written target configuration for each project type plus idempotency; a schema-parity spec asserts `schema.json` keys === the `schema.d.ts` interface.

### CAT — extended-diagnostic catalog

- [x] **CAT-01**: The integration suite asserts all 18 `ExtendedTemplateDiagnosticName` members by exact code + `DiagnosticCategory` + count, against the real `@angular/compiler-cli` over committed fixtures.
- [x] **CAT-02**: At least one severity-promotion case proves `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"` flips a warning-default diagnostic to an error (NG8011 excepted: out-of-band / not promotable — assert its observed category).
- [x] **CAT-03**: The baseline TS/NG codes (TS2322, TS2339, NG2003, NG2005, NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) are asserted by exact code.
- [x] **CAT-04**: The catalog is a single data-driven `it.each` table keyed on the enum members (introduction-version is a row field, not a per-version file split); any member not reproducible by a static fixture under Angular 22.0.4 is `it.skip` with a written reason (the row remains in the catalog).
- [x] **CAT-05**: `research/DIAGNOSTIC-CATALOG.md` is corrected to the authoritative 18-member set (the `ExtendedTemplateDiagnosticName` enum incl. NG8011 + NG8021, both outside the 81xx range; NG8110 + NG8118 noted as `ErrorCode`s that are NOT configurable extended diagnostics).

### DRIFT — completeness tripwire

- [x] **DRIFT-01**: A completeness tripwire asserts the catalog's covered-code set equals the `ExtendedTemplateDiagnosticName` enum, so an Angular release that adds/renames/removes a member fails CI loudly. Runs in the `test` (or `typecheck-drift`) job; consumes the enum at build/test time.

### GE2E — generator end-to-end (folded into `angular-typechecker-install-e2e`)

- [ ] **GE2E-01**: The plugin ships `generators.json`; the `install-e2e` consumer fixture gains a project WITHOUT a pre-wired target; an e2e scenario installs the tarball, runs `nx g angular-typechecker:typecheck-configuration` on that project, and asserts the resulting `project.json` target.
- [ ] **GE2E-02**: The same scenario then runs `nx run <proj>:angular-typecheck --skip-nx-cache` and asserts the verdict end-to-end (clean → success; an injected template/type error → failure with the diagnostic code visible). No Verdaccio; no new e2e project.

### GUARD — CI self-audit

- [ ] **GUARD-01**: A guard test asserts the `e2e` job's explicit `-p` project list equals the set of `e2e/*` projects in the workspace graph, converting a forgotten-`-p` silent skip into a loud, located failure.

## Future Requirements (deferred, tracked)

### FsTree real-disk testing

- **FSTREE-01**: Bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers (quarantined `nx/src/generators/tree` deep import + drift tripwire) — only if a future generator emits files a real compiler must read back. Not needed for a `project.json`-edit generator.

### Generator surface expansion

- **GEN-FUT-01**: Angular CLI (`angular.json`) workspace support for the generator (via `convertNxGenerator`).
- **GEN-FUT-02**: `ng add` / `nx add` install schematics.

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
| `ng add` / `nx add` install schematics; Angular CLI workspace generator | Deferred (GEN-FUT-01/02). |
| Machine-readable reporters (JSON/SARIF), `NgtscProgram` incremental/`--watch`, `createNodesV2` inference, Jest, Storybook story type-check, standalone CLI | Carried-forward deferrals (PROJECT.md Out of Scope). |

## Traceability

Each requirement maps to exactly one phase (v0.0.4 phases continue from v0.0.3's last phase 11).

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
| GEN-01 | Phase 14 | Pending |
| GEN-02 | Phase 14 | Pending |
| GEN-03 | Phase 14 | Pending |
| GEN-04 | Phase 14 | Pending |
| GEN-05 | Phase 14 | Pending |
| GEN-06 | Phase 14 | Pending |
| GE2E-01 | Phase 15 | Pending |
| GE2E-02 | Phase 15 | Pending |
| GUARD-01 | Phase 15 | Pending |

**Coverage:**
- v0.0.4 requirements: 17 total
- Mapped to phases: 17 (Phase 12: 6 · Phase 13: 2 · Phase 14: 6 · Phase 15: 3)
- Unmapped: 0

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 — v0.0.4 re-scoped after spikes 001-005 GO: added WALK-01/02 (engine reference-walking), reshaped GEN-01/02/03 (one `typecheck` target → solution `tsconfig.json`). Now 17/17 requirements mapped across Phases 12-15 (12 shipped; 13 engine-walk; 14 generator; 15 e2e + guard).*
