# Quick-task Research: fix `nx release publish` shipping TypeScript source

**Researched:** 2026-07-04
**Domain:** Nx 23.0.1 release/publish packageRoot; Verdaccio e2e; CI gating
**Confidence:** HIGH (root cause + fix verified against installed Nx 23.0.1 source and both reference clones)

## Summary

The published tarball ships `src/**/*.ts` because `nx release publish` packs the
**project SOURCE root**, not `dist/`. This is Nx's documented default, proven in the
installed executor:

`node_modules/@nx/js/dist/src/executors/release-publish/release-publish.impl.js:68`

```js
const packageRoot = join(context.root, options.packageRoot ?? projectConfig.root);
```

With no `options.packageRoot`, it falls back to `projectConfig.root` =
`packages/angular-typechecker`, whose `package.json` `files: ["src", ...]`
(`packages/angular-typechecker/package.json:35`) globs `src/**/*.ts`. `release.yml:83-84`
builds correct dist then publishes from source, ignoring dist entirely.

**Primary recommendation:** Add an `nx-release-publish` target with
`options.packageRoot: "dist/packages/angular-typechecker"` to
`packages/angular-typechecker/project.json`. This is exactly what Nx's own
`@nx/js:library --publishable` generator writes (evidence below). Do NOT add
`manifestRootsToUpdate` / `currentVersionResolver: git-tag` — this repo's decoupled
build-then-publish CI flow does not need them (see Goal 1 follow-on). Guard against
regression with a cheap config+version assertion in the existing serialized e2e project;
a full Verdaccio round-trip is an optional higher-fidelity gate (Goal 2).

---

## Goal 1 — The fix: publish the built dist, not source

### Recommended change (canonical for Nx 23.0.1)

Add to `packages/angular-typechecker/project.json` `targets`:

```json
"nx-release-publish": {
  "options": {
    "packageRoot": "dist/packages/angular-typechecker"
  }
}
```

That is the whole fix. Use the **literal** path (matches `build.options.outputPath` at
`project.json:12`), not the `{projectRoot}` token — the publish impl joins
`context.root + options.packageRoot` directly (`release-publish.impl.js:68`) and does not
interpolate tokens the way the build executor interpolates `{options.outputPath}`.

### Why this is canonical (not a workaround)

Nx's own publishable-library generator writes precisely this shape.
`node_modules/@nx/js/dist/src/generators/library/utils/add-release-config.js:95-111`:

```js
const packageRoot = joinPathFragments(defaultOutputDirectory /* 'dist' */, '{projectRoot}');
projectConfiguration.targets['nx-release-publish'] = { options: { packageRoot } };
projectConfiguration.release = {
  version: {
    manifestRootsToUpdate: [packageRoot],
    currentVersionResolver: 'git-tag',        // see follow-on below
    fallbackCurrentVersionResolver: 'disk',
  },
};
```

So the `nx-release-publish` target `packageRoot` is THE knob (canonical). It lives in
`project.json` per Nx's generator; a top-level `nx.json` `targetDefaults["nx-release-publish"]`
also works (nx-verdaccio uses the empty `"nx-release-publish": {}` form,
`nx-verdaccio/nx.json:154`). Per-project `project.json` is preferred here — this repo
releases exactly one project (`nx.json:70`).

### Reference clones (how real Nx-published Angular-adjacent plugins do it)

Both clones publish from dist via `@nx/js:tsc`, and **neither sets `packageRoot` explicitly**:

- `nx-verdaccio` — build `outputPath: "{projectName}/dist"` (`nx-verdaccio/projects/nx-verdaccio/project.json`), release block has no `packageRoot`, and `nx.json:154` has a bare `"nx-release-publish": {}`.
- `analog` — same family (`@nx/js:tsc` build to a dist dir).

They get away without `packageRoot` because their build `outputPath` is nested UNDER the
project root (`nx-verdaccio/dist`), so `projectConfig.root` fallback... actually still
would not include dist. **The honest read: this repo's bug is that dist is a SIBLING tree
(`dist/packages/...`) and publish defaults to the project root, so it MUST set
`packageRoot` explicitly.** Do not treat "the clones omit it" as license to omit it — set
it. `[VERIFIED: local clones + Nx 23.0.1 source]`

