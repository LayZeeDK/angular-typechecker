---
status: resolved
slug: cli-yarn-e2e-wrong-version
trigger: "CLI x yarn e2e (e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts): corepack yarn@4.17.0 installs angular-typechecker@0.2.0 from PUBLIC npm (schematics=undefined, exports {'.','./package.json'}) instead of the Verdaccio-published LOCAL dist (schematics: ./collection.json), so `ng add`/`ng g angular-typechecker:ng-add` errors \"Package was found but does not support schematics\"."
created: 2026-07-12
updated: 2026-07-12
---

# Debug: CLI x yarn e2e installs the wrong angular-typechecker@0.2.0

## Symptoms

- **Expected:** `corepack yarn add -D angular-typechecker` (and/or the real `ng add`) resolves the
  Verdaccio-published LOCAL dist of angular-typechecker@0.2.0 (WITH the Angular CLI surface:
  `schematics: ./collection.json`, `builders`, `executors`, `generators`), so
  `ng g angular-typechecker:ng-add` runs the schematic and auto-wires every project.
- **Actual:** yarn installs the PUBLIC-npm angular-typechecker@0.2.0 (the shipped v0.2.0 milestone
  artifact that PREDATES the Angular CLI surface: `schematics=undefined`, exports only
  `{'.','./package.json'}`). `ng g`/`ng add` then errors "Package was found but does not support
  schematics".
- **Error:** `Package was found but does not support schematics.` (Angular CLI, at `ng g angular-typechecker:ng-add`)
- **Timeline:** brand-new test (Phase 24, filling the CLI x yarn cell of the workspace matrix). Never passed.
- **Reproduction:** `npx nx e2e angular-typechecker-ng-cli-e2e` (runs the yarn spec; ~60-100s/run incl.
  globalSetup build+publish + real yarn install of an Angular 22 workspace). The spec's `it.each`
  covers `flat` and `workspace` layouts; BOTH fail identically per the handoff.

## BLOCKING CONSTRAINTS (do not violate)

- [ ] **NOT an `exports`/product bug.** Do NOT re-attempt exposing `./collection.json` (or
      builders/executors/generators) in package.json `exports`. That was tried, rebuilt, re-run, STILL
      failed identically, and reverted. Angular CLI resolves the schematics collection by FILESYSTEM
      JOIN from the package dir (`path.resolve(pkgDir, pkg.schematics)`), not via the `exports` subpath.
      The real cause is the WRONG INSTALLED VERSION, not exports.
- The product dist is CORRECT: `dist/packages/angular-typechecker/package.json` has
  `schematics: ./collection.json` + the full Angular CLI surface. Verified by the passing npm ACV-02
  spec (`ng-add-ng-run.e2e.spec.ts`) which `ng add`s the same Verdaccio dist and wires successfully.

## Established facts (confirmed before this session, do NOT re-derive)

1. **Verdaccio is NO-PROXY for `angular-typechecker`** (`.verdaccio/config.yml:39`): a dedicated
   package block with no `proxy` key, matched ABOVE the `'**'` catch-all. So Verdaccio NEVER falls
   through to npmjs for this package -- it serves purely from local storage, and `clearStorage:true`
   wipes+re-publishes the local dist every run. => If yarn actually queried Verdaccio it would get
   the CORRECT dist.
2. **Verdaccio definitively serves the correct dist.** Two sibling specs prove it against this exact
   shared globalSetup (one build+publish, `startLocalRegistry`, 127.0.0.1 loopback):
   - `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts` (npm, `ng add`) PASSES.
   - `e2e/angular-typechecker-install-e2e/src/nx-add-yarn.e2e.spec.ts` (yarn 4, `nx add` -> child
     `yarn add -D angular-typechecker`) PASSES with an IDENTICAL `.yarnrc.yml`.
3. **Both config files point at Verdaccio.** The failing spec writes `.yarnrc.yml`
   (`npmRegistryServer: <verdaccio>`) AND `.npmrc` (`registry=<verdaccio>`, via `writeVerdaccioNpmrc`).
   Neither points at public npm -- so a `.npmrc`/registry redirect does NOT explain a public-npm fetch.
