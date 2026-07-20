---
phase: 32-verification-docs-additive-audit
plan: 1
subsystem: testing
tags: [sarif, ajv, ajv-formats, vitest, integration, json-reporter, byte-stability]

# Dependency graph
requires:
  - phase: 30-reporter-seam-json-reporter-format-threading-observability
    provides: formatJsonReport + the widened renderReport seam + relativizePath projection
  - phase: 31-sarif-reporter
    provides: formatSarifReport (node-sarif-builder) + the file-less no-location + partialFingerprints shape
provides:
  - Dev-only SARIF 2.1.0 schema validator (validateSarif) + shared redaction helper (redactVolatile) in @workspace/test-util
  - VER-02 integration tier: run() + the Nx executor over real cold-compiler fixtures emitting --format json + --format sarif
  - Committed redacted snapshots locking cross-OS/Node byte-stability incl. the Windows path -> forward-slash artifactLocation.uri
affects: [32-02-tarball-e2e-VER-03, 32-03-additive-audit-ADD-01]

# Tech tracking
tech-stack:
  added: [ajv@^8 (root devDep), ajv-formats@^3 (root devDep)]
  patterns:
    - "Real schema validation over the shipped reporter output (committed draft-07 schema + ajv, never fetch-at-test, never shape-only)"
    - "Redact-before-compare + committed redacted snapshot as the cross-OS/Node byte-stability contract"
    - "cwd-pin (process.chdir(workspaceRoot)) makes run()'s cwd-derived pathBase produce OS-invariant repo-relative forward-slash paths"

key-files:
  created:
    - libs/test-util/src/lib/validate-sarif.ts
    - libs/test-util/src/lib/sarif-2.1.0.schema.json
    - libs/test-util/src/lib/redact-volatile.ts
    - packages/angular-typechecker/src/core/machine-reporters-json.integration.spec.ts
    - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts
    - packages/angular-typechecker/src/core/__snapshots__/machine-reporters-json.integration.spec.ts.snap
    - packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap
  modified:
    - package.json
    - package-lock.json
    - libs/test-util/src/index.ts

key-decisions:
  - "Committed the SchemaStore SARIF 2.1.0 copy (draft-07, verified) -> plain ajv@^8 + ajv-formats@^3 with strict:false; the draft-04/ajv-draft-04 fallback was NOT needed."
  - "ajv/ajv-formats live in the workspace-ROOT package.json devDependencies ONLY; the plugin manifest is byte-unchanged (additive-only charter, ADD-01)."
  - "validate-sarif.ts resolves its schema via __dirname (not import.meta.url) because the test-util lib builds under module:commonjs where import.meta is forbidden -- matches the existing verdaccio-global-setup.ts convention."
  - "The Nx executor is invoked DIRECTLY (not via convertNxExecutor), so it resolves NO project graph and needs no NX_DAEMON/NX_ISOLATE_PLUGINS override."

patterns-established:
  - "Machine-reporter integration proof: drive both run() (CLI adapter) and the executor over the SAME committed real-compiler fixtures, assert their redacted payloads are equal (single renderReport seam)."
  - "SARIF file-less path = a results[] entry with NO locations, never dropped (global-diagnostics fixture)."

requirements-completed: [VER-02]

coverage:
  - id: D1
    description: "Dev-only SARIF 2.1.0 schema validator (validateSarif) + shared redactVolatile, exported from @workspace/test-util for reuse by the 32-02 e2e tier."
    requirement: VER-02
    verification:
      - kind: integration
        ref: "packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts#schema-validates against the committed SARIF 2.1.0 schema"
        status: pass
    human_judgment: false
  - id: D2
    description: "JSON reporter proven over real cold-compiler fixtures through run() + the executor: stdout-purity, formatVersion + flat diagnostics[] + summary, file:null path, repo-relative forward-slash paths, two-run + snapshot byte-stability."
    requirement: VER-02
    verification:
      - kind: integration
        ref: "packages/angular-typechecker/src/core/machine-reporters-json.integration.spec.ts (10 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SARIF reporter proven over real cold-compiler fixtures: true 2.1.0 schema validation over both fixtures, repo-relative forward-slash artifactLocation.uri, file-less no-location result, two-run + snapshot byte-stability, executor==run() parity."
    requirement: VER-02
    verification:
      - kind: integration
        ref: "packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Additive-only held: ajv/ajv-formats are root devDependencies only; the plugin package.json dependencies are byte-unchanged vs 0.2.2 (still only node-sarif-builder added); version stays 0.2.2."
    requirement: VER-02
    verification:
      - kind: other
        ref: "git diff angular-typechecker@0.2.2..HEAD -- packages/angular-typechecker/package.json (only + node-sarif-builder); git show HEAD:packages/angular-typechecker/package.json | rg -c ajv == 0"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-07-19
