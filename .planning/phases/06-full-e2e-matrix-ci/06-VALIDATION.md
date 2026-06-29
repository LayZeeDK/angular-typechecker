---
phase: 6
slug: full-e2e-matrix-ci
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-29
updated: 2026-06-29
---

# Phase 6 — Validation Strategy

> REFRESHED to the re-discuss-v2 LEAN design (RD-01..RD-12). Supersedes the earlier
> 9-cell / `needs:[test,e2e]` wording. All coverage exists and PASSES (independently
> re-run by the verifier); the only open item is SC3 (matrix green on real runners),
> which is human-gated by design (RD-10 draft PR) and tracked in Manual-Only below.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x via `@nx/vitest:test` |
| **Config file** | per-project `vitest.config.mts` (plugin unit: jsdom; e2e: cloned serialized node-env config) |
| **Quick run** | `npx nx run-many -t test -p angular-typechecker` (unit + integration) |
| **e2e run** | `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` (Linux-only gate; runs locally too) |
| **act suite** | `bash tools/act/act-compat.sh` (container-free `act --validate` + `act -n` per trigger) |
| **workflow lint** | `actionlint .github/workflows/*.yml` |
| **Verified runtimes** | unit/int 114 ✓; matrix-e2e 7 ✓ (~82s); install-e2e 22 ✓; act-compat 12 ✓; actionlint exit 0; `nx run-many -t build` green |

---

## Sampling Rate

- **After every task commit:** `npx nx run-many -t test -p angular-typechecker`
- **After every plan wave:** add the e2e project list + `bash tools/act/act-compat.sh` + `actionlint`
- **Phase gate (real-runner):** the `ci.yml` matrix green on the draft PR -> the aggregate `ci` job green (RD-10)

---

## Per-Plan Verification Map (final — all PASS except the push-gated SC3)

| Req | Plan | Behavior | Test | Command | Status |
|-----|------|----------|------|---------|--------|
| TEST-03 | 06-02 | 5 project types green + injected TS2322 vs the installed tarball | e2e | `nx run angular-typechecker-matrix-e2e:test` (it.each x5) | ✅ 7/7 |
| TEST-03/OUT-02 | 06-02 | pnpm symlinked-store run + realpath guard (Windows fallback; Linux CI = true teeth) | e2e | (same spec) | ✅ (fallback locally) |
| OUT-02 | 06-03 | mixed-case fold (both case modes) + RD-04 `.pnpm`/`.bun`/plain store-dir generality | unit | `nx run-many -t test -p angular-typechecker` | ✅ filter-diagnostics 13 |
| OUT-02 | 06-03 | host-derived `useCaseSensitiveFileNames` | integration | (same) | ✅ run-typecheck.integration 13 |
| CI-01 | 06-04 | release.yml publish `if:` ref gate; OIDC model unchanged | regression | release-hygiene int spec | ✅ 22/22 |
| CI-01 | 06-05 | lean 6-cell matrix + Linux-only e2e + act-compat + lint-workflows + aggregate `ci` gate | CI infra | actionlint + act-compat.sh | ✅ actionlint 0 / act 12 |
| CI-01 | 06-05 | act suite: all triggers/conditions (incl tag-vs-branch publish discrimination) | act | `bash tools/act/act-compat.sh` | ✅ 12/12 |
| CI-01 | — | **full matrix GREEN on windows-latest + macos-latest real runners** | CI matrix | the draft-PR run | ⏳ HUMAN-GATED (RD-10) |

---

## Nyquist Sample Points (lean 6-cell)

- **5 project types x install path** — app, local lib, buildable lib, publishable lib, spec tsconfig (e2e, npm; green + injected TS2322). ✅
- **pnpm symlink case** — one pnpm install; symlinked-store run + realpath guard (Windows fallback locally; Linux CI authoritative). ✅ (local) / ⏳ (Linux true-teeth)
- **mixed-case + store-dir** — unit (`filter-diagnostics.spec.ts`, both case modes + `.pnpm`/`.bun`/plain) + integration (host-derived). ✅ on all 6 cells.
- **6 CI matrix cells** — `ubuntu-latest×{22,24,26}` + `windows-latest×{24,26}` + `macos-latest×{24}`, `fail-fast:false` (lean: full Node sweep on Linux + OS axis on Node 24 + the windows×26 cross-cell). Defined ✅; green ⏳ (draft PR).
- **aggregate gate** — `ci` job `needs:[test,e2e,act-compat,lint-workflows]`, `if:always()`, fail-closed (`failure||cancelled||skipped`). Defined + act-validated ✅; gate arithmetic on skipped ⏳ (real-runner only — act's skipped semantics diverge, RD-09).

---

## Which layer validates which requirement
- **TEST-03** -> e2e (matrix-e2e: 5-type + pnpm). ✅ locally; full cross-OS ⏳ draft PR.
- **CI-01** -> CI infra (ci.yml matrix + e2e + act-compat + lint-workflows + `ci` gate). Authored + statically/act-validated ✅; matrix-green ⏳ draft PR.
- **OUT-02 (backstop)** -> unit + integration (mixed-case + store-dir + host-derived), all 6 cells. ✅

---

## Wave 0 Requirements — ALL RESOLVED
- [x] `.github/workflows/ci.yml` (06-05)
- [x] `e2e/angular-typechecker-matrix-e2e/{project.json,vitest.config.mts,tsconfig*.json}` + the 5-type fixture (06-01)
- [x] `src/matrix-5types.int.spec.ts` (06-02)
- [x] `src/pnpm-symlink.int.spec.ts` + `pnpm-lock.yaml` (06-02)
- [x] EXTEND `filter-diagnostics.spec.ts` (06-03)
- [x] EXTEND `run-typecheck.integration.spec.ts` (06-03)
- [x] `tools/act/act-compat.sh` + `tools/act/events/*.json` + `.actrc` (06-05)
- [x] release.yml `if:` gate (06-04)
- [x] OQ-1 clean-install spike — PASSED (06-01)
- [x] DI-06-01 `.nxignore` fixture-graph exclusion (06-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full CI matrix GREEN on `windows-latest` + `macos-latest` real runners + the `ci` gate fires | CI-01 / SC3 | Cross-OS real runners can't be emulated locally; needs a push (gated). | Push a `ci/validate-ci-matrix` branch, open a draft PR, `gh pr checks --watch` until the `ci` check is green. See `06-HANDOFF.md`. |
| pnpm realpath regression-guard true `.pnpm` boundary-crossing teeth | OUT-02 / B-02 | Git Bash `ln -s` copies on the Windows dev box; needs a real Linux symlink. | Validated on the Linux e2e leg of the draft-PR run (above); backstopped by the unit realpath coverage. |

---

## Validation Sign-Off

- [x] Every requirement has automated verify (unit/integration/e2e/act) or is a documented human-gated item
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 fully resolved
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` (all coverage exists + passes; verifier independently re-ran)
- [x] SC3 matrix-green proof — **PROVEN GREEN** on real runners (PR #3 run 28354578169: all 6 cells + e2e + act-compat + lint-workflows + the `ci` gate)

**Approval:** validated 2026-06-29 — full coverage + SC3 green on real GitHub runners.
