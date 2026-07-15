---
phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
plan: 01
subsystem: infra
tags: [angular-cli, builder, convert-nx-executor, ng-run, esm-bridge, nx-devkit, spike, gate]

# Dependency graph
requires:
  - phase: v0.2.0 (shipped)
    provides: the typecheck executor + core/compiler-loader.ts CJS->ESM await import() bridge that the builder re-exports
provides:
  - Minimal Angular CLI builder (src/builders/typecheck/builder.ts = convertNxExecutor(typecheckExecutor))
  - builders.json manifest + additive package.json builders field + files-allowlist entry + project.json build-asset glob
  - Sanitized builder schema.json (Nx-only $id/cli/version stripped; single-string tsConfig)
  - gate-a-static byte-guard extended to the built builder entry
  - GATE A' spike 011 with a recorded VERDICT = GO (real ng run on-stack Angular 22, no ERR_REQUIRE_ESM)
affects: [21-02 (ENG-01 tsConfig array), 21-03 (ACB-01/ACB-03 in-repo guard suite), Phase 22 configuration write-fork, Phase 23 ng-add, Phase 24 e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Angular CLI builder = thin convertNxExecutor re-export of the SAME executor default export (no hand-written architect builder; D-04)"
    - "Additive-safety: Nx reads executors ?? builders, so the new builders manifest is Nx-invisible; executors/generators byte-unchanged"
    - "GATE-by-evidence: an orchestrator spike drives real nx build -> npm pack dist -> tarball install into a real clone -> ng run, recording a GO/NO-GO forensic-log.json (record-only; clone never committed)"

key-files:
  created:
    - packages/angular-typechecker/src/builders/typecheck/builder.ts
    - packages/angular-typechecker/src/builders/typecheck/schema.json
    - packages/angular-typechecker/builders.json
    - .planning/spikes/011-builder-ng-run-esm-bridge/harness.mjs
    - .planning/spikes/011-builder-ng-run-esm-bridge/README.md
    - .planning/spikes/011-builder-ng-run-esm-bridge/forensic-log.json
  modified:
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/project.json
    - packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts
    - packages/angular-typechecker/src/package-manifest.spec.ts
    - .planning/spikes/MANIFEST.md
    - .claude/skills/spike-findings-angular-typechecker/SKILL.md

key-decisions:
  - "GATE A' = GO (empirical): the CJS->ESM await import() bridge survives convertNxExecutor + a real ng run on-stack Angular 22 (app AND library), no ERR_REQUIRE_ESM incl. the eager project-graph prelude"
  - "Builder tsConfig stays single-string in this plan (pure bridge gate); ENG-01 widens both schemas to oneOf in Wave 2 (21-02)"
  - "On-stack install into bluehalo/ngx-leaflet needed NO --legacy-peer-deps (clean)"

patterns-established:
  - "convertNxExecutor re-export builder"
  - "orchestrator spike (real ng run) vs verbatim-engine .mjs spike"

requirements-completed: []  # ACB-01/ACB-02/ACB-03 substantively advanced but formally closed by the phase verifier after the human GATE A' GO + Wave 3 guard suite

# Metrics
duration: ~30min
completed: 2026-07-10
---

# Phase 21 Plan 01: Angular CLI builder + GATE A' spike (GO) Summary

**Landed the minimal `convertNxExecutor` Angular CLI builder (+ manifests, sanitized schema, extended byte-guard) and empirically PROVED (GATE A' = GO) that the CJS-loads-ESM-`@angular/compiler-cli`-`await import()` bridge survives `convertNxExecutor` + a real `ng run` on-stack Angular 22, against the real `bluehalo/ngx-leaflet` clone.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-10T17:40:00Z
- **Completed:** 2026-07-10T17:57:00Z
- **Tasks:** 3 of 4 (task 4 is a blocking human-verify checkpoint -- pending)
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments
- Minimal Angular CLI builder: `src/builders/typecheck/builder.ts` is a 3-line `convertNxExecutor(typecheckExecutor)` re-export -- parity with the Nx executor is structural (same core, same stdout report, same `{ success }`).
- Additive manifests: new `builders.json`, additive `package.json` `builders` field + `builders.json` in the files allowlist, and a `project.json` build-asset glob so the tarball carries the manifest. `executors`/`generators` byte-unchanged.
- Sanitized builder `schema.json` (Nx-only `$id`/`cli`/`version` stripped; all five properties + `required`/`additionalProperties` verbatim; single-string `tsConfig` for the pure bridge gate).
- Extended `gate-a-static.spec.ts` with a negative byte-assertion on the built `builder.js` (never `require()`s `@angular/compiler-cli`); fixed `package-manifest.spec.ts` to lock the additive `builders` field + files entry. Full suite green (258 tests).
- **GATE A' spike 011 = GO:** an orchestrator harness built + packed the dist, installed the tarball into the real Angular 22 `bluehalo/ngx-leaflet` clone (no `--legacy-peer-deps`), hand-wired `architect.typecheck` on the app AND the library, ran real `ng run <project>:typecheck` three times, and recorded 15/15 assertions PASS with no ESM failure signatures.

## Task Commits

Each task was committed atomically:

1. **Task 1: minimal builder + manifests + sanitized schema** - `4b768d4` (feat)
2. **Task 2: extend static byte-guard + fix manifest spec** - `86d44c4` (test)
3. **Task 3: GATE A' spike 011 (real ng run) -- VERDICT GO** - `57c391c` (test)

**Plan metadata:** (this SUMMARY + partial STATE/ROADMAP) -- committed with this doc.

## GATE A' Evidence (spike 011 / forensic-log.json)

- **Verdict:** `GO`
- **Substrate:** `bluehalo/ngx-leaflet` @ `818e9ae55240b570397ede5a15cb4d466785abdc` (record-only; clone + node_modules never committed, restored pristine after the run).
- **Environment:** node v24.18.0, npm 11.16.0, `@angular/cli` 22.0.0, `@angular/core` 22.0.0, `@angular/compiler-cli` 22.0.0, TypeScript 6.0.3 (on-stack Angular 22).
- **Per-project `ng run` exit codes:**
  - `ngx-leaflet-demo` (app, `tsConfig: tsconfig.app.json`), clean baseline: **exit 0 (GREEN)**
  - `ngx-leaflet` (library, `tsConfig: projects/ngx-leaflet/tsconfig.lib.json`), clean: **exit 0 (GREEN)** -- bridge survives for a library project
  - `ngx-leaflet-demo` (app) with a planted `TS2322`: **exit 1 (RED)** -- `src/main.ts:17:7 - error TS2322: Type 'string' is not assignable to type 'number'.`
- **ESM-signature scan:** EMPTY for all three runs (no `ERR_REQUIRE_ESM`, no `require() of ES Module`, no `Cannot use import statement outside a module`); no project-graph/daemon error before any diagnostic. The eager `retrieveProjectConfigurationsWithAngularProjects` prelude ran cleanly.
- **On-stack install:** clean -- NO `--legacy-peer-deps` (added 91 packages incl. the transitive `nx`; expected per Pitfall 4).
- **`nx build angular-typechecker && nx test angular-typechecker`:** GREEN (258 tests, incl. the extended `gate-a-static.spec.ts` builder-entry assertion + the `package-manifest.spec.ts` builders-field assertion).

## Files Created/Modified
- `packages/angular-typechecker/src/builders/typecheck/builder.ts` - the whole builder: `convertNxExecutor(typecheckExecutor)` re-export (ACB-01).
- `packages/angular-typechecker/builders.json` - Angular CLI builder manifest registering `typecheck`.
- `packages/angular-typechecker/src/builders/typecheck/schema.json` - sanitized builder options schema (no `$id`/`cli`/`version`; single-string `tsConfig`).
- `packages/angular-typechecker/package.json` - additive `builders` field + `builders.json` files entry (executors/generators unchanged).
- `packages/angular-typechecker/project.json` - build-asset glob copying `builders.json` into dist/tarball.
- `packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts` - negative byte-assertion on the built `builder.js` (ACB-02 static half).
- `packages/angular-typechecker/src/package-manifest.spec.ts` - locks the additive `builders` field + `builders.json` in the files allowlist (ACB-03).
- `.planning/spikes/011-builder-ng-run-esm-bridge/{harness.mjs,README.md,forensic-log.json}` - the GATE A' spike record (VERDICT GO).
- `.planning/spikes/MANIFEST.md` - Idea 4 (v0.2.1 Angular CLI builder GATE A') verdict row = GO.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` - findings-index row surfacing GATE A' = GO.

## Decisions Made
- **Builder `tsConfig` stays single-string in this plan.** The pure bridge gate uses a single-string `tsConfig`; ENG-01 widens both schemas to `oneOf` string|array in Wave 2 (21-02). (Per the plan's `<interfaces>` note.)
- **Optional peers (`@angular-devkit/architect`, `rxjs`) NOT declared here.** Deferred to Phase 23 (ACP-01) per the plan; the `ngx-leaflet` clone provides both, so the gate was not blocked and there is no `@nx/dependency-checks` lint surprise mid-gate.
- **GREEN control is the app baseline (pre-plant) + the library run; RED proof is the same app with a planted `TS2322`.** Using the same app for green->red is an airtight "diagnostics genuinely flow" proof independent of the clone's own cleanliness; the library run additionally proves the bridge survives for a library project.

## Deviations from Plan

None - plan executed exactly as written (tasks 1-3). No deviation rules (1-4) were triggered; build, lint, and the full test suite passed without any auto-fix.

## Issues Encountered
- The `bluehalo/ngx-leaflet` clone had NO `node_modules` (fresh clone). Handled within scope: the harness auto-provisions the clone via `npm ci` when `node_modules` is absent (idempotent; part of the documented reproduction). This is expected substrate setup, not a plan deviation.

## User Setup Required
None - no external service configuration required. (The GATE substrate is a local dev clone documented by repo URL + SHA in the spike record.)

## Next Phase Readiness
- **GATE A' = GO is recorded**, but plan 21-01 is NOT yet complete: task 4 is a **blocking `checkpoint:human-verify`** (the GATE A' GO/NO-GO). The human must type "GO" to authorize Waves 2-3. Until then, 21-02 (ENG-01) and 21-03 (ACB guard suite) must NOT proceed, and ROADMAP plan 21-01 stays unchecked.
- On GO, the minimal builder STAYS (it is the ACB-01 deliverable). On NO-GO (not the case here), the phase HALTS with a documented re-scope and NEVER a hand-written `@angular-devkit/architect` builder (D-04).

## Self-Check: PASSED

All created files exist on disk (builder.ts, builder schema.json, builders.json, the built dist builder.js + builders.json, and the spike 011 harness/README/forensic-log). All three task commits (`4b768d4`, `86d44c4`, `57c391c`) exist in the git log.

---
*Phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no*
*Completed (tasks 1-3): 2026-07-10 -- awaiting human GATE A' GO/NO-GO*
