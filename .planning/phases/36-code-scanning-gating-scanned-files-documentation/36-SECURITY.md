---
phase: 36
slug: code-scanning-gating-scanned-files-documentation
status: verified
asvs_level: 2
block_on: high
threats_found: 8
threats_closed: 8
threats_open: 0
created: 2026-07-22
---

# Phase 36 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Mode: VERIFY (registers authored at plan time in the 36-01 and 36-02
> `<threat_model>` blocks). Each declared mitigation was confirmed PRESENT in the
> committed code -- grep/read of the cited files, not accepted on documentation or
> SUMMARY intent. No blind scan for new threats.
>
> Scope note: this phase is CI-wiring + docs + drift-guard tests, additive-only vs
> `@0.2.3`. No `packages/angular-typechecker/src/**` runtime change (the two touched
> `.spec.ts` files are tarball-excluded), no `package.json`/manifest change, no new
> dependency, no version bump (`package.json` version stays `0.2.3`, verified). The
> security-relevant dimensions are: command injection on the two new CI assertion
> steps (T-36-02, the one HIGH), workflow tampering / drift (T-36-01), a
> self-lockout DoS from the new `main` ruleset (T-36-07), and information hygiene in
> the shipped prose (T-36-04, T-36-06). Auth / session / access-control / crypto
> ASVS categories are N/A (no such surface in a CI/docs phase).

---

## Verdict

**SECURED.** All 8 declared threats CLOSED. `threats_open: 0`. The load-bearing HIGH
threat for `block_on: high` (T-36-02, command injection on the two new D-03
assertion steps) is mitigated verbatim: pure `if:`-expression gating with a STATIC
`echo`/`exit 1` body, no step output and no PR metadata interpolated into any `run:`
shell. Nothing blocks ship on security grounds.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| fork PR head repo -> CI runner | The un-path-gated `code-scanning` job runs `npm ci` + `nx build` on every PR (incl. forks); untrusted PR code/metadata crosses here. |
| GitHub Actions expression engine -> `run:` shell | The two new D-03 assertion steps must gate via a pure `if:` expression only; nothing interpolated into the shell body. |
| committed `ci.yml` -> required `main` merge gate | A tampered or silently-regressed gate weakens `main` protection. |
| GitHub `main` ruleset -> merge button | GATE-02 adds a hard `main` control; a mis-sequenced enablement can lock out ALL merges (empty bypass). |
| shipped README (npm tarball) -> public consumers | The DOC-01 prose ships in the published package (`files` allowlist includes `README.md`). |
| committed AGENTS.md -> public repo readers + all future AI agents | An inaccurate runbook silently misguides every agent; AGENTS.md self-governs (must be code-reviewed). |

---

## Threat Verification

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-36-01 | Tampering | medium | mitigate | CLOSED | `ci-e2e-coverage-guard.spec.ts:705-746` drift guard: membership list-item-anchored (`:715`, `:720`), un-path-gate scoped to `code-scanning` block asserted false (`:728-733`), D-03 assertion anchored on `produced == 'false'` (`:736-745`); all scoped via `extractJobLines` (throws on missing job -> non-vacuous). Real state matches: `ci.yml:779-780` (both jobs in `ci.needs[]`), `ci.yml:551-553` (no path-gate `if:` on `code-scanning`). |
| T-36-02 | Tampering / Elevation (command injection) | high | mitigate | CLOSED | `ci.yml:614-618` + `:622-626`: both assertion steps gate on a pure `if:` expression (`github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.<id>.outputs.produced == 'false'`) with a STATIC `echo "::error::..."` + `exit 1` body -- NO `${{ }}`, no step output, no PR metadata in any shell. Top-of-file no-command-injection invariant (`ci.yml:5-9`) present and unchanged. Grep confirmed no `${{` in any `run:` body of the `code-scanning` job. |
| T-36-03 | Elevation of Privilege | low | accept | CLOSED | Accepted risk logged below. Verified: `code-scanning` uses the safe `pull_request: {}` trigger (`ci.yml:25`); job-scoped `permissions: { contents: read, security-events: write }` unchanged (`ci.yml:554-556`); fork-PR upload gates intact (`ci.yml:634`, `:643`); no new secret/env. |
| T-36-04 | Tampering / Information disclosure | low | mitigate | CLOSED | `code-scanning-docs.spec.ts:34-51` normalized-whitespace tripwire asserts the heading on the raw string + `Scanned files` / `a GitHub limitation` / `CodeQL` / `run.artifacts`. All four tokens present in the shipped README (`README.md:724-735`) -> tripwire non-vacuous, claim locked. |
| T-36-05 | Tampering | medium | mitigate | CLOSED | AGENTS.md self-governance rule routed the runbook (`AGENTS.md:243-279`) through the phase `code_review_gate`. `36-REVIEW.md:60-63` confirms the runbook was reviewed AND found factually accurate against the live `ci.yml` (un-path-gate, both required tools, per-PR-kind analysis, `enforcement:disabled` recovery). |
| T-36-06 | Information disclosure | low | mitigate | CLOSED | Direct grep of the shipped README + AGENTS.md (+ all changed files): NO email-shaped token and NO work-domain leak (`NO_EMAIL_SHAPED_TOKENS_FOUND`, `NO_WORK_DOMAIN_LEAK`). The load-bearing control (no leak in the actual shipped content) is verified present. See note below re: the battery allowlist-inversion check. |
| T-36-07 | Denial of Service (self-lockout) | medium | mitigate | CLOSED | `AGENTS.md:243-279` runbook: opens with "agent NEVER flips the ruleset" (`:245-251`); Evaluate-mode-FIRST (`:261-265`); probe both PR kinds (`:266-270`); flip to Active only after probe (`:271`); `enforcement:disabled` recovery (`:272-274`); fork-PR deadlock accepted (`:275-279`). No ruleset-mutating `gh api` call anywhere. Enablement is human-run + real-CI-only (D-04). |
| T-36-SC | Tampering (supply chain) | low | accept | CLOSED | Accepted risk logged below. Verified: no package install, no new marketplace action; `github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1` reused verbatim at all three upload sites (`ci.yml:635`, `:644`, `:733`). No version bump (`package.json` version `0.2.3`). Applies to both 36-01 and 36-02 registers. |

