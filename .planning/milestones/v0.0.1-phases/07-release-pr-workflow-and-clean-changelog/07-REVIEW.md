---
phase: 07-release-pr-workflow-and-clean-changelog
reviewed: 2026-06-29T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - AGENTS.md
  - .github/workflows/ci.yml
  - nx.json
  - e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts
  - .planning/REQUIREMENTS.md
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-29
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found (0 Critical / 0 High -- approve; 2 Warnings + 3 Info are non-blocking)

## Summary

Reviewed the five in-scope Phase-7 source/config/docs files against the locked decisions
(07-CONTEXT.md D-01..D-17), the source-verified facts (07-RESEARCH.md), and the ACTUAL
codebase (nx.json release block, release.yml trigger + permissions, ci.yml, the act-compat
contract, the live CHANGELOG.md). Every load-bearing claim was cross-checked against the
real files rather than taken on faith.

**Verdict: 0 Critical / 0 High -- approve.** All four mechanical pieces are factually
correct and internally consistent:

- **nx.json** -- the diff is EXACTLY the one-field flip `release.git.tag: true -> false`;
  `commit:true`, `push:false`, `createRelease:false` are all unchanged (verified by direct
  read of lines 82-97). Matches D-01.
- **ci.yml** -- the skip-gate is correct: `dorny/paths-filter` is SHA-pinned to the exact
  research SHA (`9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0`), `actions/checkout` is
  the same v5.0.1 SHA used elsewhere, `persist-credentials: false` is preserved, the heavy
  jobs use the load-bearing NEGATIVE form `if: needs.changes.outputs.code != 'false'`, the
  aggregate `ci` job adds `changes` to `needs`, drops ONLY `'skipped'` from the fail set,
  keeps `failure` + `cancelled` fail-closed, retains `if: always()`, and the job id AND name
  are byte-stable `ci`. The `on:` trigger has NO `paths-ignore` (the only `paths-ignore`
  occurrence is inside an explanatory comment documenting the anti-pattern to avoid). The new
  `changes` job is additive to the act-compat plan (`ci/changes`) and collides with no
  `assert_absent` (the only `assert_absent` target is `release/publish`).
- **AGENTS.md** -- every release-mechanics claim is accurate against the real files: the
  nx.json `release.git` shape `{commit:true, tag:false, push:false}` + `createRelease:false`
  (verified), the `on: push: tags: ['angular-typechecker@*']` filter + the publish-job
  `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` gate (verified in
  release.yml), `environment: npm-publish` + `id-token: write`-only / no `contents: write`
  (verified). The kept-verbatim sections (0.x bump table; the
  `GIT_PUSH_FALSE_WITH_CREATE_RELEASE` landmine; the literal-version gotcha-1) are NOT
  regressed. The rewritten gotcha-3 lead and the checklist correctly describe the NEW flow
  (branch cut -> PR carrying `.planning/` -> merge commit -> tag the MERGE COMMIT
  `angular-typechecker@x.y.z` -> push -> `gh release create --notes-file ... --verify-tag`,
  never `--generate-notes`). The new "default-branch ruleset" note + D-12 lockout-recovery
  toggle are present. The added unified-`nx release` note is factually correct (the `version`
  subcommand rejects the top-level `release.git` block). ASCII-only confirmed (0 non-ASCII
  chars across the whole file).
- **release-hygiene spec** -- the new `git.tag === false` assertion is correct and matches
  the nx.json state; the three CHANGELOG leak-shape regexes have NO false negatives for the
  documented two-digit GSD plan-id shapes (`feat(05-01):`, `**06-02:**`, `05-01:`, `**06:**`,
  `06:`, deeper `**07-01-02:**`) and all return clean against the current CHANGELOG.md (test
  PASSES). The unrelated diff hunk in the PKG-04 SHA-pin assertion is a pure Prettier reflow
  (no semantic change).
