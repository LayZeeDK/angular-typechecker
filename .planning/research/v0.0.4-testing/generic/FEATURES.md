# Feature Research

**Domain:** Nx plugin tooling — a `project.json`-editing config generator + an exhaustive Angular/TypeScript compiler-diagnostic test catalog
**Scope:** v0.0.4 ONLY — the `typecheck-configuration` generator (GEN-family) and the extended-diagnostic catalog (CAT/DRIFT/GE2E/GUARD). The existing `angular-typecheck` executor, engine, modes, boundary filtering, cacheable target, and the v0.0.1 test pyramid are SHIPPED and out of scope here.
**Researched:** 2026-07-01
**Confidence:** HIGH
**Builds on:** `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` (ratified 8-lens Opus board). This file is descriptive (feature behaviors by category) and does NOT contradict CONSENSUS.md; where the board already decided, this file cites the decision (D1–D6) rather than re-litigating it. Requirements are already written (`.planning/REQUIREMENTS.md`, GEN-01..06 / CAT-01..05 / DRIFT-01 / GE2E-01..02 / GUARD-01); this is archival.

---

## Feature 1 — `typecheck-configuration` Nx generator

A generator that, given a project name, wires an `angular-typecheck` target into that project's `project.json`. It edits configuration only (`readProjectConfiguration` → mutate → `updateProjectConfiguration` → `formatFiles`); it emits NO files (no `generateFiles`, no `files/` template dir). Verified against installed `@nx/devkit@23.0.1` (`formatFiles`/`readProjectConfiguration`/`updateProjectConfiguration` are public; the in-memory test substrate `createTreeWithEmptyWorkspace` is exported from the public `@nx/devkit/testing` subpath). Prior art: the sandbox's 33-line generator (SANDBOX-TECHNIQUES §1) and Connect's Impl-C generator (CONNECT-TECHNIQUES §2).

