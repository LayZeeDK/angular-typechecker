# Phase 22: `configuration` schematic + the `angular.json` write-fork - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended options auto-locked; `--analyze` trade-off tables logged in DISCUSSION-LOG.md). Trap-quadrant check applied per the `--auto` discuss rule -- see the "Trap-quadrant assessment" note in `<decisions>`. No user BLOCKER surfaced; all locked decisions are evidence-backed (source-verified in the v0.2.1 research), and the one genuinely open item (leaf-set discovery) is flagged as a Phase-22 research question rather than auto-locked.

<domain>
## Phase Boundary

`ng generate angular-typechecker:configuration <project>` wires ONE per-project
`typecheck` architect target into `angular.json`, scoped to exactly that project's
complete leaf set, via a single shared generator with a `tree.exists('angular.json')`
write-fork -- leaving the Nx generator path byte-unchanged.

**In scope (Phase 22 -- ACS-01, ACS-02, ACS-04, COV-01):**
- The `tree.exists('angular.json')` write-fork inside the SHARED `configuration`
  generator (`src/generators/configuration/generator.ts`): on an Angular CLI workspace,
  write the `architect.<targetName>` target directly into `angular.json` with
  `builder: 'angular-typechecker:typecheck'` and `tsConfig: [<build leaf>, <spec leaf>]`;
  config-edit-only (no emitted file), idempotent, collision-safe. (ACS-01)
- The Nx branch stays behavior-unchanged: init-first, `updateProjectConfiguration`,
  single-string solution `tsConfig`. (ACS-02)
- Register `convertNxGenerator(configurationGenerator)` in a NEW `collection.json`
  (`schematics`), add the `package.json` `schematics` field + `files` entry additively;
  assert `nx g angular-typechecker:configuration` still resolves (`generators ?? schematics`
  precedence -- the ACS-04 Nx-surface regression, mirroring the Phase-21 ACB-03
  `executors ?? builders` spec). (ACS-04)
- Prove per-project scoping: a per-project `typecheck` target checks that project's
  COMPLETE leaf set (application+spec, or library+spec) and ONLY its leaves, no
  cross-project bleed. (COV-01)

**Out of scope (other phases / charter):**
- `init` schematic parity + first-party `ng-add` auto-wire-all + optional-peer
  classification -> Phase 23 (ACS-03, NGADD-01, ACP-01).
- Real-OSS tarball e2e + scaffolded automated e2e + additive-only audit + docs
  -> Phase 24 (ACV-01/02/03, ACP-02, ACD-01).
- The builder (`ng run <project>:typecheck`) + the `tsConfig: string | string[]`
  engine widening -> ALREADY SHIPPED in Phase 21 (ACB-01/02/03, ENG-01). Phase 22
  CONSUMES the array `tsConfig` and the builder id; it does not modify the engine or
  the builder.
- Any hand-written `@angular-devkit/schematics` Rule for `configuration` (charter:
  the thin `convertNxGenerator` re-export over the shared generator; a hand-written
  adapter would fork the engine -> v0.3.0 scope).
- Emitted per-project solution tsconfig (superseded by `tsConfig: string[]`, Option A);
  runtime `angular.json`/tsconfig parsing in the builder (leaves resolved at
  generate-time and written into the target).

</domain>

<decisions>
## Implementation Decisions

> **Trap-quadrant assessment (per the `--auto` discuss rule):** Phase 22's design is
> LOCKED and source-verified in `.planning/research/v0.2.1-angular-cli/` (Option A
> `tsConfig:[buildLeaf,specLeaf]`; the `tree.exists('angular.json')` fork inside the
> shared generator; direct `updateJson` edit with zero new production dependency; the
> `generators ?? schematics` additive-safety precedence). Those are HIGH-confidence
> evidence-backed auto-locks (D-01..D-06), not bare defaults -- outside the trap
> quadrant. The ONE genuinely NOT-HIGH-confidence item -- how the CLI branch discovers
> a project's `[buildLeaf, specLeaf]` set (RF-01) -- is an implementation-approach /
> researcher question (GSD philosophy: codebase patterns + technical approach belong to
> the researcher, not the user), not a user-vision fork. It is recorded as a Phase-22
> research flag with a starting hypothesis, NOT auto-locked as settled. No HIGH-impact +
> NOT-HIGH-confidence USER decision exists, so there is no UNRESOLVED user BLOCKER.

