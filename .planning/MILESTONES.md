# Milestones: angular-typechecker

A historical record of shipped versions. For current work see `.planning/ROADMAP.md`.

---

## v0.2.2 -- Standalone CLI

**Closed:** 2026-07-17 (phases complete + milestone audit PASSED)
**Phases:** 25-29 (5) | **Plans:** 12 | **Commits:** 150 (since the `angular-typechecker@0.2.1` tag)
**Timeline:** 2026-07-16 -> 2026-07-17 (2 days)
**Published:** `angular-typechecker@0.2.2` (npm, live, `latest`, tag on the release merge commit dated 2026-07-17, tokenless OIDC + SLSA v1 provenance).

### Delivered

A standalone `angular-typechecker` / `atc` command-line binary that runs the *complete*
Angular type-check (TypeScript + template type-check + extended NG8xxx, no emit) outside Nx
and the Angular CLI -- a third thin adapter over the same `runTypecheck` core -- and the
first surface to own the literal OS exit code `2` for infrastructure/usage errors. Two `bin`
names resolve to one compiled `src/cli/bin.js`; args via Node stdlib `util.parseArgs` (zero
new dependencies); the CLI path imports ONLY the pure core (never `@nx/devkit`/`nx` at
runtime). Purely additive beside the existing Nx executor + Angular CLI builder -- patch bump
`0.2.1 -> 0.2.2`, `v0.3.0` escape hatch never triggered.

### Key Accomplishments

1. **Advisory-notice seam extracted (Phase 25, CLI-04)** -- the five executor `warn*` helpers moved VERBATIM into a pure `core/emit-advisory-notices.ts` behind an injected structural `Logger`; the Nx executor emits every advisory through one `emitAdvisoryNotices(result, logger)` call with byte-identical behavior, so the CLI can drive advisories without importing `executor.ts` (dodging the `@nx/devkit`/chalk 24-06 crash class).
2. **Pure `run(argv, env)` CLI core + two-step exit-code compose (Phase 26, CLI-02/03, ARGS-01..05, EXIT-01/02, VER-01/02, PKG-03, VER-01)** -- the third thin adapter mirrors the executor compose order; usage -> `2`, `TypecheckInfrastructureError` -> `toExitCode` = `2` (its first live consumer), completed -> `evaluateResult(...).success ? 0 : 1` (coverage-incomplete/warnings-exceeded with `errorCount === 0` correctly returns `1`, the anti-false-pass). Single `--tsConfig` collapses to a string (solution-walk), 2+ stay `string[]`. Pure: no `process.exit`/stream writes.
3. **Flush-safe `bin.ts` shell + cross-platform packaging (Phase 27, CLI-01, PKG-01/02, VER-03, ADD-01)** -- two `bin` names -> one `./src/cli/bin.js`; `newLine: lf` + `.gitattributes` pin the deterministic LF shebang through `@nx/js:tsc`; no separate bin tsconfig so the `await import()` ESM bridge is never downleveled; `src/cli/**` nx-free import-ban + a static require-graph guard; additive-only audit vs `0.2.1`.
4. **Shipped-tarball e2e + real-clone UAT (Phase 28, VER-04/05)** -- a dedicated `angular-typechecker-cli-e2e` project proves the shipped `bin`s return literal `0`/`1`/`2` through the real package-manager `.bin` shim across npm + yarn (flat + workspace) + pnpm on Linux AND Windows (dedicated `e2e-windows` CI job), plus a runtime nx-free `require.cache` probe; real-clone UAT across both workspace kinds on-stack Angular 22.
5. **Docs (Phase 29, DOC-01)** -- README `## Standalone CLI` section (install, 7-flag reference, `0`/`1`/`2` exit-code table, `npx angular-typechecker` canonical / never `npx atc`) + curated undated `## 0.2.2` CHANGELOG entry + a `standalone-cli-docs.spec.ts` HELP_TEXT/README drift-lock.

### Audit

PASSED (`.planning/milestones/v0.2.2-MILESTONE-AUDIT.md`): 21/21 requirements SATISFIED,
5/5 phases verified `passed`, 2/2 E2E flows proven (VER-04 CI-authoritative exit-code
contract; VER-05 real-clone assertions -- human sign-off accepted, backstopped by VER-04),
Nyquist COMPLIANT, security threats_open 0. Additive-only vs `angular-typechecker@0.2.1`
HOLDS -- the milestone stayed on the `0.2.x` line.

