# Feature Research

**Domain:** Standalone type-check / linter CLI whose PRODUCT is its exit code + human output (a third thin adapter over the existing `runTypecheck` core)
**Researched:** 2026-07-16
**Confidence:** HIGH

## Scope note

This is a SUBSEQUENT-milestone (v0.2.2) feature study of ONLY the new standalone CLI's
user-facing surface. The engine, the boundary filter, the diagnostic set, the verdict
(`evaluateResult`), the exit-code policy (`toExitCode`), and the human renderer
(`formatReport`/`renderReport`) all already exist. The CLI adds NO engine behavior -- every
flag traces to an existing `CoreOptions` field or an existing adapter knob. The research
question is UX: which flags, which names/aliases/defaults, and which exit-code contract, all
grounded in named real-CLI prior art and mapped back to what is already built.

Prior art studied (all verified this session): `tsc --noEmit` (TypeScript 6, classic JS
compiler), `ngc` (`@angular/compiler-cli`), `eslint`, `vitest run`, `biome check`, and
`tsgo` (the `typescript-go` port). ESLint is the closest model for the exit-code contract
(0/1/2 with a distinct config/usage code); tsc/ngc are the closest model for the input flag
(`-p`/`--project`, `--noEmit`).

## The existing surface the CLI must mirror (no new behavior)

| CLI concern | Existing field / knob | Where it is consumed | Source file |
|-------------|-----------------------|----------------------|-------------|
| tsconfig path(s) | `CoreOptions.tsConfigPath: string \| string[]` (executor schema `tsConfig`) | `runTypecheck` | `core/run-typecheck.ts` |
| dependency boundary | `CoreOptions.includeDeps?: boolean` (default false) | `finalize`/`filterDiagnostics` | `core/run-typecheck.ts` |
| CI-path base | `CoreOptions.pathBase?: string` | `formatReport` only (ignored by engine) | `core/run-typecheck.ts` |
| warning gate | `maxWarnings?: number` | `evaluateResult` | `core/evaluate-result.ts` |
| coverage gate | `strict?: boolean` (default false) | `evaluateResult` | `core/evaluate-result.ts` |
| output brevity | `failFast: boolean` (default false) | `formatReport` (reporting only, NOT a gather short-circuit) | `core/format-report.ts` |
| color | `color: boolean` | `formatReport` (strips ANSI when false) | `core/format-report.ts` |
| clean/type/infra exit | `toExitCode()` -> 0/1/2 | (no live consumer yet -- reserved for the CLI, COR-04) | `core/exit-codes.ts` |
| pass/fail verdict | `evaluateResult()` -> `{ success, outcome }` | Nx executor reads `.success` | `core/evaluate-result.ts` |
| advisory notices | 5 `warn*(result)` helpers -> `logger.*` | Nx executor adapter | `executors/typecheck/executor.ts` |

The Nx executor (`normalize-options.ts` + `executor.ts`) is the exact template: normalize
args -> `runTypecheck` -> advisory `warn*` notices -> `renderReport` to raw stdout ->
`evaluateResult` -> map to a result. The CLI does the same, but maps to `process.exit` and
injects a console-based logger instead of `@nx/devkit`'s `logger` (per the 24-06 lesson: the
CLI path must never import `@nx/devkit`/`nx` at runtime).

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the CLI feel broken to anyone who has used `tsc`, `ngc`, or `eslint`.

