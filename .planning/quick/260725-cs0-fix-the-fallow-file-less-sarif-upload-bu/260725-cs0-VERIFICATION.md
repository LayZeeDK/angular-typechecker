---
quick_id: 260725-cs0
verified: 2026-07-25T00:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260725-cs0: Fix the fallow file-less SARIF upload bug -- Verification Report

**Task Goal:** Stop fallow's file-less `fallow/code-duplication` result from killing the ENTIRE
fallow SARIF upload (`locationFromSarifResult: expected at least one location`) -- without dropping
any finding. Delivered as `tools/ci/normalize-fallow-sarif.mjs`, a subprocess-driven spec, and
`ci.yml` wiring.

**Verified:** 2026-07-25
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from PLAN must_haves)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every result in every run of the post-processed `fallow.sarif` carries `locations[0].physicalLocation.artifactLocation.uri` | VERIFIED | `normalize-fallow-sarif.mjs:101` predicate is `locations.length > 0 && locations.every(hasUri)` -- per-ENTRY, not per-result `.some()`. Confirmed exact match to the required IM-01 fix. Spec run 3 (mixed array `[{}, {located}]`) asserts `locations[0].../.uri === '.fallowrc.jsonc'` after normalization; REVIEW-FIX.md documents that reverting the script to the pre-fix `.some()` predicate produced `AssertionError: expected undefined to be truthy` on this exact fixture (proven, not assumed). I additionally ran the single named test live (`npx nx test angular-typechecker -- -t "gives every location-deficient..."`) -- PASS, 368ms. |
| 2 | No finding is dropped; already-located results kept byte-unchanged | VERIFIED | `normalize-fallow-sarif.mjs:107-120` maps every entry individually (`hasUri(location) ? location : {anchor}`) -- never removes an array entry. Spec assertion 2 deep-equals run 0's located result against the original fixture object (fresh `createFixture()` call, alias-free). Spec assertion 3 opens with `expect(output.runs.flatMap(r => r.results)).toHaveLength(5)` -- a result-count pin that would fail if any result were dropped. Assertion 3b deep-equals the mixed result's surviving usable entry in place. |
| 3 | `automationDetails.id` scheme frozen at `fallow/<index>`, effect-identical to `origin/main`'s inline `node -e` | VERIFIED | `git diff origin/main -- .github/workflows/ci.yml` shows the ONLY functional line change is `node -e '...(j.runs||[]).forEach(function(r,i){r.automationDetails={id:"fallow/"+i}})...'` -> `node tools/ci/normalize-fallow-sarif.mjs`. The new script's loop (`for (const [index, run] of (doc.runs ?? []).entries()) { run.automationDetails = { id: \`fallow/${index}\` }; }`) is effect-identical (spec assertion 4 pins `['fallow/0','fallow/1','fallow/2','fallow/3']`, including the overwrite of fallow's own `fallow/audit/dupes` on run 1). No new `(analysis_key, category, environment)` tuple risk. |
| 4 | Fix is regression-tested locally by a spec driving the real script as a subprocess, asserting location PRESENCE (not just SARIF schema validity) | VERIFIED | Spec at `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts` uses `execFileSync('node', [normalizeScript], { cwd: tempRoot })` against a `mkdtempSync` temp dir -- confirmed no import of `tools/ci` by grep (only comment/string-literal mentions). Assertion 3 explicitly walks every entry of every result asserting `.uri` truthiness (the presence check); assertion 5's `validateSarif` is explicitly demoted to an "envelope regression guard only" per the header comment, matching the plan's requirement that schema validity must not stand in for presence. |
| 5 | `ci.yml`'s `produced=true/false` contract, the `Assert fallow SARIF was produced` step, the no-`category` upload, and the `head.repo.fork == false` gate are unchanged | VERIFIED | `git diff origin/main -- .github/workflows/ci.yml` (55 lines total) shows exactly one script-invocation line change plus two comment-block additions/edits. Read the full surrounding context (lines 580-807): `produced=true`/`produced=false` branches (623/625), the `Assert fallow SARIF was produced (non-fork PR)` step (647-651) including its `fork == false` gate, the no-`category` `Upload fallow SARIF` step (667-671), `FALLOW_AUDIT_BASE` env (618), and every `angular-typechecker`/red-proof SARIF path (590-593, 636-640, 658-662, 732-806) are byte-identical to `origin/main`. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `tools/ci/normalize-fallow-sarif.mjs` | new -- pure exported transform + thin I/O wrapper | VERIFIED | Exists, 172 lines. Mirrors `merge-sarif.mjs` shape: header rationale block, `export function normalizeFallowSarif(doc)` pure transform with JSDoc types, helper functions `hasUri`/`fingerprintOf`, and an `if (process.argv[1] === fileURLToPath(import.meta.url))`-guarded CLI wrapper. Node builtins only (`node:crypto`, `node:fs`, `node:url`) -- no new dependency. |
| `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts` | new -- subprocess-driven guard | VERIFIED | Exists, 307 lines. Drives the script via `execFileSync`, imports only node builtins + vitest + `@workspace/test-util`. Ran live and passes (see above). |
| `.github/workflows/ci.yml` | the `fallow-sarif` step body + two comment blocks | VERIFIED | Diff confirmed: one script-invocation line change (line 622) plus two comment blocks (lines 604-615 fallow-sarif step; lines 764-770 red-proof `gen` step cross-reference reconciliation). |
| `.fallowrc.jsonc` | conditional -- only if fallow gate flags the new script | VERIFIED (correctly untouched) | `git diff origin/main -- .fallowrc.jsonc` is empty. SUMMARY.md documents `npm run fallow` reported "No issues in 6 changed files" -- neither `unused-files` nor `code-duplication` fired, so per the plan's conditional the file was correctly left alone. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ci.yml` `fallow-sarif` step | `tools/ci/normalize-fallow-sarif.mjs` | `node tools/ci/normalize-fallow-sarif.mjs` (line 622) | WIRED | Confirmed in the diff; this is the script's only caller (config-only reachable), matching the plan's key_link. |
| script's `FALLBACK_URI` constant | `.fallowrc.jsonc` | `const FALLBACK_URI = '.fallowrc.jsonc';` (line 77) | WIRED | Single named constant, confirmed a one-line swap point per the header comment and REVIEW-FIX.md's SG-05b resolution. |
| script's `automationDetails.id = fallow/<index>` | GitHub's category derivation | `run.automationDetails = { id: \`fallow/${index}\` };` (line 94) | WIRED | Category stays `fallow` (text before final `/`); spec assertion 4 pins the exact id sequence. |
| the spec | the real script | `execFileSync('node', [normalizeScript], ...)` | WIRED | Confirmed via grep: no `import` of any `tools/ci` module in the spec file -- only comment/string-literal mentions of the path. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Per-entry predicate holds (IM-01 fix) | `npx nx test angular-typechecker -- -t "gives every location-deficient result a region-less"` | 1 passed / 592 skipped, 368ms | PASS |
| No file deletions in the changeset | `git diff --diff-filter=D origin/main -- .` | empty output | PASS |
| No `fix`-type commit (would bump 0.x version) | `git log --format='%H %s' origin/main..HEAD \| rg -i "^\w+ fix"` | no match (exit 1) | PASS |
| `.fallowrc.jsonc` untouched | `git diff origin/main -- .fallowrc.jsonc` | empty | PASS |
| Spec imports no `tools/ci` module | grep of import statements | only node builtins/vitest/`@workspace/test-util` | PASS |
| `ci.yml` diff scope | `git diff origin/main -- .github/workflows/ci.yml` (55 lines) | one script-invocation line + two comment blocks only | PASS |

Full-suite gates (`nx test` 59 files/593 tests, `nx typecheck`, `nx lint` maxWarnings 0, `nx format:check`, `act --validate`, `npm run fallow`) were run by the requester immediately prior to this verification and reported green; not re-run in full here per the "run the full suite at most once" constraint. The one behavior-critical single named test was re-run live above as an independent check.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the three changed files. No empty implementations, no hardcoded-empty stub returns, no console.log-only bodies. Comments are WHY-focused throughout and were fact-checked line-by-line in REVIEW.md (all claims verified TRUE or corrected in the REVIEW-FIX pass).

### Requirements Coverage

Not applicable -- this is a quick task (`mode: quick-full`), not a phase with REQUIREMENTS.md entries.

### Human Verification Required

None required by this verification. The REAL-CI-ONLY residuals below are explicitly out of scope for local verification per the task's own scoping and are not items a human needs to act on now -- they are documented follow-ups to observe on the next real PR with a fallow finding.

## Real-CI-only residuals (documented, not gaps)

Per the task's explicit scoping, the following are **not** evaluated as gaps -- they require a real GitHub Code Scanning ingestion and a PR whose diff actually contains a fallow finding, neither of which exists yet (branch is unpushed, no PR open):

- Whether GitHub accepts a dotfile `artifactLocation.uri` (`.fallowrc.jsonc`). Every region-less URI proven accepted so far (`tsconfig.json`, `package.json`) is non-dotted. `FALLBACK_URI` remains a single named constant, confirmed by reading the code -- the swap to `package.json` is genuinely one line (plus 3 comment mentions and one spec literal, all already inventoried in the code's own comments).
- Whether the upload completes end-to-end with no `locationFromSarifResult` error.
- Whether the synthesized `partialFingerprints` actually keep N clone groups as N distinct Code Scanning alerts.

`bash tools/act/act-compat.sh` is red on this machine (no Docker daemon) -- a pre-existing environment gap unrelated to this task, per the SUMMARY and the task's own scoping notes. `act --validate` (the unconditional local gate) passed.

Nothing is pushed and no PR exists -- by design, not a gap.

## Gaps Summary

None. All 5 must-have truths verified against the actual code (not SUMMARY claims), all 4 artifacts exist and are substantive/wired, all 4 key links confirmed, the `ci.yml` diff was read in full and matches the byte-unchanged-except-documented-lines claim, no debt markers or anti-patterns found, and the IM-01/IM-02 review findings from REVIEW.md were confirmed fixed in the shipped code (per-entry `every(hasUri)` predicate, synthesized `partialFingerprints` with `??=` non-clobbering). The task goal is achieved at the level verifiable outside real CI.

---

_Verified: 2026-07-25_
_Verifier: Claude (gsd-verifier)_
