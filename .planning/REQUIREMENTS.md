# Requirements: angular-typechecker v0.0.3 (Engine hardening)

**Defined:** 2026-06-29
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.

**Milestone goal:** Harden the EXISTING whole-program no-emit `runTypecheck` engine -- close real correctness/completeness holes, make diagnostic gathering resilient instead of all-or-nothing, and make Angular-version drift fail loudly -- all verified against stable Angular 22.0.4 and WITHOUT migrating off `performCompilation` to `NgtscProgram`.

**Grounding:** every requirement traces to a verified finding in `.planning/research/prior-art/PRIOR-ART-SUMMARY.md` (the bracketed `#N` refers to that summary's numbered improvement table). The engine is already complete and faithful to `@angular/build` at 22.0.4; this milestone is targeted hardening, not a rewrite.

## v0.0.3 Requirements

### Correctness & Completeness (COR)

- [x] **COR-01**: A config-resolution infrastructure crash -- an `UNKNOWN_ERROR_CODE` (500) diagnostic returned in `readConfiguration().errors` -- is detected immediately after the config parse and re-thrown as `TypecheckInfrastructureError`, never folded into the reported diagnostics or counted as a type error. -- [#1] (today only `result.diagnostics` is scanned for 500; `parsed.errors` is folded verbatim -- a broken `extends`/host throw is mis-counted as a type error).
- [x] **COR-02**: Global / location-less TypeScript semantic diagnostics (e.g. TS2318) are gathered via `program.getTsProgram().getGlobalDiagnostics()` and reported. -- [#2] (the per-file `getTsSemanticDiagnostics` path never emits TS global diagnostics; `@angular/build` calls `getGlobalDiagnostics()` explicitly).
- [x] **COR-03**: A diagnostic whose `file.fileName` is present-but-empty is treated as file-less (reported, never silently dropped by the project-boundary filter). -- [#5]
- [x] **COR-04**: The engine classifies an infrastructure failure (`TypecheckInfrastructureError`) distinctly from a type-error failure and exposes a pure, framework-agnostic exit-code policy (`toExitCode` -> `0` clean / `1` type-error / `2` infra, ngc-parallel) as the single source of truth for all surfaces. The Nx executor surfaces an infra failure distinctly WITHIN Nx's `{ success: boolean }` contract (typed error + distinct operator message; Nx maps to exit 1), so CI/agents can tell a crash apart from real type errors; the literal distinct OS exit code (`2`) is delivered by the DEFERRED standalone CLI surface, which owns its process (like `ngc`) and consumes the same policy. -- [Q3 decision, REFRAMED 2026-06-29 after nx-source + nx-docs prior-art: Nx hard-maps executor `{success}` to 0/1 (verified nx 23.0.1 `run.ts:72`, `command-object.ts:30`) and `process.exit` from an executor is hostile to in-process `runExecutor` / run-many / daemon / batch; parallels ngc `exitCodeFromResult`. See `.planning/phases/08-correctness-completeness-fixes/08-CONTEXT.md` D-07..D-10.]

### Resilience (RES)

- [x] **RES-01** [GATE / spike]: A spike determines whether any Angular non-template diagnostics (`traitCompiler` / `checkForPrivateExports`) are file-less or otherwise unreachable through a per-file `getNgSemanticDiagnostics(fileName)` / `getDiagnosticsForFile` `d.file === file` filter, and produces a GO decision on the per-file isolation shape: simple per-file loop vs. HYBRID (gather the non-template set once whole-program + loop the template/extended families per file). Gates RES-02. -- [#3 open question; the only true unknown]. **GO = HYBRID** (recorded in `phases/09-.../09-RES-01-SPIKE.md`).
- [x] **RES-02** [REFRAMED 2026-06-29 -- see `phases/09-.../09-RES-02-DECISION.md`]: Angular diagnostic gathering is fault-isolated per file (HYBRID per RES-01) so that a single component's `FatalDiagnosticError` yields exactly one diagnostic and does NOT collapse the whole run to an infrastructure error -- the run completes and surviving files' TypeScript + Angular NON-template diagnostics are still reported, on the existing `api.Program` surface (no `NgtscProgram` migration). A LOUD notice fires when a TCB-generation Fatal may suppress surviving files' template diagnostics (never-silent). **Known limitation, deferred to REP-RES-02b:** surviving files' TEMPLATE/extended (NG8xxx) diagnostics cannot be recovered after a TCB-generation Fatal on the `WholeProgram` / `api.Program` surface (shared shim-priming abort; same as `@angular/build`; verified v22.0.4 + a 5-lens Opus panel). -- [#3].
- [x] **RES-03**: A throwing `realpath()` in the project-boundary filter is caught (falls back to the unresolved path), so a filesystem realpath failure cannot abort the whole type-check pass. -- [#4].
- [x] **RES-04**: The no-emit options override sets `suppressOutputPathCheck: true`, so output-path configuration nuisance errors never surface in the type-only flow. -- [#6].

### Drift-hardening & Maintainability (HARD)

- [ ] **HARD-01**: A build-time drift check -- a dedicated `tsconfig.drift.json` (classic `moduleResolution: node`) type-checked in CI as its own target -- asserts that the real `@angular/compiler-cli` `api.Program` stays assignable TO the vendored `compiler-cli-types.ts` `Program` shim (real->shim direction only, because the shim is a deliberate subset). A REMOVED, renamed, or signature-changed diagnostic getter (among the getters the gatherer calls) breaks the build via that assignability assertion; newly-ADDED upstream getters are intentionally NOT a build failure and are surfaced instead by the runtime getter-set spec. The NG error-code encoding (`ngErrorCode`) + the `UNKNOWN_ERROR_CODE` literal are mirrored. -- [#7]. [D-07 wording fix: the prior text said both "a new OR removed getter breaks the build" and "real->shim direction only", which is internally contradictory -- real->shim cannot break on an ADDED getter.]
- [x] **HARD-02**: The shim's fabricated `EmitFlags.None = 0` member is corrected against the real enum; the `emitFlags: 0` call site is retained as a documented literal (verified safe under `noEmit: true`). -- [#8].
- [x] **HARD-03**: Every divergence in the vendored type surface carries a greppable `// angular-typechecker: vendored -- <reason>` marker comment (Prettier `angular-estree-parser` idiom). -- [#9].
- [x] **HARD-04**: The `getNgStructuralDiagnostics()` call is RETAINED (documented as a deliberately forward-compatible no-op-tolerant call) and is covered by the HARD-01 getter-set assertion, so a future Angular version that reactivates it cannot silently under-gather. -- [#10, reversed from "drop it"].
- [ ] **HARD-05**: A regression spec asserts that no `TS-99` substring (a raw, un-rewritten negative NG code) survives our `color: false` output path. -- [Q4 color-rewrite guard].

### Code-Quality Gate (QUAL) -- added 2026-06-30 during Phase 11 planning

These requirements were intentionally deferred to `/gsd-plan-phase` per the Phase 11 ROADMAP entry ("Requirements: TBD -- a new code-quality-gate requirement to be added to REQUIREMENTS.md during /gsd-plan-phase"). They adopt `fallow` (npm, the dead-code / duplication / complexity analyzer; v2.x -- 2.103.0 at research time) as a CI quality gate and resolve the repo's current findings so the gate is green on adoption. Grounded in `phases/11-fallow-code-quality-ci-gate/11-CONTEXT.md` (decisions D-01..D-15) and `11-DISCUSS-RESEARCH.md` (live `fallow@2.103.0` evidence).

- [x] **QUAL-01**: A dedicated, path-gated, SHA-pinned `fallow` CI job (ubuntu-latest, Node 24, `actions/checkout` with `fetch-depth: 0` + `persist-credentials: false`) runs `npx fallow audit --format json --base origin/main` (gate `new-only` -- fail only on findings INTRODUCED by the changeset) and is wired into the `ci` aggregate's `needs:` list AND its `contains(needs.*.result, 'failure'|'cancelled')` gate, so newly-introduced dead code / duplication / over-complexity breaks CI LOUDLY. The single required status check stays `ci` -- NO Default-branch ruleset change. The job is path-gated with the same `if: ${{ needs.changes.outputs.code != 'false' }}` NEGATIVE form as `test`/`e2e` (skips planning/docs-only PRs; stays in the `act -n` plan under empty filter output). -- [CONTEXT D-01, D-10, D-12, D-13, D-14; ROADMAP scope items 2, 4].
- [x] **QUAL-02**: A hand-authored `.fallowrc.jsonc` (JSON family per preference; both `.json`/`.jsonc` auto-discovered) RESOLVES the repo's current fallow findings so the gate is green on adoption -- NOT baselined. Confirmed false positives are suppressed in config with a documented JSONC comment each: the tsconfig-`files`-only drift tripwire `compiler-cli-types.drift.ts` declared as an `entry` point (IN-02); the `EmitFlags` contract-mirror shim members scoped off via `overrides` on `compiler-cli-types.ts` (IN-03); the value-mirrored `UNKNOWN_ERROR_CODE` type export pinned via `ignoreExports` (IN-04); the intentional `fixtures/fault-isolation/**` components scoped off (`unrendered-components`/`unused-component-inputs`). `unused-dev-dependencies` is set `off` (import-graph cannot see flat-config/CLI tooling deps), while `unused-dependencies` stays `error`; any genuine prod-dep finding (e.g. `@angular/forms`) is VERIFIED then resolved (removed if truly unused, else `ignoreDependencies` with a reason). All three families (dead-code + duplication + complexity) enabled at default thresholds. (IN-05 does NOT reproduce in 2.103.0 -- fallow analyzes the root `package.json`, not the published manifest -- so no IN-05 suppression.) The post-phase `fallow audit --base origin/main` exits 0. -- [CONTEXT D-02..D-09; ROADMAP scope items 1, 4].
- [x] **QUAL-03**: `fallow` is pinned as an EXACT root `devDependency` (run via `npx fallow` after `npm ci`, never `@latest`); `tools/act/act-compat.sh` asserts the new job's selection (`assert_selected "$PR_PLAN" "ci/fallow"`); actionlint (`lint-workflows`) stays green; and `ci.yml`'s security posture is preserved (every action SHA-pinned + Dependabot-tracked, top-level `contents: read`, no PR-metadata interpolation, `persist-credentials: false`). The project keeps `code_quality.fallow.enabled: true`; fixing GSD's broken fallow structural pre-pass is OUT OF SCOPE. SARIF/`--ci` output is NOT used (would require `security-events: write`). -- [CONTEXT D-11, D-15; ROADMAP scope items 3, 5].

## Future Requirements (deferred -- tracked, not in this roadmap)

### Observability (OBS)

- **OBS-01**: `totalFilesCount` field on `CoreResult` (`@nx/js` parity; root-vs-total program spread). -- [#11] Deferred pending charter-fit (borders on the deferred reporting surface).

### Resilience -- deferred to the `NgtscProgram`/incremental milestone (REP)

- **REP-RES-02b**: Recover SURVIVING files' Angular TEMPLATE/extended (NG8xxx) diagnostics when another component throws a TCB-generation `FatalDiagnosticError`. Requires `OptimizeFor.SingleFile`-per-file priming (the Angular Language Service approach: `ensureAllShimsForOneFile` primes each file independently against the INTACT program, so one file's Fatal does not abort another's). Unreachable on today's `api.Program` `getNgSemanticDiagnostics(fileName)` overload (it hardcodes `WholeProgram` at `program.ts:241`); lands naturally on the `NgtscProgram` incremental surface (REP). The v0.0.3 RES-02 reframe delivered run-level resilience + a loud suppression notice; this is the faithful per-file-template recovery that exceeds `@angular/build`'s cold-build behavior. -- [RES-02 reframe; web research + 5-lens Opus panel 2026-06-29; see `phases/09-.../09-RES-02-DECISION.md`].

### Carried forward from v0.0.1 (unchanged)

Inferred targets (INF), install/generators (GEN), other surfaces (SUR), reporters/performance incl. `NgtscProgram` incremental + `--watch` (REP), broader support (SUP). Full detail: `.planning/milestones/v0.0.1-REQUIREMENTS.md`.

## Out of Scope (this milestone)

| Feature | Reason |
|---------|--------|
| `NgtscProgram` migration / incremental / `--watch` | RES-02 stays on the existing `api.Program` surface; the incremental engine is a separate (REP) milestone |
| Machine-readable reporters (JSON / SARIF / GitHub annotations) | REP family; output-layer feature, not engine hardening |
| Any new executor option or feature surface (INF / GEN / SUR) | This milestone improves the existing engine only; no new capabilities |
| `totalFilesCount` (OBS-01) | Deferred (see Future); decide charter-fit later |
| Emit / build output, auto-fix of diagnostics | Unchanged project-level exclusions (no-emit type-checker) |

## Traceability

Which phases cover which requirements. v0.0.3 phases continue from v0.0.1's last phase (7), starting at Phase 8.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COR-01 | Phase 8 | Complete |
| COR-02 | Phase 8 | Complete |
| COR-03 | Phase 8 | Complete |
| COR-04 | Phase 8 | Complete |
| RES-01 | Phase 9 | Complete |
| RES-02 | Phase 9 | Complete |
| RES-03 | Phase 9 | Complete |
| RES-04 | Phase 9 | Complete |
| HARD-01 | Phase 10 | Complete |
| HARD-02 | Phase 10 | Complete |
| HARD-03 | Phase 10 | Complete |
| HARD-04 | Phase 10 | Complete |
| HARD-05 | Phase 10 | Complete |
| QUAL-01 | Phase 11 | Complete |
| QUAL-02 | Phase 11 | Complete |
| QUAL-03 | Phase 11 | Complete |

**Coverage:**
- v0.0.3 requirements: 16 total
- Mapped to phases: 16 (Phase 8: COR-01..04; Phase 9: RES-01..04; Phase 10: HARD-01..05; Phase 11: QUAL-01..03)
- Unmapped: 0

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-30 during Phase 11 planning: added the Code-Quality Gate (QUAL) cluster (QUAL-01..03) per the Phase 11 ROADMAP "Requirements: TBD" deferral; mapped to Phase 11; coverage 16/16/0.*
