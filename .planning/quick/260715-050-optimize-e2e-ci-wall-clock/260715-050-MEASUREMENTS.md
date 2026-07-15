# Quick Task 260715-050: e2e CI wall-clock -- MEASUREMENTS

**Started:** 2026-07-15
**Baseline source:** CI run 29369041238 (PR #35 "THROWAWAY CI dress-rehearsal", branch
gsd/v0.2.1-angular-cli-workspace-support). Overall run = failure, but ONLY fallow + format-lint
(later fixed); the `e2e` job = SUCCESS. Valid baseline for the current `--parallel=2` single job.
No new CI minutes spent (reused an existing green e2e job log).

## Step 0 -- BASELINE (current single `e2e` job, `nx run-many -t e2e --parallel=2`)

- `e2e` job wall: **620s** (10m20s). Step breakdown: checkout 1s + setup-node 0s + corepack 1s +
  pnpm-setup 3s + `npm ci` 23s + typecheck-e2e (`-p tag:type:e2e`) 6s + **`run-many -t e2e` step 581s**.
- Fixed per-runner overhead (everything except the e2e step) ~= **~35s** (NOT the ~120s the RESEARCH
  modeled -- `npm ci` is cache-warmed at 23s, and `angular-typechecker:build` via `dependsOn` is a
  small @nx/js:tsc lib, ~5-10s). This makes a split's per-cell fixed cost cheap -> split is MORE
  favorable than the research model assumed.

### Per-project vitest wall (specs run SERIALLY within each project -- fileParallelism effectively off)

| Project | vitest Duration | # spec files |
|---|---|---|
| angular-typechecker-ng-cli-e2e | **278.9s** | 3 |
| angular-typechecker-install-e2e | **266.1s** | 11 |
| angular-typechecker-matrix-e2e | 47.0s | 2 |
| angular-typechecker-cache-e2e | 28.7s | 3 |

Sum of project walls ~= 620s. Under `--parallel=2` (install-e2e + cache-e2e are `parallelism:false`)
the observed schedule was: install-e2e ALONE (266s) -> matrix-e2e (47s) || ng-cli-e2e (279s) ->
cache-e2e ALONE (29s) ~= 574s of vitest + ~7s build ~= 581s step.

### Per-spec-file durations (CI, from the vitest reporter)

| Spec file | Project | PM | Seconds |
|---|---|---|---|
| ng-add-ng-run-yarn.e2e.spec.ts (2 tests) | ng-cli | **yarn** | **130.0** |
| ng-add-ng-run-pnpm.e2e.spec.ts | ng-cli | **pnpm** | **103.5** |
| storybook-tarball.e2e.spec.ts (2 tests) | install | npm | 83.6 |
| nx-add-pnpm.e2e.spec.ts | install | **pnpm** | 56.8 |
| storybook-composition.e2e.spec.ts (3 tests) | install | npm | 41.6 |
| ng-add-ng-run.e2e.spec.ts | ng-cli | **npm** | 38.5 |
| matrix-5types.e2e.spec.ts (5 tests) | matrix | npm (direct) | 33.3 |
| nx-add-yarn.e2e.spec.ts | install | **yarn** | 20.2 |
| generator-e2e.e2e.spec.ts | install | npm (direct) | 16.6 |
| pnpm-symlink.e2e.spec.ts (2 tests) | matrix | **pnpm** | 13.2 |
| cache-busts-on-spec-edit.e2e.spec.ts (3) | cache | none | 11.6 |
| install-smoke.e2e.spec.ts | install | npm (direct) | 10.9 |
| verdaccio-publish.e2e.spec.ts | install | npm | 10.5 |
| cache-busts-on-dep-error.e2e.spec.ts (3) | cache | none | 9.9 |
| nx-add-npm.e2e.spec.ts | install | **npm** | 9.7 |
| nx-add-e2e.e2e.spec.ts | install | npm (direct) | 7.4 |
| executor-parity.e2e.spec.ts (3) | cache | none | 6.4 |
| tarball-audit.e2e.spec.ts (6) | install | none | 1.7 |
| release-hygiene.e2e.spec.ts (19) | install | none | 0.01 |

### Per-PM aggregation

| PM bucket | Total | Note |
|---|---|---|
| npm (Verdaccio + npmjs-direct) | **252s** | storybook x2 = 125s dominate |
| pnpm | 174s | |
| yarn | 150s | ng-add-yarn alone is 130s |
| no-PM / misc | 30s | cache-e2e + release-hygiene + tarball-audit |

