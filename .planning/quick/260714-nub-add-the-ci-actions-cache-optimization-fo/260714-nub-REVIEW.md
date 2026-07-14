---
task: 260714-nub-add-the-ci-actions-cache-optimization-fo
reviewed: 2026-07-14T00:00:00Z
depth: quick
files_reviewed: 1
files_reviewed_list:
  - .github/workflows/ci.yml
findings:
  blocker: 0
  major: 0
  minor: 0
  info: 3
  total: 3
status: clean
---

# quick-260714-nub: CI actions/cache (Verdaccio uplink storage) -- Code Review

**Reviewed:** 2026-07-14
**Depth:** quick (static review of the uncommitted `ci.yml` diff; workflow NOT executed)
**Files Reviewed:** 1 (`.github/workflows/ci.yml`, +27 lines: `actions/cache/restore` + `actions/cache/save` in the `e2e` job)
**Status:** clean -- **zero blockers, zero majors, zero minors.** 3 info notes.

## Verdict

APPROVE. The diff is a correct, fidelity-safe, posture-preserving cross-run cache of the Verdaccio->npmjs uplink storage. All seven verification points hold. The three notes below are advisory only and do not gate the commit.

## Summary

The change adds two steps to the `e2e` job: a `restore` right after `npm ci` and a `save` as the job's last step, caching `tmp/local-registry/storage` (Verdaccio's npmjs uplink proxy cache) minus the two run-volatile paths. Correctness is decoupled from the cache by construction: `resetVerdaccioPublishState(root)` deletes `storage/angular-typechecker` + `storage/.htpasswd` at run start (before `startLocalRegistry` boots), and `uplinks.npmjs.maxage: 60m` revalidates metadata -- so the cache can only change speed, never correctness. This extends the already-shipped Lever 1 (`clearStorage: false`, which persists the same storage across the four e2e projects WITHIN a run) to persist across CI runs; it introduces no new storage-persistence semantics.

## Per-point verification (all confirmed)

1. **SHA pin (confirmed, offline-caveat in IN-01).** Both steps pin `actions/cache/{restore,save}@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` -- a valid 40-char hex SHA, identical across both steps (correct, since `restore`/`save` are subpaths of the same repo@commit). Cannot be resolved offline; see IN-01.
2. **No new permission scope (confirmed).** The `e2e` job declares NO `permissions:` block, so it inherits the top-level `contents: read`. `actions/cache` authenticates via the auto-injected `ACTIONS_CACHE_URL` / `ACTIONS_RUNTIME_TOKEN`, not the `permissions:` block, so no write scope is added and the tokenless-OIDC posture is not regressed. (The only job that restates permissions remains `format-lint`, both read-only, unchanged.)
3. **Path + excludes match the real volatile paths (confirmed).** Path `tmp/local-registry/storage`; excludes `!.../angular-typechecker` and `!.../.htpasswd`. Verified against `libs/test-util/src/lib/e2e-fixture.ts:20-28`: `resetVerdaccioPublishState` deletes EXACTLY `storage/angular-typechecker` (recursive) and `storage/.htpasswd`, and against `.verdaccio/config.yml:28` (htpasswd at `../tmp/local-registry/storage/.htpasswd`). Excludes are byte-for-byte the reset set. Because the reset runs before Verdaccio boots, even a failed `!` negation cannot serve a stale dist or token -- the excludes are pure defense-in-depth (and keep the archive lean + the token out of the artifact on save).
4. **Key + restore-keys (confirmed).** Primary key `verdaccio-storage-${{ runner.os }}-${{ hashFiles(...) }}` busts on change to fixture manifests/lockfiles, the plugin manifest, or `ci.yml`. Every glob matches real files -- verified: `e2e/**/fixtures/**/package.json` (9 hits incl. all consumer + ng-cli + storybook + matrix fixtures), `e2e/**/fixtures/**/package-lock.json` (1: ng-cli-workspace), `e2e/**/fixtures/**/pnpm-lock.yaml` (1: consumer-workspace), `packages/angular-typechecker/package.json` (exists), `.github/workflows/ci.yml` (exists). hashFiles is therefore non-empty -- the key does NOT degenerate to a bare prefix. The broad `verdaccio-storage-${{ runner.os }}-` restore-key is a sound hit-rate fallback (a partial restore is still fidelity-safe per point 6). No yarn.lock glob is needed (yarn fixtures generate a throwaway lockfile at test time; their `package.json` is already covered).
5. **Placement + save guard (confirmed coherent).** Restore (id `verdaccio-storage`) sits after `npm ci` and before both the typecheck-e2e (`-p tag:type:e2e`) and the `nx run-many -t e2e --parallel=2` install step; save is the job's LAST step. The save `if: success() && steps.verdaccio-storage.outputs.cache-hit != 'true'` is the idiomatic restore/save split: it skips re-saving on an exact-key hit but DOES save on a cold miss or a restore-keys-only partial match, capturing newly fetched packages under the fresh primary key. The save `key: ${{ steps.verdaccio-storage.outputs.cache-primary-key }}` reuses the restore's computed primary key (no hashFiles re-eval drift). The `id` reference resolves correctly in both the `if:` and the `key:`.
6. **Fidelity / supply-chain (confirmed safe).** Stale dep: bounded and speed-only -- npm version tarballs are immutable (content-addressed by version), so a cached tarball cannot change under a fixed version; `maxage: 60m` revalidates packument metadata so new `latest` versions surface within an hour (see IN-02). Poisoned dep: the cache holds tarballs Verdaccio fetched from real npmjs; install clients (npm/pnpm/yarn) integrity-check tarballs against packument/lockfile SHAs, and the cache is repo-scoped (writes require a same-repo run; fork PRs get read-only cache). Our own plugin + auth are wiped and re-minted every run. No realistic staleness or poisoning vector is introduced.
7. **YAML correctness (confirmed).** Indentation is consistent with sibling steps (`- uses:` at 6 spaces; `id:`/`if:`/`with:` at 8; `path:`/`key:`/`restore-keys:` at 10; block-scalar bodies at 12). Both additions are self-contained list items under the `e2e` job's `steps:`. No other step or job is touched by the diff (verified against the full file). The existing `lint-workflows` (actionlint) and `act-compat` (`act --validate` / `act -n`) gates will structurally validate the added steps -- note they do NOT resolve remote action SHAs (IN-01).

