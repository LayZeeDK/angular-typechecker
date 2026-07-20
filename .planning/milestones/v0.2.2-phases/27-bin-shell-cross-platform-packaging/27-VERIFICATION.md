---
phase: 27-bin-shell-cross-platform-packaging
verified: 2026-07-16T19:12:00Z
status: passed
score: 4/4 must-haves verified (5/5 requirement IDs satisfied)
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification -- no previous VERIFICATION.md existed."
advisory_open: # Non-blocking code-review items (27-REVIEW.md), outside phase locked decisions + requirements
  - "WR-01: bin.ts has no stdout EPIPE handler (robustness follow-up, not a locked D-01..D-12 decision)."
  - "WR-02: trailing-newline nit (cosmetic)."
---

# Phase 27: Bin shell + cross-platform packaging Verification Report

**Phase Goal:** A thin, cross-platform `bin.ts` shell ships the CLI under two `bin` names, with the shebang and the CJS->ESM bridge surviving the build into the PUBLISHED artifact, an nx-free import boundary enforced by lint + a static build guard, and the whole milestone proven additive-only vs `angular-typechecker@0.2.1`.
**Verified:** 2026-07-16T19:12:00Z
**Status:** passed
**Re-verification:** No -- initial verification.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | CLI-01: two `bin` names (`angular-typechecker` + `atc`) resolve to one compiled `src/cli/bin.js`; `bin.ts` is the ONLY process.exit/stream-write site and is flush-safe. | VERIFIED | `package.json` (source AND freshly-built dist) `bin` maps both names to `./src/cli/bin.js`. `bin.ts` line 1 is the shebang; imports ONLY `./main`; uses `process.exitCode` in both `.then` and `.catch`, NEVER `process.exit()` (flush-safe D-02). `git grep` confirms bin.ts is the sole stream-write / exit-code site in `src/cli/` (main.ts has none; other hits are comments/spec assertions). |
| 2 | PKG-01+PKG-02: source shebang (LF) survives `@nx/js:tsc` into the built+published `bin.js` (`newLine:lf` + `.gitattributes`); `module:nodenext` keeps the `await import()` bridge un-downleveled. | VERIFIED | `tsconfig.lib.json` has `"newLine":"lf"`. Repo-root `.gitattributes` has `*.ts text eol=lf`. Freshly-built `dist/.../src/cli/bin.js` first line raw bytes = `#!/usr/bin/env node`, byte-before-LF = `0x65` (no `0x0d`/CR). Built `core/compiler-loader.js` retains `yield import('@angular/compiler-cli')` (NOT `require()`), so the ESM bridge is not downleveled. `gate-a-static.spec.ts` (4 tests) green. |
| 3 | VER-03: `bin-static.spec.ts` asserts the built `bin.js` `\r`-free shebang + nx-free require graph; a `src/cli/**` ESLint import-ban enforces the boundary. | VERIFIED | `bin-static.spec.ts` exists, walks UP 2 dirs, derives `distRoot` from `project.json` `build.options.outputPath`, asserts shebang equality + `.not.toContain('\r')` + a transitive nx-free require walk; runs green (2 tests) inside `nx test`. The `eslint.config.mjs` `**/src/cli/**/*.ts` block is present AND LIVE: a temporary `@nx/devkit` import in `src/cli` tripped `no-restricted-imports` with 2 D-09 errors (probe removed clean). |
| 4 | ADD-01: milestone is additive-only vs `angular-typechecker@0.2.1` -- no public-surface break; `bin` field + `src/cli/**` net-new; v0.3.0 untriggered. | VERIFIED | Barrel-drift tripwire (`tsconfig.drift.json` leg of `nx typecheck`) green. Independent `git diff angular-typechecker@0.2.1..HEAD` at CURRENT HEAD (0a65e23) shows all 9 public-surface paths byte-unchanged (0 lines). `bin.ts` absent at tag; no `bin` field in the 0.2.1 manifest (net-new). `27-ADDITIVE-AUDIT.md` exists, ASCII-only, records ADDITIVE-ONLY with v0.3.0 untriggered. |

