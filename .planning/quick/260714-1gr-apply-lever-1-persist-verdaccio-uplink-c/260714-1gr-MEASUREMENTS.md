# Quick Task 260714-1gr: Lever 1 applied + cold-vs-warm re-measure

**Measured:** 2026-07-14 (two back-to-back instrumented runs, Windows arm64 dev box)
**Branch:** gsd/v0.2.1-angular-cli-workspace-support (main checkout, no worktree)
**Scope:** APPLY Lever 1 (persist the Verdaccio uplink cache) + MEASURE. The
`actions/cache` CI extension is DEFERRED to a documented turnkey follow-up (Part d).

## What + how

Lever 1 = flip `clearStorage: true -> false` in BOTH registry global-setups
(`e2e/angular-typechecker-{install,ng-cli}-e2e/src/global-setup.ts`) and, before
each `startLocalRegistry`, call the new shared helper
`resetVerdaccioPublishState(root)` (in `libs/test-util`, barrel-exported) which
deletes ONLY the two run-scoped essentials:

- `tmp/local-registry/storage/angular-typechecker/` -- so our freshly built dist
  republishes with no `EPUBLISHCONFLICT`;
- `tmp/local-registry/storage/.htpasswd` -- so the fresh ci-user sign-up mints a
  real publish token (a second sign-up over an existing htpasswd 409s).

Everything else under `storage/` -- the npmjs uplink proxy cache (494 package dirs
after a full run) plus `.verdaccio-db.json` -- now PERSISTS across runs. Verified
against first-party `@nx/js` source: the executor wipes storage ONLY inside
`if (options.clear && existsSync(storage))` (`verdaccio.impl.js:31`), so with
`--clear false` our two `rmSync` calls are the COMPLETE and ONLY reset.

Instrumentation is unchanged from w87 (RESEARCH Option A): the single shared
install seam `sh()` (`libs/test-util/src/lib/e2e-process.ts`) appends one JSONL
record (`{ ts, cmd, cwd, ms, ok }`) per call, gated on `ATC_TIME_INSTALLS=1`
(a true no-op when unset). Aggregated by
`tools/e2e-timing/aggregate-install-timings.mjs` (reused unchanged).

### 2-run protocol (both AFTER applying Lever 1)

```bash
# RUN C (cold) -- delete the WHOLE storage to force a from-scratch fill.
#   Folds Task 1's invariant proof AND measurement run C.
rm -rf tmp/local-registry/storage
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/1gr-run1-cold.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache

# RUN W (warm) -- do NOT delete storage; the helper removes only
#   angular-typechecker + .htpasswd, preserving the npmjs proxy cache.
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/1gr-run2-warm.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache

node tools/e2e-timing/aggregate-install-timings.mjs tmp/1gr-run1-cold.jsonl
node tools/e2e-timing/aggregate-install-timings.mjs tmp/1gr-run2-warm.jsonl
```

`--skip-nx-cache` is REQUIRED (a cache hit runs no installs -> empty JSONL). A
DISTINCT absolute `ATC_TIMING_OUT` per run (both under gitignored `tmp/`) keeps the
cold and warm JSONL from mixing. Both raw JSONL files are gitignored and NOT
committed.

### Invariant survival (the LOUD failure modes)

BOTH runs exited 0, all 4 e2e projects green:

| Run | install-e2e | matrix-e2e | ng-cli-e2e | cache-e2e | NX result |
| --- | --- | --- | --- | --- | --- |
| C (cold) | 37/37 | 7/7 | 4/4 | 9/9 | Successfully ran e2e for 4 projects |
| W (warm) | 37/37 | 7/7 | 4/4 | 9/9 | Successfully ran e2e for 4 projects |

