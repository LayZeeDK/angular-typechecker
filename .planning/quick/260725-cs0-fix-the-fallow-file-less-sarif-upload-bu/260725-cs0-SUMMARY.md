---
quick_id: 260725-cs0
description: Fix the fallow file-less SARIF upload bug -- post-process fallow.sarif in a tools/ci script that gives every location-deficient result a region-less anchor at .fallowrc.jsonc while porting the automationDetails.id stamping verbatim
mode: quick-full
status: complete
completed: 2026-07-25
branch: fix/fallow-fileless-sarif
tasks_completed: 3
tasks_total: 3
commits:
  - 1a0e73a ci(code-scanning) -- tools/ci/normalize-fallow-sarif.mjs
  - 0ca59df test(code-scanning) -- normalize-fallow-sarif.spec.ts
  - a8b25c1 ci(code-scanning) -- ci.yml fallow-sarif step + comment reconciliation
key-files:
  created:
    - tools/ci/normalize-fallow-sarif.mjs
    - packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts
  modified:
    - .github/workflows/ci.yml
  untouched:
    - .fallowrc.jsonc
---

# Quick Task 260725-cs0: Fix the fallow file-less SARIF upload bug -- Summary

The `fallow audit` dupes sub-analysis emits `fallow/code-duplication` with the `locations` key
omitted, and GitHub rejects the WHOLE multi-run upload with `locationFromSarifResult: expected at
least one location` -- losing the sibling dead-code run's properly located findings too. The fix
replaces `ci.yml`'s inline `node -e` with `tools/ci/normalize-fallow-sarif.mjs`, which keeps the
frozen per-run `automationDetails.id = fallow/<index>` stamping and additionally gives every
location-deficient result a region-less anchor at `.fallowrc.jsonc`. No finding is dropped and no
already-located result is clobbered.

## Tasks

### Task 1 -- `tools/ci/normalize-fallow-sarif.mjs` (commit `1a0e73a`)

Mirrors `merge-sarif.mjs`: house-style header, a pure exported `normalizeFallowSarif(doc)` with
JSDoc types, then a thin I/O wrapper guarded by
`if (process.argv[1] === fileURLToPath(import.meta.url))`. Node builtins only (`node:fs`,
`node:url`); no new dependency. Two module constants: `FALLBACK_URI = '.fallowrc.jsonc'` (the
one-line swap point for the REAL-CI-ONLY dotfile risk) and `SARIF_FILE = 'fallow.sarif'`.

One `some()` condition covers all three deficiency shapes (`locations` key absent -- the only
observed shape -- plus `locations: []` and an entry lacking `physicalLocation`). A mixed array with
at least one usable entry is left untouched. The header states the four load-bearing whys:
whole-upload rejection (with the two live CI run ids), no recoverable file, region-less acceptance
(the `ATC90002` precedent), and the frozen id scheme (the AGENTS.md GATE-02 orphan-tuple hazard).

Verified: `node --check` exits 0; `npx prettier --check` passes.

### Task 2 -- `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts` (commit `0ca59df`)

Copies `merge-sarif.spec.ts`'s structure AND its header rationale: the spec drives the real script
as a SUBPROCESS (`execFileSync('node', [script], { cwd: tempRoot })`) against a `mkdtempSync` temp
dir and imports no `tools/ci` module by any mechanism. Imports are node builtins, `vitest`, and
`findWorkspaceRoot` + `validateSarif` from `@workspace/test-util`. `rmSync` in `finally`.

The fixture is a 3-run SARIF 2.1.0 envelope: run 0 a fully located `fallow/unused-file` with region
and `partialFingerprints`; run 1 the verbatim captured dupes run
(`automationDetails: { id: 'fallow/audit/dupes' }`, no `tool.driver.rules`, `locations` absent); run
2 the two unobserved deficiency shapes. A `createFixture()` factory (not a shared const) makes the
deep-equal comparison in assertion 2 alias-free.

All five assertions are present: (1) the dupes result survives at `.fallowrc.jsonc` with no `region`
key, (2) run 0's result is deep-equal to the input, (3) EVERY result in EVERY run has a
`physicalLocation.artifactLocation.uri` -- the load-bearing check, (4) the ids are exactly
`fallow/0`, `fallow/1`, `fallow/2` including the overwrite of `fallow/audit/dupes`, (5)
`validateSarif` reports `valid: true` as an envelope regression guard only, explicitly commented as
unable to detect this bug.

Verified: `npx nx test angular-typechecker` (59 files / 593 tests, the new spec among them),
`npx nx typecheck angular-typechecker`, `npx nx lint angular-typechecker` (clean at
`maxWarnings: 0`, proving no `tools/ci` import).

### Task 3 -- `ci.yml` wiring + comment reconciliation (commit `a8b25c1`)

The `fallow-sarif` step's inline `node -e` line is replaced with
`node tools/ci/normalize-fallow-sarif.mjs`. Everything else in that step is byte-unchanged: the
`npx fallow audit --format sarif -o fallow.sarif --base origin/main || true` generation, the
`if [ -s fallow.sarif ]` produced-guard, and both `produced=true` / `produced=false` branches. The
`Assert fallow SARIF was produced (non-fork PR)` step, the no-`category` upload, the
`head.repo.fork == false` gate, the `FALLOW_AUDIT_BASE` env, and every
`angular-typechecker` / `angular-typechecker-red-proof` SARIF path are untouched (confirmed by the
diff: only the one script line plus two comment blocks changed).

