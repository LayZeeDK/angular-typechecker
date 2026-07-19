---
phase: 32-verification-docs-additive-audit
plan: 4
subsystem: docs
tags: [readme, changelog, docs-tripwire, sarif, json-reporter, upload-sarif, machine-readable]

# Dependency graph
requires:
  - phase: 30-reporter-seam-json-reporter-format-threading-observability
    provides: the JSON payload shape (formatVersion + flat diagnostics[] + summary) + the --format flag threaded through all three adapters
  - phase: 31-sarif-reporter
    provides: the SARIF 2.1.0 reporter (node-sarif-builder) + the 18-NG8xxx rules[] catalog + partialFingerprints + file-less no-location behavior
provides:
  - README ## Machine-readable output section (--format, JSON schema, SARIF upload-sarif recipe, run-from-repo-root artifactLocation.uri caveat) + ToC anchor
  - Curated undated public CHANGELOG 0.2.3 entry in end-user language (no internal ids), version held at 0.2.2
  - machine-readable-docs.spec.ts content tripwire drift-locking the documented claims + the removal of the three now-false reporter passages + CHANGELOG hygiene
affects: [v0.2.3-release-pr]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs content tripwire mirroring standalone-cli-docs.spec.ts: pure README + CHANGELOG read, whitespace-normalized, --format drift-locked against live parseCliArgs(['--help'])"
    - "Absence drift-lock: a tripwire asserts a reconciled stale claim (non-goal / 'lands in a later release') stays removed, so it cannot silently reappear"

key-files:
  created:
    - packages/angular-typechecker/src/machine-readable-docs.spec.ts
  modified:
    - packages/angular-typechecker/README.md
    - CHANGELOG.md
    - packages/angular-typechecker/src/cli/parse-args.ts
    - packages/angular-typechecker/src/executors/typecheck/schema.json
    - packages/angular-typechecker/src/builders/typecheck/schema.json

key-decisions:
  - "SARIF README recipe uses `npx angular-typechecker --format sarif`, NOT the plan's literal `atc` -- a bare `atc` is not on PATH in a GitHub Actions `run:` step (node_modules/.bin is not added there), so `npx angular-typechecker` is the reliable + canonical invocation (Rule 1)."
  - "CHANGELOG 0.2.3 hygiene slice ends at the specific `## 0.2.2` heading (not a generic `## `) to avoid mis-slicing on the `### ` subheadings -- mirrors the shipped standalone-cli-docs.spec.ts idiom."
  - "The now-false `sarif lands in a later release` claim shipped in THREE --format surfaces (CLI HELP_TEXT + the executor + builder schema.json format descriptions); all three reworded so json/sarif read as the available machine-readable payloads (coordinator-directed follow-up). Description-string-only -> additive-safe: no enum/default/required/additionalProperties changed, both {executors,builders}/typecheck/schema-parity.spec.ts stay green with no expectation edit, so it is not a contract change."
  - "Documented JSON schema was verified against the source of truth (json-report.spec.ts key drift-lock: exact top-level/summary/diagnostic key sets + the four outcome values), not paraphrased."

patterns-established:
  - "Docs-only plan cuts NO release: undated CHANGELOG entry, package.json version held, no tag/publish (the cut is the later human-gated Release-PR)."

requirements-completed: [DOC-01]

coverage:
  - id: D1
    description: "README ## Machine-readable output section (+ ToC anchor) documenting --format (human/json/sarif), the JSON payload schema, the SARIF upload-sarif recipe, and the run-from-repo-root artifactLocation.uri caveat; plus the three now-false reporter passages reconciled (no non-goal claim, no 'lands in a later release' clause)."
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/machine-readable-docs.spec.ts#README ## Machine-readable output section (docs tripwire)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Curated undated public CHANGELOG 0.2.3 entry in end-user language with no internal ids / plan scopes / board jargon; package.json version held at 0.2.2 (no release cut)."
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/machine-readable-docs.spec.ts#CHANGELOG ## 0.2.3 entry (hygiene tripwire)"
        status: pass
      - kind: other
        ref: "node -e require(package.json).version === '0.2.2'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The new README machine-output prose reads as end-user-facing for an Angular dev and the documented JSON/SARIF examples faithfully represent the shipped payloads."
    requirement: DOC-01
    verification: []
    human_judgment: true
    rationale: "The tripwire proves the structural claims (section, anchor, flag values, upload-sarif token, caveat, absence of stale claims) deterministically, but prose readability and example fidelity are a human-judgment eyeball of the rendered README."

# Metrics
duration: 8min
completed: 2026-07-19
status: complete
---

# Phase 32 Plan 4: DOC-01 machine-readable output docs Summary

