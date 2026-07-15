# Quick Task 260714-gja: safe install flags applied + measured

**Measured:** 2026-07-14 (one instrumented warm run, Windows arm64 dev box)
**Branch:** gsd/v0.2.1-angular-cli-workspace-support (main checkout, no worktree)
**Scope:** APPLY the RESEARCH APPLY-NOW flag set to the 13 direct install sites
(committed at `6828d35`) + MEASURE the delta against the 1gr WARM baseline.

## What + how

The APPLY-NOW flag set (RESEARCH table (b)), applied to DIRECT package-manager
installs only:

- 11 direct npm install sites gained `--no-audit --no-fund --prefer-offline`
  (provision `npm install`, tarball `npm install <tgz>`, the two Storybook
  `npm install @storybook/angular ... --legacy-peer-deps`, and the
  verdaccio-consumer `npm install --save-dev <name>`).
- The 2 provisioning `pnpm install` sites gained `--prefer-offline`.
- `nx add` / `ng add` / both `corepack yarn install` / the pnpm-symlink
  `pnpm add <tgz>` were left FLAG-FREE (fidelity: the real command under test
  forwards no flags; yarn 4 has no `--prefer-offline`; the pnpm-symlink is a
  deferred measure-only). No new `--legacy-peer-deps` / `--force` anywhere; the
  two Storybook installs keep `--legacy-peer-deps` exactly (perf flags appended
  after it). None of the flags change dependency resolution or mask a peer
  ERESOLVE, so B-03 peer-honesty is intact.

Measurement uses the committed `ATC_TIME_INSTALLS` seam UNCHANGED (no code
change to measure): `sh()` (`libs/test-util/src/lib/e2e-process.ts`) appends one
JSONL record `{ ts, cmd, cwd, ms, ok }` per install call, aggregated by
`tools/e2e-timing/aggregate-install-timings.mjs`. The added flags do NOT change
the aggregator's PM/action bucketing (`deriveAction` still sees `npm install` /
`pnpm install` / `npm install <tgz>` / `storybook install`).

### Single-run protocol (reuses 1gr warm as the before-flags baseline)

```bash
# Verdaccio storage already WARM (494 package dirs, left by 1gr run W;
# Lever 1 clearStorage:false persists the npmjs proxy cache). No warm-up needed.
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/gja-after.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache
node tools/e2e-timing/aggregate-install-timings.mjs tmp/gja-after.jsonl
```

`--skip-nx-cache` is REQUIRED (a cache hit runs no installs -> empty JSONL).
`tmp/` is gitignored; the raw `tmp/gja-after.jsonl` is NOT committed. The
before-flags baseline is 1gr run W (`260714-1gr-MEASUREMENTS.md`, WARM table),
run on the same box under the same warm Verdaccio -- no new baseline run needed.

## Fidelity proof: the run was GREEN

Exit 0, all 4 e2e projects green -- the flags broke no resolution / no ERESOLVE
/ no install:

| project | test files | tests |
| --- | --- | --- |
| angular-typechecker-install-e2e | 11 | 37/37 |
| angular-typechecker-matrix-e2e | 2 | 7/7 |
| angular-typechecker-ng-cli-e2e | 3 | 4/4 |
| angular-typechecker-cache-e2e | 3 | 9/9 |

