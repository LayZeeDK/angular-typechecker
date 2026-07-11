---
status: pass
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
source: [24-VERIFICATION.md, 24-ACV-01-UAT.md]
started: 2026-07-11T12:05:00Z
updated: 2026-07-11T14:10:00Z
---

## Current Test

ACV-01 executed autonomously (both gates run). Gate #1 PASS. Gate #2 initially FAILED --
found a real defect in the (UNRELEASED) v0.2.1 `configuration`/`ng-add` generator (silent
app-build-leaf under-checking on Angular-CLI-that-is-also-a-pnpm-workspace). Defect FIXED
(read projectType/root from angular.json on the CLI branch), regression-tested (CLI matrix +
Nx-collision lock), and gate #2 RE-VERIFIED on the real clone with the fixed build: PASS. See
"Fix + re-verification" below.

## Tests

### 1. ACV-01 real-clone gate #1 -- bluehalo/ngx-leaflet @ 818e9ae55240b570397ede5a15cb4d466785abdc (app ngx-leaflet-demo + lib ngx-leaflet)

expected: ng add auto-wires a typecheck target into BOTH projects (two-element tsConfig array, no stray nx.json). Clean baseline: both targets exit 0. Planted: the app target reports TS2322 + TS2345 but NOT TS2554; the lib target reports TS2554 but NEITHER app code. No ERR_REQUIRE_ESM / infrastructure error.
result: PASS
evidence: |
  Substrate: on-stack Angular 22, npm workspace (NO pnpm-workspace.yaml). Installed with
  NO --legacy-peer-deps (clean). `ng add <local dist .tgz> --skip-confirmation` printed the
  NO_CACHING_NOTICE and auto-wired BOTH projects:
    ngx-leaflet-demo -> {tsConfig:[tsconfig.app.json, tsconfig.spec.json]}
    ngx-leaflet      -> {tsConfig:[projects/ngx-leaflet/tsconfig.lib.json, projects/ngx-leaflet/tsconfig.spec.json]}
  No stray nx.json; no .nx/ materialized. Clean baseline: both targets exit 0.
  - Run A (lib COMPONENT plant, leaflet.directive.ts TS2554): app target = TS2322 + TS2345
    + TS2554; lib target = TS2554 only. The app ALSO reporting TS2554 is CORRECT behaviour,
    NOT a scoping bug: the demo app imports the library by RELATIVE SOURCE path
    (`import { LeafletDirective } from 'projects/ngx-leaflet/src/public-api'`), so the library
    source is genuinely part of the app's compilation program. The load-bearing direction
    (library target does NOT bleed app code) holds.
  - Run B (clean bidirectional, library-SPEC plant leaflet.util.spec.ts TS2554, app-invisible):
    app target = TS2322 + TS2345 (NOT TS2554); lib target = TS2554 (NOT app codes). Clean
    per-project scoping proven. No ERR_REQUIRE_ESM / infrastructure error on any run; the
    shipped CJS->ESM `await import()` bridge survives packaging + `ng run`.

### 2. ACV-01 real-clone gate #2 -- realworld-angular/realworld-angular @ 9e3528ff27bad5fedaefb879ccc4aaf4717b137b (single application, app-only)

`ng add angular-typechecker`, plant app-component TS2322 + app-spec TS2345, run `ng run realworld-angular:typecheck`.

