# Quick Task 260712-ft9 -- Vanilla (Nx-free) Angular CLI schematic repro: RESEARCH

**Researched:** 2026-07-12
**Domain:** Angular CLI `ng add` post-install schematic-detection probe under yarn 4
**Confidence:** HIGH (all mechanism claims read directly from installed @angular/cli + @angular-devkit/schematics source, cross-checked against the pinned debug doc)

## The question this repro answers

The pinned root-cause (`.planning/debug/resolved/cli-yarn-e2e-wrong-version.md`, "Post-24-05 root-cause
pin") is: under yarn 4, `ng add angular-typechecker` installs but does NOT auto-wire because the CLI's
Gate 3 probe (`collection.createSchematic('ng-add', true)`, `cli.js:249`) THROWS while `require()`-loading
the ng-add factory. That factory is `convertNxGenerator(...)` -> pulls `@nx/devkit` -> `nx` -> `ora` ->
`log-symbols` -> `chalk` (observed `TypeError: chalk.blue is not a function`). A bare `catch {}` at
`cli.js:251-253` swallows it -> `hasSchematics=false` -> "does not provide any ng add actions" -> no wire.
npm/pnpm hoist nx's transitive deps compatibly, so the same probe succeeds there.

Because the throw is entirely inside the `@nx/devkit -> nx` chain, the failure MAY be nx-transitive-specific
rather than a general Angular-CLI-under-yarn probe bug. **A VANILLA (Nx-free) schematic with NO heavy
transitive chain isolates this**: if it ALSO fails the yarn probe => general CLI bug (fileable upstream);
if it WIRES => the failure is nx-specific (do NOT file the "ng add is broken under yarn" issue).

## Verified mechanism facts (read from source, do not re-derive)

1. **Non-first-party factories load via plain `require()`, not a VM wrap.**
   `schematic-engine-host.js:23-52` `shouldWrapSchematic()` returns `encapsulation ?? isFirstParty`, and
   `isFirstParty` is `/\/node_modules\/@(?:angular|schematics|nguniversal)\//`. A package named
   `vanilla-ng-add-repro` (or angular-typechecker) is NOT first-party and sets no `encapsulation`, so
   `shouldWrapSchematic` is `false` -> falls through to `NodeModulesEngineHost` -> `ExportStringRef`
   (`@angular-devkit/schematics/tools/export-ref.js`). Confirms a pure factory has NO extra sandbox and NO
   heavy transitive chain of its own.
2. **The factory MUST be the module's `default` export.** `ExportStringRef` (`inner=true`) does
   `require(module)[name || 'default']` (`export-ref.js:22`). The collection ref `"./index"` has no `#name`,
   so it resolves `require('.../index.js').default`. Verified against the built angular-typechecker factory:
   `dist/.../schematics/ng-add/schematic.js:21` = `exports.default = (0, devkit_1.convertNxGenerator)(...)`.
   => a hand-written CJS factory MUST use `exports.default = fn`, NOT `module.exports = fn` (the latter
   resolves to `undefined` -> `createSchematic` throws -> FALSE NEGATIVE that would fake a "general bug").
3. **Gate 1 (registry metadata) needs `package.json` `schematics`.** `loadPackageInfoTask` reads
   `manifest.schematics`; pinned doc confirms `yarn npm info` returns it. So the published package.json must
   carry `"schematics": "./collection.json"`.
4. **Fresh first-run is mandatory.** `cli.js:167-176` short-circuits (`executeSchematic`, bypassing the
   probe) when the package is ALREADY installed with a valid version. The gate pipeline (Gate 1 + Gate 3
   probe) only runs on a first `ng add` where the package is not yet present -- so the vanilla package must
   NOT be pre-added to the workspace's package.json/lockfile.

## 1. Minimal VANILLA package shape (3 files, no build, zero runtime deps)

Put at `D:\projects\sandbox\vanilla-ng-add-repro\`. Hand-write CJS -- no TypeScript, no tsc, no
`@angular-devkit/schematics` dependency (the `Tree`/`SchematicContext` are injected at call time).

```
vanilla-ng-add-repro/
  package.json
  collection.json
  index.js
```

**package.json** (minimal; `main`/`types` are irrelevant to ng-add resolution):
```json
{
  "name": "vanilla-ng-add-repro",
  "version": "0.0.1",
  "schematics": "./collection.json"
}
```

**collection.json** (`ng-add` is the reserved name the probe loads; `schema` is optional -- omit it):
```json
{
  "schematics": {
    "ng-add": {
      "factory": "./index",
      "description": "Vanilla ng-add repro -- writes a marker file. No nx, no heavy deps."
    }
  }
}
```

**index.js** (zero imports; `exports.default`; makes an OBSERVABLE on-disk change):
```js
'use strict';
exports.default = function (_options) {
  return function (tree, context) {
    context.logger.info('[vanilla-ng-add] SCHEMATIC RAN');
    tree.create('/VANILLA_NG_ADD_RAN.txt', 'vanilla ng-add ran\n');
    return tree;
  };
};
```

- The zero-import factory is the **cleanest possible control**: if even THIS fails the yarn probe, the bug
  is unambiguously in the CLI, not in any dependency. `ng add --skip-confirmation` (not `--dry-run`) commits
  the tree, so `VANILLA_NG_ADD_RAN.txt` lands at the workspace root = a hard, disk-level "it ran" assertion.
- **Do NOT pull `@schematics/angular` utilities** -- they would drag transitive deps and confound the
  comparison. Pure `@angular-devkit/schematics` (types only) or zero-import is the point. TypeScript is
  unnecessary; if used, compile `module: CommonJS` and keep `export default` (-> `exports.default`).

## 2. Discriminating test (reuse the existing harness, swap the package)

Adapt `C:\Users\LarsGyrupBrinkNielse\.claude\jobs\95152ba0\tmp\verdaccio-repro.mjs` (already does
startLocalRegistry + token mint + Verdaccio publish + fresh yarn-4 node-modules workspace + G1/G2/G3 cli.js
patch + first-run `ng add`). Changes:

- Publish the vanilla package dir instead of the angular-typechecker dist:
  `npm publish "D:/projects/sandbox/vanilla-ng-add-repro" --registry <url> --userconfig <pubrc>`.
- Skip the provenance strip (vanilla has no `publishConfig`).
- Swap `ng add angular-typechecker` -> `ng add vanilla-ng-add-repro --skip-confirmation --verbose`.
- Replace the WIRED? check with the marker assertion: `existsSync(join(WS, 'VANILLA_NG_ADD_RAN.txt'))`.
- Keep the G1/G2/G3 + `[G3-CATCH]` cli.js patch verbatim (it logs generically).
- **Add an npm control**: a second fresh workspace (npm, same @angular/cli 22.0.6, same Verdaccio) running
  `ng add vanilla-ng-add-repro`. This proves the package is well-formed regardless of the yarn outcome.

**Interpretation matrix:**

| yarn result | npm control | Verdict |
|-------------|-------------|---------|
| G3 OK + marker present (wires) | wires | **NX-SPECIFIC.** Failure needs the `@nx/devkit`->nx->chalk transitive chain under yarn's hoist. Do NOT file "ng add broken under yarn" upstream. Accurate scope stays "loading the nx-based factory throws in the yarn probe." |
| `[G3-CATCH]` fires / "no ng add actions", marker ABSENT | wires | **GENERAL Angular-CLI-under-yarn bug.** A dependency-free schematic fails the yarn probe. Fileable upstream (angular/angular-cli): bare `catch {}` masks the error AND the yarn-4 `ng add` probe path is broken/untested. |
| yarn fails AND npm also fails | fails | Package is malformed (likely the `exports.default` gotcha, #2) -- fix the repro, not a real finding. |

**Expected outcome + why:** yarn WIRES the vanilla package => **nx-specific**. The observed throw
(`chalk.blue is not a function` in `nx/node_modules/log-symbols`) is entirely inside nx's transitive tree; a
zero-dependency factory has no such chain, so Gate 3 `createSchematic('ng-add')` returns cleanly. This
would confirm the "do NOT attribute upstream" guard in the pinned doc's OPEN QUESTION.

## 3. Pitfalls / gotchas

1. **`exports.default`, never `module.exports`** (mechanism fact #2). The single highest-risk false
   negative -- a wrong export shape makes `createSchematic` throw and fakes a "general bug" result.
2. **Fresh first-run only** (fact #4). Do not pre-install/pre-add the vanilla package -- the already-installed
   short-circuit bypasses the probe entirely.
3. **Empty `yarn.lock` escapes the parent yarn project.** The harness already writes `yarn.lock=''` in the
   test workspace; keep it (the sandbox sits under a parent `~/.claude` yarn project otherwise).
4. **Verdaccio catch-all uplink.** `.verdaccio/config.yml` has a no-proxy block for `angular-typechecker`
   only; `vanilla-ng-add-repro` matches the `'**'` catch-all (proxies npmjs). Verdaccio serves
   locally-published packages from storage FIRST, so publish+install works as long as the name is unique
   (it is -- not on npm). `enableMirror:false` (already in the harness `.yarnrc.yml`) prevents the
   locator-keyed stale-mirror trap that bit the original spec.
5. **`--skip-confirmation`, not `--dry-run`.** Dry-run does not commit the tree, so the marker file never
   lands and the assertion would false-negative.
6. **OPTIONAL heavy-import variant (only if you need to characterize the boundary).** A second vanilla
   schematic whose `index.js` does `require('chalk')` (a v5 ESM-only) or an nx-adjacent dep would test
   whether ANY heavy transitive breaks the yarn probe vs. only nx's specific packaging. Skip unless the
   primary zero-dep result is ambiguous or the user wants the general/nx boundary mapped -- YAGNI for the
   binary question.

## 4. Where to put it

- **Package:** `D:\projects\sandbox\vanilla-ng-add-repro\` (3 files above). Standalone, NOT committed to the
  angular-typechecker repo.
- **Test workspace:** reuse the harness pattern -- copy the repo's
  `e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace` into a throwaway dir (job tmp or
  `D:\projects\sandbox\vanilla-ng-add-ws\`) and convert to yarn 4, exactly as `verdaccio-repro.mjs` does.
  `D:\projects\sandbox\angular220` is an alternative substrate (has app + `projects/`). Keep the repro
  self-contained and out of the tracked repo.
- **Harness script:** copy `verdaccio-repro.mjs` into the sandbox/job tmp and edit per section 2; it depends
  on the repo's `@nx/js` `startLocalRegistry` + `.verdaccio/config.yml`, so run it rooted at the repo but
  publishing/installing the vanilla package.

## Suggested plan shape (1-3 tasks)

1. Create `D:\projects\sandbox\vanilla-ng-add-repro\` (3 files).
2. Adapt + run the harness (yarn + npm control); capture G1/G2/G3/`[G3-CATCH]` + marker outcome.
3. Apply the matrix; record the verdict (nx-specific vs general CLI bug) and resolve the OPEN QUESTION in
   `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` (and the yarn-caveat todo).

## Sources

- HIGH: `node_modules/@angular/cli/src/commands/add/cli.js` (gates 167-278) -- installed 22.0.6.
- HIGH: `node_modules/@angular/cli/src/command-builder/utilities/schematic-engine-host.js:23-73` (`shouldWrapSchematic`, non-first-party -> default host).
- HIGH: `node_modules/@angular-devkit/schematics/tools/export-ref.js:12-27` (`require(mod)[name||'default']`).
- HIGH: `dist/packages/angular-typechecker/src/schematics/ng-add/schematic.js:21` (`exports.default = convertNxGenerator(...)`).
- HIGH: `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` (Post-24-05 root-cause pin + OPEN QUESTION).
- HIGH: existing harness `C:\Users\LarsGyrupBrinkNielse\.claude\jobs\95152ba0\tmp\verdaccio-repro.mjs`; mirrored `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts`.
</content>
</invoke>
