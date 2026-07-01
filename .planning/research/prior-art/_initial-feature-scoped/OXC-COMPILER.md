# Void Zero Oxc Angular Compiler -- Prior Art Learnings

Researched 2026-06-29. Sources:

- Local clone: `D:\projects\github\voidzero-dev\oxc-angular-compiler\` (Cargo workspace + NAPI-RS node bindings + Vite plugin). Published as `@oxc-angular/vite` v0.0.32.
- Article: "How we made the Angular Compiler faster using AI" -- https://voidzero.dev/posts/oxc-angular-compiler (by Brooklyn / LongYinan, VoidZero).

This is the single most important prior-art datapoint for angular-typechecker's positioning: it is the experimental fast Angular compiler that explicitly skips type-checking and tells you to run the type-check elsewhere. That "elsewhere" is exactly what angular-typechecker provides.

---

## What it is & scope

The Oxc Angular Compiler is a **Rust port of Angular's _template/decorator_ compiler** built on the Oxc toolchain (the same Rust stack that powers Vite 8+). It parses Angular component templates and decorator metadata and emits Ivy JavaScript (`ɵɵdefineComponent`, `ɵɵngDeclare*`, etc.) -- the equivalent of `@angular/compiler-cli`'s code-generation step, reimplemented natively. It supports `@Component`, `@Directive`, `@NgModule`, `@Injectable`, `@Pipe` (and `@Service`), templates, HMR, style encapsulation (Emulated / None / ShadowDom), i18n extraction, partial vs full compilation modes, and Ivy `.d.ts` member generation.

### Explicit type-check stance (the headline)

The article carries an explicit DANGER callout (article line 32-34, verbatim):

> "It does not implement Angular's cross-file optimizations or support template type-checking."

And a WARNING (article line 7-9):

> "The Oxc Angular Compiler is an experiment for research purposes."

The article explains _why_ type-checking is the separable cost it deliberately drops (article line 45-47, verbatim):

> "Angular's existing compiler compiles HTML templates into TypeScript code and then runs TypeScript Compiler to generate the JavaScript output. While generating the JavaScript output, Angular compiler uses TypeScript Compiler's semantic information for optimizations. Therefore, Angular compiler is unable to skip the type check, which otherwise accelerates build. Meaning it effectively performs deep, whole-program type analysis on template-generated TypeScript code. This becomes exponentially more expensive as applications grow."

> "Rather than driving template compilation through TypeScript's checker, Oxc Angular Compiler implements the template compiler and the required analysis natively in Rust using Oxc and integrates it into Vite through NAPI-RS. This reduces how much the build depends on TypeScript's semantic checker. Resulting in less overhead and much faster compiling."

The source code corroborates the no-type-checker stance repeatedly -- the compiler has no TS semantic checker and works around its absence with heuristics:

- `crates/oxc_angular_compiler/src/dts.rs:562`: "Note: We use `unknown` as the type because we don't have access to the TypeScript type checker".
- `crates/oxc_angular_compiler/src/component/transform.rs:2504`: "a TypeScript type checker we cannot otherwise distinguish interfaces from classes."
- `crates/oxc_angular_compiler/src/class_metadata/builders.rs:805`: "checking is_type_only is the closest heuristic without a full type checker."
- `crates/oxc_angular_compiler/src/pipeline/phases/remove_illegal_let_references.rs:6`: behavior differs in JIT "where type checking isn't running".

There is **no type-checking crate or module** in the workspace (`crates/` contains only `oxc_angular_compiler` and `angular_conformance`; the core crate modules are parser / transform / ir / pipeline / output / hmr / styles / i18n / dts / linker / partial / etc. -- no `checker`/`typecheck`). Template type-check (NG8xxx extended diagnostics, expression type errors) is entirely out of scope.

### Project status: it will NOT be maintained

Article line 124-128 (verbatim):

> "the Oxc Angular Compiler is an experiment to test what's possible with AI and showcase Oxc's speed. **The project will not be maintained.** It's a reference on how to implement Angular's single-file compilation completely in Rust."

> "In parallel, the Angular team have been conducting their own experiments with Oxc. Specifically, for the TypeScript parsing while feeding Angular's existing template compiler because it enables more incremental porting. There's a potential future where the Oxc Angular Compiler is integrated into Angular's official full compiler stack."

The README also flags it: "This project is in an experimental stage and is actively seeking maintainers."

---

## Architecture & Node API

### Compiler architecture (per-file / single-file, NOT whole-program)

The compiler is **single-file by design**. The article's closing line calls it "a reference on how to implement Angular's _single-file compilation_ completely in Rust", and the DANGER box says it "does not implement Angular's cross-file optimizations". This is the architectural inverse of angular-typechecker, which is deliberately _whole-program_ (`performCompilation` over the full `tsconfig`).

6-stage pipeline (README + core crate `lib.rs` doc):

```
HTML Template -> PARSING (HTML AST) -> TRANSFORM (R3 AST, Angular's IR)
  -> INGESTION (IR ops) -> TRANSFORMATION (67 ordered optimization phases)
  -> EMISSION (Output AST) -> CODE GENERATION (JavaScript)
```

Angular templates + decorator metadata are handled entirely in Rust: an HTML parser, an `htmlAstToRender3Ast` transform, and metadata extractors that walk the Oxc TS AST (`oxc_parser::Parser`) to read `@Component`/`@Directive`/etc. decorators. It reuses Oxc's Parser / Semantic / Transformer / Codegen crates (`oxc_* = "0.137"`) instead of TypeScript. Perf techniques (article line 144-148): arena allocation to cut memory allocs, SIMD crates, mimalloc global allocator. Fidelity strategy was a **strict 1:1 port** of Angular's TS compiler control flow, verified by a "compare" test harness against `ng` CLI output on real apps (Bitwarden).

`cross_file_elision` exists as an opt-in feature but is explicitly **"intended for compare tests only. In production, bundlers handle import elision during tree-shaking"** (`napi/.../src/lib.rs:176-183`). So there is no production whole-program analysis.

### Node-facing API (`napi/angular-compiler/`)

Two consumption modes (README + article line 49-120):

1. **First-class Vite plugin**: `import { angular } from '@oxc-angular/vite'`. Peer-depends only on `vite >= 8.0.0`. Returns an array of Vite plugins (main transform, styles, dts, linker, optional jit, build-optimizer, ssr-manifest).
2. **Programmatic API**: `import { compileTemplate, transformAngularFile } from '@oxc-angular/vite/api'` (maps to the raw NAPI binding `#binding` -> `./index.js`).

Core NAPI functions (`napi/angular-compiler/src/lib.rs`), all async via `AsyncTask` with sync twins:

- `compileTemplate(template, componentName, filePath, options?) -> TemplateCompileResult { code, map, errors }`
- `transformAngularFile(source, filename, options?, resolvedResources?) -> TransformResult { code, map, dependencies, templateUpdates, styleUpdates, errors, warnings, dtsDeclarations }`
- HMR helpers: `compileForHmr*`, `generateHmrModule`, `generateStyleModule`, component-id encode/decode/parse.
- Metadata extractors: `extractComponentUrls`, `extractComponentMetadata`, `extractTopLevelDeclarations`, `extractPipeMetadata`, `compilePipe`, `encapsulateStyle`.

`TransformOptions` notable fields: `angularVersion {major,minor,patch}` (version-conditional emit), `hmr`, `jit`, `sourcemap`, `compilationMode: 'full' | 'partial'`, `emitClassMetadata` (default true, mirrors `ngc`), `minifyComponentStyles`, `encapsulation`, `changeDetection`, `crossFileElision` (compare-tests only). `errors`/`warnings` are returned as `OxcError` diagnostics (template _compile_ errors, NOT type errors).

How a bundler calls it (from `vite-plugin/index.ts`): the plugin's `transform` hook matches `*.ts(x)`, does a cheap substring check for an Angular decorator, resolves `templateUrl`/`styleUrls` from disk (running Vite's `preprocessCSS` for SCSS/LESS), then calls `transformAngularFile(code, id, options, resources)` and returns `{ code, map }`. HMR is driven through `handleHotUpdate` + a `@ng/component` HTTP middleware endpoint.

