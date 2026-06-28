# Phase 6: Full e2e Matrix + CI - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Mode:** --auto --chain --analyze (research-first; --research passed to plan-phase)

<domain>
## Phase Boundary

Make the executor's correctness GATED and CROSS-PLATFORM. Two deliverables, the slow
backstop that the earlier phases deliberately deferred to here:

1. **TEST-03 -- the full project-type e2e matrix.** Validate the executor end-to-end
   against the INSTALLED tarball across ALL FIVE project types -- (1) application,
   (2) local (non-buildable) library, (3) buildable library, (4) publishable library,
   (5) spec tsconfig -- PLUS a **pnpm fixture** (the symlinked node_modules layout that
   would break a naive, non-realpath project-boundary filter) and a **mixed-case path
   assertion** (the case-insensitive-FS bug invisible under npm/Linux). Today only ONE
   project type (an application, `consumer-app`) is validated, by the Phase-5
   `angular-typechecker-install-e2e` smoke.

2. **CI-01 -- the cross-OS / multi-Node GitHub Actions gate.** Run unit + integration on
   a Node {22,24,26} x {Linux,Windows,macOS} matrix (free standard public-repo runners),
   with the heavy e2e / tarball-install gate Linux-only. The full matrix must be green and
   become the REQUIRED gate before merge/publish. Today there is NO test-CI workflow --
   only `.github/workflows/release.yml` (OIDC publish).

This phase clarifies HOW to build the matrix + CI for what is already scoped. LOCKED and
NOT re-decided here: the core engine + executor + cacheable target + filtering (Phases
1-4); the dependency/manifest/peer model + tarball audit + e2e smoke harness (Phase 5);
the OIDC publish pipeline (Phase 5/5.1). OUT of scope (-> Phase 7 / deferred): the
Release-PR workflow + branch-protection RULESET SWITCH itself (Phase 6 only DEFINES the
required-check name Phase 7 will consume); clean public changelog; `createNodesV2`
inference, `nx add`/`ng add`, CLI bin, Angular builder, JSON/SARIF reporters; OpenSSF
Scorecard / harden-runner / CodeQL (continuous-assurance tooling deferred from Phase 5).

**Process note:** decisions below are grounded in (1) prior context (`05-CONTEXT.md`
honesty invariant, `04-CONTEXT.md`/`04-LEARNINGS.md` serialized-e2e + env-isolation
patterns, STATE Blockers/Concerns), (2) live codebase scout (existing `install-e2e` +
`cache-e2e` harnesses, `filter-diagnostics.ts`, `nx.json`, `.npmrc`, `release.yml`), and
(3) a **2-researcher parallel pass** (lenses: CI/GitHub-Actions-matrix-design; e2e-fixture
/ pnpm / cross-OS-path-design) that re-validated current 2026 GitHub Actions facts + the
installed Nx 23.0.1 / Angular 22.0.4 generator surface + local public clones (`nx-verdaccio`,
`nx`, `analog`). Research findings are folded in inline and tagged `[research]`.
</domain>

<decisions>
## Implementation Decisions

### CI workflow + matrix (CI-01)

- **D-01 `[research]`: Unit + integration matrix = FULL 3-Node x 3-OS = 9 cells, `fail-fast: false`.**
  `strategy.matrix: { node: [22, 24, 26], os: [ubuntu-latest, windows-latest, macos-latest] }`.
  Standard runners (Linux/Windows/macOS) are FREE + unquota'd for PUBLIC repos in 2026 (the
  10x macOS multiplier applies only to PRIVATE-repo quota, never public) -- so there is no
  cost pressure to trim. The plugin's core risk is precisely cross-OS / cross-Node behavior
  (CJS->ESM `import()` bridge, path separators, `node16`/`nodenext` resolution), which a 3x3
  covers exactly. `fail-fast: false` so one red cell never masks others. Pin Node to MAJOR
  (`22`/`24`/`26`); do NOT pin `architecture` (lets `macos-latest` = arm64/M-series resolve
  the native Node binary -- 22/24/26 all ship macOS-arm64 builds). Note: Node 26 is
  Current/non-LTS until ~Oct 2026 but is inside `engines`, so testing it is correct +
  forward-looking (accept occasional churn).

