# Pitfalls Research

**Domain:** Standalone Node CLI `bin` for an Angular/TypeScript whole-program type-check tool (v0.2.2)
**Researched:** 2026-07-16
**Confidence:** HIGH (codebase + registry + GitHub API verified; general Node-CLI mechanics are well-established)

> Scope note: this file catalogs mistakes SPECIFIC to adding the standalone `bin` + its
> verification substrate. It does NOT re-litigate the engine, boundary filter, or Nx/Angular-CLI
> adapters -- those are shipped and audited. Everything below assumes the thin-adapter charter:
> the CLI is a third adapter over the ONE `runTypecheck` core, never a re-implementation.

---

## Critical Pitfalls

### Pitfall 1: Wiring the exit code to `toExitCode` instead of the full `evaluateResult` verdict (silent false pass)

**What goes wrong:**
The CLI does `process.exit(toExitCode(result))`. `toExitCode` (`src/core/exit-codes.ts`) maps ONLY
`TypecheckInfrastructureError -> 2`, `errorCount > 0 -> 1`, else `0`. But the LIVE pass/fail verdict is
`evaluateResult` (`src/core/evaluate-result.ts`), which returns `{ success: false }` for THREE more
outcomes that all have `errorCount === 0`: `coverage-incomplete` (a dropped in-graph diagnostic, a
`templateCheckAborted` TCB abort, or a `zero-root-names` leaf), and `warnings-exceeded`
(`--max-warnings` gate tripped). A CLI that exits on `toExitCode` alone returns **0** for every one of
those -- a silent false pass that directly violates the project's governing charter ("never a silent
false pass; over-report is the acceptable degradation direction").

**Why it happens:**
`toExitCode` LOOKS like the exit-code policy -- it is even named for it, lives in `core/`, and its own
tests assert 0/1/2. The subtlety is documented in its own header comment: it is the ngc-parity
error/infra/clean LEAF only and deliberately does NOT re-derive the coverage/warnings verdict, because
that verdict lives in exactly one place (`evaluateResult`) and a second partial copy would diverge.
The dead-scaffold comment literally says "When the deferred standalone CLI lands it must map
`evaluateResult(...)`'s `success`/`outcome` to an exit code, NOT re-compute the verdict here."

**How to avoid:**
The CLI's exit mapping is a two-step compose, not a single call:
1. On a thrown `TypecheckInfrastructureError` -> exit **2**.
2. Otherwise call `evaluateResult(result, { maxWarnings, strict })`. If `success === false` -> exit **1**
   (regardless of whether `outcome` is `type-error`, `coverage-incomplete`, or `warnings-exceeded`).
   If `success === true` -> exit **0**.
`toExitCode` can still be used for the infra-vs-error distinction, but `errorCount` alone must never be
the pass gate. Render the `outcome` label in the human output so a `coverage-incomplete` fail is not
mistaken for a plain type error.

**Warning signs:**
An e2e where a run with a warning under `--max-warnings 0`, a planted TCB-abort, or a dropped in-graph
diagnostic exits **0**. Any test that asserts the CLI verdict purely from `errorCount`.

**Phase to address:**
The exit-code wiring phase (the phase that connects the pure `toExitCode`/`evaluateResult` policy to
`process.exit`). This is the highest-value correctness pitfall in the milestone.

---

### Pitfall 2: CRLF corrupting the shebang line (Windows-arm64 build host)

**What goes wrong:**
The bin ships with `#!/usr/bin/env node\r`. On Linux/macOS the kernel treats the whole line after
`#!` as the interpreter path, so it looks for a program literally named `node\r` and fails with
`env: 'node\r': No such file or directory` (or `bad interpreter`). The CLI is unrunnable on exactly the
platforms the dev never sees locally -- this repo is built on Windows arm64, CI runs Linux/macOS.

**Why it happens:**
The bin file is authored/emitted on Windows. Two independent CRLF sources: (a) git checking out `.ts`
with `autocrlf=true`, and (b) TypeScript's `newLine` emit option -- when unset, `tsc`/`@nx/js:tsc` can
emit CRLF on a Windows host, so the compiled `bin.js` carries `\r` on the shebang line even if the
source was LF. The cmd.exe/PowerShell shims npm generates on Windows parse the shebang leniently, so
the CLI works on the dev box and only breaks on POSIX -- the classic "works on my machine".

**How to avoid:**
- Pin `"newLine": "lf"` in the built tsconfig (`tsconfig.lib.json`) so emit is deterministic across
  hosts (this also stabilizes the whole package, not just the bin).
