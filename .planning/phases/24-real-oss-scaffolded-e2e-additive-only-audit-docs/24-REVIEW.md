---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
reviewed: 2026-07-11T12:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts
  - packages/angular-typechecker/src/index.drift.ts
  - packages/angular-typechecker/tsconfig.drift.json
  - packages/angular-typechecker/src/angular-cli-docs.spec.ts
  - packages/angular-typechecker/README.md
  - CHANGELOG.md
  - e2e/angular-typechecker-ng-cli-e2e/project.json
  - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts
  - e2e/angular-typechecker-ng-cli-e2e/tsconfig.json
  - e2e/angular-typechecker-ng-cli-e2e/tsconfig.spec.json
  - e2e/angular-typechecker-ng-cli-e2e/vitest.config.mts
  - fixtures/builder-context/angular.json
  - fixtures/builder-context/app.component.ts
  - fixtures/builder-context/app.component.spec.ts
  - fixtures/builder-context/tsconfig.app.json
  - fixtures/builder-context/tsconfig.spec.json
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-07-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 24 is a verification/audit/docs phase: it adds no production engine or generator
surface, only two specs (a builder-over-`BuilderContext` integration spec and a real-`ng`
scaffolded-workspace e2e), planted-error fixtures, a barrel drift tripwire, a new e2e
project, and Angular CLI documentation. I reviewed every changed source file at standard
depth and cross-referenced the executor, builder, `normalizeOptions`, the barrel (`index.ts`),
the CI workflow, and the sibling e2e projects and GUARD specs.

Key correctness items verified GREEN:

- **`index.drift.ts` locks the full public surface.** It imports all five barrel exports --
  `runTypecheck` / `TypecheckInfrastructureError` (values, `void`-referenced) and
  `CoreOptions` / `CoreResult` / `SkippedReference` (types, pinned in a tuple) -- so a
  removed or renamed export fails `tsc --noEmit` (TS2305) under `tsconfig.drift.json`, which
  is wired into the `typecheck` target (`project.json:94`). Additive-only charter enforced.
- **e2e per-project scoping is genuinely proven, not green-washed.** `ng-add-ng-run.e2e.spec.ts`
  asserts distinct per-leaf codes (app `TS2322` + app-spec `TS2345`, lib `TS2554`), asserts the
  reverse direction (lib run excludes both app codes), asserts a non-vacuous pre-`ng add`
  baseline, and guards against a false failure with `not.toMatch(/ERR_REQUIRE_ESM/)` +
  `not.toContain('infrastructure error')`. Cleanup via `finally { removeTmpDir(tmp) }`.
- **`global-setup.ts` publish safety is intact.** The `http://127.0.0.1:` loopback gate
  (lines 118-122), the `buildCleanEnv({ stripAllNpmConfig: true })` + residual-`npm_config_*`
  assertion (lines 128-134), and the provenance strip are all preserved from the install-e2e
  copy. No path to a public registry.
- **GUARD contract holds.** The new project carries `e2e` + `typecheck` targets and the
  `type:e2e` tag; `ci-e2e-coverage-guard.spec.ts` enumerates e2e projects dynamically, so the
  4th project does not break GUARD-01/01b/01c/01d, and CI's `--parallel=1` is still enforced.
- **Docs are coherent and end-user-facing.** The README `## Angular CLI` section preserves the
  Storybook "not supported" caveat (README:461-463, 567-568), uses no internal ids, and every
  string asserted by `angular-cli-docs.spec.ts` is present.
- **Planted fixtures are correct by design** (TS2322 in `app.component.ts`, TS2345 in
  `app.component.spec.ts`) -- these are the test input that proves `success: false`, not bugs.

One weak-assertion issue in the integration spec (WR-01) plus three low-severity accuracy /
robustness nits are the only findings.

## Warnings

### WR-01: Planted-error integration test asserts only the boolean verdict, so a fixture-load failure would pass green

