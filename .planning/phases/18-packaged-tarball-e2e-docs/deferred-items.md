# Phase 18 - Deferred / Out-of-Scope Items

Discovered during execution; NOT fixed (out of scope for the discovering plan).

## 18-04: `nx-add-yarn.int.spec.ts` ECONNREFUSED against local Verdaccio (pre-existing, environmental)

- **Discovered during:** 18-04 wave run of `npx nx test angular-typechecker-install-e2e`
  (the filter argument did not restrict, so all 10 e2e spec files ran).
- **Result:** 9/10 spec files passed (33/34 tests), including the new
  `storybook-tarball.int.spec.ts` (both layouts). The ONLY failure was
  `nx-add-yarn.int.spec.ts`: corepack `yarn 4.17.0` completed its Resolution step
  (269 packages resolved from `http://localhost:487x`) but its Fetch step threw
  `RequestError` / `AggregateError [ECONNREFUSED]`.
- **Why out of scope for 18-04:** additive change only (a new spec file + two fixture
  dirs). The yarn spec runs in its OWN isolated tmp workspace and never references the
  new fixtures. The failure is a corepack-yarn-4 + local-Verdaccio fetch flake
  (ECONNREFUSED), the known-fragile yarn path (corepack provisioning + registry age
  gate). Per AGENTS.md the CI e2e gate is Linux-only; this corepack-yarn fragility is
  a local-Windows-only observation.
- **Action:** not fixed by 18-04. Re-evaluate at the phase verification / wave gate on
  a clean network, or on CI (Linux). If it reproduces deterministically there, open a
  dedicated debug task for the corepack-yarn Verdaccio fetch path.
