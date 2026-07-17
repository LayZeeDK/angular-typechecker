# Phase 23: `init` schematic parity + first-party `ng-add` - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended options auto-locked; `--analyze` trade-off tables logged in DISCUSSION-LOG.md). Trap-quadrant check applied per the `--auto` discuss rule -- see the "Trap-quadrant assessment" note in `<decisions>`. No user BLOCKER surfaced; every locked decision is evidence-backed (source-verified in the v0.2.1 research against the installed `@nx/devkit@23.0.1` / `nx@23.0.1` source), and the two genuinely NOT-HIGH-confidence items (devDependency management, `ng-add` on a non-`angular.json` tree) are recorded as Phase-23 research flags with starting hypotheses, NOT auto-locked as settled.

<domain>
## Phase Boundary

`ng add angular-typechecker` installs the package and auto-wires a `typecheck`
target into EVERY `application` + `library` project in `angular.json`, with an
explicit "no target caching on Angular CLI" notice; an `init` schematic exists
for parity that seeds NO caching (no stray `nx.json`); and the optional-peer
dependencies the converted builder needs at runtime are classified so
`@nx/dependency-checks` stays green. Purely ADDITIVE beside the shipped Nx
surface; composes the Phase-22 `angular.json` write-fork.

**In scope (Phase 23 -- ACS-03, NGADD-01, ACP-01):**
- **First-party `ng-add` schematic (NGADD-01):** iterate `angular.json#projects`,
  filter to `projectType` `application` + `library` (skip e2e/other types), and
  wire a per-project `typecheck` architect target into EACH by composing the
  SHARED Phase-22 `configuration` write-fork; idempotent (skip a project that
  already has OUR `typecheck` target); ensure the package is a `devDependency`;
  print the "no target caching on Angular CLI" notice ONCE. Registered under the
  reserved `ng-add` name in `collection.json`.
- **`init` schematic parity (ACS-03):** `ng generate angular-typechecker:init`
  available on the Angular CLI surface; on an `angular.json` workspace it seeds
  NO caching and creates NO stray `nx.json`. Delivered via an additive
  `tree.exists('angular.json')` early-return fork in the shipped `init` generator
  (mirroring the Phase-22 `configuration` fork) + `convertNxGenerator(initGenerator)`
  registered in `collection.json`.
- **Optional-peer dependency classification (ACP-01):** declare
  `@angular-devkit/architect` (`^0.2200.0` -- the `0.22xx.x` scheme, NOT `22.x`)
  and `rxjs` (`^7.8.0`) as OPTIONAL `peerDependencies`
  (`peerDependenciesMeta.<dep>.optional: true`); keep `@nx/dependency-checks`
  green; document the "`ng add` pulls `nx` transitively + may materialize a `.nx/`
  dir" consequence.
- The Nx `nx add angular-typechecker` behavior is UNCHANGED from v0.2.0 (still runs
  the Nx `init` -> seeds `nx.json` `targetDefaults` caching only; NO auto-wire-all).

**Out of scope (other phases / charter):**
- Real-OSS + scaffolded e2e, the additive-only audit, and README/CHANGELOG docs
  -> Phase 24 (ACV-01/02/03, ACP-02, ACD-01). Phase 23 delivers unit/integration
  coverage of its own surface; the e2e PROOF of `ng add` end-to-end is Phase 24.
- The builder (`ng run <project>:typecheck`), the `tsConfig: string | string[]`
  engine widening, and the `configuration` schematic + `angular.json` write-fork
  -> ALREADY SHIPPED in Phases 21-22 (ACB-01/02/03, ENG-01, ACS-01/02/04, COV-01).
  Phase 23 CONSUMES them (composes the write-fork per project; reuses the builder id).
- Nx auto-provisioning of per-leaf targets via `createNodesV2` (WALK-FUT-01) --
  the idiomatic Nx analog of `ng add` auto-wire-all; deferred, keeps Nx `nx add`
  init/caching-only.
- Any breaking change to the executor id, `runTypecheck`/`CoreResult`/`CoreOptions`,
  or existing schemas (ADDITIVE-ONLY charter; re-version to v0.3.0 only if a
  breaking change proves unavoidable).

</domain>

<decisions>
## Implementation Decisions

