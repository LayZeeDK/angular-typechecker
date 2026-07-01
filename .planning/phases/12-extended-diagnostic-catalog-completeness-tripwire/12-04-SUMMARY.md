---
phase: 12-extended-diagnostic-catalog-completeness-tripwire
plan: 04
subsystem: planning-docs
tags: [diagnostics, catalog, documentation, CAT-05]
requires:
  - "12-01 EXTENDED_DIAGNOSTIC_MEMBERS (the as-const 18-member source of truth the tripwire consumes)"
provides:
  - "DIAGNOSTIC-CATALOG.md corrected to the authoritative 18-member ExtendedTemplateDiagnosticName set (CAT-05)"
affects:
  - ".planning/research/DIAGNOSTIC-CATALOG.md"
tech-stack:
  added: []
  patterns:
    - "Enum-as-source-of-truth documentation: the catalog doc mirrors @angular/compiler-cli's ExtendedTemplateDiagnosticName enum, not the angular.dev docs list"
key-files:
  created: []
  modified:
    - ".planning/research/DIAGNOSTIC-CATALOG.md"
decisions:
  - "Carried the two enum-only members' (NG8011, NG8112) introduction versions from compiler history without independent docs re-verification, and said so in the doc -- the enum (not the intro-version) is the membership authority the tripwire keys on"
  - "Rephrased corrective prose to avoid the literal strings 'not promotable' and 'jscodeshift' so the plan's literal string-count acceptance gates return zero, while preserving the corrected meaning (out-of-band-but-promotable; committed static fixtures over AST mutation)"
metrics:
  duration: "~11 min"
  completed: "2026-07-01"
  tasks: 1
  files: 1
---

# Phase 12 Plan 04: DIAGNOSTIC-CATALOG.md rewrite to the authoritative 18-member enum set Summary

Rewrote `.planning/research/DIAGNOSTIC-CATALOG.md` so its extended-diagnostics section is driven
by the source-verified 18-member `ExtendedTemplateDiagnosticName` enum (`@angular/compiler-cli@22.0.4`)
instead of the docs-derived 16-entry list, correcting the exact docs-vs-enum gap the DRIFT-01
tripwire exists to catch (CAT-05).

## What was done

Single documentation-only task (no source code, no packages):

- **Extended table rewritten to 18 members** in enum-declaration order, each row carrying the
  enum string value + NG code + default category (all `Warning`) + introduction version. Added the
  two enum-only members the old catalog omitted or misclassified: NG8011
  (`controlFlowPreventingContentProjection`) and NG8112 (`unusedLetDeclaration`). Retained NG8113
  (`unusedStandaloneImports`) and NG8021 (`deferTriggerMisconfiguration`).
- **NG8110 and NG8118 noted as non-enum `ErrorCode`s** (`UNSUPPORTED_INITIALIZER_API_USAGE`,
  `FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION`) that fall inside the NG81xx range but are not
  configurable extended diagnostics -- with the "NG81xx numeric filter is provably wrong" note.
- **Promotability reframed to emission-mechanism:** all 18 are promotable via
  `extendedDiagnostics.defaultCategory: "error"`; the only real split is factory-based (16) vs
  emitted out-of-band (2: NG8011, NG8113), and BOTH out-of-band checks honor `defaultCategory`.
  NG8011 is framed as out-of-band-but-promotable; the stale un-promotable-exception framing is
  gone (D-09/D-13).
- **Baseline table cleaned:** dropped the unverified alias parentheticals (NG8004 (NG1019),
  NG2005 (NG1005), NG3003 (NG8003)); marked NG6100 a `Warning` (the `WARN_` prefix); added a
  Category column. The runtime-error scope-boundary paragraph is unchanged.
- **Test-organization section replaced:** removed the per-introduction-version file-split guidance
  and the programmatic-injection guidance; replaced with the D-01/D-05 decision -- a single
  enum-keyed `it.each` catalog (intro-version a row field) plus the type-level enum-vs-table
  completeness tripwire run by `typecheck-drift`, over committed static fixtures.
- **Intro prose + VERIFY banner reframed** so the enum (build/test source of truth) drives
  membership and DRIFT-01 consumes the enum precisely because the docs lag/omit members.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Rephrased corrective prose to satisfy literal string-count gates**
- **Found during:** Task 1 verification.
- **Issue:** My first draft corrected the stale claims using their literal wording in negation
  (e.g. `never "not promotable"`, `no jscodeshift`). The plan's acceptance criteria are literal
  string-count gates that require `git grep -ci "not promotable"` and `git grep -ci "jscodeshift"`
  to return ZERO -- even a negating mention trips them.
- **Fix:** Rephrased the three passages to convey the correction without the banned literal
  strings: "treated NG8011 as an un-promotable exception" (past-framing), "programmatic AST
  mutation of generated fixtures" instead of naming the tool, and a descriptive
  "per-introduction-version file split (one `*.integration.spec.ts` per Angular major)" instead of
  the `executor.angularNN` literal. Meaning preserved; all gates now return zero.
- **Files modified:** `.planning/research/DIAGNOSTIC-CATALOG.md`
- **Commit:** (this plan's commit)

## Verification

All plan acceptance-criteria gates pass:

- `git grep -c "controlFlowPreventingContentProjection\|unusedLetDeclaration\|deferTriggerMisconfiguration"`
  -> matches (each member present individually: 3 / 2 / 1 lines).
- `git grep -c "8110\|8118"` -> 4 lines (both noted as non-enum ErrorCodes).
- `git grep -ci "not promotable"` -> 0 (exit 1, no matches).
- `git grep -ci "jscodeshift\|executor.angularNN"` -> 0 (exit 1, no matches).
- `git grep -c "NG1019\|NG1005\|NG8003"` -> 0 (exit 1, no matches).
- `rg -n '[^\x00-\x7F]'` -> 0 (no non-ASCII characters introduced).

## Traceability

Implements CONTEXT.md decisions D-10 (full rewrite to the 18-member enum), D-11 (NG8112
included), D-12 (NG8110/NG8118 noted non-enum; stale test-org guidance replaced), and D-13
(the un-promotable-exception framing for NG8011 removed; CAT-02/CONSENSUS flagged superseded is
handled in ROADMAP/CONTEXT, not in this doc). Satisfies requirement CAT-05.

## Self-Check: PASSED

- File exists: `.planning/research/DIAGNOSTIC-CATALOG.md` (FOUND).
- Commit: recorded below after the atomic commit.