Run W is the decisive invariant proof: it started with `storage/angular-typechecker/`
AND `storage/.htpasswd` PRESENT (left by run C), so the helper actually DELETED both
before publish. The run still published clean (no `EPUBLISHCONFLICT`) and minted a
fresh token (no sign-up 409) -- both LOUD failure modes stayed quiet. No ng-cli-e2e
`run-many` flake occurred in either run (no standalone re-run needed). No isolation
invariant was perturbed: 127.0.0.1 SAFETY gate, single 4873 registry,
`parallelism:false` on install-e2e/cache-e2e, `--parallel=2`,
`NX_INVOCATION_ROOT_PID` clearing, `enableMirror:false`, and no `package.json`
version mutation.

## Environment + CAVEAT (read before trusting absolutes)

- **Windows arm64 dev box.** Defender real-time scanning inflates `node_modules`
  write time by multiples; `execSync` wall-clock also carries `cmd.exe` + `corepack`
  shim spawn overhead. The CI e2e gate is **Linux-only**, where these absolutes
  shrink and the network-fetch portion (the part Lever 1 removes) is a LARGER share
  of each install -- so the Windows local win is a **LOWER BOUND** on the
  proportional CI win.
- **One run per condition** (no median-of-3). Treat every absolute ms as
  **directional**. The valid signals are the RELATIVE per-subset deltas plus the
  matrix flat control.
- **The vitest wall-clock is NOT the cache signal.** Each e2e project's Duration is
  dominated by the `nx typecheck` assertions (CPU-bound real-Angular-compiler runs
  over fixtures), not installs -- e.g. install-e2e wall-clock was 497.9s (C) vs
  521.7s (W), a ~24s swing that is pure CPU/Defender noise on the ~484s of
  typecheck time, NOT the install cache. Only the `sh()` install-ms JSONL isolates
  install cost, so the whole analysis below is on install-ms.
- **JSONL is append-atomic across `--parallel=2`.** 45/45 lines parsed cleanly in
  both runs (0 skipped); every record `ok:true`; all 3 PMs (npm/pnpm/yarn) present.
- **CROSS-SESSION caveat on the w87 comparison.** The w87 baseline was a DIFFERENT
  session (2026-07-13). The cache-INDEPENDENT matrix control (npmjs-direct, touches
  no storage) itself dropped ~27% from w87 to this session -- i.e. this box was
  faster today irrespective of Lever 1. So the w87->now aggregate drop is mostly
  environmental; only the EXCESS of a subset's drop OVER the matrix control's ~27%
  is cleanly Lever-attributable (see Part 4).

## Measured tables

Source: `tmp/1gr-run1-cold.jsonl` and `tmp/1gr-run2-warm.jsonl` (gitignored raw
data, NOT committed), 45 records each, all parseable. `other` = non-install `sh()`
calls (version probes, `nx g` wiring, the global-setup `nx release publish`);
included for transparency, NOT install cost. matrix-e2e's `pnpm add <tgz>` install
runs via a direct `execSync` (not `sh()`) by design, so it is absent from both JSONL
files (consistent across C and W; the npm matrix tarball `atc-matrix` IS captured).

### COLD (run C) -- install timing by PM x scenario x action

