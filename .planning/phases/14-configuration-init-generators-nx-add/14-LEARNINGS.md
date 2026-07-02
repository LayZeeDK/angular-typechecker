---
phase: 14
phase_name: "configuration + init generators, nx add"
project: "angular-typechecker"
generated: "2026-07-02"
counts:
  decisions: 5
  lessons: 4
  patterns: 4
  surprises: 3
missing_artifacts:
  - "14-UAT.md"
---

# Phase 14 Learnings: configuration + init generators, nx add

## Decisions

### `nx add` discovery: register `init` by literal key, no `ng-add` alias
`nx add angular-typechecker` runs the package's generator KEYED `init` (resolved via the `package.json` `generators` field). We register `init` by its literal key only and add NO `ng-add` alias.

**Rationale:** Traced against the installed Nx 23.0.1 source — `nx add` hardcodes `g <pkg>:init` and matches by generator key; the `generators` field is the only required manifest key (no `nx`/`schematics` key needed). An `ng-add` alias would falsely imply the deferred Angular-CLI schematic surface (GEN-FUT-02).
**Source:** 14-RESEARCH.md (§ nx add → init contract), 14-03-SUMMARY.md

### Whole-entry `??=` don't-clobber for the targetDefaults seed
`init` seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` only when the key is absent; an existing entry (any shape) is left untouched.

**Rationale:** The WALK-02 block (`cache:true` + `outputs:[]` + `default`-based inputs) is a COHERENT unit — a sub-key `??=` merge (the first-party `@nx/eslint`/`@nx/vitest` shape) could yield an incoherent block (e.g. a user's `production` inputs left in place while we add `outputs:[]`). Whole-entry guard fully satisfies GEN-07's "never clobber a customized entry." Documented deviation from first-party (D-05).
**Source:** 14-CONTEXT.md (D-05), 14-01-SUMMARY.md

### Seed the UNSCOPED published id only
`init` seeds `angular-typechecker:typecheck`, never the dev-repo scoped alias `@angular-typechecker/angular-typechecker:typecheck` (which exists only because this repo aliases its own package).

**Rationale:** A consumer's workspace uses the unscoped published id; seeding the scoped key would be dev-repo-specific noise a consumer never keys off.
**Source:** 14-01-SUMMARY.md, 14-CONTEXT.md (D-04)

### Config-edit-only generators → in-memory test substrate (no bespoke FsTree)
Both generators edit `project.json` + `nx.json` via `@nx/devkit` with NO `generateFiles`; unit tests run on the public in-memory `createTreeWithEmptyWorkspace`.

**Rationale:** A generator that emits no files needs no real-disk fidelity — board decision D1 / D-12. The bespoke `createFsTree`/`flushFsTreeChanges` helper stays deferred (FSTREE-01) unless a future generator emits files a real compiler must read back.
**Source:** 14-CONTEXT.md (D-12), 14-RESEARCH.md

### `--tsConfig` override semantics (OQ-1)
A relative `--tsConfig` is interpreted project-root-relative (`joinPathFragments(projectConfig.root, override)`) and existence-probed; an absolute override is honored verbatim.

**Rationale:** The user names a project and thinks project-relative; (b) yields a path the executor resolves correctly. Absolute paths cannot be probed against the workspace-relative Tree, so they pass through.
**Source:** 14-RESEARCH.md (OQ-1 RESOLVED), 14-02-SUMMARY.md

---

## Lessons

### An idempotent "rewrite" must MERGE, not replace
The first implementation replaced the whole target object on an idempotent re-run, silently discarding any user-added executor options (`maxWarnings`, `includeDeps`) or a `configurations` block. GEN-04's "no clobbered config" means preserve extra keys — re-assert only the executor id + resolved `tsConfig`.

**Context:** Deep code review finding WR-01; fixed in `c306eee` with `{ ...existing, executor, options: { ...existing?.options, tsConfig } }` + a merge-preserve spec case.
**Source:** 14-REVIEW.md (WR-01)

### An unprobed override defers a typo failure to execute time
A relative `--tsConfig` override that is not existence-probed writes a broken target into `project.json` and only fails when the executor runs — bypassing the crisp located-error contract the other resolution branches provide.

**Context:** Code review WR-02; fixed in `c306eee` with a `tree.exists` probe + located error. This also flipped an existing happy-path spec (the override test now must create the file).
**Source:** 14-REVIEW.md (WR-02)

### Write a WORKSPACE-root-relative tsConfig, not project-root-relative
The executor resolves `options.tsConfig` against the WORKSPACE root (`joinPathFragments(context.root, options.tsConfig)`), so a generator that writes a bare `tsconfig.json` (project-root-relative) produces a target that misses at run time. Build the path as `joinPathFragments(projectConfig.root, ...)` (root is already workspace-relative).

**Context:** RESEARCH Pitfall 1; the spec asserts the full `libs/<p>/tsconfig.json`.
**Source:** 14-RESEARCH.md (Pitfall 1), 14-02-SUMMARY.md

### The editor TS LSP false-positives on `import.meta` in generator specs
The new `*.spec.ts` files use `import.meta.url` (the established executor-tier pattern); the editor TS server flags it as a CommonJS-output error, but the pattern is correct under Vitest and the shipped executor specs already use it and pass in CI. The `nx test`/`nx build`/`nx lint` runners are the authoritative signal.

**Context:** Recurred across all three plans' new specs; consistent with the repo-wide "LSP diagnostics are not authoritative" rule.
**Source:** 14-01/02/03 spec files (repo test-tier convention)

---

## Patterns

### Generator tier mirrors the executor tier
New generators live at `src/generators/<name>/` (`generator.ts` + `schema.json` + `schema.d.ts` + `<name>.spec.ts` + `schema-parity.spec.ts`); the root `generators.json` mirrors `executors.json` (swap `implementation` → `factory`, drop `outputCapture`); `package.json`/`project.json`/`package-manifest.spec.ts` extend beside the `executors` entries.

**When to use:** Adding any new Nx generator (or executor) to this plugin.
**Source:** 14-PATTERNS.md, 14-01-SUMMARY.md, 14-03-SUMMARY.md

### `configuration`-calls-`init` composition
The project-editing generator awaits `init(tree, { skipFormat: true })` FIRST, then reads/mutates the project config, then formats ONCE at the end and returns `runTasksInSerial(...tasks)`.

**When to use:** Any Nx generator that must both seed workspace-level defaults (`nx.json`) and wire a per-project target — the first-party `@nx/eslint:lint-project` / `@nx/vitest:configuration` idiom.
**Source:** 14-RESEARCH.md (Pattern 1), 14-02-SUMMARY.md

### `@nx/nx-plugin-checks` is a free registration-correctness gate
`nx lint angular-typechecker` runs `@nx/nx-plugin-checks`, which validates every `generators.json` (and `executors.json`) `factory`/`schema` path resolves. A malformed manifest fails CI loudly rather than silently mis-registering.

**When to use:** Whenever adding/renaming a registered executor or generator — treat green lint as proof the registration is discoverable.
**Source:** 14-RESEARCH.md (Pitfall 5), 14-03-SUMMARY.md

### Verify Nx behavior against the installed `node_modules` source
The authoritative version of an Nx API/CLI contract is the installed `node_modules/nx` + `@nx/*` source (23.0.1), not web docs. Trace command implementations and copy first-party generator shapes directly.

**When to use:** Resolving any Nx API/behavior/discovery question — cite exact file:line from node_modules over documentation.
**Source:** 14-RESEARCH.md (Sources, HIGH-confidence primary)

---

## Surprises

### The `nx add` alias-discovery helper is DEAD CODE in Nx 23.0.1
`findInitGenerator` (which inspects `ng-add`/`init` aliases) is defined but never called anywhere in Nx 23.0.1; `nx add` hardcodes `g <pkg>:init` and matches by key. The widely-copied `aliases: ["ng-add"]` on `@nx/vitest`'s init is for Angular-CLI `ng add`, irrelevant to `nx add` — and `@nx/eslint`'s init omits it and still works.

**Impact:** Avoided shipping an unnecessary, misleading alias; simplified the manifest and kept the deferred Angular-CLI surface truly deferred.
**Source:** 14-RESEARCH.md (§ nx add → init contract, (b))

### Cumulative requirements must be scoped across plans to avoid audit false positives
GEN-05 (registration/packaging) and GEN-06 (unit tests) span all three plans. Each executor deliberately left the cross-plan requirement `Pending` rather than self-closing it early; the verifier closed GEN-06 once it was cumulatively satisfied.

**Impact:** Kept the milestone audit's 3-source cross-reference (VERIFICATION + SUMMARY + REQUIREMENTS) honest — no requirement marked done before its evidence existed across every contributing plan.
**Source:** 14-01/02/03-SUMMARY.md, 14-VERIFICATION.md

### `state.record-metric` is a no-op in this project
All three executors reported `state.record-metric` did nothing because STATE.md has no `## Performance Metrics` section — they skipped it rather than fabricating one.

**Impact:** Benign; flagged for the milestone audit in case that section is expected. No metric history is captured for this project.
**Source:** 14-01/02/03-SUMMARY.md
