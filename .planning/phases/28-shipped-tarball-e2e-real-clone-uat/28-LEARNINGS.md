---
phase: 28
phase_name: "shipped-tarball-e2e-real-clone-uat"
project: "angular-typechecker"
generated: "2026-07-17"
counts:
  decisions: 6
  lessons: 4
  patterns: 4
  surprises: 4
missing_artifacts: []
---

# Phase 28 Learnings: shipped-tarball-e2e-real-clone-uat

## Decisions

### Install the CLI BY NAME from Verdaccio, not from a packed .tgz
The e2e specs install `angular-typechecker` by name from the local Verdaccio registry rather than `npm install ./x.tgz`.

**Rationale:** A `.tgz` path install forces a filesystem path that Git Bash/MSYS mis-parses (the `D:/` drive letter is read as a remote host) on the Windows leg; install-by-name sidesteps the drive-letter gotcha entirely and is closer to what a real consumer does.
**Source:** 28-01-SUMMARY.md (D-02)

### runShim spawns the PM-generated .bin shim, never `node bin.js`
The exit-code runner is `spawnSync` over `node_modules/.bin/<binName>[.cmd]` reading the literal OS status; `.cmd` + `shell:true` on Windows (CVE-2024-27980 hardened), `maxBuffer` 20MB.

**Rationale:** The `.bin` shim is the one genuinely Windows-divergent CLI surface, so the shim IS the surface under test. Invoking `node bin.js` would bypass exactly the thing that can break cross-platform.
**Source:** 28-01-SUMMARY.md

### Windows CI = a dedicated `e2e-windows` job, not `matrix.include`
The Windows tarball e2e is a separate `e2e-windows` job (windows-latest, Node 24) running ONLY `angular-typechecker-cli-e2e`, wired into the required `ci` aggregate `needs`.

**Rationale:** `matrix.include` would silently merge the Windows cell into a Linux matrix combination and disturb GUARD-01b's dynamic-matrix invariants; a standalone job keeps the Linux dynamic matrix byte-unchanged. Locked by GUARD-01f.
**Source:** 28-03-SUMMARY.md / STATE.md

### pnpm build-gate via `pnpm-workspace.yaml` `strictDepBuilds:false`, not `.npmrc`
The pnpm spec disables pnpm 11's build-script gate in `pnpm-workspace.yaml`, not the consumer `.npmrc` the plan text named.

**Rationale:** pnpm 11 reads the build-script gate from `pnpm-workspace.yaml`; installing `angular-typechecker` pulls `nx` transitively (whose postinstall npm itself skips), which would `ERR_PNPM_IGNORED_BUILDS`-fail the `pnpm add` under the default gate. `.npmrc` would not have disabled it. `strictDepBuilds:false` skips ALL dependency build scripts (more restrictive than an allowlist).
**Source:** 28-02-SUMMARY.md (Deviation 1)

### Runtime nx-free proof via `node -r <exit-hook.cjs> <installed bin.js>`
D-07 adds a runtime require-cache probe that runs a real type-check through the installed bin and, on process exit, dumps `require.cache` filtered by `/node_modules[\\/](@nx[\\/]|nx[\\/])/` -> `toEqual([])`, plus an `ERR_REQUIRE_ESM`-free output assertion.

**Rationale:** Phase 27 proved nx-freeness STATICALLY (require-graph walk of `bin.js`); this is the runtime complement, confirming the CJS->ESM `await import('@angular/compiler-cli')` bridge survives install un-downleveled and that no `@nx/*`/`nx/` is loaded at run time.
**Source:** 28-02-SUMMARY.md (D-07)

### VER-05 executed as an AUTHORIZED AUTONOMOUS agent run, recorded as such
VER-05's real-clone UAT was authored as a human-run gate but executed autonomously by the agent per the paused-session HANDOFF decision, with the result recorded honestly as an agent run (not a human sign-off).

**Rationale:** The user explicitly authorized the autonomous run; the clones + assertions are reproducible and the results are real. The frontmatter and sign-off make the agent-vs-human distinction explicit so a literal human sign-off remains available if wanted. VER-04 already proves the identical exit-code contract deterministically on CI.
**Source:** STATE.md Session Continuity / 28-04-UAT.md

---

## Lessons

### A new e2e project trips two fallow findings that are config-declare, not refactor
Adding the `cli-e2e` project surfaced two CI-blocking fallow findings: its vitest `global-setup.ts` flagged `unused-file` (config-only reachable), and `mintCiToken` tripped `high-complexity` after the D-06 cold-runner retry pushed it to cyclomatic 10 / cognitive 16.

**Context:** Both are the established false-positive class -- declare the globalSetup an `entry`, and add `libs/**` (non-product test harness) to `health.ignore`; the retry is reviewed essential resilience, so declare-not-refactor per the repo's fallow guidance. Feed-forward: any future e2e project needs a fallow `entry` for its globalSetup, and shared-harness complexity growth needs a health-ignore.
**Source:** STATE.md (resume-work CI fix, commit b15a01f) / .fallowrc.jsonc (FAL-12)

### Real-clone UAT at a fresh SHA surfaces the clone's OWN pre-existing type errors
On radix-ng/primitives the solution reference-walk + lib/spec leaves carried the clone's own diagnostics (TS + NG8007 two-way-binding + "syntax not supported" in stories); a clean exit-0 GREEN needed a genuinely clean leaf (`tsconfig.schematics.json`).

**Context:** Treat the clone's own errors as PROOF the engine fires (including Angular NG8xxx template type-checking on a real Nx workspace), not as a tool failure. Always discover a clean leaf for the GREEN cell; plant into a clean leaf for RED.
**Source:** 28-04-UAT.md (Test 4)

