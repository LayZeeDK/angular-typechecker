# Milestones: angular-typechecker

A historical record of shipped versions. For current work see `.planning/ROADMAP.md`.

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