| PM | scenario | action | count | total ms | mean ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| yarn | atc-ng-yarn-flat | corepack yarn install | 1 | 53513 | 53513 | 53513 |
| npm | atc-sb-a | npm install | 1 | 38709 | 38709 | 38709 |
| npm | atc-sb-a | storybook install | 1 | 38282 | 38282 | 38282 |
| yarn | atc-ng-yarn-workspace | corepack yarn install | 1 | 36055 | 36055 | 36055 |
| npm | atc-add-npm | npm install | 1 | 29651 | 29651 | 29651 |
| npm | atc-sb-b | npm install | 1 | 28963 | 28963 | 28963 |
| npm | atc-sb-comp | npm install | 1 | 28320 | 28320 | 28320 |
| pnpm | atc-add-pnpm | nx add | 1 | 27501 | 27501 | 27501 |
| npm | atc-ng-cli | ng add | 1 | 26985 | 26985 | 26985 |
| npm | atc-verdaccio-consumer | npm install | 1 | 26780 | 26780 | 26780 |
| npm | atc-ng-cli | npm install | 1 | 23100 | 23100 | 23100 |
| npm | atc-sb-b | storybook install | 1 | 19514 | 19514 | 19514 |
| npm | atc-sb-comp | storybook install | 1 | 19242 | 19242 | 19242 |
| npm | atc-matrix | npm install <tgz> | 1 | 17775 | 17775 | 17775 |
| npm | angular-typechecker | other | 2 | 13151 | 6576 | 7129 |
| npm | atc-gen | npm install <tgz> | 1 | 12822 | 12822 | 12822 |
| npm | atc-add | npm install <tgz> | 1 | 12529 | 12529 | 12529 |
| npm | atc-smoke | npm install <tgz> | 1 | 12280 | 12280 | 12280 |
| yarn | atc-ng-yarn-flat | ng add | 1 | 12045 | 12045 | 12045 |
| pnpm | atc-ng-pnpm | ng add | 1 | 11430 | 11430 | 11430 |
| yarn | atc-ng-yarn-workspace | ng add | 1 | 10200 | 10200 | 10200 |
| yarn | atc-add-yarn | nx add | 1 | 10113 | 10113 | 10113 |
| npm | atc-sb-a | nx add | 1 | 9964 | 9964 | 9964 |
| npm | atc-add-npm | nx add | 1 | 9237 | 9237 | 9237 |
| npm | atc-sb-comp | nx add | 1 | 9232 | 9232 | 9232 |
| npm | atc-sb-b | nx add | 1 | 8806 | 8806 | 8806 |
| yarn | atc-add-yarn | corepack yarn install | 1 | 8400 | 8400 | 8400 |
| pnpm | atc-ng-pnpm | pnpm install | 1 | 7856 | 7856 | 7856 |
| npm | atc-verdaccio-consumer | other | 2 | 5678 | 2839 | 2953 |
| pnpm | atc-add-pnpm | pnpm install | 1 | 4887 | 4887 | 4887 |
| npm | atc-add | other | 1 | 3693 | 3693 | 3693 |
| npm | atc-gen | other | 1 | 3325 | 3325 | 3325 |
| npm | atc-sb-b | other | 1 | 2432 | 2432 | 2432 |
| npm | atc-sb-a | other | 1 | 2348 | 2348 | 2348 |
| pnpm | angular-typechecker | other | 2 | 1024 | 512 | 518 |
| yarn | angular-typechecker | other | 2 | 974 | 487 | 567 |
| pnpm | atc-add-pnpm | other | 1 | 667 | 667 | 667 |
| pnpm | atc-ng-pnpm | other | 1 | 639 | 639 | 639 |
| yarn | atc-ng-yarn-flat | other | 1 | 381 | 381 | 381 |
| yarn | atc-ng-yarn-workspace | other | 1 | 281 | 281 | 281 |
| yarn | atc-add-yarn | other | 1 | 248 | 248 | 248 |

**COLD per-PM totals:** npm 26/402818 ms, yarn 11/132210 ms, pnpm 8/54004 ms.
**COLD grand total:** 45 calls, 589032 ms.

### WARM (run W) -- install timing by PM x scenario x action