4. **The fixture is clean.** `git ls-files` under
   `e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/` shows only `package-lock.json`
   (which the spec drops) -- NO committed `yarn.lock`, `.yarn/`, `.yarnrc.yml`. Fixture
   `packageManager` is `npm@11.16.0` (the spec overrides to `yarn@4.17.0`). No `.yarnrc.yml` at/above
   the repo root. => Stale-committed-lockfile hypothesis ELIMINATED.
5. **Version collision:** local dist AND public npm are BOTH `0.2.0` (package.json stays 0.2.0; v0.2.1
   not cut). So any fall-through/cache path that reaches npmjs returns a same-version-but-wrong tarball.

## Conclusion drawn from the facts

Since Verdaccio serves the correct dist (fact 2) and both configs target Verdaccio (fact 3), the
failing `corepack yarn add -D angular-typechecker` must be **bypassing its configured registry** for
this package -- resolving/caching from public npm instead. The one material difference from the
PASSING `nx-add-yarn` spec is that here the install is a DIRECT `corepack yarn add` (plus an extra
`.npmrc` that also points at Verdaccio, and a `npm_config_userconfig -> nonexistent` env), whereas the
passing spec installs via `nx add`'s child `yarn add`. WHY a direct `yarn add` reaches public npm
while the `nx add` child yarn does not is the open question.

## Current Focus

hypothesis (CONFIRMED, 2nd layer): With the version fixed (enableMirror:false), the ng-add schematic
  now LOADS but crashes: `Cannot find module 'nx/src/devkit-exports'`. The schematic is
  `convertNxGenerator(ngAddGenerator)` importing `@nx/devkit`; `@nx/devkit`'s entrypoint require()s
  `nx/src/devkit-exports` at load. `@nx/devkit` is a angular-typechecker DEPENDENCY; its `nx` PEER is
  auto-installed by npm (why ACV-02 passes) and pnpm, but yarn 4 does NOT auto-install peer deps, so
  `nx` is absent in the pure Angular CLI (non-Nx) yarn workspace. FIX: install `nx` explicitly in the
  yarn spec before ng-add (mirrors what npm auto-does; the nx-add-yarn fixture already has nx).
test: add `corepack yarn add -D nx@23.0.1`, re-run BOTH layouts to green.
expecting: ng g runs the schematic and both layouts auto-wire + scope-check green.
next_action: apply the nx-install fix and re-run.

archived_hypothesis: A bare `corepack yarn add -D angular-typechecker` is NOT using the tmp workspace's
  `.yarnrc.yml` npmRegistryServer for this fetch (effective registry != Verdaccio), OR yarn is reusing
  a public-npm resolution from a cache/mirror not isolated by `enableGlobalCache:false` +
  per-fixture `cacheFolder`. The nx-add-yarn spec avoids it because `nx add`'s child `yarn add` runs in
  a context where the Verdaccio registry actually takes effect.
