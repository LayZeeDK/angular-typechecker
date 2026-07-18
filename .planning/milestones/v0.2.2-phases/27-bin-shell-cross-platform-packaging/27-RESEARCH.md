# Phase 27: Bin shell + cross-platform packaging - Research

**Researched:** 2026-07-16
**Domain:** Cross-platform Node `bin` packaging for a CommonJS `@nx/js:tsc`-built Nx plugin; shebang/ESM-bridge survival to the published artifact; nx-free static build guard; additive-only release audit.
**Confidence:** HIGH (every claim grounded in the actual codebase seams + this milestone's own HIGH-confidence research; the only MEDIUM item -- TypeScript shebang preservation -- is proven at build time by the VER-03 spec this phase writes).

## Summary

This phase adds the THIRD thin adapter's OS boundary over the already-shipped pure
`run(argv, env)` core (Phase 26). There is NO engine or verdict work here -- it is packaging,
one ~15-line shell file, one ESLint block, one static guard spec, one tarball-audit extension,
and one additive-only audit doc. The load-bearing correctness (parse, exit-code compose, path
resolution, the CJS->ESM bridge) already shipped and is unit/integration-tested; this phase
proves the shell + packaging survive `@nx/js:tsc` into the built and published artifact and
never regress the nx-free boundary.

All twelve CONTEXT decisions (D-01..D-12) are HIGH-confidence and locked. The two scope
questions with any latitude are already resolved by codebase facts confirmed this session:
`publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` are existing root devDependencies and
`tarball-audit.e2e.spec.ts` already exists (so PKG-01 EXTENDS it -- zero new dependency, zero
new project), and there is NO `.gitattributes` in the repo today (so D-07 adds a new narrow
one). The `angular-typechecker@0.2.1` git tag exists (ADD-01 baseline is concrete).

**Primary recommendation:** Follow the CONTEXT decisions verbatim. Write `bin.ts` as the
flush-safe `run().then(...)` shell that sets `process.exitCode` (NEVER calls `process.exit`);
add the two-name `bin` field; pin `newLine: lf` in `tsconfig.lib.json` + a narrow `*.ts eol=lf`
`.gitattributes`; mirror the `core/**` ESLint import-ban into a `cli/**` block WITHOUT the
`no-console`/`process.exit` rules; write `bin-static.spec.ts` on the `gate-a-static.spec.ts`
model (2 dirs up, not 3); extend `tarball-audit.e2e.spec.ts` with a new bin describe block; and
write `27-ADDITIVE-AUDIT.md` on the `24-ADDITIVE-AUDIT.md` model against the `0.2.1` tag.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | Two `bin` names (`angular-typechecker` + `atc`) -> one compiled `src/cli/bin.js`; `bin.ts` is the only `process.exit`/stream-write site, flush-safe. | Section "bin.ts shape" (flush-safe pattern), "package.json bin field" (two-name map). Wraps the shipped `run()` in `src/cli/main.ts` (read: it returns `{exitCode,stdout,stderr}` and re-throws unknown errors). |
| PKG-01 | Source shebang (LF) survives `@nx/js:tsc` into built AND published `bin.js`; `newLine: lf` + `.gitattributes`; publint tarball audit. | Section "Shebang survival" (newLine placement, .gitattributes scope), "Tarball publint bin audit" (extend the existing e2e spec). |
| PKG-02 | Bin compiles under `module: nodenext` so the `await import()` bridge is not downleveled (no `ERR_REQUIRE_ESM`). | Section "ESM bridge not downleveled" -- `bin.ts` inherits `tsconfig.lib.json` (no separate tsconfig); tie to the GATE A invariant `gate-a-static.spec.ts` already proves. |
| VER-03 | `bin-static.spec.ts` (`test` tier, `dependsOn: build`) asserts a `\r`-free shebang + an nx-free `require` graph from the built `bin.js`. | Section "VER-03 static guard" -- built require patterns confirmed (`require("../core/...")` double-quoted, extensionless); recursive relative-require walk design. |
| ADD-01 | Milestone additive-only vs `angular-typechecker@0.2.1`: barrel drift green, no public-surface break, `bin`+`src/cli/**` net-new, `v0.3.0` untriggered. | Section "ADD-01 additive-only audit" -- git-diff commands, drift tripwire, `27-ADDITIVE-AUDIT.md` shape on the `24-ADDITIVE-AUDIT.md` model. |
</phase_requirements>

<user_constraints>
## User Constraints (from 27-CONTEXT.md)

### Locked Decisions
- **D-01:** `src/cli/bin.ts` is a thin wrapper: call `run(process.argv.slice(2))`, then write
  `result.stdout`/`result.stderr`, and set the exit code from `result.exitCode`. Contract
  already spelled out in `main.ts`'s docstring. NO logic beyond wiring.
- **D-02:** Flush-safety (Pitfall 6): set `process.exitCode = result.exitCode` and let the
  event loop drain stdout/stderr naturally -- do NOT call `process.exit(code)` immediately after
  writing (truncates buffered stdout on a PIPE). If explicit `process.exit` is ever unavoidable,
  only after a write-callback / drain.
- **D-03:** `run()` re-throws any non-`TypecheckInfrastructureError`; `bin.ts` catches an unknown
  throw, writes it to stderr, and maps it to exit `2`.
- **D-04:** `package.json` gains `"bin": { "angular-typechecker": "./src/cli/bin.js", "atc":
  "./src/cli/bin.js" }` -- both names -> the ONE compiled `./src/cli/bin.js` (never `.ts`).
- **D-05:** `bin` is a NEW manifest field; verify `@nx/js:tsc` preserves it into
  `dist/.../package.json` (tarball audit in D-11 does this). NO `files` change needed.
  `version` STAYS `0.2.1`.
- **D-06:** Pin `"newLine": "lf"` in `tsconfig.lib.json` `compilerOptions` (the build/ship
  tsconfig). Deterministic LF emit across hosts. Dist-only, does not affect the ADD-01 audit.
- **D-07:** Add a repo-root `.gitattributes` LF guard on the TypeScript SOURCE (`*.ts text
  eol=lf`). Deliberately NARROW: NOT a repo-wide `* text=auto eol=lf` renormalization (would
  churn the committed `ng-cli-workspace` fixture + lockfiles). REVERSIBLE -- may narrow to the
  bin path only.
- **D-08:** NO separate bin tsconfig. `bin.ts` compiles under `tsconfig.lib.json` (`module:
  nodenext` via `tsconfig.json`), so the `await import('@angular/compiler-cli')` bridge (reached
  transitively via `core/compiler-loader.ts`) is never downleveled. `package.json` stays `type:
  commonjs`. GATE A invariant `bin.js` inherits.
- **D-09:** Add an ESLint `@typescript-eslint/no-restricted-imports` block scoped to
  `**/src/cli/**/*.ts`, modeled on the `**/src/core/**/*.ts` block: ban `nx`, `@nx/*`,
  `@angular-devkit/*`, the adapter modules, and the barrel. DIFFERENCE: do NOT add `no-console`
  or `no-restricted-properties: process.exit` -- `bin.ts` legitimately writes streams + sets the
  exit code.
- **D-10:** `bin-static.spec.ts` (`test` tier, `dependsOn: build`, modeled on
  `gate-a-static.spec.ts`) asserts (a) the built `bin.js` FIRST line is exactly
  `#!/usr/bin/env node` with NO `\r`; (b) the built bin's `require` graph never reaches
  `@nx/devkit`/`nx` (static transitive walk following relative `require()`s). Static/test-tier
  ONLY; the RUNTIME `require.cache` probe on the INSTALLED bin is Phase 28. Cold-start budget NOT
  done (speculative).
- **D-11:** EXTEND the EXISTING `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts`
  (publint already a dev-dependency) to assert on the PACKED tarball: (a) `package.json` `bin`
  maps BOTH names -> an existing `src/cli/bin.js`; (b) `src/cli/bin.js` first line is a `\r`-free
  shebang; (c) publint passes. REVERSIBLE -- may move beside Phase 28.
- **D-12:** Prove additive-only vs `angular-typechecker@0.2.1`: (a) barrel-drift tripwire stays
  green; (b) git-diff the public surface (executor id, `runTypecheck`/`CoreResult`/`CoreOptions`,
  builder, generator/executor/builder schemas) -- no break; (c) confirm `bin` + `src/cli/**`
  net-new; (d) write `27-ADDITIVE-AUDIT.md` on the `24-ADDITIVE-AUDIT.md` model. `v0.3.0` stays
  untriggered.

### Claude's Discretion
- Internal `bin.ts` structure (`main()` wrapper + `.then/.catch` vs top-level await), as long as
  it is flush-safe (D-02) and adds no logic beyond wiring. **Research note:** top-level await is
  ILLEGAL in a `type: commonjs` module -- use `.then/.catch` or an async IIFE (see below).
- Exact `.gitattributes` scope within the narrow/additive constraint (D-07): `*.ts eol=lf` vs a
  bin-only rule.
- The `bin-static` transitive-walk implementation (how it regexes require specifiers per built
  `.js` and follows relatives), as long as it proves the graph from `bin.js` is nx-free.
- Whether the `src/cli/**` ESLint block lists the executor/builder relative paths explicitly or
  relies on the `nx`/`@nx/*` bans -- both achieve nx-free.
- Fixture / assertion reuse when extending `tarball-audit.e2e.spec.ts` (D-11).

### Deferred Ideas (OUT OF SCOPE)
- Shipped-tarball install-and-RUN e2e (literal `0`/`1`/`2` through the real PM `.bin` shim; npm +
  yarn + pnpm; Linux + Windows) + the manual real-clone UAT -- **Phase 28 (VER-04/05)**.
- README `## Standalone CLI` + exit-code table + curated CHANGELOG -- **Phase 29 (DOC-01)**.
- JSON/SARIF reporters, `--watch`, `--quiet`/`--color`/`--no-color`/`--project` alias -- Future
  Requirements, out of this milestone.
- Cold-start-budget (`--version` < ~300ms) assertion -- Pitfall 3 "optional"; NOT warranted.
- A repo-wide `* text=auto eol=lf` `.gitattributes` renormalization -- deliberately NOT done.
</user_constraints>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **ASCII only** in all output (no em dashes, curly quotes, box-drawing). This RESEARCH.md
  complies; the planner and executor must too.
- **`git grep` primary; `rg -uu` for `dist/` and `node_modules/`** (both gitignored -- `git grep`
  returns zero matches there silently). Read BUILT artifacts under `dist/packages/...` with
  `fs`/Read, never `git grep`. (This is exactly what `gate-a-static.spec.ts` and
  `bin-static.spec.ts` do at runtime -- `fs.readFileSync`.)
- **No `git add .`/`-A`/`-u`;** stage files by name. Prefer `git mv` for moves.
- **`version` STAYS `0.2.1`** this phase -- the bump is the human-gated Release-PR flow
  (AGENTS.md), never a phase edit.
- **`AGENTS.md` changes need code review** (the `code_review_gate` satisfies this). Not touched
  this phase.
- **`@nx/dependency-checks` runs at `maxWarnings:0`** -- the bin adds no new runtime import
  (`node:*` builtins + pure core), so NO manifest dependency change beyond the `bin` field.
- **fallow GSD pre-pass is disabled** (`code_quality.fallow.enabled: false`); fallow gates in CI
  instead. No action here.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OS process boundary (exit code, stream writes) | CLI shell (`src/cli/bin.ts`) | -- | Only `bin.ts` may touch `process.exit`/streams; everything else is pure. |
| Verdict + diagnostics compose | Core (`src/cli/main.ts` `run()` -> `core/**`) | -- | Already shipped (Phase 26); UNCHANGED this phase. |
| Command registration | Package manifest (`package.json` `bin`) | Build (`@nx/js:tsc` copies manifest) | npm/pnpm/yarn generate `.bin` shims from the `bin` field. |
| Deterministic LF emit | Build tsconfig (`tsconfig.lib.json` `newLine`) | Source (`.gitattributes` on `*.ts`) | `newLine: lf` is the primary emit guard; `.gitattributes` is belt-and-suspenders on the source. |
| nx-free import boundary | Lint (`eslint.config.mjs` `cli/**` block) | Static guard (`bin-static.spec.ts`) | Lint fails at author time; the static walk proves the BUILT graph. |
| Additive-only release contract | Drift tripwire (`tsconfig.drift.json`) | Audit doc (git-diff vs `0.2.1` tag) | Standing tripwire + a one-off audit doc, same as v0.2.1. |

## Standard Stack

### Core -- ZERO additions (verified this session)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:util` `parseArgs` | stdlib | Arg parsing | Already used by the shipped `parse-args.ts`. [VERIFIED: codebase] |
| `@nx/js:tsc` (native `tsc`) | `23.0.1` | Compile `src/cli/*.ts` -> `.js`; preserve shebang; copy manifest | Already the build; `tsconfig.lib.json` `include: ["src/**/*.ts"]` picks up `bin.ts` with NO project.json change. [VERIFIED: project.json, tsconfig.lib.json] |
| `package.json` `bin` field | n/a | Register two command names -> one target | npm-native; two keys share one target file. [CITED: STACK.md] |
| `publint` | `0.3.21` (root devDependency) | Bin tarball audit (`bin` rule = "file must start with a shebang") | Already invoked by `tarball-audit.e2e.spec.ts` via `npx publint --strict`. [VERIFIED: root package.json:52, tarball-audit spec] |
| `@arethetypeswrong/cli` | `0.18.4` (root devDependency) | Types-resolution audit (already asserted; NOT bin-specific) | Present; unchanged. [VERIFIED: root package.json:25] |

**Installation:** NONE. No runtime dependency, no dev dependency, no new project. The whole phase
is config + source + specs.

### Alternatives Considered (all rejected in prior research)

| Instead of | Could Use | Tradeoff / Why Rejected |
|------------|-----------|-------------------------|
| One compiled `bin.js` under `node` | `esbuild`/`ncc`/`pkg` bundle | Fights the `@nx/js:tsc` multi-file layout + the `await import()` bridge. [CITED: STACK.md] |
| Source `#!/usr/bin/env node` | `shebang-trim` + ts-node dev shebang | The source shebang IS the compiled shebang -- nothing to rewrite. [CITED: STACK.md] |
| npm install-time chmod (+x) | build-time `chmod +x` step | npm sets `0o755` on the bin target at install; a build chmod is redundant. [CITED: STACK.md, Pitfall 8] |
| `newLine: lf` in `tsconfig.lib.json` | rely on git autocrlf only | Two independent CRLF sources (git checkout AND `tsc` emit on Windows) -- pin BOTH. [CITED: PITFALLS.md Pitfall 2] |

## Package Legitimacy Audit

> Not applicable in the install sense -- **this phase installs zero packages.** Every tool it
> uses (`publint`, `@arethetypeswrong/cli`, `nx`, `tsc`, `tar`, `npm`) is already a root
> devDependency or a system tool. The two audit tools were confirmed present this session
> (`root package.json:25,52`). No slopcheck run required; no `[SLOP]`/`[SUS]` surface.

## Architecture Patterns

### System Architecture Diagram (where the bin sits)

```
process.argv --> bin.ts (NEW, the ONLY process.exit/stream site)
                   |
                   | run(process.argv.slice(2))          [Phase 26, UNCHANGED]
                   v
                 main.ts run(argv, env): Promise<{ exitCode, stdout, stderr }>
                   |            |                    \
                   |            |                     re-throws unknown error --> bin.ts .catch --> exitCode=2
                   v            v
             parse-args     core/** (runTypecheck -> emit-advisory-notices ->
             console-logger        renderReport -> evaluateResult -> toExitCode)
                                          |
                                   await import('@angular/compiler-cli')   [ESM bridge, nodenext]
                   |
   bin.ts: process.stdout.write(stdout); process.stderr.write(stderr); process.exitCode = exitCode; (return)
                   |
                   v
             natural event-loop drain --> process exits with exitCode (flush-safe)
```

The bin's ENTIRE `require()` graph reaches only `./main` -> `../core/**` + `node:*` + `tslib`.
No `@nx/*`, no `nx`, no `@angular-devkit/*`. `@angular/compiler-cli` is reached via `await
import()` (NOT `require`), so it never appears in the static require graph.

### Recommended Project Structure (delta only)

```
packages/angular-typechecker/
|-- .gitattributes                 # (repo ROOT, not here) NEW: *.ts eol=lf  [D-07]
|-- package.json                   # MODIFIED: + "bin" (two names)  [D-04]
|-- tsconfig.lib.json              # MODIFIED: + compilerOptions.newLine: "lf"  [D-06]
|-- eslint.config.mjs              # MODIFIED: + src/cli/** import-ban block  [D-09]
|-- src/cli/
|   |-- bin.ts                     # NEW: shebang + flush-safe run().then/.catch  [D-01..D-03]
|   '-- bin-static.spec.ts         # NEW: shebang byte-check + nx-free require walk  [D-10]
e2e/angular-typechecker-install-e2e/src/
|   '-- tarball-audit.e2e.spec.ts  # MODIFIED: + bin describe block  [D-11]
.planning/phases/27-.../
    '-- 27-ADDITIVE-AUDIT.md       # NEW: additive-only audit vs 0.2.1  [D-12]
```

### Pattern 1: bin.ts -- the flush-safe shell (CLI-01, EXIT-02, D-01/D-02/D-03, Pitfall 6)

**What:** ~15 lines. Shebang line 1, import `run`, call it, write the two strings, set
`process.exitCode`, catch unknown throws -> `2`.

**Load-bearing detail (supersedes the ARCHITECTURE.md draft):** The ARCHITECTURE.md draft used
`process.exit(exitCode)`. **D-02 overrides that** -- set `process.exitCode = exitCode` and RETURN
(do NOT call `process.exit`). `process.exit()` terminates before Node drains a piped stdout
buffer (every CI run + the e2e `execSync` capture), truncating the tail `TSxxxx` code an
assertion needs. Setting `process.exitCode` and letting the event loop drain naturally is the
documented flush-safe pattern: queued `process.stdout.write` calls flush before natural exit,
whereas `process.exit()` skips that flush. This directly answers research_focus item 1.

**Top-level await is ILLEGAL here** -- `package.json` is `type: commonjs` and the bin compiles
`module: nodenext`, so a CommonJS module cannot use top-level await. Use `.then/.catch` (below)
or an async IIFE. Both are flush-safe; `.then/.catch` matches the shipped `run()`'s Promise
shape and the ARCHITECTURE.md precedent.

```typescript
// Source: mirrors ARCHITECTURE.md Pattern 2, D-02-corrected (no process.exit)
#!/usr/bin/env node
import { run } from './main';

run(process.argv.slice(2))
  .then(({ exitCode, stdout, stderr }) => {
    if (stdout) {
      process.stdout.write(stdout);
    }

    if (stderr) {
      process.stderr.write(stderr);
    }

    // D-02: set the code and RETURN. The event loop drains the writes above, then
    // the process exits with this code. NEVER process.exit(code) here -- it would
    // truncate a piped stdout tail (Pitfall 6).
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    // D-03: run() re-throws any non-TypecheckInfrastructureError; an unknown crash
    // is infrastructure-class for a type-checker -> exit 2, never 0/1.
    process.stderr.write(
      String((error as { stack?: string })?.stack ?? error) + '\n',
    );
    process.exitCode = 2;
  });
```

**Note the blank-lines-around-control-flow style** (CLAUDE.md JS/TS rule) already applied above.

### Pattern 2: package.json bin field (CLI-01, D-04/D-05, Pitfall 8)

```jsonc
// Add to the existing manifest -- no other field change (version STAYS 0.2.1).
"bin": {
  "angular-typechecker": "./src/cli/bin.js",
  "atc": "./src/cli/bin.js"
}
```

- Both keys -> the ONE compiled `./src/cli/bin.js` (compiled JS, consistent with `main:
  ./src/index.js`). NEVER `.ts`.
- Path is relative to the published package root; the published layout keeps the `src/` prefix.
- `files: ["src", ...]` ALREADY ships `src/cli/bin.js` -- **no `files` change** (verified:
  `package.json:40-48` whitelists `"src"`). [VERIFIED: package.json]
- `@nx/js:tsc` copies the manifest verbatim into `dist/`, and `nx-release-publish` packs from
  `packageRoot: dist/packages/angular-typechecker` (verified: `project.json:58-62`), so the `bin`
  field ships from the built artifact. The tarball audit (D-11) is the standing proof it
  survived. [VERIFIED: project.json]

### Pattern 3: newLine + .gitattributes (PKG-01, D-06/D-07, Pitfall 2)

- **`newLine: lf`** goes in `tsconfig.lib.json` `compilerOptions` (the build/ship tsconfig).
  Verified this session: `newLine` is currently absent from EVERY tsconfig in the repo, so this
  is a fresh key. It stabilizes the WHOLE package emit deterministically across hosts (this repo
  builds on Windows arm64 where an unset `newLine` can emit CRLF). Dist-only (gitignored) -- does
  NOT affect the ADD-01 public-surface audit. [VERIFIED: `git grep newLine` -> none]

```jsonc
// tsconfig.lib.json compilerOptions (add one line)
"compilerOptions": {
  "outDir": "../../dist/out-tsc",
  "declaration": true,
  "types": ["node"],
  "newLine": "lf"        // D-06: deterministic LF emit; guards the shebang on non-Windows CI
}
```

- **`.gitattributes`** is NEW at the repo ROOT (verified absent this session). D-07 recommends
  the narrow `*.ts text eol=lf` -- NOT a repo-wide `* text=auto eol=lf` renormalization (that
  would churn the committed `.prettierignore`'d `ng-cli-workspace` `ng new` output + committed
  lockfiles). The `text eol=lf` form normalizes on checkin and forces LF on checkout for `*.ts`.
  Claude's-discretion latitude: a bin-only path rule is acceptable if the planner prefers even
  narrower.

```gitattributes
# .gitattributes (repo root) -- D-07 narrow LF guard on TypeScript source.
# newLine:lf in tsconfig.lib.json is the primary emit guard; this is belt-and-suspenders
# on the SOURCE. Deliberately NOT a repo-wide `* text=auto` (would churn committed fixtures).
*.ts text eol=lf
```

- **Executable bit does NOT matter for `npm i` consumers:** npm sets `0o755` on the bin target
  at install and generates the Windows `.cmd`/`.ps1` shims. `tsc`/`npm pack` emit without `+x`;
  that is fine (only relevant to run-by-path from a raw checkout on POSIX, which is not the
  consumer path). NO build-time chmod. [CITED: STACK.md, PITFALLS.md Pitfall 8]

### Pattern 4: ESM bridge not downleveled (PKG-02, D-08, Pitfall 4)

`bin.ts` compiles under the SAME `tsconfig.lib.json` (which extends `tsconfig.json` ->
`module: nodenext`, `moduleResolution: nodenext`, verified `tsconfig.json:4-5`). NO separate bin
tsconfig. So the transitive `await import('@angular/compiler-cli')` (in
`core/compiler-loader.ts`, reached via `runTypecheck`) survives emit as a native dynamic import
instead of downleveling to `require()` (which throws `ERR_REQUIRE_ESM` on the first real
type-check). `package.json` stays `type: commonjs`. This is the GATE A build invariant that
`gate-a-static.spec.ts` ALREADY proves for `compiler-loader.js`/`executor.js`/`builder.js` --
`bin.js` inherits it, no new tsconfig work. VER-03's nx-free walk (below) is the bin-specific
addition; the ESM-bridge survival is already covered by the existing GATE A positive assertion
on `core/compiler-loader.js`. [VERIFIED: tsconfig.json, gate-a-static.spec.ts]

### Anti-Patterns to Avoid

- **`process.exit(code)` in bin.ts** -- truncates piped stdout (Pitfall 6). Use
  `process.exitCode = code`.
- **A separate `module: commonjs` tsconfig for the bin** -- downlevels the ESM bridge (Pitfall
  4). Share `tsconfig.lib.json`.
- **Importing anything nx into `src/cli/**`** -- reintroduces the 24-06 chalk-chain crash class
  (Pitfall 3). Lint-banned + statically guarded this phase.
- **Repo-wide `.gitattributes` renormalization** -- churns committed fixtures (D-07 deferred
  idea). Narrow `*.ts eol=lf`.
- **Adding `no-console`/`process.exit` bans to the `cli/**` lint block** -- `bin.ts` legitimately
  writes streams + sets the exit code (D-09 difference from the core block).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shebang injection/rewrite | A post-build shebang tool | Author `#!/usr/bin/env node` as source line 1 | `tsc` preserves it verbatim; nothing to rewrite. [CITED: STACK.md] |
| Windows bin shims | A `.cmd`/`.ps1` generator | npm/pnpm/yarn generate them from the `bin` field | Package-manager native; verified at install by Phase 28. |
| Tarball packaging fidelity check | A bespoke tar inspector | `publint --strict` (bin rule) + the existing `tarball-audit` pack/extract scaffolding | Already wired; extend it. |
| Additive-only barrel guard | A new spec | The existing `src/index.drift.ts` + `tsconfig.drift.json` | Standing tripwire already locks the 5 exports. |
| Exit-code / flush semantics | Custom buffering | `process.exitCode` + natural drain | Documented Node flush-safe idiom. |

**Key insight:** This phase is glue and guards over shipped machinery. Every "how do I..." has an
existing seam to mirror (`gate-a-static.spec.ts`, the `core/**` lint block, `tarball-audit`,
`24-ADDITIVE-AUDIT.md`). Re-implementing any of them is the trap.

## VER-03 static guard: bin-static.spec.ts (D-10)

Model on `gate-a-static.spec.ts` verbatim -- reuse its dist-read scaffolding. Two assertion
families:

### (a) Shebang first-line byte-check (no `\r`)

Read the built `dist/packages/angular-typechecker/src/cli/bin.js` with `fs.readFileSync(path,
'utf8')`, split on `\n`, assert the first line is EXACTLY `#!/usr/bin/env node` and that the raw
first line contains no `\r` (CRLF guard, meaningful on the Windows arm64 build host). A robust
check: `content.split('\n')[0] === '#!/usr/bin/env node'` (a trailing `\r` would make it
`'#!/usr/bin/env node\r'` and fail equality) plus an explicit `expect(firstLine).not.toContain('\r')`.

### (b) Static transitive nx-free require-graph walk

**Verified build shape this session** -- the compiled CJS emit uses double-quoted, extensionless,
relative requires:

```
// dist/.../src/cli/main.js (actual, confirmed 2026-07-16)
const emit_advisory_notices_1 = require("../core/emit-advisory-notices");
const console_logger_1 = require("./console-logger");
const run_typecheck_1 = require("../core/run-typecheck");
const tslib_1 = require("tslib");
const node_fs_1 = require("node:fs");
```

So the walk is a small recursive function (Claude's discretion on exact regex):

1. Start at the built `bin.js`. Maintain a `visited` set of absolute file paths.
2. For each file: read it, strip full-line comments (reuse `gate-a-static.spec.ts`'s
   `stripCommentLines` so a `require("@nx/...")` inside a JSDoc cannot false-fail), and extract
   every `require("<spec>")` / `require('<spec>')` specifier via
   `/require\(\s*["']([^"']+)["']\s*\)/g`.
3. **Assert** no specifier matches the nx pattern `/^(@nx\/|nx\/|nx$)/` (matches `@nx/devkit`,
   `nx`, `nx/...`; does NOT match `node:*`, `tslib`, `typescript`, `@angular/*`). If any does,
   fail with the offending file + specifier.
4. **Follow** only RELATIVE specifiers (start with `.`): resolve `path.join(dir(file), spec +
   '.js')`, recurse if not visited. Bare specifiers (`tslib`, `node:*`) are CHECKED but not
   followed (they are leaf dependencies, and `node:*` are builtins).

`@angular/compiler-cli` never appears in the require graph (it is reached via `await import()`),
so it neither trips nor needs special-casing. The walk terminates because relative requires form
a DAG within `dist/.../src/`.

### Placement + wiring

- File: `packages/angular-typechecker/src/cli/bin-static.spec.ts`.
- It rides the `test` tier automatically: the `test` target's Vitest glob is
  `{src,tests}/**/*.{test,spec}.{...}` (verified `vitest.config.mts:14`), and `test` has
  `dependsOn: ["build"]` (verified `project.json:101-103`), so the dist is built before the
  spec reads it. NO project.json change.
- **packageRoot derivation differs from gate-a by ONE level.** `gate-a-static.spec.ts` is at
  `src/executors/typecheck/` and walks UP 3 (`'..','..','..'`). `bin-static.spec.ts` at `src/cli/`
  walks UP **2** (`'..','..'`) to reach the package root. Derive `distRoot` from `project.json`
  `build.options.outputPath` exactly as gate-a does (do NOT hard-code `dist/...`).
- Import `findWorkspaceRoot` from `@workspace/test-util` (same as gate-a).
- Static/test-tier ONLY. The RUNTIME `require.cache` module-graph probe on the INSTALLED bin is
  Phase 28 (VER-04). No cold-start-budget assertion (deferred).

## CLI-03 enforcement half: the src/cli/** ESLint block (D-09)

Mirror the `**/src/core/**/*.ts` `no-restricted-imports` block (`eslint.config.mjs:16-64`) into a
NEW `**/src/cli/**/*.ts` block, with the import-ban ONLY -- OMIT the core block's `no-console` and
`no-restricted-properties: process.exit` rules (the CLI adapter owns I/O + exit). Add it as a new
config object after the core block, before the `**/*.json` block.

```javascript
// eslint.config.mjs -- NEW block, mirrors the core/** paths/patterns, import-ban ONLY.
{
  files: ['**/src/cli/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'nx', message: 'cli/ must be nx-free (D-09).' },
          { name: '@nx/devkit', message: 'cli/ must not import @nx/devkit (D-09).' },
          { name: '@angular-devkit/architect', message: 'cli/ must not import the Angular CLI architect (D-09).' },
        ],
        patterns: [
          { group: ['@nx/*'], message: 'cli/ must not import any @nx/* package (D-09).' },
          { group: ['@angular-devkit/*'], message: 'cli/ must not import any @angular-devkit/* package (D-09).' },
          // Optional (Claude's discretion): also ban reaching the adapter modules + the barrel.
          // The nx/@nx bans already make cli/ nx-free; these make intent explicit.
          { group: ['**/executors/**', '**/builders/**', '**/generators/**', '**/schematics/**'],
            message: 'cli/ is a thin adapter over core/**, not over another adapter (D-09).' },
          { group: ['../index', '../index.js'], message: 'cli/ imports core modules directly, not the public barrel (D-09).' },
        ],
      },
    ],
    // NO no-console, NO no-restricted-properties process.exit -- bin.ts writes streams + sets exit.
  },
},
```

**Confirmed it will not break existing code:** the shipped `src/cli/*.ts` (`main.ts`,
`parse-args.ts`, `console-logger.ts`) import ONLY `node:*`, `../core/*` (by relative path, NOT
the barrel), `./parse-args`, `./console-logger`, and the type-only `../core/logger` -- none of
which hit the bans (verified by reading all three files). `bin.ts` will import only `./main`.
The `spec.ts` files are also under `src/cli/**` and match the `files` glob -- confirm they import
nothing banned (`bin-static.spec.ts` imports `node:fs`/`node:path`/`node:url`/`vitest`/
`@workspace/test-util`, all clear). The `no-console`/`process.exit` OMISSION is what lets
`bin.ts` legitimately do its job. [VERIFIED: main.ts, parse-args.ts, console-logger.ts]

## PKG-01 publint tarball audit: extend tarball-audit.e2e.spec.ts (D-11)

The existing spec (`e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts`) already:
packs fresh dist into an OS-temp dir via `npm pack --json --pack-destination`, records
`filePaths` (package-relative, no `package/` prefix), extracts into `extractDir/package`, reads
the packed `package.json`, and runs `npx publint "<tgz>" --strict` + `npx attw`. Extend it (do
NOT create a new spec):

1. **Add `src/cli/bin.js` to `REQUIRED_FILES`** (the positive file-set the "ships the required
   published files" `it` iterates). This asserts the compiled bin ships. The existing leak guard
   excludes `.spec.` so `bin-static.spec.ts` never leaks (also excluded from the tarball by
   `tsconfig.lib.json`'s `src/**/*.spec.ts` exclude). [VERIFIED: tarball-audit spec REQUIRED_FILES]

2. **Add a new describe/it block** (name it for v0.2.2 PKG-01 -- note the file's EXISTING
   `describe('PKG-02: ...')` header is the v0.2.0 milestone's packaging requirement, an unrelated
   id collision; use a distinct block heading like `CLI-01/PKG-01: the packed tarball ships a
   runnable bin`):
   - Extend the `TarballManifest` interface with `bin?: Record<string, string>`.
   - Read `extractDir/package/package.json`; assert
     `manifest.bin?.['angular-typechecker'] === './src/cli/bin.js'` AND
     `manifest.bin?.['atc'] === './src/cli/bin.js'` (both names -> the one compiled entry).
   - Assert `filePaths` contains `src/cli/bin.js` (the mapped target actually ships inside the
     tarball).
   - Read `extractDir/package/src/cli/bin.js`; assert its first line is exactly
     `#!/usr/bin/env node` with no `\r` (`content.split('\n')[0] === '#!/usr/bin/env node'` +
     `.not.toContain('\r')`). This is the PUBLISHED-artifact half of the shebang guard (VER-03 is
     the dist half).

3. **publint bin coverage is automatic** once `bin` exists: the existing `publint --strict`
   assertion already runs against the `.tgz`, and publint's `bin` rule requires the referenced
   file to start with a shebang -- so a missing/CRLF shebang or a mispathed `bin` fails publint
   without further wiring. Keep the assertion; it now covers the bin.

This closes PKG-01's published-artifact half IN-PHASE (REVERSIBLE per D-11 -- if the planner
finds the packed-tarball assertion better belongs beside Phase 28's new install-and-run project,
the dist-level VER-03 guard remains Phase 27's authoritative proof either way).

**e2e tier note:** the `e2e` target builds dist first (its `dependsOn`), packs, and runs
SEQUENTIALLY on the main tree under the serialized config (300000ms). The Windows tar drive-letter
gotcha is already handled in the spec (relative `-C` under `cwd=packDest`). No new harness work.

## ADD-01 additive-only audit (D-12)

Prove the whole milestone additive-only vs the concrete `angular-typechecker@0.2.1` tag (verified
present this session via `git tag -l`). Three legs + a doc:

### (a) Barrel-drift tripwire stays green

`src/index.drift.ts` + `tsconfig.drift.json` lock the 5 barrel exports (`runTypecheck`,
`TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`). It runs via the
`typecheck` target's `tsc --noEmit -p .../tsconfig.drift.json` (verified `project.json:94`). A
removed/renamed export fails `tsc` LOUDLY. Confirm green in the phase's `nx typecheck` run.
[VERIFIED: index.drift.ts, tsconfig.drift.json, project.json]

### (b) Git-diff the public surface vs `angular-typechecker@0.2.1`

Run per-path diffs (baseline `angular-typechecker@0.2.1`, NOT `0.2.0` -- this milestone's
baseline is the last shipped version):

```bash
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/index.ts
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/executors/typecheck/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/builders/typecheck/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/src/generators/configuration/schema.json \
                                            packages/angular-typechecker/src/generators/init/schema.json
git diff angular-typechecker@0.2.1..HEAD -- packages/angular-typechecker/executors.json \
                                            packages/angular-typechecker/generators.json \
                                            packages/angular-typechecker/builders.json \
                                            packages/angular-typechecker/collection.json
```

Expected verdict: the Nx executor id (`angular-typechecker:typecheck`), the
`runTypecheck`/`CoreResult`/`CoreOptions` barrel, the Angular CLI builder, and all
generator/executor/builder schemas are byte-unchanged (Phases 25/26 touched `core/`
internals + added `src/cli/**`, none of which is public surface). The `executor.ts` logger swap
(Phase 25) is internal + observably identical. Confirm each diff is empty on the audited paths
(or, if `package.json` shows the `bin` field, that is net-new additive, not a change to an
existing public contract).

### (c) Confirm bin + src/cli/** are net-new

`git cat-file -e angular-typechecker@0.2.1:packages/angular-typechecker/src/cli/bin.ts` should
report the path absent at the tag (net-new). The `bin` field did not exist in the `0.2.1`
manifest (verified: current `package.json` has no `bin` -- it is added THIS phase). Both are
additive by construction.

### (d) Write 27-ADDITIVE-AUDIT.md

Model on `.planning/milestones/v0.2.1-phases/24-.../24-ADDITIVE-AUDIT.md` (read this session):
- A **Verdict** paragraph ("ADDITIVE-ONLY HOLDS ... v0.3.0 is NOT triggered").
- A **Guard cross-check map** table (barrel drift tripwire + the existing nx-surface / schema
  parity regression specs, all present + green).
- A **Git-diff verdict per audited path** table (UNCHANGED / WIDEN-ONLY / net-new).
- A **New-file additions** table (`src/cli/*`, the `bin` field).
- An **ADD-01 disposition** paragraph.

## Common Pitfalls

### Pitfall 1: process.exit truncates piped stdout (Pitfall 6, HIGH)
**What goes wrong:** `process.exit(code)` right after a large `renderReport` write drops the tail
on a PIPE (CI + e2e `execSync`). **Avoid:** `process.exitCode = code` + return (D-02). **Warning
sign:** an intermittent `toContain('TS2322')` failure that passes on re-run, fine in a TTY.

### Pitfall 2: CRLF shebang on the Windows arm64 build host (Pitfall 2, HIGH)
**What goes wrong:** `#!/usr/bin/env node\r` -> `env: 'node\r': No such file or directory` on
Linux/macOS. **Avoid:** `newLine: lf` (D-06) + `.gitattributes` (D-07). **Detect:** VER-03's
first-line byte-check + the tarball audit's shebang check.

### Pitfall 3: nx leaks transitively into the bin (Pitfall 3, HIGH -- the 24-06 crash class)
**What goes wrong:** importing an adapter module drags `@nx/devkit` -> chalk chain -> yarn-4-hoist
crash. **Avoid:** import only `./main` -> `../core/**`; the `cli/**` lint block (D-09) + the
static require walk (D-10). **Detect:** the walk fails on any `@nx/`/`nx` specifier.

### Pitfall 4: ESM bridge downleveled (Pitfall 4, HIGH)
**What goes wrong:** a separate `module: commonjs` bin tsconfig turns `await import()` into
`require()` -> `ERR_REQUIRE_ESM`. **Avoid:** NO separate tsconfig (D-08); share `tsconfig.lib.json`.
**Detect:** the existing GATE A positive assertion on `core/compiler-loader.js`.

### Pitfall 5: bin field dropped/mispathed in the published artifact (Pitfall 8, MEDIUM)
**What goes wrong:** `bin` present in source but absent from `dist/.../package.json`, or points at
`.ts`, or `bin.js` not shipped. This repo shipped a packaging defect of this shape before (0.0.1-
0.1.0 raw `.ts`, fixed in 0.1.1). **Avoid/Detect:** the tarball audit (D-11) asserts the packed
`bin` map + the shipped `bin.js` + publint. **Note:** `bin.js` ships under `src/` which `files`
already whitelists -- but the audit proves it, does not assume it.

## Code Examples

Verified patterns from the actual codebase (cite when planning tasks):

### Dist-read static spec scaffolding (mirror for bin-static.spec.ts)
```typescript
// Source: packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts
// packageRoot for bin-static is 2 levels up (src/cli/), NOT 3 like gate-a (src/executors/typecheck/).
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..'); // src/cli -> src -> packageRoot
const workspaceRoot = findWorkspaceRoot(packageRoot);
const projectJson = JSON.parse(readFileSync(join(packageRoot, 'project.json'), 'utf8'));
const distRoot = join(workspaceRoot, projectJson.targets.build.options.outputPath);
const binJsPath = join(distRoot, 'src', 'cli', 'bin.js');
```

### Built CJS require shape the walk parses (verified 2026-07-16)
```javascript
// Source: dist/packages/angular-typechecker/src/cli/main.js (actual built output)
const run_typecheck_1 = require("../core/run-typecheck");   // relative -> follow
const console_logger_1 = require("./console-logger");        // relative -> follow
const tslib_1 = require("tslib");                            // bare -> check, do not follow
const node_fs_1 = require("node:fs");                        // builtin -> check, do not follow
// nx pattern to assert-absent: /^(@nx\/|nx\/|nx$)/  (matches @nx/devkit, nx, nx/...; not node:*, tslib)
```

## Runtime State Inventory

> **Not applicable.** This is an additive packaging phase, not a rename/refactor/migration. No
> stored data, live-service config, OS-registered state, secrets, or build artifacts carry a
> renamed string. The one build-artifact consideration -- the compiled `bin.js` and the copied
> manifest under `dist/` (gitignored) -- is produced fresh by `nx build` and proven by the VER-03
> static guard + the tarball audit; there is no stale artifact to migrate. **Verified:** the phase
> adds files + config keys and edits no existing runtime-persisted state.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.exit(code)` to end a CLI | `process.exitCode = code` + natural drain | long-established Node idiom | flush-safe on pipes (Pitfall 6) |
| Rewrite shebang post-build | Author it in source; `tsc` preserves it | TS preserves `#!` on emit | no shebang tooling needed |
| `attw` as a bin gate | `publint` bin rule | -- | attw is type-resolution-focused; bins are not type-facing |

**Deprecated/outdated:** the ARCHITECTURE.md draft's `process.exit(exitCode)` in `bin.ts` is
superseded by D-02's `process.exitCode = exitCode` (flush-safety). Plan to the CONTEXT decision,
not the older draft.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript/`@nx/js:tsc` preserves a leading `#!/usr/bin/env node` on emit and does not relocate it. | Shebang survival | LOW -- CITED (STACK.md sources: microsoft/TypeScript#10382/#45319) and PROVEN at build time by VER-03's first-line byte-check + the tarball audit. If wrong, both specs fail LOUDLY (not a silent ship). |
| A2 | `process.exitCode = code` + natural event-loop drain flushes queued piped stdout writes before exit. | bin.ts shape | LOW -- documented Node behavior; the inverse (`process.exit` truncation) is the well-attested Pitfall 6. The Phase 28 install-and-run e2e (piped `execSync` capturing the full tail) is the runtime confirmation. |

**Everything else is VERIFIED against the codebase this session** (bin absent, newLine absent,
.gitattributes absent, 0.2.1 tag present, publint/attw devDeps present, built require shape, test
glob + dependsOn, files whitelist, cli/* imports, drift tripwire wiring) or CITED from this
milestone's HIGH-confidence research (PITFALLS/ARCHITECTURE/STACK).

## Open Questions

None blocking. Two items are resolved-by-design and simply need the standing specs green:
1. **Shebang survival through `@nx/js:tsc`** -- resolved by writing VER-03 (dist) + the tarball
   audit (published). Both fail loudly if it regresses.
2. **`.gitattributes` scope** -- Claude's discretion within D-07 (recommend `*.ts eol=lf`; a
   bin-only path rule is acceptable).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test/e2e | Yes | `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` (engines) | -- |
| `nx` / `@nx/js:tsc` | build | Yes | `23.0.1` | -- |
| `typescript` (`tsc`) | build/drift/typecheck | Yes | `>=6.0.0 <6.1.0` | -- |
| `publint` | tarball audit (PKG-01) | Yes (root devDep) | `0.3.21` | -- |
| `@arethetypeswrong/cli` | tarball audit (existing) | Yes (root devDep) | `0.18.4` | -- |
| `tar` / `npm pack` | tarball audit e2e | Yes (system + npm) | -- | -- |

**Missing dependencies with no fallback:** none. **With fallback:** none. The phase installs
nothing.

## Validation Architecture

> `workflow.nyquist_validation: true` (verified `.planning/config.json`). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (via `@nx/vitest:test`) |
| Config file | `packages/angular-typechecker/vitest.config.mts` (`test` tier); `e2e/angular-typechecker-install-e2e/vitest.config.mts` (`e2e` tier) |
| Quick run command | `nx test angular-typechecker` (builds first via `dependsOn: ["build"]`) |
| Full suite command | `nx build angular-typechecker && nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker` |
| e2e command | `nx e2e angular-typechecker-install-e2e` (packs tarball, runs publint/attw + bin audit) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-03 | Built `bin.js` first line is a `\r`-free `#!/usr/bin/env node` | unit/static (`test` tier, dist read) | `nx test angular-typechecker` | NO -- Wave 0 (`src/cli/bin-static.spec.ts`) |
| VER-03 | Built bin `require` graph never reaches `@nx/*`/`nx` | unit/static (`test` tier) | `nx test angular-typechecker` | NO -- Wave 0 (same spec) |
| CLI-01 / PKG-01 | Packed tarball `bin` maps both names -> shipped `src/cli/bin.js` | e2e (tarball) | `nx e2e angular-typechecker-install-e2e` | PARTIAL -- extend `tarball-audit.e2e.spec.ts` |
| PKG-01 | Packed `src/cli/bin.js` first line is a `\r`-free shebang | e2e (tarball) | `nx e2e angular-typechecker-install-e2e` | PARTIAL -- extend same spec |
| PKG-01 | `publint --strict` passes for the bin | e2e (tarball) | `nx e2e angular-typechecker-install-e2e` | YES -- existing publint assertion covers bin once `bin` exists |
| PKG-02 | `await import()` bridge not downleveled (bin inherits `module: nodenext`) | unit/static (`test` tier) | `nx test angular-typechecker` (existing `gate-a-static.spec.ts` positive assertion) | YES -- existing GATE A spec |
| CLI-03 (enforce) | `src/cli/**` imports nothing nx | lint-time | `nx lint angular-typechecker` (maxWarnings:0) | NO -- Wave 0 (eslint.config.mjs block) |
| ADD-01 | Barrel exports byte-unchanged (5 exports locked) | typecheck (drift) | `nx typecheck angular-typechecker` (`tsc --noEmit -p tsconfig.drift.json`) | YES -- existing `src/index.drift.ts` |
| ADD-01 | Public surface additive-only vs `0.2.1` | one-off audit doc + git-diff | `git diff angular-typechecker@0.2.1..HEAD -- <paths>` | NO -- Wave 0 (`27-ADDITIVE-AUDIT.md`) |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (fast tier; builds + runs the static guard).
- **Per wave merge:** `nx build && nx test && nx typecheck && nx lint angular-typechecker` (adds
  drift + lint gates); `nx e2e angular-typechecker-install-e2e` for the tarball extension.
- **Phase gate:** full suite green + the e2e tarball audit green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/cli/bin.ts` -- the shell itself (CLI-01/EXIT-02).
- [ ] `packages/angular-typechecker/src/cli/bin-static.spec.ts` -- covers VER-03 (shebang +
      nx-free walk).
- [ ] `eslint.config.mjs` `src/cli/**` block -- covers CLI-03 enforcement half.
- [ ] `e2e/.../tarball-audit.e2e.spec.ts` bin describe block -- covers PKG-01 published half.
- [ ] `27-ADDITIVE-AUDIT.md` + git-diff run -- covers ADD-01.
- [ ] Config edits (no test): `package.json` `bin`, `tsconfig.lib.json` `newLine`,
      `.gitattributes`.

### Deferred to Phase 28 (do NOT over-scope this phase's validation)
- Install-and-RUN e2e for literal exit `0`/`1`/`2` through the real PM `.bin` shim (npm + yarn
  flat/workspace + pnpm; Linux + Windows) -- a NEW `angular-typechecker-cli-e2e` project (VER-04).
- The RUNTIME `require.cache` module-graph probe on the INSTALLED bin (VER-04) -- distinct from
  this phase's STATIC dist-read walk.
- Real-clone UAT (radix-ng/primitives, analogjs/analog, ngx-leaflet, realworld-angular) (VER-05).

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` -> treated as enabled. This is a
> packaging phase; most ASVS categories (auth/session/access-control) do not apply. The relevant
> surface is supply-chain + the published tarball.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / Supply Chain | yes | Ship both `bin` names but steer docs to `npx angular-typechecker` (never `npx atc`) -- `atc@0.0.6` is an unrelated published package (Pitfall 5). Docs are Phase 29; THIS phase just ships the names. |
| V5 Input Validation | partial | The `-p`/`--tsConfig` path reaches `ts`/`fs` APIs, never a shell -- no path-injection surface. Already true in the shipped `run()`. |
| V10 Malicious Code / Packaging | yes | The tarball must declare NO install lifecycle scripts (`preinstall`/`install`/`postinstall`/`prepare`/`prepublish`). ALREADY guarded by the existing `tarball-audit` `INSTALL_SCRIPT_KEYS` assertion -- the bin adds no script, so this stays green. |
| V2/V3/V4/V6 (authn/session/access/crypto) | no | No auth, session, access control, or cryptography in a type-check CLI. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `npx atc` fetches foreign `atc@0.0.6` | Spoofing / Elevation | Canonical docs use `npx angular-typechecker` (Phase 29); the shipped `--help` already says so (Phase 26 D-11). This phase ships the alias but adds no npx-fetchable advertising. |
| `postinstall` payload in the published tarball (s1ngularity vector) | Tampering | Existing `INSTALL_SCRIPT_KEYS` tarball-audit gate; unchanged by the bin. |
| nx/chalk chain crash on a non-Nx consumer (24-06) | Denial of Service | nx-free `cli/**` lint block (D-09) + the static require walk (D-10). |

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `src/cli/main.ts`, `src/cli/parse-args.ts`,
  `src/cli/console-logger.ts` (the shipped `run()` + seams `bin.ts` wraps);
  `src/executors/typecheck/gate-a-static.spec.ts` (the VER-03 model); `eslint.config.mjs`
  (the `core/**` block to mirror); `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.drift.json`
  (module nodenext, no newLine, drift wiring); `package.json` (no `bin`, `files` whitelist,
  version 0.2.1); `project.json` (build outputPath, test dependsOn build, packageRoot);
  `src/index.ts`/`src/index.drift.ts` (5 barrel exports); `e2e/.../tarball-audit.e2e.spec.ts`
  (the extend target); `vitest.config.mts` (test glob).
- Shell verifications this session: `.gitattributes` absent; `angular-typechecker@0.2.1` tag
  present; `newLine` absent from all tsconfigs; `publint@0.3.21` + `@arethetypeswrong/cli@0.18.4`
  root devDependencies; built `dist/.../src/cli/main.js` require shape.
- `.planning/milestones/v0.2.1-phases/24-.../24-ADDITIVE-AUDIT.md` (the ADD-01 doc model).

### Secondary (HIGH -- this milestone's own research, 4 researchers converged)
- `.planning/research/v0.2.2-standalone-cli/PITFALLS.md` (Pitfalls 2/3/4/6/8; "Looks Done But
  Isn't" checklist).
- `.planning/research/v0.2.2-standalone-cli/ARCHITECTURE.md` (third-thin-adapter; bin.ts shape).
- `.planning/research/v0.2.2-standalone-cli/STACK.md` (bin conventions; publint bin rule; shebang
  preservation; no new dependency).
- `.planning/phases/26-.../26-CONTEXT.md` (the `run()` contract + D-15 nx-free boundary this phase
  enforces).

### Tertiary (MEDIUM -- flagged in Assumptions Log)
- TypeScript shebang preservation on emit (microsoft/TypeScript#10382/#45319, via STACK.md) --
  MEDIUM, proven at build time by VER-03 + the tarball audit.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero additions; every tool verified present this session.
- Architecture (bin shell / packaging): HIGH -- grounded in the shipped `run()` + the existing
  GATE A / lint / tarball / drift seams; D-02 flush-safe pattern is a documented Node idiom.
- Pitfalls: HIGH -- inherited verbatim from this milestone's converged PITFALLS.md, each mapped to
  a standing guard.

**Research date:** 2026-07-16
**Valid until:** ~2026-08-15 (stable -- config + codebase-grounded; no fast-moving external
dependency).
