---
phase: 5
slug: packaging-publish-hardening-e2e-smoke-mvp
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
validated: 2026-06-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` "## Validation Architecture". Covers PKG-01..04 + TEST-05.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.x via `@nx/vitest:test` (Nx 23.0.1)                                                                                                                                                              |
| **Config file**        | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (NEW — clone Phase-4 cache-e2e config, timeouts >= 300000) + existing `packages/angular-typechecker/vitest.config.mts` for the manifest unit spec |
| **Quick run command**  | `npx nx test angular-typechecker` (manifest unit spec — fast, no build)                                                                                                                                   |
| **Full suite command** | `npx nx run angular-typechecker-install-e2e:test` (serialized e2e: tarball-audit gate + install smoke — slow, needs build + pack)                                                                         |
| **Estimated runtime**  | unit ~5-15s; install-e2e ~60-180s (build + pack + clean install + 2 nx runs)                                                                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (fast feedback on PKG-01 manifest).
- **After every plan wave:** Run `npx nx run angular-typechecker-install-e2e:test` (the audit gate + smoke — central PKG-02/TEST-05 evidence).
- **Before `/gsd:verify-work`:** Full e2e (audit + smoke) must be green; `nx release --first-release --dry-run` reviewed manually.
- **Max feedback latency:** ~180 seconds (full e2e).
- **NOT a chain gate:** the live publish (05-05) is HUMAN-GATED (B-01) — never an automated verification step.

---

## Per-Task Verification Map

| Req ID      | Plan     | Wave | Behavior                                                                                                        | Threat Ref | Secure Behavior                            | Test Type        | Automated Command                                                                                    | File Exists                 | Status                                                                  |
| ----------- | -------- | ---- | --------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| PKG-01      | 05-01    | 1    | manifest declares `files`/`exports`/`executors`/keywords/`repository`/`license`/peers/devkit-dep                | —          | n/a                                        | unit             | `npx nx test angular-typechecker` (`package-manifest.spec.ts`)                                       | ✅ extended                 | ✅ green (13 tests)                                                     |
| PKG-01      | 05-01    | 1    | LICENSE file exists + ships in tarball                                                                          | T-V14      | no source/secret leak; license present     | e2e              | install-e2e audit gate (`files[]` contains `LICENSE`)                                                | ✅ exists                   | ✅ green                                                                |
| PKG-01/D-10 | 05-01    | 1    | `compiler-cli-types.d.ts` self-contained (no deep-relative escape)                                              | —          | n/a                                        | e2e (attw)       | install-e2e audit gate (`attw --profile node16` problems empty + no `@fixtures` in shipped `.d.ts`)  | ✅ exists                   | ✅ green                                                                |
| PKG-02      | 05-02    | 2    | executors.json/schema.json/schema.d.ts/executor.js present in tarball                                           | T-V14      | only intended files ship                   | e2e              | install-e2e audit gate (`files[]` positive set)                                                      | ✅ exists                   | ✅ green                                                                |
| PKG-02      | 05-02    | 2    | `publint --strict` clean against tarball                                                                        | —          | n/a                                        | e2e              | install-e2e audit gate (execSync publint)                                                            | ✅ exists                   | ✅ green                                                                |
| PKG-02      | 05-02    | 2    | `attw --pack --profile node16` problems empty (D-10 fixed)                                                      | —          | n/a                                        | e2e              | install-e2e audit gate (execSync attw --format json)                                                 | ✅ exists (D-10 fix landed) | ✅ green                                                                |
| PKG-02      | 05-02    | 2    | no `.spec`/tsconfig.spec/fixture leak + no install scripts                                                      | T-V14      | no test/secret leak; no postinstall vector | e2e              | install-e2e audit gate (negative `files[]` + scripts check)                                          | ✅ exists                   | ✅ green                                                                |
| PKG-03      | 05-04    | 3    | `nx.json` release block scopes to `angular-typechecker` only                                                    | T-V4       | fixtures never published                   | config           | assert `nx.json` `release.projects == ["angular-typechecker"]`                                       | ✅ exists                   | ✅ green                                                                |
| PKG-03      | 05-04/05 | 3    | `nx release --first-release --dry-run` -> 0.0.1 + tag + changelog preview                                       | —          | n/a                                        | manual-only      | `npx nx release --first-release --dry-run`                                                           | n/a (B-01)                  | ⚪ manual-only (exercised: dry-run PASS, 05-VERIFICATION)               |
| PKG-03      | 05-05    | —    | live publish via OIDC + provenance                                                                              | T-V2/V6    | tokenless OIDC; provenance attested        | manual-only      | HUMAN (token-seed -> register TP -> revoke); verify `npm view angular-typechecker --json` provenance | n/a (B-01)                  | ✅ DONE (0.0.1 live w/ provenance; TP registered — see 05-VERIFICATION) |
| PKG-04      | 05-04    | 3    | SECURITY.md present at repo root                                                                                | —          | n/a                                        | unit (presence)  | assert `fs.existsSync('SECURITY.md')`                                                                | ✅ exists                   | ✅ green                                                                |
| PKG-04      | 05-04    | 3    | release workflow: read-only top perms, id-token:write only, no `pull_request_target`, SHA-pinned, `environment` | T-V1/V4    | least-privilege CI; no untrusted trigger   | unit (YAML lint) | parse `.github/workflows/release.yml`; assert invariants                                             | ✅ exists                   | ✅ green (incl. Dependabot)                                             |
| TEST-05     | 05-03    | 2    | packed tarball installs clean (no legacy-peer-deps) + runs green                                                | T-V5       | honest peer resolution                     | e2e              | install-e2e smoke (green run exit 0)                                                                 | ✅ exists                   | ✅ green                                                                |
| TEST-05     | 05-03    | 2    | injected TS2322 -> non-zero exit + `TS2322` in stdout + no `ERR_REQUIRE_ESM`/infra-error                        | —          | proves the check ran (not a no-op)         | e2e              | install-e2e smoke (injected-error run)                                                               | ✅ exists                   | ✅ green                                                                |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⚪ manual-only. All 12 automated rows RE-RUN LIVE this audit (2026-06-28) and PASSED. The two manual-only rows are B-01 publish-gated and excluded from the chain gate; the live publish (05-05) was nonetheless COMPLETED out-of-band._

---

## Wave 0 Requirements

- [x] `e2e/angular-typechecker-install-e2e/vitest.config.mts` + `project.json` + `tsconfig.json` + `tsconfig.spec.json` — clone Phase-4 cache-e2e; timeouts >= 300000; `implicitDependencies: ["angular-typechecker"]` [all four present; serialized forks/singleFork/node env confirmed]
- [x] `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` — PKG-01 (LICENSE/tarball) + PKG-02 (publint/attw/leak/scripts) [6 tests green live]
- [x] `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` — TEST-05 (green + injected-error) + B-03 (clean install) [1 test green live, ~21s]
- [x] `e2e/angular-typechecker-install-e2e/fixtures/<consumer-app>/` — committed minimal app fixture wired with the PUBLISHED executor id + `includeDeps:true`; no source alias to plugin [present; wires `consumer-app:angular-typecheck` via the published unscoped id]
- [x] Extend `packages/angular-typechecker/src/package-manifest.spec.ts` — new PKG-01 fields (files/exports/keywords/repository/license/description/publishConfig) [13 tests green live]
- [x] A small repo-hygiene/config spec — SECURITY.md presence, release-workflow YAML invariants, `nx.json` `release.projects` scoping (PKG-04/PKG-03 config) [`release-hygiene.int.spec.ts`, 13 tests green live]
- [x] Root devDeps: `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` [both present in root `package.json`]

---

## Manual-Only Verifications

| Behavior                                                                                       | Requirement | Why Manual                                                                                               | Test Instructions                                                                                                                                                                                                      | Outcome                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx release --first-release --dry-run` preview                                                 | PKG-03      | Interactive prompt; previews only (writes nothing)                                                       | Run `npx nx release --first-release --dry-run`; confirm proposed version 0.0.1, tag `angular-typechecker@0.0.1`, changelog preview                                                                                     | EXERCISED — dry-run previews 0.0.1 + tag `angular-typechecker@0.0.1` + changelog scoped to the plugin (05-VERIFICATION behavioral spot-check)                                                                                                                                          |
| Live first publish (token seed -> register Trusted Publisher -> revoke token; OIDC thereafter) | PKG-03      | IRREVERSIBLE + requires out-of-band npmjs.com Trusted-Publisher registration no agent can perform (B-01) | Human runs the seed publish from CI with a short-lived granular token + provenance; registers TP (exact workflow filename + environment); revokes token; verifies provenance via `npm view angular-typechecker --json` | COMPLETED — `angular-typechecker@0.0.1` live on npm with a `https://slsa.dev/provenance/v1` attestation; TP registered (GitHub Actions, repo LayZeeDK/angular-typechecker, workflow release.yml, env npm-publish, "require 2FA and disallow tokens"); seed token reverted to OIDC-only |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency (the two manual-only items are B-01 publish-gated and explicitly excluded from the chain gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the install-e2e project + specs + fixture + manifest-spec extension + root devDeps) — every Wave-0 file now exists and passes
- [x] No watch-mode flags (execSync only; `NX_DAEMON=false`)
- [x] Feedback latency < 180s (full e2e) — live: install-e2e 3 files / 20 tests in ~27s
- [x] `nyquist_compliant: true` set in frontmatter (post-execution, by validate-phase)

