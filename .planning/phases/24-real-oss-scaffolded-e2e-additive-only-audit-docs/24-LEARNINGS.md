---
phase: 24
phase_name: "real-oss-scaffolded-e2e-additive-only-audit-docs"
project: "angular-typechecker"
generated: "2026-07-11"
counts:
  decisions: 5
  lessons: 6
  patterns: 4
  surprises: 3
missing_artifacts: []
---

# Phase 24 Learnings: real-oss-scaffolded-e2e-additive-only-audit-docs

## Decisions

### CLI write-fork reads projectType/root from angular.json, not readProjectConfiguration
The Angular CLI `configuration` generator's write-fork now reads the project's `root`/`projectType`
straight from `angular.json` (`readJson(...).projects[project]`); `resolveTsConfigLeaves` takes
`(tree, root, projectType, schema)`. The Nx else-branch is byte-unchanged (project.json authoritative).

**Rationale:** `readProjectConfiguration` returns a package-inference STUB (projectType undefined,
root ".") on an Angular CLI workspace that is ALSO a pnpm workspace with a name-colliding root
package.json; angular.json is the authoritative source on that branch.
**Source:** 24-HUMAN-UAT.md, commit 1837b25, 24-REVIEW-ACV01FIX.md

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
has no Angular CLI generator at all); no schema/executor-id/builder-id/collection/barrel changed.
**Source:** 24-ADDITIVE-AUDIT.md section 5

### Re-run the four post-execution gates via their DEDICATED agents after a gap-fix
code-review (gsd-code-reviewer) + verify (gsd-verifier) + secure (gsd-security-auditor) + validate
(gsd-nyquist-auditor), never self-certified inline.
**Rationale:** a code change after the pre-fix audits invalidates them; independent re-audit caught a
vacuous-test defect (MAJOR-01) and a coverage gap (ng-add path) the orchestrator had missed.
**Source:** 24-REVIEW-ACV01FIX.md, 24-VERIFICATION.md, 24-SECURITY.md, 24-VALIDATION.md

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

### The real entry point (`ng add` -> ngAddGenerator) is a distinct coverage surface
Testing `configurationGenerator` directly did not exercise the ng-add composition path (which filters
projects on `projectType` via `getProjects`). A separate standing guard was added there.

**Context:** empirically, `getProjects` returned projectType='application' at the ng-add filter under the
collision, so the app WAS enumerated and reached the (broken) leaf resolution — the fix was the fix, but
the ng-add path now has its own guard.
**Source:** 24-VALIDATION.md, commit cf90407

### pnpm caches a local tarball by version; force fresh content with a unique filename
Re-`pnpm add`-ing a re-packed same-version tarball can reuse stale content. A uniquely-named copy
(`angular-typechecker-0.2.0-acv01fix.tgz`) forced a fresh resolve.
**Source:** ACV-01 re-verification (24-HUMAN-UAT.md)

### The clean scaffold (ACV-02) cannot reproduce inference-shadowing bugs
ACV-02's committed `ng-cli-workspace` fixture (npm, no pnpm-workspace.yaml) reads projectType correctly,
so only a REAL clone with the pnpm-workspace + name-collision shape exposed the defect.
**Source:** 24-HUMAN-UAT.md, configuration-angular-cli.spec.ts

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