### The `.d.ts` / tsconfig seam (the interop hook -- important)

Two explicit statements show the compiler _expects an external type-checker_ and even feeds it:

- Vite plugin option (`vite-plugin/index.ts:52-53`): `tsconfig?: string` -- "Path to tsconfig.json **(used for file discovery, not TypeScript compilation)**." The plugin never type-checks; tsconfig is only for resolving the file set / path aliases.
- `TransformResult.dtsDeclarations` (`napi/.../src/lib.rs:364-375`): the compiler emits Ivy static member declarations (`ɵfac`/`ɵcmp`/...) for injection into a library's `.d.ts`, and the doc says this "enables library builds to include proper Ivy type declarations **for template type-checking by consumers**." The `dts.rs` module header (`crates/.../src/dts.rs:5`): these declarations "enable Angular's template type-checking system to work with pre-compiled libraries." So Oxc's own design assumes the _consumer_ runs the type-check; it just produces the Ivy `.d.ts` surface that a real Angular type-checker needs.

---

## Performance claims (verbatim, cite article + README)

- "up to 20x faster code compiling speed" (article line 11).
- "6.4x faster than Angular CLI on Super Productivity" (article line 40).
- "20.7x faster than Webpack + `@ngtools/webpack` on Bitwarden" (article line 41).
- README benchmark, Bitwarden Web Vault cold production build, Apple M3 Max, Node 22.22.0, 3 iterations: **Vite + OXC Angular Compiler = 4.55s (20.7x)** vs **Webpack + `@ngtools/webpack` = 1m 34.2s (baseline)**.
- Causal claim (article line 43): "While using Rust did contribute to the performance improvement, a bigger reason is the differing approaches of each compiler." The differing approach IS skipping the TS semantic checker (quoted above).

