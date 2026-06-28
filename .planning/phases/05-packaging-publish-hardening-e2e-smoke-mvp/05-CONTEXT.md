# Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `angular-typechecker` PUBLISHABLE and prove it installs-and-runs end-to-end as a Vertical-MVP slice: a correct dependency/manifest model, `executors.json`/`schema.json`/compiled `.js` present in the tarball (audited, not source-tree-checked), a supply-chain-hardened `nx release` path (OIDC + provenance + hardened CI + SECURITY.md), all proven by ONE early e2e smoke that installs the packed artifact and runs the executor from the installed package.

Requirements covered: **PKG-01** (package.json deps model + `files`/`exports`/`executors` + `nx`/`nx-plugin` keywords for registry listing), **PKG-02** (`executors.json`/`schema.json` v2 + compiled `.js` in the tarball, verified by `publint` + `attw --pack` against the TARBALL), **PKG-03** (publish to npm via `nx release` using npm Trusted Publishers (OIDC) + provenance), **PKG-04** (`SECURITY.md` + hardened release CI), **TEST-05** (one real-workspace e2e smoke installs the packed tarball and runs `nx run <project>:angular-typecheck`).

This phase clarifies HOW to package/publish/smoke-test what is already scoped. LOCKED and NOT re-decided here: the core engine + executor + cacheable target (Phases 1-4), the dependency model (`@nx/devkit` pinned dependency, `@angular/compiler-cli` + `typescript` peers), the CJS-loads-ESM `import()` + `module:nodenext` GATE-A invariant, the executor schema v2 (`tsConfig`/`includeDeps`/`maxWarnings`/`failFast`, `additionalProperties:false`, `outputCapture:"direct-nodejs"`). OUT of scope (-> Phase 6 / deferred milestones): the full 5-project-type e2e matrix, the pnpm fixture, the mixed-case path assertion, the cross-OS / multi-Node CI matrix (TEST-03, CI-01); the Nx community-registry-listing PR (a post-publish follow-up, NOT a Phase-5 deliverable); `createNodesV2` inference, `nx add`/`ng add`, CLI bin, Angular builder, JSON/SARIF reporters.

**Process note:** decisions below are grounded in (1) existing project research (`.planning/research/*`), (2) the Phase-4 packaging hand-off note (`04-CONTEXT.md` `<deferred>`), (3) live verification against the built `dist`/tarball + current manifest, and (4) a **5-member Opus research panel** (lenses: npm-packaging/tarball-fidelity, nx-release/OIDC/provenance, supply-chain/CI-hardening, e2e-smoke-harness, integration/red-team) that researched phase-specific sources + local public clones (`nx-verdaccio`, `analog`, `nx`, the public sandbox) + live 2026 docs. Two genuinely HIGH-impact + not-HIGH-confidence decisions were escalated to and resolved by the user (first-publish bootstrapping; published peer range). Panel findings are folded in inline and tagged `[panel]`; the user resolutions are tagged `[user]`.
</domain>

<decisions>
## Implementation Decisions

### Package manifest (PKG-01)

- **D-01 `[panel]`: `files` allowlist = `["src", "executors.json", "README.md", "LICENSE"]`** (an explicit whitelist; the Pitfall-5 mitigation -- never rely on npm defaults). Interpreted DIST-relative (the tarball packs from `dist/packages/angular-typechecker/`). `executors.json` MUST be named explicitly (it sits at the package root, not under `src/`). Keep source maps for v0.0.1 (harmless; stripping them is an optional later cleanup -- npm `files` is an allowlist, not a denylist, so map-stripping would mean `sourceMap:false` in `tsconfig.lib.json`, deferred). Mirrors nx-verdaccio's real published `files`.

