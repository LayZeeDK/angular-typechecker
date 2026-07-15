# Quick Task 260713-w87: e2e install-time MEASUREMENTS

**Measured:** 2026-07-13 (single instrumented run, Windows arm64 dev box)
**Branch:** gsd/v0.2.1-angular-cli-workspace-support (main checkout, no worktree)
**Scope:** MEASURE + REPORT only. NO optimization was applied. Applying a lever is
the named follow-up (see Findings).

## What + how

Instrumentation = RESEARCH Option A: the single shared install seam
`sh()` (`libs/test-util/src/lib/e2e-process.ts`) appends one JSONL timing record
(`{ ts, cmd, cwd, ms, ok }`) per call, gated on `ATC_TIME_INSTALLS=1`. Every e2e
install routes through `sh()` (`npm install`, `pnpm install`, `corepack yarn install`,
`npx nx add`, `npx ng add`, and their `corepack yarn` variants), so a nested install
performed by `nx add` / `ng add` is captured inside the parent `sh()` elapsed. The
flag is a true no-op when unset (proven by `e2e-process.spec.ts`), so the committed
instrumentation costs the normal e2e gate nothing.

The tier was run ONCE, instrumented, at the CI-representative shape:

```
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/e2e-install-timings.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache
```

`--skip-nx-cache` is required (a cache hit would run no installs -> empty JSONL). All
4 e2e projects passed (exit 0). No re-run of `ng-cli-e2e` was needed -- the known
local-registry "already invoked by a parent Nx process" flake did not occur this run.
No isolation invariant was perturbed: install commands unchanged, 127.0.0.1 loopback,
SAFETY gate, `parallelism:false` on install-e2e/cache-e2e, `--parallel=2`,
`NX_INVOCATION_ROOT_PID` clearing, and `enableMirror:false` are all untouched, and no
`package.json` version was mutated.

One install bypasses the `sh()` seam by design: matrix-e2e's `pnpm-symlink` spec runs
`pnpm add <tgz>` through a direct `execSync` (its catch needs `status`/`signal`
discrimination `sh()` does not preserve). It was measured in a supplementary
`nx e2e angular-typechecker-matrix-e2e` pass via a temporary, reverted local timing
wrapper (details under Coverage confirmation); the shipped spec is unchanged.

The aggregator `tools/e2e-timing/aggregate-install-timings.mjs` reads the JSONL,
derives PM (ordered rule: `corepack yarn` / `yarn` FIRST -> yarn, so the heaviest
`corepack yarn install` is never misfiled as `corepack`/`other`; then pnpm; then npm;
else PM from the cwd basename for ambient `nx add` / `ng add` / bare-tarball installs),
action, and scenario, and emits the tables below.

## Environment + CAVEAT (read before trusting absolutes)

- **Windows arm64 dev box.** Defender real-time scanning inflates `node_modules`
  write time by multiples; `execSync` wall-clock also includes `cmd.exe` + `corepack`
  shim spawn overhead (yarn/pnpm are corepack-fetched) -- a fixed per-invocation tax,
  larger on Windows. The CI e2e gate is **Linux-only**, where these absolutes shrink.
- **A single run**, not a median-of-3. Treat every absolute ms as **directional**.
  The valid signals are (a) the RELATIVE per-PM / per-scenario / per-action breakdown
  and (b) the natural cold-vs-warm delta visible WITHIN this run (see Findings).
- **JSONL is append-atomic across `--parallel=2` workers.** Each `sh()` writes the
  record + trailing newline in ONE `appendFileSync` call, so concurrent projects do
  not interleave a half-written line. 46/46 lines parsed cleanly (0 skipped).
