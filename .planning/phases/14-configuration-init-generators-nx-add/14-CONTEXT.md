# Phase 14: configuration + init generators, nx add - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

> Captured autonomously via `/gsd-discuss-phase 14 --analyze --auto --chain`.
> Every decision below was auto-selected (recommended option) and is grounded in
> ROADMAP Phase 14 SC1-SC5, REQUIREMENTS GEN-01..09, the shipped Phase 13 walk +
> Phase 13.1 rename, the spike/board record, and a concrete codebase scout
> (nx.json, package.json, executors.json, project.json, plus the first-party
> `@nx/vitest`/`@nx/eslint` `init`+`configuration` pattern in `node_modules`).
> Each gray area was rated on IMPACT x CONFIDENCE per the auto-lock discipline;
> NONE landed in the high-impact / not-high-confidence quadrant, so none is left
> as a BLOCKER. The one borderline item (nx-add -> init wiring, D-06) is
> auto-locked with an explicit RESEARCH-VERIFY flag for the phase researcher --
> its residual uncertainty is a verifiable Nx-source fact, not a user preference.
> Trade-off tables are recorded in `14-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Ship the FIRST generators for this plugin: a `configuration` generator and a
standalone `init` generator, plus `nx add angular-typechecker` support. All work
is **config-edit only** (`project.json` + `nx.json`) with **NO file emission**
(no `generateFiles`), building on the already-shipped Phase 13 reference-walking
engine and the Phase 13.1 `angular-typechecker:typecheck` executor id.

**In scope:**
- `nx g angular-typechecker:configuration <project>` -- wires ONE minimal
  `typecheck` target (executor `angular-typechecker:typecheck`,
  `options.tsConfig`) into the project's `project.json`, pointed at the project's
  solution `tsconfig.json` (relying on WALK-01), via
  `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`.
  `--tsConfig` override; flat-project leaf fallback; configurable `targetName`
  (default `typecheck`); idempotent + non-ours-collision-safe.
- `nx g angular-typechecker:init` (standalone) -- idempotently seeds
  `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the WALK-02
  cacheable block (`cache:true`, `outputs:[]`, `default`-based inputs, never
  `production`), keyed by the UNSCOPED published id, never clobbering a
  customized entry. `configuration` invokes `init` (GEN-08).
- `nx add angular-typechecker` -- auto-runs the registered `init` generator on
  install (GEN-09), seeding `targetDefaults` cacheable-on-install.
- Packaging: hand-authored `schema.json` + `schema.d.ts` per generator; root
  `generators.json` (each entry keyed `factory`); `package.json` `generators`
  field; tarball `files` + build `assets` updated so both generators ship.
- Unit tests on the public in-memory `createTreeWithEmptyWorkspace` substrate
  (+ schema-parity spec per generator).

**Out of scope (this phase):**
- The generator END-TO-END proof against the installed tarball, the `nx add`
  e2e scenario, and the CI `-p` set-equality guard -- those are **Phase 15**
  (GE2E-01..03, GUARD-01). This phase's tests are in-plugin unit only.
- `ng add` (Angular CLI) install schematic + Angular CLI `angular.json`
  workspace support (GEN-FUT-02 / GEN-FUT-01, deferred).
- `createNodesV2` inferred granular per-leaf targets (WALK-FUT-01, deferred).
- The bespoke real-disk `createFsTree`/`flushFsTreeChanges` helper (FSTREE-01,
  board Option A -- NOT built; the generator emits no files).
- Any engine/executor change (Phase 13/13.1 shipped those); no per-project-type
  `tsConfig` detection and no separate spec target (both EVAPORATE via the walk).

</domain>

<decisions>
## Implementation Decisions

