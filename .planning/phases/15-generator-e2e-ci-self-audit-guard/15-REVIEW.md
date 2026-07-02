---
phase: 15-generator-e2e-ci-self-audit-guard
reviewed: 2026-07-02T08:06:30Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
  - e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/package.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/nx.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/project.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/tsconfig.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/tsconfig.lib.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/tsconfig.spec.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/src/consumer-generator.component.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/src/consumer-generator.component.spec.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-07-02T08:06:30Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 15 is a testing + CI-guard phase (no production source changed). The three
new/modified specs and the seven-file `consumer-generator` fixture were reviewed
adversarially, with cross-file tracing against the CI workflow (`.github/workflows/ci.yml`),
the shipped generators (`configuration`/`init`), the plugin `package.json` + `project.json`
build assets, and the serialized e2e `vitest.config.mts`.

The phase is well constructed. The most important test-correctness properties hold:

- **GUARD-01 cannot silently false-PASS.** Job-scoping to `e2e:` (the `/^  [a-z0-9-]+:\s*$/`
  boundary regex admits the digit in `e2e:`), the line-start `-p` match (which never selects
  the `test` job's mid-line `-p angular-typechecker`), enumeration by each `e2e/*/project.json`
  `.name` (not the over-counting `scope:fixture` tag -- verified 3 dirs -> 3 names), and the
  bidirectional `toEqual` are all correct. The empty-both false-PASS is unreachable: the `-p`
  regex requires a non-whitespace token so `pList` is never `[]`, and a missing `e2e:` job or
  `-p` line throws loudly at collection time. CRLF is absorbed by `.trim()` before `split`.
- **nx-add-e2e (GE2E-03) is non-vacuous.** It asserts the `angular-typechecker:typecheck` key
  is `undefined` BEFORE install/init and defined after -- the Pitfall-5 "seeded from absent"
  guard is present, and the fixture provably omits the key (D-02 confirmed in `nx.json`).
- **The two injected codes are asserted as full tokens** (`TS2322`/`TS2345`, not bare 4-digit
  substrings), each injection is guarded non-vacuous (`.not.toBe(original)`), and the negative
  guards (`no ERR_REQUIRE_ESM`, `no 'infrastructure error'`) are present so the injected-run
  non-zero exit cannot come from an unrelated crash. `--skip-nx-cache` is on every `nx run`
  and `--skipFormat` on every `nx g`.
- **The fixture is clean-by-construction:** solution `tsconfig.json` has a non-empty
  `references[]` -> lib + spec; both source leaves type-check clean; NO lockfile and NO
  `.npmrc` are committed (only the 8 intended files are git-tracked).
- **Teardown cannot mask a failed assertion.** Assertions run in `try`, `removeTmpWorkspace`
  runs in `finally` and its empty `catch` swallows only its own `rmSync` EPERM -- the original
  assertion error re-propagates.
- **PKG-02 (D-13):** the 5 added generator paths are correct package-relative paths that match
  `generators.json` factory paths, the `project.json` build assets (`generators.json` glob +
  `**/!(*.ts)` src glob), and the `package.json` `files` allowlist. The `.spec.`/`tsconfig.spec`/
  `(libs|fixtures|e2e)/` leak guards do not false-positive on the new paths (plugin
  `tsconfig.lib.json` excludes `src/**/*.spec.ts`, so no generator spec compiles into the
  tarball). ASCII-only and project TS style verified (no non-ASCII, no debug artifacts).

Two robustness/test-correctness gaps remain (below), plus one informational brittleness note.
No BLOCKER-class defect: no guard can pass while a real diagnostic is lost, and no security
surface exists (fixed target ids + flags, tarball path quoted via `JSON.stringify`, cwd passed
as an option rather than interpolated).

## Warnings

### WR-01: GE2E-02's two-leaf proof does not isolate the LIB reference (TS2322 leaks across the spec leaf)

**File:** `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts:283-318`
**Issue:** The spec claims the two injected codes prove "the solution tsconfig's lib AND spec
references were walked (GE2E-02)". The `TS2345` half is robust -- that code originates only in
`consumer-generator.component.spec.ts`, which only `tsconfig.spec.json` includes, so its
presence genuinely proves the spec reference was walked. The `TS2322` half is NOT
reference-isolating: the broken field is injected into `consumer-generator.component.ts`, and
the spec file imports that component
(`import { ConsumerGeneratorComponent } from './consumer-generator.component';` -- confirmed).
So the spec leaf's program transitively compiles the component and would emit `TS2322` even if
the executor walked ONLY the spec reference and skipped the standalone lib reference. Concretely,
the "spec walked, lib NOT walked" case still yields BOTH codes and the test passes -- so the
assertion does not actually establish that the lib reference was independently walked. (Practical
impact is bounded: in that skipped-lib case the component is still type-checked via the spec's
import graph, so no real diagnostic is lost -- which is why this is a WARNING, not a BLOCKER --
but the test's stated guarantee is stronger than the evidence, and the distinct-codes rationale
in the comment only half-holds.)
**Fix:** Make the lib-leaf error originate in a lib-only file that no spec imports, so `TS2322`
can appear only if the lib reference is independently walked. For example add a second lib-only
source (not imported by the spec) and inject the `number = "str"` field there:
```ts
// fixtures/consumer-generator/src/lib-only.ts  (referenced by tsconfig.lib.json's src/**/*.ts,
// NOT imported by any *.spec.ts)
export const libOnly = 1;
// inject in the tmp copy:  export const broken: number = "str";  -> TS2322 provably lib-only
```
Alternatively, weaken the comment to claim only what `TS2345` proves (spec reference walked) plus
"the component is type-checked", and drop the "lib reference walked" claim.

### WR-02: generator-e2e's "seeded from ABSENT" claim (GE2E-01b) lacks its own before-absent baseline guard

**File:** `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts:260-276`
**Issue:** The GE2E-01(b) block asserts the post-generation shape
(`seeded.cache === true`, `seeded.outputs == []`, `seeded.inputs[0] === 'default'`) and its
comment states `init` "SEEDED the nx.json targetDefaults from ABSENT". But unlike its sibling
`nx-add-e2e.int.spec.ts` (which explicitly asserts
`before.targetDefaults?.['angular-typechecker:typecheck']` is `undefined` before running init --
the Pitfall-5 guard), this spec never asserts the pre-condition. Today it is correct because the
shared fixture provably omits the key, but the "from ABSENT" claim is unverified here: if the
fixture ever gains a targetDefaults entry (or generator-e2e is later pointed at its own fixture),
`init`'s whole-entry `??=` would skip seeding and this assertion would pass for the wrong reason
(vacuous). The suite-wide risk is partly compensated because nx-add-e2e guards the same shared
fixture, but this spec's independent claim should not depend on a sibling spec.
**Fix:** Mirror the nx-add-e2e baseline before the `nx g configuration` call:
```ts
const before = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8')) as {
  targetDefaults?: Record<string, unknown>;
};
expect(before.targetDefaults?.['angular-typechecker:typecheck']).toBeUndefined();
```

## Info

### IN-01: GUARD-01's `-p` extraction is coupled to the folded-scalar multi-line form of the e2e run step

**File:** `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts:77-89`
**Issue:** `extractE2ePList` finds the first line in the `e2e:` block matching `/^\s*-p\s+\S/`
and splits only THAT line. This is correct for the current `ci.yml` (a `>` folded scalar with the
whole `-p` list on one continuation line), but it is brittle against two benign refactors: (1)
collapsing the run to a single line (`- run: npx nx run-many -t test -p a b c`) makes no line
start with `-p`, so the guard throws "no `-p` project list found" even though CI is correct; and
(2) wrapping the `-p` list across two continuation lines silently drops the projects on the
second line from `pList`, producing a false-RED. Both fail in the SAFE direction (loud error or
false-RED, never a false-PASS that hides a real coverage gap), so this is informational, but a
maintainer collapsing the YAML for readability would hit a confusing failure. Consider tolerating
both forms (scan all lines in the job block for project-name tokens after `run-many`, or match the
folded continuation more explicitly) or add a code comment on `ci.yml`'s e2e run step warning that
its shape is asserted by this guard.

---

_Reviewed: 2026-07-02T08:06:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
