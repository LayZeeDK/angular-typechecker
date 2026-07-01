# Vendored compiler-cli Type Surface & Filter -- Hardening Findings

Research date: 2026-06-29. Subject: improving the maintainability/robustness of the
hand-maintained `@angular/compiler-cli` type shim and the project-boundary diagnostic
filter against Angular version drift. Deferred FEATURES are out of scope.

All "real type" claims below were verified against the INSTALLED stable
`@angular/compiler-cli@22.0.4` typings under TypeScript `6.0.3`, and the
nodenext-resolvability claims were verified EMPIRICALLY with throwaway probe files run
through `tsc --noEmit` (probes removed after running; see "Build-time drift detection").

Sources:

- `node_modules/@angular/compiler-cli/index.d.ts` (the barrel), `src/transformers/api.d.ts`
  (the real `api.Program` + `EmitFlags`), `src/perform_compile.d.ts`
  (`ParsedConfiguration`, `performCompilation`, `readConfiguration`, `formatDiagnostics`,
  `defaultGatherDiagnostics`, `UNKNOWN_ERROR_CODE`).
- `angular/angular-cli` at tag `v22.0.4`: `packages/angular/build/src/tools/angular/...`
  - root `tsconfig.json` (how Angular's OWN build consumes these types).
- `.planning/research/prior-art/PRETTIER-PARSERS.md` (prior pass; reused, not re-researched).

---

## What our shim re-declares & its drift risk

The shim is `packages/angular-typechecker/src/core/compiler-cli-types.ts`. It structurally
re-declares the compiler-cli surface over the `typescript` substrate (a real,
nodenext-resolvable dependency). Re-declared members, and the verified drift delta vs
the real `22.0.4` typings:

| Shim member (file:line)                                                           | Real source                                                                                                                                                         | Drift risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interface Program` (`compiler-cli-types.ts:57-80`) -- 6 getters + `getTsProgram` | `src/transformers/api.d.ts:122` `interface Program`                                                                                                                 | **PRIMARY DRIFT POINT.** Our shim declares 7 of the real interface's 9 members. We deliberately OMIT `loadNgStructureAsync(): Promise<void>` and the obsolete `listLazyRoutes()`, and `emit<CbEmitRes>()`. Because we declare a SUBSET, a NEW getter added upstream would NOT break our build (we just would not gather it -> the silent "under-gathering" hazard the prompt names). A RENAMED/REMOVED getter we DO declare would break only at the `gather-diagnostics.ts` call site IF the runtime object stops having it (a runtime `undefined is not a function`, not a build error) -- the shim is structural over `import()`-loaded `any`, so today nothing forces our 6-getter list to match Angular's real getter set at build time. |
| `getNgSemanticDiagnostics(fileName?: string, ...)` (`:76`)                        | api.d.ts:167 -- identical                                                                                                                                           | Low. Note the `fileName` (not `sourceFile`) asymmetry vs the other getters is REAL (matches upstream).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TsProgram = ts.Program & { useCaseSensitiveFileNames(): boolean }` (`:45-47`)    | Real `getTsProgram(): ts.Program` -- the `useCaseSensitiveFileNames()` member is on the host, not the public `ts.Program` interface, but IS on the runtime instance | Low-medium. We intersect a member the public `ts.Program` interface does not surface. If TS ever adds it to `ts.Program`, the intersection becomes redundant (harmless). If the runtime stops exposing it, `run-typecheck.ts:201` breaks at runtime, not build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `enum EmitFlags { None = 0 }` (`:89-91`)                                          | api.d.ts:74 `enum EmitFlags { DTS=1, JS=2, Metadata=4, Codegen=16, Default=19, All=31 }`                                                                            | **CONFIRMED DRIFT (cosmetic today).** The real enum has **NO `None` member**. Our `None = 0` is a FABRICATED name. The engine only ever passes `0 as EmitFlags` (`run-typecheck.ts:163`), and `0` is a valid no-flags bitmask regardless, so this works -- but the `None` name is a fiction that would mislead a future maintainer and does not track the real enum.                                                                                                                                                                                                                                                                                                                                                                         |
| `const UNKNOWN_ERROR_CODE = 500` (`:100`)                                         | `src/perform_compile.d.ts` exports it; documented value `500`                                                                                                       | Low. The literal `500` is hardcoded in two places (here + the JSDoc). If Angular ever changed it, our re-throw detection (`run-typecheck.ts:172`) would silently stop catching infra failures and count them as type errors. It has been `500` for years, so risk is low but the value is duplicated, not imported.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `interface ParsedConfiguration` (`:109-116`)                                      | `src/perform_compile.d.ts:14`                                                                                                                                       | Medium. Real shape: `options: api.CompilerOptions` (NOT `ts.CompilerOptions & { basePath? }`), `rootNames: string[]` and `errors: ts.Diagnostic[]` (MUTABLE; ours are `readonly`). Our `options: ts.CompilerOptions & { basePath?: string }` is a deliberate narrowing -- `api.CompilerOptions` extends `ts.CompilerOptions` and DOES carry `basePath?: string` (verified api.d.ts:16). So our hand-modeled `basePath?` matches reality. Drift risk: if Angular moves `basePath` or adds a required field, our narrowing diverges silently.                                                                                                                                                                                                  |
| `interface PerformCompilationOptions` (`:125-130`)                                | The inline params object of `performCompilation` (perform_compile.d.ts:33)                                                                                          | Medium. The real signature has MANY more optional params (`host`, `oldProgram`, `emitCallback`, `mergeEmitResultsCallback`, `customTransformers`, `forceEmit`, `modifiedResourceFiles`). We declare only the 4 we pass. Since they are all optional upstream, omitting them is safe; risk is only if one we DO pass changes shape. `gatherDiagnostics?: (program: Program) => readonly ts.Diagnostic[]` matches.                                                                                                                                                                                                                                                                                                                             |
| `interface PerformCompilationResult` (`:143-146`)                                 | perform_compile.d.ts:27                                                                                                                                             | Medium. We declare `program: Program` NON-optional; upstream types it OPTIONAL (`program?`). This is a deliberate narrowing justified by the engine's guarded usage (it re-throws on infra failure before touching `result.program`). Safe under the engine's non-strict-null options, but it is a place where our type is STRICTER than reality.                                                                                                                                                                                                                                                                                                                                                                                            |
| `interface CompilerCli` (`:154-178`) -- the loaded-namespace shape                | The barrel `index.d.ts` (not directly typeable -- see below)                                                                                                        | This is the aggregate the loader casts to. `readConfiguration`, `performCompilation`, `defaultGatherDiagnostics`, `EmitFlags`, `UNKNOWN_ERROR_CODE`, `formatDiagnostics` all verified present with matching signatures. `formatDiagnostics(diags, host?)` matches perform_compile.d.ts:11 exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Where drift is most likely / most damaging, ranked:**

1. **The `Program` getter set under-gathering** (silent: build stays green, but a new Angular
   diagnostic phase would not be gathered). This is the highest-leverage hardening target.
2. **`EmitFlags` fabricated `None`** (misleading; should be a clearly-marked divergence).
3. **`UNKNOWN_ERROR_CODE` value duplication** (silent re-throw failure if it ever changes).
4. **`ParsedConfiguration` / `PerformCompilationResult` narrowings** (deliberate, but undocumented as such relative to the real optionality).

---

## Build-time drift detection

### The hard constraint (verified empirically)

Under the plugin's shipping config (`module: nodenext` / `moduleResolution: nodenext`,
from `packages/angular-typechecker/tsconfig.json`), the REAL `api.Program` type is
**unreachable by ANY import form.** Probe results (TS 6.0.3, nodenext):