**README `## Machine-readable output` section (--format json/sarif, the JSON payload schema, the SARIF upload-sarif Code Scanning recipe, the run-from-repo-root artifactLocation.uri caveat) + a curated undated public CHANGELOG 0.2.3 entry + a docs tripwire that drift-locks the claims and keeps the three now-false reporter passages removed -- docs-only, version held at 0.2.2.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-19T00:10:22Z
- **Completed:** 2026-07-19T00:18:57Z
- **Tasks:** 3 (+1 coordinator-directed fix)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Added a `## Machine-readable output` README section (+ ToC anchor) in end-user language: `--format <human|json|sarif>` on the CLI and the matching `format` option on the Nx executor / Angular CLI builder; the exact JSON payload schema (top-level `formatVersion`/`tool`/`version`/`tsConfigPath`/`summary`/`diagnostics[]`, the four `outcome` values, 1-based positions, `TS####`/`NG8xxx`/`ATC9000x` code strings, `file:null` for file-less); the SARIF `upload-sarif` GitHub Actions recipe with the 18-NG8xxx `rules[]` catalog + `partialFingerprints`; and the run-from-repo-root `artifactLocation.uri` caveat.
- Reconciled the three now-false pre-existing reporter passages (JSON shipped Phase 30, SARIF shipped Phase 31): dropped the `--format` Options-row `(SARIF lands in a later release)` clause, replaced the `## Output` "deliberate non-goal ... only output" paragraph with a pointer to the new section, and deleted the `## Limitations` "non-goals in v0.x" bullet. The README now carries NO reporter non-goal claim and NO "lands in a later release" clause.
- Added a curated UNDATED public CHANGELOG `## 0.2.3` entry (end-user prose, no internal ids / plan scopes / board jargon), with `package.json` version held at `0.2.2` (no bump, tag, or publish -- the cut is the later human-gated Release-PR).
- Added `machine-readable-docs.spec.ts` (mirrors `standalone-cli-docs.spec.ts`): a pure README + CHANGELOG read locking the section + ToC anchor, the three `--format` values, the `upload-sarif` recipe, the `artifactLocation.uri` repo-root caveat, the `--format` drift-lock against live `parseCliArgs(['--help'])`, the ABSENCE of the two reconciled stale claims, and CHANGELOG 0.2.3 hygiene.
- Corrected the stale `sarif lands in a later release` claim in all THREE shipped `--format` surfaces (coordinator-directed): the CLI `HELP_TEXT` (`parse-args.ts`) and both the Nx executor and Angular CLI builder `schema.json` `format` descriptions now read `json` and `sarif` as the available machine-readable payloads. Description-string-only (additive-safe); the tripwire was extended to drift-lock the phrase absent from the live help + both schema descriptions.

## Task Commits

Each task was committed atomically:

1. **Task 1: README ## Machine-readable output section + ToC anchor + reconcile 3 stale passages** - `055dbb3` (docs)
2. **Task 2: Curated undated CHANGELOG 0.2.3 entry** - `1575134` (docs)
3. **Task 3: Docs content tripwire spec** - `088d363` (test)
4. **Follow-up (coordinator-directed): correct stale "SARIF lands later" claim in CLI help + executor/builder schema descriptions** - `4ab821d` (docs)

**Plan metadata:** `174e2e2` (SUMMARY/STATE/ROADMAP/REQUIREMENTS) + a follow-up SUMMARY update closing the resolved deferred item.

## Files Created/Modified
- `packages/angular-typechecker/README.md` - New `## Machine-readable output` section + ToC anchor; the three now-false reporter passages reconciled.
- `CHANGELOG.md` - New undated end-user `## 0.2.3` entry above `## 0.2.2`.
- `packages/angular-typechecker/src/cli/parse-args.ts` - HELP_TEXT `--format` description reworded (SARIF available, no "lands in a later release").
- `packages/angular-typechecker/src/executors/typecheck/schema.json` - Nx executor `format` description reworded (description-only; enum/default/required/additionalProperties unchanged).
- `packages/angular-typechecker/src/builders/typecheck/schema.json` - Angular CLI builder `format` description reworded (description-only; enum/default/required/additionalProperties unchanged).
- `packages/angular-typechecker/src/machine-readable-docs.spec.ts` - Docs content tripwire (README section/anchor/claims + absence drift-lock + --format help/README lock + CHANGELOG 0.2.3 hygiene) + a shipped-surface block asserting the stale phrase is absent from the live HELP_TEXT and both schema descriptions.

