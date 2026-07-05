# Advisory board fact pack -- v0.1.2 Storybook type-check milestone

You are ONE member of a 6-person advisory board convened to decide and harden the
requirements and technical decisions for a specific software milestone. This document
contains ONLY facts and the requester's stated goals. It deliberately proposes NO
solution. Reach your own conclusions independently, from your assigned lens. Another
person (the executor) will synthesize the whole board's positions; your final message is
returned to that executor, not to any end user.

ASCII only. Every claim below is either verified from source/empirical test or is a
stated requester goal (marked as such).

## System under design

- "angular-typechecker" is an Nx plugin providing a `typecheck` executor. Purpose: run the
  COMPLETE Angular type-check (TypeScript + Angular template type-check + extended NG8xxx
  diagnostics), with NO emit, DECOUPLED from building the app or running its tests, aimed at
  CI pipelines and AI coding agents.
- Stated core invariant of the tool (enforced throughout its codebase and tests): it must
  NEVER report a "clean"/passing verdict that is actually a false negative. A silent false
  pass is treated by the project as the worst possible failure mode.
- Officially supported stack: Nx 23.0.1, Angular 22.0.4, TypeScript 6.0.3, Node 22/24/26.
  Semver is 0.x (pre-1.0). Current released version is 0.1.1.

## How the engine selects and checks files (verified from source)

1. The `typecheck` executor is pointed at a project's SOLUTION `tsconfig.json` (a config
   whose job is to list `references[]`, not source files).
2. The engine reads that solution config and walks its DIRECT `references[]` (ONE level
   only). For each referenced leaf tsconfig, it runs the Angular compiler `performCompilation`
   (no emit) and UNIONs the resulting diagnostics.
3. A reference-walk guard SKIPS a referenced leaf whose tsconfig FILE path is not under the
   solution tsconfig's directory (path containment).
4. After compilation, a SEPARATE diagnostic BOUNDARY FILTER classifies each gathered
   diagnostic by the absolute (realpath-normalized) path of its source file, and DROPS a
   diagnostic if the file is inside `node_modules` OR is not under a BASE DIRECTORY. For a
   walk, the base directory is the SOLUTION tsconfig's directory (the directory of the
   pointed-at tsconfig). Diagnostics with no source file (e.g. config errors, synthesized
   guards) are ALWAYS kept.
5. An existing option `includeDeps` exists: when true it DISABLES the boundary filter
   entirely (every diagnostic is kept, INCLUDING `node_modules`). Default is false.
6. The walk iterates EVERY reference generically (there is no allowlist of expected leaf
   names). The engine already parses, and has in hand, each leaf's list of input files (its
   "rootNames").
7. When suppressing out-of-project/node_modules diagnostics, the engine records a
   suppressed COUNT (an integer) in its result; it does not, by default, fail the verdict on
   a nonzero suppressed count.
8. A companion `configuration` generator wires ONE `typecheck` target pointing at a
   project's solution `tsconfig.json` when that config has a non-empty `references[]`
   (otherwise it falls back to a leaf tsconfig).

## Nx + Storybook scaffolding facts (empirical + generator-source verified)

- Running Nx's Angular Storybook configuration generator (`@nx/angular:storybook-configuration`)
  on a project UNCONDITIONALLY adds `./.storybook/tsconfig.json` to THAT project's own
  solution `tsconfig.json` `references[]` (verified for both applications and libraries; it
  is an explicit Angular-specific branch in the generator source).
- The scaffolded `.storybook/tsconfig.json` `extends` the project's own `tsconfig.json`
  (thus inherits `strictTemplates` and the other Angular compiler options). Its `include`
  covers `../src/**/*.stories.*` PLUS bare `.storybook/*.{js,ts}` (i.e. it also includes the
  Storybook config files `main.ts` and `preview.ts`). The generator also adds
  `**/*.stories.ts|.js` to the app/lib leaf's `exclude`, so a story is compiled by exactly
  one leaf (no double coverage).
