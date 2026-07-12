---
status: pending
created: 2026-07-12
source: 24-05 (CLI x yarn e2e finalization)
severity: blocker-before-release
decision_owner: user
---

# README `## Angular CLI` overstates `ng add` auto-wiring for yarn

`packages/angular-typechecker/README.md` `## Angular CLI` section claims `ng add`
auto-wires a typecheck target into every project. Plan 24-05's finalized CLI x yarn e2e
CONFIRMED (across three e2e runs) that this is INACCURATE for yarn:

- Under yarn 4, `ng add angular-typechecker` INSTALLS correctly (angular-typechecker + `nx`
  transitively via 24-04 + `collection.json`), but the CLI's post-install
  `createSchematic('ng-add')` probe THROWS while loading this package's ng-add factory
  (`convertNxGenerator(...)` from `@nx/devkit` -> `nx` transitive deps; under yarn 4's hoist
  the load throws -- pinned 2026-07-12 as `TypeError: chalk.blue is not a function` from nx's
  nested `log-symbols`/`ora`). @angular/cli swallows it in a bare `catch {}` -> reports
  "Package installed successfully. The package does not provide any `ng add` actions" and
  wires NOTHING. (See the pinned gate-by-gate analysis in
  `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md`, "Post-24-05 root-cause pin".)
- npm and pnpm hoist nx's deps so the SAME probe succeeds and they wire the identical dist.
  So this is NOT an angular-typechecker defect, NOT a collection-resolution issue, and NOT the
  registry-metadata bug (Gate 1 sees `schematics`).
- The ng-add schematic ITSELF runs fine under yarn: a yarn user must run
  `ng g angular-typechecker:ng-add` (or run `ng add` a SECOND time -- the already-installed
  short-circuit) to wire. The e2e wires via `ng g`.

## Decision needed before the v0.2.1 release (do NOT auto-fix)

1. Add a yarn caveat to the README `## Angular CLI` section in END-USER language: under
   yarn, `ng add angular-typechecker` installs but does not auto-wire; run
   `ng g angular-typechecker:ng-add` afterwards to wire every project (or run `ng add` twice).
   (npm and pnpm auto-wire via `ng add` directly.) Keep the caveat about the OUTCOME, not the
   internal mechanism.
2. Upstream angular/angular-cli issue -- NOT WARRANTED (prerequisite repro done, 2026-07-12,
   quick task 260712-ft9). The vanilla-repro settled it: a VANILLA (Nx-free) zero-import
   `ng-add` schematic WIRES cleanly under yarn 4 (Gate 3 `createSchematic('ng-add')` OK, marker
   lands), and the npm control wires the identical package. So the failure is NX-SPECIFIC -- it
   needs the `@nx/devkit -> nx -> ora -> log-symbols -> chalk` transitive chain that only nx's
   packaging drags in under yarn's hoist; it is NOT a general Angular-CLI-under-yarn probe bug.
   Do NOT file the "Angular CLI's yarn-4 `ng add` probe is broken / bare-catch masks the error"
   issue -- that framing is refuted. If anything is fileable it is reframed as an nx-under-yarn
   packaging/hoist consideration (nx's nested chalk/log-symbols interop under yarn 4), and it
   stays USER-GATED (draft-only, pending an explicit go-ahead). See the resolved OPEN QUESTION in
   `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` and the sandbox
   `D:/projects/sandbox/vanilla-ng-add-repro/FINDINGS.md`.

   NOTE: item 1 (the README yarn caveat) is UNAFFECTED -- the yarn `ng add` no-autowire behavior
   is real regardless of attribution, so a yarn user still runs `ng g angular-typechecker:ng-add`
   (or `ng add` twice) to wire. That README decision remains open for the user.

3. In-product auto-wire fix -- CHEAP OPTION REFUTED (2026-07-12 spike). Deferring the `@nx/devkit`
   load out of the ng-add factory's module top-level (lazy-require, "Option D") was spiked: it fixed
   the CLI probe (`createSchematic` OK, no swallowed catch) but `executeSchematic` then threw
   `chalk.blue is not a function` anyway -> still no first-run wire (just a loud error instead of a
   silent one). Root cause is PROCESS-WIDE: the add command's listr2 renderer pollutes chalk before
   nx's nested `log-symbols` loads, so any fix that loads `@nx/devkit` during the first-run `ng add`
   execution (lazy-require D, or a native-composition ng-add running the convertNx `configuration`
   schematic, "Option G") fails the same way. The ONLY in-product fix that auto-wires the yarn first
   run is a genuinely nx-free ng-add execution path -- a vanilla `@angular-devkit/schematics` ng-add
   that wires `angular.json` via a framework-agnostic leaf-resolution function SHARED with the Nx
   generator (extract-not-duplicate). That is a real refactor, warranted only if the yarn first-run
   `ng add` UX is prioritized (v0.2.2/v0.3.0). RECOMMENDATION: for v0.2.x, ship the item-1 README
   caveat (the workaround is one documented command); revisit the nx-free refactor later if desired.
   Spike detail: `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` ("Option D spike").

Out of scope for 24-05 (two e2e specs only). Recorded as a release-facing product-doc
decision for the user.