**Score:** 4/4 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/cli/bin.ts` | Shebang + flush-safe `run().then/.catch` shell | VERIFIED | Line 1 shebang; single `./main` import; `process.exitCode` in both paths, no `process.exit()`; unknown throw -> exit 2. Compiles to dist. |
| `packages/angular-typechecker/package.json` `bin` | Two names -> `./src/cli/bin.js` | VERIFIED | Both names present; version stays `0.2.1`; `files` unchanged; carried verbatim into dist manifest. |
| `packages/angular-typechecker/tsconfig.lib.json` | `"newLine":"lf"` | VERIFIED | Present; `module`/`moduleResolution` untouched (inherits `nodenext`); no separate bin tsconfig. |
| `.gitattributes` (repo root) | Narrow `*.ts text eol=lf` | VERIFIED | Present; single narrow rule, no repo-wide `* text=auto`. |
| `packages/angular-typechecker/eslint.config.mjs` | `**/src/cli/**/*.ts` import-ban block | VERIFIED | Present; bans nx/@nx/*/@angular-devkit/* + adapters + barrel; import-ban ONLY (no `no-console`, no process.exit ban); provably fires. |
| `packages/angular-typechecker/src/cli/bin-static.spec.ts` | Built-bin shebang + nx-free require walk | VERIFIED | 127 lines; distRoot from project.json; 2 tests green. |
| `e2e/.../tarball-audit.e2e.spec.ts` | Published bin map + LF shebang audit | VERIFIED (read) | `REQUIRED_FILES` += `src/cli/bin.js`; `TarballManifest.bin`; `CLI-01/PKG-01` describe asserts both names -> `./src/cli/bin.js` + shipped file + `\r`-free shebang; publint --strict covers the bin. See e2e note below. |
| `27-ADDITIVE-AUDIT.md` | ADDITIVE-ONLY verdict vs 0.2.1 | VERIFIED | ASCII-only; verdict, guard cross-check, per-path git-diff, new-file additions, disposition; v0.3.0 untriggered. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin.ts` | `main.ts run()` | `import { run } from './main'` | WIRED | bin.ts imports and invokes `run(process.argv.slice(2))`; result destructured to streams + exit code. |
| `package.json bin` | `./src/cli/bin.js` | compiled JS shipped under `files:["src",...]` | WIRED | Both names map; dist manifest confirmed; bin.js emits under whitelisted `src/`. |
| `bin-static.spec.ts` | built `dist/.../bin.js` | `project.json build.options.outputPath` | WIRED | Derived (not hard-coded); spec green under `test` (dependsOn build). |
| `bin.js` require graph | `./main -> ../core/** + node:* + tslib` | static walk | WIRED (nx-free) | Walk reaches no `@nx/*`/`nx`; `import('@angular/compiler-cli')` un-downleveled. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `bin.ts` | `{ exitCode, stdout, stderr }` | `run()` (Phase-26 core, VER-01/VER-02 complete + `main.integration.spec.ts`) | Yes -- run() composes real verdict/report/exit code | FLOWING |