### CRITICAL follow-on: does the dist `package.json` carry the BUMPED version at publish?

**Yes, in this repo's flow — no gap.** Trace:

1. `preVersionCommand` (build) runs BEFORE the version bump in a combined `nx release`.
   Confirmed: `node_modules/nx/dist/src/command-line/release/version.js:120` runs
   `runPreVersionCommand`, then `:141` comment: *"This happens after preVersionCommands run,
   as those commands may create manifest files needed for versioning."* So in a SINGLE
   `nx release` the build would emit a dist manifest with the OLD version — the classic gap
   the Nx generator's `currentVersionResolver: 'git-tag'` + `manifestRootsToUpdate` solve.

2. **This repo does NOT publish from the local cut.** The local cut runs
   `nx release --skip-publish` (AGENTS.md release flow); dist is gitignored and discarded.
   Publish is a SEPARATE tag-triggered CI job that does a FRESH checkout of the already-bumped
   tagged commit, then `npx nx build` (`release.yml:83`) → `npx nx release publish`
   (`release.yml:84`). The source `package.json` at that tag already carries the bump
   (committed during the cut), and `@nx/js:tsc` copies it verbatim into dist — verified: the
   current `dist/packages/angular-typechecker/package.json` reads `"version": "0.1.0"`,
   `"main": "./src/index.js"`, 17 `.js`, 0 `.ts` source, 0 specs.

3. `nx release publish` run standalone does not re-version; it `npm publish`es the
   packageRoot manifest as-is (`nxReleaseVersionData` is optional,
   `release-publish.impl.js:127`).

Therefore: build-off-tagged-source → dist manifest has the correct bumped version → publish
from dist is correct. **Recommendation: add ONLY `packageRoot`. Skip
`manifestRootsToUpdate` / `currentVersionResolver: git-tag`** — they would perturb the
already-working versioning path (0.0.1→0.1.0 all bumped fine off source-disk resolution) and
solve a gap the decoupled CI flow does not have. `[VERIFIED: Nx source + release.yml + dist inspection]`

---

## Goal 2 — Regression gate (source-vs-dist can never ship again)

### Why the existing gates miss it

`tarball-audit.int.spec.ts` and `install-smoke.int.spec.ts` pack with `npm pack` from
`distDir` DIRECTLY (`tarball-audit.int.spec.ts:35,161`; `install-smoke.int.spec.ts:43,150`)
and install the `.tgz` by PATH. They prove the dist tarball is publish-correct and runnable
— but they **never invoke `nx release publish`**, so they structurally cannot catch a
`packageRoot` regression. `nx-add-e2e.int.spec.ts:16-32` documents that real
`nx add <bare-name>` resolves from the REGISTRY and cannot target a local tarball offline, so
it substitutes the internal `nx g angular-typechecker:init`.

### Recommended (lazy, deterministic, no new dep) — two cheap assertions

Fold into the existing serialized `angular-typechecker-install-e2e` project (rides the CI
`e2e` job automatically, matches the `release-hygiene.int.spec.ts` config-assertion style):

1. **packageRoot guard** — assert the `nx-release-publish` target for `angular-typechecker`
   resolves `options.packageRoot === "dist/packages/angular-typechecker"`. Read
   `project.json` directly (like `release-hygiene.int.spec.ts` reads `nx.json`), or
   `execSync('npx nx show project angular-typechecker --json')` and inspect
   `targets['nx-release-publish'].options.packageRoot`. This fails instantly if the fix is
   reverted.
