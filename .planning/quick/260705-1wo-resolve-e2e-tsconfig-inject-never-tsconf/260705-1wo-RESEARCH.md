# Quick Task 260705-1wo: Resolve e2e tsconfig inject() never + add CI typecheck gate - Research

**Researched:** 2026-07-05
**Domain:** vitest 4 globalSetup typing + Nx e2e tsconfig program + CI typecheck gate
**Confidence:** HIGH (every claim empirically verified with `tsc` exit codes, first-party type/runtime sources, and the official vitest docs)

## User Constraints (from CONTEXT.md)

- **Fix approach = A2 + fix GlobalSetupContext.** Include `global-setup.ts` in the spec program AND fix its removed-type import. (A1 ambient `.d.ts` is optional; keep ONE augmentation source.)
- **CI gate = a target running `tsc --noEmit -p tsconfig.spec.json`**, modeled on `typecheck-drift` (packages/angular-typechecker/project.json:62). Linux, single Node, NOT the 6-cell matrix, NOT the heavy e2e install.
- **Gate scope = all THREE e2e projects** (install + cache + matrix).
- **Branch: STAY on `test/nx-add-e2e-pnpm-yarn`.** No new branch. Non-worktree, single-plan, main tree.
- **Discretion:** augmentation location; exact CI wiring.

---

## Q1: The exact vitest-4 replacement for `GlobalSetupContext`

**FIX (exact):** in `e2e/angular-typechecker-install-e2e/src/global-setup.ts`

- Line 5: `import type { TestProject } from 'vitest/node';`
- Line 68: `export default async function ({ provide }: TestProject) {`

`GlobalSetupContext` is fully absent from vitest 4.1.9 (`rg -uu "GlobalSetupContext" node_modules/vitest/` -> zero hits) `[VERIFIED: rg node_modules/vitest]`. Its successor is **`TestProject`**, exported from `vitest/node` (node.d.ts:264 re-exports `TestProject`) `[VERIFIED: node_modules/vitest/dist/node.d.ts:264]`. `TestProject` carries the exact `provide` shape the code destructures:

```ts
// node_modules/vitest/dist/chunks/reporters.d.DtoKVV2s.d.ts:1971
provide: <T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]) => void;
```
`[VERIFIED: reporters.d.DtoKVV2s.d.ts:1971]`

vitest invokes the default export with the project instance itself: `const teardown = await globalSetupFile.setup?.(this)` where `this` is the `TestProject` `[VERIFIED: node_modules/vitest/dist/chunks/cli-api.24X8XwN1.js:10746]`. The official docs confirm "the `setup` method and a `default` function receive a test project as the first argument" and show the exact pattern (`import type { TestProject } from 'vitest/node'` + `project.provide(...)` + the `declare module 'vitest' { interface ProvidedContext {...} }` augmentation) `[CITED: vitest.dev/config/globalsetup]`. Destructuring `{ provide }` from `TestProject` is equivalent to the docs' `project.provide`.

Option (b) — inline-typing `{ provide }` with the raw signature — also compiles but is strictly worse (duplicates the vitest type, drifts on upgrade). Use `TestProject`.

## Q2: Does A2 + the TestProject fix give a fully clean `tsc`? YES

**Empirically verified in three steps** (temp tsconfig identical to `tsconfig.spec.json` but with `src/global-setup.ts` added to `include`; `tsc --noEmit -p` each time):

1. Baseline, current `tsconfig.spec.json`: **exit 2** — 12 `inject()` -> `never` errors (TS2345/TS2339) across the 4 specs `[VERIFIED: tsc exit 2]`.
2. global-setup.ts included, import UNFIXED: **exit 2** — the `inject` errors DISAPPEAR (the augmentation at lines 187-192 is now in the program) leaving exactly ONE error: `global-setup.ts(5,15): TS2305 Module '"vitest/node"' has no exported member 'GlobalSetupContext'` `[VERIFIED: tsc exit 2]`.
3. global-setup.ts included + import fixed to `TestProject`: **exit 0** `[VERIFIED: tsc exit 0]`.

No other latent issues surface. All of global-setup.ts's imports/usages resolve under the spec tsconfig (`types: ["node","vitest/globals","vitest/importMeta","vitest"]`, `moduleResolution: bundler`): `@nx/js/plugins/jest/local-registry` (typed), `@workspace/test-util` (path-mapped to `./libs/test-util/src/index.ts`, tsconfig.base.json:21, captured by `^default`), `fetch`/`AbortSignal.timeout`/`process.env` (from `@types/node`). Nothing extra to add — no new `@types`, no extra `types` entry, no `.d.ts`.

**Augmentation location:** keep the existing `declare module 'vitest'` block IN global-setup.ts (lines 187-192). Once global-setup.ts is in the program it is in scope for every spec — no separate `.d.ts` needed. One source, leanest.

