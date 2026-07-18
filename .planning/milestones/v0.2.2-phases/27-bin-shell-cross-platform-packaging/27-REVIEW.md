---
phase: 27-bin-shell-cross-platform-packaging
reviewed: 2026-07-16T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - packages/angular-typechecker/src/cli/bin.ts
  - packages/angular-typechecker/src/cli/bin-static.spec.ts
  - packages/angular-typechecker/src/cli/main.spec.ts
  - packages/angular-typechecker/package.json
  - packages/angular-typechecker/tsconfig.lib.json
  - packages/angular-typechecker/eslint.config.mjs
  - .gitattributes
  - e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-07-16T00:00:00Z
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 27 ships the standalone-CLI bin shell (`bin.ts`) plus the cross-platform
packaging guards (LF shebang via `newLine: lf` + `.gitattributes`, the two-name
`bin` map, a static dist-read spec, and tarball-audit extensions) over the
Phase-26 pure `run()` core.

The core contracts hold up under a deep cross-file trace:

- **bin.ts is genuinely nx-free.** Traced the full compiled require graph
  `bin -> main -> {../core/*, ./console-logger, ./parse-args}`. Every reachable
  core module imports only Node stdlib, type-only symbols, and sibling core
  modules; no `@nx/*` / `nx` / `nx/...` specifier appears anywhere in the graph
  (`git grep` over `src/core/*.ts` + `src/cli/*.ts` confirms). `@angular/compiler-cli`
  is reached via `await import()`, so it never emits as a `require()` and never
  enters the walk.
- **bin.ts is flush-safe.** It uses `.then/.catch` (no top-level await under
  `type: commonjs`), sets `process.exitCode` and returns (never `process.exit`),
  and maps an unknown reject to exit 2. Correct.
- **`newLine: lf` is in the right tsconfig.** `project.json` `build.options.tsConfig`
  points at `tsconfig.lib.json`, which is exactly where `newLine` was added, so the
  `@nx/js:tsc` build emits an LF shebang. `.gitattributes` `*.ts text eol=lf` is a
  correct belt-and-suspenders on the source.
- **The `bin` map + tarball assertions are correct.** Both names resolve to the one
  compiled `./src/cli/bin.js`; `files` ships `src`; the extract-and-assert shebang
  check catches CRLF (a trailing `\r` fails the exact `toBe` compare regardless of
  the redundant `.not.toContain('\r')`).
- **The main.spec.ts `vi.fn()` change does NOT weaken any assertion.** `beforeEach`
  re-sets `mockResolvedValue(SENTINEL_REPORT)`, so runtime behavior is byte-identical;
  the change is a pure `.mock.calls` typing fix so `lastColor()` can read index `[1]`.