test: Instrument the tmp workspace in-test (tmp is removeTmpDir-cleaned, so probe IN the run -- extend
  the existing atc-probe pattern). Before AND right before the failing `yarn add`, capture:
  (a) `corepack yarn config get npmRegistryServer` (yarn's EFFECTIVE registry from that cwd);
  (b) `corepack yarn npm info angular-typechecker --fields version,dist,dist-tags --json` (what yarn's
      registry client actually resolves for the package -- does it report the Verdaccio local dist or
      public npmjs? compare `dist.tarball` host: 127.0.0.1 vs registry.npmjs.org);
  (c) after `yarn add`, read `<tmp>/yarn.lock` for the `angular-typechecker@` resolution line
      (`resolution:` + `resolved`/`checksum`) -- the lockfile records the EXACT source.
  Then diff against the SAME three probes inside a minimal repro that mirrors `nx-add-yarn` (no
  `.npmrc`, no `npm_config_userconfig`, `nx add` path) to isolate which single factor flips the source.
expecting: (b)/(c) reveal a `registry.npmjs.org` tarball host (or a non-Verdaccio resolution) for the
  DIRECT yarn add, vs a `127.0.0.1` Verdaccio tarball for the nx-add path -- pinpointing whether the
  cause is (i) effective-registry not Verdaccio, (ii) a yarn cache/mirror leak, or (iii) something the
  `.npmrc`/`npm_config_userconfig`/direct-add path introduces.
next_action: RUNNING NOW — instrumented the failing spec with 3 probes (effective registry, `yarn npm info`, yarn.lock resolution line) around the direct `yarn add`. Executing `npx nx e2e angular-typechecker-ng-cli-e2e` to capture ground truth before choosing the fix.
prior_next_action: Run ONE instrumented experiment (the three probes above) rather than blind-iterating.
  Read the probe output to choose the fix among the handoff candidates: (a) publish the e2e dist under
  a DISTINCT version to remove the 0.2.0 npmjs collision (but globalSetup avoids version mutation on a
  release branch -- weigh carefully); (b) align yarn registry/cache handling with the working
  nx-add-yarn recipe (drop the extra `.npmrc`/`npm_config_userconfig`; match its install path); (c)
  force yarn's resolution to Verdaccio (e.g. an explicit registry on the add, or clear the mirror).
  Do NOT re-attempt the exports fix (refuted, fact under BLOCKING CONSTRAINTS).
reasoning_checkpoint:
  hypothesis: yarn's GLOBAL MIRROR (globalFolder "D:\\packages\\.yarn\\berry\\global" set in the HOME
    ~/.yarnrc.yml) holds a STALE public-npm angular-typechecker@0.2.0 (schematics=undefined). The
    per-fixture .yarnrc.yml sets enableGlobalCache:false but leaves enableMirror at its DEFAULT (true),
    so yarn reuses the mirror zip BY LOCATOR (angular-typechecker@npm:0.2.0) rather than downloading the
    fresh Verdaccio dist. Because BOTH dists are version 0.2.0 (locator collision), the stale
    schematics-less zip is installed -> `ng g :ng-add` errors "does not support schematics". The prior
    "bypassing the registry / public-npm fetch" conclusion was directionally right (wrong CONTENT) but
    the MECHANISM was wrong: NOT a registry redirect (registry resolves correctly to Verdaccio) -- it is
    the locator-keyed global mirror serving stale tarball bytes.
  confirming_evidence:
    - "probe (a): yarn effective registry = http://127.0.0.1:4873 (Verdaccio) -- NOT a redirect."
    - "probe (b): `yarn npm info` resolves the Verdaccio tarball (http://127.0.0.1:4873/...) correctly."
    - "atc-probe (INSTALLED): version 0.2.0, schematics=undefined, exports {'.','./package.json'}."
    - "fresh dist manifest HAS schematics:./collection.json + full CLI surface (executors/generators/builders/ng-add)."
    - "npm ACV-02 PASSES in the SAME run (npm installs the fresh Verdaccio dist directly; npm has no such mirror)."
    - "global mirror D:\\packages\\.yarn\\berry\\global\\cache holds angular-typechecker-npm-0.2.0-e2781dad95-10c0.zip; its package.json = version 0.2.0, schematics=undefined, generators=./generators.json (WHY nx-add-yarn passes -- nx init only needs generators), exports {'.','./package.json'} = the public pre-CLI 0.2.0."
  falsification_test: "If adding enableMirror:false does NOT flip the atc-probe to schematics='./collection.json', the mirror theory is wrong."
  fix_rationale: "enableMirror:false makes yarn IGNORE the global mirror; with enableGlobalCache:false + a fresh per-fixture cacheFolder, the ONLY source left is the resolved registry (Verdaccio), forcing a fresh download of the correct dist. Root-cause fix (stale mirror reuse), not a symptom patch. Test-harness only -- product dist is correct."
  blind_spots: "Whether `ng g angular-typechecker:ng-add` succeeds under yarn once the CORRECT version is installed. The spec docstring claims `ng g <collection>` differs from `ng add` under yarn's node-modules linker; that claim may itself be a misdiagnosis of THIS mirror bug. If `ng g` still fails with schematics present, switch that line to the proven `ng add --skip-confirmation` path (matches npm ACV-02)."

## Evidence

