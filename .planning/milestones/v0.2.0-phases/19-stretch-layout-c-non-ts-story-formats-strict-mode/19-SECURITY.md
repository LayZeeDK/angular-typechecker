---
phase: 19
slug: stretch-layout-c-non-ts-story-formats-strict-mode
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-07
---

# Phase 19 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Retroactive audit of an already-merged, CI-green phase. Every declared mitigation
> was verified present in the implemented code (grep + test run), not accepted on
> documentation or intent.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Executor option intake | Consumer-supplied `strict` option (project.json / CLI) flows through `normalizeOptions` into the pure `evaluateResult` verdict | Untrusted boolean; malformed/absent value must degrade to `false` (never a silent false-pass) |
| e2e package install | The Composition install-e2e installs the shipped tarball + `@storybook/angular` into a throwaway tmp workspace | npm registry origin (must be local Verdaccio, never public npm) + transient dependency tree |
| Public documentation | README `## Storybook` / `### Storybook Composition` + `19-DECISIONS.md` consumed by external users | Coverage claims (false-assurance risk); no secrets |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-19-01 | Tampering | `evaluate-result.ts` strict gate | mitigate | `strict` destructured once with `= false` default (evaluate-result.ts:122) and used ONLY in a `success:false` branch (evaluate-result.ts:135, `(gatesWarnings \|\| strict) && suppressedInGraphWarningCount > 0`), downstream of every early fail-return (lines 99/105/109/118/128); falls through to `clean` (line 139) when both flags are false. `options.strict ?? false` in normalize-options.ts:62. Can only ADD a fail path. | closed |
| T-19-02 | Tampering | `executor.ts` option threading | mitigate | Regression test asserts a dropped in-graph ERROR fails WITH and WITHOUT strict (evaluate-result.spec.ts:178-190); FLIP test asserts strict only adds the dropped-WARNING fail path, default stays clean (evaluate-result.spec.ts:158-176); executor threads `strict` (executor.ts:44,71). 23/23 evaluate-result tests green. | closed |
| T-19-03 | Spoofing | e2e npm install registry | mitigate | Registry isolation verified in storybook-composition.int.spec.ts: `buildCleanEnv({ stripAllNpmConfig: true })` (:72), `writeVerdaccioNpmrc` (:86), `verdaccioUrl.startsWith('http://localhost:')` assertion (:123), `npm_config_userconfig` -> nonexistent path (:90-93). | closed |
| T-19-04 | Tampering (supply chain) | transient `@storybook/angular@10.4.6` | accept | Pinned exact (spec:46), force-installed via `--legacy-peer-deps` into a `mkdtempSync` tmp workspace (spec:108,125); absent from the published plugin `package.json` (grep-verified). Documented in Accepted Risks Log (R-19-04). | closed |
| T-19-05 | Tampering (false assurance) | README Composition coverage claim | mitigate | Claim in MUST/MUST-NOT form (README:405-409); no over-claim ("Storybook's own type does not catch it", README:395). Deterministic content tripwire storybook-docs.spec.ts (8 assertions) fails CI if the MUST-NOT caveat or Composition claim is removed/softened -- 8/8 green against the post-WR-01 (commit 4c97b05) README; WR-01 tightened strict wording without breaking any asserted string. | closed |
| T-19-06 | Information disclosure | README / `19-DECISIONS.md` | accept | Public consumer-facing docs; no secrets. Documented in Accepted Risks Log (R-19-06). | closed |
| T-19-SC | Tampering (supply chain) | npm/pip/cargo installs | accept | No new package in the published plugin `package.json` (grep-verified). `@storybook/angular` appears only in a `.planning/spikes/007` fixture manifest and the transient e2e install -- never a tracked plugin dependency. 19-01 is pure source/tests on the locked stack. Documented in Accepted Risks Log (R-19-SC). | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-19-04 | T-19-04 | `@storybook/angular@10.4.6` is an official Storybook package, pinned exact and force-installed only into a throwaway `mkdtempSync` tmp workspace for the Composition install-e2e. It is never added to a tracked/published manifest, so it cannot reach a consumer's dependency graph. Registry origin is pinned to local Verdaccio (see T-19-03). | Lars Gyrup Brink Nielsen | 2026-07-07 |
| R-19-06 | T-19-06 | README `## Storybook` / `### Storybook Composition` and `19-DECISIONS.md` are public consumer-facing documentation containing no credentials, tokens, or internal endpoints. No changelog written and no release cut in this phase. | Lars Gyrup Brink Nielsen | 2026-07-07 |
| R-19-SC | T-19-SC | Phase 19 adds zero packages to the published plugin `package.json`. 19-01 is pure verdict source + unit tests on the locked stack; 19-02's `@storybook/angular` is transient/e2e-only; 19-03 is docs + one deterministic content spec. No supply-chain surface reaches the shipped artifact. | Lars Gyrup Brink Nielsen | 2026-07-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-07 | 7 | 7 | 0 | gsd-security-auditor |

Verification method notes:
- T-19-01/T-19-02: code read + `vitest run` of evaluate-result.spec.ts (23/23 green).
- T-19-03: code read of all four registry-isolation controls in the e2e spec.
- T-19-05: code read + `vitest run` of storybook-docs.spec.ts (8/8 green) confirming the tripwire still matches the README after the WR-01 (4c97b05) wording change.
- T-19-04/T-19-06/T-19-SC: accept -- claims verified (pinned exact, tmp-only install, no tracked-manifest dependency, grep-confirmed) and logged above.
- No `## Threat Flags` section in any phase-19 SUMMARY; the three "Threat Model Compliance" sections map only to registered IDs. No unregistered flags.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-07
