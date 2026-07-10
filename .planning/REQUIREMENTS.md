# Requirements: angular-typechecker

**Defined:** 2026-07-10
**Milestone:** v0.2.1 -- Angular CLI (`angular.json`) workspace support
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.

**Charter (ADDITIVE-ONLY):** every requirement below is additive beside the shipped Nx surface. No breaking changes to the Nx executor id (`angular-typechecker:typecheck`), the `runTypecheck`/`CoreResult`/`CoreOptions` public API (widening only), or the existing generator/executor schemas. `feat` under 0.x conventional commits bumps `0.2.0 -> 0.2.1`. If a breaking change proves UNAVOIDABLE, the milestone re-versions to **v0.3.0** (a `!`/`BREAKING CHANGE` commit) -- an explicit, deliberate decision.

Design decisions and empirical verification: `.planning/research/v0.2.1-angular-cli/SUMMARY.md` (CORRECTION & LOCKED DECISIONS).

## v0.2.1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Engine -- multi-tsConfig (ENG)

- [x] **ENG-01**: The `tsConfig` option accepts `string | string[]`. An array runs each entry through the existing single-`tsConfig` logic, UNIONs the diagnostics, and filters via the v0.2.0 input-set-membership boundary over the combined declared input sets. Additive/non-breaking: `CoreOptions.tsConfig` + the executor `schema.json` (`oneOf` string|array) + `normalize-options` are widened only; the single-string behavior and the Nx path are byte-unchanged.

### Angular CLI Builder (ACB)

- [x] **ACB-01**: `ng run <project>:typecheck` runs the complete Angular type-check via a `convertNxExecutor`-wrapped builder, producing diagnostics, human output, and an exit/`BuilderOutput.success` verdict identical to the Nx executor.
- [x] **ACB-02** (GATE A', GO/NO-GO): a spike proves the CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` engine survives `convertNxExecutor` + a real `ng run` **on-stack (Angular 22)**, with no `ERR_REQUIRE_ESM` (incl. the wrapper's eager project-graph prelude), verified against a REAL cloned OSS Angular 22 `angular.json` workspace (`bluehalo/ngx-leaflet`, MIT, non-Nx, app + lib) used for quick verification. A NO-GO re-scopes the builder (documented) and never falls back to a hand-written architect builder. (Off-stack Angular 21 was DROPPED from this gate 2026-07-10 per user directive.)
- [x] **ACB-03**: `builders.json` + the `package.json` `builders` field are added additively; `nx run <project>:typecheck` still resolves unchanged (a field-aliasing / Nx-surface regression assertion: `executors ?? builders`).

### Angular CLI Schematics (ACS)

- [x] **ACS-01**: `ng generate angular-typechecker:configuration <project>` wires ONE per-project `typecheck` architect target into `angular.json` with `tsConfig: [<project build leaf>, <project spec leaf>]` (via the `tree.exists('angular.json')` write-fork; config-edit-only, no emitted file; idempotent + collision-safe).
- [x] **ACS-02**: the Nx `configuration` generator path stays behavior-unchanged -- one shared generator with the workspace-type fork; the Nx path still writes a single-string solution `tsConfig`.
- [x] **ACS-03**: `ng generate angular-typechecker:init` is available for parity; on an Angular CLI workspace it seeds NO caching and creates no stray `nx.json`.
- [x] **ACS-04**: `collection.json` + the `package.json` `schematics` field are added additively; `nx g angular-typechecker:configuration` still resolves unchanged (regression assertion: `generators ?? schematics`).

### ng add (NGADD)

- [ ] **NGADD-01**: `ng add angular-typechecker` runs a first-party `ng-add` schematic that iterates `angular.json#projects` and auto-wires a `typecheck` target into EVERY `application` + `library` project (idempotent -- skips a project that already has a `typecheck` target; app + library only, skipping e2e/other project types), ensures the devDependency, and prints an explicit "no target caching on Angular CLI" notice. The Nx `nx add` behavior is unchanged from v0.2.0.

### Coverage (COV)

- [x] **COV-01**: a per-project `typecheck` target type-checks that project's COMPLETE leaf set (application+spec, or library+spec) and ONLY that project's leaves (no cross-project bleed) -- proven by scaffolding `ng g library` and asserting per-project scoping.

### Verification (ACV)

