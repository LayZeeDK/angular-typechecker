# Advisory board -- Round 1 synthesis (de-identified)

Six advisors (3 constructive lenses: correctness, ecosystem/DX, maintainability; 3 adversarial
critics: failure-modes, scope/YAGNI, consumer-trust) each reasoned independently from the neutral
fact pack (FACTS.md). No advisor saw another's position. This document de-identifies and merges
their Round-1 output: what is settled, the one contested point, the established code facts, and the
empirical gates. It is the input for Round 2. ASCII only.

## Settled consensus (unanimous or near-unanimous)

- **D1 -- layouts / commitment.** Layout A (per-project scaffold) = MINIMUM and essentially FREE:
  the walk already visits the `.storybook` leaf and keeps its (under-solution-dir) stories; work is
  a regression fixture + docs, no engine code. Layout B (centralized host) = MINIMUM and the ONLY
  layout needing engine work; it is a LIVE silent false pass today and fixing it is obligatory under
  the never-false-pass charter -- but it must NOT be shipped as "supported" until the D2 fix lands
  AND is proven. Layout C (flat, no references) = EXCLUDE from committed support (different
  architecture; low ROI), but a no-silent-pass guard is mandatory. (Confidence: HIGH across the
  board.)

- **D3 -- which files.** Check the WHOLE set the tsconfig declares (stories + `.storybook/main.ts` +
  `preview.ts`, and for a host the aggregated component/directive/source files) -- NOT a
  `*.stories.ts` filename allowlist. A story-only filter would DROP the aggregated `*.component.ts`
  diagnostics that carry NG8xxx, reintroducing a false pass; it is also more code for less coverage.
  The tsconfig's own `include` is the selector. (HIGH.)

- **D4 -- Storybook peer incompatibility (Angular 22 / TS 6).** DOCUMENTATION ONLY. No runtime
  version gate, no block, no prerelease/label change. The tool has zero dependency on Storybook; a
  gate would couple a deliberately-decoupled tool to Storybook and create false FAILs on workspaces
  that run fine via `--legacy-peer-deps`/`--force`. Document: (1) installing `@storybook/angular@10`
  into Angular 22 needs `--legacy-peer-deps`; (2) genuine type errors in `main.ts`/`preview.ts` under
  TS 6 are legitimately reported, not a tool defect. (HIGH.)

- **D5 -- validation.** The acceptance gate is the NEGATIVE test, not the clean one: a deliberately
  broken story MUST flip the verdict to FAIL, per layout. Required assertions: (A) broken story fails
  / clean passes; (B) broken AGGREGATED story OUTSIDE the host dir fails (the exact old-boundary
  false pass); node_modules diagnostics NOT reported; an imported dependency project's internal error
  NOT reported (isolation). On the OFFICIAL stack only (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3,
  `@storybook/angular@10.4.6` force-installed). Layers: a pure unit test on the boundary rule +
  in-repo integration fixtures + the existing packaged-tarball e2e (essential given prior releases
  shipped source, not dist). Build fixtures in-repo by scaffolding; OSS repos are informational only;
  the Angular-21.2.9/TS-5.9.3 compiler observation does NOT substitute for the official stack. (HIGH.)

- **D6 -- breaking change / API.** No new REQUIRED public option; the boundary fix is the DEFAULT
  (a correctness fix, not opt-in); do NOT add `includeStories`/`boundaryMode`/`storybookLayout`
  surface. The fix turns some currently-green Layout-B builds RED -- that is a false-pass -> true-fail
  correction, permitted pre-1.0, NOT a semver break -- but it MUST be a LOUD changelog callout so
  adopters do not read a correct new failure as a regression. "0.1.2 feature release, no breaking
  changes" holds (and matches this repo's 0.x mapping: `feat` -> patch, 0.1.1 -> 0.1.2). (HIGH.)

- **D7 -- Layout C.** Exclude from committed support; guarantee no silent pass. A per-project target
  with empty `references[]` already hits the synthesized `90001` guard; a direct pointer at a flat
  tsconfig checks its rootNames directly. Add ONE guard test: a Layout-C-style target that resolves
  to a config NOT covering stories must NOT report clean-with-zero-stories as a pass. Build nothing
  else. (MEDIUM-HIGH.)

