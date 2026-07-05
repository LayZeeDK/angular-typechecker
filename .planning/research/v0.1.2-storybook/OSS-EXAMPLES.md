# OSS examples: Nx + Angular + Storybook (`*.stories.ts` tsconfig wiring)

Researched 2026-07-05 via `gh search code` / `gh search repos` / `gh api`. Goal: find real
repos that show how `*.stories.ts` files are (or are not) wired into a project's tsconfig
`references[]`, to inform the v0.1.2 milestone that adds Storybook story type-checking to
`angular-typechecker`.

## Availability verdict

**True Nx 23 + Angular 22 + Storybook 8/9 repos do not exist yet** (both Nx 23 and Angular 22
are very recent; `gh search code`/`gh search repos` for the exact combo returned nothing).
Closest available, newest-first:

1. `bitwarden/clients` -- Nx 22.6.5 / Angular 21.2.17 / Storybook 10.3.6 -- closest version
   match, but architecturally incompatible (flat tsconfig, no `references[]` at all).
2. `zeckaissue/nx-angular19-storybook-example` -- Nx 22.3.3 / Angular 19 / Storybook 9 --
   stock `@nx/angular` + `@storybook/angular` generator output, correct `references[]` wiring.
3. `brandonroberts/angular-nx-storybook-scss` -- Nx 22.0.3 / Angular 20.3.0 / Storybook
   9.1.16 -- newest Angular version of the three, correct `references[]` wiring, but uses the
   community `@analogjs/storybook-angular` executor instead of stock `@storybook/angular`.

`gh search code` for `"@nx/angular:storybook-configuration"` and for generic
`"@storybook/angular" "@nx/angular"` in `package.json` returned **zero results** -- GitHub
code search does not reliably index small/recent repos, so absence there is not proof of
non-existence; the working leads instead came from `gh search repos` (repo names/topics) and
from following a real `*.stories.ts` code-search hit (`isaccanedo/clients`, a fork) back to
its upstream (`bitwarden/clients`).

## Summary table

