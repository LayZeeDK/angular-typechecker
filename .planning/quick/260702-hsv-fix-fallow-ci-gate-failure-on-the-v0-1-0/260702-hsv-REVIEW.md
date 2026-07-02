---
phase: 260702-hsv-fix-fallow-ci-gate-failure-on-the-v0-1-0
reviewed: 2026-07-02T12:28:57Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - .fallowrc.jsonc
  - .github/workflows/ci.yml
  - e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts
  - packages/angular-typechecker/src/core/walk-references.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 260702-hsv: Code Review Report

**Reviewed:** 2026-07-02T12:28:57Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the CI-triage delta in `5e32512^..10c0a83` (fixing PR #15's fallow +
e2e CI gate failures) across four files. The delta is a focused, well-reasoned
set of CI/config fixes plus one comment-only source annotation. I verified every
load-bearing claim against the actual codebase and the installed toolchain
(fallow 2.103.0, Node execSync, the GUARD-01 spec, Prettier), not just the
narrative.

Key verifications (all PASS):

- **No over-broad glob leaks into shipped product code.** I traced every new/changed
  glob (`entry`, `health.ignore`, both `overrides`). None matches
  `packages/angular-typechecker/src/**/*.ts` (non-spec). `unused-files`, `health`
  (complexity), `code-duplication`, and `unlisted-dependencies` all stay gated for
  the published engine. The spec-only globs (`**/*.spec.ts`, `**/*.int.spec.ts`)
  and fixture/dev-lib globs (`fixtures/**`, `e2e/**/fixtures/**`, `libs/**`) do not
  reach non-spec product files.
- **All config keys and rule ids are valid in fallow 2.103.0.** Confirmed against
  the shipped `schema.json`: `ignoreDependencies`, `health` (`ignore` is a real
  `HealthConfig` field), `entry`, `overrides`, and the rule ids
  `unused-files`, `unrendered-components`, `unused-component-inputs`,
  `unused-enum-members`, `unlisted-dependencies` all exist. So none of the
  suppressions is a silent no-op that would leave the gate red.
- **The `code-duplication` directive is correctly spelled and placed.**
  `// fallow-ignore-next-line code-duplication` matches fallow's shipped docs
  (`skills/fallow/references/gotchas.md`) verbatim, sits immediately above the
  intended `ng.performCompilation` statement, and suppresses only that one line's
  clone finding.
- **GUARD-01 still passes.** `ci-e2e-coverage-guard.spec.ts` extracts the `-p`
  list with `/^\s*-p\s+\S/` and `.find()`; `--parallel=1` starts with `--` (not
  `-p`) and lives on a separate physical line, so it is never captured. The
  bidirectional set-equality assertion is unaffected.
- **The e2e diagnostic re-throw still fails loudly.** It re-throws on `pnpm add`
  failure, and I empirically confirmed `execSync` (encoding `utf8`, default stdio)
  populates `error.stdout`/`error.stderr` as strings, so pnpm's real stderr is
  surfaced. The install command, flags, env, and B-03 no-peer-override honesty are
  byte-identical. The `error as {...}` cast is TS-correct against `unknown`.
- **`walk-references.ts` is truly comment-only.** The diff adds only a rationale
  block + the ignore directive; no logic, type, or behavior change.

There are **no BLOCKERs and no security regressions**. The single WARNING is a
robustness gap (the load-bearing `--parallel=1` flag has no guard test, unlike the
sibling `-p` list). The Info items are documentation-accuracy nits and a
defense-in-depth suggestion. The delta is safe to ship.

## Warnings

### WR-01: The load-bearing `--parallel=1` e2e serialization flag is not guarded, unlike the `-p` list it sits next to

**File:** `.github/workflows/ci.yml:154-157`
**Issue:** The correctness of the entire `e2e` gate now depends on `--parallel=1`.
The three e2e projects share one mutable tarball path
(`dist/packages/angular-typechecker/angular-typechecker-<ver>.tgz`): each packs it
in `beforeAll` and `rmSync`s it in `afterAll`. `--parallel=1` is the only thing
preventing a sibling project's `afterAll rmSync` from deleting the tarball
mid-`pnpm add` (the ENOENT race this delta fixes). If a future maintainer drops
the flag to speed up CI, the nondeterministic race returns **silently** -- it will
pass locally and on most runs, then flake under load. This is exactly the "silent
CI drift" class that this repo already decided is unacceptable for the `-p` list:
`ci-e2e-coverage-guard.spec.ts` (GUARD-01) exists precisely to make `-p` drift a
loud, located test failure. The same protection is absent for `--parallel=1`. The
current state is correct and thoroughly documented inline; the gap is purely
future-drift robustness.
**Fix:** Prefer either of:
1. Eliminate the shared mutable resource (root cause): give each e2e project a
   unique tarball path (e.g. pack into a per-project temp dir, or include the
   project name in the filename), so cross-project parallelism is safe and
   `--parallel=1` is no longer load-bearing.
