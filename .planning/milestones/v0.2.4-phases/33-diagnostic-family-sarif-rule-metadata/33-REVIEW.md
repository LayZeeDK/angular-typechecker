---
phase: 33-diagnostic-family-sarif-rule-metadata
reviewed: 2026-07-21T08:50:21Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - packages/angular-typechecker/src/core/diagnostic-family.ts
  - packages/angular-typechecker/src/core/diagnostic-family.spec.ts
  - packages/angular-typechecker/src/core/sarif-report.ts
  - packages/angular-typechecker/src/core/sarif-report.spec.ts
  - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts
  - packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap
  - packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: resolved
resolution:
  WR-01: fixed in commit 029b45d (full RuleMeta rebuilt on family upgrade; D-04 spec hardened)
  IN-01: deferred -- a shared SYNTHESIZED_CODE_FLOOR const would require editing diagnostic-record.ts, which D-10/D-12 freeze byte-unchanged this phase; revisit in a phase allowed to touch that module
---

# Phase 33: Code Review Report

**Reviewed:** 2026-07-21T08:50:21Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** resolved (WR-01 fixed in 029b45d; IN-01 deferred -- see Resolution)

## Resolution (orchestrator, 2026-07-21)

- **WR-01 (warning) -- FIXED** in commit `029b45d`. The family upgrade now rebuilds the
  full `RuleMeta` via `buildRuleMeta(record, 'template-type-check')` while preserving the
  first-observed level (D-06), so the tag AND the description/help/URI all describe the
  template family regardless of observation order. The D-04 spec was hardened to assert
  `shortDescription` / `helpUri` / `help.text` in both orders (it previously asserted only
  the tag, which is why it missed this).
- **IN-01 (info) -- DEFERRED.** A shared `SYNTHESIZED_CODE_FLOOR` const would need
  `diagnostic-record.ts` to reference it, but D-10/D-12 freeze that module byte-unchanged
  for this phase (the additive-only audit depends on it). Introducing the const in only one
  of the two sites would not achieve the single-source-of-truth goal and would arguably be
  worse. Revisit when a future phase is allowed to touch `diagnostic-record.ts`.

## Summary

Reviewed the Phase 33 SARIF rule-metadata additions at deep depth: the new pure
`diagnostic-family.ts` classifier (`familyOf`), the on-demand rule catalog fold and
`buildRuleMeta` in `sarif-report.ts`, their unit specs, the real-fixture integration
spec, and the two generated snapshots. Cross-checked the call chains into the
untouched siblings (`codeStringOf`, `ngCodeOf`, `NG`, the `ATC`/`NG` code-string
formats, `EXTENDED_DIAGNOSTIC_CATALOG`, `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` /
`REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE`) to verify the boundaries line up.

Overall the diff is careful and the classifier is correct: the `rawCode`
sign/range-before-`.html` order is sound (as documented and intentional), the
`extended-diagnostics` catalog lookup keys (`'NG' + ngCode`) match the humanized
`record.code`, the `tool` keys (`'ATC' + code`) match, the never-drop / never-mask
verdict guarantees hold, and the fingerprint tuple is OS-invariant. No security
issues: no injection sink, no `eval`/`exec`, no hardcoded secret, no forbidden email
or domain, and the snapshots carry only repo-relative forward-slash URIs (no drive
letter, no absolute path).

One substantive defect: the catalog fold's family-upgrade path (`.ts` then `.html`
for the same TypeScript code) leaves the rule's `shortDescription` / `helpUri` /
`help.text` describing a generic TypeScript diagnostic while re-tagging it
`template-type-check`, and the result is order-dependent -- contradicting the code's
own "the fold is order-independent" claim. Details below.

## Structural Findings (fallow)

Source: `fallow audit --changed-since` (phase 33 scope). Phase-scoped summary:
`dead_code_issues=0`, `duplication_clone_groups=0`, `complexity_findings=1`. The
project-level `verdict=fail` is reachability noise, not phase-specific.

- **COMPLEXITY (moderate) -- `sarif-report.ts:229` `buildRuleMeta` (cyclomatic 11,
  cognitive 8, 56 lines, CRAP 37.1).** Assessed and **dismissed as not a defect.**
  `buildRuleMeta` is a flat four-family classifier (extended-diagnostics / tool /
  template-type-check / typescript) with exactly one early-return object literal per
  family and no nesting; the branch order is load-bearing by design and documented.
  The cyclomatic count is inflated by the `??` / `?:` fallbacks (each counted as a
  branch), not by real control-flow depth. The `coverage_source: "estimated"` tier is
  a false signal here: the function is exercised for all four families by
  `sarif-report.spec.ts` (TS2322 typescript, ATC90001 tool, the catalog NG code
  extended-diagnostics, NG8002 template-type-check, the D-04 `.html`-wins reducer, the
  D-06 first-observed level tie-break) AND by `machine-reporters-sarif.integration.spec.ts`
  over real cold-compiler fixtures for every family. No split or coverage action is
  warranted. (The real gap is in `buildRuleMeta`'s CALLER, not this function -- see
  WR-01.)

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: Family upgrade leaves stale `shortDescription` / `helpUri` / `help.text`, producing order-dependent, self-contradictory rule metadata