- **D-02 `[research]` -- CROSS-PHASE CONTRACT: a single aggregate gate job named `ci` is the
  required status check.** Matrix cell check-names are dynamic/unstable and cannot be
  required individually without an admin adding each by hand. So add ONE job
  (`id: ci`, `name: ci`) with `needs: [test, e2e]`, `runs-on: ubuntu-latest`, `if: always()`,
  whose only step fails unless every dependency succeeded -- use the robust form
  `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` (NOT
  `needs.test.result != 'success'`, which can read `success` if any single cell passed under
  `fail-fast:false`). **`ci` is the EXACT name Phase 7's "Default branch" ruleset will require
  -- lock it; renaming it later breaks branch protection.** Pair the required check with
  "require branches up to date" to close the brief register-late window.

- **D-03 `[research]`: e2e is a SEPARATE Linux-only job, selected by EXPLICIT project list.**
  Today the heavy e2e projects (`angular-typechecker-install-e2e`, `angular-typechecker-cache-e2e`,
  and the NEW matrix-e2e from D-08) share the SAME `test` target name as the unit suite --
  so `nx run-many -t test` would run unit AND e2e together. Split by PROJECT, not target:
  the `e2e` job runs `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`
  on `ubuntu-latest` only, on ONE Node version (recommend Node 24, matching `release.yml`);
  the matrix `test` job runs `-p angular-typechecker` (+ any OS-portable integration projects).
  Use `nx run-many` (deterministic), NOT `nx affected` (the gate must always run so `ci` has
  consistent meaning; the e2e graph is tiny + `implicitDependencies:["angular-typechecker"]`
  makes almost everything "affected" anyway). Set `NX_DAEMON: false` job-wide (defense-in-depth;
  the specs already set it internally). Do NOT introduce Nx Cloud. *Runner-up (a maintainer
  style call, NOT auto-locked as superior): a dedicated `e2e` target on the e2e projects --
  cleaner `nx run-many -t e2e` split, but a 2+ file `project.json` edit; explicit-project-list
  wins on zero-config-change + determinism.*

- **D-04 `[research]`: Install + cache = `npm ci` + `actions/setup-node` `cache: npm`; NO
  cross-job Nx cache, NO Nx Cloud.** `npm ci` auto-honors the committed root `.npmrc`
  (`legacy-peer-deps=true`) -- no flag needed (this is the dev-repo Angular-22-vs-`@nx/angular`-23
  reconciliation, correct for the workspace install). `actions/setup-node` with
  `node-version: ${{ matrix.node }}` + `cache: npm` (built-in, keyed on `package-lock.json`,
  free, cross-OS). Skip hand-rolled `actions/cache` for `.nx/cache` across 9 cells (fragile
  cross-OS keys for a 3-project graph; within-job Nx caching is automatic; the e2e specs use
  `--skip-nx-cache` for their differentials anyway). Do NOT set `registry-url` in CI (it is
  load-bearing for OIDC in `release.yml` only; in test CI it just writes a noisy `.npmrc`).

- **D-05 `[research]`: Match `release.yml`'s hardening envelope + reuse its action SHAs.**
  Top-level `permissions: { contents: read }`; `persist-credentials: false` on every checkout;
  full 40-char SHA pins with `# vN` trailing comments; a `concurrency` group
  (`${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`) to cancel
  superseded PR runs. Triggers: `pull_request` + `push` to the default branch (`main`).
  Reuse the EXACT SHAs `release.yml` already pins so Dependabot (`github-actions` ecosystem)
  bumps both workflows in lockstep: `actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1`,
  `actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0`. (Re-verify both SHAs
  resolve at execution time; latest majors are checkout v7 / setup-node v6 -- adopting them is
  fine too, Dependabot converges either way.)

- **D-06 `[research]`: Provision pnpm via `pnpm/action-setup` (SHA-pinned), NOT `corepack enable`.**
  Corepack is removed from Node 25+, and the matrix runs Node 26 -- so the durable
  provisioning for the Linux-only pnpm fixture (D-09) is the `pnpm/action-setup` action (pin a
  `version:` matching the committed fixture lockfile). pnpm auto-switches to frozen-lockfile in
  CI; commit a `pnpm-lock.yaml` for the fixture or pass `--no-frozen-lockfile` for the tmp install.

