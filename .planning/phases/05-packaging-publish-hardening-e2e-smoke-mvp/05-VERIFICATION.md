---
phase: 05-packaging-publish-hardening-e2e-smoke-mvp
verified: 2026-06-28T18:30:00Z
status: human_needed
score: 4/4 must-have truths verified (publish-ready boundary); 1 human-gated action remaining (B-01 live publish). Item 2 (tag-pattern/trigger alignment) RESOLVED post-verification in commit 785c747.
overrides_applied: 0
human_verification:
  - test: "Perform the live first npm publish of angular-typechecker@0.0.1 (05-05, B-01)"
    expected: "0.0.1 live on npm (MIT, 0.x semver) with a provenance attestation (npm view angular-typechecker --json shows provenance); npm Trusted Publisher registered against repo LayZeeDK/angular-typechecker, workflow release.yml, environment npm-publish, npm-publish action ticked; the short-lived granular seed token revoked"
    why_human: "By design (B-01). The first publish is irreversible (immutable versions, 72h unpublish window, the npm name is claimed forever) and requires out-of-band npmjs.com actions no agent can perform: npm cannot do a package's FIRST publish via OIDC (npm/cli#8544 open) and registering the Trusted Publisher is a manual npmjs.com UI action. This is the PKG-03 EXECUTION half; the PKG-03 CONFIG is fully verified. NOT a gap/defect."
  - test: "[RESOLVED 2026-06-28, commit 785c747] Release tag pattern aligns with the release.yml workflow trigger"
    expected: "RESOLVED: nx.json now sets release.releaseTag.pattern = 'angular-typechecker@{version}' (Nx 23 nested shape; the deprecated top-level releaseTagPattern is rejected by Nx 23). `nx release 0.0.1 --first-release --dry-run` now prints CREATE .../releases/tag/angular-typechecker@0.0.1, which MATCHES the release.yml trigger glob 'angular-typechecker@*'. The tag-push trigger now fires correctly; workflow_dispatch remains as a fallback. No human action required for this item."
    why_human: "No longer human-gated -- the orchestrator applied the releaseTag.pattern fix and re-verified the dry-run tag form. Retained for audit-trail completeness only."
---

# Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) Verification Report

**Phase Goal:** The plugin is publishable to npm and installs-and-runs end-to-end -- correct dependency/manifest model, executors.json/schema.json present in the tarball, supply-chain-hardened release via nx release (OIDC + provenance + hardened CI + SECURITY.md), all proven by one early e2e smoke (Vertical MVP).
**Verified:** 2026-06-28T18:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

