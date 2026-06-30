# AnalogJS fastCompile + Storybook + Brandon Roberts analysis -- Prior Art Learnings

Research date: 2026-06-29. Sources: local clone `D:\projects\github\analogjs\analog`
(`@analogjs/vite-plugin-angular@2.6.3-beta.1`, `@analogjs/storybook-angular@2.6.3-beta.1`)
and Brandon Roberts' dev.to article "Angular Compilation, Type-Checking, and Build
Bottlenecks" (published 2026-06-26, fetched via markdown.new).

This is the prior art for the EXACT seam angular-typechecker fills: every fast Angular
build path in this ecosystem deliberately SKIPS the whole-program type-check and tells you
to "run the type-check elsewhere." angular-typechecker is that elsewhere.

---

## fastCompile: what it does and skips

### The option and its default

`@analogjs/vite-plugin-angular` exposes a `fastCompile` plugin option.
Evidence: `packages/vite-plugin-angular/src/lib/angular-vite-plugin.ts:110-115`:

```ts
/**
 * Opt into the fast compile path. Skips Angular's template type-checking
 * and routes compilation through an internal single-pass transform.
 * Defaults to `false`.
 */
fastCompile?: boolean;
```

Normalized default at `angular-vite-plugin.ts:174`: `fastCompile: options?.fastCompile ?? false`.
A second option `fastCompileMode?: 'full' | 'partial'` (default `'full'`) selects final Ivy
emit (`full`, for apps) vs partial declarations (`partial`, for library publishing) --
`angular-vite-plugin.ts:116-121, 175`.

### The mechanism (per-file transpile, no NgtscProgram)

The fast path lives in `packages/vite-plugin-angular/src/lib/fast-compile-plugin.ts`
(plugin name `@analogjs/vite-plugin-angular-fast-compile`, `enforce: 'pre'`). It does NOT
construct an `NgtscProgram` and does NOT run a TypeScript type-checker. Instead:

1. **Registry build (`initFastCompile`, lines 165-354)**: scans tsconfig `rootNames` plus
   the entry points named in `compilerOptions.paths`, walks the transitive relative-import
   and `paths`-mapped import graph, and lazily reads external packages' `.d.ts` files
   (`scanPackageDts`, lines 296-311) to build a `ComponentRegistry` Map of class name ->
   directive/component/pipe metadata (selectors, input/output names). It explicitly notes
   this replaces "a whole-program type-checker" with "a lightweight registry."
