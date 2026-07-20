# Phase 26: Pure CLI core + exit-code wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 26-pure-cli-core-exit-code-wiring
**Mode:** `--auto` (autonomous, no interactive prompts) `--analyze` `--chain`
**Areas discussed:** CWD + report path base, --max-warnings validation, color-detection precedence, --version + --help content

> Note: this phase is exhaustively pre-specified by the ROADMAP success criteria,
> the locked REQUIREMENTS, and the HIGH-confidence v0.2.2 research (all four
> researchers converged; "skip --research-phase"). Most load-bearing choices were
> already LOCKED upstream; the four gray areas below are the genuinely-open
> implementation forks. Each was rated IMPACT x CONFIDENCE per the trap-quadrant
> rule; none was HIGH-impact AND NOT-HIGH-confidence, so all were auto-locked to
> the recommended option without escalation.

---

## CWD + report path base (GA-1)

| Option | Description | Selected |
|--------|-------------|----------|
| cwd-relative | `run()` resolves relative `--tsConfig` against `process.cwd()`; `pathBase = cwd` -> cwd-relative diagnostic paths (tsc/ngc/eslint parity) | [x] |
| absolute | `pathBase` unset -> absolute diagnostic paths (portable, cwd-independent) | |

**Auto-selection:** cwd-relative (recommended default).
**Notes:** IMPACT low + reversible (one-line pathBase change), CONFIDENCE high.
Reading `process.cwd()` is a read, not a stream write -- EXIT-02 (`run()` never
writes / never `process.exit`) still holds. The locked `run(argv, env)` signature
is preserved; cwd is NOT threaded as a third param. Windows normalization (`\`->`/`
+ `realpathSync.native`) applied before the boundary filter (PKG-03).

---

## --max-warnings validation (GA-2)

| Option | Description | Selected |
|--------|-------------|----------|
| non-negative integer only | reject NaN / float / negative as usage error -> exit 2 with a clear message | [x] |
| any integer | accept negatives, pass through as unset (evaluateResult defensive behavior) | |

**Auto-selection:** non-negative integer only (recommended default).
**Notes:** IMPACT low, CONFIDENCE high. Honors ARGS-04 ("non-integer -> 2") and is
clearer UX than silently ignoring a `-1` typo. `--max-warnings 0` stays valid.

---

## Color-detection precedence (GA-3)

| Option | Description | Selected |
|--------|-------------|----------|
| NO_COLOR > FORCE_COLOR > TTY | NO_COLOR (any value) off; else FORCE_COLOR (not 0/false) on; else stdout.isTTY | [x] |
| FORCE_COLOR > NO_COLOR > TTY | FORCE_COLOR overrides NO_COLOR | |

**Auto-selection:** NO_COLOR > FORCE_COLOR > TTY (recommended default).
**Notes:** IMPACT low, CONFIDENCE high. Follows the NO_COLOR informal standard
(NO_COLOR wins -- a user sets it to GUARANTEE no color). Computed in `run()` from
the `env` param; feeds `renderReport({ color })` (ARGS-05).

---

## --version + --help content (GA-4)

| Option | Description | Selected |
|--------|-------------|----------|
| require package.json | `--version` = `require('../../package.json').version`, drift-locked by a test | [x] |
| build-time constant | generate a version constant at build | |

**Auto-selection:** require package.json (recommended default).
**Notes:** IMPACT low, CONFIDENCE high. CJS JSON `require` works under
`module: nodenext`; the build-time constant was rejected (adds machinery for no
benefit). `--help`/`--version` -> stdout, exit 0. `--help` MUST show
`npx angular-typechecker`, NEVER `npx atc` (Pitfall 5: `atc@0.0.6` is a foreign
package). Minimal synopsis this phase; full prose README is Phase 29.

---

## Claude's Discretion

- Internal file/function/class naming within `src/cli/` (`main.ts` vs `run.ts`;
  `BufferingLogger` name; parse+validate as one function or two).
- Exact `--help` / usage wording (must use `npx angular-typechecker`, list the
  flags + the 0/1/2 exit codes).
- VER-02 fixture layout / reuse of existing real-compiler fixtures.

## Deferred Ideas

- `bin.ts` + `package.json` `bin` + shebang/CRLF + `process.exit`/flush-safety --
  Phase 27.
- `src/cli/**` ESLint import-ban + `bin-static.spec.ts` module-graph guard --
  Phase 27.
- Shipped-tarball e2e + real-clone UAT -- Phase 28.
- README + CHANGELOG -- Phase 29.
- JSON/SARIF reporters, `--watch`, `--quiet`/explicit `--color`/`--project` alias
  -- Future Requirements (out of scope).
