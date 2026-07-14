# Quick Task 260714-gja: OTHER local e2e wall-clock levers -- RESEARCH

**Researched:** 2026-07-14 (Windows arm64 dev box; branch gsd/v0.2.1-angular-cli-workspace-support)
**Domain:** e2e install-cost optimization -- LOCAL, fidelity-preserving repo changes (NOT Docker, NOT actions/cache)
**Confidence:** HIGH (grounded in this repo's w87/1gr/squ/fd4 first-party measurements + a full read of every install site)

## Summary

The e2e per-run cost is the INSTALL into each `mkdtemp` workspace, and installs are the
majority of the tier wall-clock (w87/1gr: install-e2e install-only ~355s of ~498s Duration).
Lever 1 (warm Verdaccio, landed 1gr) already collapsed the NETWORK-fetch portion of every
Verdaccio-routed install toward ~0. What remains per install is: tarball EXTRACT+LINK, the
npm `audit`/`fund`/metadata-revalidation round-trips, the corepack shim spawn, and -- the
dominant Windows residual -- Defender real-time scanning of `node_modules`.

After reading all 19 install sites, the honest picture: the only fidelity-safe REPO lever
left is a small set of npm/pnpm install flags on the DIRECT provisioning + tarball installs
(never on `nx add`/`ng add`, never on yarn). It gives a modest, near-zero-risk shave and
helps CI too. The two bigger conceptual levers are both disqualified for a release branch:
intra-project vitest parallelism is CI-HOSTILE (oversubscribes 4-vCPU runners) and
Verdaccio-race-prone, and the single biggest LOCAL win -- a Windows Defender exclusion on
the OS-temp install path -- is a contributor-machine change, not a repo change.

**Primary recommendation:** APPLY the fidelity-safe npm/pnpm flag set to the direct install
sites (one hunk each, revertable). MEASURE-ONLY the Defender-exclusion spike + matrix-e2e
file-parallelism. REJECT the local-cache-pin, the pnpm-swap, yarn flags, and
install-e2e/ng-cli-e2e file-parallelism.

## Ground truth confirmed by reading the code (not just the prior measurements)

| Claim | Verdict | Evidence |
|-------|---------|----------|
| `buildCleanEnv({stripAllNpmConfig:true})` strips the local npm CACHE dir, forcing re-fetch | **FALSE** | It strips `npm_config_*` KEYS. `npm_config_cache` is not set in this env, so npm falls back to its default `~/.npm` cache -- which persists. `[VERIFIED: e2e-process.ts buildCleanEnv + no npm_config_cache anywhere]` |
| Verdaccio port is stable across runs (so `~/.npm` hits across runs) | **TRUE (4873, fixed)** | `project.json` `local-registry` `port: 4873`. npm caches Verdaccio tarballs keyed by `http://127.0.0.1:4873/...`; a stable port means cross-run cache hits already happen locally. `[VERIFIED: project.json:8]` |
| yarn fixtures can reuse a cache across runs | **FALSE, by design** | Both yarn specs write `cacheFolder: ./.yarn/cache` into a per-mkdtemp `.yarnrc.yml` (fresh each run) with `enableMirror:false` -- deliberately, to prove the local Verdaccio dist is used. No yarn cache lever exists without breaking that fidelity. `[VERIFIED: nx-add-yarn:118, ng-add-ng-run-yarn:218]` |
| mkdtemp workspaces land on the fast Dev Drive (D:, ReFS) | **FALSE** | Every spec uses `mkdtempSync(join(tmpdir(), ...))` = OS temp = `C:\Users\...\AppData\Local\Temp` (NTFS, full real-time Defender), NOT the D: Dev Drive the repo sits on. `[VERIFIED: 19 mkdtemp call sites]` |
| Install commands carry perf flags today | **FALSE (none)** | Only pre-existing flags: `--legacy-peer-deps` (Storybook, load-bearing), `--config.frozen-lockfile=false --ignore-scripts` (pnpm-symlink), `--skip-confirmation` (ng add). No `--no-audit/--no-fund/--prefer-offline` anywhere. `[VERIFIED: grep of all specs]` |

## (a) Ranked lever table

Score = expected LOCAL win x confidence / (fidelity + parallel=2 + CI risk).

| # | Lever | Expected local win | Fidelity risk | parallel=2 risk | CI effect | Verdict | Files |
|---|-------|--------------------|---------------|-----------------|-----------|---------|-------|
| 1 | npm/pnpm safe flags on DIRECT installs (`--no-audit --no-fund` [+ `--prefer-offline`]; pnpm `--prefer-offline`) | LOW-MODEST (secs/heavy install; extract+link still dominates) | NONE (no resolution change, no ERESOLVE masking) | NONE (per-install) | Bonus: `--no-audit/--no-fund` help CI too | **APPLY-NOW** | 8 spec files (see (b)) |
| 2 | Windows Defender exclusion on OS-temp install path | HIGH (multiplicative on extract+link, the biggest Windows residual) | n/a (not a repo change) | n/a | none (CI is Linux) | **MEASURE-ONLY** (contributor note + optional spike) | none (docs/env) |
| 3 | matrix-e2e intra-project fileParallelism | LOW (2 files; npmjs-direct; overlaps 1 npm + 1 pnpm spec) | LOW (isolated mkdtemps, per-spec `--pack-destination`, different PMs/caches) | LOW-MED (co-runs with ng-cli under --parallel=2 -> CI oversubscription) | negative on 4-vCPU runner | **MEASURE-ONLY** | matrix vitest.config.mts |
| 4 | ng-cli-e2e intra-project fileParallelism | MODERATE-HIGH (overlap the 44-53s yarn install with npm+pnpm) | MED (3 PMs share ONE 127.0.0.1:4873 Verdaccio) | HIGH (concurrent COLD first-fetch race on shared proxy cache; CI oversubscription) | negative/flaky on cold cache | **MEASURE-ONLY / lean REJECT** | ng-cli vitest.config.mts |
| 5 | install-e2e intra-project fileParallelism | HIGH-potential (10 specs incl. 3 Storybook) | HIGH (sole Verdaccio publisher; latent serial assumptions) | HIGHEST (shared registry/token/cold-fetch race) | negative/flaky | **REJECT** | -- |
| 6 | Pin a persistent local npm cache / pnpm store dir (Lever 2 premise) | ~0 (already reused; Lever 1 + fixed port 4873 dominate) | LOW | LOW-MED (shared store under concurrent installs) | none | **REJECT** | -- |
| 7 | Swap non-PM-specific installs to pnpm (~7x) | N/A (none qualify -- all are PM-specific or npm-layout is load-bearing) | HIGH (layout/executor-resolution change, coverage loss) | -- | -- | **REJECT** | -- |
| 8 | yarn 4 perf flags | 0 (no safe speed flag; win comes free from warm Verdaccio) | -- | -- | -- | **REJECT** | -- |

## (b) Safe install-flag set per install site

Rule: flags go ONLY on DIRECT package-manager installs the harness issues for provisioning
or for installing OUR tarball. They MUST NOT touch `nx add` / `ng add` (the REAL command
under test forwards no flags -- fidelity) or yarn (no safe flag). None of the recommended
flags change dependency resolution or suppress a peer ERESOLVE (only `--legacy-peer-deps` /
`--force` do that, and those stay exactly as-is), so B-03 peer-honesty is preserved.
`[CITED: docs.npmjs.com/cli/commands/npm-install -- --no-audit, --no-fund, --prefer-offline]`
`[CITED: pnpm.io/cli/install -- --prefer-offline]`

| Spec | Line | Command | Add flags? |
|------|------|---------|------------|
| nx-add-npm | 88 | `npm install` (provision) | `--no-audit --no-fund` [+ `--prefer-offline`] |
| nx-add-e2e | 114 | `npm install <tgz>` | `--no-audit --no-fund` [+ `--prefer-offline`] |
| install-smoke | 120 | `npm install <tgz>` | `--no-audit --no-fund` [+ `--prefer-offline`] |
| generator-e2e | 137 | `npm install <tgz>` | `--no-audit --no-fund` [+ `--prefer-offline`] |
| storybook-composition | 97 | `npm install` (provision) | `--no-audit --no-fund` [+ `--prefer-offline`] |
| storybook-composition | 108 | `npm install <SB> --legacy-peer-deps` | ADD `--no-audit --no-fund` (keep `--legacy-peer-deps`) |
| storybook-tarball | 123 | `npm install` (provision) | `--no-audit --no-fund` [+ `--prefer-offline`] |
| storybook-tarball | 136 | `npm install <SB> --legacy-peer-deps` | ADD `--no-audit --no-fund` (keep `--legacy-peer-deps`) |
| verdaccio-publish | 110 | `npm install --save-dev <name>` | `--no-audit --no-fund` [+ `--prefer-offline`] |
| matrix-5types | 130 | `npm install <tgz>` | `--no-audit --no-fund` [+ `--prefer-offline`] |
| ng-add-ng-run | 202 | `npm install` (provision) | `--no-audit --no-fund` [+ `--prefer-offline`] |
| nx-add-pnpm | 142 | `pnpm install` (provision) | `--prefer-offline` ONLY (do NOT add `--ignore-scripts`; the build-gate is under test) |
| ng-add-ng-run-pnpm | 246 | `pnpm install` (provision) | `--prefer-offline` |
| pnpm-symlink | 126 | `pnpm add <tgz> --config.frozen-lockfile=false --ignore-scripts` | optional `--prefer-offline` (npmjs-direct; small) |
| **nx-add-yarn / ng-cli yarn** | 139 / 271 | `corepack yarn install` | **NONE** (yarn 4 has no `--prefer-offline`; fresh `cacheFolder`/`enableMirror:false` load-bearing) |
| **ALL `npx nx add` / `npx ng add` / `corepack yarn nx add` / `corepack yarn ng add`** | -- | the REAL command under test | **NONE** (fidelity -- forwards no flags) |

Flag notes:
- `--no-audit` + `--no-fund`: real, safe saving on every direct npm install; skips the
  post-install audit tree-build + registry call and the funding walk. Help BOTH local and
  CI. `[CITED: npm docs]`
- `--prefer-offline`: skips metadata REVALIDATION when the local `~/.npm` cache has the data.
  LOCAL-ONLY marginal win (against localhost 4873 revalidation is cheap; on CI each job's
  `~/.npm` is cold so it is a no-op). Bracketed `[optional]` because its win is small.
- `--no-progress`: **skip -- no-op here.** `execSync` captures stdout (non-TTY), and npm
  already auto-disables the progress bar on non-TTY. `FORCE_COLOR=0` is already set by
  `buildCleanEnv`. `[VERIFIED: e2e-process.ts + non-TTY npm behavior]`
- pnpm has no install-time audit/fund spam by default, so `--prefer-offline` is its only
  applicable flag. `--reporter=silent` is NOT recommended (sh() already captures + rethrows
  the diagnostic on failure; silencing only removes captured context for no real time win).

Implementation note (alternative, MEASURE-ONLY): writing `audit=false` / `fund=false` into
each fixture's `.npmrc` would ALSO speed `nx add`'s child `npm install -D` (a bonus) without
hiding errors -- but it widens the `nx add` environment surface. Prefer the surgical CLI
flags on the direct installs; consider the `.npmrc` variant only if measurement shows the
`nx add` child install is a meaningful slice.

## (c) Intra-project vitest parallelism -- per-project safe/unsafe verdict

All four e2e configs set `pool:forks + singleFork:true + fileParallelism:false +
sequence.concurrent:false`. squ removed the shared-tarball race (per-spec
`--pack-destination`), so file-parallelism is no longer categorically unsafe -- but the
remaining shared state differs sharply per project, and one cross-cutting caveat dominates.

**CROSS-CUTTING CAVEAT (applies to all three): the vitest config is shared local + CI.**
CI runs `nx run-many -t e2e --parallel=2` on a Linux **4-vCPU / 16GB** standard runner.
Enabling intra-project fileParallelism there stacks ON TOP of --parallel=2 projects -> up to
5 concurrent full-Angular installs+typechecks on 4 cores + heavy memory pressure -> likely
SLOWER and flakier on CI. The 12-core dev box is not CI. A local-only win would require
gating fileParallelism on `!process.env.CI` -- added complexity not worth it pre-release.

| Project | Shared state under intra-project concurrency | Verdict |
|---------|----------------------------------------------|---------|
| **matrix-e2e** | 2 files, NO Verdaccio (npmjs-direct); npm vs pnpm (different caches); isolated mkdtemps + per-spec `--pack-destination`; dist read-only. npm cacache + pnpm store are both concurrency-safe. | **SAFE (dev box) but MEASURE-ONLY** -- only 2 files, small win; still changes CI oversubscription. Enable only if measured net-positive on both local AND CI. |
| **ng-cli-e2e** | 3 PMs share ONE `127.0.0.1:4873` Verdaccio + one published dist/token. Concurrent COLD first-fetches of the same Angular toolchain risk Verdaccio's concurrent-cache-population race (safe only once WARM; CI's first run is cold until actions/cache lands). Biggest potential win (overlap the 44-53s yarn install). | **MEASURE-ONLY / lean REJECT** -- high flake surface on a release branch; the yarn metadata-cache landmine (squ) is not re-triggered by concurrency alone, but the cold-fetch race + CI oversubscription are real. |
| **install-e2e** | Sole Verdaccio PUBLISHER; 10 specs incl. 3 heavy Storybook, all pulling the same toolchain concurrently; shared registry/htpasswd/token (read-only during specs but assumed serial); latent serial-order assumptions across specs written for singleFork. | **REJECT** -- highest flake surface, lowest confidence, and the residual it would parallelize (extract+link) is Defender-serialized locally anyway. |

