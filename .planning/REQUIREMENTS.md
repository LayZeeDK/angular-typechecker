# Requirements: angular-typechecker — v0.0.4 (typecheck-configuration generator and extended testing strategy)

**Defined:** 2026-07-01
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests — faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Strategy basis:** Unanimous 8-lens Opus board (5 constructive + 3 adversarial), fact-only, 2 rounds to consensus — `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`.

## Milestone v0.0.4 Requirements

### GEN — `typecheck-configuration` generator

- [ ] **GEN-01**: A developer can run `nx g angular-typechecker:typecheck-configuration <project>` to wire an `angular-typecheck` target into the project's `project.json` (edits configuration only via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`; no `generateFiles`, no file emission).
- [ ] **GEN-02**: The generator defaults the target's `tsConfig` by project type — application → `tsconfig.app.json`, library → `tsconfig.lib.json` — with an explicit `--tsConfig` override. *(Generator-phase design decision: detection method, and single-target+option vs. multiple targets vs. `configurations`. Nx workspaces only; Angular CLI `angular.json` layouts deferred; prod tsconfigs e.g. `tsconfig.lib.prod.json` skipped — no-emit.)*
- [ ] **GEN-03**: The generator supports spec-tsconfig (`tsconfig.spec.json`) type-checking when a spec tsconfig exists (target/configuration shape finalized with GEN-02 in the generator phase).
- [ ] **GEN-04**: Re-running the generator on an already-wired project is idempotent (no duplicate target, no clobbered config).
- [ ] **GEN-05**: The generator ships a hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` and the published `package.json` `generators` field; the generator + schema are included in the tarball `files` set.
- [ ] **GEN-06**: Generator unit tests run on the public in-memory `createTreeWithEmptyWorkspace` substrate and assert the written target configuration for each project type plus idempotency; a schema-parity spec asserts `schema.json` keys === the `schema.d.ts` interface.

### CAT — extended-diagnostic catalog

- [ ] **CAT-01**: The integration suite asserts all 18 `ExtendedTemplateDiagnosticName` members by exact code + `DiagnosticCategory` + count, against the real `@angular/compiler-cli` over committed fixtures.
- [ ] **CAT-02**: At least one severity-promotion case proves `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"` flips a warning-default diagnostic to an error (NG8011 excepted: out-of-band / not promotable — assert its observed category).
- [ ] **CAT-03**: The baseline TS/NG codes (TS2322, TS2339, NG2003, NG2005, NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) are asserted by exact code.
- [ ] **CAT-04**: The catalog is a single data-driven `it.each` table keyed on the enum members (introduction-version is a row field, not a per-version file split); any member not reproducible by a static fixture under Angular 22.0.4 is `it.skip` with a written reason (the row remains in the catalog).
- [ ] **CAT-05**: `research/DIAGNOSTIC-CATALOG.md` is corrected to the authoritative 18-member set (the `ExtendedTemplateDiagnosticName` enum incl. NG8011 + NG8021, both outside the 81xx range; NG8110 + NG8118 noted as `ErrorCode`s that are NOT configurable extended diagnostics).

### DRIFT — completeness tripwire

- [ ] **DRIFT-01**: A completeness tripwire asserts the catalog's covered-code set equals the `ExtendedTemplateDiagnosticName` enum, so an Angular release that adds/renames/removes a member fails CI loudly. Runs in the `test` (or `typecheck-drift`) job; consumes the enum at build/test time.

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

Populated during roadmap creation (each requirement maps to exactly one phase).

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEN-01 | — | Pending |
| GEN-02 | — | Pending |
| GEN-03 | — | Pending |
| GEN-04 | — | Pending |
| GEN-05 | — | Pending |
| GEN-06 | — | Pending |
| CAT-01 | — | Pending |
| CAT-02 | — | Pending |
| CAT-03 | — | Pending |
| CAT-04 | — | Pending |
| CAT-05 | — | Pending |
| DRIFT-01 | — | Pending |
| GE2E-01 | — | Pending |
| GE2E-02 | — | Pending |
| GUARD-01 | — | Pending |

**Coverage:**
- v0.0.4 requirements: 15 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 15 (roadmap pending)

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 after initial definition (board-ratified testing strategy)*