| Repo | Stars | Last updated | Nx | Angular | Storybook | TypeScript | Has stories? | Stories-tsconfig in `references[]`? | Clone path | Fixture suitability |
|---|---|---|---|---|---|---|---|---|---|---|
| `bitwarden/clients` | 13,181 | 2026-07-03 | 22.6.5 | 21.2.17 | 10.3.6 (`@storybook/angular`) | 5.9.3 | Yes, 76 in `libs/components` alone (+ 8 more libs/apps globbed in `.storybook/main.ts`) | **No** -- repo has no `references[]` anywhere; single flat root `tsconfig.json` covers everything | `D:/projects/github/bitwarden/clients` (sparse: `libs/components`, `.storybook`) | **No** -- 1.28 GB repo, GPL-3.0, no TS project-references architecture at all; would require rearchitecting tsconfigs, not just upgrading versions |
| `zeckaissue/nx-angular19-storybook-example` | 0 | 2025-12-23 | 22.3.3 | 19 | 9 (`@storybook/angular` + `@nx/storybook:build`) | ~5.9.2 | Yes, `apps/sb-host/src/app/basic.stories.ts` | **Yes** -- `apps/sb-host/tsconfig.json` `references` includes `./.storybook/tsconfig.json` | `D:/projects/github/zeckaissue/nx-angular19-storybook-example` | Needs upgrade -- small single-app workspace (212 KB), stock executors, but Angular 19 / Nx 22.3 / TS 5.9 all below the plugin's peer floor |
| `brandonroberts/angular-nx-storybook-scss` | 0 | 2025-11-14 | 22.0.3 | 20.3.0 | 9.1.16 (`@analogjs/storybook-angular` executor, `@storybook/angular` also installed) | ~5.9.2 | Yes, `app.stories.ts` + `nx-welcome.stories.ts` | **Yes** -- `apps/my-app/tsconfig.json` `references` includes `./.storybook/tsconfig.json` | `D:/projects/github/brandonroberts/angular-nx-storybook-scss` | Needs upgrade -- small single-app workspace (220 KB), newest Angular of the three, but uses the Analog wrapper executor (tsconfig shape is identical to stock, so this doesn't block use as a reference) |

## Per-repo detail

### 1. `bitwarden/clients` (real-world large monorepo -- version-closest, architecture-incompatible)

Versions (from root `package.json`): `nx: 22.6.5`, `@nx/devkit`/`@nx/eslint`/`@nx/jest`/`@nx/js`/`@nx/webpack`: `22.6.5`, `@angular/core: 21.2.17`, `@angular/cli: 21.2.9`, `typescript: 5.9.3`, `storybook: 10.3.6`, `@storybook/angular: 10.3.6`.

Cloned with a blobless, sparse checkout (`git clone --depth 1 --filter=blob:none --no-checkout`, then `git sparse-checkout set libs/components .storybook`) because the full repo is 1.28 GB -- too large to fetch or use as an install-and-run fixture.

Key tsconfig facts:
- Root `tsconfig.json` (`D:/projects/github/bitwarden/clients/tsconfig.json`): extends `tsconfig.base.json`, and is a **flat include/exclude tsconfig**, not a solution file:
  ```json
  {
    "extends": "./tsconfig.base.json",
    "include": ["apps/browser/src/**/*", ..., "libs/*/src/**/*", ...],
    "exclude": ["apps/browser/src/**/*.spec.ts", ..., "libs/*/src/**/*.spec.ts", "**/*.spec-util.ts"]
  }
  ```
  There is **no `references` field anywhere in the repo** (verified in `tsconfig.json`, `tsconfig.base.json`, and every `libs/components/tsconfig*.json`). `.stories.ts` files are not excluded from this root include, so they are picked up by the flat root tsconfig -- but there is no per-project "solution tsconfig -> leaf tsconfigs" graph for `angular-typechecker` to walk.
- `libs/components/tsconfig.json`: `{"extends": "../../tsconfig.base"}` -- also flat, no references.
- `libs/components/tsconfig.app.json`: extends the above, explicitly `"exclude": ["**/*.stories.*"]`.
- `libs/components/tsconfig.spec.json`: extends the above, only covers `test.setup.ts`.
- `.storybook/tsconfig.json` (workspace-root-level, not per-project): extends the workspace-root flat `../tsconfig` (i.e. the same flat root file), adds `moduleResolution: bundler`, excludes spec files, and lists explicit `files` (`preview.tsx`, `libs/components/src/main.ts`, `libs/components/src/polyfills.ts`) -- it does not itself `include` a `*.stories.ts` glob; it inherits the root's broad include.
- `libs/components/project.json` exists (so `@bitwarden/components` is a real Nx project), but its `build` target is `nx:run-script` (delegates to an npm script), not a `tsc`/Angular-compiler executor with a `tsConfig` pointer -- the Angular build for `components` is driven separately by `angular.json` (`libs/components/tsconfig.app.json`).
- `.storybook/main.ts` globs 10 different libs/apps for stories (`auth`, `dirt/card`, `pricing`, `subscription`, `tools/send/send-ui`, `vault`, `components`, `web`, `browser`, `bit-web`, `angular`) -- all covered by the single flat root tsconfig, none via a references graph.

Fixture assessment: **not usable**, for two independent reasons: (1) 1.28 GB / GPL-3.0 production app, far too heavy for a packed-tarball install test; (2) more importantly, its tsconfig architecture is fundamentally different from what `angular-typechecker` expects (a solution tsconfig with `references[]` to leaf tsconfigs) -- there is nothing to "wire the stories tsconfig into," because there is no references graph at all. This repo is best used as a **real-world counterexample**: proof that "flat include/exclude tsconfig, no `references[]`" is a live pattern in large Nx/Angular codebases that `angular-typechecker` currently cannot support (its executor only resolves `references[]` from the solution tsconfig).

### 2. `zeckaissue/nx-angular19-storybook-example` (stock generator output, correct wiring)

Versions (`package.json`): `@nx/angular: ^22.3.3`, `@nx/devkit`/`@nx/storybook`/`@nx/web`/`@nx/workspace`: `22.3.3`, `nx: 22.3.3`, `@angular/core: 19`, `@angular/cli: 19`, `typescript: ~5.9.2`, `storybook: 9`, `@storybook/angular: 9`. Package manager: pnpm (`pnpm-lock.yaml`/`pnpm-workspace.yaml` present). Single-app workspace: `apps/sb-host` only, no `libs/`.

Key tsconfig facts -- `apps/sb-host/tsconfig.json` (the project's solution tsconfig):
```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.editor.json" },
    { "path": "./tsconfig.app.json" },
    { "path": "./.storybook/tsconfig.json" }
  ]
}
```
`apps/sb-host/.storybook/tsconfig.json`:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": { "emitDecoratorMetadata": true },
  "exclude": ["../**/*.spec.ts"],
  "include": [
    "../src/**/*.stories.ts", "../src/**/*.stories.js",
    "../src/**/*.stories.jsx", "../src/**/*.stories.tsx", "../src/**/*.stories.mdx",
    "*.js", "*.ts"
  ]
}
```
`apps/sb-host/tsconfig.app.json` explicitly excludes `**/*.stories.ts` / `.js` (so the app build target never compiles stories). The repo-root `tsconfig.json` is a legacy flat file (predates the per-project `references[]` convention; used for editor/ts-node config, not a solution file with its own `references[]`) -- the *project-level* tsconfig (`apps/sb-host/tsconfig.json`) is the actual solution file Nx/the Angular compiler operate on, and **that one correctly lists `.storybook/tsconfig.json` in `references[]`**.

Target wiring (`apps/sb-host/project.json`): `storybook` uses the stock `@storybook/angular:start-storybook` executor (`configDir: apps/sb-host/.storybook`, `browserTarget: sb-host:build`); `build-storybook` uses the stock `@nx/storybook:build` executor. No separate type-check step exists for the storybook tsconfig -- it is only compiled implicitly by Storybook's own webpack/babel pipeline, never by a standalone `tsc --noEmit`.

Fixture assessment: **needs upgrade, otherwise structurally ideal**. It is small (212 KB, single app project, minimal deps: just `@angular/*` core + Tailwind, no extra libs), so bumping `@angular/*` 19 -> 22, `@nx/*`/`nx` 22.3.3 -> 23.x, and `typescript` ~5.9.2 -> `>=6.0.0 <6.1.0` is a tractable, self-contained upgrade (likely `nx migrate` + `ng update` + fixing any v20/v21/v22 breaking changes) rather than a rearchitecture. Once upgraded, this is a clean fixture: install the packed `angular-typechecker` tarball, point `nx typecheck` at `sb-host`, and confirm the executor discovers `.storybook/tsconfig.json` via `references[]` and reports NG8xxx/type errors from a deliberately-broken `.stories.ts`.

### 3. `brandonroberts/angular-nx-storybook-scss` (newest Angular version, same wiring pattern, non-stock executor)

Versions (`package.json`): `@nx/angular`/`@nx/eslint`/`@nx/js`/`@nx/storybook`/`@nx/vite`/`@nx/web`/`@nx/workspace`: `22.0.3`, `nx: 22.0.3`, `@angular/core: ~20.3.0`, `@angular/cli: ~20.3.0`, `typescript: ~5.9.2`, `storybook: 9.1.16`, `@storybook/angular: 9.1.16` (installed but not the configured executor -- see below). Package manager: npm. Single-app workspace: `apps/my-app` only.

Key tsconfig facts -- `apps/my-app/tsconfig.json` (the project's solution tsconfig):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "strict": true, ..., "module": "preserve" },
  "angularCompilerOptions": { "strictTemplates": true, ... },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" },
    { "path": "./.storybook/tsconfig.json" }
  ]
}
```
`apps/my-app/.storybook/tsconfig.json` is byte-for-byte the same shape as `zeckaissue`'s (extends `../tsconfig.json`, includes `../src/**/*.stories.{ts,js,jsx,tsx,mdx}`, excludes `../**/*.spec.ts`). `apps/my-app/tsconfig.app.json` excludes `**/*.stories.ts`/`.js`.

Deviation from the stock scaffold: the `storybook`/`build-storybook` targets in `apps/my-app/project.json` use `@analogjs/storybook-angular:start-storybook` / `:build-storybook` (the AnalogJS community wrapper, Vite-based) instead of `@storybook/angular` + `@nx/storybook:build`. `@storybook/angular` is still a devDependency (likely a peer of `@analogjs/storybook-angular` or left over from scaffolding) but is not the executor actually wired into `project.json`. This does not affect the tsconfig-wiring lesson -- `angular-typechecker` only cares about the `references[]` graph, which is identical to the stock pattern -- but it does mean this repo cannot demonstrate the *stock* `@storybook/angular` build/serve path end-to-end.

Also notable in `nx.json`'s `namedInputs.production`: an explicit exclusion list scrubs `**/*.stories.@(js|jsx|ts|tsx|mdx)`, `.storybook/**/*`, and `tsconfig.storybook.json` from cache inputs for production builds -- confirming that Nx itself treats the stories tsconfig as a first-class, separately-cacheable unit alongside `tsconfig.spec.json`.

Fixture assessment: **needs upgrade**, similar profile to `zeckaissue` (small, single-project, minimal deps) but starting one Angular major closer to the target (20.3 vs 22.0) and with a newer Storybook (9.1.16). Its non-stock storybook executor is a cosmetic wrinkle for a *type-checking* fixture, not a blocker, since `angular-typechecker` never invokes Storybook's own build pipeline.

## Recommendation

Use **`zeckaissue/nx-angular19-storybook-example`** and **`brandonroberts/angular-nx-storybook-scss`** together as the primary structural references for the milestone -- both independently confirm that the current `@nx/angular` + Storybook scaffold (regardless of pnpm/npm, or stock `@storybook/angular` vs `@analogjs/storybook-angular` executor) wires `.storybook/tsconfig.json` into the owning project's `tsconfig.json` `references[]`, sitting alongside `tsconfig.app.json`/`tsconfig.spec.json`/`tsconfig.editor.json`, with the app tsconfig explicitly excluding `*.stories.*`. That is the exact shape `angular-typechecker`'s existing `references[]` walk should already be able to discover once pointed at the project -- worth validating against directly, since it suggests the gap this milestone is closing may be narrower than "stories are never wired in."

Pick **`brandonroberts/angular-nx-storybook-scss`** as the actual e2e-fixture base (lightly upgraded to Angular 22 / Nx 23 / TypeScript 6.0.x): it is the newest/closest-to-target starting point (Angular 20.3 vs 19), tiny (220 KB, one app project), and its `.storybook/tsconfig.json` + parent `references[]` wiring is identical to the stock pattern, so the Analog executor deviation is irrelevant to a type-check-only fixture. Keep `zeckaissue/nx-angular19-storybook-example` as a secondary cross-check (stock `@storybook/angular` executor) to make sure the fixture's behavior isn't an artifact of the Analog wrapper.

Keep **`bitwarden/clients`** purely as documented context (this report), not as a fixture: it is the only real, actively-maintained, large-scale proof that the "flat tsconfig, no `references[]`" pattern exists in production Angular/Nx codebases, which matters if the milestone's scope needs to consider (or explicitly exclude) that architecture.

## Clone paths (local, not committed)

- `D:/projects/github/bitwarden/clients` -- sparse checkout (`libs/components`, `.storybook`, root config files only)
- `D:/projects/github/zeckaissue/nx-angular19-storybook-example` -- full shallow clone (212 KB)
- `D:/projects/github/brandonroberts/angular-nx-storybook-scss` -- full shallow clone (220 KB)

None of these clones are inside the `angular-typechecker` repo and nothing was installed (`npm install`/`pnpm install` was not run in any of them); this was static file analysis only.
