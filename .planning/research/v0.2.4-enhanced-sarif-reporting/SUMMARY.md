# Project Research Summary — v0.2.4 Enhanced SARIF reporting for GitHub Code Scanning

**Synthesized:** 2026-07-21 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md (all namespaced here), grounded in the shipped reporter source, the live `ci.yml`, the closed spike PR #53, GitHub docs, and the installed `node-sarif-builder@4.1.0`. Confidence: HIGH.

## Key Findings

### 1. Only RULE-01..04 touches the published SARIF report (the sole release-bearing change)
- Implement in `sarif-report.ts` + one new pure `diagnostic-family.ts`. Switch from "always add the 18 NG rules" to **catalog one rule per `ruleId` actually emitted** (RULE-01 = catalog-on-demand, NOT enumerate every `TSxxxx`).
- Set `properties.tags` / `defaultConfiguration.level` / `help.text` by **mutating `SarifRuleBuilder.rule`** — `node-sarif-builder`'s `initSimple` doesn't cover them; this is the same escape hatch the module already uses for `result.partialFingerprints`. **No new dependency.**
- `help` ≠ `helpUri` (the alert rule-help panel needs `help`). `helpUri` alone leaves "No rule help available".
- **Family derivation is coarse, from `DiagnosticRecord.{rawCode,file}` inside the SARIF path only** (never added to `DiagnosticRecord` → JSON/human stay byte-unchanged): negative code + in catalog → `extended-diagnostics`; `rawCode >= 90000` → `tool`; `.html` file → `template-type-check`; else → `typescript`. The only imprecision (inline-template TS error in a `.ts` file → tagged `typescript`) is the already-deferred **RULE-FUT-01**.
- Ships as a patch bump; run the byte-for-byte additive audit vs `@0.2.3`.

### 2. MULTI, GATE, PROOF, DOC are CI/ruleset/docs only — NO release
- **MULTI (per-project categories):** CI-side, NOT reporter-side. A new `tools/ci/merge-sarif.mjs` stamps `automationDetails.id = angular-typecheck/<project>` per run and uploads one file with **no `category` input** (mirrors the existing fallow multi-run step). Discovery via a new `tools/ci/list-typecheck-projects.mjs` filtering `executor === 'angular-typechecker:typecheck'` (plain `--with-target typecheck` over-matches) → the 4 consumers today; anti-drift guard mirrors GUARD-01b. Keeping MULTI out of the reporter is what preserves the "only RULE bumps the version" rule.
- **PROOF:** an ISOLATED fixture at `tools/sarif-proof-fixture/` with **no `project.json`** (so `nx run-many -t typecheck` never touches it), emitting one diagnostic per family; assert via **bounded `gh api` polling** on the PR merge-ref (`refs/pull/<n>/merge`) under a dedicated `angular-typecheck-proof` category, asserting **set-membership** (category/tags/severity present), not counts. `sarif_id` + `GET /code-scanning/sarifs/{id}` is the deterministic wait handle; `security-events: read` scope.
- **DOC-01:** README note that "Scanned files" is a CodeQL-only GitHub panel third-party SARIF can't populate.

### 3. Two CRITICAL risks the roadmap must front-load
- **GATE-02 planning-PR deadlock (highest risk, GitHub-undocumented edge).** "Require code scanning results" is a **repository ruleset, independent of status checks**, that blocks a merge when a required tool's analysis is **missing / in-progress / not-configured** — NOT just on alerts. The repo's `changes` path-gate + skip-tolerant `ci` trick fixes the status-check deadlock but does NOT satisfy this GitHub-side "analysis exists" check. On a `.planning/`-only PR the path-skipped `code-scanning` job → no analysis → **merge locked** on empty-bypass `main`. **Mitigation: un-path-gate the `code-scanning` job so every PR to `main` uploads an analysis** (planning PRs re-run the clean analysis, cheap), evaluate the ruleset in "Evaluate" mode first, and know the `enforcement: disabled` recovery toggle. **Must be spiked/live-verified on a throwaway PR before enabling the ruleset on `main`.** Fork PRs also deadlock (read-only token → upload skipped) — document.
- **Release discipline.** Keeping MULTI in the reporter would make it release-bearing AND risk a non-additive SARIF change — keep it in CI. Only RULE-01..04 may bump the version.

### 4. Notable correction to prior notes
- `node-sarif-builder@4.1.0` `completeRunFields()` **auto-emits `run.artifacts[]`** and **auto-sets `result.ruleIndex`** — so v0.2.3's shipped SARIF ALREADY carries artifacts, yet the "Scanned files" panel is still empty → the CodeQL-only-gap finding is **doubly confirmed**, and the `sarif-report.ts` header comment (claims neither is emitted) is **stale and needs a doc fix** (fold into the RULE phase).

## Implications for Roadmap

- **Build order:** RULE (release substrate) → MULTI (reshapes the code-scanning job + discovery/guard) → PROOF (asserts RULE + MULTI end-to-end) → GATE + DOC last (promote `code-scanning` to required + enable the ruleset only once the proof is green). Suggested phases 33 (RULE), 34 (MULTI + discovery/guard), 35 (PROOF fixture + gh-assert), 36 (GATE + DOC + ruleset live-verify).
- **GATE-02 is a spike-gated, real-CI-only task** — do not lock the ruleset on `main` until the un-path-gate + no-deadlock behavior is proven on a throwaway PR; carry the `enforcement: disabled` recovery note.
- **GATE-01 reverses a deliberate decision** (code-scanning was kept out of `ci` so an outage can't deadlock merges) — acceptable (precedented by `cve-lite`) but must be documented, not assumed free.
- **Requirement refinements** (not blockers; fold into planning): RULE-01 = catalog-on-demand; RULE-02 = coarse file-based 4-way family with the inline-template edge deferred to RULE-FUT-01; GATE-02 acceptance = "planning + fork PRs do not deadlock", proven live.
- Repo constraints throughout: `main` is PR-only; SHA-pin every action; do NOT clobber the root `.planning/research/*.md`; do NOT file GitHub Issues.

## Sources
- `.planning/research/v0.2.4-enhanced-sarif-reporting/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` (this milestone's research, cited inline).
- Installed `node-sarif-builder@4.1.0` dist + `@types/sarif@2.1.7`; the shipped `sarif-report.ts`/`extended-catalog.ts`/`diagnostic-record.ts`; live `.github/workflows/ci.yml`; closed spike PR #53.
- GitHub docs: "Set code scanning merge protection", REST `code-scanning/{analyses,alerts,sarifs}`; `github/codeql-action` upload-lib; the prior multi-project SARIF research report.
