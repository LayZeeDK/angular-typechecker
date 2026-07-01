# Board consensus — v0.0.4 testing strategy (UNANIMOUS, 2 rounds)

Board: 5 constructive lenses (Nx-engineering, Angular-correctness, test-architecture, CI/platform,
product-value) + 3 adversarial (minimalist/YAGNI, failure-modes/fragility, maximalist/completeness),
each Opus, fed a facts-only pack. Round 1 = independent positions + fact-requests. Orchestrator
verified the requested facts (FACTS §A1–A7 in ROUND2-BRIEF.md). Round 2 = converge-or-hold-with-a-fact.

**Round-2 result: 8/8 CONVERGE on every decision; 0 holds; 0 new facts requested.**

## Converged decisions

- **D1 — Substrate.** Generator unit tests use the public in-memory `createTreeWithEmptyWorkspace`.
  Do NOT author the bespoke real-disk `createFsTree`/`flushFsTreeChanges` (no `nx/src/generators/tree`
  deep import, no quarantine, no FsTree drift tripwire). Real-disk reached only at the existing e2e
  tier (`fs`/`execSync` over the tarball). Basis: no per-code/in-process file dependency (the
  generator edits `project.json` only — decision B); Nx's own ratio is 452 in-memory : 1 real-disk;
  the deep import is non-public.
- **D2 — Diagnostic catalog.** Assert all **18** `ExtendedTemplateDiagnosticName` members + the
  baseline TS/NG codes by **exact code + `DiagnosticCategory` + count + one severity-promotion case**,
  against the real compiler over **committed fixtures**, in a **single data-driven `it.each` table
  keyed on the enum members** (introduction-version is a row field, not a file split). Add an
  **enum-vs-table completeness tripwire** (catalog rows === the `ExtendedTemplateDiagnosticName`
  enum) so an Angular release that adds/renames/removes a member fails CI loudly. Any member not
  reproducible by a static fixture is `it.skip` **with a written reason** (the row stays in the
  catalog, so the tripwire stays honest). Batch fixtures per program where practical.
  - Implementation nuance (Angular-correctness lens, verified): **NG8011
    (`controlFlowPreventingContentProjection`) is emitted out-of-band** (no `extended/checks/`
    factory) and is **not promotable** via `extendedDiagnostics`; **NG8021
    (`deferTriggerMisconfiguration`) is** a registered promotable check. So 17 of 18 are promotable;
    assert NG8011's observed category and skip its promotion case with a reason.
  - Verified code map: the 18 members are NG8101–8117 **plus NG8011 and NG8021** (both outside the
    81xx range — a numeric "NG81xx" filter must not be used). NG8110/NG8118 are `ErrorCode`s but are
    NOT configurable extended diagnostics.
- **D3 — No mid-tier executor-vs-workspace tier.** The `context.root`→`tsConfig` resolution is a
  pure two-branch function (`normalize-options.ts`) already covered by `normalize-options.spec.ts`
  (+ the resolution-to-real-compiler seam in `config-resolution.integration.spec.ts`). If a
  `context.root`-relative case is missing from the unit spec, add it there — not a new tier.
- **D4 — Generator e2e folded into `install-e2e`.** Ship `generators.json` + the generator; add an
  **un-wired project** to the `consumer-app` fixture (it is currently pre-wired); run
  `nx g angular-typechecker:typecheck-configuration`, assert `project.json`, then
  `nx run <proj>:angular-typecheck` with **`--skip-nx-cache`**. No new e2e project; no Verdaccio.
- **D5 — CI.** In-plugin generator + catalog + tripwire specs auto-route into the existing 6-cell
  `test` matrix (no `ci.yml` change). Generator e2e rides `install-e2e` (already in the `-p` list).
  Add a **set-equality guard test** asserting the `e2e` job's `-p` list equals the set of `e2e/*`
  projects in the graph (none exists today) — converts the silent-skip landmine into a loud failure.
  Keep the single required `ci` aggregate. No `test`-target split (cold-compile ≈ 0.5s/fixture,
  ~9s/cell parallelized — comfortable).
- **D6 — Scope.** The `typecheck-configuration` generator is in scope (the version-bumping `feat`).
  Testing scope = generator unit (+ schema parity) + the 18-member catalog + completeness tripwire +
  one folded generator e2e + the `-p` guard. **Exclude:** bespoke `createFsTree`, a mid-tier tier,
  Verdaccio, the jscodeshift injection toolkit, Nx cache/`dependsOn`-ordering tests, and
  quiet/errors-only mode tests.

## Two items that are decisions, not board outputs (for the human)

1. **The bespoke FsTree utilities are NOT built under this consensus.** This contradicts the earlier
   directive to bring `createFsTree`/`flushFsTreeChanges` in. All 8 lenses (incl. the maximalist)
   concluded they add no value for a `project.json`-edit generator and that the prior-art FsTree
   helper lived only in Connect's _executor e2e_ (real-workspace edits), not in any generator unit
   test. Requires explicit human ratify-or-override.
2. **Generator shape (decision B) is an assumption, not a discovered fact:** `project.json`-edit-only,
   emits no file, no per-project-type branching. The whole D1/D3/D6 convergence is conditioned on it.
   Requires explicit human confirmation; if the generator must emit a tsconfig or branch per type,
   D1 (FsTree) and D6 (milestone split) re-open.
