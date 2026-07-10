---
phase: 23-init-schematic-parity-first-party-ng-add
reviewed: 2026-07-11T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - packages/angular-typechecker/collection.json
  - packages/angular-typechecker/eslint.config.mjs
  - packages/angular-typechecker/package.json
  - packages/angular-typechecker/src/generators/init/generator.ts
  - packages/angular-typechecker/src/generators/init/init-angular-cli.spec.ts
  - packages/angular-typechecker/src/generators/ng-add/generator.ts
  - packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts
  - packages/angular-typechecker/src/generators/ng-add/schema.d.ts
  - packages/angular-typechecker/src/generators/ng-add/schema.json
  - packages/angular-typechecker/src/package-manifest.spec.ts
  - packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts
  - packages/angular-typechecker/src/schematics/init/schematic.ts
  - packages/angular-typechecker/src/schematics/ng-add/schematic.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: resolved
resolved_at: 2026-07-11
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-11
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This is a heavily-locked additive thin-adapter phase (first-party `ng-add`, Angular
CLI `init` parity, converted-builder optional peers). The deliberate architecture is
sound and I did not re-litigate any of the flagged-as-intentional decisions (compose
`configurationGenerator`, return void / no install callback, `ng-add` in
`collection.json` only, the grep-clean doc comment). The full suite is green and the
manifest/surface contracts are well covered by static specs.

Cross-file tracing (`ngAddGenerator` -> `configurationGenerator` -> `initGenerator`, plus
the `convertNxGenerator` schematic re-exports and the published `package.json` peer
contract) surfaced no BLOCKERs but three genuine WARNINGs that would misfire on real
consumer inputs, plus one minor UX inaccuracy:

1. The Angular-CLI-vs-Nx discriminator is `tree.exists('angular.json')` alone, which
   contradicts the code's own documented invariant and misclassifies a hybrid/legacy
   Nx workspace.
2. The new `@angular-devkit/architect` peer range `^0.2200.0` is narrower than intended
   (Angular 22.0.x only), asymmetric with the `^22.0.0` compiler-cli peer, and is locked
   in by a spec assertion.
3. `ngAddGenerator`'s `--project` filter never validates the requested project, so a typo
   or out-of-scope name silently wires nothing and reports success.

No security defects were found in the config-write path: all writes go through the
virtual `Tree` (`updateJson`/`writeJson`/`updateProjectConfiguration`) against fixed
filenames or `joinPathFragments(projectRoot, <fixed leaf>)`; there is no fs write, no
injection sink, and the generator runs on a developer's own workspace (no trust boundary).

## Warnings

### WR-01: Angular-CLI fork discriminates on `angular.json` presence alone, contradicting its own "and no nx.json" invariant

**RESOLVED (4396ca6):** Both the `init` and `configuration` CLI forks now gate on `tree.exists('angular.json') && !tree.exists('nx.json')`, so a hybrid workspace with both files takes the Nx path. Added hybrid lock tests in `init-angular-cli.spec.ts` + `configuration-angular-cli.spec.ts` and updated the block comments to state nx.json is authoritative when present.

**File:** `packages/angular-typechecker/src/generators/init/generator.ts:82` (and the composed `src/generators/configuration/generator.ts:238`)
**Issue:**
The new `init` fork gates the entire Angular-CLI path on `tree.exists('angular.json')`:

```ts
if (tree.exists('angular.json')) {
  logger.info(NO_CACHING_NOTICE);
  return; // skips readNxJson/updateNxJson -> seeds NO targetDefaults
}
```

The block's own comment states the invariant it is trying to encode: *"an Angular CLI
workspace has angular.json (and no nx.json)."* The code only checks the first half.

A workspace that has BOTH `nx.json` and `angular.json` (legacy Nx-with-`angular.json`
project config, or an Nx workspace that still carries an `angular.json` shell) is a real
Nx workspace, but this fork misclassifies it as Angular CLI and returns before seeding
`nx.json.targetDefaults[angular-typechecker:typecheck]` — silently dropping the cache
configuration the Nx path is supposed to provide. The composed `configurationGenerator`
takes the same `tree.exists('angular.json')` fork and additionally reads
`json.projects[schema.project]`; in a hybrid workspace whose projects are defined via
`project.json` (not the `angular.json` `projects` map) that lookup is `undefined` and the
subsequent `project.architect?.[targetName]` throws `Cannot read properties of undefined`.

Neither `init-angular-cli.spec.ts` nor `ng-add.spec.ts` exercises the both-files-present
case — every spec does `tree.delete('nx.json')` first — so this gap is untested.

**Fix:** Gate on the full documented invariant (nx.json is authoritative when present).
This is test-safe: every existing Angular-CLI spec deletes `nx.json`, so the CLI fork
still fires, and pure-Nx specs have no `angular.json`.

```ts
if (tree.exists('angular.json') && !tree.exists('nx.json')) {
  logger.info(NO_CACHING_NOTICE);

  return;
}
```

Apply the same guard to the `configurationGenerator` write-fork so the two stay in sync.

### WR-02: `@angular-devkit/architect` peer range `^0.2200.0` only covers Angular 22.0.x, asymmetric with the `^22.0.0` compiler-cli peer