- `import type * as ng from '@angular/compiler-cli'; type P = ng.Program;`
  -> **TS2694: Namespace ... has no exported member 'Program'.** The barrel's
  extensionless `export * from './src/transformers/api'` re-exports do not resolve under
  strict ESM nodenext, so the namespace is EMPTY. (This is exactly why the shim exists.)
- `import type { Program } from '@angular/compiler-cli/src/transformers/api';`
  -> **TS2307: Cannot find module.** The package `exports` map exposes ONLY
  `['.', './package.json', './linker', './linker/babel', './private/*']` -- deep `src/...`
  paths are NOT exported subpaths, so nodenext refuses them.
- Deep RELATIVE path into `node_modules/.../api.d.ts` (the OLD pre-D-10 approach)
  -> **TS2307**, because `api.d.ts`'s OWN internal extensionless re-exports break under
  nodenext too. Adding an explicit `.js` extension also fails (no `api.js` sibling there).

**Decisive enabling fact:** the SAME barrel import resolves CLEANLY under classic
`moduleResolution: node` (`module: commonjs`, `ignoreDeprecations: "6.0"`) -- verified: no
TS2694, no errors. This is exactly how Angular's own `@angular/build` consumes it
(`import type * as ng from '@angular/compiler-cli'` under root `tsconfig.json`
`"module": "commonjs"`, `"moduleResolution": "node"` at `v22.0.4`). **The barrel is simply
not nodenext-tested upstream** -- confirmed.

