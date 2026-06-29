---
phase: 04-nx-executor-adapter-cacheable-target
fixed_at: 2026-06-28T12:26:59Z
review_path: .planning/phases/04-nx-executor-adapter-cacheable-target/04-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 4
skipped: 6
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-06-28T12:26:59Z
**Source review:** .planning/phases/04-nx-executor-adapter-cacheable-target/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (fix_scope=all): 10 (0 Critical, 4 Warning, 6 Info)
- Fixed: 4 (WR-01, WR-02, WR-03, IN-02)
- Skipped: 6 (WR-04 + IN-01, IN-03, IN-04, IN-05, IN-06 -- all reviewer-marked advisory / acceptable-as-is / skip-by-design)

Note on commit grouping: findings that interleave within a single spec file were
committed together as one coherent, atomic, self-contained commit (the reviewer
explicitly coordinated WR-01 + IN-02). Two commits total, each scoped to one file.

## Fixed Issues

### WR-01: Cache-MISS assertion can false-PASS on a non-cache failure

**Files modified:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts`
**Commit:** bd94f40 -- `fix(04): harden cache-MISS assertion + clean up temp cache dir (WR-01, WR-02, IN-02)`
**Applied fix:** Replaced the weak `expect(third.stdout).toMatch(/TS2322|2322/)` in the
cache-MISS case with `expect(third.stdout).toContain(INJECTED_TS_CODE)` (the full
`TS2322` token, not a bare 4-digit substring), and added two negative guards so an
unrelated infrastructure failure cannot masquerade as a genuine cache bust:
`expect(third.stdout).not.toMatch(/ERR_REQUIRE_ESM/)` and
`expect(third.stdout).not.toContain('infrastructure error')`. This is an assertion
(logic) change to test behavior -- see "Requires human verification" note below.

### WR-02: Per-run isolated NX_CACHE_DIRECTORY created but never cleaned up

**Files modified:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts`
**Commit:** bd94f40 -- `fix(04): harden cache-MISS assertion + clean up temp cache dir (WR-01, WR-02, IN-02)`
**Applied fix:** Imported `rmSync` from `node:fs`, imported `afterAll` from `vitest`,
and added `afterAll(() => { rmSync(cacheDir, { recursive: true, force: true }); })`
so the temp `atc-cache-*` dir created at module load is removed after the suite,
stopping the unbounded disk leak. `force: true` keeps teardown non-fatal.

### WR-03: workspaceRoot.split('\\').join('/') fragile path normalization

