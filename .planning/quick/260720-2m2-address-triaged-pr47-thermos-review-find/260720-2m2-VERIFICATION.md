---
status: passed
---

# Verification: quick-260720-2m2 -- address 7 pre-triaged PR #47 thermos review findings

## Scope

Verified each `must_haves.truths` entry from `260720-2m2-PLAN.md` directly against the current
codebase state (git grep / Read of the actual files), not against the executor's SUMMARY.md.
Three commits landed exactly matching the plan's structure:

- `a9cf2f7` test(test-util): prove stdout purity structurally, lazy-load SARIF validator
- `fd20243` docs: scope byte-pure stdout, neutralize version example, document --fail-fast
- `32189d0` refactor(core): single-source the CLI format type, correct SARIF ruleIndex comments

`git diff --stat 2a9e161..32189d0` touches exactly the 9 files listed in the plan's
`files_modified` -- no scope creep.

## Per-truth verification

**F1** (stdout-purity structural check) -- PASS.
`git grep -n ADVISORY_NOTICE_PREFIX -- libs packages e2e` returns zero matches (confirmed via
direct grep, exit code 1). `libs/test-util/src/lib/cli-e2e.ts` `assertMachineFormatParity`
(lines 264-324) parses `.stdout` alone via `JSON.parse(clean.stdout)` / `validateSarif(clean.stdout)`
(and the planted-error variant) with no needle assertion remaining -- structural purity is the
sole signal, exactly as the truth requires. Both e2e specs
(`install-smoke.e2e.spec.ts`, `ng-add-ng-run.e2e.spec.ts`) confirmed to have no
`ADVISORY_NOTICE_PREFIX` import and rely on `extractJsonPayload` + `JSON.parse`/`validateSarif`
on the extracted slice instead. `libs/test-util/src/index.ts` no longer re-exports it.

**F2** (README/CHANGELOG scope byte-pure stdout) -- PASS.
`packages/angular-typechecker/README.md:617-628` scopes the byte-pure-stdout claim to "the
standalone CLI (`npx angular-typechecker`) and `ng run <project>:typecheck`" and explicitly
calls out "The Nx executor (`nx typecheck`) is the exception: Nx's task runner wraps the
executor's stdout with its own framing." `CHANGELOG.md:20-25`'s 0.2.3 Features bullet was
softened: it now says the standalone CLI / `ng run` write the payload alone on stdout, "from the
Nx executor (`nx typecheck`) that same payload shares standard output with Nx's own task-runner
output, so strip that framing ... for a clean capture" -- no longer a blanket promise.

**F3** (stale version placeholder) -- PASS.
`packages/angular-typechecker/README.md:635,641` shows `"version": "x.y.z"` (not a real released
version) with surrounding prose: "The `version` field carries the installed tool version (shown
as the `x.y.z` placeholder below)".

**F4** (SARIF ruleIndex comment correction) -- PASS.
`packages/angular-typechecker/src/core/sarif-report.ts` module header (lines 28-30) and the
result-loop comment (lines 76-79) both now state results reference their rule by `ruleId` only
and no `ruleIndex` is emitted (valid SARIF); the "18 NG rules added once" facts are preserved.
No remaining claim that node-sarif-builder computes/owns `ruleIndex`.

**F5** (--fail-fast machine-format caveat) -- PASS.
`packages/angular-typechecker/README.md:545-547`: "`--fail-fast` affects the human report only:
it stops printing after the first error so the output stays short. The `json` and `sarif`
formats always carry every diagnostic, so a machine consumer never loses one to `--fail-fast`."
The `--fail-fast` flag token remains present in the options table (line 528).

**L2** (single-sourced ReportFormat type) -- PASS.
`packages/angular-typechecker/src/cli/parse-args.ts:3` has `import type { ReportFormat } from
'../core/render-report';` (type-only). Line 249 declares the single runtime source:
`const REPORT_FORMATS: readonly ReportFormat[] = ['human', 'json', 'sarif'];`, consumed by
`validateFormat` (line 258). `git grep` for an inline `'human'.*'json'.*'sarif'` union pattern in
the file returns nothing beyond that one `REPORT_FORMATS` declaration -- no remaining inline
type unions. `nx run-many -t typecheck` (12 projects) confirms the CLI graph stays clean/nx-free.

**L4** (lazy SARIF validator) -- PASS.
`libs/test-util/src/lib/validate-sarif.ts`: `readFileSync` + `new Ajv` + `addFormats` +
`ajv.compile` all happen inside `getValidator()` (lines 30-42), guarded by a module-level
`let compiled: ValidateFunction | undefined` memoization check, not at module load. The public
`validateSarif(sarifJson: string): { valid: boolean; errors: string }` signature (lines 53-65)
is unchanged.

## Triaged-out items confirmed untouched

- `packages/angular-typechecker/src/core/run-typecheck.ts`: last touched at `fa9e7e3` (well
  before this quick task's 3 commits); not in the 9-file diff stat. Length/structure untouched.
- Windows cross-drive SARIF absolute-path residual: no related file changed; documented/accepted
  per the plan's scope guard, left alone.

## Gate results (re-run fresh, `--skip-nx-cache`)

- `npx nx test test-util` -- PASS (4 files, 15 tests passed, 1 skipped as expected)
- `npx nx test angular-typechecker` -- PASS (52 files, 552 tests passed, incl.
  `parse-args.spec.ts`, `bin-static.spec.ts`, `machine-readable-docs.spec.ts`,
  `standalone-cli-docs.spec.ts`)
- `npx nx run-many -t typecheck` -- PASS (12 projects, clean)
- `npx nx lint angular-typechecker` -- PASS ("All files pass linting", maxWarnings:0)
- Forbidden tripwire phrases (`non-goal`, `lands in a later release`) -- absent from README
  (verified via `git grep`, no matches)
- CHANGELOG board-jargon patterns (DOC-0N, CLI-0N, phase-N, Layout A-C, input-set, SB-N, G-gate,
  REP/FMT/VER/ADD/OBS/CLIX-N) -- absent from `CHANGELOG.md` (verified via `git grep`, no matches)
- ASCII-only across all 9 changed files -- verified programmatically, no non-ASCII characters

## Verdict

All 7 findings (F1, F2, F3, F4, F5, L2, L4) are correctly and completely addressed per the
locked plan's `must_haves.truths`. All primary gates pass. Scope guards respected -- no
scope creep beyond the 9 planned files, and both triaged-out items remain untouched.

No gaps found.
