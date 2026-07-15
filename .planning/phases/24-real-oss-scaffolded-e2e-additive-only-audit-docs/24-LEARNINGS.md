---
phase: 24
phase_name: "real-oss-scaffolded-e2e-additive-only-audit-docs"
project: "angular-typechecker"
generated: "2026-07-15"
counts:
  decisions: 11
  lessons: 12
  patterns: 7
  surprises: 7
missing_artifacts: []
---

# Phase 24 Learnings: real-oss-scaffolded-e2e-additive-only-audit-docs

## Decisions

### CLI write-fork reads projectType/root from angular.json, not readProjectConfiguration
The Angular CLI `configuration` generator's write-fork now reads the project's `root`/`projectType`
straight from `angular.json` (`readJson(...).projects[project]`); `resolveTsConfigLeaves` takes
`(tree, root, projectType, schema)`. The Nx else-branch is byte-unchanged (project.json authoritative).
24-06 preserved this behavior verbatim when the logic moved into the shared `src/core/angular-cli-wiring.ts`.

**Rationale:** `readProjectConfiguration` returns a package-inference STUB (projectType undefined,
root ".") on an Angular CLI workspace that is ALSO a pnpm workspace with a name-colliding root
package.json; angular.json is the authoritative source on that branch.
**Source:** 24-HUMAN-UAT.md, commit 1837b25, 24-REVIEW-ACV01FIX.md, 24-06-SUMMARY.md

### Real-clone ACV-01 gate: pnpm-native install, decouple tarball from schematic
For the real-clone gate on a pnpm workspace, install the LOCAL dist tarball via `pnpm add -w -D <tgz>`
then run `ng g <pkg>:ng-add` — NEVER `ng add <file:tarball>` (pnpm rejects the file: metadata fetch)
and NEVER `ng add <name>` (would fetch the already-published same-version artifact).

**Rationale:** pnpm's `auto-install-peers` brings in the `nx` transitive peer of `@nx/devkit`; npm's
`--legacy-peer-deps` (needed for a repo with lagging devDeps) SUPPRESSES that peer and crashes the
schematic (`Cannot find module 'nx/src/devkit-exports'`).
**Source:** 24-ACV-01-UAT.md, 24-HUMAN-UAT.md

### ACV-01 substrate = two ordered on-stack Ng22 clones (ngx-leaflet, then realworld-angular)
Gate #1 ngx-leaflet @818e9ae (npm, app+lib), gate #2 realworld-angular @9e3528f (pnpm, app-only).
**Rationale:** app-vs-library scoping breadth + a second exact-stack repo; the pnpm one surfaced the defect.
**Source:** 24-ACV-01-UAT.md, STATE.md

### The gap-fix stays additive-only (v0.2.1, not v0.3.0)
**Rationale:** the fix is inside the UNRELEASED Angular CLI generator (v0.2.0, the last published version,
has no Angular CLI generator at all); no schema/executor-id/builder-id/collection/barrel changed. 24-06's
vanilla-ng-add rewrite is likewise an unreleased-surface implementation change: `index.ts` byte-unchanged
vs the 0.2.0 tag, version stays 0.2.0.
**Source:** 24-ADDITIVE-AUDIT.md section 5, 24-VERIFICATION.md (2026-07-15), 24-06-SUMMARY.md

### Re-run the four post-execution gates via their DEDICATED agents after a gap-fix
code-review (gsd-code-reviewer) + verify (gsd-verifier) + secure (gsd-security-auditor) + validate
(gsd-nyquist-auditor), never self-certified inline.

**Rationale:** a code change after the pre-fix audits invalidates them; independent re-audit caught a
vacuous-test defect (MAJOR-01) and a coverage gap (ng-add path) the orchestrator had missed. Re-affirmed
by the 24-04/24-05 gap closure (3 residual CLAUDE.md contradictions, missing lib clean-baseline) AND by
the 24-06 close-out: because 24-06 landed AFTER the 2026-07-12 gates, verify/secure/validate were re-run
against post-24-06 HEAD and the timestamped gates re-issued — the stale-gate trap (gates dated before the
last plan's SUMMARY) is real and only a re-audit catches it.
**Source:** 24-REVIEW-ACV01FIX.md, 24-REVIEW-GAP-2404-2405.md, 24-VERIFICATION.md, 24-SECURITY.md, 24-VALIDATION.md

### nx is a DIRECT `^23.0.0` dependency (deliberately overriding the "never declare nx" rule)
Declared `nx: "^23.0.0"` in the published plugin's `dependencies` (alongside exact `@nx/devkit@23.0.1`;
`nx` stays OUT of peerDependencies). Inverted the `package-manifest.spec.ts` guard + added `nx` to
`@nx/dependency-checks` `ignoredDependencies`; flipped the operative Dependencies rule in PROJECT.md +
CLAUDE.md (STACK-research rows carry dated `[v0.2.1 CORRECTION]` annotations).

