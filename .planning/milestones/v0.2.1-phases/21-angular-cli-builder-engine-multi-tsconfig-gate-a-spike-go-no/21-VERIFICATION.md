---
phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
verified: 2026-07-10T19:03:38Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  note: initial verification
---

# Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike Verification Report

**Phase Goal:** The shipped `typecheck` executor is runnable as an Angular CLI builder (`ng run <project>:typecheck`) with diagnostics, human output, and verdict identical to the Nx executor; the engine's `tsConfig` accepts `string | string[]`; and the CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` bridge is empirically proven to survive `convertNxExecutor` + a real `ng run`.
**Verified:** 2026-07-10T19:03:38Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | GATE A' (ACB-02): real `ng run` against `bluehalo/ngx-leaflet` completes with NO `ERR_REQUIRE_ESM` on-stack Angular 22 (incl. eager project-graph prelude); the GATE build-output static assertion is extended to the builder entry; GO/NO-GO verdict recorded | VERIFIED | `forensic-log.json` verdict=GO, 15/15 assertions PASS; `esmSignatures` empty on all 3 runs; app baseline exit 0, lib exit 0, app-planted exit 1 (TS2322 RED). Harness logic verified genuine (verdict computed from `results.every(r=>r.pass)`, not hardcoded). `gate-a-static.spec.ts` extended with a negative `require('@angular/compiler-cli')` assertion on the built `builder.js` (4/4 tests pass). Human-authorized GO recorded (commit `81f3128`) |
| 2 | ACB-01: `ng run <project>:typecheck` via the `convertNxExecutor`-wrapped builder produces diagnostics + human output + `BuilderOutput.success` verdict identical to the Nx executor | VERIFIED | `builder.ts` = `export default convertNxExecutor(typecheckExecutor)` -- re-export of the SAME executor default (structural parity). `builder.spec.ts` (4/4) asserts source + runtime (genuine Architect brand + handler). `schema-parity.spec.ts` (8/8) locks the builder schema to `TypecheckExecutorOptions`. Real `ng run` planted TS2322 surfaced RED, clean GREEN -- diagnostics genuinely flow through convertNxExecutor + Architect + the compiler-cli bridge |
| 3 | ENG-01: `tsConfig` accepts an array; each entry runs through the single-`tsConfig` logic, diagnostics UNION, input-set-membership boundary over combined declared sets; single-string + Nx path byte-unchanged | VERIFIED | `schema.d.ts` `tsConfig: string \| string[]`; both `schema.json` `oneOf` string\|array minItems 1; `normalize-options.ts` maps `resolveOne` over entries; `run-typecheck.ts` `Array.isArray` branch -> `handleMultiTsConfig` (union raw diagnostics, ONE `finalize` over combined `rootNamePaths` via `buildFinalizeFilter`, zero-rootNames -> `SkippedReference`, empty-array + per-entry 500 -> infra throw). `multi-tsconfig.integration.spec.ts` (3/3, real compiler): array surfaces BOTH TS2322+TS2345, both leaves kept; `[appLeaf]`===`appLeaf`; single-string unchanged. Full pre-existing suite green (274 unit + 97 integration) |
| 4 | ACB-03: `builders.json` + `package.json` `builders` field added additively; `nx run <project>:typecheck` still resolves; `executors ?? builders` regression assertion passes | VERIFIED | `builders.json` registers the `typecheck` builder; `package.json` `builders: "./builders.json"` additive with `executors`/`generators` byte-unchanged + `builders.json` in `files`; `project.json` asset glob copies `builders.json` to dist (confirmed `dist/.../builders.json`). `nx-surface-regression.spec.ts` (3/3) + `package-manifest.spec.ts` (15/15) lock the surface |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/builders/typecheck/builder.ts` | `convertNxExecutor(typecheckExecutor)` re-export | VERIFIED | 3-line re-export; import ordering per convention; built `dist/.../builder.js` is CJS, `require`s the executor, never requires compiler-cli |
| `builders.json` | Angular CLI builder manifest | VERIFIED | `builders.typecheck.implementation = ./src/builders/typecheck/builder`; copied to dist via asset glob |
| `src/builders/typecheck/schema.json` | Sanitized builder schema (no `cli`/`version`/`$id`) | VERIFIED | All 5 properties verbatim, `required:["tsConfig"]`, `additionalProperties:false`, `tsConfig` `oneOf` string\|array; no Nx-only keys |
| `package.json` | Additive `builders` field + files entry | VERIFIED | `builders: "./builders.json"`; `executors`/`generators` unchanged; `builders.json` in allowlist |
| `project.json` | Build-asset glob for `builders.json` | VERIFIED | Third asset block present; `dist/.../builders.json` exists |
| `src/core/run-typecheck.ts` | Widened `CoreOptions.tsConfigPath` + `handleMultiTsConfig` | VERIFIED | `handleMultiTsConfig` reached via `Array.isArray`; exactly ONE `finalize(` inside it (line 682) |
| `src/executors/typecheck/normalize-options.ts` | Array-aware resolution | VERIFIED | `resolveOne` mapped over entries via `Array.isArray` |
| `fixtures/multi-tsconfig-array/**` | Hermetic co-located leaves, planted diagnostic each | VERIFIED | 4 files (app.component.ts TS2322, app.component.spec.ts TS2345, tsconfig.app/spec.json); new dir, no committed fixture mutated |
| `.../spike-011/forensic-log.json` | GATE A' evidence, verdict=GO | VERIFIED | verdict=GO, clone URL+SHA `818e9ae`, per-project exit codes, empty ESM scan, 15 assertions |
| Builder guard specs (3) | schema-parity, builder, nx-surface-regression | VERIFIED | All present + substantive; part of the 274-test green suite |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `builder.ts` | executor default export | `import typecheckExecutor + convertNxExecutor` | WIRED | Built `builder.js` `require("../../executors/typecheck/executor")` |
| `package.json builders` | `builders.json` -> `builder` impl | Angular CLI builder resolution | WIRED | Manifest present, additive; real `ng run` resolved the builder in the GATE |
| `project.json` assets | `dist/.../builders.json` | asset glob | WIRED | `dist/packages/angular-typechecker/builders.json` present |
| `runTypecheck` `Array.isArray` branch | `handleMultiTsConfig` -> `finalize` over combined set | union-then-single-finalize | WIRED | Integration spec proves both leaves surface + combined boundary |
| `normalize-options` | `coreOptions.tsConfigPath` (string \| string[]) | `Array.isArray ? map(resolveOne) : resolveOne` | WIRED | Confirmed in source |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
| -------- | ---- | ------ | ------------------ | ------ |
| Angular CLI builder | diagnostics + `{ success }` | `typecheckExecutor` -> core engine -> `@angular/compiler-cli` `performCompilation` | Yes | FLOWING -- real `ng run` planted TS2322 surfaced RED (exit 1); clean GREEN (exit 0); confirms live diagnostics through the CJS->ESM bridge |
| `handleMultiTsConfig` | unioned diagnostics | per-entry `readConfiguration` + `runNoEmitCompilation` | Yes | FLOWING -- integration spec surfaces real TS2322 (app leaf) + TS2345 (spec leaf) from a real compiler run |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Build + unit tests + lint | `nx run-many -t build test lint -p angular-typechecker --skip-nx-cache` | 274 tests pass (32 files); build + lint green | PASS |
| Integration tier (real compiler) | `nx run angular-typechecker:integration --skip-nx-cache` | 97 tests pass (19 files); `multi-tsconfig.integration.spec.ts` 3/3 | PASS |
| Workspace format check (CI gate) | `nx format:check` | exit 0 (clean) | PASS |
| Built builder.js is CJS + no compiler-cli require | read `dist/.../builder.js` | `require`-based CJS, `convertNxExecutor(executor)`, no compiler-cli require | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| GATE A' spike 011 orchestrator | `node .planning/spikes/011-builder-ng-run-esm-bridge/harness.mjs` | Not re-executed (mutates an external uncommitted clone + provisions node_modules; minutes-long). Harness LOGIC verified genuine (verdict from `results.every(r=>r.pass)`); committed `forensic-log.json` records verdict=GO / 15-of-15; human-authorized GO (commit `81f3128`) | PASS (evidence + logic audit) |

Note: this spike is not a conventional `scripts/*/tests/probe-*.sh`; it is a record-only GATE orchestrator against an external clone. Re-running is destructive/expensive, and the human GATE A' checkpoint already accepted the recorded GO. The anti-fabrication check (that the harness computes GO from real assertions rather than hardcoding it) was performed by reading the harness source.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| ENG-01 | 21-02 | `tsConfig` accepts `string \| string[]`; union + combined input-set boundary; single-string + Nx path byte-unchanged | SATISFIED | `handleMultiTsConfig` + both schemas `oneOf` + `normalize-options` + integration spec (3/3) |
| ACB-01 | 21-01, 21-03 | `ng run` via `convertNxExecutor` builder identical to Nx executor | SATISFIED | Thin re-export + builder.spec + schema-parity + real `ng run` RED/GREEN |
| ACB-02 (GATE A') | 21-01 | Spike proves ESM bridge survives `convertNxExecutor` + real `ng run` on-stack Angular 22, verdict recorded | SATISFIED | Spike 011 forensic-log verdict=GO, gate-a-static extended, human GO |
| ACB-03 | 21-01, 21-03 | `builders.json` + `builders` field additive; `executors ?? builders` regression | SATISFIED | Additive manifests + nx-surface-regression + package-manifest specs |

Note: `REQUIREMENTS.md` traceability table still marks ENG-01 and ACB-02 as "Pending". This is the expected pre-verification state -- the SUMMARYs explicitly leave these for the phase verifier to formally close. The codebase evidence above satisfies both; the milestone audit can now close them. Not a gap.

### CONTEXT.md Decisions (D-01..D-07)

| Decision | Honored | Evidence |
| -------- | ------- | -------- |
| D-01 real `ngx-leaflet` clone @ 818e9ae for GATE A' | Yes | forensic-log records exact repo URL + SHA |
| D-02 spike record-only per CONVENTIONS | Yes | spike 011 harness+README+forensic-log; clone uncommitted; MANIFEST + skill row committed |
| D-03 GO checklist (no ERR_REQUIRE_ESM; parity; static assertion extended; nx run resolves) | Yes | all four criteria evidenced |
| D-04 gate-first; NO-GO halts; never a hand-written architect builder | Yes | builder is `convertNxExecutor` re-export; thin-wrapper guard forbids a fork; GO recorded before waves 2-3 |
| D-05 sanitized builder schema | Yes | no `cli`/`version`/`$id` (asserted) |
| D-06 `tsConfig` string\|string[] union-then-single-finalize over combined input set | Yes | `handleMultiTsConfig` |
| D-07 three-tier substrate (in-repo CI-authoritative; real clone quick verify; scaffolded e2e -> Phase 24) | Yes | in-repo Vitest suite + real-clone GATE; scaffolded e2e correctly deferred to Phase 24 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | - | - | No debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER) in phase production files; no stubs (the minimal builder is the intended deliverable per D-04); format + lint clean |

### Human Verification Required

None outstanding. The one human-gated item -- the GATE A' GO/NO-GO checkpoint (task 4 of plan 21-01) -- was authorized GO on 2026-07-10 (commit `81f3128`; confirmed by the orchestrator), unblocking Waves 2-3 which are complete.

### Gaps Summary

No gaps. All four ROADMAP success criteria (ENG-01, ACB-01, ACB-02/GATE A', ACB-03) are satisfied with codebase evidence: a substantive `convertNxExecutor` builder + additive manifests, a widened `tsConfig` engine path proven by a real-compiler integration spec, a sanitized parity-locked builder schema, and the GATE A' spike recording an empirically GO'd, human-authorized verdict. Build (274 unit), integration (97, incl. the ENG-01 spec), lint, and workspace format:check all pass. The GATE A' harness computes its verdict from real assertions (not hardcoded) and the built `builder.js` provably never `require()`s the ESM compiler.

---

_Verified: 2026-07-10T19:03:38Z_
_Verifier: Claude (gsd-verifier)_
