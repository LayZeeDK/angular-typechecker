# Feature Research

**Domain:** Standalone type-checking / static-analysis dev-tool (Nx `angular-typecheck` executor)
**Researched:** 2026-06-27
**Confidence:** HIGH

> Scope note: v0.0.1 decisions are LOCKED in PROJECT.md and are NOT re-derived here. This file maps the
> full feature landscape of comparable tools (tsc/ngc, `@nx/js:tsc`/`:typecheck`, type-coverage, ESLint,
> svelte-check, vue-tsc) to confirm v0.0.1 is not missing a table-stake. Every row is tagged:
> **[in v0.0.1]**, **[deferred per PROJECT.md]**, or **[GAP -- table-stake we may be missing]**.
> The GAP list is the headline output -- see "Verdict: GAP List" below.

## Comparable Tools Surveyed

| Tool | Role as a comparable | Key takeaway for us |
|------|----------------------|---------------------|
| `tsc --noEmit` | The bare TS type-check baseline; our engine wraps the same `ts.Program` | Sets the default-behavior expectation: report-all, exit 0/1, `--pretty`, `-p <tsconfig>` |
| `ngc` (`@angular/compiler-cli`) | The direct Angular analog; our engine is its all-getter superset | `formatDiagnostics`, `strictTemplates`+extended diagnostics, phase short-circuit we deliberately avoid |
| `@nx/js:tsc` / `@nx/js:typecheck` | The Nx-native peer; what Nx users reach for today | Sets Nx-executor conventions: `tsConfig` option, `cache:true`, `outputs:[]`, batch mode, inferred targets |
| `type-coverage` | Threshold-gated static analysis CLI | `--at-least <n>` threshold + `--cache` + `package.json` config; our `--max-warnings` is the analog |
| ESLint | The canonical lint CLI; defines reporter/exit-code/threshold norms | `--max-warnings`, `--format` ecosystem, exit 0/1/2, `--output-file` |
| `svelte-check` / `sv check` | Closest template-aware checker (TS + framework template diagnostics) | `--threshold`, `--output machine`, `--watch`, `--compiler-warnings code:behaviour`, `--tsconfig` |
| `vue-tsc` | Thin tsc wrapper for `.vue` template type-check | Inherits the ENTIRE tsc CLI surface -- the "wrap tsc, get everything free" model |

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = the tool feels broken or surprising.

