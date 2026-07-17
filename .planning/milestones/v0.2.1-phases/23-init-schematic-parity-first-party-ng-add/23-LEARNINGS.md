---
phase: 23
phase_name: "init-schematic-parity-first-party-ng-add"
project: "angular-typechecker"
generated: "2026-07-11"
counts:
  decisions: 6
  lessons: 6
  patterns: 4
  surprises: 3
missing_artifacts:
  - "23-UAT.md (verification passed without human_needed; no UAT file created)"
---

# Phase 23 Learnings: init-schematic-parity-first-party-ng-add

## Decisions

### RF-01 install placement = Approach C (ng-add.save + defensive devDep move, return VOID)
`ngAddGenerator` returns `Promise<void>` and does NOT call `addDependenciesToPackageJson` / return a `GeneratorCallback`. The devDependency is placed by the package's own `ng-add.save: "devDependencies"` field (read by `@angular/cli` BEFORE the schematic runs) plus a defensive in-schematic `updateJson` move of any `dependencies['angular-typechecker']` to `devDependencies`.

**Rationale:** `convertNxGenerator` turns a returned `GeneratorCallback` into a `RunCallbackTask` that fires a redundant `npm install`; `@angular/cli` already installed the dep via `ng-add.save`. Returning void avoids lockfile churn. Verified against installed `@angular/cli@22` source.
**Source:** 23-CONTEXT.md, 23-RESEARCH.md, 23-03-SUMMARY.md

### ng-add COMPOSES the shipped configurationGenerator, re-implements nothing
`ngAddGenerator` enumerates `getProjects(tree)`, filters `projectType in {application, library}`, and calls `configurationGenerator(tree, { project, skipFormat: true })` per project. Idempotency, collision-by-builder-id throw, and leaf resolution are all inherited from the Phase-22 write-fork.

**Rationale:** The only genuinely new logic in the phase is the enumerate/filter/compose loop; wiring is a solved problem in `configurationGenerator`. Composition keeps one source of truth for the write-fork.
**Source:** 23-03-PLAN.md, 23-03-SUMMARY.md, 23-VERIFICATION.md

### ng-add lives in collection.json ONLY, never generators.json
The `ng-add` schematic is registered in `collection.json`; `generators.json` is untouched. Nx resolves `generators ?? schematics`, so the collection stays Nx-invisible and `nx add angular-typechecker` still runs `<pkg>:init` (unchanged).

**Rationale:** Registering `ng-add` in `generators.json` would change the Nx `nx add` surface (SC4 regression) and add an `@nx/nx-plugin-checks` burden. Pitfall 5.
**Source:** 23-03-PLAN.md, nx-generators-surface-regression.spec.ts

### Keep + widen the builder's optional peers (do NOT remove them)
When code review flagged the too-narrow `@angular-devkit/architect` peer, the decision was to KEEP `@angular-devkit/architect` + `rxjs` as OPTIONAL peers and WIDEN their ranges to Angular 22's (`>=0.2200.0 <0.2300.0` and `^6.5.3 || ^7.4.0`), rather than remove them.

**Rationale:** They document the Angular-CLI-builder-path runtime need (a transitive `require` inside `@nx/devkit`), giving a helpful `nx add`/npm peer hint. The user chose documentation value over the marginal simplicity of removal.
**Source:** 23-REVIEW.md (WR-02), this-session decision

### ACP-01 exemption lever is ignoredDependencies, not peerDependenciesMeta.optional
`@nx/dependency-checks` still flags an optional peer as an obsolete dependency; `peerDependenciesMeta.optional: true` does NOT exempt it. The operative lever is `ignoredDependencies: ['@angular-devkit/architect', 'rxjs']` in `eslint.config.mjs`, added by hand (never `eslint --fix`, which would rewrite public ranges to installed exacts).

**Rationale:** Keeps the publishable peer ranges honest and the lint gate green.
**Source:** 23-02-SUMMARY.md, 23-02-PLAN.md (T-23-07)

### Review-fix code changes route through an agent, not orchestrator inline edits
When a small review-fix (the rxjs peer widen) was needed, the orchestrator's inline edit was reverted and the change was delegated to the fixer agent for an atomic commit.

**Rationale:** Workflow discipline (GSD enforcement): repo edits go through a GSD executor/fixer so planning artifacts, atomic commits, and the green gate stay coupled.
**Source:** this-session correction

## Lessons

### @nx/devkit's convertNxExecutor lazily requires architect + rxjs at runtime
`convert-nx-executor.js` does `require('@angular-devkit/architect').createBuilder(...)` and `new (require('rxjs').Observable)(...)` inside its body — fired only on the Angular CLI builder path (`ng run`), never the Nx executor path. `@nx/devkit` declares NEITHER as its own dep (only `nx` as a peer). Our source imports neither; the need is entirely transitive.

**Context:** This is why both are OPTIONAL peers on our package and why their absence is silent for pure-Nx consumers.
**Source:** node_modules/@nx/devkit inspection (this session)

