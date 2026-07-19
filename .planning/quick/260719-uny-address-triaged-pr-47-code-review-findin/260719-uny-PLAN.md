---
phase: quick-260719-uny
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/angular-typechecker/src/core/walk-references.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/diagnostic-record.ts
  - packages/angular-typechecker/src/core/json-report.ts
  - packages/angular-typechecker/src/core/sarif-report.ts
  - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
autonomous: true
requirements: [STD-1, STD-2, STD-3, STD-4]

must_haves:
  truths:
    - "The authored-source predicate (!isDeclarationFile && !fileName.endsWith('.ngtypecheck.ts')) exists in exactly ONE place and is invoked at both former copy-paste sites (STD-1)."
    - "totalFilesCount is emitted as a plain property with no dead undefined-guard at both finalizeUnion and the direct path (STD-2)."
    - "NormalizedOptions.format is typed as ReportFormat, not a restated string union (STD-3)."
    - "The tool version is read from package.json in ONE place (toolVersion) and reused by both the JSON and SARIF reporters (STD-4)."
    - "Zero behavior/output change: nx test + all reporter snapshots stay green; JSON/SARIF payloads are byte-identical."
    - "Public barrel src/index.ts is untouched (ADD-01 additive-only; index.drift.ts stays green)."
  artifacts:
    - "packages/angular-typechecker/src/core/walk-references.ts (new exported isAuthoredSourceFile helper)"
    - "packages/angular-typechecker/src/core/diagnostic-record.ts (new exported toolVersion const)"
    - "packages/angular-typechecker/src/core/run-typecheck.ts, json-report.ts, sarif-report.ts, executors/typecheck/normalize-options.ts (updated to reuse the extracted single sources)"
  key_links:
    - "run-typecheck.ts extends its existing value import from './walk-references' to include isAuthoredSourceFile (no import cycle: walk-references is the lower module)."
    - "json-report.ts and sarif-report.ts extend their existing './diagnostic-record' import to include toolVersion."
    - "normalize-options.ts imports type ReportFormat from '../../core/render-report' (type-only; adds no runtime dep to the executor graph)."
    - "src/index.ts is NOT modified; none of the new symbols (isAuthoredSourceFile, toolVersion) reach the public barrel."
---

<objective>
Address four triaged PR #47 code-review findings (STD-1..STD-4): internal
de-duplication and type-drift refactors in the v0.2.3 machine-readable-reporter
code. All four are behavior-preserving and output-preserving.

Purpose: remove copy-pasted predicates/version-reads and one restated type so the
reporter code has a single source of truth per concern, without changing the JSON /
SARIF / human output or the verdict.
Output: 6 source files updated; two new non-barrel exports (`isAuthoredSourceFile`,
`toolVersion`); no public-API, dependency, or version change.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@CLAUDE.md

@packages/angular-typechecker/src/core/walk-references.ts
@packages/angular-typechecker/src/core/run-typecheck.ts
@packages/angular-typechecker/src/core/diagnostic-record.ts
@packages/angular-typechecker/src/core/json-report.ts
@packages/angular-typechecker/src/core/sarif-report.ts
@packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
@packages/angular-typechecker/src/core/render-report.ts

# Scope guard for this whole plan (all three tasks):
# - Do NOT add ANY symbol to the public barrel src/index.ts. The additive-only
#   charter (ADD-01) + the index.drift.ts tripwire must stay green.
# - Zero behavior/output change is the acceptance bar. Reporter snapshots and
#   drift-lock specs must stay green with NO assertion edits. If any spec goes
#   red, the refactor is wrong -- fix the refactor, do not weaken the spec.
</context>

<tasks>

<task type="auto">
  <name>Task 1: STD-1 + STD-2 -- extract isAuthoredSourceFile; drop the dead totalFilesCount guard (core engine)</name>
  <files>packages/angular-typechecker/src/core/walk-references.ts, packages/angular-typechecker/src/core/run-typecheck.ts</files>
  <action>