status: complete
---

# Phase 32 Plan 1: VER-02 machine-reporter integration tier Summary

**JSON + SARIF reporters proven over real cold-compiler fixtures through run() and the Nx executor, with a dev-only ajv SARIF 2.1.0 schema validator, a shared redaction helper, and committed redacted snapshots locking cross-OS byte-stability -- all dev-only, plugin manifest byte-unchanged.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-19
- **Tasks:** 3 (+ 1 deviation fix)
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments
- Added `validateSarif` (real ajv@^8 + ajv-formats@^3 validation over the COMMITTED draft-07 SARIF 2.1.0 schema, `strict:false`) and `redactVolatile` (tool version -> `[version]`) to `@workspace/test-util`, so the 32-02 e2e tier reuses ONE validator.
- Installed `ajv`/`ajv-formats` as workspace-ROOT devDependencies ONLY -- the plugin manifest `dependencies` are byte-unchanged vs `0.2.2` (additive-only charter held; no version bump).
- JSON integration spec (10 tests): run() + executor over `layout-b-host` (mixed TS2322 + NG8002) and `global-diagnostics` (file-less TS2318); proves stdout-purity, `file:null`, repo-relative forward-slash paths, two-run + snapshot byte-stability, and executor==run() parity.
- SARIF integration spec (9 tests): TRUE 2.1.0 schema validation over BOTH real payloads, the forward-slash `artifactLocation.uri` (Windows proof), the file-less no-location result, and byte-stability. The validator genuinely rejects a corrupted SARIF (verified: missing required field -> valid=false).

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared dev-only SARIF validator + redaction helper + ajv root devDeps** - `0b092f7` (test)
2. **Task 2: JSON reporter integration spec (run() + executor)** - `0342534` (test)
3. **Task 3: SARIF reporter integration spec (schema validation + Windows URI)** - `9fad8e3` (test)
4. **Deviation fix: keep core/ specs nx-free (D-11 lint boundary)** - `9268499` (fix)

## Files Created/Modified
- `libs/test-util/src/lib/validate-sarif.ts` - Dev-only `validateSarif(sarifJson)` compiling the committed schema ONCE with ajv + ajv-formats; the uncaught JSON.parse is the reused stdout-purity signal.
- `libs/test-util/src/lib/sarif-2.1.0.schema.json` - Committed SchemaStore SARIF 2.1.0 schema (draft-07, 111720 bytes), network-free at test time; lives under libs/test-util (never published), NOT under plugin src/ (Pitfall 4).
- `libs/test-util/src/lib/redact-volatile.ts` - Shared `redactVolatile(payload)` mapping the volatile tool version (JSON top-level / SARIF `runs[].tool.driver.version`) to `[version]`; SARIF spec `version: "2.1.0"` is intentionally preserved.
- `libs/test-util/src/index.ts` - Re-exports `validateSarif` + `redactVolatile`.
- `packages/angular-typechecker/src/core/machine-reporters-json.integration.spec.ts` (+ committed `.snap`) - JSON reporter VER-02 proof.
- `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` (+ committed `.snap`) - SARIF reporter VER-02 proof.
- `package.json` / `package-lock.json` - `ajv@^8.20.0` + `ajv-formats@^3.0.1` root devDependencies.

