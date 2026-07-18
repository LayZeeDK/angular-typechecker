---
phase: 25-extract-the-advisory-notice-seam
audited: 2026-07-16
auditor: Claude (gsd-security-auditor)
asvs_level: 1
block_on: high
threats_total: 4
threats_closed: 4
threats_open: 0
status: secured
register_authored_at_plan_time: true
---

# Phase 25: Extract the advisory-notice seam -- Security Audit

**Scope:** verify that every mitigation declared in the PLAN `<threat_model>` is
present in the implemented code. This is a verification pass against the authored
register (`register_authored_at_plan_time: true`), not a fresh vulnerability scan.

**Phase shape:** a pure internal refactor -- the five advisory `warn*` helpers +
`skippedReferenceVerdictNote` were moved verbatim out of `executor.ts` into a new
pure `core/emit-advisory-notices.ts` behind an injected structural `Logger`
(`core/logger.ts`); the executor now calls `emitAdvisoryNotices(result, logger)`
once. Additive-only vs `angular-typechecker@0.2.1`: no public-API/barrel change, no
new dependency, zero package installs. Files changed this phase (75a130e^..c06ea2c):
`core/logger.ts`, `core/emit-advisory-notices.ts`, `core/emit-advisory-notices.spec.ts`,
`executors/typecheck/executor.ts` -- 4 source files, nothing else.

## Threat Verification

| Threat ID | Category | Disposition | Verdict | Evidence |
|-----------|----------|-------------|---------|----------|
| T-25-01 | Tampering (regression) | mitigate | CLOSED | Verbatim move + byte-identical guard + exact-string anchor spec -- all three present (see below). |
| T-25-02 | Tampering (boundary erosion) | mitigate | CLOSED | `src/core/**` D-11 ESLint block (error-level) bans nx/@nx/*/@angular-devkit/*/yargs + no-console + process.exit; both new files import only type-only core-internal specifiers; Logger is homegrown. |
| T-25-03 | Information disclosure (content isolation) | accept | CLOSED | Accepted-risk entry recorded below; rationale independently verified against the moved helper bodies. |
| T-25-SC | Tampering (supply chain) | not-applicable | CLOSED | Zero package installs -- `package.json`/lockfile untouched this phase; only 4 source files changed. |

**Threats closed: 4/4. Open: 0.**

## Evidence detail

### T-25-01 -- Tampering (regression) [mitigate -> CLOSED]

Declared mitigation: literal cut-paste (no retype); existing `executor.spec.ts` +
`builder.spec.ts` + `builder.integration.spec.ts` stay green with NO assertion edits
(byte-identical guard); new `emit-advisory-notices.spec.ts` asserts EXACT full-string
message text + stream routing.

Verified (all three components present):

1. **Verbatim move -- independently confirmed byte-identical.** Extracted the
   pre-move helper region from `git show 75a130e^:.../executor.ts`, stripped only the
   permitted `, logger: Logger` signature addition, and diffed against
   `core/emit-advisory-notices.ts` (lines 43-209). Every message string,
   concatenation (`+`), interpolation (`${...}`), body line, and doc comment in the
   new module has an identical counterpart in the pre-move executor (`comm` "new only"
   set empty; "pre-move only" set is a single `}` range-selection artifact, not a
   content diff). The five helper signatures moved from
   `(result: CoreResult): void` (pre-move lines 98/127/189/225/252) to
   `(result: CoreResult, logger: Logger): void`; `skippedReferenceVerdictNote` kept its
   `(reason): string` signature (`emit-advisory-notices.ts:97-99`).
2. **Byte-identical guard specs unchanged.** `git diff --stat 75a130e^ c06ea2c` for
   `executor.spec.ts`, `builder.spec.ts`, `builder.integration.spec.ts` is empty -- no
   assertion edits. `executor.spec.ts` does NOT `vi.mock` the new seam, so the real
   `emitAdvisoryNotices` runs against the mocked `@nx/devkit` logger (guard intact).
3. **Exact-string anchor spec present.** `core/emit-advisory-notices.spec.ts` uses
   full-string `toHaveBeenCalledWith('<exact message>')` (NOT `stringContaining`) for
   all five advisories (lines 49, 68, 101, 105, 109, 131, 135, 157, 176), covers all
   three `skippedReferenceVerdictNote` branches (not-found / zero-root-names /
   default-tail), asserts the info-before-warn sub-order via `invocationCallOrder`
   (139-141), asserts `logger.error` is never called by any advisory, and includes a
   clean-CoreResult silent case (183-191). No `vi.mock` -- a plain injected `vi.fn()`
   object.

Emission order preserved: `emitAdvisoryNotices` calls
templateCheckAborted -> skippedReferences -> suppressed -> notTypeChecked ->
bundlerQueryImports (`emit-advisory-notices.ts:26-30`), mirroring the pre-move call
site. `warnSuppressed`'s two independent `if` blocks stay in order (info node_modules
count first, then warn coverage-incomplete). `warnSkippedReferences` keeps its
per-reference `for` loop (one `logger.warn` per reference).