## Projected wall-clock by split axis (fixed+build ~= ~45s/cell)

| Design | Floor cell | Wall | vs 620s | Complexity |
|---|---|---|---|---|
| Current single job | -- | 620s | -- | -- |
| **Per-project matrix (4 cells)** | ng-cli-e2e 279s | **~324s** | **~48%** | trivial; nx-target aligned; research design |
| Per-PM (3 PM + misc) | npm 252s | ~297s | ~52% | medium; cells run spec-file subsets (cross-cuts nx projects) |
| Custom balanced (~5-6 cells) | heaviest single spec = ng-add-yarn 130s | ~175-220s | ~65% | high; spec-file CI targeting + large GUARD-01b rewrite |

## Axis analysis (answers "what about a per-PM split?")

- Per-PM (~297s) is only MARGINALLY faster than per-project (~324s): the npm bucket is
  storybook-dominated (125s), so PM-bucketing does not balance well. It also costs real complexity
  (a CI cell must run a SUBSET of a project's spec files via vitest file filtering, cross-cutting the
  nx project boundary + breaking per-project nx caching cleanliness).
- Both per-project and per-PM are limited by the fact that install-e2e and ng-cli-e2e run their own
  specs SERIALLY. The genuinely bigger win (~65%) requires splitting INDIVIDUAL heavy specs across
  cells -- floor becomes the single heaviest spec (ng-add-yarn, 130s) -- which is the high-complexity
  custom path (sub-project spec-file targeting + big guard rewrite).
- The theoretical wall floor (any design) is ~fixed+build+130s ~= ~175s (the ng-add-yarn spec cannot
  be subdivided further).

## Locked decisions (user, 2026-07-15, after reviewing this baseline)

1. **Lever order:** A (split) first, measure, THEN B (Verdaccio uplink cache from 260714-nub).
2. **Measurement scope:** FULL loop, orchestrator-driven -- implement on a scratch branch, run
   throwaway-draft-PR CI measurements (baseline vs split[+cache]), apply keep/revert criterion,
   commit the winning config to the feature branch.
3. **Split axis:** PER-PROJECT matrix (one runner per nx e2e project). ~324s / ~48% modeled.
4. **Future-proofing (HARD requirement):** the split MUST auto-cover any NEW project that adds an
   `e2e` target. => DYNAMIC matrix from nx (`nx show projects --with-target e2e --json` ->
   `fromJSON`), NOT a static list. A guard must still fail loud if the dynamic wiring drifts.
5. **Build handoff:** SEPARATE build job + build artifact (user chose this over per-cell rebuild
   despite the ~35s critical-path cost, for build-once consistency). The build job ALSO hosts the
   dynamic-matrix discovery (it already does checkout + npm ci), so the dynamic matrix is ~free.

### Consolidated architecture

- `changes` (unchanged path gate).
- **`build`** (NEW): checkout + setup-node + `npm ci` + `nx build angular-typechecker`; upload the
  build output artifact (`.nx/cache` + `dist/` so nx replays `build` as a CACHE HIT downstream --
  keeping the `e2e`-target `dependsOn: build` + local-dev flow + GUARD-01e intact, NOT deleting the
  dependsOn); job `outputs.projects = nx show projects --with-target e2e --json`.
- **`e2e`**: `needs: [changes, build]`, `if: code != 'false'`, `strategy.fail-fast: false`,
  `strategy.matrix.project: ${{ fromJSON(needs.build.outputs.projects) }}`; download the artifact
  (so cells do not rebuild); `nx run-many -t typecheck -p ${{ matrix.project }}` +
  `nx run-many -t e2e -p ${{ matrix.project }}` (keep the `run-many` spelling for GUARD-01/01c).
- `ci` aggregate: add `build` to `needs`; existing `contains(needs.*.result, 'failure'|'cancelled')`
  gate catches a matrix-cell OR build failure. NO new required-check name; NO ruleset edit.

### Open technical risks for the plan/checker to resolve

- **Dynamic `fromJSON` matrix under `act -n` + actionlint**: `needs.build.outputs.projects` is empty
  in a dry run, so `fromJSON('')` could break matrix expansion or the `act -n` plan. Validate locally
  with `bash tools/act/act-compat.sh` (container-free) BEFORE any CI run; harden with a fallback
  (e.g. a default) if act reds. This is the single biggest new risk vs the research's static-matrix design.
- **Artifact-vs-`dependsOn` rebuild**: restoring `.nx/cache` (+dist) makes `angular-typechecker:build`
  a cache hit in each cell; cells must NOT pass `--skip-nx-cache`.
