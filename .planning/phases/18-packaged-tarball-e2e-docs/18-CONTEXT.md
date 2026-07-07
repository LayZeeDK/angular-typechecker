# Phase 18: Packaged-tarball e2e + docs - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discuss; recommended options auto-locked) `--analyze` (trade-off tables logged) `--chain` (auto-advance to plan+execute)

<domain>
## Phase Boundary

Prove the SHIPPED artifact (the packed tarball, not just the local build) catches
a planted `*.stories.ts` type error via `nx add` + `nx g angular-typechecker:configuration`
+ `nx typecheck` on generator-scaffolded Storybook fixtures (Layout A, and Layout B
per the Phase-16 GO), and ship the exact coverage claim + caveats + the green->red
changelog callout. This is the v0.1.2 validation + documentation phase.

**In scope (Phase 18 = SB-06, SB-07):**
- SB-06 -- the acceptance-gate negative tests: the packaged-tarball e2e (criterion 1)
  + the remaining T1-T11 matrix gaps not already covered by Phase 17's minimum
  integration proof, per layout, on the official stack.
- SB-07 -- README + changelog: the exact MUST/MUST-NOT/caveat coverage statement and
  the false-pass -> true-fail (green->red) callout.
- Criterion 2: a workspace `paths`-aliased aggregated import compiles clean (no spurious TS2307).
- Criterion 3 / T11: `.mdx` (never checked) and `.tsx`-without-`jsx` gaps emit a loud
  "not type-checked" notice (verdict may stay green). **This is net-new engine+executor
  work -- see D-01 and the flagged note below; it is NOT covered by any existing notice.**

**Out of scope (explicit -- belongs to later phases / other flows):**
- Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard -> Phase 19 (SB-08, stretch).
- Actual type-CHECKING of `.mdx`/`.tsx` (beyond the loud notice) -> Phase 19 (SB-08, stretch).
- An opt-in strict mode that FAILS on `suppressedInGraph > 0` -> Phase 19 (SB-08, stretch).
- The v0.1.2 release CUT (nx release, tag, npm publish) -> the AGENTS.md Release-PR flow
  AFTER the milestone closes; Phase 18 authors docs/changelog PROSE only (D-05).
- Any Storybook-specific engine machinery (version gate, `*.stories.ts` allowlist,
  layout option) -- the boundary fix shipped in Phase 17 is the DEFAULT, not a flag (D6 carried).

</domain>

<decisions>
## Implementation Decisions