### Consequence for the idiom

A `satisfies api.Program` / mutual-assignability assertion against the REAL type CANNOT
live in the LIB build (`tsconfig.lib.json`, nodenext) -- the real type is unreachable
there. It MUST live in a compilation unit that uses classic `node` resolution. Two viable
homes, both of which already type-check on every `nx test` / `nx build`:

**Option 1 (recommended): a drift-assertion SPEC file** compiled by `tsconfig.spec.json`.
The spec tsconfig currently inherits `module/moduleResolution: nodenext` from
`tsconfig.json`, so it would need a per-file or per-tsconfig override to `node`/`bundler`.
The cleanest is a dedicated `compiler-cli-types.drift.spec.ts` plus a tiny
`tsconfig.drift.json` (extends base, sets `moduleResolution: node`, `ignoreDeprecations:
"6.0"`, includes only that one file) wired into the test/lint target. Vitest transpiles
per-file and does not type-check, so to make the assertion BREAK the build it must be
type-checked -- run it through `tsc --noEmit -p tsconfig.drift.json` as a build/lint step
(Nx target), NOT rely on Vitest.

**Option 2: keep it type-only and isolate resolution at the file boundary.** TS has no
per-file `moduleResolution`, so Option 1's dedicated tsconfig is the mechanism. Do NOT try
to sneak the real import into a nodenext unit -- the probes prove it cannot resolve.

### The concrete idiom (code sketch)

In the drift-check unit (compiled under `moduleResolution: node`):

```ts
// compiler-cli-types.drift.spec.ts  --  type-checked under tsconfig.drift.json
// (moduleResolution: node, ignoreDeprecations: "6.0"). This file's ONLY job is to
// FAIL `tsc` when our shim drifts from the real @angular/compiler-cli surface.
import type * as ng from '@angular/compiler-cli'; // resolves under classic `node`
import type { Program as ShimProgram, ParsedConfiguration as ShimParsedConfiguration, PerformCompilationResult as ShimResult } from './compiler-cli-types';

// Compile-time assertion helper: `Assignable<A, B>` is `true` only if A extends B.
type Assignable<A, B> = A extends B ? true : false;

// (1) Our shim Program must remain a STRUCTURAL SUBSET of the real api.Program:
//     every getter we declare must still exist with a compatible signature.
//     If Angular renames/removes a getter we rely on, this line fails to compile.
const _shimIsSubsetOfReal: Assignable<ng.Program, ShimProgram> = true;
//    ^ real Program must be assignable TO our (narrower) shim => our 6 getters
//      are all still present on the real type with compatible signatures.

// (2) DRIFT TRIPWIRE for the getter SET (the under-gathering hazard).
//     `Required<Omit<ng.Program, 'getTsProgram' | 'emit' | 'loadNgStructureAsync'
//      | 'listLazyRoutes'>>` is the set of diagnostic getters we intend to gather.
//     Compare its KEYS to a literal tuple of the 6 we DO gather; a newly-added
//     upstream getter (not in our omit-list) makes the key sets differ and breaks
//     the build, forcing a maintainer decision (gather it, or add it to the
//     explicit ignore-list with a reason). This is the prettier
//     `Required<Omit<AstVisitor,'visit'>>` idiom applied to the getter set.
type GatheredGetters = keyof Omit<ng.Program, 'getTsProgram' | 'emit' | 'loadNgStructureAsync' | 'listLazyRoutes'>;
type KnownGetters = 'getTsOptionDiagnostics' | 'getNgOptionDiagnostics' | 'getTsSyntacticDiagnostics' | 'getTsSemanticDiagnostics' | 'getNgStructuralDiagnostics' | 'getNgSemanticDiagnostics';
// Exact-match both directions: any NEW upstream getter -> `Exclude` is non-never
// -> assignment to `never` fails to compile.
const _noNewGetters: Exclude<GatheredGetters, KnownGetters> extends never ? true : false = true;
const _noStaleGetters: Exclude<KnownGetters, GatheredGetters> extends never ? true : false = true;