## (d) APPLY-NOW recommendation + minimal task shape + revert path

**APPLY NOW (1 task):** add the fidelity-safe flag set from (b) to the direct npm/pnpm
install sites. Nothing on `nx add`/`ng add`/yarn.

- **Files (8):** nx-add-npm, nx-add-e2e, install-smoke, generator-e2e, storybook-composition
  (2 sites), storybook-tarball (2 sites), verdaccio-publish, matrix-5types, ng-add-ng-run
  (npm `--no-audit --no-fund` [+`--prefer-offline`]); nx-add-pnpm, ng-add-ng-run-pnpm
  (pnpm `--prefer-offline`). (Optionally pnpm-symlink `--prefer-offline`.)
- **Expected local win:** modest -- a few seconds off each heavy npm install (audit skip is
  the biggest single contributor); extract+link + Defender remain irreducible. Real bonus on
  CI (`--no-audit`/`--no-fund` apply on every fresh job).
- **Fidelity:** none of the flags change resolution or hide ERESOLVE; B-03, the
  Storybook `--legacy-peer-deps` order, the pnpm build-gate, and yarn's fresh cacheFolder are
  all untouched. GUARD-01b invariants unaffected (no `--parallel`, `--pack-destination`,
  `parallelism:false`, or build-once change).
