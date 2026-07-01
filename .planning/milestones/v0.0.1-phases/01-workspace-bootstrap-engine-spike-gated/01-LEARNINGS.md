---
phase: 01
phase_name: 'workspace-bootstrap-engine-spike-gated'
project: 'angular-typechecker'
generated: '2026-06-27'
counts:
  decisions: 6
  lessons: 6
  patterns: 6
  surprises: 5
missing_artifacts:
  - 'UAT.md'
---

# Phase 01 Learnings: Workspace Bootstrap + Engine Spike (GATED)

> Extracted from 4 PLAN.md + 4 SUMMARY.md, plus 01-VERIFICATION.md, 01-REVIEW.md, 01-SECURITY.md, 01-RESEARCH-ADDENDUM-WAVE3.md, and STATE.md. The spike verdict was GO on all six go/no-go items.

## Decisions

### Keep the deep-`.d.ts` type-only shim for compiler-cli under `module: nodenext`

`src/core/compiler-cli-types.ts` re-exports the `@angular/compiler-cli` API from the package's DEEP declaration files (relative path) instead of importing from the package barrel, because the barrel does not type-resolve under `module: nodenext`.

**Rationale:** It was the only option that preserves the locked `module: nodenext` emit (the GATE A enabler). Verified alternatives are all worse: `moduleResolution: bundler` is mutually exclusive with `module: nodenext` (TS5095/TS5109); `esnext`/`bundler` emit an ESM executor Nx's `require()` loader cannot load; `module: commonjs` + the `Function('return import()')` trick is the path PROJECT.md deliberately rejected. The shim is type-only (erased at emit), so the worst-case failure is a CI build error, never a shipped runtime bug.
**Source:** 01-03-SUMMARY.md, 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 1)

### Re-pin all `@angular/*` to EXACT `22.0.4`

The `@nx/angular@23.0.1` `:application` generator wrote Angular `~21.2.0` framework deps (its baseline default). Re-pinned every `@angular/*` framework + tooling package to exact `22.0.4`.

**Rationale:** The locked stack is Angular 22 (D-15); the generator default conflicts with `@angular/compiler-cli@22.0.4`. Exact dev pins keep dev/CI reproducible.
**Source:** 01-02-SUMMARY.md

### Commit a root `.npmrc` with `legacy-peer-deps=true`

A documented `.npmrc` reconciles the locked Angular-22 + Nx-23 pairing.

**Rationale:** `@nx/angular@23.0.1` caps `@angular/build` / `@angular-devkit/*` / `@schematics/angular` peers at `< 22.0.0` (it formally supports Angular up to 21). The locked Angular-22 tree legitimately exceeds those optional peer ranges. CI and all future `npm install`s inherit this; revisit when an `@nx/angular` 23.1.x admits Angular 22.
**Source:** 01-02-SUMMARY.md, STATE.md Blockers/Concerns

### GATE A static positive target is built `core/compiler-loader.js`, not `executor.js`

The `/import\(/` positive assertion reads the built `core/compiler-loader.js`; the negative `require('@angular/compiler-cli')` assertion runs on BOTH built files (comment-stripped).

**Rationale:** Per the core/adapter split, the memoized `await import()` lives in core; the executor is a thin delegate. CONTEXT D-12's original "executor.js" target was corrected after the engine was built.
**Source:** 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 2)

### Assert the NG8109 diagnostic as `-998109`, never bare `8109`

GATE B asserts `toContain(-998109)` (with an optional `Math.abs(c)-990000===8109` recovery helper); TS code `2322` stays raw.

**Rationale:** Angular encodes extended diagnostic codes negative on `ts.Diagnostic.code` (`ngErrorCode(code) = parseInt('-99'+code)`); bare `8109` never appears. CONTEXT D-17's "8109" was the diagnostic's logical code, not its `ts.Diagnostic.code` value.
**Source:** 01-04-SUMMARY.md, 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 3)

### Commit the orchestrator's STATE.md bookkeeping as the canonical pre-bootstrap HEAD

The clean-tree precondition was satisfied by committing the GSD "execution started" STATE.md change (no user code) before the destructive bootstrap.

**Rationale:** The bootstrap's NON-NEGOTIABLE precondition is a clean tree + a captured pre-bootstrap HEAD. The move-aside would have preserved the STATE.md change regardless (no clobber risk); committing it just restored the documented precondition exactly.
**Source:** 01-01-SUMMARY.md

---

## Lessons

### `module: nodenext` cannot type-resolve `@angular/compiler-cli@22.0.4`'s barrel