- Add a `.gitattributes` rule forcing LF on the bin source (and ideally all `*.ts`).
- Add a tarball-audit assertion (extend the existing `tarball-audit.e2e.spec.ts`) that the packed
  `src/bin.js` first line is exactly `#!/usr/bin/env node\n` -- byte-check for absence of `\r`.

**Warning signs:**
CLI runs fine on Windows but Linux/macOS CI reports `env: node\r: No such file or directory`. A hex/byte
inspection of the packed bin shows `0d 0a` at the end of the shebang line.

**Phase to address:**
The cross-platform bin packaging phase (build config + tarball-audit assertion).

---

### Pitfall 3: The nx-transitive-import crash class (24-06 lesson) reaching the CLI

**What goes wrong:**
The bin entry imports a module that transitively pulls `@nx/devkit`/`nx`, which drags the
`chalk`/`ora`/`log-symbols` chain. Two failure modes: (a) slow cold start (hundreds of ms of module
init the CLI never needs), and (b) the yarn-4-hoist crash class that already bit v0.2.1 (24-06) -- a
non-Nx consumer's package manager can materialize an nx dependency tree that crashes on load. This is
the single explicit lesson the milestone context calls out.

**Why it happens:**
The obvious "reuse the adapter" instinct is to import from the executor/builder module -- but those
import `@nx/devkit` (`convertNxExecutor`, `logger`, `ExecutorContext`). The barrel `src/index.ts` is
already curated to expose only the pure core (`runTypecheck`, `TypecheckInfrastructureError`,
`CoreOptions`/`CoreResult`, `SkippedReference`), but it does NOT export `evaluateResult`/`toExitCode`
(package-internal) -- so a developer wiring the CLI is tempted to reach into a module that also pulls nx,
or to widen the barrel carelessly.

