# Quick Task 260714-nub: CI actions/cache of the Verdaccio uplink storage -- RESEARCH

**Researched:** 2026-07-14 (Windows arm64 dev box; branch gsd/v0.2.1-angular-cli-workspace-support)
**Domain:** GitHub Actions cross-run cache design + a measurement plan under a PR-only CI trigger
**Confidence:** HIGH (grounded in this repo's own w87/1gr/gja measurements + code + verified GHA docs/SHAs)

## Summary

The e2e job already caches `~/.npm` via `actions/setup-node cache: npm` (keyed on the ROOT
`package-lock.json`). That cache sits on ONE of the two round-trips a Verdaccio-routed install
pays: the **client -> Verdaccio (127.0.0.1:4873)** hop. It does NOT touch the second hop,
**Verdaccio -> npmjs uplink**, which is served only by Verdaccio's own storage
(`tmp/local-registry/storage`) -- and that storage starts EMPTY on every fresh CI runner, so
Verdaccio re-fetches the whole Angular 22 / Nx 23 / TS 6 / Storybook toolchain from npmjs each run.

**Verdict: the lever is REAL and additive -- decisively for the yarn- and pnpm-routed installs.**
yarn uses a fresh per-fixture `cacheFolder` with `enableMirror: false` (both load-bearing for
fidelity), so yarn NEVER uses `~/.npm` and ALWAYS re-fetches every package through Verdaccio ->
uplink; the single most expensive install in the tier (`corepack yarn install`, 44-53s) gets ZERO
help from `setup-node cache: npm`. pnpm's global store is likewise uncached today. Only caching
`tmp/local-registry/storage` removes the uplink fetch for all three package managers at once. For
the npm-routed Verdaccio installs it is partly redundant with `~/.npm` (fixed port 4873 keeps the
cache-key URL stable) but is the more robust cross-run lever. It is NOT redundant overall.

**Primary recommendation: GO -- implement + measure, via a throwaway draft PR (Option b).** One
SHA-pinned `actions/cache/restore` + `actions/cache/save` split in the `e2e` job, no new permission
scope, no OIDC-posture change, decoupled from the release, one-hunk revert. Because
`on:` is `pull_request:{} + push:[main]` only and `main` is PR-only, **there is no push-only way to
measure on this branch** -- the miss->hit must be read within a SINGLE PR (run 1 saves to the PR's
merge-ref scope, a re-run restores). Keep it only if the e2e-step wall-clock HIT beats MISS beyond
CI noise; otherwise revert.

---

## (1) Is the lever real? (additive-over-setup-node verdict)

### The two round-trips, and who caches each

| Hop | What pays it | Cached today by |
|-----|--------------|-----------------|
| A. client -> Verdaccio `http://127.0.0.1:4873` | every Verdaccio-routed install | **npm only**, via `~/.npm/_cacache` (setup-node `cache: npm`); pnpm store + yarn cache are NOT |
| B. Verdaccio -> npmjs uplink | first request of each proxied package | **nothing** -- `tmp/local-registry/storage` is empty on every fresh runner |

`setup-node cache: npm` is keyed on the ROOT `package-lock.json` and restores `~/.npm`. It attacks
hop A **for npm**. It cannot attack hop B, and it does nothing for pnpm/yarn (different caches).
`[VERIFIED: ci.yml lines 158-161 + npm cacache keys HTTP responses by URL]`

### Install routing (verified by reading every e2e spec)

Two disjoint classes (the empty-`.npmrc` fidelity pattern decides which registry each hits):

| Class | Specs | Registry | Verdaccio storage caches it? |
|-------|-------|----------|------------------------------|
| **Verdaccio-routed** (write `.npmrc`/`.yarnrc.yml` -> registry = `127.0.0.1:4873`) | nx-add-npm, nx-add-pnpm, nx-add-yarn, storybook-tarball (x2), storybook-composition (x2), verdaccio-publish; ng-cli ng-add-ng-run (npm), -pnpm, -yarn (flat+workspace) | 127.0.0.1:4873 | **YES -- this is the lever** |
| **npmjs-direct** (empty `.npmrc` + nonexistent userconfig -> default registry) | install-smoke, generator-e2e, nx-add-e2e, matrix-5types (`npm install <tgz>`), pnpm-symlink (`pnpm add <tgz>`) | registry.npmjs.org | No (never touch Verdaccio) -- already warmed by `~/.npm` (overlaps `npm ci` deps) |

`[VERIFIED: git grep of writeVerdaccioNpmrc / npmRegistryServer / empty .npmrc across e2e/**/*.e2e.spec.ts]`

### Per-package-manager verdict

- **yarn-routed (STRONGLY additive -- the decisive case).** `nx-add-yarn` + `ng-add-ng-run-yarn`
  set `cacheFolder: ./.yarn/cache` (inside the thrown-away `mkdtemp`) + `enableMirror: false` +
  `enableGlobalCache: false` -- all load-bearing (the CLI-YARN root-cause fix). So yarn's cache is
  fresh-and-discarded every run and yarn re-fetches EVERY package through Verdaccio. It never uses
  `~/.npm`. The tier's single biggest install (`corepack yarn install`, 44-53s warm; ~93s the run
  w87 forced cold) gets zero coverage from `setup-node cache: npm`. Only caching Verdaccio storage
  removes its uplink fetch. `[VERIFIED: nx-add-yarn.e2e.spec.ts:118, ng-add-ng-run-yarn.e2e.spec.ts:196-220]`