- **Revert path:** one hunk per site (strip the added flags). Test-harness only; no product
  source; no `package.json` version mutation -> release-safe.

**Verification (reuse the committed `ATC_TIME_INSTALLS` seam -- no code change to measure):**
```bash
# BEFORE (baseline) and AFTER (flags applied), each on a warm Verdaccio (Lever 1):
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/gja-before.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache
# ...apply flags...
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/gja-after.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache
node tools/e2e-timing/aggregate-install-timings.mjs tmp/gja-before.jsonl
node tools/e2e-timing/aggregate-install-timings.mjs tmp/gja-after.jsonl
```
Read the per-scenario `npm install` / `pnpm install` deltas (the `nx add`/`ng add`/yarn rows
should be unchanged -- they carry no flags). `--skip-nx-cache` is required (a cache hit runs
no installs -> empty JSONL). Both JSONL under gitignored `tmp/`. Gate stays green 4/4.

**MEASURE-ONLY (defer to a follow-up spike, do not apply now):**
1. **Windows Defender exclusion on the OS-temp install path** (the single biggest LOCAL
   lever). Add a Defender exclusion for `%TEMP%` (and/or the repo) on the contributor box,
   then re-measure with the same seam. This is a **dev-environment change, not a repo
   change** -- do NOT redirect `mkdtemp` into a repo-relative D: `tmp/` (longer paths risk
   the Windows 260-char `MAX_PATH` limit on deep `node_modules`, and it changes behavior for
   every contributor). Recommend a one-line CONTRIBUTOR NOTE (README/CONTRIBUTING) plus an
   optional local-only spike; leave the actual exclusion to the developer. CI is Linux -> no
   effect there.
