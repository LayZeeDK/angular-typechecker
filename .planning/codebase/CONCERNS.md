# Codebase Concerns

**Analysis Date:** 2026-07-09

Scope: the published Nx plugin `angular-typechecker` (`packages/angular-typechecker/`)
plus its e2e harness (`e2e/`). This codebase is unusually well-maintained for its age:
there are effectively no stray `TODO`/`FIXME`/`HACK` markers in source (the only
`ponytail:`-style marker is a deliberate one in `scoped-name-guard.spec.ts`), and most
of the items below are DELIBERATE, DOCUMENTED trade-offs with existing mitigations, not
latent defects. They are catalogued here so future work does not silently regress a
load-bearing decision or re-open a resolved bug.

## Tech Debt

**CJS executor / ESM `@angular/compiler-cli` bridge is build-config-fragile:**
- Issue: the executor ships as CommonJS but the type-check engine is ESM-only, reached
  through the single dynamic `await import('@angular/compiler-cli')` in
  `packages/angular-typechecker/src/core/compiler-loader.ts`. That `import()` MUST survive
  emit as a native dynamic import. It only does so because the package is compiled under
  `module: nodenext` (`packages/angular-typechecker/tsconfig.json`). Switching to
  `module: commonjs` would downlevel `import()` to `require()`, which throws
  `ERR_REQUIRE_ESM` at runtime for the ESM compiler-cli.
- Files: `packages/angular-typechecker/tsconfig.json` (the `module`/`moduleResolution:
  nodenext` setting), `packages/angular-typechecker/src/core/compiler-loader.ts`,
  `packages/angular-typechecker/src/executors/typecheck/executor.ts` (GATE A artifact header).
- Impact: a well-meaning "modernize the tsconfig" or "align with `type: commonjs`" change
  silently breaks every consumer install; the failure only appears at runtime after
  compile+pack, never at type-check time.
- Fix approach / mitigation in place: GATE A asserts the EMITTED bytes (not source), and
  the e2e specs assert `NO /ERR_REQUIRE_ESM/` on real installed tarballs (see
  `e2e/angular-typechecker-install-e2e/src/storybook-tarball.e2e.spec.ts` and the other
  `*.e2e.spec.ts`). Keep those assertions; never relax the `module` setting.

**Hand-vendored `@angular/compiler-cli` type surface:**
- Issue: the compiler-cli barrel `index.d.ts` does not resolve under `nodenext` (its
  re-exports are extensionless ESM paths that resolve empty), so the core consumes a
  hand-declared STRUCTURAL shim instead of the real typings. The shim can drift from the
  real upstream API on any Angular bump.
- Files: `packages/angular-typechecker/src/core/compiler-cli-types.ts` (the shim, with a
  long rationale header), `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts`
  + `packages/angular-typechecker/tsconfig.drift.json` (the build-time tripwire), and the
  `typecheck-drift` CI target in `.github/workflows/ci.yml`.
- Impact: if the real `api.Program` getters or the NG error-code encoding change and the
  shim is not updated, the engine could under-gather diagnostics silently.
- Fix approach / mitigation in place: the `tsconfig.drift.json` + `typecheck-drift` target
  break the build when the shim drifts from the real installed typings; greppable
  `// angular-typechecker: vendored -- <reason>` markers flag every intentional divergence.
  Widen the shim (never re-introduce a deep relative import into the dependency tree) as
  the engine grows.

**Two look-alike detectors with OPPOSITE scan targets:**
- Issue: in `finalize()`, `detectTemplateCheckAborted(diagnostics)` scans the PRE-filter
  diagnostic set (a whole-program TCB abort must fire even for an out-of-project poison),
  while `detectBundlerQueryImports(ts, reported)` scans the POST-filter kept set (it must
  name only TS2307 the consumer actually sees). They read almost identically but a refactor
  that "unifies" them onto one argument would break correctness in one direction or the other.
- Files: `packages/angular-typechecker/src/core/run-typecheck.ts` (the `finalize` function,
  around lines 683-693, with an explicit "MUST NOT unify them" comment).
- Impact: a future simplification could either silence the TCB-abort notice for
  out-of-project poison, or start naming node_modules `?query` imports the consumer cannot fix.
- Fix approach: preserve the two distinct scan targets; the inline comment documents the trap.

## Known Bugs

**(RESOLVED) npm releases 0.0.1-0.1.0 shipped raw `.ts` source, not compiled `.js`:**
- Symptoms: on a stock Nx 23 consumer, `nx add` / `nx g` / `nx typecheck` / `require()` all
  failed because the published tarball contained zero `.js` and no `src/index.js`.
