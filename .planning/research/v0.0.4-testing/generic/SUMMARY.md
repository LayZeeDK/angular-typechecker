# Project Research Summary

**Project:** angular-typechecker
**Domain:** Nx 23 plugin — adding a `project.json`-editing config generator + an exhaustive Angular/TypeScript compiler-diagnostic test catalog (v0.0.4)
**Researched:** 2026-07-01
**Confidence:** HIGH

> **v0.0.4-SCOPED + ARCHIVAL.** This summary synthesizes the four generic researcher outputs
> (STACK / FEATURES / ARCHITECTURE / PITFALLS) for the v0.0.4 milestone ONLY. It post-dates and
> builds on the unanimous 8-lens Opus board (`.planning/research/v0.0.4-testing/board2/CONSENSUS.md`,
> D1–D6) and the already-defined requirements + roadmap. REQUIREMENTS.md (GEN-01..06, CAT-01..05,
> DRIFT-01, GE2E-01/02, GUARD-01) and ROADMAP.md (Phases 12–14) ALREADY EXIST. This document does
> not re-derive the strategy; it confirms versions/APIs, consolidates the failure modes, and — in
> the REQUIRED final section — states for every requirement and phase whether the research CONFIRMS,
> ENRICHES, or CHANGES it. It does NOT contradict CONSENSUS.md; any apparent tension is surfaced
> explicitly with a citation. The roadmap is already cut, so the "Implications for Roadmap" section
> is a consistency check, not a proposal.

## Executive Summary

v0.0.4 is a SUBSEQUENT-milestone extension of a shipped Nx plugin, not a greenfield build. It adds
exactly two new feature surfaces to the existing `angular-typechecker` plugin: (1) a
`typecheck-configuration` Nx generator that wires an `angular-typecheck` target into a project's
`project.json` (config-edit only — `readProjectConfiguration` → mutate → `updateProjectConfiguration`
→ `formatFiles`; NO file emission), and (2) an exhaustive extended-diagnostic test catalog that
asserts all 18 `ExtendedTemplateDiagnosticName` members plus the baseline TS/NG codes by exact
code + `DiagnosticCategory` + count against the real `@angular/compiler-cli@22.0.4` over committed
fixtures, guarded by an enum-vs-table completeness tripwire. The supporting work (a generator e2e
folded into the existing `install-e2e` harness and a CI `-p` set-equality guard) adds rows, not
tiers, and requires NO structural `ci.yml` change.

The single most important stack finding is that **nothing new must be installed** — runtime, dev, or
peer. The generator binds to the already-pinned `@nx/devkit@23.0.1` dependency; the generator-test
substrate (`createTreeWithEmptyWorkspace`) is the `@nx/devkit/testing` subpath of that same
dependency; and the catalog/tripwire consume the already-present peer `@angular/compiler-cli@22.0.4`
(the 18-member enum + `ErrorCode` map). The concrete "stack add" is therefore configuration and
source — a `generators.json` file, a `"generators"` field in `package.json`, one build-asset glob, a
`files` allowlist entry, and committed fixtures — not packages. The architecture is a clean addition:
the generator is a THIRD devkit-aware surface (sibling to `executors/`) that never touches the pure
core engine, and the catalog is a third row-set inside the existing integration tier.

The dominant risk for a type-checking tool is the **false green** — a passing gate while the checker
is silently not checking. Every critical pitfall is a variant of it: an `81xx` numeric filter that
silently drops NG8011/NG8021, coarse `success`-only assertions that pass when the wrong diagnostic
fires, an undetected coverage gap when Angular adds a 19th member, a forgotten CI `-p` entry that
makes a new e2e project invisible, a cached-green post-generate run, and a generator that wires a
`tsConfig` with `strictTemplates` off (silently disabling the entire extended-diagnostic surface).
The mitigations are exactly the board-ratified mechanisms already encoded in the requirements:
enum-keyed catalog + completeness tripwire (DRIFT-01), exact code+category+count assertions (CAT-01),
the `-p` set-equality guard (GUARD-01), `--skip-nx-cache` on the post-generate run (GE2E-02), and an
end-to-end run that proves a real NG diagnostic surfaces (GE2E-02). The research adds no new
requirement and contradicts no ratified decision.