### analog's library leaves need a workspace build for a true GREEN; breadth needs less
Every analog Angular library leaf (content/router/trpc) is clean except a uniform pre-existing `TS2882` -- `test-setup.ts` side-effect-imports the unbuilt `@analogjs/vite-plugin-angular/setup-vitest` (its `./setup-vitest.js` output does not exist unbuilt; the package is not even linked into node_modules).

**Context:** A true exit-0 GREEN would require building the workspace first -- out of scope for a "breadth/alt" target. RED (planted TS2322 surfaced alongside the baseline) + BAD-PATH + no-infra were sufficient to prove breadth on a second Nx workspace. Do not rabbit-hole building a giant monorepo for a confidence gate.
**Source:** 28-04-UAT.md (Test 5)

### A `.planning`-only push still re-triggers the FULL CI on this repo
Pushing a docs-only commit to the PR branch re-ran the entire e2e tier (cli-e2e + e2e-windows) + the full OS/Node matrix, not just format:check.

**Context:** The `changes` filter does not skip the heavy tiers for a `.planning`-only diff. Budget ~8-10 min for the e2e re-run, or accept it as a formality when the delta carries zero source change relative to an already-green run.
**Source:** STATE.md Session Continuity (resume-work)

---

## Patterns

### nx-free consumer fixture type-checked by the standalone CLI at a tsconfig path
A committed fixture with NO `nx.json`/`project.json` (and a committed lockfile via `npm install --package-lock-only`, no materialized `node_modules`) that the standalone CLI type-checks by tsconfig path directly.

**When to use:** Any e2e proving the CLI works without Nx present; the fixture only needs the Angular 22 peer set. `nx`/`@nx/devkit` still arrive transitively when installing `angular-typechecker` by name (unused at CLI runtime -- verified by the D-07 runtime probe).
**Source:** 28-01-SUMMARY.md

### Verbatim-copy a proven analog spec + re-target runShim, don't re-author
The yarn (`it.skipIf(!corepackAvailable).each(['flat','workspace'])`) and pnpm specs copied the proven ng-add-ng-run PM analogs verbatim (`.yarnrc.yml` node-modules linker + `enableMirror:false` + `npmMinimalAgeGate:0`; pnpm `strictDepBuilds:false`) and only re-pointed the assertion to `runShim`.

**When to use:** When a load-bearing PM-provisioning mechanism is already proven green elsewhere in the repo -- reuse the exact config, change only the surface under test, avoid re-discovering PM quirks.
**Source:** 28-02-SUMMARY.md

### GUARD-01f: a fail-loud unit test locks CI OS-axis wiring
A guard spec (generalized `extractJobLines` slicer) asserts the four `e2e-windows` OS-axis wiring facts (job present, windows-latest/Node 24, in the required `ci` needs, SHA-pinned uses), so an edit that drops the Windows leg fails a fast unit test rather than silently reducing coverage.

**When to use:** Whenever CI coverage depends on a job/matrix wiring fact that a future edit could silently remove -- encode the invariant as a fail-loud, non-vacuous unit assertion.
**Source:** 28-03-SUMMARY.md / ci-e2e-coverage-guard.spec.ts

### Close a phase via dedicated gate agents, commit each artifact atomically
verify_phase_goal (gsd-verifier) -> secure (gsd-security-auditor) -> validate (gsd-nyquist-auditor), each reached by its DEDICATED agent (never self-certified inline) and its artifact committed atomically; extract-learnings runs inline (the documented exception).

**When to use:** Every phase close-out -- the independent fresh-context audit is the point; a short-circuit that lets the orchestrator author the verdict defeats it.
**Source:** STATE.md Session Continuity / CLAUDE.md GSD rules

---

## Surprises

### The Bash safety classifier was intermittently unavailable mid-execution
Across multiple sessions (including this one), Bash calls intermittently failed with "classifier temporarily unavailable"; retrying until it recovered was the only workaround.

**Impact:** No artifact impact -- every command and commit ultimately ran -- but it stretched wall-clock on the heavy e2e/UAT commands. Prefer batching independent commands and using background runs for slow ones.
**Source:** 28-01-SUMMARY.md (Issues Encountered) / this session

### An empty `projects/*` glob still exercises yarn's workspace linker
The yarn "workspace" cell uses `workspaces:['projects/*']` verbatim even though `cli-consumer` ships no `projects/` members; the empty glob still drives yarn's node-modules workspace linker path.

**Impact:** Both yarn layouts (flat + workspace) proved green with one fixture shape -- no need to author a real multi-package workspace fixture to cover the workspace linker cell.
**Source:** 28-02-SUMMARY.md

### The CLI under test is a FROZEN artifact, so every TDD e2e task is one test() commit
Plans 28-01/02 tasks are `tdd="true"`, but the shipped bin (frozen in Phases 25-27) has no new production code -- each spec OBSERVES shipped behavior, so a single `test(...)` commit is the correct and only commit (a RED phase would require the shipped bin to be broken).

**Impact:** No RED->GREEN production churn; the "TDD" ceremony collapses to a behavior-observation spec, which is the honest shape for verifying an already-shipped artifact.
**Source:** 28-01-SUMMARY.md / 28-02-SUMMARY.md

### All post-execution gates came back clean with zero new tests or edits
Security audit closed 6/6 threats with no file edited; Nyquist validation found 4/4 criteria COVERED and generated 0 tests; the code review (--auto) had 0 blockers.

**Impact:** The plans + the --auto pipeline had already covered the surface; the dedicated gates confirmed rather than filled. A clean gate result is a real signal here, not a skipped check -- each was reached by its dedicated agent.
**Source:** 28-SECURITY.md / 28-VALIDATION.md / 28-REVIEW.md