- **pnpm-routed (additive).** No `store-dir` override in any spec -> pnpm uses its global default
  store (`~/.local/share/pnpm/store` on Linux), which `setup-node cache: npm` does NOT cache and
  nothing caches today. pnpm re-fetches through Verdaccio -> uplink (empty storage). Caching
  Verdaccio storage removes the uplink fetch. `[VERIFIED: no store-dir in specs; nx-add-pnpm.e2e.spec.ts:142]`
- **npm-routed Verdaccio installs (robustly additive; partly redundant).** The port is FIXED at
  4873 (`project.json` local-registry target), so the `~/.npm` cache-key URL `http://127.0.0.1:4873/...`
  is stable across runs and CAN carry Verdaccio responses -- but only fragilely: `setup-node`
  skips its post-job SAVE on an exact `package-lock.json` hit, freezing `~/.npm` at its first-saved
  state, and `nx add`/`ng add` themselves are flag-free (no `--prefer-offline`) so they revalidate.
  Verdaccio-storage caching removes the uplink fetch regardless. `[VERIFIED: project.json port:4873;
  ASSUMED: setup-node skip-save-on-hit interaction -- directional, does not change the verdict]`
- **npmjs-direct tarball installs (not affected, no harm).** They never touch Verdaccio; already
  served by `~/.npm` (their deps overlap the root workspace `npm ci` set).

**Bottom line:** cache `tmp/local-registry/storage`. It is additive over `setup-node cache: npm`
because that only warms npm's `~/.npm` (hop A), while Verdaccio storage is the ONLY cross-run cache
for hop B -- and yarn/pnpm (the biggest and an uncached-store install) get nothing from `~/.npm` at
all. Magnitude ceiling (honest): 1gr shows the fetch portion is real but the e2e step is dominated
by CPU-bound typecheck assertions, so the wall-clock delta is a FRACTION of the step (larger on
Linux CI than the Defender-taxed dev box, but still a fraction). `[VERIFIED: 1gr honest-ceiling]`

---

## (2) Exact design (implementation-ready)

**Fidelity is safe by construction.** `resetVerdaccioPublishState(root)` deletes
`storage/angular-typechecker` + `storage/.htpasswd` at run START (before `startLocalRegistry`), so
our freshly built dist is ALWAYS republished (never served stale) and the token is always freshly
minted. The cache only holds PROXIED npmjs bytes -- exactly what Verdaccio would re-fetch
identically -- and `uplinks.npmjs.maxage: 60m` makes Verdaccio revalidate stale metadata while
serving tarballs from disk. So the cache can only change SPEED, never correctness; the key can be
loose (favor hit rate). Restore-then-reset is correct. `[VERIFIED: global-setup.ts:121-129 + .verdaccio/config.yml]`

**Storage size:** 480 MB / 494 package dirs locally -- far under the 10 GB per-repo cache ceiling
(shared with `~/.npm`; no eviction concern). `[VERIFIED: du -sh]`

**Steps** (SHA-pinned `actions/cache@v6.1.0`; restore/save split gives save-on-success-only +
delta capture). Slot the restore right after `npm ci`; the save is the job's LAST step:

```yaml
      - run: npm ci
      # Cross-run Verdaccio uplink cache (quick-260714-nub). Additive over the
      # setup-node cache:npm above: that warms ~/.npm (npm<->Verdaccio); THIS warms
      # Verdaccio<->npmjs (its storage), which yarn (fresh cacheFolder+enableMirror:false)
      # and pnpm (uncached store) never get from ~/.npm. Correctness is independent of the
      # cache: resetVerdaccioPublishState wipes storage/angular-typechecker + .htpasswd each
      # run and uplinks.npmjs.maxage:60m revalidates -- the cache only changes SPEED.
      - uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        id: verdaccio-storage
        with:
          path: |
            tmp/local-registry/storage
            !tmp/local-registry/storage/angular-typechecker
            !tmp/local-registry/storage/.htpasswd
          key: verdaccio-storage-${{ runner.os }}-${{ hashFiles('e2e/**/fixtures/**/package.json', 'e2e/**/fixtures/**/package-lock.json', 'e2e/**/fixtures/**/pnpm-lock.yaml', 'packages/angular-typechecker/package.json', '.github/workflows/ci.yml') }}
          restore-keys: |
            verdaccio-storage-${{ runner.os }}-
      - run: npx nx run-many -t typecheck -p tag:type:e2e
      - run: npx nx run-many -t e2e --parallel=2
      - uses: actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        if: success() && steps.verdaccio-storage.outputs.cache-hit != 'true'
        with:
          path: |
            tmp/local-registry/storage
            !tmp/local-registry/storage/angular-typechecker
            !tmp/local-registry/storage/.htpasswd
          key: ${{ steps.verdaccio-storage.outputs.cache-primary-key }}
```

Design notes:
- **Exclusions** (`storage/angular-typechecker`, `storage/.htpasswd`) keep a stale plugin/token
  out of the archive. They are defense-in-depth only -- `resetVerdaccioPublishState` deletes both
  at run start, so dropping the `!` lines would still be correct (fall back to that if `!` negation
  ever misbehaves). `.verdaccio-db.json` is intentionally cached (part of the warm proxy state; not
  reset). `[CITED: actions/cache path supports @actions/glob `!` excludes]`
- **Key inputs:** fixture manifests+lockfiles (the consumer toolchain), the plugin manifest (drives
  which nx/@nx/devkit/tslib+peers the consumer pulls when installing our package), and `ci.yml`
  (pins Node 24 / pnpm 11.9.0). `runner.os` is constant (Linux-only job) but future-proof. The
  broad `restore-keys` prefix makes a stale/partial restore still warm -- safe, per the fidelity
  argument above (Verdaccio re-fetches deltas).
- **Save-on-success-only + delta capture:** `if: success()` gates the save; `cache-hit != 'true'`
  skips re-saving an exact hit while still saving under a NEW primary key when only `restore-keys`
  matched (captures newly fetched packages). Known tradeoff: floating-dep additions under an
  UNCHANGED key aren't re-saved until the key busts -- harmless (Verdaccio re-fetches the small
  delta each run). `[VERIFIED: gh api actions/cache -- restore/save subactions exist at v6.1.0, SHA 55cc8345]`
- **Placement:** must precede `nx run-many -t e2e` (the step that runs the installs). Restoring
  before the typecheck-e2e step is fine (harmless).
- **Permissions / posture:** `actions/cache` authenticates via `ACTIONS_CACHE_URL` +
  `ACTIONS_RUNTIME_TOKEN` (auto-injected), NOT the `permissions:` block -- so it works under the
  job's `contents: read` with NO new scope and NO OIDC-posture change (contrast Docker's
  `packages:` scope, fd4). Same-repo PRs by collaborators keep read-write cache; fork PRs get
  read-only (restore main's cache, can't save) -- fine for a public repo.
  `[CITED: docs.github.com dependency-caching; github.blog 2026-06-26 read-only-cache-for-untrusted-triggers]`

---

## (3) Measurement under the CI-trigger constraint

**The constraint (verified in ci.yml + AGENTS.md):** `on:` is `pull_request: {}` +
`push: branches: [main]` ONLY. A `git push` to `gsd/v0.2.1-...` triggers NOTHING; `main` is PR-only
(empty-bypass ruleset). The branch is fully pushed (0/0 vs origin, 176 ahead of main); NO PR open.
**There is no push-only way to measure on this branch.**