2. **Per-file transform (`handleFastCompileTransform`, lines 374-546)**: for each `.ts`
   file matching the Angular decorator regex (`ANGULAR_DECORATOR_CALL_RE`), it inlines
   external `templateUrl`/`styleUrl`s, preprocesses SCSS/Sass/Less, then calls `compile()`
   (the project's own R3 emitter under `src/lib/compiler/`) to produce the Ivy definitions
   (`ɵcmp`, `ɵfac`, `ɵprov`, `ɵmod`). It finishes by stripping TS-only syntax with
   `vite.transformWithOxc` / `transformWithEsbuild` (lines 522-531).
3. Non-Angular files are merely TS-syntax-stripped (lines 378-398); a JIT branch
   (lines 401-437) routes through `jitTransform` instead.

What it SKIPS, verbatim: "emits Ivy instructions directly and **skips Angular's template
type-checking**" (README) and "Skips Angular's template type-checking" (option docs).
There is NO TypeScript semantic check and NO Angular template type-check in this path --
only OXC/esbuild syntax stripping. Conformance: README states the fast path "currently
passes ~91% of Angular's conformance suite."

### Surprise finding: the AOT path ALSO skips type-checking by default

Even the NON-fastCompile (NgtscProgram AOT) path defaults to skipping type-checking. The
option `disableTypeChecking?: boolean` defaults to **`true`**
(`angular-vite-plugin.ts:170`: `disableTypeChecking: options?.disableTypeChecking ?? true`).

The gather function `getDiagnosticsForSourceFile` (`angular-vite-plugin.ts:1749-1772`) is
the precise INVERSE of what angular-typechecker must do:

```ts
function getDiagnosticsForSourceFile(sourceFile, disableTypeChecking, program, angularCompiler) {
  const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile);
  if (disableTypeChecking) {
    // Syntax errors are cheap ... always show these regardless
    return syntacticDiagnostics;                       // <-- DEFAULT: syntactic only
  }
  const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile);
  const angularDiagnostics = angularCompiler
    ? angularCompiler.getDiagnosticsForFile(sourceFile, 1)   // Angular template diagnostics
    : [];
  return [...syntacticDiagnostics, ...semanticDiagnostics, ...angularDiagnostics];
}
```

So by default the Vite dev/build pipeline returns ONLY syntactic diagnostics; the full set
(syntactic + TS semantic + Angular template via `getDiagnosticsForFile`) is gated behind
opting `disableTypeChecking: false`. **angular-typechecker's job is to always run all three
unconditionally** -- this is the same `getDiagnosticsForFile(sourceFile, 1)` Angular API
surface (the `1` is `OptimizeFor.SingleFile`), gathered for every source file.

The plugin does NOT itself fully delegate to a separate tool inside the build; rather, when
type-checking is on, it does collect Angular template diagnostics inline. The point is the
DEFAULT posture is "type-check off, run it elsewhere," which the README makes explicit for
fastCompile (see next section).

---

## The "type-check elsewhere" seam

This is the load-bearing finding -- the literal integration point angular-typechecker replaces.

### Literal recommended command (from the published README)

`packages/vite-plugin-angular/README.md:53-71`:

> ## Fast Compile Mode
> `fastCompile` opts the plugin into a single-pass compilation path that emits Ivy
> instructions directly and skips Angular's template type-checking. ...
>
> When `fastCompile` is enabled, template and input type errors will not surface during
> compilation -- **run `ngc -p tsconfig.app.json --noEmit` as a separate step in your build
> script to keep full type safety**:

```json
{
  "scripts": {
    "build": "ngc -p tsconfig.app.json --noEmit && vite build"
  }
}
```

So the canonical recommended command is literally:

```
ngc -p tsconfig.app.json --noEmit
```

wired into the npm `build` script as a `&&`-prefix gate before `vite build`. The tsconfig
it points at (`tsconfig.app.json`, documented in the same README at lines 76-114) carries
`angularCompilerOptions.strictTemplates: true`, `strictInjectionParameters`,
`strictInputAccessModifiers` -- i.e. the strict template type-check is exactly what `ngc
--noEmit` performs.

### Where the guidance lives

- Published `README.md` of `@analogjs/vite-plugin-angular` (the "Fast Compile Mode"
  section). This README ships in the npm tarball, so it is the canonical public guidance.
- Brandon's article reinforces it conceptually: "Skipping type-checking means template
  mistakes the normal build would reject slip through to runtime -- that's the explicit
  trade, and **it's why you still run the type-check, just elsewhere.**"

### Why this is angular-typechecker's exact replacement target

The recommended seam is a raw `ngc --noEmit` shell step. angular-typechecker offers the
SAME complete diagnostic set (TS syntactic + semantic + Angular template + extended NG8xxx)
but Nx-native, cacheable, per-project, and decoupled. The pitch writes itself: replace
`"build": "ngc -p tsconfig.app.json --noEmit && vite build"` with an Nx target that runs
`angular-typecheck` (cached) as a dependsOn of `build`. The seam is identical; the value-add
is caching, Nx graph integration, multi-project-type support (app/lib/spec tsconfigs), and
not re-resolving the program on every invocation.

---

## storybook-angular & *.stories.ts type-check

### How stories are built/compiled

`@analogjs/storybook-angular` is a Storybook framework adapter built on
`@storybook/builder-vite` + `@analogjs/vite-plugin-angular`. Its Vite integration lives in
`packages/storybook-angular/src/lib/preset.ts`. The `viteFinal` hook (lines 70-128) strips
any user-loaded analogjs plugins and re-adds `@analogjs/vite-plugin-angular` with these
options:

```ts
angular({
  jit: typeof framework.options?.jit !== 'undefined' ? framework.options?.jit : true,   // DEFAULT jit: true
  liveReload: ... ?? false,
  tsconfig: ... ?? (options?.tsConfig ?? './.storybook/tsconfig.json'),
  inlineStylesExtension: ... ?? 'css',
}),
```

Key facts:
- **Stories compile in JIT mode by default** (`jit` defaults to `true`, preset.ts:102-105).
  In the fastCompile plugin's JIT branch (`fast-compile-plugin.ts:165-166, 401-437`) there
  is NO registry scan and NO type-check -- `jitTransform` only rewrites decorators and
  strips TS syntax. In the AOT plugin, `jit: true` also disables AOT template type-check
  blocks. Either way, **stories are NOT Angular-template type-checked** during a Storybook
  build/serve.
- The story tsconfig defaults to `./.storybook/tsconfig.json` (the `tsConfig` builder
  option, see `start-storybook/schema.json` `tsConfig` property). A typical
  `.storybook/tsconfig.json` extends the app/lib tsconfig and adds `*.stories.ts` to its
  `include`.
- There is **no separate "type-check stories" step** anywhere in the package -- no executor,
  builder option, or README mention of type-checking. The only correctness aids are
  optional `compodoc` (docs metadata, not type-check) and `experimentalZoneless`.

### What type-checking `*.stories.ts` with our tool would require (deferred SUR)

A Storybook story type-check (the deferred SUR feature) needs:
1. **A tsconfig whose `include` covers `*.stories.ts`** -- in practice
   `.storybook/tsconfig.json` (or a dedicated `tsconfig.storybook.json`) that extends the
   project tsconfig and adds the stories glob. The user already has this for Storybook to
   run; angular-typechecker just needs to be pointed at it.
2. **Stories must compile under the same Angular program.** Stories reference real Angular
   components and use `Meta`/`StoryObj<T>` generics and `args`. Because a story imports the
   component class and binds `args` to its `@Input()`s, a full `performCompilation` over a
   stories-including tsconfig WILL type-check both the story's TS (e.g. wrong `args` shape
   vs the component's inputs) AND any inline `template` in a story's `render`/`moduleMetadata`
   via Angular template type-check blocks. No special story-awareness is needed -- they are
   ordinary `.ts` files with Angular decorators/templates once included.
3. **Caveat to verify:** Storybook's CSF types come from `@storybook/angular`
   (`Meta`, `StoryObj`), which must be installed and resolvable; the story tsconfig's
   `types`/`include` must not exclude them. The analog `tsconfig.spec.json` for the package
   itself uses `types: ["webpack-env", "node"]` and `isolatedModules: true` -- a consumer's
   stories tsconfig will differ, but the lesson is that the `types` array matters for the
   check to resolve story-runner globals.

Net: the deferred Storybook SUR is mostly "accept/point at a stories-including tsconfig" --
the engine (`performCompilation` + unconditional gatherer) needs no story-specific code.

---

## Brandon Roberts bottleneck breakdown

All numbers are the author's measurements on one large real-world app ("hundreds of
components"), cold production builds ("the kind CI runs"). Quotes are verbatim.

### The four pipelines and their times

| Pipeline | Type-checks? | Build time | Notes |
| --- | --- | --- | --- |
| Webpack + `@ngtools/webpack` (whole-program AOT, legacy) | Yes | **~49s** | Deprecated as of Angular v22 |
| `@angular/build:application` (whole-program AOT, esbuild -- modern default, `ng build`) | Yes | **~36s** | Same `ngtsc`; only the bundler changed |
| AnalogJS `fastCompile` (per-file transpile) | **No** | **~14.5s** | Vite/rolldown bundler |
| Oxc Angular Compiler (experimental, Rust, per-file transpile) | **No** | **~7.7s** | Research project, not a roadmap item |

The isolated type-check reference point:

> "The dashed bar is the reference point: type-checking the app on its own -- **`ngc
> --noEmit` with `strictTemplates`, no codegen, no bundling -- takes about 15 seconds**, as
> long as an entire per-file build."

> "`ngc --noEmit` puts a number on it: the whole-program type-check alone is **~15s** --
> about as long as the entire fastCompile build (**~14.5s**), and roughly twice the Oxc
> Angular Compiler build (**~7.7s**)."

> "Of the modern builder's **~36s**, roughly **15 is type-checking** and the rest is
> codegen, bundling, and optimization -- and the type-check is the biggest of those pieces,
> and the only one that produces no output, just a pass or a fail."

> "The per-file pipelines still come in **2.5-5x faster**."

### Reconciliation with PROJECT.md's 15s/36s

**PROJECT.md's figures HOLD and are accurate.** PROJECT.md cites "~15s standalone `ngc
--noEmit` vs ~36s full esbuild build." The article gives:
- standalone `ngc --noEmit` with `strictTemplates`: **~15s** -> matches PROJECT.md's ~15s.
- full esbuild application builder build: **~36s** -> matches PROJECT.md's ~36s.

Additional precision PROJECT.md could optionally add (all from the article): Webpack legacy
baseline ~49s; fastCompile ~14.5s; Oxc ~7.7s; and the key framing that within the ~36s
build, ~15s IS the type-check (so the type-check is ~42% of the modern build and is the
single largest, separable, output-less component). No correction is needed; PROJECT.md may
quote these refinements verbatim.

### Brandon's recommendation for where/how to run the type-check

- The article does NOT name a specific tool; it establishes the PRINCIPLE: the fast
  per-file compilers "skip the check entirely" and "it's why you still run the type-check,
  just elsewhere." The editor's Language Service covers the live loop; CI runs `ngc
  --noEmit`.
- "That's the same analysis your editor runs as you type and your CI runs on every push;
  `ngc --noEmit` does it standalone in ~15s."
- Forward-looking: TypeScript 7 (Go port, "~10x speedup") could eventually make Angular's
  type-check much faster since "`ngtsc` wraps a `ts.Program`," but he hedges that Angular's
  template checking sits on top and "may not see the same multiple." Implication for us: the
  type-check stays a separable, worth-optimizing cost for the foreseeable v0.0.x window.

---

## LEARNINGS FOR angular-typechecker

1. **[positioning] The "elsewhere" is a literal `ngc -p tsconfig.app.json --noEmit` shell
   step wired as a `build` script gate.** This is the verbatim command AnalogJS recommends
   (README "Fast Compile Mode"). angular-typechecker's headline pitch is a drop-in
   replacement for that exact seam: same complete diagnostics, but Nx-cacheable,
   per-project, and not re-resolving the program every run. Quote the README command in our
   README's "Why" / migration section.

2. **[positioning] Both the fastCompile AND the default AOT path skip type-checking** --
   `disableTypeChecking` defaults to `true` (`angular-vite-plugin.ts:170`). The ecosystem's
   default posture is "type-check off." This widens our addressable seam: it's not just
   fastCompile users; ANY `@analogjs/vite-plugin-angular` consumer on defaults is
   type-checking-blind in the build and needs an "elsewhere." Reinforces the core value
   prop.

3. **[positioning/engine] The diagnostic API surface is identical to ours.** Analog gathers
   the full set via `program.getSyntacticDiagnostics` + `program.getSemanticDiagnostics` +
   `angularCompiler.getDiagnosticsForFile(sourceFile, 1)` (`angular-vite-plugin.ts:1763-1771`).
   Our Approach A gatherer targets the same three sources; confirm we also emit the
   syntactic set (cheap, always relevant) and that we pass the right `OptimizeFor` (Analog
   uses `1` = SingleFile). This is independent corroboration that our engine design matches
   a production implementation.

4. **[SUR -- Storybook] A `*.stories.ts` type-check needs only a stories-including tsconfig;
   no story-specific engine code.** Storybook compiles stories in JIT by default
   (`preset.ts:102-105`) with NO template type-check, and ships no type-check step. Point
   angular-typechecker at the user's `.storybook/tsconfig.json` (Storybook's default
   `tsConfig`) -- which already `include`s `*.stories.ts` -- and `performCompilation` checks
   story TS (e.g. `args` vs `@Input()` shape) and inline story templates for free. Deferred
   SUR is low-engine-cost.

5. **[SUR -- Storybook] Verify story-runner type resolution before claiming Storybook
   support.** `Meta`/`StoryObj<T>` come from `@storybook/angular`; the stories tsconfig's
   `types`/`include`/`typeRoots` must resolve them or we'll emit false TS errors. Add a
   recipe note: ensure the stories tsconfig extends the project tsconfig and does not narrow
   `types` to exclude story-runner globals.

6. **[docs-recipe -- Analog/Vite non-Nx] Standalone-CLI wiring (deferred SUR).** A non-Nx
   AnalogJS/Vite user today writes `"build": "ngc -p tsconfig.app.json --noEmit && vite
   build"`. Our deferred standalone CLI should mirror exactly that ergonomic:
   `angular-typecheck -p tsconfig.app.json` as the `&&`-gate before `vite build`. The CLI's
   minimum viable surface is "take a `-p <tsconfig>`, run the complete diagnostic set, exit
   non-zero on error" -- a direct `ngc --noEmit` analog. This is the simplest possible
   parity target.

7. **[docs-recipe -- Nx + Analog] Nx user wiring.** An Nx + Analog user replaces the shell
   `ngc --noEmit` gate with an Nx target: add `angular-typecheck` executor target to the
   project, and make the app's `build` (or a CI `check`) target `dependsOn:
   ["angular-typecheck"]`. Because Analog projects on Nx use `@nx/vite`/Vite builders that
   skip the type-check, the Nx-cached `angular-typecheck` target becomes the canonical
   "elsewhere" -- and unlike the shell `&&`, it's cached and graph-aware. Document this as
   the flagship recipe.

8. **[positioning] Lean on the verified numbers.** ~15s `ngc --noEmit` is ~42% of the ~36s
   modern build and is the single largest, output-less, separable cost; per-file builds are
   2.5-5x faster precisely by omitting it. Use these (with attribution to Brandon Roberts,
   2026-06-26) in README/marketing. PROJECT.md's 15s/36s are CONFIRMED correct.

9. **[SUP -- AI-agent skill] The agent-loop value prop is the same "run it elsewhere"
   story.** Fast per-file dev compilers give agents a fast inner loop but no type-truth;
   angular-typechecker is the headless, complete static check an agent runs before declaring
   done. A future AI skill should know the exact tsconfig-per-project-type mapping
   (app/lib/spec/stories) so it points the executor at the right tsconfig for the files it
   changed.

10. **[engine] Registry-vs-program is the architectural fork to NOT take for v0.0.1.**
    fastCompile and Oxc achieve speed by replacing the whole-program type-checker with a
    lightweight selector registry (`fast-compile-plugin.ts:165-354`) -- which is exactly the
    correctness they give up. angular-typechecker deliberately keeps the whole-program
    `performCompilation`/NgtscProgram model because completeness is the product. The article
    validates that the type-check is inherently whole-program ("the compiler can't work one
    file at a time"), so our non-incremental, per-tsconfig-program approach is the correct
    (only) way to be complete -- the cost we're paying is the cost that exists.

---

## Open questions

1. **Extended NG8xxx diagnostics via `getDiagnosticsForFile`?** Analog calls
   `angularCompiler.getDiagnosticsForFile(sourceFile, 1)`, which returns template
   diagnostics. Confirm this includes extended diagnostics (NG8xxx) or whether those require
   `extendedDiagnostics` config in `angularCompilerOptions` and a separate gather path. (Our
   PROJECT.md claims we ship the extended set -- verify the API returns them with
   `strictTemplates`/extended config on.)

2. **Does Analog's stories tsconfig actually include `*.stories.ts`, or only `main.ts`?**
   The default `tsConfig` is `./.storybook/tsconfig.json`; confirm against a real Storybook
   scaffold whether that file's `include` covers stories (it typically does, but the analog
   package's own `tsconfig.spec.json` includes only `**/*.test.ts` + `**/*.d.ts`). Affects
   the Storybook recipe's "point at this tsconfig" instruction.

3. **`OptimizeFor` value.** Analog passes `1` (SingleFile) to `getDiagnosticsForFile`.
   For a whole-program no-emit run, is `WholeProgram` (`0`) more correct/faster for our
   batch-over-all-files use case? Worth a perf/correctness check against our gatherer.

4. **fastCompile `partial` mode for buildable/publishable libs.** fastCompile's
   `'partial'` mode emits partial declarations for library publishing. Does this interact
   with how we should type-check publishable libraries (which use partial-Ivy `.d.ts`)? No
   evidence either way yet; flag for the buildable/publishable-lib test matrix.

5. **Brandon article: were the per-file builds using Vite/rolldown vs the AOT esbuild?**
   The article notes the per-file totals "mix two effects" (skipped type-check + faster
   bundler), and `ngc --noEmit` is what "cleanly isolates the type-check." Our positioning
   should cite the ~15s `ngc` figure (clean isolation) rather than the build-total deltas to
   avoid the bundler confound.