## Key Findings

### Recommended Stack

The stack is "no install." See `.planning/research/v0.0.4-testing/generic/STACK.md`. Every API the
generator and the extended tests need was verified against the INSTALLED `nx@23.0.1` /
`@nx/devkit@23.0.1` this session, and registry dist-tags were re-checked 2026-07-01. `@nx/devkit`
stays a pinned `dependency` (also the Nx registry-listing requirement) — do NOT bump it or move it to
a peer "because it's now also a generator dep." The single concrete add is the `generators.json`
registration + the `package.json` `"generators"` field + the build/`files` wiring, mirroring the
existing `executors.json` setup exactly.

**Core technologies (all already present):**

- `@nx/devkit@23.0.1` (already a pinned `dependency`): generator-authoring API
  (`readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`/`Tree`) — the generator
  reuses the SAME devkit the executor depends on; zero new runtime deps.
- `@nx/devkit/testing` (subpath of the same dependency): `createTreeWithEmptyWorkspace()` — the
  public in-memory Tree substrate for generator unit tests; test-only at use-time, never ships.
- `@angular/compiler-cli@22.0.4` (already a peer + devDep): source of the 18-member
  `ExtendedTemplateDiagnosticName` enum + `ErrorCode` map for the catalog and the tripwire; ESM-only,
  so reached via `await import()`. Stable only — never `next`/`rc`.
- `typescript@6.0.3` + `vitest@~4.1.0` (already installed): `ts.DiagnosticCategory` for the catalog's
  category assertions; the runner the new specs auto-route into (the existing 6-cell matrix).

### Expected Features

See `.planning/research/v0.0.4-testing/generic/FEATURES.md`. All 15 requirements are in scope this
milestone; there is no narrower MVP within v0.0.4 (the generator is the version-bumping `feat`, the
catalog is the headline testing deliverable). Both new features are descriptive elaborations of
already-written requirements.

**Must have (table stakes):**

- `nx g angular-typechecker:typecheck-configuration <project>` adds the `angular-typecheck` target to
  `project.json`, idempotently, with a positional project arg (GEN-01, GEN-04).
- Hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` + the package
  `"generators"` field, shipped in `files`, gated by a schema-parity spec; generator unit tests on
  the in-memory substrate (GEN-05, GEN-06).
- Exact code + `DiagnosticCategory` + count per diagnostic over the REAL compiler on committed
  fixtures, including the baseline TS/NG floor and one severity-promotion case (CAT-01, CAT-02, CAT-03).
- Generator e2e folded into `install-e2e` (`nx g` → assert `project.json` → run the target with
  `--skip-nx-cache`), and in-plugin specs auto-routing into the existing matrix (GE2E-01/02).

**Should have (competitive / the value-add over the prior art):**

- Per-project-type `tsConfig` defaulting (app → `tsconfig.app.json`, library → `tsconfig.lib.json`,
  `--tsConfig` override) — a TWO-branch fork, not a per-five-type branch; spec-tsconfig wiring gated
  on file existence (GEN-02, GEN-03). This is the concrete improvement over both prior arts (sandbox
  hard-coded `tsconfig.lib.json`; Connect forked app-vs-lib on a broad editor tsconfig).
- Single enum-keyed `it.each` table + the enum-vs-table completeness tripwire (CAT-04, DRIFT-01) — the
  headline differentiator: a future Angular member add/rename/remove fails CI loudly.
- `-p` set-equality guard (GUARD-01) — the board's "single highest-leverage test in the milestone";
  converts a silent CI skip into a loud, located failure.

**Defer (tracked, later milestones):**

- Bespoke real-disk `createFsTree`/`flushFsTreeChanges` — only if a future generator emits files a
  compiler reads back (FSTREE-01).
- Angular CLI (`angular.json`) workspace support via `convertNxGenerator` (GEN-FUT-01); `ng add` /
  `nx add` install schematics (GEN-FUT-02); file emission via `generateFiles`.

### Architecture Approach

See `.planning/research/v0.0.4-testing/generic/ARCHITECTURE.md`. The plugin gains a SECOND
devkit-aware surface (the generator) alongside the existing executor, and a THIRD row-set inside the
already-present integration tier (the enum-keyed catalog + tripwire). Nothing in the core engine
changes; the generator consumes only `@nx/devkit` config APIs and references the executor by its
published string id (`angular-typechecker:angular-typecheck`). The build order is consistent with the
ratified roadmap: Phase 12 (catalog, independent) before/with Phase 13 (generator, independent),
Phase 14 (generator e2e + guard) after Phase 13.

**Major components:**

1. `generators.json` + `src/generators/typecheck-configuration/` (generator.ts + schema.{json,d.ts} +
   specs) — NEW devkit-aware surface, sibling to `executors/`; config-edit-only on the in-memory Tree.
2. `extended-catalog.integration.spec.ts` + `fixtures/extended-catalog/` + the completeness tripwire
   — NEW single enum-keyed `it.each` table over committed fixtures, supersedes the partial v13 split.
3. Folded generator e2e in `install-e2e` (un-wired project added to the consumer fixture) + the `-p`
   set-equality guard spec (in the `test` tier) — NEW specs, NO new e2e project, NO `ci.yml` change.

### Critical Pitfalls

Top 5 from `.planning/research/v0.0.4-testing/generic/PITFALLS.md` (all false-green variants):

1. **`81xx` numeric filter silently drops NG8011 + NG8021** — key the catalog on enum membership
   (`Object.values(ExtendedTemplateDiagnosticName)`), never a numeric pattern; assert each by exact
   `code` via the `NG()` helper (CAT-01/04/05, Phase 12).
2. **Coarse `success`/boolean assertions** (the prior art's sin) — assert exact code +
   `DiagnosticCategory` + count per row; `runTypecheck` already returns `result.diagnostics` so no new
   seam is needed (CAT-01/03, Phase 12).
3. **Coverage drift undetected when Angular changes the enum** — the enum-vs-table completeness
   tripwire imports the live enum and asserts NAME-set equality, in the `test` job so a peer bump
   fails it (DRIFT-01, Phase 12).
4. **`-p` silent-skip landmine** — do NOT create a new e2e project; fold into `install-e2e` (already
   listed) AND add the GUARD-01 set-equality test (GE2E-01 + GUARD-01, Phase 14).
5. **Generator wires `strictTemplates`-off / wrong-type `tsConfig`** — the in-memory unit test only
   proves the written shape; the generator e2e must RUN the generated target and assert a real NG
   diagnostic surfaces; validate per-type defaults against real generated projects (GEN-02/03 +
   GE2E-02, Phases 13 + 14). Also: NG8011 is NOT promotable (out-of-band) — assert its observed
   category and `it.skip` its promotion case with a reason; cached-green requires `--skip-nx-cache`.

## Implications for Roadmap

The roadmap is ALREADY cut (Phases 12–14) and the research is fully consistent with it. This section
is a consistency check, not a proposal.

### Phase 12: Extended-diagnostic catalog + completeness tripwire

**Rationale:** Pure test/fixture work on the SHIPPED engine; independent of the generator; de-risks
the diagnostic-vocabulary facts the rest of the milestone leans on. Build first OR in parallel with 13.
**Delivers:** the single enum-keyed `it.each` catalog (18 members + baseline TS/NG codes by exact
code+category+count + one promotion case), committed `fixtures/extended-catalog/` triples, the
enum-vs-table tripwire, the corrected `DIAGNOSTIC-CATALOG.md`. Auto-routes into the `test` matrix.
**Addresses:** CAT-01..05, DRIFT-01.
**Avoids:** Pitfalls 1–5, 12 (numeric filter, coarse assertions, NG8011 promotion, fixture rot,
coverage drift, cold-compile cost via per-program batching).

### Phase 13: typecheck-configuration generator

**Rationale:** The version-bumping `feat`; independent of Phase 12 (different surfaces). Coordinate the
`package.json`/`project.json` edits if Phases 12 and 13 run as concurrent worktrees.
**Delivers:** the registered, tested, shipped generator + `schema.{json,d.ts}` + `generators.json` +
the `package.json`/`project.json` plumbing + in-memory `generator.spec.ts` + schema-parity spec.
**Uses:** `@nx/devkit` config utils + `@nx/devkit/testing` `createTreeWithEmptyWorkspace` (no new dep).
**Implements:** the dual-devkit-surface pattern (generator sibling to executor, shared marker convention).
**Avoids:** Pitfalls 8–11, 13 (broken generator/executor contract, unregistered/unpackaged generator,
non-idempotent re-run, `/virtual` leakage / open-handle hang, internal-import FsTree fragility).

### Phase 14: Generator e2e + CI self-audit guard

**Rationale:** MUST follow Phase 13 (needs the shipped generator + `generators.json` + the
`"generators"` field in the tarball).
**Delivers:** the un-wired project in the `install-e2e` consumer fixture, `generator.int.spec.ts`
folding `nx g` → assert `project.json` → run target into `install-e2e`, the `-p` set-equality guard
spec (in the `test` tier), and the `tarball-audit` file-set update expecting `generators.json`.
**Avoids:** Pitfalls 6, 7, 9 (the `-p` silent-skip landmine, cached-green, install-time resolution).

### Phase Ordering Rationale

- 12 before/with 13: the catalog is independent and de-risks the diagnostic facts; both "depend on
  nothing within v0.0.4" per the roadmap.
- 13 before 14: the e2e and the shipped tarball require the registered generator + `generators.json` +
  the `"generators"` field.
- The `-p` guard rides Phase 14 because that is when a new-e2e temptation is highest — the consensus
  chose to FOLD rather than add a project precisely so the guard never has to learn a new name.
- No `ci.yml` structural change in any phase; the only CI artifact touched is the NEW guard SPEC,
  which runs inside the existing `test` job.

### Research Flags

Phases likely needing deeper research/discussion during planning:

- **Phase 13:** the per-project-type `tsConfig` defaulting + spec-tsconfig wiring SHAPE is an explicit
  open generator-phase design decision (single target + `--tsConfig` option vs. multiple targets vs.
  Nx `configurations`) AND the type-detection method (GEN-02/GEN-03 are one joint decision). The
  idempotency contract (skip-if-present vs. update-cleanly, preserving a user-customized target) is
  the other open choice (GEN-04). Both are flagged in REQUIREMENTS/ROADMAP as resolved-in-phase.
- **Phase 12:** the ACTUAL observed default category of NG8011/NG8021 must be discovered empirically
  against the real compiler at implementation time (the board flagged it as the biggest unverified
  fact); it is a verification detail, not a scope change.

Phases with standard patterns (skip research-phase):

- **Phase 14:** folds into a known harness; the `-p` guard is pure `fs` + YAML/graph parse — no novel
  research needed.
- The generator PACKAGING in **Phase 13** mirrors the proven `executors.json` plumbing exactly.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                       |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Every API verified against the INSTALLED `nx@23.0.1`/`@nx/devkit@23.0.1` this session; registry dist-tags re-checked 2026-07-01; no new deps required.                                      |
| Features     | HIGH       | Both features are descriptive elaborations of already-written, board-ratified requirements; verified against the installed Angular 22.0.4 enum (exactly 18 members).                        |
| Architecture | HIGH       | Read direct from tracked source (`executors.json`/`project.json`/`package.json`/`ci.yml`/the e2e harness + fixture); Nx authoring/testing APIs verified against the installed runtime.      |
| Pitfalls     | HIGH       | Consolidated from the unanimous 8-lens board (chiefly the failure-modes + Angular-correctness lenses) and verified against `@angular/compiler-cli@22.0.4` + the repo's CI/fixtures/harness. |

**Overall confidence:** HIGH

### Gaps to Address

- **NG8011/NG8021 observed default category:** not assumed; discover empirically against the real
  compiler during Phase 12 implementation. Drives the NG8011 promotion-skip and the per-row category
  assertions. (Verification detail; no requirement edit.)
- **Generator shape (GEN-02/03) and idempotency contract (GEN-04):** open generator-phase decisions,
  already flagged as resolved-in-phase by REQUIREMENTS/ROADMAP. The whole D1/D3/D6 board convergence
  is CONDITIONED on the generator staying `project.json`-edit-only (CONSENSUS.md item #2); if the
  generator must EMIT a file or branch per type, D1 (FsTree / FSTREE-01) and D6 (milestone split)
  re-open — but the research assumes (and the requirements lock) the edit-only shape.
- **`nx g` resolution from a tarball install:** the `install-e2e` harness was built for `nx run`; that
  `nx generate` resolves from the installed tarball is to be PROVEN in GE2E-01, not assumed.

## Requirement impact assessment

For each of the 15 requirements and the 3-phase roadmap, the verdict is CONFIRMS, ENRICHES, or
CHANGES. The research was conservative: it explicitly builds on CONSENSUS.md and contradicts nothing.
**No finding rises to CHANGES.**

### Generator (GEN)

| Requirement                                     | Verdict      | Basis                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GEN-01 (config-edit-only generator)             | **CONFIRMS** | STACK verified `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles` are public in the installed `@nx/devkit@23.0.1` and the generator imports ONLY `@nx/devkit` (already a dependency). ARCHITECTURE Pattern 2 + FEATURES Feature 1 restate the edit-only contract. No file emission, consistent with CONSENSUS D1/D6.                                                                                         |
| GEN-02 (per-type `tsConfig` default + override) | **ENRICHES** | FEATURES + PITFALLS 8 add the implementation detail that this is a TWO-branch fork (app vs library) read from `readProjectConfiguration().projectType` — NOT a per-five-type branch (buildable/publishable/local libs all resolve to `tsconfig.lib.json`) — and that prod tsconfigs are skipped because they are emit-on. No scope change; the requirement already states app→`tsconfig.app.json`, library→`tsconfig.lib.json`. |
| GEN-03 (spec-tsconfig wiring)                   | **ENRICHES** | FEATURES adds "detect existence via the tree before wiring; do not wire a spec target if no `tsconfig.spec.json` is present" and confirms the shape is decided JOINTLY with GEN-02 in the generator phase. Detail only; the open shape decision is already noted in the requirement.                                                                                                                                            |
| GEN-04 (idempotent re-run)                      | **ENRICHES** | FEATURES + PITFALLS 10 surface the two valid contracts (wholesale-overwrite vs. preserve-customized) and add the load-bearing test: seed a project with a DIFFERENT custom target value, run, assert unchanged/per-contract — never duplicated/half-merged. The requirement already defers the contract choice to the phase; this enriches the verification.                                                                    |
| GEN-05 (schema + registration + packaging)      | **ENRICHES** | STACK + ARCHITECTURE + PITFALLS 9 add the precise four-link checklist (`generators.json` entry + `"generators"` field + build-asset glob mirroring `executors.json` + `files` allowlist) and that `tarball-audit`/`package-manifest` specs should assert `generators.json` in the tarball. Packaging detail; no scope change.                                                                                                   |
| GEN-06 (in-memory unit tests + schema parity)   | **ENRICHES** | STACK confirms `createTreeWithEmptyWorkspace` resolves to an `FsTree` rooted at `/virtual` with `nx.json` + `.prettierrc` seeded. PITFALLS 11 adds two hazard mitigations (the `mock-project-graph` first-import idiom for `/virtual` leakage; `NX_DAEMON:false` + `testTimeout` for the open-handle hang) and the `skipFormat:true`-in-tests guidance. Implementation/verification detail; consistent with CONSENSUS D1.       |

### Diagnostic catalog (CAT) + tripwire (DRIFT)

| Requirement                                                                 | Verdict      | Basis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-01 (18 members by exact code+category+count)                            | **ENRICHES** | FEATURES + PITFALLS 3 add the load-bearing implementation detail that `runTypecheck` ALREADY returns `result.diagnostics` (code + `.category` + count), so the catalog asserts against that array directly — NO new seam, no logger scraping. ARCHITECTURE's data-flow restates it. The board (D2) and the requirement already mandate exact code+category+count; this confirms the seam exists and enriches HOW.                                                                                                      |
| CAT-02 (severity-promotion case; NG8011 excepted)                           | **CONFIRMS** | PITFALLS 2 + STACK + FEATURES + ARCHITECTURE all confirm NG8011 is out-of-band / not promotable (assert observed category, `it.skip` promotion with a reason) and that NG8021 IS a registered promotable check — exactly CONSENSUS D2's nuance and the requirement's parenthetical. Note: PITFALLS adds that each row's ACTUAL default category should be discovered empirically rather than assumed WARNING — this is a verification practice, not a requirement change (CAT-02 says "assert its observed category"). |
| CAT-03 (baseline TS/NG codes by exact code)                                 | **CONFIRMS** | FEATURES lists the same baseline set; PITFALLS confirms these are errors-by-default (no `extendedDiagnostics` promotion needed) and asserted by exact code. Matches the requirement's enumerated list verbatim.                                                                                                                                                                                                                                                                                                        |
| CAT-04 (single enum-keyed `it.each` table; `it.skip`-with-reason rows stay) | **CONFIRMS** | All four files confirm the single enum-keyed table with introduction-version as a row field, and that un-reproducible members stay as `it.skip`-with-reason so the tripwire stays honest. Directly restates CONSENSUS D2 and the requirement.                                                                                                                                                                                                                                                                          |
| CAT-05 (correct DIAGNOSTIC-CATALOG.md to 18 members)                        | **CONFIRMS** | FEATURES + PITFALLS + STACK verify against the INSTALLED `extended_template_diagnostic_name.d.ts` that the enum has EXACTLY 18 members incl. NG8011/NG8021 outside 81xx, with NG8110/NG8118 as non-configurable `ErrorCode`s — exactly the correction CAT-05 prescribes. FEATURES notes the current doc lists 16, which is precisely the gap the requirement closes.                                                                                                                                                   |
| DRIFT-01 (enum-vs-table completeness tripwire)                              | **CONFIRMS** | PITFALLS 5 + ARCHITECTURE Pattern 3 + FEATURES confirm the enum-imported-at-test-time, NAME-set-equality tripwire running in `test`, complementing the v0.0.3 `tsconfig.drift.json` gate — exactly the requirement and CONSENSUS D2. ENRICHES detail: the enum must be reached via `await import()` (ESM); if it is type-only at runtime, fall back to the shipped `.d.ts` member list (a `schema-parity`-style encoding).                                                                                             |

### Generator e2e (GE2E) + CI guard (GUARD)

| Requirement                                                                                         | Verdict      | Basis                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GE2E-01 (ship `generators.json`; un-wired project; `nx g` → assert `project.json`)                  | **ENRICHES** | ARCHITECTURE + PITFALLS 9 add that the `install-e2e` harness was built for `nx run`, so `nx g` resolving from the installed TARBALL is an UNPROVEN assumption the scenario must actually prove (not just assert files exist). Verification detail; no scope change.                                                                                                                                                              |
| GE2E-02 (run target `--skip-nx-cache`; clean → success, injected error → failure with code visible) | **ENRICHES** | PITFALLS 7 + 8 add the WHY: `--skip-nx-cache` prevents a cached-green false pass, and the run-the-target step is what catches a generator that wired `strictTemplates`-off (a catastrophic silent regression the in-memory unit test cannot catch). Assert the code/sentinel is visible in output, not just a non-zero exit. Strengthens the verification; the requirement already mandates `--skip-nx-cache` + both directions. |
| GUARD-01 (`-p` set-equality guard)                                                                  | **CONFIRMS** | PITFALLS 6 + ARCHITECTURE + FEATURES confirm the set-equality guard (parse `ci.yml` `-p` list + glob `e2e/*` project names, predicate quantifier `every`) as the board's "single highest-leverage test." ENRICHES detail: prefer pure `fs` + YAML/graph parse over shelling `nx show projects` for speed/cross-platform under `NX_DAEMON:false`. Matches the requirement exactly.                                                |

### Roadmap (Phases 12–14)

| Item                                              | Verdict      | Basis                                                                                                                                                                                               |
| ------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 12 (catalog + tripwire; independent)        | **CONFIRMS** | ARCHITECTURE's "Suggested Build Order" and PITFALLS' phase mapping place CAT-01..05 + DRIFT-01 in Phase 12, independent of the generator, buildable first or in parallel. Matches ROADMAP verbatim. |
| Phase 13 (generator; independent, parallel to 12) | **CONFIRMS** | Same sources map GEN-01..06 to Phase 13, parallel to Phase 12, with the caveat to coordinate the shared `package.json`/`project.json` edits if run as concurrent worktrees. Matches ROADMAP.        |
| Phase 14 (generator e2e + guard; depends on 13)   | **CONFIRMS** | GE2E-01/02 + GUARD-01 mapped to Phase 14, after Phase 13 (needs the shipped generator + `generators.json` + `"generators"` field). No `ci.yml` structural change. Matches ROADMAP.                  |

### Items the research EXCLUDES (consistent with REQUIREMENTS Out of Scope / Future)

The research re-affirms — and provides additional pitfall rationale for — every exclusion already in
REQUIREMENTS.md: bespoke `createFsTree` (FSTREE-01; internal-import fragility, PITFALLS 13), the
mid-tier executor-vs-workspace tier (CONSENSUS D3; false-green-fiction risk), Verdaccio (Windows-arm64
`execFileSync` breakage), the jscodeshift injection toolkit (committed fixtures suffice), Nx
cache/`dependsOn` tests, and quiet/errors-only mode tests. None of these is reopened. **No CHANGES.**

## Sources

### Primary (HIGH confidence)

- `.planning/research/v0.0.4-testing/generic/STACK.md` — no-new-deps finding; verified `@nx/devkit@23.0.1` + `@nx/devkit/testing` APIs against the installed runtime; `generators.json`/`package.json` wiring conventions.
- `.planning/research/v0.0.4-testing/generic/FEATURES.md` — generator table-stakes/differentiators/anti-features; the 18-member catalog design; prior-art comparison; feature dependencies + MVP.
- `.planning/research/v0.0.4-testing/generic/ARCHITECTURE.md` — dual-devkit-surface integration; in-memory Tree pattern; enum-keyed catalog pattern; data flows; suggested build order (Phases 12–14).
- `.planning/research/v0.0.4-testing/generic/PITFALLS.md` — 13 pitfalls (false-green variants), tech-debt patterns, integration gotchas, looks-done-but-isn't checklist, pitfall-to-phase mapping.
- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` — the ratified 8-lens board strategy (D1–D6) all four files build on.
- `.planning/REQUIREMENTS.md` (GEN/CAT/DRIFT/GE2E/GUARD) + `.planning/ROADMAP.md` (Phases 12–14) — the already-defined requirements + roadmap this summary assesses against.
- Installed `@angular/compiler-cli@22.0.4` (`extended_template_diagnostic_name.d.ts` — exactly 18 members incl. NG8011/NG8021 outside 81xx) and installed `nx@23.0.1`/`@nx/devkit@23.0.1` — verified this session.

### Secondary (MEDIUM confidence)

- `.planning/research/DIAGNOSTIC-CATALOG.md` — the 16-entry framing superseded by the authoritative 18-member enum (the correction is CAT-05).

---

_Research completed: 2026-07-01_
_Ready for roadmap: requirements + roadmap already exist; this is an archival, consistency-checking synthesis_