bin.ts is a thin shell over the already-tested `run()` core; the exit-code/report data originates from `runTypecheck` + `evaluateResult` + `renderReport`, all covered by Phase-26 tests. No hardcoded/empty values.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build compiles bin.ts | `nx build angular-typechecker --skip-nx-cache` | Success (test-util + plugin) | PASS |
| Test suite incl. bin-static | `nx test angular-typechecker --skip-nx-cache` | 43 files / 435 tests passed (incl. `bin-static.spec.ts` 2 tests) | PASS |
| Typecheck (3 tsc incl. drift) | `nx run angular-typechecker:typecheck --skip-nx-cache` | spec + drift + tools all green | PASS |
| Lint at maxWarnings:0 | `nx lint angular-typechecker --skip-nx-cache` | All files pass | PASS |
| Import-ban fires (negative probe) | temp `@nx/devkit` import in src/cli -> `nx lint` | 2 no-restricted-imports errors (D-09) | PASS |
| Built shebang LF | raw byte read of dist bin.js line 1 | `#!/usr/bin/env node`, no CR | PASS |
| ESM bridge un-downleveled | `rg import\\( dist/.../compiler-loader.js` | `yield import('@angular/compiler-cli')` present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLI-01 | 27-01, 27-02 | Two-name bin over one compiled bin.js | SATISFIED | Truth 1 + artifacts. |
| PKG-01 | 27-01, 27-02 | Shebang survives to built+published bin.js; publint bin audit | SATISFIED | Truth 2 (dist half verified directly; published half via dist manifest + read e2e spec + SUMMARY/CI). |
| PKG-02 | 27-01 | `module:nodenext` keeps `await import()` bridge | SATISFIED | Built compiler-loader.js retains `import(`; gate-a-static green. |
| VER-03 | 27-02 | bin-static.spec.ts + src/cli/** ESLint import-ban | SATISFIED | Truth 3; spec green + ban provably fires. |
| ADD-01 | 27-03 | Additive-only vs 0.2.1 | SATISFIED | Truth 4; independent git-diff at HEAD + barrel-drift green + 27-ADDITIVE-AUDIT.md. |

All 5 phase requirement IDs accounted for and satisfied. No orphaned requirements (REQUIREMENTS.md maps only CLI-01/PKG-01/PKG-02/VER-03/ADD-01 to Phase 27; all present in plan frontmatter).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any phase-modified file | Info | Clean. |

### Human Verification Required

None. All four success criteria are programmatically verified. No `<verify><human-check>` blocks were deferred by the planner. The install-and-RUN shipped-bin e2e (literal 0/1/2 through PM `.bin` shims) and the real-clone UAT are explicitly OUT OF SCOPE for Phase 27 (deferred to Phase 28 / VER-04/VER-05).

### Notes

- **e2e tier (published-artifact half of PKG-01/CLI-01):** The `tarball-audit.e2e.spec.ts` extension was read and confirmed substantive and correct; the freshly-built dist manifest carries the two-name `bin` and a clean-shebang `bin.js` under the whitelisted `src/` (the exact bytes `npm pack` would ship). The full `nx e2e angular-typechecker-install-e2e` run is Linux-CI-authoritative (Windows-Verdaccio bind is known-flaky) and passed locally this session per 27-02-SUMMARY; accepted as evidence. The deterministic dist-tier guard (`bin-static.spec.ts`) is the always-run authoritative shebang/nx-free proof and is green.
- **ADDITIVE-AUDIT HEAD drift:** the doc records HEAD `77a55d3`; three commits landed since (audit doc itself, plan closeout, a Prettier-format of the `src/cli` eslint block, code-review report). The Prettier commit touches `eslint.config.mjs` only (not a public-surface path). Re-running the per-path git-diff at CURRENT HEAD (`0a65e23`) still yields 0 lines on all 9 paths -- the verdict holds unchanged.
- **Code review (27-REVIEW.md):** 0 critical / 2 warning / 2 info, advisory + non-blocking. WR-01 (stdout EPIPE handler gap) and WR-02 (trailing-newline nit) are robustness follow-ups outside the phase's locked decisions (D-01..D-12) and requirements; recorded as `advisory_open`, do not block goal achievement.

### Gaps Summary

None. Every success criterion is observably true in the codebase, every artifact exists and is substantive + wired + data-flowing, every key link is wired, the nx-free import-ban provably fires, and the milestone is proven additive-only vs `angular-typechecker@0.2.1`. All authoritative gates (build, test, typecheck, lint) are green.

---

_Verified: 2026-07-16T19:12:00Z_
_Verifier: Claude (gsd-verifier)_