The package `index.d.ts` uses extensionless `export *` re-exports; strict nodenext type resolution never tries the sibling `.d.ts` (only the path as a directory), so the namespace collapses to empty (TS2305 on every named import).

**Context:** This blocked the plugin build under the locked `module: nodenext` and forced the deep-`.d.ts` shim. Angular's own `@angular/build` consumes these types under `module: commonjs` / `moduleResolution: node`, so the barrel is simply not nodenext-tested upstream.
**Source:** 01-03-SUMMARY.md, 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 1)

### `@nx/angular@23.0.1` is not Angular-22-ready out of the box

Its `:application` generator scaffolds Angular 21.2 deps, and its peer ranges cap Angular tooling at `< 22.0.0` — even though both `@nx/angular` and Angular 22 are current "latest" releases.

**Context:** Required two compensating actions (exact re-pin to 22.0.4 + `legacy-peer-deps=true`) to host a real Angular 22 app in an Nx 23 workspace. This is the practical cost of the "only viable pairing" PROJECT.md documents.
**Source:** 01-02-SUMMARY.md

### `create-nx-workspace --preset=apps` is a minimal empty workspace

CNW 23.0.1 with `--preset=apps` does NOT emit `tsconfig.base.json`, `.prettierrc`, or `apps/.gitkeep`. Those materialize only when the first project is generated.

**Context:** Plan 01-01's `files_modified` optimistically listed `tsconfig.base.json`; it actually appeared during Plan 01-02's plugin generation. Plan a "verify/create tsconfig.base.json after first generator" step rather than expecting CNW to emit it.
**Source:** 01-01-SUMMARY.md, 01-02-SUMMARY.md

### npm's script-allowlist gate blocks postinstall native bindings