### Generator source layout + registration (GA-1)
- **D-01 (Layout mirrors the executor tier):** Both generators live under
  `packages/angular-typechecker/src/generators/<name>/` --
  `.../configuration/` and `.../init/` -- each carrying `generator.ts`
  (default-export async Nx generator fn), `schema.json`, `schema.d.ts`, a
  co-located `<name>.spec.ts`, and a `schema-parity.spec.ts`. This matches the
  established `src/executors/typecheck/` shape (see STRUCTURE.md "Where to Add
  New Code" -> "New Nx executor"), so the build/asset/test conventions already
  in place carry over unchanged.
- **D-02 (New root `generators.json`, `factory`-keyed):** Add
  `packages/angular-typechecker/generators.json` registering both generators,
  each entry keyed with `factory` -> the extensionless COMPILED path
  (`./src/generators/<name>/generator`) + `schema` (`./src/generators/<name>/schema.json`)
  + a `description`. Add `"generators": "./generators.json"` to the published
  `package.json`. This mirrors the first-party pattern verified in
  `node_modules/@nx/vitest/generators.json` (`init` + `configuration`, both
  `factory`) and `node_modules/@nx/eslint/generators.json` (`init#initEsLint`).
- **D-03 (Ship it in the tarball):** `generators.json` needs its OWN build
  `assets` glob (`{ input: ./packages/angular-typechecker, glob: "generators.json",
  output: "." }`) alongside the existing `executors.json` entry in
  `packages/angular-typechecker/project.json`, AND must be added to the
  `package.json` `files` allowlist (currently `src`, `executors.json`,
  `README.md`, `LICENSE`). The per-generator `schema.json` files are already
  copied by the existing `**/!(*.ts)` asset glob and `schema.d.ts` by the
  `**/*.d.ts` glob (both under `src/`), so only the root `generators.json`
  needs the extra wiring. (The Phase 15 tarball-audit expected-files list will
  need the new paths -- noted for Phase 15, not built here.)

### `init` generator -- targetDefaults seeding (GA-2)
- **D-04 (Seed the UNSCOPED id with the VERBATIM WALK-02 block):** `init`
  seeds `nx.json` `targetDefaults` under the UNSCOPED published executor id
  **`angular-typechecker:typecheck`** only (NOT the scoped dev-repo key
  `@angular-typechecker/angular-typechecker:typecheck`, which exists only
  because this repo aliases its own package). The seeded value is the EXACT
  block currently in this repo's `nx.json` (copy verbatim, do not hand-retype):
  ```jsonc
  {
    "cache": true,
    "outputs": [],
    "inputs": [
      "default",
      "{projectRoot}/tsconfig*.json",
      "{projectRoot}/package.json",
      "{workspaceRoot}/tsconfig.base.json",
      "^default",
      { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true },
      { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
    ]
  }
  ```
  The `default` (NOT `production`) input is load-bearing: `production` excludes
  `*.spec.ts`, which would under-hash spec sources the walk type-checks ->
  stale PASS (the WALK-02 landmine). Use `readNxJson`/`updateNxJson` from
  `@nx/devkit`.
- **D-05 (Whole-entry `??=` don't-clobber):** If
  `targetDefaults["angular-typechecker:typecheck"]` already exists (any shape),
  `init` leaves it UNTOUCHED -- the user may have customized it. Seed only when
  the key is absent. (Interpret GEN-07's "per-key `??=`" as whole-entry
  don't-clobber at the `targetDefaults` key level; the planner MAY refine to a
  finer sub-key `??=` if research shows first-party `init`s do so, but
  whole-entry is the safe default and satisfies "never clobber a customized
  entry".)

### `nx add` -> `init` wiring (GA-3) -- borderline, RESEARCH-VERIFY
- **D-06 (Register `init` by name; rely on the first-party nx-add contract):**
  Register the generator literally as `init` in `generators.json` (as
  `@nx/vitest` and `@nx/eslint` both do). `nx add angular-typechecker` then runs
  the package's `init` generator on install (GEN-09).
  **RESEARCH-VERIFY (MANDATORY for the phase researcher):** confirm the EXACT
  Nx 23.0.1 `nx add` discovery contract against the Nx source / first-party
  behavior BEFORE implementing -- specifically (a) whether `nx add` invokes the
  generator named `init` directly, (b) whether an `aliases: ["ng-add"]` entry on
  the `init` generator is REQUIRED or merely conventional (`@nx/vitest`'s `init`
  carries `aliases: ["ng-add"]`; `@nx/eslint`'s does not), and (c) whether
  `package.json` needs anything beyond the `generators` field. This is the
  single public install contract in the phase; getting it wrong makes `nx add`
  silently skip seeding. **Do NOT** ship an Angular-CLI `ng add` schematic
  surface (GEN-FUT-02 stays deferred) -- an `ng-add` ALIAS, if research shows
  nx-add needs it, exists only to satisfy Nx's discovery, not to add an Angular
  CLI schematic.

### `configuration` -- tsConfig resolution (GA-5)
- **D-07 (Resolution order):** Resolve the target's `tsConfig` as:
  1. explicit `--tsConfig` wins (honored verbatim, project-root-relative);
  2. else the project's solution `tsconfig.json` IF it exists and has
     `references[]` -> point the ONE target at it (relies on WALK-01 to walk the
     in-project leaves incl. `tsconfig.spec.json`);
  3. else **flat-project fallback** -> the leaf tsconfig by Nx `projectType`
     (`application` -> `tsconfig.app.json`, `library` -> `tsconfig.lib.json`)
     with an fs existence probe;
  4. else error clearly (no resolvable tsconfig).
  Nx workspaces only; Angular CLI `angular.json` layouts deferred; prod
  tsconfigs (e.g. `tsconfig.lib.prod.json`) are NOT referenced by the solution
  tsconfig and so are not walked. Spec checking is automatic via the walk in
  case (2); in the flat fallback (3) spec checking is out of the single leaf
  target's scope and left to the consumer (GEN-03).

### `configuration` -- target write, idempotency, collision (GA-4)
- **D-08 (One minimal target, config-edit only):** Write ONE target named
  `targetName` (default `typecheck`) with `executor: "angular-typechecker:typecheck"`
  and `options.tsConfig` = the resolved path, via
  `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`. NO
  `generateFiles`, NO file emission. Caching is NOT inlined on the target -- it
  is delegated to `init` (D-04).
- **D-09 (Idempotent for ours, error for non-ours):** A re-run is idempotent
  when a same-named target already exists AND is OURS (its `executor` ===
  `angular-typechecker:typecheck`) -- rewrite it to the same shape, no
  duplicate. When a same-named target exists that is NOT ours (different
  executor), THROW a clear, located error (do not clobber). The configurable
  `targetName` lets a consumer sidestep a genuine name clash.
- **D-10 (`configuration` invokes `init`):** `configuration` calls the `init`
  generator as part of its run (GEN-08), so one
  `nx g angular-typechecker:configuration <project>` both seeds workspace
  `targetDefaults` (via `init`) and wires the project's minimal target -- the
  idiomatic first-party pattern (`@nx/eslint:lint-project` -> `lintInitGenerator`,
  `@nx/vitest:configuration` -> `init`).

### Claude's Discretion
- **D-11 (Schema option surface -- LOW impact, planner may refine):**
  Recommended `configuration` schema: `project` (string, required,
  `$default: { $source: "argv", index: 0 }`), `tsConfig` (string, optional),
  `targetName` (string, default `"typecheck"`), `skipFormat` (boolean, default
  `false`); `additionalProperties: false`, `cli: "nx"`. Recommended `init`
  schema: minimal -- `skipFormat` (boolean, default `false`) or no options;
  `additionalProperties: false`, `cli: "nx"`. `schema.json` <-> `schema.d.ts`
  parity is enforced by a `schema-parity.spec.ts` per generator (same mechanism
  the executor tier uses). The planner may rename/trim options; keep the pair in
  parity.

### Testing (GA-7 -- carried forward, board-locked)
- **D-12 (In-memory substrate only, this phase):** Unit tests run on the PUBLIC
  in-memory `createTreeWithEmptyWorkspace` (`@nx/devkit/testing`) per board
  decision D1 + GEN-06: assert the `configuration` target write for BOTH the
  solution-tsconfig case AND the flat-project fallback, plus idempotency and the
  non-ours collision error; assert the `init` seed shape, an idempotent re-run,
  don't-clobber, and `default`-not-`production`; plus a schema-parity spec per
  generator. The bespoke real-disk `createFsTree` helper is NOT built
  (FSTREE-01 deferred). Real-disk / install fidelity is Phase 15's tarball e2e.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirement & goal
- `.planning/ROADMAP.md` -- "Phase 14: configuration + init generators, nx add"
  (Goal + SC1-SC5, the authoritative success criteria).
- `.planning/REQUIREMENTS.md` -- **GEN-01..GEN-09** (the full generator-suite
  spec: config-edit-only `configuration`, standalone `init`, `configuration`
  calls `init`, `nx add`, schema/registration/packaging, in-memory tests).
- `.planning/REQUIREMENTS.md` -- **WALK-02** (the exact cacheable
  `targetDefaults` block `init` must reproduce; `default`-not-`production`).

### Prior-phase context this phase builds on
- `.planning/phases/13-engine-solution-tsconfig-reference-walking/13-CONTEXT.md`
  -- the walk contract the single target relies on (union+dedupe,
  boundary-guard, coarse cache; WALK-02 caching value).
- `.planning/phases/13.1-rename-angular-typecheck-executor-to-typecheck/13.1-CONTEXT.md`
  -- the renamed id `angular-typechecker:typecheck` (unscoped) + scoped
  `@angular-typechecker/angular-typechecker:typecheck` the target/targetDefaults
  use; the rename-discipline landmine (never bare-replace `angular-typecheck`).

### Strategy of record (WHY the shape is what it is)
- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` -- board decision D1
  (in-memory `createTreeWithEmptyWorkspace`; generator emits no files; NO
  bespoke FsTree) and the folded-e2e / `-p` guard decisions (Phase 15).
- `.planning/spikes/MANIFEST.md` -- spikes 001-005 (all VALIDATED, GO) that
  resolved the GEN-02/03 shape to ONE walk target (per-project-type detection
  and a separate spec target evaporate).

### Live source anchors (read before editing)
- `nx.json` -- the authoritative `targetDefaults["angular-typechecker:typecheck"]`
  WALK-02 block to copy verbatim into `init` (D-04); note BOTH the unscoped and
  scoped keys exist here (seed only the unscoped one).
- `packages/angular-typechecker/executors.json` -- the shape/idiom to mirror for
  the new `generators.json` (extensionless compiled path, `schema`,
  `description`).
- `packages/angular-typechecker/package.json` -- `files` allowlist + `executors`
  field to extend with `generators`.
- `packages/angular-typechecker/project.json` -- the build `assets` globs
  (`**/!(*.ts)`, `**/*.d.ts`, `executors.json`) to extend for `generators.json`.
- `.planning/codebase/STRUCTURE.md` -- "Where to Add New Code" (executor tier as
  the layout analog for the generator tier).
- First-party reference (read-only, in `node_modules`):
  `node_modules/@nx/vitest/generators.json` and
  `node_modules/@nx/eslint/generators.json` -- the `init` + `configuration`
  `factory` registration pattern, and `@nx/vitest`'s `init` `aliases: ["ng-add"]`
  (relevant to D-06's nx-add research).

### Release / execution mechanics (constraints, not scope)
- `AGENTS.md` -- "Parallel execution in git worktrees: the `node_modules`
  junction" (if the planner splits Phase 14 into parallel plans) and the
  Conventional-Commits rules (a `feat(...)` touching the package counts toward
  the version; the 0.1.0 cut itself is the milestone Release PR, not this phase).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Executor tier as the structural template:** `src/executors/typecheck/`
  (executor.ts + schema.json + schema.d.ts + normalize-options + specs +
  schema-parity.spec.ts) is the exact analog for the new
  `src/generators/{configuration,init}/` tier. The `schema-parity.spec.ts`
  mechanism is directly reusable per generator.
- **`executors.json` + its build asset glob + `files` entry** are the proven
  registration/packaging pattern to copy for `generators.json`.
- **The verbatim WALK-02 `targetDefaults` block in `nx.json`** is the exact
  value `init` seeds -- no invention needed, copy it.

### Established Patterns
- **Config-edit generators only (no `generateFiles`):** the whole phase edits
  `project.json` + `nx.json` via devkit (`readProjectConfiguration`/
  `updateProjectConfiguration`/`formatFiles`/`readNxJson`/`updateNxJson`); the
  generator emits NO files (board D1). This is why FsTree stays unbuilt.
- **`@nx/devkit` is a pinned runtime `dependency`** (not a peer) -- generators
  may import from `@nx/devkit` freely; the core engine purity rule
  (no `@nx/devkit` in `src/core/`) does NOT constrain the generator tier.
- **`@nx/dependency-checks` (ERROR) polices the published `package.json`:** any
  new import in the generator tier must be a declared dependency; devkit +
  tslib already are.

### Integration Points
- `nx.json` `targetDefaults` (both id forms present) -- `init` writes the
  unscoped-id entry into a CONSUMER's nx.json; the dev-repo's own entries stay
  as-is.
- `packages/angular-typechecker/package.json` `generators` field + `files`;
  `project.json` build `assets`; new root `generators.json` -- the packaging
  surface that makes `nx add` + `nx g` discover the generators.
- Phase 15 (downstream) consumes this phase's shipped `generators.json` +
  registered generators for the tarball e2e and the `nx add` e2e; the
  Phase 15 `tarball-audit` expected-files list will need the new generator paths.

</code_context>

<specifics>
## Specific Ideas

- Concrete new values: `generators.json` entries `configuration`
  (`factory: ./src/generators/configuration/generator`,
  `schema: ./src/generators/configuration/schema.json`) and `init`
  (`factory: ./src/generators/init/generator`,
  `schema: ./src/generators/init/schema.json`); `package.json`
  `"generators": "./generators.json"`; `files` gains `"generators.json"`;
  seeded targetDefaults key `angular-typechecker:typecheck` (unscoped).
- Prefer the first-party plugins as the copy-source of truth over the private
  prior art: `@nx/vitest` (`configuration` + `init`) and `@nx/eslint`
  (`init#initEsLint`, `lint-project` -> `lintInitGenerator`) are the idiomatic
  templates the milestone was re-scoped against. (Any Connect prior-art
  reference stays READ-ONLY and fully sanitized -- no proprietary identifiers.)

</specifics>

<deferred>
## Deferred Ideas

All already tracked in REQUIREMENTS.md "Future Requirements" / "Out of Scope"
and STATE.md "Deferred Items" -- none newly surfaced this phase:
- **GE2E-01..03 + GUARD-01** -- generator/nx-add tarball e2e + the `-p`
  set-equality CI guard -> **Phase 15** (not this phase).
- **FSTREE-01** -- bespoke real-disk `createFsTree`/`flushFsTreeChanges`
  (board Option A; only if a future generator emits files).
- **GEN-FUT-01 / GEN-FUT-02** -- Angular CLI `angular.json` generator support /
  `ng add` (Angular CLI) install schematic.
- **WALK-FUT-01** -- `createNodesV2` inferred granular per-leaf `typecheck`
  targets (the granular counterpart to this phase's coarse single target).

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 14-configuration-init-generators-nx-add*
*Context gathered: 2026-07-02*