- [ ] **ACV-01**: the milestone's FINAL tarball end-to-end verification gate, proven against a REAL cloned OSS Angular 22 `angular.json` workspace (`bluehalo/ngx-leaflet`, on-stack Angular 22, MIT, non-Nx, app `ngx-leaflet-demo` + lib `ngx-leaflet`): pack the SHIPPED tarball -> `ng add` -> `ng run <project>:typecheck` -> assert planted diagnostics. Real-repo gate run locally/manually (the clone is UNCOMMITTED; reproduction = repo URL + commit SHA). No off-stack Angular 21 cross-check (DROPPED 2026-07-10).
- [ ] **ACV-02**: the repeatable AUTOMATED e2e (runs in CI with no external clone), proven against a freshly SCAFFOLDED workspace (`npm init @angular` + `ng g library`): plant application + spec + library errors and assert each per-project target catches exactly its own leaves.
- [ ] **ACV-03**: unit + integration coverage of the Angular-CLI-vs-Nx differences: the `tsConfig: string[]` union; the `angular.json` write-fork on an `angular.json` schematics test tree; the builder over `BuilderContext`; `ng-add` auto-wire-all + idempotency; and no stray `nx.json`.

### Packaging / deps (ACP)

- [x] **ACP-01**: `@angular-devkit/architect` + `rxjs` are declared as OPTIONAL `peerDependencies` (runtime-required by the converted builder; present in any Angular CLI workspace); `@nx/dependency-checks` stays green; the "`ng add` pulls `nx` transitively + may create a `.nx/` dir" consequence is documented.
- [ ] **ACP-02**: additive-only is enforced: no breaking change to the executor id, `runTypecheck`/`CoreResult`/`CoreOptions` (widened only), or the existing schemas (v0.3.0 only if a breaking change proves unavoidable).

### Docs (ACD)

- [ ] **ACD-01**: README gains an `## Angular CLI` section (`ng add` auto-wire-all; `ng generate ...:configuration` for a single project; `ng run <project>:typecheck`; per-project targets; the `tsConfig` array; the `nx`-transitive + no-caching notes; the off-stack `--legacy-peer-deps` note), plus a curated CHANGELOG entry in end-user language (no internal ids).

## Future Requirements

Deferred beyond v0.2.1. Tracked, not in this roadmap.

### Nx auto-provisioning (WALK-FUT-01)

- **WALK-FUT-01**: `createNodesV2` inference so Nx auto-provides per-leaf `typecheck` targets without editing each `project.json` (the idiomatic Nx analog of the Angular CLI `ng add` auto-wire). The Nx `nx add` remains init/caching-only until then.

## Out of Scope

Explicitly excluded from v0.2.1.

| Feature | Reason |
|---------|--------|
| Changing the Nx `nx add` to auto-wire all Nx projects | Would change shipped v0.2.0 install UX; the idiomatic Nx path is `createNodesV2` inference (WALK-FUT-01), deferred. |
| Hand-written `@angular-devkit/architect` builder or `@angular-devkit/schematics` Rule | Charter mandates the thin `convertNx*` re-export over the shared core; a hand-written adapter would fork the engine (v0.3.0 scope). |
| Emitted per-project solution tsconfig | Superseded by `tsConfig: string[]` (Option A) -- keeps the generator config-edit-only. |
| Runtime `angular.json`/tsconfig parsing in the builder to auto-resolve leaves | Higher engine + failure-mode surface; leaves are resolved at generate-time and written into the target. |
| `.angular/cache` (or a custom cache dir) target caching | Verified build-pipeline-only; Angular CLI has no task-result cache to seed. |
| Machine-readable reporters (JSON / SARIF) | Project-wide deferral, unchanged by this milestone. |
| `NgtscProgram` incremental / `--watch` | Deferred engine work (REP family). |
| Standalone CLI binary; Jest support; Angular CLI Storybook special-casing | Out of the Angular-CLI-workspace-support charter. |
| Wider Angular support (off-stack Angular 21/20; older majors) | Stack stays Nx 23 / Angular 22 / TS 6. Off-stack Angular 21 (and any cross-version e2e cross-check) DROPPED 2026-07-10 per user directive -- verification is on-stack Angular 22 only. |

## Traceability

Phase numbering continues from v0.2.0's Phase 20.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 21 | Complete |
| ACB-01 | Phase 21 | Complete |
| ACB-02 | Phase 21 | Complete |
| ACB-03 | Phase 21 | Complete |
| ACS-01 | Phase 22 | Complete |
| ACS-02 | Phase 22 | Complete |
| ACS-03 | Phase 23 | Complete |
| ACS-04 | Phase 22 | Complete |
| NGADD-01 | Phase 23 | Pending |
| COV-01 | Phase 22 | Complete |
| ACV-01 | Phase 24 | Pending |
| ACV-02 | Phase 24 | Pending |
| ACV-03 | Phase 24 | Pending |
| ACP-01 | Phase 23 | Complete |
| ACP-02 | Phase 24 | Pending |
| ACD-01 | Phase 24 | Pending |

**Coverage:**
- v0.2.1 requirements: 16 total
- Mapped to phases: 16 (Phase 21: 4 | Phase 22: 4 | Phase 23: 3 | Phase 24: 5)
- Unmapped: 0

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-10 after milestone v0.2.1 definition*