| PM | scenario | action | count | total ms | mean ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| yarn | atc-ng-yarn-flat | corepack yarn install | 1 | 44709 | 44709 | 44709 |
| yarn | atc-ng-yarn-workspace | corepack yarn install | 1 | 39642 | 39642 | 39642 |
| npm | atc-sb-a | npm install | 1 | 33822 | 33822 | 33822 |
| npm | atc-verdaccio-consumer | npm install | 1 | 33322 | 33322 | 33322 |
| npm | atc-add-npm | npm install | 1 | 30192 | 30192 | 30192 |
| npm | atc-sb-comp | npm install | 1 | 30155 | 30155 | 30155 |
| pnpm | atc-add-pnpm | nx add | 1 | 29744 | 29744 | 29744 |
| npm | atc-sb-b | npm install | 1 | 29710 | 29710 | 29710 |
| npm | atc-ng-cli | npm install | 1 | 25815 | 25815 | 25815 |
| npm | atc-ng-cli | ng add | 1 | 24048 | 24048 | 24048 |
| npm | atc-sb-comp | storybook install | 1 | 23901 | 23901 | 23901 |
| npm | atc-sb-b | storybook install | 1 | 23033 | 23033 | 23033 |
| npm | atc-sb-a | storybook install | 1 | 22877 | 22877 | 22877 |
| npm | atc-matrix | npm install <tgz> | 1 | 18439 | 18439 | 18439 |
| npm | atc-gen | npm install <tgz> | 1 | 16827 | 16827 | 16827 |
| npm | angular-typechecker | other | 2 | 14481 | 7241 | 8843 |
| npm | atc-smoke | npm install <tgz> | 1 | 13057 | 13057 | 13057 |
| pnpm | atc-ng-pnpm | ng add | 1 | 12393 | 12393 | 12393 |
| npm | atc-add | npm install <tgz> | 1 | 12083 | 12083 | 12083 |
| yarn | atc-add-yarn | nx add | 1 | 11430 | 11430 | 11430 |
| yarn | atc-ng-yarn-flat | ng add | 1 | 11245 | 11245 | 11245 |
| npm | atc-sb-comp | nx add | 1 | 11030 | 11030 | 11030 |
| npm | atc-add-npm | nx add | 1 | 10338 | 10338 | 10338 |
| npm | atc-sb-b | nx add | 1 | 10100 | 10100 | 10100 |
| yarn | atc-ng-yarn-workspace | ng add | 1 | 10017 | 10017 | 10017 |
| npm | atc-sb-a | nx add | 1 | 9841 | 9841 | 9841 |
| yarn | atc-add-yarn | corepack yarn install | 1 | 8741 | 8741 | 8741 |
| pnpm | atc-ng-pnpm | pnpm install | 1 | 7916 | 7916 | 7916 |
| npm | atc-verdaccio-consumer | other | 2 | 7048 | 3524 | 3813 |
| pnpm | atc-add-pnpm | pnpm install | 1 | 5080 | 5080 | 5080 |
| npm | atc-add | other | 1 | 4436 | 4436 | 4436 |
| npm | atc-gen | other | 1 | 3699 | 3699 | 3699 |
| npm | atc-sb-a | other | 1 | 3002 | 3002 | 3002 |
| npm | atc-sb-b | other | 1 | 2756 | 2756 | 2756 |
| pnpm | angular-typechecker | other | 2 | 1047 | 524 | 551 |
| yarn | angular-typechecker | other | 2 | 1002 | 501 | 550 |
| pnpm | atc-add-pnpm | other | 1 | 746 | 746 | 746 |
| pnpm | atc-ng-pnpm | other | 1 | 649 | 649 | 649 |
| yarn | atc-ng-yarn-workspace | other | 1 | 320 | 320 | 320 |
| yarn | atc-ng-yarn-flat | other | 1 | 318 | 318 | 318 |
| yarn | atc-add-yarn | other | 1 | 288 | 288 | 288 |

**WARM per-PM totals:** npm 26/414012 ms, yarn 11/127712 ms, pnpm 8/57575 ms.
**WARM grand total:** 45 calls, 599299 ms.

## (4) Cold-vs-warm delta -- the honest result

### Same-session C-vs-W delta is NULL (within noise)

Install-only ms (excludes `other`), Verdaccio-routed subset = install-e2e +
ng-cli-e2e scenarios; matrix = the npmjs-direct flat control:

| subset (install-only ms) | COLD (C) | WARM (W) | C -> W |
| --- | --- | --- | --- |
| Verdaccio-routed (install - matrix) | 536416 | 541068 | **+0.9%** |
| -- install-e2e | 355232 | 365283 | +2.8% |
| -- ng-cli-e2e | 181184 | 175785 | -3.0% |
| matrix control (npmjs-direct) | 17775 | 18439 | **+3.7%** |

