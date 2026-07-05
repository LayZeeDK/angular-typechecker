# Phase 17: Input-set-membership boundary + layout support - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discuss; recommended options auto-locked) `--chain` (auto-advance to plan+execute)

<domain>
## Phase Boundary

`nx typecheck` type-checks `*.stories.ts` (and the whole `.storybook/`
tsconfig-declared surface) for BOTH the per-project scaffold (Layout A) and the
centralized host (Layout B, the Nx `one-storybook-for-all` recipe) **without ever
silently passing a dropped diagnostic**, via ONE boundary-filter correctness fix:
replace the diagnostic filter's directory-containment proxy with compiler
**input-set membership**.

**In scope (Phase 17 = SB-02, SB-04, SB-01, SB-03):**
- SB-02 — replace directory-containment with a pure `keep(diagnostic, inputSet, options)`
  routed by both the walk and the direct single-leaf path; external-template branch 4a.
- SB-04 — split the silent `suppressedCount` into `suppressedThirdParty` +
  `suppressedInGraph`; surface both loudly; `suppressedInGraph > 0` => non-clean.
- SB-01 — Layout A support (already type-checked by the shipped walk; delivered as
  a regression fixture + docs note here).
- SB-03 — Layout B support, delivered purely by the SB-02 boundary change.

**Out of scope (explicit — belongs to later phases):**
- Full T1-T11 negative-test acceptance matrix + packaged-tarball e2e -> Phase 18 (SB-06).
- README + changelog coverage claim/caveats -> Phase 18 (SB-07).
- Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard -> Phase 19 (SB-08, stretch).
- Any Storybook-specific machinery: NO version gate, NO `*.stories.ts` allowlist,
  NO `boundaryMode`/`includeStories`/`storybookLayout` option (D6). The fix is the
  DEFAULT, not behind a flag.

</domain>

<decisions>
## Implementation Decisions

Most of this phase's design is LOCKED by the Phase-16 gate spike (verdict = GO,
branch 4a). Those locked items are recorded so downstream agents do not re-open
them. The two genuine gray areas (D-06 shape, D-09 test scope) are both
evidence-backed by the roadmap/spike; residual plan-time details are flagged.

### Boundary filter (SB-02) — LOCKED by spike

- **D-01:** Replace directory-containment (current `isUnderDir` as the primary keep
  test) with input-set membership. Implement a pure
  `keep(diagnostic, inputSet, options) -> boolean` and route BOTH the walk-union path
  and the direct single-leaf path through it (one boundary semantics; avoids drift).
  The boundary filter references **ZERO ngtsc/component-registry internals** —
  enforced by a structural `git grep` gate in the test suite.
- **D-02:** `inputTs` = the canonical UNION of every walked leaf's DECLARED
  `readConfiguration(leaf).rootNames` `.ts` paths — NOT
  `program.getTsProgram().getRootFileNames()` (a SUPERSET that adds one synthetic
  `<root>.ngtypecheck.ts` shim per root; spike 006). If rootNames are ever read off a
  Program, strip/ignore `.ngtypecheck.ts` shims (never treat a shim as first-party —
  it would corrupt `suppressedInGraph`). Canonicalize `inputTs` AND diagnostic files
  with the SAME existing canonicalizer (realpath -> slash -> case-fold) or
  symlink/junction cases break (T8).
- **D-03:** keep-rule branches (per diagnostic `d`, canonical file `F`, `base` =
  solution/host tsconfig dir):
  (a) `d` file-less OR `F` unresolvable -> KEEP (existing fail-safe);
  (b) `F` has a `node_modules` path SEGMENT -> SUPPRESS (unless `includeDeps`);
  (c) `F` in `inputTs` OR `F` under `base` -> KEEP (covers `.ts` inputs + inline
  templates; Layout-A stories are both; a transitively-imported dependency `.ts` is
  neither -> suppressed = isolation);
  (d) `F` is a non-`.ts` external-template resource -> branch 4a (below).
