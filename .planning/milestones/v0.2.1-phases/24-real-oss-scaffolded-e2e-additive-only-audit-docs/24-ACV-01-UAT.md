---
status: executed-fail
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
source: [24-03-PLAN.md, 24-RESEARCH.md, 24-CONTEXT.md]
scope: ACV-01 milestone-FINAL real-clone tarball gate (MANUAL/local -- clones UNCOMMITTED, reproduced from URL + SHA; NOT a CI test)
gate: manual (D-02)
substrate: on-stack Angular 22 ONLY (off-stack Angular 21 DROPPED)
created: 2026-07-11
executed: 2026-07-11 (autonomous per HANDOFF)
reverified: 2026-07-15 (post-24-06 HEAD; quick task 260715-ig5) -- BOTH gates PASS again on the
  nx-free vanilla ng-add. See "## Re-run 2026-07-15 (post-24-06)" below + 260715-ig5-SUMMARY.md /
  260715-ig5-VERIFICATION.md.
outcome: gate #1 (ngx-leaflet) PASS; gate #2 (realworld-angular) initially FAILED -- found a
  real generator defect (silent app-build-leaf drop on Angular-CLI-that-is-also-a-pnpm-workspace);
  DEFECT FIXED + regression-tested + gate #2 RE-VERIFIED on the real clone with the fixed build:
  PASS. All three tests now pass. Full evidence + root cause + fix in 24-HUMAN-UAT.md.
  RE-VERIFIED 2026-07-15 against post-24-06 HEAD (see re-run section).
---

## About this gate

This is the **reproducible UAT procedure** for ACV-01, the milestone's FINAL real-clone
tarball gate. It is a **MANUAL / local gate** (D-02): the two OSS clones are UNCOMMITTED, so a
committed CI test cannot run them. Reproduction is by **repo URL + pinned commit SHA**. Run it
by hand at phase verification and record the `result:` / `evidence:` fields; it is surfaced in
VALIDATION.md's Manual-Only section.

The **CI-authoritative** proof of the same `ng add` -> `ng run <project>:typecheck` flow is
**ACV-02** -- the automated `angular-typechecker-ng-cli-e2e` project shipped in this same plan,
which runs the identical flow against a committed, pinned Angular 22 fixture with no external
clone. ACV-01 is the human-run confidence gate ON TOP of ACV-02, against two REAL on-stack OSS
workspaces.

**Substrate (on-stack Angular 22 ONLY, IN THIS ORDER):**

1. **`bluehalo/ngx-leaflet`** @ `818e9ae55240b570397ede5a15cb4d466785abdc` -- app
   `ngx-leaflet-demo` + library `ngx-leaflet` (MIT, non-Nx `angular.json`). Gives the app+lib
   per-project-scoping coverage. The same clone Phase-21 GATE A' (spike 011) used.
2. **`realworld-angular/realworld-angular`** @ `9e3528ff27bad5fedaefb879ccc4aaf4717b137b` --
   a SINGLE application `realworld-angular` (MIT, non-Nx `angular.json`, `@angular/build:application`).
   Breadth/confidence on a second exact-stack repo. Run AFTER ngx-leaflet.

Off-stack Angular 21 stays DROPPED everywhere. On-stack Angular 22 needs NO `--legacy-peer-deps`.

**Windows / MSYS tar gotcha:** when packing the tarball on Git Bash, use `/d/...` style paths,
NOT `D:/...` -- Git Bash mis-parses the `D:` drive letter as a remote host
([[oss-real-repo-verification]]).

**Planted diagnostics (distinct raw TS code per leaf, mirroring ACV-02):**

- app **component** leaf (`tsconfig.app.json`): assign a number to a `string` field -> **TS2322**.
- app **spec** leaf (`tsconfig.spec.json`): pass a string where `Math.abs` wants a number -> **TS2345**.
- library **component** leaf (`tsconfig.lib.json`): call `parseInt()` with zero args -> **TS2554**.