- **The eslint cli block is additive, not clobbering.** The base config sets no
  `no-restricted-imports`, so the new `src/cli/**` block is the sole matcher for that
  rule on cli `.ts` files; ordering (after core/**, before the JSON blocks) is correct.

The findings below are robustness/quality nits at the single stream-write boundary
and two latent-completeness gaps in the guards. No correctness, security, or data-loss
defect was found.

## Warnings

### WR-01: bin.ts has no `error` handler on stdout, so an early-closed downstream pipe surfaces as an uncaught EPIPE crash

**File:** `packages/angular-typechecker/src/cli/bin.ts:13-19`
**Issue:** `bin.ts` is the designated "only stream-write site" and is explicitly
designed to survive piped stdout (the comment at 21-24 keeps `process.exitCode`
instead of `process.exit` precisely to avoid truncating a piped tail). But the tool's
own reason for existing is fast feedback, and a report piped to a reader that quits
early -- e.g. `atc -c tsconfig.app.json | head` or `... | less` then `q` -- closes the
pipe before the write drains. Node surfaces that as an asynchronous `EPIPE` `error`
event on `process.stdout`. With no listener, that becomes an uncaught exception: the
process dies with a stack dump on stderr and a non-deterministic exit code, defeating
the whole "clean 0/1/2 exit" contract. The `.catch` at line 27 does NOT cover it --
EPIPE is emitted async on the stream, not thrown into the promise chain.
**Fix:** Swallow a broken-pipe error at the write boundary, e.g.:
```ts
function writeSafely(stream: NodeJS.WriteStream, chunk: string): void {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') {
      process.exit(0);
    }

    throw err;
  });
  stream.write(chunk);
}
```
or register a one-time `process.stdout.on('error', ...)` guard that treats `EPIPE`
as a clean exit. (For the documented full-capture flows -- CI, the e2e `execSync`
capture -- the reader consumes all output, so this never trips; it only bites
interactive piping. Still a real, reproducible crash surface for a shipped bin.)

### WR-02: bin.ts writes buffered stderr without a trailing newline, inconsistent with its own crash path

**File:** `packages/angular-typechecker/src/cli/bin.ts:17-19` (vs `30-32`)
**Issue:** `run()` returns `stderr` as `BufferingLogger.text`, which is
`lines.join('\n')` -- no trailing newline (verified in `console-logger.ts:36`).
`bin.ts` writes that string verbatim (`process.stderr.write(stderr)`), so a usage
error or advisory-notice run emits a final stderr line with no terminating newline,
and a subsequent shell prompt (or the next tool's output) runs onto the same line.
The crash path immediately below DOES append `'\n'` (line 31), so the two write paths
at the single designated I/O boundary disagree on line termination. This is a quality
inconsistency at the exact tier that owns terminal formatting.
**Fix:** Terminate the buffered stderr consistently, e.g.:
```ts
if (stderr) {
  process.stderr.write(stderr.endsWith('\n') ? stderr : stderr + '\n');
}
```
(Does not affect the `.toContain(...)` e2e/unit assertions, which are newline-agnostic.)

## Info

### IN-01: bin-static require-walk cannot follow a directory-style relative require

**File:** `packages/angular-typechecker/src/cli/bin-static.spec.ts:99-105`
**Issue:** The transitive nx-free walk follows a relative specifier only by
resolving `join(dirname(file), specifier + '.js')`. A directory import such as
`require("../core")` would need `../core/index.js`, but the code only probes
`../core.js`, which does not exist, so it silently stops descending. The offending
directory specifier is still *checked* against `NX_SPECIFIER` (it is relative, so no
match), so the guard only under-walks; it never false-fails. In practice `@nx/js:tsc`
emits explicit per-file requires (`require("../core/run-typecheck")`), so no directory
import exists today -- this is a latent false-negative, not a current one. The
`NX_SPECIFIER` regex itself (`/^(@nx\/|nx\/|nx$)/`) is complete: it matches bare `nx`,
`nx/...`, and `@nx/...` while correctly excluding `@nxext/*` and `nxyz`.
**Fix:** When `specifier + '.js'` is absent, also probe
`join(dirname(file), specifier, 'index.js')` before giving up, so a future directory
import stays inside the guarded graph.

### IN-02: eslint cli block silently drops the `yargs` restriction the comment implies it mirrors

**File:** `packages/angular-typechecker/eslint.config.mjs:76-125`
**Issue:** The `src/cli/**` block comment says it "Mirrors the core/** block's
no-restricted-imports, but INTENTIONALLY omits no-console and the process.exit ban."
It also omits the `yargs` path entry that the core block bans (lines 36-39), but that
omission is not called out. Because the cli tier is legitimately where arg-parsing
lives (via `node:util` `parseArgs`), banning `yargs` there would be wrong, so the
omission is defensible -- but the "differences from core" note only enumerates
no-console/process.exit, so a future reader could mistake the divergence for an
oversight (or re-add `yargs` "to match core" and break intent). Benign; documentation
completeness only.
**Fix:** Extend the comment to note `yargs` is also intentionally omitted (cli is the
arg-parsing tier), so the divergence from core is fully enumerated.

---

_Reviewed: 2026-07-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
