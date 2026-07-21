---
phase: 32-verification-docs-additive-audit
plan: 2
subsystem: testing
tags: [sarif, ajv, vitest, e2e, tarball, verdaccio, json-reporter, exit-codes, stdout-purity]

# Dependency graph
requires:
  - phase: 32-verification-docs-additive-audit (32-01)
    provides: the dev-only validateSarif SARIF 2.1.0 validator + redactVolatile in @workspace/test-util
  - phase: 30-reporter-seam-json-reporter-format-threading-observability
    provides: the --format flag + renderReport seam + the json/sarif payloads across all three adapters
  - phase: 31-sarif-reporter
    provides: formatSarifReport (node-sarif-builder)
provides:
  - runShimSplit (separate stdout/stderr) + assertMachineFormatParity in @workspace/test-util
  - extractJsonPayload (isolate a framed executor payload) + the exported ADVISORY_NOTICE_PREFIX purity needle
  - VER-03 shipped-tarball --format proof across all three adapters (standalone CLI, ng run, Nx executor)
affects: [32-03-additive-audit-ADD-01, v0.2.3-Release-PR]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runShimSplit: parse ONLY .stdout for the guaranteed-pure standalone-CLI machine-payload proof"
    - "extractJsonPayload (first { .. last }): isolate the single executor payload from Nx/ng stdout framing; a failing parse/validate is LOUD, never a false pass"
    - "exit-code parity across --format human|json|sarif for the SAME input (0 clean / non-zero planted TS2322) is the cardinal anti-false-pass, proven on the shipped tarball"

key-files:
  created:
    - .planning/phases/32-verification-docs-additive-audit/deferred-items.md
  modified:
    - libs/test-util/src/lib/cli-e2e.ts
    - libs/test-util/src/lib/e2e-process.ts
    - libs/test-util/src/index.ts
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts
    - e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts
    - packages/angular-typechecker/project.json  # build asset-glob ignore (snapshot-leak fix, additive-safe)

key-decisions:
  - "runShim/runShimSplit share a private spawnShim so the spawn options (Windows shell+quoted-path CVE-2024-27980 handling, maxBuffer) live in ONE place; runShim's stream-merged output and error message are byte-unchanged."
  - "Observed (not assumed) framing: Angular CLI 22 `ng run` emits PURE stdout (leading/trailing empty); Nx 23 `nx run --output-style=static` FRAMES stdout (leading `> nx run` echo + a NO_COLOR/FORCE_COLOR node warning, trailing ` NX  Successfully ran ...`). extractJsonPayload isolates the payload for both; the CLI `.bin` shim stays the guaranteed-pure proof."
  - "ADVISORY_NOTICE_PREFIX = 'angular-typechecker:' is a safe purity needle: the json/sarif payloads name the tool `\"angular-typechecker\"` (no trailing colon), and the executor gates advisory notices to the human format, so a machine payload never contains it."
  - "Snapshot tarball leak (surfaced by the Task 3 e2e gate, pre-existing) was FIXED here at the coordinator's direction (commit 7a77b51): ignore:['**/__snapshots__/**'] on the build asset glob -- build-config only, additive-safe (restores @0.2.2's clean tarball shape); NOT a public-API/schema/dependency/version change."

patterns-established:
  - "One shared validateSarif across the integration tier (32-01) and all three e2e adapters (32-02)."
  - "assertMachineFormatParity called ALONGSIDE assertShippedBinExitCodes (not a fork); both restore the planted source in a finally so callers resume on a committed-clean fixture."

requirements-completed: [VER-03]

coverage:
  - id: D1
    description: "Standalone CLI adapter: the shipped .bin shim emits parseable JSON + schema-valid SARIF with PURE stdout (runShimSplit parses only .stdout) and identical exit codes across --format human|json|sarif (0 clean / 1 planted TS2322)."
    requirement: VER-03
    verification:
      - kind: e2e
        ref: "e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts (assertMachineFormatParity) -- nx e2e angular-typechecker-cli-e2e"
        status: pass
    human_judgment: false
  - id: D2
    description: "ng run adapter: ng run <app>:typecheck --format json|sarif emits a parseable/schema-valid payload with a clean payload boundary and identical exit codes across formats on the installed tarball; ng run stdout observed PURE."
    requirement: VER-03
    verification:
      - kind: e2e
        ref: "e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts (ACV-02, --format block) -- nx e2e angular-typechecker-ng-cli-e2e"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nx executor adapter: nx run <project>:typecheck --format json|sarif off the installed tarball emits a parseable/schema-valid payload (extractJsonPayload isolates the Nx-framed stdout) with identical exit codes across formats (0 clean / non-zero planted TS2322)."
    requirement: VER-03
    verification:
      - kind: e2e
        ref: "e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts (TEST-05, --format block) -- the install-smoke spec passed"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-07-19