// (3) ParsedConfiguration / result narrowings stay assignable.
const _parsedOk: Assignable<ng.ParsedConfiguration, ShimParsedConfiguration> = true;
const _resultOk: Assignable<ng.PerformCompilationResult, ShimResult> = true;

// (4) EmitFlags + UNKNOWN_ERROR_CODE value pins (catches an enum/value change).
const _emitZeroIsValid: ng.EmitFlags = 0 as ng.EmitFlags; // 0 must remain assignable
// const _unknownCode: 500 = ng.UNKNOWN_ERROR_CODE; // if it is typed as a literal
```

Notes anchoring this to what is importable:

- The import `import type * as ng from '@angular/compiler-cli'` is **only** valid because
  this unit compiles under `moduleResolution: node` -- the same mode Angular's build uses.
  Verified to resolve `ng.Program`, `ng.ParsedConfiguration`, `ng.PerformCompilationResult`,
  `ng.EmitFlags`, `ng.UNKNOWN_ERROR_CODE` non-empty.
- It is `import type` -> erased at emit -> zero runtime effect, and it lives in a NON-shipped
  unit (spec/drift tsconfig excluded from `tsconfig.lib.json`), so the published `.d.ts`
  surface and the nodenext lib build are untouched.
- Assertion (2) is the one that closes the SILENT under-gathering gap: it converts "Angular
  added a 7th diagnostic getter" from an invisible runtime gap into a red `tsc`/CI failure.

**Effort/placement caveat:** the assertion must be TYPE-CHECKED to bite. Vitest alone will
not catch it (it transpiles, does not type-check). Wire `tsc --noEmit -p
tsconfig.drift.json` (or fold the file into an existing type-checked target whose
moduleResolution is `node`) into the Nx `lint`/`build`/`test` pipeline so it runs in CI.

---

## Prettier estree-parser idioms we should adopt

From `angular-estree-parser` (peer-dep + type-as-drift-detector model, which is the model
this project already follows -- see PRETTIER-PARSERS.md), the directly applicable idioms:

1. **`Required<Omit<X, 'excluded'>>` as a drift tripwire.** estree-parser uses
   `type TransformVisitors = Required<Omit<AstVisitor, 'visit'>>` so a new Angular AST node
   becomes a compile error. We adopt the SAME shape for the `api.Program` getter set
   (assertion (2) above). This is the single highest-value idiom for us.

2. **`// @ts-expect-error -- <reason>` to fence any private/deep access.** estree-parser
   does `// @ts-expect-error -- need to call private _commentStart` for
   `Parser.prototype._commentStart`. We currently have NO deep/private import (the shim is
   self-contained over `typescript`, and the loader casts via `as unknown as CompilerCli`).
   That `as unknown as` cast (`compiler-loader.ts:17`) is the moral equivalent of the
   private-access fence and should carry a marker comment (it already has a JSDoc block;
   add the greppable marker). If we ever DO reach a deep compiler-cli path (e.g. in the
   drift-check unit), fence it with `@ts-expect-error -- <reason>` only if it errors; the
   barrel-under-node import above does NOT error, so it needs no fence.

3. **Greppable namespaced divergence markers** (from `angular-html-parser`'s
   `// angular-html-parser:` convention). Adopt `// angular-typechecker: vendored -- <reason>`
   on EVERY re-declared member and every deliberate divergence (the `EmitFlags.None`
   fabrication, the `program` non-optional narrowing, the `TsProgram` intersection, the
   `UNKNOWN_ERROR_CODE = 500` value pin). Then `git grep "angular-typechecker: vendored"`
   enumerates the entire vendored surface in one command at every Angular bump.

4. **Peer-dep + per-version support entries.** Already done (`@angular/compiler-cli:
^22.0.0` peer). When widening to Angular 23+, record it as a feature and re-run the
   drift-check unit against the new typings -- the assertion is the regression net (the
   estree-parser "support angular NN" pattern).

5. **NOT applicable: deep monorepo fork (Model A).** Re-confirmed: a type-checker loads the
   consumer's real compiler-cli anyway, so inlining buys nothing. Keep Model B.

**On the "nx-internal `FsTree` quarantine":** there is NO `FsTree` or any nx-internal
quarantine file in the current codebase (verified: `git grep -i "FsTree|nx-internal|
quarantine"` returns nothing in `packages/angular-typechecker/`). The only nx-internal
surface consumed is `@nx/devkit` (a pinned `dependency` with its own published, resolvable
typings) in the executor layer (not in `src/core/`). So idiom (2)/(3) apply to the
compiler-cli shim and the loader cast; there is currently no nx-internal type to quarantine.
If an executor ever reaches an unpublished `@nx/devkit` internal, the SAME marker +
`@ts-expect-error` discipline applies.