| Feature | Why Expected | Complexity | Notes (prior art -> existing option) |
|---------|--------------|------------|--------------------------------------|
| `-p` / `--tsConfig` input by path, repeatable | Every type-check CLI takes a project/config path; `tsc -p`, `ngc -p` are muscle memory | LOW | tsc/ngc `-p`/`--project`. `util.parseArgs` `{ short: 'p', multiple: true }` -> `string[]` -> `CoreOptions.tsConfigPath` (array fans out to `handleMultiTsConfig`, ALREADY built). Single `-p` -> string path. |
| Literal exit code 0 / 1 / 2 | The CLI's entire PRODUCT for CI + agents | LOW | ESLint model (see contract below). Wires `evaluateResult().success` (0/1) + infra/usage (2). `toExitCode` already returns 0/1/2. |
| Human diagnostics output (TS + template + NG8xxx codeframes) | A type-check CLI must print what failed | LOW | Already built: `renderReport` -> `formatReport` (compiler-cli `formatDiagnostics`). Write to raw stdout (like the executor's `process.stdout.write`). |
| `--help` / `-h` | Universal CLI expectation; exits 0 | LOW | Hand-write usage text (parseArgs has no help generator). Include the exit-code legend. |
| `--version` / `-v` | Universal; exits 0 | LOW | tsc/ngc/eslint all use `-v`/`--version`. Read version from the package manifest. |
| `--max-warnings <n>` | ESLint-established warning gate; agents/CI expect it | LOW | ESLint `--max-warnings` (default -1 = disabled). Maps to `maxWarnings` -> `evaluateResult`. Omit => unset; `0` => fail any warning; negative/NaN => unset (already handled defensively). |
| Auto color on TTY + honor `NO_COLOR` | 2020s CLI baseline; broken pipes must not emit ANSI | LOW | Extends the executor's `process.stdout.isTTY` check. `color` boolean feeds existing `formatReport` (strips ANSI when false). No new rendering. |
| Advisory notices to stderr | Coverage-incomplete / skipped-ref / not-type-checked / bundler-query warnings must not be silent, and must not corrupt stdout codeframes | LOW | Port the 5 `warn*` helpers to a console logger writing to STDERR (report stays on stdout). Same fields, same messages; just a different `logger` sink. |
| Two `bin` names + cross-platform shebang | `angular-typechecker` (primary) + `atc` (alias), runnable via `npx`; must work on Windows | LOW | `#!/usr/bin/env node`; npm generates the `.cmd`/`.ps1` shim on Windows. Built `.js` under `module: nodenext` (same CJS->ESM `await import()` bridge). |

### Differentiators (Competitive Advantage)

These align with the Core Value and are things `tsc`/`ngc` alone do NOT give you.

| Feature | Value Proposition | Complexity | Notes (-> existing option) |
|---------|-------------------|------------|----------------------------|
| Complete Angular check in one no-emit pass (TS + template + extended NG8xxx) | `ngc --noEmit` short-circuits by phase and drops template/extended diagnostics behind an earlier error; this does not | NONE (already built) | The whole reason the tool exists. CLI just surfaces `runTypecheck`. |
| Repeatable `-p` unioning multiple leaf tsconfigs in ONE run | `tsc -p` checks exactly one project; checking app + lib + spec is 3 invocations. One `atc -p a -p b -p c` unions + dedupes | NONE (already built) | `handleMultiTsConfig` already does the union + single-finalize over the combined input set. |
| `--strict` coverage gate (never a silent false pass) | Fails when a first-party in-graph diagnostic was dropped by the boundary -- unique to this tool's charter; no other type-check CLI has this | LOW | Maps to `strict` -> `evaluateResult` (`coverage-incomplete` outcome). Already built and unit-tested. |
| Distinct exit `2` for infra/usage vs `1` for "your code has errors" | Lets agents/CI tell "I could not run" apart from "your types are wrong" -- `tsc` collapses nearly everything into `1` | LOW | ESLint parity. `toExitCode(TypecheckInfrastructureError) === 2` already; extend the same class to usage errors (bad flag, missing `-p`). |
| `--include-deps` boundary toggle | Opt into out-of-project + node_modules diagnostics; off by default keeps output focused | NONE (already built) | Maps to `includeDeps` -> `filterDiagnostics`. |
| `--fail-fast` output brevity | Truncate the report at the first error WITHOUT skipping any gather phase (unlike ngc's real short-circuit) | NONE (already built) | Maps to `failFast` -> `formatReport`. Reporting-only; all diagnostics still gathered. |
| Deterministic, idempotent output (`\n`, absolute-or-cwd-relative paths, sorted+deduped) | Agent- and diff-friendly; stable across Nx daemon vs cold run | NONE (already built) | `formatReport` forces `getNewLine: () => '\n'` and a non-identity canonical-file-name host; diagnostics pre-sorted/deduped. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `--watch` | tsc `-w`, vitest watch -- feels standard | The tool targets headless CI/agent loops; the editor's Angular Language Service already owns the live loop. Watch adds a long-lived process, incremental-program state (deferred `NgtscProgram`), and a whole new failure surface | Deferred (project Out of Scope). Re-run the fast cold check; incremental is a future `NgtscProgram` milestone. |
| Config-file discovery (implicit tsconfig from cwd) | `tsc`/`ngc` with no `-p` walk up from cwd; `eslint` auto-finds its config | The core REQUIRES an explicit absolute `tsConfigPath` and never reads `process.cwd()` (D-04). Discovery reintroduces solution-vs-leaf heuristics and cwd non-determinism the engine deliberately excludes | Require `-p`; error clearly (exit 2) when missing. The CLI resolves relative `-p` against cwd -- but only when EXPLICITLY given. |
| Glob / file-list input (`atc "src/**/*.ts"`) | ESLint takes file globs; feels natural | The engine is tsconfig-driven and whole-program; the input-set-membership boundary keys off declared rootNames. A loose file list fights that boundary and cannot express Angular's compilation unit | Deferred. Point `-p` at the tsconfig that declares the files. |
| JSON / SARIF `--format` reporters | Machine-readable output for dashboards/code-scanning | Real value, but a separate concern from the exit-code+human-output MVP; needs a stable schema commitment | Explicitly deferred to a future milestone (already project Out of Scope). Exit code + `formatDiagnostics` is the v0.2.2 product. |
| `--fix` / autofix | ESLint/Biome have it | A type-checker cannot mechanically fix type errors; nonsensical for this domain | Never build. |
| Dedicated CLI config file (`.atcrc`) | "Don't retype flags" | YAGNI for a 7-flag surface; another discovery+precedence surface to test | Never build (this milestone). Flags + npm scripts cover it. |
| `--quiet` (errors-only output) | ESLint has it | Overlaps `--fail-fast`; ESLint's `--quiet` + `--max-warnings` interaction is a known footgun (warn rules must still run) | Optional, low priority. `--fail-fast` already trims output. Defer unless requested. |
| Explicit `--color` / `--no-color` flags | Full color control | `NO_COLOR` + `FORCE_COLOR` + TTY auto-detect covers ~95% of cases with zero flag surface | Optional nice-to-have; add later if users ask. Honor env first. |

## The exit-code contract (the load-bearing deliverable)

Recommended contract -- the **ESLint 0/1/2 model**, which coincides exactly with the existing
`toExitCode` policy AND the `evaluateResult` verdict:

| Exit | Meaning | Trigger | Prior art |
|------|---------|---------|-----------|
| **0** | Clean -- the run fully checked and found nothing that fails the verdict | `evaluateResult(...).success === true` (`outcome: 'clean'`) | ESLint 0; tsc 0; ngc 0; vitest 0 |
| **1** | The check ran and the verdict FAILS -- type errors, warnings over `--max-warnings`, or coverage-incomplete | `evaluateResult(...).success === false` (`type-error` / `warnings-exceeded` / `coverage-incomplete`) with `errorCount` OR the coverage/warning gates tripped | ESLint 1 (errors OR warnings > max-warnings); ngc non-zero on errors; tsc 1 (`DiagnosticsPresent_OutputsSkipped`) |
| **2** | The tool could not run correctly -- infrastructure failure OR usage error | a caught `TypecheckInfrastructureError`, OR an argv/usage error (unknown flag, missing `-p`, non-numeric `--max-warnings`, empty `-p` set) | ESLint 2 ("configuration problem or internal error"); this tool's `toExitCode(TypecheckInfrastructureError) === 2` |

### CRITICAL wiring note (no new behavior, but the naive wiring is wrong)

`toExitCode` (as written) is **verdict-blind**: it returns `2` for infra, `1` for
`errorCount > 0`, else `0`. It deliberately does NOT know about `coverage-incomplete` or
`warnings-exceeded`, both of which have `errorCount === 0` but `success === false`. Its own
header comment says so explicitly: *"When the deferred standalone CLI lands it must map
`evaluateResult(...)`'s `success`/`outcome` to an exit code, NOT re-compute the verdict
here."*

So `process.exit(toExitCode(result))` alone would **wrongly exit 0** on a
`--max-warnings 0` run with a lone warning, or on a dropped-in-graph-warning
`coverage-incomplete` run. The correct adapter wiring (still zero new engine behavior) is:

```
try {
  result = await runTypecheck(coreOptions)      // infra throws
} catch (e) {
  if (e instanceof TypecheckInfrastructureError) process.exit(2)   // == toExitCode(e)
  throw e                                         // truly unexpected -> crash (non-zero)
}
warn*(result) -> stderr
write formatted report -> stdout
const { success } = evaluateResult(result, { maxWarnings, strict })
process.exit(success ? 0 : 1)
```

Usage/argv errors are caught BEFORE `runTypecheck` and exit `2` directly (ESLint parity:
usage joins the infra bucket, keeping `1` strictly "the check found something"). This
distinction is the differentiator agents care about most -- do not collapse usage errors
into `1`.

PROJECT.md's phrasing "wiring the pure `toExitCode` policy to `process.exit`" is
approximately right but should be read as: `toExitCode` owns the infra=2 branch; the 0-vs-1
split MUST come from `evaluateResult().success`. Flag this to the roadmap so a requirement
does not encode the naive (broken) wiring.

### `--max-warnings` -> exit mapping (ESLint parity, already implemented in `evaluateResult`)

- omitted => warnings never fail on their own (exit 0 with warnings present).
- `--max-warnings 0` => any warning fails (exit 1, `warnings-exceeded`).
- `--max-warnings N` => `warningCount > N` fails (exit 1).
- `-1` or negative or NaN => treated as unset (ESLint uses `-1` as the disable sentinel; `evaluateResult` already treats negative/NaN as unset -- free parity).
- Dropped in-graph warnings count toward the SAME `N` tolerance (`coverage-incomplete`), and `--strict` fails on ANY dropped in-graph warning regardless of `N`. Both already in `evaluateResult`.

## Recommended flag set (names + aliases + defaults)

| Flag | Alias | Type / default | Maps to | Prior art |
|------|-------|----------------|---------|-----------|
| `--tsConfig <path>` | `-p` | string, repeatable (`multiple: true`); REQUIRED | `CoreOptions.tsConfigPath` (string or string[]) | tsc/ngc `-p`/`--project` |
| `--max-warnings <n>` | -- | number, default unset | `maxWarnings` -> `evaluateResult` | eslint `--max-warnings` |
| `--fail-fast` | -- | boolean, default false | `failFast` -> `formatReport` (output brevity only) | (existing executor `failFast`) |
| `--include-deps` | -- | boolean, default false | `includeDeps` -> `filterDiagnostics` | (existing executor `includeDeps`) |
| `--strict` | -- | boolean, default false | `strict` -> `evaluateResult` | (existing executor `strict`) |
| `--help` | `-h` | boolean; prints usage, exit 0 | -- | universal |
| `--version` | `-v` | boolean; prints version, exit 0 | -- | tsc/ngc/eslint `-v` |

Defaults deliberately match the executor schema (`includeDeps:false`, `failFast:false`,
`strict:false`, `maxWarnings` unset) so the CLI and the Nx target behave identically for the
same inputs.

### Naming decision -- `-p` primary, long form choice

- **`-p` is the primary handle** (tsc/ngc muscle memory; strongest prior art for a type-check CLI). Non-negotiable.
- **Long form:** PROJECT.md documents `--tsConfig` (internal-consistency with the executor's `tsConfig` option). The dominant PRIOR ART is `--project` (tsc/ngc). Recommendation: keep `--tsConfig` as the documented primary per PROJECT.md, and OPTIONALLY register `--project` as an additional alias for tsc/ngc muscle memory -- `util.parseArgs` makes extra aliases free. Do not agonize; `-p` carries the ergonomics.
- **Casing:** boolean/number flags use kebab-case (`--max-warnings`, `--include-deps`, `--fail-fast`) per CLI convention and PROJECT.md; `--tsConfig` is the one camelCase outlier (mirrors the schema key). Acceptable given `-p` is the real handle.

### Color detection (extends existing `color` boolean; no new rendering)

Priority order (grounded in no-color.org / force-color.org, the widely-adopted standard):
1. `NO_COLOR` present (non-empty) => `color = false`.
2. `FORCE_COLOR` present (non-empty) => `color = true`.
3. else `color = process.stdout.isTTY === true` (the executor's existing rule).

The resulting boolean feeds the existing `formatReport` (`color:false` strips ANSI). Explicit
`--color`/`--no-color` flags are OPTIONAL (defer); env + TTY covers the common cases.

### Streams

- Formatted diagnostics report -> **stdout** (raw `write`, byte-clean codeframes for GitHub problem-matchers), mirroring the executor.
- Advisory `warn*` notices + the infra `logger.error` -> **stderr** (via the injected console logger), so they never corrupt stdout parsing.
- `--help`/`--version` -> stdout, exit 0.
- Usage errors -> stderr, exit 2.

### `pathBase` for the CLI

The executor sets `pathBase = context.root` for workspace-relative CI annotation paths. The
CLI has no workspace root -- recommend `pathBase = process.cwd()` (CI-annotation-friendly,
matches the executor's intent). This maps to the existing `CoreOptions.pathBase` (consumed
only by `formatReport`); no new behavior, no flag needed for v0.2.2.

## Feature Dependencies

```
[-p/--tsConfig input] ──required-by──> [everything] (no input, no run; exit 2)

[exit code 0/1/2]
    └──requires──> [evaluateResult().success]   (0 vs 1)
    └──requires──> [TypecheckInfrastructureError catch + usage-error catch]  (2)

[--max-warnings] ──feeds──> [evaluateResult] ──feeds──> [exit 1 (warnings-exceeded)]
[--strict]       ──feeds──> [evaluateResult] ──feeds──> [exit 1 (coverage-incomplete)]
[--include-deps] ──feeds──> [filterDiagnostics] ──changes──> [what diagnostics exist -> counts -> verdict]
[--fail-fast]    ──feeds──> [formatReport]  (output only; NEVER changes the verdict/exit)

[color] <──NO_COLOR / FORCE_COLOR / isTTY──  (env + TTY) ──feeds──> [formatReport]

[advisory notices -> stderr] ──requires──> [console logger injection]  (NOT @nx/devkit)
```

### Dependency Notes

- **Exit code requires `evaluateResult`, not `toExitCode` alone:** `toExitCode` is verdict-blind (see the CRITICAL note). The 0-vs-1 decision comes from `evaluateResult().success`; `toExitCode` owns the infra=2 branch. This is the single subtlest wiring in the milestone.
- **`--include-deps` indirectly moves the verdict:** it changes which diagnostics are counted, so it can flip an exit code -- but only through the existing filter, no new logic.
- **`--fail-fast` NEVER moves the verdict:** it only truncates the printed report; counts and exit are computed from the full set. Preserve this invariant (it is why the tool is more complete than `ngc`).
- **Advisory notices depend on a non-`@nx/devkit` logger:** the CLI must inject a console logger (stderr) rather than importing `@nx/devkit`'s `logger`, to keep startup lean and dodge the nx `chalk`-chain crash class (24-06 lesson).

## MVP Definition

### Launch With (v0.2.2)

Everything here is thin surfacing of already-built behavior -- there is no expensive feature
to defer WITHIN the CLI; the deferrals are whole out-of-scope families (below).

- [ ] `-p` / `--tsConfig` repeatable input -- no input, no tool.
- [ ] Exit code 0/1/2 via `evaluateResult().success` (+ infra/usage -> 2) -- the product.
- [ ] Human report (TS + template + NG8xxx) to stdout via `renderReport`.
- [ ] `--help` / `--version`.
- [ ] `--max-warnings` (ESLint-parity gate).
- [ ] `--include-deps`, `--strict`, `--fail-fast` (executor-parity knobs, trivial).
- [ ] Color auto-detect + `NO_COLOR`/`FORCE_COLOR`.
- [ ] Advisory notices to stderr via an injected console logger.
- [ ] Two `bin` names (`angular-typechecker`, `atc`) + cross-platform shebang.
- [ ] Args parsed with Node stdlib `util.parseArgs` (no new runtime dependency).

### Add After Validation (v0.2.x)

- [ ] `--quiet` (errors-only output) -- if users want less than `--fail-fast` gives.
- [ ] Explicit `--color` / `--no-color` flags -- if env+TTY proves insufficient.
- [ ] `--project` as an extra alias for tsc/ngc muscle memory.

### Future Consideration (v0.3+ / separate milestone)

- [ ] JSON / SARIF `--format` reporters -- needs a committed schema (already project Out of Scope).
- [ ] `--watch` -- needs the deferred `NgtscProgram` incremental engine.
- [ ] Config-file discovery / implicit tsconfig -- conflicts with the D-04 "no cwd" engine contract.
- [ ] Glob / file-list input -- conflicts with the tsconfig-driven whole-program boundary.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `-p`/`--tsConfig` repeatable input | HIGH | LOW | P1 |
| Exit 0/1/2 via evaluateResult + infra/usage=2 | HIGH | LOW | P1 |
| Human report to stdout | HIGH | LOW (exists) | P1 |
| `--help` / `--version` | HIGH | LOW | P1 |
| `--max-warnings` | HIGH | LOW (exists) | P1 |
| `--strict` | MEDIUM | LOW (exists) | P1 |
| `--include-deps` | MEDIUM | LOW (exists) | P1 |
| `--fail-fast` | MEDIUM | LOW (exists) | P1 |
| Color + NO_COLOR/FORCE_COLOR | MEDIUM | LOW | P1 |
| Advisory notices -> stderr | MEDIUM | LOW | P1 |
| Two bin names + shebang | HIGH | LOW | P1 |
| `--quiet` | LOW | LOW | P3 |
| explicit `--color`/`--no-color` | LOW | LOW | P3 |
| JSON/SARIF reporters | MEDIUM | HIGH | P3 (deferred) |
| `--watch` | LOW (editor owns live loop) | HIGH | P3 (deferred) |
| config discovery / glob input | LOW | MEDIUM | P3 (anti-feature) |

## Competitor Feature Analysis

| Feature | `tsc --noEmit` | `ngc` | `eslint` | `vitest run` | `biome check` | `tsgo` | Our CLI (`atc`) |
|---------|----------------|-------|----------|--------------|---------------|--------|-----------------|
| Input flag | `-p`/`--project` (one) | `-p`/`--project` (one) | globs / `-c` config | test globs | paths | `-p` (tsc-compat) | `-p`/`--tsConfig` (repeatable, unioned) |
| Config discovery | yes (cwd walk) | yes | yes (eslint.config) | yes | yes | yes | NO -- explicit `-p` only (D-04) |
| Exit 0 (clean) | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Exit on "found problems" | 1 | 1 (errors; warnings pass) | 1 (errors or warnings>max) | 1 | non-zero | 2 for noEmit-skipped (renumbered) | 1 |
| Distinct usage/infra code | no (mostly 1) | no | **2** (config/internal) | -- | -- | 3/4/5 (project/cycle/notimpl) | **2** (infra + usage) |
| `--max-warnings` | no | no | **yes** | no | `--max-diagnostics` | no | **yes** (evaluateResult) |
| Warnings fail build? | n/a | no (PR #43673) | only via `--max-warnings` | n/a | configurable | n/a | only via `--max-warnings`/`--strict` |
| Template + NG8xxx diagnostics | no | yes but phase-short-circuits | no | no | no | no | **yes, complete, no short-circuit** |
| Color: NO_COLOR / TTY | `--pretty`/TTY | via tsc | NO_COLOR + `--color` | yes | yes | TTY | NO_COLOR + FORCE_COLOR + TTY |
| `--watch` | yes | yes | no (native) | yes (default) | no | yes | NO (deferred) |
| Autofix | no | no | `--fix` | no | `--write` | no | NO (nonsensical for type-check) |

Key takeaways: adopt ESLint's **0/1/2 with a distinct usage/infra 2** (the clearest, and it
matches the existing `toExitCode` + the infra-vs-type invariant); adopt tsc/ngc's **`-p`**
input handle; adopt ngc's **warnings-do-not-fail-unless-gated** stance (already in
`evaluateResult`); reject discovery, watch, and autofix. Do NOT copy tsgo's renumbered exit
codes (its `DiagnosticsPresent_OutputsSkipped` is `2`, which would collide with our
infra/usage `2`) -- the ESLint numbering is the right one and it is what the codebase already
implements.

## Sources

- ESLint CLI reference -- exit codes 0/1/2, `--max-warnings` (default -1), `--quiet` interaction, exit-2-for-config history: https://eslint.org/docs/latest/use/command-line-interface (HIGH); exit-2 change PR https://github.com/eslint/eslint/pull/10009 (HIGH)
- TypeScript `ExitStatus` enum (Success=0, DiagnosticsPresent_OutputsSkipped=1, DiagnosticsPresent_OutputsGenerated=2) and the `typescript-go`/`tsgo` renumbering (skipped=2, +InvalidProject=3/Cycle=4/NotImplemented=5): microsoft/TypeScript `src/tsc/tsc.ts` (HIGH); pkg.go.dev typescript-go tsc (MEDIUM)
- `@angular/compiler-cli` `exitCodeFromResult` (0 clean / non-zero on error-category diagnostics; warnings pass since PR #43673): angular/angular commit 426a3ec (HIGH); jsDocs.io @angular/compiler-cli signature (MEDIUM)
- Vitest CLI exit-code contract (0 pass / 1 test-or-coverage fail; `--run` to avoid watch): https://vitest.dev/guide/cli + vitest-dev/vitest #2363/#5249 (HIGH); Biome `check` non-zero on problems (MEDIUM): biomejs/biome
- NO_COLOR / FORCE_COLOR / CLICOLOR priority (env-before-TTY, flag-overrides-env): https://no-color.org, https://force-color.org, http://bixense.com/clicolors/ (HIGH)
- Existing codebase (ground truth, read this session, HIGH): `core/run-typecheck.ts` (`CoreOptions`), `core/exit-codes.ts` (`toExitCode` + the verdict-blind note), `core/evaluate-result.ts` (`evaluateResult` + `Outcome`), `core/format-report.ts`/`core/render-report.ts` (renderer + color), `executors/typecheck/{schema.json,normalize-options.ts,executor.ts}` (option surface + advisory `warn*` template), `.planning/PROJECT.md` (v0.2.2 charter + Out of Scope)

---
*Feature research for: standalone Angular type-check CLI (exit code + human output as the product)*
*Researched: 2026-07-16*
