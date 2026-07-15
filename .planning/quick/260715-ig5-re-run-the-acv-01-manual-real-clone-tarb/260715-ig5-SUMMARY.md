---
status: complete
quick_id: 260715-ig5
slug: re-run-the-acv-01-manual-real-clone-tarb
completed: 2026-07-15
tags: [acv-01, e2e, real-clone, ng-add, ng-run, tarball, angular-cli, verification]
outcome: PASS -- both real-clone gates green against post-24-06 HEAD
---

# Quick Task 260715-ig5: Re-run ACV-01 real-clone gate (post-24-06) -- Summary

**Both ACV-01 real-clone gates PASS against post-24-06 HEAD.** The freshly built + packed
tarball (nx-free vanilla ng-add) auto-wires and per-project-scopes correctly on both
`bluehalo/ngx-leaflet` (app+lib, npm) and `realworld-angular/realworld-angular`
(app-only, pnpm-workspace + name-collision). This closes the LOW-risk pre-release human
item the Phase-24 verifier flagged (the prior manual UAT ran 2026-07-11, one day before
24-06 rewrote the exact `ng add` code path).

## Result

| Gate | Repo @ SHA | ng add / wire | Clean baseline | Planted (RED) | ERR_REQUIRE_ESM | Verdict |
|------|-----------|---------------|----------------|---------------|-----------------|---------|
| #1 | bluehalo/ngx-leaflet @818e9ae (app+lib, npm) | `ng add` auto-wired BOTH projects FIRST-RUN, 2-el `tsConfig` arrays, no nx.json | both targets exit 0 | app=TS2322+TS2345 (not TS2554); lib=TS2554 (not app codes); exit 1 | none | PASS |
| #2 | realworld-angular @9e3528f (app-only, pnpm) | vanilla ng-add wired FULL `[tsconfig.app.json, tsconfig.spec.json]` array (build leaf NOT dropped under name-collision), no nx.json | exit 0 | TS2322 (app.ts, build leaf) + TS2345 (footer.spec.ts, spec leaf); exit 1 | none | PASS |

## What was executed (against the ACTUAL post-24-06 HEAD, not SUMMARY claims)

### Task 1 -- Rebuild + pack + assert the 24-06 delta in the shipped artifact
- `nx build angular-typechecker --skip-nx-cache` (exit 0); `npm pack` of the built dist ->
  `angular-typechecker-0.2.0.tgz`.
- Tarball ships compiled `.js` (0 raw `.ts` under `package/src`), `builders.json`,
  `collection.json`, `executors.json`, `generators.json`, `src/index.js|.d.ts`.
- **24-06 delta CONFIRMED in the shipped artifact:** the packed
  `package/src/schematics/ng-add/schematic.js` contains ZERO `@nx/devkit`/`convertNxGenerator`
  (grep-clean) -- the vanilla nx-free ng-add really ships.
- This local dist pack is the exact shape `nx release publish` ships (per the 0.1.1
  `packageRoot` fix), so this also re-confirms the shipped-artifact packaging.

### Task 2 -- Gate #1: bluehalo/ngx-leaflet (app + library, npm)
- Reset clone to pristine @818e9ae (kept gitignored `node_modules`).
- A SINGLE `npx ng add "$ABS_TGZ" --skip-confirmation` **auto-wired BOTH** projects on the
  FIRST run: `ngx-leaflet-demo` -> `["tsconfig.app.json","tsconfig.spec.json"]`, `ngx-leaflet`
  -> `["projects/ngx-leaflet/tsconfig.lib.json","projects/ngx-leaflet/tsconfig.spec.json"]`,
  each `builder: angular-typechecker:typecheck`; **no stray nx.json**.
- Clean baseline: both `ng run <project>:typecheck` exit 0; no `ERR_REQUIRE_ESM`.
- Per-project scoping (clean bidirectional): with the lib error in a lib file NOT imported by
  the demo (`leaflet.util.spec.ts`, TS2554), the APP target reported TS2322 (app.component.ts,
  build leaf) + TS2345 (app.component.spec.ts, spec leaf) and NOT TS2554; the LIB target
  reported TS2554 and NOT the app codes. Both exit 1; reverting the plants returned both to
  exit 0.
- The `tsconfig.lib.json` (component) leaf was independently confirmed checked: an earlier
  probe planting TS2554 in `leaflet.directive.ts` (a directive the demo transitively imports
  via the `n/src/public-api` SOURCE path alias) surfaced correctly in the lib target -- and
  also in the app target, which is correct complete-typecheck behavior (the app genuinely
  compiles that imported source), not a scoping bleed.

### Task 3 -- Gate #2: realworld-angular (single app, pnpm-workspace + name-collision)
- Reset clone to pristine @9e3528f. This repo is the hard shape: `pnpm-workspace.yaml` + a root
  `package.json` whose `name` (`realworld-angular`) collides with the angular.json project name
  -- the exact trigger for the Phase-24 app-build-leaf-drop defect.
- `ng add "$ABS_TGZ"` under pnpm fails at INSTALL with `ERR_PNPM_ADDING_TO_ROOT` (Angular CLI's
  `pnpm add` omits `-w` on a workspace root) -- an Angular-CLI/pnpm install-mechanics limitation,
  NOT an angular-typechecker defect. Fell back to the documented pnpm-native path: force-fresh
  `pnpm add -w -D <unique-named tarball>` (guarding against pnpm reusing the STALE 2026-07-11
  nx-based 0.2.0 -- confirmed the pre-existing install WAS nx-based, and the fresh one is
  vanilla nx-free) + `npx ng g angular-typechecker:ng-add`.
- The vanilla 24-06 ng-add wired `realworld-angular` -> **FULL** `["tsconfig.app.json",
  "tsconfig.spec.json"]` (the app **build leaf is NOT dropped** despite the name-collision --
  the shared `angular-cli-wiring.ts` core reads angular.json directly), **no stray nx.json**.
- Clean baseline exit 0; planted TS2322 (app.ts, build leaf) + TS2345 (footer.spec.ts, spec
  leaf) -- BOTH surfaced, exit 1 (proving both leaves are checked); no `ERR_REQUIRE_ESM`;
  reverting -> exit 0.

## Deviations / notes

- **pnpm install mechanics (gate #2):** `ng add <tarball>` cannot install into a pnpm workspace
  root without `-w`; used the documented `pnpm add -w -D` + `ng g` path (matches 2026-07-11
  gate #3). The 24-06 change (vanilla ng-add) does not affect pnpm install mechanics; npm/pnpm
  auto-wire was never the problem (the yarn `chalk.blue` throw was, and it is covered by the
  CI-authoritative ACV-02 yarn e2e).
- **Force-fresh guard:** pnpm keys a local tarball by version, and realworld-angular still had
  the STALE nx-based 0.2.0 from 2026-07-11; used a unique-named tarball copy + removed the
  installed copy so the re-run genuinely exercised the 24-06 vanilla schematic (verified
  nx-free after install).
- **Clones are UNCOMMITTED scratch** (D-02); both reset to their pinned SHAs and left pristine.
- **No product/test/version change.** Package version stays 0.2.0; this is a verification re-run.

## Self-Check: PASSED

- Tarball built + packed from post-24-06 HEAD; packed ng-add schematic is nx-free.
- Gate #1 (ngx-leaflet) PASS: first-run auto-wire-all, per-project scoping, clean/RED/GREEN.
- Gate #2 (realworld-angular) PASS: full-array wiring under name-collision, both leaves checked.
- Both clones restored to pristine pinned SHAs; main repo clean.
