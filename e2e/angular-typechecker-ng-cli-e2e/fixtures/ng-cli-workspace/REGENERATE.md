# ng-cli-workspace fixture (committed, pinned Angular 22)

This is a **committed, pinned Angular CLI workspace fixture** (RF-01 Option B). It is a
genuine `ng new` + `ng generate library` scaffold captured once and frozen on-stack, so the
`angular-typechecker-ng-cli-e2e` e2e installs the SHIPPED tarball into a deterministic,
offline, on-stack workspace with no live network scaffold step.

## What it contains

- An **application** project `ng-cli-workspace` (root `""`; build leaf `tsconfig.app.json`,
  spec leaf `tsconfig.spec.json`).
- A **library** project `my-lib` (root `projects/my-lib`; build leaf
  `projects/my-lib/tsconfig.lib.json`, spec leaf `projects/my-lib/tsconfig.spec.json`).

This app + library shape gives the e2e per-project-scoping coverage: `ng add` auto-wires a
`typecheck` target into BOTH projects, and each `ng run <project>:typecheck` catches exactly
its own leaves.

## Honesty / drift note

**Regenerate this fixture on Angular MAJOR bumps** (mirrors the repo's `*.drift.ts` honesty
convention). It is pinned to Angular 22 / TypeScript 6.0.x on purpose; a live
`npm init @angular@latest` would drift off the locked stack. To regenerate (once, offline):

```
ng new ng-cli-workspace --defaults --skip-install --skip-git
cd ng-cli-workspace
ng generate library my-lib --skip-install
# pin package.json: @angular/cli ~22.0.x, @angular/* ^22.0.0, typescript ~6.0.3
npm install --package-lock-only     # commit the resulting package-lock.json
# strip node_modules/ .angular/ dist/ .git/ before committing
```

The fixture MUST NOT carry an `.npmrc` with `legacy-peer-deps=true` -- on-stack Angular 22
installs clean with no flag, and a leaked peer override would mask a real peer result. The
Verdaccio `.npmrc` (registry + minted token) is written into the tmp copy at test time, never
committed here.
