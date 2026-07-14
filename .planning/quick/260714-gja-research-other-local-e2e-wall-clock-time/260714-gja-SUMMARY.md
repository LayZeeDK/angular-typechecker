---
task: 260714-gja
title: Apply safe LOCAL e2e install-perf flags + measure
date: 2026-07-14
branch: gsd/v0.2.1-angular-cli-workspace-support
status: complete
commit: 6828d35
---

# Quick Task 260714-gja: apply safe install flags + measure -- Summary

Applied the RESEARCH APPLY-NOW install-perf flag set to the 13 direct
package-manager install sites in the e2e tier (test-harness only), then measured
the delta against the 1gr warm baseline: a real, cleanly flag-attributable
install-time win driven by `--no-audit`, larger than the pre-run "modest"
expectation, with the e2e gate staying GREEN 4/4.

## What was done

### Task 1 -- apply the flags (committed `6828d35`)

- 11 direct npm install sites gained `--no-audit --no-fund --prefer-offline`
  (provision `npm install`, tarball `npm install <tgz>`, both Storybook
  `npm install @storybook/angular ... --legacy-peer-deps`, verdaccio-consumer
  `npm install --save-dev <name>`).
- 2 provisioning `pnpm install` sites gained `--prefer-offline`.
- Left FLAG-FREE (fidelity): both `corepack yarn install`, all `nx add`/`ng add`,
  the pnpm-symlink `pnpm add <tgz>`. No new `--legacy-peer-deps`/`--force`; the
  two Storybook installs keep `--legacy-peer-deps` exactly (flags appended after).
- 11 spec files changed, 80 insertions / 38 deletions (deletions are line-level
  re-wraps, no file deletions). No `package.json` version mutation.

### Task 2 -- measure (report: `260714-gja-MEASUREMENTS.md`, uncommitted raw JSONL)

One instrumented warm `--parallel=2` run via the committed `ATC_TIME_INSTALLS`
seam (no code change to measure), aggregated and diffed against 1gr run W.

## Verification (all honest results)

### T1 fast gate -- GREEN

- Guards: `--no-audit`=11, `--no-fund`=11, `--prefer-offline`=13; all 11
  `corepack yarn` lines flag-free; both Storybook installs still carry
  `--legacy-peer-deps` (exact order preserved); `git diff` on
  `packages/angular-typechecker/package.json` EMPTY (no version mutation). The
  three checker hardenings were applied: Storybook check THROWS on mismatch, a
  `--no-fund`==11 count guard was added, and the package.json-diff check is an
  automated throw-if-non-empty assertion.
- `nx format:check` GREEN on all 11 touched files (three tarball sites were
  Prettier-canonicalized with `format:write`).
- `nx typecheck` GREEN on all 3 touched e2e projects. (`lint` is a no-op: the
  e2e projects have no `lint` target, and the edits are lint-neutral -- only
  appended CLI-flag strings.)

### T2 fidelity + measurement -- GREEN

- Full `--parallel=2` run exited 0, 4/4 projects: install-e2e 37/37, matrix-e2e
  7/7, ng-cli-e2e 4/4, cache-e2e 9/9. No `EPUBLISHCONFLICT`/`ERESOLVE`/
  `ECONNREFUSED`; NO ng-cli-e2e `run-many` flake (no standalone re-run needed).
  45/45 JSONL records parsed.
- Aggregation produced a valid table (`Grand total: 45 sh() calls, 533192 ms`).

## Measurement headline (after-flags vs 1gr warm)

- **npm: real win.** Flagged npm rows -42.5% (313233 -> 180013 ms) while the
  SAME-PM flag-free rows (`nx add`+`ng add`) ROSE +19.7% -- a clean separation
  that drift cannot explain. Provision `npm install` -44.6%, Storybook install
  -72.1%, tarball `npm install <tgz>` -2.1%.
- **Environmental control:** flag-free `corepack yarn install` +13.4% and
  `nx add` +14.1% agree the box ran ~+14% SLOWER this session -- so the flagged
  drop is understated, and the yarn/nx-add/ng-add rows moving only with the
  environment PROVES the flags landed only where intended.
- **pnpm: within-noise / no measurable win** (`pnpm install` +12.5% = inside the
  +14% drift) -- as RESEARCH predicted (pnpm runs no audit/fund).
- **Driver:** `--no-audit` removing the audit round-trip (npm -> Verdaccio ->
  npmjs uplink), cost scaling with tree size -- biggest on Storybook + full
  Angular provision installs, near-zero on tiny tarball installs. RESEARCH
  assumption A1 VALIDATED. Single-run caveats: `atc-ng-cli` npm install +11.5%
  and `atc-ng-pnpm` ng-add +236% are single-run anomalies; absolutes directional.

## Deviations

- **[Rule 3 - blocking] Prettier canonicalization.** My initial multi-line
  edits to the three `npm install <tgz>` sites (generator-e2e, install-smoke,
  nx-add-e2e) were not Prettier-conformant (Prettier does not break inside a
  template-literal `${}`). Fixed with `nx format:write` scoped to those 3 files
  only. No behavior change.
- **Out-of-scope pre-existing:** `nx format:check` (unscoped) also flags branch
  fixtures (`ng-cli-workspace/*`, `angular-cli-wiring.spec.ts`) that I did NOT
  touch -- pre-existing branch state relative to `main`, out of scope; verified
  they are absent from my working-tree diff. Scoped `format:check --files` on my
  11 files is GREEN.

## Follow-ups documented (NOT implemented)

MEASURE-ONLY: Windows Defender OS-temp exclusion (contributor-machine, not a
repo change); matrix-e2e `fileParallelism` (only if net-positive local AND
4-vCPU CI); pnpm-symlink `--prefer-offline`. REJECTED: local PM-cache pin,
pnpm-swap, yarn perf flags, ng-cli/install-e2e intra-project fileParallelism.

## Fidelity invariants confirmed

`nx add`/`ng add`/`corepack yarn install`/pnpm-symlink untouched; Storybook
`--legacy-peer-deps` intact; no new `--legacy-peer-deps`/`--force`; no
`package.json` version mutation; no product/source change (test-harness only,
one-hunk-per-site revert); measure-only + rejected levers documented, not
implemented.

## Self-Check: PASSED

- `260714-gja-MEASUREMENTS.md` exists (written).
- `260714-gja-SUMMARY.md` exists (this file).
- Commit `6828d35` exists (`git log`): `test(e2e): add safe npm/pnpm install
  perf flags to direct install sites`, 11 files.
- `tmp/gja-after.jsonl` (45 records, gitignored) produced from the GREEN run.
