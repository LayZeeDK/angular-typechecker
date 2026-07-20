---
phase: 29
slug: docs
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
audited: 2026-07-17
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
| 29-01-01 (README `## Standalone CLI` + ToC) | 01 | 1 | DOC-01 | T-29-01 | Section presents `npx angular-typechecker` only; never `npx atc` (typosquat `atc@0.0.6` avoidance) | doc content | asserted by T3 spec | ✅ | ✅ green |
| 29-01-02 (curated `## 0.2.2` CHANGELOG) | 01 | 1 | DOC-01 | T-29-02 | No internal id/scope leak in the public changelog | doc content | asserted by T3 spec | ✅ | ✅ green |
| 29-01-03 (`standalone-cli-docs.spec.ts` tripwire) | 01 | 1 | DOC-01 | T-29-01 | HELP_TEXT drift-lock + `not.toContain('npx atc')` | unit (doc tripwire) | `nx test angular-typechecker` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` — doc tripwire for
  the `## Standalone CLI` section (covers DOC-01). Delivered; modeled on
  `src/angular-cli-docs.spec.ts` (pure fs read of `../README.md`,
  whitespace-normalized `toContain`). All highest-value assertions present and green:
  - (a) `## Standalone CLI` heading present (spec L49-51);
  - (b) ToC contains `[Standalone CLI](#standalone-cli)` (L53-55);
  - (c) `npx angular-typechecker` present AND README does NOT contain `npx atc`
    (L57-60; mirrors `parse-args.spec.ts` `not.toContain('npx atc')`), plus `atc@0.0.6`
    named (L62-64);
  - (d) each of the 7 flag tokens present (`-c, --tsConfig`, `--max-warnings`, `--fail-fast`,
    `--include-deps`, `--strict`, `-h, --help`, `--version`) — L66-71;
  - (e) the three exit codes `` `0` `` / `` `1` `` / `` `2` `` plus `infrastructure-or-usage`
    and `verdict-fail` (L73-80).
  - **Drift-lock (closes D-06):** `const help = parseCliArgs(['--help']);` (L35-36) then each
    flag token asserted in BOTH `helpText` AND the README (L66-71) — a genuine,
    non-tautological README/`--help` drift guard reading the LIVE help output, not a hardcoded
    copy. Verified: renaming/dropping a flag in `HELP_TEXT` or the README fails the spec.
- [x] CHANGELOG `## 0.2.2` heading present + no internal-id leak over the sliced entry
  (`not.toMatch(/DOC-01|CLI-0\d|SC#|\bphase\b/i)`, spec L85-97). First tripwire to also read
  the repo-root CHANGELOG (`../../../CHANGELOG.md`).
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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s (full suite 5.54s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** APPROVED — nyquist_compliant

---

## Audit Verdict (2026-07-17)

**Result: COVERED. Phase 29 / DOC-01 is nyquist-compliant. No gaps; 0 tests generated.**

The single phase requirement DOC-01 is fully covered by the shipped doc-tripwire
`packages/angular-typechecker/src/standalone-cli-docs.spec.ts` (8 tests). Coverage was
verified adversarially, not assumed:

- **Ran the suite** (`nx test angular-typechecker --skip-nx-cache`): 44 files / 447 tests
  passed, including `standalone-cli-docs.spec.ts` (8/8 green, 4ms).
- **Confirmed the assertions target DOC-01's behavior** (not a simpler proxy):
  - Section + ToC anchor existence (README ships to npm).
  - Supply-chain guard `not.toContain('npx atc')` over the whole README (T-29-01, load-bearing
    D-05) + `atc@0.0.6` named.
  - Flag-set drift-lock across BOTH the README and the LIVE `parseCliArgs(['--help'])` output.
    Confirmed non-tautological: `helpText` is derived from source `HELP_TEXT`, so a flag
    rename/drop in either surface fails the spec.
  - Exit-code triad `` `0` ``/`` `1` ``/`` `2` `` + `infrastructure-or-usage` + `verdict-fail`.
  - CHANGELOG `## 0.2.2` hygiene: entry sliced and regex-asserted leak-free (T-29-02).

Residual DOC-01 sub-behaviors are legitimately manual and recorded under Manual-Only
Verifications (rendered-prose readability; end-user-language judgment of the `## 0.2.2` entry).
These are prose-quality judgments that no tripwire can assert — not uncovered testable behavior.
