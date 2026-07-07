# OSS verification-target candidates: Nx + Angular + Storybook (all layouts + stretch)

Researched 2026-07-06 via three parallel `gh search` / `gh api` sweeps (Layout A, Layout B,
Layout C + stretch formats). Purpose: pick real GitHub repos to use as LOCAL (uncommitted)
post-phase verification targets for the shipped `angular-typechecker` tarball, across ALL
officially supported layouts (A per-project, B centralized host) plus the stretch surface
(Layout C flat, `.mdx`/`.tsx`). Supersedes the layout-A-only `OSS-EXAMPLES.md` (2026-07-05).

Method: `gh search repos` (keyword/topic) + `gh search code` (unreliable for small/recent repos,
used as supplement) + per-repo `gh api .../contents/*` reads of `package.json` +
`tsconfig*.json` + `.storybook/{main,tsconfig}` + `git/trees?recursive=1` for story-extension
enumeration. No clones, no installs (static analysis). Versions quoted verbatim from each repo's
root `package.json`.

License note: these are LOCAL verification clones (not vendored, not committed, not
redistributed), so GPL/NOASSERTION/no-license repos are acceptable targets -- verify only before
ever copying code into this repo.

## Headline finding (the exact-stack availability matrix)

Angular 22 + Nx 23 repos DO exist and are findable, but the exact stack x layout matrix is nearly
empty -- the only exact-stack + target-layout hit is `radix-ng/primitives` (Layout B):

| Layout | Exact Angular 22 + Nx 23 | Nx 22 + Angular 22 (stretch) | Best available |
|---|---|---|---|
| A (per-project scaffold, `references[]` -> `.storybook/tsconfig.json`) | **EMPTY** | **EMPTY** | `cuentoneta/cuentoneta` (Nx 23.0.1 exact, Ng 21) |
| B (centralized host aggregating cross-project sources) | **`radix-ng/primitives`** | **EMPTY** | `radix-ng/primitives` (exact stack, MIT, as-is) |
| C (flat root tsconfig, no `references[]`) | **EMPTY** (all exact-stack repos are solution-tsconfig) | **EMPTY** | `bitwarden/clients` (Ng 21, flat, off-stack) |

The Nx 22 + Angular 22 quadrant is empty in EVERY layout (Angular 22 is ~1 month old; those repos
jumped straight to Nx 23-beta). Flat Layout C is a rare deliberate pattern and has NO exact-stack
example -- every Ng22/Nx23 workspace uses `tsconfig.base.json` + per-project solution tsconfigs.

## Layout A candidates (ranked)

1. **`cuentoneta/cuentoneta`** (BEST true Layout A) -- https://github.com/cuentoneta/cuentoneta
   (branch `develop`), 30 stars, active (pushed 2026-07-06). `nx`/`@nx/angular` **23.0.1 (exact Nx)**,
   `@angular/core`/`compiler-cli` **21.2.16**, `@angular/cli` 21.2.18, `typescript` ~5.9.3,
   `storybook`/`@storybook/angular` **10.4.6 (STOCK)**. pnpm@10.12.1, ~118 MB, LICENSE=NOASSERTION.
   - Layout A EVIDENCE: root `tsconfig.json` `references: [tsconfig.app.json, tsconfig.spec.json,
     tsconfig.editor.json, ./.storybook/tsconfig.json]`; `.storybook/tsconfig.json` extends
     `../tsconfig.json`, includes `../src/**/*.stories.@(ts|js|jsx|tsx|mdx)`. Stock `@storybook/angular`.
   - ~25 real `.stories.ts` (no `.tsx`/`.mdx` present). Already ships a `tsconfig.typecheck.json`.
   - SUITABILITY: needs minor upgrade (Ng 21->22 + TS 5.9->6.0) to satisfy our peers for an ON-STACK
     proof; or install off-stack via `--legacy-peer-deps` as an Ng-21 indicator. pnpm -> known
     `nx add` `ERR_PNPM_IGNORED_BUILDS` workaround applies. Beats the prior known repos (zeckaissue
     Ng19, brandonroberts Ng20).
2. **`ZenSoftware/zen`** -- 218 stars, maintained full-stack starter. Nx 21.4.1 / Ng 20.2 / TS 5.9 /
   SB 9.1, multi-lib per-project Layout A (`libs/*/tsconfig.json` references incl. `.storybook`),
   stock `@storybook/angular`, ~64 MB. Fallback if a multi-lib Layout A example is wanted.
3. **`tolak-dev/nx-angular-storybook`** -- Nx 21.3 / Ng 20.1 / TS 5.8 / SB 9.0, clean stock Layout A,
   npm, ~1.8 MB, ~6 `.stories.ts`. Tiny easy fixture (demo repo, no stars/license).
