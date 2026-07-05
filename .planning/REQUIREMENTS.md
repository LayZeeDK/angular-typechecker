# Requirements: v0.1.2 -- Storybook story type-checking

**Milestone:** v0.1.2 (feature release; `feat` under 0.x -> patch bump `0.1.1 -> 0.1.2`; no breaking
changes unless a need surfaces).

**Goal:** `angular-typechecker`'s `typecheck` targets type-check Angular Storybook component stories
(`*.stories.ts`) -- and the whole `.storybook/` tsconfig-declared surface -- for the two Nx-official
layouts (per-project scaffold and centralized host), proven end-to-end against the shipped tarball on
the supported stack, without ever silently passing a dropped diagnostic.

**Core value tie-in:** deliver the complete Angular type-check (TS + template + NG8xxx) for stories
too, decoupled from the (coupled, and today Angular-22-incompatible) Storybook build -- the "run the
type-check elsewhere" step, now covering the Storybook surface.

## Framing (from the advisory board -- see `research/v0.1.2-storybook/board/CONSENSUS.md`)

This is fundamentally ONE boundary-filter correctness fix -- replace the diagnostic filter's
directory-containment proxy with **compiler input-set membership** -- whose motivating case is the
centralized Storybook host (a live silent false pass today). No Storybook-specific machinery (no
version gate, no `*.stories.ts` selector, no new public option). Governing charter: **never a silent
false pass**; over-report (false FAIL) is the acceptable degradation direction, under-report (false
PASS) is not.

Two layouts, both Nx-official:
- **Layout A -- per-project default scaffold** (`nx g @nx/angular:storybook-configuration`): stories in
  the project's own `src/`; `.storybook/tsconfig.json` in the project's `references[]`. Already covered
  by the existing walk; needs a regression fixture, not engine code.
- **Layout B -- centralized host** (Nx recipe "one main Storybook instance for all projects"): one host
  aggregates stories/components from other projects via a widened `.storybook/tsconfig.json` `include`
  that reaches OUTSIDE the host dir. The diagnostic boundary filter drops those out-of-dir diagnostics
  today -> silent false pass. Fixing it is the milestone's engine work.

## v0.1.2 Requirements

### Engine -- input-set-membership boundary (the version-bumping `feat`)

- [ ] **SB-02**: Replace the walk's directory-containment diagnostic filter with a pure
  `keep(diagnostic, inputSet, options) -> boolean` keyed on **compiler input-set membership**, and
  route BOTH the walk and the direct single-leaf path through it (one boundary semantics). The walk
  surfaces each walked leaf's rootName PATHS (it already holds `result.program`; today it discards
  everything but the count). Keep-rule (per diagnostic, canonical file `F`): (a) file-less /
  unresolvable -> keep; (b) `node_modules` segment -> suppress (unless `includeDeps`); (c) `F` in the
  union of walked leaves' rootNames OR under the solution/host base dir -> keep; (d) external-template
  resource -> per the G1-gated branch (SB-05). `inputSet` and diagnostic files MUST be canonicalized
  with the SAME canonicalizer (realpath -> slash -> case-fold). Additive: no Layout-A regression; the
  boundary filter references ZERO ngtsc/component-registry internals (structural `git grep` gate).

- [ ] **SB-04**: Split the currently-silent suppressed count into `suppressedThirdParty`
  (`node_modules`, expected/quiet) and `suppressedInGraph` (a compiled first-party source was dropped).
  Surface BOTH in executor stdout AND the structured result (CI gates on exit code; agents on the
  structured verdict). `suppressedInGraph > 0` yields a distinct non-clean **coverage-incomplete**
  outcome (the charter floor: a real dropped diagnostic must never coexist with a green verdict),
  guarded by canonicalization symmetry so it cannot spuriously fire on a correctly-classified layout
  (where `suppressedInGraph == 0` by construction).

### Layout support (minimums)

- [ ] **SB-01**: `nx typecheck` type-checks `*.stories.ts` under the per-project default scaffold
  (Layout A), for both application and library projects, with zero consumer tsconfig edits -- real
  story type errors AND Angular template/extended (NG8xxx) diagnostics surface; a clean story passes.
  (Covered by the existing walk; delivered as a regression fixture + docs.)

- [ ] **SB-03**: `nx typecheck` type-checks the aggregated cross-project stories/components of a
  centralized Storybook host (Layout B, the Nx `one-storybook-for-all` recipe) via SB-02 -- a broken
  aggregated story (including one using an external `templateUrl` template) FAILS the verdict; a clean
  host passes; an imported dependency project's own internal error is NOT reported (isolation);
  `node_modules` diagnostics are NOT reported. Gated on the SB-05 spike.

### Gate spike, validation, docs

