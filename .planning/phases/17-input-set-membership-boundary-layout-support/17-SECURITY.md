---
phase: 17
slug: input-set-membership-boundary-layout-support
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-06
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 7 PLAN.md `<threat_model>` blocks). This
> audit VERIFIES each declared mitigation exists in the implementation; it does
> not scan for new threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| consumer tsConfig -> rootName / diagnostic file paths | untrusted-shaped file paths (symlinks, junctions, case variants) decide whether a real error is reported | file path strings |
| solution tsconfig `references[]` -> resolved leaf configs | consumer-declared reference paths resolve to leaf tsconfigs whose declared rootNames enter the input set | resolved leaf paths + declared rootNames |
| Angular compiler output -> `ts.Diagnostic.relatedInformation` | branch-4a external-template ownership signal attributing a `.html` diagnostic to its `.ts` | public `ts.Diagnostic` fields |
| walk / direct entry -> shared `finalize` filter | the ONE chokepoint both entry paths route through; a `inputTs` threaded to only one path would reintroduce walk/direct drift | `inputTs` union (declared rootNames) |
| CoreResult counts -> pass/fail verdict + exit code | the verdict is the security control: it must never report clean while a first-party diagnostic was dropped | split suppressed counters |
| CoreResult (in-process) -> executor stdout | the loud notice is the human-facing surface of coverage loss; names files but never leaks a dependency's error text | file paths only (content isolation) |
| Angular/TS internal invariants -> the boundary filter | undocumented invariants (rootName===fileName pre-realpath; external-template relatedInformation; NG3004-only TCB Fatal) that, if they drift, silently break coverage | pinned tripwire assertions |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering (verdict) | keep() membership on symlink/junction/case-variant path | mitigate | Dual-identity membership + KEEP-on-throw canonicalizer: `filter-diagnostics.ts:211` (`isMember` raw OR full), `:217` (fail-safe KEEP when realpath threw), `createCanonicalizer` catch `:310-320`. Tripwire: `dual-identity-tripwire.spec.ts` (3 FS modes + transitive-dep negative). | closed |
| T-17-02 | Tampering (coverage) | branch 4a external-template attribution | mitigate | `owningComponentTs` reads public `relatedInformation` `filter-diagnostics.ts:245,275-287`; unmappable `.html` default-KEEP `:247-250`; suppressed dep external template counts in-graph `:153-161`. Proven: `layout-b.integration.spec.ts:87-109`, `external-template.integration.spec.ts:75-88`. | closed |
| T-17-03 | Tampering (ngtsc coupling break) | keep()/4a coupling to compiler internals | mitigate | keep()/4a read only public `ts.Diagnostic` fields (file.fileName, category, relatedInformation). Structural gate `filter-diagnostics.structural.spec.ts` (7-token denylist); `git grep` denylist on `filter-diagnostics.ts` returns ZERO matches (verified this audit). | closed |
| T-17-04 | Denial of Service (resource exhaustion) | inputSet build + per-diagnostic membership | accept | Set O(1) lookups bounded by declared rootNames; memoized canonicalizers; no backtracking regex over paths (linear `.replace(/\\/g,'/')`, `endsWith`, `split`). Offline single-process low-value tool. See Accepted Risks Log AR-17-01. | closed |
| T-17-05 | Tampering (coverage / Program-derived rootNames) | reading rootNames off a Program vs declared config | mitigate | `walk-references.ts:268` surfaces `parsed.rootNames` (DECLARED set) only; never `program.getRootFileNames()` (no `.ngtypecheck.ts` shim). WalkResult contract `:49-57`. `walk-references.spec.ts`. | closed |
| T-17-06 | Spoofing (input-set inflation) | out-of-project / skipped leaf contributing paths | mitigate | Accumulation lives in the surviving-leaf tail `walk-references.ts:268`, AFTER every skip/self-ref/dup/not-found/zero-root-names `continue` guard (`:145-242`). `walk-references.spec.ts`. | closed |
| T-17-07 | Tampering (walk/direct drift) | inputTs threaded to one entry path only | mitigate | Single shared `buildFinalizeFilter -> finalize -> filterDiagnostics` chokepoint: walk threads `walk.rootNamePaths` `run-typecheck.ts:321`, direct threads `parsed.rootNames` `:425`; `finalize` passes `filter.inputTs` `:540`. | closed |
| T-17-08 | Repudiation (dropped first-party reads clean) | guard paths returning stale/absent counts | mitigate | `finalize` guard paths (no filter) default all four suppressed fields to 0/[] `run-typecheck.ts:529-532`; a real suppression increments `suppressedInGraph` (filterDiagnostics `:153-161`). | closed |
| T-17-09 | Repudiation (false clean verdict) | unwired suppressed count / baked-in warning decision | mitigate | `evaluateResult` reads suppressed counts `evaluate-result.ts:95-99`; `toExitCode` reads them `exit-codes.ts:60`; warning decision late-bound to real maxWarnings `evaluate-result.ts:114-129` (no silent pass at maxWarnings:0). | closed |
| T-17-10 | Tampering (program abort hides survivors) | templateCheckAborted not verdict-affecting | mitigate | FM-9 fold: `templateCheckAborted !== undefined -> coverage-incomplete` `evaluate-result.ts:101-103`. Drift probe `fault-isolation.integration.spec.ts:215-269` (verdict-affecting + NG3004 surface pin). | closed |
| T-17-11 | Repudiation (zero-file leaf reads clean) | zero-root-names leaf advisory-only | mitigate | A `zero-root-names` skipped reference -> coverage-incomplete `evaluate-result.ts:105-112`; recorded at `walk-references.ts:235-242`. | closed |
| T-17-12 | Repudiation (silent coverage loss) | suppressed count present but never rendered | mitigate | Adapter renders BOTH counts: INFO third-party `executor.ts:120-125`, LOUD WARN in-graph naming files `:132-145`; clean run stays silent (both gated `> 0`). `executor.spec.ts`. | closed |
| T-17-13 | Information disclosure (dep error text leaking) | rendering suppressed diagnostics' content | mitigate | WARN renders ONLY `result.suppressedInGraphFiles.join(...)` (file paths), never message text `executor.ts:143`; adapter never reads `result.diagnostics` for the notice. `executor.spec.ts` `not.toHaveBeenCalledWith(...'is not assignable')`. | closed |
| T-17-14 | Tampering (false pass on real story error) | Layout-B aggregated out-of-dir story dropped | mitigate | `layout-b.integration.spec.ts:74-81` broken aggregated `card.stories.ts` TS2322 present + `evaluateResult(result).success === false`. | closed |
| T-17-15 | Info disclosure / false verdict | dependency error isolation | mitigate | `layout-b.integration.spec.ts:114` dep code (TS2339) ABSENT from diagnostics; `:118` suppressedInGraphErrorCount >= 1; `:129-136` verdict coverage-incomplete (NOT success:true). | closed |
| T-17-16 | Tampering (base-clause misclassifies clean host template) | D-04a base clause on external/indirect templates | mitigate | `external-template.integration.spec.ts:106-107` clean host suppressedInGraph == 0; corroborated `layout-b.integration.spec.ts:153-154` (clean host + clean external template). | closed |
| T-17-SC | Tampering (supply chain) | npm/pip/cargo installs | accept | N/A — this phase installs NO packages (all 7 SUMMARY `tech-stack.added: []`; fixtures are plain Angular, no `@storybook/angular`). No new dependency surface. See Accepted Risks Log AR-17-02. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-04 | Resource exhaustion is bounded: input set is a `Set` (O(1) lookups) sized by the consumer's own declared rootNames; canonicalizers are memoized (no repeat realpath syscall); path handling uses only linear `.replace`/`endsWith`/`split` (no backtracking regex). angular-typechecker is an offline, single-process, per-project CI/agent tool — not a network-facing service — so an attacker controlling the tsconfig already controls the machine. No mitigation warranted at ASVS L1. | Lars Gyrup Brink Nielsen | 2026-07-06 |
| AR-17-02 | T-17-SC | No packages are installed in this phase (verified: every plan SUMMARY records `tech-stack.added: []`; the Layout-A/B and tripwire fixtures are plain Angular with no `@storybook/angular` install). There is no new supply-chain surface to review. | Lars Gyrup Brink Nielsen | 2026-07-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. All 7 plan SUMMARY files (`17-01`..`17-07`) report `## Threat Flags: None` — no new attack surface appeared during implementation that lacks a threat mapping.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 17 | 17 | 0 | gsd-security-auditor |

Verification method by disposition: `mitigate` (15 threats) — grepped/read the cited mitigation in the implementation files and confirmed the cited test asserts it; `accept` (T-17-04, T-17-SC) — recorded in the Accepted Risks Log above. ASVS L1, `block_on: high`: zero open threats of any severity.

Evidence files audited (read-only): `filter-diagnostics.ts`, `filter-diagnostics.structural.spec.ts`, `walk-references.ts`, `run-typecheck.ts`, `evaluate-result.ts`, `exit-codes.ts`, `executor.ts`, `dual-identity-tripwire.spec.ts`, `external-template.integration.spec.ts`, `fault-isolation.integration.spec.ts`, `layout-b.integration.spec.ts`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-06