- **REQUIREMENTS.md** -- REL-01/02/03 are defined with acceptance criteria, mapped to Phase
  7 in Traceability, and the recount arithmetic is consistent: 34 traceability rows, 34
  unique IDs (no duplicates), per-phase counts sum to exactly 34, coverage 34/34/0.

The findings below are all robustness/clarity issues, none blocking.

## Warnings

### WR-01: Two CHANGELOG leak-shape regexes false-positive on legitimate prose (future-release brittleness)

**File:** `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts:250-252`
**Issue:** Two of the three REL-03 leak-shape regexes match plausible _legitimate_ changelog
content, so a future curated entry could fail the suite even though it contains no GSD
plan-id scope. Empirically verified:

- `conventionalCommitScope = /\((\d{2}(?:-\d{2})*)\)/` matches ANY two-digit number in
  parentheses, not just a commit scope: `(22)`, `(24)`, `(42)`, `(12)` all match. A
  Compatibility line such as `supports Node (22) and (24)` -- entirely reasonable wording --
  would FAIL the test. (Good: 4-digit `(2026)` and `(2026-06)` do NOT match, because `\d{2}`
  must be immediately followed by `)` or `-`.)
- `bareLeadingScope = /\b\d{2}(?:-\d{2})*:/` matches a two-digit number followed by a colon
  anywhere: `Angular 22:`, `14:30` (time of day), `16:9` (aspect ratio), `Section 99:`,
  `port 80:` all match. `Angular 22:` is a very plausible Compatibility-section phrasing.

The current CHANGELOG.md passes (all three return clean -- verified), so this is NOT a leak
that slips through and NOT a failure today. The risk is a FALSE POSITIVE that blocks a future
release until someone diagnoses the over-broad regex. Note the comment at lines 247-249
describes the intent as "an internal GSD phase/plan scope", but the regexes match far more
than that.

**Fix:** Anchor the patterns to the actual leak grammar so they cannot match bare numbers in
prose. The leak always carries a conventional-commit type prefix or a Markdown emphasis
delimiter:

```ts
// conventional-commit scope: a type keyword immediately before the (NN[-NN]) scope
const conventionalCommitScope = /\b(?:feat|fix|perf|refactor|docs|chore|test|build|ci|style|revert)\([^)]*\b\d{2}(?:-\d{2})*\)/;
// bold/bare leading scope only at the start of a list item or heading line (multiline)
const boldHeadingScope = /\*\*\d{2}(?:-\d{2})*[:*]/; // already specific -- keep
const bareLeadingScope = /^[\s*#>-]*\d{2}(?:-\d{2})*:/m; // anchor to line start, not \b mid-prose
```

This keeps every documented leak shape caught (verified: `feat(05-01):`, `**06-02:**`,
leading `05-01:`/`06:`) while no longer tripping on `Node (22)`, `Angular 22:`, `14:30`, or
`16:9`. At minimum, anchor `bareLeadingScope` to a line start (`/^.../m`) and gate
`conventionalCommitScope` behind a commit-type keyword.

### WR-02: PKG-05 spec describe-block + comment now mislabels the flow as "local-first cut"

**File:** `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts:80,88-92,160-161`
**Issue:** Phase 7 (D-17) generalized the release flow from "cut locally on `main` -> push
the tag to `main`" to the Release-PR flow ("cut on a `release/*` branch -> PR -> merge ->
tag the merge commit"). AGENTS.md was rewritten to reflect this, but the spec's surrounding
prose was not. Three stale references remain:

- Line 80: `it('keeps the local-first cut decoupled from push + GitHub release (PKG-05 / D-13)')`
  -- "local-first cut" describes the OLD flow.
- Lines 88-92 comment: "...would push an UN-CURATED version commit + tag to a
  force-push-protected main before the changelog is hand-curated. The local-first cut
  requires both disabled -- the maintainer pushes the tag and creates the Release after
  curation." This now describes the superseded model; under the new flow the cut happens on a
  `release/*` branch and the tag targets the merge commit, never `main` directly.