- **D-02 `[panel]`: Add a minimal `exports` map** `{ ".": "./src/index.js", "./package.json": "./package.json" }` AND keep root `main: "./src/index.js"` + `types: "./src/index.d.ts"` (belt-and-suspenders for node10 resolution + satisfies publint's "export package.json" suggestion; matches `@analogjs/platform`). Do NOT ship conditional `import`/`require`/`types` exports -- the package is CJS-only with a single barrel entry; conditional exports invite FalseCJS/FalseESM attw findings for zero benefit. Note: the Nx executor is loaded by `executors.json` `implementation` paths (Nx appends `.js` + `require()`s), NOT via `exports`/`main` -- so `exports` only governs the `index` barrel public API (`runTypecheck`/`renderReport`/etc.) that custom consumer tooling may import.

- **D-03 `[panel]`: Metadata block** (all currently MISSING from the manifest):
  ```jsonc
  "description": "Nx executor that runs the complete Angular compiler type-check (TypeScript + template type-check + extended NG8xxx diagnostics), no emit, decoupled from build and test.",
  "keywords": ["nx", "nx-plugin", "angular", "typecheck", "type-check", "ngc", "compiler-cli", "diagnostics"],
  "author": "Lars Gyrup Brink Nielsen <larsbrinknielsen@gmail.com>",
  "license": "MIT",
  "homepage": "https://github.com/LayZeeDK/angular-typechecker#readme",
  "bugs": { "url": "https://github.com/LayZeeDK/angular-typechecker/issues" },
  "repository": { "type": "git", "url": "git+https://github.com/LayZeeDK/angular-typechecker.git", "directory": "packages/angular-typechecker" }
  ```
  `keywords` MUST include `nx` + `nx-plugin` (registry/search). `repository.url` (+ `directory` for the monorepo subfolder) is a HARD Nx-registry-listing criterion AND is load-bearing for OIDC/provenance (the published `repository.url` must byte-for-byte, case-sensitively match the GitHub URL configured in the npm Trusted Publisher -- a mismatch silently 404s the first OIDC publish; see D-15). `author` uses the PUBLIC-projects email `larsbrinknielsen@gmail.com` -- NEVER the work address (global contact rule).

- **D-04 `[panel]`: `publishConfig: { "provenance": true }`** only -- DROP `access` (a no-op for an UNSCOPED package; `access:"public"` only matters for `@scope/` packages). Declarative provenance intent + the CI env `NPM_CONFIG_PROVENANCE=true` (D-14) is belt-and-suspenders so a future workflow edit can't silently drop provenance.

- **D-05 `[panel]`: Keep the existing 4 core fields verbatim** (`type:"commonjs"`, `main`, `types`, `executors`) -- all correct and required (`executors` is THE Nx-plugin marker; `@nx/js:tsc` copies them into `dist` unchanged, verified). **Keep `tslib@^2.3.0` as a `dependency` IF** `@nx/dependency-checks` confirms the emitted `.js` references `tslib` (the base tsconfig sets `importHelpers:true`, so it very likely does) -- do NOT guess; the dependency-checks lint rule is authoritative. Drop it only if reported obsolete.

- **D-06 `[user: "Stable 22 only. We must not use 22 next/rc prereleases for verification."]`: Published peer ranges = `@angular/compiler-cli: "^22.0.0"` (STABLE Angular 22 only) + `typescript: ">=6.0.0 <6.1.0"`.** README documents that consumers on Angular 22.x PRE-releases (`-next`/`-rc`) must pass `--legacy-peer-deps`. Widening to `>=22.0.0-0` later is non-breaking under 0.x semver -- so stable-only is the safe, correctable default, NOT a pre-emptive loosening. **Phase-wide constraint (user):** ALL verification (engine tests, integration fixtures, the e2e smoke, future CI) targets STABLE Angular 22 (`@angular/compiler-cli@22.0.4`, already pinned) -- do NOT use `22.x-next`/`-rc` builds for verification anywhere going forward (supersedes the early-spike note in PROJECT.md Context that the engine was first probed against `22.1.0-next.3`). **Prevent `@nx/dependency-checks` from rewriting the public range to the installed exact version:** set `"checkVersionMismatches": false` in the plugin's `@nx/dependency-checks` ESLint options (still catches MISSING/OBSOLETE deps; stops the autofix from clobbering `^22.0.0` -> `22.0.4`). NEVER run `eslint --fix` blindly on the manifest. The existing `package-manifest.spec.ts` already asserts these exact ranges -- it is the regression backstop; keep it.

- **D-07 `[panel]`: Create a per-package `LICENSE` file** (`packages/angular-typechecker/LICENSE`, MIT, (c) 2026 Lars Gyrup Brink Nielsen) AND add a build asset to copy it into `dist` (`{ "input": "./packages/angular-typechecker", "glob": "LICENSE", "output": "." }`). FINDING: there is NO LICENSE file today and the asset glob only catches `*.md`, so `files:[...,"LICENSE"]` would currently ship nothing. Also flesh out the stub `packages/angular-typechecker/README.md` (currently ~267 bytes) to document the manual `project.json` target wiring + the FULL consumer `targetDefaults` recipe (with inputs) + Brandon Roberts positioning; it ships via the `*.md` asset glob.

### Tarball fidelity + audit gate (PKG-02)

- **D-08 `[panel, verified]`: Assets globs are CORRECT -- the manifests + executor `.js` already land in the tarball** (verified against built `dist` + `npm pack --dry-run --json`: 41 files; `executors.json` at root, `schema.json` + `schema.d.ts` + `executor.js` under `src/executors/angular-typecheck/`, `outputCapture:"direct-nodejs"` present, no `.spec.ts`/`tsconfig.spec.json` leak). **REMOVE the stray `generators.json` asset glob** from `project.json` -- it matches nothing (generators deferred, no `generators` manifest field) and is a latent footgun. Keep BOTH `src/**/!(*.ts)` (carries `schema.json`/maps) and `src/**/*.d.ts` (carries the hand-authored `schema.d.ts`) globs.

- **D-09 `[panel]`: PKG-02 audit harness = a SERIALIZED Vitest e2e spec** (reuse the Phase-4 D-14 determinism conventions) that: `nx build angular-typechecker` -> `npm pack` (the BUILT dist) -> runs the gates against the resulting `.tgz`. Add `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` to the ROOT devDependencies (tooling, never shipped). Gates, all required:
  - `publint <tgz> --strict` -> assert no error-level messages (triage warnings; suppress nothing silently).
  - `attw <tgz> --profile node16 --format json` -> parse, assert `problems` empty (or only pre-approved, inline-justified ignores). The `attw --pack` run is AUTHORITATIVE (see D-10).
  - NEGATIVE leak assertion via `npm pack --json` `files[].path` (cross-OS-deterministic, no `tar` binary dependency): assert the entry set CONTAINS `package/executors.json`, `package/src/executors/angular-typecheck/{schema.json,executor.js}`, `package/src/index.{js,d.ts}`, `package/README.md`, `package/LICENSE`; and does NOT contain `/\.spec\./`, `tsconfig\.spec`, `/(libs|fixtures|e2e)/`, `typecheck-consumer`.
  - `@fixtures/*` non-leak guard: grep extracted `.d.ts` for `@fixtures` (verified ZERO today -- this is a regression guard, not a current fix).
  - **No-install-scripts gate `[panel: supply-chain]`:** assert the tarball's `package.json` has NO `preinstall`/`install`/`postinstall`/`prepare`/`prepublish` script (the source ships none today; gate it so a future edit can't reintroduce the exact s1ngularity vector).
  Expose the raw commands ALSO as root npm scripts for local/CI ergonomics. Wire as a CI gate before the publish job.

