# Quick Task 260705-1wo: Resolve e2e tsconfig inject() never + add CI typecheck gate - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** --research --analyze (mapped to research + plan-check + verify)
**Branch:** STAY on the current branch `test/nx-add-e2e-pnpm-yarn` (user directive: do NOT
create a separate branch). This stacks on the nx-add e2e work already on that branch.

<domain>
## Task Boundary

Resolve the pre-existing issue: `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` omits
`src/global-setup.ts`, so a standalone `tsc -p tsconfig.spec.json` reports `inject()` -> `never`
(TS2345/TS2339) on EVERY install-e2e spec, and NO CI gate type-checks e2e source at all. "Resolve"
= (1) make the e2e specs + global-setup type-check cleanly, AND (2) add a CI gate so it stays
enforced (the "no CI gate runs it" half).
</domain>

<decisions>
## Verified findings (first-party, this session -- do NOT re-derive)

- Mechanism: vitest types `inject<K extends keyof ProvidedContext>(key: K)`. `ProvidedContext` is
  an empty base interface (`node_modules/vitest/.../traces.d.*.d.ts:21 interface ProvidedContext {}`),
  meant to be augmented. The augmentation lives ONLY in `install-e2e/src/global-setup.ts:187-192`.
  `tsconfig.spec.json` include = `["vitest.config.mts","src/**/*.int.spec.ts","src/**/*.d.ts"]` --
  `global-setup.ts` matches none, so it is NOT in the tsc program -> `keyof {}` = `never` ->
  every spec's `inject('verdaccioUrl')` errors. VERIFIED via `tsc -p tsconfig.spec.json` (exit 2).
- A1 (ambient `.d.ts` augmentation): adding `src/vitest-provided-context.d.ts` with the
  `declare module 'vitest' { interface ProvidedContext { verdaccioUrl: string; verdaccioToken: string } }`
  (picked up by the existing `src/**/*.d.ts` glob) -> `tsc -p tsconfig.spec.json` EXIT 0. VERIFIED.
  But A1 alone leaves `global-setup.ts` still un-type-checked.
- A2 (include `global-setup.ts` in the program): fixes the inject errors BUT surfaces a SECOND real
  latent error -- `global-setup.ts:5 import type { GlobalSetupContext } from 'vitest/node'` ->
  TS2305 "has no exported member 'GlobalSetupContext'". VERIFIED. `GlobalSetupContext` was REMOVED
  in vitest 4 (confirmed absent from vitest 4.1.9 dist). So global-setup.ts is itself type-broken,
  hidden by the same gap.
- No CI gate type-checks e2e: `test` job runs `-p angular-typechecker test-util` only (ci.yml:132);
  `e2e` job runs `@nx/vitest:test` (esbuild transpile, NO type-check); lint does not catch the
  inject generic; there is NO `tsc --noEmit -p tsconfig.spec.json` anywhere. VERIFIED.
- Blast radius: ONLY `install-e2e` has `global-setup.ts` + `inject()` + the `GlobalSetupContext`
  import. `cache-e2e` and `matrix-e2e` have the SAME tsconfig.spec.json shape but NO global-setup /
  no inject usage. VERIFIED (git grep).

## Locked decisions (auto-resolved)

- **Fix approach = A2 + fix GlobalSetupContext (NOT A1 alone).** For the CI gate to be meaningful it
  must type-check `global-setup.ts` too, so include it in the program AND fix its removed-type
  import. (A1's ambient `.d.ts` is optional cleanliness; the augmentation can stay in global-setup
  once global-setup is included, or move to a `.d.ts` -- planner/executor's call, keep ONE source.)
- **CI gate = a `typecheck` target running `tsc --noEmit -p tsconfig.spec.json`**, added to the e2e
  project(s) and wired into ci.yml. Model it after the existing `typecheck-drift` target
  (`packages/angular-typechecker/project.json:62`). Type-checking is OS-independent -> Linux,
  single Node (like format-lint), NOT the 6-cell matrix, NOT the heavy e2e install job.
- **Gate scope = all THREE e2e projects** for consistency (install + cache + matrix), provided
  cache-e2e/matrix-e2e already type-check clean (RESEARCH confirms; if either has its own latent
  error, fix it as part of this task since the gate must be green).
- Branch: STAY on `test/nx-add-e2e-pnpm-yarn`. No new branch. Non-worktree, single-plan, main tree.

## Claude's Discretion
- Augmentation location (keep in global-setup.ts once included, vs move to a `.d.ts`).
- Exact CI wiring (fold into `format-lint`, extend the `e2e` job with a fast pre-test tsc step, or a
  new lightweight `typecheck-e2e` job) -- pick the leanest that runs on Linux+single-Node and is a
  required input to the `ci` aggregate.
</decisions>

<specifics>
## Specific anchors
- `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` (the include to extend)
- `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (augmentation :187-192; broken import :5, :68)
- `packages/angular-typechecker/project.json:62` (`typecheck-drift` target -- model the new target on it)
- `.github/workflows/ci.yml` (`test` :98-132, `e2e` :141-180, `format-lint` :231-258, `ci` aggregate :333)
- `nx.json` (targetDefaults; where a `typecheck` targetDefault might live)
</specifics>

<canonical_refs>
## Canonical References
- CLAUDE.md "TypeScript LSP diagnostics are not authoritative" -- the authoritative signal is
  `tsc --noEmit` / the test runner; this task ADDS that missing tsc gate for e2e.
- Prior session analysis of this exact issue (A1/A2/B options + verifications above).
</canonical_refs>
