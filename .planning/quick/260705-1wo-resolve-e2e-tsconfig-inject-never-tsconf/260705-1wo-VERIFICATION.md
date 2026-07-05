---
task: 260705-1wo
verified: 2026-07-05T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick Task 260705-1wo Verification Report

**Task Goal:** Resolve the e2e tsconfig `inject()`->`never` issue (install-e2e/tsconfig.spec.json omitted global-setup.ts) AND add a CI typecheck gate for the e2e projects.
**Verified:** 2026-07-05
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | `tsc --noEmit -p install-e2e/tsconfig.spec.json` exits 0 (no `inject()`->`never`, no `GlobalSetupContext` TS2305) | PASS | Re-ran independently: `tsc exit: 0`. global-setup.ts line 5 imports `TestProject`, line 68 uses `{ provide }: TestProject`, tsconfig.spec.json include now carries `src/global-setup.ts` so the `ProvidedContext` augmentation (lines 187-192) is in-program. |
| 2 | `nx run-many -t typecheck-e2e` runs tsc for all THREE e2e projects, each exit 0 | PASS | All 3 project.json define `typecheck-e2e` (nx:run-commands, `tsc --noEmit -p <own tsconfig.spec.json>`, cache:true, 4 inputs). `git grep` confirms exactly 3 target definitions. Executor ran `--skip-nx-cache` all green; the install-e2e leg independently re-confirmed exit 0. |
| 3 | `nx test angular-typechecker-install-e2e` still passes (type fix did not change runtime) | PASS | Commit 7764803 diff is type-only (import-type swap + tsconfig include; 8 insertions/3 deletions, no runtime statement changed). Executor: 9 files / 32 tests pass. Authoritative test-runner signal accepted per task instructions (slow Verdaccio suite not re-run). |
| 4 | CI e2e job runs `typecheck-e2e` (no `-p`) after `npm ci`, before the tarball test step; `ci` aggregate needs unchanged | PASS | ci.yml:170 `- run: npx nx run-many -t typecheck-e2e` (no `-p`), placed after `npm ci` (165), before folded `-t test ... --parallel=1` (182-185). `ci` needs array (339-349) still lists `e2e` -- no needs change; no other job touched. |
| 5 | GUARD-01 ci-e2e-coverage-guard still passes (new step is `-p`-less) | PASS | New step has no line-start `-p`, so the guard's `.find(/^\s*-p\s+\S/)` still selects the folded test scalar's `-p` list (ci.yml:184, all 3 projects). Executor: GUARD-01/01b = 4 tests pass. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `e2e/angular-typechecker-install-e2e/src/global-setup.ts` | `TestProject` import + signature; augmentation intact | VERIFIED | line 5 `import type { TestProject } from 'vitest/node'`; line 68 `export default async function ({ provide }: TestProject)`; augmentation at 187-192 unchanged. No `GlobalSetupContext` remains. |
| `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` | include contains `src/global-setup.ts` | VERIFIED | include array (9-14) now has `"src/global-setup.ts"`. |
| `e2e/angular-typechecker-install-e2e/project.json` | `typecheck-e2e` target | VERIFIED | targets 16-29, `-p e2e/angular-typechecker-install-e2e/tsconfig.spec.json`, cache:true, 4 inputs, cwd `.`, no outputs. |
| `e2e/angular-typechecker-cache-e2e/project.json` | `typecheck-e2e` target | VERIFIED | targets 20-33, `-p e2e/angular-typechecker-cache-e2e/tsconfig.spec.json`, same shape. |
| `e2e/angular-typechecker-matrix-e2e/project.json` | `typecheck-e2e` target | VERIFIED | targets 16-29, `-p e2e/angular-typechecker-matrix-e2e/tsconfig.spec.json`, same shape. |
| `.github/workflows/ci.yml` | e2e job runs `run-many -t typecheck-e2e` between npm ci and tarball test | VERIFIED | line 170, `-p`-less, correctly positioned. |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| global-setup.ts `import type { TestProject }` | `vitest/node` exported member | import-type replacing removed `GlobalSetupContext` | WIRED (tsc exit 0 resolves the symbol) |
| tsconfig.spec.json include `src/global-setup.ts` | `declare module 'vitest' { ProvidedContext }` (187-192) | brings augmentation into spec tsc program | WIRED (`keyof ProvidedContext` resolves; no `never`) |
| each project.json `typecheck-e2e` command | that project's tsconfig.spec.json | `tsc --noEmit -p ...` | WIRED (3 distinct `-p` paths, one per project) |
| ci.yml e2e step | the three typecheck-e2e targets | `nx run-many -t typecheck-e2e` (no `-p`) | WIRED (run-many selects every project defining the target) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| install-e2e spec program type-checks clean | `npx tsc --noEmit -p e2e/angular-typechecker-install-e2e/tsconfig.spec.json` | `tsc exit: 0` | PASS |
| typecheck-e2e defined in exactly 3 project.json + ci.yml | `git grep -n typecheck-e2e` | 1 ci.yml + 3 project.json | PASS |
| Commits exist with correct file scope | `git show --stat 7764803 7549e65` | fix = 2 files (source+tsconfig); ci = ci.yml + 3 project.json; zero scope creep | PASS |

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/placeholder markers introduced; diffs are minimal and on-scope.

### Scope Constraints Honored

- No new dependency, no `nx.json` targetDefault, no rename of the plugin's own `typecheck` target.
- cache-e2e / matrix-e2e sources + tsconfigs untouched (only their project.json gained the target).
- New CI step is `-p`-less; no other CI job or the `ci` needs array touched.
- Work stayed on `test/nx-add-e2e-pnpm-yarn`; no `packages/angular-typechecker/` files, so no published-package version bump.

### Note on LSP output (already triaged, NOT a gap)

The editor TS LSP may still surface `inject()`->`never` / "Cannot find module '@workspace/test-util'" / "vitest cannot be found" on global-setup.ts. That is stale LSP not using the e2e `tsconfig.spec.json` types/paths. The authoritative `tsc -p tsconfig.spec.json` exits 0 (re-confirmed here). Per CLAUDE.md, tsc is the gate, not the LSP.

### Gaps Summary

No gaps. All five must-have truths verified against the actual codebase, four via direct file reads plus an independent `tsc` re-run and `git grep`/`git show` cross-checks. The type fix is provably runtime-neutral (type-only diff), so accepting the executor's install-e2e test-runner result is sound. Goal achieved: e2e specs + global-setup type-check cleanly and the check is CI-enforced across all three e2e projects.

---

_Verified: 2026-07-05_
_Verifier: Claude (gsd-verifier)_
