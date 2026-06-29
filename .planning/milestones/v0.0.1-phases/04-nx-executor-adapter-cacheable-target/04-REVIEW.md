---
phase: 04-nx-executor-adapter-cacheable-target
reviewed: 2026-06-28T00:00:00Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - packages/angular-typechecker/src/core/render-report.ts
  - packages/angular-typechecker/src/core/render-report.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/format-report.ts
  - packages/angular-typechecker/src/core/evaluate-result.ts
  - packages/angular-typechecker/src/index.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/schema.json
  - packages/angular-typechecker/src/executors/angular-typecheck/schema.d.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts
  - packages/angular-typechecker/executors.json
  - nx.json
  - tsconfig.base.json
  - libs/typecheck-consumer/project.json
  - libs/typecheck-consumer/package.json
  - libs/typecheck-consumer/src/index.ts
  - libs/typecheck-consumer/src/lib/consumer.component.ts
  - libs/typecheck-consumer/tsconfig.json
  - libs/typecheck-consumer/tsconfig.lib.json
  - libs/typecheck-consumer-dep/project.json
  - libs/typecheck-consumer-dep/package.json
  - libs/typecheck-consumer-dep/src/index.ts
  - libs/typecheck-consumer-dep/src/lib/dep.component.ts
  - libs/typecheck-consumer-dep/src/lib/dep.component.ts.pristine
  - libs/typecheck-consumer-dep/tsconfig.json
  - libs/typecheck-consumer-dep/tsconfig.lib.json
  - e2e/angular-typechecker-cache-e2e/project.json
  - e2e/angular-typechecker-cache-e2e/vitest.config.mts
  - e2e/angular-typechecker-cache-e2e/tsconfig.json
  - e2e/angular-typechecker-cache-e2e/tsconfig.spec.json
  - e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts
  - e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-28
**Depth:** deep (cross-file: adapter -> core seam, target -> cache inputs, fixture graph edge)
**Files Reviewed:** 27 source files (+ specs)
**Status:** issues_found (no Critical/High; 4 Warning, 6 Info)

## Summary

Phase 4 wraps the Phase 1-3 core as the `angular-typecheck` Nx executor, adds the cacheable `targetDefaults`, and ships the TEST-04 "cache-cannot-lie" gate plus committed fixtures. I reviewed for correctness, security, and quality with an adversarial stance, tracing the adapter -> core seam, the cache-input recipe, and the cache-test false-PASS surface.

The correctness-critical claims hold up:

- **renderReport seam (D-02) is clean.** It imports only `compiler-loader`, `format-report`, and types -- NOT `@nx/devkit`. The barrel (`src/index.ts`) exports `renderReport`/`loadCompilerCli` but NOT `loadTypescript`, so the anti-leak invariant is intact.
- **The executor RE-THROWS unknown errors** and only maps `TypecheckInfrastructureError` to `{ success: false }`. The "a type-checker that lies is worse than none" rule is honored, and a unit test asserts the re-throw. The adapter is 62 lines incl. doc comment / ~25 lines of body -- well under the sub-50-line intent.
- **tsConfig resolution is correct** (`isAbsolute ? : joinPathFragments(context.root, ...)`), POSIX-stable, with both branches unit-tested.
- **The cache gate is genuinely blocking.** The R1 `--check` pre-flight uses `execSync` (throws on exit 1, no `head`/`rg` pipe masking), and the HIT and MISS cases are BOTH asserted with defense-in-depth (static marker + exit code + injected diagnostic code). The crash-safe revert is `.pristine` heal + `finally` byte-restore (not `git checkout`), which survives a killed worker.
- **The `includeDeps: true` fix is correct** and necessary: the non-buildable dep is out-of-project for the consumer's leaf-tsconfig boundary filter, so without it the injected dep error is silently suppressed (a false PASS) -- the deviation log documents this as a load-bearing prerequisite fix.

No Critical or High findings. The Warning-tier items are robustness/false-PASS-hardening gaps in the e2e harness and one cross-OS path-handling fragility; the Info items are quality/duplication observations. ASCII-only, brace, and blank-line-around-control-flow conventions are followed throughout.

## Warnings

### WR-01: Cache-MISS assertion can false-PASS on a *non-cache* failure (e.g. ERR_REQUIRE_ESM, graph error, executor crash)