Distinct codes let each `ng run <project>:typecheck` prove it caught EXACTLY its own leaves and
no other project's leaf leaked in.

## Re-run 2026-07-15 (post-24-06)

Re-executed against post-24-06 HEAD (the nx-free vanilla `ng-add`) as quick task **260715-ig5**,
to close the LOW-risk pre-release confirmation the Phase-24 verifier flagged (24-06 rewrote the
exact `ng add` code path AFTER the 2026-07-11 UAT). **Both gates PASS.**

- **Fresh tarball:** `nx build` + `npm pack` of the built dist -> `angular-typechecker-0.2.0.tgz`;
  the packed `src/schematics/ng-add/schematic.js` is nx-free (24-06 delta confirmed in the SHIPPED
  artifact); compiled `.js` + `builders.json`/`collection.json`/`executors.json`/`generators.json`,
  0 raw `.ts`.
- **Gate #1 (ngx-leaflet @818e9ae, npm):** a SINGLE `ng add <tarball>` auto-wired BOTH projects
  FIRST-RUN with 2-element `tsConfig` arrays, no nx.json; clean baseline both exit 0; per-project
  scoping clean bidirectional (app=TS2322+TS2345, lib=TS2554, no cross-bleed); no `ERR_REQUIRE_ESM`.
- **Gate #2 (realworld-angular @9e3528f, pnpm-workspace + name-collision):** `ng add <tarball>`
  blocked at the pnpm install by `ERR_PNPM_ADDING_TO_ROOT` (Angular-CLI/pnpm mechanics, not an
  angular-typechecker defect) -> used the documented pnpm-native `pnpm add -w -D` + `ng g` path
  (force-fresh, guarding the stale 2026-07-11 nx-based install). The vanilla 24-06 ng-add wired the
  FULL `[tsconfig.app.json, tsconfig.spec.json]` array (app build leaf NOT dropped under the
  collision), no nx.json; clean baseline exit 0; planted TS2322 (build leaf) + TS2345 (spec leaf)
  both surfaced, exit 1; no `ERR_REQUIRE_ESM`.

Evidence: `.planning/quick/260715-ig5-re-run-the-acv-01-manual-real-clone-tarb/`
(`260715-ig5-SUMMARY.md`, `260715-ig5-VERIFICATION.md`). Clones remain UNCOMMITTED scratch,
restored to their pinned SHAs. No product/test/version change.

## Current Test

[executed 2026-07-11 autonomously per HANDOFF -- see result fields + 24-HUMAN-UAT.md;
re-verified 2026-07-15 post-24-06 -- see the re-run section above]

## Tests

### 1. Build + pack the shipped tarball

expected: |
  `npx nx build angular-typechecker --skip-nx-cache` exits 0; packing the built dist
  produces `angular-typechecker-<version>.tgz` whose `package/src/**` entries are compiled
  `.js` + `.d.ts` (NO raw `.ts`) and which ships `builders.json`, `collection.json`,
  `executors.json`, and the schema files. This is the EXACT artifact `nx release publish`
  ships.
steps: |
  ```bash
  npx nx build angular-typechecker --skip-nx-cache
  # Pack from the dist dir. MSYS: use /d/... not D:/... so Git Bash tar does not
  # mis-parse the drive letter as a remote host.
  cd /d/projects/github/LayZeeDK/angular-typechecker/dist/packages/angular-typechecker
  TGZ=$(npm pack --json | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)[0].filename))")
  tar -tzf "$TGZ" | rg '\.js$|\.d\.ts$|builders\.json|collection\.json'   # compiled JS, no raw .ts
  ABS_TGZ="$PWD/$TGZ"   # absolute path for the ng add / npm install below
  ```
result: pass
evidence: "Fresh nx build + npm pack of dist: angular-typechecker-0.2.0.tgz, 25 compiled .js, 0 raw .ts, ships builders.json/collection.json/executors.json/generators.json + src/index.js|.d.ts."

