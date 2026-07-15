---
phase: 20
slug: vite-analog-storybook-query-import-guidance-vite-client-read
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-07
---

# Phase 20 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Retroactive audit of a verified, CI-green phase (PR #27, Gate A + Gate B met).
> Every declared mitigation was verified present in the implemented code
> (code read of the cited file:line), not accepted on documentation or intent.
> Process threats (T-20-06/07/08) were verified against observable state (git
> tags, package.json version, SUMMARY evidence), not code.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Compiler diagnostic intake | `detectBundlerQueryImports` parses the specifier out of the compiler's English TS2307 `messageText` | Compiler-owned message text (NOT consumer input); still processed by regex -- must be linear/backtracking-safe |
| Post-filter diagnostic scan target | Detector scans the POST-boundary-filter kept set `reported`, never the pre-filter superset | In-project (consumer-visible) diagnostics only; boundary-filtered node_modules `?query` must never be named |
| Verdict surface | `CoreResult.bundlerQueryImports` (advisory) must never enter `evaluateResult` | Advisory field; must be structurally absent from the verdict input |
| Advisory notice output | `warnBundlerQueryImports` emits one `logger.warn` naming consumer specifiers | Consumer's own module specifiers only; no dependency error text |
| Release / publish gate | Phase stops at "PR open + green CI"; merge/tag/publish/env-approval human-gated | No version bump, no tag, no packages installed |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-20-01 | Denial of Service | `detect-bundler-query-imports.ts` regex | mitigate | Linear negated class `[^']+` -- no nested quantifier, no catastrophic backtracking (detect-bundler-query-imports.ts:58, `/Cannot find module '([^']+)'/`). `exec` result null-guarded before deref (line 60, `match !== null && match[1].includes('?')`). Input is compiler-owned `ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')` (line 51), not consumer input. | closed |
| T-20-02 | Information Disclosure | detector scan target + `CoreResult` field + executor message | mitigate | Detector is fed the POST-filter kept set `reported` (run-typecheck.ts:671, `detectBundlerQueryImports(ts, reported)`), where `reported = ts.sortAndDeduplicateDiagnostics(kept)` (line 639) is the boundary-filtered set (filter applied 618-632). The Pitfall-1 comment (663-670) explicitly locks this to the POST-filter arg and warns against unifying it with `detectTemplateCheckAborted` (pre-filter). Executor notice names only `result.bundlerQueryImports` (executor.ts:257, `Specifier(s): ${result.bundlerQueryImports.join(', ')}`) -- the consumer's own specifiers, never dependency error text. | closed |
| T-20-03 | Tampering (verdict integrity) | `evaluate-result.ts` / `EvaluateInput` / executor | mitigate | `bundlerQueryImports` is structurally ABSENT from `EvaluateInput` (evaluate-result.ts:69-78 -- Pick covers only errorCount/warningCount + the four coverage signals) and is never referenced in `evaluateResult` (body 95-140). The underlying TS2307 stay COUNTED errors: the detector only reads `reported` and returns `string[]`, never suppressing (detect-bundler-query-imports.ts:36-66); errorCount derives from `reported` (run-typecheck.ts:641-643). Executor reads only `.success` (executor.ts:72). D-05 verdict-neutrality tripwire in evaluate-result.spec.ts (per 20-01-SUMMARY). | closed |
| T-20-04 | Information (accuracy of guidance) | README Vite caveat | mitigate | Recipe grounded in spike 009 present: `"types": ["vite/client"]` fix (README:433-443, "one real project's 227 `?query` TS2307 to 0"); hand `declare module '*?raw'` shim fallback (445-449); the wildcard blind-spot honesty note (451-454); reaffirms the TS2307 are NEVER auto-suppressed (456-460). | closed |
| T-20-05 | Tampering (accidental release) | CHANGELOG / package.json | mitigate | `package.json` version unchanged at `0.1.1` (package.json:3). No new CHANGELOG version heading -- the bundler-query advisory is folded into the pre-existing `0.1.2` entry's Features (CHANGELOG.md:35-41) and Compatibility (72-76). No `angular-typechecker@0.1.2` git tag exists. | closed |
| T-20-06 | Elevation of Privilege | merge / nx release / npm-publish env | mitigate | Observable state confirms the phase stopped at "PR open + green CI": package.json still `0.1.1`, no `angular-typechecker@0.1.2` tag, no publish. 20-05-SUMMARY explicitly records "Nothing merged, released, tagged, or approved (D-11 / never-approve-deployments): merge of PR #27 and the v0.1.2 cut/publish remain human-gated." | closed |
| T-20-07 | Tampering (red-tree push) | pushed branch | mitigate | Gate A = PR #27 with all required CI green (20-05-SUMMARY:52, self-check PASSED). `main` is PR-only under an empty-bypass ruleset (AGENTS.md "The default-branch ruleset"), so no red-tree direct push is possible; changes land only through the PR after `ci` + CodeQL checks pass. | closed |
| T-20-08 | Tampering (wrong artifact verified) | packed tarball (Gate B) | mitigate | Gate B packed the built DIST tarball `angular-typechecker-0.1.1.tgz` -- confirmed to ship compiled `.js` incl. `src/core/detect-bundler-query-imports.js`, verified before install (20-05-SUMMARY:12-15) -- and exercised it against a real `radix-ng/primitives` checkout. Not the source root, not the published npm artifact. | closed |
| T-20-SC | Tampering (supply chain) | package installs | accept | Phase installs ZERO packages into angular-typechecker: 20-01-SUMMARY `tech-stack.added: []` (vite@8.1.0 was already a root devDependency); published `package.json` dependencies/peerDependencies unchanged. Every library remains lockfile-pinned. Documented in Accepted Risks Log (R-20-SC). | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-20-SC | T-20-SC | Phase 20 adds no packages to the published plugin `package.json` (dependencies `@nx/devkit`/`tslib` and peers `@angular/compiler-cli`/`typescript` unchanged; 20-01-SUMMARY `added: []`). The work is pure source (`detect-bundler-query-imports.ts`, the `run-typecheck.ts` finalize seam, the `executor.ts` advisory) + tests + hermetic fixtures + README/CHANGELOG prose on the locked stack. No supply-chain surface reaches the shipped artifact. | Lars Gyrup Brink Nielsen | 2026-07-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-07 | 9 | 9 | 0 | gsd-security-auditor |