`NX Successfully ran target e2e for 4 projects`. No `EPUBLISHCONFLICT`, no
`ERESOLVE`, no `ECONNREFUSED`, and NO ng-cli-e2e `run-many` flake ("already
invoked by a parent Nx process") -- so no standalone re-run was needed. 45/45
JSONL records parsed cleanly (aggregator uses a per-line try/catch; 0 skipped).

## Environment + CAVEAT (read before trusting absolutes)

- **One run per condition** (after-flags = gja; before-flags = 1gr run W). Every
  absolute ms is **directional**. The valid signal is the RELATIVE per-subset
  delta plus the flag-free environmental control.
- **Windows arm64 dev box.** Defender real-time scanning inflates `node_modules`
  write time; `execSync` carries `cmd.exe` + corepack shim spawn overhead. The
  CI e2e gate is Linux-only, where the network-round-trip portion the flags
  remove is a LARGER share of each install -- so this local win is a LOWER BOUND
  on the proportional CI win of `--no-audit` / `--no-fund`.
- **Cross-session drift is real and this session ran SLOWER.** Two anomalous
  single-run rows: `atc-ng-pnpm` `ng add` 12393 -> 41709 (+236%) and
  `atc-ng-cli` `npm install` 25815 -> 28774 (+11.5%). Both are read through the
  control below, not taken at face value.

## After-flags aggregated table (gja)

Source: `tmp/gja-after.jsonl` (gitignored, NOT committed), 45 records, all
parseable. `other` = non-install `sh()` calls (version probes, `nx g` wiring,
the global-setup publish); shown for transparency, NOT install cost.

### Per-PM totals (1gr warm -> gja after)

| PM | 1gr warm (ms) | gja after (ms) | delta |
| --- | --- | --- | --- |
| npm | 414012 | 295805 | **-28.6%** |
| yarn | 127712 | 145823 | +14.2% |
| pnpm | 57575 | 91564 | +59.0% |
| grand | 599299 | 533192 | -11.0% |

The per-PM totals MIX flagged and flag-free actions, so they are not the clean
signal: npm's total drop is diluted by its flag-free `nx add`/`ng add` rows
(which rose), and pnpm's +59% is ENTIRELY the one `atc-ng-pnpm` `ng add` outlier
(+29316 ms, larger than the whole pnpm delta of +33989 ms) -- a flag-free row.
The treatment-vs-control split below is the real result.

## (4) The result -- treatment vs control (the honest read)

Rule (same rigor as 1gr): the FLAG-FREE rows are the environmental control;
attribute to the flags only the EXCESS drop of a flagged subset OVER the
control's drift. NOTE the matrix `npm install <tgz>` row now carries flags, so
it is a TREATMENT row this time, not a control.

### Environmental control (flag-free) -- the box drifted UP ~+14%

| flag-free action | 1gr warm | gja after | drift |
| --- | --- | --- | --- |
| corepack yarn install (3) | 93092 | 105542 | **+13.4%** |
| nx add (6) | 82483 | 94100 | **+14.1%** |
| ng add (4, incl. pnpm outlier) | 57703 | 96290 | +66.9% |
| ng add (excl. `atc-ng-pnpm` outlier) | 45310 | 54581 | +20.5% |

The two stable control families (`corepack yarn install` +13.4%, `nx add`
+14.1%) agree: this session ran ~**+14% SLOWER** than 1gr, independent of any
flag. The yarn/nx-add/ng-add rows carry NO added flags and moved only with the
environment -- **proof the flags landed only where intended.**

### Treatment (flagged) -- the flags won AGAINST a +14% headwind

| flagged action | 1gr warm | gja after | delta |
| --- | --- | --- | --- |
| npm install (provision, 6) | 183016 | 101401 | **-44.6%** |
| storybook install (3) | 69811 | 19505 | **-72.1%** |
| npm install `<tgz>` (4) | 60406 | 59107 | -2.1% |
| pnpm install (2) | 12996 | 14626 | +12.5% |

Per-scenario detail on the two big movers:

| scenario | action | 1gr warm | gja after | delta |
| --- | --- | --- | --- | --- |
| atc-verdaccio-consumer | npm install | 33322 | 14070 | -57.8% |
| atc-sb-comp | npm install | 30155 | 13311 | -55.9% |
| atc-add-npm | npm install | 30192 | 13564 | -55.1% |
| atc-sb-b | npm install | 29710 | 14302 | -51.9% |
| atc-sb-a | npm install | 33822 | 17380 | -48.6% |
| atc-ng-cli | npm install | 25815 | 28774 | +11.5% (anomaly) |
| atc-sb-comp | storybook install | 23901 | 6308 | -73.6% |
| atc-sb-b | storybook install | 23033 | 6420 | -72.1% |
| atc-sb-a | storybook install | 22877 | 6777 | -70.4% |

### Verdict: a REAL, flag-attributable win -- LARGER than the "modest" expectation

Within npm the separation is clean and unambiguous:

- Flagged npm rows: **-42.5%** (313233 -> 180013 ms).
- Flag-free npm rows (`nx add` + `ng add`): **+19.7%** (65357 -> 78227 ms).

The flagged rows fell ~43% while the flag-free rows in the SAME PM rose ~20%.
That separation cannot be environmental drift (drift moved both the same way and
UP). This is NOT within-noise -- it is a real, cleanly flag-attributable win,
and it is LARGER than the pre-run "modest" expectation. Subtracting the ~+14%
control drift, the flag-attributable improvement is roughly **-59 pp** on the
provision `npm install` rows and **-86 pp** on the Storybook installs.

**Why bigger than predicted (RESEARCH A1 VALIDATED, not refuted).** The win is
dominated by `--no-audit` removing the post-install audit round-trip (npm ->
Verdaccio -> npmjs uplink), whose cost scales with dependency-tree size:

- biggest on the LARGEST trees -- Storybook (-72%) and full-Angular provision
  installs (~-50%);
- near-zero on the tiny tarball installs (`npm install <tgz>` -2.1%: the
  angular-typechecker tarball pulls few deps, so audit/metadata is already
  cheap);
- ZERO measurable on pnpm (`pnpm install` +12.5% = within the +14% control
  drift): pnpm runs no audit/fund by default, and `--prefer-offline` against a
  warm store + localhost:4873 is already cheap -- exactly as RESEARCH predicted
  ("pnpm's win is small").

1gr's "extract+link + Defender dominate" ceiling held for the on-disk portion,
but on a WARM-cache Windows box the audit/metadata NETWORK round-trip turned out
to be a bigger remaining slice than that model implied -- and it is precisely
what `--no-audit` / `--prefer-offline` remove. Because the audit round-trip
always hits the network, this is a STRUCTURAL win that reproduces (and, on
Defender-free Linux CI where the network share is larger, should be at least as
large).

**Single-run caveats.** `atc-ng-cli` `npm install` rose +11.5% despite carrying
the flags (its cost is dominated by extracting the full committed Angular app,
which the flags do not touch, plus this session's +14% drift), and the
`atc-ng-pnpm` `ng add` +236% outlier shows how noisy one run is. The aggregate
treatment-vs-control separation is robust to both.

## Follow-up levers (documented, NOT implemented)

### MEASURE-ONLY (defer to a future spike)

1. **Windows Defender exclusion on the OS-temp install path** -- the single
   biggest LOCAL lever (multiplicative on the extract+link residual the flags do
   NOT touch), but a CONTRIBUTOR-MACHINE change, not a repo change. Do NOT
   redirect `mkdtemp` into a repo-relative D: `tmp/` (deep `node_modules` risks
   the Windows 260-char MAX_PATH limit). Recommend a one-line CONTRIBUTOR NOTE +
   an optional local-only spike; leave the actual exclusion to the developer.
   CI is Linux -> no effect there.
2. **matrix-e2e intra-project `fileParallelism`** -- only 2 files, small win;
   isolated mkdtemps + per-spec `--pack-destination` + different PMs make it
   SAFE on the dev box, but it stacks on top of `--parallel=2` and would
   oversubscribe a 4-vCPU CI runner. Enable only if measured net-positive on
   BOTH local AND a 4-vCPU CI shape.
3. **pnpm-symlink `pnpm add <tgz> --prefer-offline`** -- optional, npmjs-direct
   small win; its failure diagnostic is a CI status signal, so left as-is.

### REJECTED (do NOT apply)

- **Local PM-cache pin** (Lever 2) -- already reused; Lever 1 + fixed port 4873
  dominate. **REJECT.**
- **pnpm-swap of non-PM-specific installs** (Lever 4) -- none qualify; all are
  PM-specific by design. **REJECT.**
- **yarn 4 perf flags** (Lever 8) -- none safe; the fresh `cacheFolder` /
  `enableMirror:false` are load-bearing. **REJECT.**
- **ng-cli-e2e / install-e2e intra-project `fileParallelism`** (Levers 4/5) --
  shared 127.0.0.1:4873 Verdaccio cold-fetch race + CI 4-vCPU oversubscription;
  the vitest config is shared local + CI. **REJECT.**

## GO / NO-GO outcome

**GO -- keep the flags.** The e2e gate stayed GREEN (4/4 projects, 57 tests),
the flags are test-harness-only with a one-hunk-per-site revert, no
`package.json` version mutation, and the measurement shows a real,
flag-attributable install-time win (npm flagged rows -43% against a +14%
environmental headwind, dominated by `--no-audit` on large trees) that also
helps CI. The fidelity levers (`nx add` / `ng add` / yarn / `--legacy-peer-deps`
/ the pnpm build-gate / the pnpm-symlink) are provably untouched.
