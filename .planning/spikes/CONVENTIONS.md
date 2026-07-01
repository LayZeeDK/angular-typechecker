# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the
question requires otherwise.

## Stack

- **Harness runtime:** standalone Node ESM `.mjs` scripts run with `node .planning/spikes/NNN-*/harness.mjs`.
  Each imports the REAL toolchain: `import * as ng from '@angular/compiler-cli'` (ESM) and
  `import tsDefault from 'typescript'; const ts = tsDefault.default ?? tsDefault` (CJS default-import).
  No build step, no ts-node -- plain node against the workspace `node_modules` (resolves by walking up).
- **Engine fidelity:** harnesses mirror the real engine by copying the pure functions VERBATIM --
  `gatherAllDiagnostics` (gather-diagnostics.ts), `filterDiagnostics` (filter-diagnostics.ts), and the
  emit-neutralizing `options` override (run-typecheck.ts). This keeps a spike's behavior identical to
  production without importing the TS source.
- **Benchmarking:** Vitest `bench` (`*.bench.mts` + a standalone `vitest.bench.config.mts`, node
  environment) for standardized statistics (samples, p99, RME). A companion node harness may provide
  production-representative absolutes + correctness assertions (Vitest's pool inflates absolute ms
  ~2.5x, so read the RATIO from bench, the absolutes from the node harness).
- **Glob/Nx-input analysis:** `minimatch` (from node_modules) with `{ dot: true }` to resolve Nx
  named inputs; `npx nx show projects --affected --files=<f>` to confirm project-graph edges.
- Verified versions: `@angular/compiler-cli` 22.0.4, `typescript` 6.0.3, `vitest` 4.1.9,
  `minimatch` 10.2.5, Node 24.18.0 (Windows arm64).

## Structure

```
.planning/spikes/
  MANIFEST.md            # idea, requirements, spike table with verdicts, deferred synergy
  CONVENTIONS.md         # this file
  NNN-descriptive-name/
    README.md            # frontmatter + What/Research/How to Run/Investigation Trail/Results
    harness.mjs          # the experiment; exits 0 all-pass / 1 on any failed assertion
    forensic-log.json    # machine-readable evidence (committed)
    fixture/             # hermetic tsconfigs + sources (solution + leaves + optional dep)
    *.bench.mts          # (benchmarks only) Vitest bench + vitest.bench.config.mts
```

## Patterns

- **Hermetic fixtures.** Each spike builds its OWN solution/leaf tsconfigs + sources under
  `fixture/`. NEVER mutate `libs/typecheck-consumer*` or `fixtures/*` -- committed fixtures the plugin
  specs consume; mutating them perturbs `run-typecheck.integration.spec.ts` / the executor specs / the
  Nx graph. Self-contained leaf tsconfigs (inline compilerOptions, or a local `tsconfig.base.json`
  with a `paths` alias for path-mapped deps).
- **Assertion-bearing harnesses.** Every harness ends with a labelled assertion list
  (`[PASS]/[FAIL] id: detail`), a `VERDICT`, and `process.exit(allPass ? 0 : 1)`. By-hand
  expectations are pinned as strict multisets, not loose thresholds; when the compiler contradicts an
  expectation (e.g. interpolated un-invoked signal co-fires NG8117 + NG8109), fix the EXPECTATION and
  record the surprise -- the compiler is the source of truth.
- **Forensic JSON.** Every harness writes `forensic-log.json` (environment, per-leaf data, counters,
  assertions, verdict) alongside the human summary. Committed as evidence.
- **Dedupe identity.** Cross-`Program` union-dedupe relies on `ts.sortAndDeduplicateDiagnostics`,
  which keys on `diagnostic.file.path` (STRING) + start + length + code + messageText -- NOT the
  `SourceFile` object. Aggregate = union raw per-leaf diagnostics -> one `finalize` over the union.
- **Boundary = canonical path-containment.** In/out-of-project is decided by realpath + case-fold
  canonicalization then containment under the project dir (dirname of the solution tsconfig) -- the
  same basis as the diagnostic filter's basePath (D-05/D-06).

## Tools & Libraries

| Tool | Version | Use |
|------|---------|-----|
| `@angular/compiler-cli` | 22.0.4 | `readConfiguration` + `performCompilation` (the engine under test) |
| `typescript` | 6.0.3 | `sortAndDeduplicateDiagnostics`, `sys`, `DiagnosticCategory` |
| `vitest` (`bench`) | 4.1.9 | benchmarking (preferred over hand-rolled timing) |
| `minimatch` | 10.2.5 | Nx named-input glob resolution (spike 005) |
| `nx` CLI | 23.0.1 | `nx show projects --affected` for project-graph edge checks |
