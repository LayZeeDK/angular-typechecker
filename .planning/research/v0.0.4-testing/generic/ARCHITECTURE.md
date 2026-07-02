# Architecture Research

**Domain:** v0.0.4 integration architecture -- the `typecheck-configuration` Nx generator + extended-diagnostic testing stack folding into the existing `angular-typechecker` plugin
**Researched:** 2026-07-01
**Confidence:** HIGH (read direct from tracked source: `executors.json`, `project.json`, `package.json`, `ci.yml`, the install-e2e harness + fixture; Nx API facts verified against the installed `nx@23.0.1` in `CURRENT-AUDIT-AND-GENERATOR.md` / `NX-FSTREE-INTERNALS.md`)

> **Scope note.** This is a SUBSEQUENT-milestone integration study, not a greenfield architecture. It builds ON the ratified strategy in `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` (8/8 unanimous board) and does NOT re-derive the existing core/adapter engine (mapped in `.planning/codebase/ARCHITECTURE.md`). The CONSENSUS hard constraints are load-bearing here: NO bespoke `createFsTree` (in-memory `createTreeWithEmptyWorkspace` only), generator e2e FOLDED into `install-e2e` (no new e2e project, no Verdaccio), and NO structural `ci.yml` change. Where this document and CONSENSUS.md disagree, CONSENSUS.md wins.

## Standard Architecture

### System Overview

The plugin gains a SECOND devkit-aware surface (the generator) alongside the existing executor, and a THIRD test tier inside the already-present integration tier (the enum-keyed catalog + tripwire). Nothing in the core engine changes. ASCII tree convention: `|` vertical, `|--` tee, `'--` corner.

```
PUBLISHED PLUGIN  packages/angular-typechecker/
|
|-- package.json        "executors": "./executors.json"   (existing)
|                       "generators": "./generators.json"  [NEW field]
|                       files: [+ "generators.json"]        [MODIFIED allowlist]
|
|-- executors.json      angular-typecheck -> executor       (existing, untouched)
|-- generators.json     typecheck-configuration -> generator [NEW marker file]
|
'-- src/
    |-- core/                         ENGINE (framework-agnostic)  -- UNTOUCHED
    |   '-- run-typecheck / gather / filter / render / verdict ...
    |
    |-- executors/angular-typecheck/  ADAPTER (devkit-aware)       -- UNTOUCHED
    |   '-- executor.ts + normalize-options.ts + schema.{json,d.ts}
    |
    '-- generators/                   [NEW devkit-aware surface, sibling to executors/]
        '-- typecheck-configuration/
            |-- generator.ts          readProjectConfiguration -> mutate targets -> update -> formatFiles
            |-- schema.json + schema.d.ts   (hand-authored; parity-gated)
            '-- generator.spec.ts     in-memory createTreeWithEmptyWorkspace

TEST TIERS (existing 3 tiers; v0.0.4 ADDS rows, not tiers)
|
|-- unit (*.spec.ts)            + generator.spec.ts + generator schema-parity   [NEW specs]
|-- integration (*.integration.spec.ts)
|   '-- extended-catalog.integration.spec.ts   ONE it.each keyed on the enum     [NEW spec]
|       + completeness tripwire (rows === ExtendedTemplateDiagnosticName)        [NEW spec]
|-- e2e (*.int.spec.ts, under e2e/)
    '-- install-e2e/generator.int.spec.ts   nx g -> assert project.json -> run    [NEW spec, FOLDED in]
    '-- install-e2e/fixtures/consumer-app   gains an UN-WIRED project              [MODIFIED fixture]

CI  .github/workflows/ci.yml  -- NO structural change (jobs unchanged)
|-- test (6-cell matrix)  auto-routes the new in-plugin specs (glob match)
|-- e2e (-p install-e2e ...) auto-runs the folded generator e2e
'-- a NEW guard spec asserts the e2e -p list === all e2e/* graph projects        [NEW spec, in the test tier]
```

### Component Responsibilities

