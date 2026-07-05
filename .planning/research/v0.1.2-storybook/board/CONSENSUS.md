# Advisory board -- CONSENSUS (2 rounds, 6 lenses)

Board: 3 constructive (correctness, ecosystem/DX, maintainability) + 3 adversarial (failure-modes,
scope/YAGNI, consumer-trust). Round 1 = independent positions from a neutral fact pack; Round 2 =
convergence on the de-identified synthesis. Outcome below is unanimous except the one residual noted
in D2. This is the hardened decision set for milestone v0.1.2. ASCII only.

## Framing (agreed)

This is NOT a "Storybook feature" milestone. It is **one boundary-filter correctness fix** --
replace the diagnostic filter's directory-containment proxy with **compiler input-set membership** --
whose motivating case is the centralized Storybook host. Refuse all Storybook-specific machinery
(no version gates, no `*.stories.ts` selectors, no `boundaryMode`/`includeStories` API). Charter
that governs every call: **never a silent false pass** (a real diagnostic on a checked file dropped
while the verdict/exit reads clean). Over-reporting (false FAIL) is the acceptable degradation
direction; under-reporting (false PASS) is not.

## D1 -- Layouts and commitment (HIGH)

- **Layout A (per-project default scaffold): MINIMUM, essentially free.** The Nx generator injects
  `.storybook/tsconfig.json` into the project's `references[]`; our `configuration` generator already
  points the target at the solution tsconfig; the walk visits the leaf and (stories under the
  solution dir) keeps them today. Work = a regression fixture + docs; no engine code.
- **Layout B (centralized host, the official Nx recipe "one main Storybook instance for all
  projects"): MINIMUM, and the only engine work.** It is a LIVE silent false pass today and it is the
  official Nx recipe, so fixing it is both charter- and ecosystem-credibility-mandatory. It must NOT
  be claimed "supported" until the D2 fix lands AND the P16 spike gates pass.
- **Layout C (flat, no `references[]`): EXCLUDE from committed support; a no-silent-pass guard is
  mandatory.** Different architecture, low ROI; the split-counter (D2) covers it uniformly.

## D2 -- Boundary behavior (the core decision)

Replace directory-containment with **input-set membership**. Two shared implementation facts:
`PerformCompilationResult.program` is already held by the walk (surfacing rootName PATHS + the `.ts`
input set is free); the vendored `Program` interface exposes no template->component registry (so
external-template ownership mapping requires widening that drift-guarded surface -- a real cost that
G5 decides).

### The keep-rule as a per-diagnostic decision tree (G1-gated)

Let `inputTs` = canonical union of all WALKED leaves' rootName `.ts` paths (built with the SAME
canonicalizer as the filter -- realpath -> slash -> case-fold; non-negotiable, see T8). `base` =
solution/host tsconfig dir. Per diagnostic `d` with canonical file `F`:

- (a) `d` file-less OR `F` unresolvable (realpath threw) -> **KEEP** (existing fail-safe).
- (b) `F` has a `node_modules` path segment -> **SUPPRESS** (unless `includeDeps`).
- (c) `F` in `inputTs` OR `F` under `base` -> **KEEP**. Covers `.ts` inputs AND inline templates
  (which attribute to the component `.ts`, a rootName). No Layout-A regression (A stories are both
  rootNames and under base). Isolation holds (a transitively-imported dependency `.ts` is not a
  rootName -> suppressed).
- (d) `F` is a non-`.ts` external-template resource -> branch on the spike result G1:
  - **G1 = external-template diagnostics attribute to the component `.ts`:** step (c) already keeps
    them; no ownership map needed. Ship (a)-(c) only. Add a tripwire assertion that a `.html`-
    attributed diagnostic never appears (so a future Angular attribution flip is caught, not silently
    dropped). Confidence HIGH.
  - **G1 = external-template diagnostics attribute to the `.html`:**
    - 4a. If an owning-component->template map is cheaply + STABLY buildable (G5 PASS): KEEP iff `F`
      is an external template OWNED by a rootName component, else suppress. Exact + isolation-correct.
      Soundness HIGH; feasibility MEDIUM (needs a stable public ownership signal, e.g.
      `relatedInformation` back to the component `.ts` -- NOT ngtsc internals; if only internals
      exist, treat as G5 FAIL).
    - 4b. Fallback (G5 FAIL): KEEP every non-`node_modules` external-template diagnostic. Never a
      false pass; cost is possibly reporting an imported dependency's template error (a false FAIL,
      the SAFE direction). Document the isolation gap loudly. Soundness HIGH.