This is an MVP (user-story) packaging phase. The phase-SUCCESS boundary for the autonomous chain is "publish-ready" (plans 05-01..05-04). The live first publish (05-05) is intentionally HUMAN-GATED per decision B-01 -- it is the only irreversible action and requires out-of-band npmjs.com actions no agent can perform. All four publish-ready observable truths are VERIFIED against the codebase and the green test runners (the authoritative signal per project CLAUDE.md). The deferred live publish is reported as a human verification item, NOT a gap.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `package.json` declares `@nx/devkit` pinned dependency (no `nx`), `@angular/compiler-cli`+`typescript` as peers (`^22.0.0` / `>=6.0.0 <6.1.0`), with `files`/`exports`/`executors` fields and `nx`/`nx-plugin` keywords (PKG-01) | VERIFIED | `packages/angular-typechecker/package.json`: deps `{@nx/devkit: 23.0.1, tslib: ^2.3.0}` (no `nx`); peers exactly `^22.0.0` / `>=6.0.0 <6.1.0`; `files: [src, executors.json, README.md, LICENSE]`; `exports: {. , ./package.json}`; `executors: ./executors.json`; keywords include `nx`+`nx-plugin`; `publishConfig.provenance: true`; engines set. 12 manifest regression tests green. |
| 2 | `executors.json`+`schema.json` (v2, `cli:nx`, `outputCapture`) + compiled executor `.js` copied into dist and present in the npm pack tarball, verified by publint + attw --pack against the tarball (PKG-02) | VERIFIED | `executors.json` has `outputCapture: direct-nodejs`; `schema.json` has `version: 2` + `cli: nx`. `nx build` dist carries `executors.json`, `src/executors/angular-typecheck/{executor.js,schema.json}`, LICENSE. tarball-audit.int.spec.ts (6 tests green): `publint --strict` clean; `attw --pack --profile node16 reports problems empty (D-10/B-02 verified)`; positive file-set + negative leak + no-install-scripts all green AGAINST the packed .tgz. |
| 3 | The package publishes via nx release using npm Trusted Publishers (OIDC)+provenance, with SECURITY.md present and the release CI hardened (read-only default perms, no untrusted pull_request_target, SHA-pinned actions, manual-approval publish environment) (PKG-03 CONFIG + PKG-04) | VERIFIED (config) / human_needed (live publish) | nx.json `release.projects: [angular-typechecker]`, conventionalCommits, preVersionCommand build, workspaceChangelog createRelease github. `nx release 0.0.1 --first-release --dry-run` previews 0.0.1 + changelog scoped to angular-typechecker, "Skipped publishing". SECURITY.md at repo root (PVR primary + public-email fallback, latest-0.x-only, ~7-day ack). release.yml: tag-push+workflow_dispatch only (no pull_request_target), top-level `contents: read`, publish job `id-token: write` only, both actions SHA-pinned (40-char) with required-reviewer `environment: npm-publish`, `persist-credentials: false`, `NPM_CONFIG_PROVENANCE: true`, no NODE_AUTH_TOKEN. dependabot.yml github-actions weekly. release-hygiene.int.spec.ts (13 tests green). **Live publish EXECUTION = human-gated (B-01).** |
| 4 | One real-workspace e2e smoke installs the packed tarball and runs `nx run <project>:angular-typecheck` successfully, proving the executor resolves from the installed package (TEST-05) | VERIFIED | install-smoke.int.spec.ts (1 test green, ~20s): packs -> clean tmp `npm install <tgz>` (no peer override) -> `nx run consumer-app:angular-typecheck` exit 0 -> injected TS2322 exits non-zero with `TS2322` in stdout and NO `ERR_REQUIRE_ESM`/infra-error. Committed consumer-app fixture wires the PUBLISHED unscoped id `angular-typechecker:angular-typecheck` + `includeDeps:true`, no source path-alias. B-03 RESOLVED: clean install of stable Angular 22.0.4 peers needs no override. |