- 2026-07-12: Read both specs. FAILING `ng-add-ng-run-yarn.e2e.spec.ts` install sequence (lines
  241-261): `corepack enable` -> `corepack yarn install` -> `corepack yarn add -D angular-typechecker`
  [TEMP DIAGNOSTIC] -> write+run `atc-probe.cjs` (require.resolve of installed pkg) -> `corepack yarn
  ng g angular-typechecker:ng-add`. `.yarnrc.yml` (setupYarnWorkspace, lines 186-199) matches
  nx-add-yarn byte-for-byte: nodeLinker node-modules, npmRegistryServer/npmAuthToken=Verdaccio,
  unsafeHttpWhitelist 127.0.0.1, npmMinimalAgeGate 0, enableImmutableInstalls false, per-fixture
  cacheFolder ./.yarn/cache, enableGlobalCache false. EXTRA vs nx-add-yarn: also calls
  `writeVerdaccioNpmrc` (line 204) and runs with `npmEnv = {...env, npm_config_userconfig:
  <tmp>/.npmrc.nonexistent}`.
- 2026-07-12: `.verdaccio/config.yml` -> `angular-typechecker` block has NO proxy key (local-only);
  `'**'` catch-all proxies npmjs. globalSetup publishes the freshly built dist once via `nx release
  publish --first-release --excludeTaskDependencies`, `clearStorage:true`, 127.0.0.1 loopback.
- 2026-07-12: fixture is clean of yarn artifacts (git ls-files); no repo-root `.yarnrc.yml`.
- 2026-07-12 [INSTRUMENTED EXPERIMENT — ground truth]: ran the 3 probes + read the fresh dist + the
  yarn global mirror. RESULTS:
  - probe (a) effective registry = `http://127.0.0.1:4873` (Verdaccio). No redirect.
  - probe (b) `yarn npm info` = version 0.2.0, dist.tarball `http://127.0.0.1:4873/angular-typechecker/-/angular-typechecker-0.2.0.tgz`, dist-tags latest 0.2.0. yarn RESOLVES Verdaccio correctly.
  - atc-probe (INSTALLED, both layouts) = `VERSION=0.2.0 SCHEMATICS=undefined EXPORTS={".":"./src/index.js","./package.json":"./package.json"}`.
  - fresh dist `dist/packages/angular-typechecker/package.json` HAS `schematics: ./collection.json` + executors/generators/builders/ng-add. `exports` intentionally only `.` + `./package.json` (Angular CLI joins pkg.schematics on the filesystem, so require.resolve('collection.json') ERR_PACKAGE_PATH_NOT_EXPORTED is a red herring, per BLOCKING CONSTRAINTS).
  - npm ACV-02 (`ng-add-ng-run.e2e.spec.ts`) PASSED in the SAME run; only the yarn spec's 2 layouts FAILED.
- 2026-07-12 [ROOT CAUSE]: HOME `~/.yarnrc.yml` sets `globalFolder: D:\packages\.yarn\berry\global`.
  That mirror's cache holds a STALE `angular-typechecker-npm-0.2.0-e2781dad95-10c0.zip`; its package.json
  = version 0.2.0, schematics=undefined, generators=`./generators.json`, executors=`./executors.json`,
  exports `{'.','./package.json'}` (the PUBLIC pre-CLI 0.2.0). The per-fixture `.yarnrc.yml` has
  `enableGlobalCache:false` but NO `enableMirror` override (default true), so yarn copies the mirror zip
  BY LOCATOR (`angular-typechecker@npm:0.2.0`) into the fresh per-fixture cache instead of fetching the
  Verdaccio tarball. Version collision (public 0.2.0 == Verdaccio 0.2.0) makes the locators identical.
  nx-add-yarn passes because the stale zip still has `generators` (nx init); CLI-yarn fails because it
  needs the NEW `schematics` surface, absent from the stale zip.