- **D-04:** External-template branch = **4a** (spike 008; G1 = html, G5 = PASS):
  read the `.html` diagnostic's public `ts.Diagnostic.relatedInformation`, resolve the
  owning component `.ts`, **KEEP iff that `.ts` is in `inputTs`**, else SUPPRESS (a
  dependency's external-template error -> isolation). If an `.html` diagnostic has NO
  `.ts` `relatedInformation` (unmappable; not observed in the spike) -> **default-KEEP**
  (over-report safe; never a false pass).

### Split suppressed counter + coverage-incomplete verdict (SB-04)

- **D-05 (LOCKED):** Split the currently-silent `suppressedCount` into
  `suppressedThirdParty` (= `node_modules` suppressions, expected, INFO) +
  `suppressedInGraph` (= a compiled first-party source dropped: NEITHER `node_modules`
  NOR file-less). Surface BOTH counts in the structured `CoreResult` AND loudly in
  executor stdout. A correctly-classified supported layout has
  `suppressedInGraph == 0` BY CONSTRUCTION.
- **D-06 (direction AUTO-LOCKED; shape flagged for planning):** `suppressedInGraph > 0`
  yields a distinct **non-clean coverage-incomplete outcome** — the charter is "never a
  silent false pass," so the executor MUST NOT report a clean / `success: true` when a
  first-party diagnostic was dropped. Guard with canonicalization symmetry (T8) so it
  cannot spuriously fire on a supported layout.
  - **RESIDUAL for research + planning:** the exact operational shape. Recommendation:
    gate it in the PURE core (so both the Nx executor and the deferred CLI inherit one
    rule); for the Nx path map coverage-incomplete to `success: false`
    (`evaluate-result.ts`); decide whether the deferred CLI gets a DISTINCT exit code vs
    reusing `1`, ratified against `exit-codes.ts` at plan time. Current scheme:
    `0` clean / `1` type-error / `2` infra; `toExitCode` has NO live consumer yet (CLI
    is deferred scaffold), so the CLI code choice is low-risk and additive.
- **D-07 (flagged for planning):** `suppressedCount` is a shipped public `CoreResult`
  field. Recommendation: KEEP it (= `suppressedThirdParty + suppressedInGraph`) alongside
  the two new fields for an additive / non-breaking 0.x change; planner to confirm vs
  a clean replacement.

### Layout support + Phase-17 test scope (SB-01, SB-03)

- **D-08 (LOCKED):** Layout A (SB-01) is already type-checked by the shipped
  reference-walk; Phase 17 adds it as a regression fixture + a docs note (docs body is
  Phase 18). Layout B (SB-03) is delivered PURELY by the SB-02 boundary change — no
  Storybook-specific code. Check the WHOLE tsconfig-declared set (the `include` is the
  selector), never a filename allowlist.
- **D-09 (test scope AUTO-LOCKED per roadmap split):** Phase 17 ships exactly:
  (1) a pure UNIT test on `keep()` with synthetic diagnostics + a synthetic input set
  (proves every branch a-d, incl. the 4a `relatedInformation` map + the unmappable
  default-KEEP);
  (2) the **tripwire** test — assert external-template diagnostics DO carry a `.ts`
  `relatedInformation`, so a future Angular attribution flip is caught LOUD, not
  silently dropping diagnostics;
  (3) the MINIMUM integration proof of this phase's 5 success criteria (broken/clean
  story fails/passes under BOTH Layout A and Layout B; the external-`templateUrl` NG8002
  kill-shot with `.html`/component codeframe; dependency + `node_modules` isolation;
  clean Layout-B `suppressedInGraph == 0` with both counts surfaced; no Layout-A
  regression).
  The FULL T1-T11 acceptance matrix, packaged-tarball e2e, and docs are Phase 18
  (SB-06/SB-07) — do NOT pull them forward.

### Claude's Discretion (for research + planning)
- Exact module location + signature of `keep()` (extend `filter-diagnostics.ts` vs a new
  module) and the `inputSet` data structure (a `Set<string>` of canonical rootName paths
  is the obvious choice).
- Exactly how `walk-references.ts` surfaces each leaf's declared rootNames (it currently
  holds `result.program` and discards everything but the count).
- Exact stdout wording/format for the two counts (loud is the requirement).
- The D-06 exit-code shape and the D-07 field-retention question (both flagged above).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning
or implementing.**

