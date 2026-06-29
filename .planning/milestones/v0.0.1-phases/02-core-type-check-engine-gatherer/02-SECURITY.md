---
phase: 02
slug: core-type-check-engine-gatherer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-27
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verification mode: each declared mitigation confirmed present in implemented code
> (grep-located + REAL-compiler proof), not accepted on documentation or intent.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| consumer tsconfig -> `runTypecheck` | The sole untrusted input is `tsConfigPath` (absolute) + the resolved tsconfig contents, parsed by `ng.readConfiguration`. The core never `eval`/execs consumer config. | tsconfig path + file contents (low sensitivity; may embed absolute paths) |
| ESM compiler-cli load -> core | A failed `await import('@angular/compiler-cli')` is an environment/install error, not a type result; it propagates as a true error. | module load success/failure |
| committed fixture tsconfig + source -> `runTypecheck` | Fixtures are committed, trusted, out-of-graph controlled inputs that exercise the engine's diagnostic-surfacing and emit-override behavior. | controlled test inputs |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Tampering / Repudiation-of-trust | `runTypecheck` count logic (D-01) | mitigate | Explicit `ts.DiagnosticCategory` counting in `finalize()` — `errorCount` = `category === Error`, `warningCount` = `category === Warning`, never `length - errorCount`. `run-typecheck.ts:206-211`. No `length - errorCount` in non-comment source (grep returns 0). | closed |
| T-02-02 | Tampering / Repudiation-of-trust | `runTypecheck` config handling (D-03) | mitigate | `const configDiagnostics = [...parsed.errors]` captured and prepended to both return paths; a malformed/unreadable config surfaces as a returned Error, never dropped. `run-typecheck.ts:79, 95, 153`. | closed |
| T-02-03 | Tampering | `performCompilation` no-emit path (D-05) | mitigate | Full emit-neutralizing override: `noEmit: true` + `composite: false` (gatekeeper) + `declaration/declarationMap/emitDeclarationOnly/incremental: false` + cleared sourcemap/tsbuildinfo, AND `emitFlags: 0` (both load-bearing, V-2). `run-typecheck.ts:107-131`. | closed |
| T-02-04 | Tampering | masked ESM-load / internal crash (D-06) | mitigate | Returned `UNKNOWN_ERROR_CODE` (500) detected BY CODE (`diagnostic.code === ng.UNKNOWN_ERROR_CODE`, not `source === 'angular'`) and RE-THROWN as `TypecheckInfrastructureError`. `run-typecheck.ts:139-147`; shim exposes the code at `compiler-cli-types.ts:44`. Proven: `infra-failure.spec.ts:65-79` (rejects on code 500; does not throw on a real TS error). | closed |
| T-02-05 | Information Disclosure (low) | re-thrown error `messageText` | accept | Confirmed an intentional, JSDoc-documented disclosure: the only surface is the deliberate `TypecheckInfrastructureError` re-throw carrying flattened compiler `messageText` (`run-typecheck.ts:144-145`). No `console`/`logger`/`process.env` access exists in production source (grep returns 0) — no secret/env leak. Output relativization deferred to Phase 3 (OUT-02). See Accepted Risks Log. | closed |
| T-02-02b | Tampering / Repudiation-of-trust | malformed tsconfig handling | mitigate | `config-broken/tsconfig.malformed.json` (extends a nonexistent path -> returned TS5012). `config-resolution.integration.spec.ts:74-99` asserts `errorCount >= 1`, the config-error message present, AND `runTypecheck` does NOT throw (config errors returned, not thrown). | closed |
| T-02-06 | Tampering / Repudiation-of-trust | solution-style / references-only tsconfig | mitigate | `solution-style/tsconfig.json` (`files:[]`, `references:[...]`). Engine gates on `parsed.rootNames.length === 0` (`run-typecheck.ts:88`), NEVER TS18003. `config-resolution.integration.spec.ts:101-126` asserts EXACTLY `rootNamesCount === 0` AND `errorCount === 1`, message matches `/tsconfig\.(app|lib|spec)\.json/`, and codes do NOT contain `18003`. | closed |
| T-02-07 | Tampering / Repudiation-of-trust | spec tsconfig | mitigate | `config-broken/tsconfig.spec.json` -> `["error.component.spec.ts"]` with a planted TS2322. `config-resolution.integration.spec.ts:59-70` asserts `rootNamesCount > 0`, `errorCount >= 1`, and the planted `2322` present in `diagnostics` — specs are type-checked, not just built (EXE-02). | closed |
| T-02-01b | Tampering / Repudiation-of-trust | unconditional gatherer (ENG-02) | mitigate | `gather-diagnostics.ts` calls every getter unconditionally (incl. `getNgSemanticDiagnostics`). `gate-b.spec.ts:75-76` proves the all-getter surfaces BOTH TS2322 AND NG8109 in one pass; `:88-89` proves `defaultGatherDiagnostics` surfaces TS2322 but NOT NG8109 (the differential — no short-circuit lie). | closed |
| T-02-03b | Tampering | D-05 no-emit override (composite triangle) | mitigate | `composite-triangle/tsconfig.json` sets `composite/declarationMap/emitDeclarationOnly: true`. `no-emit-override.integration.spec.ts:47-57` asserts codes exclude TS5053/6304/6379 (the override neutralizes the triangle; ROADMAP criterion 1 — prevents the inverse false-FAIL lie). | closed |
| T-02-08 | Tampering / Repudiation-of-trust | extended-diagnostic category counting (ENG-04) | mitigate | `extended-v13` (no `defaultCategory`) -> `extended.angular13.integration.spec.ts:41-43`: NG8101 `.category === Warning`, `warningCount >= 1`, `errorCount === 0`. `extended-promoted` (`defaultCategory:"error"`) -> `extended.angular17.integration.spec.ts:44-45`: SAME code `.category === Error`, `errorCount >= 1`. Counts honor `.category`, never code sign. | closed |
| T-02-09 | Tampering | D-02 diagnostics Message | mitigate | Engine forces `diagnostics: false` (`run-typecheck.ts:126`). `no-emit-message/tsconfig.app.json` sets `diagnostics: true`; `no-emit-override.integration.spec.ts:59-70` asserts no `DiagnosticCategory.Message` "Time for diagnostics" entry survives. | closed |
| T-02-SC | Tampering | npm/pip/cargo installs (supply chain) | accept | Verified: `packages/angular-typechecker/package.json` last changed in Phase 1 (`14b8107`); no Phase-2 commit touched it (`git diff 7564333..HEAD -- package.json` empty). All three SUMMARYs declare `tech-stack.added: []`. Zero supply-chain delta this phase; publish-hardening controls are Phase 5. See Accepted Risks Log. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-05 | The re-thrown `TypecheckInfrastructureError` carries the compiler's flattened `messageText`, which may include absolute filesystem paths. Acceptable for a local CI/agent type-checker run in the consumer's own environment; the message is the intentional, sole disclosure surface (no `console`/`logger`/`process.env` access exists in production source). Output relativization is deferred to Phase 3 (OUT-02). | Lars Gyrup Brink Nielsen | 2026-06-27 |
| AR-02-02 | T-02-SC | No new runtime/dev dependencies were added in Phase 02 (verified: `package.json` unchanged since Phase 1; all SUMMARYs report `tech-stack.added: []`). The phase is pure code + fixtures + specs against the already-locked, already-installed toolchain. No supply-chain delta to mitigate; s1ngularity/publish-hardening controls are scoped to Phase 5. | Lars Gyrup Brink Nielsen | 2026-06-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-27 | 13 | 13 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-27

---

## Notes

- Behavioral signal at audit time: `npx nx test angular-typechecker` is 39/39 across 12 files (green); the four `*.integration.spec.ts` proofs run against the REAL Angular 22 compiler (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`).
- Unregistered flags: NONE. No SUMMARY contained a `## Threat Flags` section and all three declare `tech-stack.added: []`; no new attack surface appeared during implementation.
- Implementation files were NOT modified by this audit (read-only verification).