| Component | Responsibility | New / Modified / Existing |
|-----------|----------------|---------------------------|
| `generators.json` (package root) | Plugin marker that registers `typecheck-configuration` -> factory + schema path; the generator analogue of `executors.json` | **NEW file** |
| `src/generators/typecheck-configuration/generator.ts` | Default async `(tree, options)` fn: `readProjectConfiguration` -> guard/merge an `angular-typecheck` target into `targets` -> `updateProjectConfiguration` -> `formatFiles`. NO `generateFiles`, NO file emission | **NEW** |
| `src/generators/typecheck-configuration/schema.{json,d.ts}` | Hand-authored option schema (`project` positional via `$default` argv, `--tsConfig` override, target-name; `additionalProperties:false`) + matching TS interface | **NEW** |
| `generator.spec.ts` | In-memory `createTreeWithEmptyWorkspace` + `addProjectConfiguration` seed -> run generator -> assert written target per project type + idempotency | **NEW** |
| generator schema-parity spec | `schema.json` keys === `schema.d.ts` interface keys -- extends the existing executor `schema-parity.spec.ts` idiom | **NEW (idiom reused)** |
| `extended-catalog.integration.spec.ts` | ONE `it.each` table keyed on the 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes; exact code + `DiagnosticCategory` + count + one promotion case; real compiler over committed fixtures | **NEW (replaces/absorbs the partial v13 split)** |
| completeness tripwire | Asserts catalog covered-code set === the `ExtendedTemplateDiagnosticName` enum, consumed at test time; `it.skip`-with-reason rows stay counted | **NEW** |
| `install-e2e/.../consumer-app` fixture | Gains a SECOND project WITHOUT a pre-wired target, so the generator has something to wire | **MODIFIED fixture** |
| generator e2e spec (in `install-e2e`) | Pack+install tarball -> `nx g angular-typechecker:typecheck-configuration` -> assert `project.json` -> `nx run <proj>:angular-typecheck --skip-nx-cache` (clean=success, injected error=failure with code visible) | **NEW spec, folded into existing project** |
| `-p` set-equality guard spec | Reads `ci.yml` e2e job `-p` list and the Nx project graph; asserts list === all `e2e/*` projects (quantifier `every`) | **NEW (in the `test` tier)** |
| build target `assets` (`project.json`) | Must glob `generators.json` into `dist` (mirror the existing `executors.json` asset block) | **MODIFIED** |
| `package.json` `files` + `generators` | Add `generators.json` to the tarball allowlist; add the `"generators"` field | **MODIFIED** |
| core engine (`src/core/**`) | The whole-program type-check; consumed by the generated target at runtime | **EXISTING, untouched** |
| executor adapter | Consumed by the target the generator writes; unchanged | **EXISTING, untouched** |
| `ci.yml` jobs | `test` / `e2e` / `fallow` / aggregate `ci` -- structurally unchanged | **EXISTING, untouched** |

## Recommended Project Structure

```
packages/angular-typechecker/
|-- executors.json                       # existing executor marker
|-- generators.json                      # NEW: { generators: { "typecheck-configuration": { factory, schema, description } } }
|-- package.json                         # MODIFIED: + "generators", + files["generators.json"]
|-- project.json                         # MODIFIED: build.assets globs generators.json (mirror executors.json block)
|-- src/
|   |-- core/                            # UNTOUCHED engine
|   |-- executors/angular-typecheck/     # UNTOUCHED adapter
|   |   '-- schema-parity.spec.ts        # existing idiom the generator parity spec mirrors
|   |-- generators/                      # NEW devkit-aware surface (sibling to executors/)
|   |   '-- typecheck-configuration/
|   |       |-- generator.ts
|   |       |-- generator.spec.ts        # in-memory createTreeWithEmptyWorkspace
|   |       |-- schema.json
|   |       |-- schema.d.ts
|   |       '-- schema-parity.spec.ts    # generator schema.json <-> schema.d.ts parity
|   '-- core/
|       '-- extended-catalog.integration.spec.ts   # NEW: the single enum-keyed it.each + tripwire
|
fixtures/                                # plugin integration tier (workspace root)
|-- extended-catalog/                    # NEW or consolidated: per-code component+tsconfig triples
|   '-- ...                              # for the 18 members + baseline codes (batch per program where practical)
|
e2e/angular-typechecker-install-e2e/
|-- src/
|   |-- install-smoke.int.spec.ts        # existing
|   '-- generator.int.spec.ts            # NEW: nx g -> assert project.json -> run target
|-- fixtures/consumer-app/
|   |-- project.json                     # existing pre-wired application project
|   '-- <un-wired-project>/              # MODIFIED: add a project with NO angular-typecheck target
|
.planning/research/DIAGNOSTIC-CATALOG.md # MODIFIED (CAT-05): corrected to the authoritative 18-member set
```

