---
phase: 10
slug: drift-hardening-maintainability
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-30
---

# Phase 10 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 4 PLAN.md carry a `<threat_model>`); all
> plan-time threats verified CLOSED. Phase security surface is SMALL: it adds a
> build-time type-check + a CI command + test-only specs; it ships NO new runtime
> code (the drift file is type-only/erased, excluded from the tarball) and adds NO
> new dependency (D-03). The only applicable ASVS category is V14 (configuration /
> supply chain). The mitigations below were independently confirmed by the Phase 10
> goal verification (10-VERIFICATION.md): drift file excluded from both production
> tsconfigs, CI uses fixed `typecheck-drift` flags with the SHA-pinned envelope
> unchanged, `renderReport` real-formatter routing with an anti-fake grep, and
> `nx build` + 147 tests green.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `compiler-cli-types.ts` / `compiler-cli-types.drift.ts` -> emitted output | Both are type-only (`declare` + interfaces / pure type assertions); erased at emit, never shipped as runtime code | None (types only) |
| `tsconfig.drift.json` -> real `@angular/compiler-cli` barrel | Drift file imports the installed, `@nx/dependency-checks`-policed package types under classic-node resolution; type-only, no runtime execution | Installed package typings (trusted) |
| drift file -> shipped tarball | `*.drift.ts` excluded from `tsconfig.lib.json` AND `tsconfig.spec.json`; not `index`-reachable; gated by the `files` whitelist | None (never shipped) |
| `ci.yml` run step -> `typecheck-drift` nx target | New CI command runs in the existing path-gated `test` job; fixed target id + flags, no untrusted PR metadata interpolated | Fixed literals only |
| runtime / TS-99 specs -> real `@angular/compiler-cli` (ESM import) | Specs `await import` the already-installed package (the production load path) + read committed in-repo fixtures | Trusted installed module; no network, no secrets |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-10-01-01 | Tampering | EmitFlags correction silently breaks the no-emit guarantee | mitigate | `0` stays "emit nothing"; `noEmit: true` is the orthogonal guarantee at run-typecheck.ts; `0 as EmitFlags` cast retained; members mirror the verified real enum; `nx build` green | closed |
| T-10-01-02 | Information disclosure | Vendor-marker comments leak internal info into the tarball | accept | Markers are source comments; the published `.d.ts` is generated and the shim is type-only; no secret/PII in marker text | closed |
| T-10-01-SC | Tampering (supply chain) | Dependency installs | accept | No package installs (D-03: zero new dependency) | closed |
| T-10-02-01 | Tampering / Elevation | New CI step interpolating untrusted PR metadata | mitigate | `typecheck-drift` uses FIXED target id + flags; folded into the existing path-gated `test` job; no PR title/branch/author interpolated | closed |
| T-10-02-02 | Tampering | Unpinned action in a new job (tj-actions vector) | mitigate | No new job added; existing SHA-pinned `checkout`/`setup-node` + `permissions: contents: read` envelope byte-unchanged | closed |
| T-10-02-03 | Information disclosure / build breakage | Drift file ships or breaks the build (imports the real ESM barrel) | mitigate | Excluded from `tsconfig.lib.json` (L18) AND `tsconfig.spec.json` (L29); `files` whitelist gates the tarball; `nx build` + `nx test` green (no TS2305) | closed |
| T-10-02-SC | Tampering (supply chain) | Dependency installs | accept | No package installs; `nx:run-commands` ships with nx core | closed |
| T-10-03-01 | Tampering | Runtime spec executes arbitrary code via the imported package | accept | Imports ONLY the already-installed `@angular/compiler-cli` (production load path); no dynamic/untrusted specifier | closed |
| T-10-03-02 | Denial of service | Runtime spec builds a real program (slow/flaky) | mitigate | `gatherDiagnostics: () => []` keeps it shape-only; reuses a small committed fixture; existing 30000ms testTimeout covers cold warmup; spec green | closed |
| T-10-03-SC | Tampering (supply chain) | Dependency installs | accept | No package installs (D-03) | closed |
| T-10-04-01 | Spoofing / Tampering | A fake formatter passes the spec while production leaks TS-99 | mitigate | Spec routes through `renderReport` (real `cli.formatDiagnostics`); acceptance grep forbids `ts.formatDiagnostics`/`vi.fn`/`replaceTsWithNgInErrors`; verified by 10-VERIFICATION | closed |
| T-10-04-02 | Denial of service | `runTypecheck` on the fixture is slow/flaky | accept | Reuses a small committed fixture; existing 30000ms testTimeout; same convention as existing integration specs | closed |
| T-10-04-SC | Tampering (supply chain) | Dependency installs | accept | No package installs (D-03) | closed |

*Status: open / closed*
*Disposition: mitigate (implementation required) / accept (documented risk) / transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-01-02 | Vendor-marker comments are type-only source comments; the shipped `.d.ts` is generated and carries no secret/PII | Lars Gyrup Brink Nielsen | 2026-06-30 |
| AR-10-02 | T-10-01-SC, T-10-02-SC, T-10-03-SC, T-10-04-SC | Phase adds ZERO dependencies (D-03 locked); no supply-chain surface added | Lars Gyrup Brink Nielsen | 2026-06-30 |
| AR-10-03 | T-10-03-01 | Specs import only the already-installed, dependency-checks-policed `@angular/compiler-cli` (the production load path); no untrusted module specifier | Lars Gyrup Brink Nielsen | 2026-06-30 |
| AR-10-04 | T-10-04-02 | Cold-compiler test latency covered by the existing 30000ms testTimeout; consistent with the established integration tier | Lars Gyrup Brink Nielsen | 2026-06-30 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-30 | 12 | 12 | 0 | gsd-secure-phase (orchestrator; short-circuit: register authored at plan time, mitigations confirmed by 10-VERIFICATION) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-30
