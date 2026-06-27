# Angular Diagnostic Catalog (for TEST-02)

The set of TypeScript + Angular compiler diagnostics the integration tests assert by EXACT code/count. Organized by the Angular major that INTRODUCED each check (a coverage taxonomy, not a multi-version test matrix) -- all are exercised on **Angular 22**. Derived from the sandbox `ANGULAR-COMPILER-ERRORS.md` + Angular docs (v17-21) + `extended_template_diagnostic_name.ts` (v13-16).

> VERIFY ON IMPLEMENTATION: confirm exact codes/names against Angular 22's `packages/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.ts` and the Angular 22 extended-diagnostics docs (local clone `D:/projects/github/angular/angular`). Add any v22-introduced diagnostics. Some codes have aliases (shown as `A (B)`).

**Scope boundary:** Angular **runtime** errors (NG0xxx, listed at https://angular.dev/errors) are OUT of scope -- a static no-emit type-check cannot detect them. The relevant **compile-time** compiler errors are the baseline NG codes below (a subset of angular.dev/errors); we capture them via the compiler's emitted diagnostics on fixtures, not by enumerating the errors reference.

## Baseline diagnostics (no `extendedDiagnostics` needed; present since v13 unless noted)

| Code | Introduced | Scenario / trigger |
|------|-----------|--------------------|
| TS2322 | TypeScript | Plain type-assignment error in a component class |
| TS2339 | TypeScript | Template references a missing member (template type-check) |
| NG2003 | v13 | Missing injection token (primitive constructor param) |
| NG2007 | v13 | Undecorated base class uses Angular features |
| NG8001 | v13 | Unknown component/element |
| NG8004 (NG1019) | v13 | Missing pipe declaration |
| NG2005 (NG1005) | v13 | Illegal constructor decorator usage |
| NG3003 (NG8003) | v13 | Directive lacks `exportAs` but template references it |
| NG1001 | v13 | Component metadata argument not a literal |
| NG2009 | v13 | Invalid Shadow DOM selector (ViewEncapsulation.ShadowDom, selector missing hyphen) |
| NG8002 | v13 | Invalid attribute/directive usage (e.g. `[(ngModel)]` without importing the directive) |
| NG6100 | v14 | `@NgModule({ id: module.id })` anti-pattern |

## Extended template diagnostics (require `strictTemplates`; default category = warning)

To make these FAIL, promote via `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"` (or per-check). Listed by introduction version (cumulative):

| Code | Name | Introduced |
|------|------|-----------|
| NG8101 | invalidBananaInBox (Invalid Banana-in-Box) | v13 |
| NG8102 | nullishCoalescingNotNullable | v13 |
| NG8103 | missingControlFlowDirective | v14 |
| NG8104 | textAttributeNotBinding | v14 |
| NG8105 | missingNgForOfLet (missing `let` in `*ngFor`) | v14 |
| NG8106 | suffixNotSupported | v14 |
| NG8107 | optionalChainNotNullable | v14 |
| NG8108 | skipHydrationNotStatic (`ngSkipHydration` must be a static attribute) | v16 |
| NG8109 | interpolatedSignalNotInvoked (signals must be invoked in interpolations) | v17 |
| NG8111 | uninvokedFunctionInEventBinding (functions must be invoked in event bindings) | v18 |
| NG8113 | unusedStandaloneImports | v19 |
| NG8114 | unparenthesizedNullishCoalescing | v20 |
| NG8115 | uninvokedTrackFunction | v20 |
| NG8116 | missingStructuralDirective | v20 |
| NG8117 | uninvokedFunctionInTextInterpolation (functions must be invoked in text interpolation) | v20 |
| NG8021 | deferTriggerMisconfiguration | v21 |

Authoritative Angular 22 set, verified against https://angular.dev/extended-diagnostics (2026-06-27). Gaps: **NG8110 and NG8112 are unassigned**; v15 added none; there are **no extra v22-only extended diagnostics** beyond NG8021. Each diagnostic has a page at `/extended-diagnostics/<code>`.

**Introduction-version provenance + method:** the "Introduced" column is derived by diffing the **versioned** extended-diagnostics docs across majors -- `https://v<NN>.angular.dev/extended-diagnostics` for NN = 13..21 (URL format differs on older majors; the unversioned `angular.dev/extended-diagnostics` is the current = v22 set). A code's introduction major is the first versioned page it appears on. **URL domains differ by era:** older majors are on `angular.io` (e.g. v13 = `https://v13.angular.io/extended-diagnostics`), newer majors on `angular.dev` (the docs domain moved around v17/v18: `https://v<NN>.angular.dev/extended-diagnostics`); the unversioned `https://angular.dev/extended-diagnostics` = current (v22). Current values come from a v13->v21 sweep (the sandbox `ANGULAR-COMPILER-ERRORS.md`) cross-checked against the v22 list above; to extend for a future major, diff its versioned page against the prior. (Being independently re-verified against the versioned pages.)

## Special test cases (behavior, not a single code)

- **Dependency filtering**: `main-lib` (clean) depends on `dependency-lib` (has a type error). Default (`excludeLibsFromTypeCheck`/no `includeDeps`): `main-lib` PASSES (dependency error filtered). With `includeDeps: true`: `main-lib` FAILS. (EXE-04.)
- **Complete gather (no short-circuit)**: a component with BOTH a plain TS error AND a template/extended error -> the executor reports BOTH in one run (proves the unconditional gatherer; `ngc --noEmit` would report only the TS error). (ENG-02.)
- **Dependency-error-busts-cache**: changing a dependency's source type must invalidate the consumer's cached typecheck result. (TEST-04 / EXE-06.)
- **Clean project**: no diagnostics -> success, exit 0.

## Test organization

Mirror the sandbox's per-introduction-version split (`executor.angularNN.integration.spec.ts`) so adding a future Angular major's diagnostics is a drop-in file. Inject errors programmatically (jscodeshift-style edits) on generated/committed fixtures; assert exact codes + counts, not just pass/fail.
