---
phase: 10
phase_name: 'Drift-hardening & Maintainability'
project: 'angular-typechecker'
generated: '2026-06-30'
counts:
  decisions: 5
  lessons: 6
  patterns: 5
  surprises: 4
missing_artifacts:
  - 'UAT.md (verification passed with no human_needed items)'
---

# Phase 10 Learnings: Drift-hardening & Maintainability

## Decisions

### Drift tripwire scope = `real -> shim` ProbeOnly (NOT exhaustiveness)

The build-time gate asserts the real `api.Program` is assignable TO the hand-written shim (catches REMOVED/renamed/signature-changed getters + `UNKNOWN_ERROR_CODE`/`EmitFlags` drift). A newly-ADDED upstream getter is intentionally NOT a build failure.

**Rationale:** Resolved via web + GitHub prior-art research (the latter empirically verified at tsc 6.0.3) and a 5-member Opus advisory board, then user-confirmed. For a deliberately-vendored SUBSET, prior art lands decisively on assignability-probe-only; a plain probe structurally cannot catch additions (TS width subtyping), and forcing it (exact-equality / `Exclude<keyof>`) re-imposes full-interface maintenance and fires on every benign Angular minor. Additions are covered out-of-band by the runtime spec.
**Source:** 10-CONTEXT.md D-01/D-02, 10-RESEARCH.md, 10-DISCUSSION-LOG.md

### Construction = hand-written shim + per-member probe (NOT `Pick`-derived)

Keep `compiler-cli-types.ts` hand-written as the fixed contract; the drift file asserts the real type against it per-member.

**Rationale:** A `Pick<api.Program, ...>`-derived shim AUTO-TRACKS upstream -- a removed getter silently resolves to fewer keys instead of breaking loudly (a follower, not a tripwire). It is also mechanically unavailable: the real type resolves only under the classic-node drift tsconfig, never the production `nodenext` build that ships the shim. The asymmetry (shim fixed, real checked against it) IS the alarm.
**Source:** 10-CONTEXT.md D-02, board member 2/4

### Tooling = PlainTS `AssertAssignable`, ZERO new dev dependency

A one-line `type AssertAssignable<From, To extends From> = true;` over a tuple of pairs, no library.

**Rationale:** At ~7 one-shot assertions a type-testing library earns nothing; `expect-type` (already transitive via Vitest 4.1.9) was the board's closest call but would add a `@nx/dependency-checks`-policed direct devDep + a runtime import in the drift file. `tsd` rejected outright (bundles its own TS 5.9, breaking fidelity vs the project's TS 6.0.3).
**Source:** 10-CONTEXT.md D-03, npm survey

### Additions + runtime-semantic drift covered by a runtime Vitest spec (NOT api-extractor)

A spec against the real `await import('@angular/compiler-cli')` asserts a SUBSET-containment getter set (additions diff `toEqual([])`) + the encoding round-trip (`NG(n) === ngErrorCode(n)`, `UNKNOWN_ERROR_CODE === 500`).

**Rationale:** It is the cheapest control for the ProbeOnly additions blind-spot AND closes runtime-semantic drift no type check can see (the `-99` arithmetic encoding). A committed `@microsoft/api-extractor` `.api.md` report-diff was rejected as disproportionate / scope-creep for v0.0.1 (board 3/5).
**Source:** 10-CONTEXT.md D-04, board member 4

### junction-worktree adopted as the parallel-execution standard

`worktree.baseRef=head` + a per-worktree `node_modules` directory junction to the main checkout (when deps are unchanged) + `NX_DAEMON=false --skip-nx-cache` + LINK-ONLY teardown.

**Rationale:** GSD worktree executors start with no `node_modules` (gitignored) and cannot run `nx`/`tsc` to verify. Sharing the main checkout's installed deps via a junction is valid because Phase 10 plans change no dependencies. The user ratified it as the standard (recovery from an accidental main-`node_modules` delete is a cheap `npm ci` on this repo). Documented in AGENTS.md (agent-reviewed + APPROVED) and the project memory.
**Source:** AGENTS.md "Parallel execution in git worktrees", worktree memory

## Lessons

### `getTsProgram()` cannot be a naive `real -> shim` member probe

The shim widens its return to `ts.Program & { useCaseSensitiveFileNames() }`, so a member pair FAILS TS2322. Special-case it as `AssertAssignable<ReturnType<RealProgram['getTsProgram']>, ts.Program>`; the other 6 diagnostic getters use the plain per-member probe.
**Source:** 10-RESEARCH.md Pitfall 1 (verified at tsc 6.0.3)

### `optional -> required` parameter drift is SILENT under assignability

Method-parameter bivariance + arity tolerance mean the structural probe stays GREEN if a getter's optional param (`getNgSemanticDiagnostics(fileName?)`) becomes required. Only a CALL-SITE probe invoking each getter at the gatherer's exact arity catches it -- the verifier's negative proof confirmed the type gate trips on rename/return-change but call-site probes are needed for the arity case.
**Source:** 10-RESEARCH.md Pitfall, board member 2

### `emitFlags: 0` relies on the `0 as EmitFlags` cast, not "numeric-enum looseness"