status: complete
---

# Phase 32 Plan 2: VER-03 shipped-tarball --format e2e Summary

**The Verdaccio-installed tarball emits parseable JSON + schema-valid SARIF through all three adapters (standalone CLI, `ng run`, Nx executor) with clean payload boundaries and identical exit codes across `--format human|json|sarif` for the same input -- proven with a new `runShimSplit` stream-split, the shared 32-01 `validateSarif`, and an `extractJsonPayload` framing isolator.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-07-19T02:33Z
- **Completed:** 2026-07-19T03:06Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Added `runShimSplit` (SEPARATE stdout/stderr, sharing a private `spawnShim` with the unchanged stream-merged `runShim`) and `assertMachineFormatParity` to `@workspace/test-util`; wired it into the npm cli-exit-codes e2e -- the shipped `.bin` shim's stdout parses in isolation (JSON) / schema-validates (SARIF) and returns the identical exit code across all three formats (0 clean / 1 planted TS2322).
- Added `extractJsonPayload` (first `{` .. last `}`) + exported `ADVISORY_NOTICE_PREFIX` for the framed `ng run` / `nx run` adapters, and reused the ONE shared `validateSarif` across all three adapters.
- Extended the `ng-cli-e2e` ACV-02 spec (ng run adapter) and the `install-e2e` TEST-05 spec (Nx executor adapter): parse the json payload (formatVersion + diagnostics[] + summary), schema-validate the sarif payload, assert no advisory text inside the payload boundary, and assert exit-code parity across formats (clean + planted TS2322).
- Observed (not assumed) the real stdout framing: `ng run` is PURE (leading/trailing empty); `nx run --output-style=static` frames stdout with a `> nx run` echo + a NO_COLOR/FORCE_COLOR node warning and a trailing ` NX  Successfully ran ...` summary -- `extractJsonPayload` isolates the payload in the framed case, and the CLI `.bin` shim remains the guaranteed-pure proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: runShimSplit + standalone-CLI --format parity/purity (cli-e2e)** - `5031cf5` (test)
2. **Task 2: ng run --format purity + exit-code parity (ng-cli-e2e)** - `20fbd0a` (test)
3. **Task 3: Nx executor --format purity + exit-code parity (install-e2e)** - `d18091f` (test)

## Files Created/Modified
- `libs/test-util/src/lib/cli-e2e.ts` - `spawnShim` (shared), `runShimSplit` + `ShimResultSplit`, `assertMachineFormatParity`, exported `ADVISORY_NOTICE_PREFIX`; `runShim` refactored onto `spawnShim` with byte-unchanged behavior.
- `libs/test-util/src/lib/e2e-process.ts` - `extractJsonPayload`, the framed-adapter payload isolator.
- `libs/test-util/src/index.ts` - re-exports the new symbols.
- `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts` - calls `assertMachineFormatParity` alongside `assertShippedBinExitCodes`.
- `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts` - the `ng run <app>:typecheck --format` parity/purity block.
- `e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts` - the `nx run <project>:typecheck --format` parity/purity block.
- `.planning/phases/32-verification-docs-additive-audit/deferred-items.md` - the out-of-scope tarball-leak blocker (below).