### Known deferred items at close

Recorded as Future Requirements (out of scope, not debt): **REP-01/REP-02** (machine-readable
`--format json` / `--format sarif` reporters), **CLIX-01** (`--watch`, needs the deferred
`NgtscProgram` incremental engine), **CLIX-02** (`--quiet` / explicit `--color`), plus the
carried-forward `createNodesV2` inference (WALK-FUT-01), `NgtscProgram` incremental
(WALK-FUT-02), `totalFilesCount` (OBS-01), and the GitHub-backed Nx remote cache.

**Migration note:** archived retroactively during the GSD1 -> OpenGSD migration cleanup
(2026-07-18) -- the milestone shipped under GSD1 but its artifacts were not moved into
`.planning/milestones/` at close; done here before starting v0.2.3.

### Archives

- `.planning/milestones/v0.2.2-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.2.2-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.2.2-MILESTONE-AUDIT.md` -- audit report
- `.planning/milestones/v0.2.2-phases/` -- phase execution history (PLANs, SUMMARYs, VERIFICATIONs, etc.)

---

## v0.2.1 -- Angular CLI workspace support

**Closed:** 2026-07-16 (phases complete + milestone audit PASSED)
**Phases:** 21-24 | **Plans:** 14 (3 original + 3 gap-closure in Phase 24) | **Commits:** 250 (since the `angular-typechecker@0.2.0` tag)
**Timeline:** 2026-07-10 -> 2026-07-16 (6 days)
**Package source:** ~4,413 LOC production TypeScript (`packages/angular-typechecker/src/`, non-test, 31 files); ~15,584 LOC incl. the test suite
**Published:** `angular-typechecker@0.2.1` (npm, live, 2026-07-16, tokenless OIDC + SLSA v1 provenance) -- cut via the human-gated Release-PR flow (AGENTS.md): PR #38 merged, tag `angular-typechecker@0.2.1` on the release merge commit.

### Delivered

`angular-typechecker` now installs and runs in a plain Angular CLI (`angular.json`)
workspace with no Nx: `ng add angular-typechecker` wires a `typecheck` target into every
application and library at once, `ng generate angular-typechecker:configuration` wires a
single project, and `ng run <project>:typecheck` runs the exact same complete Angular
type-check (TypeScript + template + extended NG8xxx diagnostics, no emit) as the Nx target
-- purely additive beside the existing Nx surface, proven against real OSS Angular 22
workspaces from the shipped tarball.

### Key Accomplishments

1. **GATE A' spike -- GO (Phase 21, ACB-02)** -- the shipped CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` engine survives `convertNxExecutor` + a real `ng run` against a real cloned OSS Angular 22 workspace (`bluehalo/ngx-leaflet`), with no `ERR_REQUIRE_ESM`; a NO-GO would never have fallen back to a hand-written architect builder.
2. **Multi-tsConfig engine widening (Phase 21, ENG-01)** -- `tsConfig` widened to `string | string[]` so a single target checks a project's complete leaf set (build + spec) in one pass; single-string path stays byte-unchanged.
3. **The angular.json write-fork (Phase 22, ACS-01/02/04, COV-01)** -- the shared `configuration` generator gains an early `tree.exists('angular.json')` fork that wires ONE per-project `typecheck` target with `tsConfig: [buildLeaf, specLeaf]`, proven per-project-scoped with zero cross-project bleed; the Nx path is untouched.
4. **Init parity + first-party ng-add + optional peers (Phase 23, ACS-03, NGADD-01, ACP-01)** -- `ng generate ...:init` seeds no caching / no stray `nx.json`; `ng-add` auto-wires every application + library project; `@angular-devkit/architect` + `rxjs` classified as optional peers.
5. **Real-OSS + scaffolded e2e, additive-only audit, docs (Phase 24, ACV-01/02/03, ACP-02, ACD-01)** -- a committed CI-authoritative Angular CLI e2e (npm + yarn + pnpm) and a manual real-clone milestone-final gate; a git-diff audit proving additive-only vs `angular-typechecker@0.2.0` (no `v0.3.0` trigger); README `## Angular CLI` + curated CHANGELOG.
6. **Root-cause yarn fixes (Phase 24 gap closure, 24-04/24-06)** -- discovered post-verification that yarn does not auto-install the `@nx/devkit` peer `nx` (fixed: `nx` declared as a direct `^23.0.0` dependency) and that Angular CLI's post-install `ng-add` probe crashes loading nx's `chalk` chain under yarn 4's hoist (fixed: `ng-add` rewritten as a vanilla nx-free `@angular-devkit/schematics` Rule sharing one framework-agnostic wiring core with the Nx generator) -- `ng add` now auto-wires on the FIRST run under npm, yarn (flat + workspace), and pnpm alike.