### Project-type e2e matrix (TEST-03)

- **D-07 `[research]`: Fixture topology = ONE multi-project consumer Nx-workspace fixture,
  install the tarball ONCE, run the executor against 5 targets.** The binding constraint is
  cost: the e2e tier is Linux-only, fully serialized (`singleFork`, `fileParallelism:false`),
  and `npm install` of the Angular 22 + Nx 23 tree is the long pole -- five independent
  per-type fixtures would pay that install cost 5x for no extra signal (the type-by-type
  logic is PM/OS-independent). A single workspace also exercises the REAL cross-project graph
  (`includeDeps` crossing real lib boundaries) and mirrors a real consumer. Preserve failure
  isolation by running each project type in its own `it()` / `it.each` over the 5 targets so a
  per-type failure is named, with independent green/injected-error assertions (reuse the
  Phase-5 green+`TS2322` pairing). The fixture is self-contained (its own `nx.json`, NO
  `tsconfig.base.json` extension, NO source path-aliases -- mirror `consumer-app`), wires the
  PUBLISHED executor id `angular-typechecker:angular-typecheck`, and installs FROM the tarball.
  **The 5 type shapes (Nx 23 / Angular 22, validated against installed schemas):** app =
  `tsConfig: tsconfig.app.json`; local non-buildable lib = `projectType:"library"`, no build
  target, `tsConfig: tsconfig.lib.json` (mirror `libs/typecheck-consumer`); buildable lib =
  library + a `build` target (`@nx/angular:ng-packagr-lite` + `ng-package.json`), type-check
  still at `tsconfig.lib.json`; publishable lib = library + `build` (`@nx/angular:package`) +
  `importPath` + per-lib `package.json`/`ng-package.json`; spec tsconfig = a target whose
  `tsConfig: tsconfig.spec.json` (baseline shifts to the spec tsconfig dir; the included file
  set becomes the `*.spec.ts` sources + test-runner ambient types -- a file set the app/lib
  targets EXCLUDE, so it is a genuinely distinct check). The executor never RUNS the build
  targets -- it only reads each project's `tsConfig` -- so build-target presence alone
  distinguishes buildable/publishable. **See OQ-1: shape buildable/publishable WITHOUT a
  `@nx/angular` dep if possible, to preserve the clean-install honesty invariant.**

- **D-08 `[research]`: New dedicated `angular-typechecker-matrix-e2e` Nx project for the
  5-type + pnpm specs** (do NOT pile onto `install-e2e`). The repo precedent is one e2e
  project per concern (`cache-e2e` = TEST-04, `install-e2e` = TEST-05/packaging), each cloning
  the same serialized `vitest.config.mts` + re-declaring `buildCleanEnv`. Vitest serialization
  is per-Nx-target, so a separate project keeps the fast packaging-audit specs in `install-e2e`
  from being blocked behind the slow matrix, lets the two be distinct gate jobs, and is
  independently cacheable. Clone `install-e2e`'s `vitest.config.mts` verbatim (300000 timeouts,
  `environment:'node'`, `pool:'forks'`, `singleFork:true`, `fileParallelism:false`,
  `sequence.concurrent:false`), copy `buildCleanEnv` + the pack-to-tmp logic, set
  `implicitDependencies:["angular-typechecker"]`, tag `scope:fixture`.

- **D-09 `[research]`: pnpm fixture = ONE fixture that BOTH runs under the symlinked layout
  AND is a realpath regression-guard.** Install the packed tarball under pnpm in a tmp dir
  (`pnpm add <tgz>` or a `file:` dep + `pnpm install`), run the executor green/red with
  `includeDeps:true` so pnpm's `.pnpm/`-symlinked store is genuinely traversed, AND construct
  an in-project source resolved THROUGH a pnpm symlink such that a naive (non-realpath)
  `startsWith(basePath)` filter would MIS-SUPPRESS an in-project diagnostic -- assert that
  diagnostic is KEPT (and an out-of-project one is correctly suppressed via realpath). One
  pnpm install, regression-guard semantics. Reject a full 5-type duplicate under pnpm (the
  type breakdown is PM-independent; the Linux-only serialized gate cannot afford a second full
  Angular+Nx install for no new signal). **See B-02: empirically confirm `ts.sys.realpath`
  actually resolves the `.pnpm/` link in the installed layout before locking the construction.**

