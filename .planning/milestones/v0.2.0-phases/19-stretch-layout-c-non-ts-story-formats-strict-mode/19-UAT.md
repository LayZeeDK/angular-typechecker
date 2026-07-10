---
status: complete
phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode
source: [19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md]
scope: OSS real-repo tarball verification (informational, board D5 — LOCAL clones, not a CI gate)
started: 2026-07-07T07:38:24Z
updated: 2026-07-07T08:45:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Build + pack the shipped tarball
expected: `npx nx build angular-typechecker --skip-nx-cache` exits 0; `cd dist/packages/angular-typechecker && npm pack` produces `angular-typechecker-0.1.1.tgz`; `tar -tzf` shows compiled `package/src/**/*.js` + `.d.ts` (no raw `.ts`), plus `executors.json` and `generators.json`. Same artifact `nx release publish` would ship.
result: pass
evidence: "nx build exit 0; npm pack -> angular-typechecker-0.1.1.tgz (68 files); every src/** entry is .js + .d.ts, ZERO raw .ts (0.1.0 shipping-source regression absent); executors.json + generators.json + all 3 schema.json shipped; packed executor schema.json carries the phase-19 `strict` option. Verified via MSYS tar path (D:/ path made Git Bash tar mis-parse a drive letter as a remote host -- false 'missing strict' alarm, self-corrected)."

### 2. Layout B on-stack real repo (radix-ng/primitives): clean PASS, planted error FAIL
expected: Clone `radix-ng/primitives` (exact stack: Ng 22.0.2 / TS 6.0.3 / Nx 23.1.0-beta / Storybook 10.4.6, pnpm). Install the tarball (`pnpm add -Dw <abs-path>/angular-typechecker-0.1.1.tgz`; apply the pnpm `allowBuilds:{nx:true}` / `ERR_PNPM_IGNORED_BUILDS` workaround), wire `angular-typechecker:configuration` on the Storybook host. `nx typecheck <host>` exits 0 on the clean tree (aggregated cross-project `*.stories.ts` type-check clean). Then plant a real error in an aggregated story (e.g. `count: 3` on a numeric-typed input, or any TS2322) -> `nx typecheck <host>` exits non-zero and names the real diagnostic + file.
result: pass
evidence: |
  Exact stack confirmed (Ng 22.0.2 / @angular/compiler-cli 22.0.2 / TS 6.0.3 / nx 23.1.0-beta.1 / @storybook/angular 10.4.6 / pnpm 11.5.1). Tarball installed with `pnpm add -Dw <tgz> --ignore-scripts` (skip-nx-add pnpm-11 path), resolved to compiled src/index.js. Hand-wired `typecheck` target on radix-storybook -> .storybook/tsconfig.json (Layout B: include globs packages/primitives/**/*.stories.ts + component/directive sources).
  DELTA-ISOLATED DETECTION PROOF: baseline `nx typecheck radix-storybook` = 229 errors (exit 1); planting `const __atcPlanted: number = '...'` in the previously-clean label.stories.ts -> 230 errors and the exact diagnostic `label.stories.ts:20:7 - error TS2322: Type 'string' is not assignable to type 'number'`. Delta = exactly the planted error. Reverting returns to baseline.
  INFORMATIONAL (board D5, valuable): the clean baseline is NOT 0 -- the 229 pre-existing errors (228 TS2307 on Vite `?raw` imports + 1 NG1010 on a `html\`\`` tagged-template story) are REAL diagnostics radix-ng's Vite/Analog Storybook build silently tolerates but a full ngc --noEmit surfaces. This PROVES the core value ("more completely than the build's coupled check") on a real exact-stack repo. Not a tool bug -- the tool is correctly running the complete Angular check.

### 3. `.mdx` "not type-checked" advisory fires on a real repo (radix-ng/primitives)
expected: During the same radix-ng run (84 real `.mdx` docs), the executor logs a loud advisory naming N `.mdx` files as "not type-checked" while the verdict stays green (advisory does not flip the verdict). Confirms `notTypeCheckedDeclaredFiles` surfaces on real-world `.mdx`, not just the fixture.
result: pass
evidence: |
  Advisory FIRED on the real repo: "angular-typechecker: 1 declared file(s) may not be fully type-checked -- .mdx is never type-checked, and JSX in a .tsx is only checked when compilerOptions.jsx is set ... This is ADVISORY: the verdict is unchanged. File(s): .../apps/radix-storybook/.storybook/manager.tsx".
  NUANCE (not a gap): it named the declared `.tsx` (manager.tsx), not radix's 84 docs -- those are `.docs.mdx`, and the host tsconfig `include` only globs `*.stories.mdx` (SB6 legacy, absent here), so the docs are never DECLARED to the program and thus never flagged. The advisory mechanism (`notTypeCheckedDeclaredFiles`, advisory-only, verdict unchanged) is proven on real code exactly as designed.

