---
phase: 28-shipped-tarball-e2e-real-clone-uat
verified: 2026-07-17T00:45:00Z
status: passed
score: 4/4 must-haves verified (VER-05 human sign-off accepted by the user during the v0.2.2 milestone audit)
re_verification:
  # Not a re-verification; no previous VERIFICATION.md existed.
human_verification_resolved:
  - test: "Decide whether VER-05 requires a LITERAL human sign-off on 28-04-UAT.md, or whether the authorized autonomous agent run satisfies the gate."
    resolution: "RESOLVED 2026-07-17 (v0.2.2 milestone audit): the user ACCEPTED the authorized autonomous run as the VER-05 pass -- all real-clone RED/GREEN/BAD-PATH assertions ran and passed across both workspace kinds, results are real (not fabricated), and the identical shipped-bin exit-code contract is independently gated by the CI-authoritative VER-04 (Linux + Windows, PR #41 green). No re-run required."
---

# Phase 28: Shipped-tarball e2e + real-clone UAT Verification Report

**Phase Goal:** The shipped `bin`s, installed from the packed tarball across the package-manager matrix on Linux AND Windows, return literal OS exit codes `0`/`1`/`2` through the real package-manager `.bin` shim, and the same shipped `bin`s prove correct against real on-stack Angular 22 OSS workspaces of both kinds (a real Nx workspace and a real Angular CLI workspace).
**Verified:** 2026-07-17T00:45:00Z
**Status:** passed (VER-05 human sign-off accepted by the user during the v0.2.2 milestone audit, 2026-07-17)
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A DEDICATED `angular-typechecker-cli-e2e` project (auto-covered by the dynamic per-project CI matrix) proves the SHIPPED `angular-typechecker` + `atc` bins and `npx angular-typechecker` return literal exit codes `0`/`1`/`2` through the real PM `.bin` shim across npm + yarn (flat + workspace) + pnpm. | VERIFIED | Project exists at `e2e/angular-typechecker-cli-e2e/`; `node tools/ci/list-e2e-projects.mjs` emits it (auto-discovered, no static list). Three substantive specs assert the 0/1/2 matrix through the `.bin` shim + npx: `cli-exit-codes.e2e.spec.ts` (npm, both bins + `npx angular-typechecker` + multi-`-c` union), `cli-exit-codes-yarn.e2e.spec.ts` (flat + workspace via `it.each`), `cli-exit-codes-pnpm.e2e.spec.ts`. **Real CI proof:** PR #41 `e2e (angular-typechecker-cli-e2e)` = SUCCESS. |
| 2 | The e2e CI job gains an OS axis so the tarball e2e runs on BOTH Linux AND Windows (Node 24), handling Windows-Verdaccio robustness (127.0.0.1 bind / ECONNREFUSED retry). | VERIFIED | Dedicated `e2e-windows` job in `.github/workflows/ci.yml` (`runs-on: windows-latest`, Node 24, `PROJECT: angular-typechecker-cli-e2e`, `shell: bash`, SHA-pinned `uses:`), listed in the `ci` aggregate `needs`. Linux leg auto-covered via the dynamic matrix. GUARD-01f (4 assertions) locks the wiring; bounded ECONNREFUSED/ECONNRESET retry present in `mintCiToken` (`verdaccio-global-setup.ts:74-107`). **Real CI proof:** PR #41 `e2e-windows` = SUCCESS. |
| 3 | Output never matches `/ERR_REQUIRE_ESM/`, and a module-graph probe confirms the installed bin's `require` cache never reaches `@nx/*`/`nx/`. | VERIFIED | `nx-free-runtime.e2e.spec.ts` runs the installed `bin.js` via `node -r <hook>`, dumps `require.cache` filtered by `node_modules[\\/](@nx[\\/]|nx[\\/])`, asserts `.toEqual([])` and `runOutput.not.toMatch(/ERR_REQUIRE_ESM/)` after a real type-check (exit 0). Every RED cell in the three exit-code specs also asserts `.not.toMatch(/ERR_REQUIRE_ESM/)`. Static complement `packages/angular-typechecker/src/cli/bin-static.spec.ts` (Phase 27) present. Ran green inside the cli-e2e CI cell on Linux + Windows. |
| 4 | Real-clone UAT runs the shipped bins at real project tsconfigs in on-stack Angular 22 clones of both kinds -- a real Nx workspace AND a real Angular CLI workspace -- asserting planted RED / clean GREEN / bad-path -> `2`. | VERIFIED (assertions ran + passed); literal human sign-off is a user decision | `28-04-UAT.md` records 5/5 tests PASS: ngx-leaflet @818e9ae (CLI app+lib, RED TS2322/TS2345/TS2554, GREEN, 4x exit-2), realworld-angular @9e3528f (CLI app-only pnpm, RED TS2322/TS2345, GREEN, exit-2), radix-ng/primitives @4a7390a2 (Nx, GREEN via schematics leaf + NG8xxx template checks fired on the walk, RED, exit-2), analogjs/analog @5b0b8b66 (Nx alt breadth: RED+BAD-PATH+no-infra PASS; exit-0 GREEN blocked only by analog's own unbuilt-monorepo TS2882, not a tool defect). Both bin names + `npx angular-typechecker` (never `npx atc`); every invocation uses `-c/--tsConfig`; NO ERR_REQUIRE_ESM / infra error on any run. **Caveat:** executed as an authorized AUTONOMOUS agent run (paused-session HANDOFF), NOT a literal human sign-off -- see Human Verification. |

**Score:** 4/4 truths verified (SC-4's real-clone assertions ran and passed; the literal-human-sign-off decision is routed to the user)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `e2e/angular-typechecker-cli-e2e/project.json` | e2e + typecheck targets, `type:e2e` tag, `parallelism:false`, e2e `dependsOn` build | VERIFIED | Has `e2e` (@nx/vitest:test, dependsOn angular-typechecker:build, parallelism:false) + `typecheck` targets, `type:e2e` tag. Satisfies GUARD-01/01b/01c/01d/01e. |
| `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` | one-line `createVerdaccioGlobalSetup` delegate | VERIFIED | Delegates to the shared factory (publish-once + 127.0.0.1 loopback safety gate). |
| `e2e/.../fixtures/cli-consumer/package.json` | on-stack Angular 22 peers + committed lockfile; nx-free | VERIFIED | `@angular/*` 22.0.4, `@angular/compiler-cli` 22.0.4, `typescript` 6.0.3; `package-lock.json` committed; NO `nx.json` / `project.json` (nx-free). Fixture component carries the exact planted anchor, committed clean. |
| `libs/test-util/src/lib/cli-e2e.ts` | `runShim`: spawnSync over PM `.bin` shim, cross-platform | VERIFIED | `spawnSync` over `node_modules/.bin/<bin>` (`.cmd` + `shell:true` on Windows, quoted path for WR-01, `maxBuffer` 20MB), returns literal `status` + combined stdout/stderr. |
| `e2e/.../src/cli-exit-codes.e2e.spec.ts` | npm install-by-name + 0/1/2 for both bins + npx | VERIFIED | Full 0/1/2 matrix + shim-existence assertions + union path + planted TS2322. |
| `e2e/.../src/cli-exit-codes-yarn.e2e.spec.ts` | yarn flat + workspace, corepack skipIf | VERIFIED | `it.each(['flat','workspace'])`, corepack availability skipIf, full 0/1/2. |
| `e2e/.../src/cli-exit-codes-pnpm.e2e.spec.ts` | pnpm, strictDepBuilds:false, skipIf | VERIFIED | pnpm-workspace.yaml `strictDepBuilds:false`, availability skipIf, full 0/1/2. |
| `e2e/.../src/nx-free-runtime.e2e.spec.ts` | runtime require-cache probe + ERR_REQUIRE_ESM negative | VERIFIED | Preload-hook require.cache dump -> `toEqual([])`; `not.toMatch(/ERR_REQUIRE_ESM/)`; real type-check exit 0. |
| `.github/workflows/ci.yml` (e2e-windows) | dedicated windows-latest Node 24 job in `ci` needs | VERIFIED | Present + wired into `ci` aggregate `needs`; SHA-pinned actions; env-var PROJECT (no command injection). |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01f) | 4 OS-axis wiring assertions | VERIFIED | GUARD-01f block asserts windows-latest job, run-many -t e2e -p "$PROJECT" + PROJECT pin, `ci` needs membership, Linux dynamic-matrix membership. Guard spec passes (439/439). |
| `.planning/phases/28-.../28-04-UAT.md` | frontmatter + per-clone Tests + Summary tally | VERIFIED (see note) | All fields present; 5/5 PASS. NOTE: frontmatter has DUPLICATE `status:` keys (line 2 `pending-human-run`, line 11 `executed-autonomous-pass`); YAML last-wins resolves to `executed-autonomous-pass`. Cosmetic, honest about the autonomous run -- flagged as INFO below. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `global-setup.ts` | `verdaccio-global-setup.ts` | `createVerdaccioGlobalSetup` import | WIRED | Direct import + default-export delegate. |
| exit-code specs | `node_modules/.bin/{angular-typechecker,atc}` | `runShim` spawnSync over PM shim | WIRED | All three PM specs call `runShim(...)` against both `.bin` names + assert existence. |
| `tools/ci/list-e2e-projects.mjs` | `cli-e2e/project.json` | `targets.e2e` discovery | WIRED | CLI output includes `angular-typechecker-cli-e2e`; GUARD-01b asserts CLI output == enumeration. |
| ci.yml `e2e-windows` | cli-e2e project | `run-many -t e2e -p "$PROJECT"` | WIRED | PROJECT env = `angular-typechecker-cli-e2e`; GUARD-01f asserts. |
| ci.yml `ci` needs | `e2e-windows` | needs membership + `contains(needs.*.result,'failure')` gate | WIRED | `e2e-windows` in `ci.needs`; aggregate fails on any failure/cancelled. |
| `nx-free-runtime.e2e.spec.ts` | installed `bin.js` | `node -r hook` require-cache dump | WIRED | Runs installed `node_modules/angular-typechecker/src/cli/bin.js`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| GUARD-01/01b/01c/01d/01e/01f + full plugin unit/guard suite | `npx nx test angular-typechecker -- --run src/ci-e2e-coverage-guard.spec.ts` (whole test target ran) | 43 files / 439 tests passed | PASS |
| e2e project discovery emits cli-e2e | `node tools/ci/list-e2e-projects.mjs` | `[...,"angular-typechecker-cli-e2e",...]` | PASS |
| Fixture is nx-free | `ls .../fixtures/cli-consumer/{nx.json,project.json}` | both absent | PASS |
| Full CI on a fresh runner (Linux + Windows) | PR #41 status rollup (`gh pr view 41`) | 23/23 checks SUCCESS incl. `e2e-windows`, `e2e (angular-typechecker-cli-e2e)`, `test (windows-latest, 24/26)` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| VER-04 | 28-01, 28-02, 28-03 | Shipped-tarball e2e: literal 0/1/2 through `.bin` shim across npm+yarn+pnpm+npx, Linux AND Windows | SATISFIED | cli-e2e project + 4 specs + Windows job; real CI green (PR #41). |
| VER-05 | 28-04 | Real-clone UAT of shipped bins at real tsconfigs, both workspace kinds, RED/GREEN/BAD-PATH | SATISFIED (assertions) / NEEDS HUMAN (sign-off) | `28-04-UAT.md` 5/5 PASS via authorized autonomous run; literal human sign-off is a user decision (see Human Verification). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `28-04-UAT.md` | 2 & 11 | Duplicate `status:` YAML key (`pending-human-run` vs `executed-autonomous-pass`) | Info | YAML last-wins -> `executed-autonomous-pass`; both are honest; no runtime effect. Recommend collapsing to one key for cleanliness. |

No debt markers (`TBD`/`FIXME`/`XXX`/`PLACEHOLDER`/"not yet implemented") in any phase-modified source file. No stub returns, no orphaned artifacts. Git working tree clean.

### Human Verification Required

#### 1. VER-05 literal human sign-off decision

**Test:** Decide whether VER-05 requires a LITERAL human sign-off on `28-04-UAT.md`, or whether the authorized autonomous agent run satisfies the gate.
**Expected:** User either (a) accepts the autonomous-authorized run as the VER-05 pass -- all real-clone RED/GREEN/BAD-PATH assertions ran and passed against both workspace kinds, results are real and not fabricated -- or (b) re-runs the reproducible `28-04-UAT.md` procedure and signs the results table by hand.
**Why human:** The 28-04 PLAN and the UAT artifact itself explicitly designed VER-05 as a HUMAN-RUN gate ("the phase must NOT mark VER-05 done from automation -- a blocking human checkpoint gates it"). The run was executed by an authorized autonomous agent per the paused-session HANDOFF decision, NOT a literal human sign-off. This is a user judgment call, not grep-decidable. Mitigating context: the CI-authoritative VER-04 already proves the identical shipped-bin exit-code contract deterministically on Linux + Windows (PR #41 green), so the tool's exit-code behavior is independently gated regardless of this decision.

### Gaps Summary

No blocking gaps. All four ROADMAP success criteria are achieved in the codebase:

- SC-1/SC-2/SC-3 are proven both by substantive committed artifacts (project + 4 specs + runShim + Windows job + GUARD-01f) AND by a real full-CI run on a fresh runner (PR #41: 23/23 green, including `e2e-windows` and `e2e (angular-typechecker-cli-e2e)`). These are done.
- SC-4's real-clone assertions were RUN and PASSED across both workspace kinds (Angular CLI: ngx-leaflet + realworld-angular; Nx: radix-ng/primitives + analogjs/analog), with the only non-green cell being analog's exit-0 GREEN blocked by analog's OWN unbuilt-monorepo TS2882 -- an external condition, not an angular-typechecker defect. The one open item is a governance decision the phase intentionally reserved for a human: whether the authorized autonomous run counts as the VER-05 sign-off, or a literal human signature is required. That is surfaced (not silently passed or failed) as the single `human_needed` item. Because the plan itself mandated "must NOT mark VER-05 done from automation," this decision belongs to the user before the phase is marked complete.

---

_Verified: 2026-07-17T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
