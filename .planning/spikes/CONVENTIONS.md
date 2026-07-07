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
- **NG-code decoding.** Angular encodes `ts.Diagnostic.code` as `-(990000 + ngNumber)` -- NG8002 =
  `-998002`, NG3004 = `-993004`. Recover with `ngNumber = -code - 990000` (valid when
  `code < 0 && 990000 < -code < 1000000`). Extended diagnostics are NG81xx (+ NG8011/8021), core
  template errors NG80xx. Used to assert NG8xxx firing without hardcoding raw codes (spikes 007/008).
- **Forced peer-conflicting dep -> isolated scratchpad scaffold (user-chosen).** When a spike needs
  a dependency whose peer range excludes the official stack (e.g. `@storybook/angular@10.4.6` caps
  Angular <22 / TS ^4.9||^5), install it the way a consumer must (`--legacy-peer-deps`/`--force`,
  capturing the ERESOLVE first as evidence) in a THROWAWAY npm scaffold under the session scratchpad
  -- NOT the dev repo's `node_modules`/`package.json`. Pin the exact official stack in the scaffold
  `package.json`. Run the harness FROM the scaffold (so the forced dep + pinned toolchain resolve),
  then COMMIT the record only -- `package.json` + `fixture/` + `harness.mjs` + `forensic-log.json` --
  and document the `npm install` reproduction; the scaffold `node_modules` is never committed
  (spike 007).
- **Diagnostic-driven detection reads PUBLIC diagnostic fields only.** To classify or detect a
  situation from compiler output, key on `diagnostic.code` + the module specifier recovered from
  `ts.flattenDiagnosticMessageText(d.messageText, '\n')` (e.g. `/Cannot find module '([^']+)'/` for
  TS2307). No ngtsc/component-registry internals, no framework/`.storybook` coupling. A `?` in a
  module specifier is a bundler (Vite/webpack) query -- TS/Node specifiers never contain `?` -- a
  builder-agnostic signal (spikes 009/010). Advisories built this way are self-gating: they key on
  the PRESENCE of the unresolved diagnostic, so they fall silent once the consumer resolves it.
- **Reuse a prior spike's committed fixture** via a relative path (`join(HERE, '..', 'NNN-*', 'fixture')`)
  rather than duplicating sources, when the new question is a different lens on the same inputs
  (spike 010 reused 009's fixture).

## Tools & Libraries

| Tool | Version | Use |
|------|---------|-----|
| `@angular/compiler-cli` | 22.0.4 | `readConfiguration` + `performCompilation` (the engine under test) |
| `typescript` | 6.0.3 | `sortAndDeduplicateDiagnostics`, `sys`, `DiagnosticCategory` |
| `vitest` (`bench`) | 4.1.9 | benchmarking (preferred over hand-rolled timing) |
| `minimatch` | 10.2.5 | Nx named-input glob resolution (spike 005) |
| `nx` CLI | 23.0.1 | `nx show projects --affected` for project-graph edge checks |
| `vite` (`vite/client`) | 8.1.0 | ambient wildcard module decls for Vite `?query` imports (`*?raw`/`*?url`/`*?worker`/`*?inline`), the consumer-side fix (spike 009) |