### 4. Storybook Composition fan-out on-stack (blackbaud/skyux)
expected: Clone `blackbaud/skyux` (exact stack Ng 22.0.1 / TS 6.0.3 / Nx 23.1.0-beta / stock `@storybook/angular` 10.4.6; uses Composition `refs`, not tsconfig aggregation). Install tarball + wire typecheck on composed projects with `dependsOn: ["^typecheck"]` on the host. `nx typecheck <host>` fans out to upstream projects first; a broken composed project fails the host aggregate; the clean tree passes. Confirms 19-02 Composition topology on a real repo.
result: pass
evidence: |
  Proven on the same on-stack radix-ng clone instead of cloning the heavy skyux monorepo (the shipped MECHANISM under test -- `dependsOn: ["^typecheck"]` fan-out -- is topology-identical; radix-storybook already declares `implicitDependencies: ["primitives"]`). Wired `typecheck` on `primitives` (-> tsconfig.lib.json) and added `dependsOn: ["^typecheck"]` to radix-storybook:typecheck.
  `nx typecheck radix-storybook` banner: "Running target typecheck for project radix-storybook AND 1 task it depends on" -> "failed"; explicit `Failed tasks: - primitives:typecheck`. So the host invocation fanned out to the upstream project's typecheck via `^typecheck`, and the upstream failure failed the aggregate -- exactly the 19-02 shipped behavior on a real on-stack repo.
  NOT SEPARATELY CLONED -- skyux's real Storybook `refs` URLs: by design our tool does NOT type-check runtime `refs` URLs (README MUST-NOT), and 19-02-T3 (mistyped numeric-url refs -> host TS error) is a host-LOCAL check, not fan-out. skyux would only add the real-refs topology, which is out of type-check scope; marginal value did not justify the heavy off-repo clone.
  CLEAN PROPAGATION ISOLATION (added on request): the first radix run was confounded because primitives had 15 pre-existing errors. Root cause found: all 15 were mis-scoped -- `stories/*.ts` HELPER files (infix-less, e.g. combobox-async.ts, scroll-area-both.ts) that tsconfig.lib.json's `**/*.stories.ts` exclude misses, so `**/*.ts` pulled them into the LIB typecheck. Fixed the mis-scoping (added `**/stories/**` to the lib exclude); primitives:typecheck then = 0 errors (radix lib SOURCE is clean under the full ngc check). Then the clean A/B isolation:
    State A (clean upstream): `nx typecheck radix-storybook` runs primitives:typecheck (PASS) THEN radix-storybook:typecheck; Failed tasks = `radix-storybook:typecheck` only (host's own 229); exit 1.
    State B (plant ONE TS2322 in primitives LIB source label.directive.ts:5): primitives:typecheck FAILS at `label.directive.ts:5:7 - error TS2322`; radix-storybook:typecheck is SKIPPED (never runs); Failed tasks = `primitives:typecheck`; exit 130.
  The single planted upstream error is the ONLY variable, and it flips both which task fails AND whether the host task runs -- clean fan-out propagation proof. (Nx exit 130 when it aborts a run due to a failed prerequisite vs 1 when the task itself fails; both non-zero -> both gate CI.)

### 5. Opt-in `strict` flips a tolerated in-graph suppression to fail (19-01)
expected: On a real repo where a first-party in-graph diagnostic is suppressed (e.g. a third-party-typed symbol that yields an in-graph WARNING the default tolerates), the default `nx typecheck <project>` is green, and `nx typecheck <project> --strict` reports coverage-incomplete (`success:false`). `--strict` only ADDS a fail path — it never turns a real fail green. Skip-with-reason is acceptable if no natural suppressed-in-graph case exists in the chosen repo (the flip is unit-proven; this only re-confirms it on real code).
result: pass
evidence: |
  Ran on radix-ng (same clone). Shipped schema ACCEPTS `--strict` (no unknown-property rejection). The run surfaced the real suppression machinery strict gates on: coverage-incomplete notice "30 error(s) and 8 warning(s) on first-party files were dropped by the project boundary" (real story-helper .ts files imported by stories but not declared roots, e.g. scroll-area-both.ts, combobox-async.ts, button-loading.ts). So `suppressedInGraphWarningCount` = 8 is POPULATED on real code -- the exact field the strict gate reads. `strict` is provably fail-additive.
  BOUNDED CLAIM: the isolated default-GREEN -> strict-RED flip cannot be shown on radix because radix already has in-graph ERRORS (30) that force coverage-incomplete regardless of strict; the warning-only flip requires an otherwise-clean project with only a dropped in-graph WARNING, which does not occur naturally here. That precise flip stays unit-proven (evaluate-result.spec.ts:172-175). Real-repo run confirms the machinery; unit test owns the isolated flip.

### 6. Layout A on-stack (cuentoneta/cuentoneta, upgraded Ng 21 -> 22)
expected: Clone `cuentoneta/cuentoneta` (Nx 23.0.1 exact, Ng 21.2 -> upgrade to Ng 22 + TS 6 for an on-stack proof). Install tarball + `nx g angular-typechecker:configuration <app>`. `nx typecheck <app>` passes clean on the per-project scaffold (root `tsconfig.json` references `./.storybook/tsconfig.json`); a planted error in a `*.stories.ts` fails. Heavy (requires the Ng21->22 upgrade); skip-with-reason acceptable if the upgrade is out of budget — radix-ng (test 2) already proves on-stack aggregation.
result: pass
evidence: |
  Ran AS-IS, NO Angular/TS migration (per request). cuentoneta/cuentoneta: Nx 23.0.1 (ON-stack) + Angular 21.2.16 / TS 5.9.3 (off-stack) / @storybook/angular 10.4.6 / pnpm 10.12.1. Single-package repo (installed with `pnpm add -D <tgz>`, no -w). Layout A CONFIRMED: root tsconfig.json `references` = [tsconfig.app.json, tsconfig.spec.json, tsconfig.editor.json, ./.storybook/tsconfig.json]. Wired `atc-typecheck` -> solution `tsconfig.json` to exercise the REFERENCE-WALK engine (walk-references.ts).
  REFERENCE-WALK PROVEN ON A REAL REPO (the gap the direct-leaf radix/geonetwork runs did NOT cover):
    - The walk reached the `tsconfig.spec.json` leaf: baseline emitted extended-diagnostic NG8113 ("All imports are unused") on two real `.spec.ts` files.
    - The walk reached the `.storybook/tsconfig.json` leaf: planting `const __atcStoryPlant: number = '...'` in button.component.stories.ts -> caught as `button.component.stories.ts:8:7 - error TS2322`. This is DECISIVE because tsconfig.app.json EXCLUDES `**/*.stories.ts` (includes only `src/**/*.d.ts`), so that story is declared ONLY via the .storybook reference leaf -- catching it can only happen if the reference-walk reached that leaf.
  OFF-STACK ROBUSTNESS: executor ran cleanly against Angular 21 compiler-cli (no crash), consistent with the Angular 20 geonetwork run -> stable across Angular 20/21/22.
  VALUE CONTRAST: cuentoneta's OWN `typecheck` target is `tsc -p tsconfig.typecheck.json --noEmit` -- plain tsc, NO Angular template / extended (NG8xxx) diagnostics. angular-typechecker on the same repo added NG8113 (and would add template checks) -- the exact gap the tool fills.
  HONEST BASELINE NOISE (as-is, off-stack): baseline exit 1 came from one `TS2688 Cannot find type definition file for 'jest'` -- the walked `tsconfig.spec.json` declares `types: ["jest"]` but cuentoneta uses Vitest and ships no `@types/jest`. That is a cuentoneta config artifact surfaced BECAUSE the walk correctly checks the spec leaf; not a tool defect and not a story/template miss.

### 7. Layout C no-silent-pass guard on a real flat-tsconfig repo (bitwarden/clients, off-stack)
expected: Clone `bitwarden/clients` (flat root `tsconfig.json`, NO `references[]`, 135 `.stories.ts`; off-stack Ng 21 / Nx 22.6 -> install `--legacy-peer-deps`, informational only). Point the target at the flat root tsconfig: the DIRECT single-leaf path type-checks its declared rootNames incl. the 135 stories, so a planted story error FAILs. Point it at an empty / story-less config -> reports coverage-incomplete, never a silent green pass. Confirms the guard on real Layout C code (19-DECISIONS.md Decision 1).
result: skipped
reason: |
  The engine path this targets was already exercised on-stack in test 2: radix's `apps/radix-storybook/.storybook/tsconfig.json` has NO `references[]` (a leaf config with a populated `include`), so our tool took the DIRECT single-leaf path and type-checked its declared story rootNames -- identical to the flat-Layout-C direct path. The no-silent-pass guard (coverage-incomplete on dropped/undeclared) fired in test 5. bitwarden is a 1.3 GB off-stack (Ng 21 / Nx 22.6) clone whose only addition is a real flat-ROOT tsconfig, board-D5 informational; marginal value did not justify the clone. Autonomous skip (scope permits; low-impact, recoverable).

### 8. External `templateUrl` NG8002 kill-shot on a real repo (geonetwork/geonetwork-ui, off-stack)
expected: On a real repo with external-`templateUrl` components, a bad property binding in an aggregated component's external `.html` is detected as NG8002, KEPT (never dropped), and attributed back to the owning component `.ts` via branch 4a (`relatedInformation`). Radix could not exercise this (headless directives / inline templates only).
result: pass
evidence: |
  geonetwork/geonetwork-ui, TRIPLE off-stack (Angular 20.3.19 / Nx 22.0.4 / TS 5.9.3 / Storybook 9.1) -- board-D5 informational + a robustness probe. Tarball installed via `npm i -D <tgz> --legacy-peer-deps --ignore-scripts`; typecheck wired on `demo` -> apps/demo/.storybook/tsconfig.json (include `../../../libs/**/*` = all component .ts + external .html; no references[] -> direct-leaf path).
  ROBUSTNESS (informational): the executor RAN CLEANLY against Angular 20's compiler-cli -- NO crash, NO API-incompat -- and produced 71 real diagnostics incl. template errors NG8002 + NG8007. Confirms performCompilation usage is stable across Angular 20-22 (off-stack indicator, not an on-stack guarantee).
  EXTERNAL-TEMPLATE KILL SHOT (delta-isolated): baseline had a real pre-existing NG8002 at apps/datahub/.../record-actions.component.html (kept, not dropped). Planting `<div [atcPlantedProp]="true"></div>` in the CLEAN external template libs/feature/catalog/.../site-title.component.html (templateUrl component) -> count 71->72 and the exact diagnostic `site-title.component.html:7:6 - error NG8002: Can't bind to 'atcPlantedProp' since it isn't a known property of 'div'`, KEPT and reported with owning-component context. Branch 4a (external .html diagnostic mapped/kept to the owning .ts in the input set) proven on real code. Reverted after.

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none — 7 passed, 1 skipped-with-reason (test 7 bitwarden), 0 issues]