### Write-fork location + shape (ACS-01, ACS-02 -- LOCKED)
- **D-01:** ONE shared `configuration` generator with an early `tree.exists('angular.json')`
  fork (Architecture Option A). Angular CLI branch -> write the target into
  `angular.json` at `projects.<project>.architect.<targetName>`; Nx branch -> the
  EXISTING path (`updateProjectConfiguration` + init-first), byte-unchanged. Option B
  (a separate Angular-CLI generator) is REJECTED (duplicates resolution/collision logic,
  drift risk). `convertNxGenerator(configurationGenerator)` then re-exports this same
  generator for free. Source: `ARCHITECTURE.md` "The crux fork" + "Option A".
- **D-02:** The CLI target shape uses the Angular CLI vocabulary -- `builder`
  (NOT `executor`) with the SAME id string `angular-typechecker:typecheck`, and
  `tsConfig` as an ARRAY of the project's leaves:
  `{ "builder": "angular-typechecker:typecheck", "options": { "tsConfig": [<buildLeaf>, <specLeaf>] } }`.
  The array is consumed by the ENG-01 union-then-single-`finalize` engine already
  shipped in Phase 21 and filtered by the v0.2.0 input-set-membership boundary over the
  combined declared input sets. NO emitted per-project solution tsconfig; NO
  directory-boundary change. Source: SUMMARY.md CORRECTION point 2 + ROADMAP Phase 22 SC1
  + 21-CONTEXT D-06.

### How `angular.json` is written (LOCKED)
- **D-03:** Edit `angular.json` via the `@nx/devkit` `readJson`/`updateJson` tree helpers
  that ALREADY operate transparently on the `DevkitTreeFromAngularDevkitTree` adapter
  tree -- NOT `updateProjectConfiguration` (which throws on an Angular CLI app and
  mis-writes a lib's `package.json` `nx` block; nrwl/nx#19104). Direct JSON edit needs
  ZERO new production dependency (charter). `@schematics/angular/utility`'s
  `updateWorkspace` is the more idiomatic alternative ONLY if a dependency were
  acceptable -- it is NOT (additive-only, zero-new-dep). Source: `ARCHITECTURE.md`
  "The init / caching-gap fork -- resolution" + `PITFALLS.md` Pitfall 2.

### `init` gating on the CLI branch (LOCKED)
- **D-04:** The CLI branch does NOT invoke the Nx `init` generator -- Angular CLI has no
  `nx.json` / `targetDefaults` / task cache to seed, and `updateNxJson` is a verified
  no-op off-Nx anyway (`nx-json.js` early-return; it creates NO stray `nx.json`). Gate it
  out explicitly (cleaner + avoids a redundant `formatFiles` round-trip) rather than
  relying on the incidental no-op. The Nx branch KEEPS the init-first composition
  unchanged (GEN-08/D-10). Source: `ARCHITECTURE.md` "The workspace-substrate divergence"
  + `PITFALLS.md` Pitfall 3. (The `init` SCHEMATIC parity + the "no target caching"
  notice are Phase 23, not here.)

### Idempotency + collision + targetName (ACS-01 -- LOCKED, mirror the shipped Nx path)
- **D-05:** Reuse the shipped generator's collision/idempotency semantics on the CLI
  branch: default `targetName` = `typecheck`; reject an empty/whitespace `--targetName`;
  collision-check by the target's `builder` id (`angular-typechecker:typecheck`, the
  SAME string as the executor id) -- a same-named target that is NOT ours throws a clear
  located error; a re-run of OUR target is idempotent, preserving user-added keys
  (`configurations`) and extra `options` (`maxWarnings`, `includeDeps`, `failFast`,
  `strict`), re-asserting only the id + resolved `tsConfig`. Source:
  `src/generators/configuration/generator.ts` (GEN-04/D-09) -- mirror it, don't re-invent.

