# Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 5-Packaging, Publish Hardening + e2e Smoke (MVP)
**Mode:** `--analyze --auto --chain` (auto-select recommended; trade-off analysis per area; auto-advance to plan-phase). Two HIGH-impact + not-HIGH-confidence areas escalated to the user per the trap-quadrant rule.
**Method:** 5-member Opus research panel (lenses: npm-packaging/tarball-fidelity, nx-release/OIDC/provenance, supply-chain/CI-hardening, e2e-smoke-harness, integration/red-team), phase-specific research over project docs + local public clones (nx-verdaccio, analog, nx, sandbox) + live 2026 docs.
**Areas discussed:** files allowlist, exports map, manifest metadata, publishConfig, LICENSE, peer ranges, assets globs, tarball audit gate, deep-import .d.ts escape, nx release config, first-publish bootstrapping, local/CI split, SECURITY.md, hardened CI, supply-chain MVP set, e2e install mechanism, smoke shape/assertions/honesty, harness, plan sequencing.

---

## First publish + OIDC bootstrapping (USER-ESCALATED -- trap quadrant)

| Option                  | Description                                                                                                                                                                                     | Selected |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Token seed, then OIDC   | Auto everything to publish-ready; STOP; human seed-publishes 0.0.1 with a short-lived granular token (+provenance), registers the Trusted Publisher, revokes the token; later releases via OIDC | ✓        |
| Dummy-package bootstrap | Bootstrap via third-party setup-npm-trusted-publish so the real 0.0.1 publishes via OIDC; cost: third-party tool in a hardening phase + a burned junk version                                   |          |
| Defer publish to later  | Phase 5 delivers publish-ready + config + dry-run; PKG-03 execution deferred to a separate release event                                                                                        |          |

**User's choice:** Token seed, then OIDC.
**Notes:** npm cannot do a first publish via OIDC (npm/cli#8544 open 2026-06-23) and Trusted-Publisher registration is a manual npmjs.com action -- so the live publish is HUMAN-GATED (B-01); the `--chain` stops at publish-ready.

## Published @angular/compiler-cli peer range (USER-ESCALATED -- trap quadrant)

| Option                                      | Description                                                                                                            | Selected |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| Stable 22 only: `^22.0.0`                   | Stable Angular 22 audience; README `--legacy-peer-deps` note for pre-release consumers; widening later is non-breaking | ✓        |
| Pre-release-inclusive: `>=22.0.0-0 <23.0.0` | Admits the 22.x -next/-rc builds the engine was first probed against; also admits untested pre-releases                |          |

**User's choice:** Stable 22 only.
**Notes (user directive):** "We must not use 22 next/rc prereleases for verification." -> phase-wide constraint: ALL verification (tests/fixtures/smoke/CI) targets STABLE Angular 22 (`@angular/compiler-cli@22.0.4`); supersedes the early-spike `22.1.0-next.3` probing note.

---

## Auto-selected (recommended option; panel HIGH confidence) -- summary

| Area              | Selected (recommended)                                                                                                                                        | Runner-up considered                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `files` allowlist | `["src","executors.json","README.md","LICENSE"]`                                                                                                              | omit `files` (rejected: Pitfall-5 trap)                        |
| `exports`         | minimal `{".":"./src/index.js","./package.json":"./package.json"}` + keep main/types                                                                          | no exports / full conditional exports                          |
| metadata          | add repository(+directory)/license/description/keywords(nx,nx-plugin)/homepage/bugs/author(public email)                                                      | --                                                             |
| `publishConfig`   | `{provenance:true}` (drop access -- unscoped)                                                                                                                 | env-only provenance                                            |
| LICENSE           | create per-package LICENSE + asset glob                                                                                                                       | (none today -- gap)                                            |
| assets globs      | keep; REMOVE dead `generators.json` glob                                                                                                                      | --                                                             |
| PKG-02 gate       | serialized Vitest e2e: publint --strict + attw --profile node16 + leak + no-install-scripts assertions vs tarball                                             | npm-scripts-only / Nx target                                   |
| nx release        | projects-scoped, conventionalCommits, preVersionCommand build, workspaceChangelog createRelease github                                                        | independent-mode / extra generatorOptions                      |
| local/CI split    | local `nx release --skip-publish` (--first-release once) + --dry-run; CI `nx release publish` tag-push; NODE_AUTH_TOKEN unset                                 | push-to-main auto-release                                      |
| CI security       | top-level contents:read; publish job id-token:write; SHA-pin all; persist-credentials:false; manual-approval environment; tag-push, never pull_request_target | broad GITHUB_TOKEN / PR trigger (rejected: s1ngularity vector) |
| SECURITY.md       | root; PVR primary + email fallback; latest-0.x-only table                                                                                                     | email-only / PVR-only                                          |
| supply-chain MVP  | Dependabot(github-actions) + npm 2FA + no-install-scripts gate                                                                                                | + Scorecard/harden-runner/CodeQL (deferred to Phase 6)         |
| e2e install       | `npm pack` + `npm install <tgz>`                                                                                                                              | Verdaccio (deferred to Phase 6)                                |
| smoke shape       | committed consumer fixture (tmp copy), PUBLISHED executor id, green + injected-error assertions, clean install (no legacy-peer-deps)                          | ephemeral create-nx-workspace; exit-0-only                     |
| harness           | new dedicated serialized e2e project, Phase-4 D-14 config, timeout>=300000, main-tree only                                                                    | extend cache-e2e project                                       |
| sequencing        | 5 plans tracer-bullet ordered; all sequential on main tree; smoke gates publish                                                                               | one-plan-per-requirement                                       |

---

## Claude's Discretion

Exact keyword list + description wording; e2e fixture/project name + app-vs-lib; CI Node version (>=22.14.0); whether to add a `require()`-the-installed-executor check; exact SECURITY.md prose; whether the audit gate + smoke share one e2e project; exact `attw --ignore-rules` (run-authoritative, justify any suppression); verify `tslib` necessity via dependency-checks.

## Deferred Ideas

Verdaccio install + full 5-type matrix + pnpm + mixed-case + cross-OS CI -> Phase 6; Nx registry-listing PR -> post-publish follow-up; Scorecard/harden-runner/CodeQL/signed commits -> Phase 6/later; source-map stripping -> optional later; createNodesV2/nx add/ng add/CLI/builder/reporters/migrations -> deferred milestones.
