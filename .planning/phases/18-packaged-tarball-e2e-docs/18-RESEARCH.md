# Phase 18: Packaged-tarball e2e + docs - Research

**Researched:** 2026-07-06
**Domain:** Nx-plugin packaged-tarball e2e validation + a small pure-detection engine field + npm docs prose (Angular 22.0.4 / TS 6.0.3 / Nx 23.0.1 / `@storybook/angular@10.4.6`)
**Confidence:** HIGH (all touch-points read in-repo; engine invariants verified against installed TS 6.0.3 + Angular 22.0.4; the one genuinely open item -- `.tsx`+no-`jsx` verdict semantics -- is flagged ASSUMED and needs a fixture during planning)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (LOCKED -- FLAGGED as net-new engine surface):** Criterion 3 / T11 requires a loud
  "not type-checked" notice for declared-but-uncheckable files. **Verified 2026-07-06: no such notice
  exists today** (`git grep` over `src/`: the only `.tsx` handling is the filter's suppress rule + the
  `normalizeShimFileName` LIMITATION doc at `run-typecheck.ts` ~lines 634-643). Phase 18 must ADD it.
  Shape: **pure detection in core + loud render in the executor**, mirroring the established
  `skippedReferences` / `templateCheckAborted` / `suppressedInGraphFiles` detection-vs-render split
  (core is pure -- eslint bans `console`/`process` under `src/core/**`; the executor adapter renders
  every loud notice from structured fields). Trigger: a file present in the tsconfig-declared surface
  the type-check cannot cover -- `.mdx` ALWAYS; `.tsx` ONLY when the resolved `compilerOptions.jsx`
  is unset / `none`. Add a structured advisory field on `CoreResult` (a `readonly string[]` of the
  un-checked declared paths, in the family of `suppressedInGraphFiles`); the executor renders it
  loudly. **Verdict STAYS GREEN** (criterion 3 permits it) -- advisory, NOT a coverage-incomplete flip.
  The exact detection mechanism is research/discretion (answered below in RQ2).
- **D-02 (LOCKED):** Use committed generator-shaped Storybook fixtures + force-install
  `@storybook/angular@10.4.6`, NOT a live `nx g @nx/angular:storybook-configuration` per e2e. Commit
  generator-produced Layout-A (and Layout-B) Storybook fixtures ONCE under the
  `angular-typechecker-install-e2e` project's `fixtures/`, then per e2e run: copy into a tmp workspace,
  install the freshly-packed tarball, run `nx add` + `nx g angular-typechecker:configuration` +
  `nx typecheck`, assert a planted `*.stories.ts` error is caught (non-zero exit + expected code token,
  NO `ERR_REQUIRE_ESM`, NO "infrastructure error"). Include a Layout-B case.
- **D-02a (LOCKED -- install honesty, B-03):** Force-install `@storybook/angular@10.4.6` as a SEPARATE,
  EXPLICIT `--legacy-peer-deps` step, but install the **angular-typechecker tarball with NO
  peer-resolution override** -- a real ERESOLVE on OUR published peers is a real finding and must
  surface. Reuse the existing install-e2e harness VERBATIM. MUST run in the serialized shared-tarball
  e2e tier (`nx --parallel=1`, singleFork, `NX_DAEMON=false`).
- **D-03 (LOCKED):** Two tiers. FAST in-repo integration specs (`src/core/*.integration.spec.ts`)
  prove BOUNDARY SEMANTICS (no tarball); the e2e tier proves the SHIPPED ARTIFACT (criterion 1 only).
  Phase 17 already shipped the minimum integration proof; Phase 18 fills ONLY the remaining T-matrix
  gaps -- expected: T5, T6, T9 (criterion 2), T10, T11 (exercises D-01) -- plus the packaged-tarball
  story proof (criterion 1) in the e2e project. Researcher MUST map Phase 17 coverage against T1-T11
  and confirm the exact gap set (answered below in RQ1).
- **D-04 (LOCKED):** Add a dedicated **"Storybook" section to `README.md`** (near "How it compares" /
  "Limitations") carrying the EXACT coverage statement; MUST NOT claim "all Storybook files" /
  "complete Storybook coverage" / that it ensures Storybook BUILDS; MUST caveat `.mdx` (never checked),
  `.tsx` (only with `jsx`), external `templateUrl` per shipped branch 4a, Layout C (unsupported),
  pointing at a LEAF tsconfig (excludes stories), and force-install (`--legacy-peer-deps`/`--force`;
  `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS`). Update **Limitations** (fold WR-01: empty /
  zero-root-names in-project leaf is now **coverage-incomplete**, not advisory-skip -- only
  out-of-project / duplicate / self remain advisory). Write a curated **`0.1.2` CHANGELOG.md section**
  with a PROMINENT green->red "false-pass -> true-fail" callout. Source the exact release claim from
  the board CONSENSUS.md.
- **D-05 (LOCKED):** Phase 18 authors README + CHANGELOG PROSE only. The v0.1.2 release CUT
  (`nx release`, version bump, tag, OIDC publish) runs through the AGENTS.md Release-PR flow AFTER the
  milestone closes -- NOT in this phase. Do NOT run `nx release` during Phase 18.

### Claude's Discretion

- The exact detection mechanism + `CoreResult` field name for the D-01 `.mdx`/`.tsx` notice (the
  DECISION -- loud advisory, green verdict, core-detect/executor-render -- is locked; the HOW is
  research). Confirm how the resolved `compilerOptions.jsx` is read for the `.tsx`-without-`jsx`
  condition.
- Exact fixture shapes for the committed Layout-A / Layout-B Storybook e2e fixtures and the precise
  planted-error anchor + asserted code token (follow `generator-e2e.int.spec.ts`'s DISTINCT-token
  discipline).
- The exact gap set of T-cases still needed after mapping Phase 17 coverage (D-03) -- and which live
  in-repo vs e2e.
- README section placement/wording and the CHANGELOG prose (content locked by SB-07 + the board
  claim; phrasing is discretion).

### Deferred Ideas (OUT OF SCOPE)

- Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard -> Phase 19 (SB-08).
- Actual type-CHECKING of `.mdx`/`.tsx` (beyond Phase 18's loud notice) -> Phase 19 (SB-08).
- An opt-in strict mode that FAILS on `suppressedInGraph > 0` -> Phase 19 (SB-08).
- The v0.1.2 release CUT itself (nx release / tag / publish) -> AGENTS.md Release-PR flow after
  milestone close (D-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SB-06 | Validate with negative tests as the acceptance gate (broken input flips verdict to FAIL), per layout, on the official stack; the T1-T11 matrix + the packaged-tarball e2e (`nx add` + `nx g configuration` + `nx typecheck`). | RQ1 (exact residual T-gap map + tiers), RQ2 (T11 = D-01 engine+tests), RQ3 (criterion-1 e2e strategy). Existing Phase 17 specs cover T1/T2/T3/T4/T7/T8; residual = T5(partial)/T6/T9/T10/T11 + e2e. |
| SB-07 | README + changelog document the exact coverage claim + caveats + the green->red callout. | RQ4 (verbatim MUST/MUST-NOT/caveat claim from CONSENSUS.md; WR-01 Limitations fix; CHANGELOG 0.1.2 prose + callout; README section placement). |
</phase_requirements>

## Summary

Phase 18 has three workstreams, and its title ("e2e + docs") understates one of them. RQ2 (T11) is
**net-new engine + executor code**, verified absent today. The other two are (a) a small set of
**in-repo integration fixtures** filling the residual T-matrix gaps Phase 17 did not ship, plus the
**one packaged-tarball Storybook e2e** proving the shipped artifact catches a planted story error, and
(b) **README + CHANGELOG prose** carrying the exact locked coverage claim.

The engine's detection-vs-render split is mature and well-documented in the source: `CoreResult` already
carries three pure advisory fields (`templateCheckAborted`, `skippedReferences`, `suppressedInGraphFiles`)
that the executor renders as loud `logger.warn` notices, and `evaluateResult` is a pure verdict function
that reads only the fields it is meant to gate on. The D-01 notice slots into this pattern exactly: a new
`readonly string[]` field on `CoreResult`, populated by pure detection in the walk + direct paths, rendered
by one new `logger.warn` block, and deliberately NOT read by `evaluateResult` (so the verdict stays green).

The e2e harness (`e2e/angular-typechecker-install-e2e/`) is a fully serialized, single-fork, shared-dist
Verdaccio project. The new Storybook e2e spec is a NEW `.int.spec.ts` FILE in that SAME project (never a
new project -- the three e2e projects race on the shared tarball), reusing the `generator-e2e` / `nx-add`
patterns verbatim, adding one explicit `--legacy-peer-deps` Storybook install step.

**Primary recommendation:** Plan three waves -- (1) the D-01 engine field + executor render + unit/negative
tests + the fast in-repo residual integration fixtures (T5/T6/T9/T10/T11 boundary semantics); (2) the
single packaged-tarball Storybook e2e spec (criterion 1) in the install-e2e project; (3) the README
Storybook section + Limitations WR-01 fix + curated CHANGELOG 0.1.2 section. Do NOT cut the release.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect declared `.mdx` / `.tsx`-without-`jsx` (D-01) | Core engine (`src/core`) | -- | Pure detection; eslint bans `console`/`process` in core. Mirrors `skippedReferences`/`suppressedInGraphFiles`. |
| Render the "not type-checked" notice | Executor adapter (`src/executors/typecheck/executor.ts`) | -- | ONLY tier that touches `@nx/devkit` `logger`. |
| Verdict (stays green on the D-01 field) | Core (`evaluate-result.ts`) | -- | Pure verdict fn; MUST NOT read the new field. |
| Boundary-semantics proofs (T5/T6/T9/T10/T11) | In-repo integration (`src/core/*.integration.spec.ts`) | -- | Fast, no tarball; real cold `performCompilation` against committed `fixtures/`. |
| Shipped-artifact proof (criterion 1) | e2e (`e2e/angular-typechecker-install-e2e`) | -- | Only the tarball/`nx add` install proves the published package. |
| Coverage claim + caveats + green->red callout | Docs (README.md / CHANGELOG.md) | -- | Prose only; no code. Release cut is out of scope (D-05). |

**Why this matters:** the recurring failure mode this phase must avoid is putting the D-01 detection in the
executor (it belongs in pure core) or letting the D-01 field leak into the verdict (it must stay green).
Both are prevented by following the existing `skippedReferences` precedent to the letter.

## RQ1 -- T-matrix gap map (D-03): what Phase 17 already covers vs the exact residual

**Method:** read all four Phase-17 proof specs + the committed fixtures + `git grep` over the unit tiers.
Phase-17 fixtures live at repo-root `fixtures/` (not under the package): `layout-a-storybook[-clean]`,
`layout-b-host[-clean]`, `layout-b-aggregated[-clean]`, `layout-b-dependency`, `external-template-tripwire`,
`clean-template-host`.

| T | Matrix item | Phase-17 coverage | Status | Phase-18 action + tier |
|---|-------------|-------------------|--------|------------------------|
| T1 | Layout A broken/clean | `layout-a.integration.spec.ts` (broken story TS2322 on `button.stories.ts` FAILS; clean PASSES, `rootNamesCount>0`) | **DONE** | none |
| T2 | Layout B out-of-dir story broken/clean | `layout-b.integration.spec.ts` (`card.stories.ts` TS2322 out-of-host-dir FAILS; `layout-b-host-clean` PASSES) | **DONE** | none |
| T3 | External-template NG8002 with `.html`/component codeframe | `layout-b.integration.spec.ts` + `external-template.integration.spec.ts` (NG8002 kept via branch-4a `relatedInformation`, `.html` codeframe + `.ts` owner) | **DONE** | none |
| T4 | Dependency isolation | `layout-b.integration.spec.ts` (dep internal TS2339 ABSENT from reported, counted in `suppressedInGraphErrorCount`, `thing.ts` in `suppressedInGraphFiles`) + `dual-identity-tripwire.spec.ts` negative control | **DONE** | none |
| T5 | `node_modules` suppressed by default; reported under `includeDeps` | Pure `filter-diagnostics.spec.ts` (node_modules segment suppression + `suppressedThirdParty`); `run-typecheck.integration.spec.ts` covers `includeDeps` foldback but on a first-party sibling (`suppressedThirdParty===0` there, NOT a node_modules case) | **PARTIAL** | **THIN residual, in-repo integration**: add one assertion that a `node_modules`-attributed diagnostic is suppressed-by-default AND counted in `suppressedThirdParty>0` AND folded back under `includeDeps`. The Storybook-specific SB10 node_modules `.d.ts` suppression (spike 007's 48 errors) is proven IMPLICITLY by the e2e clean-story pass (criterion 1). Confirm the generic case is not already covered before writing. |
| T6 | Layout-C / story-less config guard (no silent clean pass) | Unit: `walk-references.spec.ts` ("skips a zero-rootNames leaf and records the notice"); `evaluate-result.spec.ts` (`zero-root-names` -> coverage-incomplete). Mechanism proven at UNIT tier. | **PARTIAL (mechanism only)** | **In-repo integration**: one real-config fixture -- a flat/story-less tsconfig -> the run is NOT a silent clean pass (either the 90001 zero-rootNames guard fires, or coverage-incomplete). This is the board's D-7 "ONE guard test." |
| T7 | Clean Layout-B `suppressedInGraph==0` + both counts surfaced | `layout-b.integration.spec.ts` clean host (structured: both split counts `===0`); executor stdout surfacing proven in `executor.spec.ts` (the 17-05 spec) | **DONE** | none |
| T8 | Symlink/junction realpath throws still FAILS | `dual-identity-tripwire.spec.ts` (PURE: raw-form recovery keeps a declared root through a throwing realpath; isolation negative control) | **DONE** (mechanism proven at pure tier; D-03 lists T8 as done) | none |
| T9 | `paths`-alias aggregated import compiles clean (**criterion 2**) | NONE | **GAP** | **In-repo integration**: a Layout-B fixture where an aggregated story imports a sibling via a workspace `@org/*` alias declared in the `paths` of the base tsconfig the `.storybook/tsconfig.json` `extends`; assert NO spurious `TS2307` and a clean verdict. |
| T10 | Host with NO app/lib leaf (references only `./.storybook/tsconfig.json`) fails on a story error, not 90001 | The shipped `fixtures/layout-b-host/tsconfig.json` IS this exact shape (`"files": [], "references": [{ "path": "./.storybook/tsconfig.json" }]`), and `layout-b.integration.spec.ts` proves a story error FAILS with `rootNamesCount>0` (implicitly not-90001) | **LARGELY DONE** | **THIN residual, in-repo integration**: add ONE explicit assertion to the layout-b flow that no `ZERO_ROOT_NAMES` (90001) diagnostic appears (traceability for "not empty-project 90001"). May be judged redundant -- see Open Questions. |
| T11 | `.mdx` present -> loud "not type-checked" notice (verdict may stay green); `.tsx` without `jsx` -> same | NONE -- **verified absent** (`git grep` over `src/` for `.mdx`/"not type-checked" returned zero) | **NET-NEW (D-01)** | **Engine + executor + tests** (RQ2 below), plus an in-repo integration fixture proving the notice fires and the verdict stays clean. |
| C1 | Packaged tarball catches a planted story error via `nx add`+`nx g configuration`+`nx typecheck` | NONE (Phase 17 is in-repo only) | **GAP** | **e2e** (RQ3 below): new `.int.spec.ts` in `angular-typechecker-install-e2e`. |

**Confirmed already done (do NOT duplicate):** T1, T2, T3, T4, T7, T8.
**Residual Phase-18 work:** T5 (thin), T6, T9 (= criterion 2), T10 (thin), T11 (= D-01 net-new), C1 (e2e).

## RQ2 -- The D-01 `.mdx` / `.tsx`-without-`jsx` "not type-checked" notice: concrete mechanism

**Verified against the installed toolchain (2026-07-06):** `typescript@6.0.3`, `@angular/compiler-cli@22.0.4`.

### The detection primitives (VERIFIED against `node_modules/typescript/lib/typescript.d.ts`)

- `ts.JsxEmit` runtime enum: `None = 0, Preserve = 1, React = 2, ReactNative = 3, ReactJSX = 4,
  ReactJSXDev = 5`. `CompilerOptions.jsx?: JsxEmit`. So "jsx unset / none" == `parsed.options.jsx ===
  undefined || parsed.options.jsx === 0` (`ts.JsxEmit.None`). [VERIFIED: typescript.d.ts:7052, :7174-7181]
- `ts.parseJsonConfigFileContent(json, host, basePath, existingOptions?, configFileName?,
  resolutionStack?, extraFileExtensions?, ...): ParsedCommandLine`, where `extraFileExtensions?: readonly
  FileExtensionInfo[]` and `interface FileExtensionInfo { extension: string; isMixedContent: boolean;
  scriptKind?: ScriptKind }`. [VERIFIED: typescript.d.ts:9267, :6898-6902]

### `.tsx`-without-`jsx` (the simple half)

`.tsx` is ALWAYS a supported TypeScript extension, so a `.tsx` file matched by the tsconfig `include`
already appears in `parsed.rootNames`. Detection = filter `parsed.rootNames` for `.endsWith('.tsx')`,
then check `parsed.options.jsx` is unset/`None`.

```ts
// Source: derived from typescript@6.0.3 JsxEmit + ParsedConfiguration.rootNames (in-repo compiler-cli-types.ts)
function declaredTsxWithoutJsx(parsed: ParsedConfiguration): readonly string[] {
  const jsxUnset = parsed.options.jsx === undefined || parsed.options.jsx === 0; // ts.JsxEmit.None
  if (!jsxUnset) {
    return [];
  }
  return parsed.rootNames.filter((name) => name.endsWith('.tsx'));
}
```

### `.mdx` (the half that needs a second parse)

`.mdx` is NEVER a TS-supported extension, so it never appears in `parsed.rootNames`. To enumerate the
declared `.mdx` files exactly as the tsconfig `include`/`exclude`/`files` semantics would, re-parse the
leaf tsconfig with an extra file extension and diff:

```ts
// Source: typescript@6.0.3 public API (parseJsonConfigFileContent + extraFileExtensions). ts.sys is
// permitted in core (walk-references.ts already uses it); no console/process.
function declaredMdx(ts: typeof import('typescript'), leafTsConfigPath: string): readonly string[] {
  const configJson = ts.readConfigFile(leafTsConfigPath, ts.sys.readFile).config;
  const parsed = ts.parseJsonConfigFileContent(
    configJson,
    ts.sys,
    dirname(leafTsConfigPath),
    /* existingOptions */ undefined,
    leafTsConfigPath,
    /* resolutionStack */ undefined,
    [{ extension: 'mdx', isMixedContent: false, scriptKind: ts.ScriptKind.Unknown }],
  );
  return parsed.fileNames.filter((name) => name.endsWith('.mdx'));
}
```

- The `extraFileExtensions` approach is the robust, public-API mechanism -- it honors `include`,
  `exclude`, and `files` exactly (no hand-rolled glob semantics). CONTEXT.md's alternative ("read the raw
  config `include` and glob") is a FALLBACK only; it forces you to re-implement TypeScript's wildcard /
  exclude / files logic and will drift. **Recommend `extraFileExtensions`.**
- Note: `.mdx` only surfaces if the tsconfig `include` has a glob that can match it (e.g. `**/*` or an
  explicit `**/*.mdx`). A `.storybook/tsconfig.json` whose `include` is `.ts`-only will report zero `.mdx`
  -- which is correct (nothing declared, nothing to warn about). The detection is include-driven, not a
  filesystem scan.

### Where detection runs, and the `CoreResult` field

- The walk path (`walkReferences`) already surfaces each surviving leaf's declared `rootNames` as
  `rootNamePaths`. Add a parallel aggregation: each surviving leaf contributes its declared-uncheckable
  paths (`.mdx` + `.tsx`-without-`jsx`) to a `WalkResult` array, populated in the SAME surviving-leaf tail
  (after every skip `continue`) so a skipped/out-of-project leaf contributes nothing -- exactly the
  `rootNamePaths` pattern.
- The direct single-leaf path (`runTypecheck`, the non-references branch) computes it from its own `parsed`.
- `finalize` (or `runTypecheck` after `finalize`) attaches the aggregated array to `CoreResult` using the
  same conditional-spread `[] -> undefined` idiom as `skippedReferences`.

**Recommended field name (discretion):** `notTypeCheckedDeclaredFiles: readonly string[]` (or
`uncheckedDeclaredFiles`). Family of `suppressedInGraphFiles` -- a `readonly string[]` of canonical/declared
paths, `undefined` when empty. Document it as ADDITIVE / advisory (0.x non-breaking). Note it will appear in
the README Programmatic API `CoreResult` shape comment, so pick the name deliberately.

### Executor render point

In `executor.ts`, after the `suppressedInGraph` block and BEFORE `renderReport(...)` (so it is not buried
under a codeframe dump), add one `logger.warn` gated on `result.notTypeCheckedDeclaredFiles?.length`:

```ts
if (result.notTypeCheckedDeclaredFiles?.length) {
  logger.warn(
    `angular-typechecker: ${result.notTypeCheckedDeclaredFiles.length} declared file(s) are NOT ` +
      `type-checked -- .mdx is never type-checked, and .tsx is only checked when compilerOptions.jsx ` +
      `is set. This is ADVISORY: the verdict is unchanged. File(s): ` +
      `${result.notTypeCheckedDeclaredFiles.join(', ')}.`,
  );
}
```

### Verdict stays GREEN -- the mandatory negative test

`evaluateResult` MUST NOT read `notTypeCheckedDeclaredFiles`. Add a NEGATIVE unit test in
`evaluate-result.spec.ts`: a result with a non-empty `notTypeCheckedDeclaredFiles` but `errorCount===0` and
no other coverage trigger returns `{ success: true, outcome: 'clean' }`. This is the tripwire that proves the
notice never becomes a coverage-incomplete flip (the D-01 charter distinction). Because `evaluateResult`'s
`EvaluateInput` is a `Pick` + `Partial<Pick<...>>`, simply NOT adding the field to that type is sufficient --
but the negative test locks it against a future accidental wiring.

### Detection unit + integration tests

- **Pure unit** (stack-independent, cannot rot): feed a synthetic `ParsedConfiguration`-like object /
  `rootNames` + `jsx` into the detection helper; assert `.tsx`-without-jsx is detected, `.tsx`-WITH-jsx is
  not, and no false positives on a `.ts`-only set. (The `.mdx` half needs real `ts.parseJsonConfigFileContent`,
  so its exact-enumeration proof belongs at the integration tier over a committed fixture.)
- **Integration fixture (T11)**: a fixture whose `.storybook/tsconfig.json` `include` declares a `.mdx`
  (and/or a `.tsx` with `jsx` unset), assert `result.notTypeCheckedDeclaredFiles` is non-empty AND the
  verdict is `clean`. A negative fixture (no `.mdx`, jsx set) asserts the field is empty/undefined.

## RQ3 -- Storybook e2e fixture strategy (D-02 / D-02a)

### The harness to reuse VERBATIM

`e2e/angular-typechecker-install-e2e/` -- the serialized, single-fork Verdaccio project. Its
`vitest.config.mts` sets `pool:'forks'`, `poolOptions.forks.singleFork:true`, `fileParallelism:false`,
`sequence.concurrent:false`, `testTimeout/hookTimeout:300000`, `globalSetup:['./src/global-setup.ts']`. The
`global-setup.ts` stands up Verdaccio, builds `dist` ONCE, mints a token, and PUBLISHES the real dist ONCE;
specs consume `inject('verdaccioUrl')` / `inject('verdaccioToken')`. `@workspace/test-util` exports:
`findWorkspaceRoot`, `buildCleanEnv`, `commandSucceeds`, `run`, `sh`, `removeTmpDir`, `writeVerdaccioNpmrc`,
`expectSeededTypecheckTargetDefault`, `readTypecheckTargetDefault`.

**Serialization is non-negotiable and already handled at the right level:** the new spec MUST be a NEW
`*.int.spec.ts` FILE inside `angular-typechecker-install-e2e` (never a new e2e project). All specs in this
project run in ONE fork, sequentially, and share the one dist build + Verdaccio publish. The cross-project
tarball race ([[e2e-projects-share-one-tarball-serialize]]) is prevented at the `nx --parallel=1` level;
staying inside this project inherits that.

### The criterion-1 command sequence (two viable install paths)

Criterion 1 says "via `nx add` + `nx g angular-typechecker:configuration` + `nx typecheck`." Two existing
patterns feed the SHIPPED artifact:

1. **Verdaccio `nx add` by name** (`nx-add-npm.int.spec.ts` pattern): `writeVerdaccioNpmrc(tmp, url, token)`
   -> `npx nx add angular-typechecker` (resolves from Verdaccio, runs `init`) -> `nx g configuration` ->
   `nx typecheck`. This most literally satisfies "via `nx add`" AND proves `nx add` works on a Storybook
   workspace.
2. **Direct tarball install** (`generator-e2e.int.spec.ts` pattern): `npm pack` the shared dist in
   `beforeAll`, `npm install <tgz>` (NO override), `nx g configuration`, `nx typecheck`; `rm` the `.tgz`
   in `afterAll`.

**Recommendation:** use path (1) (Verdaccio `nx add`) as the primary criterion-1 proof -- it is the exact
command sequence in criterion 1 and the globalSetup already publishes to Verdaccio. See Open Questions for
the D-02/D-02a "install the freshly-packed tarball" wording, which reads toward path (2); the planner should
pick one and note it. Either proves the shipped artifact.

### Per-run recipe (mirrors `nx-add-npm` / `generator-e2e`)

1. `mkdtempSync(join(tmpdir(), 'atc-sb-'))`; `cpSync(fixtureDir, tmp, { recursive: true })`.
2. `env = buildCleanEnv({ stripAllNpmConfig: true })` (strips the process-wide `npm_config_registry` the
   globalSetup set + the leaked `legacy-peer-deps`, preserving B-03 honesty).
3. **Force-install Storybook as a SEPARATE explicit step, WITH the override (D-02a):**
   `sh('npm install @storybook/angular@10.4.6 --legacy-peer-deps', { cwd: tmp, env })`. The peer-cap
   ERESOLVE is real (`@storybook/angular` -> `@angular-devkit/build-angular >=18 <22` -> `@angular/compiler-cli@^21`),
   documented (D4), and NOT a tool defect. This step is where the override is legitimate.
4. **Install angular-typechecker with NO override (B-03 honesty):** either `nx add angular-typechecker`
   (Verdaccio, path 1) or `npm install <tgz>` (path 2) with an empty tmp `.npmrc` + a nonexistent
   `npm_config_userconfig`, so a real ERESOLVE on OUR published peers surfaces.
5. `npx nx g angular-typechecker:configuration <project> --skipFormat` (fixture has no Prettier).
6. **Clean-baseline run first:** `run(tmp, '<project>:typecheck', { env, skipNxCache: true })` -> exit 0
   (proves a clean generator-shaped Storybook project passes, and that forced-SB10's node_modules `.d.ts`
   errors do NOT leak in-project -- the implicit T5 Storybook proof).
7. **Plant the error, then run:** replace a committed clean anchor line in `*.stories.ts` with a broken
   line (built via `JSON.stringify` for ASCII safety, like generator-e2e), re-run, assert:
   `code !== 0`; stdout contains the DISTINCT full code token (e.g. `TS2322`, and for Layout B the
   external-template `NG8002`); stdout does NOT match `/ERR_REQUIRE_ESM/` (CJS->ESM bridge survived
   packaging); stdout does NOT contain `'infrastructure error'` (the non-zero exit is the real diagnostic).
8. `finally { removeTmpDir(tmp); }`.

### The committed fixtures (produce once, commit under the install-e2e project's `fixtures/`)

- **Layout A** (`fixtures/consumer-storybook-a` or similar): produce ONCE via a real
  `nx g @nx/angular:storybook-configuration` on a scaffolded app, then commit the generator output MINUS
  `node_modules` (the spike-007 forced-SB10 scaffold was scratchpad-only and NEVER committed -- so this is
  net-new committed material). Story files carry a CLEAN baseline; the spec plants the error at runtime.
- **Layout B** (`fixtures/consumer-storybook-b` or similar): the generator output + the documented
  centralized-host recipe hand-edit (a widened `.storybook/tsconfig.json` `include` reaching aggregated
  cross-project stories/components, an external `templateUrl`), matching the in-repo `fixtures/layout-b-*`
  shapes. Plant the aggregated story error at runtime.

**Distinct-token discipline (Pitfall):** assert full `TSxxxx`/`NGxxxx` tokens (never bare 4-digit
substrings -- they false-PASS on a hash/offset), and use a DISTINCT code per leaf so a planted error
uniquely attributes to the story surface (the `generator-e2e` `LIB_LEAF_CODE`/`SPEC_LEAF_CODE` rule).

**pnpm note (optional):** criterion 1 needs only ONE package manager (npm is sufficient). A pnpm variant
would need the `allowBuilds: { nx: true }` build-gate workaround (`nx-add-pnpm.int.spec.ts` /
[[nx-add-fails-on-pnpm-workspaces]]); this is optional scope -- do not add unless the planner wants
multi-PM parity for the Storybook path.

## RQ4 -- SB-07 docs: the exact claim, the WR-01 fix, the CHANGELOG callout

### The EXACT coverage statement (verbatim-ready, from board CONSENSUS.md "Release coverage claim")

**MUST claim:**
> "v0.1.2 runs the complete Angular type-check (TypeScript + template type-check + NG8xxx, no emit) on the
> TypeScript files the Storybook tsconfig declares -- your `*.stories.ts`, `.storybook/main.ts`/`preview.ts`,
> and (centralized host) the aggregated `*.component.ts`/`*.directive.ts`/`*.ts` its `include` reaches --
> provided the `typecheck` target points at the project's SOLUTION `tsconfig.json`. A green verdict means
> every such file type-checked clean."

**MUST NOT claim:** "all Storybook files" / "complete Storybook coverage" unqualified; that it ensures
Storybook builds/runs; support for any layout not proven on the official stack.

**MUST caveat:** `.mdx` never type-checked; `.tsx` only if `jsx` enabled; external `templateUrl` per the
shipped G1 branch (branch 4a: attributes to `.html`, kept via `relatedInformation` owner mapping); Layout C
not a supported Storybook layout; pointing at a LEAF app/lib tsconfig EXCLUDES stories (point at the solution
config); "supported" is verified against the FORCE-INSTALLED Storybook combination (`--legacy-peer-deps` /
`--force`; `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS`).

**Two docs-only facts to fold in (from the spike-findings blueprint / D4):**
- Forced `@storybook/angular@10.4.6` peer-caps Angular `>=18 <22` / TS `^4.9||^5`; installing on Angular
  22.0.4 / TS 6.0.3 needs `--legacy-peer-deps`/`--force`. Never a runtime gate.
- Forced-SB10's 48 TS6 `.d.ts` errors are `node_modules`-attributed and suppressed by the keep-rule -> they
  never leak in-project -> no false FAIL. Genuine TS6 errors in your own `main.ts`/`preview.ts` are real.
- The DX note (from CONSENSUS.md cross-cutting): the target stores `tsConfig: <solution>` and reads
  `references[]` at EXECUTE time, so adding Storybook AFTER wiring `typecheck` yields coverage on the next
  run with no re-generation.

### README placement (D-04)

Add a `## Storybook` section between `## How it compares` and `## Limitations` (and a matching entry in the
`## Contents` list). Keep the MUST/MUST-NOT/caveat statement above as its spine. Reference the two Nx layouts
(A per-project scaffold, B centralized host) with a one-line each, and point at pointing-at-the-solution
tsconfig as the enabling condition.

### The WR-01 Limitations fix (folded into D-04)

The current README Limitations bullet ("The reference walk is single-level...") says references that are
"out-of-project, empty, or themselves solution tsconfigs are skipped with an advisory warning and do not
change the verdict." Phase 17 D-06 made the **empty / zero-root-names in-project leaf** case
**coverage-incomplete** (a non-clean verdict), NOT an advisory-only skip. Rewrite so: a referenced in-project
leaf that resolves to ZERO input files (empty, or a references-only/solution tsconfig whose inner projects are
not walked) yields a non-clean **coverage-incomplete** verdict; only **out-of-project / duplicate /
self-reference** remain advisory (verdict unchanged). This is also visible in the shipped executor notice
copy (`executor.ts` renders distinct `verdictNote`s per `skipped.reason`). After this rewrite, move the
WR-01 todo `.planning/todos/pending/wr-01-readme-coverage-incomplete.md` to resolved.

### The CHANGELOG 0.1.2 section (curated, matches existing entry style)

Write a hand-curated `## 0.1.2 (<date>)` section ABOVE `## 0.1.1`, in the existing prose style (feature
summary + `### Features` / `### Fixes` / `### Internal` / `### Compatibility`, plus the reference-link
footer `[0.1.2]: .../angular-typechecker@0.1.2`). It MUST carry a PROMINENT green->red callout:

> **Behavior change (a correctness fix, not a regression):** existing centralized-host (Layout B) Storybook
> builds that previously passed by SILENTLY dropping aggregated cross-project diagnostics will now FAIL when
> those aggregated stories/components have real type or template errors. This is a false-pass -> true-fail
> CORRECTION (permitted under 0.x semver), not a break. If a build newly goes RED, read the newly reported
> diagnostics as the errors that were there all along.

**Do NOT** run `nx release`, bump the version, or tag (D-05). The version bump is computed by
conventional commits at release time; Phase 18 writes the PROSE for the eventual curated changelog. (Per
AGENTS.md, the raw `nx release` changelog leaks internal plan-id scopes, so a hand-curated section is
required for any public release anyway -- Phase 18 authoring it now is the curation step.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enumerate declared `.mdx` files | A custom glob over the tsconfig `include` | `ts.parseJsonConfigFileContent(..., extraFileExtensions:[{extension:'mdx',...}])` and diff `fileNames` | Re-implementing TS include/exclude/files/wildcard semantics WILL drift; the public API is exact. |
| Read the resolved `jsx` option | Parse the raw tsconfig JSON | `parsed.options.jsx` (already resolved by `readConfiguration`, honoring `extends`) | The resolved option already flows through the `extends` chain; the raw JSON does not. |
| The e2e install / tmp-workspace / clean-env plumbing | New harness | `@workspace/test-util` (`run`/`sh`/`buildCleanEnv`/`writeVerdaccioNpmrc`/`removeTmpDir`) + the `nx-add`/`generator-e2e` spec shape | Verbatim reuse is mandated (D-02a) and battle-tested for nested-nx isolation + B-03 honesty. |
| A new e2e project for the Storybook proof | A `angular-typechecker-storybook-e2e` project | A new `*.int.spec.ts` FILE in `angular-typechecker-install-e2e` | Separate e2e projects race on the shared dist tarball ([[e2e-projects-share-one-tarball-serialize]]). |
| The verdict flip / green->red logic | Any new verdict path for D-01 | `evaluateResult` UNCHANGED (do not read the new field) | The D-01 notice is advisory; the verdict machinery already exists and must stay green. |

**Key insight:** every mechanism this phase needs (advisory field on `CoreResult`, executor render, pure
verdict, e2e install) already has a shipped precedent in the codebase. The phase is pattern-following, not
invention -- the only genuinely new logic is the two-line `.mdx`/`.tsx` detection.

## Common Pitfalls

### Pitfall 1: Putting the D-01 detection in the executor
**What goes wrong:** the detection reads `parsed`/globs and it feels adapter-ish, so it drifts into
`executor.ts`. **Why:** the executor is the render tier. **How to avoid:** detection is PURE and lives in
`src/core` (walk + direct paths); the executor only reads `result.notTypeCheckedDeclaredFiles` and renders.
eslint bans `console`/`process` in core -- but `ts.sys` and `ts.parseJsonConfigFileContent` are allowed
(walk-references.ts already uses `ts.sys`). **Warning sign:** a `logger`/`console` call under `src/core/**`.

### Pitfall 2: The D-01 field leaking into the verdict
**What goes wrong:** the field gets added to `evaluateResult`'s `EvaluateInput` and starts flipping the
verdict. **How to avoid:** do NOT add it to `EvaluateInput`; add the negative test that a result with the
field set but `errorCount===0` is `{ success:true, outcome:'clean' }`.

### Pitfall 3: Assuming `.tsx`-without-`jsx` "stays green" unconditionally
**What goes wrong:** a `.tsx` file IS a rootName and IS compiled; if it contains JSX and `jsx` is off, the
compiler emits a hard TS error (e.g. TS17004 class) that FAILS the verdict -- so "verdict may stay green" only
holds when the `.tsx` has no hard errors. The advisory is orthogonal to the verdict. **How to avoid:** treat
the notice as advisory-only signalling; do NOT assume it implies a green verdict. Verify the exact
`.tsx`+JSX+no-`jsx` verdict with a fixture during planning (see Assumptions Log A1).

### Pitfall 4: Serialization / shared-tarball race in the e2e tier
**What goes wrong:** a parallel worker or a second e2e project packs/removes the same dist `.tgz` mid-run ->
ENOENT. **How to avoid:** the new spec stays inside `angular-typechecker-install-e2e` (singleFork,
`fileParallelism:false`), and cross-project runs use `nx --parallel=1`. Do NOT add a `beforeAll` that races a
sibling spec's pack -- prefer the Verdaccio `nx add` path (no per-spec pack) or the shared-pack `beforeAll`
idiom from `generator-e2e` (which is already serialized within the project).

### Pitfall 5: Masking a real consumer ERESOLVE
**What goes wrong:** applying `--legacy-peer-deps` to the angular-typechecker install would hide a real
ERESOLVE on OUR published peers (B-03 violation). **How to avoid:** the `--legacy-peer-deps` step is
Storybook-ONLY and SEPARATE; the angular-typechecker install uses an empty tmp `.npmrc` + nonexistent
`npm_config_userconfig` + `stripAllNpmConfig` so no override leaks.

### Pitfall 6: Bare 4-digit code assertions in the planted-error e2e
**What goes wrong:** asserting `'2322'` false-PASSes on an unrelated 4-digit substring (offset/hash).
**How to avoid:** assert the full `TS2322`/`NG8002` token and use DISTINCT codes per leaf.

### Pitfall 7: `.mdx`/`.tsx` detection running on skipped/out-of-project leaves
**What goes wrong:** aggregating declared-uncheckable paths BEFORE the walk's skip `continue`s counts an
out-of-project leaf's `.mdx`. **How to avoid:** aggregate in the surviving-leaf tail, exactly where
`rootNamePaths.push(...)` lives (walk-references.ts:268).

## Code Examples

### The advisory-field precedent to mirror (`skippedReferences`)
```ts
// Source: packages/angular-typechecker/src/core/run-typecheck.ts (in-repo, verified)
// Core maps the walk's empty array [] -> undefined so the adapter's presence check is sufficient.
const skipped =
  walk.skippedReferences.length > 0
    ? { skippedReferences: walk.skippedReferences }
    : {};
// ...later: return { ...result, ...skipped };
// The D-01 field follows this exact conditional-spread idiom.
```

### The executor render precedent to mirror (`suppressedInGraph` block)
```ts
// Source: packages/angular-typechecker/src/executors/typecheck/executor.ts (in-repo, verified)
if (result.suppressedInGraphErrorCount > 0 || result.suppressedInGraphWarningCount > 0) {
  logger.warn(`angular-typechecker: this run's coverage is INCOMPLETE -- ...`);
}
// The D-01 notice is a NEW logger.warn block in the same location, gated on the new field's length.
```

### The e2e planted-error assertion discipline
```ts
// Source: packages/.../e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts (in-repo)
expect(bad.code).not.toBe(0);
expect(bad.stdout).toContain(LIB_LEAF_CODE);     // full 'TS2322' token, distinct per leaf
expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);   // CJS->ESM bridge survived packaging
expect(bad.stdout).not.toContain('infrastructure error');
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (unit/integration); `e2e/angular-typechecker-install-e2e/vitest.config.mts` (e2e, serialized) |
| Quick run command | `npx nx test angular-typechecker` (unit + integration; cold-compiler integration specs inherit `testTimeout:30000`) |
| Full suite command | `npx nx run-many -t test --parallel=1` (adds the serialized e2e project; `--parallel=1` prevents the shared-tarball race) |

### Phase Requirements -> Test Map
| Req / T | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| T11 / D-01 detect | `.mdx` / `.tsx`-no-`jsx` enumerated from the declared surface | unit | `npx nx test angular-typechecker` (new detection spec) | Wave 0 |
| T11 / D-01 verdict | field set + 0 errors -> `{success:true, outcome:'clean'}` (negative) | unit | `npx nx test angular-typechecker` (evaluate-result.spec.ts add) | extend existing |
| T11 / D-01 e2e-of-engine | fixture with a declared `.mdx` -> notice fires, verdict clean | integration | `npx nx test angular-typechecker` (new `*.integration.spec.ts`) | Wave 0 |
| T9 (criterion 2) | `paths`-alias aggregated import compiles clean, no TS2307 | integration | `npx nx test angular-typechecker` | Wave 0 (fixture + spec) |
| T6 | story-less / flat config -> not a silent clean pass | integration | `npx nx test angular-typechecker` | Wave 0 (fixture + spec) |
| T5 (thin) | `node_modules` diag suppressed-by-default + `suppressedThirdParty>0`; folded under `includeDeps` | integration or extend pure | `npx nx test angular-typechecker` | verify-then-extend |
| T10 (thin) | host with only `.storybook` leaf: story error FAILS, no 90001 | integration | `npx nx test angular-typechecker` | extend layout-b flow |
| SB-06 C1 | shipped tarball catches a planted story error (Layout A + B) | e2e | `npx nx test angular-typechecker-install-e2e` (new `*.int.spec.ts`) | Wave 0 (fixtures + spec) |
| SB-07 | README claim + Limitations WR-01 fix + CHANGELOG 0.1.2 prose | manual/prose | reviewed in code review (no automated assertion) | edit existing docs |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (fast unit + integration).
- **Per wave merge:** the above + `npx nx test angular-typechecker-install-e2e` for the e2e wave.
- **Phase gate:** `npx nx run-many -t test --parallel=1` (+ `format:check`, `lint` -- both required CI
  gates at `maxWarnings:0`, per [[verify-format-and-lint-before-release]]) green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/core/<d-01-detection>.spec.ts` -- pure `.tsx`/jsx detection.
- [ ] `packages/angular-typechecker/src/core/not-type-checked.integration.spec.ts` (or fold into a
      Storybook integration spec) -- `.mdx` enumeration + green-verdict proof (T11).
- [ ] `packages/angular-typechecker/src/core/evaluate-result.spec.ts` -- ADD the negative
      "field-set-but-clean" case.
- [ ] `fixtures/` additions for T6 (story-less/flat), T9 (`paths`-alias aggregated), T11 (declared `.mdx`).
- [ ] `e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-{a,b}` -- committed
      generator-shaped Storybook fixtures.
- [ ] `e2e/angular-typechecker-install-e2e/src/storybook-tarball.int.spec.ts` -- criterion 1.
- [ ] T5 verification: confirm no existing spec covers node_modules-suppressed + `suppressedThirdParty>0` +
      `includeDeps` foldback before writing a new one.

## Security Domain

`security_enforcement` is not explicitly `false` in config, so it is treated as enabled. This phase has a
minimal, well-bounded surface:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (low) | The D-01 detection reads tsconfig paths + globs already parsed by `readConfiguration`/`ts.parseJsonConfigFileContent`. No new untrusted input; paths come from the consumer's own tsconfig. |
| V12 Files/Resources | yes (low) | Detection reads config files via `ts.sys` (same host the engine already uses). The e2e installs a pinned `@storybook/angular@10.4.6` into a throwaway tmp workspace (`removeTmpDir` cleanup). |
| V6 Cryptography | no | -- |
| V2/V3/V4 Auth/Session/Access | no | -- |

**Threat notes (STRIDE):**
- Supply chain (Tampering/Elevation): `@storybook/angular@10.4.6` is force-installed in a TEST FIXTURE ONLY
  (never a product dependency of the plugin -- the plugin ships zero Storybook coupling, D4/D6). It is a
  pre-vetted, real, widely-used package (validated across spikes 006-008; version pin confirmed to exist on
  npm 2026-07-06). The e2e uses `--legacy-peer-deps` for Storybook only; the angular-typechecker install
  keeps NO override (B-03), so a real peer conflict on OUR package surfaces rather than being masked.
- Information disclosure: the D-01 notice names the consumer's OWN declared files only (never dependency
  error text -- consistent with the existing `suppressedInGraphFiles` isolation rule).

## Package Legitimacy Audit

Phase 18 adds NO new dependency to the published plugin (the plugin's `dependencies`/`peerDependencies` are
unchanged). The only external package installed anywhere is a TEST FIXTURE dependency:

| Package | Registry | Age/Version | Source Repo | slopcheck | Disposition |
|---------|----------|-------------|-------------|-----------|-------------|
| `@storybook/angular` | npm | `10.4.6` (confirmed present via `npm view` 2026-07-06) | github.com/storybookjs/storybook | not run (locked test fixture dep, pre-vetted spikes 006-008) | Approved (test-only, version-pinned by D-02a/D4) |

No product-facing package legitimacy gate applies -- there is nothing new to slopcheck in the shipped
tarball. `@storybook/angular@10.4.6` is a locked, verified fixture dependency from the milestone charter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `typescript` | D-01 detection API | Yes | 6.0.3 | -- |
| `@angular/compiler-cli` | integration fixtures (cold compile) | Yes | 22.0.4 | -- |
| `@storybook/angular` | e2e fixture force-install | Yes (npm) | 10.4.6 | -- (force-install `--legacy-peer-deps`) |
| Nx + Verdaccio (`@nx/js` local-registry) | e2e globalSetup | Yes | Nx 23.0.1 | -- |
| npm | e2e install path | Yes | -- | -- |
| pnpm 11 | OPTIONAL pnpm e2e variant | CI-only (`pnpm/action-setup`) | 11.9.0 | skip variant if absent (`commandSucceeds` guard) |

No blocking missing dependencies. All engine + e2e prerequisites are present in the dev repo and CI.

## State of the Art

Not a fast-moving domain for this phase -- the toolchain is version-locked (Nx 23 / Angular 22 / TS 6 /
`@storybook/angular@10.4.6`) by the project charter. The one relevant "current approach" note: enumerating a
tsconfig's non-`.ts` declared files via `ts.parseJsonConfigFileContent`'s `extraFileExtensions` is the
supported public-API mechanism (present in TS 6.0.3), superseding any hand-rolled glob.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A `.tsx` declared with `jsx` unset "may stay green" -- but a `.tsx` that contains JSX will emit a hard TS error (TS17004 class) and turn the verdict RED; the advisory is orthogonal to the verdict. Exact behavior not empirically run this session. | RQ2 / Pitfall 3 | If a `.tsx`+JSX+no-`jsx` fixture actually goes RED, the T11 "verdict may stay green" success wording needs the fixture to use a JSX-free `.tsx` (or `.mdx`) to demonstrate the green-verdict case. Verify with a fixture during planning. |
| A2 | `ts.parseJsonConfigFileContent` with `extraFileExtensions:[{extension:'mdx',...}]` includes declared `.mdx` files in `fileNames` (API shape verified; end-to-end enumeration not run this session). `scriptKind: ts.ScriptKind.Unknown` is a safe choice. | RQ2 | If enumeration misbehaves, fall back to reading the raw `include` + a bounded glob; verify with the T11 integration fixture. |
| A3 | The `nx add` (Verdaccio) path is the intended criterion-1 install, reconciling D-02/D-02a's "install the freshly-packed tarball" wording with criterion 1's "via nx add". | RQ3 / Open Q1 | If the planner prefers the direct-tarball (`npm install <tgz>`) path, the spec shape changes (add a `beforeAll` pack) but the proof is equivalent. |
| A4 | The `@nx/angular:storybook-configuration` generator's Layout-A `.storybook/tsconfig.json` `include` is `.ts`-oriented (may or may not declare `.mdx`); the T11 `.mdx` case likely needs an explicit `.mdx` in the fixture's include to demonstrate. | RQ2/RQ3 | If the generated config already globs `.mdx`, the fixture is simpler; if not, the fixture adds an explicit `.mdx` + include entry. Confirm when producing the committed fixture. |

## Open Questions

1. **Criterion-1 install path (Verdaccio `nx add` vs direct tarball).** D-02/D-02a say "install the freshly-
   packed tarball" and "reuse the harness verbatim" (the `generator-e2e` pack pattern), while criterion 1
   says "via `nx add`". Both prove the shipped artifact.
   - What we know: globalSetup already publishes dist to Verdaccio; `nx-add-*` specs use `nx add`;
     `generator-e2e` uses `npm install <tgz>`.
   - Recommendation: use the Verdaccio `nx add` path (most literal criterion-1 proof); note the tarball
     alternative. Planner picks one.

2. **T10 explicit assertion vs redundancy.** `fixtures/layout-b-host` IS the "host with only the `.storybook`
   leaf" shape and `layout-b.integration.spec.ts` already proves a story error fails with `rootNamesCount>0`
   (implicitly not-90001).
   - Recommendation: add ONE explicit assertion that `ZERO_ROOT_NAMES` (90001) is absent to the existing
     layout-b flow for traceability, OR mark T10 covered-by-T2. Low-risk either way.

3. **T5 exact residual.** The generic node_modules suppression is pure-tier covered; the `includeDeps`
   integration test is on a first-party sibling, not node_modules.
   - Recommendation: verify `run-typecheck.integration.spec.ts` / `filter-diagnostics.spec.ts` for a
     node_modules-attributed `suppressedThirdParty>0` case before writing; add a thin one if genuinely
     missing. The Storybook-specific SB10 suppression is proven implicitly by the e2e clean-story pass.

## Sources

### Primary (HIGH confidence -- in-repo, read this session)
- `.planning/phases/18-packaged-tarball-e2e-docs/18-CONTEXT.md` -- the 5 locked decisions + canonical refs.
- `.planning/REQUIREMENTS.md` -- SB-06 (T1-T11) + SB-07.
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` -- the exact release claim + T-matrix.
- `.planning/phases/17-.../17-DECISION-input-set-boundary.md` -- coverage-incomplete / WR-01 fact.
- `.claude/skills/spike-findings-angular-typechecker/references/storybook-input-set-boundary.md` -- blueprint.
- Engine: `src/core/run-typecheck.ts`, `filter-diagnostics.ts`, `evaluate-result.ts`, `walk-references.ts`,
  `compiler-cli-types.ts`; `src/executors/typecheck/executor.ts`.
- Phase-17 proofs: `layout-a.integration.spec.ts`, `layout-b.integration.spec.ts`,
  `external-template.integration.spec.ts`, `dual-identity-tripwire.spec.ts`; `fixtures/layout-b-host/*`.
- e2e harness: `generator-e2e.int.spec.ts`, `nx-add-pnpm.int.spec.ts`, `global-setup.ts`,
  `vitest.config.mts`; `libs/test-util/src/index.ts`.
- Docs to rewrite: `packages/angular-typechecker/README.md`, `CHANGELOG.md`,
  `.planning/todos/pending/wr-01-readme-coverage-incomplete.md`.

### Tool-verified (HIGH confidence)
- `node_modules/typescript/lib/typescript.d.ts` -- `parseJsonConfigFileContent` signature +
  `extraFileExtensions`/`FileExtensionInfo`; `JsxEmit` enum (`None=0`); `CompilerOptions.jsx?`.
- `npm view @storybook/angular@10.4.6 version` -> `10.4.6` present (2026-07-06).
- Installed `typescript@6.0.3`, `@angular/compiler-cli@22.0.4` (confirmed via `require(...).version`).

## Metadata

**Confidence breakdown:**
- T-matrix gap map (RQ1): HIGH -- all four Phase-17 proofs + fixtures read directly.
- D-01 mechanism (RQ2): HIGH on the API surface (verified against installed TS); MEDIUM on exact
  `.tsx`-verdict semantics (A1, needs a fixture).
- e2e strategy (RQ3): HIGH -- harness patterns read verbatim; one install-path ambiguity flagged (Open Q1).
- Docs claim (RQ4): HIGH -- exact wording lifted from CONSENSUS.md; WR-01 fact confirmed.

**Research date:** 2026-07-06
**Valid until:** ~2026-08-05 (stable, version-locked toolchain; the TS API + Storybook pin will not move)