Per-PM install+other totals (from the aggregator): npm 402818 -> 414012 (+2.8%),
yarn 132210 -> 127712 (-3.4%), pnpm 54004 -> 57575 (+6.6%); grand 589032 -> 599299
(+1.7%).

**There is NO measurable cold-to-warm speedup between run C and run W.** Every
subset moves within +/-4%, and the cache-independent matrix control (+3.7%) actually
swings MORE than the Verdaccio-routed subset (+0.9%) -- the C-vs-W level is
noise-dominated.

**Why (this is the finding, not a defect):** `clearStorage:false` makes run C
already warm WITHIN ITSELF. install-e2e alone runs 11 spec files sharing one
persistent proxy cache, so after its FIRST install fetches the Angular/Nx/TS/
Storybook toolchain cold, every later install-e2e spec AND ng-cli-e2e (running later
in the same tier) reuse it. By the end of run C the cache is fully populated (494
package dirs) and PERSISTS, so run W starts with nothing left to warm. The Lever's
benefit is fully banked inside a single run; it does NOT require a second run to
appear. The classic two-run cold/warm experiment therefore reads flat -- correctly.

### Where the win IS visible: vs the w87 pre-Lever baseline

The true "cold" reference is w87 (2026-07-13, `clearStorage:true` -- storage wiped
before EVERY registry start, so ng-cli-e2e re-fetched the whole toolchain cold after
install-e2e had already fetched it):

| subset (install-only ms) | w87 (pre-Lever) | C | W | w87 -> C | w87 -> W |
| --- | --- | --- | --- | --- | --- |
| Verdaccio-routed | 797099 | 536416 | 541068 | -32.7% | -32.1% |
| -- install-e2e | 519442 | 355232 | 365283 | -31.6% | -29.7% |
| -- ng-cli-e2e | 277657 | 181184 | 175785 | **-34.7%** | **-36.7%** |
| matrix control (npm) | 24513 | 17775 | 18439 | -27.5% | -24.8% |

Grand totals (install + other): w87 887631 -> C 589032 -> W 599299.

**Cross-session caveat applied:** the matrix control (cache-independent) fell ~27%
from w87 to this session, so ~27 points of every subset's drop is just a faster box
today. The **cache-attributable excess** = a subset's drop minus the matrix ~27.5%:

- Verdaccio-routed: -32.7% - 27.5% = **~5 pp** clean cache win (aggregate).
- ng-cli-e2e: -34.7% - 27.5% = **~7 pp** (the project w87 forced fully cold).

### Flagship line -- the clean structural proof

The heaviest single install, ng-cli yarn-flat `corepack yarn install` (a cold full
Angular 22 toolchain fetch):