- **D-10 `[panel: red-team, verified on disk] -- INVESTIGATE, escalate if non-trivial`: The deep-import `.d.ts` escape.** The emitted `dist/.../core/compiler-cli-types.d.ts` contains `import type {...} from '../../../../node_modules/@angular/compiler-cli/src/transformers/api'` -- a relative path computed for the WORKSPACE layout that climbs OUT of the published package; in a consumer install (esp. pnpm's symlinked layout) it may not resolve. This is a types-side analogue of Pitfall 5, invisible to a runtime-only smoke (the executor's runtime `import()` uses the bare specifier `@angular/compiler-cli` and works). The `attw --pack` run in D-09 is the authoritative detector. **Plan must:** run `attw` expecting it MAY flag this; if it flags a real resolution problem, FIX it -- preferred approaches: (a) make `compiler-cli-types.d.ts` self-contained (hand-declare the minimal structural surface, no deep import), or (b) confirm it is NOT reachable from the public `index.d.ts` surface and erase/exclude it from shipped types. `index.d.ts` does NOT re-export `CompilerCli`, so erasure may be viable. The published-types form is genuinely unsettled (STATE [01-03 CAVEAT] flags the shim as fragile) -- if the fix is non-trivial / changes the public type contract, ESCALATE before locking.

### Release automation: nx release + OIDC + provenance (PKG-03)

- **D-11 `[panel]`: `nx.json` `release` block** (currently absent):
  ```jsonc
  "release": {
    "projects": ["angular-typechecker"],
    "version": { "conventionalCommits": true, "preVersionCommand": "npx nx run-many -t build" },
    "changelog": { "workspaceChangelog": { "createRelease": "github" } }
  }
  ```
  `projects: ["angular-typechecker"]` scoping is MANDATORY so the spike app, the cache-e2e project, and the `libs/typecheck-consumer*` fixtures are NEVER versioned/published (defense-in-depth: verify those fixtures carry `"private": true`, Phase-4 D-11 hygiene). `preVersionCommand: build` keeps `dist` fresh before publish (prevents a stale-tarball Pitfall-5 ship). Omit `projectChangelogs` for a single package (the workspace changelog IS the package changelog). `projectsRelationship: "independent"` is acceptable (keeps tags as `angular-typechecker@x.y.z`); single project so it is cosmetic.

- **D-12 `[user: "Token seed, then OIDC"]`: First-publish bootstrapping -- the irreversible step is HUMAN-GATED.** npm CANNOT perform a package's FIRST publish via OIDC (npm/cli#8544 OPEN as of 2026-06-23; the npmjs.com UI requires the package to exist before a Trusted Publisher can be attached) AND Trusted-Publisher registration is a manual npmjs.com action no agent can do. Therefore:
  - **Phase-5 EXECUTION stops at "publish-ready":** build, the D-09 tarball-audit gate, the TEST-05 e2e smoke, the `nx.json` release block, the SECURITY.md + hardened CI workflow, and a `nx release --first-release --dry-run` (inspect proposed version `0.0.1` + tag + changelog). It does NOT perform the real publish. **The `--chain` auto-advance MUST NOT auto-execute the live publish (see B-01).**
  - **The live first publish is a deliberate human release event:** seed-publish the REAL `0.0.1` FROM the hardened CI job using a SHORT-LIVED granular WRITE token scoped to only `angular-typechecker` (+ `NPM_CONFIG_PROVENANCE=true` + `id-token: write` so the seed still gets provenance) -> immediately register the npm Trusted Publisher (GitHub Actions provider, repo `LayZeeDK/angular-typechecker`, the EXACT publish-workflow filename, the `environment` name; explicitly tick the `npm publish` action -- required for configs created after 2026-05-20) -> REVOKE the granular token. Every subsequent release auto-publishes tokenlessly via OIDC.
  - Chose token-seed over the third-party `setup-npm-trusted-publish` dummy-package tool: avoids a third-party publish tool inside a supply-chain-hardening phase and avoids permanently burning a junk version; the seed still gets provenance because it runs in CI with `id-token: write`.

