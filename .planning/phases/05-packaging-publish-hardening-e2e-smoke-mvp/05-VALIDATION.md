---
phase: 5
slug: packaging-publish-hardening-e2e-smoke-mvp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` "## Validation Architecture". Covers PKG-01..04 + TEST-05.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (Nx 23.0.1) |
| **Config file** | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (NEW — clone Phase-4 cache-e2e config, timeouts >= 300000) + existing `packages/angular-typechecker/vitest.config.mts` for the manifest unit spec |
| **Quick run command** | `npx nx test angular-typechecker` (manifest unit spec — fast, no build) |
| **Full suite command** | `npx nx run angular-typechecker-install-e2e:test` (serialized e2e: tarball-audit gate + install smoke — slow, needs build + pack) |
| **Estimated runtime** | unit ~5-15s; install-e2e ~60-180s (build + pack + clean install + 2 nx runs) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (fast feedback on PKG-01 manifest).
- **After every plan wave:** Run `npx nx run angular-typechecker-install-e2e:test` (the audit gate + smoke — central PKG-02/TEST-05 evidence).
- **Before `/gsd:verify-work`:** Full e2e (audit + smoke) must be green; `nx release --first-release --dry-run` reviewed manually.
- **Max feedback latency:** ~180 seconds (full e2e).
- **NOT a chain gate:** the live publish (05-05) is HUMAN-GATED (B-01) — never an automated verification step.

---

## Per-Task Verification Map

| Req ID | Plan | Wave | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| PKG-01 | 05-01 | 1 | manifest declares `files`/`exports`/`executors`/keywords/`repository`/`license`/peers/devkit-dep | — | n/a | unit | `npx nx test angular-typechecker` (extend `package-manifest.spec.ts`) | EXTEND (exists) | ⬜ pending |
| PKG-01 | 05-01 | 1 | LICENSE file exists + ships in tarball | T-V14 | no source/secret leak; license present | e2e | install-e2e audit gate (`files[]` contains `LICENSE`) | ❌ W0 | ⬜ pending |
| PKG-01/D-10 | 05-01 | 1 | `compiler-cli-types.d.ts` self-contained (no deep-relative escape) | — | n/a | e2e (attw) | install-e2e audit gate (`attw --profile node16` problems empty) | ❌ W0 | ⬜ pending |
| PKG-02 | 05-02 | 2 | executors.json/schema.json/schema.d.ts/executor.js present in tarball | T-V14 | only intended files ship | e2e | install-e2e audit gate (`files[]` positive set) | ❌ W0 | ⬜ pending |
| PKG-02 | 05-02 | 2 | `publint --strict` clean against tarball | — | n/a | e2e | install-e2e audit gate (execSync publint) | ❌ W0 | ⬜ pending |
| PKG-02 | 05-02 | 2 | `attw --pack --profile node16` problems empty (D-10 fixed) | — | n/a | e2e | install-e2e audit gate (execSync attw --format json) | ❌ W0 (FAILS until D-10 fix) | ⬜ pending |
| PKG-02 | 05-02 | 2 | no `.spec`/tsconfig.spec/fixture leak + no install scripts | T-V14 | no test/secret leak; no postinstall vector | e2e | install-e2e audit gate (negative `files[]` + scripts check) | ❌ W0 | ⬜ pending |
| PKG-03 | 05-04 | 3 | `nx.json` release block scopes to `angular-typechecker` only | T-V4 | fixtures never published | config | assert `nx.json` `release.projects == ["angular-typechecker"]` | ❌ W0 | ⬜ pending |
| PKG-03 | 05-04/05 | 3 | `nx release --first-release --dry-run` -> 0.0.1 + tag + changelog preview | — | n/a | manual-only | `npx nx release --first-release --dry-run` | n/a (B-01) | ⬜ pending |
| PKG-03 | 05-05 | — | live publish via OIDC + provenance | T-V2/V6 | tokenless OIDC; provenance attested | manual-only | HUMAN (token-seed -> register TP -> revoke); verify `npm view angular-typechecker --json` provenance | n/a (B-01) | ⬜ pending |
| PKG-04 | 05-04 | 3 | SECURITY.md present at repo root | — | n/a | unit (presence) | assert `fs.existsSync('SECURITY.md')` | ❌ W0 | ⬜ pending |
| PKG-04 | 05-04 | 3 | release workflow: read-only top perms, id-token:write only, no `pull_request_target`, SHA-pinned, `environment` | T-V1/V4 | least-privilege CI; no untrusted trigger | unit (YAML lint) | parse `.github/workflows/release.yml`; assert invariants | ❌ W0 | ⬜ pending |
| TEST-05 | 05-03 | 2 | packed tarball installs clean (no legacy-peer-deps) + runs green | T-V5 | honest peer resolution | e2e | install-e2e smoke (green run exit 0) | ❌ W0 | ⬜ pending |
| TEST-05 | 05-03 | 2 | injected TS2322 -> non-zero exit + `TS2322` in stdout + no `ERR_REQUIRE_ESM`/infra-error | — | proves the check ran (not a no-op) | e2e | install-e2e smoke (injected-error run) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/angular-typechecker-install-e2e/vitest.config.mts` + `project.json` + `tsconfig.json` + `tsconfig.spec.json` — clone Phase-4 cache-e2e; timeouts >= 300000; `implicitDependencies: ["angular-typechecker"]`
- [ ] `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` — PKG-01 (LICENSE/tarball) + PKG-02 (publint/attw/leak/scripts)
- [ ] `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` — TEST-05 (green + injected-error) + B-03 (clean install)
- [ ] `e2e/angular-typechecker-install-e2e/fixtures/<consumer-app>/` — committed minimal app fixture wired with the PUBLISHED executor id + `includeDeps:true`; no source alias to plugin
- [ ] Extend `packages/angular-typechecker/src/package-manifest.spec.ts` — new PKG-01 fields (files/exports/keywords/repository/license/description/publishConfig)
- [ ] A small repo-hygiene/config spec — SECURITY.md presence, release-workflow YAML invariants, `nx.json` `release.projects` scoping (PKG-04/PKG-03 config)
- [ ] Root devDeps: `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `nx release --first-release --dry-run` preview | PKG-03 | Interactive prompt; previews only (writes nothing) | Run `npx nx release --first-release --dry-run`; confirm proposed version 0.0.1, tag `angular-typechecker@0.0.1`, changelog preview |
| Live first publish (token seed -> register Trusted Publisher -> revoke token; OIDC thereafter) | PKG-03 | IRREVERSIBLE + requires out-of-band npmjs.com Trusted-Publisher registration no agent can perform (B-01) | Human runs the seed publish from CI with a short-lived granular token + provenance; registers TP (exact workflow filename + environment); revokes token; verifies provenance via `npm view angular-typechecker --json` |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency (the two manual-only items are B-01 publish-gated and explicitly excluded from the chain gate)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the install-e2e project + specs + fixture + manifest-spec extension + root devDeps)
- [ ] No watch-mode flags (execSync only; `NX_DAEMON=false`)
- [ ] Feedback latency < 180s (full e2e)
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, by validate-phase)

**Approval:** pending