**File:** `packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts:123-129, 139-147`
**Issue:** The planted-error cases assert only `expect(output.success).toBe(false)`. The
builder (via the wrapped executor's `catch` in `executor.ts:75-85`) maps a
`TypecheckInfrastructureError` -- e.g. an unreadable/unresolvable tsconfig -- to
`{ success: false }` exactly as it maps a real type error. So this test would still pass if
the `builder-context` fixture stopped loading (tsconfig resolution regression, base-config
drift) and the planted `TS2322`/`TS2345` were never actually surfaced. Unlike the e2e spec,
it never asserts the specific diagnostic codes nor `not(infrastructure error)`, and the CLEAN
case exercises a *different* fixture (`clean-template-host`), so no test proves the
`builder-context` fixture loads cleanly. The spec's stated purpose ("a real BuilderOutput
flowed and the planted TS2322 + TS2345 ... drove the verdict to failure", line 126-127) is
therefore not actually locked down -- it is asserted in a comment, not in code. The parity
assertion partially mitigates (executor would also be `false`), but both can be `false` for
the same wrong reason.
**Fix:** Capture the report the executor writes to stdout and assert the planted codes are
present and the failure is a real type error, e.g.:
```ts
async function runBuilderCapturingStdout(
  tsConfig: readonly string[],
): Promise<{ output: BuilderOutput; stdout: string }> {
  let stdout = '';
  const original = process.stdout.write.bind(process.stdout);
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array, ...rest: unknown[]) => {
      stdout += chunk.toString();
      return original(chunk as string, ...(rest as []));
    });

  try {
    return { output: await runBuilder(tsConfig), stdout };
  } finally {
    spy.mockRestore();
  }
}

// in the planted-error case:
const { output, stdout } = await runBuilderCapturingStdout([appLeaf, specLeaf]);
expect(output.success).toBe(false);
expect(stdout).toContain('TS2322');
expect(stdout).toContain('TS2345');
expect(stdout).not.toContain('infrastructure error');
```
This makes the integration spec non-vacuous the way the e2e spec already is.

## Info

### IN-01: e2e spec comment claims it "shares the ONE dist tarball path" -- it does not

**File:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts:29-30`
**Issue:** The header comment states "It shares the ONE dist tarball path with the sibling
e2e projects, so the CI e2e job MUST stay `--parallel=1`." This project does **not** `npm pack`
a shared `dist/.../angular-typechecker-<ver>.tgz` and never `rmSync`s one (contrast the other
three e2e projects, per `ci.yml:196-204` and GUARD-01b). Its `global-setup.ts` instead
`nx build`s dist and publishes to Verdaccio (`ng add` pulls from the registry). The
`--parallel=1` requirement is still real -- the global-setup rebuilds and mutates the shared
`dist/packages/angular-typechecker/` (manifest provenance strip) that siblings pack from -- but
the stated rationale is wrong. A maintainer trusting this comment would hunt for a tarball
`rmSync` that isn't here and could wrongly conclude the `--parallel=1` coupling is stale.
**Fix:** Reword to the actual mechanism, e.g. "shares the same `dist/packages/angular-typechecker/`
build output (this project rebuilds + publishes it; siblings pack it), so the CI e2e job must
stay `--parallel=1`."

### IN-02: `ngRun` uses raw `execSync` with the default 1 MB `maxBuffer`

**File:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts:126-131`
**Issue:** `execSync('npx ng run ...')` runs with Node's default `maxBuffer` (1 MB). If a
failing `ng run <project>:typecheck` ever emits more than 1 MB of combined output, `execSync`
throws with `status: undefined` and a truncated `stdout`; the catch then returns `code: 1`
with output that may be truncated *before* the asserted `TSxxxx` token, turning a real failure
into a confusing false-negative on the `toContain(CODE)` assertions. For the current few
planted diagnostics the output is small, so this is latent, not active.
**Fix:** Pass an explicit generous buffer to remove the ceiling:
```ts
execSync(`npx ng run ${target}`, { cwd, env: runEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
```

### IN-03: CHANGELOG `0.2.1` entry omits the release date and the bottom link reference every prior version has

**File:** `CHANGELOG.md:5, 301-306`
**Issue:** The `## 0.2.1` heading has no `(YYYY-MM-DD)` date, and there is no `[0.2.1]:`
tag link definition in the reference block at the bottom (every released version 0.2.0 down to
0.0.1 has both). This is consistent with a work-in-progress entry finalized during the Release
PR per `AGENTS.md`, so it is a reminder rather than a defect -- but if it ships as-is the public
changelog will be visibly inconsistent with the rest of the file.
**Fix:** At the release cut, add the date to the `## 0.2.1` heading and append
`[0.2.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.2.1`
to the reference block.

---

_Reviewed: 2026-07-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