**File:** `packages/angular-typechecker/src/core/sarif-report.ts:145-168` (the PASS-1
fold; upgrade block at `162-167`)

**Issue:**
When the SAME TypeScript rule id (e.g. `TS2322`) fires in both a `.ts` file and an
external `.html` template within one run, the fold upgrades the family tag but leaves
every other family-derived field untouched:

```ts
if (
  family === 'template-type-check' &&
  existing.family !== 'template-type-check'
) {
  existing.family = 'template-type-check';   // ONLY the tag is changed
}
```

`existing` was built by `buildRuleMeta` from the FIRST occurrence. So when the `.ts`
occurrence is seen first (the likely default, since source files are typically
gathered before their templates), the emitted rule ends up:

- `properties.tags` = `['template-type-check']` (upgraded, correct)
- `shortDescription.text` = `'TypeScript diagnostic TS2322'` (stale -- says TypeScript)
- `helpUri` = `https://www.typescriptlang.org/docs/handbook/2/understanding-errors.html`
  (stale -- points at the TypeScript handbook, not the Angular template guide)
- `help.text` = `'A TypeScript compiler diagnostic (TS2322)...'` (stale)

The rule's help panel and help link therefore contradict its own family tag. In the
reverse order (`.html` first) the rule instead gets the Angular
`template-type-check` shortDescription / `helpUri`
(`https://angular.dev/tools/cli/template-typecheck`) / help text. So the emitted SARIF
is **order-dependent** for these three fields -- directly contradicting the code
comment on line 158 ("only a `typescript` entry can ever upgrade ... so the fold is
order-independent"), which is only true for the tag, not for the full `RuleMeta`.

This is a reachable, real scenario, not a synthetic one: the Angular compiler reports
external-template type-check failures with TypeScript codes attributed to the `.html`
file, while the same TS code also occurs in ordinary component/service `.ts` files.
The phase's own `tsInHtml()` fixture and the layout-b-host integration fixture confirm
the team designs for TS codes landing in `.html`.

**Why the existing tests miss it:** the D-04 unit test
(`sarif-report.spec.ts:264-278`, "in either order") asserts only
`rules[0].properties?.tags` -- never `shortDescription` / `helpUri` / `help.text` --
so both orderings pass despite emitting different metadata. The byte-stable two-run
tests do not catch it either, because a single fixture's diagnostic order is stable
run-to-run.

Classified WARNING rather than BLOCKER because the blast radius is descriptive
metadata for one edge rule: the load-bearing `tags` filter field is correct, the
never-drop / never-mask verdict guarantees are untouched, `help.text` is still
non-empty (RULE-04's literal requirement is met), and the stale TypeScript help/link
is still valid for `TS2322`. No wrong verdict, crash, or security impact. It is,
however, a genuine correctness/determinism defect (contradictory metadata + a false
invariant claim) and should be fixed before ship.

**Fix:** on upgrade, rebuild ALL family-derived fields via `buildRuleMeta`, keeping
only the first-observed level (D-06):

```ts
if (
  family === 'template-type-check' &&
  existing.family !== 'template-type-check'
) {
  // Rebuild shortDescription / helpUri / helpText to match the upgraded family,
  // not just the tag; keep the FIRST-observed level (D-06).
  const upgraded = buildRuleMeta(record, 'template-type-check');
  upgraded.level = existing.level;
  catalog.set(ruleId, upgraded);
}
```

`buildRuleMeta(record, 'template-type-check')` derives its three text fields from
`record.code` alone, so this makes both input orders emit byte-identical metadata and
restores the order-independence the comment claims. Also harden the D-04 test to
assert `shortDescription` / `helpUri` / `help.text` (not just `tags`) in both orders so
the invariant is actually pinned.

### Info

#### IN-01: The `90000` synthesized-code floor is a bare literal duplicated across two modules

**File:** `packages/angular-typechecker/src/core/diagnostic-family.ts:58` (and the
mirror in `diagnostic-record.ts:111` `codeStringOf`)

**Issue:**
`familyOf` dispatches `tool` on `record.rawCode >= 90000`, and `codeStringOf`
independently formats `'ATC' + rawCode` on `rawCode >= 90000`. The two MUST agree
(otherwise a code could be labeled `ATC...` but tagged non-`tool`, or vice versa), yet
the `90000` boundary is a bare literal in both places. This is the same
single-source-of-truth invariant the codebase deliberately enforces elsewhere (e.g.
`EXTENDED_NG_CODES` is derived from `EXTENDED_DIAGNOSTIC_CATALOG` to prevent desync;
`ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` / `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE` live in one
place).

**Fix:** export a shared constant (e.g. `SYNTHESIZED_CODE_FLOOR = 90000`) from
`diagnostic-codes.ts` -- the canonical home already documenting the 90000+ synthesized
space -- and reference it from both `familyOf` and `codeStringOf` so the classifier
and the code-string formatter can never drift on the boundary. Minor; the boundary is
stable and documented, so this is a hardening nicety, not a bug.

---

_Reviewed: 2026-07-21T08:50:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