- 2026-07-12 [FIX 1 VERIFIED + 2ND LAYER FOUND]: added `enableMirror: false` to the yarn config and
  re-ran. atc-probe FLIPPED to `VERSION=0.2.0 SCHEMATICS="./collection.json"` -- the fresh Verdaccio
  dist is now installed (mirror bug fixed; the "does not support schematics" error is GONE). But the
  test now fails DEEPER, at the ng-add schematic execution: `An unhandled exception occurred: Cannot
  find module 'nx/src/devkit-exports'`, require stack `@nx/devkit/dist/index.js` <-
  `angular-typechecker/src/schematics/ng-add/schematic.js`. So `ng g angular-typechecker:ng-add` DOES
  find + load the collection under yarn (refuting the spec docstring's `ng g`-vs-`ng add` theory -- that
  was a misdiagnosis of the version bug). The new cause: the schematic is `convertNxGenerator(...)` from
  `@nx/devkit`; loading `@nx/devkit` require()s `nx/src/devkit-exports`. `@nx/devkit` is an
  angular-typechecker DEPENDENCY whose `nx` PEER npm/pnpm auto-install but yarn 4 does NOT -> `nx`
  missing in the non-Nx yarn workspace. (npm ACV-02 passes because it runs the SAME schematic and would
  crash identically if `nx` were absent -> proof npm auto-installed the `nx` peer.)

## Eliminated

- hypothesis: `exports` map hides `collection.json` from Angular CLI. REFUTED + REVERTED (prior
  session): applied the exports edit, rebuilt, re-ran -> STILL failed identically. Angular CLI resolves
  the collection by filesystem join, not the exports subpath. Real cause is the wrong installed version.
- hypothesis: a stale committed `yarn.lock`/`.yarn/` in the fixture pins angular-typechecker to public
  npm. ELIMINATED 2026-07-12: `git ls-files` shows the fixture ships only `package-lock.json` (dropped
  by the spec) -- no yarn artifacts; no repo-root `.yarnrc.yml`.
- hypothesis: the `.npmrc`/registry redirects yarn to public npm. ELIMINATED: the `.npmrc`
  (writeVerdaccioNpmrc) sets `registry=<verdaccio>` -- it points AT Verdaccio, not public npm.
- hypothesis: yarn bypasses its configured registry and RESOLVES from public npm. REFUTED by the
  instrumented experiment: probe (a) registry = Verdaccio, probe (b) `yarn npm info` = Verdaccio tarball.
  yarn resolves Verdaccio correctly; the wrong CONTENT comes from the global MIRROR reusing a
  locator-keyed stale tarball, not from a registry redirect.

## Resolution

root_cause: yarn 4's global MIRROR (globalFolder `D:\packages\.yarn\berry\global`, set in the HOME
  `~/.yarnrc.yml`) held a stale public-npm `angular-typechecker@0.2.0` (schematics=undefined, the
  pre-Angular-CLI 0.2.0). The failing spec's per-fixture `.yarnrc.yml` set `enableGlobalCache:false`
  but left `enableMirror` at its default `true`, so yarn served the package from the mirror by LOCATOR
  (`angular-typechecker@npm:0.2.0`) instead of downloading the fresh Verdaccio dist. Because the public
  and Verdaccio dists share version 0.2.0, the locators collide and the stale schematics-less zip was
  installed, so `ng g angular-typechecker:ng-add` errored "Package was found but does not support
  schematics". (npm ACV-02 passes: npm has no such mirror. nx-add-yarn passes: the stale zip still
  carries `generators`, all `nx add`'s init needs.) TEST-HARNESS bug; the shipped/built dist is correct.