4. **`KenTandrian/storybook-angular-styles-bug`** -- Nx 21.3 / Ng 20.1 / TS 5.8 / SB 9.0, tiniest
   clean stock Layout A (~390 KB, npm), only 1 story.
- Prior known (now superseded by cuentoneta): `zeckaissue/nx-angular19-storybook-example` (Ng 19),
  `brandonroberts/angular-nx-storybook-scss` (Ng 20, Analog executor).

## Layout B candidates (ranked)

1. **`radix-ng/primitives`** (BEST -- exact stack, true Layout B) -- https://github.com/radix-ng/primitives
   264 stars, MIT, pnpm, active. `nx`/`@nx/angular`/`@nx/storybook` **23.1.0-beta.1**,
   `@angular/core`/`cli`/`compiler-cli` **22.0.2**, `typescript` **6.0.3**, `storybook` 10.4.6,
   framework **`@analogjs/storybook-angular` 10.4.6** (Vite; builder-only, irrelevant to the ngc check).
   - Layout B EVIDENCE: host `apps/radix-storybook/.storybook/tsconfig.json` `include` reaches OUTSIDE
     the host and pulls real cross-project sources: `../../../packages/primitives/**/*.stories.ts`,
     `**/*.directive.ts`, `**/*.component.ts`, `**/src/**/*.ts`. `main.ts` globs
     `../../../packages/primitives/**/*.stories.ts`. Aggregates ~50+ component/directive folders.
   - Story format: `.stories.ts` + `.docs.mdx`. External `templateUrl`: NOT present (radix primitives
     are largely headless directives / inline templates) -> does NOT exercise the T3 external-template
     NG8002 "kill shot".
   - SUITABILITY: usable AS-IS (peers match us EXACTLY: TS 6.0.3, Ng 22.0.2; Nx 23.1.0-beta satisfies
     devkit's peer). Caveats: pnpm -> `ERR_PNPM_IGNORED_BUILDS` workaround; Vite framework is
     builder-only. This is the primary exact-stack real-repo proof for Layout B.
2. **`geonetwork/geonetwork-ui`** (best external-`templateUrl` coverage) -- 80 stars, GPL-2.0, large,
   active. Nx 22.0.4 / Ng 20.3.19 / TS 5.9.3 / SB 9.1 (stock, webpack). Host `apps/demo`
   `.storybook/tsconfig.json` `include: ["../../**/*", "../../../libs/**/*"]` pulls ALL libs source
   (every `*.component.ts`), `main.ts` globs `../../../libs/**/*.stories.*`, `strictTemplates: true`,
   real `templateUrl` components. Off-stack (Ng 20/Nx 22) but the STRONGEST aggregation + the only
   Layout B target that can exercise the external-template kill shot on a real repo.
3. **`marcospss/ecommerce-nx`** -- Nx **23.0.1 (stable, exact)** / Ng 21.2 / TS 5.9 / SB 10 (stock,
   Vite), no license. Layout A today (`.storybook` glob/include LOCAL-only) but LITERALLY one glob +
   include widening from Layout B. The only stable-Nx-23 base -> ideal hand-converted Layout B fixture.
4. **`stijn-dejongh/spec-kitty-design`** -- Nx 22.7.1 / Ng 21.2.11 / TS / SB 10.3.6 (stock), MIT,
   fresh (2026-06-29). Host `apps/storybook` aggregates `../../../packages/**/*.stories.@(ts|tsx)`.
   Cleanest MIT Layout B one stack-step back.
- Also exact stack but NOT Layout B: `blackbaud/skyux` (Nx 23.1.0-beta.2 / Ng 22.0.1 / TS 6.0.3 /
  STOCK `@storybook/angular` 10.4.6) -- uses Storybook Composition (`refs`), not tsconfig aggregation.
  Excellent exact-stack + stock-executor version target; wrong aggregation mechanism for Layout B.

## Layout C candidates (flat, no `references[]`) -- stretch

1. **`bitwarden/clients`** (best clean Layout C) -- Nx 22.6.5 / Ng 21.2.17 / TS 5.9.3 / SB 10.3.6
   (stock), GPL-3.0, ~1.28 GB, ~9k stars. Root `tsconfig.json` extends `tsconfig.base.json`, broad
   `include` of `apps/*/src/**/*` + `libs/*/src/**/*`, **NO `references[]` anywhere**. `*.spec.ts`
   EXCLUDED (delegated to the test runner); **135 `.stories.ts`** NOT excluded -> land in the flat
   program; 81 plain `.mdx` docs. SUITABILITY: point our target at the flat root tsconfig -> the
   DIRECT path checks its rootNames incl. the 135 stories; a planted story error FAILs; no-silent-pass
   guard holds. Off-stack (Ng 21) so informational only (board D5).
2. **`Alfresco/alfresco-ng2-components`** -- Nx 22.7.4 / Ng 20.3.25 / TS 5.9.3 / SB 10.4, Apache-2.0,
   ~548 MB, 304 stars, active. Degenerate-flat root `tsconfig.json`: root `compilerOptions`, NO
   `include` (tsc defaults to all `.ts`), NO `references[]`; sweeps specs too (messier than a clean
   Layout C). Lighter + more permissive than bitwarden, one Ng version further off. Secondary target.
- No exact-stack (Ng22/Nx23) flat Layout C repo exists.

## Stretch-format candidates (`.mdx` / `.tsx`)

- **Plain `.mdx` (for the shipped "not type-checked" advisory):** best target **`radix-ng/primitives`**
  (exact stack, MIT, ~17 MB, 84 `.mdx`); also `analogjs/analog` (Nx 23.0.1 / Ng 22, 10 `.mdx`);
  `bitwarden/clients` (81 `.mdx`, off-stack). Overlaps the Layout B winner -> one target covers both.
- **`.stories.mdx`: NO real candidate.** It is Storybook-6 legacy, REMOVED in Storybook 7+. Every
  current Angular repo (SB 8-10) uses plain `.mdx` docs instead. Only stale ancient bitwarden forks
  still contain `.stories.mdx`. -> Verify FIXTURE-ONLY.
- **`.stories.tsx`: NO real candidate.** No Angular + `@storybook/angular` repo authors stories in
  TSX; `jsx` is unset in every real Angular tsconfig inspected (radix-ng, skyux, analog). -> The
  `.tsx`-gated-on-`jsx` path can only be exercised by a planted synthetic fixture that sets `jsx`.

## Recommended verification target set (local clones, informational per board D5)

| Layout / surface | Target | Stack | How | Exercises |
|---|---|---|---|---|
| B (primary, on-stack) | `radix-ng/primitives` | Ng 22.0.2 / Nx 23.1.0-beta / TS 6.0.3 | AS-IS (pnpm workaround) | aggregated cross-project story + component FAIL/clean; `.mdx` advisory |
| B (kill-shot) | `geonetwork/geonetwork-ui` | Ng 20.3 / Nx 22.0.4 (off-stack) | as-is `--legacy-peer-deps` | external-`templateUrl` NG8002 (T3) on a real repo |
| A (on-stack) | `cuentoneta/cuentoneta` | Nx 23.0.1 exact; Ng 21->**22** upgrade | upgrade Ng21->22 + TS->6 | per-project scaffold story FAIL/clean on stack |
| C (guard, stretch) | `bitwarden/clients` | Ng 21 / Nx 22.6 (off-stack) | as-is `--legacy-peer-deps` | flat direct-path checks stories; no-silent-pass guard |
| stretch `.mdx` | `radix-ng/primitives` | exact | (covered by the B run) | "N .mdx not type-checked" advisory |
| stretch `.stories.tsx`/`.stories.mdx` | (none exist) | -- | synthetic fixture | fixture-only |

## Near-hits log (one axis off; forward-compat indicators)

- Exact-stack solution-tsconfig (Layout A/B), stock or Analog: `radix-ng/primitives` (Ng22/Nx23-beta,
  Layout B), `blackbaud/skyux` (Ng22/Nx23-beta, Composition), `analogjs/analog` (Ng22/Nx23.0.1),
  `mushilu-san/Mushilu-San-UI` (Ng 22.0.5 / Nx 23.0.1 / TS 6 / STOCK `@storybook/angular`, but the
  Angular-CLI `projects/` "extends tsconfig.lib.json, no `references[]`" shape -- a distinct
  non-A/B/C layout worth capturing), `marcospss/ecommerce-nx` (stable Nx 23.0.1 / Ng 21, Layout A->B
  convertible), `ghostfolio/ghostfolio` (Ng 21 / Nx 23.0.1).
- Non-Nx exact stack (rejected -- our executor needs Nx): `recon-research/caelum` (Ng 22 / TS 6),
  `Aam-Digital/ndb-core` (Ng 21 / TS 5.9), `BIRU-Scop/tenzu-front`, `keycloakify/keycloakify-angular`.
- Layout B one stack-step back: `ethlete-io/ethdk` (Ng 20.3 / Nx 21.6, MIT, active),
  `Stutter-Journal/Stutter-Journal` (Ng 21 / Nx 22.3, Apache-2.0, literal `storybook-host`).