All five gray areas were auto-resolved (`--auto`) to their recommended option; the
`--analyze` trade-off tables are in the DISCUSSION-LOG. None fell in the trap quadrant
(high-impact AND low-confidence): every lock is evidence-backed by the roadmap criteria,
the v0.1.2 charter, the Phase-17 decisions, or the existing e2e harness. D-01 is
high-impact but high-confidence; it is flagged for planning VISIBILITY (it changes the
phase's shape from "e2e + docs" to "small engine addition + e2e + docs"), not blocked.

### `.mdx` / `.tsx`-without-`jsx` "not type-checked" notice (criterion 3 / T11)

- **D-01 (LOCKED -- FLAGGED as net-new engine surface):** Criterion 3 requires a loud
  "not type-checked" notice for declared-but-uncheckable files. **Verified 2026-07-06:
  no such notice exists today** (`git grep` over `src/`: the engine only handles `.tsx`
  inside the filter's suppress rule and documents a `.tsx`/`.ngtypecheck` LIMITATION in
  `run-typecheck.ts` lines ~634-643 -- there is no scan-the-declared-surface advisory).
  So Phase 18 must ADD it. Shape: **pure detection in core + loud render in the executor**,
  mirroring the established `skippedReferences` / `templateCheckAborted` /
  `suppressedInGraphFiles` detection-vs-render split (core is pure -- eslint bans
  `console`/`process` under `src/core/**`; the executor adapter renders every loud notice
  from structured fields). Trigger: a file present in the tsconfig-declared surface that
  the type-check cannot cover -- `.mdx` ALWAYS; `.tsx` ONLY when the resolved
  `compilerOptions.jsx` is unset / `none`. Add a structured advisory field on `CoreResult`
  (a `readonly string[]` of the un-checked declared paths, in the family of
  `suppressedInGraphFiles`); the executor renders it loudly. **Verdict STAYS GREEN** (criterion 3
  explicitly permits it) -- this is an advisory, NOT a coverage-incomplete flip. The exact
  detection mechanism (enumerate declared non-`.ts` files -- `parseJsonConfigFileContent`
  `fileNames` is `.ts`-only, so glob the tsconfig `include` / `wildcardDirectories` or
  read the raw config `include`) is research/discretion.

### Packaged-tarball Storybook e2e (SB-06 criterion 1)

- **D-02 (LOCKED):** Use **committed generator-shaped Storybook fixtures + force-install
  `@storybook/angular@10.4.6`**, NOT a live `nx g @nx/angular:storybook-configuration` run
  per e2e. Rationale: a live Storybook generator install per OS-matrix job is heavy and
  fragile; the spike-007 forced-SB10 scaffold was never committed (scratchpad-only). Commit
  generator-produced Layout-A (and Layout-B) Storybook fixtures ONCE under the
  `angular-typechecker-install-e2e` project's `fixtures/`, then, per e2e run: copy into a
  tmp workspace, install the freshly-packed tarball, run `nx add` + `nx g
  angular-typechecker:configuration` + `nx typecheck`, and assert a planted `*.stories.ts`
  error is caught (non-zero exit + the expected code token, NO `ERR_REQUIRE_ESM`, NO
  "infrastructure error"). Include a Layout-B case (GO resolved; Layout B is the milestone's
  motivating silent-false-pass case).
- **D-02a (LOCKED -- install honesty, carries the B-03 rule):** Force-install
  `@storybook/angular@10.4.6` as a SEPARATE, EXPLICIT `--legacy-peer-deps` step (the D4
  documented SB10-peer-cap constraint), but install the **angular-typechecker tarball with
  NO peer-resolution override** -- a real ERESOLVE on OUR published peers is a real finding
  and must surface (mirrors `generator-e2e.int.spec.ts` / `nx-add-e2e` B-03 honesty). Reuse
  the existing install-e2e harness VERBATIM (`@workspace/test-util` `run`/`sh`/`buildCleanEnv`/
  `findWorkspaceRoot`; packs the shared `dist/packages/angular-typechecker` in `beforeAll`,
  removes the `.tgz` in `afterAll`). MUST run in the serialized shared-tarball e2e tier
  (`nx --parallel=1`, singleFork, `NX_DAEMON=false`) -- all e2e specs pack+rm the SAME
  tarball and race to ENOENT otherwise ([[e2e-projects-share-one-tarball-serialize]]).

### T1-T11 acceptance-matrix tier placement (SB-06)

- **D-03 (LOCKED):** Two tiers. FAST in-repo integration specs (under
  `packages/angular-typechecker/src/core/*.integration.spec.ts`) prove the BOUNDARY
  SEMANTICS (no tarball); the e2e tier proves the SHIPPED ARTIFACT (criterion 1 only).
  Phase 17 already shipped the minimum integration proof (Layout A/B, the external-template
  NG8002 kill-shot, dependency + node_modules isolation, clean Layout-B
  `suppressedInGraph == 0` with both counts). Phase 18 does NOT duplicate those; it FILLS
  ONLY the remaining T-matrix gaps in-repo -- expected gaps: T5 (`node_modules` reported
  under `includeDeps`), T6 (Layout-C story-less config guard: no silent clean pass), T9
  (workspace `paths`-alias aggregated import compiles clean -- criterion 2), T10 (host with
  NO app/lib leaf, references only `./.storybook/tsconfig.json`, fails on a story error),
  T11 (`.mdx`/`.tsx` loud notice -- exercises D-01) -- plus the packaged-tarball story proof
  (criterion 1) in the e2e project. The researcher MUST map Phase 17's actual coverage
  against T1-T11 and confirm the exact gap set before planning writes redundant tests.

### README + changelog (SB-07 criterion 4)

- **D-04 (LOCKED):** Add a dedicated **"Storybook" section to
  `packages/angular-typechecker/README.md`** (place it near "How it compares" / "Limitations")
  carrying the EXACT coverage statement: the complete Angular type-check runs on the
  TypeScript files the Storybook tsconfig DECLARES (stories, `main.ts`/`preview.ts`, a host's
  aggregated `*.component.ts`/`*.directive.ts`/`*.ts`) PROVIDED the `typecheck` target points
  at the SOLUTION `tsconfig.json`; MUST NOT claim "all Storybook files" / "complete Storybook
  coverage" / that it ensures Storybook BUILDS; MUST caveat `.mdx` (never checked), `.tsx`
  (only with `jsx`), external `templateUrl` per the shipped branch 4a, Layout C (unsupported),
  pointing at a LEAF tsconfig (excludes stories), and force-install (`--legacy-peer-deps`/
  `--force`; `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS`). Update the **Limitations**
  section (fold WR-01: the empty / zero-root-names in-project leaf case is now
  **coverage-incomplete**, not advisory-skip -- only out-of-project / duplicate / self refs
  remain advisory). Write a curated **`0.1.2` CHANGELOG.md section** (match the existing
  entries' style) with a PROMINENT green->red "false-pass -> true-fail" callout: existing
  Layout-B builds that passed by silently dropping aggregated diagnostics will now FAIL --
  this is a correctness CORRECTION, not a regression. Source the exact release claim from
  the board CONSENSUS.md (SB-07 points there for "the exact release claim").

### Release-cut boundary

- **D-05 (LOCKED):** Phase 18 authors README + CHANGELOG PROSE only. The v0.1.2 release CUT
  (`nx release`, the version bump, the tag on the merge commit, the OIDC publish) runs
  through the AGENTS.md Release-PR flow AFTER the milestone closes -- NOT in this phase. Do
  not run `nx release` during Phase 18.

### Claude's Discretion (for research + planning)
- The exact detection mechanism + `CoreResult` field name for the D-01 `.mdx`/`.tsx` notice
  (the DECISION -- loud advisory, green verdict, core-detect/executor-render -- is locked;
  the HOW is research). Confirm how the resolved `compilerOptions.jsx` is read for the
  `.tsx`-without-`jsx` condition.
- Exact fixture shapes for the committed Layout-A / Layout-B Storybook e2e fixtures and the
  precise planted-error anchor + asserted code token (follow `generator-e2e.int.spec.ts`'s
  DISTINCT-token discipline so a planted error uniquely attributes to the story leaf).
- The exact gap set of T-cases still needed after mapping Phase 17 coverage (D-03) -- and
  which live in-repo vs e2e.
- README section placement/wording and the CHANGELOG prose (content is locked by SB-07 + the
  board claim; phrasing is discretion).

### Folded Todos
- **WR-01** (`.planning/todos/.../wr-01-readme-coverage-incomplete.md`, from 17-REVIEW.md):
  the README Limitations bullet still says out-of-project / empty / solution-tsconfig refs
  are "skipped with an advisory warning and do not change the verdict." Phase 17 D-06 made
  the EMPTY / zero-root-names in-project case **coverage-incomplete** (non-clean), not an
  advisory skip. Folded into D-04 -- the rewritten coverage/Limitations section MUST state
  the coverage-incomplete behavior (incl. the zero-root-names leaf) correctly. Only
  out-of-project / duplicate / self references remain advisory.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning
or implementing.**

### Requirements, roadmap, the exact release claim (READ FIRST)
- `.planning/REQUIREMENTS.md` -- SB-06 (validation / T1-T11 matrix) + SB-07 (README + changelog
  coverage claim). Phase 18 = SB-06, SB-07. SB-08 -> Phase 19 (stretch).
- `.planning/ROADMAP.md` Section "Phase 18" -- goal + the 4 success criteria that gate this phase.
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` -- the board rationale AND
  **the exact release claim** SB-07 must reproduce (MUST / MUST-NOT / caveat wording).

### Phase-17 boundary + counter design (the behavior the e2e/tests exercise)
- `.planning/phases/17-input-set-membership-boundary-layout-support/17-CONTEXT.md` -- the
  locked D-01..D-09a decisions the boundary fix shipped (dual-identity membership, branch 4a,
  the split counter, the three-state clean/coverage-incomplete/type-error verdict).
- `.planning/phases/17-input-set-membership-boundary-layout-support/17-DECISION-input-set-boundary.md`
  -- the authoritative "hardened R1-plus" verdict/counter design (coverage-incomplete on
  zero-root-names -- the WR-01 fact D-04 must document).
- `.claude/skills/spike-findings-angular-typechecker/references/storybook-input-set-boundary.md`
  -- the build blueprint (keep-rule branches a-d, branch 4a, the split counter, the SB10
  force-install / `ERR_PNPM_IGNORED_BUILDS` constraints the e2e must handle).
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- requirements + findings index.

### Existing e2e harness to reuse VERBATIM (D-02/D-02a)
- `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts` -- the closest analog:
  pack-shared-dist -> install tarball -> `nx g configuration` -> run target -> assert planted
  errors by DISTINCT code token; B-03 no-override honesty; singleFork/serialized.
- `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts`,
  `nx-add-{npm,pnpm,yarn}.int.spec.ts` -- the `nx add` proof across package managers
  (allowBuilds / `ERR_PNPM_IGNORED_BUILDS` workarounds; see [[nx-add-fails-on-pnpm-workspaces]]).
- `e2e/angular-typechecker-install-e2e/src/global-setup.ts` + `vitest.config.mts` -- the
  shared dist build + serialized (forks/singleFork/no-parallel) harness config.
- `libs/test-util` (`@workspace/test-util`) -- `run`, `sh`, `buildCleanEnv`, `findWorkspaceRoot`,
  `removeTmpDir`, `expectSeededTypecheckTargetDefault`, `readTypecheckTargetDefault`.

### Docs to rewrite (SB-07)
- `packages/angular-typechecker/README.md` -- add the Storybook coverage section; update Limitations (fold WR-01).
- `CHANGELOG.md` (repo root) -- add the curated `0.1.2` section with the green->red callout.
- `.planning/todos/*/wr-01-readme-coverage-incomplete.md` -- the folded todo (resolves in D-04).

### Engine touch-points for the D-01 notice
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- the `.tsx`/`.ngtypecheck`
  LIMITATION doc (~lines 634-643) + where declared rootNames are known; the `CoreResult` shape.
- `packages/angular-typechecker/src/core/evaluate-result.ts` -- the three-state verdict; the
  D-01 notice must NOT flip it (green advisory).
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` -- renders loud notices
  from structured fields (where the D-01 notice is surfaced).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`e2e/angular-typechecker-install-e2e/`** -- the packaged-tarball e2e tier. Phase 18's
  Storybook tarball proof (criterion 1) is a NEW spec here reusing the harness verbatim; new
  committed fixtures land under its `fixtures/`.
- **Phase 17 integration specs** (`src/core/layout-a.integration.spec.ts`,
  `layout-b.integration.spec.ts`, `external-template.integration.spec.ts`,
  `dual-identity-tripwire.spec.ts`) -- the minimum proof already shipped; Phase 18 fills only
  the T-matrix gaps, not duplicates (D-03).
- **`skippedReferences` / `templateCheckAborted` / `suppressedInGraphFiles`** -- the
  pure-detection-in-core + loud-render-in-executor pattern the D-01 `.mdx`/`.tsx` notice follows.

### Established Patterns (constrain the implementation)
- **Core is PURE** -- eslint bans `console`/`process` under `src/core/**`; loud notices are
  structured fields rendered by the executor adapter (D-01 obeys this).
- **B-03 install honesty** -- install OUR tarball with NO peer override so a real ERESOLVE
  surfaces; force-install foreign packages (SB10) with `--legacy-peer-deps` in a SEPARATE step (D-02a).
- **Serialized shared-tarball e2e** -- all e2e specs pack+rm the same dist tarball; run
  `nx --parallel=1` / singleFork ([[e2e-projects-share-one-tarball-serialize]]).
- **DISTINCT code-token assertions** -- assert full `TSxxxx`/`NGxxxx` tokens (not bare digits)
  and use distinct codes per leaf so a planted error uniquely attributes (generator-e2e discipline).
- **Additive / non-breaking 0.x** -- the green->red flip on existing Layout-B builds is a
  true-fail CORRECTION; the D-01 notice is an additive advisory (verdict stays green).

### Integration Points
- Tarball (`npm pack` of `dist/packages/angular-typechecker`) -> tmp Storybook fixture ->
  `nx add` + `nx g configuration` + `nx typecheck` -> assert planted-error catch.
- D-01: declared-surface scan -> `CoreResult` advisory field -> executor loud render (verdict green).

</code_context>

<specifics>
## Specific Ideas

- **The Storybook e2e kill-shot:** a planted `*.stories.ts` type error (and, for Layout B, an
  aggregated external-`templateUrl` NG8002) MUST flip the SHIPPED tarball's verdict to FAIL --
  this is the whole point of proving the artifact, not just the local build.
- **Force-SB10 reality:** `@storybook/angular@10.4.6` peer-caps Angular `>=18 <22` / TS `^4.9||^5`;
  installing on the Angular 22.0.4 / TS 6.0.3 stack needs `--legacy-peer-deps`/`--force`. Its 48
  TS6 `.d.ts` errors are all `node_modules`-attributed -> suppressed by keep-rule (b) -> never
  leak in-project -> no false FAIL. This is docs-only (D4), never a runtime gate.
- **Layout B host shape:** the host solution `tsconfig.json` may reference ONLY
  `./.storybook/tsconfig.json` (no app/lib leaf -- a real shape, radix-ng), whose `include`
  reaches out via relative globs; `paths` aliases flow via `extends` (T9 / criterion 2 -- must
  compile clean, no spurious TS2307).

</specifics>

<deferred>
## Deferred Ideas

- Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard -> **Phase 19 (SB-08, stretch)**.
- Actual type-CHECKING of `.mdx` / `.tsx` (beyond Phase 18's loud "not type-checked" notice) -> **Phase 19 (SB-08, stretch)**.
- An opt-in strict mode that FAILS (not just reports coverage-incomplete) on any
  `suppressedInGraph > 0` -> **Phase 19 (SB-08, stretch)**.
- The v0.1.2 release CUT itself (nx release / tag / publish) -> AGENTS.md Release-PR flow after milestone close (D-05).

None of the above is scope creep -- all are already roadmapped to Phase 19 or the release process.

</deferred>

---

*Phase: 18-packaged-tarball-e2e-docs*
*Context gathered: 2026-07-06*