**Approval:** approved (nyquist_compliant: true, wave_0_complete: true) — Validation audit 2026-06-28.

## Validation Audit (2026-06-28)

Retroactive adversarial audit of the Per-Task Verification Map against the implemented tests. Every spec file EXISTS and was RE-RUN LIVE this session (not trusting the SUMMARY/VERIFICATION claims):

- **Unit tier** (`npx nx test angular-typechecker --skip-nx-cache`): 20 files / 107 tests passed in ~7s. Confirms `package-manifest.spec.ts` (13 tests — PKG-01 files/exports/keywords/repository/license/description/provenance/access + CMP-01/CMP-02 dependency-model contract).
- **Install-e2e tier** (`npx nx run angular-typechecker-install-e2e:test --skip-nx-cache`): 3 files / 20 tests passed live in ~27s — `tarball-audit.int.spec.ts` (6), `install-smoke.int.spec.ts` (1), `release-hygiene.int.spec.ts` (13). The interleaved `NX ... consumer-app:angular-typecheck failed` line is the EXPECTED injected-TS2322 honesty output the smoke asserts on (captured inside the test via execSync try/catch), NOT a test failure.
- **Artifact presence** confirmed on disk: `SECURITY.md`, `.github/workflows/release.yml`, `.github/dependabot.yml`, `packages/angular-typechecker/LICENSE`, and root devDeps `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4`.