**The tsconfig change (install-e2e ONLY):** add `"src/global-setup.ts"` to the `include` array:
```json
"include": ["vitest.config.mts", "src/**/*.int.spec.ts", "src/**/*.d.ts", "src/global-setup.ts"]
```

## Q3: Do cache-e2e and matrix-e2e type-check clean today? YES

`tsc --noEmit -p tsconfig.spec.json` from each dir: **cache-e2e exit 0, matrix-e2e exit 0** `[VERIFIED: tsc exit 0 x2]`. Neither has a `global-setup.ts`, `inject()`, or the removed import (identical tsconfig.spec.json shape, no latent errors). The gate over all three is green from the start once install-e2e is fixed. No changes needed to the sibling projects' sources or tsconfigs.

## Q4: Cleanest CI gate wiring

**Target (recommended): a distinct `typecheck-e2e` target, inline in each of the 3 e2e `project.json`,** modeled on `typecheck-drift` (inline `nx:run-commands` running `tsc --noEmit -p <tsconfig>`, `cache: true`) — the repo's established pattern for custom no-emit checks (typecheck-drift and scoped-name-guard are both inline `nx:run-commands` with no targetDefault).

```json
"typecheck-e2e": {
  "executor": "nx:run-commands",
  "cache": true,
  "inputs": [
    "default",
    "^default",
    "{workspaceRoot}/tsconfig.base.json",
    { "externalDependencies": ["typescript", "vitest"] }
  ],
  "options": {
    "command": "tsc --noEmit -p e2e/angular-typechecker-install-e2e/tsconfig.spec.json",
    "cwd": "."
  }
}
```
(swap the `-p` path per project.) `outputs` omitted -> defaults to `[]` (noEmit emits nothing; matches typecheck-drift). `default` (nx.json:5 = `{projectRoot}/**/*`) already covers src + `vitest.config.mts` + the project tsconfigs; `^default` captures the `@workspace/test-util` source global-setup imports; `{workspaceRoot}/tsconfig.base.json` covers the base config; externalDependencies bust on typescript/vitest upgrades.

**Name = `typecheck-e2e`, NOT `typecheck`.** `typecheck` is already overloaded: the plugin SHIPS an executor `angular-typechecker:typecheck` (renamed in 956e657), and the fixture consumer projects (`libs/typecheck-consumer`, `libs/typecheck-walk-consumer`, and the e2e `fixtures/*` projects) define `typecheck` targets that USE that executor (dogfooding, needs a plugin build) `[VERIFIED: libs/typecheck-consumer/project.json:8-9; git grep]`. Naming the e2e gate `typecheck` would make `nx run-many -t typecheck` sweep those heavy dogfood targets too. A distinct `typecheck-e2e` name has zero sweep and zero collision.

