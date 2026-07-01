---
phase: 10-drift-hardening-maintainability
fixed_at: 2026-06-30T01:47:00Z
review_path: .planning/phases/10-drift-hardening-maintainability/10-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 3
skipped: 4
status: partial
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-06-30T01:47:00Z
**Source review:** .planning/phases/10-drift-hardening-maintainability/10-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (2 Warning, 5 Info; fix_scope = all)
- Fixed: 3 (WR-01, WR-02, IN-01)
- Skipped: 4 (IN-02, IN-03, IN-04, IN-05 -- all CONFIRMED FALSE POSITIVES with "Fix: None")

All three actionable findings were fixed and individually verified with the
relevant compile/test command BEFORE commit. The four skipped Info findings are
deliberate false positives of the intentional drift-shim / build-time-tripwire
pattern; resolving them is a structural-analyzer configuration concern (Phase 11
fallow gate), not a code edit. No source code referenced by those four was
touched.

## Fixed Issues

### WR-01: `typecheck-drift` cache `inputs` undercount the drift compilation's dependency surface

**Files modified:** `packages/angular-typechecker/project.json`
**Commit:** 53e72db
**Applied fix:** Replaced the two hand-listed deep `@angular/compiler-cli` `.d.ts`
inputs (`index.d.ts`, `src/transformers/api.d.ts`) on the `typecheck-drift` target
with the canonical `{ "externalDependencies": ["typescript", "@angular/compiler-cli"] }`
input, keeping the existing project source/tsconfig/base inputs. This mirrors the
sibling `angular-typecheck` target's pattern in `nx.json` and keys the Nx cache off
the installed peer versions (resolved from the lockfile), so a compiler-cli or
TypeScript upgrade invalidates the cache instead of replaying a stale cached PASS.
**Verification:** `node -e JSON.parse(...)` confirmed valid JSON; then
`npx nx run angular-typechecker:typecheck-drift --skip-nx-cache` (with
`NX_DAEMON=false`) exited 0 -- the target still runs and the drift compile is clean.

### WR-02: `getSourceFiles` / `SourceFile.isDeclarationFile` call-surface not covered by either drift prong

**Files modified:** `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts`, `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts`
**Commit:** 3da72fb
**Applied fix:** Added the `getSourceFiles` reach-through probe to the drift file's
call-site probes (`const _i: readonly ts.SourceFile[] = real.getTsProgram().getSourceFiles(); void _i;`)
so the asserted Program call-surface mirrors the gatherer's full surface
(`gather-diagnostics.ts:80`). Also added the optional matching runtime-spec
assertion (`expect(typeof program.getTsProgram().getSourceFiles).toBe('function')`)
alongside the existing `getGlobalDiagnostics` reach-through assertion.
**Verification:** `npx tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json`
exited 0 -- the drift file still compiles CLEAN against the real
`@angular/compiler-cli@22.0.4` (no spurious drift failure introduced). The targeted
`vitest run` of `compiler-cli-types.runtime.spec.ts` passed 3/3, and the full
`nx test angular-typechecker --skip-nx-cache` passed 147/147.

### IN-01: Stale line reference in the runtime spec (`gather-diagnostics.ts:80` should be `:88`)

**Files modified:** `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts`
**Commit:** e4087b1
**Applied fix:** Corrected the COR-02 `getGlobalDiagnostics` reach-through citation
from `gather-diagnostics.ts:80` to `:88` at both comment sites (the `GATHERED_GETTERS`
header comment near line 47 and the inline assertion comment near line 108). Verified
against `gather-diagnostics.ts`: line 80 is the `getSourceFiles()` loop header and
line 88 is the `getGlobalDiagnostics()` call. Comment-only change.
**Verification:** Targeted `vitest run` of `compiler-cli-types.runtime.spec.ts`
passed 3/3.

## Skipped Issues

### IN-02: "unused_file compiler-cli-types.drift.ts" -- CONFIRMED FALSE POSITIVE

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts`
**Reason:** False positive, no code change (REVIEW "Fix: None"). The drift file is a
build-time tripwire referenced via `tsconfig.drift.json` `files` and the
`typecheck-drift` Nx target (run in CI); it is intentionally NOT import-reachable and
NOT in the tarball `files` whitelist. Deleting or "cleaning up" this file would destroy
the drift mechanism. (The WR-02 fix ADDED a probe to it -- it remains load-bearing.)
Resolving the analyzer reachability gap is Phase 11's job (fallow config), not a code
edit here.
**Original issue:** Structural pre-pass flagged the drift file as unused; reachability
cannot see tsconfig-`files`-only references.

### IN-03: "unused_enum_members EmitFlags 110-116" -- CONFIRMED FALSE POSITIVE

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.ts:109-117`
**Reason:** False positive, no code change (REVIEW "Fix: None"). The 7 `EmitFlags`
members are an intentional verbatim mirror of the real compiler-cli enum; each member
is individually value-pinned by the drift file so a renumber fires `TS2322`. "Unused
members" is the expected shape of a contract-mirroring shim. Not touched.
**Original issue:** Structural pre-pass flagged the `EmitFlags` members as unused.

### IN-04: "unused_types compiler-cli-types.ts:130" -- CONFIRMED FALSE POSITIVE

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.ts:130`
**Reason:** False positive, no code change (REVIEW "Fix: None"). `UNKNOWN_ERROR_CODE = 500`
is referenced via a `typeof` on `CompilerCli` (`:209`), value-pinned by the drift file
(`:143`), and read at runtime in `run-typecheck.ts`. The `typeof` reference is invisible
to the analyzer. Not touched.
**Original issue:** Structural pre-pass flagged the const as an unused type.

### IN-05: "unused_dependencies package.json:52" -- FALSE POSITIVE (mislabeled `publishConfig` key)

**File:** `packages/angular-typechecker/package.json:51-54`
**Reason:** False positive, no code change (REVIEW "Fix: None"). Line 52 is
`"provenance": true` inside `publishConfig`, not a dependency; the analyzer mislabeled a
publish-config key as an unused dependency. Out of phase-10 scope. Not touched.
**Original issue:** Structural pre-pass flagged a `publishConfig` key as an unused dependency.

---

_Fixed: 2026-06-30T01:47:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
