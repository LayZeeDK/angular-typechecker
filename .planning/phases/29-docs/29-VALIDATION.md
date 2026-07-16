---
phase: 29
slug: docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-17
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vitest.config.ts` (existing) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx run-many -t test` |
| **Estimated runtime** | ~a few seconds (pure fs-read doc tripwire; no compiler load) |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker`
- **After every plan wave:** Run `nx run-many -t test`
- **Before `/gsd:verify-work`:** Full suite green PLUS the repo's non-test gates
  `nx format:check`, `nx lint angular-typechecker`, `nx typecheck angular-typechecker`
  (memory `verify-format-and-lint-before-release` — docs edits still trip Prettier/lint).
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

> Single plan `29-01` with 3 tasks (T1 README section, T2 CHANGELOG entry, T3 doc-tripwire
> spec). The `standalone-cli-docs.spec.ts` tripwire is delivered as T3 (ordered LAST so it ends
> GREEN — content-first, then lock), not a separate Wave 0 plan; it asserts both the README and
> the CHANGELOG content produced by T1/T2.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 (README `## Standalone CLI` + ToC) | 01 | 1 | DOC-01 | T-29-01 | Section presents `npx angular-typechecker` only; never `npx atc` (typosquat `atc@0.0.6` avoidance) | doc content | asserted by T3 spec | ❌ new | ⬜ pending |
| 29-01-02 (curated `## 0.2.2` CHANGELOG) | 01 | 1 | DOC-01 | T-29-02 | No internal id/scope leak in the public changelog | doc content | asserted by T3 spec | ❌ new | ⬜ pending |
| 29-01-03 (`standalone-cli-docs.spec.ts` tripwire) | 01 | 1 | DOC-01 | T-29-01 | HELP_TEXT drift-lock + `not.toContain('npx atc')` | unit (doc tripwire) | `nx test angular-typechecker` | ❌ new | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` — new doc tripwire for
  the `## Standalone CLI` section (covers DOC-01). Model on the existing
  `src/angular-cli-docs.spec.ts` / `src/storybook-docs.spec.ts` (pure fs read of `../README.md`,
  whitespace-normalized `toContain`). Highest-value assertions:
  - (a) `## Standalone CLI` heading present;
  - (b) ToC contains `[Standalone CLI](#standalone-cli)`;
  - (c) `npx angular-typechecker` present AND the section does NOT contain `npx atc`
    (mirrors `parse-args.spec.ts` `not.toContain('npx atc')`);
  - (d) each of the 7 flag tokens present (`--tsConfig`/`-c`, `--max-warnings`, `--fail-fast`,
    `--include-deps`, `--strict`, `--help`/`-h`, `--version`);
  - (e) the three exit codes `0` / `1` / `2` with their meanings.
  - **Drift-lock (closes D-06):** `const help = parseCliArgs(['--help']);` then assert each
    flag token in `help.text` also appears in the README section — the genuine README/`--help`
    drift guard. `parseCliArgs` is exported (`HELP_TEXT` need not be).
- [ ] (discretionary) CHANGELOG `## 0.2.2` heading present + no internal-id leak
  (e.g. `not.toMatch(/DOC-01|CLI-0\d|\bphase\b/i)`) — optional second assertion; the repo-root
  CHANGELOG does not ship to npm, so this is lower priority than the README tripwire.
- No framework install needed — Vitest infrastructure already exists.

*Everything else is prose/table edits to two existing files (README.md, CHANGELOG.md) — no new
test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendered README reads clearly and matches the tone of the existing `## Angular CLI` / `## Storybook` sections | DOC-01 | Prose quality / readability is subjective and cannot be asserted by a tripwire | Read the rendered `## Standalone CLI` section; confirm the exit-code table, flag list, and npx guidance are unambiguous to an Angular dev with no Nx |
| Curated `## 0.2.2` CHANGELOG entry is in end-user language | DOC-01 | Whether prose is "end-user language" vs jargon is a human judgment | Read the entry; confirm no `Layout B`/board/plan-id jargon (memory `changelog-readme-end-user-facing`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