Two comment reconciliations:

- The `fallow-sarif` step's comment block gains a paragraph stating that the script still stamps the
  per-run `automationDetails.id` (which the no-`category` upload depends on) AND anchors
  location-deficient results at `.fallowrc.jsonc` because of the whole-upload rejection.
- The red-proof `gen` step's comment no longer points at "the dogfood job's fallow
  `automationDetails` rewrite" (which no longer exists). Its style constraint is now stated
  self-containedly -- outer single quotes, inner double quotes, `function` expressions, no
  backticks, no `$`, no PR data -- so the no-command-injection invariant is still documented at the
  point it applies. The red-proof inline `node -e` itself is unchanged.

## Verification results

| Gate | Result |
| --- | --- |
| `node --check tools/ci/normalize-fallow-sarif.mjs` | PASS |
| `npx nx test angular-typechecker` | PASS -- 59 files / 593 tests, re-run after the `ci.yml` edit |
| `npx nx typecheck angular-typechecker` | PASS |
| `npx nx lint angular-typechecker` | PASS (`maxWarnings: 0`) |
| `npx nx format:check` | PASS |
| `act --validate` | PASS (exit 0) |
| `npm run fallow` | PASS -- `No issues in 6 changed files` |
| `bash tools/act/act-compat.sh` | **SKIPPED** -- no Docker daemon (see below) |

### `npm run fallow`: no finding fired, `.fallowrc.jsonc` untouched

`npm run fallow` (`fallow audit --format human --base origin/main`) reported
`Audit scope: 6 changed files vs origin/main` and `No issues in 6 changed files (34.27s)`. Neither
of the two anticipated risks materialised:

- **`unused-files` did NOT fire** on `tools/ci/normalize-fallow-sarif.mjs`, despite it being
  config-only reachable (invoked as `node <path>` from `ci.yml`, never imported). This matches the
  existing repo state: neither `tools/ci/merge-sarif.mjs` nor `tools/ci/assert-code-scanning.mjs` is
  declared as an `entry` either, and both pass the gate. Only `tools/ci/list-e2e-projects.mjs` and
  `tools/e2e-timing/aggregate-install-timings.mjs` needed declarations (FAL-07 / quick-260715-050).
- **No `code-duplication` clone group** was reported against `merge-sarif.mjs`.

So the plan's CONDITIONAL `.fallowrc.jsonc` edit was **not** performed -- the file is untouched, per
the plan's "if neither fires, leave `.fallowrc.jsonc` untouched."

### `act-compat` skip

`bash tools/act/act-compat.sh` was SKIPPED: `docker info` fails on this machine (no daemon), and
`act -n` cannot resolve a job plan without a docker connection. Per the plan this is a pre-existing
environment gap, not a regression, and the suite exercises job/trigger selection which editing one
step's script invocation cannot affect. `act --validate` (the unconditional gate) passed with exit
0. CI's `act-compat` job on ubuntu-latest is the authoritative signal.

## Deviations from plan

None. All three tasks were executed as written, with the `.fallowrc.jsonc` edit correctly not
triggered (a documented conditional, not a deviation).

Minor judgement calls inside the plan's discretion:

- The spec uses ONE `it` covering all five assertions rather than five subprocess spawns -- they all
  assert on the same rewritten output file, so a second spawn would buy nothing. Each `expect` is
  individually commented with which numbered assertion it is.
- The red-proof comment paragraph was re-flowed across an extra `#` blank line so no comment line
  runs long; the sentence content is the plan's.

## Known stubs

None.

## Threat flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary schema change. The
new script reads and writes one fixed relative filename (`fallow.sarif`) with no interpolated input,
and the `ci.yml` change removes shell-embedded JavaScript rather than adding any -- the
no-command-injection invariant is strictly improved.

## Real-CI-only residual (NOT verifiable locally, carried forward)

Whether GitHub accepts a **dotfile** `artifactLocation.uri` is unproven -- every region-less URI
proven accepted so far (`tsconfig.json`, `package.json`) is non-dotted. The authoritative check is a
PR whose diff actually contains a fallow finding: `Upload fallow SARIF` must reach
`Analysis upload status is complete.` with no `locationFromSarifResult`, and
`gh api ".../code-scanning/analyses?tool_name=fallow"` must show a new analysis at that commit. On a
clean-diff PR the fix is not exercised at all, so a green `ci` there is NOT evidence. Fallback if
GitHub rejects the dotfile: swap `FALLBACK_URI` to `package.json` -- deliberately a one-line change
in a single named constant.

## Out of scope (untouched, as planned)

- fallow was NOT bumped (3.9.1 reproduces the defect identically).
- The red-proof job's inline `node -e` was not converted to a script.
- No `git push`, PR, merge, ruleset edit, or Code Scanning API call.
- `ROADMAP.md` not updated; planning docs not committed (orchestrator-owned).

## Self-Check: PASSED

- `tools/ci/normalize-fallow-sarif.mjs` -- FOUND
- `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts` -- FOUND
- `.github/workflows/ci.yml` -- FOUND
- Commit `1a0e73a` -- FOUND
- Commit `0ca59df` -- FOUND
- Commit `a8b25c1` -- FOUND
- `git diff origin/main --stat`: 3 files changed, 341 insertions(+), 7 deletions(-); no file
  deletions in any commit (`git diff --diff-filter=D` empty for all three).