| Feature | Why Expected | Complexity | Status / Notes |
|---------|--------------|------------|----------------|
| tsconfig selection (`tsConfig` / `-p`) | Every checker (tsc, ngc, type-coverage, svelte-check, `@nx/js`) takes an explicit project file | LOW | **[in v0.0.1]** Required `tsConfig` option, overridable per target. Matches `@nx/js:tsc`. |
| tsconfig resolution: `extends` chain + `include`/`exclude` honored | `ts.Program` honors them; users expect their config to mean what it says | LOW | **[in v0.0.1]** Engine uses real `parseJsonConfigFileHost`; inputs hash the `extends` chain. |
| Report-all-errors default (no fail-fast) | `tsc --noEmit` reports every error; agents/CI want the full list in one pass | LOW | **[in v0.0.1]** Full/report-all default; this is THE behavioral contract of a type-checker. |
| Complete diagnostic set (TS + template + extended NG8xxx) | An Angular checker that misses template errors is broken vs ngc/`@angular/build` | HIGH | **[in v0.0.1]** Core value. Models `@angular/build` (no phase short-circuit), superset of `ngc --noEmit`. |
| Exit code 0 = clean, non-zero = errors | Universal CI contract; tsc/eslint/type-coverage/svelte-check all do this | LOW | **[in v0.0.1]** Nx executor returns `{ success }` -> Nx maps to exit code. Errors fail. |
| Human-readable diagnostic output with code frames | tsc `--pretty`, ngc `formatDiagnostics`, svelte-check human output all render frames | MEDIUM | **[in v0.0.1]** Default = `@angular/compiler-cli` `formatDiagnostics` (renders NG codes + template codeframes). |
| Respect project-configured severities | `angularCompilerOptions.extendedDiagnostics` maps checks to error/warning/suppress; ignoring it would override user intent | MEDIUM | **[in v0.0.1]** "project-configured diagnostic categories respected" -- explicitly in scope. |
| Dependency boundary (don't drown user in node_modules / cross-project noise) | `tsc` reports lib errors unless `skipLibCheck`; users expect project-in-isolation feedback | MEDIUM | **[in v0.0.1]** Exclude out-of-project + node_modules by default; opt-in `includeDeps`. |
| Nx cacheable target (`cache:true`, correct inputs/outputs) | Any modern Nx executor that is not cacheable feels broken; `@nx/js` typecheck is cached | MEDIUM | **[in v0.0.1]** `cache:true`, `outputs:[]`, `@nx/js`-style per-tsconfig inputs + `externalDependencies`. |
| Works across all real project shapes (app/lib variants/spec) | A type-checker that only handles apps is incomplete in a monorepo | MEDIUM | **[in v0.0.1]** Validated across application, local/buildable/publishable lib, spec tsconfig. |
| Warning threshold gate (`--max-warnings`) | ESLint and type-coverage (`--at-least`) set the expectation that CI can fail on warnings | LOW | **[in v0.0.1]** `--max-warnings=<n>` (0 = fail on any warning). Only count-based prior art -- tsc/ngc have none. |
| Fail-fast / stop-at-first-error opt-in | `ngc`/`tsc` short-circuit by default; users used to that want the fast-fail option | LOW | **[in v0.0.1]** Opt-in fail-fast mode. |
| `run-many` / `affected` compatibility | Any Nx target is expected to compose with `nx affected -t` and `run-many` for free | LOW | **[in v0.0.1] (inherited)** Standard executor + correct inputs => works automatically. No extra code. |
| CI annotation surface via stable text output | Users wire `setup-node`'s bundled tsc problem matcher or a custom matcher to log output | LOW | **[in v0.0.1] (via output)** `formatDiagnostics` text is matcher-parseable; see GAP-1 caveat on path format. |

### Differentiators (Competitive Advantage)

Features that set the tool apart. Aligned with PROJECT.md Core Value.

| Feature | Value Proposition | Complexity | Status / Notes |
|---------|-------------------|------------|----------------|
| Complete diagnostics in one pass (no `ngc` phase short-circuit) | More complete than `ngc --noEmit` (which skips template+extended when an earlier phase errors) and decoupled from build/test | HIGH | **[in v0.0.1]** THE differentiator. Models `@angular/build`, not `ngc`. |
| Decoupled from build AND test execution | Fast static feedback for AI agents / headless CI; the "elsewhere" AnalogJS/Oxc/esbuild tell you to run | MEDIUM | **[in v0.0.1]** Core positioning -- no competitor offers this Nx-native. |
| Nx-native, project-graph-integrated, cacheable | First cacheable replacement for AnalogJS's manual `ngc -p tsconfig.app.json --noEmit` npm script | MEDIUM | **[in v0.0.1]** Differentiates from raw `ngc`/`vue-tsc`/`svelte-check` (none are Nx graph-aware). |
| Spec/unit-test tsconfig type-check decoupled from running tests | Type-check `tsconfig.spec.json` without a Vitest/Jest run -- nothing else does this for Angular | MEDIUM | **[in v0.0.1]** A target pointed at `tsconfig.spec.json`. Genuine differentiator. |
| Exact-diagnostic-code test assertions across v13->v22 catalog | Confidence the complete set actually fires; improves on priors' pass/fail-only tests | HIGH | **[in v0.0.1]** A quality differentiator (internal), not a user-facing feature. |
| `createNodesV2` inferred targets (zero-config) | `@nx/js`/`@nx/eslint` auto-infer targets; users expect not to hand-wire `project.json` | HIGH | **[deferred per PROJECT.md]** Next milestone. v0.0.1 = manual wiring documented. Strong differentiator when it lands. |
| Machine-readable reporters (JSON / SARIF) | SARIF -> GitHub code scanning Security tab; JSON -> custom CI tooling | MEDIUM | **[deferred per PROJECT.md]** ESLint/oxlint/svelte-check (`machine`) offer this. Deferred, not a v0.0.1 table-stake (see analysis). |
| Watch / incremental (`NgtscProgram` + `oldProgram` + affected files) | svelte-check/tsc/vue-tsc have `--watch`; faster re-checks | HIGH | **[deferred per PROJECT.md]** Editor's Angular Language Service already covers the live loop; CI/agent loop is single-shot. |
| Standalone CLI binary (non-Nx use) | Lets non-Nx Angular/AnalogJS users adopt it | MEDIUM | **[deferred per PROJECT.md]** vue-tsc/svelte-check/type-coverage are all standalone CLIs. Deferred. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for THIS tool. Documenting to prevent scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Emit / `--declaration` / build output | "It wraps the compiler, why not build?" | Conflates type-check with build; reintroduces the exact coupling the tool exists to remove; cache `outputs` become non-empty | Keep `noEmit`, `outputs:[]`. Use `@nx/js:tsc` / `@angular/build` for emit. |
| Auto-fix / codemods for diagnostics | ESLint `--fix` sets the expectation | Type errors and template diagnostics are not mechanically fixable safely; out of scope for a checker | Report only; pair with Angular schematics / `ng update` migrations for fixes. |
| Built-in `--watch` in the executor (v0.0.1) | tsc/svelte-check/vue-tsc have it | The Angular Language Service owns the live editor loop; a watch executor duplicates it and complicates the single-shot cache model; needs incremental engine first | Deferred to the `NgtscProgram` incremental milestone; use the editor for live feedback. |
| Per-rule enable/disable flags on the CLI (e.g. `--compiler-warnings code:error`) | svelte-check exposes this | Angular already owns this via `angularCompilerOptions.extendedDiagnostics` in tsconfig; a parallel CLI surface causes config drift and two sources of truth | Configure severities in tsconfig (respected by the engine); don't add CLI overrides. |
| Type-coverage percentage / `--at-least` metric | type-coverage popularized "% typed" | Different problem domain (measuring `any` usage), not "does it type-check"; whole-program count is the wrong granularity here | `--max-warnings` count gate covers the CI-fail need; coverage % is a separate tool. |
| Multiple tsconfigs per target invocation | "Check app + spec in one run" | Breaks the 1 target : 1 tsconfig : 1 cache-entry model; muddies inputs and per-project affected granularity | One target per tsconfig (app, lib, spec); compose with `run-many`/`affected`. |
| Bundling many reporter formats in core | ESLint shipped 12, now regrets it (issue #17524: removing all but stylish/json) | Maintenance burden; ESLint's own survey shows almost everyone uses the default | Ship ONE great default (`formatDiagnostics`); add JSON/SARIF later as the 1-2 that matter, not a zoo. |
| `skipLibCheck`-style global lib opt-out as a headline flag | tsc perf advice pushes it | It is a tsconfig option the user already controls; surfacing it as a tool flag invites masking real errors | Honor the user's tsconfig `skipLibCheck`; don't add a competing flag. |

## Feature Dependencies

```
[Complete diagnostic gatherer (all-getter, no short-circuit)]   <-- the engine
    +--requires--> [programmatic @angular/compiler-cli performCompilation]
    +--requires--> [tsConfig resolution: extends + include/exclude]
    '--enables---> [Dependency boundary filtering (exclude out-of-project)]

[Nx cacheable target]
    +--requires--> [correct per-tsconfig inputs (globs + extends + deps + externalDependencies)]
    '--enables---> [run-many / affected for free]   (no extra code)

[--max-warnings gate]
    +--requires--> [warning vs error categorization from engine + project severities]

[formatDiagnostics human output]   <-- v0.0.1 default
    '--enables---> [CI problem-matcher annotations]   (parses the text -- see GAP-1)

[Machine reporters: JSON / SARIF]   (deferred)
    +--requires--> [stable internal diagnostic model decoupled from formatDiagnostics text]
    '--enables---> [GitHub code scanning (SARIF), custom CI tooling (JSON)]

[Watch mode]   (deferred)
    '--requires--> [NgtscProgram incremental migration (oldProgram + OptimizeFor.SingleFile)]

[createNodesV2 inferred targets]   (deferred)
    '--enables---> [zero-config adoption]   -- independent of the engine
```

### Dependency Notes

- **Machine reporters require a stable internal diagnostic model.** v0.0.1 emits `formatDiagnostics` text. Adding JSON/SARIF later is cheaper if the gatherer already returns structured `ts.Diagnostic[]` (it does) rather than only formatted strings -- so keep the formatting step at the edge. This is an architecture nudge, not a v0.0.1 feature.
- **Watch requires the incremental engine.** v0.0.1's `performCompilation` builds a fresh program per run; watch is blocked on the `NgtscProgram` migration. Correct ordering: incremental first, then watch.
- **`run-many`/`affected` are free.** They are not features to build -- they fall out of being a well-formed cacheable executor with correct inputs. The only risk is incorrect inputs causing cache misses or stale hits; that is covered by the inputs requirement.

## MVP Definition

### Launch With (v0.0.1) -- all already in PROJECT.md

- [x] `tsConfig` option (required, per-target overridable) -- table-stake
- [x] Complete diagnostics: TS + template + extended (NG8xxx), unconditional all-getter -- core value
- [x] Report-all default + opt-in fail-fast -- table-stake behavior
- [x] Dependency boundary (exclude out-of-project/node_modules) + opt-in `includeDeps` -- table-stake
- [x] `--max-warnings=<n>` ESLint-style gate -- table-stake threshold control
- [x] `formatDiagnostics` human output (renders NG codes + codeframes) -- table-stake output
- [x] Exit-code semantics via Nx executor `{ success }` -- table-stake CI contract
- [x] Nx-cacheable target (`cache:true`, `outputs:[]`, correct inputs) -- table-stake for Nx
- [x] All five project types validated -- table-stake coverage

### Add After Validation (v0.x)

- [ ] **JSON reporter** -- trigger: first user/CI request for machine-readable output, or our own SARIF prerequisite
- [ ] **SARIF reporter** -- trigger: demand for GitHub code-scanning / Security-tab integration
- [ ] **`createNodesV2` inferred targets** -- trigger: adoption friction from manual `project.json` wiring (already next milestone)
- [ ] **`nx add` / `ng add` + config generator** -- trigger: ships alongside createNodesV2

### Future Consideration (v1+)

- [ ] **Incremental engine (`NgtscProgram` + `oldProgram`)** -- defer: TS 7 (Go port) may reshape the perf story; large effort
- [ ] **`--watch`** -- defer: blocked on incremental; editor Language Service already covers live loop
- [ ] **Standalone CLI binary** -- defer: until non-Nx demand is proven
- [ ] **Storybook `*.stories.ts` support / true Angular builder / Jest support** -- defer per PROJECT.md

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Complete diagnostics (all-getter) | HIGH | HIGH | P1 (in v0.0.1) |
| `tsConfig` option + resolution | HIGH | LOW | P1 (in v0.0.1) |
| Report-all + fail-fast modes | HIGH | LOW | P1 (in v0.0.1) |
| Dependency boundary + `includeDeps` | HIGH | MEDIUM | P1 (in v0.0.1) |
| `--max-warnings` gate | MEDIUM | LOW | P1 (in v0.0.1) |
| `formatDiagnostics` output + exit codes | HIGH | LOW | P1 (in v0.0.1) |
| Nx-cacheable target | HIGH | MEDIUM | P1 (in v0.0.1) |
| JSON reporter | MEDIUM | LOW | P2 (deferred) |
| SARIF reporter | MEDIUM | MEDIUM | P2 (deferred) |
| createNodesV2 inferred targets | HIGH | HIGH | P2 (next milestone) |
| Incremental + watch | MEDIUM | HIGH | P3 (deferred) |
| Standalone CLI | LOW-MEDIUM | MEDIUM | P3 (deferred) |

## Competitor Feature Analysis

| Feature | tsc `--noEmit` | ngc | `@nx/js:tsc`/`:typecheck` | type-coverage | ESLint | svelte-check | Our v0.0.1 |
|---------|----------------|-----|---------------------------|---------------|--------|--------------|------------|
| tsconfig selection | `-p` | `-p` | `tsConfig` opt | `-p` | (eslint config) | `--tsconfig` | **`tsConfig` (required)** |
| Report-all default | yes | phase short-circuit | yes | n/a | yes | yes | **yes (no short-circuit)** |
| Template/extended diagnostics | no | yes (gated by phase) | no | no | (angular-eslint, separate) | yes (svelte) | **yes, complete, unconditional** |
| Exit code 0/non-zero | 0/1 | 0/1 | 0/1 | 0/1 | 0/1/2 | 0/1 | **via Nx `{success}`** |
| Human output + codeframes | `--pretty` | `formatDiagnostics` | inherits tsc | summary table | `stylish` | human-verbose | **`formatDiagnostics`** |
| Warning threshold gate | none | none | none | `--at-least <n>` | `--max-warnings` | `--threshold` | **`--max-warnings` (ESLint-style)** |
| Fail-fast | (short-circuits) | (short-circuits) | n/a | n/a | n/a | n/a | **opt-in** |
| Dependency/scope boundary | `skipLibCheck` | `skipLibCheck` | project scope | `--ignore-files` | per-config | `--no-tsconfig` | **exclude out-of-project; `includeDeps`** |
| Caching | `.tsbuildinfo` | `.tsbuildinfo` | Nx cache + batch | `--cache` | `--cache` | none | **Nx cache (`cache:true`)** |
| Watch | `--watch` | `--watch` | (batch) | no | no | `--watch` | **deferred** |
| run-many/affected | n/a | n/a | yes (Nx) | n/a | yes (`@nx/eslint`) | n/a | **yes (free, inherited)** |
| Machine reporter (JSON/SARIF) | no | no | no | json/badge | json/sarif(pkg) | `--output machine` | **deferred** |
| Inferred/zero-config target | n/a | n/a | createNodesV2 | n/a | createNodesV2 | n/a | **deferred (next milestone)** |
| CI annotations | problem matcher (setup-node) | (tsc matcher) | (tsc matcher) | action | matcher/sarif | machine -> CI | **via text matcher (GAP-1)** |
| Output to file (`-o`) | redirect | redirect | redirect | `--reportSemanticError`... | `--output-file` | redirect | **stdout (redirect)** |

## Verdict: GAP List (table-stakes NOT currently in v0.0.1 scope)

This is the headline deliverable. After mapping every comparable tool's feature surface, the assessment is:

**v0.0.1 covers every TABLE-STAKE for a type-checking executor. No table-stake is missing.**

The locked feature set (required `tsConfig`, report-all + fail-fast, dependency boundary + `includeDeps`,
`--max-warnings`, `formatDiagnostics`, Nx-cacheable target, exit-code via `{success}`, five project types)
maps 1:1 onto the table-stakes column above. The genuine differentiators (complete unconditional
diagnostics, build/test decoupling, Nx-native caching, spec-tsconfig checking) are also in scope.

The following are the ONLY items that warrant a second look. None is a hard blocker; they are graded:

- **GAP-1 (NEEDS A DECISION, low cost): CI annotation path format.** The single most common real-world
  failure of tsc-style tools in CI is that diagnostic file paths are emitted relative to the PROJECT root,
  but GitHub Actions problem matchers (and `setup-node`'s bundled tsc matcher) require paths relative to the
  REPOSITORY root, or annotations silently do not render. `formatDiagnostics` paths originate from the
  `ts.Program` and are typically project-root-relative when an executor runs with `cwd` at the project.
  This is a documentation + possibly a small path-normalization concern, not a new feature. **Recommendation:**
  verify the path base of `formatDiagnostics` output under an Nx executor run, and either (a) emit
  workspace-root-relative paths, or (b) document the matcher/`awk`-prefix workaround. Cheap to address now;
  expensive to discover as a bug after release. This is the one item I would explicitly route into requirements.

- **GAP-2 (NOT a v0.0.1 gap, flagged for awareness): machine-readable reporter (JSON).** ESLint, oxlint,
  type-coverage, and svelte-check (`--output machine`) all ship a machine format, so a savvy CI user MIGHT
  expect one. However: (1) the human `formatDiagnostics` text is matcher-parseable today, (2) ESLint's own
  user survey shows almost nobody uses non-default formatters, and (3) JSON/SARIF are explicitly deferred in
  PROJECT.md. Verdict: **deferred is correct, NOT a table-stake.** Architecture nudge only: keep the
  structured `ts.Diagnostic[]` available at the gatherer boundary so the later JSON/SARIF reporter is a thin
  edge layer rather than a re-parse of formatted text.

- **GAP-3 (NOT a gap, confirmed free): `run-many` / `affected`.** Worth stating explicitly because it LOOKS
  like a feature: it is not. A well-formed cacheable executor with correct inputs composes with
  `nx run-many` and `nx affected -t angular-typecheck` automatically. The only failure mode is incorrect
  inputs (cache misses / stale hits), which the existing inputs requirement already covers. No work, but the
  test suite should include one `affected`/`run-many` smoke assertion to prevent a silent regression.

**Bottom line:** ship v0.0.1 as scoped. Add ONE requirement for GAP-1 (CI path-format verification +
docs/normalization). Treat GAP-2 as an architecture note (preserve structured diagnostics at the boundary)
and GAP-3 as a test-coverage note (one `affected` smoke test). Everything else is correctly a differentiator
or a deliberate deferral/anti-feature.

## Sources

- TypeScript tsc CLI Options -- https://www.typescriptlang.org/docs/handbook/compiler-options.html (HIGH)
- TypeScript TSConfig Reference (`extendedDiagnostics`, `listFiles`, `explainFiles`, `skipLibCheck`) -- https://www.typescriptlang.org/tsconfig/ (HIGH)
- Angular Template type checking (`strictTemplates`, `fullTemplateTypeCheck`) -- https://angular.dev/tools/cli/template-typecheck (HIGH)
- Angular Extended Diagnostics overview -- https://angular.dev/extended-diagnostics (HIGH)
- Angular compiler options reference -- https://angular.dev/reference/configs/angular-compiler-options (HIGH)
- Nx `@nx/js` Executors -- https://nx.dev/docs/technologies/typescript/executors (HIGH)
- Nx Enable TSC Batch Mode -- https://nx.dev/docs/technologies/typescript/guides/enable-tsc-batch-mode (HIGH)
- Nx Configure Inputs / Outputs for Task Caching -- https://nx.dev/recipes/running-tasks/configure-inputs , https://nx.dev/recipes/running-tasks/configure-outputs (HIGH)
- Nx run-many reference -- https://nx.dev/nx-api/nx/documents/run-many (HIGH)
- plantain-00/type-coverage (`--at-least`, `--strict`, `--ignore-files`, `--cache`, package.json config) -- https://github.com/plantain-00/type-coverage (HIGH)
- ESLint Formatters Reference -- https://eslint.org/docs/latest/use/formatters/ (HIGH)
- ESLint CLI Reference (`--max-warnings`, exit codes 0/1/2, `--output-file`) -- https://eslint.org/docs/latest/use/command-line-interface (HIGH)
- ESLint issue #17524 (consolidating to stylish/json) -- https://github.com/eslint/eslint/issues/17524 (MEDIUM)
- ESLint issue #11255 (SARIF as separate package) -- https://github.com/eslint/eslint/issues/11255 (MEDIUM)
- Svelte `sv check` / svelte-check options (`--threshold`, `--output machine`, `--watch`, `--compiler-warnings`, `--tsconfig`) -- https://svelte.dev/docs/cli/sv-check (HIGH)
- vue-tsc (thin tsc wrapper, inherits tsc CLI) -- https://www.npmjs.com/package/vue-tsc (MEDIUM)
- GitHub Actions problem matchers ADR -- https://github.com/actions/runner/blob/main/docs/adrs/0276-problem-matchers.md (HIGH)
- GitHub SARIF support for code scanning -- https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning (HIGH)
- actions/setup-node tsc problem matcher PR -- https://github.com/actions/setup-node/pull/9/files (MEDIUM)

---
*Feature research for: standalone Angular type-checking / Nx type-check executor*
*Researched: 2026-06-27*