> **Trap-quadrant assessment (per the `--auto` discuss rule):** Phase 23's design is
> LOCKED and source-verified in `.planning/research/v0.2.1-angular-cli/` (CORRECTION &
> LOCKED DECISIONS point 3 = `ng add` auto-wires ALL app+library projects; the
> optional-peer classification in STACK.md; the init no-op-off-Nx finding + the
> safe "skip explicitly" resolution in PITFALLS.md Pitfall 3 + Gaps). Those are
> HIGH-confidence, evidence-backed auto-locks (D-01..D-08), not bare defaults --
> outside the trap quadrant. The TWO genuinely NOT-HIGH-confidence items are
> IMPLEMENTATION-APPROACH questions (how `ng-add` ensures the devDependency
> classification; how `ng-add` behaves when invoked on a tree without
> `angular.json`) -- per GSD philosophy those belong to the researcher/planner, not
> the user. They are recorded as Phase-23 research flags (RF-01, RF-02) with
> starting hypotheses, NOT auto-locked as settled. Both are MEDIUM-impact (reversible
> within the milestone, test-gated), so neither is a HIGH-impact + NOT-HIGH-confidence
> USER decision -- there is no UNRESOLVED user BLOCKER, and this autonomous pass is
> correct to proceed.

### First-party `ng-add`: authoring pattern + engine-composition (NGADD-01 -- LOCKED)
- **D-01:** Author `ng-add` as an Nx-devkit generator `ngAddGenerator(tree, schema)`
  re-exported via `export default convertNxGenerator(ngAddGenerator)` at
  `src/schematics/ng-add/schematic.ts`, registered in `collection.json` under the
  reserved `ng-add` name. This keeps `ng-add` on the SAME `@nx/devkit` `Tree`
  abstraction as the shipped generators, so it can call the shared
  `configurationGenerator` directly, and `convertNxGenerator` wraps it as the
  `@angular-devkit/schematics` Rule that `ng add` requires. NOT a hand-written
  `@angular-devkit/schematics` Rule assembled from primitives (that would add a
  dependency and could not reuse the Nx generator). Source: SUMMARY.md
  "Architecture Approach" component 3 + ARCHITECTURE.md.