### Audit

PASSED (`.planning/milestones/v0.2.1-MILESTONE-AUDIT.md`): 16/16 requirements SATISFIED,
4/4 phases verified `passed`/re-verified, cross-phase integration 8-of-8 seams WIRED,
4/4 E2E flows proven, Nyquist COMPLIANT across all 4 phases, security threats_open 0.
Additive-only vs `angular-typechecker@0.2.0` HOLDS -- the milestone stayed on the `0.2.x`
line (no `v0.3.0` trigger).

### Known deferred items at close

- **Post-close (human-gated) -- DONE 2026-07-16:** the v0.2.1 npm release was cut + published via the AGENTS.md Release-PR flow -- PR #38 (`release/0.2.1`) merged, `angular-typechecker@0.2.1` tag created on the release merge commit, OIDC publish through the `npm-publish` environment (SLSA v1 provenance).
- **Roadmap Phase 25 proposed then removed:** a GitHub-backed self-hosted Nx remote cache (workspace-wide CI cache optimization) was added to the roadmap mid-milestone and then removed as lower priority than the already-shipped e2e per-project matrix split (~41% faster CI). Tracked as a backlog item, not milestone debt.
- The 19 post-Phase-24 quick tasks (260709-w96 through 260715-rze) were verified + shipped (CI hardening, dependency audits, review-finding triage, e2e wall-clock optimization); the close audit initially flagged them "missing" due to the recurring bare-`SUMMARY.md`-vs-`<id>-SUMMARY.md` scanner mismatch. One quick-task directory (260709-w96, `OBS-01` observability) was an empty, never-executed, untracked stub -- removed at close; `OBS-01` correctly remains a tracked deferred Future Requirement, not abandoned work.
- The `24-VERIFICATION.md` frontmatter `status: human_needed` was cosmetically stale at audit time -- the underlying human item (re-run the ACV-01 real-clone tarball gate post-24-06) was already RESOLVED (quick task 260715-ig5) before this close.

### Archives

- `.planning/milestones/v0.2.1-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.2.1-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.2.1-MILESTONE-AUDIT.md` -- audit report

---

## v0.2.0 -- Storybook story type-checking

**Closed:** 2026-07-07 (phases complete + milestone audit PASSED)
**Phases:** 16-20, incl. the Phase 16 GO/NO-GO spike (5) | **Plans:** 20 | **Tasks:** 37 | **Commits:** ~204 (since the v0.1.1 hotfix tag)
**Timeline:** 2026-07-05 -> 2026-07-07 (3 days)
**Package source:** ~3,636 LOC production TypeScript (`packages/angular-typechecker/src/`, non-test)
**Published:** `angular-typechecker@0.2.0` (npm, live, 2026-07-07, tokenless OIDC + SLSA v1 provenance) -- cut AFTER milestone close via the human-gated Release-PR flow (AGENTS.md): PR #29 merged, tag `angular-typechecker@0.2.0` on the release merge commit.

### Delivered

`nx typecheck` now type-checks Angular Storybook stories (`*.stories.ts`) and the
whole `.storybook/` tsconfig-declared surface across BOTH Nx-official layouts (the
per-project scaffold and the centralized host), via ONE boundary-filter correctness
fix -- directory-containment replaced by compiler **input-set membership** -- with the
charter guarantee that a dropped first-party diagnostic can never coexist with a green
verdict. Proven end-to-end against the SHIPPED tarball on the supported stack.

