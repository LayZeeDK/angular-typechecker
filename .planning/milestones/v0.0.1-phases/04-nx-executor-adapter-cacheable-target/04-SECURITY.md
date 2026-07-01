---
phase: 04-nx-executor-adapter-cacheable-target
audit: security
audited: 2026-06-28
asvs_level: 1
block_on: high
threats_total: 13
threats_closed: 13
threats_open: 0
status: SECURED
---

# Phase 4: Security Threat Verification

**Phase:** 4 -- Nx Executor Adapter + Cacheable Target
**Audited:** 2026-06-28
**ASVS Level:** 1
**Block on:** high severity
**Result:** SECURED -- 13/13 declared threats closed; 0 open at or above `high`.

## Scope and surface

This phase is a build-tool Nx executor (reads a consumer `tsconfig`, runs the
Angular compiler no-emit, writes diagnostics to stdout) plus a serialized
integration test harness (shells out to the real `nx` CLI, mutates and reverts a
committed fixture file). There is NO web, network, auth, database, secret, or
credential surface. The real attack surface assessed:

- Executor option ingress (Nx CLI -> adapter -> core).
- Path handling for the consumer `tsConfig` (traversal / cwd ambiguity).
- Correctness integrity: a swallowed error or a lying cache producing a false
  PASS (a "type-checker that lies" -- the phase's central threat class).
- Test-harness mutation of a committed source file (must always revert; must
  never leak the injected error into committed code or a dirty tree).
- `execSync` shelling to `nx` (command-injection surface).
- Supply chain: any new package installs.

No threats were invented for surfaces this phase does not have.

## Threat verification

Each threat is verified against the IMPLEMENTED code, not documentation or
intent. Evidence is a `file:line` reference confirming the mitigation is present
at the actual control point.

| Threat ID | Category                                                     | Disposition           | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------ | --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-01   | Tampering (schema input)                                     | mitigate              | CLOSED | `schema.json:29` `required: ["tsConfig"]`; `schema.json:30` `additionalProperties: false`; typed props `schema.json:9-28`; key-parity guard `schema-parity.spec.ts` against `schema.d.ts:1-6`                                                                                                                                                                                                             |
| T-04-02   | Repudiation (error swallow)                                  | mitigate              | CLOSED | `executor.ts:51-61` -- only `TypecheckInfrastructureError` maps to `{ success: false }` (`:52-57`); every other error is RE-THROWN at `executor.ts:60`. Asserted in `executor.spec.ts` (re-throw edge)                                                                                                                                                                                                    |
| T-04-03   | Information disclosure (malformed maxWarnings)               | accept                | CLOSED | Accepted risk logged below. Defensive handling verified: `evaluate-result.ts:49-54` treats undefined / non-finite / negative `maxWarnings` as unset (no crash, no inverted verdict); `normalize-options.ts:55` forwards as-is (no `?? 0` footgun)                                                                                                                                                         |
| T-04-04   | Tampering (tsConfig path traversal / cwd)                    | mitigate              | CLOSED | `normalize-options.ts:45-47` resolves only `isAbsolute(tsConfig) ? tsConfig : joinPathFragments(context.root, tsConfig)`; no shell interpolation, no `process.cwd()`. Core confirms no cwd read (`run-typecheck.ts:88` is a comment only; no `process.cwd()` call anywhere in `src/core/`)                                                                                                                |
| T-04-05   | Tampering (cache inputs / stale green)                       | mitigate              | CLOSED | `nx.json:44-55` (and dev-key `:60-71`) inputs include `^default` (hashes inlined transitive dep source) + `externalDependencies: ["typescript", "@angular/compiler-cli"]` (`:54`). R1 `--check` edge guard is a BLOCKING pre-flight in `cache-busts-on-dep-error.int.spec.ts:137-150`                                                                                                                     |
| T-04-06   | Tampering (fixtures vs product)                              | mitigate              | CLOSED | Fixtures tagged `scope:fixture` (`libs/typecheck-consumer/project.json:6`, `libs/typecheck-consumer-dep/project.json:6`); each `package.json` `"private": true` (`:4` both); alias namespaced `@fixtures/typecheck-consumer-dep` (`tsconfig.base.json:23-25`) and does not shadow the product alias (`:20-22`); the product never imports them                                                            |
| T-04-07   | Spoofing (custom hasher voids the guard)                     | accept (by avoidance) | CLOSED | Accepted-by-avoidance logged below. No custom hasher registered: `nx.json` uses static `inputs` only (`:44-55`, `:60-71`); no `hasher`/`hashFn` key anywhere, so `nx show target inputs --check` remains a valid oracle                                                                                                                                                                                   |
| T-04-08   | Tampering (harness leaves injected error committed)          | mitigate              | CLOSED | `.pristine` byte-identical sidecar (verified 810 bytes, identical); `beforeAll` + `afterEach` heal (`cache-busts...:126-134`); `finally` byte-restore of captured original (`:189-192`, `:213-215`); parity spec same pattern (`executor-parity...:151-158`, `:192-194`, `:230-232`); NEVER `git checkout` (only in comments `:120-122`). Working tree clean for `libs/typecheck-consumer-dep` post-audit |
| T-04-09   | Repudiation/Tampering (lying cache -> false PASS)            | mitigate              | CLOSED | Green-then-broken transition asserts CACHE MISS defense-in-depth (`cache-busts...:185-188`): marker absent + diagnostic code present + non-zero exit; CACHE HIT proven first (`:163-165`); R1 `--check` pre-flight proves dep source is hashed (`:137-150`); anti-lying `--skip-nx-cache` differential (`:195-216`)                                                                                       |
| T-04-10   | Tampering (command injection into execSync)                  | mitigate              | CLOSED | `nx` command built from FIXED target id + fixed flags only (`cache-busts...:96-116`); the only dynamic `run(extra)` arg is the hard-coded literal `'--skip-nx-cache'` (`:209`); injected error literal built via `JSON.stringify` and WRITTEN TO A FILE, never the shell (`:174-177`, `executor-parity...:79`)                                                                                            |
| T-04-11   | Denial of service (non-deterministic cache/daemon races)     | mitigate              | CLOSED | D-14 serialization in `vitest.config.mts` (singleFork, `fileParallelism: false`, `sequence.concurrent: false`, `testTimeout 180000`, node env); per-run isolated `NX_CACHE_DIRECTORY` + `NX_DAEMON: 'false'` + `FORCE_COLOR: '0'` (`cache-busts...:84-85`, `:76-82`); nested-nx env strip `buildCleanEnv` (`:63-82`)                                                                                      |
| T-04-12   | Repudiation (unknown executor error swallowed -> false PASS) | mitigate (upstream)   | CLOSED | Upstream guard is the executor re-throw (`executor.ts:60`, = T-04-02); this plan's parity test confirms executor verdict === core verdict in both green and injected states (`executor-parity...:160-196`), so a swallowed error would surface as a parity mismatch                                                                                                                                       |
| T-04-SC   | Tampering (supply-chain: npm/pip/cargo installs)             | mitigate              | CLOSED | Zero new packages installed across all 3 plans (`tech-stack.added: []` in all three SUMMARY frontmatters; RESEARCH Package Legitimacy Audit: zero new installs). slopcheck N/A                                                                                                                                                                                                                            |

## Accepted risks log

These threats have a non-`mitigate` declared disposition. Both are verified to be
correctly dispositioned with the disposition's required evidence present.

### T-04-03 -- malformed `maxWarnings` (accept)

**Rationale:** `maxWarnings` is a build-tool numeric quality-gate input with no
PII and no privileged effect. A malformed value (negative / NaN / non-finite)
cannot crash the run or invert the pass/fail verdict because `evaluateResult`
defensively gates warnings only when `maxWarnings` is `!== undefined &&
Number.isFinite(...) && >= 0` (`evaluate-result.ts:49-54`), and
`normalizeOptions` forwards the raw value rather than defaulting it to `0`
(`normalize-options.ts:55`), avoiding the un-loosenable `default: 0` footgun.
Residual risk: a user supplies a nonsense `maxWarnings` and gets the
"warnings never fail on their own" behavior instead of an error -- acceptable
for a build tool. Disposition CORRECTLY `accept`.

### T-04-07 -- custom hasher voiding the `--check` guard (accept by avoidance)

**Rationale:** The phase deliberately registers NO custom Nx hasher (D-05/D-10).
Confirmed: `nx.json` declares only static string/object `inputs` for the
cacheable target default; there is no `hasher` or `hashFn` key anywhere in the
config. Avoiding a custom hasher is what keeps `nx show target inputs --check`
valid as the cache-correctness oracle (the R1 guard that backs T-04-05/T-04-09).
The accepted residual is that the recipe relies on Nx's built-in `^default`
hashing semantics; this is intended and is the safer choice. Disposition
CORRECTLY `accept (by avoidance)`.

## Threat flags reconciliation (from SUMMARY)

`04-03-SUMMARY.md ## Threat Flags` reports: "None -- no new network endpoints,
auth paths, file-access patterns, or trust-boundary schema changes introduced
beyond the plan's threat model." Plans 01 and 02 SUMMARYs likewise report no new
security-relevant surface beyond their `<threat_model>` blocks.

**Unregistered flags:** none. No new attack surface appeared during
implementation that lacks a mapped threat ID.

## Notable executor deviations (cross-referenced, not new threats)

Three deviations in `04-03-SUMMARY.md` are correctness-positive and reinforce the
threat mitigations rather than open new surface:

- **`includeDeps: true` on the consumer target** (`libs/typecheck-consumer/project.json:11`)
  closed a latent FALSE-PASS hole: the non-buildable dep was out-of-project for
  the leaf-tsconfig boundary filter, so the injected dep error was silently
  suppressed. This directly strengthens T-04-09 (lying cache) -- without it the
  MISS case would have been a false PASS.
- **Dual-key `targetDefaults`** (`nx.json:41-56` published id + `:57-72`
  dev-workspace-scoped id) made the cacheable default actually bind in the dev
  workspace. The dev-scoped `@angular-typechecker/...` key is a workspace-only
  artifact. This is NOT a Phase-4 security gap, but it carries a Phase-5
  hand-off obligation (see below).
- **Nested-nx env strip** (`buildCleanEnv`, both int specs) is the T-04-11
  determinism control; without it the HIT assertion could never pass and the
  whole gate would be dead.

## Cross-reference with code review (04-REVIEW.md)

04-REVIEW.md found 0 Critical/High, 4 Warning, 6 Info. None are security
BLOCKERS at or above `high`. Security-relevant items, with disposition:

- **WR-01** (MISS assertion could false-PASS on a non-cache failure; the
  `/TS2322|2322/` regex is weak): a test-robustness hardening, not a product
  vulnerability. The MISS case is already defense-in-depth (marker absent + code
  - non-zero exit) and the real-`nx-run` proof adds an explicit
    `not.toMatch(/ERR_REQUIRE_ESM/)` (`executor-parity...:227`). Residual risk is
    a weaker-than-ideal false-PASS guard in a test, below `high`. Carry as a
    test-hardening follow-up; does not block the phase.
- **WR-04** (dual-key cache recipe duplication + Phase-5 leak hazard of the
  dev-scoped key): advisory. No Phase-4 security impact. Phase-5 obligation:
  the PUBLISHED consumer recipe/README must be keyed ONLY by
  `angular-typechecker:angular-typecheck`; the `@angular-typechecker/...` key
  must never leak into published guidance.
- WR-02 (temp cache dir leak) and WR-03 (fragile path string-replace in a test)
  are quality/robustness, no security weight.

## Verdict

All 13 declared threats are CLOSED with code evidence at the actual control
points. The two non-`mitigate` threats (T-04-03 accept, T-04-07 accept-by-
avoidance) are correctly dispositioned with their required evidence present and
are logged in the accepted-risks log above. No unregistered attack surface. No
open threat at or above the `high` block threshold.

**threats_open: 0**