- Root cause: `nx release publish` packed the source root instead of the built `dist`
  (missing `packageRoot`); the build itself was correct, and the e2e tarball audit tested
  the LOCAL dist pack, not the shipped artifact.
- Status: RESOLVED in 0.1.1 (2026-07-04) via the `packageRoot` fix; versions 0.0.1-0.1.0
  are deprecated on npm and marked GitHub pre-release. Current `version` is `0.2.0`
  (`packages/angular-typechecker/package.json`), publish pending the Release-PR.
- Residual concern: the e2e tarball-audit exercises the local dist pack. The authoritative
  guard against a repeat is the Verdaccio `nx add` install e2e that installs the actually
  published artifact (`e2e/angular-typechecker-install-e2e/src/global-setup.ts` builds +
  publishes dist once, and the install specs consume it by name). Keep the install-path
  e2e; a dist-only pack test would not have caught this class of packaging defect.

**(RESOLVED) `nx add` on yarn 4 (berry) intermittently threw `AggregateError [ECONNREFUSED]`:**
- Symptoms: yarn's resolution step succeeded against the local Verdaccio, then the fetch
  step was refused; only yarn flaked (npm/pnpm passed on the same host/run). Observed once
  during the Phase 18-04 wave on Windows arm64.
- Root cause: dual-stack `localhost` family mismatch -- Verdaccio bound the single family
  `localhost` resolved to first (IPv6 `::1`-only on the Windows host) while yarn 4's HTTP
  layer intermittently attempted IPv4 `127.0.0.1`.
- Status: RESOLVED 2026-07-09 by pinning the shared e2e local registry to the numeric IPv4
  loopback end-to-end. Files touched: root `project.json` (`listenAddress: 127.0.0.1`),
  `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (the `listenAddress` +
  `http://127.0.0.1:` SAFETY gate), and the loopback asserts in every install-e2e spec that
  reads `verdaccioUrl`. Full record: `.planning/debug/resolved/nx-add-yarn-flake.md`.
- Residual concern (HONEST CAVEAT from the debug session): a single green run cannot prove
  absence of a 1-in-many flake. Confidence is mechanism-level (numeric literals remove the
  DNS/family-selection step), not statistical; repeated Linux-CI runs remain the closing check.

## Security Considerations

**Type-checker must never report success on its own crash (correctness-as-security):**
- Risk: a type-checker that silently swallows an infrastructure failure and returns
  `success: true` is worse than none -- CI and agents would gate green on a broken check.
- Files: `packages/angular-typechecker/src/executors/typecheck/executor.ts` (the `catch`
  re-throws EVERY error except `TypecheckInfrastructureError`, which maps to
  `success: false`); `packages/angular-typechecker/src/core/run-typecheck.ts`
  (`throwIfInfrastructureFailure` applied at three stages -- config parse, walk union,
  post-compile -- plus a `result.program === undefined` defense-in-depth guard).
- Current mitigation: robust. The infra-vs-type invariant is detected by CODE only
  (`UNKNOWN_ERROR_CODE`/500), never by message text, so `errorCount` never counts a crash
  as a type error and a crash never masquerades as a clean verdict.
- Recommendation: preserve the re-throw-by-default posture; do not add a broad
  catch-and-return-false.

**e2e publish SAFETY gate against reaching the real npm registry:**
- Risk: the e2e globalSetup runs the REAL `nx release publish`; a misconfiguration could
  publish to `registry.npmjs.org`.
- Files: `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (refuses any registry
  URL not starting with `http://127.0.0.1:` before touching publish; strips all
  `npm_config_*`).
- Current mitigation: strong (explicit loopback allowlist + env scrub). Keep the gate; the
  numeric-IP pin also happens to be the yarn-flake fix.

**Supply-chain posture of the CI/release workflows is already hardened:**
- `.github/workflows/ci.yml` and `.github/workflows/release.yml` use SHA-pinned actions,
  top-level `contents: read`, `persist-credentials: false`, and tokenless OIDC publishing
  with provenance. No standing `contents: write` in CI; the irreversible tag+publish stays
  human-gated (see `AGENTS.md`). No committed secrets; `.env`-class files are not present.
- Note only (not a defect): `.npmrc` in the dev repo carries `legacy-peer-deps=true` (dev
  convenience for the `@nx/angular` peer cap); it does not reach consumers.

## Performance Bottlenecks

**Cold whole-program compile is the dominant cost (by design):**
- Problem: each run performs a full `performCompilation` whole-program type-check with an
  unconditional all-diagnostics gatherer; there is no per-file incremental path.
