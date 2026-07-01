---
phase: 07-release-pr-workflow-and-clean-changelog
plan: 01
subsystem: release-mechanism
tags: [release, nx-release, changelog, requirements, regression-gate]
requires:
  - 'nx.json release block (Phase 5/5.1)'
  - 'release-hygiene.int.spec.ts PKG-03/PKG-04 gates (Phase 5/6)'
  - 'CHANGELOG.md curated 0.0.1/0.0.2 entries (Phase 5/5.1)'
provides:
  - 'nx.json release.git.tag:false (REL-01 config change -- cut creates no tag)'
  - 'release-hygiene git.tag===false regression assertion (Wave 0 gate)'
  - 'release-hygiene CHANGELOG-no-plan-id-scope assertion (REL-03 backstop)'
  - 'REQUIREMENTS.md REL-01/02/03 definitions + Traceability rows'
affects:
  - 'Future release cuts (the cut now commits-not-tags; maintainer tags the merge commit post-PR)'
  - 'ci.yml path-aware skip + branch-protection switch + AGENTS.md rewrite (later Phase-7 plans)'
tech-stack:
  added: []
  patterns:
    - 'Read-file-and-assert regression gate (JSON.parse for nx.json; regex .not.toMatch for CHANGELOG)'
    - 'Conjunction-of-regexes content-hygiene assertion (3 plan-id-scope leak shapes)'
key-files:
  created: []
  modified:
    - '.planning/REQUIREMENTS.md'
    - 'nx.json'
    - 'e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts'
decisions:
  - "REL-01/02/03 defined verbatim from RESEARCH 'Proposed REQUIREMENTS.md text'; coverage recomputed 31->34/34/0"
  - 'nx.json one-field flip release.git.tag true->false (D-01); commit/push/createRelease untouched'
  - 'REL-03 backstop uses three regexes (conventional-commit scope, bold heading token, bare leading scope) validated to catch leaks with zero false positives on real CHANGELOG content'
metrics:
  duration: '~4 min'
  tasks: 3
  files: 3
  completed: '2026-06-29'
---

# Phase 7 Plan 01: Release-PR mechanism (REL-01 config + REL-03 backstop) Summary

Delivered the load-bearing REL-01 config change (`nx.json release.git.tag: true -> false`, decoupling the release cut from tagging) plus its Wave-0 regression assertion, defined the new REL-01/02/03 requirement IDs, and added an automatable REL-03 changelog-hygiene backstop -- all three changes in-tree, autonomous, and verified green against the install-e2e suite.

## What Was Built

### Task 1: REL-01/02/03 in REQUIREMENTS.md (commit `29078c1`)

- Added a new `### Release Process (REL)` family after the CI family with three unchecked items REL-01 (Release-PR flow), REL-02 (branch-protection switch), REL-03 (clean changelog), using the exact descriptions + acceptance criteria from `07-RESEARCH.md` "Proposed REQUIREMENTS.md text".
- Added three Traceability rows mapping REL-01/02/03 -> Phase 7, status Pending.
- Recomputed the Coverage block 31 -> 34 total / 34 mapped / 0 unmapped, updated the count Note (30 + PKG-05 + 3 REL) and added the Phase 7 per-phase count line.

### Task 2: nx.json git.tag flip + regression assertion (commit `5dc0ac0`)

- Flipped exactly one field: `release.git.tag: true -> false`. `commit:true`, `push:false`, `releaseTag.pattern`, `conventionalCommits`, `preVersionCommand`, `projects`, and `changelog.workspaceChangelog.createRelease:false` all untouched. The resulting git block is `{ "commit": true, "tag": false, "push": false }`.
- Added an `it('keeps the cut decoupled from git tagging (REL-01 / D-01)', ...)` inside the existing `describe('PKG-03: ...')` block, adjacent to the push/createRelease test, cloning that test's structure: fresh `readFileSync(nxJsonPath)` + inline-typed `JSON.parse(...) as { release?: { git?: { tag?: boolean } } }` + `expect(nx.release?.git?.tag).toBe(false)`, with a leading comment explaining the D-01/D-03 rationale (cut must not tag; maintainer tags the merge commit post-PR).
- TDD: confirmed RED (the new assertion fails `expected true to be false` with `tag:true`) before flipping, then GREEN (all 16 pass after the flip).

