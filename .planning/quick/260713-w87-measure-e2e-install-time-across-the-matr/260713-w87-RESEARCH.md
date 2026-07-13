# Quick Task 260713-w87: Measure e2e install time across the PM matrix + optimization research

**Researched:** 2026-07-13
**Domain:** Nx 23 @nx/js Verdaccio e2e install cost (npm / pnpm / yarn 4) + measurement instrumentation
**Confidence:** HIGH for mechanism (first-party source + repo reads); MEDIUM for wall-clock magnitudes (machine-dependent, unmeasured today)
**Scope:** This task MEASURES + RESEARCHES. It recommends but does NOT apply an optimization. A follow-up task applies the chosen lever.

## Summary

Every e2e install routes through the shared `sh()` helper
(`libs/test-util/src/lib/e2e-process.ts:112`) and every install ultimately fetches its
third-party bytes (Angular 22 + Nx 23 + TS 6 + Storybook) from **npmjs via Verdaccio's
`npmjs` uplink proxy** (`.verdaccio/config.yml`: `**` -> `proxy: npmjs`, `cache: true` by
default). Verdaccio's uplink cache would normally persist those tarballs to
`tmp/local-registry/storage` and serve every subsequent install from local disk -- but the
gate starts Verdaccio with `clearStorage: true`, which `@nx/js`'s executor implements as an
`rmSync(storage, {recursive})` of the WHOLE storage folder before each run
(`node_modules/@nx/js/dist/src/executors/verdaccio/verdaccio.impl.js:31-32`). So the proxy
cache is **cold on every run**: each run re-downloads the entire Angular toolchain from
npmjs, once per package-manager, into fresh tmp workspaces. That cold re-fetch is the
dominant, and the only genuinely *reducible*, cost. The real bytes are irreducible on the
first fetch; the win is not re-fetching them.

**Recommended measurement:** Option A -- instrument `sh()` behind an `ATC_TIME_INSTALLS=1`
env flag to append `{cmd, cwd, ms, ts}` JSONL, run the tier once, aggregate. It is the
smallest change (one shared file), captures 100% of installs including the nested installs
inside `nx add` / `ng add`, and the cold-vs-warm delta is measured by a two-run experiment
that temporarily flips `clearStorage` -- no separate harness needed.

**Top optimization lever:** persist Verdaccio's uplink cache across runs (Lever 1), backed
by `actions/cache` on CI (Lever 2). Everything else is marginal once Verdaccio is warm, or
blocked by the yarn host-cache / `enableMirror:false` landmines.

## (a) Install workload table

| e2e project | PM(s) | What installs (per spec) | Fresh tmp workspace? | Where the bytes come from |
|---|---|---|---|---|
| **install-e2e** | npm (+corepack yarn, pnpm 11 in nx-add-*) | `nx add angular-typechecker` (-> nested `npm/pnpm/yarn add` of the plugin + `nx`), `npm install <tgz>`, `npm install @storybook/angular --legacy-peer-deps` (heaviest) | YES (mkdtemp per spec) | angular-typechecker from local Verdaccio (no-proxy block); ALL else npmjs via uplink (cold each run) |
| **ng-cli-e2e** | npm, pnpm 11, yarn 4 (corepack) | Full committed Angular 22 app+lib fixture (`npm/pnpm/corepack yarn install`, 9203-line lock) + `ng add` (nested install) | YES (cpSync fixture -> mkdtemp) | fixture deps (Angular/CLI/ng-packagr/vitest/jsdom) all npmjs via uplink (cold each run); plugin from Verdaccio |
| **matrix-e2e** | npm, pnpm 11 | `npm install <tgz>` / `pnpm add <tgz>` into 5 project-type workspaces | YES | small workspaces; plugin from Verdaccio, deps npmjs via uplink |
| **cache-e2e** | none | No install (uses source barrel via nxViteTsPaths) | N/A | N/A -- not an install-cost contributor |

Heaviest single install: the ng-cli fixture (full Angular 22 app + library toolchain) x3
package managers, plus install-e2e's Storybook `--legacy-peer-deps` install. Under
`--parallel=2`, install-e2e and cache-e2e run alone (`parallelism:false`); ng-cli-e2e and
matrix-e2e may overlap (both may install concurrently -- relevant to shared-cache safety).

## (b) Recommended measurement methodology

**Chosen: Option A -- instrument the `sh()` seam (opt-in), one tier run, aggregate.**

Why A over B: `sh()` is the single choke point EVERY install routes through
(`npm install`, `pnpm install`, `corepack yarn install`, `nx add`, `ng add` are all
`sh(...)` calls; only `npm pack` and `ng run`/`nx run` use `execSync` directly, and those
are not installs). A nested install performed by `nx add`/`ng add` is a child process of the
parent `sh()` call, so its cost is captured inside the parent's elapsed -- Option B's
standalone harness would miss exactly that nested-install overhead and the real Verdaccio
cold-cache context. B buys nothing A doesn't, so skip it. (ponytail: one seam, one flag, one
run.)

