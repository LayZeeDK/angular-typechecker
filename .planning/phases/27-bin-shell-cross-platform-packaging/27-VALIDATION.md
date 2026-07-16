---
phase: 27
slug: bin-shell-cross-platform-packaging
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-16
validated: 2026-07-16
---

# Phase 27 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Draft skeleton created by plan-phase; the per-task map is completed by
> `/gsd-validate-phase` (gsd-nyquist-auditor) after execution. Status legend is
> ASCII (this repo is ASCII-only): `[ ]` pending, `[x]` green, `[!]` red, `[~]` flaky.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit `test` tier) + `vitest.integration.config.mts` (integration) + `e2e/angular-typechecker-install-e2e/vitest.config.mts` (tarball audit) |
| **Quick run command** | `nx test angular-typechecker` (dependsOn: build) |
| **Full suite command** | `nx run-many -t build test integration lint` + `nx e2e angular-typechecker-install-e2e` |
| **Estimated runtime** | unit ~a few s (dist read); integration ~cold-compiler; e2e ~Verdaccio pack+install |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker`
- **After every plan wave:** Run `nx run-many -t build test lint` on the package
- **Before `/gsd:verify-work`:** Full suite (build + test + integration + lint + format:check) must be green
- **Max feedback latency:** the `test` tier is a dist byte-read (fast); the tarball e2e is the slow tail

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| VER-03 | 27-01, 27-02 | W1, W2 | Built `bin.js` first line is a `\r`-free `#!/usr/bin/env node` shebang | T-27-01, T-27-05 | N/A (dev tool, no network/secrets) | unit/static (`test` tier, dist byte-read) | `nx test angular-typechecker` | [x] `src/cli/bin-static.spec.ts` | [x] green |
| VER-03 | 27-01, 27-02 | W1, W2 | Built bin require graph never reaches `@nx/*`/`nx`; `src/cli/**` nx-free at lint time | T-27-02, T-27-07 | N/A | unit/static + lint | `nx test angular-typechecker` + `nx lint angular-typechecker` | [x] `bin-static.spec.ts` + `eslint.config.mjs` | [x] green |
| PKG-02 | 27-01 | W1 | `await import()` ESM bridge not downleveled (`bin.js` inherits `module: nodenext`; core load site keeps `import(`) | (packaging fidelity) | N/A | unit/static (`test` tier) | `nx test angular-typechecker` | [x] `src/executors/typecheck/gate-a-static.spec.ts` | [x] green |
| CLI-01 | 27-01, 27-02 | W1, W2 | Both `angular-typechecker` and `atc` map to one compiled `./src/cli/bin.js` (dist + published) | T-27-03 (accept, informational) | N/A | unit/static + e2e (tarball) | `nx test angular-typechecker` + `nx e2e angular-typechecker-install-e2e` | [x] `bin-static.spec.ts` + `tarball-audit.e2e.spec.ts` | [x] green |
| PKG-01 | 27-01, 27-02 | W1, W2 | Shebang survives to the PUBLISHED artifact (`\r`-free) + `publint --strict` passes for the bin | T-27-01, T-27-05 | V10 packaging (no install scripts, unchanged) | e2e (tarball pack + extract + publint) | `nx e2e angular-typechecker-install-e2e` | [x] `tarball-audit.e2e.spec.ts` | [x] green (see WARNING) |
| ADD-01 | 27-03 | W3 | Milestone additive-only vs `angular-typechecker@0.2.1`; 5 barrel exports byte-unchanged; `bin`/`src/cli/**` net-new | T-27-08 | N/A | typecheck (drift tripwire) + one-off git-diff audit | `nx typecheck angular-typechecker` | [x] `src/index.drift.ts` + `27-ADDITIVE-AUDIT.md` | [x] green |

*Finalized by gsd-nyquist-auditor during `/gsd-validate-phase`. Each row was verified independently by RUNNING the test/command, not by trusting the SUMMARY. Deferred to Phase 28 (NOT scoped here): the install-and-run e2e for literal 0/1/2 through the PM `.bin` shim + the RUNTIME `require.cache` module-graph probe (VER-04), and the real-clone shipped-bin UAT (VER-05).*

---

## Wave 0 Requirements