- **D-02:** `ng-add` COMPOSES the shared Phase-22 `configuration` write-fork per
  project -- it does NOT re-implement per-project target wiring. For each in-scope
  project it invokes `configurationGenerator(tree, { project, skipFormat: true })`
  (the same code path `ng generate angular-typechecker:configuration <project>`
  runs), then formats ONCE at the end. This inherits the write-fork's
  collision-by-builder-id guard, idempotent rewrite (preserving user keys/options),
  and RF-01 leaf-array resolution for free. Source: 22-CONTEXT `<specifics>` ("ng add
  auto-wire-all is Phase 23. Both compose the SAME write-fork") + ARCHITECTURE.md
  component 3.

### `ng-add` project selection (NGADD-01 -- LOCKED)
- **D-03:** Enumerate `angular.json#projects` (via `readJson`/the tree, on the same
  virtual `Tree`), and wire a target ONLY into projects whose `projectType` is
  `'application'` or `'library'`. Skip everything else (e2e-only projects / other
  types). Idempotency is delegated to the shared `configuration` write-fork's
  collision-by-builder-id check: a project that already carries OUR `typecheck`
  target is re-asserted to the same shape (no-op-equivalent), and a project with a
  same-named NON-ours target throws the write-fork's clear located error rather than
  clobbering. Source: REQUIREMENTS NGADD-01 + SUMMARY.md CORRECTION point 3.

### `init` schematic parity + the CLI fork (ACS-03 -- LOCKED)
- **D-04:** Add an additive early `tree.exists('angular.json')` fork to the shipped
  `init` generator (`src/generators/init/generator.ts`): on an Angular CLI workspace
  it does NO `nx.json` seeding and returns (optionally printing the shared
  no-caching notice) BEFORE touching `nx.json`; the Nx branch stays the current body
  verbatim (`readNxJson`/`updateNxJson` targetDefaults seed). This mirrors the
  Phase-22 `configuration` fork's "gate the Nx work out explicitly rather than rely
  on the incidental no-op" pattern (22-CONTEXT D-04). Rationale over the plain
  re-export: although `updateNxJson` is a VERIFIED no-op when `nx.json` is absent
  (`nx-json.js` early-return, creates nothing), the research Gaps flag a documented
  in-corpus CONTRADICTION on this point (FEATURES.md claimed it CREATES a stray
  `nx.json`) -- the safe, non-incidental design skips explicitly. Source: PITFALLS.md
  Pitfall 3 + SUMMARY.md Gaps ("safe design either way: skip explicitly, never rely
  on the incidental behavior").
- **D-05:** Register `convertNxGenerator(initGenerator)` at
  `src/schematics/init/schematic.ts` in `collection.json` (parity re-export). The
  fork lives in the generator, so `ng generate angular-typechecker:init` and
  `nx g angular-typechecker:init` run the exact same forked code. Additive-safe:
  `generators ?? schematics` keeps `collection.json` Nx-invisible (already proven by
  `nx-generators-surface-regression.spec.ts`; extend coverage to the new entries).

### The "no target caching on Angular CLI" notice (NGADD-01, ACS-03 -- LOCKED)
- **D-06:** A single shared notice string ("Angular CLI has no target-result cache to
  seed; the `typecheck` target(s) are wired without caching") printed via the devkit
  `logger.info` (which surfaces through both the Nx and Angular CLI schematic
  runners). Printed ONCE by `ng-add` (after wiring). The `init` CLI fork MAY print
  the same shared string; wording lives in ONE place to avoid drift. Low-impact
  cosmetic; exact phrasing is planner discretion within end-user language. Source:
  NGADD-01 + PITFALLS.md Pitfall 3.

### Optional-peer dependency classification (ACP-01 -- LOCKED)
- **D-07:** Declare `@angular-devkit/architect` (`^0.2200.0`) and `rxjs` (`^7.8.0`)
  as OPTIONAL `peerDependencies` (`peerDependenciesMeta.<dep>.optional: true`) in the
  published `package.json`. These are `require()`d at runtime by the
  `convertNxExecutor`-produced builder (the `require()`s live in `@nx/devkit`, not in
  this plugin's source, so `@nx/dependency-checks` cannot otherwise see them). They
  are always present in any Angular CLI workspace and never forced onto a pure-Nx
  consumer. `nx` itself is NOT declarable and flows in transitively through
  `@nx/devkit`'s existing peer -- ACCEPT + DOCUMENT it (an `ng add` into a non-Nx
  workspace pulls `nx` transitively and may materialize a `.nx/` dir). Source:
  STACK.md "Dependency-classification call" + PITFALLS.md Pitfalls 4 + 5.
- **D-08:** Keep the `@nx/dependency-checks` ESLint gate green after adding the two
  optional peers. The planner confirms the exact rule config against the installed
  `@nx/eslint` behavior -- the likely lever is `ignoredDependencies` (or relying on
  the rule reading `peerDependencies` directly) so the two peers, which are NOT
  imported by this plugin's own `src/`, are not flagged as obsolete/unused. Verified
  green by running the existing `nx lint` gate (a required CI check). Source: STACK.md
  + the shipped `.eslintrc`/flat-config `@nx/dependency-checks` rule.

### Charter reconciliation (record for the planner -- IMPORTANT)
- **D-09:** The REQUIREMENTS "Out of Scope" line "Hand-written
  `@angular-devkit/architect` builder or `@angular-devkit/schematics` Rule" is NOT
  violated by the first-party `ng-add`. That exclusion targets ENGINE ADAPTERS -- the
  builder and the `configuration` schematic MUST be thin `convertNx*` re-exports so
  they never fork the shared core. `ng-add` is an INSTALL-ORCHESTRATION schematic
  (there is no Nx generator to convert for "install + auto-wire-all"; `nx add` is
  handled by Nx invoking the registered `init`, not a generator named `ng-add`). It
  is authored as an Nx generator -> `convertNxGenerator` and COMPOSES the shared
  `configuration` generator, so it neither hand-writes a `@angular-devkit/schematics`
  Rule from primitives NOR forks the engine -> IN charter. (Recorded here so the
  milestone audit and the planner do not read NGADD-01 and the Out-of-Scope line as a
  contradiction.) Source: REQUIREMENTS Out of Scope + FEATURES.md "Must have" +
  ARCHITECTURE.md component 3.

### Claude's Discretion
- Plan decomposition (how many plans; whether `ng-add` + the `init` fork/schematic +
  the optional-peer classification split across plans or land together). Researcher +
  planner decide, grounded in the canonical refs. A natural split mirrors Phase 22:
  the behavioral fork/schematic code in one plan, the additive-manifest + regression
  + optional-peer + docs-touch in another -- but this is not prescribed.
- The exact no-caching notice wording (end-user language, no internal ids).
- Whether `ng-add` takes an optional `--project` to scope a single project (a
  nice-to-have per SUMMARY.md "optionally chains `configuration`"); the DEFAULT and
  the tested behavior is auto-wire-ALL app+library projects (NGADD-01).
- Whether the `ng-add` schema is a minimal hand-authored `schema.json` (likely just
  `skipFormat?` + an optional `project?`) or reuses an existing one -- confirm the
  Architect/schematics dialect needs (cf. Phase-21 Pitfall 7 sanitized-schema
  lesson) during planning.

### Phase-23 Research Flags (NOT auto-locked -- for gsd-phase-researcher)
- **RF-01 (devDependency ensure/classification -- the primary Phase-23 research
  question):** HOW does `ng-add` guarantee `angular-typechecker` ends up in
  `devDependencies` (a type-checker is dev tooling), given that `ng add <pkg>`
  installs the package into `dependencies` by default BEFORE running the schematic?
  Competing approaches, to resolve empirically (against the `bluehalo/ngx-leaflet`
  clone + the Phase-24 scaffolded workspace, with the real proof in Phase 24):
  - **(A) `@nx/devkit` `addDependenciesToPackageJson`** into the `devDependencies`
    bucket (+ remove from `dependencies` if `ng add` placed it there). Zero new dep
    (devkit is already a dependency); returns an install `GeneratorCallback`.
    Starting hypothesis (recommended, NOT locked).
  - **(B) direct `package.json` tree edit** ensuring the `devDependencies` entry and
    deleting any `dependencies` entry -- no install task (the package is already on
    disk from `ng add`'s own install).
  - Open sub-questions the researcher must settle: does `convertNxGenerator` correctly
    surface a returned install-`GeneratorCallback` as a schematic task under `ng add`
    (cf. Phase-21 `convertNxExecutor` DEVIATION -- these bridges have edges), and does
    `ng add` re-run install after the schematic (making a task redundant)? MEDIUM
    impact (landing in prod deps vs dev deps is a hygiene/UX issue, not a correctness
    break), reversible, test-gated -- deliberately left to research.
- **RF-02 (`ng-add` behavior on a tree WITHOUT `angular.json`):** `ng add` is an
  Angular CLI command, but nothing prevents it running where there is no
  `angular.json` (e.g. an Nx-only workspace, or a bare package). What should the
  first-party `ng-add` do then? Starting hypothesis (recommended, NOT locked): guard
  on `tree.exists('angular.json')` -- if absent, do the dependency-ensure only and
  print guidance (do NOT attempt to wire targets, do NOT seed `nx.json`), keeping the
  Nx `nx add` -> `init` path the untouched way to configure an Nx workspace (charter:
  "Nx `nx add` behavior unchanged"). Confirm during research + cover with a
  no-`angular.json` unit test. MEDIUM impact, reversible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (LOCKED decisions -- read FIRST)
- `.planning/research/v0.2.1-angular-cli/SUMMARY.md` -- CORRECTION & LOCKED DECISIONS
  (point 3 = `ng add` auto-wires ALL app+library projects; the `init` no-op-off-Nx
  finding; the executor-unchanged / generator-write-fork ASYMMETRY). This section wins
  over everything else. Also "Architecture Approach" component 3 (`ng-add` Rule) +
  "Implications for Roadmap" Phase 3 + "Gaps to Address" (the `init` create-vs-no-op
  contradiction; the safe skip-explicitly resolution).
- `.planning/research/v0.2.1-angular-cli/ARCHITECTURE.md` -- the `ng-add` first-party
  Rule component, the init/caching-gap fork, and the source-verified additive-safety
  precedence (`generators ?? schematics`).
- `.planning/research/v0.2.1-angular-cli/PITFALLS.md` -- Pitfall 3 (`init` silent
  no-op off-Nx -> skip explicitly + print the no-caching notice), Pitfall 4 (`nx`
  dragged in + `.nx/` artifact -> accept + document), Pitfall 5 (undeclared runtime
  `require()`s -> optional peers), Pitfall 6 (`ng add` peer friction on Angular < 22).
- `.planning/research/v0.2.1-angular-cli/STACK.md` -- the dependency-classification
  call (`@angular-devkit/architect ^0.2200.0` + `rxjs ^7.8.0` as OPTIONAL peers; `nx`
  accepted transitively; DEV-only `@angular/cli` for the harness).
- `.planning/research/v0.2.1-angular-cli/FEATURES.md` -- "Must have" (`ng add`, the
  `init` parity schematic with the FORKED body) + "Deliberately NOT built"
  (no `nx.json` seed off-Nx; the `init` create-vs-no-op claim now superseded by the
  CORRECTION + Pitfall 3).

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` -- ACS-03, NGADD-01, ACP-01; the ADDITIVE-ONLY charter;
  the "Out of Scope" table (the hand-written-Rule exclusion reconciled in D-09).
- `.planning/ROADMAP.md` -- Phase 23 Goal / Success Criteria (SC1-SC4); the Phase 24
  dependency on this phase.

### Existing code to MODIFY / mirror (this phase)
- `packages/angular-typechecker/src/generators/init/generator.ts` -- ADD the additive
  `tree.exists('angular.json')` early-return fork (D-04); exports
  `TYPECHECK_EXECUTOR_ID` and the `TYPECHECK_TARGET_DEFAULTS` block (the Nx-only seed
  the CLI branch skips). The Nx branch body stays byte-unchanged (mirror the Phase-22
  `configuration` fork discipline).
- `packages/angular-typechecker/src/generators/configuration/generator.ts` -- the
  SHARED `configuration` generator `ng-add` COMPOSES per project (D-02); the
  `tree.exists('angular.json')` write-fork + `resolveTsConfigLeaves` (RF-01 Approach A)
  + the collision-by-builder-id / idempotent-rewrite logic are reused unchanged.
- `packages/angular-typechecker/src/generators/init/schema.{json,d.ts}` +
  `configuration/schema.{json,d.ts}` -- the shared schemas; the `ng-add` schema is new
  (minimal), the `init` schema is reused by its parity re-export.
- `packages/angular-typechecker/src/schematics/configuration/schematic.ts` -- the
  `convertNxGenerator(configurationGenerator)` re-export to MIRROR for `init` and (with
  the composed-generator twist) `ng-add`.
- `packages/angular-typechecker/collection.json` -- ADD `init` + `ng-add` entries
  (currently only `configuration`). Additive; Nx-invisible.
- `packages/angular-typechecker/package.json` -- ADD the two OPTIONAL
  `peerDependencies` + `peerDependenciesMeta` (D-07); the `files` whitelist already
  ships `src` + `collection.json`, so the new schematic dirs need no `files` edit
  (confirm). `executors`/`generators`/`builders`/`schematics` fields stay as-is.
- `packages/angular-typechecker/generators.json` -- the Nx manifest; whether `ng-add`
  is ALSO registered as an Nx generator is planner discretion (Nx uses `init` for
  `nx add`, so an Nx-surface `ng-add` generator is likely unnecessary -- confirm).

### Mirror-these test patterns (Phase 21/22 precedents)
- `packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts`
  -- the `generators ?? schematics` regression assertion; EXTEND to cover the new
  `init`/`ng-add` collection entries staying Nx-invisible.
- `packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts`
  -- the `angular.json`-SEEDED schematics test tree pattern; mirror it for the
  `ng-add` auto-wire-all + idempotency spec and the `init` no-stray-`nx.json` spec.
- `packages/angular-typechecker/src/generators/init/init.spec.ts` +
  `target-defaults-drift.spec.ts` -- the existing `init` Nx-branch behavior to keep
  byte-unchanged (the fork only ADDS an angular.json branch).
- `packages/angular-typechecker/src/generators/configuration/schema-parity.spec.ts` /
  `src/builders/typecheck/schema-parity.spec.ts` -- the schema-parity pattern if the
  `ng-add` schema needs its own sanitized shape.

### Real-clone substrate (dev/debug; uncommitted -- Phase 24 owns the real e2e PROOF)
- `D:\projects\github\bluehalo\ngx-leaflet` @ `818e9ae` -- on-stack Angular 22
  `angular.json` workspace (app `ngx-leaflet-demo`; lib `ngx-leaflet`). Use to
  sanity-check `ng add` auto-wire-all + the devDependency ensure (RF-01); the
  CI-authoritative proof is the `angular.json`-seeded integration test.

### Codebase maps (orientation)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`,
  `.planning/codebase/TESTING.md`, `.planning/codebase/CONVENTIONS.md`.

### Spike / prior context
- `.planning/phases/22-configuration-schematic-the-angular-json-write-fork/22-CONTEXT.md`
  -- the write-fork `ng-add` composes; RF-01 leaf resolution; the collision/idempotency
  semantics; the additive-safety precedence.
- `.planning/phases/21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no/21-CONTEXT.md`
  -- GATE A' = GO; the `convertNxExecutor` DEVIATION lesson (these bridges have edges,
  informs RF-01's `GeneratorCallback`-under-`ng add` sub-question).
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- the findings channel
  (v0.2.1 Angular CLI builder GATE A' = GO).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`configuration/generator.ts`** -- the shared write-fork `ng-add` composes per
  project via `configurationGenerator(tree, { project, skipFormat: true })`. Its
  `tree.exists('angular.json')` branch, `resolveTsConfigLeaves` (RF-01 Approach A),
  collision-by-builder-id, and idempotent rewrite are all inherited unchanged.
- **`init/generator.ts`** -- gets ONE additive `tree.exists('angular.json')`
  early-return fork (D-04); `TYPECHECK_EXECUTOR_ID` + `TYPECHECK_TARGET_DEFAULTS` stay
  as-is (the Nx-only seed the CLI branch skips). Nx branch byte-unchanged.
- **`src/schematics/configuration/schematic.ts`** -- the `convertNxGenerator` re-export
  template to clone for `init` (plain re-export) and `ng-add` (re-export of the new
  composed `ngAddGenerator`).
- **`nx-generators-surface-regression.spec.ts`** -- extend its `generators ?? schematics`
  assertion to the new `init`/`ng-add` entries.
- **`configuration-angular-cli.spec.ts`** -- the `angular.json`-seeded tree harness to
  mirror for the `ng-add` auto-wire-all + `init` no-stray-`nx.json` specs.

### Established Patterns
- **`convertNxGenerator` re-export (Pattern 2):** a ~2-line `export default
  convertNxGenerator(<generator>)` per schematic, compiled CJS under `module: nodenext`
  (the `tsconfig.lib.json` `include: ["src/**/*.ts"]` already covers `src/schematics/`).
  `ng-add` is the one that wraps a NEW composed generator rather than an existing one.
- **Fork-in-the-shared-generator (Phase 22):** the Angular-CLI divergence lives as an
  additive `tree.exists('angular.json')` branch INSIDE the shipped generator, never a
  duplicate CLI-only generator -- so `convertNxGenerator` re-exports the same code.
  Applied here to `init` (D-04).
- **Additive-safety precedence:** `generators ?? schematics` keeps `collection.json`
  Nx-invisible -- assert it for the new entries (ACS-04 shape), don't assume it.
- **`DevkitTreeFromAngularDevkitTree` adapter:** `@nx/devkit` `readJson`/`updateJson`/
  `readProjectConfiguration`/`addDependenciesToPackageJson`/`formatFiles` all operate
  transparently on the Angular CLI tree, so `ng-add`/`init` use the SAME helpers on both
  surfaces.

### Integration Points
- MODIFIED: `src/generators/init/generator.ts` (additive angular.json fork only);
  `collection.json` (+`init`, +`ng-add` entries); `package.json` (+optional peers).
- NEW: `src/schematics/init/schematic.ts`, `src/schematics/ng-add/{schematic.ts,schema.json,schema.d.ts}`,
  the composed `ngAddGenerator`, and the `angular.json`-seeded integration + regression
  specs. The engine, core, executor, builder, public barrel, and the `configuration`
  generator body are UNTOUCHED (only COMPOSED).

</code_context>

<specifics>
## Specific Ideas

- `ng add` -> auto-wire ALL app+library projects (the install convenience); the
  Phase-22 `configuration` schematic remains the SINGLE-project entry point for
  projects added after install. Both compose the SAME shared write-fork.
- The `init` schematic exists purely for parity/symmetry with the Nx surface; on
  Angular CLI it is intentionally a near-no-op (skip caching, no stray `nx.json`).
- `nx add angular-typechecker` (the Nx surface) is deliberately UNCHANGED from
  v0.2.0 -- still init/caching-seed only; Nx auto-wire-all is the deferred
  `createNodesV2` future (WALK-FUT-01), NOT this phase.
- Validate `ng add` auto-wire-all + the devDependency ensure against the real
  `bluehalo/ngx-leaflet` clone for confidence; the CI-authoritative proof is the
  `angular.json`-seeded integration test (repeatable, no external clone). The real
  tarball e2e is Phase 24.

</specifics>

<deferred>
## Deferred Ideas

None new -- discussion stayed within phase scope. Already-tracked deferrals live in
`REQUIREMENTS.md` Future Requirements / Out of Scope (WALK-FUT-01 `createNodesV2`
Nx auto-provisioning; real-OSS + scaffolded e2e / additive-only audit / docs
-> Phase 24 ACV-01/02/03, ACP-02, ACD-01).

</deferred>

---

*Phase: 23-init-schematic-parity-first-party-ng-add*
*Context gathered: 2026-07-10*