- **D2 approach (agreed).** Directory containment is the wrong primitive -- it is a lossy PROXY for
  "files this run was asked to check." The authoritative set is the compiler's own declared inputs.
  Replace/augment path-containment with INPUT-SET MEMBERSHIP, keep the `node_modules` segment
  exclusion first, keep file-less-always and fail-safe-keep-on-canonicalization-failure. Do NOT fail
  the verdict on a nonzero suppressed count (node_modules suppression is constant); instead the
  correctness guarantee comes from the boundary DEFINITION, and the suppressed count must be surfaced
  loudly in executor output (it is currently silent). `includeDeps: true` is NOT the Layout-B fix --
  it re-admits all node_modules diagnostics (noise, and under forced SB10/TS6 those .d.ts can
  themselves error -> false FAIL).

## The one CONTESTED point: the exact D2 predicate (external templates)

Two competing formulations of "input-set membership" emerged. They agree on everything above; they
differ on whether the simplest formulation is SOUND.

- **Predicate P1 (from the constructive lenses):** keep a diagnostic iff its canonical file is
  (under the solution/host basePath) OR (a member of the union of walked leaves' `rootNames`), minus
  node_modules. Strictly additive over today's rule (no regression to Layout A), reuses data the walk
  already computes (it must now collect the rootName PATHS, not just the count). Argued to satisfy
  isolation by construction (a merely-imported dependency file is not a declared rootName -> stays
  suppressed).

- **Objection + Predicate P2 (from the adversarial failure-mode lens) -- the kill shot:** P1 STILL
  produces a false pass for EXTERNAL COMPONENT TEMPLATES. An Angular template diagnostic (NG8xxx or
  template TS) for a component using `templateUrl: './x.component.html'` is attributed by the compiler
  to the `.html` FILE. That `.html` is (a) NOT a rootName (rootNames are `.ts` only) and (b) in
  Layout B lives outside the host solution dir -> P1 DROPS it. Demanded fix: attribute a template
  diagnostic to its OWNING COMPONENT (which IS a rootName) -- via the diagnostic's component
  reference -- and keep it based on the component's in-project status; OR base membership on each
  walked leaf Program's actual input source set rather than a rootName/path test. Demanded proof:
  a Layout-B fixture with an aggregated component whose EXTERNAL `.html` template contains a real
  NG8002 must FAIL, with the `.html` codeframe in stdout.

## Established code facts (verified from source this session; treat as given)

- CF1. The reference walk currently returns only a rootNames COUNT (integer), not the rootName file
  paths; the boundary filter runs ONCE, globally, over the unioned diagnostics against the SOLUTION
  tsconfig's directory (not per-leaf). Implementing input-set membership requires the walk to surface
  the actual input file set (paths) to the filter.
- CF2. The executor renders ONLY the kept diagnostics to stdout; `suppressedCount` and
  `rootNamesCount` are on the internal result but are NOT printed to the consumer -- so today's
  boundary suppression is 100% silent. There is existing precedent for loud `logger.warn` advisories
  (skipped-reference, template-abort) to hook a suppression/coverage notice onto.
- CF3. A walk that compiles ZERO in-project leaves already synthesizes a `90001` guard (not a silent
  pass). The specific silent-pass gap is "compiled >0 files but all their diagnostics were
  boundary-suppressed" (Layout B today).
- CF4. `program.getSourceFiles()` returns the whole Program's TS source files -- which INCLUDES
  transitively imported dependency sources, not just declared inputs. So "keep everything in
  getSourceFiles()" would be TOO BROAD (breaks per-project isolation, D2c). rootNames is the declared
  input set; the correct set for isolation is "declared inputs (+ their owned external templates),"
  not "all Program source files."
- CF5. External template `.html` files are resources, not TS source files, so they are neither
  rootNames nor (typically) TS `SourceFile`s -- reinforcing that a template diagnostic must be mapped
  to its owning component to be classified in-project.

## Empirical gates (flagged by all six as position-changing; resolvable ONLY by a spike on the official stack)

- G1. Does Angular 22.0.4 attribute an EXTERNAL-template diagnostic to the `.html` file or to the
  component `.ts`? If `.ts`, the kill shot collapses and P1 suffices; if `.html`, P2's
  component-mapping is required. (This selects the D2 predicate.)
- G2. Do the widened cross-project files in a Layout-B `.storybook/tsconfig.json` actually materialize
  as `parsed.rootNames` (declared inputs), vs being pulled in only as imports?
- G3. Does force-installed `@storybook/angular@10.4.6` COMPILE cleanly under Angular 22.0.4 / TS 6.0.3
  via `performCompilation` (no infra failure), a CLEAN story passes clean (no spurious
  Storybook-type errors leaking in-project via `main.ts`/`preview.ts` or story imports)?
- G4. Do NG8xxx extended diagnostics actually FIRE on stories/aggregated components on this stack?
- G5. Can the walk cheaply RETAIN each leaf Program's input set (or a component->template map) at
  filter time, given each leaf Program is currently created and discarded during the walk?

## Adversarial edge-case test matrix (from the failure-mode lens; each needs a test or an explicit documented gap)

- External-template `.html` NG8xxx in Layout B (the kill shot) -> must FAIL; `.html` in stdout.
- `.mdx` stories: not TS, never rootNames -> silently unchecked. At minimum document loudly; test a
  broken `.stories.mdx` to prove the current behavior.
- `.tsx` stories: only compiled if `jsx` configured -> may be silently excluded. Test / document.
- Mixed A+B layouts in one workspace: same story/component reachable from two leaves -> duplicate
  (dedup should absorb -- verify) or missed coverage. Test both targets; each error reported once,
  none dropped.
- pnpm/junction symlinks + case-insensitive FS: canonicalizer realpaths first; a story reached via a
  junction may realpath OUTSIDE the solution dir -> false suppression. Test a symlinked-source story
  error still fails.
- tsconfig `paths` aliases: host `.storybook/tsconfig.json` may not inherit workspace `paths` ->
  aggregated cross-project imports -> TS2307 false FAIL. Test an aliased-import aggregated story
  compiles CLEAN.
- Centralized host with NO app/lib leaf (references only `./.storybook/tsconfig.json`): confirm the
  walk visits the single leaf and does not treat it as empty-project 90001. Test a story error there
  fails.

## Cross-cutting notes to carry into the milestone

- DX: the target stores `tsConfig: <solution>` and reads `references[]` at EXECUTE time, so a consumer
  who adds Storybook AFTER wiring `typecheck` gets story coverage on the next run with NO
  re-generation. Genuine selling point; document it.
- Pointing the target at a LEAF (app/lib) tsconfig instead of the solution config means stories are
  excluded (the generator adds `*.stories.*` to the leaf `exclude`) -> silently unchecked. Story
  coverage REQUIRES pointing at the solution config; document, and the generator already does this.
- Redundant host/component coverage (host + owning project both check an aggregated file) is
  redundant, not incorrect -- do NOT add suppression for it (suppression risks dropping real errors);
  a docs note suffices.
- Direction question (out of scope for 0.1.2, decide the direction): should the direct single-leaf
  path also migrate to input-set membership, to avoid two divergent boundary semantics later?

## Round 2 question (for all six)

1. Ratify or amend the settled consensus above.
2. Converge on the D2 predicate given the external-template kill shot: specify the PRECISE keep rule
   as a decision tree gated on G1 (if external-template diagnostics attribute to the component `.ts`
   -> which predicate; if they attribute to the `.html` -> which predicate), such that Layout B is
   sound for BOTH inline and external templates while preserving isolation (no node_modules, no
   imported-dependency internals). State it testably.
3. Lock the P16 spike's exact PASS/FAIL gates (from G1-G5) that must be green before Layout B may be
   claimed "supported," and the minimal test matrix that constitutes shippable proof.
