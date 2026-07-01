---
phase: 4
phase_name: 'nx-executor-adapter-cacheable-target'
project: 'angular-typechecker'
generated: '2026-06-28'
counts:
  decisions: 4
  lessons: 5
  patterns: 4
  surprises: 3
missing_artifacts:
  - '*-HUMAN-UAT.md (verifier returned passed; no human verification items)'
---

# Phase 4 Learnings: nx-executor-adapter-cacheable-target

## Decisions

### renderReport core seam (D-02) — adapter could not call formatReport directly

`renderReport(result, { pathBase, color, failFast }): Promise<string>` was added to `core/`, using the memoized `loadCompilerCli()` + the module-PRIVATE `loadTypescript()` and delegating to `formatReport`.

**Rationale:** `formatReport` needs injected `ng`/`ts`, but `runTypecheck` returns no module handles and `loadTypescript` is not barrel-exported — so the adapter literally could not render. The seam keeps CJS->ESM loading inside `core/` where the loaders live, preserves `formatReport`'s pure/injectable signature for unit tests, and avoids the two wrong fixes (re-exporting `loadTypescript`, or re-coupling rendering into the engine via `CoreResult.formatted`). The 5-member panel flagged this as a compile-blocker before execution; it was.
**Source:** 04-01-SUMMARY.md, 04-CONTEXT.md D-02

### ^default inlined-source cache model, NOT @nx/js's project-references model (D-08/D-09)

The cacheable target hashes dependency SOURCE via `^default` (+ `{workspaceRoot}/tsconfig.base.json` + `externalDependencies:['typescript','@angular/compiler-cli']`), not `dependentTasksOutputFiles` over dep `.d.ts`.

**Rationale:** Angular has no TS project-references support, so deps are inlined source; the consumer's whole-program check reads the dep `.ts` directly, so the dep source must be hashed. `^default` over `^production` (the research's first answer) because a whole-program check reads files `production` excludes — over-invalidation is the safe direction for a correctness gate. `@nx/js` even leaves `externalDependencies` commented out; a type-check tool deliberately enables it.
**Source:** 04-02-SUMMARY.md, 04-CONTEXT.md D-08/D-09

### Dual-key targetDefaults (published id + dev workspace-scoped key)

`nx.json` keys the cacheable default by BOTH `angular-typechecker:angular-typecheck` (the published id) AND the dev workspace-scoped `@angular-typechecker/angular-typechecker:angular-typecheck`.

**Rationale:** In this dogfooding workspace the executor is referenced via the tsconfig path-alias scope, so a default keyed only by the published id NEVER BINDS — caching was effectively off (every run a cache-miss) until the second key was added. Phase-5 hand-off: only the PUBLISHED key goes in the consumer README; the workspace-scoped key is a dev-only artifact and must not leak.
**Source:** 04-03-SUMMARY.md, 04-REVIEW.md WR-04

### includeDeps: true on the cache-test consumer target

The consumer target sets `includeDeps: true`.

**Rationale:** The non-buildable dep is a sibling project root, so its diagnostics are out-of-project and SUPPRESSED by the Phase-3 boundary filter by default — the injected dep-source error produced a false PASS. `includeDeps: true` surfaces it so the cache MISS genuinely reports the new error. This is the correct recipe for catching non-buildable transitive-dep errors (Phase-5 README note).
**Source:** 04-03-SUMMARY.md

---

## Lessons

### The cache false-PASS modes are real and subtle — the test design caught them, a naive one would not

TEST-04 asserts a CACHE HIT first (proving the targetDefault binds) and uses `includeDeps:true` (proving dep errors surface). A naive "run twice, see the error both times" test would have PASSED while caching was silently off AND dep diagnostics were suppressed — the exact "type-checker that lies" outcome the phase exists to prevent.

**Context:** Both false-PASS modes were latent bugs introduced in 04-02 and fixed in 04-03. The HIT-then-MISS triad + the R1 `--check` pre-flight are what exposed them.
**Source:** 04-03-SUMMARY.md, 04-VERIFICATION.md

### `--no-color` on `nx run` is forwarded as an executor option and rejected by additionalProperties:false

Passing `--no-color` on the `nx run` CLI makes Nx forward `color: false` into the executor's options object, which the v0.0.1 schema's `additionalProperties: false` rejects (`'color' is not found in schema`, exit 1 — a false failure).

**Context:** D-12 originally specified `--no-color` for ANSI determinism. The fix: use the ENV VARS `FORCE_COLOR=0`/`NO_COLOR=1` instead, combined with `--output-style=static`. Schema strictness (a contract/security win) surfaced an unexpected CLI incompatibility.
**Source:** 04-02-SUMMARY.md (hand-off), 04-03-SUMMARY.md

### The fixture paths alias must be RELATIVE under TS 6 or it raises TS5090 and masks real errors

A non-relative `paths` value (`libs/...`) raises TS5090 (baseUrl-not-set) as an OPTIONS diagnostic inherited by every fixture extending `tsconfig.base.json`; `ngc`'s `defaultGatherDiagnostics` short-circuits on the options error and masks the real TS2322, breaking `gate-b.spec.ts`'s differential.

