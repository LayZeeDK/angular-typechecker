# Requirements: angular-typechecker -- v0.2.4 (Enhanced SARIF reporting for GitHub Code Scanning)

**Defined:** 2026-07-21
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) without building or testing -- and, this milestone, make its GitHub Code Scanning integration first-class and continuously PROVEN.

Scope empirically de-risked by the 2026-07-20 spike (closed PR #53): the SARIF->alert pipeline, per-run categories, and rule tags/catalog/help were verified LIVE in Code Scanning; the "Scanned files" panel was proven to be an unfixable GitHub third-party limitation. Builds on the shipped v0.2.3 SARIF reporter + the merged CI dogfood wiring (PR #49).

## v1 Requirements

### Per-project analyses (MULTI)

- [ ] **MULTI-01**: angular-typechecker's CI SARIF upload reports one SARIF run per workspace project that uses the executor, each landing in GitHub Code Scanning as its own analysis under a distinct category `angular-typecheck/<project>` (merged into one file, single `upload-sarif`, no `category` input -- per-run `automationDetails.id` avoids GitHub's multi-run-same-category rejection).
- [ ] **MULTI-02**: The set of reported projects is auto-discovered from the workspace (a project that adds the `angular-typechecker:typecheck` target is covered with no CI edit; a project that drops it is dropped) -- with a guard so the discovered set cannot silently drift.

### Rule metadata (RULE) -- the release-bearing SARIF change

- [ ] **RULE-01**: Every emitted diagnostic references a cataloged SARIF rule across ALL families (TypeScript `TSxxxx`, template type-check, extended `NG8xxx`, tool `ATC900x`), so no Code Scanning alert shows a blank rule description (today only the 18 NG8xxx are cataloged).
- [ ] **RULE-02**: Each rule carries a diagnostic-family tag in `properties.tags` (`typescript` / `template-type-check` / `extended-diagnostics` / `tool`) so GitHub `tag:` filters group alerts by family.
- [ ] **RULE-03**: Each rule carries `defaultConfiguration.level` consistent with the diagnostic severity so GitHub `severity:` filtering and default alert severity are correct.
- [ ] **RULE-04**: Each rule carries SARIF `help` text (not only `helpUri`) so the alert detail page's rule-help panel renders instead of "No rule help available".

### Gating (GATE)

- [ ] **GATE-01**: The `code-scanning` CI job is a required member of the `ci` aggregate (so the dogfood upload running successfully is part of the merge gate).
- [ ] **GATE-02**: GitHub "Require code scanning results" is enabled on `main` for angular-typechecker + fallow, configured so that planning-only PRs (where `code-scanning` is path-skipped) are NOT deadlocked.

### Automated proof (PROOF)

- [ ] **PROOF-01**: A CI check emits one known diagnostic per family from an ISOLATED fixture (outside the normal `nx typecheck` gate) and asserts via the `gh` CLI (`code-scanning/analyses` + `code-scanning/alerts`) that each expected alert lands in Code Scanning with the expected category, tags, and severity.
- [ ] **PROOF-02**: The proof fails loudly (red check) if any expected alert, category, or tag is missing -- so a regression in the SARIF->Code Scanning contract is caught automatically, not manually.

### Documentation (DOC)

- [ ] **DOC-01**: The README/docs document that GitHub's tool-status "Scanned files" panel is a CodeQL-only telemetry surface that third-party SARIF cannot populate (with the spike evidence), so the empty panel is a known GitHub limitation, not a defect.

## v2 / Future Requirements

- **RULE-FUT-01**: Precisely distinguish `template-type-check` from `typescript` for TS-coded diagnostics that originate in templates (family cannot be derived from the `TSxxxx` code alone; needs the diagnostic's origin). Deferred unless a coarse file-extension heuristic proves insufficient.
- **MULTI-FUT-01**: Migrate per-project uploads from one merged multi-run file to a per-project CI matrix if the workspace grows past a handful of self-hosting projects.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Populating the "Scanned files" tool-status panel via SARIF | Proven a GitHub product gap (CodeQL-internal telemetry); `run.artifacts` is inert for third-party tools -- documented (DOC-01), not pursued |
| Emitting `run.artifacts` in the SARIF | No effect on the Scanned-files panel; adds bytes for no benefit |
| Filing a GitHub Issue for the Scanned-files limitation | User preference: no GitHub Issues filed on their behalf -- document in-repo instead |
| Duplicating findings gating in the `code-scanning` job | angular-typechecker findings already gate via `test`'s `nx typecheck`; fallow via the `fallow` job -- the code-scanning job stays a reporting/upload gate |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MULTI-01 | TBD | Pending |
| MULTI-02 | TBD | Pending |
| RULE-01 | TBD | Pending |
| RULE-02 | TBD | Pending |
| RULE-03 | TBD | Pending |
| RULE-04 | TBD | Pending |
| GATE-01 | TBD | Pending |
| GATE-02 | TBD | Pending |
| PROOF-01 | TBD | Pending |
| PROOF-02 | TBD | Pending |
| DOC-01 | TBD | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 11

---
*Requirements defined: 2026-07-21*
*Last updated: 2026-07-21 at milestone v0.2.4 kickoff*