**GHA cache scope (the hard rule for miss->hit):** a cache created on a `pull_request` run is scoped
to the merge ref `refs/pull/N/merge` and is restorable ONLY by RE-RUNS of the SAME PR -- not the
base branch, not other PRs. Default-branch (`main`) caches are readable by all. So the miss->hit
must be read WITHIN one PR: **run 1 = MISS (saves to that PR's scope), a re-run = HIT.** Production
steady-state only kicks in after the commit lands on `main` and the first `main` run seeds main's
cache for all future PRs. `[CITED: docs.github.com dependency-caching -- "created for the merge ref
... can only be restored by re-runs of the pull request"]`

**Reading durations (both options use the same gh):**
```bash
gh run list --workflow ci.yml --branch <head> --json databaseId,event,status,createdAt -L 10
# e2e install-step wall-clock in seconds (miss run, then rerun):
gh run view <run-id> --json jobs -q '
  .jobs[] | select(.name=="e2e") | .steps[]
  | select(.name|test("run-many -t e2e"))
  | ((.completedAt|fromdateiso8601)-(.startedAt|fromdateiso8601))'
```

| # | Option | How to trigger CI | miss->hit method | Outward-facing? | Violates human-gated Release-PR? | Cost |
|---|--------|-------------------|------------------|-----------------|----------------------------------|------|
| **b (RECOMMENDED)** | **Throwaway draft PR from a scratch branch** | `git switch -c ci-cache-probe`, commit the ci.yml change, push, `gh pr create --draft --base main --head ci-cache-probe` (fires `pull_request`) | run 1 = MISS + save; `gh run rerun <id>` = HIT; read both e2e-step durations; then `gh pr close <n> --delete-branch` | Yes -- a PR in the user's OWN repo (own-repo PRs are exempt from the AskUserQuestion gate); draft, never merged; the 176-commit diff is cosmetic | **No** -- separate throwaway PR, never merged; keeps the CI change decoupled from the release (aligns with 1gr/fd4); the proven commit later rides the real Release-PR | 2 CI runs + cleanup. Cache is PR-scoped, evaporates; does NOT seed main (real Release-PR's first run is cold again -- fine) |
| a (fallback) | Fold into the eventual Release-PR | the human opens `release/0.2.1` -> main (per AGENTS.md) | first `ci` run e2e = MISS; `gh run rerun <id>` = HIT | No extra artifact -- it IS the release PR | **Entangles** an unproven CI change with the human-gated release cut (contra 1gr/fd4 "keep CI-only changes separate"); you learn miss->hit only AFTER the human opens it | 0 extra runs + 1 rerun; revert noise in the release if it flops |
| c (last resort) | Add `workflow_dispatch` to ci.yml | dispatch on the branch (branch-scoped cache; re-dispatch = HIT) | run 1 = MISS + save to branch scope; re-dispatch = HIT | A ci.yml trigger edit to add + later revert | **Blocked in practice:** `workflow_dispatch` is only dispatchable once the trigger exists on the DEFAULT branch -- i.e. you must MERGE the trigger to `main` first (a PR), defeating the "measure without a PR" goal. Also depends on `dorny/paths-filter` yielding a non-`false` `code` on dispatch | highest moving parts; not worth it |

Rank: **b > a > c.**

---

## (4) Keep / revert criterion ("apply IF proven faster")

- **Metric:** the `nx run-many -t e2e --parallel=2` STEP wall-clock, MISS vs HIT, from
  `gh run view <id> --json jobs` (step `startedAt`/`completedAt`). The step is cleaner than the whole
  job but still bundles the cache-independent CPU-bound typecheck assertions with the installs, so
  the delta reflects only the install-fetch savings against a large fixed floor.
- **Threshold to KEEP:** HIT beats MISS by a clear margin BEYOND CI run-to-run noise. A single
  miss-vs-hit is directional; size the noise with a SECOND hit rerun (each run burns minutes, so no
  median-of-3). Pragmatic bar: keep if the HIT e2e-step is faster by a clear double-digit-second
  reduction that exceeds the hit-vs-hit spread. The local 1gr/gja install-ms evidence already proves
  the fetch delta exists; this CI read decides if it clears the wall-clock noise floor.
- **REVERT if within noise / negligible.** One-hunk revert: delete the `actions/cache/restore` +
  `actions/cache/save` steps from the `e2e` job. No other file is touched (the key is just
  `hashFiles` globs -- NO global-setup/code change is needed).

---

## (5) GO / NO-GO + minimal slice + code-review note

**GO to IMPLEMENT + MEASURE (via Option b).** The lever is real and additive: yarn (biggest single
install) and pnpm get ZERO help from the existing `setup-node cache: npm`, and only caching
`tmp/local-registry/storage` warms the Verdaccio->npmjs hop for all three PMs. It is low-cost, adds
NO permission scope, does NOT regress the `contents: read`/tokenless-OIDC posture, is fidelity-safe
by construction (reset + maxage), and is a one-hunk revert. It stacks cleanly on the landed Lever 1
(`clearStorage:false` already gives in-job cross-project reuse; this adds cross-CI-run persistence).