## Decisions Made
- Primary schema path taken (NOT the fallback): the SchemaStore `sarif-2.1.0.json` is draft-07 with an `$id`, so plain `ajv@^8` + `ajv-formats@^3` (`strict:false`) validates it -- `ajv-draft-04` was not installed.
- Executor invoked directly (no `convertNxExecutor`) -> no project-graph resolution -> no `NX_DAEMON`/`NX_ISOLATE_PLUGINS` override needed (unlike `builder.integration.spec.ts`), because `normalizeOptions` reads only `context.root`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the core/ integration specs nx-free (D-11 lint boundary)**
- **Found during:** Overall verification (`nx lint angular-typechecker`, maxWarnings:0)
- **Issue:** The specs are pinned to `src/core/` by the plan, but the `core/**` ESLint block bans all `@nx/*` imports (D-11). My initial `import type { ExecutorContext } from '@nx/devkit'` failed lint with 4 errors.
- **Fix:** Removed the `@nx/devkit` import and derived the context type from the executor's own signature (`Parameters<typeof typecheckExecutor>[1]`); runtime behavior unchanged, snapshots unaffected (all 19 tests still pass).
- **Files modified:** both `machine-reporters-*.integration.spec.ts`
- **Verification:** `nx lint angular-typechecker` + `nx typecheck angular-typechecker` green; both integration specs re-run green.
- **Committed in:** `9268499`

**2. [Rule 3 - Blocking] validate-sarif.ts uses `__dirname`, not the RESEARCH `import.meta.url`**
- **Found during:** Task 1
- **Issue:** The RESEARCH recipe used `import.meta.url`, but `validate-sarif.ts` is a test-util LIB file compiled under `module:commonjs` (tsconfig.lib.json), where `import.meta` is a TS error -- and it would break `nx build test-util`.
- **Fix:** Used `__dirname` (the established `verdaccio-global-setup.ts` lib convention). Works under both the commonjs lib build and the vitest forks runtime.
- **Files modified:** `libs/test-util/src/lib/validate-sarif.ts`
- **Verification:** `nx build test-util` + `nx typecheck test-util` + `nx lint test-util` all green.
- **Committed in:** `0b092f7` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 lint-boundary bug, 1 blocking module-format correction)
**Impact on plan:** Both necessary for correctness within the existing repo boundaries. No scope creep -- the observable proofs (schema-valid SARIF, byte-stable redacted payloads, forward-slash URIs, executor==run() parity) are all as the plan specified.

## Issues Encountered
- None beyond the two deviations above. The additive-only invariant was re-proven inline (ADD-01's full audit is 32-03): the plugin `dependencies` diff vs `angular-typechecker@0.2.2` is only `+ node-sarif-builder`, `rg -c ajv` on the shipped manifest is 0, and the version stays `0.2.2`.

## Known Stubs
None - every deliverable is wired to real cold-compiler output and asserted.

## Threat Flags
None - no new network/auth/file-access surface. `ajv`/`ajv-formats` are dev-only (root devDeps, verified OK in the RESEARCH legitimacy audit); the committed schema is validated network-free at test time.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `validateSarif` + `redactVolatile` are exported from `@workspace/test-util` and ready for the 32-02 VER-03 shipped-tarball e2e (which reuses the SAME validator across the CLI / `ng run` / Nx executor adapters).
- Full plugin suite green: `nx integration` (24 files / 139 tests), `nx test` (50 files / 523 tests), `nx typecheck`, `nx lint` (maxWarnings:0), `nx lint test-util`, `nx typecheck test-util`, `nx format:check`.

## Self-Check: PASSED

- All 7 created files exist on disk (validator, schema, redaction helper, 2 specs, 2 snapshots).
- All 4 commits present: `0b092f7`, `0342534`, `9fad8e3`, `9268499`.
- Additive-only re-proven: plugin `dependencies` diff vs `0.2.2` is only `+ node-sarif-builder`; `ajv` count in shipped manifest = 0; version = `0.2.2`.

---
*Phase: 32-verification-docs-additive-audit*
*Completed: 2026-07-19*