- Files: `packages/angular-typechecker/src/core/run-typecheck.ts`,
  `packages/angular-typechecker/src/core/gather-diagnostics.ts`.
- Cause: the tool's entire value is the COMPLETE whole-program check (TS + template +
  NG8xxx), which is inherently whole-program; the ESM module load of compiler-cli +
  typescript is the dominant cold-start cost (`durationMs` is captured from the very top of
  `runTypecheck` to reflect it honestly).
- Improvement path: Nx caching is the primary speed lever for consumers (the `init`
  generator seeds a cacheable `targetDefaults`; see `README.md` caching guidance).
  `NgtscProgram` per-file incremental checking is a deferred Future Requirement
  (WALK-FUT-02), not current debt. The `loadCompilerCli` memoization amortizes the module
  load across walked leaves within one process.

**Cache-key correctness is a footgun for consumers (documented):**
- Problem: because one target checks every leaf (including the spec leaf) in one run, the
  cache keys on ONE key. Using the `production` named input (which excludes `*.spec.ts`)
  instead of `default` would let a spec-only edit replay a stale PASS.
- Files: `packages/angular-typechecker/README.md` and the root `README.md` caching section;
  the `init` generator seeds the correct `default`-first inputs.
- Mitigation: documented prominently and seeded correctly by the generator; the risk is
  only if a consumer hand-writes the wrong inputs.

## Fragile Areas

**e2e tarball is shared across three projects -- cross-project runs MUST be serialized:**
- Files: `.github/workflows/ci.yml` (the `e2e` job runs `nx run-many -t test -p
  angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e
  --parallel=1`); `e2e/angular-typechecker-install-e2e/vitest.config.mts`
  (`singleFork` + `fileParallelism: false` + `sequence.concurrent: false`).
- Why fragile: all three e2e projects `npm pack`/consume the SAME dist tarball
  (`dist/packages/angular-typechecker/angular-typechecker-<ver>.tgz`) and `rmSync` it on
  teardown. Vitest serializes specs WITHIN a project, but `nx run-many` defaults to
  parallel, so without `--parallel=1` a sibling's teardown deletes the tarball mid-install
  (ENOENT). pnpm 11's supply-chain verification widened the window so the latent race trips
  deterministically. This flake only surfaced under CI parallel scheduling, not locally.
- Safe modification: never add a fourth e2e project or drop `--parallel=1` without a
  per-project isolated tarball; keep new tarball-consuming specs INSIDE
  `angular-typechecker-install-e2e` (inherits the serialized harness). The `-p` list line
  in ci.yml is also parsed by the GUARD-01 set-equality self-audit -- keep it on one line.

**e2e job is coupled to Node 24 for corepack:**
- Files: `.github/workflows/ci.yml` (the `e2e` job pins `node-version: 24` and runs
  `corepack enable` to put the yarn 4 shim on PATH for `nx-add-yarn.e2e.spec.ts`).
- Why fragile: corepack ships through Node 24 but is REMOVED in Node 25+. Bumping the e2e
  job's Node to >=25 will break `corepack enable` with no obvious error.
- Safe modification: if the e2e Node is bumped past 24, provision yarn via a pinned setup
  step (mirroring `pnpm/action-setup`) or gate the corepack step on the Node major. The
  coupling is documented inline in the workflow.

**Boundary-filter base path can silently disable the filter if left empty:**
- Files: `packages/angular-typechecker/src/core/run-typecheck.ts` (`resolveFilterBasePath`).
- Why fragile: an empty `basePath` makes the containment check treat `'' + '/'` as `/`,
  matching every absolute path on POSIX and silently disabling the project-boundary filter.
- Mitigation in place: `resolveFilterBasePath` explicitly guards `undefined` AND `''`
  (a bare `??` would miss `''`) and falls back to the tsconfig directory. Keep both checks.

**CI path-skip gate depends on a load-bearing quantifier:**
- Files: `.github/workflows/ci.yml` (`changes` job, `predicate-quantifier: 'every'`).
- Why fragile: with the default `some` quantifier, all-negation globs would wrongly mark a
  `.planning/*.md`-only PR as a code change (it is not under `docs/`, so `!docs/**` matches),
  so the heavy matrix would never skip. A prior CI skip-gate bug (Phase 7) surfaced only on
  a live run because Docker was unavailable locally, so `act` static checks could not catch it.
- Safe modification: preserve `predicate-quantifier: every`; validate path-gating changes
  against a real PR, not just `act -n`.

