# Project Research Summary

**Project:** angular-typechecker -- milestone v0.2.2 (Standalone CLI)
**Domain:** A third thin `bin` adapter over an existing framework-agnostic `runTypecheck` core (Nx executor + Angular CLI builder are the first two adapters)
**Researched:** 2026-07-16
**Confidence:** HIGH

## Executive Summary

v0.2.2 adds a standalone `angular-typechecker` / `atc` command-line binary that runs the SAME complete Angular type-check (TypeScript + template + extended NG8xxx, no emit) as the shipped Nx executor and Angular CLI builder -- a third thin adapter, never a re-implementation. All four researchers converged independently: the entire feature is glue over already-built core functions (`runTypecheck`, `evaluateResult`, `renderReport`, `toExitCode`) plus Node stdlib, and it finally gives the dead `toExitCode` scaffold (reserved since v0.0.3 COR-04) its first live consumer -- the literal OS exit code `2` for infrastructure errors. This is an ADDITIVE patch bump (`0.2.1 -> 0.2.2`); no breaking changes to any public API, executor id, builder, or generator schema.

The recommended approach is deliberately lean: **zero new runtime or dev dependencies** (Node's `util.parseArgs` covers the whole 7-flag surface), a **nx-free CLI boundary** (import only pure-core modules, never `@nx/devkit`/`nx` -- the 24-06 yarn-4 chalk-crash lesson made mechanical), and a **pure `run(argv, env)` core + a 10-line `bin.ts` shell** so the exit-code logic is unit-testable without spawning a process. One small internal extraction is required: the five advisory `warn*` helpers move out of `executor.ts` into `core/emit-advisory-notices.ts` behind a minimal structural `Logger` interface, so both the Nx logger and a CLI console logger can be injected. That extraction is additive/internal (no public API change) and de-risks the whole milestone by proving the shared seam against the unchanged Nx adapter first.

The risk profile is narrow but sharp. The single highest-value correctness pitfall (flagged by all four researchers) is **exit-code wiring**: a naive `process.exit(toExitCode(result))` reads a `coverage-incomplete` or `warnings-exceeded` run (both `errorCount === 0`, both `success === false`) as exit 0 -- a silent false pass that violates the project's governing charter. The correct wiring is a two-step compose: `toExitCode` owns only the literal `2` in the infra catch; the completed-run 0-vs-1 split MUST come from `evaluateResult(result).success`. The remaining risks are all cross-platform packaging (CRLF shebang, `ERR_REQUIRE_ESM` downlevel, Windows path normalization, `bin` surviving to the published artifact) plus one supply-chain hazard: `atc` is a real published npm package (`atc@0.0.6`), so docs must steer users to `npx angular-typechecker`, never `npx atc`.

## Key Findings

### Recommended Stack

The headline finding across STACK.md is **zero additions**. The CLI is delivered entirely with `node:util` `parseArgs` (stable on every supported runtime), a two-key `bin` object in the existing `package.json` both pointing at one compiled `./src/cli/bin.js`, a `#!/usr/bin/env node` shebang authored in source (native `tsc` preserves it verbatim), and the already-recommended `publint` as the tarball bin audit. The build target, `files` whitelist, and `module: nodenext` bridge all cover the new files with no config change beyond adding the `bin` field.

**Core technologies (all already present):**
- `node:util` `parseArgs` -- parses the full flag set (`multiple: true` for repeatable `-p`, `short` aliases, `strict` throws on unknown flags) -- stdlib, ladder rung 3, no dependency.
- `@nx/js:tsc` build (unchanged) -- compiles `src/cli/**/*.ts` automatically via the existing `src/**/*.ts` include; preserves the source shebang into emit.
- The pure core (`runTypecheck` / `evaluateResult` / `renderReport` / `toExitCode`) -- the CLI's only non-stdlib imports; verified nx-free by grep.
- `publint` (dev audit only) -- its `bin` rule validates the shebang against the actual packed tarball; not added to `dependencies`.

Explicitly rejected: any arg parser (`commander`/`yargs`/`minimist`/`meow`/`cac`/`arg`), any color library (coloring already lives in `renderReport`), any bundler (`esbuild`/`ncc`/`pkg`), and a build-time `chmod` (npm sets `+x` at install).

### Expected Features

FEATURES.md frames the CLI's PRODUCT as its exit code + human output. Every flag traces to an existing `CoreOptions` field or adapter knob -- there is no new engine behavior to build, only UX surfacing. ESLint is the model for the exit-code contract (0/1/2 with a distinct usage/infra 2); tsc/ngc are the model for the `-p` input handle.

**Must have (table stakes):**
- `-p` / `--tsConfig` input by path, repeatable (single `-p` -> string WALK path; 2+ -> `string[]` union) -- tsc/ngc muscle memory; no input, no tool.
- Literal exit code 0 / 1 / 2 -- the entire product for CI + agents.
- Human diagnostics output (TS + template + NG8xxx codeframes) to stdout via `renderReport`.
- `--help` / `-h` and `--version` / `-v` (both exit 0).
- `--max-warnings <n>` (ESLint-parity gate), `--strict`, `--include-deps`, `--fail-fast` (all executor-parity, trivial maps).
- Color auto-detect (`NO_COLOR` / `FORCE_COLOR` / TTY) feeding the existing `formatReport`.
- Advisory notices routed to stderr (never corrupt stdout codeframes) via an injected console logger.
- Two `bin` names + cross-platform shebang.

**Should have (differentiators, already built -- just surfaced):**
- Complete Angular check in one no-emit pass (no ngc phase short-circuit).
- Repeatable `-p` unioning multiple leaf tsconfigs in ONE run.
- `--strict` coverage gate (never a silent false pass) -- unique to this tool's charter.
- Distinct exit `2` for infra/usage vs `1` for "your code has errors" -- lets agents tell "could not run" from "types wrong".

**Defer (out of scope, carried forward):**
- JSON / SARIF `--format` reporters (needs a committed schema).
- `--watch` (needs the deferred `NgtscProgram` incremental engine).
- Config-file discovery / implicit tsconfig / glob input (conflicts with the D-04 "no cwd" whole-program engine contract).
- `--fix` / autofix (nonsensical for a type-checker -- never build).
- `--quiet`, explicit `--color`/`--no-color`, `--project` alias (post-validation nice-to-haves).

### Architecture Approach

ARCHITECTURE.md confirms the CLI is a third adapter composing the same core as the other two: `runTypecheck -> emitAdvisoryNotices -> renderReport -> evaluateResult -> verdict`. Nothing in `core/` changes except one NEW pure module. The bin is nx-free by construction -- its entire `require()` graph reaches only `core/**`, which is already lint-guarded against `nx`/`@nx/*`/`@angular-devkit/*`. The exit-code axis is split exactly as the code intends: `toExitCode(error)` owns the literal `2` (infra) in the catch; `evaluateResult(result).success` owns 0 vs 1 on a completed run.

**Major components:**
1. `core/emit-advisory-notices.ts` (NEW, extract) -- the five `warn*` helpers moved out of `executor.ts`, taking an injected structural `Logger` (`info`/`warn`/`error`). Pure: no nx, no console, no process. Both adapters inject their own logger; `executor.ts` becomes a one-line swap (MODIFIED, internal only).
2. `src/cli/main.ts` (NEW) -- pure `run(argv, env?): Promise<{exitCode, stdout, stderr}>`; parse -> resolve paths -> `runTypecheck` -> notices (into a buffering logger) -> `renderReport` -> `evaluateResult` -> exit code. Never calls `process.exit`, never writes a stream -> fully unit-testable.
3. `src/cli/parse-args.ts` + `src/cli/console-logger.ts` (NEW) -- `parseArgs` wrapper returning typed `CliOptions | help | version | usageError`; a `Logger` over `console.error` routing everything to stderr.
4. `src/cli/bin.ts` (NEW) -- shebang + `run(...).then(write + exit).catch(exit 2)`. The ONLY tier that touches `process.exit` / streams; untested by unit tests (covered by the tarball e2e). No top-level `await` (CJS forbids it -- the `await import()` bridge lives inside `run`'s async body).
5. `package.json` `bin` (two names -> one `bin.js`) + a new `eslint.config.mjs` `src/cli/**` import-ban block + `bin-static.spec.ts` (built `bin.js` starts with `#!` AND never `require()`s nx).

### Critical Pitfalls

1. **Exit code wired to `toExitCode`/`errorCount` alone (silent false pass)** -- the highest-value correctness pitfall, flagged by all four. `toExitCode` is verdict-blind (its own header comment says so). A `coverage-incomplete` / `warnings-exceeded` run has `errorCount === 0` but `success === false` -> naive wiring exits 0. **Avoid:** two-step compose -- caught `TypecheckInfrastructureError` (and usage errors) -> exit 2 via `toExitCode`; otherwise `evaluateResult(result, {maxWarnings, strict}).success ? 0 : 1`. Render the `outcome` label so a coverage-incomplete fail is not mistaken for a plain type error.

2. **CRLF corrupting the shebang** -- built on Windows arm64, run on Linux/macOS CI. A `#!/usr/bin/env node\r` fails with `env: node\r: No such file or directory` on POSIX only ("works on my machine"). **Avoid:** pin `"newLine": "lf"` in `tsconfig.lib.json`, add a `.gitattributes` LF rule for the bin source, and a tarball-audit byte-check that the packed `bin.js` first line ends in `\n` (no `\r`).

3. **The nx-transitive-import crash class (24-06) reaching the CLI** -- importing the executor/builder (or widening the barrel) drags `@nx/devkit` -> `chalk`/`ora`/`log-symbols`, which crashed under yarn 4 and taxes cold start. **Avoid:** import ONLY pure-core modules + inject a console logger; enforce with a `src/cli/**` ESLint import-ban and a module-graph probe (`require.cache` has no `@nx/*`/`nx/`) in the e2e.

4. **`await import()` downleveled to `require()` in the bin build (`ERR_REQUIRE_ESM`)** -- a bespoke `module: commonjs` bin tsconfig would downlevel the ESM bridge to `@angular/compiler-cli` and throw at first real type-check. **Avoid:** the bin compiles under the SAME `tsconfig.lib.json` (`module: nodenext`); no separate bin tsconfig; e2e asserts output never matches `/ERR_REQUIRE_ESM/`.

5. **`npx atc` fetches the foreign `atc@0.0.6` package** -- `atc` is real on the registry. The "collision risk is nil" note holds ONLY for LOCAL resolution (installed `.bin/atc` shadows); uninstalled `npx atc` fetches + executes arbitrary code. **Avoid:** canonical invocation in README/`--help` is `npx angular-typechecker`; document `atc` only as a post-install PATH shorthand.

6. **`process.exit()` truncating buffered stdout in CI (flush race)** -- `process.exit` after a large `formatDiagnostics` dump can terminate before the piped buffer flushes -> intermittent `toContain('TS2322')` flake + real users losing tail diagnostics. **Avoid:** prefer `process.exitCode = code` + return, or exit on the write `drain` callback; never `process.exit` right after an async write.

(Also material, lower tier: Windows path normalization via `realpathSync.native` before calling the core (Pitfall 7); `bin`/shebang surviving to the PUBLISHED artifact -- the 0.1.1 `packageRoot` precedent (Pitfall 8); parse/usage errors mapped to exit 2 not 1 (Pitfall 9).)

## Implications for Roadmap

The four researchers independently produced the SAME build order. It is dependency-driven (the shared seam de-risks everything downstream) and maps cleanly onto the pitfall-prevention phases. Suggested phase structure:

### Phase 1: Extract the advisory-notice seam
**Rationale:** De-risk first. Extracting the five `warn*` helpers into `core/emit-advisory-notices.ts` behind an injected `Logger`, then swapping `executor.ts` to `emitAdvisoryNotices(result, logger)`, proves the seam serves the unchanged Nx adapter (all existing executor/builder tests stay green) BEFORE any CLI code depends on it. It also avoids the "two drifting copies of the coverage-incomplete message" tech-debt the charter forbids.
**Delivers:** `core/emit-advisory-notices.ts` + spec (NEW, pure); `executor.ts` one-line swap (MODIFIED, internal/additive).
**Addresses:** Advisory notices to stderr (table stakes) via a reusable seam.
**Avoids:** Pitfall 3 (the CLI would otherwise be tempted to import `executor.ts` and pull nx).

### Phase 2: Pure CLI core + exit-code wiring
**Rationale:** All the load-bearing correctness lives here, in code that is unit-testable with no process side effects. Build `parse-args.ts` + `main.ts` (`run(argv, env)`) + `console-logger.ts`, and wire the two-step exit-code compose.
**Delivers:** `src/cli/{parse-args,main,console-logger}.ts` + specs asserting `{exitCode, stdout, stderr}`; `toExitCode` gets its first live consumer (infra=2), `evaluateResult` owns 0/1.
**Uses:** `node:util` `parseArgs`, `node:path` resolution against cwd (nx-free equivalent of `joinPathFragments`, POSIX-normalized), the pure core.
**Implements:** the pure `run()` + thin-bin architecture; the nx-free import boundary.
**Avoids:** Pitfall 1 (exit-code compose -- the milestone's whole point), Pitfall 6 (`process.exitCode` over abrupt `process.exit`), Pitfall 7 (`realpathSync.native` path normalization on input), Pitfall 9 (wrap `parseArgs`, usage errors -> exit 2).

### Phase 3: Bin shell + cross-platform packaging
**Rationale:** With `run()` correct and tested, wrap it in the impure shell and make the artifact ship correctly across OSes.
**Delivers:** `src/cli/bin.ts` (shebang + `.then/.catch`), `package.json` `bin` (two names -> one `bin.js`), `tsconfig.lib.json` `newLine: lf`, `.gitattributes` LF rule, the `src/cli/**` ESLint import-ban block, and `bin-static.spec.ts` (built `bin.js` starts with `#!` and never `require()`s nx -- model on `gate-a-static.spec.ts`).
**Avoids:** Pitfall 2 (CRLF shebang), Pitfall 4 (share `module: nodenext`), Pitfall 8 (`bin` -> compiled `./src/cli/bin.js`, survives the build include and the published manifest), Pitfall 3 (import-ban lint).

### Phase 4: CI-authoritative e2e + real-clone UAT
**Rationale:** The literal 0/1/2 exit codes -- especially exit 2 -- are net-new coverage the existing Nx/ng `{success}` (0/1) harness does not exercise. Prove them on the shipped tarball.
**Delivers:** a `createCliRun` helper (analogous to `createNgRun`: `execSync` try/catch -> `error.status`, `maxBuffer: 20MB`, `FORCE_COLOR=0`, never pipe) added to the existing `install-e2e` / `ng-cli-e2e` fixtures; CLI specs asserting literal 0/1/2 (coverage-incomplete + warnings-exceeded -> 1, bad/malformed `-p` -> 2, `--help` -> 0); the shebang exercised through the `.bin` shim on the Linux cell; a Windows bin smoke in the all-OS unit/smoke tier (heavy e2e is Linux-only). Plus manual real-clone UAT (URL+SHA, ACV-01 pattern).
**Addresses:** Verification charter (both a real Nx workspace and a real Angular CLI workspace).
**Avoids:** Pitfalls 6 (re-run for flake), 7 (Windows non-root-CWD + lowercase-drive cell), 8 (`.bin/*` link-and-run after install), 4 (assert no `ERR_REQUIRE_ESM`).

### Phase 5: Docs
**Rationale:** The `npx atc` supply-chain hazard lives here.
**Delivers:** README `## Standalone CLI` + the exit-code contract table (0 clean / 1 verdict-fail / 2 infra-or-usage); curated public CHANGELOG (end-user language, no internal ids). Canonical invocation `npx angular-typechecker`; `atc` documented only as an installed shorthand.
**Avoids:** Pitfall 5 (`npx atc` foreign fetch).

### Verification substrate (real, on-stack Angular 22)

- **Nx side:** `radix-ng/primitives` @ `4a7390a2...` (primary -- Angular 22.0.2 / TS 6.0.3, full leaf set; its `nx` is a beta but that is irrelevant to a nx-agnostic CLI) + `analogjs/analog` @ `04e32e2a...` (alt, stable `nx 23.0.1`, breadth).
- **Angular CLI side:** reuse `bluehalo/ngx-leaflet` @ `818e9ae5...` + `realworld-angular` @ `9e3528ff...` verbatim from v0.2.1.
- **Two-tier model:** CI-authoritative committed-fixture e2e (the `createCliRun` extension asserting literal 0/1/2) + manual real-clone UAT (planted-error RED / clean GREEN / bad-path -> 2). Windows/MSYS `tar`/pack uses `/d/...` paths, not `D:/...`.

### Phase Ordering Rationale

- **Extract-seam-first is a genuine dependency, not just prudence:** the CLI cannot render advisory notices without either importing `executor.ts` (pulls nx -> Pitfall 3) or duplicating five message helpers (drift risk). The shared seam resolves both, and validating it against the unchanged Nx adapter costs nothing extra.
- **Correctness (Phase 2) before packaging (Phase 3):** the exit-code compose is the milestone's reason to exist and is fully testable in-process; packaging is mechanical once `run()` is proven.
- **e2e after packaging** because the net-new coverage (exit 2, shebang through the `.bin` shim) can only be exercised against a real installed tarball.
- **Docs last** so the exit-code contract table matches the shipped behavior exactly.

### Research Flags

Phases likely needing deeper research during planning:
- **None.** Every deliverable is glue over already-built, already-tested core functions against a codebase the researchers read directly (all four HIGH confidence, grounded in the actual seams). Skip `--research-phase` for all suggested phases.

Two MEDIUM items to VERIFY DURING BUILD (assert, do not re-research):
- **Phase 3:** shebang preservation through `@nx/js:tsc` -- assert in `bin-static.spec.ts` against the BUILT `dist/.../bin.js`, not just source.
- **Phase 4:** Windows path-separator round-trip -- the `.replace(/\\/g, '/')` + `realpathSync.native` normalization is exercised on the Windows CI cell with a relative `-p` from a non-root CWD.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node 22 `parseArgs` API verified against docs; shebang preservation, `bin` shape, and nx-free core all confirmed by direct codebase grep. Zero-dependency conclusion is unambiguous. |
| Features | HIGH | Every flag mapped to an existing `CoreOptions` field / adapter knob read this session; exit-code contract grounded in ESLint/tsc/ngc prior art + the existing `toExitCode`/`evaluateResult` code. |
| Architecture | HIGH | Grounded in the actual seams (`run-typecheck.ts`, `exit-codes.ts`, `evaluate-result.ts`, `render-report.ts`, `executor.ts`, `eslint.config.mjs`). Two MEDIUM items are build-time assertions, not open design questions. |
| Pitfalls | HIGH | Codebase + npm registry + GitHub API verified 2026-07-16; the exit-code and CRLF traps are documented in the code's own comments and the repo's shipping history (0.1.1 `packageRoot`). |

**Overall confidence:** HIGH

### Gaps to Address

- **`--max-warnings` non-integer input:** `parseArgs` yields strings; `evaluateResult` already treats NaN/negative as unset (safe pass-through), but an explicit usage error (exit 2) on a non-integer is better UX. Decide during Phase 2 planning (naming/validation, not structural).
- **`--version` source:** read `require('../../package.json').version` from the compiled location (CJS JSON require works; the published layout keeps `package.json` two dirs above `src/cli/`). Assert against `package.json` in a test so it can't drift. Low risk, settle in Phase 2/3.
- **Long-form flag naming (`--tsConfig` vs `--project`):** PROJECT.md documents `--tsConfig` (executor-schema consistency); dominant prior art is `--project`. `-p` carries the ergonomics either way. Recommendation: keep `--tsConfig` primary, optionally register `--project` as a free alias. Do not agonize -- decide at Phase 2.

## Sources

### Primary (HIGH confidence)
- Local codebase read this session -- `core/{run-typecheck,exit-codes,evaluate-result,render-report,compiler-loader,load-typescript}.ts`, `executors/typecheck/{executor,normalize-options,schema.json}.ts`, `schematics/ng-add/schematic.ts`, `eslint.config.mjs`, `package.json`/`project.json`/`tsconfig.{json,lib.json}`, `src/index.ts` barrel. Confirms nx-free core, the verdict-blind `toExitCode` note, the CJS->ESM bridge under `module: nodenext`, the `files` whitelist, and no `bin` field today.
- Node 22 `util.parseArgs` API (nodejs.org) -- `type` is boolean|string only, `multiple`/`short`/`strict`/`allowPositionals` present; covers the full flag set with no dependency.
- ESLint CLI reference + exit-2 history (eslint.org, PR #10009); TypeScript `ExitStatus` enum + tsgo renumbering; `@angular/compiler-cli` `exitCodeFromResult` (warnings pass since PR #43673) -- the exit-code-contract prior art.
- npm registry (2026-07-16): `atc@0.0.6` exists (the `npx atc` foreign-fetch hazard); `angular-typechecker@0.2.1` current.
- GitHub API (2026-07-16): `radix-ng/primitives` @ `4a7390a2...` (nx 23.1.0-beta.1, Angular 22.0.2, TS 6.0.3, MIT); `analogjs/analog` @ `04e32e2a...` (nx 23.0.1, Angular ^22, TS ~6.0); `bluehalo/ngx-leaflet` + `realworld-angular` SHAs (reused from v0.2.1).
- `.planning/PROJECT.md` v0.2.2 charter + constraints; v0.2.1 phase-24 records (`24-ACV-01-UAT.md`, the 24-06 nx-free ng-add crash class).

### Secondary (MEDIUM confidence)
- publint rules (publint.dev) -- the `bin` shebang rule validates against the packed tarball via `npm-pack-list`.
- TypeScript shebang preservation (microsoft/TypeScript #10382, #45319) + `newLine` default hazard -- assert against the built `bin.js`.
- Node CLI mechanics (npm cmd-shim triple-file generation on Windows; `process.exit` stdout flush race on pipes) -- well-established, verify in e2e.

### Detailed research
- `.planning/research/v0.2.2-standalone-cli/STACK.md`
- `.planning/research/v0.2.2-standalone-cli/FEATURES.md`
- `.planning/research/v0.2.2-standalone-cli/ARCHITECTURE.md`
- `.planning/research/v0.2.2-standalone-cli/PITFALLS.md`

---
*Research completed: 2026-07-16*
*Ready for roadmap: yes*