Both-edges (Nyquist) matrix — every binary signal confirmed by a real, failable test that passed when re-run:

| Signal                      | Edge A                                                                                                                                               | Edge B                                                                                                                        | Result                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| TEST-05 install honesty     | GREEN run from clean install -> exit 0                                                                                                               | injected TS2322 -> non-zero + `TS2322` in stdout + no `ERR_REQUIRE_ESM`/infra-error                                           | PASS (live e2e)                  |
| PKG-02 tarball file-set     | POSITIVE: required files ship (executors.json/schema.json/executor.js/index.js/index.d.ts/README/LICENSE)                                            | NEGATIVE: no `.spec`/tsconfig.spec/`(libs\|fixtures\|e2e)/` leak + no install-script keys + no `@fixtures` in shipped `.d.ts` | PASS (live e2e)                  |
| PKG-02 type/lint gates      | `attw --pack --profile node16` problems empty (D-10 fix)                                                                                             | `publint --strict` no error-level messages                                                                                    | PASS (live e2e)                  |
| PKG-04 release.yml polarity | PRESENT: `id-token: write`, `contents: read`, `environment:`, 40-char SHA pins, `persist-credentials: false`, `NPM_CONFIG_PROVENANCE: true`, `tags:` | ABSENT: `pull_request_target`, `contents: write`, `NODE_AUTH_TOKEN`                                                           | PASS (live e2e)                  |
| PKG-03 release scoping      | `nx.json` `release.projects == ["angular-typechecker"]` (exact)                                                                                      | dry-run previews 0.0.1 only, "Skipped publishing" (no fixture versioned)                                                      | PASS (live e2e + manual dry-run) |
| PKG-04 SECURITY.md          | PRESENT at repo root                                                                                                                                 | directs to PVR ("Report a vulnerability") + public email fallback                                                             | PASS (live e2e)                  |
| PKG-01 manifest contract    | devkit pinned EXACT dependency; peers `^22.0.0` / `>=6.0.0 <6.1.0`                                                                                   | `nx` declared by NO ONE (no dep, no peer); `type: commonjs`                                                                   | PASS (unit)                      |

**Tests generated this audit:** none — coverage was already genuinely complete. Every automated requirement row was already exercised by a real, failable test that passed when re-run live. The two manual-only rows are B-01 publish-gated by design (the dry-run was exercised; the live publish was completed out-of-band), not coverage gaps.
