---
phase: 27
phase_name: "bin-shell-cross-platform-packaging"
project: "angular-typechecker"
generated: "2026-07-16"
counts:
  decisions: 5
  lessons: 4
  patterns: 3
  surprises: 2
missing_artifacts:
  - "27-UAT.md (verification passed with no human_needed items; install-and-run UAT is Phase 28)"
---

# Phase 27 Learnings: bin-shell-cross-platform-packaging

## Decisions

### Flush-safe bin.ts uses process.exitCode + natural drain, never process.exit
`bin.ts` sets `process.exitCode` in both the `.then` and `.catch` and returns; it never calls
`process.exit(code)`. On a pipe (`atc -c tsconfig.json | head`, every CI run, the e2e `execSync`
capture) an immediate `process.exit` truncates the buffered stdout tail, dropping the very `TSxxxx`
code an assertion reads -- a silent wrong verdict.

**Rationale:** Pitfall 6; the "flush-safe on large buffered output" success criterion. The event loop
drains the writes before exiting with the set code.
**Source:** 27-CONTEXT.md D-02, 27-01-SUMMARY.md

### bin.ts uses .then/.catch, not top-level await (type: commonjs)
The package is `type: commonjs`; top-level await is illegal there. The shell wraps `run()` with
`.then/.catch`. The `.catch` maps an unknown throw to `process.exitCode = 2` after writing stderr
(D-03: `run()` re-throws any non-`TypecheckInfrastructureError`).

**Rationale:** RESEARCH flagged this as a planner-facing correction to the ARCHITECTURE draft.
**Source:** 27-RESEARCH.md, 27-01-SUMMARY.md

