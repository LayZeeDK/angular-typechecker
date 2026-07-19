---
phase: 32
phase_name: "Verification + docs + additive audit"
project: "angular-typechecker"
generated: "2026-07-19"
counts:
  decisions: 9
  lessons: 5
  patterns: 7
  surprises: 4
missing_artifacts: []
---

# Phase 32 Learnings: Verification + docs + additive audit

Final phase of milestone v0.2.3 (machine-readable JSON/SARIF reporters). Deliverable is
integration + shipped-tarball e2e across all three adapters, SARIF schema validation, the
additive-only git-diff audit vs `@0.2.2`, and README/CHANGELOG -- no new runtime surface.

## Decisions

### Committed SchemaStore SARIF 2.1.0 schema + plain ajv, ROOT devDeps only
Validate the shipped SARIF against a COMMITTED SchemaStore `sarif-2.1.0.json` (draft-07, 111720 bytes, network-free at test time) using plain `ajv@^8` + `ajv-formats@^3` with `strict:false`. The draft-04 / `ajv-draft-04` fallback was NOT needed. `ajv`/`ajv-formats` live in the workspace-ROOT `package.json` devDependencies only; the plugin manifest is byte-unchanged (additive-only charter).

**Rationale:** Real schema validation over real reporter output (never shape-only, never fetch-at-test); keeps the dev-only validator out of the shipped tarball. **Source:** 32-01-SUMMARY.md

### validate-sarif.ts resolves its schema via `__dirname`, not `import.meta.url`
The RESEARCH recipe used `import.meta.url`, but `validate-sarif.ts` is a test-util LIB file compiled under `module:commonjs`, where `import.meta` is a TS error and breaks `nx build test-util`. Used `__dirname` (the established `verdaccio-global-setup.ts` convention).

**Rationale:** Works under both the commonjs lib build and the Vitest forks runtime. **Source:** 32-01-SUMMARY.md (Deviation 2)

### Nx executor invoked DIRECTLY in the integration tier (no convertNxExecutor)
The integration specs call `typecheckExecutor` directly rather than through `convertNxExecutor`, so it resolves NO project graph and needs no `NX_DAEMON`/`NX_ISOLATE_PLUGINS` override (unlike `builder.integration.spec.ts`), because `normalizeOptions` reads only `context.root`.

**Rationale:** Simpler, hermetic; avoids the ambient-daemon `ProjectConfigurationsError` class. **Source:** 32-01-SUMMARY.md

### runShim / runShimSplit share a private spawnShim; runShimSplit parses only .stdout
`runShimSplit` (separate stdout/stderr) shares a private `spawnShim` with the unchanged stream-merged `runShim`, so Windows shell+quoted-path (CVE-2024-27980) handling and `maxBuffer` live in ONE place. The standalone-CLI machine-payload proof parses ONLY `.stdout`.

**Rationale:** The `.bin` shim's isolated stdout is the guaranteed-pure payload proof; no drift between the two spawn variants. **Source:** 32-02-SUMMARY.md

### ADVISORY_NOTICE_PREFIX = 'angular-typechecker:' as the stdout-purity needle
The json/sarif payloads name the tool `"angular-typechecker"` (no trailing colon) and the executor gates advisory notices to the human format, so a machine payload can never contain the `angular-typechecker:` prefix -- a safe purity assertion.

**Rationale:** Deterministic proof that no advisory text contaminates the machine payload boundary. **Source:** 32-02-SUMMARY.md

### Snapshot tarball leak fixed via a build asset-glob ignore, classified non-breaking
`ignore: ["**/__snapshots__/**"]` added to the `packages/angular-typechecker/project.json` build asset glob so dev-only Vitest `.snap` files no longer pack into the tarball. Build-config only; classified additive-safe by ADD-01 (no public API / executor id / schema / dependency / version change).

**Rationale:** Restores `@0.2.2`'s clean tarball shape -- a regression fix, not a breaking change. **Source:** 32-02-SUMMARY.md, 32-03-SUMMARY.md

### ADD-01 verdict: ADDITIVE-ONLY holds, v0.3.0 untriggered, version held at 0.2.2
The published surface is byte-additive: barrel/builder/executor-id/generator-schemas UNCHANGED; executor+builder schemas WIDEN-ONLY (optional `format` enum, `required`/`additionalProperties` unchanged); `CoreResult.totalFilesCount` ADDITIVE. Plugin `dependencies` gained EXACTLY `node-sarif-builder@^4.1.0` since `@0.2.2`.