### What cost is eliminated by skipping type-check (reinforces our core value)

The article's central technical thesis is that **the whole-program type analysis is the separable, dominant build cost**: Angular's compiler cannot skip the TS type check because it reuses the checker's semantic info during emit, and that "deep, whole-program type analysis ... becomes exponentially more expensive as applications grow." Oxc gets its speed by _not doing that analysis at all_. This is independent third-party corroboration of angular-typechecker's PROJECT.md premise (Brandon Roberts' ~15s `ngc --noEmit` vs ~36s build separation): the type-check is both the expensive part AND cleanly separable from code generation.

---

## Positioning implications for angular-typechecker (strategic core)

1. **The market gap is real and now explicitly named by a major vendor.** A VoidZero/Oxc compiler shipping a literal "does not support template type-checking" DANGER box, plus esbuild dev and AnalogJS `fastCompile` doing the same, means the "fast compile that skips type-check -> run the type-check elsewhere" pattern is now the mainstream fast-build architecture. angular-typechecker IS that "elsewhere," and can cite this verbatim.

2. **angular-typechecker is architecturally complementary, not competitive.** Oxc = per-file/single-file _emit_, no type-check, dev/build speed. angular-typechecker = whole-program _no-emit_ type-check (TS + template + NG8xxx), decoupled from build. They occupy opposite halves of what `ngc` does today. There is no overlap to defend -- the pitch is "pair them," not "pick one."

3. **The threat is bounded and points the other way.** Oxc "will not be maintained" as a standalone product; its stated future is being absorbed into Angular's _official_ compiler stack (Angular team already experimenting with Oxc for TS parsing while keeping Angular's own template compiler). Even in that future, the type-check stays in Angular's compiler -- nobody is proposing a fast Rust _type-checker_. A faster Angular build that still skips/needs the separable type-check only _increases_ demand for a fast decoupled type-check.

4. **Use it as the canonical "why decoupled?" citation in README/docs.** The quote "Angular compiler is unable to skip the type check ... deep, whole-program type analysis ... exponentially more expensive as applications grow" is a clean, attributable justification for why a standalone whole-program type-check tool exists and why it is the slow-but-necessary half worth caching per project.

---

## Interop / companion story (concrete)

A realistic two-tool workflow that we can document as the recommended setup:

- **Dev / build loop**: Oxc Angular Compiler (or esbuild/AnalogJS fastCompile) compiles fast, skipping type-check, for the inner-loop and/or production bundle.
- **Correctness gate**: angular-typechecker runs `angular-typecheck` as a separate, cacheable Nx target over the same `tsconfig`(s) in CI and agent loops -- producing the TS + template + extended NG8xxx diagnostics the fast compiler skipped.

Concrete seams that make this clean:

- **Shared tsconfig, different consumer.** Oxc treats `tsconfig` as "file discovery, not TypeScript compilation"; angular-typechecker consumes the _same_ tsconfig as a real whole-program type-check input. The project's file set is the shared contract -- no special integration needed.
- **The editor covers the live loop, we cover headless.** Article and our PROJECT.md agree the Angular Language Service handles in-editor template checking; the gap is headless/CI/agent runs -- precisely our target.
- **Library `.d.ts` interop.** Oxc emits Ivy `.d.ts` member declarations (`partial` mode) so that downstream apps' template type-checking works against pre-compiled libs. angular-typechecker, run on a consuming app, would be the tool that actually _exercises_ those declarations during a whole-program template type-check. The two halves literally fit: Oxc produces the typed library surface, we verify usage against it.
- **No plugin/hook coupling required.** Because Oxc exposes only a Vite plugin + a stateless programmatic NAPI API (no type-check hook, no diagnostic-provider seam), the cleanest interop is _orchestration-level_ (two Nx targets / two pipeline steps over one project), not in-process. There is no API on Oxc's side to hang a type-checker off of, and we should not try to.

---

## LEARNINGS FOR angular-typechecker

