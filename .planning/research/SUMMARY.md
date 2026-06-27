# Project Research Summary

**Project:** angular-typechecker
**Domain:** Nx plugin (single executor) wrapping `@angular/compiler-cli` for complete Angular type-checking, authored + published to npm, 2026
**Researched:** 2026-06-27
**Confidence:** HIGH (stack/features/architecture); MEDIUM-HIGH (pitfalls)

> **How to read this file.** PROJECT.md already locks the core decisions (Nx 23 / Angular 22 / TS 6 / Node ranges / Vitest / CJS-executor-with-`await import()` / `performCompilation` all-getter engine / `nx release` / MIT). The four researchers were instructed NOT to re-derive those. Their job -- and this summary's job -- is to surface what the deep pre-research did NOT settle: **CORRECTIONS** (findings that contradict a locked decision and require a PROJECT.md edit) and **ADDITIONS** (new requirements/notes that refine a phase). The "CORRECTIONS & ADDITIONS vs PROJECT.md" section below is the headline deliverable for the roadmapper; the standard synthesis follows it.

---

## CORRECTIONS & ADDITIONS vs PROJECT.md

Ranked by impact. Each item is tagged `[CORRECTION]` (contradicts a locked decision -- PROJECT.md MUST change) or `[ADDITION]` (new requirement/note). "Apply where" routes the change to a PROJECT.md decision, a v0.0.1 requirement, or a specific phase.