**Rationale:** A patch bump `0.2.2 -> 0.2.3` is correct; the v0.3.0 escape hatch stays untriggered. **Source:** 32-03-SUMMARY.md

### SARIF README recipe uses `npx angular-typechecker`, not `atc`
The GitHub Actions `upload-sarif` recipe invokes `npx angular-typechecker -c tsconfig.json --format sarif`, NOT a bare `atc` (not on PATH in a GH Actions `run:` step -- `node_modules/.bin` is not added there) and NOT `npx atc` (the documented `atc@0.0.6` supply-chain hazard).

**Rationale:** The reliable, canonical, copy-pasteable invocation for CI. **Source:** 32-04-SUMMARY.md (Deviation 1)

### Corrected "SARIF lands in a later release" across all THREE shipped --format surfaces
SARIF shipped in Phase 31, so the stale claim was reworded in the CLI `HELP_TEXT` (`parse-args.ts`) AND both the Nx executor and Angular CLI builder `schema.json` `format` descriptions. Description-string-only -> additive-safe (no enum/default/required/additionalProperties change; schema-parity specs stay green with no expectation edit).

**Rationale:** A falsehood would otherwise ship in 0.2.3; a description-only edit is not a contract change. **Source:** 32-04-SUMMARY.md (Deviation 2)

---

## Lessons

### The core/** ESLint D-11 boundary bans @nx/* imports even in specs
An `import type { ExecutorContext } from '@nx/devkit'` in a `src/core/` spec failed `nx lint` (maxWarnings:0) with 4 errors. Fix: derive the context type from the executor's own signature -- `Parameters<typeof typecheckExecutor>[1]` -- runtime unchanged.

**Context:** The framework-agnostic core boundary is enforced on specs too, not just production files. **Source:** 32-01-SUMMARY.md (Deviation 1)

### import.meta is forbidden under the commonjs test-util lib build
Test-util lib files build under `module:commonjs` (tsconfig.lib.json), so `import.meta` is a TS error and would break `nx build test-util`. Use `__dirname` for on-disk fixture resolution.

**Context:** Applies to any new file added under `libs/test-util/src/lib/`. **Source:** 32-01-SUMMARY.md (Deviation 2)

### Adapter stdout framing must be OBSERVED, not assumed
Angular CLI 22 `ng run` emits PURE stdout (leading/trailing empty). Nx 23 `nx run --output-style=static` FRAMES stdout: a leading `> nx run` echo + a NO_COLOR/FORCE_COLOR node warning + a trailing ` NX  Successfully ran ...` summary. `extractJsonPayload` (first `{` .. last `}`) isolates the payload for the framed case; the CLI `.bin` shim stays the guaranteed-pure proof.

**Context:** Any machine-payload assertion over `nx run` output must isolate the payload from framing. **Source:** 32-02-SUMMARY.md

### A packaging leak can hide until an e2e gate exercises the real tarball
The `**/!(*.ts)` build asset glob packed `src/**/__snapshots__/*.snap` into the tarball. It reproduced at the pre-32-02 HEAD but was invisible to unit/integration/typecheck/lint -- only the Task 3 install-e2e gate (tarball-audit PKG-02, verdaccio-publish REL-04) surfaced it.

**Context:** Packaging correctness is only observable at the tarball/e2e tier; run it before declaring a reporter/asset change done. **Source:** 32-02-SUMMARY.md

### Cross-OS byte-stability is a CI-only observable, not a local test gap
The integration spec asserts redacted-payload byte-stability against a committed snapshot on THIS machine (Windows). No single local machine can additionally prove Linux/macOS emit the identical redacted bytes -- that fact only exists once CI's 6-cell OS x Node matrix runs the same spec on the same commit. This is the sole legitimate `human_needed` / manual-only item for VER-02.

**Context:** Resolves automatically when the branch is pushed for the Release-PR; not an escapable gap. **Source:** 32-VERIFICATION.md, 32-VALIDATION.md

---

## Patterns

### Machine-reporter integration proof: same fixtures, both adapters, one seam
Drive BOTH `run()` (the CLI adapter) and the Nx executor over the SAME committed real cold-`@angular/compiler-cli` fixtures (`layout-b-host`, `global-diagnostics`), then assert their redacted payloads are equal -- proving the single `renderReport` seam.

**When to use:** Any time two adapters must share one reporter output; assert equality, not two independent shapes. **Source:** 32-01-SUMMARY.md