| run | ms | vs w87 |
| --- | --- | --- |
| w87 (cold, storage wiped before ng-cli) | 93427 | -- |
| C (Lever, ng-cli reuses install-e2e's cache) | 53513 | -42.7% |
| W (fully warm) | 44709 | -52.1% |

That -43% (C) / -52% (W) FAR exceeds the ~27% environmental control -- a clean
~15 pp (C) to ~27 pp (W) cache win on the single most expensive install. This is the
mechanism in one row: w87's `clearStorage:true` wiped storage before ng-cli's
registry started, forcing a cold re-fetch; Lever 1 lets ng-cli reuse the persistent
cache install-e2e already filled.

## (5) Honest ceiling

Warm collapses the NETWORK-fetch portion of every Verdaccio-routed install toward
~0, but the **irreducible local cost remains**: tarball extraction, `node_modules`
linking, the corepack shim spawn, and (on Windows) Defender scanning. That is why
the fully-warm run W is not dramatically faster than the already-warm run C, and why
several individual scenarios wobble up a few percent between runs -- the residual
local cost, plus Defender/CPU variance, now dominates each install once the bytes
are on disk. The concrete floor from w87 is the in-run identical-fixture drop
93.4s -> 43.8s (~2.1x) on the ng-cli yarn fixture; Lever 1 generalizes exactly that
network-portion win to every Verdaccio-routed install and makes it survive across
runs -- it removes re-fetching, nothing more.

## (d) actions/cache CI cross-run cache -- DEFERRED follow-up (not this task)

There is NO storage caching in `.github/workflows/` today. It CANNOT be verified
locally (needs 2 consecutive CI runs: miss then hit), and entangling an unverifiable
CI change with the measurable local flip would muddy the PR -- **separate follow-up
PR**. Turnkey recipe for the `e2e` job in `.github/workflows/ci.yml` (restore before
`nx run-many -t e2e`, save auto at post-job); SHA-pin `actions/cache` per this repo's
supply-chain posture (Dependabot keeps it fresh):

```yaml
- uses: actions/cache@<pin-a-40char-sha>  # verify tag->SHA before adding
  with:
    path: |
      tmp/local-registry/storage
      !tmp/local-registry/storage/angular-typechecker
      !tmp/local-registry/storage/.htpasswd
    key: verdaccio-storage-${{ runner.os }}-${{ hashFiles('e2e/**/fixtures/**/package-lock.json', 'e2e/**/fixtures/**/pnpm-lock.yaml', 'packages/angular-typechecker/package.json', '.github/workflows/ci.yml') }}
    restore-keys: |
      verdaccio-storage-${{ runner.os }}-
```

- **Exclude** `storage/angular-typechecker` + `.htpasswd`: the run-start selective
  delete removes them anyway; caching them wastes space and could cache a stale
  plugin/token.
- **Key** on the Verdaccio-routed fixture lockfiles + the plugin manifest (drives
  which nx/devkit/tslib the consumer pulls) + `ci.yml` (pins Node/pnpm/yarn). matrix
  is npmjs-direct so its lockfile is intentionally NOT keyed on.
- Verify by 2 consecutive CI e2e runs (miss then hit) wall-clock delta; confirm the
  gate stays green.

**Expected CI win is LARGER than the local win, and cleaner.** Linux CI has no
Defender masking the network savings and faster disk, so the network-fetch portion
Lever 1 removes is a bigger share of each install. The `clearStorage:false` flip
this task ships ALREADY gives CI the within-run cross-project reuse (CI runs the same
`nx run-many -t e2e`, so ng-cli reuses install-e2e's cache in-job today); `actions/
cache` adds the cross-CI-run persistence on top.

## (e) GO / NO-GO outcome

**GO -- ship the local flip.** The flip HELD: both e2e runs green (4/4 projects,
57 tests each), no `EPUBLISHCONFLICT`, no sign-up 409, no ng-cli `run-many` flake.
Run W proved the selective delete works against pre-existing state (deleted the
plugin dir + htpasswd, republished clean, re-minted the token). It is test-harness
only, additive, and a one-line-per-file revert.

| Weigh | Assessment |
| --- | --- |
| Blast radius | Test-harness only (2 e2e global-setups + 1 test-util helper + config comments). No product code, no version mutation. |
| Reversibility | Trivial: `clearStorage:false -> true` in both files + remove the 2 helper calls. |
| Measured local win | Within-run cross-project cache reuse -- the ng-cli yarn 93.4s -> 53.5s drop and a persistently-warm proxy cache. NO additional cross-run (C->W) speedup (the cache is fully warm after one run). |
| CI win | Real; the `clearStorage:false` flip gives in-job reuse now, and the deferred `actions/cache` follow-up adds cross-run persistence (expected larger + cleaner on Linux). |
| Honesty | The classic two-run cold/warm delta is ~null BY DESIGN (run C is already warm-within-itself); the win is real but banked inside a single run, best evidenced vs the w87 wipe-per-project baseline (flagship ng-cli yarn line) after subtracting the ~27% cross-session environmental drift. |

**Recommendation:** ship this flip; open the `actions/cache` CI extension as a
separate follow-up PR (Part d).