### 2. bluehalo/ngx-leaflet (app + library) -- ng add auto-wire-all, per-project ng run scoping

expected: |
  On `bluehalo/ngx-leaflet` @ `818e9ae55240b570397ede5a15cb4d466785abdc` (on-stack
  Angular 22, MIT, non-Nx), `ng add angular-typechecker` (installed from the packed tarball)
  auto-wires a `typecheck` architect target into BOTH the application `ngx-leaflet-demo` and
  the library `ngx-leaflet`, with a two-element `tsConfig` array per project (build leaf +
  spec leaf) and NO stray `nx.json`. On the CLEAN tree, `ng run ngx-leaflet-demo:typecheck`
  and `ng run ngx-leaflet:typecheck` each exit 0. With per-leaf errors planted, the APP target
  reports its own TS2322 (component) AND TS2345 (spec) but NOT the library's TS2554; the
  LIBRARY target reports TS2554 but NEITHER app code. No `ERR_REQUIRE_ESM`, no infrastructure
  error -- the non-zero exits are real diagnostics.
steps: |
  ```bash
  # Clone + pin (reproduction is URL + SHA).
  git clone https://github.com/bluehalo/ngx-leaflet /d/projects/github/bluehalo/ngx-leaflet
  cd /d/projects/github/bluehalo/ngx-leaflet
  git checkout 818e9ae55240b570397ede5a15cb4d466785abdc
  npm install            # on-stack Angular 22 -- NO --legacy-peer-deps

  # Install the packed tarball + run the ng-add schematic (auto-wires ALL projects).
  npx ng add "$ABS_TGZ" --skip-confirmation
  # Assert auto-wire-all: angular.json projects.ngx-leaflet-demo.architect.typecheck and
  # projects.ngx-leaflet.architect.typecheck both use builder angular-typechecker:typecheck
  # with a two-element tsConfig array; assert NO nx.json was created.
  test ! -f nx.json && echo "no stray nx.json (OK)"

  # CLEAN baseline: both targets green.
  npx ng run ngx-leaflet-demo:typecheck   # expect exit 0
  npx ng run ngx-leaflet:typecheck        # expect exit 0

  # Plant DISTINCT per-leaf errors:
  #  - app component (src/.../*.component.ts):  add `readonly atcPlant: string = 123;` -> TS2322
  #  - app spec      (src/.../*.spec.ts):       add `Math.abs('x');`                   -> TS2345
  #  - lib component (projects/ngx-leaflet/src/.../*.ts): add `readonly atcLib = parseInt();` -> TS2554
  npx ng run ngx-leaflet-demo:typecheck   # expect non-zero; stdout HAS TS2322 + TS2345, NOT TS2554
  npx ng run ngx-leaflet:typecheck        # expect non-zero; stdout HAS TS2554, NOT TS2322/TS2345
  # Revert the plants -> both targets return to green.
  git checkout -- .
  ```
result: pass
evidence: "npm workspace (no pnpm-workspace.yaml), on-stack, NO --legacy-peer-deps. ng add auto-wired BOTH projects with 2-element tsConfig arrays, no stray nx.json; clean baseline both exit 0; per-project scoping proven (Run B: app=TS2322+TS2345, lib=TS2554, bidirectional no-bleed); no ERR_REQUIRE_ESM. See 24-HUMAN-UAT.md gate #1."

### 3. realworld-angular/realworld-angular (single application) -- ng add + per-leaf ng run scoping

expected: |
  On `realworld-angular/realworld-angular` @ `9e3528ff27bad5fedaefb879ccc4aaf4717b137b`
  (exact-stack Angular 22.0 / TS 6.0.3, MIT, non-Nx, `@angular/build:application`),
  `ng add angular-typechecker` wires a `typecheck` target into the single application
  `realworld-angular` (app-only; leaves `[tsconfig.app.json, tsconfig.spec.json]`) with NO
  stray `nx.json`. On the CLEAN tree `ng run realworld-angular:typecheck` exits 0. With a
  planted TS2322 in an app component AND a planted TS2345 in an app spec, the target reports
  BOTH codes (proving the build leaf AND the spec leaf were checked) and exits non-zero; no
  `ERR_REQUIRE_ESM` / infrastructure error. (App-only repo -> no cross-project library leg;
  ngx-leaflet already covers the app-vs-library scoping.)
