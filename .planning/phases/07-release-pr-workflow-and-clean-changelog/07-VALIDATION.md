---
phase: 07
slug: release-pr-workflow-and-clean-changelog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 7 is a release-process/config/docs phase: most deliverables are
> **one-time live operational verifications** (the ruleset switch) or
> **live-PR proofs** (the ci.yml skip-gate), not repeatable CI tests. The
> repeatable surface is the `release-hygiene` regression spec + workflow
> static validation (actionlint + act-compat). See RESEARCH.md
> "## Validation Architecture" for the full tier classification.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (+ actionlint 1.7.7, act v0.2.89 for workflow validation) |
| **Config file** | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (serialized; forks/singleFork) |
| **Quick run command** | `npx nx run angular-typechecker-install-e2e:test` |
| **Full suite command** | `npx nx run-many -t test -p angular-typechecker angular-typechecker-install-e2e` |
| **Workflow validation** | `./actionlint -color` (1.7.7) + `bash tools/act/act-compat.sh` (act v0.2.89) |
| **Estimated runtime** | ~30-120s (release-hygiene spec is fast text/FS; actionlint/act-compat seconds) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx run angular-typechecker-install-e2e:test`; for any `ci.yml` edit also run `./actionlint -color` and `bash tools/act/act-compat.sh`.
- **After every plan wave:** Run the full suite + `bash tools/act/act-compat.sh`.
- **Before `/gsd:verify-work`:** Full suite green; actionlint + act-compat green on the modified `ci.yml`.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

> Populated after plans are created (task IDs assigned by the planner) and
> finalized by `/gsd:validate-phase` post-execution. The REL-mapped behaviors
> and their verification tiers are pre-classified below from RESEARCH.md.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {07-NN-NN} | {NN} | {W} | REL-01 | — | `nx.json` has `release.git.tag:false` (+ push:false, createRelease:false) | unit (regression) | `npx nx run angular-typechecker-install-e2e:test` | ❌ W0 (add `git.tag===false` assertion) | ⬜ pending |
| {07-NN-NN} | {NN} | {W} | REL-01 | — | `release.yml` stays OIDC-only/frozen | integration (existing) | `npx nx run angular-typechecker-install-e2e:test` | ✅ existing | ⬜ pending |
| {07-NN-NN} | {NN} | {W} | REL-02 | T-07 (no unprotected window / publish bypass) | ci.yml modified YAML stays parseable + spec-valid | unit (static) | `./actionlint -color` + `bash tools/act/act-compat.sh` | ✅ existing CI jobs | ⬜ pending |
| {07-NN-NN} | {NN} | {W} | REL-03 | T-07 (no scope/PII leak) | curated CHANGELOG.md section has no plan-id scope | unit (grep/spec) | `rg -n '\b\d{2}(-\d{2})*:' CHANGELOG.md` (latest section empty) | ❌ W0 (optional hygiene assertion) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts` — ADD an `it(...)` asserting `nx.json` `release.git.tag === false` (the spec already asserts `push`/`createRelease` false; `tag` is the new REL-01 field).
- [ ] (Optional, recommended) a CHANGELOG-hygiene assertion: a spec or `rg` check that the latest `CHANGELOG.md` section contains no `\b\d{2}(-\d{2})*:` / `**NN:**` plan-id scope (makes REL-03 automatable; near-zero cost).
- [ ] No framework install needed — Vitest, actionlint, act are already provisioned.

---

## Manual-Only Verifications

> These are one-time live operations or live-PR proofs, recorded in
> VERIFICATION.md the way Phase 6 SC3 was — NOT repeatable CI assertions
> (re-asserting live GitHub ruleset state every CI run would need a token +
> a GitHub round-trip; out of scope for the test suite).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ruleset 18229122 active + strict:false + 3 checks + empty bypass + merge:["merge"] | REL-02 | Live GitHub config, changed once via `gh api` PUT | `gh api repos/LayZeeDK/angular-typechecker/rulesets/18229122 --jq '{enforcement, ...}'` (RESEARCH Runbook 2 step 2) |
| v0.0.1 ruleset (18229088) deleted | REL-02 | One-time live DELETE | `gh api repos/LayZeeDK/angular-typechecker/rulesets/18229088` returns 404 |
| Release-tag ruleset (18229053) retained | REL-02 | Live config assertion | `gh api repos/LayZeeDK/angular-typechecker/rulesets/18229053` returns active tag ruleset |
| ci.yml planning-only PR skips heavy jobs yet `ci` reports success; code PR runs the matrix | REL-02 (DX) | Requires a real GitHub PR (act cannot emulate path-filter + required-check semantics) | Draft PR with a `.planning/`-only diff (ci green, test/e2e skipped) + a code-touching diff (matrix runs) — mirrors Phase 6 SC3 draft-PR proof |
| release-branch `nx release --dry-run` shows version+changelog and creates NO tag | REL-01 | Needs a release context; not a CI assertion | `npx nx release --dry-run` on a `release/*` branch — read "Tagging ... Skipped" |
| GitHub Release notes match the curated CHANGELOG section | REL-03 | Per-release human-authored content | `gh release view angular-typechecker@x.y.z` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (or are classified manual-only operational verifications above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the `release-hygiene` `git.tag:false` assertion (+ optional CHANGELOG-hygiene)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter (post-validate-phase)

**Approval:** pending