### src/cli/** ESLint block is an import-ban ONLY (no no-console / no process.exit)
The `**/src/cli/**/*.ts` block mirrors the `**/src/core/**/*.ts` block's `no-restricted-imports`
(bans nx / @nx/* / @angular-devkit/* + adapter modules + the barrel) but deliberately OMITS the
core block's `no-console` and `no-restricted-properties: process.exit` -- bin.ts legitimately writes
streams and sets the exit code. main.ts purity (EXIT-02) is guarded by its unit tests, not lint.

**Rationale:** the CLI tier has one legitimate I/O site (bin.ts); a blanket core-style ban would
forbid it.
**Source:** 27-CONTEXT.md D-09, 27-01-SUMMARY.md

### PKG-01 published-artifact audit EXTENDS the existing tarball-audit spec (zero new dep/project)
`publint` was already a root devDependency and `tarball-audit.e2e.spec.ts` already existed; the bin
map + LF-shebang + publint-bin assertions were added to that spec rather than creating a new spec or
project. Discovered during discuss-phase codebase scout, which dissolved the only real scope-boundary
question.

**Rationale:** additive, no dependency churn; the packed tarball is the right place to prove the
PUBLISHED artifact.
**Source:** 27-CONTEXT.md D-11, 27-02-SUMMARY.md

### ADD-01 baselines against the angular-typechecker@0.2.1 tag (not 0.2.0)
The additive-only git-diff compares HEAD against the LAST shipped tag `angular-typechecker@0.2.1`
(which exists), scoped to the public-surface paths (barrel, executor id, builder, schemas,
executors/generators/builders/collection json). All nine paths were byte-unchanged.

**Rationale:** 0.2.1 shipped after Phase 24; the last-shipped contract is the correct diff base.
**Source:** 27-03-SUMMARY.md, 27-ADDITIVE-AUDIT.md

---

## Lessons

### `nx test` (vitest) green does NOT prove specs type-check -- run the `nx typecheck` target as its own gate
A Phase-26 (`26-02`) spec (`src/cli/main.spec.ts`) shipped a real type error (a zero-arg inline mock
impl typed the mock's `.mock.calls` args as an empty tuple, so a helper reading call-arg index `[1]`
failed `tsc` with TS2493/TS2532). It escaped because **vitest transpiles specs with esbuild WITHOUT
type-checking**, so `nx test` was green -- and 26-02 verified test/lint/format but never ran
`nx run <project>:typecheck` (`tsc --noEmit -p tsconfig.spec.json`). The red typecheck surfaced only
when Phase 27 exercised that gate. Fixed at root in `c25119b` (bare `vi.fn()`, `beforeEach` already
set the resolved value).

**Context:** the authoritative type signals are the build + the typecheck target, NOT the vitest run
and NOT the LSP feed. A phase is not "green" until `nx typecheck` (all tsconfigs incl. spec) passes.
**Source:** 27-01-SUMMARY.md, deferred-items.md D1, commit c25119b

### bin-static.spec.ts walks UP 2 dirs to packageRoot, not 3
`gate-a-static.spec.ts` (the model) sits at `src/executors/typecheck/` and walks up 3 dirs; `bin.ts`
sits at `src/cli/`, so its static guard walks up only 2. Copying the analog verbatim without adjusting
the depth would resolve the wrong `packageRoot`.

**Context:** derive `distRoot` from `project.json` `build.options.outputPath`, never hard-code it.
**Source:** 27-02-SUMMARY.md, 27-RESEARCH.md

### The compiled require graph is double-quoted, extensionless, relative -- the nx-free walk matches on that shape
The built CJS emits `require("../core/run-typecheck")`; the static nx-free walk follows relative
specifiers and checks each against `/^(@nx\/|nx\/|nx$)/` (which correctly excludes `@nxext/*` and
`nxyz`). `@angular/compiler-cli` is reached via `await import()`, not `require`, so it never appears
in the require graph.

**Context:** the walk is `test`-tier and static; the RUNTIME `require.cache` probe on the installed
bin is Phase 28 (VER-04).
**Source:** 27-RESEARCH.md, 27-02-SUMMARY.md, 27-REVIEW.md IN-01

### The heavy e2e tarball tier can be reproduced deterministically on Windows without Verdaccio
PKG-01/CLI-01's published-artifact assertions live in the Linux-CI-authoritative e2e tier
(Windows-Verdaccio-flaky). The nyquist auditor reproduced every assertion deterministically:
`npm pack --json` from dist, extract, `od -c` the shipped `bin.js` first line (`#!/usr/bin/env node\n`,
no `\r`), `npx publint <tgz> --strict` (exit 0) -- no Verdaccio needed, because tarball-audit only
packs locally; only the install-e2e project's globalSetup starts Verdaccio.

**Context:** the always-run deterministic guard for the same bytes is the `test`-tier
`bin-static.spec.ts`.
**Source:** 27-VALIDATION.md Validation Audit, 27-02-SUMMARY.md

---

## Patterns

### Static build-artifact guard (dist byte-read + transitive relative-require walk)
Model on `gate-a-static.spec.ts`: `test` tier (`dependsOn: build`), derive `distRoot` from
`project.json` `build.options.outputPath`, `fs.readFileSync` the built `.js`, `stripCommentLines`,
assert on bytes (shebang first-line) + walk the transitive relative-`require` graph asserting a
banned-specifier regex never appears.

**When to use:** proving a build-emit invariant survived `@nx/js:tsc` (shebang preservation, no
ESM->require downlevel, an import-boundary) deterministically and fast, without packing or spawning.
**Source:** 27-02 (bin-static.spec.ts), 27-CONTEXT.md D-10

### Additive-only audit = drift tripwire + per-path git-diff vs the last shipped tag + net-new confirmation
(1) A standing barrel-drift tripwire (`src/index.drift.ts` under `tsconfig.drift.json`, rides
`nx typecheck`) fails loudly on a removed/renamed export; (2) `git diff <last-tag>..HEAD -- <public
paths>` proves byte-unchanged; (3) `git ls-tree`/`git cat-file` confirms new files/fields are net-new
at the tag. Verdict recorded in `NN-ADDITIVE-AUDIT.md` on the `24-ADDITIVE-AUDIT.md` model.

**When to use:** any patch/minor that must prove it did not break a published contract (the 0.x
additive-only charter; the v0.3.0 escape hatch).
**Source:** 27-03, 27-ADDITIVE-AUDIT.md

### vi.fn() call-arg typing: bare vi.fn() when the test reads call-arg indices
A `vi.fn(async () => X)` with a zero-arg inline impl types `.mock.calls` elements as an empty tuple,
breaking any `.mock.calls.at(-1)?.[i]` read at `tsc` time. Use a bare `vi.fn()` (args `any[]`, like a
sibling mock) and set the return in `beforeEach` via `mockResolvedValue`.

**When to use:** any vitest mock whose test helpers introspect `.mock.calls[...][index]`.
**Source:** commit c25119b, 27-01-SUMMARY.md

---

## Surprises

### The full Verdaccio install-e2e actually passed on Windows this session
Despite the documented Windows-Verdaccio robustness issues (127.0.0.1 bind / ECONNREFUSED; heavy e2e
is Linux-only by default), the 27-02 executor ran the full `nx e2e angular-typechecker-install-e2e`
(11 files / 40 tests, incl. the extended tarball-audit) GREEN on the Windows arm64 host.

**Impact:** extra confidence beyond the deterministic reproduction; but the tier stays
Linux-CI-authoritative -- do not rely on Windows-local e2e as the gate.
**Source:** 27-02-SUMMARY.md

### The flush-safe bin.ts still has an uncovered EPIPE path (a robustness follow-up)
The `process.exitCode` + drain design (which fixes the truncation Pitfall) does NOT cover an
early-closed downstream pipe (`atc ... | head`): stdout emits an async EPIPE with no listener, which
the `run().catch` cannot cover -> an uncaught crash. Flagged Warning by code review; deferred as a
follow-up outside the phase's locked decisions, and a natural target for Phase 28's real piped e2e.

**Impact:** a real robustness gap for a CLI built for CI/agent pipelines; not a phase blocker.
**Source:** 27-REVIEW.md WR-01
