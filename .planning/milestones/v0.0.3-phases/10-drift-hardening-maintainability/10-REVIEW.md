---
phase: 10-drift-hardening-maintainability
reviewed: 2026-06-29T23:21:02Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - .github/workflows/ci.yml
  - packages/angular-typechecker/project.json
  - packages/angular-typechecker/src/core/compiler-cli-types.drift.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.ts
  - packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts
  - packages/angular-typechecker/tsconfig.drift.json
  - packages/angular-typechecker/tsconfig.lib.json
  - packages/angular-typechecker/tsconfig.spec.json
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-29T23:21:02Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 10 hardens the local `@angular/compiler-cli` type shim (`compiler-cli-types.ts`)
against silent drift with a two-pronged guard: a build-time type tripwire
(`compiler-cli-types.drift.ts` compiled under `tsconfig.drift.json` via the
`typecheck-drift` Nx target), a runtime getter-set + NG-encoding spec
(`compiler-cli-types.runtime.spec.ts`), and a TS-99 leak regression
(`ts99-leak.integration.spec.ts`), all wired into `.github/workflows/ci.yml`.

I verified the mechanism is **functionally correct** by empirical probing, not just
reading:

- The drift type assertions catch the three failure modes they claim: a return-type
  change fires `TS2344`, a removed getter fires `TS2339`, and an `EmitFlags` renumber
  or changed `UNKNOWN_ERROR_CODE` fires `TS2322` (confirmed with isolated `tsc 6.0.3`
  probes under classic `moduleResolution: node`).
- The drift check compiles cleanly today against the real `@angular/compiler-cli@22.0.4`
  (`tsc --noEmit -p tsconfig.drift.json` exits 0) and runs through Nx (`nx run
angular-typechecker:typecheck-drift` succeeds; bare `tsc` resolves via run-commands).
- The real `api.d.ts` matches every shim/drift claim verbatim (`EmitFlags DTS=1..All=31`,
  no `None`; `UNKNOWN_ERROR_CODE = 500`; the 6 diagnostic getters + `getTsProgram(): ts.Program`).
- The drift file is correctly EXCLUDED from `tsconfig.lib.json` and `tsconfig.spec.json`
  (both `exclude` `src/**/*.drift.ts`); I confirmed the `@angular/compiler-cli` import
  fails under `nodenext` (`TS2307`), justifying the exclusion, and confirmed the built
  `dist/` ships the shim but NOT the drift file.
- All three new specs pass (runtime drift 3/3, TS-99 leak 1/1); the TS-99 guard correctly
  routes through the real `cli.formatDiagnostics` rewrite path via the `renderReport` seam.
- The CI `test` job runs `npx nx run-many -t typecheck-drift test`, so a drift failure
  (non-zero `tsc`) fails the job and the `ci` aggregate's `contains(needs.*.result,