## Decisions Made
- Shared `spawnShim` so `runShim` (merged) and `runShimSplit` (split) never drift on spawn options; `runShim`'s output + spawn-failure message are byte-unchanged.
- No `ng run` stream-split variant was needed: the observation showed `ng run` stdout is already pure, so `extractJsonPayload` (defensive isolation) suffices for both framed and pure adapters.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Excluded dev-only Vitest snapshots from the published tarball (PKG-02)**
- **Found during:** Task 3 verify gate (`nx e2e angular-typechecker-install-e2e`) surfaced two RED specs I did not modify -- `tarball-audit` PKG-02 and `verdaccio-publish` REL-04.
- **Issue:** the plugin build asset glob `**/!(*.ts)` in `packages/angular-typechecker/project.json` copied `src/**/__snapshots__/*.snap` into `dist/.../src/`, which `files: ["src"]` packed -- leaking four dev-only Vitest snapshots (`json-report.spec.ts.snap` P30, `sarif-report.spec.ts.snap` P31, the two `machine-reporters-*.integration.spec.ts.snap` 32-01) into the tarball. Pre-existing (reproduces at the pre-32-02 HEAD), surfaced by this plan's e2e gate.
- **Fix:** added `ignore: ["**/__snapshots__/**"]` to the asset glob -- Vitest snapshots are no longer copied; every real non-`.ts` asset (executors/schema/collection/builders/generators JSON, README, LICENSE) still ships.
- **Additive-safe:** build-config (packaging) change ONLY -- no public API / executor id / schema contract / dependency / version change. `@0.2.2`'s tarball carried no reporter snapshots (they arrived unreleased in Phase 30/31), so excluding them restores 0.2.3's tarball to `@0.2.2`'s clean shape -- a regression fix, not a breaking change. **32-03 ADD-01 should expect a `project.json` asset-glob diff and classify it non-breaking.**
- **Files modified:** `packages/angular-typechecker/project.json`
- **Verification:** `nx build angular-typechecker` dist has zero `.snap` and all real assets present; `nx e2e angular-typechecker-install-e2e` GREEN (11 files / 40 tests); `nx typecheck/lint angular-typechecker` (maxWarnings:0) + `nx format:check` green.
- **Committed in:** `7a77b51` (distinct fix commit)

---

**Total deviations:** 1 auto-fixed (1 packaging-correctness bug). The three planned VER-03 adapter proofs were implemented and pass exactly as specified.
**Impact on plan:** the fix was directed by the coordinator (fix now, not defer). It is a real 0.2.3 ship-blocker and a minimal, additive-safe build-config change. No scope creep into public API.

## Issues Encountered / Deferred Issues

### RESOLVED (commit `7a77b51`): the published tarball leaked dev-only `__snapshots__/*.snap`

Fixed in this plan (see the deviation above). The two previously-RED install-e2e specs (`tarball-audit` PKG-02, `verdaccio-publish` REL-04) are now GREEN. `deferred-items.md` and the STATE blocker are marked RESOLVED.

## Known Stubs
None - every deliverable is wired to the real installed tarball and asserted.

## Threat Flags
None - no new network/auth/file-access surface. VER-03 reuses the shipped Verdaccio global-setup (127.0.0.1, publish-once) and the 32-01 dev-only ajv validator; no new dependency, no ci.yml edit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `runShimSplit`, `assertMachineFormatParity`, `extractJsonPayload`, and `ADVISORY_NOTICE_PREFIX` are exported from `@workspace/test-util`.
- 32-03 (ADD-01) can proceed; the `.snap` tarball leak is RESOLVED (commit `7a77b51`). ADD-01 should expect a `packages/angular-typechecker/project.json` asset-glob diff (`ignore: ["**/__snapshots__/**"]`) and classify it as a non-breaking build-config/packaging change (no public API / executor id / schema / dependency / version change).
- Green gates: `nx e2e angular-typechecker-cli-e2e`, `nx e2e angular-typechecker-ng-cli-e2e`, `nx e2e angular-typechecker-install-e2e` (11 files / 40 tests, all GREEN), `nx build angular-typechecker`, `nx typecheck/lint test-util`, `nx typecheck/lint angular-typechecker` (maxWarnings:0), `nx format:check`.

## Self-Check: PASSED

- All created/modified files exist on disk (SUMMARY, deferred-items, cli-e2e helper, 3 e2e specs).
- All 3 task commits present: `5031cf5`, `20fbd0a`, `d18091f`.
- VER-03 adapter proofs green: `nx e2e angular-typechecker-cli-e2e` (5 tests), `nx e2e angular-typechecker-ng-cli-e2e` (5 tests), the install-smoke `--format` spec.
- Plugin surface unchanged (public API/executor/schema/deps/version): `nx typecheck/lint angular-typechecker`, `nx format:check` green.
- `nx e2e angular-typechecker-install-e2e` GREEN (11 files / 40 tests) after the snapshot-leak fix (`7a77b51`); the blocker is RESOLVED in deferred-items.md + STATE.md.

---
*Phase: 32-verification-docs-additive-audit*
*Completed: 2026-07-19*