**Score:** 4/4 publish-ready truths verified. PKG-03 live-publish EXECUTION is a human-gated follow-up (B-01), not a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/package.json` | Full PKG-01 manifest | VERIFIED | All fields present + correct; peers locked; no `nx` dep; no work-email |
| `packages/angular-typechecker/LICENSE` | MIT (c) 2026 Lars Gyrup Brink Nielsen | VERIFIED | Present; ships into dist via asset glob (dist/LICENSE confirmed) |
| `packages/angular-typechecker/src/core/compiler-cli-types.ts` | Self-contained structural types, no deep import | VERIFIED | 178 lines; `import type * as ts from 'typescript'` substrate; deep-import count 0 (src AND shipped .d.ts); exported names preserved |
| `packages/angular-typechecker/executors.json` | v2 executor + outputCapture | VERIFIED | `outputCapture: direct-nodejs`, schema/impl paths correct |
| `packages/angular-typechecker/README.md` | Consumer guide, published id, Brandon Roberts | VERIFIED | (per 05-01 SUMMARY + grep guards) |
| `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` | publint+attw+leak+no-install-scripts gate | VERIFIED | 6 tests green against packed .tgz |
| `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` | pack->clean install->green+injected-TS2322 | VERIFIED | 1 test green; PUBLISHED id resolution from install |
| `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts` | nx.json+SECURITY.md+release.yml invariants | VERIFIED | 13 tests green |
| `e2e/.../fixtures/consumer-app/project.json` | PUBLISHED id + includeDeps:true | VERIFIED | `executor: angular-typechecker:angular-typecheck`, `includeDeps: true` |
| `nx.json` | release block scoped to angular-typechecker | VERIFIED | `release.projects: [angular-typechecker]` exactly |
| `SECURITY.md` | repo-root policy | VERIFIED | PVR primary + larsbrinknielsen@gmail.com fallback, latest-0.x |
| `.github/workflows/release.yml` | hardened tag-push OIDC workflow | VERIFIED | All PKG-04 invariants present (active YAML directives) |
| `.github/dependabot.yml` | github-actions ecosystem | VERIFIED | version 2, github-actions, weekly |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| index.ts public surface | compiler-cli-types.ts | type re-export over typescript substrate | WIRED | No deep escape; build green is the drift guard |
| project.json (plugin) | LICENSE | build asset glob | WIRED | dist/LICENSE present after build |
| tarball-audit spec | packed .tgz | nx build + npm pack --json | WIRED | attw problems-empty green |
| install-smoke spec | packed .tgz | mkdtemp -> npm install (no legacy-peer-deps) | WIRED | green run exit 0 |
| consumer-app fixture | angular-typechecker:angular-typecheck | PUBLISHED unscoped id | WIRED | resolves from node_modules/angular-typechecker |
| release.yml | npx nx release publish | tag-push -> required-reviewer env -> OIDC (no NODE_AUTH_TOKEN) | WIRED (config) | workflow_dispatch fallback present; tag-pattern alignment is a human-verify item |
| nx.json release.projects | angular-typechecker | scoping so fixtures never versioned | WIRED | dry-run scoped correctly |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Install-e2e suite (audit+smoke+hygiene) | `nx run angular-typechecker-install-e2e:test --skip-nx-cache` | 3 files / 20 tests passed | PASS |
| Plugin unit suite | `nx test angular-typechecker --skip-nx-cache` | 20 files / 106 tests passed | PASS |
| Plugin build + dist artifacts | `nx build angular-typechecker --skip-nx-cache` | exit 0; dist carries executors.json/LICENSE/executor.js/schema.json | PASS |
| GATE A: dynamic import survives | `rg -c "import\(" dist/.../compiler-loader.js` | count 1 | PASS |
| Shipped .d.ts no deep escape | `rg -c "node_modules/@angular/compiler-cli" dist/.../compiler-cli-types.d.ts` | 0 | PASS |
| Publish-ready dry-run | `nx release 0.0.1 --first-release --dry-run` | previews 0.0.1 + changelog, scoped to angular-typechecker, no writes | PASS |

### Probe Execution

No shell probes declared or conventional for this phase (no `scripts/*/tests/probe-*.sh`). The runnable gate is the Vitest install-e2e suite, executed above (20/20 green).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PKG-01 | 05-01 | Manifest model (devkit dep, peers, files/exports/executors, keywords) | SATISFIED | Truth 1; package.json + 12 manifest tests |
| PKG-02 | 05-02 | executors.json/schema.json in tarball, publint+attw verified | SATISFIED | Truth 2; tarball-audit 6 tests green |
| PKG-03 | 05-04 (config), 05-05 (publish) | Publish via nx release + OIDC + provenance | CONFIG SATISFIED / EXECUTION NEEDS HUMAN | Truth 3; nx.json + dry-run + workflow. Live publish human-gated (B-01) |
| PKG-04 | 05-04 | SECURITY.md + hardened CI | SATISFIED | Truth 3; SECURITY.md + release.yml + dependabot.yml + 13 hygiene tests |
| TEST-05 | 05-03 | e2e smoke installs tarball + runs executor | SATISFIED | Truth 4; install-smoke green |

All 5 phase requirement IDs accounted for. No orphans (REQUIREMENTS.md maps exactly PKG-01..04 + TEST-05 to Phase 5; all appear in plan frontmatter). PKG-03 is the only one with a deliberately human-gated execution half.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | -- | -- | No TBD/FIXME/XXX debt markers in any phase-changed file. No stub/placeholder/empty-data patterns. The consumer-app fixture's clean component is intentional (smoke injects error into tmp copy), not a stub. |

### Human Verification Required

#### 1. Live first npm publish (05-05, B-01) -- HUMAN-ONLY ACTION

**Test:** Perform the live first publish of `angular-typechecker@0.0.1` per the 05-05 runbook: create a short-lived granular npm write token scoped to the package; seed-publish 0.0.1 from the hardened CI (tag-push or workflow_dispatch) with the token temporarily as NODE_AUTH_TOKEN + id-token:write + NPM_CONFIG_PROVENANCE; immediately register the npm Trusted Publisher (GitHub Actions, repo LayZeeDK/angular-typechecker, workflow release.yml, environment npm-publish, tick npm publish); revoke the token.
**Expected:** 0.0.1 live on npm (MIT, 0.x) with a provenance attestation (`npm view angular-typechecker --json` shows provenance); Trusted Publisher attached; seed token revoked; steady-state workflow publishes tokenlessly via OIDC.
**Why human:** By design (B-01). Irreversible, and requires out-of-band npmjs.com actions no agent can perform (npm/cli#8544: no OIDC first-publish; manual Trusted-Publisher registration). This is the PKG-03 EXECUTION half; the CONFIG is fully verified above. NOT a gap/defect.

#### 2. Release tag-pattern / workflow-trigger alignment -- RESOLVED (2026-06-28, commit 785c747)

**Test:** At the live release, confirm the git tag `nx release` produces actually triggers `.github/workflows/release.yml`.
**Resolution:** The orchestrator applied the fix this verification recommended. `nx.json` now sets `release.releaseTag.pattern = "angular-typechecker@{version}"` (the Nx 23 nested shape; the deprecated top-level `releaseTagPattern` is rejected by Nx 23 with an explicit error). `nx release 0.0.1 --first-release --dry-run` now prints `CREATE .../releases/tag/angular-typechecker@0.0.1`, which MATCHES the `release.yml` trigger glob `angular-typechecker@*`. The tag-push trigger now fires on the tag `nx release` actually creates; `workflow_dispatch` remains as a fallback. **No human action required for this item** -- it is retained here for audit-trail completeness only.

### Gaps Summary

No gaps. All four publish-ready observable truths are VERIFIED against the codebase and the green test/build runners:
- PKG-01 manifest contract: complete and regression-guarded.
- PKG-02 tarball audit: publint clean + attw --pack problems-empty (the D-10/B-02 self-contained-types fix is authoritatively proven), positive/negative file-set + no-install-scripts all green against the real packed .tgz.
- PKG-03 release CONFIG: nx.json scoped release block + dry-run preview of 0.0.1 + OIDC/provenance workflow wiring -- all present and hygiene-tested. The live publish EXECUTION is the intentionally human-gated B-01 action (recorded as human_needed item #1, by design).
- PKG-04: SECURITY.md + supply-chain-hardened release.yml (tag-push only, least-privilege, SHA-pinned, required-reviewer environment, NODE_AUTH_TOKEN unset, provenance on) + Dependabot -- all present and regression-proofed by release-hygiene.int.spec.ts.
- TEST-05 e2e smoke: clean tarball install + green run + injected-TS2322 honesty check -- the tracer bullet proves install-and-run from a consumer install.

Status is `human_needed` (not `passed`) solely because of ONE remaining human-only item: the deliberately deferred live first publish (B-01). (The second item originally flagged here -- tag-pattern/trigger alignment -- was RESOLVED post-verification in commit 785c747; see item #2 above.) Per the verification decision tree, a non-empty human-verification section makes the status `human_needed`. This is the correct framing for the 05-05 publish -- it is a human-only release event, not a defect. The phase has fully achieved its publish-ready goal boundary; the only outstanding work is the irreversible human-gated publish.

---

_Verified: 2026-06-28T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