'failure')` gate catches it.

The structural pre-pass "unused" leads were all confirmed FALSE POSITIVES of the
intentional shim/tripwire pattern (see Info section). No Critical defects. The two
Warnings concern (1) a real Nx-cache invalidation gap in the `typecheck-drift` target's
`inputs` that can let the drift gate report a STALE pass after an `@angular/compiler-cli`
upgrade, and (2) a coverage completeness gap. The Info items are documentation-accuracy
and false-positive notes.

## Warnings

### WR-01: `typecheck-drift` cache `inputs` undercount the drift compilation's real dependency surface -- a compiler-cli upgrade can produce a STALE cached PASS

**File:** `packages/angular-typechecker/project.json:45-60`
**Issue:**
The `typecheck-drift` target declares `cache: true` and pins its `inputs` to two
hand-listed `@angular/compiler-cli` declaration files:

```
"{workspaceRoot}/node_modules/@angular/compiler-cli/index.d.ts",
"{workspaceRoot}/node_modules/@angular/compiler-cli/src/transformers/api.d.ts"
```

But the drift compilation actually reads **198** `@angular/compiler-cli` `.d.ts` files
transitively (verified with `tsc -p tsconfig.drift.json --listFiles`). The asserted
contract depends on more than those two files -- e.g. `RealProgram['getTsProgram']`
resolves through `src/transformers/program.d.ts` / `src/ngtsc/program.d.ts`, and the
`Program` re-export flows through `index.d.ts` which pulls in dozens of `ngtsc/*` files.
Crucially, the inputs also OMIT the canonical `externalDependencies` entry that the
sibling `angular-typecheck` target in `nx.json` already uses
(`{ "externalDependencies": ["typescript", "@angular/compiler-cli"] }`).

Consequence: an `@angular/compiler-cli` upgrade that changes a diagnostic getter's
signature in a transitively-read file while leaving `index.d.ts` and
`src/transformers/api.d.ts` byte-identical would NOT invalidate the Nx cache. In any
environment with a warm cache (local dev, Nx Cloud, or a CI cache restore), `nx
run-many -t typecheck-drift` would replay the prior cached PASS and the drift would ship
undetected -- defeating the entire HARD-01 tripwire. CI here is currently cold per job
(no Nx Cloud token configured, fresh checkout), so CI is not exposed today, but the
target is explicitly marked cacheable and the local/cloud-cache hazard is real and
silent. It also breaks if a TypeScript patch changes `ts.Program` (the inputs list no
`typescript` external dependency, yet the assertion compares against `ts.Program`).

**Fix:** Mirror the proven pattern already used by the `angular-typecheck` default in
`nx.json` -- replace the two hand-listed deep `.d.ts` paths with an
`externalDependencies` input so a version bump of either peer invalidates the cache:

```jsonc
"typecheck-drift": {
  "executor": "nx:run-commands",
  "cache": true,
  "inputs": [
    "{projectRoot}/src/core/compiler-cli-types.drift.ts",
    "{projectRoot}/src/core/compiler-cli-types.ts",
    "{projectRoot}/tsconfig.drift.json",
    "{workspaceRoot}/tsconfig.base.json",
    { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
  ],
  "options": { "command": "tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json", "cwd": "." }
}
```

`externalDependencies` keys the cache off the installed package versions (resolved from
the lockfile), which is exactly the invalidation signal the drift gate needs and is
immune to which internal `.d.ts` file changed.

### WR-02: Two getter call-surface members consumed by the gatherer are not covered by EITHER drift prong (`getSourceFiles` / `SourceFile.isDeclarationFile`)

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts:108-134` and `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts:50-58`
**Issue:**
`gather-diagnostics.ts:80` calls `program.getTsProgram().getSourceFiles()` and then reads
`sourceFile.isDeclarationFile` / `sourceFile.fileName` (`:81-85`). Neither the drift
file's call-site probes (`_a`..\_h`) nor the runtime spec's `GATHERED_GETTERS`set covers
this call surface. The drift file's`\_callSiteProbes`probes`getTsProgram()
.getGlobalDiagnostics()` (`\_h`) but not `.getSourceFiles()`; the runtime spec asserts the
6 diagnostic getters + `getTsProgram`+`getGlobalDiagnostics`, but not `getSourceFiles`.

This is a narrower exposure than WR-01 because `getSourceFiles` / `isDeclarationFile`
live on the public `ts.Program` / `ts.SourceFile` types (not the Angular shim), so they
are validated by ordinary `tsc` compilation of `gather-diagnostics.ts` in the lib build
and only move with a TypeScript major. But the drift file's stated SCOPE (lines 51-56,
"the 6 DIAGNOSTIC getters the gatherer calls" plus the COR-02 reach-through) is meant to
mirror the gatherer's full Program call surface, and the runtime spec comment explicitly
says to "Mirror this EXACTLY -- a divergence from `gather-diagnostics.ts` is itself a
drift to catch." The `getSourceFiles()` reach-through is part of that surface and is
omitted from the frozen set.

**Fix:** Add a `getSourceFiles` reach-through probe to keep the asserted surface complete
and self-documenting. In the drift call-site probes:

```ts
const _i: readonly ts.SourceFile[] = real.getTsProgram().getSourceFiles();
void _i;
```

And, optionally, assert its presence in the runtime spec alongside the existing
`getGlobalDiagnostics` reach-through:

```ts
expect(typeof program.getTsProgram().getSourceFiles).toBe('function');
```

Alternatively, if the intent is to scope the drift guard to ONLY the Angular-shim
surface (excluding stable `ts.Program` members), tighten the drift file's SCOPE comment
to say so explicitly so the omission is documented rather than implicit.

## Info

### IN-01: Stale line reference in the runtime spec -- `getGlobalDiagnostics` is at `gather-diagnostics.ts:88`, not `:80`

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts:46-47,108`
**Issue:** The spec comments cite the COR-02 reach-through (`getTsProgram()
.getGlobalDiagnostics()`) as living at `gather-diagnostics.ts:80` (lines 47 and 108).
The actual `getGlobalDiagnostics()` call is at line **88**; line 80 is the
`getSourceFiles()` loop header. The `:62-77` range for the 6 diagnostic getters is
accurate. Because this spec's own discipline is "Mirror this EXACTLY -- a divergence from
`gather-diagnostics.ts` is itself a drift to catch," an inaccurate self-reference
undercuts the file's stated contract.
**Fix:** Update `:80` to `:88` in both comment sites (lines 47 and 108). The drift file's
own references (`gather-diagnostics.ts:77`, `:85`, `:88`) are correct and can serve as
the canonical line map.

### IN-02: Structural lead "unused_file compiler-cli-types.drift.ts" -- CONFIRMED FALSE POSITIVE

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts`
**Issue:** The fallow pre-pass flagged the drift file as unused. Confirmed false positive:
it is referenced by `tsconfig.drift.json` `"files": ["src/core/compiler-cli-types.drift.ts"]`,
compiled by the `typecheck-drift` Nx target (`project.json:57`), and that target runs in
CI (`ci.yml:114`, the `npx nx run-many -t typecheck-drift test` step). Fallow's import-graph
reachability cannot see tsconfig-`files`-only references. It is intentionally NOT
`index`-reachable and NOT in the `files` tarball whitelist -- by design (it must never ship).
**Fix:** None. Exclude this path from the structural analyzer's reachability scope, or
annotate it as a tsconfig-referenced tripwire.

### IN-03: Structural lead "unused_enum_members EmitFlags 110-116" -- CONFIRMED FALSE POSITIVE (intentional mirror shim)

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.ts:109-117`
**Issue:** The 7 `EmitFlags` members are an intentional verbatim mirror of the real
`@angular/compiler-cli@22.0.4` enum (`api.d.ts:74-82`). Their value is that each member is
individually value-pinned by the drift file (`compiler-cli-types.drift.ts:148-154`), so a
renumber fires `TS2322`. The enum as a whole is consumed as a type (`emitFlags?: EmitFlags`,
`:162`) and as a value-namespace (`readonly EmitFlags: typeof EmitFlags`, `:204`). "Unused
members" is the expected shape of a contract-mirroring shim.
**Fix:** None. Treat as Info / exclude from dead-code reporting.

### IN-04: Structural lead "unused_types compiler-cli-types.ts:130" -- CONFIRMED FALSE POSITIVE

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.ts:130`
**Issue:** `export declare const UNKNOWN_ERROR_CODE = 500` is referenced at `:209`
(`readonly UNKNOWN_ERROR_CODE: typeof UNKNOWN_ERROR_CODE` on `CompilerCli`) and is
value-pinned by the drift file (`compiler-cli-types.drift.ts:143`, `const _unknown: 500 =
RealUnknown`). The runtime path reads `ng.UNKNOWN_ERROR_CODE` (the real value) in
`run-typecheck.ts:161,238`. The `typeof` reference is invisible to the analyzer.
**Fix:** None.

### IN-05: Structural lead "unused_dependencies package.json:52" -- FALSE POSITIVE (mislabeled `publishConfig` key)

**File:** `packages/angular-typechecker/package.json:51-54`
**Issue:** Line 52 is `"provenance": true` inside `publishConfig`, not a dependency.
The analyzer mislabeled a publish-config key as an unused dependency. The real
`dependencies` (`@nx/devkit`, `tslib`) and `peerDependencies` are correct and policed by
`@nx/dependency-checks`. Out of phase-10 scope.
**Fix:** None.

---

_Reviewed: 2026-06-29T23:21:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