| # | Tag | Finding | Apply where |
|---|-----|---------|-------------|
| 1 | **[CORRECTION]** | **Nx dependency classification is inverted.** PROJECT.md lists `nx`/`@nx/devkit` as `peerDependencies`. The official Nx publish-plugin recipe and both reference plugins say the opposite: ship **`@nx/devkit` as a pinned `dependency`** (`"23.0.1"`) and **do NOT declare `nx` at all** (devkit's own peer `nx: ">= 22 <= 24 || ^23.0.0-0"` carries it transitively). Only `@angular/compiler-cli` + `typescript` stay peers. This is also a **hard requirement for Nx community-registry listing**. | PROJECT.md Constraints ("Dependencies" line) + Key Decisions ("Peer deps" row); enforced in Packaging phase. |
| 2 | **[CORRECTION]** | **Test executor package changed.** Use `@nx/vitest:test` (Nx 22.2+ split Vitest into a dedicated `@nx/vitest` package; `@nx/vitest@23.0.1` verified, and nx-verdaccio carries the literal `migrate-vitest-to-vitest-package` migration). **Not** `@nx/vite:test`, which is legacy/migrated-away on Nx 23. | Dev tooling / test-infra phase; PROJECT.md test-runner note. |
| 3 | **[CORRECTION / REFINEMENT]** | **Build the executor with `module: node16` (or `nodenext`), NOT `commonjs`.** Under `module: commonjs` TypeScript downlevels `await import()` to `Promise.resolve().then(() => require(...))`, which hits `ERR_REQUIRE_ESM` against ESM-only compiler-cli at runtime -- defeating the entire dynamic-import design. Keep CJS *emit* (no `type: "module"` in package.json; file format follows nearest package.json). **Assert the compiled `.js` literally still contains `import(`** in CI. PROJECT.md says "CommonJS executor" without specifying the TS `module` setting -- this refines, not contradicts, but it is load-bearing. | Spike phase + Build/Packaging phase; add to the Module-format decision. |
| 4 | **[ADDITION]** | **Verify and normalize the diagnostic path base.** compiler-cli's `formatDiagnostics` emits paths relative to `process.cwd()`, but Nx runs executors from the **workspace root** (never project root; `process.cwd()` is unreliable, differs with/without the daemon). Use **absolute, realpath-normalized `fileName`** for filtering; emit **workspace-root-relative** paths (normalized to `/`) for GitHub Actions problem-matcher annotations. This is the single most common real-world failure of tsc-style tools in CI (GAP-1 in FEATURES). | New v0.0.1 requirement; Engine/filtering + Output phases + cross-OS CI. |
| 5 | **[ADDITION]** | **Project-boundary filtering must use the host's `getCanonicalFileName` + `realpath`,** not naive string-prefix comparison -- otherwise it breaks under pnpm symlinks (`.pnpm` realpaths) and case-insensitive filesystems (Windows/macOS). Add a **pnpm fixture** + a mixed-case path assertion to the matrix; npm/yarn hide this bug until a pnpm consumer hits it post-publish. | Engine/filtering phase; pnpm fixture in Validation/e2e phase. |
| 6 | **[ADDITION]** | **Dedicated "dependency-error-busts-cache" correctness test.** A cacheable whole-program check can restore a false-PASS from cache if inputs miss a transitive **non-buildable** dep's source. Cache inputs MUST include tsconfig include/exclude globs, the full `extends` chain, sibling `package.json`, `externalDependencies: ['typescript','@angular/compiler-cli']`, AND `^production`-style project-graph dep inputs. Verify directly: green run -> inject error in a source dep -> assert re-run does NOT cache-hit and reports the error. A type-checker that lies is worse than none. | Caching/inputs phase (dedicated correctness gate). |
| 7 | **[ADDITION]** | **Publish-fidelity hardening:** run **`publint`** + **`attw --pack`** against the *tarball* (not source); enable **`@nx/dependency-checks`** ESLint rule (scoped to the plugin's `package.json`); ensure **`executors.json` (+ each `schema.json` + compiled executor `.js`) is copied into dist** via the build target's `assets`; use **`nx release --first-release`** (with `--dry-run`) for the first publish and **`NPM_CONFIG_PROVENANCE=true` + `id-token: write`** for provenance. | Packaging/Publish phase + Install-matrix e2e. |
| 8 | **[ADDITION / ARCHITECTURE NUDGE]** | **Keep structured `ts.Diagnostic[]` at the gatherer boundary.** v0.0.1 ships only `formatDiagnostics` human text, but the deferred JSON/SARIF reporters are cheap ONLY if the gatherer returns a structured `CoreResult` (counts + raw diagnostics) and formatting happens at the edge -- not a re-parse of formatted strings. Costs nothing now; de-risks the deferred reporters. | Engine/reporting design (no v0.0.1 feature change). |

**Net effect on PROJECT.md:** items 1 and 3 require edits to locked decisions; item 2 corrects a tooling assumption; items 4-8 add requirements/tests/notes. Everything else in PROJECT.md is **confirmed** by the research (engine approach, feature set, module format intent, release mechanism, project-type coverage).

---

## Executive Summary

This is a **single-executor Nx plugin** that runs the *complete* Angular compiler diagnostic set (TypeScript + template type-check + extended NG8xxx) with no emit, decoupled from build and test. Experts build this exact shape three ways that all converge: a **framework-agnostic core** exposing one `runTypecheck(CoreOptions): Promise<CoreResult>` entry, with **thin adapters** (the Nx executor now; createNodesV2 / CLI / Angular builder later) that only translate inputs and outputs. The engine is modeled on `@angular/build`'s `AngularCompilation` (unconditional per-file all-getter via `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`), NOT `ngc`'s phase-fail-fast `defaultGatherDiagnostics` -- this is the core differentiator and is correctly captured in PROJECT.md.

The recommended approach is to **build and fully test the core engine before any Nx code exists** (the gating spike), then wrap it in a sub-50-line executor, then wire build/publish, then run the e2e tarball matrix. The supporting toolchain is `@nx/js:tsc` (native tsc, CJS `.js` + `.d.ts` -- never esbuild/swc, which bundle or skip type-checking), `@nx/vitest:test` (the dedicated Nx 23 package), `@nx/eslint` with `@nx/dependency-checks`, and `nx release` with conventional commits + provenance. **Feature research confirms v0.0.1 covers every table-stake with no gaps** -- the only feature item warranting a requirement is CI annotation path-format verification (CORRECTION/ADDITION #4).

The key risks are all **correctness traps that pass unit tests and fail in the real world**: (1) `module: commonjs` silently rewriting `await import()` to `require()` (the single highest-risk item -- breaks only against the real compiler post-build); (2) a stale Nx cache hiding real type errors (a lying type-checker erodes all trust); (3) path-filtering that breaks under pnpm symlinks / case-insensitive FS; and (4) packaging that omits `executors.json`/`schema.json` from the tarball so the installed plugin can't resolve its executor. Each is mitigated by testing the **build artifact / tarball**, not the source -- compiled-`.js`-contains-`import(` assertions, a dependency-error-busts-cache test, a pnpm fixture, and `npm pack` + `publint` + `attw --pack` gates.

## Key Findings

### Recommended Stack

The locked stack (Nx 23 / Angular 22 / TS 6 / Vitest / CJS executor) is confirmed against the npm registry (2026-06-27) and two real published plugins (`@push-based/nx-verdaccio`, `@analogjs/platform`). The one material correction is the **Nx dependency classification** (item #1): `@nx/devkit` is a pinned `dependency`, `nx` is declared by no one. See STACK.md for the full published-`package.json` / `executors.json` / `schema.json` / `tsconfig.lib.json` conventions and the `nx release` CI norms.

**Core technologies:**
- `@nx/devkit@23.0.1` (pinned **dependency**, not peer) -- plugin authoring API; its peer carries the consumer's `nx`.
- `@nx/js:tsc@23.0.1` -- the build executor; native tsc emits CJS `.js` + `.d.ts` per-file (esbuild/swc are wrong: bundle / skip type-checking).
- `@nx/vitest:test@23.0.1` + `vitest@4.x` -- the dedicated Nx 23 Vitest executor (NOT `@nx/vite:test`).
- `@nx/eslint@23.0.1` with `@nx/dependency-checks` -- mandatory dependency linter for a publishable plugin.
- `@angular/compiler-cli@22.0.4` + `typescript@6.0.3` -- the type-check engine (ESM, `await import()`) and compiler; **stay peers**.
- `nx release` (conventional commits, `--first-release`, provenance) -- publish.

### Expected Features

FEATURES.md verdict: **v0.0.1 maps 1:1 onto every table-stake for a type-checking executor; nothing is missing.** The genuine differentiators are also in scope.

**Must have (table stakes -- all in v0.0.1):**
- Required `tsConfig` option + full `extends`/`include`/`exclude` resolution.
- Report-all default + opt-in fail-fast; exit-code via Nx `{ success }`.
- Complete unconditional diagnostics (TS + template + extended NG8xxx).
- Dependency boundary (exclude out-of-project/node_modules) + opt-in `includeDeps`.
- `--max-warnings=<n>` ESLint-style gate; project-configured severities respected.
- `formatDiagnostics` human output; Nx-cacheable target (`cache:true`, `outputs:[]`).
- Validated across all five project types; `run-many`/`affected` free (inherited).

**Should have (differentiators -- in v0.0.1):**
- Complete diagnostics in ONE pass (no `ngc` phase short-circuit) -- the headline.
- Decoupled from build AND test; Nx-native, project-graph-integrated, cacheable.
- Spec-tsconfig type-check decoupled from running tests (nothing else does this for Angular).

**Defer (v0.x / v1+):** JSON + SARIF reporters, `createNodesV2` inferred targets (+ `nx add`/`ng add`), incremental (`NgtscProgram`) + `--watch`, standalone CLI binary. (All already deferred in PROJECT.md.)

### Architecture Approach

A single published package with a **framework-agnostic `src/core/`** (zero `@nx/devkit`/yargs/architect imports) behind one `runTypecheck` entry, plus **thin adapters** in `src/executors/` (now) and reserved-empty `src/plugin/`, `src/cli/`, `src/builders/` (deferred). `src/internal/` holds adapter-only glue (ExecutorContext path extraction, exit-code mapping). Tests colocate as `*.unit.test.ts` (mock compiler-cli) / `*.int.test.ts` (real compiler vs fixtures); a sibling `testing/test-nx-utils` quarantines the nx-internal `FsTree`/`flushChanges` import in one eslint-disabled file; `fixtures/` holds the committed v13->v22 diagnostic catalog; `e2e/` holds one representative workspace covering all five project types.

**Major components:**
1. **Core `runTypecheck`** -- orchestrates resolve -> gather -> filter -> report; the one function every adapter calls.
2. **Gatherer** -- unconditional per-file all-getter with a `DiagnosticModes` bitflag (models `@angular/build`); returns structured `ts.Diagnostic[]`.
3. **Compiler loader** -- memoized `await import('@angular/compiler-cli')` / `typescript` (the CJS->ESM bridge; the only dynamic-import site).
4. **Nx executor adapter** -- `normalize-options.ts` (ExecutorContext -> CoreOptions) + sub-50-line `executor.ts` + `schema.json`/`schema.d.ts`.

### Critical Pitfalls

1. **`module: commonjs` rewrites `await import()` -> `require()`** -- use `module: node16`/`nodenext`, keep CJS emit, assert compiled `.js` contains `import(`. Highest risk: passes unit tests, fails against the real compiler post-build.
2. **Stale Nx cache hides real errors (false PASS)** -- wire transitive non-buildable-dep source into inputs; dedicated dependency-error-busts-cache correctness test.
3. **Path filtering breaks under pnpm/case-insensitive FS** -- filter on absolute realpath-normalized `fileName` via host `getCanonicalFileName`+`realpath`; add a pnpm fixture.
4. **Tarball missing `executors.json`/`schema.json`/compiled `.js`** -- explicit `files` allowlist + asset-copy in the build target; verify with `npm pack` + `publint` + `attw --pack`, not source-tree audit.
5. **CWD-relative diagnostic paths + solution-style "0 files" false pass + strictTemplates-off silent empty check** -- normalize path base/separators; guard against a `references`-only tsconfig reporting "0 errors"; signal (don't force) when `strictTemplates` is off and mirror the consumer's configured severities.

## Implications for Roadmap

The research yields a near-deterministic phase order: **surface the riskiest unknown (the compiler engine) first, keep the package installable end-to-end as early as possible (Vertical MVP)**, and defer the slow/gating tarball matrix to the end. This mirrors ARCHITECTURE.md's "suggested build order" and PITFALLS.md's phase mapping.

### Phase 1: Engine spike + core skeleton
**Rationale:** Core has zero dependents and is the gated spike; everything else is cheap once it's right. Also where the highest-risk pitfall (`import()` rewrite) must be proven against the *real* compiler.
**Delivers:** `compiler-loader.ts`, `diagnostic-modes.ts`, `gather-diagnostics.ts`, `resolve-tsconfig.ts`, `runTypecheck` green against a couple of int fixtures; proof the compiled `.js` retains `import(`.
**Addresses:** complete-unconditional-diagnostics differentiator; tsConfig resolution table-stake.
**Avoids:** Pitfall 1 (`module: node16` + compiled-artifact test), Pitfall 7 (use `readConfiguration`, force `noEmit`).

### Phase 2: Filtering + reporting (completes CoreResult)
**Rationale:** Filtering and the human reporter complete the core contract before any adapter exists.
**Delivers:** deps-boundary filter (absolute realpath-normalized), `--max-warnings` counting (warning bucket), category gating, `formatDiagnostics` default output; **structured `CoreResult` preserved at the boundary** (addition #8).
**Avoids:** Pitfall 2/3 (absolute realpath filtering, host `getCanonicalFileName`), Pitfall 8 (mirror configured severities; signal strictTemplates-off).

### Phase 3: Test infrastructure + diagnostic catalog
**Rationale:** Phases 4+ assert against it; the v13->v22 catalog is itself a deliverable.
**Delivers:** `testing/test-nx-utils` (FsTree quarantine), `testing/test-fixtures` (load + error-injection), committed `fixtures/` catalog, `vitest.unit.config.ts` / `vitest.int.config.ts`. **Use `@nx/vitest:test`** (correction #2).
**Uses:** `@nx/vitest`, Vitest 4.x.

### Phase 4: Nx executor adapter
**Rationale:** First user-runnable surface; depends on core (1-2) + test utils (3).
**Delivers:** `schema.json` + `schema.d.ts`, `normalize-options.ts`, sub-50-line `executor.ts`, `executors.json`.
**Implements:** the thin-adapter pattern; cacheable target wiring begins here.
**Avoids:** Pitfall 4 (cache inputs include transitive dep source + dependency-error-busts-cache test -- addition #6).

### Phase 5: Build/publish wiring + one e2e smoke
**Rationale:** Proves the package installs and runs end-to-end (Vertical MVP).
**Delivers:** `project.json` build target (asset-copy of `executors.json`/`schema.json`), `package.json` `files`/deps/peers (**`@nx/devkit` as dependency, no `nx`** -- correction #1), `@nx/dependency-checks`, `nx release` config (`--first-release` + provenance), the representative five-project-type workspace, ONE smoke e2e, `publint` + `attw --pack` gates (addition #7).
**Uses:** `@nx/js:tsc`, `nx release`.
**Avoids:** Pitfall 5/6 (tarball-content + peer-range install gates).

### Phase 6: Full e2e matrix + CI
**Rationale:** Slow, gating, last. The tarball-install matrix is the backstop for packaging/peer-range/cross-OS bugs.
**Delivers:** tarball install matrix across all five project types **including a pnpm fixture** (addition #5); GitHub Actions Node 22/24/26 x Linux/Windows/macOS.
**Avoids:** Pitfall 2/3/6 (cross-OS path normalization, pnpm, ERESOLVE/EBADENGINE matrix).

### Phase Ordering Rationale

- **Dependency-driven:** core (no dependents) -> filtering/reporting (complete CoreResult) -> test infra (consumed by all later phases) -> executor (depends on core+tests) -> build/publish -> e2e matrix. Straight from ARCHITECTURE.md's build order.
- **Risk-first:** the `import()`-rewrite and engine-completeness unknowns are front-loaded into the gated spike (Phase 1); the slow tarball matrix is deferred to Phase 6.
- **Vertical-MVP:** the package is installable-and-runnable by Phase 5, before the full matrix -- one smoke e2e proves the seam early.
- **"Executor-first, createNodesV2-later"** is enforced by Nx's own rule ("only create dynamic targets using executors you own") -- confirms the deferral order.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase`):
- **Phase 1:** the `module: node16` + compiled-artifact assertion and the exact `@angular/build` gatherer modes are subtle; the spike is explicitly gated.
- **Phase 4/5 (caching):** the dependency-error-busts-cache contract has tracked Nx gaps (`namedInputs` not respected for source/inlined libs; `externalDependencies` over/under-invalidation) -- PITFALLS.md flags this for deeper research.
- **Phase 6:** pnpm-symlink + case-insensitive filtering and the peer-range pre-release matrix have MEDIUM-confidence sources.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 2 (reporting):** `formatDiagnostics` + `--max-warnings` are well-trodden.
- **Phase 3 (test infra):** nx-verdaccio is a verbatim live reference for the FsTree quarantine and vitest config split.
- **Phase 4 (executor scaffold):** `executors.json`/`schema.json`/thin-adapter conventions are documented + dual-referenced.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry 2026-06-27; conventions cross-checked against official Nx docs + two real published plugins. The one correction (devkit-as-dependency) is HIGH (official recipe + registry criteria + both reference plugins agree). |
| Features | HIGH | Mapped against tsc/ngc/`@nx/js`/type-coverage/ESLint/svelte-check/vue-tsc; verdict (no missing table-stake) is well-supported. |
| Architecture | HIGH | Grounded in three live reference codebases on disk (nx-verdaccio, `@angular/build`, analog) + Nx 23 extending-nx docs. |
| Pitfalls | MEDIUM-HIGH | Most verified against official docs + tracked GitHub issues; the cache-correctness and pnpm/case-sensitivity items lean on MEDIUM-confidence issue threads (flagged inline). |

**Overall confidence:** HIGH

### Gaps to Address

- **Cache correctness for non-buildable deps:** Nx has tracked gaps (`namedInputs` not honored for source/inlined libs; `externalDependencies` over/under-invalidation). Handle by treating the dependency-error-busts-cache test as a correctness gate in the caching phase and auditing computed inputs with `nx show project <p> --web`.
- **Diagnostic path base under an Nx executor:** must be empirically verified (compiler-cli formats CWD-relative; Nx runs at workspace root). Resolve early in the engine/filtering phase, not at CI-debug time.
- **pnpm + case-insensitive FS membership:** add a pnpm fixture and a mixed-case assertion to the matrix; the bug is invisible under npm/Linux.
- **Pre-release peer ranges:** if pre-release Angular/Nx (`-next`/`-rc`) is to be supported, ranges must be pre-release-inclusive (`>=22.0.0-0`) or documented as `--legacy-peer-deps`; validate with an install matrix.

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org`) dist-tags + version manifests, 2026-06-27 -- `nx`/`@nx/devkit`/`@nx/js`/`@nx/plugin`/`@nx/vitest`/`@nx/eslint` `latest = 23.0.1`; `typescript 6.0.3`; `@angular/compiler-cli 22.0.4`; `vitest 4.1.9`; verified devkit's `nx` peer and `@nx/plugin` pinned deps.
- Nx official docs -- `extending-nx/publish-plugin` (devkit-as-dependency, no `nx`, repo url + e2e + registry criteria), `local-executors`, `@nx/js:tsc`, `nx-release` (conventionalCommits, `--first-release`, provenance, `id-token`), `@nx/dependency-checks`, Inputs/Outputs caching.
- Live reference codebases on disk -- `push-based/nx-verdaccio` (Nx 22.3 published plugin: package.json, executors.json/schema.json, tsconfig layout, build asset-copy, FsTree quarantine, vitest split), `angular/angular-cli` `@angular/build` (`AngularCompilation` `DiagnosticModes`/`diagnoseFiles`/`collectDiagnostics`, memoized `loadCompilerCli`/`loadTypescript`, unconditional `getDiagnosticsForFile`), `analogjs/analog` (`@analogjs/platform` manifest: exports map, provenance, keywords; Angular 22 tsconfig base).
- TypeScript / Angular docs -- module `node16` leaves `import()` untransformed; `getCanonicalFileName`/`realpath` case-sensitivity; `preserveSymlinks`; Angular `strictTemplates`/`extendedDiagnostics`; `formatDiagnostics` paths relative to cwd (angular#19748).
- ESLint / type-coverage / svelte-check / GitHub Actions docs -- `--max-warnings`/exit codes, `--at-least`, `--output machine`/`--threshold`, problem matchers + SARIF support.

### Secondary (MEDIUM confidence)
- Tracked Nx GitHub issues -- `process.cwd()` differs with/without daemon (#9147), `externalDependencies` (#22277), cache-not-busted on lib change (#22265), `namedInputs` not respected for source libs (#32182), `--first-release` (#27887), dependency-checks pre-release mismatch (#30589).
- TypeScript/ts-node issues -- `import()` from CommonJS (#52775, ts-node#1290); pnpm symlinked node_modules structure.
- ESLint formatter-consolidation issues (#17524, #11255); vue-tsc thin-wrapper model; npm `files`/`.npmignore` behavior (#4928); ngtsc paths-vs-compiled-artifacts (angular-cli#28388).

### Tertiary (LOW confidence)
- None load-bearing. A handful of pitfall items (notably the source-lib cache-input edge cases) rest on community issue threads and warrant empirical verification during the caching phase rather than being taken as settled.

---
*Research completed: 2026-06-27*
*Ready for roadmap: yes*