### T-25-02 -- Tampering (boundary erosion) [mitigate -> CLOSED]

Declared mitigation: `src/core/**` ESLint D-11 block bans
nx/@nx/*/@angular-devkit/*/yargs (incl. type-only) + no-console + process.exit; nx
lint at maxWarnings:0; Logger is homegrown (no `@nx/devkit` type import).

Verified:

- **D-11 block present and error-level.** `eslint.config.mjs:16` scopes
  `files: ['**/src/core/**/*.ts']`; `@typescript-eslint/no-restricted-imports`
  (`error`) bans path names `nx`, `@nx/devkit`, `@angular-devkit/architect`, `yargs`
  and patterns `@nx/*`, `@angular-devkit/*` (lines 18-53); `no-console: 'error'`
  (54); `no-restricted-properties` bans `process.exit` (55-63). `allowTypeImports`
  is omitted, so type-only imports of banned specifiers are also caught. Because the
  bans are `error` severity, they are hard failures independent of any maxWarnings
  setting.
- **Both new core files clean under the boundary.** `logger.ts` has zero `import`
  statements (only doc-comment prose mentions `@nx/*`/`console`/`process`).
  `emit-advisory-notices.ts` imports only type-only core-internal specifiers:
  `Logger` from `./logger`, `CoreResult` from `./run-typecheck`, `SkippedReference`
  from `./walk-references` (lines 1-3); no code reference to console/process/nx/@nx/
  @angular-devkit (matches are doc-comment prose only).
- **Logger is homegrown.** `core/logger.ts` defines its own `interface Logger`
  (info/warn/error, each `(message: string): void`); it does not import
  `@nx/devkit`'s `logger` type. The executor passes `@nx/devkit`'s structurally
  assignable `logger` in with zero adapter (`executor.ts:53`).

VERIFICATION.md and REVIEW.md both report `nx lint` green at maxWarnings:0.

### T-25-SC -- Tampering (supply chain) [not-applicable -> CLOSED]

Declared rationale: zero package installs this phase (no new runtime or dev
dependency). Verified: `git diff --stat 75a130e^ c06ea2c` for
`packages/angular-typechecker/package.json`, root `package.json`, and
`package-lock.json` is empty; the phase changed exactly 4 source files. No
`[ASSUMED]`/`[SUS]`/`[SLOP]` package markers exist. No Package Legitimacy Audit is
warranted.

## Accepted Risks Log

### T-25-03 -- Information disclosure (content isolation) [accept]

**Risk:** advisory messages name files. If a notice were to interpolate a
dependency's own diagnostic text or a third-party path it would leak content across
the isolation boundary the tool promises.

**Decision:** ACCEPT -- unchanged vs `angular-typechecker@0.2.1`; no new exposure is
introduced by this move.

**Rationale (independently verified against the moved helper bodies in
`core/emit-advisory-notices.ts`):** every advisory interpolates ONLY values that
originate from the consumer's OWN resolved inputs or integer counts, never a
dependency's diagnostic text:

- `warnTemplateCheckAborted` -> `result.templateCheckAborted.fileName` (the
  consumer's own offending file), else the literal `'an unknown file'` (line 48-58).
- `warnSkippedReferences` -> `skipped.referencePath` + `skipped.reason` (the
  consumer's own tsconfig path + an enum reason) (line 78-83).
- `warnSuppressed` -> `suppressedThirdParty` / `suppressedInGraphErrorCount` /
  `suppressedInGraphWarningCount` (integer counts) and
  `suppressedInGraphFiles.join(', ')` (the consumer's own first-party file paths).
  The doc header explicitly states it names dropped files ONLY, never the
  dependency's error text (lines 130-155).
- `warnNotTypeChecked` -> a count + `notTypeCheckedDeclaredFiles.join(', ')` (the
  consumer's own declared files) (line 170-181).
- `warnBundlerQueryImports` -> a count + `bundlerQueryImports.join(', ')` (the
  consumer's own module specifiers) (line 197-208).

These are the verbatim-preserved 0.2.1 helper bodies (see T-25-01 byte-identity),
so the content-isolation property is unchanged by the extraction.

**Residual risk:** none introduced this phase. Re-open if a future edit interpolates
diagnostic message text (not just paths/counts) into any advisory.

## Unregistered Flags

None. `25-01-SUMMARY.md` contains no `## Threat Flags` section, and no new attack
surface, input, trust boundary, or dependency appeared during implementation (the
phase is a pure internal refactor; 4 source files changed, package manifest and
lockfile untouched).

---

_Audited: 2026-07-16_
_Auditor: Claude (gsd-security-auditor)_
_ASVS Level 1; block_on: high; threats_open: 0_