### Caret on a leading-zero-major minor caps at the next minor
`^0.2200.0` expands to `>=0.2200.0 <0.2201.0` — it locks to Angular 22.0.x only and excludes 22.1's `@angular-devkit/architect@0.2201.0`. Use an explicit `>=0.2200.0 <0.2300.0` to span all of Angular 22.x, symmetric with the `^22.0.0` compiler-cli peer.

**Context:** WR-02; empirically confirmed with the `semver` package before fixing.
**Source:** 23-REVIEW.md (WR-02)

### rxjs peer must mirror Angular 22's own range, not a high pin
The wrapper touches only the core Observable contract (`new Observable` + `subscriber.next/complete/error`), identical across rxjs 6.5.3+ and all 7.x. A `^7.8.0` pin falsely excludes rxjs 6.x and 7.4-7.7, all valid for Angular 22. Mirror Angular 22's `^6.5.3 || ^7.4.0`.

**Context:** Surfaced only when the maintainer probed which rxjs API the wrapper actually uses — the reviewer caught the architect twin but not this one.
**Source:** this-session probe, 23-REVIEW.md (WR-02)

### The Angular-CLI discriminator needs angular.json AND NOT nx.json
`tree.exists('angular.json')` alone misclassifies a hybrid/legacy workspace that carries both files — the init fork would skip seeding caching and the configuration fork could throw reading `json.projects[...].architect`. The correct discriminator is `tree.exists('angular.json') && !tree.exists('nx.json')`.

**Context:** WR-01; every pre-existing spec deleted nx.json first, so the loose form was untested. A hybrid lock test now covers it in both init and configuration specs.
**Source:** 23-REVIEW.md (WR-01)

### ng-add --project must fail loud on a no-match
A `--project` naming a nonexistent or non-app/library project wired nothing and reported success — unlike `nx g …:configuration <bad>`, which throws. Track a wired counter and throw a located error when `--project` matched nothing; gate the notice + formatFiles on `wired > 0`.

**Context:** WR-03/IN-01; silent success on a typo is a real UX trap for an install-convenience command.
**Source:** 23-REVIEW.md (WR-03/IN-01)

### Deep code review earns its keep even on a heavily-locked, fully-green phase
The phase shipped with 308 green tests and every decision source-verified, yet a deep review surfaced three real-consumer misfires (architect range, discriminator, `--project` no-op). "Locked + green" is not "correct for every consumer input."
**Context:** verification passed 4/4 AND review found 3 warnings — both true simultaneously.
**Source:** 23-VERIFICATION.md, 23-REVIEW.md

## Patterns

### Compose-not-reimplement for an install-orchestration schematic
An `ng-add` that wires the whole workspace should enumerate projects and delegate each to the single-project generator, inheriting its idempotency/collision/resolution guarantees.

**When to use:** Any multi-project auto-wire schematic where a single-project generator already exists.
**Source:** 23-03-SUMMARY.md

### Mirror the host framework's own dependency ranges for transitive-need peers
For a peer you never import but that a dependency requires at runtime on a specific path, declare the range the host framework itself accepts (verified against the framework's manifest), not the version you happen to have installed.

**When to use:** Optional peers that back an adapter/bridge (e.g. `convertNxExecutor` -> architect/rxjs on the Angular CLI path).
**Source:** 23-REVIEW.md (WR-02)

### Empirically verify semver / API claims before acting on a review finding
Both peer-range findings were confirmed by running `semver` / inspecting the actual wrapper source, not asserted from memory. Caret-on-leading-zero behavior is a common false-intuition.

**When to use:** Any dependency-range or "which API does X use" finding.
**Source:** this-session verification, 23-REVIEW.md

### Fail-loud on scoped no-match; stay silent on empty auto-scope
A `--project`-scoped run that matches nothing is a user error (throw); an unscoped auto-wire-all over a workspace with no eligible projects is valid (stay silent, skip the notice).

**When to use:** Any generator with both an explicit-target and an auto-all mode.
**Source:** 23-REVIEW.md (WR-03/IN-01)

## Surprises

### Session/usage limit interrupted the fixer twice mid-change
The org session limit killed the review-fixer twice (once before the rxjs widen, once mid-rxjs). Idempotent resume-from-transcript plus a clean working-tree check (nothing stranded) recovered each time without duplicate commits.

**Impact:** No lost work; reinforced that atomic-commit + clean-tree checks make external interruptions cheap.
**Source:** this-session task notifications

### The rxjs peer bug was invisible until the API surface was questioned
The deep reviewer flagged the architect range (WR-02) but missed the identical rxjs range bug. It surfaced only when the maintainer asked which rxjs API `@nx/devkit` actually uses.

**Impact:** A twin defect shipped in the same commit family; a targeted "what does it actually use?" question caught what a broad review missed.
**Source:** this-session probe

### phase.complete ran on a WIP-labeled HEAD
The pre-existing HEAD commit was labeled "paused at 2/3 plans"; the security auditor flagged that the label lagged the actual (complete) working-tree state. The label was cosmetic — all Plan-03 + review-fix work was present and verified.

**Impact:** No functional issue; a reminder that a WIP checkpoint-commit subject can outlive its accuracy after resume.
**Source:** 23-SECURITY.md audit note
