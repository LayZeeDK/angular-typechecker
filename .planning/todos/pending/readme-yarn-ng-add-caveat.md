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
  transitively via 24-04 + `collection.json`), but Angular CLI's post-install ng-add
  detection (`createSchematic('ng-add')` in `@angular/cli`'s add command) silently fails
  under yarn's node-modules layout, so the CLI reports "Package installed successfully. The
  package does not provide any `ng add` actions" and wires NOTHING.
- npm and pnpm both run the SAME schematic on the identical installed package and DO wire.
  So this is an Angular-CLI-under-yarn behavior, NOT an angular-typechecker defect, and NOT
  a collection-resolution issue.
- The ng-add schematic ITSELF runs fine under yarn: a yarn user must run
  `ng g angular-typechecker:ng-add` manually to wire (the e2e does exactly this).

## Decision needed before the v0.2.1 release (do NOT auto-fix)

1. Add a yarn caveat to the README `## Angular CLI` section in END-USER language: under
   yarn, `ng add angular-typechecker` installs but does not auto-wire; run
   `ng g angular-typechecker:ng-add` afterwards to wire every project. (npm and pnpm
   auto-wire via `ng add` directly.)
2. Consider filing an upstream Angular CLI issue (the `ng add` hasSchematics detection
   failing under yarn's node-modules linker).

Out of scope for 24-05 (two e2e specs only). Recorded as a release-facing product-doc
decision for the user.