2. **version-through-build guard** — after `nx build`, assert
   `dist/packages/angular-typechecker/package.json` `version` === source
   `packages/angular-typechecker/package.json` `version`. Closes the Goal-1 follow-on
   residual (proves CI's build-off-tagged-source yields the bumped dist version).

Logical closure: (packageRoot === dist, guard 1) + (`npm pack` from dist is correct, existing
`tarball-audit`) ⇒ `npm publish` from packageRoot is correct (`nx release publish` ==
`npm publish <packageRoot>`, identical tar to `npm pack`). Guard 2 covers the version.
**This fully closes the shipped regression with zero new dependencies.**

### Optional higher-fidelity — Verdaccio round-trip

Verdaccio is **NOT** currently installed (verified: absent from root `package.json` /
`nx.json`; no `node_modules/verdaccio`). It is the ONLY way to exercise (a) the real
`nx release publish` command, (b) install-BY-NAME from a registry, and (c) real
`nx add angular-typechecker` (registry fetch) — the path `nx-add-e2e` explicitly cannot test.
Cost: a new `verdaccio` devDep (research already recommends `verdaccio@6.7.4`; nx-verdaccio
runs `6.1.6`), a spawned server, longer/Windows-flakier test.

Concrete pattern extracted from nx-verdaccio (do NOT add the whole `@push-based/nx-verdaccio`
plugin — use the `verdaccio` binary directly):

- **Start** (`nx-verdaccio/.../env-bootstrap/verdaccio-registry.ts:82-177`): spawn
  `npx verdaccio --config <minimal.yaml> --listen <port>` as a detached child; resolve when
  stdout matches `/(?<proto>https?):\/\/(?<host>[^:]+):(?<port>\d+)/` (it logs
  `http://localhost:<port>/`). Use a unique port. `stop()` = `childProcess.kill()`.
  Verdaccio's default config proxies unknown packages to npmjs (uplink), so Angular/Nx/TS
  deps still resolve while `angular-typechecker` is served from local storage.
- **Configure the temp workspace** (`nx-verdaccio/.../env-bootstrap/npm.ts:39-71`): write the
  workspace `.npmrc` with `registry=<url>` and `//<host>:<port>/:_authToken="<anything>"`
  (Verdaccio accepts a dummy token with `location: none`). Prefer a project-local `.npmrc` in
  the temp workspace over `npm config set` (matches the isolation discipline in the existing
  specs, which write an explicit `.npmrc`).
- **Publish**: `npx nx release publish --registry <url>` (or `npm publish dist/... --registry <url>`).
- **Install + run**: in a fresh temp workspace, `pnpm add -Dw angular-typechecker` (or
  `npm i -D`) then `nx g angular-typechecker:init` → wire a project → `nx typecheck`; assert
  green + the installed `node_modules/angular-typechecker/src/index.js` exists and no
  `**/*.ts` source / `*.spec.*` is present.

**Temp workspace:** don't shell out to `create-nx-workspace` (network-heavy, slow). Reuse the
existing committed fixture pattern — `e2e/angular-typechecker-install-e2e/fixtures/consumer-app`
and `consumer-generator` are already minimal Nx-project fixtures that the specs `cpSync` into a
`mkdtempSync` tmp dir. A Verdaccio spec should do the same. `[VERIFIED: local clones + repo specs]`

**Recommendation:** ship the two cheap guards now (must-have, closes the regression); add the
Verdaccio spec only if you want the real-`nx add`/registry coverage — it is additive fidelity,
not required to stop the source-vs-dist ship.

---

## Goal 3 — CI gate

- The `e2e` job (`ci.yml:141-173`) runs the three e2e projects by explicit `-p` list with
  `--parallel=1` on `ubuntu-latest`, Node 24, pnpm 11.9.0. `--parallel=1` is load-bearing:
  all e2e specs `npm pack`/`rmSync` the SAME dist tarball, so they must serialize
  (`ci.yml:159-173`; matches the MEMORY note "e2e projects share one tarball; serialize").
- **Cheap guards (recommended path):** folding them into `angular-typechecker-install-e2e`
  needs NO ci.yml change — they ride the existing `e2e` job. They ARE code/config files
  (`project.json`), so the `changes.code` path filter triggers the job (`ci.yml:100`); a
  planning/docs-only PR still skips, which is fine.
- **Verdaccio spec (if added):** put it in a new e2e project, add its name to the `-p` list at
  `ci.yml:172`, and KEEP `--parallel=1` (it also builds/packs the shared dist tarball and binds
  a port). GH ubuntu runners run Verdaccio as a local process without issue. Bind a unique/free
  port and ensure `stop()` runs in `afterAll` so the port frees.
- Consider making the packageRoot guard **always-run** (like the `scoped-name-guard` job,
  `ci.yml:298-309`) since a `release.yml`/`nx.json`/`project.json` edit is the exact regression
  vector — but since those are `code` files the `e2e` job already covers them; only promote to
  always-run if you want the guard to fire even on a docs-only PR. `[VERIFIED: ci.yml]`

---

## Goal 4 — pnpm `nx add` reliability

`nx add` is **not reliable enough to be the primary tested path in pnpm workspaces.** Evidence
and reasoning:

- `nx-add-e2e.int.spec.ts:16-32` already documents that `nx add <bare-name>` resolves
  `angular-typechecker@latest` from the REGISTRY (splits on last `@`), so it cannot target a
  local tarball and needs network. Its faithful offline proof runs the byte-identical internal
  step `nx g angular-typechecker:init` instead.
- The observed pnpm failures (`ERR_PNPM_IGNORED_BUILDS`, malformed Windows nx self-reinvoke
  path, exit 1 despite the dep being added) are `nx add` orchestration fragilities, not a
  plugin defect.
- The package README already documents the robust fallback
  (`packages/angular-typechecker/README.md:83-87`): `npm install --save-dev angular-typechecker`
  then `nx g angular-typechecker:init`. The pnpm-workspace equivalent is
  `pnpm add -Dw angular-typechecker && nx g angular-typechecker:init`, which reaches the
  generator directly.

**Recommendation:** drive tests AND real-repo validation via the documented
install + `nx g angular-typechecker:init` path (deterministic, generator-direct). Treat
`nx add` as a convenience wrapper, and if a Verdaccio spec exercises `nx add`, treat a pnpm
`nx add` failure as a KNOWN-FRAGILE, non-blocking scenario (or test it on npm only, where the
existing e2e already runs). Ensure the README's pnpm fallback is explicit (add
`pnpm add -Dw ...` next to the npm line if not already present). `[VERIFIED: repo specs + README]`