- [ ] **SB-05**: A gating spike (Phase 16) on the OFFICIAL stack (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3,
  `@storybook/angular@10.4.6` force-installed) resolves the hard GO/NO-GO gates before Layout B may be
  claimed supported: **G2** widened files materialize as the storybook leaf's `parsed.rootNames`;
  **G3** forced SB10 compiles via `performCompilation` with no infra failure AND a clean story passes
  clean (no spurious Storybook-type errors leaking in-project); **G4** NG8xxx fire on
  stories/aggregated components (proven POSITIVELY -- a fixture goes RED); **G1** selects the SB-02(d)
  external-template branch (attribution to component `.ts` vs `.html`); **G5** selects an
  owning-component->template map (only from a STABLE public signal) vs the keep-all-external-template
  fallback. If G2/G3/G4 fail, Layout A still ships and Layout B is documented "not yet supported
  (blocked upstream by the `@storybook/angular` peer range)" with the SB-04 guard fail-safing.

- [ ] **SB-06**: Validate with negative tests as the acceptance gate (a broken input flips the verdict
  to FAIL), per layout, on the official stack: a pure unit test on the keep-rule (synthetic
  diagnostics + input set); in-repo integration fixtures built with the REAL Nx generators (Layout A
  via `nx g @nx/angular:storybook-configuration`; Layout B via the generator + the documented recipe
  hand-edit) wired via `nx g angular-typechecker:configuration`; and the existing packaged-tarball e2e
  extended to `nx add` + `nx g configuration` + `nx typecheck`. Minimal matrix: T1 Layout-A broken/clean;
  T2 Layout-B out-of-dir story broken/clean; T3 external-template NG8002 fails with the `.html`/component
  codeframe; T4 dependency isolation; T5 `node_modules` suppressed (reported under `includeDeps`); T6
  Layout-C story-less config guards (no silent clean pass); T7 clean Layout-B `suppressedInGraph == 0` +
  both counts surfaced; T8 symlink/junction story error still fails; T9 workspace `paths`-alias
  aggregated import compiles clean; T10 host with NO app/lib leaf (references only
  `./.storybook/tsconfig.json`) fails on a story error; T11 `.mdx` present -> loud "not type-checked"
  notice (verdict may stay green), `.tsx` without `jsx` -> same.

- [ ] **SB-07**: README + changelog document the exact coverage claim and caveats: the complete Angular
  type-check runs on the TypeScript files the Storybook tsconfig declares (stories, `main.ts`/`preview.ts`,
  and a host's aggregated `*.component.ts`/`*.directive.ts`/`*.ts`) PROVIDED the `typecheck` target
  points at the solution `tsconfig.json`; MUST NOT claim "all Storybook files" / "complete Storybook
  coverage" / that it ensures Storybook builds; MUST caveat `.mdx` (never checked), `.tsx` (only with
  `jsx`), external `templateUrl` per the shipped G1 branch, Layout C (unsupported), pointing at a leaf
  tsconfig (excludes stories), and that support is verified against the FORCE-INSTALLED Storybook
  (`--legacy-peer-deps`/`--force`; `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS`). The green->red flip
  on existing Layout-B builds is a loud changelog callout (a false-pass -> true-fail correction, not a
  regression).

## Future Requirements (deferred, not abandoned)

- **SB-08 (stretch)**: Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard;
  `.mdx`/`.tsx` story type-checking beyond the loud "not type-checked" notice; an opt-in strict mode
  that FAILS (not just reports coverage-incomplete) on any `suppressedInGraph > 0`.
- Migrate the direct single-leaf path's user-visible behavior onto the shared `keep()` boundary (the
  shared function ships in SB-02; broadening its behavioral role is deferred).

## Out of Scope (this milestone)

- Storybook build/serve execution, or ensuring Storybook itself runs (this tool is type-check only).
- A runtime `@storybook/angular` version gate or any coupling to Storybook packages (D4).
- `ng add` (Angular CLI) / Angular CLI `angular.json` Storybook support.
- Machine-readable reporters (JSON/SARIF), `NgtscProgram` incremental, `createNodesV2` inference
  (carried from prior milestones' Out of Scope).

## Traceability

(Filled by the roadmap -- each SB-* mapped to exactly one phase; see ROADMAP.md.)

| Requirement | Phase |
|-------------|-------|
| SB-05 (gate spike) | 16 |
| SB-02, SB-04 (engine) | 17 |
| SB-01, SB-03 (layout support) | 17 |
| SB-06 (validation) | 18 |
| SB-07 (docs) | 18 |
| SB-08 (stretch) | 19 (deferrable) |

Full board rationale, decision tree, spike gate detail, and the exact release claim:
`research/v0.1.2-storybook/board/CONSENSUS.md`.