- **D-10 `[research]`: The mixed-case path assertion lives in the CROSS-OS unit + integration
  tier, NOT the Linux-only e2e gate.** The case-insensitive-FS bug only manifests on
  macOS/Windows; the e2e gate is Linux-only (case-sensitive), so an e2e mixed-case assertion is
  DEAD CODE on the exact runner that executes it. The unit suite
  (`packages/angular-typechecker/src/core/filter-diagnostics.spec.ts`) runs on ALL THREE OS in
  the CI-01 matrix and ALREADY forces `useCaseSensitiveFileNames:false` with mixed-case inputs
  -- extend it (more mixed-case in-project / out-of-project / `node_modules`-segment cases under
  both case modes) so the fold logic is gated on the Windows/macOS legs deterministically.
  Separately add ONE integration test (all 3 OS) asserting the executor/host derives
  `useCaseSensitiveFileNames` from the real `ts.sys`/program host -- on the macOS/Windows matrix
  legs this becomes a real case-insensitive exercise; on Linux it asserts the case-sensitive
  path. This satisfies the Phase-6 "mixed-case path assertion" success criterion where it
  actually bites. (If a reviewer insists on a fixture-level mixed-case path, add it to the
  pnpm/integration fixture but DOCUMENT that it only has teeth on the macOS/Windows legs.)

### Claude's Discretion
- Exact CI workflow filename (`ci.yml` recommended); the `concurrency` group string; whether
  the Linux-only e2e runs as ONE `e2e` job or split (install-e2e + matrix-e2e as separate jobs
  for finer gate granularity -- either is fine, both feed the single `ci` gate via `needs`).
- Exact fixture/project names (`angular-typechecker-matrix-e2e`, `fixtures/consumer-workspace`,
  per-type project names); the exact pnpm version pin; whether the e2e job pins Node 24 vs 22.
- Whether to also run `npm i -g npm@latest` before `npm ci` in CI (parity with `release.yml`;
  optional for plain `npm ci`).
- The precise construction of the D-09 regression symlink + the D-10 extra unit cases.
- Whether unit + integration share one matrix `test` target or integration gets its own.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 spec + scope (this repo)
- `.planning/ROADMAP.md` Phase 6 section -- goal + 3 success criteria (5 project types vs
  installed tarball + pnpm + mixed-case; Node 22/24/26 x Linux/Windows/macOS matrix, e2e
  Linux-only; full matrix green + required gate). Phase 7 section -- the DOWNSTREAM consumer:
  its "Default branch" ruleset requires "the Phase-6 CI status checks" (-> the `ci` gate name,
  D-02) and it owns the branch-protection SWITCH (Phase 6 only DEFINES the check).
- `.planning/REQUIREMENTS.md` -- **TEST-03** (5 project types), **CI-01** (matrix), and
  **OUT-02** (realpath-normalized / pnpm-symlink / case-insensitive-FS-safe filtering -- the
  property the pnpm fixture + mixed-case assertion BACKSTOP).