steps: |
  ```bash
  git clone https://github.com/realworld-angular/realworld-angular /d/projects/github/realworld-angular/realworld-angular
  cd /d/projects/github/realworld-angular/realworld-angular
  git checkout 9e3528ff27bad5fedaefb879ccc4aaf4717b137b
  npm install            # on-stack Angular 22 -- NO --legacy-peer-deps

  npx ng add "$ABS_TGZ" --skip-confirmation
  test ! -f nx.json && echo "no stray nx.json (OK)"

  npx ng run realworld-angular:typecheck   # CLEAN baseline: expect exit 0

  # Plant: app component -> TS2322 (readonly atcPlant: string = 123;)
  #        app spec      -> TS2345 (Math.abs('x');)
  npx ng run realworld-angular:typecheck   # expect non-zero; stdout HAS TS2322 + TS2345
  git checkout -- .                        # revert -> green
  ```
result: PASS (after fix)
evidence: "pnpm workspace. INSTALL (proper path, documented): pnpm-native -- auto-install-peers brings nx (npm --legacy-peer-deps SUPPRESSES the nx peer -> crash); install the LOCAL tarball via `pnpm add -w -D <tgz>` + `ng g angular-typechecker:ng-add` (NOT `ng add <name>` -- would fetch the published v0.2.0). Initially FAILED: the schematic wired ONLY [tsconfig.spec.json], dropping the app build leaf (readProjectConfiguration returns projectType=undefined on an angular.json+pnpm-workspace+name-collision workspace -- Nx infers a shadowing package stub). FIXED: CLI branch now reads projectType/root from angular.json directly. RE-VERIFIED with the fixed tarball: ng-add auto-wired [tsconfig.app.json, tsconfig.spec.json], no stray nx.json, clean baseline exit 0, planted TS2322 (build leaf) + TS2345 (spec leaf) caught, exit 1, no ERR_REQUIRE_ESM. Full detail in 24-HUMAN-UAT.md."

## Summary

total: 3
passed: 3
pending: 0
issues: 0
skipped: 0
blocked: 0

## Gaps

- RESOLVED (2026-07-11): the gate-#3 defect (CLI-branch app-build-leaf drop on an Angular CLI +
  pnpm workspace with a name-colliding root package.json) is FIXED (read projectType/root from
  angular.json), regression-tested (CLI matrix + Nx-collision lock), and gate #3 re-verified PASS
  on the real clone with the fixed build. No open gaps. See 24-HUMAN-UAT.md "Fix + re-verification".

## Notes

- This gate is MANUAL by design (D-02): the clones are UNCOMMITTED, so the CI-authoritative
  proof of the identical `ng add` -> `ng run <project>:typecheck` flow is ACV-02 (the committed
  scaffolded `angular-typechecker-ng-cli-e2e` project, shipped in 24-03). ACV-01 is the human
  confidence gate on top, against two REAL on-stack OSS workspaces.
- On-stack Angular 22 needs NO `--legacy-peer-deps`. Off-stack Angular 21 is DROPPED everywhere;
  the consumer `--legacy-peer-deps` README note remains only as guidance for Angular-<22
  consumers hitting the `@angular/compiler-cli ^22.0.0` / TS-6 peer cap (Pitfall 6), NOT a test tier.
- `ng add` pulls `nx` transitively (via `@nx/devkit`'s peer) and may materialize a `.nx/` dir in
  the workspace -- expected (Pitfall C, documented in the README). It does NOT create an `nx.json`
  (the init fork on the Angular CLI branch seeds no caching).