### Additive-safety / Nx-surface regression (ACS-04 -- LOCKED)
- **D-06:** `collection.json` + the `package.json` `schematics` field + a `files`
  whitelist entry are NEW SIBLINGS of `generators.json` / the `generators` field, never
  edits of them. Nx resolves `generators ?? schematics` (nx `generator-utils.js` L57), so
  the new `collection.json` is Nx-invisible and `nx g angular-typechecker:configuration`
  is byte-unchanged. Add a `generators ?? schematics` regression assertion mirroring
  Phase 21's `executors ?? builders` spec
  (`src/builders/typecheck/nx-surface-regression.spec.ts`). Source: `ARCHITECTURE.md`
  "Additive-safety" (source-verified) + SUMMARY.md point on the two new fields.

### Test substrate for the write-fork (ACS-01/ACS-02/COV-01 -- LOCKED)
- **D-07:** Integration-test BOTH substrates using an `angular.json`-SEEDED schematics
  test tree (NOT bare `createTreeWithEmptyWorkspace`): (a) the Nx tree path still writes
  a single-string solution `tsConfig` via `project.json`, byte-unchanged; (b) the
  `angular.json` tree path writes the `architect` target with the leaf ARRAY, creates NO
  stray `nx.json`, and is idempotent + collision-safe. Prove COV-01 per-project scoping
  (the target checks ONLY that project's leaves, no cross-project bleed) at the unit/
  integration tier here; the fresh-scaffold `ng g library` real proof is Phase 24 (ACV-02).
  Source: `SUMMARY.md` "Implications for Roadmap" Phase 2 Test note.

### Claude's Discretion
- Plan decomposition (how many plans; whether the write-fork + `collection.json` +
  the regression assertion split across plans or land as one). Researcher + planner
  decide, grounded in the canonical refs.
- Whether the CLI-branch leaf resolution is factored as a new helper alongside the
  existing `resolveTsConfig` (which returns a single solution path for the Nx branch)
  or as an added return-mode of it. Keep the Nx-branch `resolveTsConfig` output
  byte-identical either way.

### Phase-22 Research Flag (NOT auto-locked -- for gsd-phase-researcher)
- **RF-01 (leaf-set discovery -- the primary Phase-22 research question):** HOW does the
  CLI branch determine a project's `[buildLeaf, specLeaf]` for a given
  `angular.json#projects.<project>`? Competing approaches, to be resolved empirically
  against the `bluehalo/ngx-leaflet` clone AND a freshly scaffolded workspace:
  - **(A) projectType-convention + existence-probe** -- `application` ->
    `<root>/tsconfig.app.json`, `library` -> `<root>/tsconfig.lib.json`, plus
    `<root>/tsconfig.spec.json`, each existence-probed; drop a missing leaf. Mirrors the
    existing `resolveTsConfig` branch-3 flat-project fallback and matches the 21-CONTEXT
    D-06 examples (`["tsconfig.app.json","tsconfig.spec.json"]`,
    `["projects/ngx-leaflet/tsconfig.lib.json","projects/ngx-leaflet/tsconfig.spec.json"]`).
  - **(B) read the project's own architect targets** -- take `buildLeaf` from
    `architect.build.options.tsConfig` and `specLeaf` from `architect.test.options.tsConfig`
    in `angular.json` (the CLI's own source of truth); more robust to custom layouts.
  - **Starting hypothesis (recommended, NOT locked):** prefer (B) where the build/test
    targets exist, fall back to (A) convention + existence-probe. Verdict is the
    researcher's, grounded in the two substrates. This is HIGH-impact (COV-01 correctness
    + Phase 23 `ng-add` / Phase 24 e2e inherit it) but reversible within the milestone
    and explicitly test-gated -- deliberately left to research, not auto-locked.
  - Related edge: a project with NO spec leaf (or no build leaf) -> the recommended
    default is an existence-probe that emits `[buildLeaf]` (or the single available leaf)
    rather than throwing; confirm during research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (LOCKED decisions -- read FIRST)
- `.planning/research/v0.2.1-angular-cli/SUMMARY.md` -- CORRECTION & LOCKED DECISIONS
  (Option A `tsConfig: string|string[]`, `ng add` auto-wire-all vs single-project
  `configuration`, the executor-unchanged / generator-write-fork ASYMMETRY, VOID
  Pitfall 8). This section wins over everything else.
- `.planning/research/v0.2.1-angular-cli/ARCHITECTURE.md` -- THE crux for Phase 22: "The
  workspace-substrate divergence" table (`readProjectConfiguration` polyfill vs
  `updateProjectConfiguration` no-write-branch), "Option A (RECOMMENDED)", the
  `angular.json` target JSON shape, the Data Flow "Angular CLI configure (with the write
  fork)" diagram, and the source-verified additive-safety precedence.