**`.tsx` component source is mis-named in the TCB-abort notice (advisory-only):**
- Files: `packages/angular-typechecker/src/core/run-typecheck.ts` (`normalizeShimFileName`).
- Why fragile: the compiler collapses both `.ts` and `.tsx` sources to the same
  `<name>.ngtypecheck.ts` shim, so a `.tsx`-sourced component is named as `<name>.ts` in the
  advisory notice. This affects only the notice's path string, never the verdict, counts, or
  the diagnostic codeframe, and `.tsx` Angular components are vanishingly rare.
- Fix approach if ever needed: resolve the source via the program's source-file map instead
  of string surgery on the shim name.

## Scaling Limits

Not a meaningful axis for this tool: it is a per-project static type-checker, not a
long-running service. The only "capacity" concern is per-project compile time (see
Performance), which Nx caching and `nx affected -t typecheck` address for large workspaces.

## Dependencies at Risk

**`@nx/devkit` pinned exact `23.0.1`; declared Nx-23-only intent is NOT enforced at install:**
- Files: `packages/angular-typechecker/package.json` (`dependencies["@nx/devkit"]:
  "23.0.1"`; no `nx` declared).
- Risk: the consumer's `nx` is constrained transitively by devkit's own peer
  (`>= 22 <= 24 || ^23.0.0-0`), which is WIDER than the project's Nx-23-only intent. You
  cannot narrow it via devkit's peer; the "Nx 23.x" support statement lives only in docs.
- Migration plan: bump devkit in lockstep with the target Nx version; keep the README
  requirements table accurate as the source of truth for the supported Nx range.

**`typescript` / `@angular/compiler-cli` peers are stable-Angular-22-only:**
- Files: `packages/angular-typechecker/package.json` (`peerDependencies:
  @angular/compiler-cli "^22.0.0"`, `typescript ">=6.0.0 <6.1.0"`).
- Risk: `^22.0.0` excludes Angular 22 pre-releases (`-next` / `-rc`) by semver rules, and
  the TS window is deliberately narrow (Angular 22 supports only TS 6.0.x). A consumer on a
  22.x pre-release needs `--legacy-peer-deps`. Verification is intentionally done only
  against stable Angular 22.0.4, never `next`/`rc`.
- Migration plan: widen the range only after verifying against the new stable; widening is
  non-breaking under 0.x semver. Documented in `README.md` (Requirements note).