After correcting the shim's `EmitFlags` to mirror the real members (no `None = 0`), a bare `emitFlags: 0` assignment ERRORS TS2322; the existing `0 as EmitFlags` cast at `run-typecheck.ts:229` is load-bearing. CONTEXT D-08's "numeric-enum looseness" rationale was wrong -- RESEARCH corrected it before execution.
**Source:** 10-RESEARCH.md correction 4, 10-01-SUMMARY.md

### HARD-05 must route through the REAL `cli.formatDiagnostics`

The `TS-99 -> NG` rewrite (`replaceTsWithNgInErrors`) lives inside Angular's real formatter and is NOT exported at runtime; `ts.formatDiagnostics` LEAKS `TS-998xxx`. A unit fake passes vacuously, so the regression spec exercises the production `renderReport` seam against a real NG8xxx fixture.
**Source:** 10-RESEARCH.md correction 5, 10-04-SUMMARY.md

### The drift file must be excluded from BOTH `tsconfig.lib.json` AND `tsconfig.spec.json`

Under production `nodenext` the real `@angular/compiler-cli` barrel resolves EMPTY (TS2305), which would break `nx build` AND `nx test` if the drift file were compiled by either. The classic-node `tsconfig.drift.json` also needs `ignoreDeprecations: "6.0"` (else TS5107).
**Source:** 10-RESEARCH.md correction 3, 10-02-SUMMARY.md

### The decision-coverage gate only tracks `**D-NN:**` and checks must_haves/truths

The `check.decision-coverage-plan` gate counts a CONTEXT decision as trackable only when written `**D-NN:**` (ID immediately before the colon); decisions written `**D-NN (label):**` are skipped. It looks in plan `must_haves`/`truths`, not just the body -- a decision cited only in prose still reads as uncovered. Fix: cite the decision ID in `must_haves.truths`.
**Source:** plan-phase decision-coverage gate run (this phase)

## Patterns

### Idiomatic vendored-subset drift guard

`type AssertAssignable<From, To extends From> = true;` over a tuple of per-member `[real, shim]` pairs, plus call-site probes at the consumer's exact arities. Uni-directional (`real -> shim`); never exact-equality against a foreign type.
**Source:** 10-RESEARCH.md, GitHub prior art (poe-code, omenien, seanmobrien)

### Two-pronged drift guard: build-time types + runtime introspection

A type gate catches structural drift (removed/renamed/sig-changed members); a runtime spec against the live import catches what types cannot -- newly-added members AND value/arithmetic drift (encodings, magic numbers). Pin encodings/constants at runtime, not in the type system.
**Source:** 10-CONTEXT.md D-04, 10-VALIDATION.md

### `node_modules` junction for parallel worktree executors

When a plan changes no deps, junction the worktree's `node_modules` to the main checkout's installed deps as the executor's first action; `NX_DAEMON=false --skip-nx-cache` for shared-cache safety; LINK-ONLY teardown (`rmdir`, never recursive) deferred to the orchestrator after the wave.
**Source:** AGENTS.md, worktree memory

### Greppable vendor-marker comment on every divergence

`// angular-typechecker: vendored -- <reason>` on each narrowed/fabricated construct so a single `git grep "angular-typechecker: vendored"` enumerates the entire vendored type surface (6 markers on the shim).
**Source:** 10-CONTEXT.md D-09, HARD-03

### Negative-proof verification for a tripwire

To prove a "fail loudly" guard actually fires, the verifier perturbed the shim (renamed a getter -> TS2339; changed a return -> TS2344), confirmed `typecheck-drift` FAILED (exit 1), then restored the shim and re-confirmed green + a clean tree. A passing gate alone does not prove the alarm trips.
**Source:** 10-VERIFICATION.md SC1

## Surprises

### The Angular ecosystem uses the real compiler-cli types directly

`@angular/build` and AnalogJS import the real `api.Program`/`NgtscProgram` and need no drift guard. angular-typechecker's vendored SUBSET (forced by the `nodenext` empty-resolution problem) is the unusual choice -- which is exactly why it needs an explicit guard the real consumers do not.
**Source:** GitHub prior-art research

### Exhaustiveness against a foreign vendored subset has no public prior art

A targeted GitHub search for exact-equality / `Exclude<keyof>` guards against an external type returned ZERO results; every real drift guard found is a uni-directional assignability probe. The "catch additions too" intuition is unsupported in the wild.
**Source:** GitHub prior-art research

### `expect-type` was already in the tree -- which argued AGAINST using it

`expect-type@1.4.0` is a transitive dependency of Vitest 4.1.9. But relying on a transitive dep is itself the hazard (a Vitest major could drop/bump it), so "using it" would require declaring it as a direct devDep. PlainTS sidestepped the question entirely.
**Source:** npm survey, board member 5

### HARD-01's own requirement text was self-contradictory

The requirement said BOTH "a new OR removed diagnostic getter breaks the build" AND "real->shim direction only (deliberate subset)" -- a NEW getter structurally cannot break a `real->shim` probe. The D-07 wording fix resolved it: REMOVED/renamed/sig-changed breaks the build; ADDED getters are intentionally not a build failure and are surfaced by the runtime spec. (Caught during discuss-phase, applied as a code-review-gated REQUIREMENTS.md edit.)
**Source:** 10-CONTEXT.md D-07, 10-02-SUMMARY.md
