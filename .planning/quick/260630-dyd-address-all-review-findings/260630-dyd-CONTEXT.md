# Quick Task 260630-dyd: Address all review findings - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Discussion mode:** `--analyze --auto` (codebase assumptions pass via gsd-assumptions-analyzer; recommended option auto-locked per gray area; no trap-quadrant escalations -- all decisions are LOW/MEDIUM impact with MEDIUM-HIGH+ confidence)

<domain>
## Task Boundary

Address the actionable findings from the PR #11 (milestone v0.0.3) code review -- the 5-agent
`/pr-review-toolkit:review-pr` pass plus this `--analyze` validation pass. One behavioral fix
(I-1), three test-gap closures, and a set of low-risk cleanups. Scope is confined to
`packages/angular-typechecker/**` source + specs, `fixtures/fault-isolation/**`, and
`.fallowrc.jsonc`. All commits land on the current branch `gsd/v0.0.3-engine-hardening`
(into PR #11). No `.planning/` behavior changes; no new feature surface.
</domain>

<decisions>
## Implementation Decisions

### I-1 -- silent RES-02 notice on out-of-basePath poison (the one behavioral fix)

- **Detect the TCB-generation Fatal (NG3004) on the PRE-filter `diagnostics` set in `finalize`**,
  not on `reported` (the post-boundary-filter, deduped set). Locked: Option A. Confirmed safe --
  `diagnostics` is the raw `[...configDiagnostics, ...result.diagnostics]` arg (run-typecheck.ts
  ~257/~367); `detectTemplateCheckAborted` is a pure `.find` returning a fresh object; counts
  derive only from `reported`, so detection on the pre-filter set changes NEITHER errorCount/
  warningCount NOR the reported set. The change is additive (more cases fire the notice; none stop).
- **Keep the current first-found `fileName` (`.find`)** -- do NOT add an in-project-preference
  branch. The compiler dedups the Fatal to one occurrence per (code,file), and a second poison's
  Fatal is empirically suppressed (09-02-SUMMARY.md), so the in-project-preference branch would be
  untestable dead code. Locked: Option A.
- **Reframe the root cause before writing the regression test** (the review's "imported unexported
  symbol from libs/bar" chain is imprecise -- the Fatal attaches to the shim of the component whose
  TEMPLATE is checked). The genuine trigger: the poisoned component's OWN `.ngtypecheck.ts` shim
  falls outside the leaf tsconfig's `basePath`. Locked: Option B.
- **Primary regression test = a `finalize`-level unit test with a SYNTHESIZED out-of-basePath
  NG3004**: assert the diagnostic is suppressed from `reported` (`suppressedCount > 0`, absent from
  `result.diagnostics`) YET `templateCheckAborted` still fires (failing-then-passing against the
  fix). This is reliable and OS-independent. A real cross-project integration fixture (poisoned
  component out-of-basePath) is BEST-EFFORT only -- attempt it, but the unit test is the gate
  (the live cross-project repro is PLAUSIBLE-UNVERIFIED).
- **Correct the run-typecheck.ts ~400-405 comment** that currently assumes the in-project case is
  the only case.

### Test-gap closures (CONFIRMED real)

- **T1 (filter-diagnostics realpath fallback):** add a test combining a THROWING realpath with an
  OUT-of-project path, asserting it is still SUPPRESSED (`suppressedCount === 1`). The existing
  throwing-realpath test only covers the in-project keep path.
- **T3 (infra re-throw message):** assert the thrown `TypecheckInfrastructureError.message` carries
  the flattened compiler text (`ts.flattenDiagnosticMessageText`), at BOTH the config-stage and
  post-compilation-stage scans. e.g. `rejects.toThrow(/<planted text>/)`, not just
  `rejects.toBeInstanceOf(...)`.
- **S-types (drift blind spot):** add `expect(typeof
program.getTsProgram().useCaseSensitiveFileNames).toBe('function')` to
  `compiler-cli-types.runtime.spec.ts` -- the one vendored runtime member enforced by neither the
  build-time drift probe nor the runtime spec.

### Cleanups (CONFIRMED, no behavioral risk)

- **S-code:** remove the dead `EmitFlags: { None: 0 }` mock member in `infra-failure.spec.ts` (~45)
  -- HARD-02 removed `None` from the shim enum; production passes `0 as EmitFlags`, never `.None`.
- **S-test:** REMOVE the unreferenced RES-01 spike-leftover fixtures
  `fixtures/fault-isolation/non-template-error.component.ts` and `tsconfig.non-template.json`
  (zero spec references; the spike probe spec no longer exists). Removal over wiring-in: a
  non-template survivor diagnostic is already covered by `fault-isolation.integration.spec.ts`
  (survivor's TS2322), so wiring in would be scope creep.
- **S-comments:** drop the three rot-prone magic numbers, keep the semantic anchors. Replace the
  `typescript.js:129892` line pin (3 sites: run-typecheck.ts ~136, infra-failure.spec.ts ~138,
  suppress-output-path.integration.spec.ts ~27) with a stable anchor like
  "in `verifyCompilerOptions` (TS 6.0.3)". Drop the ".fallowrc.jsonc 56 entry points" and
  "14 dev/tooling deps" counts (keep the surrounding rationale).

### Dropped / Out of scope

- **T2 -- DROPPED (REFUTED by --analyze):** `includeDeps: true` IS plumbed end-to-end through
  `runTypecheck -> finalize` (`run-typecheck.integration.spec.ts:129-145` asserts fold-back +
  `suppressedCount === 0`). No action -- adding coverage would duplicate existing tests.
- **NG() dev-time range guard / toExitCode + diagnostic-codes branding:** NOT added. The
  type-design review itself rated these "over-engineering / would not add now"; all callers pass
  literals.
- **AGENTS.md factual-accuracy review (process note):** no code action -- the v0.0.3 AGENTS.md
  delta was already reviewed by the phase `code_review_gate` during execution.

### Claude's Discretion

- Exact test naming/phrasing and placement within the existing spec files.
- Whether the best-effort I-1 cross-project integration fixture is included (gate is the unit test).
- Whether the `typescript.js` anchor wording is "verifyCompilerOptions" or an equally stable phrase.
  </decisions>

<specifics>
## Specific Ideas

Source of findings: the 5-agent `/pr-review-toolkit:review-pr` run on PR #11 (code / errors / types
/ tests / comments, all opus) + the `260630-dyd` `--analyze` assumptions pass. The behavioral fix
(I-1) was independently verified against `run-typecheck.ts:406` (detection on the post-filter
`reported` set) and the `@angular/compiler-cli@22.0.4` typings.

Affected files (expected): `run-typecheck.ts` (+ comment), `filter-diagnostics.spec.ts`,
`infra-failure.spec.ts`, `compiler-cli-types.runtime.spec.ts`, `suppress-output-path.integration.spec.ts`,
`.fallowrc.jsonc`, and removal of two `fixtures/fault-isolation/` files. A new finalize-level unit
test (likely in `run-typecheck.spec.ts` or a focused new spec).
</specifics>

<canonical_refs>

## Canonical References

- `.planning/phases/09-resilience-per-file-fault-isolation-boundary-robustness/09-RES-01-SPIKE.md`
  (Fatal attaches to `<checked-component>.ngtypecheck.ts`; second-poison Fatal suppression).
- `.planning/phases/09-.../09-RES-02-DECISION.md` (RES-02 reframe + REP-RES-02b deferral).
- AGENTS.md "Single-plan wave: skip worktrees" (this quick task runs the executor on the main tree).
  </canonical_refs>