**`@storybook/angular@10.4.6` peer cap forces install-time overrides (external, not ours):**
- Risk: `@storybook/angular@10.4.6` still caps its Angular peer at `>=18 <22` (TS `^4.9 ||
  ^5`), so installing it on Angular 22 / TS 6 needs `--legacy-peer-deps` (or `--force`); on
  pnpm, `nx add` can then hit `ERR_PNPM_IGNORED_BUILDS`. That Storybook version also emits
  48 TS 6 errors from its own bundled `.d.ts` (suppressed as node_modules; never affect the
  consumer's result).
- Files: `packages/angular-typechecker/README.md` (Storybook > Things to know);
  `e2e/angular-typechecker-install-e2e/src/storybook-tarball.e2e.spec.ts` (installs
  angular-typechecker BEFORE Storybook so the override-free `nx add` peer check runs against
  a Storybook-free tree).
- Note: this is a Storybook install constraint, NOT an angular-typechecker one -- the tool
  applies no version gate. Documented, never gated.

**`nx add` on pnpm workspaces hits `ERR_PNPM_IGNORED_BUILDS` (a pnpm<->nx-add interaction):**
- Risk: `nx add` runs a fixed child `pnpm add -Dw angular-typechecker@latest` and forwards
  NO flags. pnpm 11's `strictDepBuilds` (default true) makes any `pnpm add`/`pnpm install`
  exit non-zero while the workspace carries an unapproved build script (here `nx` itself has
  a postinstall). nx add treats that as an install failure and aborts before `init`.
  angular-typechecker ships ZERO install/build scripts of its own.
- Files: `e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.e2e.spec.ts` (documents +
  exercises both workarounds); `README.md` (pnpm install note). Memory:
  `nx-add-fails-on-pnpm-workspaces`.
- Workarounds (encoded in the e2e, deliberately NOT surfaced as a README caveat since it is a
  PM issue): (A) approve the build via `allowBuilds: { nx: true }` in `pnpm-workspace.yaml`
  (what `pnpm approve-builds` writes on pnpm 11); or (B) skip `nx add` -- `pnpm add -Dw
  angular-typechecker@latest --ignore-scripts` then `nx g angular-typechecker:init` (the flag
  only applies to a DIRECT install, not through `nx add`). pnpm 11 removed
  `onlyBuiltDependencies` in favor of `allowBuilds`.

**`fallow` GSD structural pre-pass is a silent no-op on fallow 2.x (CLI drift):**
- Risk: the GSD `code_quality.fallow` integration uses an old CLI contract; on fallow 2.x it
  is a silent no-op.
- Files: `.planning/config.json` (`code_quality.fallow.enabled: false` -- intentionally off
  for the GSD pre-pass); the working gate is wired directly in `.github/workflows/ci.yml`
  (the `fallow` job runs `npx fallow audit --format human --base origin/main`, new-only,
  `contents: read`).
- Mitigation: fallow is gated in CI via the manually-verified 2.x invocation, not the GSD
  pre-pass. Do not "enable" the GSD pre-pass expecting it to do anything.

## Missing Critical Features

All of the following are DELIBERATE deferrals recorded as Future Requirements in
`.planning/STATE.md` (Deferred Items) and `.planning/RETROSPECTIVE.md`, not accidental gaps.
They are listed so a consumer request maps to a known decision.

- **Machine-readable reporters (JSON / SARIF):** non-goal in v0.x. The only output is the
  Angular compiler's human-readable `formatDiagnostics` written to raw stdout
  (`packages/angular-typechecker/src/executors/typecheck/executor.ts` writes
  `process.stdout.write(report)`; `render-report.ts`). Blocks: no structured CI ingestion
  beyond a `tsc`-style problem matcher.
- **Standalone CLI binary:** deferred (would own the literal OS exit code `2`). Today the
  only entry point is the Nx executor; `package.json` declares no `bin`.
- **Faithful per-file template recovery after a TCB-generation Fatal (NG3004):** deferred
  (REP-RES-02b; needs `NgtscProgram`). Currently a single NG3004 aborts whole-program
  template-check-block generation, SUPPRESSING surviving files' template/NG8xxx diagnostics.
  This is handled honestly (a loud `warnTemplateCheckAborted` notice + a non-clean verdict in
  `executor.ts` / `run-typecheck.ts`), never silently, but the coverage gap is real until the
  offending NG3004 is fixed.
- **`.mdx` / `.tsx` type-checking:** `.mdx` is never type-checked; a `.tsx` is checked only
  when `compilerOptions.jsx` is set. Surfaced as a verdict-neutral advisory
  (`notTypeCheckedDeclaredFiles`, `warnNotTypeChecked`), deferred as SB-08.
- **`NgtscProgram` per-file incremental + `createNodesV2` per-leaf targets:** deferred
  additive engine work (WALK-FUT-01/02).

## Test Coverage Gaps

**Heavy tarball-install e2e runs on Linux only:**
- What's not tested: the `nx add` / tarball-install path across OSes; the e2e gate in
  `.github/workflows/ci.yml` runs only on `ubuntu-latest` (RD-03), while the unit/integration
  matrix covers Windows + macOS.
- Risk: an OS-specific packaging/install regression (path handling, symlink/junction, corepack
  shim) on Windows/macOS would not be caught by the install-path e2e. Unit + integration
  coverage does span the OS matrix, so pure engine regressions are covered.
- Priority: Medium.

**Yarn install-path flake is not statistically closed:**
- What's not tested: repeated runs proving the yarn 4 ECONNREFUSED family-race is gone.
- Files: `e2e/angular-typechecker-install-e2e/src/nx-add-yarn.e2e.spec.ts`;
  `.planning/debug/resolved/nx-add-yarn-flake.md`.
- Risk: the fix is mechanism-level correct (numeric IPv4 pin removes DNS/family selection),
  but a 1-in-many flake cannot be disproven by a single green run; repeated Linux-CI runs are
  the closing check.
- Priority: Low (mechanism-level confidence is high).

**`act` static CI checks cannot substitute for a live run when Docker is unavailable:**
- What's not tested locally: changes-dependent CI logic (the path-skip gate) -- `act -n`
  cannot schedule it without Docker, which is unavailable on the dev box. A real skip-gate bug
  shipped once (Phase 7) and surfaced only on a live PR run.
- Files: `.github/workflows/ci.yml` (`act-compat`, `lint-workflows` jobs are parseability /
  static checks, not execution).
- Risk: path-aware or condition-gated workflow changes can pass static validation yet behave
  wrong at runtime.
- Priority: Medium -- gate path-aware CI logic changes on a real PR run, not just static checks.

---

*Concerns audit: 2026-07-09*
