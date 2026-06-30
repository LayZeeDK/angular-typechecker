---
phase: 11-fallow-code-quality-ci-gate
reviewed: 2026-06-30T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - .fallowrc.jsonc
  - .github/workflows/ci.yml
  - package.json
  - tools/act/act-compat.sh
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-30T00:00:00Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 11 adopts `fallow@2.103.0` as a path-gated, new-only CI code-quality gate.
Reviewed the four source files at deep depth, cross-referencing every
`.fallowrc.jsonc` suppression against the actual code it targets, validating the
config against fallow 2.103.0's own `schema.json`, running the real `fallow audit`
and full-repo `fallow dead-code` scans both WITH and WITHOUT the suppressions, and
auditing `ci.yml`'s security posture against the threat-model header.

Overall this is high-quality, well-reasoned work. The headline adversarial questions
all resolve favorably:

- **No suppression hides REAL dead code.** Every one of the five suppressions
  (`entry`, `ignoreExports`, the `unused-enum-members` override, and the two
  `fixtures/fault-isolation/**` overrides) was confirmed against a no-suppression
  full-repo `fallow dead-code` scan to target a genuine false positive or an
  intentional test fixture -- not real dead code. (Evidence below in IN-01.)
- **No weakening of `ci.yml`'s security posture.** All four distinct actions are
  SHA-pinned to valid 40-char commit hashes with version comments; the shared pins
  (checkout, setup-node) match `release.yml` byte-for-byte; the only `permissions:`
  block is the top-level `contents: read` with no job-level re-grant; every checkout
  sets `persist-credentials: false`; and there is ZERO PR-metadata interpolation in
  any run step.
- **Correct job wiring.** The `fallow` job uses the negative `if: ${{ needs.changes.outputs.code != 'false' }}` form (load-bearing for `act -n`), `fetch-depth: 0`,
  `--base origin/main` + `FALLOW_AUDIT_BASE`, is in the `ci` aggregate `needs:` list,
  and the aggregate gate expression was not weakened.
- **Exact pin + dependency hygiene.** `fallow` is exact-pinned `2.103.0` (no `^`/`~`)
  in package.json AND the lockfile; `@angular/forms` is fully removed from deps and
  the lockfile with no broken peer dependency anywhere in the Angular tree.
- **`act-compat.sh` edit is correct.** `bash -n` passes under `set -euo pipefail`;
  the new assertion exactly matches the existing 3-arg `ci/<job>` pattern.

The single Warning (WR-01) is a base-ref-resolution robustness concern on the
`fallow` job that should be empirically confirmed on a real PR run; it is not a code
defect in the reviewed text. The three Info items document verified-correct
observations and one minor comment imprecision.

## Warnings

### WR-01: `fallow` job's `--base origin/main` resolution is unverified in the CI checkout context

**File:** `.github/workflows/ci.yml:164-175`
**Issue:** The `fallow` job checks out with `fetch-depth: 0` and then runs
`npx fallow audit --format json --base origin/main` (also pinning `FALLOW_AUDIT_BASE: origin/main`). The entire gate's correctness depends on `origin/main` resolving to
a valid remote-tracking ref inside the runner. `actions/checkout@v5` with
`fetch-depth: 0` fetches full history, but whether the remote-tracking ref
`origin/main` is materialized depends on checkout's refspec and the event:
- On a `pull_request` event the base branch history is present (the merge ref's
  parent), so `origin/main` typically resolves.
- On a `push` to `main` event, `origin/main` equals HEAD, so the diff is empty and
  fallow audits zero files (a benign no-op gate on the post-merge run -- see IN-03).

If `origin/main` does NOT resolve (e.g., shallow-vs-full refspec edge, or a fork PR),
fallow's documented fallback is the merge-base against `origin/HEAD`/`origin/main`/`origin/master`, which would silently change the attribution base and could let
introduced dead code slip through (or spuriously fail). This is a robustness gap, not
a proven bug -- the threat-model and act-compat suites do not exercise it.
**Fix:** Confirm on a real draft PR that `git rev-parse origin/main` resolves in the
`fallow` job before relying on the gate, OR make the base fetch explicit and fail
loudly if it is missing. For example, add a guard step before the audit:
```yaml
      - run: |
          git rev-parse --verify origin/main >/dev/null 2>&1 \
            || { echo "origin/main not resolvable in checkout; fallow base would silently drift"; exit 1; }
      - run: npx fallow audit --format json --base origin/main
        env:
          FALLOW_AUDIT_BASE: origin/main
```
(Empirical out-of-band verification on a real PR, as the phase notes plan, also
discharges this.)

