---
phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode
plan: 03
subsystem: docs
tags: [storybook, composition, docs, readme, layout-c, mdx, tsx, strict, tripwire, decision-record]

# Dependency graph
requires:
  - phase: 19-01
    provides: "the shipped opt-in strict verdict option this doc briefly mentions"
  - phase: 19-02
    provides: "the exercised Composition fixture (dependsOn:['^typecheck'] fan-out) + the StorybookConfig['refs'] is `any` finding that shapes the coverage claim"
provides:
  - "README ## Storybook Composition subsection: per-project typecheck + Nx graph fan-out, with the board trust-lens MUST/MUST-NOT coverage claim"
  - "README Layout C verification note (direct single-leaf path) + Angular-CLI planned/deferred caveat + shipped strict option documented"
  - "19-DECISIONS.md recording Layout-C-beyond-guard and .mdx/.tsx-beyond-advisory as 'not warranted' (closes phase-19 success criterion 1)"
  - "storybook-docs.spec.ts: a deterministic README content tripwire (T-19-05 false-assurance guard)"
affects: [milestone-verification, milestone-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-assertion tripwire: readFileSync(../README.md) + whitespace-normalized substring asserts (no compiler load; survives prose re-wrapping)"
    - "Coverage claim in board trust-lens MUST/MUST-NOT form; the MUST-NOT (refs are runtime URLs) is CI-locked against drift to an over-claim"

key-files:
  created:
    - packages/angular-typechecker/src/storybook-docs.spec.ts
    - .planning/phases/19-stretch-layout-c-non-ts-story-formats-strict-mode/19-DECISIONS.md
  modified:
    - packages/angular-typechecker/README.md

key-decisions:
  - "Composition coverage rests on per-project typecheck + Nx ^typecheck fan-out (implicitDependencies), NOT Storybook's `any`-typed refs (19-02 finding); the host main.ts refs is checked as ordinary TS, credited to a consumer-declared ref shape"
  - "Layout C caveat refined into a verification note (direct single-leaf path checks a flat config's stories; empty/story-less is guarded), NOT committed support"
  - "Angular-CLI shape worded 'not yet covered, planned' (GEN-FUT-01/02), NOT 'unsupported'"
  - "Documented the shipped 19-01 strict option in the executor options table (Rule 2 doc completeness) in addition to the brief Composition mention"

requirements-completed: [SB-08]

# Metrics
duration: 6min
completed: 2026-07-07
---

# Phase 19 Plan 03: Storybook Composition docs + deferred SB-08 dispositions Summary

**Extended README `## Storybook` with a Composition subsection (per-project typecheck + Nx `dependsOn:["^typecheck"]` fan-out, a board trust-lens MUST/MUST-NOT coverage claim, a Layout C verification note, an Angular-CLI planned caveat, and the shipped strict option), locked it with a deterministic content tripwire, and recorded the Layout-C-beyond-guard and `.mdx`/`.tsx`-beyond-advisory dispositions as "not warranted" -- closing phase-19 success criterion 1. Prose + one spec; zero engine/executor code.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-06T23:40Z
- **Completed:** 2026-07-06T23:50Z
- **Tasks:** 2
- **Files:** 3 (2 created, 1 modified)

## Accomplishments

- README `### Storybook Composition` subsection: Composition is a multi-project TOPOLOGY (each composed project AND the host are per-project Layout A); coverage = per-project `typecheck` + Nx graph fan-out (`nx run-many -t typecheck` / `nx affected -t typecheck` / `dependsOn: ["^typecheck"]` on the host); the graph edge (`implicitDependencies`), NEVER the ref URL, is the source of truth.
- Board trust-lens coverage claim: MUST ("each composed project's declared TypeScript surface is type-checked when a `typecheck` target points at that project's solution `tsconfig.json`; `nx run-many` / `affected` covers the set"); MUST-NOT ("we do NOT verify that composed `refs` resolve, are reachable, or deploy -- those are runtime URLs").
- Honest refs framing (per the 19-02 finding): the host `.storybook/main.ts` refs is checked as ordinary TS, but `@storybook/angular` types `StorybookConfig['refs']` as `any`, so a mistyped ref is caught only against a consumer-declared ref shape -- Storybook's own type does not catch it. The docs do NOT over-claim.
- Layout C caveat refined into a verification note (direct single-leaf path checks a flat config's declared stories; empty/story-less is guarded, never a silent pass); Angular-CLI caveat added worded "not yet covered, planned for a future milestone" (NOT "unsupported"); the shipped opt-in `strict` option documented in the executor options table plus a brief Composition mention.
- `storybook-docs.spec.ts`: a deterministic README content tripwire (no compiler load) asserting the Composition subsection, the MUST + MUST-NOT phrases, the `dependsOn: ["^typecheck"]` recipe token, the no-over-claim sentence, the Layout C direct-single-leaf note, and the Angular-CLI planned wording. 8 assertions green; full package suite 337 tests green.
- `19-DECISIONS.md`: both deferred SB-08 items recorded as "not warranted" with cited rationale (CONSENSUS D7, OSS-CANDIDATES no-exact-stack-Layout-C, the `run-typecheck.ts` direct-path fact; SB6-legacy-removed `.stories.mdx` + unused `.stories.tsx` + the shipped `.mdx` advisory) -- closing phase-19 success criterion 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: README Composition docs + content tripwire** - `6f019b3` (docs) - README `## Storybook` additions + `storybook-docs.spec.ts`.
2. **Task 2: record deferred SB-08 dispositions** - `29f57bc` (docs) - `19-DECISIONS.md` ("not warranted" x2, cited).

Both are `docs` type (README under the published package, and a `.planning/` decision note): no code behavior change, so they do not bump the released version.

## Files Created/Modified

- `packages/angular-typechecker/README.md` - `### Storybook Composition` subsection + MUST/MUST-NOT coverage claim + honest refs framing + Layout C verification note + Angular-CLI planned caveat + `strict` options-table row and Composition mention.
- `packages/angular-typechecker/src/storybook-docs.spec.ts` - the deterministic README content tripwire (whitespace-normalized substring asserts).
- `.planning/phases/19-stretch-layout-c-non-ts-story-formats-strict-mode/19-DECISIONS.md` - the two "not warranted" dispositions with cited rationale; the consistency check against the README caveats; criterion-1 closure.

## Decisions Made

- **Composition coverage claim rests on the Nx graph, not Storybook's types.** Per the 19-02 finding (`StorybookConfig['refs']` is `any`), the doc credits per-project `typecheck` + `dependsOn:["^typecheck"]` fan-out (over `implicitDependencies`) and a consumer-declared ref shape -- never Storybook's own refs typing -- for what is caught. The MUST-NOT (refs are runtime URLs, not verified) is CI-locked by the tripwire.
- **Layout C = verification note, not committed support.** Refined the existing caveat to state the direct single-leaf path already checks a flat config's declared stories and that an empty/story-less config is guarded, while keeping it explicitly out of committed support for v0.1.2.
- **Angular-CLI worded as planned/deferred.** "Not yet covered, planned for a future milestone" (GEN-FUT-01/02), not "unsupported".
- **Documented the shipped strict option (Rule 2).** 19-01 shipped `strict` without a README table row; added one for doc completeness alongside the brief Composition mention.
- **Commit scopes.** `docs(storybook)` and `docs(19)` (release-meaningful / non-package), per AGENTS.md scope-hygiene; both `docs` type, no version bump.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing doc] Documented the shipped `strict` executor option in the options table**
- **Found during:** Task 1
- **Issue:** 19-01 shipped the `strict` executor option (schema.json + schema.d.ts) but did not add it to the README Executor options table, leaving a shipped public option undocumented in its canonical place while the plan asked only for a brief Composition mention.
- **Fix:** Added a `strict` row to the Executor options table (default `false`; escalates coverage-incomplete to a hard failure; only ever adds a fail path), matching the schema.json description, in addition to the brief Composition-subsection mention the plan specified.
- **Files modified:** `packages/angular-typechecker/README.md`
- **Commit:** `6f019b3`

Otherwise the plan executed as written. The refs coverage framing was written per the wave-1 constraint (19-02): the claim rests on per-project typecheck + Nx `^typecheck` fan-out, not Storybook's `any`-typed refs -- this is honoring the plan's context, not a deviation.

## Threat Model Compliance

- **T-19-05 (Tampering / false assurance, README Composition coverage claim):** mitigated -- the claim is written in board trust-lens MUST/MUST-NOT form (never "all Storybook files", never "refs resolve"), and `storybook-docs.spec.ts` fails CI if the MUST-NOT caveat, the Composition claim, or the no-over-claim sentence is removed or softened. Drift toward an over-claim is caught.
- **T-19-06 (Information disclosure):** accept -- docs are public consumer-facing; no secrets; no changelog written, no release cut.
- **T-19-SC (supply chain):** N/A -- no package installs (docs + one deterministic spec on the locked stack).

## Known Stubs

None. This plan is prose + one content-assertion spec; no data-wired components, no placeholders.

## Verification

- `npx nx test angular-typechecker --skip-nx-cache`: 337 tests green (45 files), including the 8 new tripwire assertions.
- `npx nx format:check` clean on both touched source files (Prettier applied); `npx nx lint angular-typechecker` clean.
- `git grep -q "Composition" -- packages/angular-typechecker/README.md`: succeeds.
- `git grep -q "not warranted" -- .../19-DECISIONS.md` and `git grep -q "run-typecheck" -- .../19-DECISIONS.md`: succeed.
- ASCII-only scan (`rg '[^\x00-\x7F]'`) clean on all three touched files.

## Self-Check: PASSED

- All created/modified files verified present on disk (README.md, storybook-docs.spec.ts, 19-DECISIONS.md).
- Both task commits verified in git history: `6f019b3`, `29f57bc`.
- Tripwire spec green (337-test suite passes); format + lint clean on touched files; no accidental deletions.

---
*Phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode*
*Completed: 2026-07-07*