STD-1 (de-duplicate the authored-source predicate):
- In walk-references.ts add ONE exported pure helper `export function isAuthoredSourceFile(sourceFile: ts.SourceFile): boolean` that returns `!sourceFile.isDeclarationFile && !sourceFile.fileName.endsWith('.ngtypecheck.ts')`. `import type ts from 'typescript'` already exists at walk-references.ts:3, so `ts.SourceFile` is available. Move the ~6-line WR-01 justification comment (currently duplicated at run-typecheck.ts:524-528 and walk-references.ts:181-185) onto this helper's doc comment, phrased as the single source of the rule.
- At the walk-references.ts leaf loop (currently ~186-195) replace the inline `if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith('.ngtypecheck.ts')) { continue; }` with `if (!isAuthoredSourceFile(sourceFile)) { continue; }` and drop the now-relocated WR-01 comment block there.
- In run-typecheck.ts extend the EXISTING value import `import { gatherLeafInto, walkReferences } from './walk-references';` (line 18) to also import `isAuthoredSourceFile`. No import cycle: run-typecheck already depends on walk-references (the lower module); walk-references imports nothing from run-typecheck.
- At the run-typecheck.ts direct-path count (currently ~529-536) replace `.filter((sourceFile) => !sourceFile.isDeclarationFile && !sourceFile.fileName.endsWith('.ngtypecheck.ts'))` with `.filter(isAuthoredSourceFile)`, and remove the duplicated WR-01 comment block (~524-528).

STD-2 (remove the dead undefined-guard on a value the types prove is always a number):
- run-typecheck.ts finalizeUnion (param `totalFilesCount: number` at :303): replace the spread `...(totalFilesCount !== undefined ? { totalFilesCount } : {})` (~:331) with a plain `totalFilesCount,` property. Trim the surrounding comment (~:327-330) so it no longer claims a value-presence guard exists (the value is always the walked Set size).
- run-typecheck.ts direct path (`const totalFilesCount = ...().length` at ~:529): replace `...(totalFilesCount !== undefined ? { totalFilesCount } : {})` (~:544) with a plain `totalFilesCount,`. Trim the surrounding comment (~:517-522) so it no longer claims a value-presence spread; keep the WR-01 removal from STD-1 consistent here.

Both changes are output-identical (totalFilesCount is always a number at both sites, so the emitted key was already always present). CoreResult.totalFilesCount stays optional; assigning a definite number satisfies it.
Do NOT touch gather-diagnostics.ts (its bare `!isDeclarationFile` is a different, diagnostic-iteration predicate). Do NOT add isAuthoredSourceFile to src/index.ts.
  </action>
  <verify>
    <automated>npx nx typecheck angular-typechecker && npx nx test angular-typechecker</automated>
  </verify>
  <done>isAuthoredSourceFile is defined+exported once in walk-references.ts and used at both former sites; both totalFilesCount spreads are plain properties; typecheck (all three tsconfigs) and the angular-typechecker test suite pass with no assertion edits and no snapshot changes. Commit atomically: refactor(core): extract isAuthoredSourceFile helper and drop dead totalFilesCount guard</done>
</task>

<task type="auto">
  <name>Task 2: STD-4 -- single tool-version read shared by both machine reporters (core reporters)</name>
  <files>packages/angular-typechecker/src/core/diagnostic-record.ts, packages/angular-typechecker/src/core/json-report.ts, packages/angular-typechecker/src/core/sarif-report.ts</files>
  <action>
