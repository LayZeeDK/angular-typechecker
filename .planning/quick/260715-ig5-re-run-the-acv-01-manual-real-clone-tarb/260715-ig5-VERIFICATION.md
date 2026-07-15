---
quick_id: 260715-ig5
verified: 2026-07-15
status: passed
score: 3/3 must-have truths verified
gate: manual real-clone UAT (D-02); executed inline on the main checkout
---

# Quick Task 260715-ig5 Verification: ACV-01 re-run (post-24-06)

**Status:** passed
**Score:** 3/3 must-have truths verified against the actual post-24-06 HEAD + real clones.

This quick task re-executed the ACV-01 milestone-final real-clone tarball gate to close the
LOW-risk pre-release human item raised by the Phase-24 verifier (24-VERIFICATION.md, 2026-07-15):
"re-run the ACV-01 manual real-clone gate against post-24-06 HEAD, because 24-06 rewrote the
exact `ng add` code path and the last manual UAT ran 2026-07-11."

## Must-have truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The freshly built + packed tarball (post-24-06 HEAD) ships compiled `.js` (no raw `.ts`) + `builders.json`/`collection.json`/`executors.json`, and its `schematics/ng-add/schematic.js` is nx-free (the 24-06 delta). | VERIFIED | `nx build` exit 0; `npm pack` -> `angular-typechecker-0.2.0.tgz`; `tar -tzf` lists the 4 JSON manifests + `src/index.js|.d.ts`; 0 raw `.ts` under `package/src`; `rg '@nx/devkit\|convertNxGenerator'` over the packed `package/src/schematics/ng-add/schematic.js` is empty. |
| 2 | On ngx-leaflet@818e9ae, a SINGLE `ng add <tarball>` auto-wires a typecheck target into BOTH projects with 2-element `tsConfig` arrays + no stray nx.json; clean baseline both exit 0; planted per-leaf errors give app=TS2322+TS2345 (not TS2554), lib=TS2554 (not app codes); no `ERR_REQUIRE_ESM`. | VERIFIED | angular.json after one `ng add`: `ngx-leaflet-demo` -> `["tsconfig.app.json","tsconfig.spec.json"]`, `ngx-leaflet` -> `["projects/ngx-leaflet/tsconfig.lib.json","projects/ngx-leaflet/tsconfig.spec.json"]`, builder `angular-typechecker:typecheck`; no nx.json. Clean: both exit 0. Planted: app target exit 1 TS2322(app.component.ts:15)+TS2345(app.component.spec.ts:22), no TS2554; lib target exit 1 TS2554(leaflet.util.spec.ts:127), no app codes; revert -> both exit 0. No `ERR_REQUIRE_ESM`. (tsconfig.lib.json component leaf independently confirmed via a leaflet.directive.ts TS2554 probe.) |
| 3 | On realworld-angular@9e3528f (pnpm-workspace + name-collision), the 24-06 vanilla ng-add wires `realworld-angular` with the FULL `[tsconfig.app.json, tsconfig.spec.json]` array (app build leaf NOT dropped) + no stray nx.json; clean baseline exit 0; planted TS2322 (app comp) + TS2345 (app spec) both surface + non-zero exit; no `ERR_REQUIRE_ESM`. | VERIFIED | Installed the fresh nx-free 0.2.0 via `pnpm add -w -D <unique tgz>` (guarded against the stale 2026-07-11 nx-based install) + `ng g angular-typechecker:ng-add`. angular.json: `realworld-angular.architect.typecheck` -> `["tsconfig.app.json","tsconfig.spec.json"]` (build leaf preserved under the collision -- the Phase-24 fix holds in the extracted core); no nx.json. Clean exit 0; planted TS2322(app.ts:15)+TS2345(footer.spec.ts:38) both surface, exit 1; revert -> exit 0. No `ERR_REQUIRE_ESM`. |

## Human verification required

None. Both real-clone gates were executed here and PASS. The prior human item (ACV-01 re-run
pre-release) is now RESOLVED.

## Notes

- `ng add <tarball>` cannot install into a pnpm workspace root (`ERR_PNPM_ADDING_TO_ROOT`, an
  Angular-CLI/pnpm mechanics limitation, not an angular-typechecker defect); the documented
  pnpm-native install + `ng g` path was used for gate #2 (matches the 2026-07-11 gate #3
  procedure). The CI-authoritative counterpart is ACV-02 (`angular-typechecker-ng-cli-e2e`),
  which exercises npm + yarn (first-run auto-wire) + pnpm (collision) on committed fixtures.
- Clones are UNCOMMITTED scratch (D-02); both restored to pristine pinned SHAs. No product,
  test, or version change (package stays 0.2.0).

_Verified: 2026-07-15 -- inline manual real-clone UAT (orchestrator-run on the main checkout)._