- The Storybook version Nx 23 scaffolds is `storybook` / `@storybook/angular` 10.4.6.
- `@storybook/angular@10.4.6` peerDependencies cap `@angular/*` at ">=18.0.0 <22.0.0" and
  `typescript` at "^4.9.0 || ^5.0.0". Angular 22 and TypeScript 6 are OUTSIDE the declared
  range; installing Storybook into an Angular 22 workspace currently requires
  `--legacy-peer-deps` or `--force`. The tsconfig reference-injection itself is pure JSON
  writing and is independent of the installed Angular/TS version.
- Today, `*.stories.ts` files receive NO decoupled/standalone type-check: no inferred
  typecheck target is created for them; they are type-checked only incidentally during a
  full, coupled Storybook build.

## Three observed tsconfig layouts

- Layout A -- per-project default scaffold: each project has its own `.storybook/`; stories
  live in that project's own `src/`; `.storybook/tsconfig.json` is in that project's
  `references[]`. The story files are UNDER the project's (solution) directory.
- Layout B -- centralized Storybook host: an OFFICIAL Nx recipe titled "One main Storybook
  instance for all projects" (nx.dev/recipes/storybook/one-storybook-for-all). A dedicated
  host project runs the standard generator, then its `.storybook/main.ts` stories glob AND
  its `.storybook/tsconfig.json` `include` are MANUALLY widened to reach into OTHER projects'
  story/source files -- paths OUTSIDE the host project's directory (e.g. three directory
  levels up into a different top-level folder). The host's solution `tsconfig.json` may
  reference ONLY `./.storybook/tsconfig.json` and may have NO app/lib leaf of its own. The
  recipe also advises setting `implicitDependencies` on the host. There is no generator flag
  for this widening; it is a documented hand-edit. A REAL Angular 22.0.4 / TS 6.0.3 /
  Storybook 10.4.6 instance of this layout exists; its host `.storybook/tsconfig.json`
  `include` reaches into another top-level folder's packages, pulling in `*.stories.ts`,
  `*.component.ts`, `*.directive.ts`, and `**/src/**/*.ts`.
- Layout C -- flat root config, no references graph: a single flat workspace-root
  `tsconfig.json` uses include/exclude globs with NO `references[]` anywhere; stories are
  covered by the flat include; the Storybook tsconfig sits at the workspace root. A large,
  actively maintained real production monorepo uses this. There is no per-project
  solution->leaf references graph at all.

## How the current engine interacts with each layout (factual trace)

- Layout A: the walk visits the `.storybook` leaf (its tsconfig is under the solution dir);
  the stories it compiles are under the solution dir; the boundary filter KEEPS their
  diagnostics -> stories are type-checked as-is today.
- Layout B: the walk visits the `.storybook` leaf (its tsconfig IS under the host dir) and
  compiles the aggregated cross-project files; but the boundary filter's base is the HOST
  dir, so every diagnostic whose source file lies OUTSIDE the host dir is DROPPED. With
  default settings the run therefore reports zero diagnostics from the aggregated stories
  EVEN WHEN those stories contain type errors -- i.e. the run passes. With `includeDeps: true`
  those story diagnostics are kept, but so are all `node_modules` diagnostics. (The
  suppressed-count integer would be nonzero, but by default that does not fail the verdict.)
- Layout C: a project pointed-at here has no non-empty `references[]`, so no stories leaf is
  walked via the references graph. (The generator's flat-single-tsconfig fallback points at a
  flat tsconfig directly, but the observed real instance's flat tsconfig is workspace-root
  wide, not per-project.)

## Compiler behavior fact

- Empirically, the Angular compiler (`ngc --noEmit`, full `strictTemplates`) successfully
  type-checks a story file located OUTSIDE a host project's directory when reached via a
  widened `include` glob, with no additional wiring (verified on an Angular 21.2.9 /
  TS 5.9.3 scaffold). This has NOT yet been verified on Angular 22.0.4 / TS 6.0.3 with
  `@storybook/angular@10.4.6` force-installed.

## Fixture / availability facts