---

## filter-diagnostics robustness notes

`filter-diagnostics.ts` is already notably hardened (realpath-first, case-fold gated on the
live host flag, segment-bounded `node_modules` test, segment-bounded containment, file-less
diagnostics always kept, per-path memoization). Existing spec coverage is strong
(`filter-diagnostics.spec.ts`: pnpm/.bun/plain store realpaths, `node_modules-tools`
non-match, mixed-case fold both directions, `.ngtypecheck.ts` shadow kept, includeDeps
fold-back). Remaining edges worth hardening:

1. **`options.realpath` is called with NO try/catch (`filter-diagnostics.ts:119`).**
   Verified: `ts.sys.realpath` returns the INPUT unchanged for a missing path (does not
   throw), and `run-typecheck.ts:202` already guards the call as
   `ts.sys.realpath?.(filePath) ?? filePath`. BUT the filter module itself calls
   `options.realpath(filePath)` directly. A realpath that THROWS (EACCES on a restricted
   symlink target; a permission-denied junction on Windows; a future `ts.sys` that throws
   on a broken symlink) would crash the entire filter pass -> the whole type-check run
   aborts with an opaque error instead of degrading gracefully. **Hardening:** wrap the
   realpath call in a try/catch that falls back to the un-resolved (but still
   `\\`->`/` normalized + case-folded) path on throw. Correctness trade-off: a symlinked
   in-project file whose realpath throws would be classified on its symlink path, which is
   acceptable (it is still under basePath in the common case) and strictly better than
   crashing. Tag `robustness`.

2. **`diagnostic.file` present but `file.fileName` empty/`''`.** The filter checks
   `diagnostic.file === undefined` (D-03) but a diagnostic with a defined `file` whose
   `fileName` is `''` would canonicalize to `''`, then `isUnderDir('', base)` is false and
   `isNodeModulesPath('')` is false -> SUPPRESSED. An empty fileName is unusual but not
   impossible for synthesized diagnostics. Decide explicitly: treat empty `fileName` like a
   file-less diagnostic (keep it) rather than silently suppress. Tag `correctness`, low
   likelihood.

3. **Windows drive-letter case under case-insensitive fold.** Paths like `C:/ws/proj` vs
   `c:/ws/proj`: the `useCaseSensitiveFileNames: false` branch lower-cases the WHOLE path
   including the drive letter, so the fold is consistent on both base and file. This is
   correct AS LONG AS both basePath and fileName flow through the same canonicalizer (they
   do). No change needed, but worth an explicit spec asserting a `C:`-vs-`c:` in-project
   match on the case-insensitive branch, since the dev/CI matrix includes Windows. Tag
   `correctness` (test-only).

4. **UNC / extended-length Windows paths (`\\?\C:\...`, `\\server\share\...`).** After
   `\\`->`/` normalization these become `//?/c:/...` and `//server/share/...`. The
   segment-split `node_modules` test and `isUnderDir` prefix test still work structurally,
   but basePath from `readConfiguration` is unlikely to be UNC-prefixed while a realpath
   MIGHT resolve a network mount to a UNC path -> a false out-of-project suppression. Low
   likelihood on the supported platforms; note as an open question rather than a fix.

5. **Symlinked `basePath` itself.** The canonicalizer realpath-resolves both the base and
   each file, so a symlinked project root is handled consistently. No change. (Worth one
   spec to lock the behavior.)

---

## CONCRETE IMPROVEMENTS

Ordered low-risk / high-leverage first.

1. **[maintainability] Add `// angular-typechecker: vendored -- <reason>` greppable markers
   to every re-declared member and every deliberate divergence in `compiler-cli-types.ts`**
   (the `EmitFlags.None` fabrication, the `program` non-optional narrowing, the `TsProgram`
   intersection, the `UNKNOWN_ERROR_CODE = 500` value pin, the omitted-getter set).
   Effort: **S.** Risk: none (comments only). Enables one-command audit at every Angular bump.