expected: ng add wires a typecheck target into the single application (leaves [tsconfig.app.json, tsconfig.spec.json], no stray nx.json). Clean baseline exits 0. Planted: the target reports BOTH TS2322 and TS2345 (build leaf + spec leaf both checked) and exits non-zero; no ERR_REQUIRE_ESM / infrastructure error.
result: PASS (after fix) -- initially FAILED (defect below), now fixed + re-verified on the real clone
evidence: |
  Substrate: on-stack Angular 22.0 / TS 6.0.3, MIT, non-Nx, `@angular/build:application`,
  BUT also a pnpm workspace (ships pnpm-workspace.yaml + pnpm-lock.yaml; packageManager pnpm).

  INSTALL FINDINGS (resolved; not the defect):
  - `npm install` ERESOLVE-fails at this SHA due to the REPO'S OWN lagging devDeps
    (`@angular-eslint/*@21.3.1` peer-caps @angular/cli <22; `@angular/cdk@^21`) -- unrelated to
    angular-typechecker, whose peers (@angular/compiler-cli ^22, typescript ~6.0.3) are on-stack.
  - Working around with npm `--legacy-peer-deps` then SUPPRESSES npm's auto-install of the `nx`
    transitive peer of @nx/devkit -> the ng-add schematic AND the builder crash with
    `Cannot find module 'nx/src/devkit-exports'`. (angular-typechecker deliberately does not
    declare `nx`; it flows in via @nx/devkit's peer, which relies on the PM auto-installing peers.)
  - PROPER pnpm approach (works, no flag, no repo migration): pnpm 9 is lenient on the eslint peer
    warning, and `auto-install-peers` (default on) brings in `nx@23.0.2` as @nx/devkit's peer.
    Because `angular-typechecker@0.2.0` is ALSO published on npm (the v0.2.0 artifact, WITHOUT
    the new Angular-CLI ng-add), install the LOCAL dist tarball explicitly and run the schematic
    against it -- NEVER `ng add <name>` (which would fetch the wrong published artifact):
      pnpm add -w -D <local dist .tgz>        # installs local tarball + nx peer
      ng g angular-typechecker:ng-add         # runs the ng-add schematic against the local install
    (`ng add <file:tarball>` fails under pnpm: "Unable to fetch package information" -- a known
    pnpm+file:-spec limitation; decouple install from schematic.)

  DEFECT (BLOCKER -- the reason gate #2 fails):
  - `ng g angular-typechecker:ng-add` (and `ng g angular-typechecker:configuration realworld-angular`)
    wired `{tsConfig:["tsconfig.spec.json"]}` -- ONLY the spec leaf. The app BUILD leaf
    `tsconfig.app.json` was SILENTLY DROPPED, even though it exists at the workspace root. So
    `ng run realworld-angular:typecheck` checks ONLY the spec program; app source not reachable
    from any spec is UNCHECKED. Silent under-checking is the worst failure mode for a tool whose
    charter is the COMPLETE type-check and NEVER-false-pass.
  - ROOT CAUSE (empirically isolated): the CLI-branch generator trusts
    `readProjectConfiguration(tree, project).projectType`. On this workspace that returns a STUB
    (root=".", projectType=undefined, targets=[]) instead of the angular.json project, because the
    presence of `pnpm-workspace.yaml` makes Nx infer a package.json-based project (package.json
    `name` == angular.json project name "realworld-angular") that SHADOWS the angular.json project.
    With projectType=undefined, `resolveTsConfigLeaves` takes the library else-branch
    (`tsconfig.lib.json`, absent) and never probes the existing `tsconfig.app.json`.
    Verified: identical under nx 23.0.1 and 23.0.2; moving `pnpm-workspace.yaml` aside makes
    `readProjectConfiguration` return projectType="application" and the app leaf resolves. The
    ACV-02 committed scaffold (npm, no pnpm-workspace.yaml) cannot reproduce it -> only a real
    clone caught it (ACV-01's exact purpose).
  - RUNTIME IS SOUND: hand-wiring the correct `[tsconfig.app.json, tsconfig.spec.json]` and running
    `ng run realworld-angular:typecheck` gave a clean baseline exit 0 and, with planted TS2322
    (component footer.ts) + TS2345 (spec footer.spec.ts), exit 1 reporting BOTH codes, NO
    ERR_REQUIRE_ESM / infrastructure error. The builder + CJS->ESM bridge + engine work on
    realworld too; the ONLY defect is the generator's projectType-driven leaf resolution.

  RECOMMENDED FIX (CLI-branch-scoped, additive): on the angular.json write-fork, read `projectType`
  (and `root`) DIRECTLY from angular.json (`json.projects[project]`) rather than from
  `readProjectConfiguration`, then keep the convention-based leaf probe. Add a regression fixture:
  an angular.json app that ALSO carries a pnpm-workspace.yaml with a name-colliding package.json,
  asserting the wired tsConfig is [tsconfig.app.json, tsconfig.spec.json]. Scope: Phase-22
  `configuration` generator (Phase-23 ng-add composes it). Nx branch (project.json projectType) unaffected.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Fix + re-verification (2026-07-11, autonomous)

DEFECT FIXED in `packages/angular-typechecker/src/generators/configuration/generator.ts`:
the Angular CLI write-fork now reads `root`/`projectType` STRAIGHT from `angular.json`
(`readJson(...).projects[project]`) instead of `readProjectConfiguration`, immune to the
pnpm-inferred package stub. `resolveTsConfigLeaves` takes `(tree, root, projectType, schema)`.
The Nx else-branch is byte-unchanged (project.json is authoritative there).

Regression tests (in-repo, CI-authoritative):
- `configuration-angular-cli.spec.ts` -- 3 ACV-01 cases (pnpm-workspace + name collision):
  ROOT app -> [app, spec] (was: [spec] only; this is the RED that reproduced the bug),
  SUBDIR app -> [app, spec], SUBDIR library -> [lib, spec]. Assert angular.json DIRECTLY
  (readProjectConfiguration returns the shadowing stub, which carries no target).
- `configuration.spec.ts` -- 1 Nx-branch full-matrix lock: package.json name === project.json
  name + pnpm-workspace -> target lands on the correct project (Nx robustness locked).

Gates: nx test (all pass incl. the 4 new), lint, dogfood typecheck, build, prettier -- all green.

Real-clone re-verification with the FIXED tarball:
- realworld-angular (pnpm workspace): `ng g angular-typechecker:ng-add` now auto-wires
  [tsconfig.app.json, tsconfig.spec.json] (was [tsconfig.spec.json]); no stray nx.json; clean
  baseline exit 0; planted TS2322 (build leaf) + TS2345 (spec leaf) both caught, exit 1, no
  ERR_REQUIRE_ESM. Gate #2 now PASSES.
- ngx-leaflet (npm workspace): re-ran `ng add` with the fixed tarball -> both projects still
  wire [app/lib, spec] correctly. No regression on the npm path.

Versioning: the fix is INSIDE the additively-new, UNRELEASED Angular CLI generator (v0.2.0 --
the last published version -- has NO Angular CLI generator at all). So additive-only vs v0.2.0
still HOLDS; the fix does NOT trigger v0.3.0. 24-ADDITIVE-AUDIT.md updated accordingly.

## Blast radius (investigated 2026-07-11 via synthetic FsTree matrix)

EXACT trigger (both conditions required): (1) `pnpm-workspace.yaml` present AND (2) the root
`package.json` `name` === the angular.json project name. Verified by a 7-case matrix over
`readProjectConfiguration(tree, project).projectType` + the leaves `resolveTsConfigLeaves` would wire:

| Config | projectType | wired leaves | verdict |
|--------|-------------|--------------|---------|
| plain npm, no manifest, name match | application | [app, spec] | OK |
| npm + package-lock.json, name match | application | [app, spec] | OK |
| pnpm-workspace + name MATCH (root app) | undefined | [spec] | BUG: silent under-check |
| pnpm-workspace + name MISMATCH | application | [app, spec] | OK |
| npm/yarn `workspaces` field + name match | application | [app, spec] | OK |
| pnpm-workspace + name match + app in SUBDIR | undefined | [] | BUG: `resolveTsConfigLeaves` THROWS |
| pnpm-workspace + no package.json name | application | [app, spec] | OK |

Not triggered by npm/yarn workspaces, by a lockfile alone, by a name mismatch, or by a missing
package.json name. Two failure modes: root app -> silent spec-only under-check; subdir app -> hard
throw ("Could not resolve a tsconfig ... Pass --tsConfig explicitly"). Escape hatch: an explicit
`--tsConfig` short-circuits the resolver, but auto-wire-all (`ng add`) never passes it.

## Gaps

- RESOLVED (2026-07-11): the CLI-branch tsConfig mis-resolution on an Angular CLI + pnpm
  workspace with a name-colliding root package.json is FIXED (read projectType/root from
  angular.json) + regression-tested (CLI matrix + Nx-collision lock) + re-verified on the real
  clone. See "Fix + re-verification" above. No open gaps.