- `.planning/research/v0.2.1-angular-cli/PITFALLS.md` -- Pitfall 2
  (`updateProjectConfiguration` cannot write `angular.json`), Pitfall 3 (`init` no-op
  off-Nx), Pitfall 8 (VOID -- per-project coverage delivered by `tsConfig:[buildLeaf,specLeaf]`).

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` -- ACS-01, ACS-02, ACS-04, COV-01; the ADDITIVE-ONLY charter.
- `.planning/ROADMAP.md` -- Phase 22 Goal / Success Criteria; Phase 23-24 dependencies.

### Existing code to MODIFY / mirror (this phase)
- `packages/angular-typechecker/src/generators/configuration/generator.ts` -- the SHARED
  generator to add the `tree.exists('angular.json')` fork to; `resolveTsConfig` (D-07
  resolution order), the collision-by-id + idempotent-rewrite logic (GEN-04/D-09), and
  the init-first composition (GEN-08/D-10) to preserve on the Nx branch and mirror on CLI.
- `packages/angular-typechecker/src/generators/configuration/{schema.json,schema.d.ts}` --
  the shared `ConfigurationGeneratorSchema` (`project`, `tsConfig?`, `targetName?`,
  `skipFormat?`); reused verbatim by the schematic.
- `packages/angular-typechecker/src/generators/init/generator.ts` -- exports
  `TYPECHECK_EXECUTOR_ID` (the `angular-typechecker:typecheck` id used for collision
  checks and as the CLI `builder` id); the Nx caching seed the CLI branch skips.
- `packages/angular-typechecker/generators.json` + `collection.json` (NEW) -- the Nx
  manifest (untouched) + the new schematics manifest to add.
- `packages/angular-typechecker/package.json` -- current `executors`/`generators`/`builders`
  fields + `files`; where the additive `schematics` field + `collection.json`/schematic
  `files` entries land.

### Mirror-these test patterns (Phase 21 precedents)
- `packages/angular-typechecker/src/builders/typecheck/nx-surface-regression.spec.ts` --
  the `executors ?? builders` regression assertion to mirror as `generators ?? schematics`
  for ACS-04.
- `packages/angular-typechecker/src/generators/configuration/configuration.spec.ts` --
  the existing generator behavior spec (Nx tree); extend/parallel it with an
  `angular.json`-seeded tree.
- `packages/angular-typechecker/src/generators/configuration/schema-parity.spec.ts` --
  the schema-parity pattern (if the schematic needs a sanitized schema; likely the
  shared generator `schema.json` is reused verbatim -- confirm).

### Real-clone substrate (dev/debug; uncommitted)
- `D:\projects\github\bluehalo\ngx-leaflet` @ `818e9ae` -- on-stack Angular 22
  `angular.json` workspace (app `ngx-leaflet-demo`: `tsconfig.app.json`+`tsconfig.spec.json`;
  lib `ngx-leaflet`: `projects/ngx-leaflet/tsconfig.lib.json`+`tsconfig.spec.json`). Use
  to validate RF-01 leaf discovery + a real `ng generate ...:configuration` write.

### Codebase maps (orientation)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`,
  `.planning/codebase/TESTING.md`, `.planning/codebase/CONVENTIONS.md`.