### Key Accomplishments

1. **Layout-B gate spike -- GO (Phase 16, SB-05)** -- a reproducible spike on the official stack (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, forced `@storybook/angular@10.4.6`) resolved G1-G5: widened cross-project includes DO materialize as the storybook leaf's declared `rootNames`, forced SB10 compiles cleanly, NG8xxx fire positively, and external-template attribution selects branch **4a** (map an external `.html` diagnostic to its owning component `.ts` via public `ts.Diagnostic.relatedInformation`).
2. **Input-set-membership boundary + split counters (Phase 17, SB-01/02/03/04)** -- a pure `keep(diagnostic, inputSet, options)` shared by the walk + single-leaf paths (zero ngtsc/component-registry internals), dual-identity (raw + realpath) membership, branch 4a, and a SPLIT suppressed counter (`suppressedThirdParty` quiet vs `suppressedInGraph*` verdict-affecting) whose `suppressedInGraph > 0` yields a non-clean coverage-incomplete outcome -- both layouts proven against the real cold compiler.
3. **Packaged-tarball Storybook e2e + docs (Phase 18, SB-06/07)** -- the SHIPPED artifact, installed via `nx add` + `nx g configuration` + `nx typecheck`, catches a planted Layout-A `TS2322` and a Layout-B aggregated `TS2345` + external-template `NG8002`; a net-new verdict-neutral `.mdx`/`.tsx`-without-`jsx` "not type-checked" advisory; and the README `## Storybook` exact coverage claim + curated CHANGELOG green->red false-pass-to-true-fail callout.
4. **Stretch: opt-in strict mode + Storybook Composition (Phase 19, SB-08)** -- a verdict-only `strict` option (defaults false; only ADDS a fail path when a dropped in-graph WARNING would otherwise stay clean) threaded schema -> normalizeOptions -> evaluateResult, and Storybook Composition delivered as a ZERO-engine-code topology (per-project `typecheck` + Nx `^typecheck` fan-out); Layout-C-beyond-guard and `.mdx`/`.tsx`-beyond-advisory recorded "not warranted" (`19-DECISIONS.md`).
5. **Vite/Analog query-import guidance (Phase 20, SB-09)** -- a pure `detectBundlerQueryImports` over the post-filter kept `TS2307` set feeding a verdict-neutral `CoreResult.bundlerQueryImports` advisory (one executor `logger.warn`, `evaluateResult` never reads it), plus a README caveat that LEADS with the proven `"types": ["vite/client"]` fix; charter guard proves a plain missing module still fails and no `?query` `TS2307` is ever auto-suppressed. Verified on the real radix-ng/primitives repo (Gate B).

### Audit

PASSED (`.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`): 9/9 requirements
SATISFIED (SB-01..09; SB-08 a conditional stretch dispositioned in `19-DECISIONS.md`),
5/5 phases (Phase 16 spike GO + phases 17-20 verified `passed`), 9/9 cross-phase
integration checks WIRED (0 blockers, 0 broken flows, 0 contract inconsistencies,
opus integration-checker), 4/4 E2E flows complete (Layout A/B tarball + Composition
fan-out + Vite/Analog Gate-B real-repo), Nyquist COMPLIANT (Phase 16 spike n/a),
security verified with 0 open threats.

### Known deferred items at close

- **Post-close (human-gated) -- DONE 2026-07-07:** the v0.2.0 npm release was cut + published via the AGENTS.md Release-PR flow -- PR #29 (`release/0.2.0`) merged, `angular-typechecker@0.2.0` tag created on the release merge commit, OIDC publish through the `npm-publish` environment (SLSA v1 provenance).
- **Tech debt (non-blocking):** `exit-codes.ts` `toExitCode` mirrors only the `suppressedInGraphError` coverage-incomplete trigger (dead scaffold, no live consumer -- the Nx executor uses `evaluateResult`); the local-only `nx-add-yarn` corepack/Verdaccio ECONNREFUSED flake (CI e2e is Linux-only); and the benign `requirements-completed: [SB-08]` frontmatter overstatement.
- The 7 post-v0.1.1 quick tasks (260703-lp0/p2x/u74/wcg, 260704-mse/wnq, 260705-1wo) were verified + shipped; the close audit initially flagged them "missing" due to the recurring bare-`SUMMARY.md`-vs-`<id>-SUMMARY.md` scanner mismatch (bare markers added at close).