- **Verdaccio uplink cache is cold at each project's registry start** (`clearStorage:
  true` -> `rmSync(storage)`), so first fetches re-download the Angular/Nx/TS/Storybook
  toolchain from npmjs. Within a single registry lifetime, a later install of an
  already-pinned package can hit Verdaccio's now-warm cache -- so per-line absolutes
  mix fully-cold and partially-warm fetches (another reason to read them as
  directional).

## Measured tables

Source: `tmp/e2e-install-timings.jsonl` (gitignored raw data, NOT committed), 46
records, all parseable. 45 came from the single instrumented tier run via the
committed `sh()` timing; the 1 `atc-pnpm | pnpm add <tgz>` record came from a
supplementary `nx e2e angular-typechecker-matrix-e2e` pass (see "What + how").

### Install timing by PM x scenario x action

| PM | scenario | action | count | total ms | mean ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| yarn | atc-ng-yarn-flat | corepack yarn install | 1 | 93427 | 93427 | 93427 |
| npm | atc-sb-a | storybook install | 1 | 58517 | 58517 | 58517 |
| npm | atc-sb-a | npm install | 1 | 55055 | 55055 | 55055 |
| yarn | atc-ng-yarn-workspace | corepack yarn install | 1 | 43801 | 43801 | 43801 |
| npm | atc-sb-comp | npm install | 1 | 41994 | 41994 | 41994 |
| npm | atc-add-npm | npm install | 1 | 41394 | 41394 | 41394 |
| npm | atc-verdaccio-consumer | npm install | 1 | 40228 | 40228 | 40228 |
| npm | atc-ng-cli | npm install | 1 | 38827 | 38827 | 38827 |
| pnpm | atc-add-pnpm | nx add | 1 | 36888 | 36888 | 36888 |
| npm | atc-sb-b | npm install | 1 | 36450 | 36450 | 36450 |
| npm | atc-ng-cli | ng add | 1 | 36103 | 36103 | 36103 |
| npm | atc-sb-b | storybook install | 1 | 32432 | 32432 | 32432 |
| npm | atc-sb-comp | storybook install | 1 | 30959 | 30959 | 30959 |
| npm | atc-matrix | npm install <tgz> | 1 | 24513 | 24513 | 24513 |
| npm | angular-typechecker | other | 2 | 24037 | 12019 | 13384 |
| yarn | atc-ng-yarn-flat | ng add | 1 | 22848 | 22848 | 22848 |
| npm | atc-gen | npm install <tgz> | 1 | 20897 | 20897 | 20897 |
| pnpm | atc-ng-pnpm | ng add | 1 | 18569 | 18569 | 18569 |
| yarn | atc-add-yarn | nx add | 1 | 17219 | 17219 | 17219 |
| npm | atc-smoke | npm install <tgz> | 1 | 17112 | 17112 | 17112 |
| npm | atc-add | npm install <tgz> | 1 | 15807 | 15807 | 15807 |
| yarn | atc-add-yarn | corepack yarn install | 1 | 15090 | 15090 | 15090 |
| yarn | atc-ng-yarn-workspace | ng add | 1 | 14288 | 14288 | 14288 |
| npm | atc-sb-a | nx add | 1 | 14123 | 14123 | 14123 |
| npm | atc-add-npm | nx add | 1 | 12534 | 12534 | 12534 |
| npm | atc-sb-comp | nx add | 1 | 12316 | 12316 | 12316 |
| npm | atc-sb-b | nx add | 1 | 11795 | 11795 | 11795 |
| pnpm | atc-ng-pnpm | pnpm install | 1 | 9794 | 9794 | 9794 |
| npm | atc-verdaccio-consumer | other | 2 | 9361 | 4681 | 6115 |
| pnpm | atc-add-pnpm | pnpm install | 1 | 8632 | 8632 | 8632 |
| pnpm | atc-pnpm | pnpm add <tgz> | 1 | 7166 | 7166 | 7166 |
| npm | atc-gen | other | 1 | 6630 | 6630 | 6630 |
| npm | atc-add | other | 1 | 4933 | 4933 | 4933 |
| npm | atc-sb-b | other | 1 | 4340 | 4340 | 4340 |
| npm | atc-sb-a | other | 1 | 3280 | 3280 | 3280 |
| pnpm | angular-typechecker | other | 2 | 2452 | 1226 | 1799 |
| yarn | angular-typechecker | other | 2 | 1241 | 621 | 717 |
| pnpm | atc-add-pnpm | other | 1 | 899 | 899 | 899 |
| pnpm | atc-ng-pnpm | other | 1 | 726 | 726 | 726 |
| yarn | atc-ng-yarn-flat | other | 1 | 409 | 409 | 409 |
| yarn | atc-ng-yarn-workspace | other | 1 | 283 | 283 | 283 |
| yarn | atc-add-yarn | other | 1 | 262 | 262 | 262 |

`other` = non-install `sh()` calls (version probes `pnpm --version` /
`corepack yarn --version`, `corepack enable`, `nx g configuration` / `nx g init`
wiring, and the global-setup `nx release publish`). Included for transparency; NOT
install cost. They sum to well under 10% of the grand total.

### Per-PM totals

| PM | count | total ms |
| --- | --- | --- |
| npm | 26 | 593637 |
| yarn | 11 | 208868 |
| pnpm | 9 | 85126 |

Grand total: 46 `sh()`-style calls, 887631 ms.

**Per-PM totals are NOT a fair PM-vs-PM race.** Each PM runs a different NUMBER of
scenarios: npm carries the whole install-e2e suite (Storybook x3, nx-add, verdaccio-
consumer, smoke, generator) + the matrix npm tarball + the ng-cli npm spec; yarn runs
only its nx-add + ng-cli specs; pnpm runs its nx-add + ng-cli specs + the matrix
pnpm-symlink tarball. npm's larger total reflects more scenarios,
not a slower PM. The valid comparison is per-scenario/per-action, and the invariant
truth is that every row is a cold npmjs re-fetch through Verdaccio.

### Coverage confirmation

- **All 3 package managers present:** npm, pnpm, yarn. (Verify: PM presence asserted
  over tolerantly-parsed lines.)
- **All install-performing e2e projects present:**
  - install-e2e -> `atc-add-npm`, `atc-add-pnpm`, `atc-add-yarn`, `atc-add`, `atc-gen`,
    `atc-smoke`, `atc-sb-a`, `atc-sb-b`, `atc-sb-comp`, `atc-verdaccio-consumer`.
  - matrix-e2e -> `atc-matrix` (npm install `<tgz>`) AND `atc-pnpm`
    (`pnpm add <tgz>`, the pnpm-symlink spec).
  - ng-cli-e2e -> `atc-ng-cli` (npm), `atc-ng-pnpm` (pnpm), `atc-ng-yarn-flat` +
    `atc-ng-yarn-workspace` (yarn).
- **cache-e2e is correctly ABSENT** -- it performs zero installs by design (consumes
  the source barrel via `nxViteTsPaths`), so it is not an install-cost contributor.
- **The `atc-pnpm` install bypasses the committed `sh()` seam by design** -- matrix-e2e's
  `pnpm-symlink` spec installs via a DIRECT `execSync` because its catch block needs
  `status`/`signal` discrimination for the escalate-class ERESOLVE triage, which
  `sh()`'s plain-Error rethrow does not preserve (converting it to `sh()` would lose
  that diagnostic). To measure it without changing the shipped spec, the `pnpm add`
  install was wrapped with the SAME timing record shape in a temporary local edit, the
  matrix-e2e project was re-run standalone (which starts Verdaccio via its global-setup,
  so the install ran in the same cold-uplink context), the `atc-pnpm` record was
  appended to the JSONL, and the spec edit was REVERTED (git-clean; no committed
  change). The supplementary pass also re-measured `atc-matrix` npm install `<tgz>` at
  20677 ms vs the tier run's 24513 ms -- directionally consistent.

## Findings: hotspots -> ranked levers

**Measured hotspots (directional absolutes):**

1. **Full-toolchain first installs dominate.** The single heaviest line is
   `corepack yarn install` of the Angular 22 app+lib ng-cli fixture on the FLAT layout
   (93.4s) -- a cold npmjs fetch of the entire Angular/CLI/ng-packagr/vitest/jsdom
   toolchain plus one-time corepack yarn provisioning. The Storybook specs are the
   heaviest npm scenarios: `atc-sb-a` alone spends 55.1s (`npm install`) + 58.5s
   (`storybook install`) + 14.1s (`nx add`) = ~128s.
2. **`nx add` / `ng add` carry real nested-install cost** (12-37s each) -- exactly the
   cost Option A captures inside the parent `sh()` that a standalone harness would miss.
3. **A clean in-run cold-vs-warm signal:** the SAME ng-cli fixture under the SAME PM
   installs in **93.4s (flat, first) vs 43.8s (workspace, second)** -- a ~50s drop once
   Verdaccio's uplink had cached the pinned toolchain earlier in the same registry
   lifetime. That ~2.1x is a lower bound on the win from a persistently-warm cache.

**Mapping to the RESEARCH ranked levers (`260713-w87-RESEARCH.md`):**

- **TOP FOLLOW-UP = Lever 1: persist the Verdaccio uplink cache.** Set
  `clearStorage:false` and, in each registry global-setup, delete ONLY
  `storage/angular-typechecker/` + reset `.htpasswd` before publish (so the gate still
  tests the freshly-built plugin dist, and the SAFETY / 127.0.0.1 / yarn-cache
  invariants stay intact). **Expected impact: HIGH** -- re-run install NETWORK cost
  drops to ~0 once the uplink is warm; npmjs is hit once per pinned version instead of
  once-per-run-per-PM. The measured in-run 93.4s -> 43.8s delta (identical fixture) is
  a concrete floor for that win; a persistent cache generalizes it to every re-run and
  every PM. Verify with the RESEARCH cold-vs-warm two-run experiment (flip
  `clearStorage` locally, throwaway) plus the existing tarball-audit spec proving the
  plugin dist is still published fresh.
- **Lever 2: `actions/cache` the Verdaccio storage on CI** (the CI-facing extension of
  Lever 1; only meaningful together with it). **Expected impact: HIGH on CI** -- turns
  the per-run npmjs re-fetch into a cache restore. Scope the cached path to EXCLUDE
  `storage/angular-typechecker/` + `.htpasswd`, and key on the ng-cli fixture lockfile
  + pinned tool versions (`YARN_VERSION`, pnpm `11.x`, `@storybook/angular` pin) so any
  dependency bump busts it.
- **Levers 3-4 (pnpm persistent store; npm `--no-audit --no-fund --prefer-offline`)**
  are second-order polish that only bite once Lever 1/2 make the cache warm.
- **Lever 5 (yarn cache/mirror reuse) is a TRAP -- do NOT pursue.** `enableMirror:
  false` is load-bearing (stale-0.2.0-mirror bug) and yarn's metadata cache is
  host-keyed (poisoning landmine, quick task 260712-squ). yarn's win comes FREE from a
  warm Verdaccio (Lever 1): the 93.4s -> 43.8s in-run drop above is exactly that,
  achieved with `enableMirror:false` untouched.

**Honest ceiling.** Install bytes are irreducible on the FIRST fetch -- the real
Angular 22 + Nx 23 + TS 6 + Storybook tarballs must cross the wire at least once, and
no flag makes a cold full-toolchain install fast. The ONLY genuinely reducible cost is
re-fetching those same bytes once-per-run-per-PM; caching/proxy reuse (Levers 1+2)
removes exactly that and nothing more. Everything measured above is a cold or
partially-warm fetch of that same irreducible byte set. A deeper follow-up measurement
(the RESEARCH cold-vs-warm two-run experiment) can quantify the ceiling precisely; it
was NOT run here.

## No optimization applied

This task measured and reported only. No lever was applied; no `clearStorage` flip was
left in place; no install command, isolation invariant, or `package.json` version was
changed. The committed artifacts are ONLY the opt-in `sh()` timing (test-util, not
shipped) + the `tools/e2e-timing/` aggregator + the no-op unit test. Applying Lever 1
(persist the Verdaccio uplink cache) is the recommended follow-up.