### Phase-17 implementation blueprint (READ FIRST)
- `.claude/skills/spike-findings-angular-typechecker/references/storybook-input-set-boundary.md`
  — THE build blueprint: the keep-rule branches (a-d), branch 4a (`relatedInformation`
  ownership), the split counter, the `.ngtypecheck.ts` landmine, what-to-avoid, and the
  Layout-B host shape. Non-negotiable design.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` — requirements + findings
  index (auto-loaded during implementation).

### Requirements, roadmap, gate verdict
- `.planning/REQUIREMENTS.md` — SB-01..SB-08; Phase 17 = SB-02, SB-04, SB-01, SB-03
  (SB-05 RESOLVED = GO; SB-06/07 -> Phase 18; SB-08 -> Phase 19).
- `.planning/ROADMAP.md` §"Phase 17" — goal + the 5 success criteria that gate this phase.
- `.planning/phases/16-storybook-type-check-gate-spike-gated-go-no-go/16-SUMMARY.md` —
  gate verdict (GO), branch 4a lock, the `readConfiguration().rootNames` nuance, D4.

### Board rationale + spike records (evidence)
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` — board rationale for D3/D4/D6/D-07.
- `.planning/spikes/006-layout-b-rootnames/` — G2 rootNames (declared-set keying).
- `.planning/spikes/007-forced-sb10-compile-ng8xxx/` — G3/G4 forced SB10 + NG8xxx fire RED.
- `.planning/spikes/008-external-template-attribution/` — G1/G5 attribution + ownership (4a).
- `.planning/spikes/MANIFEST.md`, `.planning/spikes/WRAP-UP-SUMMARY.md` — verdict + wrap-up.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (the boundary fix touches these; reuse, don't reinvent)
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` — the current
  directory-containment filter. `createCanonicalizer` (realpath -> slash -> case-fold,
  memoized) is REUSED for both `inputTs` and diagnostic files (T8 symmetry).
  `isNodeModulesPath` becomes keep-rule (b); `isUnderDir` becomes rule (c)'s "under base"
  clause. `FilterResult.suppressedCount` splits into two fields.
- `packages/angular-typechecker/src/core/run-typecheck.ts` — `finalize()` runs the filter
  ONCE on the (walk or single-leaf) union = the single boundary-semantics chokepoint that
  prevents walk/direct drift. `buildFinalizeFilter()` + the `FinalizeFilter` interface are
  the one place both callers build the filter -> extend to carry `inputTs`. `CoreResult`
  gains `suppressedThirdParty`/`suppressedInGraph`.
- `packages/angular-typechecker/src/core/walk-references.ts` — currently discards each
  leaf's rootNames; must surface the DECLARED `readConfiguration().rootNames` to build the
  `inputTs` union.
- `packages/angular-typechecker/src/core/evaluate-result.ts` — the pure `{ success }`
  verdict; the coverage-incomplete (`suppressedInGraph > 0`) integration point (D-06).
- `packages/angular-typechecker/src/core/exit-codes.ts` — the pure exit-code policy
  (0/1/2, ngc parity); coverage-incomplete exit-code decision lives here (deferred CLI).
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` — the adapter that
  renders loud stdout (`logger.warn`) and maps `CoreResult` to Nx `{ success }`; surfaces
  the two new counts.

### Established Patterns (constrain the implementation)
- **Core is PURE** — eslint bans `console`/`process` in `**/src/core/**`. All loud
  notices are rendered by the executor adapter from pure structured fields (see the
  existing `templateCheckAborted` / `skippedReferences` detection-vs-rendering split).
- **Pure detection follows `detectTemplateCheckAborted`** — code-only, no side effects;
  the tripwire (D-09.2) follows the same style.
- **Additive / non-breaking 0.x** — new fields are additive; the green->red flip on
  existing Layout-B builds is a true-fail correction (loud changelog callout at Phase 18).
- **NG-code encoding:** `ts.Diagnostic.code === -(990000 + ngNumber)` (NG8002 = -998002).

### Integration Points
- walk (`parsed.rootNames` per leaf) -> `inputTs` union -> `keep()` inside `finalize`.
- `CoreResult` -> executor stdout + Nx `{ success }` (`evaluateResult`) + deferred CLI
  (`toExitCode`).

</code_context>

<specifics>
## Specific Ideas

- **The kill-shot case** (success criterion 2): an aggregated external-`templateUrl`
  NG8002 MUST FAIL with the `.html`/component codeframe. This is precisely the case a
  naive rootNames-only replacement would silently drop (`.html` is not a rootName) —
  branch 4a exists to catch it.
- **Layout B host shape:** the host solution `tsconfig.json` may reference ONLY
  `./.storybook/tsconfig.json` (no app/lib leaf — a legit real shape, radix-ng);
  `.storybook/tsconfig.json` `include` reaches out via relative globs
  (`../../../packages/**`); `paths` aliases flow in via the `extends` chain (no special
  handling). Aggregation is a MANUAL recipe edit, not generator-produced.
- **Forced Storybook constraint (docs-only, D4 — NO runtime gate):**
  `@storybook/angular@10.4.6` peer-caps Angular `>=18 <22` / TS `^4.9||^5`, so installing
  on the official Angular 22.0.4 / TS 6.0.3 stack needs `--legacy-peer-deps`/`--force`;
  its 48 TS6 `.d.ts` errors are all `node_modules`-attributed and suppressed by keep-rule
  (b) -> never leak in-project -> no false FAIL. `nx add`/pnpm can hit
  `ERR_PNPM_IGNORED_BUILDS` (this repo's known gotcha).

</specifics>

<deferred>
## Deferred Ideas

- Full T1-T11 negative-test acceptance matrix + in-repo generator fixtures + the
  packaged-tarball e2e (`nx add` + `nx g configuration` + `nx typecheck`) -> **Phase 18 (SB-06)**.
- README + changelog: exact coverage claim + caveats (`.mdx` never checked, `.tsx` only
  with `jsx`, external `templateUrl` per branch 4a, Layout C unsupported, pointing at a
  leaf tsconfig excludes stories, force-install caveat, the green->red flip callout)
  -> **Phase 18 (SB-07)**.
- `.mdx` / `.tsx`-without-`jsx` loud "not type-checked" notice (T11) -> Phase 18 validation.
- Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard
  -> **Phase 19 (SB-08, stretch)**.

None of the above is scope creep — all are already roadmapped to later phases.

</deferred>

---

*Phase: 17-input-set-membership-boundary-layout-support*
*Context gathered: 2026-07-05*