### Archives

- `.planning/milestones/v0.2.0-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.2.0-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md` -- audit report

---

## v0.1.0 -- Reference-walking engine, typecheck executor rename, and the configuration + init generator suite

**Shipped:** 2026-07-02
**Phases:** 12-15, incl. inserted 13.1 (5) | **Plans:** 16 | **Tasks:** 36 | **Commits:** ~198 (since the v0.0.3 close)
**Timeline:** 2026-06-30 -> 2026-07-02 (3 days)
**Package source:** ~2,709 LOC production TypeScript (22 non-test `.ts` files); ~8,552 LOC incl. the test suite (56 `.ts` files)
**Published:** `angular-typechecker@0.1.0` (npm, live, tokenless OIDC + SLSA v1 provenance)

### Delivered

A solution-tsconfig REFERENCE-WALKING mode that lets one `typecheck` target
type-check a project's lib/app AND spec leaves together, a BREAKING rename of
the executor to the shorter public id `typecheck`, and a `configuration` +
`init` generator suite (plus `nx add angular-typechecker` support) that wires
that single target and seeds its caching with no manual `nx.json` edit --
proven end-to-end against a real installed tarball through both generator
entry points.

### Key Accomplishments

1. **Complete extended-diagnostic catalog + completeness tripwire (Phase 12, CAT-01..05, DRIFT-01)** -- all 18 `ExtendedTemplateDiagnosticName` members plus the 12 baseline TS/NG codes are asserted by exact code + `DiagnosticCategory` + occurrence count in one enum-keyed `it.each` table against real `@angular/compiler-cli@22.0.4`, with an enum-vs-table completeness tripwire that fails CI loudly the moment a future Angular release changes the set.
2. **Reference-walking engine (Phase 13, WALK-01/02)** -- `runTypecheck` on a solution `tsconfig.json` walks its in-project referenced leaves (lib/app + spec) in ONE call, unions the per-leaf diagnostics with value-identity dedupe, and applies a module-boundary guard that skips out-of-project references; the walk target's caching uses the `default` (never `production`) named input so spec sources are never under-hashed.
3. **Executor rename (Phase 13.1, EXEC-01)** -- the shipped executor is renamed `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` across every surface (executors.json, `nx.json` targetDefaults, fixtures, specs, README), behavior unchanged -- the breaking change that drives the 0.0.3 -> 0.1.0 minor bump.
4. **`configuration` + `init` generator suite, `nx add` support (Phase 14, GEN-01..09)** -- `nx g angular-typechecker:configuration <project>` wires ONE minimal `typecheck` target at the project's solution `tsconfig.json` (override + flat-project fallback, idempotent, collision-safe), while a standalone `init` generator seeds `nx.json` `targetDefaults` with the cacheable WALK-02 block and is invoked both by `configuration` and by `nx add angular-typechecker` on install.
5. **Generator e2e + CI self-audit guard (Phase 15, GE2E-01..03, GUARD-01)** -- both generator entry points are proven against a real packed-and-installed tarball (target wiring + `targetDefaults` seeding + a correct multi-leaf walk verdict with distinct lib and spec error codes both surfacing), and a new CI guard turns a forgotten e2e project `-p` entry into a loud, located failure instead of a silent skip.

### Audit

PASSED, re-audit (`.planning/milestones/v0.1.0-MILESTONE-AUDIT.md`): 22/22
requirements SATISFIED, 5/5 phases verified `passed`, 8/8 cross-phase seams
WIRED (0 BLOCKER, 0 WARNING), the full install -> generate -> run -> verdict
flow proven end-to-end via both entry points (`configuration` generator and
`nx add`), Nyquist COMPLIANT across all 5 phases, and zero accumulated tech
debt. Upgraded from an initial `tech_debt` verdict after the two README gaps,
one grammar nit, and one SUMMARY-frontmatter bookkeeping gap it found were
all fixed.

### Known deferred items at close

