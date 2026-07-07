# Storybook input-set-membership boundary (v0.1.2, Phase 16 gate -> Phase 17 build)

Implementation blueprint for the v0.1.2 milestone: type-checking Angular Storybook stories by
replacing the diagnostic filter's directory-containment proxy with **compiler input-set
membership**. GATE RESULT: **GO** -- Layout B is supportable on the official stack. Synthesized
from spikes 006/007/008 (all VALIDATED) on Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3,
`@storybook/angular@10.4.6` force-installed. Board rationale:
`.planning/research/v0.1.2-storybook/board/CONSENSUS.md`.

## Requirements (non-negotiable)

- **Charter: never a silent false pass.** A real diagnostic on a checked file dropped while the
  verdict/exit reads clean is the one unacceptable failure. Over-report (false FAIL) is the safe
  degradation direction; under-report (false PASS) is not.
- **No Storybook-specific machinery** (D6): no version gate, no `*.stories.ts` selector, no
  `boundaryMode`/`includeStories`/`storybookLayout` option. The fix is ONE boundary-filter
  correctness change, the DEFAULT (not behind a flag).
- **Pure `keep(diagnostic, inputSet, options) -> boolean`** routed by BOTH the walk and the direct
  single-leaf path (one boundary semantics; avoids drift). The boundary filter references **ZERO
  ngtsc/component-registry internals** (structural `git grep` gate).
- **Check the WHOLE set the tsconfig declares** (D3), never a filename allowlist -- the tsconfig
  `include` is the selector.
- Canonicalize `inputSet` AND diagnostic files with the SAME canonicalizer (realpath -> slash ->
  case-fold), or symlink/junction cases break (T8).

## How to Build It

### 1. Surface each walked leaf's rootName PATHS (the input set)

The walk already holds `result.program`; today it discards everything but the count. Surface the
rootName paths to build `inputTs` = canonical union of all walked leaves' declared rootName `.ts`
paths.

- **Key `inputTs` on the DECLARED set = `readConfiguration(leaf).rootNames`** (spike 006, G2 = YES:
  a Layout-B host's widened cross-project `include` globs materialize the aggregated
  `*.stories.ts`/`*.component.ts` as `parsed.rootNames`).
- **LANDMINE (spike 006):** `program.getTsProgram().getRootFileNames()` is a SUPERSET -- it adds one
  synthetic `<root>.ngtypecheck.ts` shim per declared root (in-memory, not on disk). If you read
  rootNames off `result.program` instead of `readConfiguration`, STRIP/ignore `.ngtypecheck.ts`
  shims and never treat a shim path as a real first-party source (it would corrupt
  `suppressedInGraph`). Preferred: use the declared `readConfiguration().rootNames`.

### 2. The keep-rule (per diagnostic `d`, canonical file `F`; `base` = solution/host tsconfig dir)

- (a) `d` file-less OR `F` unresolvable (realpath threw) -> **KEEP** (existing fail-safe).
- (b) `F` has a `node_modules` path segment -> **SUPPRESS** (unless `includeDeps`).
- (c) `F` in `inputTs` OR `F` under `base` -> **KEEP**. Covers `.ts` inputs and inline templates
  (which attribute to the component `.ts`, a rootName). Layout-A stories are both rootNames and
  under base; a transitively-imported dependency `.ts` is neither -> suppressed (isolation).