## Decisions Made
- **SARIF recipe uses `npx angular-typechecker`, not `atc`.** The plan suggested `atc -c tsconfig.json --format sarif`, but a bare `atc` does not resolve in a GitHub Actions `run:` step (`node_modules/.bin` is not on PATH there, and the README itself flags `npx atc` as the `atc@0.0.6` supply-chain hazard). `npx angular-typechecker` is the reliable, canonical invocation, so the CI recipe uses it.
- **CHANGELOG hygiene slice ends at the literal `## 0.2.2`** (not a generic `## `), mirroring `standalone-cli-docs.spec.ts` -- a generic `## ` would mis-slice on the `### ` subheadings inside the entry.
- **JSON schema documented from the source of truth** (`json-report.spec.ts` key drift-lock + `evaluate-result.ts` `Outcome` enum + `diagnostic-record.ts` severity set), not paraphrased, so the README schema cannot silently diverge from the shipped payload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SARIF README recipe uses `npx angular-typechecker`, not the plan's literal `atc`**
- **Found during:** Task 1 (README section authoring)
- **Issue:** The plan's action text specified a GitHub Actions snippet piping `atc -c tsconfig.json --format sarif > results.sarif`. A bare `atc` command is not on PATH in a GitHub Actions `run:` step (npm does not add `node_modules/.bin` to PATH for a non-script `run:`), so the recipe would fail for a reader who copies it; and `npx atc` is the documented `atc@0.0.6` supply-chain hazard.
- **Fix:** The recipe uses `npx angular-typechecker -c tsconfig.json --format sarif > results.sarif` (preceded by `npm ci`), the reliable and canonical invocation the README already endorses. The tripwire does not assert the literal `atc`, so this satisfies every acceptance criterion.
- **Files modified:** `packages/angular-typechecker/README.md`
- **Verification:** `machine-readable-docs.spec.ts` green (`upload-sarif` + caveat present); `nx format:check` green.
- **Committed in:** `055dbb3` (Task 1 commit)

**2. [Rule 1 - Bug] Stale `sarif lands in a later release` in THREE shipped `--format` surfaces (coordinator-directed follow-up)**
- **Found during:** Task 1 (grep-confirming the "lands in a later release" string); initially logged as out-of-scope, then fixed on coordinator direction before completing.
- **Issue:** SARIF shipped in Phase 31, so the `sarif lands in a later release` claim is FALSE in all three user-facing `--format` surfaces and would ship in 0.2.3: the CLI `HELP_TEXT` (`parse-args.ts:87-88`), the Nx executor `schema.json` `format` description, and the Angular CLI builder `schema.json` `format` description.
- **Fix:** reworded all three so `json` and `sarif` read as the available machine-readable payloads; extended `machine-readable-docs.spec.ts` to drift-lock the phrase ABSENT from the live `HELP_TEXT` and both schema.json descriptions.
- **Additive-safe:** description-string-only -- no `enum` value, `default`, `required`, or `additionalProperties` changed, so both `{executors,builders}/typecheck/schema-parity.spec.ts` stay green with no expectation edit (they lock keys/enum/defaults, not description prose). A description-only edit is not a contract change. **Flag for the 32-03 additive audit:** it will see two `schema.json` description-line diffs + a `HELP_TEXT` prose diff, all non-breaking.
- **Files modified:** `parse-args.ts`, `executors/typecheck/schema.json`, `builders/typecheck/schema.json`, `machine-readable-docs.spec.ts`
- **Verification:** `nx test` (534), `nx typecheck`, `nx lint` (maxWarnings:0), `nx format:check` all green.
- **Committed in:** `4ab821d`

---

**Total deviations:** 2 auto-fixed (Rule 1 - README recipe correctness; Rule 1 - stale SARIF-unavailable claim in 3 shipped `--format` surfaces, coordinator-directed).
**Impact on plan:** No scope creep. Every acceptance criterion holds; the recipe change makes the CI snippet runnable, and the three-surface fix removes a falsehood that would otherwise ship in 0.2.3. Both fixes are additive-safe (docs/description strings only; the plugin `dependencies` and every schema contract are unchanged).

## Issues Encountered
- None. All four gates green (`nx test` 532, `nx typecheck`, `nx lint` maxWarnings:0, `nx format:check`).

## Known Stubs
None - the docs describe the already-shipped JSON (Phase 30) and SARIF (Phase 31) reporters; no placeholder content.

## Threat Flags
None - docs-only. No code, no dependency, no network/auth/file surface. The threat register (T-32-05 info disclosure, T-32-06 doc drift) is mitigated exactly as planned: the tripwire's hygiene regex blocks internal-id leaks in the CHANGELOG 0.2.3 entry, and the `--format` help/README drift-lock + section/anchor asserts guard doc drift.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DOC-01 is the last of Phase 32's four requirements (VER-02 done in 32-01, VER-03/ADD-01 in sibling plans); the README + CHANGELOG feed the eventual v0.2.3 Release-PR.
- The stale `sarif lands in a later release` claim is corrected in all three shipped `--format` surfaces (CLI help + executor + builder schema descriptions) and drift-locked by the tripwire; the deferred item is closed. No open follow-ups for DOC-01.

## Self-Check: PASSED

- Created file exists: `packages/angular-typechecker/src/machine-readable-docs.spec.ts`.
- Modified files carry the changes: README has `## Machine-readable output` + anchor and NO `non-goal` / `lands in a later release`; CHANGELOG has `## 0.2.3`; the stale `lands in a later release` phrase is absent from all three shipped `--format` surfaces (CLI HELP_TEXT + executor + builder schema.json).
- All commits present: `055dbb3`, `1575134`, `088d363`, `4ab821d`.
- Version held at `0.2.2`; four gates green (`nx test` 534, typecheck, lint maxWarnings:0, format:check). Schema diffs are description-line only (additive-safe).

---
*Phase: 32-verification-docs-additive-audit*
*Completed: 2026-07-19*