### Task 3: REL-03 CHANGELOG-no-plan-id-scope backstop (commit `44da470`)

- Added `const changelogPath = join(workspaceRoot, 'CHANGELOG.md');` alongside the other path consts.
- Added a `describe('REL-03: the public changelog exposes no internal GSD plan-id scope', ...)` block with one `it(...)` that reads CHANGELOG.md fresh and asserts it matches none of the three leak shapes via three `expect(changelog).not.toMatch(...)`: conventional-commit scope `\((\d{2}(?:-\d{2})*)\)`, bold heading token `\*\*\d{2}(?:-\d{2})*[:*]`, bare leading scope `\b\d{2}(?:-\d{2})*:`. Leading comment cites REL-03 / D-13 / D-15 and notes it guards the CURATED content, not raw nx output.
- Validated the three regexes catch six representative leaks (`feat(05-01):`, `fix(06):`, `**06-02:**`, `**05:**`, `05-01:`, `06-02-03:`) with zero false positives on real CHANGELOG content (version headers with dates, version-range strings, release-link lines, bold feature lead-ins) -- proving the assertion is meaningful, not vacuously passing.
- Prettier-formatted the spec (singleQuote).

## Verification Evidence

- `node -e "const r=require('./nx.json').release.git; process.exit(r.tag===false&&r.commit===true&&r.push===false?0:1)"` exits 0.
- `nx.json changelog.workspaceChangelog.createRelease` is still `false` (never `"github"` -- the GIT_PUSH_FALSE_WITH_CREATE_RELEASE landmine).
- `rg -c 'REL-0[123]' .planning/REQUIREMENTS.md` returns 10 (3 definitions + 3 Traceability rows + intra-text references); Coverage reads 34/34/0.
- `rg -n '\b\d{2}(-\d{2})*:' CHANGELOG.md` returns nothing -- the REL-03 assertion is non-vacuous.
- `rg -n 'release\?\.git\?\.tag' e2e/.../release-hygiene.int.spec.ts` returns one hit (line 111).
- `npx nx run angular-typechecker-install-e2e:test` -> "Successfully ran target test"; 3 test files / 24 tests passed (release-hygiene 17/17 incl. the two new assertions; tarball-audit + install-smoke unchanged). The console line "Running target angular-typecheck for project consumer-app failed" is the install-smoke spec's EXPECTED injected-TS2322 non-zero exit (asserted behavior of TEST-05), not a test failure -- the target succeeded and 24/24 tests passed.

## Deviations from Plan

None - plan executed exactly as written. The only working-tree changes outside my task files were pre-existing uncommitted `.planning/STATE.md` and `.planning/config.json` (orchestrator phase-execution setup), which were left untouched and not staged.

## Scope Boundary Notes

- This plan delivered the MECHANISM only. No real release was cut, `nx release` was not run for real, and no tag was pushed -- per the plan's explicit constraint. The first real release using the new flow is a later operational event.
- The other Phase-7 deliverables (ci.yml path-aware skip per D-08, the gh-api branch-protection ruleset switch per D-09, the AGENTS.md release-mechanics rewrite per D-17, and the per-release curated CHANGELOG entry) are out of scope for this plan and handled by later Phase-7 plans / operational runbooks.

## Self-Check: PASSED

- FOUND: nx.json (release.git.tag === false verified via node)
- FOUND: .planning/REQUIREMENTS.md (REL-01/02/03 + Traceability rows + 34/34/0)
- FOUND: e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts (git.tag + CHANGELOG assertions)
- FOUND commit 29078c1 (Task 1)
- FOUND commit 5dc0ac0 (Task 2)
- FOUND commit 44da470 (Task 3)
