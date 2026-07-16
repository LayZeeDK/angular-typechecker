# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [SHIPPED] **v0.2.0** -- Phases 16-20 -- shipped 2026-07-07. Storybook story type-checking via one boundary-filter correctness fix (directory-containment -> compiler input-set membership), across both Nx-official layouts, with no silent false pass. Full detail: `.planning/milestones/v0.2.0-ROADMAP.md`.
- [SHIPPED] **v0.2.1** -- Phases 21-24 -- shipped 2026-07-16. Angular CLI (`angular.json`) workspace support: `ng add`/`ng generate`/`ng run` for the typecheck target, additive-only beside the existing Nx surface, proven against real OSS Angular 22 workspaces. Full detail: `.planning/milestones/v0.2.1-ROADMAP.md`.
- [CURRENT] **v0.2.2** -- Phases 25-29 -- Standalone CLI. A standalone `angular-typechecker` / `atc` command-line binary that runs the complete Angular type-check (TypeScript + template + extended NG8xxx, no emit) outside Nx and the Angular CLI -- a third thin adapter over the same `runTypecheck` core -- finally owning the literal OS exit codes `0`/`1`/`2`. Additive-only patch bump (`0.2.1 -> 0.2.2`).

## Phases

<details>
<summary>[SHIPPED] v0.0.1 (Phases 1-7, incl. 5.1) -- SHIPPED 2026-06-29</summary>

- [x] Phase 1: Workspace Bootstrap + Engine Spike (GATED) (4/4 plans) -- completed 2026-06-27
- [x] Phase 2: Core Type-Check Engine + Gatherer (3/3 plans) -- completed 2026-06-27
- [x] Phase 3: Filtering, Modes, Output + Quality Gates (4/4 plans) -- completed 2026-06-27
- [x] Phase 4: Nx Executor Adapter + Cacheable Target (3/3 plans) -- completed 2026-06-28
- [x] Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) (5/5 plans) -- completed 2026-06-28
- [x] Phase 5.1: 0.0.2 first OIDC steady-state publish verification (INSERTED) (1/1 plan) -- completed 2026-06-29
- [x] Phase 6: Full e2e Matrix + CI (5/5 plans) -- completed 2026-06-29
- [x] Phase 7: Release-PR workflow and clean changelog (4/4 plans) -- completed 2026-06-29

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.1-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.0.3 -- Engine hardening (Phases 8-11) -- SHIPPED 2026-06-30</summary>

- [x] Phase 8: Correctness & Completeness Fixes (3/3 plans) -- completed 2026-06-29
- [x] Phase 9: Resilience (per-file fault isolation + boundary robustness) (5/5 plans) -- completed 2026-06-29
- [x] Phase 10: Drift-hardening & Maintainability (4/4 plans) -- completed 2026-06-29
- [x] Phase 11: Fallow code-quality CI gate (2/2 plans) -- completed 2026-06-30

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.3-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.1.0 -- reference-walking engine, typecheck executor rename, and the configuration + init generator suite (Phases 12-15, incl. inserted 13.1) -- SHIPPED 2026-07-02</summary>

- [x] Phase 12: Extended-diagnostic catalog + completeness tripwire (4/4 plans) -- completed 2026-07-01
- [x] Phase 13: Engine -- solution-tsconfig reference-walking (6/6 plans) -- completed 2026-07-01
- [x] Phase 13.1: Rename angular-typecheck executor to typecheck (INSERTED) (1/1 plan) -- completed 2026-07-01
- [x] Phase 14: configuration + init generators, nx add (3/3 plans) -- completed 2026-07-02
- [x] Phase 15: Generator e2e + CI self-audit guard (2/2 plans) -- completed 2026-07-02

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.1.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.0 -- Storybook story type-checking (Phases 16-20) -- SHIPPED 2026-07-07</summary>

- [x] Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO) -- completed 2026-07-05 (GO)
- [x] Phase 17: Input-set-membership boundary + layout support (7/7 plans) -- completed 2026-07-06
- [x] Phase 18: Packaged-tarball e2e + docs (5/5 plans) -- completed 2026-07-06
- [x] Phase 19: Stretch -- Layout C / non-TS story formats / strict mode (3/3 plans) -- completed 2026-07-07
- [x] Phase 20: Vite/Analog Storybook query-import guidance (5/5 plans) -- completed 2026-07-07

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.1 -- Angular CLI workspace support (Phases 21-24) -- SHIPPED 2026-07-16</summary>

