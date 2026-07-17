---
phase: 29-docs
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - packages/angular-typechecker/README.md
  - packages/angular-typechecker/src/standalone-cli-docs.spec.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** deep
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the new `## Standalone CLI` README section and the new
`standalone-cli-docs.spec.ts` doc-tripwire against the source of truth
(`src/cli/parse-args.ts` HELP_TEXT, `src/cli/main.ts`, `src/core/exit-codes.ts`,
`src/core/format-report.ts`, `package.json`, `CHANGELOG.md`).

The documentation is largely accurate and the tripwire is well-formed. Confirmed
by deep cross-file tracing:

- **Spec paths/import are all correct.** From `src/`, `../README.md` resolves to
  the package README, `../../../CHANGELOG.md` resolves to the repo-root CHANGELOG,
  and `./cli/parse-args` imports the parser. Nothing reads the wrong file.
- **The tripwire is not tautological.** `helpText` is derived from a live
  `parseCliArgs(['--help'])` call; if that seam regressed (returned a non-`help`
  kind) `helpText` collapses to `''` and every flag assertion fails. Good.
- **Every assertion is satisfiable against the current files** (all 7 flag tokens,
  the `0`/`1`/`2` codes, `verdict-fail`, `infrastructure-or-usage`, `atc@0.0.6`,
  the `## Standalone CLI` heading, and the ToC anchor are present; `npx atc` is
  absent; the CHANGELOG `## 0.2.2` slice contains no `DOC-01`/`CLI-0N`/`SC#`/
  `phase` leak).
- **The exit-code table is factually correct.** `main.ts` maps usage errors and
  `TypecheckInfrastructureError` to `2`, a completed run to
  `evaluateResult(...).success ? 0 : 1` (so warnings-exceeded and
  coverage-incomplete correctly land in `1`), matching the README table's
  `0`/`1`/`2` rows.
- **The `atc` alias claim is real** -- `package.json` `bin` declares both
  `angular-typechecker` and `atc` pointing at `./src/cli/bin.js`, so the
  supply-chain guidance ("`atc` is a post-install PATH shorthand, never `npx atc`")
  is accurate.

One doc-vs-source inaccuracy and two minor tripwire-efficacy notes follow.

## Warnings

### WR-01: `--fail-fast` description is inaccurate and inconsistent within the README

**File:** `packages/angular-typechecker/README.md:526` (and cross-referenced at `README.md:189`)
**Issue:** The Standalone CLI options table describes `--fail-fast` as
"Report only the first failing file." This mirrors `HELP_TEXT` verbatim
(`src/cli/parse-args.ts:75`), so the spec's drift-lock is satisfied -- but the
wording does not match the actual behavior in `src/core/format-report.ts:69-77`,
which truncates the already-sorted diagnostic list at the first *Error-category
diagnostic*, inclusive:

```ts
const firstError = diagnostics.findIndex(
  (diagnostic) => diagnostic.category === ts_.DiagnosticCategory.Error,
);
if (firstError >= 0) {
  toRender = diagnostics.slice(0, firstError + 1);
}
```

That output is neither "only the first failing file" nor file-scoped: diagnostics
are sorted by file then position (not by category), so the truncated list can
include warnings from files sorted *before* the first error, and it stops mid-file
at the first error rather than emitting the whole "first failing file."
Compounding this, the *executor* options table in the same README
(`README.md:189`) describes the identical flag differently as
"Report only the first error (output brevity)." A reader comparing the two
sections gets two different descriptions of one behavior, and the CLI one is the
less accurate.

**Fix:** Align both descriptions to the real behavior, e.g.
"Report diagnostics only up to the first error (output brevity; all diagnostics
are still gathered)." Because the docs tripwire ties the README CLI table to
`HELP_TEXT`, change them together: update `HELP_TEXT` in
`src/cli/parse-args.ts:75` and the README row at `README.md:526` in the same edit
so the drift-lock stays green. (Root cause is `HELP_TEXT`, which is outside this
phase's changed-file set; the README faithfully propagates it, so the fix must
touch both.)

## Info

### IN-01: Flag drift-lock does not catch an *added* flag

**File:** `packages/angular-typechecker/src/standalone-cli-docs.spec.ts:38-46,66-71`
**Issue:** `FLAG_TOKENS` is a hardcoded third copy of the flag list, iterated to
assert each token appears in both the README and the live `--help`. This catches a
flag *removed* from `HELP_TEXT` (the `helpText.toContain` assertion fails) or from
the README, and a *rename* (both assertions fail, forcing a `FLAG_TOKENS` update).
It does NOT catch a flag *added* to `HELP_TEXT` and the README but omitted from
`FLAG_TOKENS` -- the loop simply never checks it and the test passes. The header
comment's claim that "a HELP_TEXT change forces a README update (and vice versa)"
therefore overstates coverage for the additive case.

**Fix:** Optional. To make additions self-enforcing, derive the flag set from the
live help text (e.g. extract `/(^|\s)(-\w, )?--[a-z-]+/` tokens from `helpText`)
instead of hardcoding `FLAG_TOKENS`, then assert each derived token appears in the
README. Otherwise, soften the comment to state it locks removals/renames of the
listed tokens, not additions.

### IN-02: CHANGELOG hygiene regex `\bphase\b` is broad

**File:** `packages/angular-typechecker/src/standalone-cli-docs.spec.ts:96`
**Issue:** The public-notes hygiene guard rejects `/DOC-01|CLI-0\d|SC#|\bphase\b/i`
in the `## 0.2.2` slice. `\bphase\b` (case-insensitive) is aimed at leaked GSD
phase ids, but "phase" is also legitimate user-facing vocabulary for this tool
(the Angular compiler's diagnostic "phases" are described repeatedly in the
README). A future, entirely legitimate changelog entry that mentions a diagnostic
"phase" would trip this guard as a false positive. The current 0.2.2 entry is
clean, so the test passes today.

**Fix:** Optional. Tighten to the id-shaped leak pattern actually being guarded
(e.g. `/\bphase\s*\d/i` or `/phase[-\s]\d/i`) so the word "phase" alone in prose
does not fail the tripwire.

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