---

## Exact change set (for the planner)

1. `packages/angular-typechecker/project.json` — add the `nx-release-publish` target with
   `options.packageRoot: "dist/packages/angular-typechecker"`. (No nx.json change; no
   `manifestRootsToUpdate`/`git-tag` resolver.)
2. `angular-typechecker-install-e2e` — add two assertions: packageRoot === dist, and
   post-build dist version === source version. (New spec file or extend `release-hygiene.int.spec.ts`.)
3. (Optional) Verdaccio e2e project + `verdaccio` devDep + add to `ci.yml:172` `-p` list under `--parallel=1`.
4. (Doc) confirm `packages/angular-typechecker/README.md` shows the `pnpm add -Dw` fallback.

## Sources

- Nx 23.0.1 installed source (HIGH): `@nx/js/.../release-publish/release-publish.impl.js:68,127`;
  `@nx/js/.../generators/library/utils/add-release-config.js:95-111`;
  `nx/.../command-line/release/version.js:120,141`.
- Repo files (HIGH): `nx.json:69-84`; `.github/workflows/release.yml:83-84`;
  `.github/workflows/ci.yml:141-173,298-309`; `packages/angular-typechecker/project.json:8-44`;
  `packages/angular-typechecker/package.json:27,35`; `dist/packages/angular-typechecker/package.json` (inspected: v0.1.0, 17 `.js`, 0 `.ts`, 0 spec);
  `e2e/angular-typechecker-install-e2e/src/{tarball-audit,install-smoke,nx-add-e2e,release-hygiene}.int.spec.ts`;
  `packages/angular-typechecker/README.md:83-91`.
- Reference clones (HIGH): `push-based/nx-verdaccio` — `nx.json:154`, `projects/nx-verdaccio/project.json`,
  `src/executors/env-bootstrap/{verdaccio-registry.ts:82-177,npm.ts:39-71}`; `analogjs/analog` (Angular 22 `@nx/js:tsc`).
- Verdaccio absence verified: no `node_modules/verdaccio`, absent from root `package.json`/`nx.json`.

## RESEARCH COMPLETE

`D:\projects\github\LayZeeDK\angular-typechecker\.planning\quick\260704-mse-fix-nx-release-publishing-typescript-sou\260704-mse-RESEARCH.md`