2. **matrix-e2e fileParallelism** (see (c)) -- only if it proves net-positive on BOTH local
   and a 4-vCPU CI shape.

**REJECT:** local-cache pin (Lever 2 -- already reused; Lever 1 + fixed port dominate),
pnpm-swap (Lever 4 -- none qualify), yarn flags (Lever 8 -- none safe),
ng-cli-e2e/install-e2e fileParallelism (Levers 4/5 -- Verdaccio race + CI oversubscription).

## Honest ceiling

Installs are the majority of e2e wall-clock, but after Lever 1 the reducible-by-a-flag
portion is small: the audit/fund/metadata round-trips. The dominant residual is EXTRACT+LINK
plus, on Windows, Defender -- neither of which a repo-side flag touches. The biggest LOCAL
win still on the table (Defender exclusion) is a contributor-machine change, and the biggest
CI win (actions/cache, fd4) is already a separate deferred task. So the APPLY-NOW set is
deliberately the safe, high-confidence, one-hunk-revert shave; there is no large, safe,
repo-side LOCAL lever remaining after Lever 1.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `--no-audit` is the largest single time contributor among the safe npm flags | (b), (d) | If audit is already fast against Verdaccio (no audit endpoint), the win is smaller -- but still non-negative and near-zero-risk |
| A2 | CI standard runner is 4-vCPU/16GB, making intra-project fileParallelism CI-negative | (c) | If CI moves to larger runners, ng-cli/matrix fileParallelism could flip to net-positive -- re-measure then |
| A3 | Defender-exclusion win is multiplicative on extract+link (per w87/1gr caveats) | (a), (d) | Directional; the exact multiple is unmeasured -- the recommended spike would quantify it |