**Context:** Fixed by making the alias value relative (`./libs/...`), matching the existing `@angular-typechecker/...` entry. No `baseUrl` needed anywhere. Found by the in-flight gate, not by review.
**Source:** 04-02-SUMMARY.md (commit 4e42ad0)

### Nested `nx run` inside a Vitest e2e task inherits cache-defeating env vars

Running `nx run`/`runExecutor` from inside `nx run <e2e>:test` inherits `NX_SKIP_NX_CACHE` + the forked-runner `NX_*` vars from the parent task, defeating the cache assertions; the harness must strip them. `runExecutor` also needs the real project graph + a non-Tree `readNxJson`.

**Context:** This is the concrete form of the panel's "nested-Nx" determinism risk. The harness uses `NX_DAEMON=false`, a per-run `NX_CACHE_DIRECTORY`, env-var stripping, and the dedicated serialized e2e project (singleFork, no parallelism).
**Source:** 04-03-SUMMARY.md

---

## Patterns

### R1 edge guard as a blocking cache-correctness pre-flight

`nx show target inputs <project>:<target> --check <exact dep source file>` invoked via `execSync` (exit code captured), asserting the file IS an input, BEFORE the dynamic cache test.

**When to use:** Any Nx cacheable whole-program/aggregate target whose correctness depends on a transitive dependency's source being in the hash. CRITICAL: never pipe `--check` through `head`/`rg` — the pipe's exit code masks Nx's (a research-verified gotcha). A missing graph edge otherwise yields a false PASS.
**Source:** 04-RESEARCH.md, 04-03-SUMMARY.md, 04-CONTEXT.md D-10

### Cache-correctness test triad (HIT -> inject -> MISS)

Assert a CACHE HIT on an unchanged green re-run (proves the config binds), inject a type error into a transitive dep's committed SOURCE, then assert a CACHE MISS (marker absent) + the new diagnostic + non-zero exit. Run via `execSync` + `--output-style=static` + `NX_DAEMON=false` + `FORCE_COLOR=0` + per-run `NX_CACHE_DIRECTORY`.

**When to use:** Proving any cacheable correctness tool does not serve stale GREEN results. The HIT half is as load-bearing as the MISS half — it proves caching is actually on.
**Source:** 04-03-SUMMARY.md, 04-CONTEXT.md D-12/D-13

### Crash-safe committed-fixture mutation

Commit a byte-identical `.pristine` sidecar of the file a test mutates; `beforeAll` heals from the sidecar if a prior crashed run left the injection; a `finally` byte-restore reverts after the run (preserve EOL); a `git diff --exit-code` CI backstop catches leaks. NEVER `git checkout` (defeated by a killed worker; reverts to HEAD; touches the index).

**When to use:** Any test that must mutate a committed source file at runtime and reliably revert it across crashes.
**Source:** 04-03-SUMMARY.md, 04-CONTEXT.md D-15

### Convenience seam for an unreachable pure-injectable function

When an adapter needs a pure function that takes injected heavy/ESM deps (e.g. `formatReport(ng, ts, ...)`) but cannot reach those deps, add a thin core convenience (`renderReport`) that supplies them from the memoized loaders. The pure function stays unit-testable with fakes; every adapter (and future CLI/builder) calls the convenience.

**When to use:** A core/adapter seam where the pure layer's dependencies are intentionally hidden inside the core's loaders.
**Source:** 04-01-SUMMARY.md, 04-CONTEXT.md D-02

---

## Surprises

### The panel's two flagged false-PASS risks both materialized as real bugs

The 5-member pre-execution review flagged (a) a missing consumer->dep project-graph edge and (b) suppressed out-of-project dep diagnostics as the two ways TEST-04 could false-PASS. BOTH became latent bugs from 04-02 (dual-key non-binding; default boundary filter suppressing the dep error) that 04-03 had to fix. The adversarial review paid off concretely, not just theoretically.

**Impact:** Validated investing in the panel + the R1 guard + the HIT-first test design. Without them the phase would have shipped a cache that lies.
**Source:** 04-03-SUMMARY.md, 04-VERIFICATION.md, the discuss-phase panel

### A targetDefault keyed by the published package id silently did not bind in the dev workspace

Caching was effectively OFF (every run a cache-miss) because the dev-workspace target is referenced via the alias scope, not the published id — a target-name mismatch with no error.

**Impact:** Surfaced only because the cache test asserts a CACHE HIT. Reinforces that a cache test must prove caching is ON, not just that errors reappear.
**Source:** 04-03-SUMMARY.md

### Schema strictness (additionalProperties:false) collided with Nx's CLI option-forwarding

A deliberate contract/security hardening (reject unknown options) made the conventional `--no-color` determinism flag fail, because Nx forwards CLI flags as executor options. The right fix was env-var-based color control, not loosening the schema.

**Impact:** Documented as the FORCE_COLOR/NO_COLOR recipe; a reminder that strict executor schemas constrain which `nx run` flags are safe to pass.
**Source:** 04-02-SUMMARY.md, 04-03-SUMMARY.md