Property guaranteed in EVERY branch: no real error on a checked file is dropped. Only external-
template isolation fidelity varies (degrades to over-report, never under-report).

Rejected: pure directory-containment (the current bug); pure rootNames-only replacement (drops
external `.html` -> false pass, the "kill shot"); `includeDeps: true` as the Layout-B answer
(re-admits `node_modules` noise, and forced SB10/TS6 `.d.ts` can themselves error -> false FAIL);
`program.getSourceFiles()` membership (includes transitive imports -> breaks isolation); ngtsc-
internal component registries (brittle across Angular patches -> silent break -> false pass).

### The split-counter tripwire (the charter floor; unifies the whole board)

Split the currently-silent `suppressedCount` (it is 100% silent today -- the executor renders only
kept diagnostics) into:
- `suppressedThirdParty` = `node_modules` suppressions (expected, ~constant, INFO).
- `suppressedInGraph` = suppressions of a compiled source that is NEITHER `node_modules` NOR
  file-less.

A correctly-classified supported layout (A, or B under the tree) has **`suppressedInGraph == 0` by
construction**. Both counts are surfaced LOUDLY in executor output AND in the STRUCTURED result (CI
gates on exit code; agents gate on the structured verdict -- a log line beside `success:true` is
functionally silent to both).

Residual split (the ONE non-unanimous point): whether `suppressedInGraph > 0` must be
**verdict-affecting** in 0.1.2.
- Trust/scope/failure-modes lens: a green verdict while a non-`node_modules` diagnostic was
  suppressed IS the false pass; the guard must make the run non-clean (charter defense-in-depth).
- Correctness/maintainability lens: for 0.1.2 the tree guarantees `== 0` for supported layouts, so
  surface + assert `== 0` in tests (T7); reserve fail-on-`suppressedInGraph` for a future opt-in
  strict mode, to avoid a spurious false FAIL from a counter edge case.
- EXECUTOR RECOMMENDATION (to ratify at plan time): ship the split counters + loud surface + the
  T7 `== 0` test now; make `suppressedInGraph > 0` yield a distinct **non-clean "coverage-incomplete"
  outcome** (charter floor) guarded by the canonicalization-symmetry requirement (T8) so it cannot
  spuriously fire on supported layouts. This satisfies the trust invariant while honoring the
  correctness caution.

## D3 -- Which files to check (HIGH; REQUIRED, not preference)

Check the WHOLE set the tsconfig declares (stories + `.storybook/main.ts` + `preview.ts` + a host's
aggregated `*.component.ts`/`*.directive.ts`/`*.ts`), NEVER a `*.stories.ts` filename allowlist -- an
allowlist drops the aggregated `.component.ts` files that carry NG8xxx = a false pass, and rots on
`.stories.tsx`/`.mdx`/helpers. The tsconfig `include` is the selector; this falls out of D2 (in-project
= input-set membership) with no separate logic.

## D4 -- Storybook peer incompatibility (Angular 22 / TS 6) (HIGH)