- **GUARD-01b `--parallel=2` assertion** must be surgically rewritten to assert the dynamic-matrix
  wiring (`fromJSON` over `nx show projects --with-target e2e`) instead of `--parallel=2` (source
  change -> `/gsd-code-review`). The other GUARD-01b assertions (pack-destination, parallelism:false,
  no-in-spec-build) stay -- they protect the LOCAL full-tier run.

## AFTER -- Lever A (per-project matrix + build job), run #1

**Source:** throwaway draft PR #36 (base = feature branch), CI run 29393040360, all jobs GREEN
(`ci` aggregate success). Scratch branch `260715-050-e2e-split-probe` @ 652a1e4.

| Job | Duration | Timeline (UTC) |
|---|---|---|
| build (build + discover + artifact upload) | 39s | 06:02:14 -> 06:02:53 |
| e2e (ng-cli-e2e) -- FLOOR | **312s** | 06:02:55 -> 06:08:07 |
| e2e (install-e2e) | 301s | 06:02:55 -> 06:07:56 |
| e2e (matrix-e2e) | 81s | 06:02:55 -> 06:04:16 |
| e2e (cache-e2e) | 74s | 06:02:55 -> 06:04:09 |

- **Matrix critical-path** (earliest cell start -> latest finish): **312s**.
- **Combined tier wall** (build.startedAt -> last cell finish): **~353s**.
- **vs 620s baseline: ~267s saved / ~43% faster** -- clears the KEEP-A bar (> ~90s AND > ~15%)
  decisively on a single run (noise run #2 pending the build-job decision below).
- Per-cell walls exceed the baseline per-project vitest walls (312 vs 279; 301 vs 266) because each
  cell now pays its OWN npm ci + setup + rebuild. The win is purely PARALLELISM: install-e2e + ng-cli-e2e
  (the two serial floors) now run CONCURRENTLY on separate runners.

### CRITICAL FINDING -- the `.nx/cache` build-artifact handoff is a NO-OP

Every e2e cell log shows `Nx found unrecognized artifacts in the cache directory and will not be able
to use them` (nx `unknown-local-cache`) and then RE-COMPILES `angular-typechecker:build` + `test-util:build`
inside the `run-many -t e2e` step. A raw `upload/download-artifact` of `.nx/cache` is NOT a supported
cross-machine nx cache mechanism (nx keys/validates local artifacts and rejects a foreign runner's);
the supported cross-runner path is Nx Cloud / a self-hosted remote cache, which this repo does NOT use.
The `dependsOn: build` backstop rebuilds in every cell (CORRECT), which ALSO regenerates `dist`, so the
uploaded `dist` is redundant too.

**Tension a plain `dist`-only artifact does NOT resolve:** nx's `dependsOn: build` rebuilds on the cell's
cold cache regardless of a pre-placed `dist` (it cannot trust the output without its cache), so a `dist`
artifact is still redundant. Genuinely skipping the rebuild requires REMOVING `dependsOn: build` from the
e2e target -- which reintroduces the fresh-runner ENOENT footgun the sl6 fix closed (local
`nx run-many -t e2e` would need a manual `nx build` first) and forces a GUARD-01e rewrite.

**Measured cost of the thing the artifact was meant to avoid:** the per-cell rebuild is ~2-4s (small
`@nx/js:tsc` lib). The 39s "build job" is mostly its own npm ci. => the build-once apparatus saves ~2-4s
per cell; the ~43% win is entirely parallelism. Build-job design decision surfaced to the user.

## DECISION (user, 2026-07-15): finalize the SIMPLIFIED split; defer the remote cache

After RESEARCH-2 (PR-vs-release CI + build-once-test-many) + RESEARCH-3 (GH-backed Nx remote cache +
CREEP), the user chose: (1) FINALIZE the simplified split -- drop the build+artifact job, keep a lean
fs-read `discover` job for the dynamic matrix, per-cell rebuild via the UNTOUCHED `dependsOn: build`
(local dev + GUARD-01e intact); (2) DEFER the GitHub-backed Nx remote cache to its own phase (created
as Phase 25 in the current milestone). Release provenance is already covered at zero cost: the
`install-e2e` cell builds+publishes+installs the exact `dist/packages/angular-typechecker` packageRoot
that release.yml ships, and it runs on the Release-PR (a PR -> ci.yml e2e) BEFORE the tag push.

## AFTER -- Lever A, SIMPLIFIED (lean discover job + per-cell build), run 29396866900

**Source:** throwaway PR #36, sha 320f8dd. The split (discover + 4 e2e cells) all GREEN; the run's
only red was `fallow` flagging the new `tools/ci/list-e2e-projects.mjs` as unreachable dead code --
ORTHOGONAL to the split, fixed by declaring it a fallow `entry` (254d631, confirmed `fallow audit` PASS
locally + a full-green re-run 29402336635). The discover/e2e job timings below are unaffected by the
fallow red.

| Job | Duration | Timeline (UTC) |
|---|---|---|
| discover (fs-read, no npm ci/build) | **6s** | 07:17:48 -> 07:17:54 |
| e2e (ng-cli-e2e) -- FLOOR | **356s** | 07:17:58 -> 07:23:54 |
| e2e (install-e2e) | 293s | 07:17:56 -> 07:22:49 |
| e2e (matrix-e2e) | 80s | 07:17:56 -> 07:19:16 |
| e2e (cache-e2e) | 76s | 07:17:58 -> 07:19:14 |

- **Tier wall (discover start 07:17:48 -> last cell finish 07:23:54): 366s.**
- **vs 620s baseline: ~254s saved / ~41% faster** -- clears the KEEP-A bar (> ~90s AND > ~15%). Within
  CI noise of the build-artifact run's 353s: the difference is ng-cli-cell install variance (356 vs 312s),
  NOT the design -- the lean 6s discover job is objectively better than the old 39s build job.
- **KEEP A: YES.** The floor is the **ng-cli-e2e cell (~356s)**, dominated by its serial
  ng-add-{yarn,pnpm,npm} installs -- the irreducible per-project-split floor (going lower needs a
  sub-project spec split, deferred). This is exactly the install cost Lever B (Verdaccio uplink cache)
  targets -> proceed to measure B next (A-then-B).

## AFTER -- Lever B (per-cell Verdaccio uplink cache), miss vs hit

**Source:** throwaway PR #36, sha 9b1c4c7, CI run 29403722214. MISS = attempt 1 (cold, saves the
per-cell caches); HIT = attempt 2 (`gh run rerun`, restores the PR-merge-ref-scoped caches -- save
skipped on both cells, confirming `cache-hit=true`). All cells GREEN on both attempts.

| Cell (`run-many -t e2e` step) | MISS | HIT | delta |
|---|---|---|---|
| install-e2e | 249s | 260s | **+11s (HIT SLOWER)** |
| ng-cli-e2e | 336s | 307s | -29s (HIT faster) |

**Verdict: DISCARD Lever B (null result -- within CI noise).** The two install-heavy cells moved in
OPPOSITE directions (install-e2e +11s, ng-cli-e2e -29s). If the cached Verdaccio->npmjs uplink genuinely
shortened the tier, BOTH cells (both fetch through that hop) would improve; install-e2e getting SLOWER on
the warm-cache attempt means the fetch savings are smaller than these cells' run-to-run variance
(+/-20-40s is typical for the heavy yarn/pnpm install cells). The e2e-step is dominated by the CPU-bound
typecheck + install-COMPUTE floor; the uplink-FETCH slice the cache warms is a fraction that does not
clear that noise (exactly nub's honest NO-GO condition + its CPU-bound-floor caveat). One-hunk revert:
drop the two `actions/cache` steps. No second HIT run was spent -- the opposite-sign result is already
conclusive that the delta is noise-dominated.

## Applied config (the winner on the feature branch)

**Lever A ONLY** (the per-project split). Applied to `gsd/v0.2.1-angular-cli-workspace-support` from the
throwaway branch's fallow-fixed, A-only state (sha 254d631):
- `.github/workflows/ci.yml`: lean `discover` job (fs-read dynamic matrix) + per-project `e2e` matrix +
  `discover` in the `ci` aggregate `needs`. NO Lever B cache steps, NO build/artifact job.
- `tools/ci/list-e2e-projects.mjs`: the discovery script.
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`: GUARD-01/01b/01d updated for the
  dynamic-matrix wiring + the discovery-script consistency check.
- `.fallowrc.jsonc`: `tools/ci/list-e2e-projects.mjs` declared as a fallow `entry`.

**Net result: e2e-tier CI wall-clock 620s -> ~366s (~41% faster), fully green on the whole `ci` gate.**
Deferred: the GitHub-backed Nx remote cache (ROADMAP Phase 25); a sub-project (per-PM/custom-bucket)
split to lower the ng-cli floor below ~356s (higher complexity, own follow-up if ever justified).