- **D-13 `[panel]`: Local vs CI split + steady-state auth.** LOCAL: `nx release --skip-publish` (first time `nx release --first-release`) cuts version + CHANGELOG + git tag + GitHub release; always `nx release ... --dry-run` first; `git push --follow-tags`. CI: `npx nx release publish` on a TAG-PUSH trigger. Steady-state (post-bootstrap) auth = OIDC: **`NODE_AUTH_TOKEN` must be UNSET (not empty) for OIDC to engage** (an empty value breaks it and yields a misleading 404); keep `NPM_CONFIG_PROVENANCE=true`; require npm CLI `>= 11.5.1` (`npm i -g npm@latest` in CI -- bundled npm lags) + Node `>= 22.14.0` + cloud-hosted runner (OIDC requirement). Because the GitHub release is created LOCALLY (D-13), the CI publish job needs only `id-token: write` (NOT `contents: write`) -- the tighter grant (resolves the L3<->L2 `contents:write` seam in favor of least-privilege).

### Supply-chain hardening: SECURITY.md + CI (PKG-04)

- **D-14 `[panel]`: `SECURITY.md` at the repo ROOT.** Disclosure channel = GitHub Private Vulnerability Reporting (the "Report a vulnerability" button) as PRIMARY + the public email `larsbrinknielsen@gmail.com` as fallback (enabling PVR is a one-toggle human repo-settings action). Supported-versions table = "latest 0.x only" (honest for a pre-1.0 solo project). State a realistic ~7-day best-effort acknowledgement; scope in/out (in: the published package + release pipeline; out: peer deps -> their projects). (Concrete skeleton in `<specifics>`.)