**Verification depth (ASVS L2):** for each `mitigate` threat I confirmed the
mitigation ACTUALLY ADDRESSES the threat vector and sits at the correct boundary --
not merely that a pattern exists. T-36-02's gate was checked to fire only on non-fork
PRs and to carry no shell interpolation; the drift guard's regexes were confirmed
scoped to the correct job blocks (not file-wide) and non-vacuous.

---

## Accepted Risks Log

### T-36-03 -- Elevation of Privilege: un-path-gating runs `npm ci` + `nx build` on planning-only / fork PRs (low, accepted)

Un-path-gating the `code-scanning` dogfood job (D-01) means it runs `npm ci` +
`nx build` on EVERY PR, including planning-only and fork PRs, where it previously
skipped. Accepted because: it reuses the SAME trusted `pull_request` code-checkout
trigger the rest of `ci.yml` uses (`ci.yml:25`) -- no privileged sibling trigger, no
new secret; the job-scoped permissions are unchanged (`contents: read` +
`security-events: write`, `ci.yml:554-556`); on a fork PR the `GITHUB_TOKEN` is
read-only and the upload steps are fork-gated to skip (`ci.yml:634`, `:643`), so no
write action executes on untrusted forks. Cost is limited to extra runner minutes on
planning-only PRs -- a documented, accepted tradeoff (D-01) that is the price of the
analysis-existence guarantee GATE-02 requires.

### T-36-SC -- Tampering (supply chain): actions / packages (low, accepted)

This phase installs no package and adds no new marketplace action. The only action
touched by the SARIF flow, `github/codeql-action/upload-sarif`, is reused at its
existing full-40-char SHA pin `@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1`
(`ci.yml:635`, `:644`, `:733`), kept fresh by Dependabot (github-actions ecosystem).
No `[ASSUMED]`/`[SUS]` package was introduced, so no legitimacy checkpoint is needed.
No version bump.

---

## Unregistered Flags

None. `36-01-SUMMARY.md` `## Threat Flags` records "None beyond the plan's
`<threat_model>`"; `36-02-SUMMARY.md` `## Threat Surface` records "No new
security-relevant surface." No new attack surface appeared during implementation that
lacks a threat mapping.

---

## Notes

- **T-36-06 battery check (informational, not a gap):** the declared mitigation has
  two parts -- (a) the added prose contains no email, and (b) the repo's
  allowlist-inversion email-hygiene check in the "normal battery" flags any
  non-approved email-shaped token. Part (a) is the load-bearing control and is
  directly grep-VERIFIED against the actual committed files (no leak). Part (b): I
  could not locate a committed automated allowlist-inversion email test in
  `tools/` or the spec suite -- it appears to be a global-instruction-level
  operating rule rather than an in-repo test. Because the threat as scoped (this
  phase's shipped prose) is CLOSED by direct verification, and the threat is LOW
  (below the `high` block threshold), this does not open a gap. Flagged so a future
  phase can decide whether to commit the allowlist-inversion check as a repo tripwire.

- **WR-01 (from `36-REVIEW.md`, fixed in 5aff3a7):** a stale "Path-gated (D-08)"
  comment above the `code-scanning` job contradicted the un-path-gating. This is a
  documentation-consistency finding, not a security control. The current `ci.yml`
  header comment (`ci.yml:546-550`) correctly states the job is un-path-gated and
  runs on every PR ref; no stale "Path-gated" note remains on the `code-scanning`
  job. No security impact either way (the drift guard, not the comment, enforces the
  behavior).

- **Real-CI-only Nyquist points (deferred by design, NOT security gaps):** the
  required `ci` aggregate going RED on a genuine Code Scanning upload/infra failure
  and GREEN on a clean PR, GitHub SARIF ingestion, and the human ruleset toggle are
  provable only on GitHub / by a human maintainer post-merge. These are verification
  Nyquist points (mirroring the 35-03 PROOF precedent), not unmitigated threats.

---

## Audit Trail

- **ASVS level:** 2 (Standard) -- mitigation verified to address the vector at the
  correct boundary, not grep-presence alone.
- **block_on:** high. Severity order critical > high > medium > low. Only high+ open
  threats would block. Open threats: 0. `threats_open: 0`.
- **Registers audited:** `36-01-PLAN.md` `<threat_model>` (T-36-01, T-36-02, T-36-03,
  T-36-SC) and `36-02-PLAN.md` `<threat_model>` (T-36-04, T-36-05, T-36-06, T-36-07,
  T-36-SC). T-36-SC is one logical threat spanning both plans.
- **Files inspected:** `.github/workflows/ci.yml`,
  `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`,
  `packages/angular-typechecker/src/code-scanning-docs.spec.ts`,
  `packages/angular-typechecker/README.md`, `AGENTS.md`, `36-REVIEW.md`.
- **Implementation files:** READ-ONLY. This audit created only this SECURITY.md.

---

_Audited: 2026-07-22 -- gsd-security-auditor (VERIFY mode, ASVS L2)_