Documentation ONLY. No runtime version gate, no block, no prerelease/label change (the tool has zero
Storybook dependency; a gate would false-FAIL workspaces that legitimately run via `--legacy-peer-deps`
/`--force`). Forced-SB10 `.d.ts` errors are `node_modules`-attributed and already suppressed, so
docs-only cannot cause a false FAIL there (contingent on G3). Docs MUST cover: (1) `@storybook/angular@10`
on Angular 22 needs `--legacy-peer-deps`/`--force`; (2) `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS`
(this repo's known gotcha); (3) genuine TS6 errors in `main.ts`/`preview.ts` are real, not tool defects.

## D5 -- Validation (HIGH)

The acceptance gate is the NEGATIVE test (a deliberately broken input flips the verdict to FAIL), per
layout, on the OFFICIAL stack only (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, `@storybook/angular@10.4.6`
force-installed). Layers: (1) a PURE unit test on the keep-rule with synthetic diagnostics + synthetic
input set (stack-independent, cannot rot); (2) in-repo integration fixtures built with the REAL Nx
generators (Layout A via `nx g @nx/angular:storybook-configuration` app+lib; Layout B via the generator
+ the documented recipe hand-edit that widens the glob/include) wired via our
`nx g angular-typechecker:configuration`; (3) the existing packaged-tarball e2e extended to
`nx add` + `nx g configuration` + `nx typecheck` (NON-NEGOTIABLE -- 0.0.1-0.1.0 shipped `.ts` source
and the local build test would not have caught it). OSS repos are informational only; the Angular
21.2.9/TS 5.9.3 compiler observation does NOT substitute for the official stack. **G4 must be proven
POSITIVELY** (an NG8xxx fixture must go RED) or the "complete type-check incl. NG8xxx" claim is false
on green.

## D6 -- Breaking change / API surface (HIGH)

No new REQUIRED public option; the boundary fix is the DEFAULT (behind a flag would leave the false
pass as out-of-box behavior). Do NOT add `boundaryMode`/`includeStories`/`storybookLayout`. The fix
turns some currently-green Layout-B builds RED -- a false-pass -> true-fail CORRECTION, permitted
pre-1.0, NOT a semver break -- but it MUST be a LOUD changelog callout so adopters read the new RED as
a fix, not a regression. "0.1.2 feature release (`feat` -> patch, 0.1.1 -> 0.1.2), no breaking
changes" holds. Additive new signalling only: rootName-path surfacing, the split counters, the
coverage field on the structured result.

## D7 -- Flat Layout C (MEDIUM-HIGH)

Exclude from committed support; guarantee no silent pass. A per-project target with empty
`references[]` already hits the `90001` guard; a direct pointer at a flat tsconfig checks its rootNames
directly; and the split-counter (D2) makes any non-third-party suppression auditable/verdict-visible.
Add ONE guard test (a story-less/empty config does NOT report clean-with-zero-stories as a pass).
Build nothing else.

## P16 spike -- HARD GO/NO-GO gates (before Layout B may be claimed "supported")

- **G1 (branch selector):** build a Layout-B fixture with an aggregated component whose EXTERNAL
  `templateUrl` `.html` carries a real NG8002; inspect the raw `diagnostic.file.fileName` for
  MULTIPLE categories (core template TS error AND an NG8xxx). Records `.ts` or `.html` (or mixed) ->
  selects the D2(d) branch. Must be unambiguously resolved.
- **G2 (HARD prerequisite):** the widened cross-project files materialize as the `.storybook` leaf's
  `parsed.rootNames` (declared inputs), not merely imports. If NO -> `inputTs` membership can't keep
  them and the whole primitive must be redesigned -> Layout B NOT supportable via this design.
- **G3 (HARD):** forced `@storybook/angular@10.4.6` compiles via `performCompilation` with NO infra
  failure, AND a CLEAN story passes clean (no spurious Storybook-type errors leaking in-project via
  `main.ts`/`preview.ts`/story imports).
- **G4 (HARD, proven POSITIVELY):** NG8xxx extended diagnostics actually FIRE on stories/aggregated
  components on this stack (an NG8xxx fixture goes RED).
- **G5 (selects 4a vs 4b):** can an owning-component->external-template map be built cheaply from a
  STABLE public signal (e.g. `relatedInformation`), without ngtsc internals? PASS -> ship 4a; FAIL ->
  ship 4b fallback + documented isolation gap. Both are shippable.
- Supporting checks (from the failure-modes lens): G6 shared external template carries correct
  per-usage ownership; G7 canonicalization/junction consistency; G8 unmappable-resource fail-safe
  keep; G9 loud split-counter surfacing.
- If G2/G3/G4 FAIL: do NOT sink the milestone. Ship 0.1.2 = Layout A supported + Layout B documented
  "not yet supported (blocked upstream by the `@storybook/angular` peer range)" + the split-counter so
  Layout B fail-safes (coverage-incomplete) instead of false-passing.

## Minimal shippable test matrix (negatives are the gate; official stack; in-repo scaffolded + tarball e2e)

- T1 Layout A: broken `.stories.ts` FAILS; clean PASSES (regression).
- T2 Layout B: broken aggregated story `.ts` OUTSIDE host dir FAILS; clean PASSES (the old false pass).
- T3 Layout B external template (KILL SHOT): aggregated component external `templateUrl` `.html` NG8002
  -> FAILS, `.html`/component codeframe in stdout.
- T4 Isolation: an imported dependency project's internal `.ts` error NOT reported; (4a) a dep's
  external-template error (owned by a non-rootName component) NOT reported.
- T5 `node_modules` diagnostic NOT reported by default; reported under `includeDeps`.
- T6 Layout C / story-less config -> guard, NOT a silent clean pass.
- T7 Split-counter: clean Layout-B reports `suppressedInGraph == 0`; both counts surfaced in stdout AND
  the structured result.
- T8 Symlink/junction: a story reached via a junction (realpath OUTSIDE host dir) with an error still
  FAILS (requires `inputTs` + diagnostic files canonicalized identically).
- T9 `paths`-alias (DX landmine): an aggregated story importing a sibling via a workspace `@org/*`
  alias compiles CLEAN (no TS2307) -- proves the host `.storybook/tsconfig.json` inherits
  `tsconfig.base.json` `paths` (or documents the required consumer step).
- T10 Host with NO app/lib leaf (references only `./.storybook/tsconfig.json`): walk visits the single
  leaf; a story error there FAILS (not empty-project 90001).
- T11 `.mdx` present: stays green BUT a loud "N .mdx not type-checked" notice fires (Tier-2 scope
  limit, no dropped diagnostic). `.tsx` without `jsx`: same treatment.

## Release coverage claim (exact; from the trust lens)

MUST claim: "v0.1.2 runs the complete Angular type-check (TypeScript + template type-check + NG8xxx,
no emit) on the TypeScript files the Storybook tsconfig declares -- your `*.stories.ts`,
`.storybook/main.ts`/`preview.ts`, and (centralized host) the aggregated `*.component.ts`/`*.directive.ts`/`*.ts`
its `include` reaches -- provided the `typecheck` target points at the project's SOLUTION `tsconfig.json`.
A green verdict means every such file type-checked clean."
MUST NOT claim: "all Storybook files" / "complete Storybook coverage" unqualified; that it ensures
Storybook builds/runs; support for any layout not proven on the official stack.
MUST caveat: `.mdx` never type-checked; `.tsx` only if `jsx` enabled; external `templateUrl` per the
G1 branch shipped; Layout C not a supported Storybook layout; pointing at a leaf app/lib tsconfig
excludes stories (point at the solution config); "supported" is verified against the FORCE-INSTALLED
Storybook combination.

## Cross-cutting notes for the milestone

- DX selling point: the target stores `tsConfig: <solution>` and reads `references[]` at EXECUTE time,
  so adding Storybook AFTER wiring `typecheck` yields coverage on the next run with NO re-generation.
- Implement the boundary as a PURE `keep(diagnostic, inputSet, options) -> boolean`; route BOTH the
  walk and the direct single-leaf path through it (one boundary semantics; avoids future drift).
- Structural durability gate: `git grep` proves the boundary filter references ZERO ngtsc/component-
  registry internals (enforces the no-brittle-internals rule).
- Redundant host/component coverage (host + owning project both check an aggregated file) is redundant,
  not incorrect -- do NOT suppress it (suppression risks dropping real errors); a docs note suffices;
  confirm `sortAndDeduplicateDiagnostics` collapses exact duplicates.