**Instrumentation (follow-up implements; ~12 lines, additive, default-off):**
- Wrap the `execSync` in `sh()`: `const t = performance.now()` before, and in BOTH the
  success and catch paths append one JSONL line when `process.env.ATC_TIME_INSTALLS === '1'`:
  `{ ts, cmd: command, cwd: options.cwd, ms: Math.round(performance.now() - t), ok }`.
- Output path: `process.env.ATC_TIMING_OUT ?? join(tmpdir(), 'atc-install-timings.jsonl')`.
  `tmp/` is already gitignored -- do NOT commit raw timing data; the follow-up copies only
  the aggregated summary into its report.
- Append-mode (`appendFileSync`) so concurrent projects under `--parallel=2` don't clobber
  (single-line appends are atomic on both Linux and Windows for small writes; the `ts` field
  makes overlap visible in aggregation).

**Tagging dimensions (derived post-hoc, no per-call-site edits):**
- **PM x action** from the normalized `cmd` string (`npm install` / `pnpm install` /
  `corepack yarn install` / `nx add` / `ng add` / `npm install <tgz>` / storybook).
- **Project / scenario** from the `cwd` tmp-dir prefix (specs name them
  `atc-ng-yarn-flat-*`, etc.) -- enough to attribute without widening the `sh()` signature.
- **cold vs warm** from which of the two experiment runs produced the line.

**Cold-vs-warm experiment (the key optimization measurement, no permanent change):**
1. Run 1 (cold): tier as-is (`clearStorage:true`), `ATC_TIME_INSTALLS=1`.
2. Locally flip `clearStorage:false` in both registry global-setups (throwaway), run the
   tier once to warm `tmp/local-registry/storage`, then run it AGAIN and record.
3. Diff install ms cold vs warm -> the concrete ceiling of Lever 1. Revert the flip.

**Run environment:** `NX_DAEMON=false npx nx run-many -t e2e --parallel=2` (the CI shape).
For gate-representative absolutes, measure on **Linux/WSL2**, not the Windows arm64 dev box.

**Windows arm64 timing caveats:**
- Defender real-time scanning inflates `node_modules` write time by multiples -- exclude the
  tmp/workspace path or measure on Linux/WSL2 (the CI e2e gate is Linux-only anyway).
- `execSync` wall-clock includes `cmd.exe` + `corepack` shim spawn overhead (yarn/pnpm are
  corepack-fetched) -- a fixed per-invocation tax, larger on Windows.
- High variance: take the **median of 3** runs; treat dev-box numbers as directional only.

## (c) Ranked optimization levers

| # | Lever | Expected impact | Risk | Violates an isolation invariant? | How verified |
|---|---|---|---|---|---|
| **1** | **Persist Verdaccio uplink cache**: `clearStorage:false` + manually delete ONLY `storage/angular-typechecker/` + reset `.htpasswd` before publish | **HIGH** (re-run cost drops to ~0 network; npmjs hit once per pinned version). Local dev + repeated CI. | MEDIUM | NO -- if the angular-typechecker dir is deleted every run (else stale dist = broken gate). SAFETY gate / 127.0.0.1 pin / yarn cache untouched. | Cold-vs-warm two-run experiment (b); assert install-e2e still publishes fresh dist (existing tarball-audit spec) |
| **2** | **`actions/cache` the Verdaccio storage on CI**, keyed on fixture lockfile + pinned tool versions; restore before e2e (pairs with Lever 1) | **HIGH on CI** (turns per-run npmjs re-fetch into a cache restore) | MEDIUM | NO -- cache path MUST exclude `storage/angular-typechecker/` + `.htpasswd`; key must bust on any pinned-dep change | CI wall-clock delta on 2 consecutive runs (miss then hit); confirm gate still green |
| **3** | **pnpm persistent store** (`--store-dir`/`PNPM_STORE_PATH` outside tmp; `actions/cache` on CI) | MEDIUM (pnpm specs only; hardlink vs copy) | LOW | NO -- pnpm store is concurrency-safe under `--parallel=2`; keyed by integrity, registry-host-agnostic | Re-measure pnpm install ms warm vs cold store |
| **4** | **npm install flags**: `--no-audit --no-fund --no-progress --prefer-offline` on the npm installs (and consider `npm ci` for the lockfile-exact fixture provisioning) | LOW-MEDIUM (skips audit round-trip + log overhead; `--prefer-offline` compounds Lever 1/2) | LOW | NO | Re-measure npm install ms; `--prefer-offline` only bites when cache is warm |
| **5** | **yarn cache reuse** (global cache / mirror) | LOW, and **NOT SAFE HERE** | HIGH | **YES** -- `enableMirror:false` is load-bearing (stale-0.2.0-mirror bug) and yarn's metadata cache is host-keyed (poisoning landmine, 260712-squ Deviation 1) | Do not pursue -- yarn wins come free from a warm Verdaccio (Lever 1) |
| **6** | Reduce redundant installs (drop Storybook / skip nested add installs) | -- | -- | Loses coverage fidelity (out of scope) | N/A -- rejected |