- [x] `bin-static.spec.ts` -- new VER-03 static guard (shebang + nx-free require graph on the built `bin.js`); 2 tests green under `nx test`
- [x] Tarball-audit extension -- `CLI-01/PKG-01` bin describe block + `src/cli/bin.js` in `REQUIRED_FILES` + `TarballManifest.bin`; publint `bin` rule covered by the existing `--strict` assertion

*Existing infrastructure (Vitest tiers, `gate-a-static.spec.ts` model, drift tripwire, tarball-audit spec) covered the rest -- no new framework install, and no new test was needed at validation time (coverage was already present and independently verified green).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none this phase) | -- | -- | -- |

*All phase-27 behaviors have automated verification. The real-clone shipped-bin UAT is Phase 28 (VER-05), not this phase.*

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable for the tier
- [x] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** APPROVED -- all 5 phase requirements (CLI-01, PKG-01, PKG-02, VER-03, ADD-01) resolve to FILLED/green under independent re-run. One WARNING (non-blocking): PKG-01/CLI-01 published halves ride the e2e tier, which is Linux-CI-authoritative and Windows-Verdaccio-flaky per PROJECT.md; the auditor reproduced every tarball-audit assertion deterministically on Windows (pack + extract + `od -c` shebang byte-check + `publint --strict`) rather than run the full flaky `nx e2e` runner.

---

## Validation Audit (gsd-nyquist-auditor, 2026-07-16)

**Verdict: GAPS FILLED -- nyquist_compliant: true.** No genuine gap existed; every requirement's automated coverage was verified by RUNNING the test/command (adversarial FORCE stance), not by trusting the SUMMARYs. No new test files were generated (none needed); no implementation file was modified; no implementation bug found.

| Req | Independent verification (this session) | Result |
|-----|------------------------------------------|--------|
| VER-03 | `nx test angular-typechecker --skip-nx-cache` (fresh build) -> `bin-static.spec.ts` 2 tests green. Confirmed the require walk is NON-vacuous: built `bin.js -> ./main -> ../core/*` all resolve on disk, so the nx-free assertion genuinely traverses the graph. `nx lint --skip-nx-cache` green at maxWarnings:0 (src/cli/** nx-free ban active). | green |
| PKG-02 | Same `nx test` run: `gate-a-static.spec.ts` 4 tests green. Confirmed `bin.js` transitively reaches `core/compiler-loader.js` (bin->main->run-typecheck->compiler-loader), whose built line retains `import('@angular/compiler-cli')` with NO `require()` of the ESM compiler -> bridge not downleveled. | green |
| PKG-01 | Reproduced the e2e tarball assertions deterministically (no Verdaccio): `npm pack --json` from dist -> `src/cli/bin.js` in file list; extracted -> `od -c` of the shipped `bin.js` first line is `#!/usr/bin/env node\n` (no `\r`); `npx publint <tgz> --strict` exit 0 ("All good!"). | green (WARNING: e2e-tier, Linux-CI-authoritative) |
| CLI-01 | Packed manifest `bin` maps `angular-typechecker` AND `atc` both to `./src/cli/bin.js` (dist manifest + extracted tarball manifest); `bin-static.spec.ts` covers the dist half. | green |
| ADD-01 | `nx typecheck angular-typechecker --skip-nx-cache` green (incl. `tsconfig.drift.json` barrel tripwire -> 5 exports byte-intact). `git diff angular-typechecker@0.2.1..HEAD` = 0 lines on all 9 public-surface paths; `bin.ts` absent at the tag (net-new); version 0.2.1 at both tag and HEAD; `27-ADDITIVE-AUDIT.md` present. | green |

**Findings classification:**
- BLOCKERs: none.
- WARNINGs (1, non-blocking): PKG-01/CLI-01's published-artifact halves are only automated in the `e2e` tier (`nx e2e angular-typechecker-install-e2e`), which is heavy and Windows-Verdaccio-flaky (PROJECT.md/AGENTS.md) -> Linux CI is authoritative. The auditor did not execute the full `nx e2e` runner on this Windows host; instead it reproduced each PKG-01/CLI-01 tarball assertion deterministically (pack/extract/publint). The always-run, deterministic guard for the same bytes is the `test`-tier `bin-static.spec.ts` (dist half).

**Scope boundary honored:** the install-and-RUN e2e for literal exit codes through the PM `.bin` shim + the runtime `require.cache` probe (VER-04) and the real-clone shipped-bin UAT (VER-05) are Phase 28 -- deliberately NOT scoped into this phase's validation.