- In diagnostic-record.ts add ONE exported constant `export const toolVersion: string = (require('../../package.json') as { version: string }).version;` with a short comment noting it is the single source of the shipped tool version, read from the package root (compiled src/core/diagnostic-record.js -> ../../package.json, same depth as the two current reporter reads; require is lint-clean in this repo per the no-require-imports rule being off). This adds only a local package.json require -- it does NOT import node-sarif-builder, so the SARIF lazy-import firewall (render-report.ts's await import('./sarif-report.js')) is unaffected, and the `.json` specifier is not followed by the require-graph static walk.
- In json-report.ts: add `toolVersion` to the existing `import { ... } from './diagnostic-record';` (currently relativizePath, toDiagnosticRecord, type DiagnosticRecord). Delete the local `const packageManifest = require('../../package.json') as { version: string };` (line ~35) and its comment. At the payload build (line ~124) change `version: packageManifest.version` to `version: toolVersion`.
- In sarif-report.ts: add `toolVersion` to the existing `import { toDiagnosticRecord, type DiagnosticRecord } from './diagnostic-record';` (line ~3). Delete the local `const packageManifest = ...` (line ~45) and its comment. At the run builder (line ~71) change `toolDriverVersion: packageManifest.version` to `toolDriverVersion: toolVersion`.
- The emitted `version` / `toolDriverVersion` value is byte-identical (same manifest), so the JSON top-level and SARIF version drift-locks stay green.
Do NOT touch parse-args.ts:20 -- it is the CLI-boundary version read and is explicitly out of scope for STD-4. Do NOT add toolVersion to src/index.ts.
  </action>
  <verify>
    <automated>npx nx typecheck angular-typechecker && npx nx test angular-typechecker</automated>
  </verify>
  <done>toolVersion is defined+exported once in diagnostic-record.ts; both reporters import and use it; the two local packageManifest declarations are gone; typecheck + tests pass with unchanged JSON/SARIF snapshots and drift-locks. Commit atomically: refactor(core): read tool version from one shared source in the reporters</done>
</task>

<task type="auto">
  <name>Task 3: STD-3 -- type NormalizedOptions.format via ReportFormat (executor)</name>
  <files>packages/angular-typechecker/src/executors/typecheck/normalize-options.ts</files>
  <action>
- Add `import type { ReportFormat } from '../../core/render-report';` (type-only, so no runtime dependency is added to the executor graph -- render-report's compiler-cli/json-report imports are not pulled in). Place it to satisfy the repo's import-order lint (it already imports type CoreOptions from '../../core/run-typecheck'; group/order the two '../../core/*' type imports so lint stays green).
- Change the NormalizedOptions field (line ~26) from `format: 'human' | 'json' | 'sarif';` to `format: ReportFormat;`. The union is identical, so this is a pure de-drift; the `options.format ?? 'human'` default at line ~73 is unchanged.
Leave schema.d.ts and parse-args.ts alone (schema.d.ts is a self-contained contract; parse-args.ts's restatement is justified by the D-15 nx-free boundary).
  </action>
  <verify>
    <automated>npx nx typecheck angular-typechecker && npx nx test angular-typechecker</automated>
  </verify>
  <done>NormalizedOptions.format is `ReportFormat`; ReportFormat is imported type-only from ../../core/render-report; typecheck + tests pass. Commit atomically: refactor(executor): reference ReportFormat instead of restating the format union</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No new trust boundary is introduced. All three changes are internal refactors of
already-shipped v0.2.3 code with identical inputs, outputs, and control flow.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-uny-01 | Tampering | shared reporter output (JSON/SARIF) | low | accept | Behavior-preserving refactor; existing snapshot + drift-lock specs are the tripwire (must stay green with no assertion edits). |
| T-uny-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package installs in this plan; dependency set is byte-unchanged. |
</threat_model>

<verification>
Run the FULL CI-parity check battery ONCE after all three commits land (this repo
runs on the current branch with real node_modules -- NO worktree isolation):

- `npx nx run-many -t typecheck` (tsc --noEmit across lib + spec + drift tsconfigs -- catches spec type errors that `nx test` misses)
- `npx nx run-many -t test`
- `npx nx run-many -t lint` (maxWarnings:0)
- `npx nx format:check`
- `npx fallow audit --format human --base origin/main`

All five must be green. No reporter snapshot or drift-lock may change. src/index.ts
and index.drift.ts must be byte-unchanged (ADD-01 additive-only holds).
</verification>

<success_criteria>
- STD-1: one `isAuthoredSourceFile` helper, used at both former duplicate sites; WR-01 comment lives once (on the helper).
- STD-2: no `totalFilesCount !== undefined` spreads remain; both sites emit a plain property; output identical.
- STD-3: `NormalizedOptions.format` is `ReportFormat`.
- STD-4: one `toolVersion` const, used by both reporters; no `packageManifest` locals remain in json-report.ts / sarif-report.ts (parse-args.ts unchanged).
- Full battery green; JSON/SARIF/human output byte-identical; barrel unchanged.
- Three atomic commits: two `refactor(core)`, one `refactor(executor)` -- NO plan-id/quick-id scope, type `refactor` (no version bump, hidden from changelog).
</success_criteria>

<output>
Create `.planning/quick/260719-uny-address-triaged-pr-47-code-review-findin/260719-uny-SUMMARY.md` when done
</output>