**Notes on Lever 1 mechanics (verified constraint):** Verdaccio's maintainer states cached
vs published packages **cannot** live in separate storage dirs -- "the original project
design always assumed there is only one storage"
([Discussion #4519](https://github.com/orgs/verdaccio/discussions/4519)). So a per-package
`storage:` split is out; the only viable shape is single storage + `clearStorage:false` +
targeted deletion of the `angular-typechecker` package dir and `.htpasswd` in each
global-setup before publish. The uplink `cache:true` default already persists third-party
tarballs to that same folder ([Verdaccio caching docs](https://www.verdaccio.org/docs/caching/)),
and the docs explicitly name the CI use case ("CI tools clear the cache after each build ...
a waste of bandwidth ... use Verdaccio for caching tarballs and metadata ... give a boost to
your build time"). `publish.allow_offline:true` is already set, which helps the cache serve
when the uplink hiccups.

**Honesty check:** installs are largely irreducible -- real Angular/Storybook bytes must be
fetched at least once. There is no flag that makes a cold full-toolchain install fast. The
only real win is **caching/proxy reuse** so the fetch happens once, not once-per-run-per-PM.
Levers 1+2 deliver exactly that; 3-4 are second-order polish; 5 is a trap.

## (d) Recommended levers for the follow-up

1. **Lever 1 (persist Verdaccio uplink cache)** -- highest ROI, immediate local-dev win, no
   isolation-invariant violation provided the `angular-typechecker` package dir + `.htpasswd`
   are deleted every run (so the gate always tests the freshly-built dist). This is the
   single change worth making first.
2. **Lever 2 (`actions/cache` the storage on CI)** -- the CI-facing extension of Lever 1;
   only meaningful together with it. Scope the cached path to exclude the plugin's own
   package dir and `.htpasswd`, and key on the fixture lockfile + pinned tool versions
   (`YARN_VERSION`, pnpm `11.9.0`, `@storybook/angular` pin) so a dependency bump invalidates
   it.

Do **not** pursue yarn cache reuse (Lever 5) -- it reintroduces the host-keyed-cache and
stale-mirror landmines this repo already paid to fix.

## Sources

### Primary (HIGH -- first-party source / repo reads)
- `node_modules/@nx/js/dist/src/executors/verdaccio/verdaccio.impl.js:29-32` -- `clear` does
  `rmSync(storage, {recursive, force})` on the whole storage folder. `[VERIFIED]`
- `.verdaccio/config.yml` -- `npmjs` uplink (`maxage:60m`), `**` -> `proxy:npmjs`,
  `angular-typechecker` no-proxy block, `publish.allow_offline:true`; storage
  `../tmp/local-registry/storage`. `[VERIFIED]`
- `e2e/*/src/global-setup.ts` -- `startLocalRegistry({ clearStorage:true, ... })`;
  127.0.0.1 SAFETY publish gate; real-token mint; provenance strip. `[VERIFIED]`
- `libs/test-util/src/lib/e2e-process.ts:112` -- `sh()`, the single install seam. `[VERIFIED]`
- e2e specs (`ng-add-ng-run-yarn.e2e.spec.ts`, nx-add-{npm,pnpm,yarn}, matrix-*, storybook-*)
  -- exact install commands; yarn `enableMirror:false` + per-fixture cache rationale. `[VERIFIED]`
- `e2e/.../fixtures/ng-cli-workspace/package.json` + 9203-line `package-lock.json` -- full
  Angular 22 app+lib workload. `[VERIFIED]`
- `.github/workflows/ci.yml` -- e2e job uses `setup-node` `cache:npm` (npm only; no pnpm/yarn
  cache); `--parallel=2`; fresh `npm ci` per job. `[VERIFIED]`
- `260712-squ-SUMMARY.md` / `260712-squ-RESEARCH.md` -- `--parallel=2` isolation invariants;
  yarn host-keyed-cache landmine (Deviation 1). `[VERIFIED]`

### Secondary (MEDIUM -- web, cross-checked against config behavior)
- [Verdaccio Caching strategies](https://www.verdaccio.org/docs/caching/) -- `cache:true`
  default persists metadata + tarballs; CI cache-reuse use case; `maxage` tuning.
- [Verdaccio Discussion #4519](https://github.com/orgs/verdaccio/discussions/4519) -- single
  storage design; cached vs published cannot be split by directory.
- [Verdaccio #1259](https://github.com/verdaccio/verdaccio/issues/1259) /
  [#256](https://github.com/verdaccio/verdaccio/issues/256) -- proxy-cache behavior + offline
  relay caveat (`allow_offline`).

### Tertiary (LOW -- training knowledge, standard tooling)
- npm flag semantics (`--no-audit`/`--no-fund`/`--prefer-offline`/`npm ci`), pnpm
  content-addressable store, yarn 4 cache model -- `[ASSUMED]` standard tool behavior; verify
  the exact ms delta by re-measurement (that is the point of the instrumentation).

## Metadata
- Confidence: mechanism HIGH (source-verified); wall-clock magnitudes UNMEASURED (the
  deliverable is the methodology to obtain them).
- Research date: 2026-07-13. Valid until: ~30 days (stable Nx 23 / Verdaccio 6 line).