**Minimal slice (1 task):**
1. On a scratch branch, add the restore/save split to the `e2e` job in `.github/workflows/ci.yml`
   (Section 2). No `e2e/**` or `libs/test-util` change.
2. Open a throwaway draft PR, measure MISS (first run) vs HIT (`gh run rerun`), confirm the gate
   stays GREEN (4/4 projects). Close the PR + delete the branch.
3. If proven faster (Section 4): keep the commit and let it ride the real Release-PR later (its
   first `main` run seeds main's cache for all future PRs). If within noise: revert.

**Honest NO-GO condition:** if the measured within-PR miss->hit e2e-step delta is within CI noise
(the CPU-bound typecheck floor swamps the fetch savings), REVERT -- the local install-ms win does
not justify a permanent CI step.

**Fallback:** if a throwaway PR is undesirable, fold the measurement into the Release-PR (Option a),
accepting that it couples an unproven change to the release cut.

**Code-review note (user requires review on all changes).** The ONLY changed artifact is the
`ci.yml` diff (two `actions/cache` steps) -- no `AGENTS.md`/`CLAUDE.md`/product change, and NO
global-setup edit (`resetVerdaccioPublishState` already handles the volatile paths; the key inputs
are `hashFiles` globs). It is covered by the mandatory `/gsd-code-review` gate during phase
execution (reviews every changed file incl. `ci.yml`) OR an explicit independent review before
commit. The reviewer must: (i) confirm the SHA pin `v6.1.0 -> 55cc8345863c7cc4c66a329aec7e433d2d1c52a9`
(Dependabot's `github-actions` ecosystem keeps it fresh, matching every other pin here); (ii) confirm
no new permission scope; (iii) note the existing `lint-workflows` (actionlint) + `act-compat`
(`act --validate` / `act -n`) jobs will structurally validate the added steps.

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | Disposition |
|---------|----------|-----|-------------|-------------|
| `actions/cache` @ v6.1.0 (`55cc8345863c7cc4c66a329aec7e433d2d1c52a9`) | GitHub Actions Marketplace (first-party `actions/` org) | mature | github.com/actions/cache | Approved -- SHA-pinned, first-party, no npm install |

No npm/PyPI/crates packages are added by this task. `actions/cache/restore` + `actions/cache/save`
are subpaths of the same repo/commit (verified present at v6.1.0 via `gh api`).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `setup-node cache:npm`'s skip-save-on-exact-lock-hit can leave `~/.npm` NOT carrying the e2e's 127.0.0.1:4873 entries across runs (making the npm-routed benefit robustly additive rather than redundant) | (1) | If `~/.npm` DID reliably carry them, the npm-routed portion is redundant -- but yarn+pnpm (the decisive additive cases) are unaffected, so the GO verdict stands |
| A2 | The e2e-step wall-clock is dominated by CPU-bound typecheck, diluting the miss->hit delta | (1),(4) | If installs are a larger CI share than modeled, the measured win is bigger (better for GO), not worse |

## Sources

### Primary (HIGH)
- `.github/workflows/ci.yml`, `project.json` (port 4873), `e2e/**/*.e2e.spec.ts`,
  `e2e/**/global-setup.ts`, `libs/test-util/src/lib/e2e-process.ts`, `.verdaccio/config.yml` --
  install routing, fixed port, reset-at-run-start, yarn/pnpm cache locations (first-party code)
- `260714-1gr-MEASUREMENTS.md` (Lever 1 + Part d recipe), `260714-gja-MEASUREMENTS.md` (flag win),
  `260714-fd4-RESEARCH.md` (actions/cache vs Docker, 10 GB ceiling, no packages: scope) -- first-party
- `gh api repos/actions/cache/...` -- latest = v6.1.0; commit SHA `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`; restore/save subactions present at v6.1.0

### Secondary (CITED)
- [GitHub Docs -- Dependency caching reference (cache scope, PR merge-ref restriction, 10 GB ceiling, restore search order)](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [actions/cache README (path globs incl. `!` excludes; restore/save split; save-on-success)](https://github.com/actions/cache)
- [GitHub Changelog -- Read-only Actions cache for untrusted triggers (2026-06-26): same-repo PRs keep read-write](https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/)

## Metadata
- **Confidence:** additive verdict HIGH (code-verified routing + fixed port + yarn/pnpm cache facts);
  design HIGH (verified SHA + docs + fidelity proof); measurement HIGH (verified triggers + cache-scope docs).
- **Research date:** 2026-07-14  **Valid until:** ~30 days (revisit if the PM matrix, fixtures, or the CI trigger change).
