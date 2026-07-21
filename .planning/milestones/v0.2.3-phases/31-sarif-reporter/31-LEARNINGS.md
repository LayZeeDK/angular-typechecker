---
phase: 31
phase_name: "SARIF reporter"
project: "angular-typechecker"
generated: "2026-07-18"
counts:
  decisions: 6
  lessons: 4
  patterns: 5
  surprises: 4
missing_artifacts:
  - "31-UAT.md"
---

# Phase 31 Learnings: SARIF reporter

## Decisions

### partialFingerprints must include the 1-based start column, not just the line
The `atcFingerprint/v1` sha256 tuple was refined from `(ruleId + URI + message + startLine)` to
also include `startColumn`. Two distinct diagnostics on the SAME line that share a rule + an
unparameterized fixed-string message (e.g. NG8102) would otherwise collide to one fingerprint,
conflating two GitHub Code Scanning alerts.

**Rationale:** Fingerprint uniqueness is a correctness invariant for a "never hide a real signal"
tool. Column is the only remaining discriminator for same-line/same-rule/same-message pairs.
**Source:** 31-REVIEW.md (MJ-01), 31-01-SUMMARY.md, 31-CONTEXT.md (D-02 corrected)

### Correct the versioned fingerprint key in place while unreleased (no v2 bump)
The `atcFingerprint/v1` property key was kept when the column fix landed rather than bumping to
`/v2`.

**Rationale:** The recipe had never shipped (patch 0.2.2 -> 0.2.3 not cut), so there is no installed
alert base to churn. Versioning exists so the recipe can evolve non-breakingly later; correcting v1
before first release keeps it right from the start.
**Source:** 31-CONTEXT.md (D-02), fix commit d3e1cd3

### Declare node-sarif-builder as a direct dependency; NO ignoredDependencies entry
`node-sarif-builder@^4.1.0` is a plain `dependency` in both the root and the publish manifest;
`@nx/dependency-checks` (`nx lint`) passes green with no `ignoredDependencies` addition and
`eslint.config.mjs` byte-unchanged.

**Rationale:** Nx's project graph statically scans `sarif-report.ts` in place, so it sees the
lazy `await import('node-sarif-builder')` as a real use. The pre-execution A1 hedge (add to
ignoredDependencies) proved unnecessary, confirmed against the real lint run.
**Source:** 31-01-SUMMARY.md, 31-02-SUMMARY.md (A1 resolved)

### Type the CJS dependency via `import type * as`, never `@types/sarif`
The builder API is typed with `import type * as NodeSarifBuilder from 'node-sarif-builder'`
(erased at compile). No `@types/sarif` devDependency and no `import ... from 'sarif'`.

**Rationale:** Keeps the transitive `@types/sarif` + `fs-extra` out of declared deps; the interop
cast also had to mirror this exact shape to type-check (see Lessons).
**Source:** 31-CONTEXT.md (D-04), 31-02-SUMMARY.md

### File-less diagnostics become no-`locations`-key SARIF results
Synthesized 90001/90002 and global TS diagnostics are emitted as results with no `locations`
key (never dropped); the verdict/exit code, not the SARIF, is their authoritative fail signal.

**Rationale:** SARIF 2.1.0 permits locationless results (GitHub GH1001); anchoring a synthetic
1:1:1:1 region on the tsconfig would surface a misleading alert on the config file.
**Source:** 31-CONTEXT.md (D-01), 31-01-SUMMARY.md

### Promote the 18-member -> NG-code map to a production module; the spec imports it
The NG8xxx member->code mapping was promoted from `extended-catalog.integration.spec.ts` into a
new production `core/extended-catalog.ts` (enum-keyed off `EXTENDED_DIAGNOSTIC_MEMBERS`), and the
integration spec now imports that single source.