## Info

### IN-01: actions/cache v6.1.0 SHA cannot be verified offline; structural CI gates do not resolve it

**File:** `.github/workflows/ci.yml:185, 231`
**Issue:** The pin `55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` is well-formed (40-char hex, identical in both steps) and the RESEARCH.md records a `gh api` verification, but it cannot be confirmed in this offline review. Note that neither `actionlint` nor `act -n` resolves remote actions or validates that a SHA/subaction exists -- so a wrong SHA would not be caught by the CI structural gates; it would only surface as a hard failure on the first real `e2e` run (loud, but a wasted run).
**Fix:** No change required. Confirm the SHA resolves to `actions/cache@v6.1.0` before merge (a quick `gh api repos/actions/cache/git/refs/tags/v6.1.0` cross-check, or trust the first run to fail loudly), and rely on Dependabot's `github-actions` ecosystem to keep it in lockstep with the other pins.

### IN-02: Floating `latest` deps can resolve up to ~60 min stale within an unchanged key

**File:** `.github/workflows/ci.yml:192`
**Issue:** `nx add` / `ng add` fixtures that install `@latest` transitive deps are not fully pinned in fixture `package.json`, so the key may not bust when a live `latest` moves. `uplinks.npmjs.maxage: 60m` bounds this: package metadata revalidates within an hour, so a brand-new version surfaces after at most ~60 min; tarballs are immutable so already-cached versions are never wrong. This is a speed/reproducibility tradeoff, not a plugin-correctness issue, and is explicitly acknowledged in RESEARCH.md Section 2.
**Fix:** None needed. Acceptable as designed; the e2e assertions test plugin behavior, not exact upstream `latest` resolution.

### IN-03: `.verdaccio-db.json` (JWT signing secret + package list) is retained in the cache

**File:** `.github/workflows/ci.yml:188-191` (excludes cover only `angular-typechecker` + `.htpasswd`)
**Issue:** The cached `storage/` retains `.verdaccio-db.json`, which in Verdaccio 6 holds the JWT signing `secret` and the published-package list. This is intentional (part of the warm proxy state) and low risk: the secret only signs tokens for the ephemeral local registry (127.0.0.1:4873) that exists during a single CI run and serves only proxied public packages + our own dist; the cache is repo-scoped; the real publish token is written to `tmp/local-registry/publish.npmrc` (OUTSIDE the cached path) and the htpasswd credential store is excluded + reset each run. This is not new behavior -- Lever 1 already persists this file within a run. No cross-run or cross-repo privilege is created.
**Fix:** None required. Noted for defense-in-depth awareness only. If ever desired, `.verdaccio-db.json` could be added to the exclude list (Verdaccio regenerates it on boot), but there is no security or correctness reason to do so.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