**File:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts:185-188`

**Issue:** Run #3 (the MISS case) asserts three things: marker absent, `stdout` matches `/TS2322|2322/`, and `code !== 0`. The `/TS2322|2322/` regex is the only signal that distinguishes a genuine *cache-busted-and-reported-the-error* outcome from a *failed for an unrelated reason* outcome (compiler-cli ESM load failure, project-graph error, daemon issue, an Nx upgrade changing output). But `2322` is a bare 4-digit number -- it can appear coincidentally in a stack trace, a file offset, a hash fragment, or an unrelated TS code, so the regex is weak insurance against a false PASS where the cache "lied" but the run failed for a different reason. A truly broken cache that served the GREEN result would also be caught only by the marker-absent + exit-nonzero pair, which a crashed run satisfies for the wrong reason.

**Fix:** Tighten the diagnostic match to the rendered codeframe form the executor actually emits (e.g. require the `TS2322` token specifically, and ideally the message fragment), and add an explicit negative assertion that the run did NOT fail for an infrastructure reason:

```ts
// Require the real, rendered TS code token (not a bare 4-digit substring).
expect(third.stdout).toContain('TS2322');
// Guard the MISS case against an UNRELATED failure masquerading as a bust.
expect(third.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
expect(third.stdout).not.toContain('infrastructure error');
```

### WR-02: Per-run isolated `NX_CACHE_DIRECTORY` is created once but never cleaned up

**File:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts:84`

**Issue:** `const cacheDir = mkdtempSync(join(tmpdir(), 'atc-cache-'));` creates a temp cache directory at module load and never removes it. Each CI run (and each local run) leaks a populated `atc-cache-*` directory under the OS temp dir; on a CI runner that reuses the temp volume across jobs, or on a developer's machine across many runs, these accumulate (a real-`performCompilation` cache is non-trivial in size). There is no `afterAll` teardown. This is not a correctness bug for the gate itself, but it is an unbounded disk leak in the most-frequently-run correctness test.

**Fix:** Add an `afterAll` that removes the temp cache dir:

```ts
import { rmSync } from 'node:fs';

afterAll(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});
```

### WR-03: `workspaceRoot.split('\\').join('/')` is a fragile, platform-skewed path normalization

**File:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts:44`

**Issue:** `consumerTsConfig` is built as `${workspaceRoot.split('\\').join('/')}/libs/.../tsconfig.lib.json`. This hand-rolls a Windows-to-POSIX separator conversion by string replacement instead of using the `joinPathFragments`/`node:path` primitives the production code uses for exactly this reason (D-03 explicitly chose `joinPathFragments` "for POSIX-separator stability on Windows arm64"). The string-replace approach is brittle: it only converts backslashes that survive `path.join`'s normalization, it would silently mishandle a UNC path (`\\\\server\\share`), and it diverges from the project's own established path-handling convention. The test path is then passed straight to `runTypecheck` (bypassing `normalizeOptions`), so any separator mishandling surfaces only at compiler-cli config resolution.

**Fix:** Reuse the project's path primitive instead of string surgery:

```ts
import { joinPathFragments } from '@nx/devkit';

const consumerTsConfig = joinPathFragments(
  workspaceRoot,
  'libs/typecheck-consumer/tsconfig.lib.json',
);
```

### WR-04: The dual-key cacheable `targetDefaults` duplicates a 7-line input recipe verbatim, with a drift risk and a Phase-5 leak hazard

**File:** `nx.json:41-72`

**Issue:** `targetDefaults` carries TWO keys -- the published id `angular-typechecker:angular-typecheck` and the dev-workspace-scoped id `@angular-typechecker/angular-typechecker:angular-typecheck` -- each with a byte-identical copy of the `^default` / `externalDependencies` input recipe. The duplication is documented as intentional (the dev fixtures resolve the executor through the tsconfig path-alias scope, so only the scoped key actually binds locally; see 04-03-SUMMARY deviation #1). Two concrete risks: (1) **drift** -- a future tweak to the inputs recipe must be applied to both blocks or the dev gate and the documented consumer recipe silently diverge, and the correctness gate runs against only the scoped key while the README publishes the unscoped one; (2) **leak hazard for Phase 5** -- the scoped `@angular-typechecker/...` key is a pure dev-workspace artifact and MUST NOT appear in the published consumer recipe/README (the SUMMARY flags this hand-off explicitly, but nothing in code enforces it). The published key's recipe is therefore only ever exercised indirectly.

**Fix:** This is advisory-only and the duplication is a deliberate dev-workspace accommodation, so no code change is strictly required in Phase 4. To de-risk: add a short comment in `nx.json` marking the `@angular-typechecker/...` key as DEV-WORKSPACE-ONLY / never-publish, and add a Phase-5 checklist assertion that the published README recipe is keyed ONLY by `angular-typechecker:angular-typecheck`. If feasible, factor the shared input array into a single `namedInputs` entry referenced by both keys to kill the drift surface.

## Info

### IN-01: `loadTypescript` is duplicated verbatim across `run-typecheck.ts` and `render-report.ts`

**File:** `packages/angular-typechecker/src/core/render-report.ts:29-40`

**Issue:** The `cachedTypescript` memo + `loadTypescript()` function is copied verbatim from `run-typecheck.ts:340-351` (the comment says so explicitly). This is deliberate anti-leak duplication (keeping `loadTypescript` un-exported from the barrel), but it means two independent module-level memos of the same module, and any future fix to the loader (e.g. handling a different default-export shape) must be applied in two places. The cost is one extra near-free `import('typescript')` per process.

**Fix:** Optionally extract a shared, non-barrel-exported `load-typescript.ts` internal module that both `run-typecheck.ts` and `render-report.ts` import (and that `index.ts` deliberately does not re-export), giving a single memo + single maintenance point without leaking it to the public API. Acceptable to leave as-is given the explicit design rationale.

### IN-02: Loose diagnostic-code regex `/TS2322|2322/` repeated in three places

**File:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts:187,211` and `executor-parity.int.spec.ts:228`

**Issue:** The same weak `/TS2322|2322/` substring match appears in three assertions. Beyond the false-PASS concern in WR-01, the duplicated loose literal is a maintenance smell -- if the injected error code ever changes, three sites must update.

**Fix:** Hoist a single `const INJECTED_TS_CODE = 'TS2322';` and assert `toContain(INJECTED_TS_CODE)` everywhere; pair with the WR-01 tightening.

### IN-03: `sortedCodes` line exceeds the readable width and chains on one line

**File:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts:147-149`

**Issue:** `return result.diagnostics.map((diagnostic) => diagnostic.code).sort((a, b) => a - b);` is a single long line combining a `.map` and a `.sort`. It is correct (numeric sort comparator is right), just dense; Prettier may or may not wrap it depending on config.

**Fix:** Cosmetic only; let Prettier format, or split the `.map`/`.sort` for readability.

### IN-04: `buildContext()` casts through `unknown as ExecutorContext` and omits most context fields

**File:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts:107-125`

**Issue:** The `ExecutorContext` is built as a partial literal and force-cast `as unknown as ExecutorContext`. This is standard test practice and the executor only reads `root` + the fields `runExecutor` needs, but the double-cast suppresses any type signal if the executor later starts reading another context field. The `nxJsonConfiguration` is `JSON.parse`'d with an implicit `any`.

**Fix:** Acceptable for a test harness. If desired, type the parsed nx.json (`as NxJsonConfiguration`) and build the context against `Partial<ExecutorContext>` to narrow the cast surface.

### IN-05: `consumer.component.ts` / `dep.component.ts` carry no `tsconfig.spec.json`, relying on `production` named-input excludes that target spec globs not present

**File:** `libs/typecheck-consumer/tsconfig.lib.json:15`, `libs/typecheck-consumer-dep/tsconfig.lib.json:15`

**Issue:** Both fixture libs include `src/**/*.ts` with no `tsconfig.spec.json` and no spec files, while the cacheable target's `production` input excludes `tsconfig.spec.json` and `*.spec.ts`. This is harmless today (there are no specs in the fixtures), but the `{projectRoot}/tsconfig*.json` input glob would pick up a future `tsconfig.spec.json` and the `production` exclude assumes one may exist -- the fixtures are internally consistent but under-document that they are deliberately spec-free.

**Fix:** None required. Optionally add a one-line comment in each fixture `tsconfig.lib.json` noting the fixtures are intentionally spec-free so the cache recipe's spec excludes are no-ops here.

### IN-06: `.int.spec.ts` mutation files are guarded against the Vitest include glob, but the dep source is reachable by other tooling that scans `src/**/*.ts`

**File:** `libs/typecheck-consumer-dep/src/lib/dep.component.ts:1-21`

**Issue:** The mutation target is correctly a non-`.spec` file the Vitest `include` (`src/**/*.int.spec.ts`) ignores, and the `.pristine` sidecar + `finally` restore + CI `git diff --exit-code` backstop are solid (D-15). One residual: during the window between `writeFileSync(injected)` and the `finally` restore, the file on disk is genuinely broken; if a *parallel* watcher/LSP/another Nx target scanned `libs/typecheck-consumer-dep` it would observe the injected error. The D-14 serialization (singleFork, `fileParallelism: false`, `NX_DAEMON=false`) and main-tree run (D-17) close this in practice.

**Fix:** None required given the serialization guarantees. Documented here only so the time-of-mutation window is a known, accepted property rather than an unexamined one.

---

_Reviewed: 2026-06-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
