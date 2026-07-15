---
phase: 22
phase_name: "configuration-schematic-the-angular-json-write-fork"
project: "angular-typechecker"
generated: "2026-07-10"
counts:
  decisions: 5
  lessons: 4
  patterns: 4
  surprises: 2
missing_artifacts:
  - "UAT.md"
---

# Phase 22 Learnings: configuration-schematic-the-angular-json-write-fork

## Decisions

### Leaf discovery uses Approach A (projectType-convention + existence-probe)
The Angular CLI branch resolves a project's `[buildLeaf, specLeaf]` by convention
(`application -> <root>/tsconfig.app.json`, `library -> <root>/tsconfig.lib.json`, plus
`<root>/tsconfig.spec.json`), each `tree.exists`-probed, in a new `resolveTsConfigLeaves`
helper. Approach B (reading the project's own `architect.build`/`architect.test` `tsConfig`)
was rejected.

**Rationale:** The default Angular library builder `@angular/build:ng-packagr` carries NO
`tsConfig` in `build.options` (it lives under `configurations.{development,production}`), so
Approach B silently misses the library build leaf. Approach A works on both real substrates and
reproduces the expected leaf arrays exactly.
**Source:** 22-RESEARCH.md (RF-01), 22-01-SUMMARY.md

### Edit angular.json via @nx/devkit updateJson (zero new dependency)
The write-fork edits `angular.json` directly with `updateJson`, NOT `updateProjectConfiguration`
(throws on an Angular CLI app / mis-writes a lib's package.json `nx` block off-Nx) and NOT
`@schematics/angular/utility` `updateWorkspace`.

**Rationale:** `updateJson` operates transparently on the `DevkitTreeFromAngularDevkitTree`
adapter tree and needs no new production dependency (ADDITIVE-ONLY charter); `updateWorkspace`
would add a dependency.
**Source:** 22-CONTEXT.md (D-03), 22-01-SUMMARY.md

### Collision read and write both use `architect` (WR-01 fix)
The collision check reads `project.architect` and the write targets `project.architect` -- the
speculative `?? project.targets` alias read was removed (and the `targets` field dropped from the
`AngularJsonProject` interface).

**Rationale:** A raw on-disk `angular.json` always uses `architect`; the Nx `targets` alias only
appears in `readProjectConfiguration`'s NORMALIZED return, never on disk. Reading an alias the code
never writes to was pure read/write asymmetry (a bogus self-collision or an orphaned target on a
hand-edited workspace).
**Source:** 22-REVIEW.md (WR-01), commit cfecebe

### New `resolveTsConfigLeaves` helper, `resolveTsConfig` left byte-identical
Added a separate array-returning helper rather than widening the existing single-string
`resolveTsConfig`.

**Rationale:** Keeps the Nx-branch resolver output provably byte-unchanged (ACS-02), so the
existing `configuration.spec.ts` stays green untouched -- no regression risk to the shipped
single-string contract.
**Source:** 22-CONTEXT.md (Claude's Discretion), 22-01-SUMMARY.md

### The schematic reuses the generator schema.json verbatim
`collection.json` points the `configuration` schematic's `schema` at the existing
`src/generators/configuration/schema.json`; no sanitized copy was authored.

**Rationale:** The `$default`/`$source: argv` and `x-*` conventions ORIGINATE in Angular
schematics, so the schematic dialect accepts them natively -- unlike the Phase-21 builder, which
needed a sanitized `schema.json` because Architect's validator is stricter (Pitfall 7).
**Source:** 22-RESEARCH.md, 22-02-SUMMARY.md

---

## Lessons

### Speculative defensiveness for an impossible substrate introduced a real bug
The `architect ?? targets` collision read was added to "defensively" handle a `targets`-keyed
workspace -- but a raw on-disk `angular.json` never uses `targets`, so the branch was dead AND it
created a read/write asymmetry (WR-01). Dead flexibility is not free.

**Context:** Caught by the deep code review; the fix was to delete the alias handling, not add more.
**Source:** 22-REVIEW.md

### An additive `files` whitelist edit can break a strict manifest contract test
Adding `collection.json` to `package.json` `files` broke the pre-existing PKG-01
`package-manifest.spec.ts` `toEqual` allowlist assertion. Even a purely additive manifest change
trips a strict (exact-equality) contract test that must be updated in the same plan.

**Context:** Handled as a Rule-1 deviation in 22-02 (updated the allowlist + added a `schematics`-field
assertion mirroring the `builders` one).
**Source:** 22-02-SUMMARY.md

### A non-.ts manifest must be wired into build assets or the tarball omits it
`collection.json` is not auto-copied to `dist`; without a `project.json` build-`assets` glob (and a
`files` entry) the shipped tarball omits it and `ng generate` fails post-publish (Pitfall 4). The
`nx build` acceptance criterion asserted `dist/.../collection.json` exists to lock this.

**Context:** Same class as the existing `builders.json`/`executors.json`/`generators.json` asset globs.
**Source:** 22-RESEARCH.md, 22-02-SUMMARY.md

### The GSD decision-coverage gate matches decision IDs in `must_haves`, not prose
The plan implemented D-01/D-02/D-03/D-07 faithfully but did not cite those IDs in a plan's
`must_haves.truths`, so the blocking decision-coverage gate flagged them uncovered. Citing the
`D-NN` IDs in `truths` (where D-04/D-05/D-06 already were) cleared it.

**Context:** The gate scans the frontmatter `must_haves` block, not the objective/body -- cite
decision IDs there.
**Source:** plan-phase decision-coverage gate, commit 6a8114e

---

## Patterns

### Bridge-and-branch: one shared generator, `tree.exists('angular.json')` fork
Add an early workspace-type fork to a shared generator: the Angular CLI branch writes the target
into `angular.json`, the Nx else-branch is the existing body verbatim, and `convertNxGenerator`
re-exports the SAME generator for the schematic.

**When to use:** Additively supporting an Angular CLI (`angular.json`) surface beside an Nx plugin
when a devkit function reads both substrates but writes only one.
**Source:** 22-RESEARCH.md, 22-01-SUMMARY.md

### Additive-safety via `?? ` precedence + a source-regression spec
Keep the Nx manifest fields (`executors`/`generators`) declared and add the Angular CLI siblings
(`builders`/`schematics`); Nx resolves `executors ?? builders` / `generators ?? schematics`, so the
new manifests are Nx-invisible. Prove it with a regression spec, don't assume it.

**When to use:** Any additive manifest field on a dual-surface (Nx + Angular CLI) plugin.
**Source:** 22-02-SUMMARY.md, nx-generators-surface-regression.spec.ts

### Seed a genuine Angular CLI test substrate (delete nx.json, write angular.json)
For an `angular.json` write-fork test, seed with `createTreeWithEmptyWorkspace()` then
`tree.delete('nx.json')` + `tree.write('angular.json', ...)` + write the leaf tsconfigs; assert
BOTH `tree.exists('angular.json') === true` AND `tree.exists('nx.json') === false`.

**When to use:** Testing any fork that keys on `tree.exists('angular.json')` -- a bare
`createTreeWithEmptyWorkspace()` is an Nx tree, so the fork never runs and the test passes
vacuously (Pitfall 1).
**Source:** 22-RESEARCH.md, configuration-angular-cli.spec.ts

### Hoist shared guards above a branch fork
The `targetName` default + empty-name reject were hoisted above the `tree.exists('angular.json')`
fork so both branches share them without duplication. Behavior-neutral for the Nx path (a thrown
generator discards the virtual Tree regardless of guard position).

**When to use:** When adding a branch fork to an existing function and both branches need the same
input validation.
**Source:** 22-01-SUMMARY.md, 22-REVIEW.md

---

## Surprises

### Research flipped the CONTEXT leaf-discovery hypothesis
The 22-CONTEXT starting hypothesis recommended "prefer B (read architect targets), fall back to A."
Empirical reading of the real `ngx-leaflet` clone flipped it: Approach A is primary and B is rejected
outright, because the default `ng-packagr` library builder has no `build.options.tsConfig`.

**Impact:** Simpler code (one convention+probe helper, no `configurations` special-casing), correct
on the most common library shape, and matched the anticipated leaf arrays exactly. A good example of
research overriding a plausible-but-wrong pre-research default.
**Source:** 22-RESEARCH.md (State of the Art)

### `readProjectConfiguration`'s polyfill normalizes `architect`->`targets` only in its return, not on disk
`readProjectConfiguration` returns a config with `targets` (renamed from `architect`), but the raw
`angular.json` the `updateJson` callback sees still has `architect`. The two views of "the same"
target map use different keys.

**Impact:** Clarified the WR-01 fix -- the on-disk write and its collision read must both use
`architect` (the disk key), never the normalized `targets` alias, which cannot appear in a raw
`angular.json`.
**Source:** 22-RESEARCH.md, 22-REVIEW.md
