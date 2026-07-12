**Plans:** 3/3 original plans complete; 2 gap-closure plans added (2026-07-12, reopened under --force for a post-verification yarn/nx-peer gap); 24-04 complete (1/2 gap-closure)

Plans:
**Wave 1**

- [x] 24-01-PLAN.md -- ACV-03/ACP-02: builder-over-`BuilderContext` integration gap-fill + `src/index.drift.ts` barrel additive-only tripwire + the git-diff audit vs `angular-typechecker@0.2.0`
- [x] 24-02-PLAN.md -- ACD-01: README `## Angular CLI` section + curated prose CHANGELOG entry + the `angular-cli-docs.spec.ts` content tripwire

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-03-PLAN.md -- ACV-01/ACV-02: the scaffolded `ng add` -> `ng run` e2e project (committed pinned Ng22 fixture) + the real-clone milestone-final UAT procedure

**Gap closure** *(added 2026-07-12 -- a post-verification gap: yarn does not auto-install the `@nx/devkit` peer `nx`, so `ng add` crashes on a yarn Angular CLI workspace)*

- [x] 24-04-PLAN.md -- ACP-02: declare `nx` as a direct `^23.0.0` dependency (yarn does not auto-install the `@nx/devkit` peer) + invert the `package-manifest.spec.ts`/`@nx/dependency-checks` guards + de-contradict PROJECT.md/CLAUDE.md
- [ ] 24-05-PLAN.md -- ACV-02: finalize the yarn CLI e2e to the real `ng add` (strip debug scaffolding, keep `enableMirror:false`) + add a committed CLI x pnpm-workspace name-collision e2e (app build leaf never dropped)