- **D-15 `[panel]`: Hardened release-workflow security envelope** (the security model; the `nx release` commands are D-11/D-13):
  - Top-level `permissions: contents: read` (least privilege); the publish job re-grants ONLY `id-token: write` (D-13).
  - Trigger = TAG PUSH (`on: push: tags: ['angular-typechecker@*']`) + optional `workflow_dispatch`. **NEVER `pull_request_target`** -- that was the exact s1ngularity command-injection vector (unsanitized PR title interpolated into a privileged `run:` step leaking the npm token).
  - **GitHub `environment:` with a Required Reviewer** = the manual-approval gate on the publish job (the control Nx itself adopted post-incident; protection rules apply only to the job naming the environment).
  - **SHA-pin ALL actions** to a full 40-char commit SHA with a trailing `# vN` comment (strictest reading of PKG-04; Scorecard Pinned-Dependencies doesn't exempt first-party). `persist-credentials: false` on checkout. Cloud-hosted runner only.

- **D-16 `[panel]`: Supply-chain MVP set = Dependabot (`github-actions` ecosystem, keeps the SHA pins fresh) + assert npm-account 2FA + the D-09 no-install-scripts tarball gate + post-publish provenance verification (`npm view ... --json` shows the attestation / the npm page badge).** DEFER to Phase 6 / later (continuous-assurance tools that belong with the recurring CI matrix, NOT this MVP "prove it publishes safely once" phase): OpenSSF Scorecard action, StepSecurity harden-runner, CodeQL, signed commits/tags (npm OIDC provenance already attests build origin). A `package-ecosystem: npm` Dependabot entry is optional (noisy on a pinned stack); the `github-actions` entry is the load-bearing one.

### e2e smoke (TEST-05)

- **D-17 `[panel]`: Install mechanism = `npm pack` + `npm install <tgz>`** (the packed tarball is the exact artifact `nx release publish` ships -- maximum directness, minimum harness). NOT Verdaccio: a registry's resolution fidelity (real ERESOLVE, transitive proxying, multi-project-type) is what Phase-6's TEST-03 install-matrix needs and is explicitly the Phase-6 escalation. Verdaccio's only unique capability (driving a `create-nx-workspace` preset) does not apply -- v0.0.1 ships no preset/generator (GEN-* deferred). `file:`/pack is also far less Windows-arm64-fragile (no long-lived server).

- **D-18 `[panel]`: Smoke shape.** Install the freshly-packed `.tgz` into a COMMITTED minimal consumer fixture, via a PER-RUN tmp COPY (`mkdtempSync` -> copy fixture -> `npm install <tgz>` there -> run -> `rm`); never mutate the committed fixture in place. **Target wiring (CRITICAL, STATE carryforward):** the fixture references the executor by its PUBLISHED unscoped id `angular-typechecker:angular-typecheck` (NOT the dev workspace-scoped `@angular-typechecker/angular-typechecker:...` key, which would simply not bind in a consumer) and carries NO tsconfig path-alias to plugin source -- so the smoke genuinely proves resolution FROM the installed package. The fixture's working `targetDefaults` recipe (incl. `includeDeps:true` for non-buildable-dep errors, Phase-4 04-03 Rule-2) IS the consumer README example, proven by execution. One project type only (an application is most representative); all five are Phase 6.

- **D-19 `[panel]`: Assertion set = minimal-but-meaningful (NOT exit-0-only).**
  1. Tarball-contents pre-flight (cheap, before install) -- overlaps/reuses the D-09 gate.
  2. Green run: `nx run <fixture>:angular-typecheck` on a valid project -> exit 0.
  3. Injected-error run: same target on a project carrying ONE deliberate `TS2322` (reuse the Phase-4 `injectTypeScriptError` recipe) -> NON-zero exit + stdout CONTAINS `TS2322` + stdout does NOT contain `ERR_REQUIRE_ESM` (proves the installed CJS executor's `import()` survived packaging) + does NOT contain the infra-error meta message. The green+error pair is what distinguishes "the check ran and passed" from "a no-op exited 0" (a type-checker that lies is worse than none).

- **D-20 `[panel: red-team] -- honesty constraint`: The smoke installs into a CLEAN workspace with its OWN `.npmrc` and NO `legacy-peer-deps`.** This repo's committed `.npmrc` sets `legacy-peer-deps=true` (the `@nx/angular@23.0.1` <22 peer ceiling); if the smoke inherited/copied it, a real consumer `ERESOLVE` on the published peer ranges (D-06) would be silently masked (Pitfall 6). The smoke MUST honestly surface whether a clean `npm install` of the tarball succeeds. If it ERESOLVEs (i.e. the `@nx/angular` ceiling reaches consumers), that is a REAL finding -> remediation (document `--legacy-peer-deps` in README vs widen ranges vs wait for `@nx/angular` 23.1.x) is ESCALATED, not auto-patched.

- **D-21 `[panel]`: Harness = a NEW dedicated, fully-serialized e2e project** (e.g. `e2e/angular-typechecker-install-e2e`), `vitest.config.mts` cloned from the Phase-4 cache-e2e config (`pool:'forks'`, `singleFork:true`, `fileParallelism:false`, `sequence.concurrent:false`, `environment:'node'`) but with `testTimeout`/`hookTimeout >= 300000` (install is slower than a bare `nx run`). `NX_DAEMON=false` + a CLEAN env (strip inherited cache-defeating `NX_*` vars, the Phase-4 `buildCleanEnv` pattern) for any nested `nx run`; `FORCE_COLOR=0` + `--output-style=static` (NEVER `--no-color` -- it is forwarded as `color:false` and rejected by `additionalProperties:false`). `implicitDependencies: ["angular-typechecker"]` and/or `nx build` in `beforeAll` so it packs a FRESH `dist` (packing stale dist tests a stale artifact). PKG-02's audit gate (D-09) may live in this same e2e project or a sibling.

### Sequencing + plan decomposition

- **D-22 `[panel: red-team]`: 5 plans, tracer-bullet ordered, ALL sequential on the MAIN tree** (D-17 carryforward applies more strongly here: `npm pack`/`npm install`/real `nx run` against the real graph+daemon are worktree-hostile -- a junctioned worktree realpath-resolves outside itself -> graph drift; and the deep-import shim breaks `@nx/js:tsc` without `node_modules` at the package dir):
  - **05-01 Manifest + build-output correctness** (PKG-01): `files`/`exports`/`keywords`/`repository`/`license`/`description`/`publishConfig`/peer-range guard; create LICENSE + asset; flesh out README; remove the dead `generators.json` glob; investigate the D-10 `.d.ts` escape.
  - **05-02 Tarball audit gate** (PKG-02): `publint` + `attw --pack` + leak/no-install-scripts assertions against the packed tarball. (Depends on 05-01.)
  - **05-03 e2e smoke (THE tracer bullet)** (TEST-05): pack -> clean install into the tmp consumer fixture -> green + injected-error runs. (Depends on 05-01/02; the smoke validates the artifact about to be published.)
  - **05-04 nx release config + SECURITY.md + hardened CI** (PKG-03 config + PKG-04): the `release` block, the SHA-pinned hardened workflow with the manual-approval environment, SECURITY.md, Dependabot; verified via `nx release --first-release --dry-run`. (Depends on 05-01; authorable in parallel with 05-02/03 but dry-run-verified after.)
  - **05-05 Live first publish (HUMAN-GATED -- see B-01)**: the only irreversible action; NOT auto-executed by the chain.
  05-04's parallelizable text-file authoring (SECURITY.md, workflow YAML) is worktree-safe, but its verification belongs on main; treat the whole phase as main-tree sequential (marginal parallelism savings vs high graph-drift risk).

### Claude's Discretion
- Exact `keywords` list + `description` wording; the e2e install-fixture project name + the smoke project's app-vs-lib choice (an app is most representative; either works as a real consumer); the precise Node version in the CI publish job (>= 22.14.0; 24 LTS recommended); whether the smoke ALSO runs a `require()`-the-installed-executor check alongside the `nx run`; the exact SECURITY.md prose; whether the D-09 audit gate and the D-21 smoke share one e2e project or are siblings.
- The exact `attw` `--ignore-rules` set: make the real `attw --pack` run authoritative; pre-set `--profile node16`; suppress ONLY a rule that DEMONSTRABLY fires as a known CJS false-positive, with an inline justification -- never blanket-suppress (and a real FalseCJS/FalseESM is a genuine defect to fix/escalate, not ignore, per D-10).
- Verify `tslib` necessity via `@nx/dependency-checks` (D-05) rather than assuming.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 spec + scope (this repo)
- `.planning/ROADMAP.md` Phase 5 section -- goal + 4 success criteria; Phase 6 section -- the DEFERRED boundary (TEST-03/CI-01: 5 project types, pnpm, mixed-case, cross-OS CI).
- `.planning/REQUIREMENTS.md` -- PKG-01..04 + TEST-05 (the Phase-5 set) + the v2/deferred sections (GEN/SUR/REP/SUP) + traceability.
- `.planning/PROJECT.md` -- locked stack, dependency model, module format, Key Decisions ("Publish hardening: npm Trusted Publishers (OIDC) + provenance + hardened CI + SECURITY.md + tarball audit (publint/attw)"; "e2e blends both prior approaches"), Constraints (license MIT, 0.x semver, Windows arm64, legacy-peer-deps caveat), Out of Scope.

### Phase 1-4 carry-forwards (this repo) -- MUST read
- `.planning/phases/04-nx-executor-adapter-cacheable-target/04-CONTEXT.md` -- `<deferred>` "Phase-5 packaging hand-off" pre-checklist (files/exports/tar assertion/attw/`outputCapture` ship/release.projects/README recipe); D-14 (serialized e2e determinism), D-15 (crash-safe revert), D-16 (`execSync nx run` + structured assertions + `ERR_REQUIRE_ESM` guard), D-17 (main-tree sequencing).
- `.planning/phases/04-nx-executor-adapter-cacheable-target/04-LEARNINGS.md` -- dual-key `nx.json` (PUBLISHED key for consumers, dev-scoped key must NOT leak); nested-`nx run` env trap; `--no-color` rejection; Rule-1/2/3 fixes.
- `.planning/STATE.md` Accumulated Context + Blockers/Concerns -- "Phase-5 README must use the PUBLISHED-name key"; legacy-peer-deps caveat; [01-03 CAVEAT] deep-import shim needs node_modules + is fragile; GATE-A `import(` survival; pnpm/mixed-case backstop is Phase 6.
- `.planning/phases/03.../03-CONTEXT.md` + `03-LEARNINGS.md` -- core/** import ban (adapter MAY use devkit); worktrees lack node_modules.

### Project research (this repo)
- `.planning/research/PITFALLS.md` -- **Pitfall 5 (tarball missing manifests -- TEST-05/PKG-02 raison d'etre)**, **Pitfall 6 (peer ranges + dependency-checks autofix)**, "Looks Done But Isn't" checklist, Anti-Patterns table, Integration Gotchas (nx release first publish, provenance env, scoped/access), Security Mistakes.
- `.planning/research/STACK.md` -- package.json conventions (`files`/`exports`/`keywords`/`publishConfig`), executors.json/schema.json conventions, `@nx/js:tsc` build, `@nx/dependency-checks` options, nx release configuration norms (first-release, `--dry-run`, `NPM_CONFIG_PROVENANCE`, `id-token:write`, `--skip-publish` local / CI-publish split), registry-listing criteria.
- `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `FOLLOWUP-FINDINGS.md`, `DIAGNOSTIC-CATALOG.md` -- Build/Publish boundary; deferred surfaces.

### Current source this phase grows (this repo)
- `packages/angular-typechecker/package.json` -- the half-done manifest (add D-01..D-07).
- `packages/angular-typechecker/project.json` -- `@nx/js:tsc` build `assets` (remove the `generators.json` glob D-08; add the LICENSE glob D-07).
- `packages/angular-typechecker/executors.json` + `src/executors/angular-typecheck/{schema.json,schema.d.ts}` -- already v2 + `outputCapture:"direct-nodejs"`; PKG-02 only verifies they ship.
- `packages/angular-typechecker/src/package-manifest.spec.ts` -- EXTEND for the new PKG-01 fields (it already guards deps/peers/engines/`type`); it is the peer-range regression backstop (D-06).
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` (-> emitted `.d.ts`) -- the D-10 deep-import escape to investigate.
- `nx.json` -- add the `release` block (D-11); has `namedInputs`/`targetDefaults` already.
- `e2e/angular-typechecker-cache-e2e/` -- the Phase-4 serialized harness to CLONE for D-09/D-21 (`vitest.config.mts` determinism block; `buildCleanEnv`; tmp-dir/teardown).
- Repo root: NO `LICENSE`, NO `SECURITY.md`, NO `.github/` yet -- all greenfield (D-07/D-14/D-15).

### External reference sources (absolute paths, read-only; re-validate against installed versions)
- `D:/projects/github/push-based/nx-verdaccio` -- real published Nx plugin: `projects/nx-verdaccio/package.json` (`files`/`keywords`/`repository.directory`/`homepage`/`bugs`/`publishConfig`), `nx.json` `release` block shape (Nx 22.3-era; patterns only -- it uses `@nx/vite:test`, we use `@nx/vitest:test`), Verdaccio standup (`verdaccio-registry.ts`) as the Phase-6 escalation reference.
- `D:/projects/github/analogjs/analog` -- `packages/platform/package.json` (`exports` map + `publishConfig: {access, provenance:true}`), `.github/workflows/release.yml` (`id-token: write` for provenance).
- `D:/projects/github/nrwl/nx` -- `@nx/js` local-registry / `nx release` internals; e2e plugin-install helpers (Phase-6 reference).
- `D:/projects/sandbox/nx19-8-angular18-2-esbuild-playwright-storybook` (PUBLIC, version-bound, INSPIRATION ONLY) -- `INTEGRATION-TESTING-LEARNINGS.md` (fixture-discovery trap, `NX_DAEMON=false`, the `injectTypeScriptError` recipe). Re-validate against Nx 23; import no code.

### External docs / issues (URLs; re-validate at execution time -- this area moved fast in 2025-2026)
- npm Trusted Publishers / OIDC: https://docs.npmjs.com/trusted-publishers/ (npm >= 11.5.1, Node >= 22.14.0, cloud-runner-only, case-sensitive workflow filename, post-2026-05-20 action-selection); GA changelog https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/ ; **first-publish-via-OIDC still UNSUPPORTED: https://github.com/npm/cli/issues/8544 (OPEN, re-check at execution)** ; gotchas https://philna.sh/blog/2026/01/28/trusted-publishing-npm/ (NODE_AUTH_TOKEN-must-be-unset; provenance-not-always-automatic), https://socket.dev/blog/npm-trusted-publishing .
- Nx release: https://nx.dev/docs/guides/nx-release/publish-in-ci-cd (`NPM_CONFIG_PROVENANCE=true` + `id-token:write`; local `--skip-publish` / CI-publish split).
- Provenance statements: https://docs.npmjs.com/generating-provenance-statements/ .
- npm dummy-package bootstrap (the NOT-chosen alt): https://github.com/azu/setup-npm-trusted-publish .
- Supply-chain / s1ngularity: https://nx.dev/blog/s1ngularity-postmortem (root cause = `pull_request_target` command-injection leaking the npm token + postinstall payload; Nx adopted Trusted Publishers + manual approval); GHSA-cxm3-wv7p-598c / CVE-2025-10894.
- GitHub Actions hardening: GitHub Docs "Security hardening for GitHub Actions"; OpenSSF Scorecard (Token-Permissions, Pinned-Dependencies); GitHub Docs "Using environments for deployment", "Adding a security policy", "Configuring private vulnerability reporting".
- Tarball audit: publint (`publint <tgz> --strict`, tarball arg since 0.3.8; latest 0.3.21); `@arethetypeswrong/cli` (`attw <tgz> --profile node16 --format json --ignore-rules`; latest 0.18.4).
- Positioning (README): Brandon Roberts, "Angular Compilation, Type-Checking, and Build Bottlenecks" (2026-06-26) https://brandonroberts.dev/blog/posts/angular-compilation-type-checking-and-build-bottlenecks-4n2f .
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase-4 serialized e2e harness** (`e2e/angular-typechecker-cache-e2e/`): `vitest.config.mts` determinism block (forks/singleFork/no-parallel/long-timeout), `buildCleanEnv` (strips cache-defeating `NX_*`), tmp-dir/teardown, `injectTypeScriptError`, the `nx run` + `ERR_REQUIRE_ESM`/exit-code/diagnostic-code assertion shape -> clone for the PKG-02 audit gate (D-09) AND the TEST-05 smoke (D-21).
- **`package-manifest.spec.ts`**: already asserts the dependency model (devkit pinned, no `nx`, peers, engines, `type:commonjs`) -> EXTEND for the new PKG-01 fields; it is the peer-range regression backstop (D-06).
- **Build `assets` globs** (`project.json`): already correctly ship `executors.json` + `schema.json`/`schema.d.ts` + compiled `.js` + `*.md` (verified) -> only need the LICENSE glob added + the dead `generators.json` glob removed.
- **`executors.json`** (v2-shaped, `outputCapture:"direct-nodejs"`) + **`schema.json`/`schema.d.ts`** -> PKG-02 verifies they ship; no schema changes.

### Established Patterns
- Framework-agnostic `core/` (zero `@nx/devkit`/CLI imports, lint-enforced); CJS `module:nodenext` build with the `import(`-survival GATE-A invariant; thin-adapter-over-single-core-entry. The published artifact is `dist/packages/angular-typechecker` (built by `@nx/js:tsc`, which copies the source `package.json` VERBATIM into dist -- so PKG-01 fields added to source ship as-is; the tarball packs from dist).
- Committed-fixture-as-real-graph-project hygiene (Phase-4 D-11): `scope:fixture` tag + module-boundary constraint + `"private": true` + namespaced alias -> the TEST-05 consumer fixture inherits this (but installs from the tarball in a tmp copy, so it generally need NOT be a main-graph project at all).

### Integration Points
- source manifest -> `@nx/js:tsc` -> dist `package.json` -> `npm pack` tarball -> `nx release publish`: PKG-02 audits the TARBALL/dist (never the source tree); the seam (does the published dist carry the L1 fields?) is closed by D-09 auditing the artifact.
- packed tarball -> `npm install <tgz>` into the tmp consumer fixture -> `nx run <fixture>:angular-typecheck` (PUBLISHED executor id) -> resolves `node_modules/angular-typechecker/executors.json` -> implementation `.js` (D-17/D-18).
- CI: top-level read-only `permissions` -> publish job `id-token:write` + manual-approval `environment` -> OIDC `nx release publish` (D-13/D-15).

### Prior-art learnings (sanitized; inspiration only)
- The public Nx 19.8 sandbox prototype confirms the `injectTypeScriptError` recipe, the fixture-discovery trap (Nx skips gitignored/excluded dirs), `NX_DAEMON=false`, Vitest-over-Jest for ESM compiler-cli -- re-validate on Nx 23; its removed generator flags must not be copied.
</code_context>

<specifics>
## Specific Ideas

- **`nx.json` release block:** `{ "release": { "projects": ["angular-typechecker"], "version": { "conventionalCommits": true, "preVersionCommand": "npx nx run-many -t build" }, "changelog": { "workspaceChangelog": { "createRelease": "github" } } } }`.
- **`files`:** `["src", "executors.json", "README.md", "LICENSE"]`. **`exports`:** `{ ".": "./src/index.js", "./package.json": "./package.json" }`. **`publishConfig`:** `{ "provenance": true }`. **peers:** `@angular/compiler-cli: "^22.0.0"`, `typescript: ">=6.0.0 <6.1.0"`.
- **PKG-02 commands (against the packed dist tarball):** `npm pack --json` (filename + `files[]`); `npx publint ./angular-typechecker-0.0.1.tgz --strict`; `npx attw ./angular-typechecker-0.0.1.tgz --profile node16 --format json`; negative leak check over `npm pack --json` `files[].path` (NOT a `tar` text parse -- cross-OS).
- **Hardened release workflow skeleton:** `on: push: tags: ['angular-typechecker@*']` (+ `workflow_dispatch`); top-level `permissions: { contents: read }`; job `environment: <name-with-required-reviewer>`, `permissions: { id-token: write }`, `runs-on: ubuntu-latest`; `actions/checkout@<sha> # vN` with `persist-credentials: false`; `actions/setup-node@<sha>` with `registry-url: https://registry.npmjs.org/`; `npm i -g npm@latest`; `npm ci`; `npx nx release publish` with `NPM_CONFIG_PROVENANCE: true` and NODE_AUTH_TOKEN UNSET.
- **SECURITY.md skeleton:** Supported Versions table = "latest 0.x: yes / < latest 0.x: no"; Reporting = GitHub "Report a vulnerability" (`/security/advisories/new`) primary + `larsbrinknielsen@gmail.com` fallback; ~7-day best-effort ack; Scope = published package + release pipeline in, peer deps out.
- **Dependabot:** `.github/dependabot.yml` with `package-ecosystem: github-actions` (keeps SHA pins fresh).
- **Injected-error smoke:** `const x: number = 'str';` -> assert non-zero exit + `TS2322` in stdout + NO `ERR_REQUIRE_ESM`.
</specifics>

<deferred>
## Deferred Ideas

All roadmap-scoped or out-of-milestone (NOT new in-phase capabilities):
- **The live first publish bootstrapping (05-05)** is HUMAN-GATED, not deferred-as-abandoned -- see B-01; the chain stops at publish-ready.
- **Verdaccio-based install + the full 5-project-type e2e matrix + pnpm fixture + mixed-case path assertion + cross-OS / multi-Node CI matrix** -> Phase 6 (TEST-03, CI-01). The Phase-5 smoke is the single `file:`/pack canary; Phase 6 is the gating backstop.
- **Nx community-registry-listing PR** (the `approved-community-plugins.json` PR to nrwl/nx) -> POST-publish follow-up, NOT Phase 5. Phase 5 delivers ELIGIBILITY (devkit-as-dependency [done] + `repository.url` [D-03] + e2e tests [TEST-05]); the PR itself is a deliberate human action once 0.0.1 is live.
- **OpenSSF Scorecard action, StepSecurity harden-runner, CodeQL, signed commits/tags** -> Phase 6 / later (continuous-assurance tooling belongs with the recurring CI matrix; OIDC provenance already covers publish-origin attestation for MVP).
- **Source-map stripping from the tarball** (`sourceMap:false`) -> optional later cleanup (maps are harmless/useful in v0.0.1).
- **`createNodesV2` inference, `nx add`/`ng add`, config generator, CLI bin, Angular builder, JSON/SARIF reporters, `migrations.json`** -> deferred milestones (no breaking-change migration exists in v0.0.1, so no `migrations.json`).

None of the discussion drifted outside the Phase 5 boundary.

## BLOCKER / UNRESOLVED (escalated -- do NOT auto-lock or auto-execute)

- **B-01 [HUMAN-GATED, --auto override]: The live first npm publish (05-05) MUST NOT be auto-executed by the `--chain`.** It is irreversible (immutable versions, 72h unpublish window, the npm name is claimed forever) AND requires out-of-band human actions on npmjs.com (registering the Trusted Publisher) that no agent can perform. User decision (D-12): "Token seed, then OIDC." Execution proceeds through publish-READY (build, audit gate, smoke, release config, hardened CI, `nx release --first-release --dry-run`) and STOPS. The human then performs the seed publish + Trusted-Publisher registration + token revoke. In the chained `execute-phase`, treat reaching publish-ready as phase success; the publish is a separate, human-triggered release event.
- **B-02 [INVESTIGATE -> escalate if non-trivial]: The `compiler-cli-types.d.ts` deep-relative-import escape (D-10).** Resolve empirically via `attw --pack` in 05-02; if it flags a real consumer-facing resolution problem, the fix (self-contained types vs erase-from-public-surface) is a public-type-contract decision -- escalate before locking if non-trivial.
- **B-03 [DISCOVER empirically -> escalate remediation]: Whether consumers need `--legacy-peer-deps` (D-20).** The Phase-5 smoke installs clean (no legacy flag) to surface it; if a clean install ERESOLVEs, the remediation (README note vs widen ranges vs await `@nx/angular` 23.1.x) is a human call.
</deferred>

---

*Phase: 5-Packaging, Publish Hardening + e2e Smoke (MVP)*
*Context gathered: 2026-06-28*