### Table Stakes (consumers expect these of any Nx config generator)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `nx g angular-typechecker:typecheck-configuration <project>` adds the `angular-typecheck` target to `project.json` | This is the generator's entire reason to exist; an Nx generator that does not mutate the workspace is broken (GEN-01) | LOW | `readProjectConfiguration` → assign `targets['angular-typecheck']` → `updateProjectConfiguration` → `await formatFiles(tree)`. ~33 lines in the sandbox. Depends on the existing executor id (`angular-typechecker:angular-typecheck`). |
| Positional project arg with interactive prompt | Nx convention: `nx g <gen> my-lib` binds arg 0; otherwise prompt | LOW | `schema.json`: `project` with `"$default": { "$source": "argv", "index": 0 }` + `"x-prompt"`. Connect used `x-dropdown: projects` for an autocompleted picker. |
| Idempotent re-run (no duplicate target, no clobbered config) | Re-running a generator must be safe; a generator that double-adds or wipes user config is a footgun (GEN-04) | LOW–MEDIUM | Two valid contracts seen in prior art: (a) sandbox OVERWRITES `targets.angular-typecheck` wholesale every run — idempotent for same args, but silently replaces a user's customized target; (b) Connect's Impl-C "no-op if target already present" — preserves a customized target byte-for-byte. CONNECT-TECHNIQUES §2b flags the present→preserved case as the load-bearing idempotency test. Decision deferred to the generator phase. |
| Hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` + the published `package.json` `generators` field; included in the tarball `files` set | Nx does not generate the TS interface; without registration `nx g` cannot find the generator; without the `files`/asset glob it does not ship | LOW | Mirror the executor's existing `executors.json` packaging: build target globs `generators.json` + `**/*.d.ts` into `dist`; `package.json` declares `"generators": "./generators.json"`. `factory` is an extensionless path Nx `require()`s. (GEN-05) |
| Schema-parity test (`schema.json` keys === `schema.d.ts` interface) | A drifted schema/interface pair is a silent bug class — the CLI validates against JSON while the code types against the `.d.ts` | LOW | Already an established repo pattern (the executor has a schema-parity spec). (GEN-06) |
| Generator unit tests on the public in-memory `createTreeWithEmptyWorkspace` substrate | Standard Nx generator-testing idiom; fast, no disk, no compiler; both sandbox and Connect used exactly this | LOW | `beforeEach` → `createTreeWithEmptyWorkspace()` + `addProjectConfiguration(...)` seed; run generator; `readProjectConfiguration(...).targets['angular-typecheck']` then `toEqual(...)`. Board D1: do NOT build the bespoke real-disk `createFsTree`/`flushFsTreeChanges`. Pass `skipFormat`-equivalent or accept `formatFiles` running in-memory (Connect passed `skipFormat: true` to avoid coupling assertions to Prettier). (GEN-06) |

### Differentiators (where this generator beats the prior-art baselines)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-project-type `tsConfig` defaulting: application → `tsconfig.app.json`, library → `tsconfig.lib.json`, with explicit `--tsConfig` override | The sandbox hard-coded `tsconfig.lib.json` for ALL types (a v0.0.1-grade default that is wrong for apps); Connect's Impl-C forked app-vs-library but on a broad editor tsconfig. Type-aware defaulting is the concrete value-add of v0.0.4's generator over both priors. (GEN-02) | MEDIUM | Project type comes from `readProjectConfiguration(...).projectType` (`'application'` \| `'library'`). Only a TWO-branch fork (app vs library) — NOT a per-five-type branch (buildable/publishable/local libraries all use `tsconfig.lib.json`; see anti-features). `prod` tsconfigs (`tsconfig.lib.prod.json`) are skipped — they exist for emit, and this tool is no-emit. **Nx workspaces only**; Angular CLI `angular.json` layouts deferred (GEN-FUT-01). |
| Spec-tsconfig (`tsconfig.spec.json`) type-checking when a spec tsconfig exists | Checking unit-test sources is a real gap the executor already supports per-target; the generator can wire it automatically (GEN-03) | MEDIUM | Open shape decision (finalized in the generator phase, tied to GEN-02): single target + `--tsConfig` option, vs. multiple targets (e.g. `angular-typecheck` + `angular-typecheck-spec`), vs. one target with Nx `configurations`. Detect existence via the tree before wiring; do not wire a spec target if no `tsconfig.spec.json` is present. |
| Idempotency that PRESERVES a user-customized target rather than overwriting it | Protects a consumer who hand-edited `tsConfig`/inputs after generation; the sandbox's wholesale-overwrite silently discards that | LOW–MEDIUM | This is the stronger of the two idempotency contracts; pick it if the team values "never clobber user config." The unit test seeds a project with a DIFFERENT custom target value, runs the generator, and asserts the value is unchanged (CONNECT-TECHNIQUES §2b). |

### Anti-Features (commonly reached for; excluded by the board or by the no-emit nature of the tool)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| File emission via `generateFiles` (a `files/` template dir, a generated tsconfig, etc.) | "Generators scaffold files" is the common mental model | This generator only needs to edit `project.json`; emitting files invents a real-disk dependency that drives the whole D1/D3/D6 convergence the other way (a file-emitting generator WOULD justify the bespoke FsTree helper and possibly a milestone split — CONSENSUS.md item #2). The sandbox's `files/src/` dir was empty and never used. | Edit `project.json` only. Real-disk fidelity comes from the folded tarball e2e (GE2E), not from the generator emitting files. |
| Per-five-project-type branching (application / local-lib / buildable-lib / publishable-lib / spec-tsconfig as 5 distinct code paths) | The executor is validated across all five project types, so a reader assumes the generator must branch five ways too | Buildable, publishable, and local (non-buildable) libraries all resolve to the SAME `tsconfig.lib.json` default — the distinction is a packaging concern, not a type-check-input concern. Branching five ways adds dead branches and test combinatorics with zero behavioral difference. Connect's prior art forked only app-vs-library. | A two-branch fork (application vs library) for the `tsConfig` default + a separate spec-tsconfig path gated on file existence. |
| Bespoke real-disk `createFsTree`/`flushFsTreeChanges` test utilities (deep `nx/src/generators/tree` import) | Originally planned as a v0.0.1 deliverable; "test against real disk" feels higher-fidelity | Board D1 (unanimous, incl. maximalist lens): zero value for a `project.json`-edit generator — no per-code in-process file dependency to read back; the deep import is non-public (drift/quarantine risk); Nx's own ratio is 452 in-memory : 1 real-disk; the prior-art FsTree helper lived only in an EXECUTOR e2e, never a generator unit test. | In-memory `createTreeWithEmptyWorkspace` for unit tests; the tarball e2e for real-disk fidelity. Tracked for revival ONLY if a future generator emits files a real compiler must read back (FSTREE-01). |
| `ng add` / `nx add` install schematic, dependency installation, `installPackagesTask` | "I want one command to add the plugin AND wire targets" | Out of scope for v0.0.4 (GEN-FUT-02); the minimal config generator is the version-bumping `feat`, and install schematics are a separate, larger surface. The sandbox generator did NO install/init behavior either. | Document manual install + run the config generator. Defer the install schematic to a later milestone. |
| jscodeshift / AST-mutation toolkit to wire the target | The prior art used jscodeshift heavily for FIXTURE injection | The generator edits structured JSON config, not source ASTs; devkit's `updateProjectConfiguration` is the right tool. jscodeshift here is apparatus without a problem. | `readProjectConfiguration` / `updateProjectConfiguration`. (jscodeshift is also excluded for the catalog — see Feature 2 anti-features.) |
| Verdaccio local registry for the generator e2e | The sandbox e2e published to Verdaccio | Board D4/D6: a second mechanism with known Windows-arm64 `execFileSync` issues; the existing `npm pack` + tmp-install tarball harness already gives publish/install fidelity. | Fold the generator e2e into the existing `angular-typechecker-install-e2e` over the real tarball (GE2E-01/02). |

---

## Feature 2 — Exhaustive extended-diagnostic test catalog

Assert the COMPLETE Angular/TypeScript diagnostic surface the executor must reproduce: all 18 `ExtendedTemplateDiagnosticName` members + the baseline TS/NG codes, by **exact code + `DiagnosticCategory` + count + one severity-promotion case**, against the real `@angular/compiler-cli@22.0.4` over **committed fixtures**, in a **single data-driven `it.each` table keyed on the enum**, with an **enum-vs-table completeness tripwire**. Verified directly against installed Angular 22 source (`node_modules/@angular/compiler-cli/.../extended_template_diagnostic_name.d.ts`): the enum has EXACTLY 18 members, including the two outside the 81xx numeric range — `CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION` (NG8011) and `DEFER_TRIGGER_MISCONFIGURATION` (NG8021) — confirming a numeric "NG81xx" filter must NOT be used (CAT/CONSENSUS D2).

### Table Stakes (what an exhaustive compiler-diagnostic catalog must do)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Exact-code assertion per diagnostic (not just `success === false`) | The prior art only asserted a pass/fail boolean; "this fixture produces NG8115" was documentation, not an assertion. A type-checker's entire value is correctness, so the catalog must assert the actual code (CAT-01, CAT-03) | MEDIUM | Requires a seam that exposes the diagnostic ARRAY (code, category) — the executor returns only `{ success }` today. The core `runTypecheck` already produces the diagnostic set; assert against it directly rather than scraping logger text. This is the upgrade over both priors (SANDBOX §4 caveat). |
| `DiagnosticCategory` assertion per diagnostic | Extended diagnostics are warnings-by-default; a catalog that ignores category cannot prove promotion or default-severity behavior (CAT-01) | LOW | Assert `DiagnosticCategory.Warning` vs `Error` per row alongside the code. |
| Exact-count assertion per fixture | Guards against a fixture that accidentally triggers extra/duplicate diagnostics, or a getter that over-reports (CAT-01) | MEDIUM | Count is per-program/per-fixture; batch fixtures per program where practical (D2) but keep counts deterministic. |
| At least one severity-promotion case | Proves `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"` flips a warning-default diagnostic to an error — the mechanism the executor relies on to make NG8xxx fail CI (CAT-02) | MEDIUM | Prior art's `forceExtendedDiagnosticsAsErrors` helper sets `strictTemplates: true` + `extendedDiagnostics.defaultCategory: 'error'` in the fixture's tsconfig (SANDBOX §5). NG8011 is EXCEPTED — it is emitted out-of-band (no `extended/checks/` factory) and is NOT promotable; assert its observed category and `it.skip` its promotion case WITH a written reason (D2). |
| Baseline TS/NG codes asserted by exact code | TS2322/TS2339 and NG2003/NG2005/NG2007/NG2009/NG1001/NG3003/NG6100/NG8001/NG8002/NG8004 are the non-extended floor the executor must surface (CAT-03) | LOW–MEDIUM | These need no `extendedDiagnostics` promotion (they are errors by default); fixtures are smaller. |
| Real compiler over committed fixtures (not mocked, not generated-at-test-time) | The catalog must prove REAL diagnostics surface, not fabricated `ts.Diagnostic` literals; committed fixtures are deterministic and reviewable | MEDIUM | Board D2: committed fixtures replace the sandbox's `nx generate`-at-test-time + jscodeshift injection. Removes the lock/ready-flag/reference-count fixture lifecycle the sandbox needed. Cold-compile ≈ 0.5s/fixture, ~9s/cell parallelized (D5) — affordable. |

### Differentiators (catalog design choices that beat the prior-art organization)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Single data-driven `it.each` table keyed on the enum (introduction-version is a ROW FIELD, not a per-version file split) | The sandbox split one `executor.angularNN.integration.spec.ts` file per Angular major; a single enum-keyed table is more maintainable, makes the completeness tripwire trivial, and keeps introduction-version as metadata rather than file structure (CAT-04) | MEDIUM | Each row: `{ enumMember, code, category, count, introducedIn, fixture, promotable }`. A row not reproducible by a static fixture under Angular 22.0.4 is `it.skip` WITH a written reason — the row STAYS in the table so the tripwire stays honest (CAT-04). |
| Enum-vs-table completeness tripwire (catalog rows === `ExtendedTemplateDiagnosticName` enum) | A future Angular release that adds/renames/removes a member fails CI LOUDLY instead of silently under-covering — converts an invisible coverage gap into a located failure. This is the catalog's headline differentiator (DRIFT-01) | LOW–MEDIUM | Consume the enum at build/test time (`Object.values(ExtendedTemplateDiagnosticName)`), assert set-equality with the table's covered set. Complements the existing v0.0.3 `tsconfig.drift.json` real→shim assignability gate (a sibling "loud on Angular drift" mechanism). Runs in the `test` (or `typecheck-drift`) job. |
| Catalog doc corrected to the authoritative 18-member set | `research/DIAGNOSTIC-CATALOG.md` currently lists 16 extended entries and a v13→v21 framing; the authoritative enum is 18 members and includes NG8011/NG8021 outside 81xx, with NG8110/NG8118 noted as `ErrorCode`s that are NOT configurable extended diagnostics (CAT-05) | LOW | Documentation correction; prevents a future maintainer re-deriving the wrong set by numeric pattern. |

### Anti-Features (excluded by the board or made unnecessary by committed fixtures)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| jscodeshift error-injection toolkit (`addClassProperty`, `addToComponentImports`, AST decorator rewrites) | The sandbox's `test-fixtures.ts` (1373 lines) injected every diagnostic via jscodeshift AST mutation | Committed static fixtures reproduce the diagnostics deterministically with no AST-mutation apparatus, no `nx generate`-at-test-time, no lock/ready-flag fixture lifecycle, no `tsconfig.base.json` cleanup. The board excluded it outright (D6). Connect's own test plan DEPRECATED static-vs-injection churn in the same direction. | Commit small, reviewable fixture projects; batch per program where practical. |
| Numeric "NG81xx" code filter to enumerate extended diagnostics | The codes mostly live in 8101–8117, so a range filter looks sufficient | NG8011 and NG8021 are extended-diagnostic members OUTSIDE the 81xx range (verified in the installed enum); a numeric filter would silently DROP them. Conversely NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`) and NG8118 are `ErrorCode`s that are NOT configurable extended diagnostics and would be wrongly INCLUDED. | Drive the catalog off the `ExtendedTemplateDiagnosticName` enum membership, never a numeric pattern (D2, CAT-05). |
| Asserting a promotion case for NG8011 | "All 18 are extended diagnostics, so all 18 promote" | NG8011 (`controlFlowPreventingContentProjection`) is emitted out-of-band with no `extended/checks/` factory and is NOT promotable via `extendedDiagnostics`; a promotion assertion would fail or assert a fiction. 17 of 18 are promotable. | Assert NG8011's OBSERVED category; `it.skip` its promotion case with a written reason (D2, CAT-02). |
| Mid-tier executor-vs-workspace test (hand-built `ExecutorContext`) | A reader expects a tier between unit and e2e to prove `context.root` → `tsConfig` resolution | Board D3: that resolution is a pure two-branch function already covered by `normalize-options.spec.ts` + the resolution-to-real-compiler seam in `config-resolution.integration.spec.ts`. A hand-built `ExecutorContext` risks a false-green fiction. | If a `context.root`-relative case is missing, ADD it to the existing unit spec — not a new tier. |
| Runtime-error (NG0xxx) coverage | angular.dev/errors lists many NG0xxx codes a thorough catalog "should" cover | NG0xxx are RUNTIME errors; a static no-emit type-check cannot detect them. Including them is out of scope by construction. | Scope the catalog to COMPILE-TIME diagnostics (TS + NG2xxx/NG3xxx/NG6xxx/NG8xxx) only. |

---

## Feature 3 — Supporting CI / e2e features (folded, no structural change)

| Feature | Category | Why | Complexity | Notes |
|---------|----------|-----|------------|-------|
| Generator e2e folded into `angular-typechecker-install-e2e` | Table stakes | Prove the SHIPPED generator works end-to-end over the real tarball: add an un-wired project to the consumer fixture, `nx g`, assert `project.json`, then `nx run <proj>:angular-typecheck --skip-nx-cache` (clean→success; injected error→failure with the code visible) (GE2E-01/02) | MEDIUM | No new e2e project, no Verdaccio (D4). The consumer fixture is currently pre-wired; add an un-wired project. `--skip-nx-cache` avoids a cache false-green. |
| `-p` set-equality guard test (`e2e` job project list === all `e2e/*` projects in the graph) | Differentiator | Converts a forgotten-`-p` SILENT SKIP into a loud, located CI failure — a self-audit of CI completeness (GUARD-01) | LOW | None exists today; pure addition. Board D5 explicitly called the silent-skip a landmine. |
| In-plugin generator + catalog + tripwire specs auto-route into the existing 6-cell `test` matrix | Table stakes | No `ci.yml` structural change; specs are discovered by the existing Vitest config (D5) | LOW | Keeps the single required `ci` aggregate gate unchanged. No `test`-target split (cold-compile budget is comfortable). |

---

## Feature Dependencies

```
typecheck-configuration generator (GEN-01)
    └──requires──> existing angular-typecheck executor + its executor id (SHIPPED v0.0.1)
    └──requires──> generators.json registration + package.json "generators" field + tarball files glob (GEN-05)

per-project-type tsConfig defaulting (GEN-02)
    └──requires──> readProjectConfiguration().projectType (devkit, SHIPPED API)
    └──enables───> spec-tsconfig wiring (GEN-03)  [shape decided together]

generator unit tests (GEN-06)
    └──requires──> createTreeWithEmptyWorkspace (@nx/devkit/testing, public)
    └──requires──> schema.json + schema.d.ts (GEN-05)  [schema-parity spec]

generator e2e (GE2E-01/02)
    └──requires──> generators.json shipped in the tarball (GEN-05)
    └──requires──> existing install-e2e tarball harness (SHIPPED)
    └──requires──> the executor verdict path (SHIPPED)

diagnostic catalog (CAT-01..03)
    └──requires──> a diagnostic-ARRAY seam (code+category) over the SHIPPED runTypecheck core
    └──requires──> committed fixtures + real @angular/compiler-cli@22.0.4
    └──requires──> forceExtendedDiagnosticsAsErrors-style tsconfig promotion (CAT-02)

completeness tripwire (DRIFT-01)
    └──requires──> the enum-keyed it.each table (CAT-04)
    └──requires──> ExtendedTemplateDiagnosticName enum consumed at test time
    └──enhances──> v0.0.3 tsconfig.drift.json gate (sibling loud-on-drift mechanism)

-p guard test (GUARD-01) ──enhances──> the e2e job + generator e2e (GE2E)

file emission (generateFiles) ──conflicts──> board D1/D3/D6 (no bespoke FsTree, no milestone split)
```

### Dependency Notes

- **GEN-02 must precede GEN-03:** the spec-tsconfig target SHAPE (single target + option vs. multiple targets vs. `configurations`) is finalized jointly with the application-vs-library default decision in the generator phase. They are one design decision, not two.
- **The catalog requires a diagnostic-array seam the executor does not expose today.** The executor returns `{ success }`; the prior art could only assert a boolean. The framework-agnostic `runTypecheck` core already gathers the full diagnostic set, so the catalog asserts against that array directly (code+category+count) rather than scraping logger output. This is the single most load-bearing implementation detail for CAT.
- **DRIFT-01 enhances the v0.0.3 drift gate.** Both make an Angular upgrade fail CI loudly: `tsconfig.drift.json` on the getter-set/error-code encoding, the tripwire on the extended-diagnostic ENUM membership.
- **file emission conflicts with the whole board convergence.** CONSENSUS.md item #2 states D1/D3/D6 are conditioned on the `project.json`-edit-only shape; a file-emitting generator re-opens the FsTree decision (D1) and possibly a milestone split (D6).

## MVP Definition

### Launch With (v0.0.4)

All 15 requirements are in scope this milestone (Phases 12–14). There is no narrower MVP within v0.0.4 — the generator is the version-bumping `feat` and the catalog is the headline testing deliverable.

- [ ] Generator: `project.json`-edit-only, app/library `tsConfig` default + `--tsConfig` override, idempotent, schema + registration + tarball packaging, in-memory unit tests + schema parity (GEN-01..06) — Phase 13
- [ ] Catalog: all 18 enum members + baseline codes by exact code+category+count, one promotion case, single enum-keyed `it.each` table over committed fixtures, doc correction (CAT-01..05) — Phase 12
- [ ] Completeness tripwire (DRIFT-01) — Phase 12
- [ ] Generator e2e folded into install-e2e + `--skip-nx-cache` verdict (GE2E-01/02) — Phase 14
- [ ] `-p` set-equality guard test (GUARD-01) — Phase 14

### Add After Validation (later milestones)

- [ ] Spec-tsconfig multi-target shape, if the single-target+option shape proves limiting (refinement of GEN-03)
- [ ] Bespoke real-disk `createFsTree`/`flushFsTreeChanges` — ONLY if a future generator emits files a real compiler must read back (FSTREE-01)

### Future Consideration (deferred, tracked)

- [ ] Angular CLI (`angular.json`) workspace support via `convertNxGenerator` (GEN-FUT-01)
- [ ] `ng add` / `nx add` install schematics (GEN-FUT-02)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Generator adds `angular-typecheck` target (GEN-01) | HIGH | LOW | P1 |
| Per-project-type `tsConfig` default (GEN-02) | HIGH | MEDIUM | P1 |
| Idempotency (GEN-04) | HIGH | LOW | P1 |
| Schema + registration + packaging (GEN-05) | HIGH | LOW | P1 |
| Generator unit + schema-parity tests (GEN-06) | HIGH | LOW | P1 |
| Spec-tsconfig wiring (GEN-03) | MEDIUM | MEDIUM | P1 |
| Exact code+category+count catalog (CAT-01..03) | HIGH | MEDIUM | P1 |
| Severity-promotion case (CAT-02) | HIGH | MEDIUM | P1 |
| Enum-keyed `it.each` table (CAT-04) | HIGH | MEDIUM | P1 |
| Completeness tripwire (DRIFT-01) | HIGH | LOW | P1 |
| Catalog doc correction (CAT-05) | MEDIUM | LOW | P1 |
| Generator e2e folded into install-e2e (GE2E-01/02) | HIGH | MEDIUM | P1 |
| `-p` set-equality guard (GUARD-01) | MEDIUM | LOW | P1 |

**Priority key:** P1 = must have for v0.0.4 launch. (No P2/P3 in this milestone — all 15 requirements are scoped P1; deferred items live under Future Consideration above.)

## Competitor / Prior-Art Feature Analysis

| Feature | Sandbox prior art | Connect prior art | v0.0.4 approach |
|---------|-------------------|-------------------|-----------------|
| Generator file scope | `project.json`-edit only (empty `files/` never used) | `project.json`-edit only | `project.json`-edit only (GEN-01) — confirms both priors |
| `tsConfig` defaulting | Hard-coded `tsconfig.lib.json` for ALL types | App-vs-library fork on a broad editor tsconfig | App→`tsconfig.app.json`, library→`tsconfig.lib.json`, `--tsConfig` override (GEN-02) — improves on both |
| Idempotency | Wholesale overwrite (idempotent for same args) | No-op if target present (preserves user config) | Decision deferred to generator phase; preserve-customized is the stronger contract (GEN-04) |
| Generator test substrate | `createTreeWithEmptyWorkspace` (in-memory) | `createTreeWithEmptyWorkspace` (in-memory) | Same public in-memory substrate (D1, GEN-06) — no bespoke FsTree |
| Diagnostic assertion granularity | `success === false` boolean only | boolean + per-phase getter assertions (mocked) | Exact code + category + count over real compiler (CAT-01) — beyond both priors |
| Catalog organization | One file per Angular major | Per-phase injectors | Single enum-keyed `it.each` table + completeness tripwire (CAT-04/DRIFT-01) |
| Error injection | jscodeshift AST mutation + `nx generate` at test time | jscodeshift / temp-dir / static-fixture spectrum | Committed static fixtures (D6) — excludes jscodeshift |
| e2e registry | Verdaccio publish/install | tarball install | Folded into existing `npm pack` tarball install-e2e (D4) — no Verdaccio |

## Sources

- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` (D1–D6, NG8011/NG8021 nuance) — HIGH (ratified 8-lens board)
- `.planning/PROJECT.md` Current Milestone + `.planning/REQUIREMENTS.md` (GEN/CAT/DRIFT/GE2E/GUARD-01..) — HIGH
- `.planning/research/v0.0.4-testing/SANDBOX-TECHNIQUES.md` §1–9 (generator shape, schema, in-memory test, per-version catalog, jscodeshift, packaging, Verdaccio e2e) — HIGH (verbatim prior-art extraction)
- `.planning/research/v0.0.4-testing/CONNECT-TECHNIQUES.md` §2–7 (app-vs-library fork, idempotency-preservation, in-memory tree, mode/filter gaps) — HIGH (sanitized prior-art extraction)
- `.planning/research/DIAGNOSTIC-CATALOG.md` (baseline + extended code map, introduction-version provenance) — MEDIUM (16-entry framing; superseded by the 18-member enum below; correction is CAT-05)
- Installed `node_modules/@angular/compiler-cli@22.0.4/.../extended_template_diagnostic_name.d.ts` — HIGH (direct: enum has EXACTLY 18 members incl. NG8011 + NG8021 outside 81xx)
- Installed `@nx/devkit@23.0.1` (`formatFiles`/`readProjectConfiguration`/`updateProjectConfiguration` public; `@nx/devkit/testing` → `createTreeWithEmptyWorkspace` export map in `package.json`) — HIGH (direct)

---
*Feature research for: Nx config generator + exhaustive compiler-diagnostic catalog (v0.0.4-scoped)*
*Researched: 2026-07-01*
*Builds on and does not contradict `board2/CONSENSUS.md`.*