## Info

### IN-01: Every `.fallowrc.jsonc` suppression was confirmed to target a genuine false positive or intentional fixture -- none hides real dead code

**File:** `.fallowrc.jsonc:9-55`
**Issue:** (Verified-correct, recorded for the audit trail.) A no-suppression
full-repo `fallow dead-code` scan was run and each suppression mapped to the exact
finding it clears:
- `entry: ["...compiler-cli-types.drift.ts"]` clears
  `unused-file:...compiler-cli-types.drift.ts`. Confirmed false positive: the file is
  reachable ONLY via `tsconfig.drift.json`'s `files: ["src/core/compiler-cli-types.drift.ts"]` (classic node10 resolution), never via the import graph, and is
  excluded from `tsconfig.lib.json`/`tsconfig.spec.json` and the tarball.
- `ignoreExports` for `UNKNOWN_ERROR_CODE` clears
  `unused-type:...compiler-cli-types.ts:130:UNKNOWN_ERROR_CODE`. Confirmed false
  positive: the engine consumes the runtime value via `ng.UNKNOWN_ERROR_CODE`
  (`run-typecheck.ts:161,238`, the `CompilerCli` interface member), not the local
  exported const; the const is read only by the drift tripwire's value pin.
- `unused-enum-members: off` on `**/compiler-cli-types.ts` clears 7
  `unused-enum-member` findings (`EmitFlags.DTS..All`). Confirmed: the engine only
  ever passes `0 as EmitFlags` (`run-typecheck.ts:229`); the named members are a
  deliberate contract-mirror shim read only by `compiler-cli-types.drift.ts:154-160`.
- `fixtures/fault-isolation/**` overrides (`unrendered-components`/`unused-component-inputs` off) clear 3 `unrendered-component` + 1 `unused-component-input:someInput`.
  Confirmed intentional fault-isolation test fixtures (`survivor`, `tcb-poison`,
  `non-template-error`), explicitly OUT of the project graph by design.

The config validates against fallow 2.103.0's `schema.json`: `entry`, `ignoreExports`
(requires `file`+`exports`, both present), `overrides` (`ConfigOverride` = `files`
[required] + `rules`), `audit.gate` (`AuditGate` enum = `new-only`|`all`), and every
rule name + `off`/`error` severity are all valid. `fallow audit` exits 0 in both
`new-only` and `--gate all` modes with the committed config.
**Fix:** None needed. Suppressions are correct and minimal.

### IN-02: The glob `fixtures/fault-isolation/**` is correctly repo-root-relative, and the suppressed files are NOT in this changeset (anticipatory, by design)

**File:** `.fallowrc.jsonc:49`
**Issue:** (Verified-correct.) The fixtures live at the repo root
(`fixtures/fault-isolation/`), NOT under `packages/angular-typechecker/`, so the
root-relative (non-package-prefixed) glob is correct -- the no-suppression scan
matched exactly the three root-level fixture components. Separately, none of the
files targeted by the `entry`/`ignoreExports`/`unused-enum-members`/fault-isolation
suppressions are in THIS phase's changeset (they were introduced in phases 08/09).
Under the `new-only` gate those findings would be attributed "inherited" and would
not gate this PR regardless. The suppressions are therefore correctly ANTICIPATORY:
they protect the gate for the future PR that does touch those files. This is the
right posture for a permanent config, not redundancy.
**Fix:** None needed.

### IN-03: Two cosmetic notes -- `@Input` comment wording, and the post-merge-`main` fallow run is a no-op

**File:** `.fallowrc.jsonc:45`; `.github/workflows/ci.yml:159-175`
**Issue:**
1. The override comment says "one fixture `@Input`", but the actual suppressed
   finding is `unused-component-input:tcb-poison.component.ts:36:someInput`, where
   `someInput = input.required<string>()` is a SIGNAL input (`input()`), not a
   classic `@Input()` decorator. The `unused-component-inputs` rule covers both, so
   the suppression is functionally correct; only the comment wording is imprecise.
2. On a `push` to `main` (post-merge) event, `--base origin/main` equals HEAD, so the
   `fallow` job audits zero changed files and is effectively a no-op there. This is
   benign and consistent with the design (the meaningful gate runs on the PR), but
   unlike `test`/`e2e` the post-merge `fallow` run is NOT a real "second backstop"
   for fallow findings -- worth noting so a future reader does not assume it is.
**Fix:** Optionally reword the comment to "one fixture signal `input()`" for
precision. No functional change required.

---

_Reviewed: 2026-06-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
