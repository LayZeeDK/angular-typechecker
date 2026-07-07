---
phase: 19
phase_name: "stretch-layout-c-non-ts-story-formats-strict-mode"
project: "angular-typechecker"
generated: "2026-07-07"
counts:
  decisions: 3
  lessons: 3
  patterns: 3
  surprises: 3
missing_artifacts:
  - "UAT.md"
---

# Phase 19 Learnings: Stretch -- Layout C / non-TS story formats / strict mode

## Decisions

### strict shipped as a verdict-only knob, not a threaded option
The opt-in `strict` mode is a single one-line gate in the pure verdict function
(`evaluate-result.ts`: `(gatesWarnings || strict) && suppressedInGraphWarningCount > 0`),
not plumbed through `CoreOptions` / `runTypecheck` / `exit-codes.ts`. It reaches
`evaluateResult` only via `schema.json -> normalize-options (?? false) -> executor`.

**Rationale:** 19-RESEARCH flagged the multi-layer threading as an anti-pattern; the
verdict is the only place the flag changes behavior, so that is the only place it lives.
**Source:** 19-01-SUMMARY.md

### Storybook Composition supported as a TOPOLOGY with zero engine code
Composition (a host with `refs` composing sibling projects) is supported purely by
per-project `typecheck` targets plus the Nx `dependsOn: ['^typecheck']` fan-out over
`implicitDependencies` -- no changes to the type-check engine (D-04/D-05/D-06).

**Rationale:** the existing reference-walk engine already covers each composed project in
isolation; Composition is an Nx wiring concern, not a compiler concern.
**Source:** 19-02-SUMMARY.md, 19-02-PLAN.md

### Layout-C-beyond-guard and .mdx/.tsx-beyond-advisory: NOT WARRANTED
Recorded the deferred SB-08 stretch sub-items as "not warranted" with cited rationale
(CONSENSUS D7, OSS-CANDIDATES no-exact-stack-Layout-C, the `run-typecheck.ts` direct-path
fact) rather than building them. Closes phase-19 success criterion 1.

**Rationale:** no evidence on the official stack justified the extra surface; the
no-silent-pass guard already covers the safety case.
**Source:** 19-DECISIONS.md

---

## Lessons

### A dependency's declared type can be `any` -- verify before basing a negative test on it
`@storybook/angular@10.4.6` types `StorybookConfig['refs']` as `any`, so the planned
negative (a numeric `url` errors via Storybook's own type) was a false premise and would
have been a false-green. Fixed by typing the host `refs` against a locally-declared
`CompositionRef` shape (the realistic consumer pattern), so the mistyped-ref test fails on
a real diagnostic.

**Context:** negative tests that rest on a third-party type must confirm that type actually
constrains the value; `any` silently defeats the test.
**Source:** 19-02-SUMMARY.md

### A test fixture that is a real Nx project pollutes the dev graph -- exclude it
The `storybook-host` fixture collided with `consumer-storybook-b` in the dev Nx graph, and
its pre-committed `typecheck` targets would have leaked into `nx run-many -t typecheck`.
Fixed by excluding the fixture directory via `.nxignore` (matrix-e2e precedent); the
tmp-copied e2e workspace still sees all projects.

**Context:** e2e fixtures that carry `project.json` are indexed by Nx unless `.nxignore`d.
**Source:** 19-02-SUMMARY.md

### A tripwire that locks prose does not lock the option's help text
The `storybook-docs.spec.ts` content tripwire locks the README Composition claim, but the
`strict` option's `schema.json` help text and the strict README paragraph were outside its
scope and drifted into an inaccurate use of the formal `coverage-incomplete` Outcome name
(WR-01) -- caught only by deep code review.

**Context:** shipped help/description strings need their own accuracy guard or review; a
prose tripwire scoped to one claim will not catch drift elsewhere.
**Source:** 19-REVIEW.md

---

## Patterns

### Verdict-only feature gate (only-adds-a-fail-path)
Add a new fail condition as a one-line OR-widening inside the pure verdict function,
defaulted `false` and read once in a `success:false` branch downstream of all early
fail-returns. The knob can only tighten -- it can never turn a fail into a pass.

**When to use:** opt-in strictness flags where the safe direction is over-reporting.
**Source:** 19-01-SUMMARY.md, 19-VERIFICATION.md

### Content tripwire spec for public coverage claims
A deterministic filesystem-read test that greps a shipped doc for its MUST/MUST-NOT
coverage claim, normalizing whitespace (`\s+` -> single space) so it survives prose
re-wrapping. Fails CI if the claim is deleted or softened into an over-claim.

**When to use:** any public doc that makes a coverage/assurance claim that must not silently
over-claim (false-assurance threat class).
**Source:** 19-03-SUMMARY.md

### Synthetic-hybrid Composition e2e fixture
Two Layout-A libs + a composing host (`refs` + `implicitDependencies` +
`dependsOn:['^typecheck']`), `.nxignore`d out of the dev graph and materialized into a tmp
workspace against the packed tarball + real `@storybook/angular`. Exercises baseline-clean,
broken-composed-story (own target + fan-out), and mistyped-ref negatives.

**When to use:** proving a multi-project topology works end-to-end without adding a new e2e
project (shared-tarball serialization).
**Source:** 19-02-SUMMARY.md

---

## Surprises

### The planned Composition negative test premise was false
19-RESEARCH Pattern 3 assumed Storybook's `refs` type would reject a bad ref; it is typed
`any`. The executor discovered this at implementation time and re-based the negative on a
consumer-declared `CompositionRef`.

**Impact:** required a mid-plan test redesign and a downstream docs constraint for 19-03
(the coverage claim must credit per-project typecheck + fan-out, not Storybook's `refs`).
**Source:** 19-02-SUMMARY.md

### Shipped help text can be semantically self-contradictory yet pass all tests
The `strict` help text said the default "reports coverage-incomplete without failing" --
self-contradictory, since `coverage-incomplete` is by definition `success:false`. Vitest
(transpile-only) and `nx build` (excludes specs) could not catch it; only the deep code
review did (WR-01).

**Impact:** reworded three spots (schema.json + two README locations); no behavior change.
**Source:** 19-REVIEW.md

### SB-08 completion could not be marked -- it is prose, not a checkbox
`requirements.mark-complete SB-08` was a no-op because SB-08 lives under
`## Future Requirements` in REQUIREMENTS.md as a prose bullet, while all three SUMMARY
frontmatters claimed `requirements-completed: [SB-08]`.

**Impact:** a documentation nuance, not a goal gap -- the deferred sub-items are auditably
dispositioned in 19-DECISIONS.md.
**Source:** 19-VERIFICATION.md, 19-03-SUMMARY.md