### Spike / prior context
- `.planning/phases/21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no/21-CONTEXT.md`
  -- GATE A' = GO, the shipped builder + `tsConfig: string|string[]` engine that Phase 22
  consumes (D-06 array-union-then-single-`finalize`).
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- the findings channel
  (v0.2.1 Angular CLI builder GATE A' = GO).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`configuration/generator.ts`** -- add ONE early `tree.exists('angular.json')` branch;
  everything else (targetName default + empty-name reject, collision-by-id, idempotent
  rewrite preserving user keys, single `formatFiles` at the end) is reused as-is. The Nx
  branch is the current body verbatim.
- **`resolveTsConfig`** -- returns the single WORKSPACE-root-relative solution path the Nx
  branch writes; the CLI branch needs a leaf-ARRAY resolver (RF-01) that reuses the same
  `tree.exists` probing discipline (virtual `Tree` only, never `node:fs`).
- **`TYPECHECK_EXECUTOR_ID`** (from `init/generator.ts`) -- the `angular-typechecker:typecheck`
  id; identical string for the Nx `executor` and the CLI `builder`, so the collision check
  is uniform across branches.
- **Phase-21 `nx-surface-regression.spec.ts`** -- clone its `executors ?? builders` shape to
  `generators ?? schematics` for ACS-04.

### Established Patterns
- **`convertNxGenerator` re-export (Pattern 2):** `src/schematics/configuration/schematic.ts`
  = `export default convertNxGenerator(configurationGenerator)` (~2 lines); registered in
  `collection.json`. Must compile CJS under `module: nodenext` like the executor/builder
  (the `tsconfig.lib.json` `include: ["src/**/*.ts"]` already covers `src/schematics/`).
- **Additive-safety precedence:** `generators ?? schematics` keeps `collection.json`
  Nx-invisible -- assert it (ACS-04), don't assume it.
- **`DevkitTreeFromAngularDevkitTree` adapter:** `@nx/devkit` `readJson`/`updateJson`/
  `readProjectConfiguration`/`formatFiles` all operate transparently on the Angular CLI
  tree, so the write-fork uses the SAME helpers on both branches (only the write TARGET
  differs: `angular.json#architect` vs `project.json`/`updateProjectConfiguration`).

### Integration Points
- MODIFIED: `src/generators/configuration/generator.ts` (the write-fork branch only).
- NEW: `src/schematics/configuration/schematic.ts`, `collection.json`, the `package.json`
  `schematics` field + `files` entries, the ACS-04 regression spec, and the
  `angular.json`-seeded integration spec(s). The engine, core, executor, builder, public
  barrel, and the `init` generator body are UNTOUCHED.

</code_context>

<specifics>
## Specific Ideas

- The CLI `configuration` target is the SINGLE-project entry point (a project added after
  install); `ng add` auto-wire-all is Phase 23. Both compose the SAME write-fork.
- Leaves are resolved at generate-time and written into the target (no runtime
  `angular.json`/tsconfig parsing in the builder).
- Validate the write-fork against the real `bluehalo/ngx-leaflet` clone for a confidence
  check, but the CI-authoritative proof is the `angular.json`-seeded integration test
  (repeatable, no external clone).

</specifics>

<deferred>
## Deferred Ideas

None new -- discussion stayed within phase scope. Already-tracked deferrals live in
`REQUIREMENTS.md` Future Requirements / Out of Scope (WALK-FUT-01 `createNodesV2`
inference; `init` schematic parity + `ng-add` -> Phase 23; e2e/docs/additive-audit
-> Phase 24).

</deferred>

---

*Phase: 22-configuration-schematic-the-angular-json-write-fork*
*Context gathered: 2026-07-10*