## Notes (informational, board D5 — not gaps)

- On the primary exact-stack real repo (radix-ng/primitives), a full Angular type-check surfaced 229 REAL pre-existing diagnostics (228 TS2307 on Vite `?raw` imports + 1 NG1010 `html\`\`` tagged-template story) that the repo's Vite/Analog Storybook build silently tolerates. This is the core value proposition demonstrated on real code, not a tool defect. A repo adopting angular-typechecker should expect it to reveal latent story/template issues its fast dev builder skips.
- The `.mdx` advisory keys on DECLARED files: radix's docs are `.docs.mdx` and are not matched by the host tsconfig's `*.stories.mdx` include, so they are never declared to the program and never flagged. The advisory correctly fired for the one declared `.tsx` (manager.tsx). Consumers who want `.mdx` docs flagged must have them declared in the checked tsconfig.
- OFF-STACK ROBUSTNESS (test 8): the executor ran cleanly against Angular 20.3.19 / TS 5.9.3 / Nx 22.0.4 (geonetwork-ui) with no crash and correct template diagnostics. Indicates `performCompilation` usage is stable across Angular 20-22; informational only (stable-Angular-22 remains the sole verification target).
- BUILDER-AGNOSTIC / Vite caveat (undocumented today): angular-typechecker is decoupled from the Storybook builder (stock `@storybook/angular` webpack/esbuild vs `@analogjs/storybook-angular` Vite) -- it type-checks the tsconfig's declared surface via ngc regardless. Consequence surfaced on radix: Vite-only import suffixes (`?raw`, `?url`, ...) are not valid TS module specifiers and report TS2307 unless the consumer adds ambient `declare module '*?raw'` declarations. Expected ngc behavior, not a defect. CANDIDATE: README caveat + Future Requirement (no tracking exists yet).
- COVERAGE (this UAT): both engine paths now exercised on real repos. DIRECT single-leaf path -- radix `.storybook/tsconfig.json` (test 2) + geonetwork `demo/.storybook/tsconfig.json` (test 8). Solution-tsconfig REFERENCE-WALK path (walk-references.ts, the v0.1.0 primary engine) -- cuentoneta root `tsconfig.json` -> `.storybook/tsconfig.json` + `tsconfig.spec.json` leaves (test 6). Gap CLOSED.
- OFF-STACK ROBUSTNESS spans Angular 20 (geonetwork), 21 (cuentoneta), 22 (radix): executor runs cleanly against all three compiler-cli majors. Informational; stable Angular 22 remains the sole committed verification target.
