---
task: 260701-shh-add-ci-format-check-lint-jobs-nx-set-sha
reviewed: 2026-07-01T00:00:00Z
depth: deep
diff_base: 31c2abb
files_reviewed: 7
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .prettierignore
  - nx.json
  - tools/act/act-compat.sh
  - packages/angular-typechecker/src/core/compiler-cli-types.drift.ts
  - packages/angular-typechecker/src/core/extended-catalog.drift.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# GSD Quick Task 260701-shh: Code Review Report

**Reviewed:** 2026-07-01
**Depth:** deep (cross-file)
**Files Reviewed:** 7 (functional deltas only; the 377-file Prettier whitespace sweep and planning/docs artifacts are out of scope per the task brief)
**Status:** issues_found (1 Warning, 3 Info -- no Blockers)

## Summary

This quick task adds a `format-lint` CI job (Prettier `format:check` scoped by `nrwl/nx-set-shas` + `nx run-many -t lint`), bakes `maxWarnings: 0` into the `@nx/eslint:lint` targetDefaults, extends `.prettierignore` with lockfile globs and two diagnostic-sensitive fixture templates, adds one act-compat assertion, and bumps three GitHub Actions to new SHA-pinned versions. Two drift tripwires gain an `eslint-disable-next-line` comment so their phantom-type-parameter pattern survives the newly-strict `maxWarnings: 0` gate.

I verified the functional deltas by running the actual toolchain against the local checkout:

- **Action SHA pins are all correct.** `actions/checkout@9c091bb...` resolves to `v7.0.0`, `actions/setup-node@48b55a0...` to `v6.4.0`, and `nrwl/nx-set-shas@afb73a6...` dereferences (annotated tag `38457b5...`) to the exact pinned commit for `v5.0.1`. All confirmed against the GitHub API.
- **Security posture holds.** No new job re-grants any permission; top-level stays `contents: read`. The only interpolation in the new job (`steps.nx-shas.outputs.base/head`) is git-derived (a SHA and the repo-controlled TARGET branch ref), not attacker-controllable PR metadata -- no command-injection surface.
- **`maxWarnings: 0` is correctly placed** under `targetDefaults["@nx/eslint:lint"].options`; both `lint` targets (`angular-typechecker`, `ng-spike-app`) use `@nx/eslint:lint` with no `options` override, so they inherit it. `npx nx lint angular-typechecker` passes.
- **The eslint-disable is genuinely necessary and correctly scoped.** I reproduced the underlying warning: an unused phantom type parameter `To` trips `@typescript-eslint/no-unused-vars` as a _warning_, which `maxWarnings: 0` would promote to a lint failure. The `eslint-disable-next-line` sits immediately above the exact target line in both files, disables exactly one rule, and does NOT weaken the tripwire (the `To extends From` constraint -- the actual assertion -- is untouched). `nx typecheck-drift` still passes.
- **`.prettierignore` entries are correct and minimal.** Both fixture paths exist; `nx format:check` respects `.prettierignore` (verified: the two fixtures are skipped even when explicitly targeted); full-repo `nx format:check --all` exits 0, so CI will not hit false positives.
- **Cross-file consistency verified.** The `format-lint` job is added to the `ci` aggregate `needs`, gated by the same `needs.changes.outputs.code != 'false'` path filter as its siblings, and the matching `assert_selected "$PR_PLAN" "ci/format-lint"` line lands in act-compat.sh in the correct position. YAML parses cleanly.

The overall quality is high. The one Warning is a robustness gap in the push-to-`main` scope-derivation path; the Info items are minor coverage/observability notes.

## Warnings

### WR-01: `format-lint` on push-to-`main` needs `actions: read` to scope correctly; without it the whole-repo format regression window is HEAD~1 only

**File:** `.github/workflows/ci.yml:178-211`
**Issue:** On a `pull_request` event, `nx-set-shas` derives the base via `git merge-base origin/<base.ref> HEAD` (git-only; `fetch-depth: 0` supplies the refs) -- correct and permission-free. But on a **push to `main`** (the post-merge run that the `ci` aggregate comment explicitly relies on as the "second backstop"), `nx-set-shas` queries the GitHub **Actions API** for the last successful workflow run to compute the base. That call needs `actions: read`, which the top-level `permissions: contents: read` does NOT grant. With `error-on-no-successful-workflow` left at its default `false`, the action logs a warning and silently falls back to `HEAD~1` (confirmed against `nrwl/nx-set-shas` `v5.0.1` `action.yml` + `nx-set-shas.ts`).

