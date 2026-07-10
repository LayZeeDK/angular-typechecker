# Plan 20-05 Summary: Gate B -- real-OSS tarball verification (radix-ng/primitives)

**Plan:** 20-05
**Status:** COMPLETE
**Requirement:** SB-09 (Gate B, D-10)
**Verified:** 2026-07-07 (run autonomously at explicit user instruction; D-10's human-only default was overridden by the user)

## What was verified

The locally-packed dist tarball of the SB-09 build (`angular-typechecker-0.1.1.tgz`, built from the
`gsd/v0.1.2-storybook-story-type-checking` branch -- ships compiled `.js` incl.
`src/core/detect-bundler-query-imports.js`, verified before install) was exercised against a REAL
`radix-ng/primitives` checkout (Angular 22.0.2 / `@analogjs/storybook-angular` 2.6.1 /
`@storybook/angular` 10.4.6 / `vite` 8.0.16) -- the proven `?query` repo from spike 009.

A `typecheck` target (`angular-typechecker:typecheck`, `tsConfig: apps/radix-storybook/tsconfig.json`)
was wired on `radix-storybook` and run via `nx typecheck radix-storybook --skip-nx-cache` (NX_DAEMON=false).

## Results (all three legs PASS)

| Leg | Expectation | Observed |
|-----|-------------|----------|
| **Baseline** (no `vite/client`) | run FAILs; `?query` TS2307 reported (not suppressed); advisory fires | **226** `?query` TS2307 flagged by the `bundlerQueryImports` advisory (names `"types": ["vite/client"]` + the `declare module` fallback + "ADVISORY: the TS2307 are NOT suppressed" + all 226 specifiers). TS2307 total = 229. Run FAILed. |
| **Fix** (`"types": ["vite/client"]` on `.storybook/tsconfig.json`) | `?query` TS2307 -> 0; advisory silent (self-gated) | Advisory **ABSENT**. TS2307 dropped 229 -> **2**. The 2 survivors are genuine plain-missing modules (`react` in `manager.tsx`, generated `../documentation.json` in `compodoc.ts`) -- no `?`, so the wildcard correctly does NOT resolve them; run still FAILs on them. |
| **No-false-pass probe** (planted `import probe from './definitely-not-here-gateb'` in a checked file, `vite/client` present) | still errors TS2307; NOT flagged as a bundler-query | **TS2307 fired** on the planted plain-missing import; advisory stayed ABSENT (no `?` -> not a bundler-query). Probe file removed after. |

## Charter confirmation (never a silent false pass -- on a real repo)

- `?query` TS2307 are REPORTED and the run FAILs on them; they are NEVER auto-suppressed.
- Adding `vite/client` self-gates the advisory (226 -> 0) WITHOUT masking any plain missing module: the 2
  pre-existing plain-missing TS2307 survive, and a freshly planted plain-missing import still errors.
- The wildcard blind spot documented in Signal 1 holds exactly: it resolves `*?query` specifiers only.

## Deviations

- **226 vs spike 009's 227:** benign repo drift (radix added/removed a story since the spike). No behavioral difference.
- **Install method:** `pnpm add` failed with `ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF` (checkout's
  node_modules was created with pnpm 11; this environment has pnpm 9.15.7). Worked around by overlaying the
  built package files onto the resolved pnpm store path for angular-typechecker (node/nx resolution follows
  the symlinks; the pnpm-CLI store check does not affect `nx typecheck`). Faithful to the tarball's shipped
  `.js`; only the install mechanism differed from a clean `pnpm add`.

## Cleanup

- Reverted the throwaway edits (`.storybook/tsconfig.json` `vite/client`, `radix-storybook` `typecheck` target);
  removed the extract dir, run logs, and the copied tarball. The radix checkout was NOT committed.
- Nothing merged, released, tagged, or approved (D-11 / never-approve-deployments): merge of PR #27 and the
  v0.1.2 cut/publish remain human-gated.

## Self-Check: PASSED

Both user-added phase-end gates are now met: **Gate A** (PR #27, all required CI green) and **Gate B**
(this real-OSS radix-ng verification).