1. **[positioning]** A flagship Oxc/VoidZero compiler ships an explicit "does not support template type-checking" DANGER box -- quote it verbatim in README/positioning as third-party proof that the fast-compile world deliberately punts the type-check, and that angular-typechecker is the place it gets done. (Source: article line 32-34.)

2. **[positioning/strategy]** The independent performance rationale ("Angular compiler is unable to skip the type check ... deep, whole-program type analysis ... exponentially more expensive as applications grow") directly corroborates PROJECT.md's separability premise. Cite it alongside Brandon Roberts' numbers as a second, vendor-sourced justification. (Source: article line 45.)

3. **[strategy]** Frame Oxc as **complementary** (per-file emit, no type-check) vs angular-typechecker (whole-program no-emit type-check). Opposite halves of `ngc`; there is no competitive overlap to defend. Avoid any "vs Oxc" framing -- it's "Oxc for build speed, angular-typechecker for the decoupled correctness gate."

4. **[roadmap-signal -- threat is low]** Oxc Angular Compiler "will not be maintained"; its stated trajectory is absorption into Angular's _official_ compiler for TS _parsing_, not type-checking. No party is building a fast Rust type-checker. A faster Angular build that still needs a separable type-check raises demand for our tool, not lowers it. (Source: article line 124-128.)

5. **[interop]** The recommended companion workflow is orchestration-level, not in-process: Oxc/esbuild/fastCompile for dev+build (skips type-check) + a separate cacheable `angular-typecheck` Nx target over the same tsconfig for CI/agents. Document this explicitly as the "complete loop." No code coupling needed -- Oxc exposes no type-check/diagnostic hook.

6. **[interop -- shared-contract seam]** Both tools key off the project's `tsconfig` file set: Oxc uses it for "file discovery, not TypeScript compilation"; we use the same tsconfig as the whole-program type-check input. The tsconfig is the shared contract -- a natural, zero-friction integration point. (Source: `vite-plugin/index.ts:52-53`.)

7. **[interop -- library seam]** Oxc's `partial` mode emits Ivy `.d.ts` declarations specifically "for template type-checking by consumers." angular-typechecker run on a consuming app is the tool that exercises those declarations during whole-program template type-check -- the two halves compose for the buildable/publishable-library story already in our scope. (Source: `napi/.../src/lib.rs:364-375`, `crates/.../src/dts.rs:5`.)

8. **[roadmap-signal -- architecture contrast worth stating]** Oxc is single-file by design and explicitly drops cross-file optimizations; angular-typechecker's whole-program (`performCompilation`) approach is the deliberate inverse and is exactly what surfaces cross-file template/type errors a per-file compiler cannot see. This is a defensible technical differentiator, not just a positioning slogan. (Source: article DANGER box + core crate scope.)

9. **[roadmap-signal -- API shape reference]** If we ever expose a programmatic API (post-v0.0.1), Oxc's NAPI shape is a useful reference: stateless `transform(source, filename, options) -> { code, map, diagnostics }` async tasks, version-conditional behavior via an explicit `angularVersion`, and diagnostics returned as structured error objects rather than thrown. We already return `{ success }` from the executor; a future structured-diagnostics return value could mirror this.

---

## Open questions / threats

- **Will Angular fold Oxc's speed into the official compiler AND keep the type-check coupled?** If Angular's official build gets dramatically faster via Oxc TS parsing but the type-check stays coupled-and-slow, our value holds. If Angular ever ships a _fast, decoupled, cacheable_ whole-program type-check target itself, that would be the real threat -- but nothing in this prior art suggests that; the Oxc work is about parsing/emit speed, not a faster checker.
- **Does any consumer actually run a separate type-check today when using Oxc?** The repo provides the `.d.ts` seam but ships no companion type-check tool and is unmaintained -- so the "run the type-check elsewhere" step is currently an unfilled gap in their story. That gap is our opportunity, but also means there's no established pattern users already follow; we may need to evangelize the two-step workflow.
- **Tarball/peer reality check:** Oxc's plugin pins Angular as a _devDependency_ at `^22.0.0-rc.2` (`napi/angular-compiler/package.json`) and uses TS 6.0.3 / Vitest 4.1.9 -- same locked window as ours -- which de-risks our Angular 22 / TS 6 target assumptions but is not itself prior art for our packaging (they ship ESM + a Vite plugin, we ship a CJS Nx executor).
- **AI-assisted compiler dev angle:** out of scope for us; noted only that the entire compiler was built in ~2 months via Claude Code + Codex orchestrator/subagent loops against a strict 1:1 conformance/compare test harness -- irrelevant to our type-checker design.