- `.planning/PROJECT.md` -- locked stack (Nx 23 / Angular 22 / TS 6 / Node 22|24|26),
  Constraints (Windows arm64 dev; CI on free Linux/Windows/macOS public runners;
  legacy-peer-deps caveat), the e2e Key Decision ("e2e blends both prior approaches: fixtures
  fast tier + tarball CI gate").

### Phase 1-5 carry-forwards (this repo) -- MUST read
- `.planning/phases/05-packaging-publish-hardening-e2e-smoke-mvp/05-CONTEXT.md` -- the e2e
  smoke harness shape (D-17..D-22) this phase EXTENDS; **B-03 honesty invariant: a clean
  consumer install (no `legacy-peer-deps`) SUCCEEDS on stable Angular 22 + Nx 23 -- do NOT
  regress it** (the OQ-1 buildable/publishable-fixture caveat); D-21 serialized e2e config.
- `.planning/phases/04-nx-executor-adapter-cacheable-target/04-LEARNINGS.md` +
  `04-CONTEXT.md` -- the nested-`nx run` env trap (strip `NX_*`), `buildCleanEnv`,
  `NX_DAEMON=false`, `--no-color` rejection (use `FORCE_COLOR=0`/`--output-style=static`),
  dual-key `nx.json` (PUBLISHED executor id for consumer fixtures), serialized e2e determinism.
- `.planning/STATE.md` Blockers/Concerns -- "pnpm-symlink + case-insensitive FS path filtering
  is invisible under npm/Linux -- the pnpm fixture + mixed-case assertion (Phase 6) is the
  backstop" (the literal charter for TEST-03's two special fixtures); cache-correctness Nx gaps.

### Current source this phase grows / depends on (this repo)
- `.github/workflows/release.yml` -- the hardening + SHA-pin style + action SHAs to MATCH/REUSE
  (D-05); do NOT modify it (Phase 5.1 froze it OIDC-only).
- `.github/dependabot.yml` -- already tracks the `github-actions` ecosystem; the new CI
  workflow is auto-covered.
- `e2e/angular-typechecker-install-e2e/` -- `src/install-smoke.int.spec.ts` (the pack-to-tmp +
  green/`TS2322` pattern to reuse), `vitest.config.mts` (serialized config to CLONE),
  `fixtures/consumer-app/` (the self-contained application fixture to template the 5-type
  workspace on); also hosts `tarball-audit` + `release-hygiene` specs (leave them be).
- `e2e/angular-typechecker-cache-e2e/` -- the second serialized-e2e precedent (one project per
  concern); clone-reference for the new `matrix-e2e` project.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` + `filter-diagnostics.spec.ts`
  -- the OUT-02 realpath-first / case-fold logic the pnpm + mixed-case fixtures exercise; the
  spec ALREADY has mixed-case `useCaseSensitiveFileNames:false` coverage to EXTEND (D-10).
- `nx.json` -- `namedInputs`/`targetDefaults` (the executor-id-keyed cacheable target defaults,
  dual published + dev-scoped keys); the `release` block (scoped to `angular-typechecker`).
- `.npmrc` -- `legacy-peer-deps=true` (CI workspace install inherits it; the e2e clean-install
  fixtures must NOT inherit it -- B-03).
- `libs/typecheck-consumer/`, `libs/typecheck-consumer-dep/`, `apps/ng-spike-app/` -- in-repo
  shape references for the local-lib / dep / application project types.

### External reference sources (read-only; re-validate against installed versions)
- `D:/projects/github/push-based/nx-verdaccio/.github/workflows/` + e2e -- real Nx-plugin CI +
  install-fixture patterns (Nx 22-era; re-validate on Nx 23). `NX_NON_NATIVE_HASHER` CI env.
- `D:/projects/github/nrwl/nx/.github/workflows/` -- `@nx/js` local-registry + e2e
  plugin-install helpers; multi-project-type testing.
- `D:/projects/github/analogjs/analog/.github/workflows/` -- Angular-22 Nx plugin CI +
  `concurrency` cancel-in-progress pattern.

### External docs / facts (URLs; re-validate at execution -- this area moved in 2025-2026)
- GitHub-hosted runners reference (labels -> OS/arch; `ubuntu-latest`=Ubuntu 24.04 x64,
  `windows-latest`=Win Server 2025 x64, `macos-latest`=macOS 15 arm64/M1):
  https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- Actions billing/usage -- standard runners FREE + unquota'd for PUBLIC repos (10x macOS
  multiplier is private-repo-quota only): https://docs.github.com/en/actions/concepts/billing-and-usage
  ; https://docs.github.com/en/billing/reference/actions-runner-pricing
- Matrix + required-check "aggregate gate job" pattern: https://github.com/orgs/community/discussions/26822
- `actions/setup-node` arm64 macOS Node resolution (do not pin `architecture`):
  https://github.com/actions/setup-node/issues/462
- pnpm CI (action-setup; frozen-lockfile): https://pnpm.io/continuous-integration ;
  Corepack removed from Node 25+: https://github.com/nodejs/corepack
- Nx buildable & publishable libraries: https://nx.dev/docs/concepts/buildable-and-publishable-libraries
  ; @nx/angular generators (`library --buildable/--publishable`, `@nx/angular:package` /
  `:ng-packagr-lite`): https://nx.dev/docs/technologies/angular/generators
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`install-e2e` harness** (`e2e/angular-typechecker-install-e2e/`): `vitest.config.mts`
  (serialized: forks/singleFork/no-parallel/300000-timeouts/node-env) -> CLONE for the new
  `matrix-e2e`. `install-smoke.int.spec.ts` `buildCleanEnv` (strips 8 cache-defeating `NX_*`
  vars + both legacy-peer-deps env forms; sets `NX_DAEMON=false`, `FORCE_COLOR=0`), the
  `nx build --skip-nx-cache` -> `npm pack --json` from dist -> `cpSync` fixture into
  `mkdtempSync(tmpdir())` -> `npm install <tgz>` (clean, empty `.npmrc`, redirected
  `npm_config_userconfig`) -> `run(cwd)` (execSync `nx run <target> --output-style=static`,
  catch for non-zero) -> green/`TS2322` assertion shape -> REUSE verbatim for all 5 types + pnpm.
- **`fixtures/consumer-app/`**: self-contained mini Nx workspace (own `nx.json`, no
  `tsconfig.base.json`, no path-alias, PUBLISHED executor id, `includeDeps:true`) -> template
  the multi-project consumer-workspace fixture on it.
- **`filter-diagnostics.spec.ts`**: already asserts realpath-symlink + `useCaseSensitiveFileNames:false`
  mixed-case inputs -> EXTEND for D-10 (the cheapest correct home for the mixed-case assertion).
- **`cache-e2e`**: the second serialized-e2e project -- precedent for "one e2e project per
  concern" + the clone pattern.
- **`release.yml`** hardening envelope + SHA pins -> MATCH + reuse for the new CI workflow (D-05).

### Established Patterns
- One serialized e2e Nx project per concern, each cloning the same `vitest.config.mts` +
  re-declaring `buildCleanEnv` (cache-e2e, install-e2e -> matrix-e2e is the third).
- Committed-fixture-as-installed-consumer: pack the FRESH dist, install the tarball into a
  per-run tmp copy, run by the PUBLISHED executor id, never mutate the committed fixture.
- Clean-install honesty (B-03): the e2e fixtures install with NO `legacy-peer-deps` override so
  a real consumer `ERESOLVE` would surface; the dev-repo `.npmrc` override is stripped per-run.
- OUT-02 boundary filter: `realpath()` FIRST, then `\\`->`/`, then `toLowerCase()` only when
  `useCaseSensitiveFileNames===false`; `node_modules` excluded by path SEGMENT (not substring);
  `includeDeps:true` folds everything back.

### Integration Points
- source -> `@nx/js:tsc` -> dist -> `npm pack` tarball -> `npm install`/`pnpm add` into a tmp
  consumer-workspace -> `nx run <type>:angular-typecheck` (PUBLISHED id) -> resolves
  `node_modules/angular-typechecker/executors.json` -> implementation `.js`. The matrix-e2e
  walks this for all 5 types (npm) + the pnpm symlinked layout.
- CI: `pull_request`/`push` -> `test` matrix (3 Node x 3 OS, unit+integration) + `e2e`
  (Linux-only, explicit project list) -> aggregate `ci` gate (`needs`/`if:always`) -> Phase 7's
  ruleset requires `ci`.

### Prior-art learnings (sanitized; inspiration only)
- The public Nx 19.8 sandbox: `injectTypeScriptError` recipe, fixture-discovery trap (Nx skips
  gitignored/excluded dirs), `NX_DAEMON=false`, Vitest-over-Jest for ESM compiler-cli -- all
  re-validated on Nx 23; copy no removed-generator flags.
</code_context>

<specifics>
## Specific Ideas

- **CI matrix:** `strategy: { fail-fast: false, matrix: { node: [22,24,26], os: [ubuntu-latest, windows-latest, macos-latest] } }`; `actions/setup-node` `node-version: ${{ matrix.node }}` + `cache: npm`; `npm ci`.
- **Aggregate gate (the Phase-7 required check):** job `ci`, `needs: [test, e2e]`, `if: always()`, step `run: if ${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}; then exit 1; fi`.
- **e2e job (Linux-only):** `runs-on: ubuntu-latest`, Node 24, `NX_DAEMON: false`, `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`; pnpm via `pnpm/action-setup@<sha>`.
- **Action pins (reuse release.yml):** `actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1`, `actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0`; top-level `permissions: { contents: read }`, `persist-credentials: false`, `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`.
- **5-type fixture targets:** app (`tsconfig.app.json`), local lib (`tsconfig.lib.json`, no build), buildable lib (`@nx/angular:ng-packagr-lite` build target), publishable lib (`@nx/angular:package` + `importPath`), spec (`tsconfig.spec.json`).
- **pnpm install of tarball:** `pnpm add <abs-path-to.tgz>` in the tmp consumer (or `file:` dep + `pnpm install --no-frozen-lockfile`).
</specifics>

<deferred>
## Deferred Ideas

All roadmap-scoped or out-of-milestone (NOT new in-phase capabilities):
- **The branch-protection RULESET SWITCH** (enable "Default branch", delete temporary "v0.0.1")
  + **the Release-PR workflow** + **clean public changelog** -> Phase 7. Phase 6 only DEFINES
  the `ci` required-check NAME that Phase 7's ruleset will reference (D-02).
- **OpenSSF Scorecard action, StepSecurity harden-runner, CodeQL, signed commits/tags** ->
  later (continuous-assurance tooling; deferred from Phase 5 D-16).
- **Nx community-registry-listing PR** (`approved-community-plugins.json`) -> post-publish
  human follow-up (eligibility already met: devkit-as-dependency + `repository.url` + e2e tests).
- **A dedicated `e2e` Nx target** on the e2e projects (vs the D-03 explicit-project-list split)
  -> a possible later refactor; not needed for v0.0.1.
- **A full 5-type matrix duplicated under pnpm** -> rejected (no new signal; the type breakdown
  is PM-independent and the Linux-only gate cannot afford a second full install).

None of the discussion drifted outside the Phase 6 boundary.

## OPEN QUESTIONS / INVESTIGATE (flagged -- recommended default given, NOT silently locked)

- **OQ-1 [INVESTIGATE -> escalate if non-trivial]: buildable/publishable fixtures vs the
  Phase-5 "clean consumer install needs NO `legacy-peer-deps`" honesty invariant (B-03).**
  Committing `@nx/angular:ng-packagr-lite` / `@nx/angular:package` build targets would normally
  require the fixture's `package.json` to dev-depend on `@nx/angular@23.0.1`, which RE-INTRODUCES
  the Angular-22-vs-`@nx/angular`-23 peer mismatch that the root `.npmrc` papers over -- and the
  matrix-e2e installs CLEAN (no override) to honor B-03. IMPACT: MEDIUM-HIGH (touches a
  deliberate Phase-5 invariant; a wrong shape either masks a real `ERESOLVE` or burns the
  honesty signal). CONFIDENCE: MEDIUM (a clear path exists but is unproven on this stack).
  **RECOMMENDED DEFAULT:** HAND-AUTHOR the buildable/publishable `project.json` build targets +
  `ng-package.json` WITHOUT adding `@nx/angular` to the fixture's deps -- the executor never RUNS
  the build, it only reads `tsConfig`, so the type differentiation is structural and needs no
  `@nx/angular` install. RESOLUTION POINT: the planner spikes a clean `npm install` of the
  shaped fixture FIRST; if a clean install ERESOLVEs in a way hand-authoring cannot avoid, the
  remediation (scope the override to that one fixture with a documented rationale vs widen vs
  await `@nx/angular` 23.1.x) is ESCALATED, not auto-patched.

- **B-02 [DISCOVER empirically]: the D-09 pnpm regression-guard construction.** Whether
  `ts.sys.realpath` actually resolves the `.pnpm/` symlink in the installed layout such that a
  non-realpath `startsWith` filter would genuinely FAIL (so the guard has teeth). CONFIDENCE:
  MEDIUM on the exact symlink construction. RESOLUTION: validate during execution with a small
  probe before asserting; if pnpm's layout does not produce a boundary-crossing realpath, fall
  back to asserting the symlinked layout simply WORKS (option (a)) + keep the realpath unit
  coverage as the load-bearing guard.

</deferred>

---

*Phase: 6-Full e2e Matrix + CI*
*Context gathered: 2026-06-29*