**Rationale:** `@nx/devkit`'s entrypoint `require()`s `nx/src/devkit-exports` at load; yarn does NOT
auto-install the `@nx/devkit` peer (npm/pnpm do), so a yarn Angular CLI consumer crashed with
`Cannot find module 'nx/src/devkit-exports'`. `^23.0.0` is a strict subset of devkit's `nx` peer
(Nx-23-only, no double-constraint, no new package in the tree). The prior rule assumed an always-Nx
consumer -- false for a yarn Angular CLI consumer.
**Source:** 24-04-PLAN.md, 24-04-SUMMARY.md, .planning/debug/resolved/cli-yarn-e2e-wrong-version.md

### yarn CLI e2e asserts first-run `ng add` auto-wire (24-06 SUPERSEDED the 24-05 `ng g` fallback)
24-05 kept the REAL `ng add` install but wired via `ng g angular-typechecker:ng-add` and asserted the
yarn no-wire quirk. 24-06's Option C fix (nx-free vanilla ng-add) made `ng add` auto-wire on the FIRST
run under yarn 4, so the yarn e2e was FLIPPED to assert first-run auto-wire and the `ng g` fallback +
no-wire quirk-lock were removed (`enableMirror:false` retained).

**Rationale:** the 24-05 fallback was the authorized `ng-add`-misbehaves escape hatch; once 24-06 fixed
the root cause (the yarn-4 `chalk.blue` throw in nx's log-symbols chain), the fallback was no longer
needed and the e2e should assert the true, product-fixed behavior.
**Source:** 24-05-SUMMARY.md (superseded), 24-06-SUMMARY.md, 24-06-PLAN.md

### pnpm e2e gates build scripts with `strictDepBuilds:false`, not `allowBuilds:{nx:true}`
**Rationale:** the full Angular CLI fixture pulls 5-6 native build-script packages (`@parcel/watcher`,
`esbuild`x2, `lmdb`, `msgpackr-extract`, `nx`); `allowBuilds:{nx:true}` alone fails the install.
`strictDepBuilds:false` runs ZERO build scripts (mirrors npm's proven skip-and-succeed) -- strictly
SAFER than allowBuilds (which would RUN nx's postinstall) and hermetic on Windows arm64. Security
re-audit confirmed the disposition is MORE restrictive than the planned mitigation (T-24-10).
**Source:** 24-05-SUMMARY.md, 24-SECURITY.md (T-24-10)

### Option C: a VANILLA nx-free `@angular-devkit/schematics` ng-add (24-06)
The `ng-add` schematic is a plain synchronous Angular schematics `Rule`; its `@angular-devkit/schematics`
imports are TYPE-ONLY (erased at compile), so the compiled `schematic.js` `require()`s ONLY the pure
first-party core -- ZERO `@nx/devkit` in the load OR execution path. This makes `ng add angular-typechecker`
auto-wire every application + library project on the FIRST run under yarn 4 (npm + pnpm already worked).
The dead `src/generators/ng-add/generator.ts` was deleted (schema.json/schema.d.ts kept); ng-add stays
absent from `generators.json`; `collection.json` byte-unchanged.

**Rationale:** the Angular CLI post-install `createSchematic('ng-add')` probe pulled in nx's
`ora -> log-symbols -> chalk` chain, which throws `chalk.blue is not a function` under yarn 4's
last-in-wins hoist; the CLI's bare `catch {}` swallowed it and reported "no ng add actions". Option D
(lazy-require @nx/devkit) was REFUTED because the chalk breakage is process-wide and still threw at
`executeSchematic`. Removing nx from the load path entirely is the only fix.
**Source:** 24-06-PLAN.md, 24-06-SUMMARY.md, .planning/debug/resolved/cli-yarn-e2e-wrong-version.md

### Extract-not-duplicate: one shared framework-agnostic wiring core (24-06)
`src/core/angular-cli-wiring.ts` is the single source of truth for leaf resolution + `targetName` guard
+ collision-by-builder-id + `[build, spec]` idempotent merge. BOTH the vanilla ng-add schematic AND the
Nx `configuration` generator import it; the Nx `configuration` observable behavior is byte-identical (all
4 configuration specs + the init specs stay green) and every moved error string is byte-preserved.

**Rationale:** the ng-add path had to go nx-free WITHOUT drifting from the collision-fixed wiring the Nx
generator already shipped; extracting a shared pure core (rather than rewriting either side) keeps one
behavior and one test surface (the `rewrite-not-extract` blocking anti-pattern).
**Source:** 24-06-SUMMARY.md, 24-06-PLAN.md, .continue-here.md (blocking constraints)

### `posix.join` + injected `exists()` callback keep the core Tree/devkit-agnostic (24-06)
The shared core uses `node:path` `posix.join` in place of devkit `joinPathFragments` and an injected
`exists()` callback in place of `tree.exists`, so it depends on neither `@angular-devkit` nor `@nx/*` and
passes the D-11 `core/**` `no-restricted-imports` lint boundary (which bans framework/nx imports,
type-only included, at `maxWarnings:0`).

**Rationale:** a pure core is the mechanism that lets the SAME wiring code be consumed by a vanilla
Angular schematic and an Nx generator; the lint boundary makes framework-agnosticism enforceable, not just
aspirational.
**Source:** 24-06-SUMMARY.md, eslint.config.mjs (core/** boundary)

## Lessons

### A pnpm-workspace + name-collision makes Nx shadow the angular.json project with a package stub
On an `angular.json` workspace that also has `pnpm-workspace.yaml` AND a root `package.json` whose
`name` equals the angular.json project name, `readProjectConfiguration` returns a stub (root ".",
projectType undefined). Both conditions are required.

**Context:** silently dropped the app build leaf (root app -> spec-only) or threw (subdir app). The
worst failure mode for a "complete typecheck / never-false-pass" tool.
**Source:** 24-HUMAN-UAT.md blast-radius matrix

### npm --legacy-peer-deps disables automatic peerDependency install
A dependency's transitive peer (here `nx`, peer of the pinned `@nx/devkit`) is not auto-installed under
`--legacy-peer-deps`, breaking anything that requires it at runtime.

**Context:** realworld-angular's own lagging `@angular-eslint@21` forced `--legacy-peer-deps` under npm,
which then broke the ng-add schematic. pnpm-native install avoided it.
**Source:** 24-ACV-01-UAT.md

### Regression tests must be proven non-vacuous (RED against the pre-fix code)
Two of the three initial CLI regression cases passed even on the buggy generator: their pnpm-workspace
`packages` globs (`apps/*`/`projects/*`) did not match the ROOT package.json carrying the colliding
name, so no stub formed. Using `packages: ['.']` made them reproduce the stub.

**Context:** confirmed by transiently restoring the pre-fix generator and observing all new cases FAIL,
then GREEN on the fix.
**Source:** 24-REVIEW-ACV01FIX.md (MAJOR-01), commit 49974f1

### The real entry point (`ng add` -> ng-add schematic) is a distinct coverage surface
Testing `configurationGenerator` directly did not exercise the ng-add composition path (which filters
projects on `projectType`). A separate standing guard was added there. 24-06 relocated this to a vanilla
`ng-add.spec.ts` (13 tests) that drives the schematic Rule directly.

**Context:** empirically, project enumeration returned projectType='application' at the ng-add filter under
the collision, so the app WAS enumerated and reached the (broken) leaf resolution — the fix was the fix,
but the ng-add path now has its own guard.
**Source:** 24-VALIDATION.md, commit cf90407, 24-06-SUMMARY.md

### pnpm caches a local tarball by version; force fresh content with a unique filename
Re-`pnpm add`-ing a re-packed same-version tarball can reuse stale content. A uniquely-named copy
(`angular-typechecker-0.2.0-acv01fix.tgz`) forced a fresh resolve.
**Source:** ACV-01 re-verification (24-HUMAN-UAT.md)

### The clean scaffold (ACV-02) cannot reproduce inference-shadowing bugs
ACV-02's committed `ng-cli-workspace` fixture (npm, no pnpm-workspace.yaml) reads projectType correctly,
so only a REAL clone with the pnpm-workspace + name-collision shape exposed the defect.
**Source:** 24-HUMAN-UAT.md, configuration-angular-cli.spec.ts

### yarn 4 does NOT auto-install transitive peers (npm 7+ / pnpm 8+ do)
A plugin that depends on `@nx/devkit` (whose entrypoint requires `nx`) must declare `nx` DIRECTLY so
yarn consumers get it. yarn installs direct deps and skips peers; there is no yarn analogue of npm's
auto-peer-install / pnpm's `auto-install-peers`.
**Context:** the CLI-x-yarn `ng add`/`ng run` crash was `Cannot find module 'nx/src/devkit-exports'`
until `nx` became a direct dependency (24-04).
**Source:** .planning/debug/resolved/cli-yarn-e2e-wrong-version.md, 24-04-SUMMARY.md

### yarn `ng add` installs but does NOT auto-wire -- pinned to the createSchematic probe (RESOLVED by 24-06)
An instrumented first-run `ng add` against Verdaccio (@angular/cli 22.0.6 gates logged) pinned it:
Gate 1 (registry metadata) is TRUE (`yarn npm info` returns `schematics`); the post-install
`createSchematic('ng-add')` PROBE (Gate 3) THROWS while loading this package's `convertNxGenerator`/
`@nx/devkit`->`nx` factory (observed `TypeError: chalk.blue is not a function` from nx's nested
`log-symbols`/`ora` under yarn 4's hoist); @angular/cli's bare `catch {}` swallows it ->
`hasSchematics=false` -> "does not provide any ng add actions" -> no wire. npm/pnpm hoist nx's deps so
the SAME probe succeeds and they wire the identical dist. **24-06 removed `@nx/devkit`/`nx` from the
ng-add load path entirely, so the probe no longer throws and yarn auto-wires on the first run.**
**Context:** NOT an angular-typechecker defect, NOT candidate A (metadata stripping), and NOT the fixed
angular/angular-cli #33060 (that on-disk fallback IS present in 22.0.6).
**Source:** .planning/debug/resolved/cli-yarn-e2e-wrong-version.md ("Post-24-05 root-cause pin"), 24-06-SUMMARY.md

### Candidate-A (yarn npm info strips custom `schematics`) is refuted; #33060 is a distinct cousin
`yarn npm info <pkg> --json --fields ...schematics...` DOES return the custom field (verified against
public npm + the CLI's MANIFEST_FIELDS requests it). angular/angular-cli #33060 (fixed by #33285) is the
"registry strips schematics metadata" case (GitHub Packages + npm), already present in 22.0.6.
**Context:** disproving the intuitive hypothesis required actually running the CLI's exact invocation.
**Source:** .planning/debug/resolved/cli-yarn-e2e-wrong-version.md

### A clean standalone createSchematic does NOT reproduce the yarn probe throw
The failure is a yarn-4 RUNTIME/interop resolution quirk inside the FULL `ng add` process (the on-disk
`chalk` that `log-symbols` resolves is 4.1.2, which HAS `.blue`). A separate-process probe of gates 2/3
passed -- a false negative. Only the faithful in-process first-run reproduces it.
**Context:** cost two wrong intermediate conclusions before the faithful repro settled it.
**Source:** .planning/debug/resolved/cli-yarn-e2e-wrong-version.md, yarn-probe experiment

### tsc preserves JSDoc comments into the dist, so a literal `@nx/devkit` in a comment trips the dist-grep
24-06's blocking constraint greps the COMPILED `schematic.js` for `@nx/devkit`. A JSDoc line "it NEVER
loads @nx/devkit" made the grep match the forbidden literal even though there was no real import; the
comment had to be reworded ("the Nx devkit / nx runtime") to pass.

**Context:** a blocking-constraint acceptance grep that scans compiled output must account for comments
surviving compilation, not just import statements.
**Source:** 24-06-SUMMARY.md (Deviation 3)

### Type-only `@angular-devkit/schematics` imports are erased at compile
Importing `Rule`/`Tree`/`SchematicContext` as `import type` means the compiled `schematic.js` carries no
runtime `require('@angular-devkit/schematics')` — the module loads only its value-imported pure core. This
is the mechanism that makes the ng-add schematic genuinely framework-runtime-free (the Option C fix).

**Context:** the difference between a value import and a type-only import is load-bearing for a schematic
that must not pull a heavy runtime through the CLI's fragile post-install probe.
**Source:** 24-06-SUMMARY.md, dist grep evidence

## Patterns

### Blast-radius matrix via synthetic FsTree + readProjectConfiguration probes
Enumerate {workspace-kind} x {PM layout} x {name-collision} minimal workspaces on a real `FsTree` and
probe `readProjectConfiguration().projectType` + the resolver output per cell to pin the exact trigger.

**When to use:** to characterize the blast radius of an Nx/Angular inference edge case before committing
to a fix and to know which cells the fix + tests must cover.
**Source:** 24-HUMAN-UAT.md blast-radius matrix

### Read the authoritative descriptor directly on a branch where inference is unreliable
On the CLI (angular.json) write-fork, read projectType/root from angular.json rather than trusting Nx's
project inference.

**When to use:** whenever a generator already opens the authoritative config file and the inferred
config can be shadowed (workspace-manifest + name collision).
**Source:** commit 1837b25

### Assert on the written config file directly when read-back is shadowed
Under the collision, `readProjectConfiguration` returns the stub (no target), so the regression tests
assert `angular.json` (or `project.json`) DIRECTLY for the wired tsConfig.
**When to use:** verifying a generator's write when the config read-back path is the very thing under test.
**Source:** configuration-angular-cli.spec.ts

### RED-then-GREEN via a transient pre-fix restore proves protective value
`git show <pre-fix>:file > file` (temporarily), run the new tests (expect FAIL), then
`git checkout HEAD -- file` to restore and re-run (expect PASS).
**When to use:** to prove a regression test is non-vacuous when the fix is already committed.
**Source:** commits 49974f1, cf90407 verification

### Instrumented gate-by-gate first-run repro against a local registry
To pin WHICH internal gate of a tool flips a boolean, stand up the real registry (reuse the e2e's
`startLocalRegistry` + token mint + publish), create a fresh package-manager-specific workspace, PATCH
the tool's swallowing `catch {}` + log each gate, then run the REAL first-run command and read the logs.
A clean standalone re-implementation of the gate can give a false negative.
**When to use:** when a tool reports a generic outcome ("no actions") behind a bare catch and you need
the exact thrown error + the deciding gate under a specific package manager.
**Source:** .planning/debug/resolved/cli-yarn-e2e-wrong-version.md ("Post-24-05 root-cause pin")

### Gate an upstream-bug attribution on a dependency-free repro
When a failure surfaces entirely through a specific transitive chain (here `@nx/devkit`/
`convertNxGenerator` -> `nx`), do NOT attribute it to the outer tool (Angular CLI) until a VANILLA
(dependency-free) case reproduces the same failure. Scope the claim to what is proven. (Applied: quick
task 260712-ft9 confirmed the yarn failure is NX-SPECIFIC, so no upstream issue was warranted.)
**When to use:** before filing an upstream issue whose repro currently only exists through your own
dependency stack.
**Source:** quick task 260712-ft9, .planning/todos/done/readme-yarn-ng-add-caveat.md

### Vanilla schematic testing: invoke the synchronous Rule directly with a logger-backed context
For a synchronous `@angular-devkit/schematics` Rule that emits `context.logger` notices, drive the spec by
calling `ngAdd(options)(tree, context)` directly with a context backed by `runner.logger`, and subscribe to
`runner.logger`. Do NOT use `SchematicTestRunner.callRule`: in `@angular-devkit/schematics@22.0.6` it
builds its context via `engine.createContext({}, parentContext)`, which yields a `NullLogger` when no
parent is passed (notices swallowed) and CRASHES on `schematic.description.name` when a parent logger IS
passed — so it fundamentally cannot capture the Rule's notices.

**When to use:** unit-testing a vanilla Angular schematic Rule whose observable behavior includes logger
output, when `callRule` cannot capture the logger.
**Source:** 24-06-SUMMARY.md (Deviation 1), src/schematics/ng-add/ng-add.spec.ts

## Surprises

### The defect was a SILENT under-check, not a loud error (for a root app)
A root app quietly wired `[tsconfig.spec.json]` only — green when coverage was incomplete — directly
contradicting the milestone's never-false-pass charter. A subdir app threw instead (louder).
**Impact:** elevated the fix from "nice-to-have" to a charter-level correctness blocker; drove fix-now.
**Source:** 24-HUMAN-UAT.md

### The trigger is narrow: pnpm-workspace + name collision ONLY
npm/yarn `workspaces` fields, a lockfile alone, and a name mismatch all read projectType correctly; the
Nx branch (project.json authoritative) is entirely unaffected.
**Impact:** scoped the fix to the CLI branch and the tests to the exact trigger.
**Source:** 24-HUMAN-UAT.md blast-radius matrix, configuration.spec.ts Nx lock

### An independent review found regression tests that could not fail
The gsd-code-reviewer empirically traced Nx inference and proved 2/3 new CLI tests were vacuous — a
finding the lighter verification pass had reported as "substantive".
**Impact:** reinforced that dedicated-agent re-audit after a gap-fix catches orchestrator blind spots.
**Source:** 24-REVIEW-ACV01FIX.md

### 24-04 fixed the FIRST yarn probe error but a SECOND one remained (same symptom)
Making `nx` a direct dep removed the `Cannot find module 'nx/src/devkit-exports'` probe crash, but the
probe then threw a DIFFERENT error (`chalk.blue` from nx's nested `log-symbols`) under yarn 4 -- same net
outcome (no auto-wire). 24-06 finally removed the whole nx load path, resolving both layers.
**Impact:** the layered failure meant 24-04 looked incomplete until the mechanism was pinned; it took a
second gap-closure plan (24-06) to fully close NGADD-01 under yarn.
**Source:** .planning/debug/resolved/cli-yarn-e2e-wrong-version.md, 24-06-SUMMARY.md

### The 24-04 doc-flip left 3 CLAUDE.md spots still stating the old "never declare nx" rule
The code review (WR-02) found the Installation snippet deps line + `NO nx` comment, a second
Version-Compatibility table row, and a What-NOT-to-Use `Use Instead` cell still contradicting the new
direct-dependency rule.
**Impact:** a governance doc left self-contradictory could mislead a future agent into reverting the fix;
all three were corrected.
**Source:** 24-REVIEW-GAP-2404-2405.md (WR-02), 24-REVIEW-GAP-2404-2405-FIX.md

### Option D (lazy-require @nx/devkit) was REFUTED even though it "fixed" the probe
Deferring the `@nx/devkit` import out of the ng-add module top-level made the CLI's createSchematic probe
pass, but `executeSchematic` STILL threw `chalk.blue` — because the chalk breakage is process-wide (nx's
CJS log-symbols@4 resolving Angular's ESM chalk@5), not tied to the probe.
**Impact:** killed the cheaper fix and forced the full vanilla (Option C) rewrite; the blocking anti-pattern
`lazy-require-the-fix` was recorded to stop a future agent from re-attempting it.
**Source:** .continue-here.md (blocking constraints), .planning/debug/resolved/cli-yarn-e2e-wrong-version.md

### `nx run-many -t e2e --parallel=1` failed only on ng-cli-e2e via an Nx local-registry re-invocation
24-06's authoritative post-merge check found the ng-cli-e2e task aborting at globalSetup with an Nx
local-registry task RE-INVOCATION error ("already invoked by a parent Nx process in this chain"),
Nx-flagged flaky — NOT a 24-06 regression (the project passed 4/4 standalone; the other 3 e2e projects
passed within the same run-many).
**Impact:** flagged an orchestration limitation of running multiple shared-Verdaccio e2e projects in one
run-many chain; CI's fresh per-job `npm ci` avoids it. Later addressed structurally by quick tasks
260712-n7z (clear inherited NX_INVOCATION_ROOT_PID) and 260715-050 (per-project e2e CI matrix).
**Source:** 24-06-SUMMARY.md (Issues Encountered)