**RESOLVED (4844438):** Decision was KEEP-both-optional-peers + WIDEN (not remove). Widened the `@angular-devkit/architect` peer to `>=0.2200.0 <0.2300.0` (all of Angular 22.x, symmetric with the `^22.0.0` compiler-cli peer); kept `optional: true` and left `rxjs: ^7.8.0` unchanged. Updated the locking assertion in `package-manifest.spec.ts`; verified the built `dist` manifest carries the widened range.

**File:** `packages/angular-typechecker/package.json:56` (asserted by `src/package-manifest.spec.ts:166-169`)
**Issue:**
`^0.2200.0` is a caret range on a leading-zero-major version, so it locks the minor:
`^0.2200.0` == `>=0.2200.0 <0.2201.0`. Verified with `semver`:

```
0.2200.9  satisfies ^0.2200.0 -> true
0.2201.0  satisfies ^0.2200.0 -> false   (Angular 22.1's architect)
0.2205.3  satisfies ^0.2200.0 -> false
```

The `@angular-devkit/architect` scheme is `0.22<minor>.<patch>` (22.0 -> `0.2200`,
22.1 -> `0.2201`, ...), so `^0.2200.0` admits ONLY Angular 22.0.x. The sibling
`@angular/compiler-cli` peer is `^22.0.0`, which admits all of 22.x
(`22.1.0 satisfies ^22.0.0 -> true`). CLAUDE.md's stated peer intent is a *"semver-major
pin to Angular 22"*, which the compiler-cli peer achieves and this one does not.

Consequence on a real consumer: an Angular CLI workspace on Angular 22.1+ (the current
line will keep shipping minors) resolves `@angular-devkit/architect@0.2201.x`, which
satisfies the compiler-cli peer but VIOLATES this one. On npm the optional peer emits a
peer-dependency warning; under strict pnpm it can ERESOLVE. Marking the peer optional
suppresses the *absent* case, not the *present-and-mismatched* case — and Angular CLI
workspaces always have architect installed via `@angular/build`, so it is always present.
This is the milestone's headline builder path, so the mismatch will hit most future 22.x
consumers.

**Fix:** Mirror the compiler-cli peer's breadth with an explicit Angular-22 architect range,
and update the locking assertion.

```jsonc
// package.json
"@angular-devkit/architect": ">=0.2200.0 <0.2300.0"
```
```ts
// src/package-manifest.spec.ts (the assertion that currently pins ^0.2200.0)
expect(manifest.peerDependencies?.['@angular-devkit/architect']).toBe(
  '>=0.2200.0 <0.2300.0',
);
```

### WR-03: `ng-add --project` silently no-ops (false success) on an unknown or out-of-scope project name

**RESOLVED (bbce0d0):** `ngAddGenerator` now tracks a `wired` counter and throws a located error when `--project` was set but matched no application/library project. Added ng-add spec cases for the unknown-name and e2e-name cases. `ngAddGenerator` still returns void.

**File:** `packages/angular-typechecker/src/generators/ng-add/generator.ts:75-86`
**Issue:**
The `--project` scoping is a pure filter with no existence/eligibility check:

```ts
for (const [name, project] of getProjects(tree)) {
  if (schema.project && name !== schema.project) {
    continue;
  }

  if (project.projectType === 'application' || project.projectType === 'library') {
    await configurationGenerator(tree, { project: name, skipFormat: true });
  }
}
```

If `schema.project` matches no enumerated project (a typo) or matches a project whose
`projectType` is neither `application` nor `library` (e.g. an `e2e` project), the loop
wires nothing, then the generator prints `NO_CACHING_NOTICE` and returns success. The user
asked to wire a specific project and got a silent no-op reported as success.

This diverges from the direct path: `nx g angular-typechecker:configuration <bad>` throws
a located `readProjectConfiguration` error. Routing the same intent through `ng add
--project <bad>` swallows it.

**Fix:** Track whether an in-scope match was wired and fail loudly when `--project` was set
but nothing matched, mirroring the configuration generator's located-error style:

```ts
let wired = 0;

for (const [name, project] of getProjects(tree)) {
  if (schema.project && name !== schema.project) {
    continue;
  }

  if (
    project.projectType === 'application' ||
    project.projectType === 'library'
  ) {
    await configurationGenerator(tree, { project: name, skipFormat: true });
    wired++;
  }
}

if (schema.project && wired === 0) {
  throw new Error(
    `--project "${schema.project}" did not match an application or library ` +
      `project. Omit --project to wire every app + library project.`,
  );
}
```

## Info

### IN-01: no-caching notice claims targets were wired even when zero were wired

**RESOLVED (bbce0d0, folded into WR-03):** The notice + `formatFiles` are now gated on `wired > 0`, so an auto-wire-all over a workspace with only e2e/other projects stays silent instead of claiming targets were wired. Added an ng-add spec asserting the notice is not printed when zero targets are wired.

**File:** `packages/angular-typechecker/src/generators/ng-add/generator.ts:94`
**Issue:**
On the Angular-CLI path `ngAddGenerator` unconditionally logs `NO_CACHING_NOTICE`
("...the typecheck target(s) were wired without caching...") even when the loop wired
nothing — an `angular.json` with only e2e/other projects, or the WR-03 unknown-`--project`
case. The message then asserts wiring that did not happen.
**Fix:** Gate the notice (and, correspondingly, `formatFiles`) on at least one target
having been wired — naturally handled by the `wired` counter from WR-03: only emit the
notice when `wired > 0`.