**How to avoid:**
- The bin imports ONLY pure-core modules: `runTypecheck` + `TypecheckInfrastructureError` from
  `./core/run-typecheck`, `evaluateResult` from `./core/evaluate-result`, `toExitCode` from
  `./core/exit-codes`, and the human formatter from `./core/format-report`/`format-diagnostics`. Inject a
  console-based logger (the core takes a logger; do NOT import `@nx/devkit`'s `logger`).
- Enforce with an ESLint `no-restricted-imports` boundary on the bin file path: forbid `@nx/devkit`,
  `nx`, `@angular-devkit/*`, and the executor/builder/generator/schematic modules. This mirrors the
  existing `core/**` purity rule.
- Add a static/e2e assertion that the bin's loaded module graph contains no `@nx/*`: after
  `require('.../bin.js')` in a child process (or via a `--print` probe), assert
  `Object.keys(require.cache)` has no path containing `node_modules/@nx` or `node_modules/nx/`.
- Optionally assert a cold-start budget (e.g. `--version` returns in < ~300 ms) as a proxy for "no heavy
  chain loaded".

**Warning signs:**
`ERR_REQUIRE`/chalk crash under yarn on a non-Nx consumer; a dependency-graph probe shows `@nx/devkit`
loaded; noticeably slow `--help`/`--version`.

**Phase to address:**
The CLI entry + arg parsing phase (establish the import boundary from the first commit), verified in the
in-repo tarball e2e phase (module-graph probe).

---

### Pitfall 4: `await import()` ESM bridge downleveled in the bin build (`ERR_REQUIRE_ESM`)

**What goes wrong:**
The bin reaches ESM-only `@angular/compiler-cli` through the same `await import()` bridge as the
executor. If the bin is compiled under `module: commonjs`, TypeScript downlevels `await import(...)` to
`require(...)`, which throws `ERR_REQUIRE_ESM` at runtime the moment the CLI touches the compiler.

**Why it happens:**
It is easy to assume "it's just a script, CommonJS is fine" and give the bin its own tsconfig, or to let
a stray `module: commonjs` win. The whole package already dodges this (GATE A: built `module: nodenext`)
-- the bin must inherit the SAME setting, not a bespoke one.

**How to avoid:**
The bin is compiled by the SAME `tsconfig.lib.json` (`module: nodenext`/`node16`) as the rest of the
package -- no separate bin tsconfig. Keep `package.json` `type: commonjs` (the executor loader needs it;
the bin runs fine as CJS with a dynamic `import()`). The e2e must assert the CLI output never matches
`/ERR_REQUIRE_ESM/` (the exact guard `assertPerProjectScoping` already applies to `ng run`).

**Warning signs:**
`Error [ERR_REQUIRE_ESM]: require() of ES Module .../@angular/compiler-cli` on the first real
type-check. The bin's emitted `.js` contains `require("@angular/compiler-cli")` instead of a preserved
dynamic `import`.

**Phase to address:**
The cross-platform bin packaging phase (share the package's `module: nodenext` build); verified in the
in-repo tarball e2e.

---

### Pitfall 5: `npx atc` fetches a foreign npm package (`atc` is taken)

**What goes wrong:**
`atc` is a REAL published npm package (`atc@0.0.6`, "Manage fleet spawns" -- verified on the registry
2026-07-16). `npx atc -p tsconfig.json` on a machine that does NOT already have `angular-typechecker`
installed makes npx download and execute that unrelated package. Best case: confusing error. Worst case:
supply-chain execution of arbitrary code the user did not intend.

**Why it happens:**
The milestone context says "`atc` npm-collision risk is nil (local bin, not a package name)". That is
true ONLY for LOCAL resolution -- once `angular-typechecker` is installed, `.bin/atc` shadows everything.
But `npx <name>` first looks for a local bin, then falls back to FETCHING a package of that name. So the
uninstalled `npx atc` path is a genuine hazard, and docs that show `npx atc ...` as a getting-started
line steer users straight into it.

**How to avoid:**
- Canonical npx invocation in README/`--help` is `npx angular-typechecker -p <tsconfig>` -- the package
  name matches a bin name, so npx always resolves THIS package.
- Document `atc` ONLY as a post-install PATH shorthand (after `npm i -D angular-typechecker`, then
  `npx atc` resolves the local `.bin/atc`), or as `npx --package angular-typechecker atc`.
- Do NOT publish or advertise `atc` as an npx-fetchable entry point.

**Warning signs:**
README/quickstart shows `npx atc` as the first command; a fresh-machine e2e for `npx atc` (no prior
install) resolves something other than this package.

**Phase to address:**
The docs phase (README `## Standalone CLI` + the exit-code contract) and the CLI entry phase (bin
naming). Add a fresh-install e2e that uses `npx angular-typechecker` (not `atc`) for the uninstalled
path.

---

### Pitfall 6: `process.exit()` truncating buffered stdout in CI (flush race)

**What goes wrong:**
The CLI prints a large `formatDiagnostics` dump, then calls `process.exit(1)` immediately. When stdout
is a PIPE (every CI run, and the e2e's own `execSync` capture), Node does not guarantee synchronous
flush -- `process.exit` can terminate the process before the tail of the buffer is written. Result:
truncated output, missing the very `TSxxxx` code the test asserts -> intermittent CI flake AND real users
losing the last diagnostics.

**Why it happens:**
`process.exit(code)` is the intuitive "end with this status" call, but it is abrupt. The reader side of
this project already had to defend against buffer issues (`createNgRun` sets `maxBuffer: 20MB`); the
writer side is the symmetric trap.

**How to avoid:**
Prefer setting `process.exitCode = code` and returning from `main()`, letting the event loop drain
stdout naturally. If an explicit `process.exit` is required, only call it after a stdout `drain`/flush
(e.g. write, then exit on the write callback), or use synchronous writes. Never `process.exit` inside a
`.then()` that fired right after an async `console.log`.

**Warning signs:**
CI e2e intermittently fails a `toContain('TS2322')` assertion that passes when re-run; output is fine in
an interactive terminal (TTY, line-buffered) but truncated when piped.

**Phase to address:**
The exit-code wiring phase.

---

### Pitfall 7: Windows path normalization breaking the boundary filter (drive-letter case, 8.3 short names)

**What goes wrong:**
The CLI receives `-p <tsconfig>` as a user-shell-relative string. If it hands a raw or CWD-relative path
to `runTypecheck`, the core's project-boundary filter (which keys off realpath path-containment) can
mis-classify in-project files as OUT-of-project on Windows/macOS: `D:\` vs `d:\` drive-letter case, 8.3
short names (`LARSGY~1`), and case-insensitive-FS folding all defeat naive string containment -> real
first-party diagnostics silently DROPPED (which, post-v0.2.0, surfaces as `coverage-incomplete`, not a
clean pass -- but still a wrong verdict if the CLI ignores that outcome; see Pitfall 1).

**Why it happens:**
The Nx/Angular-CLI adapters always pass workspace-anchored absolute paths; the CLI is the first adapter
fed an arbitrary user path from an arbitrary CWD on the primary dev OS (Windows arm64). The core already
does a `realpath()` try/catch (RES-02), but it can only normalize what it is given -- a relative or
wrong-case input still resolves inconsistently.

**How to avoid:**
Before calling the core, `path.resolve(process.cwd(), input)` then `fs.realpathSync.native(...)` the
`-p` argument (native realpath fixes drive-letter case + expands short names on Windows). Pass the
normalized absolute path in. Add a Windows e2e cell that invokes the bin from a DIFFERENT CWD than the
project root and with a lowercase drive letter, asserting the same verdict as the canonical form.

**Warning signs:**
On Windows, a clean project reports `coverage-incomplete` / dropped in-graph diagnostics that never
appear on Linux; running the CLI from the project root works but from a parent dir does not.

**Phase to address:**
The CLI entry + arg parsing phase (path normalization on input); verified in the in-repo tarball e2e
(Windows cell).

---

### Pitfall 8: `bin` field / shebang lost between source and the PUBLISHED artifact

**What goes wrong:**
Any of: (a) `bin` points at `./src/bin.ts` (source) instead of the compiled `./src/bin.js`; (b) `bin` is
declared in the source `package.json` but `@nx/js:tsc`'s package-json handling drops it from the
published manifest; (c) `bin.ts` is excluded from the lib build (e.g. it matches a test/exclude glob) so
no `bin.js` is emitted; (d) the packed tarball omits it. Any one produces a published package with a
missing or non-functional `.bin/angular-typechecker`. This repo has ALREADY shipped a packaging defect
of exactly this shape -- 0.0.1-0.1.0 published raw `.ts` with no compiled entry (the `packageRoot`
bug), fixed in 0.1.1.

**Why it happens:**
The package intentionally ships COMPILED `.js` (`main: ./src/index.js`), so the bin path must follow the
same `./src/*.js` convention -- but `bin` is a new field with new failure surface, and `@nx/js:tsc`
copies/rewrites `package.json` fields (it preserves `executors`/`generators`/`builders`; `bin` must be
verified to survive too). TypeScript DOES preserve a `#!` shebang on emit and does NOT strip it, and does
NOT relocate it -- but it also does NOT set the executable bit (npm sets +x when it links the bin on
install, so the tarball's missing +x is harmless for `npm i` consumers, only relevant for run-by-path
from a raw checkout on POSIX).

**How to avoid:**
- `bin` points at `./src/bin.js` (compiled), consistent with `main`/`types`.
- `bin.ts` lives under `src/` so `tsconfig.lib.json`'s `src/**/*.ts` include emits it; confirm it is NOT
  caught by the test/spec excludes.
- Extend `tarball-audit.e2e.spec.ts` to assert the packed tarball's `package.json` has a `bin` map with
  both names pointing at an existing `src/bin.js` entry inside the tarball, AND that `src/bin.js` is
  compiled JS with a valid LF shebang.
- After install from the tarball, assert `node_modules/.bin/angular-typechecker` and
  `node_modules/.bin/atc` both exist and run.

**Warning signs:**
`npm i -D angular-typechecker` then `npx angular-typechecker` -> "command not found" / runs the wrong
file; `bin` absent from `dist/.../package.json`; `tar -tzf` shows no `package/src/bin.js`.

**Phase to address:**
The cross-platform bin packaging phase + the in-repo tarball e2e phase (audit assertions).

---

### Pitfall 9: Argument-parse and usage errors mis-mapped to exit 1 instead of 2

**What goes wrong:**
`util.parseArgs` (chosen to avoid a new dependency -- correct choice; it is stable on Node 22/24/26)
throws `ERR_PARSE_ARGS_*` on an unknown flag or a missing option value in strict mode. If the CLI lets
that bubble, Node exits with **1** and a stack trace. Conventionally a USAGE error is exit **2** (and so
is an infrastructure error, per this tool's ngc-parity contract), while exit **1** must mean "type
errors found". Conflating usage/1 blurs the very exit-code contract this milestone exists to own.

**Why it happens:**
`parseArgs` throwing is easy to leave unhandled; the default Node exit for an uncaught throw is 1, which
"looks like a failure" and passes a naive smoke test.

**How to avoid:**
Wrap `parseArgs` in try/catch; on a parse error print usage to stderr and `exit 2`. Treat a missing
required `-p`/`--tsConfig` the same way (usage -> 2). `--help` and `--version` -> print and `exit 0`.
Reserve exit 1 exclusively for a completed run whose verdict is not clean. Document the full table
(0 clean / 1 type-or-coverage-or-warnings fail / 2 infra-or-usage) in README and assert each in e2e.

**Warning signs:**
`atc --nonsense` exits 1 with a raw `ERR_PARSE_ARGS` stack; `atc` with no `-p` exits 1; `--help` exits
non-zero.

**Phase to address:**
The CLI entry + arg parsing phase; verified in the in-repo tarball e2e (assert exit 2 on bad flag /
missing tsconfig, exit 0 on `--help`).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| CLI exits on `errorCount` (`toExitCode`) only, skipping `evaluateResult` | Less wiring; passes a happy-path smoke | Silent false pass on coverage-incomplete / warnings-exceeded -- charter violation | Never |
| Bin gets its own tsconfig (e.g. `module: commonjs` "because it's a script") | Feels self-contained | `ERR_REQUIRE_ESM` at runtime; drift from the GATE A build invariant | Never |
| Hardcode `--version` string in the bin | One less file read | Drifts from `package.json` version on every release | Never -- read version from the package's own `package.json` (via `require('../package.json')` from the compiled location, or a build-time inlined constant asserted against package.json in a test) |
| Reuse `@nx/devkit`'s `logger` in the CLI | Familiar API | Pulls the whole nx/chalk chain -> 24-06 crash class + slow start | Never -- inject a tiny console logger |
| Only exercise the bin via `node src/bin.js` in tests (not the installed shim) | Simpler test setup | Never proves the shebang / npm bin-shim / `.bin` linking works -- the exact cross-platform surface | Only for a fast unit smoke ALONGSIDE a real installed-shim e2e |
| Manual real-clone gate only, no committed CI fixture | No fixture maintenance | Not CI-authoritative; regressions land silently between manual runs | Only as the confidence layer ON TOP of a committed CI e2e (the existing ACV-01/ACV-02 two-tier model) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@angular/compiler-cli` (ESM) from a CJS bin | Static `import`/`require`, or `module: commonjs` downlevel | Dynamic `await import()` under `module: nodenext` (shared package build) |
| npm bin shims on Windows | Assuming the POSIX symlink model; testing only cmd.exe | npm generates `<name>`, `<name>.cmd`, `<name>.ps1` per bin; the `.cmd`/`.ps1` shims PARSE the shebang to pick `node`, so the shebang is load-bearing on Windows too. Test via `npx`/`.bin`, not just `node bin.js` |
| `npx` resolution of a two-name bin | `npx atc` as the canonical command | `npx angular-typechecker` (package-name match, always this package); `atc` only as an installed-PATH shorthand (foreign `atc@0.0.6` exists) |
| Verdaccio tarball e2e harness | Piping the CLI through `head`/`rg` (tail exit code masks the CLI's) | Capture via `execSync` try/catch -> `error.status` (the `createNgRun`/`run` pattern); never pipe |
| Nested npm/nx env in e2e | Inheriting `npm_config_*` / `NX_*` from the outer test task | Reuse `buildCleanEnv({ stripAllNpmConfig })` + `FORCE_COLOR=0` + `NX_DAEMON=false` |
| `tsConfig` as `string \| string[]` in the CLI | Only handling a single `-p` | `-p/--tsConfig` is repeatable (the core already accepts an array since ENG-01); solution-walk AND multi-leaf both must work |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Heavy import chain at bin startup (nx/chalk/ora) | Slow `--help`/`--version`; measurable cold-start tax on every invocation | Pure-core imports only; module-graph probe in e2e | Immediately, on every run -- worst for agent/CI loops that invoke per-project |
| Re-loading `@angular/compiler-cli` per tsconfig when several `-p` are passed | Linear slowdown with leaf count | Load the ESM compiler ONCE via the shared bridge, reuse across leaves (the core walk already does this within one call) | Multi-leaf / solution walks on large workspaces |
| No caching story for the CLI (unlike the Nx target) | Repeated full type-checks in a loop feel slow vs `nx typecheck` | Document that caching is an Nx/CI concern; the CLI is the uncached "elsewhere" for agents (by design). Do NOT bolt on a bespoke cache this milestone | Tight agent edit-check loops -- acceptable trade-off; note it in docs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Documenting `npx atc` (uninstalled) as the entry command | npx fetches + executes the unrelated `atc@0.0.6` package (arbitrary code) | Canonical `npx angular-typechecker`; `atc` = installed-PATH shorthand only |
| Passing an unsanitized `-p` path into shell-ish operations | Path-injection if any part of the CLI shells out | The core reads tsconfigs via `ts`/`fs` APIs, not a shell; keep it that way -- no `exec` of user input in the CLI |
| Logging full absolute paths / env in `--help`/errors | Minor info leak in CI logs | Emit workspace-relative paths in diagnostics (the core already normalizes for CI annotations) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Exit 1 for both "type errors" and "bad usage" | Scripts/agents cannot distinguish a real failure from a typo | 0 clean / 1 verdict-fail / 2 infra-or-usage; documented table |
| A `coverage-incomplete` fail rendered as a plain "type error" | User hunts for a nonexistent type error | Render the `outcome` label; explain a dropped in-graph diagnostic / TCB abort distinctly |
| No `--help` / non-standard help | Discoverability; agents can't self-serve the flag set | `--help` (exit 0) listing `-p/--tsConfig` (repeatable), `--max-warnings`, fail-fast, `--include-deps`, `--strict`, `--version` |
| `--version` drifting from the published version | Confusing bug reports | Read from the package's own `package.json` |

## "Looks Done But Isn't" Checklist

- [ ] **Exit codes:** Often wired to `toExitCode`/`errorCount` only -- verify a `coverage-incomplete`
      and a `warnings-exceeded` run each exit **1**, and a bad tsconfig path exits **2**.
- [ ] **Shebang:** Often CRLF from a Windows build -- verify the packed `src/bin.js` first line ends in
      `\n` (no `\r`) AND the bin runs on Linux CI (not just Windows).
- [ ] **Import boundary:** Often leaks `@nx/devkit` transitively -- verify the loaded module graph has no
      `@nx/*`/`nx/` and cold start is fast.
- [ ] **ESM bridge:** Often downleveled -- verify output never matches `/ERR_REQUIRE_ESM/` against a real
      Angular 22 tsconfig.
- [ ] **`bin` in the published artifact:** Often present in source but dropped/mispathed in dist --
      verify `dist/.../package.json` `bin` -> existing `src/bin.js`, and both `.bin/angular-typechecker`
      and `.bin/atc` link + run after a tarball install.
- [ ] **Two-name bin via npx:** Verify `npx angular-typechecker` is the documented canonical form (not
      `npx atc`).
- [ ] **stdout flush:** Verify a large diagnostic dump is NOT truncated when piped (re-run an e2e a few
      times for flake).
- [ ] **Windows path input:** Verify the CLI run from a non-root CWD / lowercase drive gives the same
      verdict as the canonical path.
- [ ] **Both invocation shapes:** Verify a single-leaf `-p tsconfig.spec.json` AND a solution-walk
      `-p tsconfig.json` both work.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Exit code wired to `toExitCode` only (silent false pass) | LOW (pre-release) / HIGH (post-release) | Re-route through `evaluateResult`; add the coverage-incomplete/warnings-exceeded exit-1 e2e; if released, patch-bump immediately (correctness) |
| CRLF shebang shipped | LOW | Set `newLine: lf`, re-pack, re-verify on Linux; patch release |
| nx leaked into the bin | MEDIUM | Trace the offending import, swap to pure-core; add the module-graph probe so it can't regress |
| `bin` missing/mispathed in published package | LOW-MEDIUM | Fix `bin` path / build include; the 0.1.1 `packageRoot` precedent shows the drill (deprecate the broken version, republish) |
| `npx atc` documented + users hit foreign package | LOW (docs) | Fix README/`--help` to `npx angular-typechecker`; deprecation note if it shipped |

## Pitfall-to-Phase Mapping

Phase names are indicative (roadmap not yet cut); they describe the work unit that must own each pitfall.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Exit code via `evaluateResult`, not `toExitCode` alone | Exit-code wiring | e2e: coverage-incomplete + warnings-exceeded runs exit 1; infra exits 2 |
| 2. CRLF shebang | Cross-platform bin packaging | tarball-audit byte-check for LF shebang; Linux CI run |
| 3. nx-free import boundary | CLI entry + arg parsing | ESLint boundary rule; module-graph probe in e2e |
| 4. `await import()` not downleveled | Cross-platform bin packaging | e2e asserts no `ERR_REQUIRE_ESM` against Angular 22 |
| 5. `npx atc` foreign fetch | Docs + CLI entry | README/`--help` uses `npx angular-typechecker`; uninstalled-npx e2e |
| 6. stdout flush race | Exit-code wiring | Repeated piped e2e; assert full tail present |
| 7. Windows path normalization | CLI entry + arg parsing | Windows e2e: non-root CWD + lowercase drive same verdict |
| 8. `bin`/shebang survive to published artifact | Cross-platform bin packaging + in-repo tarball e2e | tarball-audit `bin` map + `.bin/*` link-and-run after install |
| 9. Usage errors -> exit 2 | CLI entry + arg parsing | e2e: bad flag / missing `-p` exit 2; `--help` exit 0 |

---

## Verification Substrate (concrete recommendation)

**Finding: on-stack Angular 22 + Nx 23 OSS repos DO exist now** (Angular 22 has been GA ~8 months by
2026-07), so NO synthetic-only fallback is needed for the Nx side. Two real, MIT-licensed candidates
were verified against the npm/GitHub API on 2026-07-16:

### Recommended Nx workspace: `radix-ng/primitives`

- **URL:** https://github.com/radix-ng/primitives
- **Pinned SHA:** `4a7390a2b058457aa47c6f3e0e03b69b70dee025` (2026-07-12)
- **Stack (verified from its `package.json`):** `nx 23.1.0-beta.1`, `@angular/core 22.0.2`,
  `@angular/compiler-cli 22.0.2`, `typescript 6.0.3` -- ON-STACK Angular 22 + TS 6, Nx 23.x. MIT, 265 stars.
- **Layout:** real Nx workspace (`nx.json` at root). Library project `packages/primitives` carries a full
  leaf set: `tsconfig.json` (solution/references), `tsconfig.lib.json`, `tsconfig.spec.json`,
  `tsconfig.stories.json`, plus `project.json`. Apps under `apps/` (radix-playground, radix-storybook, ...).
- **How to exercise the CLI:** point the shipped bin at the solution config for a reference-walk
  (`atc -p packages/primitives/tsconfig.json`) and at individual leaves for per-leaf scoping
  (`-p packages/primitives/tsconfig.lib.json`, `-p packages/primitives/tsconfig.spec.json`). Plant
  distinct per-leaf TS errors (TS2322 / TS2345 / TS2554, mirroring the ACV-01 pattern) to prove RED, and a
  clean tree to prove GREEN + exit 0.
- **Why this one:** the maintainer already uses it as the v0.2.0 Gate B cross-check (exact-stack Layout B
  Storybook host), so its stack and layout are known-good for this project. **Trade-off:** its `nx` is a
  BETA (`23.1.0-beta.1`). This is a NON-ISSUE for the standalone CLI specifically -- the CLI is Nx-agnostic
  (imports only the pure core, reads tsconfigs directly, never loads the workspace's Nx). The workspace's
  Nx version is irrelevant to the bin; it only needs real Angular 22 tsconfigs + source, which it has.

### Alternate / breadth Nx workspace: `analogjs/analog`

- **URL:** https://github.com/analogjs/analog
- **Pinned SHA:** `04e32e2a873cc3a3d0d037cc24be5ad02ddb363a` (2026-07-14, `beta` default branch)
- **Stack (verified):** `nx 23.0.1` (STABLE), `@angular/core ^22.0.0`, `@angular/compiler-cli ^22.0.0`,
  `typescript ~6.0.0`. MIT, 3153 stars, `nx.json` present.
- **Why alternate not primary:** larger meta-framework monorepo with many NON-Angular packages (Vite
  plugins, adapters), so you must point the CLI specifically at an Angular library package's tsconfig
  rather than a whole-workspace config. Use it for extra breadth/confidence, or as the primary if a
  stable-Nx workspace is preferred over radix's beta. **Trade-off:** noisier target selection; `beta`
  default branch (pin the SHA).

### Angular CLI workspaces (already established -- reuse verbatim)

Point the shipped bin at their real project tsconfigs (instead of `ng run`):

- **`bluehalo/ngx-leaflet`** @ `818e9ae55240b570397ede5a15cb4d466785abdc` -- app + library, non-Nx
  `angular.json`, on-stack Angular 22, MIT. Covers app-vs-library per-project scoping via
  `tsconfig.app.json` / `tsconfig.spec.json` / `projects/ngx-leaflet/tsconfig.lib.json`.
- **`realworld-angular/realworld-angular`** @ `9e3528ff27bad5fedaefb879ccc4aaf4717b137b` -- single app,
  exact-stack Angular 22.0 / TS 6.0.3, non-Nx `@angular/build:application`, MIT. Second exact-stack repo;
  app build leaf + spec leaf.

### Honest "does an on-stack Nx OSS repo exist?" answer

Yes -- `radix-ng/primitives` and `analogjs/analog` are both real, current, MIT, on-stack Angular 22 + Nx 23
workspaces. This is a genuine improvement over the v0.2.0 situation ("no public Nx 23 + Angular 22 +
Storybook repo exists yet"): the Storybook constraint was the blocker then, not Angular-22-on-Nx itself.
For a plain type-check CLI (no Storybook requirement), on-stack Nx OSS substrate is available today, so a
generated `create-nx-workspace` app+lib is NOT required as the Nx real-world proof -- keep it only as the
committed CI fixture (see below).

### How to reuse the existing shipped-tarball harness

The v0.2.1 harness generalizes cleanly to the CLI. Mirror the existing two-tier model:

- **CI-authoritative (committed fixtures, `angular-typechecker-install-e2e` + `-ng-cli-e2e`):** add a CLI
  spec that (1) consumes the publish-once local Verdaccio via `createVerdaccioGlobalSetup` +
  `inject('verdaccioUrl'/'verdaccioToken')`, (2) installs the shipped tarball by name into the committed
  Nx fixture (`fixtures/consumer-app`/`consumer-workspace`) AND the Angular CLI fixture
  (`fixtures/ng-cli-workspace`) using `buildCleanEnv({ stripAllNpmConfig: true })` +
  `writeVerdaccioNpmrc`, then (3) runs the installed bin and asserts the LITERAL exit code. Add a
  `createCliRun` helper analogous to `createNgRun`: `execSync('npx angular-typechecker -p <tsconfig>')`
  with the same try/catch -> `error.status` capture, `maxBuffer: 20MB`, `FORCE_COLOR=0`. Reuse `plant` /
  the TS2322 / TS2345 / TS2554 planted-leaf codes.
  - **KEY difference from the Nx/ng harness:** the CLI e2e must assert the literal **0/1/2** codes -- in
    particular **exit 2** for an infrastructure error (nonexistent / malformed `-p` tsconfig) and for a
    usage error (bad flag / missing `-p`). The Nx `{success}` (0/1) mapping the existing specs assert does
    NOT cover exit 2 -- this is net-new coverage the milestone owns.
  - Prove the shebang path: invoke through `npx angular-typechecker` / the `.bin` shim (NOT `node bin.js`)
    on the Linux e2e cell so a `\r` shebang would fire `env: node\r`. Add a Windows smoke that runs the
    installed bin (heavy e2e is Linux-only per PROJECT.md, so Windows needs at least a bin smoke in the
    all-OS unit/smoke tier).
- **Manual real-clone UAT (uncommitted, URL + SHA -- the ACV-01 model):** reproduce
  `radix-ng/primitives` (Nx) + `ngx-leaflet` and `realworld-angular` (Angular CLI) from the SHAs above,
  install the packed tarball, run the shipped bin against real project tsconfigs, assert planted-error
  RED (exit 1) / clean GREEN (exit 0) and a bad path -> exit 2. Windows/MSYS `tar`/pack: use `/d/...`
  paths, not `D:/...` (Git Bash mis-parses the drive letter as a remote host).

---

## Sources

- Local codebase (HIGH): `packages/angular-typechecker/src/core/exit-codes.ts` (the `toExitCode`
  scaffold + its "map `evaluateResult` not raw counts" contract), `evaluate-result.ts` (the
  `{success, outcome}` verdict incl. coverage-incomplete / warnings-exceeded), `src/index.ts` (curated
  barrel), `package.json` (`type: commonjs`, `main: ./src/index.js`, `files`, `bin` absent today),
  `libs/test-util/src/lib/e2e-process.ts` + `ng-cli-e2e.ts` + `verdaccio-global-setup` (the reusable
  tarball harness), `e2e/*` specs, `.planning/PROJECT.md` (milestone charter + constraints).
- v0.2.1 phase 24 records (HIGH): `24-ACV-01-UAT.md` (real-clone gate procedure, SHAs, Windows tar
  gotcha, nx-free ng-add crash class 24-06), `24-HUMAN-UAT.md` (referenced).
- npm registry `registry.npmjs.org` (HIGH, 2026-07-16): `atc@0.0.6` exists ("Manage fleet spawns") ->
  the `npx atc` foreign-fetch hazard; `angular-typechecker@0.2.1` current.
- GitHub API (HIGH, 2026-07-16): `radix-ng/primitives` @ `4a7390a2...` (nx 23.1.0-beta.1, Angular 22.0.2,
  TS 6.0.3, MIT, nx.json, `packages/primitives` full tsconfig leaf set); `analogjs/analog` @ `04e32e2a...`
  (nx 23.0.1, Angular ^22.0.0, TS ~6.0.0, MIT); `nrwl/nx-examples` is Angular 21.2.0 (OFF-STACK, dropped).
- Node.js CLI mechanics (MEDIUM, training + well-established): npm cmd-shim triple-file generation on
  Windows and shebang parsing; `util.parseArgs` strict-mode throw behavior; `process.exit` stdout flush
  race on pipes; TypeScript shebang preservation on emit + `newLine` default hazard.

---
*Pitfalls research for: standalone Node CLI bin for an Angular type-check tool (v0.2.2)*
*Researched: 2026-07-16*
</content>
</invoke>