The in-code comment already describes this fallback and calls it "acceptable -- the post-merge diff is small." That is TRUE for a normal single-merge-commit push. The residual risk: `HEAD~1` on a squash/merge push only spans the single merge commit, so `format:check` on the post-merge `main` run inspects a NARROWER file set than the PR did. A formatting regression introduced by a base-branch drift, a force-push, or any commit range wider than one commit would escape the `main` gate. The PR run is the primary catch; this only degrades the backstop. It is a genuine robustness gap, not a blocker, because the PR-run format:check (which IS correctly scoped) is the load-bearing check and `main` is PR-only.

**Fix (choose one):**

- Grant the job the minimal read scope so the intended base derivation works on push:
  ```yaml
  format-lint:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: read # nx-set-shas reads the last successful run on push-to-main
    env:
      NX_DAEMON: false
  ```
  This is still least-privilege (adds only `actions: read`, no write) and makes the comment's "resolves the base commit from git history" claim hold on push, not just PR.
- OR, if the deliberate choice is to keep `actions: read` off, tighten the comment to state that the push-path scope is INTENTIONALLY `HEAD~1`-only (not "resolves from history") so a future maintainer does not assume full-range coverage on `main`.

## Info

### IN-01: `nx run-many -t lint` silently lints only 2 of 9 projects

**File:** `.github/workflows/ci.yml:211`
**Issue:** `nx run-many -t lint` runs the `lint` target only for projects that DEFINE it. In this workspace that is `angular-typechecker` and `ng-spike-app` (verified via `nx show projects --with-target lint`). The other 7 projects (`consumer-app`, the three `*-e2e`, `typecheck-walk-consumer`, `typecheck-consumer-dep`, `typecheck-consumer`) have no `lint` target and are silently skipped -- `run-many` reports success with no indication they were not linted. This is by design for the fixture/consumer/e2e projects and is acceptable, but the ci.yml comment ("`nx run-many -t lint` lints EVERY project") overstates the coverage.
**Fix:** Reword the comment to "lints every project that DEFINES a lint target (the two source projects; fixtures/e2e/consumer projects intentionally have none)", so the coverage boundary is explicit and a future project without a lint target is a known gap rather than a surprise.

### IN-02: `nx-set-shas` outputs are interpolated without an empty-value guard

**File:** `.github/workflows/ci.yml:210`
**Issue:** `npx nx format:check --base=${{ steps.nx-shas.outputs.base }} --head=${{ steps.nx-shas.outputs.head }}`. `nx-set-shas` always sets both outputs (base falls back to `HEAD~1` or the empty-tree hash; head to the current SHA), so in practice these are never empty. But if a future `nx-set-shas` upgrade or an unexpected git state left `base` empty, the command would silently become `--base= --head=<sha>`, and `nx format:check` would interpret an empty `--base` in a way that is not fail-loud. This is a latent robustness note, not a live defect (the action's contract guarantees non-empty outputs today).
**Fix:** Optional hardening -- rely on the `NX_BASE`/`NX_HEAD` env vars that `nx-set-shas` sets by default (`set-environment-variables-for-job: true`) instead of interpolating step outputs into the shell string, or add an explicit `fallback-sha` input. Low priority; the current form works.

### IN-03: Action version bumps span two majors (checkout v5 -> v7, setup-node v5 -> v6) with no changelog note in the diff

**File:** `.github/workflows/ci.yml` (all `uses:` lines) and `.github/workflows/release.yml:56,59`
**Issue:** `actions/checkout` jumped v5.0.1 -> v7.0.0 (two majors) and `actions/setup-node` v5.0.0 -> v6.4.0 (one major). Major bumps of these actions have historically carried behavior changes (e.g. checkout's default Node runtime, setup-node's default cache/registry behavior). I verified all three SHAs match their tags and the workflows still parse and run the same step logic, and nothing in the changed steps depends on removed inputs -- so this is informational. The release.yml `setup-node` still passes `registry-url` (the OIDC-detection input), which v6 continues to honor, so the tokenless-OIDC path is unaffected.
**Fix:** None required. When Dependabot next opens these bumps, confirm the checkout v7 / setup-node v6 release notes do not change the `persist-credentials: false` or `cache: npm` semantics this repo relies on. Since Dependabot manages these pins (per the threat-model comment), the lockstep bump across ci.yml + release.yml is already consistent.

---

_Reviewed: 2026-07-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