## Sources

### Primary (HIGH -- first-party measurements + code)
- `260713-w87-MEASUREMENTS.md`, `260714-1gr-MEASUREMENTS.md`, `260712-squ-SUMMARY.md`, `260714-fd4-RESEARCH.md` -- install-cost decomposition, Lever 1 result, --parallel=2 isolation architecture, Docker NO-GO + the local levers it surfaced
- `libs/test-util/src/lib/e2e-process.ts` -- `sh()`/`buildCleanEnv`/`stripAllNpmConfig` semantics, `ATC_TIME_INSTALLS` seam
- All 19 `e2e/**/*.e2e.spec.ts` install sites + `e2e/**/vitest.config.mts` + both `global-setup.ts` + `.verdaccio/config.yml` + `project.json` (port 4873) + root `.npmrc`
- `.github/workflows/ci.yml` e2e job -- `--parallel=2`, `npm ci` per job, Linux-only

### Secondary (CITED -- flag semantics)
- npm CLI docs: `npm install` `--no-audit`, `--no-fund`, `--prefer-offline`, `--no-progress`
- pnpm CLI docs: `pnpm install` `--prefer-offline`

## Metadata
**Confidence breakdown:** flag safety = HIGH (code-read + stable flag semantics); parallelism
verdict = HIGH (shared-state read + CI-shape reasoning); Defender-lever magnitude = MEDIUM
(directional). **Valid until:** ~30 days (revisit if the PM matrix, CI runner size, or the
install-site set changes).
