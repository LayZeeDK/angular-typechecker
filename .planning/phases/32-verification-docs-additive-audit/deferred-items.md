# Phase 32 - Deferred / Out-of-Scope Items

Discoveries logged during execution that are OUT OF SCOPE for the plan that found
them (per the executor scope-boundary rule: only auto-fix issues DIRECTLY caused by
the current task's changes).

## RESOLVED 2026-07-19 (commit `7a77b51`): the published tarball leaked dev-only `__snapshots__/*.snap` files

**Resolution:** Fixed in 32-02 (at the coordinator's direction -- fix now, not defer). Added
`ignore: ["**/__snapshots__/**"]` to the `**/!(*.ts)` build asset glob in
`packages/angular-typechecker/project.json`, so Vitest snapshots are no longer copied into
`dist/.../src/` while every real non-`.ts` asset still ships. Verified: `nx build angular-typechecker`
dist has zero `.snap` and all real assets present; `nx e2e angular-typechecker-install-e2e` GREEN
(11 files / 40 tests, including `tarball-audit` PKG-02 + `verdaccio-publish` REL-04 + install-smoke).
Build-config only -- no public API / executor id / schema / dependency / version change; restores
0.2.3's tarball to `@0.2.2`'s clean shape (additive-safe). The original analysis is retained below.

- **Discovered during:** 32-02 (VER-03), Task 3 verify gate (`nx e2e angular-typechecker-install-e2e`).
- **Symptom:** two e2e specs I did NOT modify are RED:
  - `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` > PKG-02
    "leaks no spec/tsconfig.spec/fixture/consumer files" -- fails on
    `src/core/__snapshots__/json-report.spec.ts.snap` matching `/\.spec\./`.
  - `e2e/angular-typechecker-install-e2e/src/verdaccio-publish.e2e.spec.ts` > REL-04
    "ships compiled JS + types with zero .ts source" -- the packed tarball carries
    four `.snap` files.
- **The four leaked files:**
  - `packages/angular-typechecker/src/core/__snapshots__/json-report.spec.ts.snap` (added Phase 30, `9c4f83c`)
  - `packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap` (added Phase 31, `e327693`)
  - `packages/angular-typechecker/src/core/__snapshots__/machine-reporters-json.integration.spec.ts.snap` (added 32-01, `0342534`)
  - `packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap` (added 32-01, `0342534`)
- **Root cause:** the plugin build asset glob in
  `packages/angular-typechecker/project.json` `targets.build.options.assets` is
  `{ input: "./packages/angular-typechecker/src", glob: "**/!(*.ts)", output: "./src" }`.
  It copies EVERY non-`.ts` file under `src/` into `dist/.../src/`, which includes the
  Vitest `__snapshots__/*.snap` files. The published `files: ["src", ...]` allowlist
  then packs them into the tarball. The leak has existed since Phase 30's first `.snap`;
  32-01 added two more. It surfaced only now because neither Phase 30/31 nor 32-01 ran
  the full `angular-typechecker-install-e2e` project in its verify gate.
- **Why NOT fixed in 32-02:** 32-02 is a VER-03 test-only plan (its charter and files
  are the three e2e `--format` specs + the `cli-e2e` helper). Fixing the leak requires
  editing the plugin build/packaging config (`project.json` asset glob and/or the
  `files`/npmignore surface), which is production packaging -- out of this plan's scope
  and outside the "test-only changes" additive-only charter. It is NOT caused by any
  32-02 change (32-02 added zero files under `packages/angular-typechecker/src/`).
- **Why NOT covered by 32-03 as planned:** 32-03 (ADD-01) audits the published-surface
  git-diff (executor id, public barrel, schemas, `dependencies`). The `.snap` files are
  additive NEW files, so a scoped git-diff of `index.ts`/schemas/`package.json` does not
  flag them, and the dependency proof is orthogonal. So 32-03 would report ADDITIVE-ONLY
  while the tarball is actually publish-incorrect.
- **Recommended fix (for a gap-closure plan `/gsd-plan-phase 32 --gaps`, or a quick task):**
  exclude Vitest snapshots from the shipped package -- e.g. narrow the build asset glob
  so `**/__snapshots__/**` / `*.snap` are not copied into `dist/.../src/`, OR add a
  `.npmignore` / negated `files` entry excluding `__snapshots__`. Then re-run
  `nx e2e angular-typechecker-install-e2e` to green. This must land BEFORE the v0.2.3
  Release-PR (a leaking tarball would fail publint/publish-correctness).
- **Not a regression from 32-02:** the `nx e2e angular-typechecker-install-e2e` failure
  reproduces identically at the pre-32-02 HEAD (the tarball is built from the plugin
  `src/`, which 32-02 did not touch).