fix: TWO test-harness changes in `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts`
  (product source untouched):
  1. Added `enableMirror: false` to the per-fixture `.yarnrc.yml` in `setupYarnWorkspace` -> yarn
     ignores the stale global mirror and downloads the fresh Verdaccio 0.2.0 (WITH the Angular CLI
     schematics surface) into the fresh per-fixture cacheFolder. Fixes the wrong-version root cause.
  2. Added `NX_VERSION = '23.0.1'` + a `corepack yarn add -D nx@${NX_VERSION}` step before ng-add ->
     provides the `nx` package that `@nx/devkit` (angular-typechecker's dependency) require()s at load
     via `nx/src/devkit-exports`. yarn 4 does not auto-install peer deps (npm/pnpm do), so the non-Nx
     yarn workspace needs `nx` explicitly. Fixes the 2nd-layer `Cannot find module 'nx/src/devkit-exports'`.
verification: `npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` -> Test Files 2 passed (2),
  Tests 3 passed (3). Both yarn layouts GREEN (flat 87s, workspace 75s) + npm ACV-02 still green.
  atc-probe confirms the CORRECT installed dist: `VERSION=0.2.0 SCHEMATICS="./collection.json"`.
files_changed:
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts (enableMirror:false + nx install)
caveat: This surfaced a REAL yarn UX gap (out of scope, flag for product decision): a yarn 4 Angular
  CLI user running `ng add angular-typechecker` will hit `Cannot find module 'nx/src/devkit-exports'`
  UNLESS they also install `nx`, because yarn does not auto-install the transitive `nx` peer that
  npm/pnpm do. Not documented in the README. Not a test-harness defect; a packaging/UX consideration.
follow_ups_out_of_scope: HANDOFF tasks 2-3 -- remove the TEMP DIAGNOSTIC scaffolding (the standalone
  `corepack yarn add -D angular-typechecker` probe + atc-probe.cjs) now that the real `ng g` path works;
  and the mandatory code-review of this spec change.

## Final Resolution (updated 2026-07-12, Plan 24-05)

The two interim test-harness fixes above were SUPERSEDED / CORRECTED during 24-05 (the plan that
finalized the yarn spec). Final state:

1. **`nx` peer -> PRODUCT fix, not a test workaround.** The interim `NX_VERSION` +
   `corepack yarn add -D nx@23.0.1` step is REMOVED. Plan 24-04 declared `nx` a DIRECT dependency of
   angular-typechecker (`"nx": "^23.0.0"`), so `ng add` (running `yarn add angular-typechecker`) now
   installs `nx` TRANSITIVELY under yarn -- yarn installs direct deps and only skips the `@nx/devkit`
   PEER that npm/pnpm auto-add. Verified in 24-05 e2e runs: after `ng add`, `node_modules/nx` is present
   and the ng-add schematic loads without `Cannot find module 'nx/src/devkit-exports'`. The yarn UX gap
   noted in the interim `caveat` is thus FIXED IN THE PRODUCT (nx auto-installed), not merely documented.

2. **`enableMirror: false` STAYS** -- a separate, still-load-bearing fix for the global-mirror
   locator collision (the original root cause above). Unchanged.

3. **NEWLY CONFIRMED (24-05): yarn `ng add` installs but does NOT auto-wire.** With the mirror + nx
   issues resolved, `ng add angular-typechecker` under yarn installs correctly yet Angular CLI reports
   "Package installed successfully. The package does not provide any `ng add` actions" and runs NO
   schematic. Root cause is Angular CLI's post-install ng-add DETECTION (`createSchematic('ng-add')` in
   `@angular/cli`'s add command) silently failing under yarn's node-modules layout -- NOT a
   collection-resolution difference (the earlier `blind_spots` `ng g`-vs-`ng add` linker theory is
   refuted), and NOT an angular-typechecker defect: npm AND pnpm run the SAME schematic on the identical
   installed package and DO wire. The ng-add schematic ITSELF runs fine under yarn, so the finalized
   spec WIRES via an explicit `corepack yarn ng g angular-typechecker:ng-add` (the plan's authorized
   `ng add`-misbehaves -> `ng g` fallback) and asserts the no-wire state right after `ng add` to lock
   the quirk as a regression.

final_verification: 24-05 `NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` --
  all four specs green: npm (ACV-02), yarn flat, yarn workspace, pnpm collision.

out_of_scope_product_followup: the README `## Angular CLI` "ng add auto-wire-all" claim is INACCURATE
  for yarn (a yarn user's `ng add` installs but wires nothing; they must run
  `ng g angular-typechecker:ng-add`). Recorded as a release-facing decision in
  `.planning/todos/pending/readme-yarn-ng-add-caveat.md` (README yarn caveat +/- an upstream Angular CLI
  issue). Deliberately NOT auto-fixed in 24-05 (that plan ships two e2e specs only).

## Post-24-05 root-cause pin (2026-07-12, instrumented)

Item 3 above named the cause correctly (the `createSchematic('ng-add')` probe) but phrased it too
broadly ("silently failing under yarn's node-modules layout"). A faithful, INSTRUMENTED first-run
`ng add` against Verdaccio (fresh yarn-4 node-modules workspace; @angular/cli 22.0.6 gates logged;
cross-checked against the `angular-cli` clone branch `22.0.x`) pinned it gate-by-gate:

- **Gate 1 (registry metadata) = TRUE.** `[G1] hasSchematics=true manifest.schematics="./collection.json"`.
  `yarn npm info` returns the custom `schematics` field (the CLI requests it in MANIFEST_FIELDS). So this
  is NOT a metadata-stripping issue and NOT the registry-metadata bug angular/angular-cli #33060 (already
  fixed by #33285 and present in 22.0.6).
- **Gate 2 (`resolvePackageJson` on-disk fallback) is NOT the cause** (a standalone probe resolves the
  installed manifest fine under yarn's node-modules linker).
- **Gate 3 (`createSchematic('ng-add')` probe) THROWS** while LOADING this package's ng-add factory.
  That factory is `convertNxGenerator(...)` from `@nx/devkit`, so the require chain pulls in `nx` + its
  transitive deps; under yarn 4's hoist the load fails and @angular/cli's add command swallows it in a
  bare `catch {}` (introduced upstream in `a73f4fb8b`, no issue ref) -> `hasSchematics=false` -> the
  "does not provide any ng add actions" message -> NO wire. Observed throw:
  `TypeError: chalk.blue is not a function` at `nx/node_modules/log-symbols/index.js:6`, reached via
  `nx/node_modules/ora`. (On disk that `log-symbols` resolves `chalk@4.1.2`, which HAS `.blue`, so the
  failure is a yarn-4 RUNTIME/interop resolution quirk inside the full `ng add` process -- a clean
  standalone `createSchematic` does not reproduce it.) The pre-24-04 form of the same probe failure was
  `Cannot find module 'nx/src/devkit-exports'` (the missing `nx` peer, fixed by 24-04's direct `nx`
  dep); this chalk/log-symbols form is the same CLASS post-24-04 (the probe fails loading the nx-based
  factory under yarn, masked by the bare catch), just a different sub-error.

**npm/pnpm** hoist nx's transitive deps so the SAME probe succeeds and they wire the identical dist ->
confirms it is NOT an angular-typechecker packaging defect.

**Workarounds (both verified in the repro):** `ng g angular-typechecker:ng-add`, OR a SECOND `ng add`
(the CLI's already-installed short-circuit at `cli.js:167-176` -> `executeSchematic`, bypassing the
probe). Both wire the full `[tsconfig.app.json, tsconfig.spec.json]` array.

**OPEN QUESTION (gates any upstream attribution).** It is NOT established whether a VANILLA (Nx-free)
Angular schematic ALSO fails the probe under yarn. The observed throw is entirely inside the
`@nx/devkit` -> `nx` (`convertNxGenerator`) transitive chain, so the failure may be nx-transitive-specific
under yarn's hoist rather than a general Angular-CLI-under-yarn probe bug. Do NOT file an upstream
angular/angular-cli issue (bare-catch-masks-the-error / yarn-4 `ng add` untested) until a vanilla
non-nx schematic is shown to reproduce the probe failure under yarn 4. Until then the accurate scope is
"loading this package's `@nx/devkit`-based ng-add factory throws in the CLI's yarn probe", NOT "Angular
CLI's ng-add detection fails under yarn" in general.

## OPEN QUESTION -- RESOLVED (2026-07-12, quick task 260712-ft9)

**Answer: the failure is NX-SPECIFIC, NOT a general Angular-CLI-under-yarn probe bug.** A VANILLA
(Nx-free) zero-import ng-add schematic (`exports.default` factory, no `@nx/devkit`, no
`@angular-devkit/schematics`, no chalk/ora/log-symbols) WIRES cleanly under yarn 4: Gate 3
`createSchematic('ng-add')` returns OK, the factory runs, and the on-disk marker lands. The npm
control wires the SAME package identically -- so the package is well-formed and a yarn no-wire (had it
occurred) could not be dismissed as a malformed repro. Because the vanilla schematic carries NO nx
transitive chain, Gate 3 does not throw; the angular-typechecker no-wire therefore REQUIRES the
`@nx/devkit -> nx -> ora -> log-symbols -> chalk` chain (the observed `TypeError: chalk.blue is not a
function`) that only nx's packaging drags in under yarn's hoist.

Evidence (verbatim, ANSI-stripped) -- BOTH legs, no `[G3-CATCH]` fired:
- yarn: `[G1] hasSchematics=true manifest.schematics="./collection.json" vanilla-ng-add-repro@0.0.1`;
  `[G3] createSchematic(ng-add) OK -> stays true`; `[vanilla-ng-add] SCHEMATIC RAN`;
  `CREATE VANILLA_NG_ADD_RAN.txt (19 bytes)`; `[MARKER yarn] present`.
- npm: `[G1] hasSchematics=true manifest.schematics="./collection.json" vanilla-ng-add-repro@0.0.1`;
  `[G3] createSchematic(ng-add) OK -> stays true`; `[vanilla-ng-add] SCHEMATIC RAN`;
  `[MARKER npm] present`.

**Upstream attribution decision:** NO angular/angular-cli issue is warranted (the "Angular CLI's
yarn-4 `ng add` probe is broken / bare-catch masks the error" framing is refuted -- a dependency-free
schematic wires fine under yarn). If anything is fileable it is an nx-under-yarn packaging/hoist
consideration, and it stays USER-GATED. No issue is filed by the repro task.

Full repro + captured logs (external, uncommitted sandbox):
`D:/projects/sandbox/vanilla-ng-add-repro/FINDINGS.md` (harness `vanilla-repro.mjs`, combined
`run.log`, marker files under `vanilla-ng-add-ws-yarn/` and `vanilla-ng-add-ws-npm/`).

## Option D spike -- lazy-require refuted (2026-07-12, instrumented; change REVERTED)

Tested whether deferring the `@nx/devkit` load out of the ng-add factory's MODULE TOP-LEVEL fixes
the yarn first-run `ng add` (goal: keep `convertNxGenerator` + the single generator implementation,
just avoid the probe-time load). Changed `src/schematics/ng-add/schematic.ts` to lazy-`require`
`@nx/devkit` + the generator INSIDE the factory, rebuilt, and re-ran the instrumented Verdaccio
first-run `ng add`. RESULT (`verdaccio-optionD.log`):

- The PROBE was fixed: `[G1] hasSchematics=true`, `[G3] createSchematic(ng-add) OK`, `[G3-CATCH]` = 0
  (the createSchematic probe no longer throws -- the light module loads clean).
- But `executeSchematic` (which the CLI now proceeds to, since hasSchematics stayed true) THREW
  `chalk.blue is not a function` anyway -> the schematic errored -> STILL no wire on the first run.
  Option D merely RELOCATED the failure from a silent swallow ("does not provide any ng add actions")
  to a loud exception; net outcome unchanged. REVERTED.

**Refined root cause (the important learning): the chalk breakage is PROCESS-WIDE, not probe-timing.**
The first-run `ng add` process instantiates the add command's **listr2** task renderer (for the
install task) BEFORE `@nx/devkit -> nx -> ora -> log-symbols -> chalk` is loaded; that pollutes chalk
resolution under yarn 4's hoist, so the load throws WHENEVER it happens in that process (probe OR
execution). The SECOND `ng add` run wires because the already-installed short-circuit (`cli.js:167-176`)
returns `executeSchematic` BEFORE `new Listr([...])` is ever constructed -- a clean process. `ng g` is a
different command (no add-listr2) -> also clean.

**Consequence for the fix menu:** any fix that loads `@nx/devkit` during the first-run `ng add`
EXECUTION -- lazy-require (D) AND a native-composition ng-add that runs the convertNx `configuration`
schematic (G) -- fails identically. ONLY a genuinely nx-free ng-add execution path (a vanilla schematic
that wires `angular.json` via pure `@angular-devkit/schematics` + a framework-agnostic leaf-resolution
function, never loading `@nx/devkit`) would auto-wire the first run under yarn. That is a real
refactor (extract the collision-fixed wiring core to be devkit-Tree-agnostic so the vanilla ng-add and
the Nx generator share it -- NOT a blind duplicate), warranted only if the yarn first-run `ng add` UX is
prioritized (v0.2.2/v0.3.0). Otherwise the standing workaround holds: `ng g angular-typechecker:ng-add`
or run `ng add` twice (README caveat, todo item 1). Spike log: `verdaccio-optionD.log` (job tmp).
