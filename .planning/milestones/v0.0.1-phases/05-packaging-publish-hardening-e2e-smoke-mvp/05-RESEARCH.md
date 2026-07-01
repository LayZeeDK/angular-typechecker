# Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) - Research

**Researched:** 2026-06-28
**Domain:** npm packaging of an Nx plugin (tarball fidelity), supply-chain-hardened release (OIDC + provenance + hardened CI), packed-tarball e2e smoke
**Confidence:** HIGH (CONTEXT.md panel findings re-verified live: the D-10 `.d.ts` escape was reproduced empirically via `attw --pack`; npm/cli#8544 confirmed still OPEN; OIDC/`NODE_AUTH_TOKEN`-unset, s1ngularity + TanStack vectors, publint/attw versions, SECURITY.md/PVR conventions all re-validated against 2026 sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

> CONTEXT.md for this phase is a fully-formed decision set (D-01..D-22) produced by a 5-member
> Opus research panel plus two user escalations. This research VERIFIES and OPERATIONALIZES it;
> it does not re-derive it. Every D-xx below is a LOCKED decision. The three B-xx are escalated
> BLOCKERS the planner must honor.

### Locked Decisions (verbatim intent, D-01..D-22)

**Package manifest (PKG-01):**
- **D-01:** `files` allowlist = `["src", "executors.json", "README.md", "LICENSE"]` (explicit whitelist; Pitfall-5 mitigation). DIST-relative. `executors.json` named explicitly (package root, not under `src/`). Keep source maps for v0.0.1.
- **D-02:** Add minimal `exports` map `{ ".": "./src/index.js", "./package.json": "./package.json" }` AND keep root `main`/`types`. NO conditional `import`/`require`/`types` exports (CJS-only single barrel).
- **D-03:** Add metadata block: `description`, `keywords` (MUST include `nx`+`nx-plugin`), `author` (PUBLIC email `larsbrinknielsen@gmail.com`), `license`, `homepage`, `bugs`, `repository` (with `directory`). `repository.url` must byte-for-byte case-sensitively match the GitHub URL in the npm Trusted Publisher.
- **D-04:** `publishConfig: { "provenance": true }` only — DROP `access` (no-op for unscoped package).
- **D-05:** Keep the existing 4 core fields verbatim (`type`, `main`, `types`, `executors`). Keep `tslib@^2.3.0` as a dependency IF `@nx/dependency-checks` confirms the emitted `.js` references it; drop only if reported obsolete.
- **D-06 [user]:** Published peers = `@angular/compiler-cli: "^22.0.0"` (STABLE 22 only) + `typescript: ">=6.0.0 <6.1.0"`. README documents `--legacy-peer-deps` for consumers on Angular 22 PRE-releases. Set `"checkVersionMismatches": false` in `@nx/dependency-checks` to stop the autofix clobbering `^22.0.0` -> `22.0.4`. NEVER run `eslint --fix` blindly on the manifest. ALL verification targets STABLE Angular 22 (`@angular/compiler-cli@22.0.4`); never `-next`/`-rc`.
- **D-07:** Create per-package `LICENSE` file (MIT, (c) 2026 Lars Gyrup Brink Nielsen) + build asset to copy it into dist. Flesh out the stub README.

**Tarball fidelity + audit gate (PKG-02):**
- **D-08 [verified]:** Asset globs already ship manifests + executor `.js`. REMOVE the stray `generators.json` asset glob. Keep both `src/**/!(*.ts)` and `src/**/*.d.ts` globs.
- **D-09:** PKG-02 audit harness = a SERIALIZED Vitest e2e spec: `nx build` -> `npm pack` -> gates against the `.tgz`. Add `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` to ROOT devDependencies. Gates (all required): `publint <tgz> --strict` (no error-level msgs); `attw <tgz> --profile node16 --format json` (problems empty or pre-approved); negative leak assertion via `npm pack --json` `files[].path`; `@fixtures/*` non-leak guard; no-install-scripts gate. Expose raw commands as root npm scripts; wire as CI gate before publish.
- **D-10 [INVESTIGATE -> escalate if non-trivial]:** The deep-import `.d.ts` escape in `compiler-cli-types.d.ts`. `attw --pack` is authoritative. Fix preferred: (a) self-contained types, or (b) erase from public surface if not reachable.

**Release automation (PKG-03):**
- **D-11:** `nx.json` `release` block: `projects: ["angular-typechecker"]`, `version: { conventionalCommits: true, preVersionCommand: "npx nx run-many -t build" }`, `changelog: { workspaceChangelog: { createRelease: "github" } }`.
- **D-12 [user: "Token seed, then OIDC"]:** First publish is HUMAN-GATED. Phase-5 execution stops at "publish-ready" (build, audit gate, smoke, release block, SECURITY.md + CI, `nx release --first-release --dry-run`). Live first publish = human seeds REAL `0.0.1` from hardened CI with a SHORT-LIVED granular WRITE token (+ provenance) -> registers Trusted Publisher -> revokes token. Chose token-seed over the third-party dummy-package tool.
- **D-13:** Local `nx release --skip-publish` (first time `--first-release`) cuts version+changelog+tag+GitHub release; always `--dry-run` first; `git push --follow-tags`. CI = `npx nx release publish` on TAG-PUSH. Steady-state OIDC: `NODE_AUTH_TOKEN` must be UNSET (not empty); keep `NPM_CONFIG_PROVENANCE=true`; npm CLI `>= 11.5.1` + Node `>= 22.14.0` + cloud runner. CI publish job needs only `id-token: write` (NOT `contents: write`; the GitHub release is created locally).

**Supply-chain hardening (PKG-04):**
- **D-14:** `SECURITY.md` at repo ROOT. Disclosure = GitHub Private Vulnerability Reporting (PRIMARY) + public email fallback. Supported-versions = "latest 0.x only". ~7-day best-effort ack. Scope in: published package + release pipeline; out: peer deps.
- **D-15:** Hardened release workflow: top-level `permissions: contents: read`; publish job re-grants ONLY `id-token: write`; trigger = TAG PUSH (`on: push: tags: ['angular-typechecker@*']`) + optional `workflow_dispatch`; NEVER `pull_request_target`; GitHub `environment:` with Required Reviewer (manual approval); SHA-pin ALL actions (40-char SHA + `# vN`); `persist-credentials: false`; cloud runner only.
- **D-16:** MVP supply-chain set = Dependabot (`github-actions` ecosystem) + npm-account 2FA + the D-09 no-install-scripts gate + post-publish provenance verification. DEFER to Phase 6: OpenSSF Scorecard, StepSecurity harden-runner, CodeQL, signed commits/tags.

**e2e smoke (TEST-05):**
- **D-17:** Install mechanism = `npm pack` + `npm install <tgz>` (NOT Verdaccio -> Phase 6).
- **D-18:** Install the freshly-packed `.tgz` into a COMMITTED minimal consumer fixture via a PER-RUN tmp COPY (`mkdtempSync` -> copy -> `npm install <tgz>` -> run -> `rm`); never mutate the committed fixture. Fixture references the executor by its PUBLISHED unscoped id `angular-typechecker:angular-typecheck` (NOT the dev workspace-scoped key) and carries NO tsconfig path-alias to plugin source. Fixture `targetDefaults` recipe (incl. `includeDeps:true`) IS the consumer README example. One project type only (an app is most representative).
- **D-19:** Assertion set (NOT exit-0-only): (1) tarball-contents pre-flight; (2) green run -> exit 0; (3) injected-error run (one `TS2322`) -> non-zero exit + stdout CONTAINS `TS2322` + does NOT contain `ERR_REQUIRE_ESM` + does NOT contain the infra-error meta message.
- **D-20 [DISCOVER empirically]:** The smoke installs into a CLEAN workspace with its OWN `.npmrc` and NO `legacy-peer-deps`. If a clean install ERESOLVEs, that is a REAL finding -> remediation ESCALATED, not auto-patched.
- **D-21:** Harness = a NEW dedicated, fully-serialized e2e project (e.g. `e2e/angular-typechecker-install-e2e`), `vitest.config.mts` cloned from the Phase-4 cache-e2e config but with `testTimeout`/`hookTimeout >= 300000`. `NX_DAEMON=false` + a CLEAN env for any nested `nx run`; `FORCE_COLOR=0` + `--output-style=static` (NEVER `--no-color`). `nx build` in `beforeAll` so it packs FRESH dist.

**Sequencing (D-22):** 5 plans, tracer-bullet ordered, ALL sequential on the MAIN tree (worktree-hostile). 05-01 manifest+build-output; 05-02 tarball audit gate; 05-03 e2e smoke (tracer bullet); 05-04 nx release config + SECURITY.md + hardened CI; 05-05 live first publish (HUMAN-GATED).

### Claude's Discretion (verbatim)
- Exact `keywords` list + `description` wording; the e2e install-fixture project name + the smoke project's app-vs-lib choice; the precise Node version in the CI publish job (>= 22.14.0; 24 LTS recommended); whether the smoke ALSO runs a `require()`-the-installed-executor check; the exact SECURITY.md prose; whether the D-09 audit gate and the D-21 smoke share one e2e project or are siblings.
- The exact `attw` `--ignore-rules` set: make the real `attw --pack` run authoritative; pre-set `--profile node16`; suppress ONLY a rule that DEMONSTRABLY fires as a known CJS false-positive, with an inline justification — never blanket-suppress.
- Verify `tslib` necessity via `@nx/dependency-checks` (D-05) rather than assuming.

### Deferred Ideas (OUT OF SCOPE)
- The live first publish bootstrapping (05-05) is HUMAN-GATED, not abandoned (B-01).
- Verdaccio install + full 5-project-type e2e matrix + pnpm fixture + mixed-case path assertion + cross-OS/multi-Node CI matrix -> Phase 6 (TEST-03, CI-01).
- Nx community-registry-listing PR -> POST-publish follow-up, NOT Phase 5 (Phase 5 delivers ELIGIBILITY).
- OpenSSF Scorecard, StepSecurity harden-runner, CodeQL, signed commits/tags -> Phase 6 / later.
- Source-map stripping (`sourceMap:false`) -> optional later cleanup.
- `createNodesV2`, `nx add`/`ng add`, config generator, CLI bin, Angular builder, JSON/SARIF reporters, `migrations.json` -> deferred milestones.

### Escalated BLOCKERS (must honor)
- **B-01 [HUMAN-GATED, --auto override]:** The live first npm publish (05-05) MUST NOT be auto-executed by the `--chain`. Irreversible + requires out-of-band human npmjs.com actions. Reaching publish-ready IS phase success.
- **B-02 [INVESTIGATE -> escalate if non-trivial]:** The `compiler-cli-types.d.ts` deep-import escape (D-10). **RESOLVED EMPIRICALLY in this research — see `## Common Pitfalls` Pitfall 1: it IS a real consumer-facing resolution defect AND it IS reachable from the public surface, so the fix is non-trivial (public-type-contract change). ESCALATE the fix approach if the planner cannot lock it.**
- **B-03 [DISCOVER empirically -> escalate remediation]:** Whether consumers need `--legacy-peer-deps` (D-20). The smoke installs clean (no legacy flag) to surface it; remediation is a human call.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | `package.json` declares `@nx/devkit` pinned dependency (no `nx`), `@angular/compiler-cli`+`typescript` peers (Angular `^22` / TS `>=6.0 <6.1`), with `files`/`exports`/`executors` fields and `nx`/`nx-plugin` keywords | Standard Stack (manifest fields), Code Examples (full package.json), Architecture Patterns (manifest shape); current manifest already has devkit/peers/engines/type — Phase 5 ADDS `files`/`exports`/keywords/repository/license/description/publishConfig + the LICENSE file + `checkVersionMismatches:false` dependency-checks option |
| PKG-02 | `executors.json`/`schema.json` (v2, `cli:"nx"`, `outputCapture`) + compiled `.js` copied into dist + present in `npm pack` tarball, verified by `publint` + `attw --pack` | Empirically verified: 41-file tarball already ships executors.json/schema.json/schema.d.ts/executor.js; `publint --strict` PASSES; `attw --pack` FAILS (D-10 escape) — see Pitfall 1. Standard Stack (publint 0.3.21, attw 0.18.4), Code Examples (audit harness), Validation Architecture |
| PKG-03 | Published to npm (MIT, 0.x semver) via `nx release` using npm Trusted Publishers (OIDC) + provenance | `nx.json` release block (Code Examples); OIDC bootstrap (npm/cli#8544 still OPEN — token-seed-then-OIDC); `NODE_AUTH_TOKEN` must be UNSET (verified); provenance automatic under OIDC + belt-and-suspenders `publishConfig.provenance`; HUMAN-GATED (B-01) |
| PKG-04 | `SECURITY.md` present + release CI hardened (read-only default perms, no untrusted `pull_request_target`, SHA-pinned actions, manual-approval publish environment) | Hardened workflow skeleton (Code Examples); s1ngularity + TanStack postmortems (root cause = `pull_request_target` injection + whole-repo trust); SECURITY.md + GitHub PVR conventions; Dependabot github-actions; Security Domain section |
| TEST-05 | One real-workspace e2e smoke installs the packed tarball (`file:`/pack) into a workspace and runs `nx run <project>:angular-typecheck` successfully | Phase-4 serialized e2e harness to clone (verified on disk); `npm pack`+`npm install <tgz>` into tmp-copy of committed fixture using the PUBLISHED executor id; green+injected-TS2322 assertions; clean install (no legacy-peer-deps) to surface B-03 |
</phase_requirements>

## Summary

This phase makes `angular-typechecker` publishable to npm and proves the packed artifact installs-and-runs end-to-end. CONTEXT.md is an unusually complete, panel-hardened decision set; the research task was to **verify it against live 2026 reality and operationalize the one genuinely-open investigation (D-10/B-02)** — not to re-derive choices. I built the plugin, packed the real tarball, and ran the authoritative audit tools against it.

**The headline finding (D-10/B-02) is confirmed and resolved as a real, non-trivial defect.** `attw --pack ./angular-typechecker-0.0.1.tgz --profile node16` returns an **`InternalResolutionError` on all four resolution profiles** (node16-CJS, node16-ESM, bundler, node10). The shipped `src/core/compiler-cli-types.d.ts` contains two deep-relative imports (`../../../../node_modules/@angular/compiler-cli/src/transformers/api` and `.../src/perform_compile`) computed for the WORKSPACE layout; in a consumer install (`/node_modules/angular-typechecker/src/core/...`) those paths climb to a non-existent directory and fail to resolve. Critically, the escape **IS reachable from the public type surface**: `index.d.ts` re-exports `loadCompilerCli` (returns `CompilerCli`), `formatReport` (param `Pick<CompilerCli,'formatDiagnostics'>`), and `gatherAllDiagnostics` (param `Program`) — all of which import their types from `compiler-cli-types`. So plain erasure (D-10 option b) is NOT viable; the fix must make `compiler-cli-types.d.ts` self-contained (D-10 option a) — a public-type-contract change that the planner should treat as the central risk of plan 05-01/05-02.

Everything else verified green or as-expected: the tarball already ships `executors.json`, `schema.json`, `schema.d.ts`, `executor.js` (no `.spec`/fixture leak); `publint --strict` already passes; no install scripts present; `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` are legitimate, well-established tools (slopcheck OK). On the release side, npm/cli#8544 (first-publish-via-OIDC unsupported) is **still OPEN**, validating the token-seed-then-OIDC human-gated bootstrap (D-12/B-01); the 2026-05-20 action-selection requirement is now in force (configs created today MUST tick "npm publish"); `NODE_AUTH_TOKEN` must be entirely UNSET for OIDC (an empty string breaks it — and `actions/setup-node` injects a default token via `registry-url`, a real plan gotcha); and the s1ngularity + TanStack postmortems both confirm the required-reviewer environment + tag/workflow-scoped trust as load-bearing (OIDC alone is insufficient).

**Primary recommendation:** Execute the five plans exactly as D-22 sequences them, on the main tree. Front-load the D-10 self-contained-types fix in 05-01 and prove it with `attw --pack` in 05-02 BEFORE the smoke and release work — a tarball whose types don't resolve is not publish-ready regardless of the runtime smoke passing.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Published package manifest (PKG-01) | Build/Publish artifact (dist `package.json`) | Source manifest (`packages/angular-typechecker/package.json`) | `@nx/js:tsc` copies the source manifest VERBATIM into dist; fields added to source ship as-is. The tarball packs from dist. |
| Tarball asset placement (PKG-02) | Build (`@nx/js:tsc` `assets` globs in `project.json`) | — | Non-`.ts` assets (`executors.json`, `schema.json`, maps, hand-authored `.d.ts`) are copied, not compiled; the `assets` config owns this. |
| Type-resolution correctness (D-10) | Source types (`core/compiler-cli-types.ts`) | Build (emit) | The defect is authored in the source `.ts` and emitted verbatim to `.d.ts`; fixing it is a source-type-contract change, not a build-config change. |
| Tarball audit gate (PKG-02) | Dedicated e2e/test project (Vitest, serialized) | Root npm scripts (ergonomics) + CI gate | Auditing requires `nx build` + `npm pack` + shelling `publint`/`attw` against the artifact — a serialized integration concern, not a unit test. |
| Release versioning + changelog (PKG-03) | `nx.json` `release` block + LOCAL `nx release` run | Git tags + GitHub release | Versioning/changelog/tagging happen locally (D-13); only `nx release publish` runs in CI. |
| Tokenless publish + provenance (PKG-03) | CI publish job (GitHub Actions OIDC) | npm registry (Trusted Publisher config) | OIDC identity is minted by GitHub Actions and validated by npm; `nx release publish` shells to `npm publish` which auto-detects OIDC. |
| Supply-chain controls (PKG-04) | CI workflow (`.github/workflows/`) + repo settings | `SECURITY.md` + Dependabot | Hardening is workflow-level (permissions, SHA-pins, environment) + repo-settings-level (PVR, branch protection) + policy doc. |
| Install-and-run proof (TEST-05) | Dedicated serialized e2e project | tmp-copied committed consumer fixture | The smoke installs the tarball into an isolated tmp workspace and runs the executor by its PUBLISHED id. |

## Standard Stack

> The locked runtime stack (Nx 23.0.1 / Angular 22 / TS 6 / Node 22-26 / `@nx/devkit` pinned dep / compiler-cli+typescript peers) lives in CLAUDE.md + PROJECT.md and is unchanged here. This phase adds only TWO new tools — both root devDependencies, never shipped.

### Core (new in this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `publint` | `0.3.21` | Lint the packed tarball for publishing correctness (exports/main/types/files coherence, ESM/CJS pitfalls) | `[VERIFIED: npm registry]` Latest 0.3.21 (confirmed `npm view publint version`); created 2022-05-01; repo `github.com/publint/publint`. The de-facto standard tarball linter; tarball-arg supported since 0.3.8. `[CITED: nx.dev publish docs + CONTEXT.md canonical_refs]` |
| `@arethetypeswrong/cli` (`attw`) | `0.18.4` | Verify the published `.d.ts` resolve correctly across resolution modes; `--pack` runs against the tarball | `[VERIFIED: npm registry]` Latest 0.18.4 (confirmed `npm view`); created 2023-06-04; repo `arethetypeswrong/arethetypeswrong.github.io`. The authoritative types-resolution checker; it is what caught the D-10 escape in this research. `[CITED: Pitfall 5 sources + CONTEXT.md]` |

**Installation (root devDependencies — NEVER in the plugin's published `package.json`):**
```bash
npm install -D publint@0.3.21 @arethetypeswrong/cli@0.18.4
```

### Supporting (already present — verified, no version change)

| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| `@nx/js:tsc` | 23.0.1 | Build executor; copies source manifest verbatim to dist + globs assets | `[VERIFIED]` build succeeds; dist manifest is a byte copy of source |
| `@nx/eslint` `@nx/dependency-checks` | 23.0.1 | Catches missing/obsolete/mismatched deps; D-06 needs `checkVersionMismatches:false` | `[CITED: nx.dev dependency-checks docs]` already configured in repo |
| `nx release` | 23.0.1 | Versioning/changelog/tag + `publish` | `[CITED: nx.dev nx-release docs]` no release block in `nx.json` yet |

### Alternatives Considered

| Instead of | Could Use | Tradeoff (why NOT, per CONTEXT.md) |
|------------|-----------|------------------------------------|
| `npm pack` + `npm install <tgz>` smoke | Verdaccio local registry | Verdaccio's resolution fidelity (real ERESOLVE, transitive proxying) is exactly Phase-6's TEST-03; pack is far less Windows-arm64-fragile (no server). DEFERRED to Phase 6 (D-17). |
| Token-seed-then-OIDC first publish | `setup-npm-trusted-publish` dummy-package tool / `npm trust` CLI | Dummy-package adds a third-party publish tool inside a hardening phase + burns a junk version. `npm trust` (11.10.0+) exists but does NOT support GAT/bypass-2FA — unsuitable for automation. `[VERIFIED: WebSearch 2026]` (D-12). |
| `attw --pack` self-contained-types fix | Erase `compiler-cli-types` from public surface | **NOT viable** — the public `index.d.ts` surface depends on `CompilerCli`/`Program` (verified on disk). Self-contained types is the only path (D-10 option a). |

**Version verification (run 2026-06-28):**
- `npm view publint version` -> `0.3.21`
- `npm view @arethetypeswrong/cli version` -> `0.18.4`
- `npm --version` -> `11.16.0` (local; OIDC floor is 11.5.1, satisfied; CI must still `npm i -g npm@latest`)

## Package Legitimacy Audit

> Two new external packages this phase installs (both ROOT devDependencies, never shipped). slopcheck 0.6.1 ran successfully (installed via `pip install slopcheck`).

| Package | Registry | Age | Source Repo | slopcheck | Postinstall | Disposition |
|---------|----------|-----|-------------|-----------|-------------|-------------|
| `publint` | npm | ~4 yrs (created 2022-05-01) | github.com/publint/publint | OK (not blocked; install proceeded) | none (`npm view publint scripts.postinstall` empty) | Approved |
| `@arethetypeswrong/cli` | npm | ~3 yrs (created 2023-06-04) | github.com/arethetypeswrong/arethetypeswrong.github.io | OK (not blocked; install proceeded) | none | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck `install` blocks SLOP automatically and proceeds to install clean packages; both `publint` and `@arethetypeswrong/cli` passed (it installed them). Note: running `slopcheck install` had the side-effect of `npm install`-ing both into the root manifest during research; this was reverted (`git checkout -- package.json package-lock.json`) so the planner adds them deliberately in 05-02. Both are mature, widely-used, source-backed, postinstall-free tools — safe to add.*

## Architecture Patterns

### System Architecture Diagram

```
SOURCE MANIFEST                         BUILD (@nx/js:tsc)                 PUBLISHED ARTIFACT
packages/angular-typechecker/           "build" target in project.json
  package.json  ---- copied VERBATIM -->  dist/packages/angular-typechecker/
  (PKG-01 fields)                           package.json (= source copy)
  src/**/*.ts   ---- compiled --------->    src/**/*.js + *.d.ts
  src/**/*.json ---- asset glob ------->    src/**/*.json (schema.json)
  src/**/*.d.ts ---- asset glob ------->    src/**/*.d.ts (schema.d.ts, hand-authored)
  executors.json--- asset glob ------->     executors.json (root)
  LICENSE [NEW] --- asset glob [NEW] ->     LICENSE
  *.md          ---- asset glob ------->     README.md
                                                  |
                                                  | npm pack (from dist)
                                                  v
                                            angular-typechecker-0.0.1.tgz
                                            (files allowlist applies HERE)
                                                  |
                        +-------------------------+-------------------------+
                        |                         |                         |
                   PKG-02 AUDIT             TEST-05 SMOKE              PKG-03 PUBLISH
                   publint --strict         mkdtemp -> copy fixture    nx release publish
                   attw --profile node16    npm install <tgz>          (CI, OIDC, no token)
                   files[] leak check       nx run fixture:            -> npm registry
                   no-install-scripts         angular-typecheck        (+ provenance)
                        |                    (PUBLISHED executor id)         ^
                        |                         |                          |
                        v                         v                   PKG-04 HARDENED CI
                   green/escalate           green + injected-TS2322    tag-push trigger
                                            (B-03: clean install,      read-only perms
                                             no legacy-peer-deps)      id-token:write only
                                                                       required-reviewer env
                                                                       SHA-pinned actions
```

**Trace the primary use case:** A field added to the source `package.json` flows verbatim through `@nx/js:tsc` into the dist manifest, which is what `npm pack` reads; the `files` allowlist then filters the tarball; the same tarball is the input to the audit gate (PKG-02), the install smoke (TEST-05), and `nx release publish` (PKG-03). The hardened CI (PKG-04) wraps the publish step.

### Recommended Project Structure (new/changed in this phase)

```
<repo root>/
├── LICENSE                                   # [NEW, D-15? no — repo-root MIT optional]  see note
├── SECURITY.md                               # [NEW, D-14] repo root
├── .github/
│   ├── workflows/
│   │   └── release.yml                        # [NEW, D-15] hardened publish workflow (exact filename load-bearing for Trusted Publisher)
│   └── dependabot.yml                         # [NEW, D-16] github-actions ecosystem
├── nx.json                                    # [EDIT, D-11] add `release` block
├── packages/angular-typechecker/
│   ├── package.json                           # [EDIT, D-01..D-06] files/exports/keywords/repository/license/description/publishConfig/peer-range guard
│   ├── project.json                           # [EDIT, D-07/D-08] add LICENSE asset; REMOVE generators.json glob
│   ├── LICENSE                                # [NEW, D-07] per-package MIT (this is the one that ships, via asset)
│   ├── README.md                              # [EDIT, D-07] flesh out: consumer recipe + Brandon Roberts positioning
│   ├── eslint config                          # [EDIT, D-06] add checkVersionMismatches:false to @nx/dependency-checks
│   └── src/
│       ├── core/compiler-cli-types.ts         # [EDIT, D-10] make self-contained (remove deep imports)
│       └── package-manifest.spec.ts           # [EDIT] extend for new PKG-01 fields (regression backstop)
└── e2e/
    └── angular-typechecker-install-e2e/       # [NEW, D-21] OR a shared project with the audit gate (discretion)
        ├── project.json
        ├── vitest.config.mts                  # clone cache-e2e config; testTimeout/hookTimeout >= 300000
        ├── tsconfig.json / tsconfig.spec.json
        ├── src/*.int.spec.ts                  # the smoke + (optionally) the PKG-02 audit gate
        └── fixtures/<committed-consumer>/     # minimal app fixture wired with the PUBLISHED executor id
```

> Note on the repo-root `LICENSE`: D-07 mandates the PER-PACKAGE `packages/angular-typechecker/LICENSE` (the one that ships via asset). A repo-root `LICENSE` is conventional for the GitHub repo but NOT what gets packed — the planner may add it for repo hygiene but the load-bearing one is the per-package file.

### Pattern 1: Source manifest -> dist manifest is a verbatim copy

**What:** `@nx/js:tsc` copies the source `package.json` byte-for-byte into `dist/`. There is no manifest transform step.
**When to use:** Every PKG-01 field decision.
**Verified on disk:** the current `dist/packages/angular-typechecker/package.json` is identical to the source (both shown in this research). So fields added to source ship as-is; the `package-manifest.spec.ts` (which reads the SOURCE) is a valid regression backstop, but the audit gate must read the TARBALL (dist) for true fidelity.

### Pattern 2: Serialized e2e harness reuse (clone the Phase-4 cache-e2e config)

**What:** The Phase-4 `e2e/angular-typechecker-cache-e2e/vitest.config.mts` is the proven determinism template: `environment:'node'`, `pool:'forks'`, `poolOptions.forks.singleFork:true`, `fileParallelism:false`, `sequence.concurrent:false`, long timeouts. Clone it, bump `testTimeout`/`hookTimeout` to `>= 300000` (install is slower).
**When to use:** Both the PKG-02 audit gate and the TEST-05 smoke (they may share one project or be siblings — discretion).
**Example (verified Phase-4 config to clone):**
```typescript
// Source: e2e/angular-typechecker-cache-e2e/vitest.config.mts (verified on disk)
export default defineConfig(() => ({
  root: __dirname,
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-install-e2e',
    watch: false,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,   // install is slower than a bare nx run
    hookTimeout: 300000,
  },
}));
```

### Pattern 3: Nested-`nx run` env hygiene (clone `buildCleanEnv`)

**What:** Any `nx run`/`npm install` shelled from inside `nx run <e2e>:test` inherits cache-defeating `NX_*` vars (`NX_SKIP_NX_CACHE`, `NX_TASK_HASH`, etc.). Strip them; set `NX_DAEMON=false`, `FORCE_COLOR=0`, and (for the smoke) a clean install env.
**When to use:** The smoke's nested `nx run fixture:angular-typecheck`.
**Example:** the exact `NX_RUNNER_ENV_KEYS` list + `buildCleanEnv()` from `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` (verified on disk) — clone verbatim.

### Pattern 4: Crash-safe committed-fixture mutation (clone Phase-4 D-15)

**What:** The injected-error smoke (D-19 case 3) mutates the committed fixture's source. Use the Phase-4 recipe: a `.pristine` sidecar + `beforeAll` heal + `finally` byte-restore (preserve EOL) + a `git diff --exit-code` CI backstop. NEVER `git checkout`.
**When to use:** The TS2322 injection in the smoke. (D-18 already says install into a tmp COPY of the fixture, so the mutation can target the tmp copy — even safer; if so, the `.pristine` sidecar is unnecessary because the tmp copy is discarded. Planner discretion: mutate the tmp copy, not the committed source.)

### Anti-Patterns to Avoid

- **Auditing the source tree instead of the tarball (Pitfall 5):** `publint`/`attw`/leak checks MUST run against `npm pack`'s `.tgz`, not `packages/.../`. The source tree has no `files` allowlist applied and no dist layout.
- **Passing `--no-color` to a nested `nx run` (Phase-4 LEARNING):** Nx forwards it as `color:false` into executor options -> rejected by `additionalProperties:false`. Use `FORCE_COLOR=0`/`NO_COLOR=1` env + `--output-style=static`.
- **Copying the committed fixture's `.npmrc` into the smoke (D-20):** the repo `.npmrc` sets `legacy-peer-deps=true`; copying it masks a real consumer ERESOLVE. The smoke's tmp workspace must NOT inherit it.
- **Using the dev workspace-scoped executor id in the smoke fixture (D-18, STATE carryforward):** the smoke installs from the tarball, so it MUST use the PUBLISHED unscoped id `angular-typechecker:angular-typecheck`. The dev key `@angular-typechecker/angular-typechecker:angular-typecheck` would not bind in a consumer.
- **`eslint --fix` on the manifest (D-06):** `@nx/dependency-checks` autofix rewrites `^22.0.0` -> the installed `22.0.4`. Set `checkVersionMismatches:false`; never blind-fix.
- **Empty `NODE_AUTH_TOKEN` in CI (verified gotcha):** an empty string is still a value — npm tries to use it and OIDC never engages, yielding a misleading 404. The var must be entirely UNSET.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verify tarball publishing correctness | A custom `package.json` field linter | `publint --strict` | Covers exports/main/types/files coherence, ESM/CJS edge cases, deprecated fields — dozens of rules you'd reinvent badly. |
| Verify `.d.ts` resolve across modes | A custom type-resolution checker | `attw --pack --profile node16` | Simulates node16-CJS/ESM/bundler/node10 resolution exactly as TS does; it caught D-10 that a runtime smoke cannot. |
| Tokenless authenticated publish | A token-management/rotation scheme | npm Trusted Publishers (OIDC) | Eliminates long-lived tokens entirely; the post-s1ngularity standard. |
| Build provenance attestation | A custom SLSA/attestation generator | npm provenance (`NPM_CONFIG_PROVENANCE` + `id-token:write`) | npm generates the attestation automatically from the OIDC build context. |
| Tarball file-list assertion | A `tar -tf` text parse | `npm pack --json` `files[].path` | Cross-OS-deterministic (no `tar` binary dependency, no `\`-vs-`/` flake); the structured list is authoritative. |
| Crash-safe fixture revert | `git checkout` after a test | `.pristine` sidecar + byte-restore (Phase-4 D-15) | `git checkout` masks other edits, touches the index, and is defeated by a killed worker. (Or: mutate a tmp copy, per D-18.) |

**Key insight:** the entire PKG-02 gate is "don't trust that it ships correctly — prove it against the artifact with the ecosystem's own tools." Both tools are mature, source-backed, and postinstall-free.

## Runtime State Inventory

> This phase has a packaging/refactor character (the D-10 type-contract fix + new external state on npm/GitHub). The five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified. No datastore keys reference any renamed string; this is greenfield packaging. | None |
| Live service config | **npm Trusted Publisher config** (created on npmjs.com AFTER the seed publish): GitHub Actions provider, repo `LayZeeDK/angular-typechecker`, the EXACT publish-workflow filename (`release.yml`), the `environment` name, AND (post-2026-05-20, in force today) the explicitly-ticked `npm publish` action. This config lives ONLY on npmjs.com, never in git. **GitHub repo settings:** Private Vulnerability Reporting toggle (D-14) + the publish `environment` with a Required Reviewer (D-15) + branch protection on the tag/workflow. | Manual human npmjs.com + GitHub-settings actions at 05-05 (out-of-band; no agent can do them). |
| OS-registered state | None — no OS-level registration. | None |
| Secrets/env vars | **Short-lived granular npm WRITE token** scoped to `angular-typechecker` (seed publish only; revoked immediately after — D-12). `NODE_AUTH_TOKEN` must be UNSET in the steady-state OIDC job (NOT a secret to add — verified gotcha). `id-token: write` is a permission, not a secret. | Human creates + revokes the seed token at 05-05; the steady-state workflow stores NO npm secret. |
| Build artifacts | **`dist/packages/angular-typechecker/`** is regenerated by `preVersionCommand: build` (D-11) before each release — stale dist would ship a stale tarball (Pitfall 5). The `node_modules` slopcheck added during research were reverted from the manifest but the installed files remain (gitignored, harmless). | `preVersionCommand` handles dist freshness automatically; no manual action. |

**The canonical question — after every repo file is updated, what runtime systems still hold old state?** The npm Trusted Publisher config + the GitHub environment/PVR/branch-protection settings are the only "runtime state" — and they are deliberately HUMAN-created at 05-05 (B-01), never by an agent. The plan must STOP at publish-ready and hand these off.

## Common Pitfalls

### Pitfall 1: The `compiler-cli-types.d.ts` deep-import escape — a real, public-surface type-resolution defect (D-10 / B-02)

**What goes wrong:** The shipped `src/core/compiler-cli-types.d.ts` contains:
```
import type { EmitFlags, Program, UNKNOWN_ERROR_CODE } from '../../../../node_modules/@angular/compiler-cli/src/transformers/api';
import type { defaultGatherDiagnostics, formatDiagnostics, ParsedConfiguration, performCompilation, readConfiguration } from '../../../../node_modules/@angular/compiler-cli/src/perform_compile';
```
These relative paths are computed for the WORKSPACE layout. In a consumer install (`/node_modules/angular-typechecker/src/core/compiler-cli-types.d.ts`), `../../../../node_modules/@angular/compiler-cli/...` resolves to a directory that does not exist.

**EMPIRICALLY VERIFIED (this research, 2026-06-28):** `attw ./angular-typechecker-0.0.1.tgz --profile node16` returns `🥴 Internal resolution error` on ALL profiles (node16-from-CJS, node16-from-ESM, bundler, node10). The JSON detail shows `kind: "InternalResolutionError"` with the trace `Module name '../../../../node_modules/@angular/compiler-cli/src/transformers/api' was not resolved` (and the same for `perform_compile`).

**Why it's non-trivial (escalation context for B-02):** The escape IS reachable from the public type surface. The barrel `index.d.ts` re-exports:
- `loadCompilerCli(): Promise<CompilerCli>` — return type IS `CompilerCli`
- `formatReport(..., ng: Pick<CompilerCli, 'formatDiagnostics'>, ...)` — param type
- `gatherAllDiagnostics(program: Program)` — param type IS `Program`

`CompilerCli`, `Program`, `EmitFlags`, `ParsedConfiguration` all originate from the deep imports. So **D-10 option (b) "erase from public surface" is NOT viable** — verified on disk. The fix is **D-10 option (a): make `compiler-cli-types.d.ts` self-contained** — hand-declare the minimal structural surface the public types need, with no deep import. This is a public-type-contract change (the central risk of 05-01).

**How to fix (recommended approach):** Replace the deep `import type` statements with self-contained structural declarations sourced from `typescript`'s public types where possible (e.g. `Program` extends `ts.Program` shape; `EmitFlags` is an enum that can be declared as a `const enum`/numeric union; `UNKNOWN_ERROR_CODE` is a numeric literal `500`; `formatDiagnostics`/`readConfiguration`/`performCompilation`/`defaultGatherDiagnostics` are function-type declarations whose signatures use `ts.Diagnostic[]` and plain shapes). The runtime value is still the real module (loaded via `await import('@angular/compiler-cli')`) — only the COMPILE-TIME structural type changes. Keep the existing `package-manifest.spec.ts` discipline: add an `attw`-clean assertion to the PKG-02 gate so a regression is caught.

**How to avoid going forward:** The PKG-02 `attw --pack` gate (D-09) is the permanent regression detector. Assert `analysis.problems` is empty (no pre-approved ignores for `InternalResolutionError` — that is a real defect, never a CJS false-positive).

**Warning signs:** Runtime smoke (TEST-05) PASSES while `attw` FAILS — the runtime `import()` uses the bare specifier `@angular/compiler-cli` and works; only the SHIPPED TYPES are broken. This is exactly why D-10 says the runtime smoke cannot catch it and `attw --pack` is authoritative.

### Pitfall 2: `NODE_AUTH_TOKEN` set to empty (or auto-injected by setup-node) breaks OIDC

**What goes wrong:** For OIDC to engage, `NODE_AUTH_TOKEN` must be entirely UNSET. An empty string is still a value — npm tries to use it and never falls back to OIDC, yielding a misleading 404/ENEEDAUTH.
**Why it happens:** `actions/setup-node` with `registry-url: https://registry.npmjs.org/` writes a `.npmrc` that reads `${NODE_AUTH_TOKEN}` and may inject a default. `[VERIFIED: WebSearch 2026 — multiple confirmations incl. npm/cli#9088, community#176761]`
**How to avoid:** In the steady-state OIDC publish step, provide NO `env: NODE_AUTH_TOKEN` block at all. Be deliberate with `setup-node`'s `registry-url`: it is needed so npm targets the right registry, but ensure no token env leaks into the publish step. Require npm CLI `>= 11.5.1` (`npm i -g npm@latest`) + Node `>= 22.14.0` + a GitHub-hosted (cloud) runner.
**Warning signs:** `404 Not Found` or `ENEEDAUTH` on `nx release publish` despite a valid Trusted Publisher config — npm's errors point at the wrong subsystem (npm/cli#9088 acknowledges this).

### Pitfall 3: First publish via OIDC is impossible — the chicken-and-egg (D-12 / B-01)

**What goes wrong:** npm's Trusted Publisher UI requires the package to EXIST before a publisher can be attached, so the FIRST publish cannot use OIDC.
**VERIFIED:** npm/cli#8544 is **still OPEN** (2026-06-28). The standard workaround is a one-time token-based seed publish, then attach the Trusted Publisher, then revoke the token.
**2026-05-20 detail (now in force):** Trusted Publisher configs created AFTER 2026-05-20 MUST explicitly select at least one allowed action. Today is 2026-06-28, so the registration WILL require ticking "npm publish".
**How to avoid:** Execute D-12 exactly — seed `0.0.1` from the hardened CI with a short-lived granular write token (+ `id-token:write` + `NPM_CONFIG_PROVENANCE=true` so the seed still gets provenance), register the Trusted Publisher (provider, repo, EXACT workflow filename, environment, tick "npm publish"), then REVOKE the token. HUMAN-GATED (B-01): the plan stops at `nx release --first-release --dry-run`.

### Pitfall 4: Peer-range autofix + pre-release semver (Pitfall 6 / D-06)

**What goes wrong:** `@nx/dependency-checks` autofix rewrites the public peer range to the installed exact version (`^22.0.0` -> `22.0.4`), narrowing the consumer-facing contract. Separately, `^22.0.0` excludes Angular 22 PRE-releases (`-next`/`-rc`) by semver rules.
**How to avoid:** Set `"checkVersionMismatches": false` in the `@nx/dependency-checks` ESLint options (still catches MISSING/OBSOLETE). NEVER `eslint --fix` the manifest. Document `--legacy-peer-deps` for pre-release consumers in the README. The `package-manifest.spec.ts` asserts the exact ranges as the regression backstop. Widening to `>=22.0.0-0` later is non-breaking under 0.x (D-06).
**Warning signs:** the smoke's clean install ERESOLVEs (B-03) — that is a REAL finding about the `@nx/angular@23.0.1` <22 peer ceiling reaching consumers; escalate the remediation (README note vs widen vs await `@nx/angular` 23.1.x).

### Pitfall 5: `pull_request_target` command injection + whole-repo Trusted-Publisher trust (PKG-04)

**What goes wrong:** The s1ngularity attack interpolated an unsanitized PR title into a privileged `run:` step (via `pull_request_target`), leaking the npm token; the payload was a `postinstall` hook. The May-2026 TanStack attack pushed an orphaned commit because the Trusted Publisher trusted the WHOLE REPO rather than a specific protected workflow/branch.
**VERIFIED:** both postmortems confirm `[CITED: nx.dev/blog/s1ngularity-postmortem + WebSearch TanStack 2026]`.
**How to avoid (D-15/D-16):** NEVER `pull_request_target` in the release workflow; trigger on TAG PUSH only (`on: push: tags: ['angular-typechecker@*']`) + optional `workflow_dispatch`. Top-level `permissions: contents: read`; publish job re-grants ONLY `id-token: write`. SHA-pin ALL actions (40-char + `# vN`); `persist-credentials: false`. Use a GitHub `environment:` with a Required Reviewer (the manual-approval gate Nx itself adopted) + branch/tag protection. The D-09 no-install-scripts tarball gate prevents reintroducing the postinstall payload vector.
**Warning signs:** any workflow that checks out untrusted PR code with write permissions; a Trusted Publisher rule that names the repo but not the workflow filename + environment.

### Pitfall 6: Stale dist ships a stale tarball (Pitfall 5 core)

**What goes wrong:** `npm pack` packs whatever is in `dist/` — if `dist` is stale, the tarball ships old code/types.
**How to avoid:** `preVersionCommand: "npx nx run-many -t build"` (D-11) rebuilds before versioning; the e2e smoke + audit gate `nx build` in `beforeAll` (D-21). Always pack the FRESH dist.

## Code Examples

### Full published `package.json` (target state after 05-01)

```jsonc
// Source: CONTEXT.md D-01..D-06 + STACK.md conventions + analog/nx-verdaccio precedent
{
  "name": "angular-typechecker",
  "version": "0.0.1",
  "description": "Nx executor that runs the complete Angular compiler type-check (TypeScript + template type-check + extended NG8xxx diagnostics), no emit, decoupled from build and test.",
  "keywords": ["nx", "nx-plugin", "angular", "typecheck", "type-check", "ngc", "compiler-cli", "diagnostics"],
  "author": "Lars Gyrup Brink Nielsen <larsbrinknielsen@gmail.com>",
  "license": "MIT",
  "homepage": "https://github.com/LayZeeDK/angular-typechecker#readme",
  "bugs": { "url": "https://github.com/LayZeeDK/angular-typechecker/issues" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/LayZeeDK/angular-typechecker.git",
    "directory": "packages/angular-typechecker"
  },
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "executors": "./executors.json",
  "exports": {
    ".": "./src/index.js",
    "./package.json": "./package.json"
  },
  "files": ["src", "executors.json", "README.md", "LICENSE"],
  "dependencies": {
    "@nx/devkit": "23.0.1",
    "tslib": "^2.3.0"
  },
  "peerDependencies": {
    "@angular/compiler-cli": "^22.0.0",
    "typescript": ">=6.0.0 <6.1.0"
  },
  "engines": { "node": "^22.22.3 || ^24.15.0 || ^26.0.0" },
  "publishConfig": { "provenance": true }
}
```
> `repository.url` MUST byte-for-byte case-sensitively match the GitHub URL in the npm Trusted Publisher AND the provenance metadata (D-03; verified 422-on-mismatch behavior). `LayZeeDK` casing is load-bearing.

### `nx.json` `release` block (05-04)

```jsonc
// Source: CONTEXT.md D-11 + nx.dev nx-release docs (verified)
"release": {
  "projects": ["angular-typechecker"],
  "version": {
    "conventionalCommits": true,
    "preVersionCommand": "npx nx run-many -t build"
  },
  "changelog": {
    "workspaceChangelog": { "createRelease": "github" }
  }
}
```
> `projects: ["angular-typechecker"]` scoping is MANDATORY so the spike app, the cache-e2e project, and the `libs/typecheck-consumer*` fixtures are NEVER versioned/published. Verify those carry `"private": true`.
> First run: `nx release --first-release --dry-run`. With conventionalCommits + no prior tags it will PROMPT for a version specifier (no history to derive a bump) and write nothing in dry-run. The disk `version: "0.0.1"` is the fallback; keep it valid (a missing `version` breaks `--first-release`, nrwl/nx#27887). `[VERIFIED: WebSearch nx-release 2026]`

### PKG-02 audit-gate assertions (05-02, against the packed tarball)

```typescript
// Source: CONTEXT.md D-09 + empirical verification (this research)
// 1. Build fresh + pack from dist
execSync('npx nx build angular-typechecker', { env, cwd: workspaceRoot });
const packJson = JSON.parse(
  execSync('npm pack --json', { cwd: distDir, encoding: 'utf8' }),
);
const tgz = packJson[0].filename;
const filePaths = packJson[0].files.map((f) => f.path);

// 2. publint --strict -> no error-level messages (currently PASSES)
execSync(`npx publint ${tgz} --strict`, { cwd: distDir }); // throws on error-level

// 3. attw --pack --profile node16 --format json -> problems EMPTY
//    (currently FAILS with InternalResolutionError until D-10 is fixed)
const attw = JSON.parse(
  execSync(`npx attw ${tgz} --profile node16 --format json`, {
    cwd: distDir, encoding: 'utf8',
  }),
);
expect(attw.analysis.problems ?? []).toEqual([]);

// 4. Positive presence (cross-OS-deterministic, no tar binary)
for (const p of [
  'executors.json',
  'src/executors/angular-typecheck/schema.json',
  'src/executors/angular-typecheck/executor.js',
  'src/index.js', 'src/index.d.ts',
  'README.md', 'LICENSE',
]) {
  expect(filePaths).toContain(p);
}
// 5. Negative leak (NO spec / tsconfig.spec / libs|fixtures|e2e / consumer)
for (const path of filePaths) {
  expect(path).not.toMatch(/\.spec\./);
  expect(path).not.toMatch(/tsconfig\.spec/);
  expect(path).not.toMatch(/(libs|fixtures|e2e)\//);
  expect(path).not.toMatch(/typecheck-consumer/);
}
// 6. @fixtures non-leak in shipped .d.ts (regression guard; ZERO today)
//    grep extracted .d.ts for '@fixtures'
// 7. No install scripts in the tarball's package.json
const tarManifest = /* read package/package.json from tgz */;
for (const k of ['preinstall','install','postinstall','prepare','prepublish']) {
  expect(tarManifest.scripts?.[k]).toBeUndefined();
}
```
> Note: `npm pack --json` writes the filename to stdout but ALSO creates the `.tgz` on disk — `rm` it in `afterAll` (Phase-4 WR-02 cleanup discipline). Paths in `files[].path` are package-relative WITHOUT the `package/` prefix (verified: `executors.json`, not `package/executors.json`) — match accordingly.

### TEST-05 smoke shape (05-03)

```typescript
// Source: CONTEXT.md D-17/D-18/D-19/D-20/D-21 + Phase-4 harness (verified)
// beforeAll: nx build angular-typechecker -> npm pack -> capture absolute tgz path
// Per test:
const tmp = mkdtempSync(join(tmpdir(), 'atc-smoke-'));
// copy the committed minimal app fixture into tmp (NO .npmrc with legacy-peer-deps)
// install the freshly-packed tgz WITHOUT --legacy-peer-deps (B-03 honesty)
execSync(`npm install ${absoluteTgz}`, { cwd: tmp, env: cleanInstallEnv });
// GREEN: nx run <fixture>:angular-typecheck via the PUBLISHED executor id -> exit 0
const green = run(`npx nx run app:angular-typecheck --output-style=static`, tmp);
expect(green.code).toBe(0);
// INJECTED: write `const x: number = 'str';` into a fixture source, re-run
const bad = run(`npx nx run app:angular-typecheck --output-style=static`, tmp);
expect(bad.code).not.toBe(0);
expect(bad.stdout).toContain('TS2322');
expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/); // CJS import() survived packaging
expect(bad.stdout).not.toContain('infrastructure error');
// afterEach/afterAll: rmSync(tmp, { recursive: true, force: true })
```
> The fixture's `project.json` uses `"executor": "angular-typechecker:angular-typecheck"` (PUBLISHED unscoped id) and `targetDefaults`/options carry `includeDeps: true` (so a non-buildable-dep error surfaces). Since the install happens in a TMP COPY, mutating the copy is inherently crash-safe — no `.pristine` sidecar needed (D-18).

### Hardened release workflow skeleton (05-04)

```yaml
# Source: CONTEXT.md D-13/D-15/D-16 + GitHub Actions hardening + s1ngularity/TanStack postmortems (verified)
name: release
on:
  push:
    tags: ['angular-typechecker@*']    # NEVER pull_request_target
  workflow_dispatch:
permissions:
  contents: read                        # least privilege at top level
jobs:
  publish:
    runs-on: ubuntu-latest              # cloud-hosted runner (OIDC requirement)
    environment: npm-publish            # MUST have a Required Reviewer (manual approval)
    permissions:
      id-token: write                   # ONLY this — NOT contents:write (release made locally)
    steps:
      - uses: actions/checkout@<40-char-sha>   # v5
        with:
          persist-credentials: false
      - uses: actions/setup-node@<40-char-sha> # v5
        with:
          node-version: 24              # >= 22.14.0; 24 LTS recommended
          registry-url: https://registry.npmjs.org/
      - run: npm i -g npm@latest        # OIDC needs npm >= 11.5.1 (bundled lags)
      - run: npm ci
      - run: npx nx release publish
        env:
          NPM_CONFIG_PROVENANCE: true
          # NODE_AUTH_TOKEN deliberately UNSET — OIDC engages only with no token
```
> Pin the SHAs with Dependabot (`github-actions` ecosystem) keeping them fresh. The EXACT workflow filename (`release.yml`) and the `environment` name must match the npm Trusted Publisher config registered at 05-05.

### SECURITY.md skeleton (05-04)

```markdown
# Source: CONTEXT.md D-14 + GitHub PVR/security-policy conventions (verified)
# Security Policy

## Supported Versions
| Version | Supported |
| ------- | --------- |
| latest 0.x | yes |
| < latest 0.x | no |

## Reporting a Vulnerability
Please report security vulnerabilities privately via GitHub's
**"Report a vulnerability"** button on the repository's Security > Advisories page
(https://github.com/LayZeeDK/angular-typechecker/security/advisories/new).
If you cannot use that, email larsbrinknielsen@gmail.com.

We aim to acknowledge reports within ~7 days (best-effort, solo maintainer).

## Scope
In scope: the published `angular-typechecker` package and its release pipeline.
Out of scope: peer dependencies (`@angular/compiler-cli`, `typescript`, `nx`) —
report those to their respective projects.
```
> PVR is SEPARATE from SECURITY.md but complementary (PVR = the "front door", SECURITY.md = the "welcome guide"). Enabling PVR is a one-toggle repo-settings action (human, 05-05). CAVEAT to surface to the operator: by default maintainers do NOT get notified of new PVR reports — adjust watch/notification settings. `[VERIFIED: GitHub Docs 2026]`

### `.github/dependabot.yml` (05-04)

```yaml
# Source: CONTEXT.md D-16 (verified: Dependabot bumps SHA-pinned actions but does NOT alert on them)
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Long-lived npm `NODE_AUTH_TOKEN` in CI | npm Trusted Publishers (OIDC) + provenance | GA 2025-07-31; standard by 2026 | No standing secret; the publish path stops being a token-leak vector. |
| Trusted Publisher allows `npm publish` implicitly | Configs created AFTER 2026-05-20 MUST tick an allowed action | 2026-05-20 | The 05-05 registration MUST explicitly select "npm publish" (today is 2026-06-28). |
| `pull_request_target` + tag-version action refs | TAG-push trigger + SHA-pinned actions + required-reviewer environment | post-s1ngularity (2025) + post-TanStack (May 2026) | OIDC alone is insufficient; approval gating + workflow-scoped trust are load-bearing. |
| Audit the source tree | Audit the `npm pack` tarball with `publint` + `attw --pack` | mainstream by 2024-2026 | Catches `files`/`exports`/`.d.ts` defects (like D-10) that source-tree checks miss. |

**Deprecated/outdated:**
- `@nx/vite:test` for the Vitest executor — moved to `@nx/vitest` in Nx 22.2 (already handled).
- `npm trust` CLI for first-publish automation — exists (11.10.0+) but does NOT support GAT/bypass-2FA, so unsuitable; token-seed remains the path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The self-contained-types fix for D-10 can be expressed without changing the runtime behavior or the public type NAMES (`CompilerCli`, `Program`, etc.) | Pitfall 1 | If a name/shape must change, it is a public-API change in v0.0.1 (acceptable pre-publish, but the planner should confirm the surface). LOW risk — v0.0.1 is unpublished; the contract is not yet frozen. |
| A2 | `nx release --first-release --dry-run` is safe to run in 05-04 verification despite prompting for a version (it writes nothing in dry-run) | Code Examples (nx.json) | If run non-interactively in a chain it may hang on the version prompt; the planner should run it interactively or pass an explicit version specifier. `[VERIFIED behavior; interactivity is the open variable]` |
| A3 | The smoke fixture as a committed app + tmp-copy install genuinely exercises the PUBLISHED executor id resolution (no source path-alias bleed-through) | Code Examples (smoke) | If the tmp copy inherits the workspace `tsconfig.base.json` aliases, it could resolve plugin source instead of the install. Mitigate: the tmp workspace must be self-contained (its own minimal tsconfig, no `@angular-typechecker/*` alias). |
| A4 | Provenance is generated automatically under OIDC for the seed publish (token + `id-token:write`) AND steady-state | Pitfall 3 / Code Examples | Some users needed the explicit `--provenance` flag; the belt-and-suspenders `publishConfig.provenance:true` + `NPM_CONFIG_PROVENANCE=true` covers this. LOW risk. |

> All four are LOW-to-MEDIUM risk and have stated mitigations. No assumption is load-bearing enough to block planning.

## Open Questions (RESOLVED)

1. **Should the PKG-02 audit gate and the TEST-05 smoke share one e2e project or be siblings?**
   - What we know: D-21 says "PKG-02's audit gate may live in this same e2e project or a sibling" (explicit discretion).
   - Recommendation: ONE shared `e2e/angular-typechecker-install-e2e` project with two `.int.spec.ts` files (audit + smoke). Both need the same `nx build` + `npm pack` `beforeAll`; sharing avoids packing twice. The serialized config already forbids parallelism, so no race risk.
   - **RESOLVED:** plans adopt ONE shared `e2e/angular-typechecker-install-e2e` project (05-02 scaffolds it + the audit spec; 05-03 adds the smoke spec + fixture).

2. **Does a clean `npm install` of the tarball ERESOLVE (B-03)?**
   - What we know: the workspace relies on `legacy-peer-deps=true` because `@nx/angular@23.0.1` caps Angular tooling peers at <22. Whether that ceiling reaches a CONSUMER (who installs `angular-typechecker` + their own Angular 22) is unknown until the smoke runs clean.
   - Recommendation: the smoke MUST install without `--legacy-peer-deps` and SURFACE the result. If it ERESOLVEs, ESCALATE remediation (README `--legacy-peer-deps` note vs widen ranges vs await `@nx/angular` 23.1.x) — do NOT auto-patch (B-03). This is discoverable only at execution time.
   - **RESOLVED (intentionally runtime-discoverable, per B-03):** not a pre-execution blocker by design — the 05-03 smoke installs clean and surfaces the result; remediation is escalated, not auto-patched.

3. **Self-contained-types: structural copy vs minimal re-declaration?**
   - What we know: the public surface needs `CompilerCli` (with `readConfiguration`/`performCompilation`/`defaultGatherDiagnostics`/`EmitFlags`/`UNKNOWN_ERROR_CODE`/`formatDiagnostics`), `Program`, `EmitFlags`, `ParsedConfiguration`. The runtime is unchanged.
   - Recommendation: declare these structurally using `typescript`'s public types as the substrate (e.g. `formatDiagnostics: (diags: readonly ts.Diagnostic[], host: ...) => string`). Prove with `attw --pack` (problems empty). If the minimal re-declaration drifts from the real compiler-cli signatures, the engine code that CALLS them would fail to type-check — so the build itself is a guard. Escalate to the user only if the structural copy proves infeasible under nodenext (it should not, per the existing shim's own analysis that the deep `.d.ts` files DO resolve in-workspace).
   - **RESOLVED:** 05-01 locks structural re-declaration on the `typescript` substrate; the build type-checks callers as a drift guard; `attw --pack` in 05-02 verifies; escalate only if infeasible under nodenext.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `nx` (CLI) | build, pack, release, smoke | yes | 23.0.1 | — |
| `@nx/js:tsc` build | dist artifact | yes (build verified green) | 23.0.1 | — |
| `npm` (pack/install) | tarball + smoke | yes | 11.16.0 (OIDC floor 11.5.1) | — |
| `publint` | PKG-02 gate | not yet installed | 0.3.21 (verified on registry) | add to root devDeps (05-02) |
| `@arethetypeswrong/cli` | PKG-02 gate | not yet installed | 0.18.4 (verified on registry) | add to root devDeps (05-02) |
| `slopcheck` | research legitimacy audit | yes (installed during research) | 0.6.1 | — (research-only) |
| GitHub Actions OIDC | CI publish (PKG-03) | N/A at plan time | — | HUMAN-gated at 05-05 (B-01) |
| npmjs.com Trusted Publisher | first publish (PKG-03) | N/A at plan time | — | HUMAN-gated at 05-05 (B-01) |

**Missing dependencies with no fallback:** none that block PLANNING. The OIDC/npmjs.com items are deliberately human-gated (B-01), not blockers for plans 05-01..05-04.
**Missing dependencies with fallback:** `publint` + `@arethetypeswrong/cli` — install in 05-02 (verified legitimate + present on registry).

## Validation Architecture

> `workflow.nyquist_validation: true` (verified in `.planning/config.json`). This section maps each Phase-5 requirement to its verification tier for the Nyquist VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` (Nx 23.0.1) |
| Config file | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (NEW — clone Phase-4 cache-e2e config) + existing `packages/angular-typechecker/vitest config` for the manifest unit spec |
| Quick run command | `npx nx test angular-typechecker` (manifest unit spec — fast, no build) |
| Full suite command | `npx nx run angular-typechecker-install-e2e:test` (serialized e2e: audit gate + smoke — slow, needs build+pack) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKG-01 | manifest declares `files`/`exports`/`executors`/keywords/repository/license/peers/devkit-dep | unit | `npx nx test angular-typechecker` (extend `package-manifest.spec.ts`) | EXTEND (exists; covers deps/peers/engines/type) |
| PKG-01 | LICENSE file exists + ships in tarball | e2e (presence in tarball) | install-e2e audit gate (`files[]` contains `LICENSE`) | Wave 0 (new) |
| PKG-02 | executors.json/schema.json/schema.d.ts/executor.js present in tarball | e2e | install-e2e audit gate (`files[]` positive set) | Wave 0 (new) |
| PKG-02 | `publint --strict` clean against tarball | e2e | install-e2e audit gate (execSync publint) | Wave 0 (new) |
| PKG-02 | `attw --pack --profile node16` problems empty (D-10 fixed) | e2e | install-e2e audit gate (execSync attw --format json) | Wave 0 (new) — **currently FAILS until D-10 fix** |
| PKG-02 | no `.spec`/tsconfig.spec/fixture leak + no install scripts | e2e | install-e2e audit gate (negative `files[]` + scripts check) | Wave 0 (new) |
| PKG-03 | `nx.json` release block scopes to `angular-typechecker` only | unit/config | assert `nx.json` `release.projects` = `["angular-typechecker"]` (extend a config spec OR `nx release --first-release --dry-run` manual) | Wave 0 (new, small) |
| PKG-03 | `nx release --first-release --dry-run` produces version 0.0.1 + tag + changelog preview | manual-only | `npx nx release --first-release --dry-run` (interactive; A2) | Manual (HUMAN-GATED, B-01) |
| PKG-03 | live publish via OIDC + provenance | manual-only | HUMAN at 05-05 (token-seed -> register -> revoke); verify `npm view angular-typechecker --json` shows provenance | Manual (B-01) |
| PKG-04 | SECURITY.md present at repo root | unit (presence) | assert `fs.existsSync('SECURITY.md')` (extend a repo-hygiene spec) | Wave 0 (new, small) |
| PKG-04 | release workflow: read-only top perms, id-token:write only, no pull_request_target, SHA-pinned, environment | unit (YAML lint) | parse `.github/workflows/release.yml`; assert top `permissions.contents==read`, job `permissions=={id-token:write}`, no `pull_request_target`, every `uses:` is a 40-char SHA, `environment:` present | Wave 0 (new) |
| TEST-05 | packed tarball installs (clean, no legacy-peer-deps) + runs green | e2e | install-e2e smoke (green run exit 0) | Wave 0 (new) |
| TEST-05 | injected TS2322 -> non-zero exit + `TS2322` in stdout + no `ERR_REQUIRE_ESM`/infra-error | e2e | install-e2e smoke (injected-error run) | Wave 0 (new) |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (manifest unit spec — fast feedback on PKG-01).
- **Per wave merge:** `npx nx run angular-typechecker-install-e2e:test` (the audit gate + smoke — the central PKG-02/TEST-05 evidence).
- **Phase gate:** full e2e green (audit + smoke) before `/gsd:verify-work`; the `nx release --first-release --dry-run` reviewed manually; the live publish (05-05) is HUMAN-GATED and NOT a chain gate.

### Wave 0 Gaps
- [ ] `e2e/angular-typechecker-install-e2e/vitest.config.mts` + `project.json` + `tsconfig.json` + `tsconfig.spec.json` — clone Phase-4 cache-e2e; bump timeouts to >= 300000
- [ ] `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` — covers PKG-01 (LICENSE/tarball) + PKG-02 (publint/attw/leak/scripts)
- [ ] `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` — covers TEST-05 (green + injected-error) + B-03 (clean install)
- [ ] `e2e/angular-typechecker-install-e2e/fixtures/<consumer-app>/` — committed minimal app fixture wired with the PUBLISHED executor id + `includeDeps:true`
- [ ] Extend `packages/angular-typechecker/src/package-manifest.spec.ts` — new PKG-01 fields (files/exports/keywords/repository/license/description/publishConfig)
- [ ] A small repo-hygiene/config spec — SECURITY.md presence, release-workflow YAML invariants, `nx.json` release.projects scoping (PKG-04/PKG-03 config)
- [ ] Root devDeps: `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4`

*The D-10 fix is NOT a "test gap" — it is a production-code fix in 05-01; the `attw` assertion in the audit gate is what verifies it.*

## Security Domain

> `security_enforcement` is ABSENT in `.planning/config.json` (= enabled). This phase is largely a SECURITY phase (PKG-04 + the supply-chain hardening). ASVS categories below are scoped to a published npm package + a release pipeline (no auth/session/runtime-app surface).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / Supply Chain | yes | SHA-pinned actions, least-privilege CI permissions, Dependabot, provenance attestation (D-15/D-16) |
| V2 Authentication | yes (publish auth) | OIDC Trusted Publishers (no long-lived token); short-lived seed token revoked after first publish (D-12/D-13) |
| V3 Session Management | no | n/a (no app sessions) |
| V4 Access Control | yes (publish gating) | Required-reviewer `environment` on the publish job; tag/workflow-scoped Trusted Publisher; `contents: read` default (D-15) |
| V5 Input Validation | partial | the executor schema's `additionalProperties:false` (already shipped, Phase 4); the release workflow takes NO untrusted PR input (tag-push only) |
| V6 Cryptography | yes (attestation) | npm provenance (Sigstore-backed, generated by npm — never hand-rolled) (D-04/D-13) |
| V14 Configuration | yes | `files` allowlist (no source/test/secret leak), no install scripts in the tarball, no secrets in the workflow (D-01/D-09/D-15) |

### Known Threat Patterns for {Nx-plugin npm publish pipeline}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CI command injection via `pull_request_target` + unsanitized PR title (s1ngularity) | Elevation of Privilege / Tampering | Tag-push trigger only; NEVER `pull_request_target`; `contents: read` top-level (D-15) |
| Whole-repo Trusted-Publisher trust abused by orphaned commit (TanStack May 2026) | Spoofing / Tampering | Trusted Publisher pinned to EXACT workflow filename + environment + branch/tag protection; required-reviewer gate (D-12/D-15) |
| Malicious `postinstall` payload in the published tarball | Tampering | No-install-scripts tarball gate (D-09) — assert no `pre/post/install/prepare/prepublish` scripts |
| Leaked long-lived npm token | Information Disclosure | OIDC (no standing token); short-lived seed token revoked immediately (D-12) |
| Mutable action-tag repointed to malicious code (tj-actions) | Tampering | SHA-pin ALL actions to 40-char commit SHA + `# vN`; Dependabot keeps them fresh (D-15/D-16) |
| Credential persisted in `.git/config` leaked via artifact | Information Disclosure | `persist-credentials: false` on checkout (D-15) |
| Source/secret leak in tarball | Information Disclosure | Explicit `files` allowlist; `files[]` leak assertion in the audit gate (D-01/D-09) |
| Consumer cannot verify build origin | Repudiation | npm provenance (`NPM_CONFIG_PROVENANCE=true` + `publishConfig.provenance:true`); post-publish verify via `npm view --json` (D-04/D-16) |

## Sources

### Primary (HIGH confidence — verified this session)
- Empirical: `nx build angular-typechecker` (green) -> `npm pack` -> `attw ./angular-typechecker-0.0.1.tgz --profile node16 [--format json]` (InternalResolutionError on all profiles; D-10 confirmed) + `publint ./...tgz --strict` (PASS) + `npm pack --dry-run --json` (41 files, no LICENSE, no `files` field) + on-disk `.d.ts` reachability analysis (public surface depends on `CompilerCli`/`Program`).
- `npm view publint version` -> 0.3.21; `npm view @arethetypeswrong/cli version` -> 0.18.4; `npm --version` -> 11.16.0; postinstall scripts absent for both; `slopcheck install publint @arethetypeswrong/cli` (both OK).
- `github.com/npm/cli/issues/8544` (WebFetch) — first-publish-via-OIDC STILL OPEN.
- `nx.dev/docs/guides/nx-release/publish-in-ci-cd` (WebFetch) — `id-token: write`, `NPM_CONFIG_PROVENANCE`, `npx nx release publish`.
- `nx.dev/blog/s1ngularity-postmortem` (WebFetch) — `pull_request_target` injection root cause; Trusted Publishers + manual 2FA approval adopted; postinstall payload.

### Secondary (MEDIUM-HIGH — WebSearch cross-verified against official docs)
- npm Trusted Publishing 2026: `docs.npmjs.com/trusted-publishers/`; `philna.sh/blog/2026/01/28/trusted-publishing-npm/` — npm >= 11.5.1, Node >= 22.14.0, cloud-runner-only, `repository.url` match, 2026-05-20 action-selection.
- `NODE_AUTH_TOKEN`-must-be-unset: npm/cli#9088 (misleading 404/ENEEDAUTH), community#176761, `actions/setup-node` default-token gotcha.
- TanStack May-2026 attack (whole-repo trust): WebSearch (Nx Console v18.95.0 postmortem reference + hardening guides).
- GitHub Actions hardening: GitHub Docs "Secure use reference"; SHA-pin enforcement changelog 2025-08-15; `persist-credentials: false`; environment required-reviewers.
- GitHub SECURITY.md / Private Vulnerability Reporting: `docs.github.com/code-security/...` — PVR separate-but-complementary; maintainer-notification-default-off caveat.
- `nx release --first-release --dry-run` with conventionalCommits + no tags: prompts for version, writes nothing in dry-run; nrwl/nx#27887 (version field required).

### Tertiary (project artifacts — authoritative for this repo)
- CONTEXT.md (D-01..D-22, B-01..B-03, canonical_refs) — the locked decision set.
- PITFALLS.md (Pitfall 5/6, Security Mistakes), STACK.md (manifest/executors.json conventions, nx release norms), 04-CONTEXT.md (D-14 serialized harness), 04-LEARNINGS.md (dual-key nx.json, nested-nx env trap, `--no-color` rejection), STATE.md (legacy-peer-deps caveat, [01-03 CAVEAT] deep-import shim fragility).
- On-disk: `e2e/angular-typechecker-cache-e2e/` (harness to clone), `libs/typecheck-consumer/project.json` (dev-scoped id — contrast for D-18), current `package.json`/`project.json`/`executors.json`/`nx.json`.

## Metadata

**Confidence breakdown:**
- Standard stack (publint/attw): HIGH — versions verified on registry, both legitimate (slopcheck OK), already used to produce findings this session.
- Architecture / packaging flow: HIGH — verbatim source->dist copy verified on disk; tarball contents enumerated empirically.
- D-10 defect + fix path: HIGH (defect) / MEDIUM (exact self-contained-types shape) — defect reproduced with `attw`; the precise re-declaration is an implementation detail (A1/A3, Open Q3).
- Release/OIDC: HIGH — npm/cli#8544 OPEN confirmed; NODE_AUTH_TOKEN-unset + 2026-05-20 action-selection verified live.
- Supply-chain hardening: HIGH — s1ngularity + TanStack + GitHub hardening all cross-verified.
- Pitfalls: HIGH — each tied to a verified source or on-disk reproduction.

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 for the npm/OIDC fast-moving area (re-check npm/cli#8544 + the 2026-05-20 action-selection rules at execution time); ~2026-09-28 for the stable packaging/Nx-release norms.

## RESEARCH COMPLETE

**Phase:** 5 - Packaging, Publish Hardening + e2e Smoke (MVP)
**Confidence:** HIGH

### Key Findings
- **D-10/B-02 is a confirmed, non-trivial public-surface defect.** `attw --pack` returns `InternalResolutionError` on ALL profiles; the deep-import escape in `compiler-cli-types.d.ts` IS reachable from the public `index.d.ts` (verified on disk), so erasure is NOT viable — the fix must make the types self-contained (D-10 option a). Front-load this in 05-01; gate it with `attw` in 05-02.
- **The tarball already ships the manifests + executor `.js` with NO spec/fixture leak, and `publint --strict` already passes** — but it currently has NO `files` allowlist and NO LICENSE; D-01/D-07 add both. No install scripts present (no-install-scripts gate will pass).
- **The release bootstrap is verified-correct and must stay HUMAN-GATED (B-01):** npm/cli#8544 (first-publish-via-OIDC) is still OPEN; the 2026-05-20 action-selection requirement is now in force (today is 2026-06-28); `NODE_AUTH_TOKEN` must be entirely UNSET (`actions/setup-node` can inject a default — a real gotcha).
- **Supply-chain hardening (PKG-04) is well-founded:** s1ngularity (`pull_request_target` injection + postinstall payload) and TanStack May-2026 (whole-repo trust) both confirm tag-push trigger + SHA-pins + required-reviewer environment + workflow-scoped Trusted Publisher as load-bearing.
- **`publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` are legitimate** (slopcheck OK, mature, source-backed, postinstall-free); add as ROOT devDeps in 05-02.

### File Created
`.planning/phases/05-packaging-publish-hardening-e2e-smoke-mvp/05-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | versions verified on registry; tools used live this session |
| Architecture | HIGH | source->dist verbatim copy + tarball contents verified empirically |
| D-10 fix path | HIGH/MEDIUM | defect reproduced; exact re-declaration is impl detail (A1/A3) |
| Release/OIDC | HIGH | npm/cli#8544 OPEN + NODE_AUTH_TOKEN-unset + 2026-05-20 verified |
| Pitfalls/Security | HIGH | each tied to a verified source or on-disk reproduction |

### Open Questions
- Shared vs sibling e2e project for audit+smoke (recommend shared).
- Whether a clean install ERESOLVEs (B-03 — discoverable only at smoke runtime; escalate remediation).
- Exact self-contained-types shape for D-10 (recommend structural re-declaration on `typescript` substrate; build itself guards signature drift).

### Ready for Planning
Research complete. The planner can now create the 5 PLAN.md files (05-01..05-05) per D-22, front-loading the D-10 self-contained-types fix and the `attw`-clean gate, and stopping at publish-ready (B-01).