**No targetDefault needed / wanted.** The existing `angular-typechecker:typecheck` targetDefault (nx.json:44) is EXECUTOR-keyed (applies only to targets using the plugin's own executor) — it does NOT touch a `nx:run-commands` target, so there is no collision `[VERIFIED: nx.json:44-59 + fixture executor]`. Do NOT add a plain-name `typecheck` targetDefault: it would also catch the fixture `typecheck` targets and alter their cache/inputs. There is no `plugins` array in nx.json, so nothing infers a `typecheck` target either `[VERIFIED: git grep "plugins" nx.json -> none; nx show project -> install-e2e has only `test`]`. A `typecheck-e2e` targetDefault would be safe (unique name) but the inline pattern matches repo precedent and needs no per-project stub — prefer inline.

**CI placement (recommended, leanest): one step in the existing `e2e` job, after `npm ci`, before the tarball run:**
```yaml
      - run: npm ci
      - run: npx nx run-many -t typecheck-e2e
      - run: >
          npx nx run-many -t test
          -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e
          --parallel=1
```
Why this is correct and leanest:
- `nx run-many -t typecheck-e2e` (NO `-p`) runs the target for every project that defines it — only the 3 e2e projects — so there is **no second `-p` list to drift** and **GUARD-01 is untouched** (see Pitfall 1).
- The `e2e` job is already `code`-path-gated (`if: needs.changes.outputs.code != 'false'`, ci.yml:143) and already a `needs` of the `ci` aggregate (ci.yml:339) — so the gate inherits correct path-gating AND ci gating with **zero changes to the `ci` needs array** and no extra `npm ci`.
- Runs BEFORE the multi-minute tarball install -> **fails fast** on a type error.
- Node/OS-independent; the e2e job is Linux + single Node 24, matching the requirement.

**Alternative (stronger isolation, costs one `npm ci`): a dedicated `typecheck-e2e` job** — Linux + Node 24, `if: needs.changes.outputs.code != 'false'`, steps = checkout/setup-node(cache:npm)/`npm ci`/`npx nx run-many -t typecheck-e2e`, and **add `typecheck-e2e` to the `ci` job's `needs` array (ci.yml:334-344)**. Prefer this only if you want the typecheck signal decoupled from e2e-install flakiness or as a discrete check name. Given the repo's `ci`-aggregate model (one required check), the in-`e2e`-job step is sufficient and lazier.

Do NOT fold it into `format-lint` (gated on the broader `formatlint` output — would run on docs-only PRs) or into the `test` matrix (would run an OS-independent check 6x).

## Q5: Pitfalls

1. **GUARD-01 `-p`-list parser coupling (the real trap).** `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` slices the `e2e:` job block and `.find()`s the FIRST line matching `/^\s*-p\s+\S/` (a line-START `-p`, i.e. a folded-scalar continuation) then asserts it set-equals the `e2e/*` projects `[VERIFIED: ci-e2e-coverage-guard.spec.ts:82-96]`. **Mitigation:** the recommended typecheck step is a SINGLE-LINE `- run:` with NO `-p` at all, so `/^\s*-p/` never matches it and the guard still parses the folded `test` step's list. If you instead give the typecheck step its own folded (`>`) `-p` list, GUARD-01 would `.find()` whichever `-p` line comes first — safe ONLY if identical to the test set, but fragile. Keep it `-p`-less. (GUARD-01b just asserts `--parallel=1` exists somewhere in the block — unaffected.) Optional follow-up: extend GUARD-01 to assert each `e2e/*` project defines a `typecheck-e2e` target, closing the "new e2e project forgets the target" gap.
2. **`outDir` + `--noEmit`.** `tsconfig.spec.json` sets `outDir: ../../dist/out-tsc` but the CLI `--noEmit` flag overrides emission — no files written (the verified exit-0 run used that same outDir) `[VERIFIED: tsc exit 0]`. No cleanup, no dist pollution.
3. **`vitest.config.mts` in the program.** It imports `@nx/vite/plugins/*` and `vitest/config`; it type-checks clean — the verified exit-0 run (and the baseline, which only errored on `inject`) both had `vitest.config.mts` in `include` `[VERIFIED: tsc exit 0]`. No concern.
4. **Windows vs Linux.** Pure `tsc` on a fixed program is deterministic across OS; verified on Windows arm64 (dev box), CI runs Linux — same result expected. `moduleResolution: bundler` is OS-independent. No path-sep exposure in the check itself.
5. **`.nx`/cache.** `cache: true` keys on the declared inputs; `outputs: []` means the cache records pass/fail + terminal output only. In CI (fresh checkout, no Nx Cloud) first run computes, replays are instant. `NX_DAEMON: false` is already set on the `e2e` job — no daemon race.

---

## Exact change set (for the planner)

1. `e2e/angular-typechecker-install-e2e/src/global-setup.ts` — line 5 import + line 68 param: `GlobalSetupContext` -> `TestProject`. Keep the `declare module 'vitest'` block in place.
2. `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` — add `"src/global-setup.ts"` to `include`.
3. Add a `typecheck-e2e` `nx:run-commands` target (shape above) to all THREE e2e `project.json` files (`command` = `tsc --noEmit -p e2e/<project>/tsconfig.spec.json`, `cwd: "."`).
4. `.github/workflows/ci.yml` — insert `- run: npx nx run-many -t typecheck-e2e` in the `e2e` job between `- run: npm ci` and the folded `test` run-many step.
   (No `ci` needs-array change: `e2e` is already a need.)

No changes to cache-e2e/matrix-e2e sources or tsconfigs (already clean).

## Sources

- Primary (HIGH): `node_modules/vitest/dist/node.d.ts:264`, `reporters.d.DtoKVV2s.d.ts:1971`, `cli-api.24X8XwN1.js:10746` (vitest 4.1.9, installed); repo files `nx.json`, `packages/angular-typechecker/project.json`, `.github/workflows/ci.yml`, `ci-e2e-coverage-guard.spec.ts`, `tsconfig.base.json`, `libs/typecheck-consumer/project.json`; `tsc --noEmit` exit codes (baseline exit 2 / A2-unfixed exit 2 / A2-fixed exit 0 / cache exit 0 / matrix exit 0).
- Secondary (HIGH): `[CITED: vitest.dev/config/globalsetup]` — TestProject arg + provide/inject + ProvidedContext augmentation pattern.

## Metadata

**Confidence:** GlobalSetupContext fix HIGH (empirical exit 0 + type source + runtime source + official docs); A2 cleanliness HIGH (empirical); sibling cleanliness HIGH (empirical); target/CI wiring HIGH (matches repo precedent, GUARD-01 read directly).
**Research date:** 2026-07-05. **Valid until:** next vitest major or Nx major.