### Redact-before-compare + committed redacted snapshot as the byte-stability contract
`redactVolatile` maps the volatile tool version to `[version]`; the redacted payload is snapshot-committed. `process.chdir(workspaceRoot)` (cwd-pin) makes `run()`'s cwd-derived `pathBase` produce OS-invariant repo-relative forward-slash paths.

**When to use:** Locking machine output that carries volatile fields (version, absolute paths) across OSes. **Source:** 32-01-SUMMARY.md

### One shared validateSarif across the integration tier and all three e2e adapters
The dev-only `validateSarif` (committed schema + ajv) lives once in `@workspace/test-util` and is reused by the 32-01 integration specs AND the 32-02 CLI / `ng run` / Nx-executor e2e adapters.

**When to use:** Validate one payload shape identically everywhere it is produced; never re-implement the validator per tier. **Source:** 32-01-SUMMARY.md, 32-02-SUMMARY.md

### Exit-code parity across --format as the cardinal anti-false-pass
For the SAME input, assert the exit code is identical across `--format human|json|sarif` (0 clean / non-zero planted TS2322), on the shipped tarball. A reporter must never change the verdict.

**When to use:** Any multi-format reporter -- the format is presentation; the pass/fail verdict is invariant. **Source:** 32-02-SUMMARY.md

### Additive-only audit mirroring 27-ADDITIVE-AUDIT.md
Standing-guard cross-check (leg a: `index.drift.ts` barrel-drift tsc; leg c: `@nx/dependency-checks` lint) + git-diff per published path (leg b) + `git ls-tree` net-new proof. The negated-quiet idiom `! git show HEAD:<manifest> | rg -q ajv` proves a dev-only dependency did NOT reach the shipped manifest.

**When to use:** Gating a patch/minor release on "no breaking change reached the published surface". **Source:** 32-03-SUMMARY.md

### Docs content tripwire + absence drift-lock
Mirror `standalone-cli-docs.spec.ts`: a pure README + CHANGELOG read, whitespace-normalized, with `--format` drift-locked against live `parseCliArgs(['--help'])`. Add an ABSENCE assertion so a reconciled stale claim (non-goal / "lands in a later release") cannot silently reappear.

**When to use:** Any doc claim that must track shipped behavior, and any removed-falsehood you want kept removed. **Source:** 32-04-SUMMARY.md

### SARIF file-less diagnostic = a results[] entry with NO locations, never dropped
A diagnostic with no source file (e.g. a global TS2318) becomes a SARIF result with no `locations`, and is NEVER dropped from the output (proven by the `global-diagnostics` fixture).

**When to use:** Emitting SARIF/JSON where some diagnostics lack a file position -- keep them, do not filter. **Source:** 32-01-SUMMARY.md

---

## Surprises

### The snapshot tarball leak surfaced two RED specs the plan never touched
The Task 3 install-e2e gate flagged `tarball-audit` PKG-02 + `verdaccio-publish` REL-04 -- a pre-existing regression from the unreleased Phases 30/31 reporter snapshots.

**Impact:** Required an out-of-plan, coordinator-directed build-config fix (commit `7a77b51`) mid-phase before 32-02 could close. **Source:** 32-02-SUMMARY.md

### The "SARIF lands later" falsehood lurked in THREE shipped surfaces, not just the README
Beyond the README Options row, the stale claim shipped in the CLI `HELP_TEXT` AND both the executor and builder `schema.json` `format` descriptions.

**Impact:** A coordinator-directed follow-up (commit `4ab821d`) expanded 32-04 beyond README to correct + drift-lock all three surfaces. **Source:** 32-04-SUMMARY.md

### nx run frames stdout while ng run is pure
`nx run --output-style=static` still wraps the payload with an echo, a node NO_COLOR/FORCE_COLOR warning, and a trailing NX summary; `ng run` on Angular CLI 22 does not.

**Impact:** `extractJsonPayload` was needed for the framed adapters; the CLI `.bin` shim remained the only guaranteed-pure proof. **Source:** 32-02-SUMMARY.md

### The additive-only audit was the fastest plan in the phase (~6 min)
Writing the ADD-01 verdict over a frozen, already-tested published surface took ~6 min, vs ~33 min for the VER-03 e2e plan and ~18 min for VER-02.

**Impact:** Confirms that an audit-over-frozen-surface plan is cheap when the standing guards (drift tsc, dependency-checks lint) already run green -- most cost is re-running guards, not authoring. **Source:** 32-03-SUMMARY.md metrics