### Structure Rationale

- **`src/generators/` as a sibling to `src/executors/`:** mirrors the established `executors/<name>/` convention (STRUCTURE.md "New Nx executor" section) so the second devkit surface is discoverable in the same idiom. Nx's own plugins (`@nx/js`, `@nx/plugin`) use `src/generators/<name>/`. The generator stays in the `@nx/devkit`-aware tier; it never touches `src/core/**` (which must stay pure -- ESLint-enforced).
- **Generator is config-edit-only (CONSENSUS D-decision B):** it `readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` -> `formatFiles`. No `generateFiles`, no `files/` EJS template dir, no on-disk emission inside the generator boundary. This is the ENTIRE justification for using the in-memory tree (D1) and skipping the bespoke `createFsTree` -- there is no per-generation disk read to fake.
- **The catalog is ONE file, not a per-version split:** CONSENSUS D2 keys the `it.each` table on the enum with introduction-version as a ROW FIELD. The existing partial `extended.angular13.integration.spec.ts` scaffold is SUPERSEDED -- the prescribed-but-unpopulated per-version split (only v13 exists today) is replaced by the single enum-driven table so "add a future major" is a new row, not a new file. This is the one place v0.0.4 reverses an earlier documented intent (the `DIAGNOSTIC-CATALOG.md:60` per-version-file prescription).
- **Generator e2e lives INSIDE `install-e2e`, not in a new project:** CONSENSUS D4 + the GUARD-01 set-equality guard make a new e2e project actively undesirable -- a new `e2e/*` project would have to be hand-added to the `ci.yml` `-p` list (the exact silent-skip landmine GUARD-01 closes). Folding the scenario into the already-listed `install-e2e` reuses its `npm pack` + tmp-install harness and rides the existing `-p` entry. No Verdaccio (the repo deliberately runs one e2e mechanism; Verdaccio's `execFileSync(nx)` is Windows-arm64-hostile).
- **`fixtures/extended-catalog/` co-located committed fixtures:** the integration tier runs the REAL `performCompilation` against committed `tsconfig` + component triples (TESTING.md), so the catalog needs real triggering fixtures, not in-memory test files. Batch per program where practical (CONSENSUS D2) to keep cold-compile count down.

## Architectural Patterns

### Pattern 1: Dual devkit surfaces over one shared marker convention

**What:** The plugin exposes BOTH `executors.json` and `generators.json` at the package root, each a thin JSON marker mapping an id to a compiled implementation path. The published `package.json` carries BOTH `"executors"` and `"generators"` fields. Nx's CLI resolves a generator the same way it resolves an executor: read the marker, `require()` the compiled factory.

**When to use:** A plugin that both DOES work (executor) and CONFIGURES that work (generator) -- the canonical Nx tooling-plugin shape.

**Trade-offs:** Two markers + two `package.json` fields + two build-asset globs to keep honest; offset by the fact that the generator's only job is to write the executor's target, so the two surfaces are tightly co-designed (the generated `executor` id and `tsConfig` option must match the executor's published id and schema).

**Example:**
```jsonc
// generators.json (NEW, sibling to executors.json)
{
  "$schema": "../../node_modules/nx/schemas/generators-schema.json",
  "generators": {
    "typecheck-configuration": {
      "factory": "./src/generators/typecheck-configuration/generator",
      "schema": "./src/generators/typecheck-configuration/schema.json",
      "description": "Add the angular-typecheck target to a project."
    }
  }
}
```

### Pattern 2: Config-edit generator on the in-memory Tree (no real disk)

**What:** The generator is a pure `Tree` transformation -- `readProjectConfiguration` -> mutate `targets['angular-typecheck']` -> `updateProjectConfiguration` -> `formatFiles`. Tests run it against `createTreeWithEmptyWorkspace()` (public, `@nx/devkit/testing`), seeding the target project with `addProjectConfiguration` first (the generator UPDATES, it does not CREATE), then assert via `readProjectConfiguration`/`readJson`. No flush, no teardown, no `nx/src/generators/tree` deep import.

**When to use:** Any generator whose entire observable effect is a config edit and whose downstream consumer (here, the executor) is tested separately. CONSENSUS D1/D3: the in-memory tree captures 100% of a `project.json`-edit generator's behavior.

**Trade-offs:** In-memory proves the recorded CHANGE, not on-disk consumability -- but that on-disk proof already exists at the e2e tier (GE2E-02 runs the real target after generating). The alternative (bespoke real-disk `createFsTree` over the internal `nx/src/generators/tree`) would add an eslint-disable quarantine + a drift tripwire for fidelity this generator does not need; CONSENSUS rejected it unanimously.

**Example:**
```typescript
const project = readProjectConfiguration(tree, options.project); // throws if absent
project.targets ??= {};
// idempotency guard: re-running must not duplicate or clobber (GEN-04)
project.targets[options.targetName ?? 'angular-typecheck'] = {
  executor: 'angular-typechecker:angular-typecheck',
  options: { tsConfig: options.tsConfig ?? defaultTsConfigForType(project) },
};
updateProjectConfiguration(tree, options.project, project);
await formatFiles(tree);
```

### Pattern 3: Enum-keyed catalog as the single source of completeness truth

**What:** ONE data-driven `it.each` table whose rows are keyed on the `ExtendedTemplateDiagnosticName` enum members (introduction-version is a row field). A separate tripwire test asserts the table's covered-code set EQUALS the enum -- so a future Angular release that adds/renames/removes a member fails CI loudly instead of silently under-covering. Un-reproducible rows stay in the table as `it.skip`-with-written-reason so the set comparison stays honest.

**When to use:** Asserting completeness against a moving upstream vocabulary (Angular's diagnostic set). The tripwire converts "we forgot to add a test for the new code" from a silent gap into a red build -- the same drift-as-loud-failure philosophy as the existing `typecheck-drift` gate.

**Trade-offs:** A single big table is less granular than per-code files but is the ONLY shape that lets the set-equality tripwire be a one-liner against the enum. The enum must be imported by value from `@angular/compiler-cli` (verify it is a runtime enum, not a type-only const) -- if type-only, the tripwire reads the shipped `.d.ts` member list the same way `schema-parity.spec.ts` encodes the expected key set.

**Example:**
```typescript
// rows keyed on the enum; introduction-version is a field, not a file split
it.each(CATALOG)('$code ($name, v$introducedIn): exact code + category + count',
  async ({ code, category, count, fixture, skipReason }) => {
    if (skipReason) { /* it.skip path: row stays counted by the tripwire */ return; }
    const result = await runTypecheck({ tsConfigPath: fixture });
    const hits = result.diagnostics.filter((d) => d.code === code);
    expect(hits).toHaveLength(count);
    expect(hits[0].category).toBe(category);
  });

it('completeness tripwire: catalog covers exactly the enum', () => {
  expect(new Set(CATALOG.map((r) => r.name)))
    .toEqual(new Set(Object.values(ExtendedTemplateDiagnosticName)));
});
```

## Data Flow

### Generator authoring/runtime flow (generator -> project.json -> executor)

```
nx g angular-typechecker:typecheck-configuration <project> [--tsConfig ...]
    |
    v
generators.json  -> Nx require()s the compiled generator factory
    |
    v
generator(tree, options)
  readProjectConfiguration(tree, project)        # reads existing project.json into the Tree
  mutate targets['angular-typecheck']            # idempotent guard/merge
  updateProjectConfiguration(tree, project, ...) # records the change in the Tree
  formatFiles(tree)                              # Prettier over recorded changes
    |
    v  (Nx flushes the Tree to disk on a real run; in-memory in unit tests)
project.json now has the angular-typecheck target
    |
    v
nx run <project>:angular-typecheck   ->  EXISTING executor -> EXISTING core engine
```

The generator's OUTPUT (a target keyed to `angular-typechecker:angular-typecheck` with a `tsConfig` option) must be exactly what the existing executor's `schema.json` accepts -- this is the load-bearing seam between the new generator and the untouched executor.

### Catalog test flow (catalog -> CoreResult -> assertion)

```
CATALOG (enum-keyed rows) --it.each--> runTypecheck({ tsConfigPath: fixtures/extended-catalog/<...> })
    |                                       |
    |                                       v
    |                                 real @angular/compiler-cli performCompilation (cold)
    |                                       |
    |                                       v
    |                                 CoreResult.diagnostics  (codes via NG()/raw TS ints, .category, count)
    |                                       |
    '--tripwire: Set(rows) === Set(enum)----+--> assert exact code + DiagnosticCategory + count [+ promotion]
```

### CI self-audit flow (-p set-equality guard)

```
GUARD spec (in the test tier, runs in the 6-cell matrix)
    |
    |-- parse .github/workflows/ci.yml -> e2e job `-p` token list
    |-- read Nx project graph -> all projects tagged/located under e2e/*
    v
assert  Set(ci -p list) === Set(e2e/* graph projects)   (predicate quantifier: every)
    -> a forgotten -p entry becomes a LOUD, LOCATED failure instead of a silent skip
```

### Key Data Flows

1. **Generator -> executor contract:** the generated target's `executor` id and `options.tsConfig` are the integration contract; a generator e2e (GE2E-02) closes the loop by actually RUNNING the generated target end-to-end.
2. **Enum -> tripwire:** the `ExtendedTemplateDiagnosticName` enum is the single source of truth; the catalog rows must equal it, asserted at test time so an Angular upgrade can never silently shrink coverage.
3. **ci.yml -p list -> graph:** the guard reads BOTH the workflow file and the project graph and proves they agree -- a meta-test that protects the e2e gate's meaning.

## Scaling Considerations

(For a build/test plugin, "scale" = number of fixtures, projects, and Angular versions, not user count.)

| Scale | Architecture Adjustments |
|-------|--------------------------|
| v0.0.4 (1 generator, 18+baseline codes, 3 e2e projects) | Single enum-keyed catalog file; generator e2e folded into install-e2e; in-memory generator tests. Cold-compile ~0.5s/fixture, ~9s/cell parallelized (CONSENSUS D5) -- comfortable; no `test`-target split. |
| Next milestone (createNodesV2 inference, more generators) | A second generator slots into `src/generators/<name>/` under the same `generators.json`; if a generator EMITS files a compiler must read back, re-open FSTREE-01 (the deferred real-disk helper) -- but only then. |
| Future Angular majors (new NG8xxx) | The enum-keyed catalog makes a new code a new ROW + fixture; the tripwire forces it red until added. No file proliferation. |
| Angular CLI (`angular.json`) workspaces (GEN-FUT-01) | Re-export the generator via `convertNxGenerator` (a thin adapter, same core); deferred -- Nx workspaces only in v0.0.4. |

### Scaling Priorities

1. **First bottleneck: cold-compile fixture count in the catalog.** Batch multiple diagnostics per program/tsconfig where practical (CONSENSUS D2) so the catalog does not spawn one cold `performCompilation` per code.
2. **Second bottleneck: e2e serialization.** The generator e2e rides `install-e2e`, which is already fully serialized (`singleFork`, `fileParallelism:false`) and Linux-only in CI -- adding one more scenario to it is cheap; adding a NEW serialized e2e project would not be.

## Anti-Patterns

### Anti-Pattern 1: Building the bespoke `createFsTree` real-disk helper

**What people do:** Author `createFsTree`/`flushFsTreeChanges` over the internal `nx/src/generators/tree` deep import to test the generator against real disk (carried from the v0.0.1 plan + prior art).
**Why it's wrong:** A `project.json`-edit generator has no per-generation disk read to fake; the in-memory Tree captures 100% of its behavior. The deep import is non-public (needs an eslint-disable quarantine + a drift tripwire), and Nx's own ratio is 452 in-memory : 1 real-disk. CONSENSUS D1 rejected it 8/8 (incl. the maximalist lens).
**Do this instead:** Use the public `createTreeWithEmptyWorkspace` from `@nx/devkit/testing`; get real-disk fidelity from the folded generator e2e (which runs the real target after generating). Track the real-disk helper as deferred FSTREE-01, to be built ONLY if a future generator emits files a compiler reads back.

### Anti-Pattern 2: A new `e2e/*` project for the generator

**What people do:** Create `angular-typechecker-generator-e2e` as a fourth e2e project.
**Why it's wrong:** A new e2e project is invisible to CI until hand-added to the `ci.yml` `e2e` job's explicit `-p` list (the silent-skip landmine GUARD-01 exists to catch). It also adds a second serialized harness to maintain and a second Verdaccio-or-pack decision.
**Do this instead:** Fold the scenario into `install-e2e` (already in the `-p` list, already has the pack+install harness). Add an un-wired project to its `consumer-app` fixture. No new project, no Verdaccio (CONSENSUS D4).

### Anti-Pattern 3: A per-Angular-version catalog file split

**What people do:** Continue the `extended.angularNN.integration.spec.ts` per-introduction-version split prescribed by `DIAGNOSTIC-CATALOG.md:60` (one file per major).
**Why it's wrong:** A file split makes the completeness tripwire (rows === enum) hard to express and lets a new code land without a corresponding row silently. Today only the v13 file exists -- the split is unpopulated scaffolding.
**Do this instead:** ONE enum-keyed `it.each` table with introduction-version as a row field (CONSENSUS D2). A new major's code is a new row + fixture; the tripwire forces it.

### Anti-Pattern 4: Filtering extended diagnostics by an "NG81xx" numeric pattern

**What people do:** Detect/collect extended diagnostics by matching code numbers in the 81xx range.
**Why it's wrong:** Two of the 18 `ExtendedTemplateDiagnosticName` members -- NG8011 and NG8021 -- live OUTSIDE the 81xx range, so a numeric filter silently drops them. NG8011 is also emitted out-of-band and is NOT promotable; NG8110/NG8118 are `ErrorCode`s that are NOT configurable extended diagnostics.
**Do this instead:** Key the catalog on the ENUM members (the authoritative set), assert each by EXACT code (via the `NG()` helper, never the bare positive code), and assert NG8011 at its observed category while explicitly skipping its promotion case with a written reason (CONSENSUS D2 nuance).

### Anti-Pattern 5: Mutating the core engine or adapter for the generator

**What people do:** Reach into `src/core/**` or the executor adapter to "share" logic with the generator.
**Why it's wrong:** The core is pure (no `process`/`console`, ESLint-enforced) and the adapter owns Nx side effects; the generator is a THIRD devkit-aware surface that only needs `@nx/devkit` config APIs. Coupling it to the engine breaks the hexagonal boundary.
**Do this instead:** Keep the generator in `src/generators/` consuming only `@nx/devkit` (`readProjectConfiguration`, `updateProjectConfiguration`, `formatFiles`, `joinPathFragments`). It references the executor only by its published string id.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| generator <-> executor | The generated target's `executor` id string + `tsConfig` option must match the executor's published id (`angular-typechecker:angular-typecheck`) and its `schema.json` | Load-bearing seam; GE2E-02 verifies it by running the generated target |
| generator <-> `@nx/devkit` | `readProjectConfiguration` / `updateProjectConfiguration` / `formatFiles` / `joinPathFragments` (all public, verified in `nx@23.0.1`) | No deep imports; no `nx/src/*` |
| generator <-> Nx CLI | `generators.json` marker + `package.json` `"generators"` field; build `assets` glob copies `generators.json` to `dist` | Mirror the existing `executors.json` plumbing exactly |
| catalog <-> core engine | Calls `runTypecheck` directly against committed fixtures; asserts off `CoreResult.diagnostics` (code, `.category`, count) | Same idiom as existing `*.integration.spec.ts`; no engine change |
| catalog <-> `ExtendedTemplateDiagnosticName` | Enum imported (by value if runtime, else `.d.ts` member list) and compared to the table's covered set | The completeness tripwire's single source of truth |
| generator e2e <-> install-e2e harness | Reuses `buildCleanEnv` / nested-nx env-strip / `npm pack` + `mkdtempSync` tmp install from `install-smoke.int.spec.ts`; runs with `--skip-nx-cache` | No new harness; rides the existing `implicitDependencies: ["angular-typechecker"]` tarball build |
| guard spec <-> ci.yml + project graph | Parses the `e2e` job `-p` list and reads the graph; asserts set equality (`every`) | Meta-test in the `test` tier; protects the e2e gate's meaning |

### Build / Packaging Integration

| Artifact | Change | Notes |
|----------|--------|-------|
| `package.json` `"generators"` | ADD `"generators": "./generators.json"` (sibling to `"executors"`) | Makes Nx discover the generator from an install |
| `package.json` `files` | ADD `"generators.json"` to the allowlist | `schema.json` already ships via `src` + the `**/!(*.ts)` asset glob |
| `project.json` build `assets` | ADD a glob block for `generators.json` (mirror the `executors.json` block at lines 29-33) | Without it the marker is absent from `dist` and the generator is unresolvable |
| `@nx/dependency-checks` | No new runtime dep (generator uses the already-declared `@nx/devkit`) | The catalog/tripwire consume the peer `@angular/compiler-cli` (already declared) |
| tarball audit (`tarball-audit.int.spec.ts`) | Its file-set gate must now expect `generators.json` in the tarball | Update the expected-files assertion alongside the `files` change |

## Suggested Build Order (Phases 12-14)

Consistent with the ratified roadmap (Phase 12 catalog, Phase 13 generator, Phase 14 generator e2e + guard) and CONSENSUS.md. Phases 12 and 13 are INDEPENDENT (the roadmap marks both "depends on nothing within v0.0.4"); Phase 14 depends on Phase 13.

1. **Phase 12 -- Extended-diagnostic catalog + completeness tripwire (CAT-01..05, DRIFT-01).** Build first OR in parallel with Phase 13 -- it is pure test/fixture work on the SHIPPED engine, touches no new surface, and de-risks the diagnostic-vocabulary facts the rest of the milestone leans on. Deliverables: the single enum-keyed `it.each` catalog, the committed `fixtures/extended-catalog/` triples, the enum-vs-table tripwire, and the corrected `DIAGNOSTIC-CATALOG.md`. Auto-routes into the `test` matrix (no ci.yml change). NO dependency on the generator.
2. **Phase 13 -- typecheck-configuration generator (GEN-01..06).** The version-bumping `feat`. Build the generator + `schema.{json,d.ts}` + `generators.json` + the `package.json`/`project.json` plumbing + in-memory `generator.spec.ts` + schema-parity spec. Can run in PARALLEL with Phase 12 (different surfaces, no shared files beyond `package.json`/`project.json` -- coordinate those two edits if running concurrent worktrees per AGENTS.md). Output: a registered, tested, shipped generator.
3. **Phase 14 -- Generator e2e + CI self-audit guard (GE2E-01/02, GUARD-01).** MUST follow Phase 13 (needs the shipped generator + `generators.json` + the `"generators"` field in the tarball). Add the un-wired project to the `install-e2e` consumer fixture, add `generator.int.spec.ts` folding the `nx g -> assert project.json -> run target` scenario into `install-e2e`, and add the `-p` set-equality guard spec (in the `test` tier). The tarball-audit file-set assertion update (expecting `generators.json`) also lands here or in Phase 13's packaging step.

**Ordering rationale:** 12 before/with 13 because the catalog is independent and de-risks the diagnostic facts; 13 before 14 because the e2e and the shipped tarball require the registered generator; the `-p` guard rides Phase 14 because that is when a new-e2e temptation is highest (and the consensus chose to FOLD rather than add a project precisely so the guard never has to learn a new name). No `ci.yml` structural change in any phase -- the only CI artifact touched is the NEW guard SPEC, which runs inside the existing `test` job.

## Sources

- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` (8/8 unanimous board) -- HIGH -- the ratified strategy this document builds on (D1 in-memory tree, D2 enum-keyed catalog + tripwire, D3 no mid-tier, D4 fold into install-e2e, D5 no ci.yml change, D6 scope).
- `.planning/research/v0.0.4-testing/CURRENT-AUDIT-AND-GENERATOR.md` -- HIGH -- current test inventory, the 2/16-extended coverage gap, verified Nx 23 generator authoring/testing APIs, `generators.json`/`package.json`/`project.json` wiring, CI wiring of new specs.
- `.planning/research/v0.0.4-testing/NX-FSTREE-INTERNALS.md` -- HIGH -- why the in-memory `createTreeWithEmptyWorkspace` is the substrate and the real-disk `FsTree` deep import is deferred.
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `TESTING.md` -- HIGH -- the existing core/adapter hexagonal split, the `executors/<name>/` convention, the three test tiers, the `typecheck-drift` drift-gate template.
- `packages/angular-typechecker/{package.json, project.json, executors.json}`, `src/executors/angular-typecheck/schema-parity.spec.ts` -- HIGH (read direct) -- exact `files`/`assets`/marker plumbing the generator mirrors; the schema-parity idiom to extend.
- `e2e/angular-typechecker-install-e2e/{project.json, src/install-smoke.int.spec.ts, fixtures/consumer-app/project.json}` -- HIGH (read direct) -- the harness + fixture the generator e2e folds into; the currently pre-wired single project that gains an un-wired sibling.
- `.github/workflows/ci.yml` -- HIGH (read direct) -- the unchanged 6-cell `test` matrix, Linux-only `e2e` with the explicit `-p` list (the GUARD-01 target), and the single `ci` aggregate.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (v0.0.4 section) -- HIGH -- the 15 requirements and the Phase 12-14 mapping this build order is consistent with.

---
*Architecture research for: v0.0.4 generator + extended-testing integration*
*Researched: 2026-07-01*
