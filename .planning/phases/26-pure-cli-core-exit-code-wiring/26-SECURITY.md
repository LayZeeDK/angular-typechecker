---
phase: 26
slug: pure-cli-core-exit-code-wiring
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-16
---

# Phase 26 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified in VERIFY-MITIGATIONS-EXIST mode (register authored at plan time; each
> declared disposition checked against the shipped code, not against intent).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| argv + env -> run() | Untrusted command-line tokens and environment variables cross into `run()` (via `parseCliArgs`) -- the CLI's ONLY input surface this phase. | Flag strings, `--tsConfig` paths, `--max-warnings` value, `NO_COLOR`/`FORCE_COLOR` |
| resolved --tsConfig -> filesystem | A resolved tsconfig path is normalized (`node:path` + guarded `realpathSync.native`) and read by the core via TypeScript/`fs` APIs -- never a shell. | Absolute tsconfig leaf/solution paths |
| run() -> caller (bin.ts, Phase 27) | `run()` returns `{ exitCode, stdout, stderr }`; it never writes a stream or calls `process.exit`. The report is the ONLY stdout content; notices/errors are stderr. | Rendered report (stdout), buffered notices/errors (stderr), literal exit code |

No network I/O, no process spawn, no stream writes exist in `run()` (stream writes are deferred to Phase 27's `bin.ts`).

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-26-01 | Tampering | parse-args `--max-warnings` | mitigate | `Number(raw)` then reject `!Number.isInteger(n) || n < 0` -> `usageError` -> exit 2 (parse-args.ts:145-152); `run()` maps `usageError` -> exit 2 (main.ts:120-123). Verdict never inverted. Pinned in parse-args.spec.ts. | closed |
| T-26-07 | Denial of Service | parse-args strict-mode throw | mitigate | `parseArgs` wrapped in try/catch (parse-args.ts:102-172); an unknown flag / missing value throws `ERR_PARSE_ARGS_*` -> mapped to `usageError`, never an uncaught crash. Pinned in parse-args.spec.ts. | closed |
| T-26-02 | Denial of Service | main.ts `realpathSync.native` | mitigate | `realpathSync.native` wrapped in try/catch with fall-through to the resolved path (main.ts:93-98); ENOENT falls through -> core raises `TypecheckInfrastructureError` -> caught -> `toExitCode(error)` = 2 (main.ts:170-180). Verified end-to-end (nonexistent path -> exit 2) in main.integration.spec.ts. | closed |
| T-26-03 | Tampering | main.ts `--tsConfig` path handling | mitigate | NO `exec`/`spawn`/`child_process` of user input anywhere in `src/cli` (grep-confirmed: only a "NO spawn" comment). Only `node:path` `isAbsolute`/`resolve` + `node:fs` `realpathSync` (main.ts:1-2, 88-98); the core reads tsconfigs via TypeScript/`fs` APIs. | closed |
| T-26-04 | Information Disclosure | run() stdout/stderr routing | mitigate | stdout is EXCLUSIVELY the `renderReport` string (or help/version text, or ''); every notice/error routes through `BufferingLogger` to stderr = `logger.text` (main.ts:123,129,169,179; console-logger.ts:19-37). Pinned in main.spec.ts (report->stdout, notice->stderr) and main.integration.spec.ts (TS2322 in stdout, absent from stderr). | closed |
| T-26-05 | Information Disclosure | diagnostic path output | accept | `pathBase = process.cwd()` renders CWD-relative diagnostic paths, not absolute (main.ts:139). Low residual risk (local dev/CI tool). See Accepted Risks Log. | closed |
| T-26-06 | Information Disclosure | uncaught non-infra throw exposing a stack | accept | An unknown (non-infra) throw is re-thrown to `bin.ts` (Phase 27), which prints the stack to stderr (main.ts:184). Acceptable for a dev tool; `run()` returns exit 2 for infra failures. See Accepted Risks Log. | closed |
| T-26-SC | Tampering (supply chain) | dependency installs | accept | ZERO new runtime/dev dependencies this phase (Node stdlib `util.parseArgs` / `node:path` / `node:fs` + in-repo pure core only). Git-confirmed: no Phase 26 commit touched `package.json`. See Accepted Risks Log. | closed |

*Status: open - closed*
*Disposition: mitigate (implementation required) - accept (documented risk) - transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-26-05 | T-26-05 | Diagnostic paths are rendered CWD-relative via `pathBase = process.cwd()` (main.ts:139), matching the executor's CI-annotation intent. Path fragments could reveal local directory names, but this is a local dev/CI type-checking tool with no remote output channel -- low residual risk. | Phase 26 plan author (register_authored_at_plan_time) | 2026-07-16 |
| AR-26-06 | T-26-06 | A non-infrastructure throw is re-thrown out of `run()` (main.ts:184) to the Phase 27 `bin.ts` shell, which prints the stack to stderr. Stack exposure is acceptable for a developer-facing CLI and aids debugging; `run()` itself returns a clean exit 2 for the caught infrastructure path. | Phase 26 plan author | 2026-07-16 |
| AR-26-SC | T-26-SC | Zero new runtime/dev dependencies were installed this phase; the CLI uses only Node stdlib (`util.parseArgs`, `node:path`, `node:fs`) plus the in-repo pure core. `@angular/compiler-cli` + `typescript` remain pre-existing installed peers. No package legitimacy gate applies -- nothing new to audit. Verified: no Phase 26 commit modified `package.json`. | Phase 26 plan author | 2026-07-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Residual Robustness Observations (non-blocking)

Surfaced by the advisory code review (26-REVIEW.md, WR-01/WR-02); assessed against
the declared mitigations. Neither inverts a verdict; both fail SAFE. Recorded for
transparency, NOT as open threats.

| Ref | Observation | Assessment |
|-----|-------------|------------|
| WR-01 | `--max-warnings` uses lenient `Number()`: `0x10`/`1e3`/whitespace-padded/empty-string are accepted (empty -> `0`). | Fails SAFE. The empty-string -> `0` case selects the STRICTEST gate (over-gates). A large lenient value (e.g. `1e3` = 1000) is still stricter than the no-flag baseline (which tolerates all warnings), so it cannot produce a false PASS. A type-error run fails regardless of `--max-warnings` (evaluate-result owns the type-error verdict). The declared T-26-01 mitigation ("reject non-integer/negative; never invert the verdict") is present and holds; WR-01 is a UX/robustness refinement beyond the declared control, not a verdict-inversion. NOT open. |
| WR-02 | A blank `-c ''` value (length-1 array) passes the required-option guard and resolves to the CWD, surfacing as a downstream config/infra error (exit 1 or 2) rather than a clear usage message. | Fails SAFE. A blank path never yields a clean (exit 0) verdict -- it produces a fail (exit 1) or infra (exit 2) exit, so it cannot mask a real problem. UX clarity nit, not a security gap. NOT open. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-16 | 8 | 8 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-16
