---
phase: 18-packaged-tarball-e2e-docs
plan: 03
subsystem: testing
tags: [integration-test, mdx, tsx, jsx, storybook, advisory-notice, not-type-checked]

# Dependency graph
requires:
  - phase: 18-packaged-tarball-e2e-docs
    provides: "18-01 D-01 engine: CoreResult.notTypeCheckedDeclaredFiles + detectUncheckedDeclaredFiles (.mdx via ts.parseJsonConfigFileContent extraFileExtensions; .tsx-without-jsx via rootNames filter)"
provides:
  - "T11 integration proof: a fixture declaring a .mdx and a JSX-free .tsx (jsx unset) yields notTypeCheckedDeclaredFiles non-empty (incl. the real .mdx enumeration) AND a clean verdict"
  - "fixtures/not-type-checked-mdx (green: solution walk shape, .storybook include declares .mdx + JSX-free .tsx + clean .ts) and fixtures/not-type-checked-clean (negative: only .ts)"
  - "fix: the .mdx enumeration now uses ScriptKind.Deferred (was Unknown, which silently enumerated zero .mdx)"
affects: [18-05 README CoreResult shape + Storybook .mdx/.tsx caveats, milestone SB-06 acceptance matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Green-verdict integration idiom (findWorkspaceRoot + fixtureTsConfig + cold runTypecheck + evaluateResult), mirroring layout-a.integration.spec.ts"
    - "JSX-free .tsx demonstrates the advisory-orthogonal-to-verdict case (Pitfall 3 / A1): jsx unset makes it uncheckable-and-advised, yet it compiles clean so the verdict stays green"
    - "extraFileExtensions scriptKind MUST be Deferred (not Unknown) for .mdx to surface in parseJsonConfigFileContent's wildcard file set"

key-files:
  created:
    - fixtures/not-type-checked-mdx/tsconfig.json
    - fixtures/not-type-checked-mdx/.storybook/tsconfig.json
    - fixtures/not-type-checked-mdx/src/clean.stories.ts
    - fixtures/not-type-checked-mdx/src/widget.tsx
    - fixtures/not-type-checked-mdx/src/intro.mdx
    - fixtures/not-type-checked-clean/tsconfig.json
    - fixtures/not-type-checked-clean/src/clean.stories.ts
    - packages/angular-typechecker/src/core/not-type-checked.integration.spec.ts
  modified:
    - packages/angular-typechecker/src/core/detect-unchecked-declared.ts

key-decisions:
  - "Green fixture is a solution walk shape (files:[], references:[./.storybook/tsconfig.json]) mirroring layout-a-storybook-clean, so the field is exercised on the WALK path; negative fixture is a direct leaf (include only .ts) exercising the DIRECT path -- both engine paths covered"
  - "The .storybook include is explicit globs (../src/**/*.ts, ../src/**/*.tsx, ../src/**/*.mdx) with compilerOptions.jsx UNSET, so the .tsx is a checkable-but-advised rootName and the .mdx surfaces only via the extraFileExtensions second parse"
  - "Rule 1 fix: detectUncheckedDeclaredFiles used ScriptKind.Unknown, which parseJsonConfigFileContent drops from its wildcard supported-extension set -> .mdx never enumerated. Changed to ScriptKind.Deferred (canonical plugin-handled-extension value)"

metrics:
  tasks_completed: 2
  files_created: 8
  files_modified: 1
  duration_minutes: 20
  completed_date: 2026-07-06
---

# Phase 18 Plan 03: T11 not-type-checked advisory integration proof Summary

Proved the D-01 `notTypeCheckedDeclaredFiles` field end-to-end (T11 / criterion 3): a committed fixture declaring a `.mdx` and a JSX-free `.tsx` (with `compilerOptions.jsx` unset) surfaces the advisory non-empty -- including the real `.mdx` enumerated by `ts.parseJsonConfigFileContent` `extraFileExtensions` -- while the verdict stays `clean`; a negative control declaring only `.ts` leaves the field empty. The integration proof caught and fixed a latent 18-01 bug where the `.mdx` half never enumerated.

## What Was Built

- **Green fixture `fixtures/not-type-checked-mdx/`** -- a solution walk shape (`files:[]`, references only `./.storybook/tsconfig.json`) mirroring `layout-a-storybook-clean`. The `.storybook/tsconfig.json` `include` globs `../src/**/*.ts`, `../src/**/*.tsx`, `../src/**/*.mdx` with `compilerOptions.jsx` UNSET, declaring: a clean `.ts` (`clean.stories.ts`, so `rootNamesCount > 0`), a JSX-FREE `.tsx` (`widget.tsx`, uncheckable-and-advised because `jsx` is unset, but JSX-free so it compiles clean), and a `.mdx` (`intro.mdx`, never type-checked).
- **Negative fixture `fixtures/not-type-checked-clean/`** -- a direct leaf (`include: ["src/**/*.ts"]`, no `references`) declaring only a clean `.ts`, so the field is empty/undefined.
- **`not-type-checked.integration.spec.ts`** -- green case: `notTypeCheckedDeclaredFiles` is defined + non-empty, contains the declared `.mdx` (`intro.mdx`) AND the JSX-free `.tsx` (`widget.tsx`), `rootNamesCount > 0`, and `evaluateResult(result)` is `{ success: true, outcome: 'clean' }`. Negative case: field empty/undefined with a clean verdict.

## How to Verify

```
npx nx test angular-typechecker
```

All 44 test files / 323 tests pass (including the 2 new not-type-checked integration cases). `npx nx lint angular-typechecker` and `prettier --check` on the touched source files are clean.

## Deviations from Plan

### [Rule 1 - Bug] `.mdx` enumeration used ScriptKind.Unknown, which never enumerated any `.mdx`

- **Found during:** Task 2 (the integration spec's `.mdx` assertion failed -- the field was non-empty with the `.tsx` but the `.mdx` was absent).
- **Issue:** 18-01's `detectUncheckedDeclaredFiles` passed `extraFileExtensions: [{ extension: 'mdx', isMixedContent: false, scriptKind: ts.ScriptKind.Unknown }]`. Verified against `typescript@6.0.3`: `parseJsonConfigFileContent` only adds a NON-`Unknown`, non-mixed-content extra extension to the supported-extension set its wildcard reader uses. With `Unknown`, `.mdx` was silently dropped from `fileNames` for both extensionless (`**/*`) and explicit (`**/*.mdx`) include globs, so `.mdx` never surfaced in `notTypeCheckedDeclaredFiles`. The 18-01 unit tier only exercised the `.tsx` half synthetically (18-01 explicitly deferred the `.mdx` exact-enumeration proof to this integration tier), so the bug was invisible until T11.
- **Fix:** changed `scriptKind` to `ts.ScriptKind.Deferred` (the canonical value for a plugin-handled extension, matching how tsserver registers `.vue` etc.). Empirically enumerates the `.mdx` for both glob shapes.
- **Files modified:** `packages/angular-typechecker/src/core/detect-unchecked-declared.ts`
- **Commit:** `cd6cc6a`
- **Scope note:** the detector is an 18-01 file, but proving its `.mdx` half end-to-end is precisely this plan's charter (criterion 3's integration proof). No `evaluate-result` / verdict wiring was touched -- the field stays advisory. The 18-01 `.tsx`-only unit spec is unaffected (not modified).

## Self-Check: PASSED

- All created files present on disk (fixtures + spec), verified.
- All task commits present in git history: `d9151f8`, `cd6cc6a`, `2e69dbf`.

## Task Commits

1. **Task 1: T11 fixtures (green .mdx/.tsx + negative control)** - `d9151f8`
2. **Task 2: detector `.mdx` fix + T11 integration spec** - `cd6cc6a` (fix, Rule 1) then `2e69dbf` (test)

## Notes for Downstream

- SB-06 is NOT marked milestone-complete here -- it is shared across 18-01/02/03/04 and closes at phase verification.
- 18-05 (README): the `.mdx`/`.tsx` caveats and the `CoreResult.notTypeCheckedDeclaredFiles` shape comment are now proven behavior -- the `.mdx` advisory genuinely fires (the fix landed here), so the README claim is safe to write against observed behavior rather than the pre-fix (broken) code.
- Both engine paths are now covered by fixtures: the WALK path (green fixture, solution + `.storybook` leaf) and the DIRECT path (negative fixture, flat leaf).

---
*Phase: 18-packaged-tarball-e2e-docs*
*Completed: 2026-07-06*