**Files modified:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts`
**Commit:** a54176e -- `fix(04): use joinPathFragments for tsconfig path + reuse TS-code constant (WR-03, IN-02)`
**Applied fix:** Added `joinPathFragments` to the `@nx/devkit` import and replaced
the hand-rolled `${workspaceRoot.split('\\').join('/')}/libs/.../tsconfig.lib.json`
string surgery with `joinPathFragments(workspaceRoot, 'libs/typecheck-consumer/tsconfig.lib.json')`
-- the same POSIX-separator-stable path primitive the production code uses (D-03),
removing the UNC-path and double-normalization fragility.

### IN-02: Loose `/TS2322|2322/` regex duplicated in three places

**Files modified:**
`e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts`,
`e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts`
**Commits:** bd94f40 (cache-busts, two sites) and a54176e (parity, one site)
**Applied fix:** Hoisted `const INJECTED_TS_CODE = 'TS2322';` once per spec module
(the two are separate ES modules, so each needs its own module-local constant) and
replaced all three `expect(...).toMatch(/TS2322|2322/)` assertions with
`expect(...).toContain(INJECTED_TS_CODE)`. Coordinated with WR-01 so they do not
conflict (the MISS-case site uses the same constant as the tightened assertion).

## Skipped Issues

### WR-04: Dual-key cacheable targetDefaults duplicates the input recipe

**File:** `nx.json:41-72`
**Reason:** skipped-by-design (advisory-only per reviewer; both candidate fixes carry
unacceptable risk in Phase 4).
**Original issue:** The two `targetDefaults` keys
(`angular-typechecker:angular-typecheck` and the dev-scoped
`@angular-typechecker/angular-typechecker:angular-typecheck`) hold a byte-identical
7-line input recipe (verified byte-identical: `JSON.stringify(a) === JSON.stringify(b)`),
creating drift risk and a Phase-5 leak hazard.
**Rationale for skip:**
1. The reviewer explicitly marked WR-04 "advisory-only ... no code change is strictly
   required in Phase 4."
2. The suggested JSON comment is UNSAFE: `executor-parity.int.spec.ts:111` reads nx.json
   via `JSON.parse(readFileSync('nx.json'))`, and strict `JSON.parse` rejects `//`
   comments -- adding one would break that test. A `"//"` documentation key is also
   invalid here because the `targetDefaults` map keys are validated as target ids whose
   values must be `targetDefaultsConfig` objects (a string value fails Nx's schema).
3. The optional `namedInputs` refactor risks ALTERING cache behavior: the shared recipe
   contains both `^default` (a dependency-traversal named-input reference) and a
   `transitive: true` `dependentTasksOutputFiles` object. When wrapped in a `namedInputs`
   entry and referenced as a plain named input, Nx's recursive expansion of nested
   `^`-prefixed references and transitive output-file collection is subtle and
   version-sensitive; it cannot be guaranteed to resolve to the byte-identical input set
   the inline arrays currently produce. The cache-correctness gate (TEST-04) is the
   centerpiece of this phase, so the reviewer's instruction "If a namedInputs refactor
   risks altering cache behavior, SKIP it" applies directly.
The Phase-5 checklist assertion (published README recipe keyed ONLY by
`angular-typechecker:angular-typecheck`) is a Phase-5 hand-off concern, not a Phase-4
code change, and is already documented in 04-03-SUMMARY deviation #1.

### IN-01: loadTypescript duplicated across run-typecheck.ts and render-report.ts

**File:** `packages/angular-typechecker/src/core/render-report.ts:29-40`
**Reason:** skipped-by-design (reviewer: "Acceptable to leave as-is given the explicit
design rationale"). Orchestrator instruction: do NOT do the shared-module extraction --
it touches the anti-leak barrel invariant (renderReport must not re-export
loadTypescript) and is not worth the risk for a near-free duplicate `import('typescript')`.
**Original issue:** `cachedTypescript` memo + `loadTypescript()` is duplicated verbatim
between the two core modules as deliberate anti-leak duplication.

### IN-03: sortedCodes line exceeds readable width / chains on one line

**File:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts:147-149`
**Reason:** skipped (reviewer: "Cosmetic only; let Prettier format"). This is Prettier's
job, not a manual edit. I did not run a Prettier pass: the line was committed as-is via
the project's existing formatting, and a standalone format pass on a single line risks
introducing an unrelated reformatting diff. Left for the normal lint/format pipeline.
**Original issue:** A dense single-line `.map().sort()` chain (correct, just dense).

### IN-04: buildContext() casts through `unknown as ExecutorContext`

**File:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts:107-125`
**Reason:** skipped (reviewer: "Acceptable for a test harness"). Standard test practice;
the double-cast is intentional and the optional `Partial<ExecutorContext>` narrowing is
non-essential.
**Original issue:** Partial `ExecutorContext` literal force-cast; nx.json parsed as `any`.

### IN-05: fixture libs carry no tsconfig.spec.json

**File:** `libs/typecheck-consumer/tsconfig.lib.json:15`,
`libs/typecheck-consumer-dep/tsconfig.lib.json:15`
**Reason:** skipped (reviewer: "None required"). The optional documentation comment is
cosmetic and not load-bearing.
**Original issue:** Fixtures are deliberately spec-free; the production input's spec
excludes are no-ops here but under-documented.

### IN-06: time-of-mutation window on dep.component.ts

**File:** `libs/typecheck-consumer-dep/src/lib/dep.component.ts:1-21`
**Reason:** skipped (reviewer: "None required given the serialization guarantees").
Documented as a known, accepted property; the D-14 serialization (singleFork,
fileParallelism:false, NX_DAEMON=false) + main-tree run (D-17) close it in practice.
**Original issue:** During the write-injected -> finally-restore window the on-disk file
is genuinely broken; a parallel scanner would observe the injected error.

## Requires Human Verification

WR-01 changes test ASSERTION logic (semantic, not just syntax). Tier 1 (re-read) and
Tier 2 (tsc + eslint) confirm the file compiles and lints cleanly, but cannot confirm
the tightened assertion still PASSES against a real run. The cache-e2e suite does REAL
`performCompilation` and mutates fixtures under a serialized config; per orchestrator
guidance the heavy `npx nx test angular-typechecker-cache-e2e` run is DEFERRED TO CI.
The change is conservative: the prior `/TS2322|2322/` already matched, `TS2322` is a
strict subset of that match that the executor codeframe renders, and the new negative
guards only fail if the run failed for an infrastructure reason (which would be a
genuine regression worth surfacing). A maintainer should confirm the e2e suite still
passes in CI before the phase advances.

## Verification Performed

- Tier 1 (always): both edited files re-read in full; fixes present, surrounding code
  intact, no corruption.
- Tier 2 (tsc): `tsc --noEmit -p e2e/angular-typechecker-cache-e2e/tsconfig.spec.json`
  reports ZERO errors in the two edited spec files. The only tsc errors
  (`run-typecheck.ts(199,201)`) are pre-existing in an UNTOUCHED core source file pulled
  in via the path alias -- ignored per the verification strategy (errors in files not
  edited by this run). Confirmed only the two spec files are modified (`git diff --stat`).
- Tier 2 (eslint): both files pass `eslint` clean (exit 0). The only output is a benign
  "No cached ProjectGraph available -- rule skipped" environmental warning for
  `@nx/enforce-module-boundaries` (worktree has no graph cache), not a violation.
- Heavy e2e run (`npx nx test angular-typechecker-cache-e2e`) intentionally NOT run here
  (slow, mutates fixtures, must be serialized) -- deferred to CI per orchestrator guidance.

---

_Fixed: 2026-06-28T12:26:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