- Lines 160-161 comment: "The GitHub release is cut locally (D-13)".

The ASSERTIONS themselves remain correct (`git.push:false` + `createRelease:false` are still
the right invariants and the new flow still relies on them). This is a documentation-drift /
internal-consistency issue, not a behavioral one -- but the file is a regression gate whose
comments are load-bearing for the next maintainer, and AGENTS.md (the authority) now
contradicts these comments.

**Fix:** Update the describe/it title and the two comments to the Release-PR vocabulary, e.g.
"keeps the release cut decoupled from push + GitHub release" and reword the rationale to
"...the cut on a `release/*` branch must not push or auto-create a Release; the maintainer
tags the merge commit and creates the Release after the PR merges and the changelog is
curated." Keep the assertions unchanged.

## Info

### IN-01: Recount note is mildly self-contradictory ("34 ... checklist" vs "30 checklist")

**File:** `.planning/REQUIREMENTS.md:112`
**Issue:** The note reads "the enumerated v0.0.1 checklist contains **34** distinct
requirement IDs (the original "26 total" header was a source miscount; 30 checklist +
PKG-05 ... + REL-01/REL-02/REL-03 ...)". The lead clause says the checklist contains 34,
then decomposes that as "30 checklist + 4 others" -- but PKG-05 and the three REL IDs ARE
physically in the enumerated checklist (lines 54, 67-69), so "30 checklist" double-describes
the same list and contradicts the "34 ... checklist" lead. The total (34) is correct and
fully verified (34 rows, 34 unique IDs, per-phase counts sum to 34).
**Fix:** Phrase the decomposition against the ORIGINAL baseline, e.g. "...contains **34**
distinct requirement IDs: the 30 originally enumerated, plus PKG-05 (Phase 5.1 insertion) and
REL-01/REL-02/REL-03 (Phase 7 insertion); the original '26 total' header was a source
miscount." This removes the "checklist contains 30 vs 34" ambiguity.

### IN-02: bare/conventional leak regexes will miss single-digit plan ids (acceptable, but undocumented)

**File:** `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts:250-252`
**Issue:** All three regexes require `\d{2}` (two digits), so a single-digit scope such as
`feat(7):`, `**6-2:**`, or `7-1:` would NOT be caught (verified empirically). This is
consistent with the GSD convention of zero-padded two-digit plan ids (`07-01`) and with the
acceptance criterion's `\b\d{2}(-\d{2})*\b` shape, so it is acceptable -- but the test's
comment (lines 246-249) does not state the two-digit assumption, so a future reader might
assume single-digit ids are also guarded.
**Fix:** Add one line to the comment, e.g. "Assumes GSD's zero-padded two-digit plan ids
(`NN`/`NN-NN`); single-digit forms are out of scope by convention." No code change needed.

### IN-03: REL-\* statuses read "Pending" while REL-01's config + spec are already shipped

**File:** `.planning/REQUIREMENTS.md:67-69,147-149`
**Issue:** REL-01/02/03 are marked `[ ]` / "Pending" in both the checklist and Traceability.
The phase VERIFICATION.md (07-VERIFICATION.md) records all three as SATISFIED/ACHIEVED
(REL-01 config + spec done; REL-02 live ruleset switched; REL-03 changelog clean + regression
gate). The one genuinely-open item is the planning-only skip-gate LIVE proof (human-gated,
Phase-6-SC3 class). Leaving the IDs "Pending" is defensible (the phase status is
`human_needed` pending that live proof, and per-release REL-03 curation is ongoing), but the
status field now lags the verification record.
**Fix:** Optional -- reconcile during phase close-out: either flip to "Complete" once the
human skip-gate proof lands, or annotate the status (e.g. "Pending -- live skip-gate proof")
so the lag is intentional and visible rather than looking like an un-updated checkbox.

---

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