Postinstall scripts for `nx`, `less`, `unrs-resolver`, `@parcel/watcher` were blocked. `nx report` and the generators still resolved (nx's postinstall is a best-effort `try/catch`).

**Context:** A blocked native binding can be a silent degradation; confirm `nx report` + a real `nx build`/`nx test` after install rather than trusting the install exit code.
**Source:** 01-01-SUMMARY.md

### `runTypecheck` silently drops `readConfiguration().errors` (false-clean risk)

`ng.readConfiguration(...)` returns a `parsed.errors` array that the core currently ignores; a malformed/unresolvable tsconfig can yield empty `rootNames` and report `errorCount: 0` / `success: true`.

**Context:** Highest-impact product failure mode for a type-checker (a checker that lies). The Phase-1 gate never exercises a broken config, so it did not surface. Fold `parsed.errors` into diagnostics before counting when the real engine lands (Phase 2 / ENG-01). [code-review MD-01]
**Source:** 01-REVIEW.md

### `warningCount = total - errorCount` conflates diagnostic categories

The count lumps Warning + Suggestion + Message together (and would miscount ngc's "Time for diagnostics" Message if a consumer sets `diagnostics: true`).

**Context:** Count the `Warning` category explicitly in Phase 2 (ENG-04). [code-review MD-02]
**Source:** 01-REVIEW.md

---

## Patterns

### Mechanism B in-place bootstrap (move-aside -> CNW temp -> copy over preserved `.git/` -> restore)

Confirm clean tree + capture HEAD; move tracked non-code artifacts aside; `create-nx-workspace@<exact>` in a temp sibling with explicit flags (`--preset=apps --packageManager=npm --nxCloud=skip --skipGit --no-interactive`); copy generated files dotfile-safe over the preserved root `.git/`; restore the moved artifacts; verify HEAD-unchanged + no clobber at a blocking human checkpoint before committing.

**When to use:** Scaffolding a fresh Nx (or similar) workspace into a directory that already holds `.git/` + tracked files (`create-nx-workspace .` is a hard error on a non-empty dir). The named-subdir generation + `--skipGit` provably never touches the root `.git/`.
**Source:** 01-01-SUMMARY.md, 01-CONTEXT.md (D-01/D-02)

### Memoized `await import()` ESM bridge as the single runtime value-import

One memoized `await import('@angular/compiler-cli')` in `core/compiler-loader.ts`; every other reference is `import type`. Compiled under `module: nodenext` so the call survives emit (no `require()` downlevel) yet is `require()`-loadable as CJS.

**When to use:** A CommonJS package (e.g. an Nx executor loaded by `require()`) that must consume an ESM-only dependency at runtime, on TS `node16`/`nodenext`.
**Source:** 01-03-SUMMARY.md, 01-RESEARCH.md

### Unconditional all-getter + same-program differential

Call every diagnostic getter unconditionally (incl. `getNgSemanticDiagnostics()`); prove the value-add by running the framework's default `&&`-chained gatherer on the SAME parsed config (with a FRESH `options` spread per call to avoid shared mutated `noEmit`) and asserting it OMITS a code the all-getter includes.

**When to use:** Proving a custom gatherer surfaces diagnostics a phase-short-circuiting default suppresses; any "we collect more than the stock path" claim needs this differential to be load-bearing.
**Source:** 01-03-SUMMARY.md, 01-04-SUMMARY.md

### Out-of-graph deliberate-error fixture with its own tsconfig(s)

Put intentionally-broken code in a committed fixture dir with NO `project.json` (out of the Nx graph) and its own `tsconfig` (`strictTemplates: true`, `noEmit: true`); ensure nothing in the workspace imports it (TS #36017: `exclude` does not stop type-checking of imported files).

**When to use:** Committing deliberate compile errors as test input without polluting the project graph or breaking a green smoke app.
**Source:** 01-03-SUMMARY.md, 01-CONTEXT.md (D-13)

### Two-tier gate: static byte assertion + runtime no-masquerade guard

Tier 1: read the BUILT `.js` via `fs.readFileSync` + regex (strip `//` comments first; assert both a positive token and a negative token). Tier 2: a runtime assertion that a failure cannot masquerade as success (here `not.toContain(500)` + the run resolves, so an ESM-load failure fails the gate instead of looking like a clean diagnostic run).

**When to use:** Proving a build-emit property where a single signal (token present, or "tests passed") could false-pass. Never `git grep` a gitignored `dist/`.
**Source:** 01-04-SUMMARY.md, 01-RESEARCH-ADDENDUM-WAVE3.md

### Deterministic manifest-contract unit test

A pure Vitest test that reads `package.json` and asserts the exact dependency model (`@nx/devkit` pinned exact dep, NO `nx`, exact peer ranges, `type: commonjs`, `engines.node`).

**When to use:** Cheaply policing a publishable package's dependency/compat contract before a heavier linter (`@nx/dependency-checks`) lands; catches accidental manifest drift on every test run.
**Source:** 01-VALIDATION.md audit, packages/angular-typechecker/src/package-manifest.spec.ts

---

## Surprises

### NG8109 is encoded NEGATIVE on `ts.Diagnostic.code` (`-998109`)

Angular offsets extended diagnostic codes via `ngErrorCode(code) = parseInt('-99' + code)`. The all-getter probe returned `[2322, -998109, -998117]`, not `[2322, 8109, ...]`.

**Impact:** Invalidated the planned bare-`8109` GATE B assertion; the gate spec, CONTEXT D-17, and VALIDATION.md were all corrected to `-998109`. Recovery: `Math.abs(c) - 990000 === 8109`.
**Source:** 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 3)

### The `await import()` landed in core, not the executor

GATE A's `import(` survival had to be asserted on `core/compiler-loader.js`; `executor.js` only mentions the package in a JSDoc comment.

**Impact:** Shifted the GATE A static positive-assertion target and added a comment-strip requirement to the negative check (a bare `not.toContain('@angular/compiler-cli')` would false-fail on the executor's comment).
**Source:** 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 2), 01-04-SUMMARY.md

### NG8117 fires as an expected companion of the signal-not-invoked fixture

The all-getter returned `-998117` (NG8117 `UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION`) alongside `-998109`, because a signal is callable and the fixture interpolates it.

**Impact:** Benign extra diagnostic in the all-getter set; confirmed expected (not noise) so the gate assertions tolerate it.
**Source:** 01-RESEARCH-ADDENDUM-WAVE3.md (Finding 3), 01-04-SUMMARY.md

### `@nx/angular@23.0.1` does not admit Angular 22 in its peers despite both being "latest"

The current Nx Angular plugin formally supports Angular up to 21, so the locked, current Angular-22 stack required `legacy-peer-deps=true` to install.

**Impact:** The workspace's installs now depend on a committed `.npmrc` override (inherited by CI); a real, documented constraint of the only TS-6-viable pairing.
**Source:** 01-02-SUMMARY.md

### The test suite is 17 tests, not the ~13 estimated

`gate-b.spec.ts` reports 5 tests because `describe.each([app, lib])` parameterizes the positive + differential cases across both fixtures.

**Impact:** Estimate-vs-actual discrepancy only (no coverage gap); a reminder that parameterized specs inflate the visible test count beyond a naive per-`it` estimate.
**Source:** 01-VALIDATION.md audit