Verification method notes:
- T-20-01/T-20-02/T-20-03: code read of detect-bundler-query-imports.ts (regex + null-guard + scan target), run-typecheck.ts (POST-filter `reported` feed at :671, field wiring), evaluate-result.ts (`EvaluateInput` :69-78, verdict body :95-140), executor.ts (`warnBundlerQueryImports` :247-259, `.success`-only read :72).
- T-20-04: code read of README:433-460 confirming the spike-009-grounded recipe, fallback, blind spot, and never-auto-suppress line.
- T-20-05/T-20-06: observable state -- package.json:3 = `0.1.1`, `git tag -l` shows no `angular-typechecker@0.1.2`, CHANGELOG 0.1.2 entry pre-existing (advisory folded in, no new heading), 20-05-SUMMARY human-gated statement.
- T-20-07: 20-05-SUMMARY Gate A (PR #27, required CI green) + AGENTS.md PR-only default-branch ruleset.
- T-20-08: 20-05-SUMMARY Gate B built-dist tarball provenance (ships compiled `.js`, verified pre-install).
- T-20-SC: accept -- `added: []` in 20-01-SUMMARY + unchanged published manifest; logged as R-20-SC.
- No `## Threat Flags` section exists in any phase-20 SUMMARY (20-01, 20-05); no unregistered attack surface. No unregistered flags.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-07