**Rationale:** The SARIF `rules[]` catalog `id` must be the humanized `NG8xxx`, so the mapping had
to be production code, not test-only. DRY + a drift tripwire + a pairwise-distinctness guard keep
it honest.
**Source:** 31-01-SUMMARY.md, 31-RESEARCH.md

---

## Lessons

### A relative dynamic import needs an explicit `.js` extension under `module: nodenext`
`await import('./sarif-report')` fails TS2835; it must be `await import('./sarif-report.js')`. The
plan and RESEARCH prose omitted the extension. Downstream guards that assert on the compiled output
must match the ACTUAL emitted substring `import('./sarif-report.js')`.

**Context:** `@nx/js:tsc` downlevels the async body to a tslib `__awaiter`/`yield import(...)` but
preserves the source's single quotes and the `.js` extension. The require-graph guard's positive
control was written against the real built `dist/.../render-report.js`, not the sketch.
**Source:** 31-01-SUMMARY.md, 31-02-SUMMARY.md

### `nx test` does not type-check specs — a spec-only type error green-masks under it
Both waves hit spec type errors that Vitest/esbuild (`nx test`) ran past but `nx typecheck`
(`tsc --noEmit -p tsconfig.spec.json`) caught: the `describe.each` `$ngCode` shape (31-01) and the
node-sarif-builder interop cast TS2352 (31-02). The interop cast had to mirror the shipped
`sarif-report.ts` pattern (`import type * as NodeSarifBuilder ... (mod as ... & { default? }).default ?? mod`)
rather than the RESEARCH-sketch cast.

**Context:** The authoritative gate set for this repo is `nx test` + `nx typecheck` + `nx lint`
(maxWarnings:0) + `nx format:check` — not `nx test` alone. This recurs across phases.
**Source:** 31-02-SUMMARY.md, 31-01-SUMMARY.md

### A behavior-changing code-review fix needs its own regression test
The MJ-01 column fix shipped with only fingerprint-shape assertions, not a same-line-distinctness
regression test. The Nyquist validation gate (run after code review) caught the missing test and
added it, proving it load-bearing (pre-fix tuple collides, post-fix does not).

**Context:** Running validate-phase AFTER secure/verify/code-review is precisely what surfaces gaps
introduced by late fixes. The fix and its regression test should land together.
**Source:** 31-VALIDATION.md, 31-REVIEW.md

### This is a flat Nx monorepo with NO npm workspaces
`npm install <pkg> --save --workspace=packages/angular-typechecker` errors `No workspaces found`.
The correct mechanism is `npm install <pkg> --save` from the repo ROOT (updates root
package.json + lock) THEN manually mirror the entry into `packages/angular-typechecker/package.json`
(the publish manifest `@nx/dependency-checks` audits).

**Context:** The plan-checker caught this pre-execution via a live `--dry-run` against the repo;
deps are manually mirrored (root + publish manifest), not workspace-linked.
**Source:** 31-01-PLAN.md (revised), plan-checker verification

---

## Patterns

### Share one normalized-record projection across every machine reporter (anti-drift)
`core/sarif-report.ts` reuses `core/diagnostic-record.ts` (`toDiagnosticRecord`/`relativizePath`)
and never re-derives positions/codes/paths. This makes a second machine format near-mechanical and
guarantees JSON and SARIF cannot drift on those axes.

**When to use:** Any time a second output format projects the same underlying records — build ONE
projection helper and forbid the reporters from re-implementing `path.relative`/code-humanization/
`getLineAndCharacterOfPosition`.
**Source:** 31-CONTEXT.md (D-13), 31-01-SUMMARY.md

### Lazy-import firewall proven by a static require-graph guard + positive control
An optional/heavy dependency is reached only via `await import()`; a test-tier spec walks the built
require graph from the common entry points and asserts the dep is never reached, PLUS a positive
control asserting the lazy `import(...)` boundary is present (laziness proven present, not merely
absent).