- [x] Phase 21: Angular CLI builder engine (multi-tsConfig, GATE A' spike GO/NO-GO) (3/3 plans) -- completed 2026-07-11 -- ENG-01, ACB-01/02/03: GATE A' = GO against a real `bluehalo/ngx-leaflet` clone; `tsConfig` widened to `string | string[]`.
- [x] Phase 22: Configuration schematic -- the angular.json write-fork (2/2 plans) -- completed 2026-07-11 -- ACS-01/02/04, COV-01: `ng generate ...:configuration` wires `tsConfig: [buildLeaf, specLeaf]` into `angular.json`.
- [x] Phase 23: Init schematic parity + first-party ng-add (3/3 plans) -- completed 2026-07-12 -- ACS-03, NGADD-01, ACP-01: `ng generate ...:init` parity, optional peer classification, `ng-add` auto-wire-all (first iteration).
- [x] Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs (6/6 plans, incl. 3 gap-closure) -- completed 2026-07-15 -- ACV-01/02/03, ACP-02, ACD-01 + gap-closure NGADD-01 (yarn `nx` peer + nx-free vanilla `ng-add`).

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.1-ROADMAP.md`

</details>

<details open>
<summary>[CURRENT] v0.2.2 -- Standalone CLI (Phases 25-29)</summary>

- [x] Phase 25: Extract the advisory-notice seam (CLI-04) (1/1 plans) -- completed 2026-07-16
- [ ] Phase 26: Pure CLI core + exit-code wiring (3 plans) (CLI-02/03, ARGS-01..05, EXIT-01/02, PKG-03, VER-01/02)
- [ ] Phase 27: Bin shell + cross-platform packaging (CLI-01, PKG-01/02, VER-03, ADD-01)
- [ ] Phase 28: Shipped-tarball e2e + real-clone UAT (VER-04, VER-05)
- [ ] Phase 29: Docs (DOC-01)

</details>

## Phase Details (v0.2.2 -- current milestone)

### Phase 25: Extract the advisory-notice seam

**Goal**: The five advisory notices emit through one shared, logger-injected core module that the Nx executor drives with byte-identical observable behavior -- a reusable seam ready for the CLI adapter, so the CLI never has to import `executor.ts` (which would drag `@nx/devkit`/`chalk` -- the 24-06 crash class) or duplicate five message helpers.
**Depends on**: v0.2.1 (shipped)
**Requirements**: CLI-04
**Success Criteria** (what must be TRUE):
  1. A new pure `core/emit-advisory-notices.ts` renders every advisory (coverage-incomplete, TCB-abort, not-type-checked, bundler-query-imports, and the remaining `warn*` helper) through an injected structural `Logger` (`info`/`warn`/`error`), importing no `nx`/`@nx/devkit`, no `console`, no `process` -- enforced by the existing `core/**` lint boundary.
  2. The Nx executor injects its own logger via `emitAdvisoryNotices(result, logger)` and its notice output is byte-identical to `angular-typechecker@0.2.1` -- all existing executor and builder tests stay green with no behavioral diff.
  3. A unit spec drives `emit-advisory-notices` against a mock `Logger` and asserts each notice's message text and stream routing (advisories/errors via `warn`/`error`).
**Plans**:
- [x] 25-01-PLAN.md -- Extract the advisory-notice seam: new core/logger.ts Logger interface + pure core/emit-advisory-notices.ts (five helpers moved verbatim) + executor swap to one emitAdvisoryNotices(result, logger) call + byte-exact unit spec (CLI-04)

### Phase 26: Pure CLI core + exit-code wiring

**Goal**: A pure `run(argv, env)` resolves flags, runs the SAME `runTypecheck` core, and returns the correct `{ exitCode, stdout, stderr }` -- with the two-step exit-code compose that owns literal `2` for infra/usage and derives the `0`-vs-`1` split from `evaluateResult().success`, never from raw error counts. All load-bearing correctness lives here, fully unit- and integration-testable in-process with no packaging.
**Depends on**: Phase 25
**Requirements**: CLI-02, CLI-03, ARGS-01, ARGS-02, ARGS-03, ARGS-04, ARGS-05, EXIT-01, EXIT-02, PKG-03, VER-01, VER-02
**Success Criteria** (what must be TRUE):
  1. `run(argv, env)` parses `--tsConfig`/`-c` (repeatable, required), `--max-warnings`, `--fail-fast`, `--include-deps`, `--strict`, `--help`/`-h`, `--version` via Node stdlib `util.parseArgs` with ZERO new runtime or dev dependencies, and produces the SAME diagnostics and verdict as the Nx executor by composing `runTypecheck` (complete TS + template + extended NG8xxx set, no emit).
  2. A clean project returns exit code `0`; a completed run with type errors OR warnings-exceeded OR coverage-incomplete returns `1` (via `evaluateResult(...).success`, even when `errorCount === 0`); a `TypecheckInfrastructureError` returns `2` via `toExitCode` (its first live consumer); an unknown flag, a missing required `--tsConfig`, or a non-integer `--max-warnings` returns usage `2` with a clear message.
  3. `--help`/`-h` and `--version` print and return `0`; a single `--tsConfig` takes the string (direct / solution-walk) path while two or more take the `string[]` union path -- a single input is never passed as a one-element array.
  4. The CLI entrypoint imports ONLY pure-core modules (never `@nx/devkit`/`nx` at runtime); `run()` never calls `process.exit` and never writes a stream; a console logger routes the report to stdout and advisory notices/errors to stderr, color auto-detects honoring `NO_COLOR`/`FORCE_COLOR`/TTY, and tsconfig paths resolve from an arbitrary CWD via nx-free `node:path` + `realpathSync.native`-normalization before the boundary filter.
  5. In-process `*.spec.ts` on the 6-cell OS x Node matrix cover the pure logic against a STUBBED core (VER-01: parse mapping, exit-code composition incl. the `errorCount === 0` / `success === false` cases, console logger, `emit-advisory-notices`) AND exercise `run(argv)` end-to-end against committed real-cold-compiler fixtures (VER-02: clean->0, planted TS/template/NG8xxx->1, real coverage-incomplete->1, `--max-warnings 0` and `--strict`->1, multi- and single-`--tsConfig` paths, malformed/nonexistent tsconfig->2), exercising the CJS->ESM `await import()` bridge and Windows path normalization.
**Plans**: 3 plans
- [x] 26-01-PLAN.md -- parse-args.ts (util.parseArgs wrapper + validation + help/version) + console-logger.ts (BufferingLogger) + parse-args unit spec (ARGS-01/02/04, CLI-03, VER-01)
- [ ] 26-02-PLAN.md -- main.ts run() compose + two-step exit-code + nx-free path resolution + color, with the stubbed-core unit spec (CLI-02/03, ARGS-03/05, EXIT-01/02, PKG-03, VER-01)
- [ ] 26-03-PLAN.md -- main.integration.spec.ts end-to-end run(argv) against real fixtures (CLI-02, EXIT-01, PKG-03, VER-02)

### Phase 27: Bin shell + cross-platform packaging

**Goal**: A thin, cross-platform `bin.ts` shell ships the CLI under two `bin` names, with the shebang and the CJS->ESM bridge surviving the build into the PUBLISHED artifact, an nx-free import boundary enforced by lint + a static build guard, and the whole milestone proven additive-only vs `angular-typechecker@0.2.1`.
**Depends on**: Phase 26
**Requirements**: CLI-01, PKG-01, PKG-02, VER-03, ADD-01
**Success Criteria** (what must be TRUE):
  1. A user can run the complete Angular type-check with NO Nx or Angular CLI workspace present via two `bin` names (`angular-typechecker` primary + `atc` alias) that resolve to one compiled `src/cli/bin.js`; `bin.ts` is the ONLY site that touches `process.exit` / stream writes and is flush-safe on large buffered output.
  2. The source shebang (`#!/usr/bin/env node`, LF) survives `@nx/js:tsc` into the BUILT and PUBLISHED `bin.js` (`newLine: lf` + a `.gitattributes` rule guard against CRLF corruption); the bin compiles under the same `module: nodenext` config so the `await import('@angular/compiler-cli')` bridge is never downleveled to `require()` (no `ERR_REQUIRE_ESM`), validated by the tarball `publint` bin audit.
  3. A `bin-static.spec.ts` (`test` tier, `dependsOn: build`, modeled on `gate-a-static.spec.ts`) asserts the BUILT `bin.js` starts with a `\r`-free `#!/usr/bin/env node` shebang and that its `require` graph never reaches `@nx/devkit`/`nx`; a `src/cli/**` ESLint import-ban enforces the nx-free boundary.
  4. A git-diff / barrel-drift audit proves the milestone is additive-only vs `angular-typechecker@0.2.1` -- no breaking change to the Nx executor id (`angular-typechecker:typecheck`), the `runTypecheck`/`CoreResult`/`CoreOptions` public API, the Angular CLI builder, or the generator schemas (the `executor.ts` logger swap is internal + observably identical; the `bin` field and `src/cli/**` are net-new) -- and the `v0.3.0` escape hatch stays untriggered.
**Plans**: TBD

### Phase 28: Shipped-tarball e2e + real-clone UAT

**Goal**: The shipped `bin`s, installed from the packed tarball across the package-manager matrix on Linux AND Windows, return literal OS exit codes `0`/`1`/`2` through the real package-manager `.bin` shim, and the same shipped `bin`s prove correct against real on-stack Angular 22 OSS workspaces of both kinds (a real Nx workspace and a real Angular CLI workspace).
**Depends on**: Phase 27
**Requirements**: VER-04, VER-05
**Success Criteria** (what must be TRUE):
  1. A DEDICATED `angular-typechecker-cli-e2e` project (auto-covered by the dynamic per-project CI matrix) proves the SHIPPED `angular-typechecker` + `atc` `bin`s and `npx angular-typechecker` return literal process exit codes `0`/`1`/`2` through the real PM-generated `.bin` shim across npm + yarn (flat + workspace) + pnpm -- net-new coverage vs the existing Nx/ng `{success}` (0/1) harness being literal exit `2` (infra + usage) and the shim path.
  2. The e2e CI job gains an OS axis for THIS project so the tarball e2e runs on BOTH Linux AND Windows (Node 24), and the Windows leg handles the known Windows-Verdaccio robustness issues (127.0.0.1 bind / ECONNREFUSED retry) that motivate the repo's Linux-only heavy-e2e default -- accepted deliberately because the `.cmd`/`.ps1` bin shim is the one genuinely Windows-divergent CLI surface (RISK: this is a departure from the Linux-only default and must be surfaced in the plan).
  3. Output never matches `/ERR_REQUIRE_ESM/`, and a module-graph probe confirms the installed bin's `require` cache never reaches `@nx/*`/`nx/`.
  4. Manual real-clone UAT runs the shipped `bin`s at real project tsconfigs in on-stack Angular 22 clones of both kinds -- a real Nx workspace (`radix-ng/primitives` primary, `analogjs/analog` alt) AND a real Angular CLI (`angular.json`) workspace (`bluehalo/ngx-leaflet`, `realworld-angular`) -- asserting planted-error RED / clean GREEN / bad-path -> `2` (ACV-01 pattern; uncommitted clones pinned by URL + SHA).
**Plans**: TBD

### Phase 29: Docs

**Goal**: The README documents the standalone CLI -- installation, the flag set, and the `0`/`1`/`2` exit-code contract -- steering users to `npx angular-typechecker` (never `npx atc`, which would fetch the unrelated `atc@0.0.6`), with a curated end-user-language CHANGELOG entry.
**Depends on**: Phase 28
**Requirements**: DOC-01
**Success Criteria** (what must be TRUE):
  1. A README `## Standalone CLI` section documents installation, the full flag set, and the exit-code contract table (`0` clean / `1` verdict-fail / `2` infra-or-usage).
  2. The canonical uninstalled invocation documented is `npx angular-typechecker`; `atc` appears ONLY as a post-install PATH shorthand -- docs never instruct `npx atc` (supply-chain hazard: `atc@0.0.6` is an unrelated published package).
  3. A curated public CHANGELOG entry is written in end-user language with no internal ids/scopes (per the repo's changelog-hygiene rule).
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | --------------- | ------ | --------- |
| 1. Workspace Bootstrap + Engine Spike (GATED) | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 2. Core Type-Check Engine + Gatherer | v0.0.1 | 3/3 | Complete | 2026-06-27 |
| 3. Filtering, Modes, Output + Quality Gates | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 4. Nx Executor Adapter + Cacheable Target | v0.0.1 | 3/3 | Complete | 2026-06-28 |
| 5. Packaging, Publish Hardening + e2e Smoke (MVP) | v0.0.1 | 5/5 | Complete | 2026-06-28 |
| 5.1 0.0.2 first OIDC steady-state publish verification (INSERTED) | v0.0.1 | 1/1 | Complete | 2026-06-29 |
| 6. Full e2e Matrix + CI | v0.0.1 | 5/5 | Complete | 2026-06-29 |
| 7. Release-PR workflow and clean changelog | v0.0.1 | 4/4 | Complete | 2026-06-29 |
| 8. Correctness & Completeness Fixes | v0.0.3 | 3/3 | Complete | 2026-06-29 |
| 9. Resilience (per-file fault isolation + boundary robustness) | v0.0.3 | 5/5 | Complete | 2026-06-29 |
| 10. Drift-hardening & Maintainability | v0.0.3 | 4/4 | Complete | 2026-06-29 |
| 11. Fallow code-quality CI gate | v0.0.3 | 2/2 | Complete | 2026-06-30 |
| 12. Extended-diagnostic catalog + completeness tripwire | v0.1.0 | 4/4 | Complete | 2026-07-01 |
| 13. Engine -- solution-tsconfig reference-walking | v0.1.0 | 6/6 | Complete | 2026-07-01 |
| 13.1 Rename angular-typecheck executor to typecheck (INSERTED) | v0.1.0 | 1/1 | Complete | 2026-07-01 |
| 14. configuration + init generators, nx add | v0.1.0 | 3/3 | Complete | 2026-07-02 |
| 15. Generator e2e + CI self-audit guard | v0.1.0 | 2/2 | Complete | 2026-07-02 |
| 16. Storybook type-check gate spike (GATED) | v0.2.0 | spike 006-008 | Complete (GO) | 2026-07-05 |
| 17. Input-set-membership boundary + layout support | v0.2.0 | 7/7 | Complete | 2026-07-06 |
| 18. Packaged-tarball e2e + docs | v0.2.0 | 5/5 | Complete | 2026-07-06 |
| 19. Stretch (Layout C / non-TS formats / strict mode) | v0.2.0 | 3/3 | Complete | 2026-07-07 |
| 20. Vite/Analog Storybook query-import guidance | v0.2.0 | 5/5 | Complete | 2026-07-07 |
| 21. Angular CLI builder engine (multi-tsConfig, GATE A') | v0.2.1 | 3/3 | Complete | 2026-07-11 |
| 22. Configuration schematic -- the angular.json write-fork | v0.2.1 | 2/2 | Complete | 2026-07-11 |
| 23. Init schematic parity + first-party ng-add | v0.2.1 | 3/3 | Complete | 2026-07-12 |
| 24. Real-OSS + scaffolded e2e, additive-only audit, docs | v0.2.1 | 6/6 | Complete | 2026-07-15 |
| 25. Extract the advisory-notice seam | v0.2.2 | 1/1 | Complete    | 2026-07-16 |
| 26. Pure CLI core + exit-code wiring | v0.2.2 | 1/3 | In Progress|  |
| 27. Bin shell + cross-platform packaging | v0.2.2 | 0/0 | Not started | - |
| 28. Shipped-tarball e2e + real-clone UAT | v0.2.2 | 0/0 | Not started | - |
| 29. Docs | v0.2.2 | 0/0 | Not started | - |

## Backlog

- **GitHub-backed self-hosted Nx remote cache** -- a workspace-wide CI cache optimization proposed and then removed from the v0.2.1 roadmap (was Phase 25) as lower priority than the already-shipped e2e per-project matrix split (~41% faster). Grounded by `260715-050-RESEARCH-3.md` (GitHub Actions Cache backend, CREEP-mitigated). Requires fixing the OS/Node hash landmine (`RUNNER_OS` + Node major as `env` named inputs) before any cache replay.