2. **[robustness] Wrap the `options.realpath(filePath)` call in `filter-diagnostics.ts:119`
   in a try/catch** that falls back to the normalized-but-unresolved path on throw, so a
   throwing realpath degrades gracefully instead of aborting the whole type-check pass. Add
   a spec injecting a realpath that throws. Effort: **S.** Risk: low (changes only the error
   path; the happy path is identical). Highest robustness-per-line item.

3. **[maintainability] Add a build-time drift-detection unit** -- a dedicated
   `tsconfig.drift.json` (extends base, `moduleResolution: node`, `ignoreDeprecations:
"6.0"`, includes one file) + a `compiler-cli-types.drift.spec.ts` containing the
   assignability + getter-set tripwire assertions from "Build-time drift detection". Wire
   `tsc --noEmit -p tsconfig.drift.json` into the Nx pipeline (a `typecheck-drift` target or
   folded into `lint`/CI). This converts silent shim drift -- especially a NEW Angular
   diagnostic getter (the under-gathering hazard) -- into a red CI build. Effort: **M**
   (one tsconfig, one file, one target + CI wiring). Risk: low-medium -- the unit only adds a
   build check; the main concern is ensuring it is actually TYPE-CHECKED (Vitest alone won't
   bite). This is THE central ask of the research; verified feasible because the barrel
   resolves under classic `node` resolution.

4. **[correctness] Treat a present-but-empty `diagnostic.file.fileName` like a file-less
   diagnostic** (keep it, do not suppress) in `filter-diagnostics.ts`, with a spec. Effort:
   **S.** Risk: low (narrow guard; avoids a silent false-suppression).

5. **[maintainability] Replace the fabricated `EmitFlags.None = 0`** with either (a) the
   REAL minimal subset the engine needs, or (b) keep `None = 0` but mark it explicitly as a
   non-upstream convenience alias with a `// angular-typechecker: vendored -- NOT an upstream
member; 0 = no-flags bitmask` comment. The drift unit's `0 as ng.EmitFlags` assertion (item 3) already pins that `0` stays valid. Effort: **S.** Risk: low.

6. **[maintainability] Pin `UNKNOWN_ERROR_CODE`'s value via the drift unit** rather than
   trusting the duplicated literal. If Angular types it as a literal `500`, add
   `const _code: 500 = ng.UNKNOWN_ERROR_CODE` to the drift spec; otherwise assert
   `ng.UNKNOWN_ERROR_CODE` is `number`-assignable and keep the `500` documented. Effort: **S**
   (folds into item 3). Risk: low.

7. **[correctness] Add Windows-focused filter specs** (drive-letter `C:` vs `c:` case-fold
   match on the case-insensitive branch; symlinked basePath). Test-only; locks behavior the
   dev/CI matrix (incl. this Windows dev box) actually exercises. Effort: **S.** Risk: none.

8. **[maintainability] Add a greppable marker + JSDoc note to the loader's
   `as unknown as CompilerCli` cast** (`compiler-loader.ts:17`) -- the structural equivalent
   of prettier's private-access fence. Document that this single cast is the entire
   runtime-vs-type trust boundary. Effort: **S.** Risk: none.

---

## Open questions

1. **Should the drift unit assert assignability in BOTH directions, or only real->shim?**
   `Assignable<ng.Program, ShimProgram>` (real assignable to our narrower shim) is the one
   that proves "every getter we use still exists upstream." The reverse (`ShimProgram`
   assignable to `ng.Program`) would FAIL by design because our shim is a deliberate subset
   (missing `emit`/`loadNgStructureAsync`/`listLazyRoutes`). So only the real->shim
   direction is correct for a subset shim. Confirm we never want the shim to be a full
   superset.

2. **Where exactly to wire `tsc -p tsconfig.drift.json` in the Nx target graph** -- a
   standalone `typecheck-drift` target (cleanest, explicit) vs folding the file into the
   existing spec type-check (if any runs `tsc`). The spec tsconfig is currently nodenext, so
   it CANNOT host the real-type import without a resolution override; a dedicated tsconfig is
   the lower-risk path. Needs a planning decision, not more research.

3. **UNC / network-mount realpath false-suppression** (filter note 4) -- low likelihood on
   the supported platforms; defer unless a consumer reports it.

4. **Does Angular 23 keep the barrel resolvable under classic `node`?** The drift unit
   itself is the regression net, but when widening the peer range, re-run the probes against
   the new typings to confirm the classic-node import still resolves (it relies on Angular
   keeping `moduleResolution: node` working for its own build, which it does at 22.0.4).