Recorded as Future Requirements (out of scope, not debt): **FSTREE-01**
(bespoke real-disk `createFsTree` helper, only if a future generator emits
files), **GEN-FUT-01/02** (Angular CLI `angular.json` support / `ng add`
schematic -- Nx's `nx add` shipped this milestone), **WALK-FUT-01/02**
(`createNodesV2` granular per-leaf targets / `NgtscProgram` incremental
declaration-reuse to collapse the walk's double-compile tax). No open
debug/UAT artifacts at close; 3 quick tasks were initially flagged by the
close audit as "missing" due to a filename-convention mismatch in the
scanner (bare `SUMMARY.md` vs the canonical `<id>-SUMMARY.md`) -- all three
were already verified and shipped, and the audit false-positive was fixed as
part of this close.

### Archives

- `.planning/milestones/v0.1.0-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.1.0-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.1.0-MILESTONE-AUDIT.md` -- audit report
- `.planning/milestones/v0.1.0-phases/` -- phase execution history (PLANs, SUMMARYs, VERIFICATIONs, etc.)

---

## v0.0.3 -- Engine hardening (correctness, resilience, drift-hardening, CI quality gate)

**Shipped:** 2026-06-30
**Phases:** 8-11 (4) | **Plans:** 14 | **Commits:** ~150 (since the v0.0.1 close)
**Timeline:** 2026-06-29 -> 2026-06-30 (2 days)
**Package source:** ~1,777 LOC production TypeScript (15 non-test `.ts` files); ~5,263 LOC incl. the test suite (41 `.ts` files)
**Published:** `angular-typechecker@0.0.3` (npm, live, tokenless OIDC + SLSA v1 provenance)

### Delivered

Targeted hardening of the existing whole-program no-emit `runTypecheck` engine --
closing real correctness/completeness holes, making diagnostic gathering resilient
instead of all-or-nothing, and making Angular-version drift fail loudly -- all verified
against stable Angular 22.0.4 and WITHOUT migrating off `performCompilation` to
`NgtscProgram`, plus a `fallow` CI code-quality gate that is green on adoption.

### Key Accomplishments

1. **Correctness & completeness (Phase 8, COR-01..04)** -- a config-resolution `UNKNOWN_ERROR_CODE` (500) is re-thrown as `TypecheckInfrastructureError` (never miscounted as a type error); global / location-less TS diagnostics are surfaced via `getGlobalDiagnostics()`; present-but-empty `file.fileName` diagnostics are kept; and a pure framework-agnostic `toExitCode` 0/1/2 policy is the single source of truth.
2. **Run-level resilience (Phase 9, RES-01..04)** -- a GATED spike chose the HYBRID per-file fault-isolation shape so one component's `FatalDiagnosticError` no longer collapses the whole run (surviving files' TS + non-template diagnostics are still reported), with a loud, never-silent TCB-generation suppression notice; plus a `realpath()` try/catch and `suppressOutputPathCheck`.
3. **Drift-hardening (Phase 10, HARD-01..05)** -- a build-time `tsconfig.drift.json` + `typecheck-drift` CI target makes an Angular upgrade that drifts the `api.Program` getter set or NG error-code encoding break CI loudly (real->shim assignability); the fabricated `EmitFlags.None` is corrected; every vendored divergence carries a greppable marker; and a no-`TS-99`-leak regression spec guards the color-rewrite path.
4. **Fallow CI quality gate (Phase 11, QUAL-01..03)** -- `fallow@2.103.0` adopted as a path-gated, SHA-pinned, new-only CI job wired into the `ci` aggregate (single required check unchanged, least-privilege `contents: read`); all current findings resolved via `.fallowrc.jsonc` so the gate is green on adoption, and proven RED on introduced dead code via a throwaway PR.

### Audit

PASSED (`.planning/milestones/v0.0.3-MILESTONE-AUDIT.md`): 16/16 requirements
SATISFIED, 4/4 phases verified `passed`, 18/18 cross-phase links wired, the E2E engine
pipeline intact, Nyquist COMPLIANT across every phase, and zero accumulated tech debt.

### Known deferred items at close

Recorded as Future Requirements (out of scope, not debt): **REP-RES-02b** (faithful
per-file TEMPLATE/extended diagnostic recovery after a TCB-generation Fatal -- needs the
`NgtscProgram` incremental surface; same limitation as `@angular/build` today),
**OBS-01** (`totalFilesCount` on `CoreResult`), and the standalone-CLI surface that owns
the literal OS exit code `2`. No open debug/UAT artifacts. The 3 PR-review quick tasks
(260630-dyd/fg0/jnl) were verified + shipped before close.

### Archives

- `.planning/milestones/v0.0.3-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.0.3-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.0.3-MILESTONE-AUDIT.md` -- audit report
- `.planning/milestones/v0.0.3-phases/` -- phase execution history (PLANs, SUMMARYs, VERIFICATIONs, etc.)

---

## v0.0.1 -- Complete Angular type-check, decoupled from build/test

**Shipped:** 2026-06-29
**Phases:** 1-7 (8 incl. inserted Phase 5.1) | **Plans:** 29 | **Commits:** 255
**Timeline:** 2026-06-27 -> 2026-06-29 (3 days)
**Package source:** ~1,162 LOC TypeScript (33 `.ts` files incl. tests)
**Published:** `angular-typechecker@0.0.1` and `@0.0.2` (npm, live, tokenless OIDC + SLSA v1 provenance)

### Delivered

The first publishable slice: a single Nx executor (`angular-typecheck`) that runs
the complete Angular compiler diagnostic set (TypeScript + template type-check +
extended NG8xxx) with no emit, decoupled from building or testing -- Nx-native,
cacheable, and runnable per project against any project type.

### Key Accomplishments

1. **Complete unconditional diagnostic engine** -- a framework-agnostic `runTypecheck` runs `@angular/compiler-cli` whole-program no-emit with a custom all-getter gatherer modeled on `@angular/build`, surfacing TS + template type-check + extended NG8xxx diagnostics in one pass (NG8109 where `ngc`'s default gatherer short-circuits), asserted against the v13->v22 diagnostic catalog.
2. **CommonJS executor that loads ESM compiler-cli** -- a sub-50-line Nx adapter ships as CommonJS built with `module: nodenext` and reaches the ESM-only compiler via `await import()` with no `import()`->`require()` downlevel (proven by a built-bytes GATE A assertion through the packed tarball).
3. **Correct project-boundary filtering + modes + human output** -- realpath-normalized absolute-path filtering (pnpm-symlink + case-insensitive-FS safe), report-all/fail-fast modes, `--max-warnings`, and `formatDiagnostics` output; ESLint module-boundary enforcement locking the core-vs-adapter split.
4. **Nx-cacheable target with a lying-cache guard** -- `cache:true`/`outputs:[]` with correct per-tsconfig + dependency-source inputs, proven by a dependency-error-busts-cache HIT/MISS test (green -> HIT -> inject a transitive type error -> MISS + new diagnostic + non-zero exit).
5. **Supply-chain-hardened npm publish** -- 0.0.1 and 0.0.2 published live via the registered npm Trusted Publisher with NO token and SLSA v1 provenance; hardened `release.yml`, `SECURITY.md`, and tarball audits (`publint` + `attw --pack`).
6. **5-project-type e2e matrix + cross-OS CI + Release-PR flow** -- validated across application/local-lib/buildable-lib/publishable-lib/spec-tsconfig against the installed tarball (incl. pnpm + mixed-case), gated by a Node 22/24/26 x Linux/Windows/macOS matrix; `main` switched to a PR-only Release-PR workflow with a clean public changelog.

### Audit

PASSED (`.planning/milestones/v0.0.1-MILESTONE-AUDIT.md`): 34/34 requirements
SATISFIED, 8/8 phases verified, 0 cross-phase integration gaps, 4/4 E2E flows
complete (with recorded live-run evidence), Nyquist COMPLIANT across every phase.

### Known deferred items at close

None (no open debug/quick-task/UAT artifacts; tech-debt items are documentation
drift / INFO-level only -- see the audit report).

### Archives

- `.planning/milestones/v0.0.1-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.0.1-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.0.1-MILESTONE-AUDIT.md` -- audit report
- `.planning/milestones/v0.0.1-phases/` -- phase execution history (PLANs, SUMMARYs, VERIFICATIONs, etc.)