**When to use:** Whenever a dependency must stay off the common/boot code paths — clone the walk
from `cli/bin-static.spec.ts` and read the compiled `dist` (`dependsOn: build`).
**Source:** 31-02-SUMMARY.md

### Real-import (not mocked) interop spec for a CJS-under-`await import()` dependency
A spec performs the genuine `await import('<cjs-pkg>')` and resolves the API via
`(mod.default ?? mod)`, proving the interop shape rather than mocking it.

**When to use:** For any CJS dependency reached through `await import()` under `module: nodenext` +
`type: commonjs` — clone the shape from `core/compiler-loader.spec.ts`.
**Source:** 31-02-SUMMARY.md

### Enum-driven catalog module + drift tripwire + pairwise-distinctness guard
Catalog data (the 18 NG8xxx rules) lives in one production module keyed off the enum, guarded by a
drift tripwire (completeness/order) AND a uniqueness assertion (`new Set(codes).size === length`).

**When to use:** Any fixed catalog that other code keys on by id — one production source, imported by
the spec, with both a completeness and a uniqueness guard.
**Source:** 31-01-SUMMARY.md, 31-REVIEW.md (MN-01)

### Versioned fingerprint/hash key so the recipe can evolve non-breakingly
Store self-computed fingerprints under a versioned property key (`atcFingerprint/v1`) with an
OS/Node-invariant input tuple (no absolute path, no cwd, no volatile field).

**When to use:** Any self-computed stable identifier consumed by an external system that matches on
"any known version" — bump the version to evolve; correct in place while still unreleased.
**Source:** 31-CONTEXT.md (D-02)

---

## Surprises

### The NG-code mapping lived ONLY in a test file, not production
The authoritative 18-member -> NG-code table existed only in
`extended-catalog.integration.spec.ts`; the production `extended-catalog.members.ts` was name-only.

**Impact:** Required promoting the mapping to a production module before the SARIF `rules[]` catalog
`id`s could reference the humanized codes — a small but load-bearing extra task in 31-01.
**Source:** 31-RESEARCH.md, 31-01-SUMMARY.md

### `describe.each` templating breaks silently if you strip a table field
Deleting `ngCode` from the row objects handed to `describe.each('... NG$ngCode ...')` renders
`NGundefined` and makes `NG(row.ngCode)` evaluate to `NaN`, breaking all 18 assertions. The array
must be ENRICHED (`{ ...baseRow, ngCode: map.get(baseRow.member)! }`), not stripped.

**Impact:** The plan-checker flagged the wording tension pre-execution; the fix enriches. A naive
"remove the field, resolve via map" reading would have sent execution down a broken path.
**Source:** 31-REVIEW.md / plan-checker, 31-01-SUMMARY.md

### `@nx/dependency-checks` sees a lazy-only `await import()` as a real use
Contrary to the pre-execution A1 hedge, the rule statically detected the lazy dynamic import, so no
`ignoredDependencies` entry was needed.

**Impact:** `eslint.config.mjs` stayed byte-unchanged; one anticipated config edit was avoided.
Confirmed against the real `nx lint`, not inferred.
**Source:** 31-01-SUMMARY.md, 31-02-SUMMARY.md

### The compiled dynamic import preserved single quotes and gained a `.js` extension
`@nx/js:tsc` emitted `import('./sarif-report.js')` (single-quoted, `.js`-suffixed, inside a tslib
`__awaiter` generator), not the double-quoted extensionless form the plan/RESEARCH/31-01 sketches
assumed.

**Impact:** The require-graph guard's positive-control substring had to be corrected to the actual
emitted bytes, verified by reading the built `dist` before writing the assertion.
**Source:** 31-02-SUMMARY.md

---

*Extracted from 31-01/31-02 PLAN + SUMMARY, 31-VERIFICATION, 31-REVIEW, 31-SECURITY, 31-VALIDATION, 31-CONTEXT, 31-RESEARCH.*