- (d) `F` is a non-`.ts` external-template resource -> **branch 4a (SELECTED by spike 008):**
  - Spike 008: G1 = **html** (external `templateUrl` diagnostics -- NG8002 core AND NG8102
    extended -- attribute to the `.html`, NOT the component `.ts`).
  - G5 = **PASS**: the `.html` diagnostic carries `ts.Diagnostic.relatedInformation` pointing to
    the owning component `.ts` with message "Error/Warning occurs in the template of component X"
    -- a STABLE PUBLIC signal (no ngtsc internals).
  - **Rule 4a:** read the `.html` diagnostic's `relatedInformation`; resolve the owning component
    `.ts`; **KEEP iff that `.ts` is in `inputTs`** (in-graph component), else SUPPRESS (a
    dependency's external-template error -> isolation). Exact + isolation-correct.
  - **Fail-safe (board G8):** if an `.html` diagnostic has NO `.ts` `relatedInformation`
    (unmappable; not observed in the spike) -> **KEEP** (over-report safe, never a false pass).

Property guaranteed in every branch: no real error on a checked file is dropped.

### 3. Split the suppressed counter (SB-04, the charter floor)

Split the currently-silent `suppressedCount` into:

- `suppressedThirdParty` = `node_modules` suppressions (expected, INFO).
- `suppressedInGraph` = a compiled first-party source dropped (NEITHER `node_modules` NOR file-less).

A correctly-classified supported layout has `suppressedInGraph == 0` BY CONSTRUCTION. Surface BOTH
counts LOUDLY in executor stdout AND the STRUCTURED result. `suppressedInGraph > 0` yields a
distinct non-clean **coverage-incomplete** outcome (executor recommendation, ratify at plan time),
guarded by canonicalization symmetry (T8) so it cannot spuriously fire on a supported layout.

### 4. Tripwire (inverse of the old 4a-.ts case)

Since G1 = html, assert that external-template diagnostics DO carry a `.ts` `relatedInformation`, so
a future Angular attribution flip (to `.ts`, or dropping relatedInformation) is caught LOUD, not
silently dropping diagnostics.

## What to Avoid

- **Pure directory-containment** (the current bug -> the Layout-B silent false pass).
- **rootNames-only replacement** -- drops external `.html` diagnostics -> false pass (the kill shot).
- **`includeDeps: true` as the Layout-B answer** -- re-admits `node_modules` noise, and forced
  SB10/TS6 `.d.ts` can themselves error -> false FAIL.
- **`program.getSourceFiles()` membership** -- includes transitive imports -> breaks isolation.
- **ngtsc-internal component registries** -- brittle across Angular patches -> silent break -> false
  pass. (Use public `relatedInformation` instead.)
- **A `*.stories.ts` filename allowlist** -- drops the aggregated `.component.ts` files that carry
  NG8xxx (false pass) and rots on `.stories.tsx`/`.mdx`/helpers.
- **Treating a `.ngtypecheck.ts` shim path as a real source** (see step 1 landmine).

## Constraints

- **`@storybook/angular@10.4.6` peer-caps Angular `>=18 <22` and TS `^4.9||^5`** -- installing on
  the official Angular 22.0.4 / TS 6.0.3 stack REQUIRES `--legacy-peer-deps`/`--force` (the exact
  ERESOLVE: `@storybook/angular` -> peer `@angular-devkit/build-angular >=18 <22` -> `@21.2.18` ->
  peer `@angular/compiler-cli@^21`). Documentation ONLY (D4) -- NO runtime version gate; a gate would
  false-FAIL workspaces that legitimately run via `--legacy-peer-deps`. `nx add`/pnpm can also hit
  `ERR_PNPM_IGNORED_BUILDS` (this repo's known gotcha).
- **Forced-SB10 `.d.ts` DO error under TS6** (spike 007: 48 diagnostics with `skipLibCheck:false`)
  but are ALL `node_modules`-attributed and suppressed by keep-rule (b) -> never leak in-project ->
  no false FAIL. `skipLibCheck` is orthogonal (board D-07): true = 0 noise, false = 48 suppressed;
  the in-project verdict is identical.
- **NG8xxx DO fire on the forced stack** (spike 007, G4 positive: NG8002 core + NG8102 extended,
  promoted to error via `extendedDiagnostics.defaultCategory`). The "complete type-check incl.
  NG8xxx" claim (SB-07) is honest on green.
- **Layout B host shape:** the host solution `tsconfig.json` can reference ONLY
  `./.storybook/tsconfig.json` (no app/lib leaf) -- a legit real shape (radix-ng). The
  `.storybook/tsconfig.json` `include` reaches out via relative globs (`../../../packages/**`);
  aggregation is a MANUAL recipe edit, not generator-produced. `paths` aliases flow in via the
  `extends` chain -- no special handling.
- **Angular NG-code encoding:** `ts.Diagnostic.code === -(990000 + ngNumber)` (NG8002 = -998002).
  Recover: `ngNumber = -code - 990000`.

## Validation gate (Phase 18, SB-06)

Negatives are the acceptance gate, on the OFFICIAL stack: T1 Layout-A broken/clean; T2 Layout-B
out-of-dir story broken/clean; T3 external-template NG8002 fails with the `.html`/component
codeframe; T4 dependency isolation; T5 `node_modules` suppressed (reported under `includeDeps`);
T6 Layout-C story-less guard; T7 clean Layout-B `suppressedInGraph == 0` + both counts surfaced;
T8 symlink/junction; T9 `paths`-alias aggregated import clean; T10 host with only the `.storybook`
leaf; T11 `.mdx` loud "not type-checked" notice. Plus a pure unit test on `keep()` with synthetic
diagnostics, and the packaged-tarball e2e (`nx add` + `nx g configuration` + `nx typecheck`).

## Origin

Synthesized from spikes: 006 (G2 rootNames), 007 (G3/G4 forced SB10 + NG8xxx), 008 (G1/G5
attribution + ownership). Full records (README + harness + forensic-log.json) in
`.planning/spikes/006-layout-b-rootnames/`, `.planning/spikes/007-forced-sb10-compile-ng8xxx/`,
`.planning/spikes/008-external-template-attribution/`.