- No public repository exists on the EXACT Nx 23 + Angular 22 + Storybook combination (both
  Nx 23 and Angular 22 are very recent). The closest real Layout-B instance is on Angular 22
  but uses a community Vite-based Storybook framework executor instead of the one Nx
  scaffolds (its tsconfig layout still matches the recipe). Closest Layout-A public examples
  are on Angular 19/20 + Nx 22 + Storybook 9. Several real Angular 22 + Nx 23 repositories
  with Angular components but NO Storybook exist and could have Storybook scaffolded into
  them.
- The project already has an end-to-end test discipline: it packs its own npm tarball and
  installs it into throwaway consumer workspaces (including a local-registry publish
  round-trip and per-package-manager `nx add` coverage) to validate the SHIPPED artifact, not
  just the local build.

## Requester's stated goals and constraints

(These are facts about what the requester wants. You may evaluate their feasibility and
soundness and flag conflicts with the tool's charter, but treat firm constraints as strong
inputs.)

- Add `*.stories.ts` type-check support to the `typecheck` targets.
- Stated as a MINIMUM: support the default Nx-scaffolded Angular+Storybook tsconfig layout
  (Layout A).
- Stated as an additional MINIMUM: support the centralized Storybook-host layout (Layout B,
  the official Nx recipe).
- Validate end-to-end against real OSS example projects using a packaged tarball.
- Ship as a FEATURE release, version 0.1.2, with NO breaking changes unless a need surfaces.
- Verification counts only against the officially supported stack (Nx 23.0.1 / Angular
  22.0.4 / TS 6.0.3); any incidental success on older stacks is informational only.
- Stretch: catalog common OSS tsconfig layouts and consider extending support further.

## Decisions to decide and harden

- D1. Whether v0.1.2 should type-check `*.stories.ts`, and for WHICH layouts (A / B / C), at
  what commitment level each (minimum, stretch, or excluded).
- D2. The correct diagnostic-boundary behavior when a walked leaf legitimately includes
  source files OUTSIDE the solution/host directory. Specifically, how should "in-project
  (report) vs out-of-project (suppress)" be determined so that: (a) a centralized host's
  aggregated stories ARE checked; (b) genuine third-party / `node_modules` diagnostics are
  NOT reported; (c) per-project isolation (not reporting an imported DEPENDENCY project's own
  internal errors) is preserved where that is desirable. Also: whether, and how, to avoid a
  SILENT passing verdict when diagnostics are being suppressed.
- D3. Which files within the Storybook tsconfig should be type-checked: only `*.stories.ts`,
  or the whole set the tsconfig declares (including `main.ts` / `preview.ts`, and for a
  centralized host the aggregated component / directive / source files).
- D4. How to handle the `@storybook/angular` peer-range incompatibility with Angular 22 /
  TS 6 (e.g. documentation only, a runtime gate, blocking, or an effect on the
  release/prerelease labeling), given the tool itself has no dependency on Storybook packages.
- D5. What validation makes the support real and shippable (unit and/or integration
  fixtures; packaged-tarball e2e; which layouts must be proven; on which stack), given no
  exact-stack public fixture exists.
- D6. Any breaking-change or new-public-API-surface implications, and whether the "no
  breaking changes / feature release 0.1.2" framing holds.
- D7. Whether the flat-no-references layout (C) should be supported, deferred, or excluded --
  and if not supported, whether the tool must still avoid a silent false pass on it.

## Your output (structured)

- For EACH decision D1..D7: your recommendation and the reasoning FROM YOUR ASSIGNED LENS. Be
  concrete and testable; state a confidence level (high / medium / low) per decision.
- "Key risks or objections": the main risks you see with the milestone as framed.
- "Facts that would change my position": list specific facts whose truth value would flip any
  of your recommendations.
- "Additional facts I want": anything material not in this pack (list it rather than blocking
  on it).
- Keep it structured and focused (roughly 600-1000 words). Do NOT modify any files. You may
  read referenced project files to verify facts, but this pack is intended to be
  self-sufficient. Return your analysis as your final message.