2. If serialization is kept, extend the GUARD-01 spec (or add a sibling assertion)
   to assert the `e2e` job's run line contains `--parallel=1`, mirroring the
   existing line-level `ci.yml` invariant test:
   ```ts
   it('serializes the e2e projects (shared-tarball race guard)', () => {
     const e2eBlock = ci.split('\n').slice(start, end).join('\n');
     expect(e2eBlock).toMatch(/--parallel=1\b/);
   });
   ```

## Info

### IN-01: `.fallowrc.jsonc` FAL-01 comment under-enumerates the `@angular/core` importers and covered libs

**File:** `.fallowrc.jsonc:27-38, 88-97`
**Issue:** The FAL-01 comment states `@angular/core` is imported "ONLY by test
fixtures + dev libs (fixtures/**, e2e/**/fixtures/**, libs/**)". A repo scan shows
it is also imported by `apps/ng-spike-app/src/app/**` (and `.planning/spikes/**`
fixtures). The "ONLY ... (list)" phrasing is factually incomplete. Separately, the
fixture-override comment names `libs/typecheck-consumer` and
`libs/typecheck-walk-consumer` but omits the third dev lib `libs/typecheck-consumer-dep`
(all three are covered by the `libs/**` glob). The load-bearing claim -- "no
shipped product code depends on `@angular/core`" -- is TRUE (I confirmed no
`packages/angular-typechecker/src/**` non-spec/non-drift file imports it), so this
is a doc-accuracy nit only. Given AGENTS.md's emphasis on comment accuracy, worth
tightening.
**Fix:** Reword to "imported by non-published projects only (apps, fixtures, e2e
fixtures, dev libs) -- never by the published `packages/angular-typechecker`", and
either drop the specific-lib enumeration or list all three libs.

### IN-02: `ignoreDependencies: ["@angular/core"]` is repo-global, broader than the fixture-scoped FAL-01 problem it solves

**File:** `.fallowrc.jsonc:38`
**Issue:** The FAL-01 false positive originates in fixture/dev-lib project
`package.json`s that do not list `@angular/core`. The fix uses a **top-level,
repo-global** `ignoreDependencies`, which also disables fallow's error-tier
`unlisted-dependencies` check for `@angular/core` in the **published** package. The
published package must never depend on `@angular/core` (peers are
`@angular/compiler-cli` + `typescript`). Today nothing is masked (no product import
exists) and `@nx/dependency-checks` (ESLint, error-tier, `maxWarnings:0`) is a live
backstop for the published `package.json`, so this is a documented defense-in-depth
reduction rather than a hole. Still, a scoped suppression would preserve fallow's
repo-wide protection.
**Fix:** If fallow's per-glob dependency scoping supports it, move the ignore into
an `overrides` entry keyed to `fixtures/**`, `e2e/**/fixtures/**`, `libs/**`,
`apps/**` (the actual `@angular/core` importers) rather than a global
`ignoreDependencies`, so an accidental `@angular/core` import in the published
package still trips fallow in addition to `@nx/dependency-checks`.

### IN-03: The e2e diagnostic re-throw surfaces stdout/stderr/message but drops the exit status/signal

**File:** `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts:201-218`
**Issue:** The re-thrown `Error` includes `stdout`, `stderr`, and `message`, but
not `error.status` / `error.signal`. `execSync`'s default `message` is
`"Command failed: <cmd>"` and does not carry the numeric exit code. For CI triage,
the exit code is a useful discriminator (e.g. pnpm ERESOLVE exits `1` vs a
provisioning crash / signal). I confirmed `error.status` is available (empirically
`3` in a repro) but unused. Minor -- the suite already fails loudly with the real
streams.
**Fix:** Add the status/signal to the diagnostic message:
```ts
const execError = error as { stdout?: string; stderr?: string; message?: string; status?: number; signal?: string };
// ...
'--- status ---',
String(execError.status ?? execError.signal ?? '(unknown)'),
```

---

## Narrative Findings (AI reviewer)

All findings above are narrative (direct adversarial code review). No
`<structural_findings>` block was provided to this review, so there is no fallow
structural substrate to reconcile against.

---

_Reviewed: 2026-07-02T12:28:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
