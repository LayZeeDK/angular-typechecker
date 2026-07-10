# Pitfalls Research

**Domain:** Exposing an existing Nx-devkit executor + generators to a non-Nx Angular CLI (`angular.json`) workspace via `convertNxExecutor` / `convertNxGenerator` + an `ng-add` schematic (additive milestone v0.2.1)
**Researched:** 2026-07-10
**Confidence:** HIGH for the mechanism-level findings (read directly from the installed `@nx/devkit@23.0.1` + `nx@23.0.1` source and the shipped executor/generator source); MEDIUM for the OSS-repo suitability judgments (verified via GitHub API: `angular.json` present, no `nx.json`, Angular version, license) and for the `ng add` peer-friction extrapolation.

> Scope note: This builds on `.planning/research/PITFALLS.md` (the v0.0.1 Nx-plugin pitfalls -- ESM `await import()` downlevel, tarball packaging, peer ranges, cache correctness, path filtering). Those still apply to the shipped Nx surface and are NOT repeated. Everything below is NET-NEW to the Angular CLI surface. The single most important cross-reference is the v0.0.1 "Pitfall 1: `import()` -> `require()` rewrite" -- Pitfall 1 below re-assesses whether that (already-solved) bridge survives the NEW `convertNxExecutor` + `ng run` execution path.

## Key mechanism facts (verified from installed source)

Read from `node_modules/@nx/devkit/dist/src/utils/convert-nx-executor.js`, `.../invoke-nx-generator.js`, and `node_modules/nx/dist/src/generators/utils/project-configuration.js` + `nx-json.js` at the locked `23.0.1`:

- `convertNxExecutor(executor)` returns `require('@angular-devkit/architect').createBuilder(fn)`. Before calling our executor it EAGERLY runs `readNxJsonFromDisk(workspaceRoot)` + `retrieveProjectConfigurationsWithAngularProjects(workspaceRoot, nxJson)` (both from `nx/src/devkit-internals`), builds a full `projectsConfigurations`, then calls `executor(options, context)` with `projectGraph: null`, `taskGraph: null`, `cwd: process.cwd()`, and `root: builderContext.workspaceRoot`. It also `require('rxjs')`.
- Our `typecheckExecutor` reads ONLY `context.root` (verified in `normalize-options.ts`). It never touches `context.projectGraph` / `context.projectsConfigurations` / `context.projectName` / `context.taskGraph`. So the executor itself is well-behaved through the wrapper -- the risk is entirely in the wrapper's eager prelude and in what it `require()`s.
- `convertNxGenerator(generator)` wraps the Nx generator as an Angular Devkit schematic Rule via a `DevkitTreeFromAngularDevkitTree` adapter. It special-cases `UnitTestTree` (root `/` -> `/virtual`).
- `readProjectConfiguration(tree, name)` READS `angular.json` (a documented "temporary polyfill" that runs `toNewFormat`: `architect`->`targets`, `builder`->`executor`). READ works.
- `updateProjectConfiguration(tree, name, cfg)` WRITES only to `<root>/project.json` or, failing that, `<root>/package.json` (`nx` property); otherwise THROWS `Cannot update Project ... It either doesn't exist yet, or may not use project.json for configuration`. There is NO `angular.json` write-back path. (Confirmed by nrwl/nx#19104.)
- `updateNxJson(tree, json)` early-returns (`if (tree.exists('nx.json'))`) -- a NO-OP when `nx.json` is absent. So `init` seeds nothing on an Angular CLI workspace (and does NOT create a spurious `nx.json`).
- `@nx/devkit@23.0.1` declares NO dependency/peer on `@angular-devkit/architect` or `rxjs`; its only peer is `nx`.

## Critical Pitfalls

### Pitfall 1: Does the CJS-executor -> ESM-`@angular/compiler-cli` `await import()` bridge survive `convertNxExecutor` + `ng run`? (the headline risk)

**Verdict: it SHOULD survive -- LOW-to-MEDIUM residual risk -- but it MUST be proven by an early spike before any other v0.2.1 work.**

**Why it should survive (mechanism):** The `await import('@angular/compiler-cli')` bridge does NOT live in the executor entry point. It lives in `core/compiler-loader.js`, which the shipped package already compiles with `module: nodenext` (the existing GATE A static spec asserts the literal `import(` survives in `compiler-loader.js` and is never present as a `require()` of compiler-cli). `convertNxExecutor` does not re-transform code -- it returns a builder that calls our already-compiled `executor` default export, which reaches the already-compiled `compiler-loader.js`. Angular CLI's `@angular-devkit/architect` loads a builder implementation via `require()` (CommonJS) exactly the way Nx's executor loader `require()`s an executor. Same CJS host, same untransformed dynamic `import()`, same Node ESM loader (Node 22/24/26 always support it). The calling harness (architect vs Nx) is irrelevant to whether an already-emitted `import()` runs.

**Where the residual risk actually is (the adjacent failure modes, all realistic):**
1. **The wrapper's eager project-graph prelude, not our code, fails first.** `convertNxExecutor` runs `retrieveProjectConfigurationsWithAngularProjects` BEFORE our executor. This is the exact surface of nrwl/nx#19475: converted Angular executors threw `Cannot use import statement outside a module` during project-graph building when async executor resolution raced `unregisterPluginTSTranspiler` (with `useDaemonProcess: false`). That specific bug was about on-the-fly `.ts` executor transpilation (we ship `.js`, so we are likely immune to that exact race), but it proves the wrapper's prelude is a real, ESM-sensitive execution phase that runs in the consumer workspace and can fail before our engine is even reached.
2. **The new builder-wrapper file must be compiled by the SAME `nodenext` tsconfig.** If the new `builder.ts` (the `convertNxExecutor(executor)` re-export) is accidentally built under a different/`commonjs` config, the wrapper itself is fine (it does no `import()`), but any drift in the build graph that recompiles `compiler-loader.ts` under `commonjs` re-introduces the v0.0.1 downlevel bug. GATE A's build-output assertion must be EXTENDED to cover the builder entry path.
3. **Undeclared runtime `require()`s** (`@angular-devkit/architect`, `rxjs`) resolve from the consumer -- see Pitfall 5.

**How to avoid / verify early:** Add a spike (call it GATE A') that, in a scratch real Angular CLI (`angular.json`) workspace on Node 22/24/26: (a) installs the SHIPPED/packed tarball, (b) wires a `typecheck` architect target at the converted builder, (c) runs a real `ng run <project>:typecheck`, and (d) asserts the run reaches the compiler and emits real diagnostics with NO `ERR_REQUIRE_ESM`, NO `require() of ES Module`, and NO `Cannot use import statement outside a module`. Pair it with a static assertion (mirror the existing `gate-a-static.spec.ts`) that the builder-entry build output still contains an untransformed `import(` reachable from `compiler-loader.js` and never a `require()` of compiler-cli. Do this on BOTH an on-stack (Angular 22) and an off-stack (Angular 21) workspace.

**Warning signs:** The builder run throws before printing any diagnostic; `ng run` errors mention project-graph / daemon / `import statement outside a module`; it works under `nx run` (Nx loader) but fails under `ng run` (architect loader); passes on the maintainer's daemon-enabled machine but fails in CI where the daemon is off.

**Phase to address:** A DEDICATED early spike phase (first phase of the milestone), gating GO/NO-GO on the entire builder feature -- exactly as Phase 16 gated Layout B in v0.2.0.

---

### Pitfall 2: The existing `configuration` generator's `updateProjectConfiguration` cannot write into `angular.json` -- the `typecheck` target is never wired where `ng run` looks

**What goes wrong:**
The shipped `configuration` generator writes the target with `updateProjectConfiguration(tree, project, projectConfig)`. In a real Angular CLI workspace, a project's config lives in the root `angular.json` and the project root usually has NEITHER a `project.json` NOR a `package.json`. `updateProjectConfiguration` then THROWS (`Cannot update Project ... may not use project.json for configuration`). Where a library root DOES have a `package.json`, it silently writes the target into `packageJson.nx.targets` -- a location Angular CLI never reads. Either way, `ng run <project>:typecheck` fails with "target not found" because nothing was added to `angular.json`'s `projects[name].architect`.

**Why it happens:**
`readProjectConfiguration` READS `angular.json` via a polyfill, so the generator's *read* side works and the bug is invisible in any unit test seeded with a `project.json` (e.g. `createTreeWithEmptyWorkspace`). Developers reasonably assume the symmetric `updateProjectConfiguration` also round-trips to `angular.json`. It does not -- there is no `toOldFormat` write path (confirmed in `nx@23.0.1` source and nrwl/nx#19104). This is THE reason `convertNxGenerator` alone does not make the generator "just work" on Angular CLI.

**How to avoid:**
- The Angular CLI configuration/`ng-add` schematic must write the target into `angular.json` directly: `updateJson(tree, 'angular.json', ...)` adding `projects[project].architect[targetName] = { builder: 'angular-typechecker:typecheck', options: { tsConfig } }` (note `builder`, not `executor`; and `architect`, which Angular CLI also accepts as `targets`). Alternatively use `@schematics/angular/utility/workspace` `updateWorkspace`. Keep the tsconfig-resolution logic (`resolveTsConfig`) -- only the write sink changes.
- Do NOT re-export the existing generator's write path verbatim through `convertNxGenerator`. Extract the shared resolution; branch the write on workspace kind (Nx `project.json`/devkit vs Angular `angular.json`), OR ship a distinct schematic for the CLI surface.
- Preserve the existing idempotency + non-ours-collision guard against the `angular.json` target map (same semantics: rewrite our target, throw on a foreign same-named target).

**Warning signs:**
`nx g` tests pass but `ng generate` throws `Cannot update Project ...`; or `ng generate` "succeeds" but `ng run <p>:typecheck` reports the target does not exist; a stray `nx` block appears in a library's `package.json`.

**Phase to address:** The Angular-CLI schematic (configuration/ng-add) phase. Verification: an `angular.json`-substrate test (Pitfall 9) + the real-repo e2e.

---

### Pitfall 3: `init` (`updateNxJson`) is a silent no-op on Angular CLI -- `ng add`'s caching value-prop evaporates

**What goes wrong:**
`init` seeds `nx.json` `targetDefaults` for cacheability. `updateNxJson` early-returns when `nx.json` is absent, so on a pure Angular CLI workspace `init` reads `null` -> builds an in-memory `{}` -> writes nothing. It does not error and does not create a spurious `nx.json` (good), but it also delivers zero of its purpose. If `ng-add` calls the existing `init` (as `nx add` does), the install "succeeds" while doing nothing -- a classic looks-done-but-isn't. Angular CLI has no `targetDefaults`/task-cache concept, so there is nothing meaningful to seed.

**Why it happens:**
The "additive re-export" instinct is to have `ng-add` call the same `init` that `nx add` calls. But `init`'s entire job (cache seeding) is Nx-only. The PROJECT.md charter already flags "No Nx caching analog" as a genuine fork; the source confirms the fork is forced, not optional.

**How to avoid:**
- The `ng-add` schematic should NOT invoke the Nx `init` on an Angular CLI workspace. It should do only the Angular-meaningful work: register the package and wire the builder target into `angular.json` (delegating to the Pitfall-2 write path). If any "init-like" step remains, make it an explicit, logged no-op ("Angular CLI has no target cache; skipping cache seeding") rather than a silent devkit call that quietly does nothing.
- Document in the README that on Angular CLI the tool is not cacheable (unlike the Nx surface) -- consumers rely on their own CI caching.

**Warning signs:** `ng add` prints success but nothing changed except `package.json` deps; consumers ask "where's the caching?"; a test asserts `init` seeded something and passes only because it ran on an Nx tree, not an `angular.json` tree.

**Phase to address:** The `ng-add` schematic phase (define what ng-add DOES on Angular CLI vs what init does on Nx).

---

### Pitfall 4: Installing the package drags `nx` into a non-Nx workspace, and the builder REQUIRES it at runtime

**What goes wrong:**
`angular-typechecker` depends on `@nx/devkit@23.0.1`, whose peer is `nx: ">= 22 <= 24 || ^23.0.0-0"`. `ng add` / `npm i` into a pure Angular CLI workspace therefore auto-installs `nx` (npm 7+ peer auto-install) -- the very tool the consumer chose to avoid -- as a heavyweight transitive install. This is not merely cosmetic: `convertNxExecutor` calls `nx/src/devkit-internals` (`readNxJsonFromDisk`, `retrieveProjectConfigurationsWithAngularProjects`) at RUNTIME, so `nx` MUST be present for the builder to run at all. Running the builder can also materialize a `.nx/` workspace-data / file-hash cache directory in the consumer's Angular CLI workspace (Nx workspace-context side effect) -- a surprising artifact in a repo with no other Nx footprint.

**Why it happens:**
The thin-re-export approach (mandated by the charter: "a thin re-export over the SAME core + Nx executor, NOT a hand-written `@angular-devkit/architect` builder") inherently pulls Nx's devkit-internals into the builder path. There is no way to use `convertNxExecutor` without `nx` at runtime.

**How to avoid:**
- Accept and DOCUMENT it: the Angular CLI builder path installs `nx` transitively and needs it at runtime; this is the cost of reusing the identical engine. It is a tradeoff, not a bug.
- Add `.nx/` to the README's "expect this artifact" note and confirm the e2e tolerates/cleans it.
- Do NOT attempt to hand-write a pure `@angular-devkit/architect` builder to avoid `nx` -- that is explicitly out of charter (would fork the engine and risk the never-false-pass guarantee) and would become v0.3.0-scope work.

**Warning signs:** Consumers surprised by a large `nx` install and a `.nx/` folder; `ng run` fails with "cannot find module nx/src/devkit-internals" when `nx` failed to install (e.g. behind a strict peer resolver).

**Phase to address:** `ng-add` / packaging phase (peer + docs); e2e phase (verify `.nx/` artifact tolerance).

---

### Pitfall 5: Undeclared runtime dependencies `@angular-devkit/architect` and `rxjs`

**What goes wrong:**
`convertNxExecutor` does `require('@angular-devkit/architect')` and `require('rxjs')` at runtime, resolved from the CONSUMER's `node_modules`. `@nx/devkit@23.0.1` declares neither, and `angular-typechecker` declares neither. In a real Angular CLI workspace both are present (Angular CLI depends on them), so it works incidentally -- but it is an implicit, unpoliced runtime contract. `@nx/dependency-checks` will not catch it (the code that imports them lives in `@nx/devkit`, not in our source), and it would break for any non-Angular-CLI consumer that somehow loaded the builder.

**Why it happens:**
The `require()`s are inside a dependency's compiled code, invisible to the plugin's own dependency linter, and satisfied by coincidence in the only workspaces the builder is meant for.

**How to avoid:**
- Declare `@angular-devkit/architect` and `rxjs` as `peerDependencies` with `peerDependenciesMeta.<dep>.optional: true` (optional so the pure-Nx consumer is not forced to install them), and document that the Angular CLI builder path requires them (satisfied by any Angular CLI workspace). This also documents intent for `attw`/`publint`.
- The e2e (real `ng run`) is the true backstop that both resolve.

**Warning signs:** `Cannot find module '@angular-devkit/architect'` / `'rxjs'` when the builder runs in an unusual workspace; passes only because the dev repo happens to have Angular installed.

**Phase to address:** Packaging/peer-deps phase; e2e phase.

---

### Pitfall 6: `ng add` peer-dependency friction on Angular < 22 (the consumer-facing side of the dev-repo `legacy-peer-deps` carry-forward)

**What goes wrong:**
`angular-typechecker` peer-caps `@angular/compiler-cli: ^22.0.0` and `typescript: >=6.0.0 <6.1.0`. `ng add angular-typechecker` on an Angular 20/21 consumer (npm 7+ strict peers) fails with `ERESOLVE`. The dev-repo mitigation (`.npmrc legacy-peer-deps=true`) does NOT reach consumers (STATE.md), so a real off-stack consumer must pass `--legacy-peer-deps`/`--force` themselves. This directly hits the e2e: the best "real app" fixtures (RealWorld, Ismaestro) are Angular 21, so their install leg needs `--legacy-peer-deps` -- while the on-stack Angular 22 fixture does not. This mirrors the v0.2.0 `@storybook/angular` peer-cap handling (documented, never gated) and the radix-ng off-stack pattern.

**Why it happens:**
The locked stack is Angular 22 / TS 6 only; the peer range is deliberately narrow. `ng add` runs the package manager's install with strict peer resolution before the schematic even runs.

**How to avoid:**
- e2e: install the tarball into the Angular-21 fixtures with `--legacy-peer-deps` (off-stack, executor runs off-stack per the established pattern); install into the Angular-22 fixture WITHOUT it (on-stack proves no friction). Assert the executor still produces correct diagnostics off-stack.
- README: document that on Angular 20/21 the install needs `--legacy-peer-deps` (the compiler-cli peer caps at 22); never gate it in code.
- Watch the `nx add`-on-pnpm interaction (`ERR_PNPM_IGNORED_BUILDS`, see the project memory) if any e2e uses pnpm -- `ng add` has the same PM-forwarding shape.

**Warning signs:** `ERESOLVE unable to resolve dependency tree` on `ng add` against Angular 21; e2e green only because it silently used `--force`.

**Phase to address:** e2e phase + docs phase.

---

### Pitfall 7: Reusing the Nx executor `schema.json` for the Angular builder trips Angular CLI's stricter schema validation

**What goes wrong:**
Angular CLI validates builder options with `@angular-devkit/core`'s JSON-schema parser, which differs from Nx's. Nx-specific schema extensions the executor `schema.json` carries -- `cli: "nx"`, `x-prompt`, `x-priority`, `x-completion-type`, and especially `$default` positional-argument mappings -- are not honored the same way (some are ignored, some can warn or reject). A builder reusing the executor schema verbatim may fail option parsing or drop the required `tsConfig`.

**Why it happens:**
`convertNxExecutor` converts the executor CODE, not the schema; the `builders.json` still needs a schema, and copying the executor's is the obvious move. The two CLIs have divergent schema dialects.

**How to avoid:**
- Author a builder-specific `schema.json` (or a sanitized copy) for `builders.json`: drop `cli: "nx"` / `x-*` extensions and `$default` positional args; keep plain typed properties with `tsConfig` required. Reuse the SAME TypeScript options interface (`TypecheckExecutorOptions`) so the code path is shared.
- Add a schema-parity test asserting the builder schema and the executor schema describe the same option surface (the repo already has `schema-parity.spec.ts` precedent).
- Verify `ng run <p>:typecheck --tsConfig=... --includeDeps --maxWarnings=0` parses each option.

**Warning signs:** `ng run` errors on an unknown/invalid schema property; `tsConfig` arrives `undefined` at the executor; positional `ng run <p>:typecheck path/to/tsconfig.json` is not mapped.

**Phase to address:** Builder wiring phase (`builders.json` + schema).

---

### Pitfall 8: The reference-walk never engages on Angular CLI (no TS project references) -> spec files silently unchecked

**What goes wrong:**
The v0.1.0 engine's completeness relies on walking a solution `tsconfig.json`'s `references[]`. Angular CLI workspaces do NOT use TypeScript project references (PROJECT.md: "Angular lacks TypeScript project-references support"): a CLI app has `tsconfig.json` (base) + `tsconfig.app.json` + `tsconfig.spec.json` with no `references[]`. So `resolveTsConfig` falls through branch 2 (no non-empty `references`) to branch 3 (flat-project leaf = `tsconfig.app.json` for an application). The `typecheck` target then checks ONLY the app leaf; `tsconfig.spec.json` is never walked. A consumer expecting the tool's "complete" promise gets app-only coverage, silently missing all spec type errors.

**Why it happens:**
The walk is the mechanism that folds in the spec leaf on Nx; without references there is nothing to walk, and the single-leaf fallback is correct but partial. The `realworld-angular` fixture confirms the CLI shape (`@angular/build:application` + separate `tsconfig.spec.json`, no references).

**How to avoid:**
- Document explicitly (README, matching the v0.2.0 coverage-claim discipline) that on Angular CLI a single `typecheck` target checks one tsconfig leaf; spec checking requires a second target or `--tsConfig tsconfig.spec.json`.
- Consider having the Angular CLI configuration schematic wire TWO targets (e.g. `typecheck` -> `tsconfig.app.json` and `typecheck-spec` -> `tsconfig.spec.json`) or accept a documented `--tsConfig` override. Keep this ADDITIVE (a schematic behavior choice), not an engine change.
- e2e must plant BOTH an app-source error and a spec-source error and assert whether each is caught under the chosen target wiring -- so partial coverage is a deliberate, tested decision, never an accident.

**Warning signs:** e2e catches an app error but a planted `.spec.ts` error passes green; consumers report "it misses my test type errors."

**Phase to address:** Engine/resolution reuse phase + configuration schematic phase; verified in e2e.

---

## Additive-only pitfalls (accidentally forcing a v0.3.0 bump)

The charter is ADDITIVE-ONLY: no breaking change to the Nx executor id, the `runTypecheck`/`CoreResult`/`CoreOptions` public API, or the existing generator schemas. These moves would silently break the Nx surface:

| Change | Why it breaks the Nx surface | Additive alternative |
|--------|------------------------------|----------------------|
| Modifying `typecheckExecutor`'s signature or making it read `context.projectGraph`/`projectsConfigurations` | Those are `null` under `convertNxExecutor`; reading them breaks the builder AND risks the Nx path | Keep the executor reading ONLY `context.root` (already true, verified); the builder wrapper is a NEW file that re-exports the SAME default export |
| Editing the existing `configuration`/`init` generator's write path to target `angular.json` | Changes behavior on Nx workspaces | Branch on workspace kind, or ship a SEPARATE Angular-CLI schematic; leave the Nx generators byte-stable |
| Removing/renaming entries when adding `builders`/`schematics` to `package.json` | Nx reads `executors`/`generators`; dropping them breaks `nx run`/`nx g` | ADD `builders` + `schematics` fields alongside the existing `executors` + `generators`; Nx ignores `builders`, Angular ignores `executors`/`generators` |
| Widening/altering the shared `schema.json` to satisfy Angular CLI | Changes the Nx executor's validated option surface | Give the builder its OWN schema (Pitfall 7); keep the executor schema unchanged |
| Trimming the public barrel (`src/index.ts`) while re-exporting a builder | A barrel change is a public-API break (precedent: the v0.1.0 barrel trim was breaking) | Do not touch the barrel; the builder is discovered via `builders.json` by path, never via the barrel |

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Re-export the existing generator via `convertNxGenerator` and assume the write "just works" | Zero new code | `updateProjectConfiguration` throws / mis-writes on `angular.json`; the target is never wired (Pitfall 2) | Never -- the write sink MUST be `angular.json`-aware |
| Test the converted schematic only on `createTreeWithEmptyWorkspace` | Reuses the existing substrate | Seeds an Nx tree, exercises the polyfilled READ path, hides the `angular.json` WRITE failure | Never for the CLI write path -- add an `angular.json` substrate |
| Call the Nx `init` from `ng-add` | Symmetry with `nx add` | Silent no-op; misleading "success" (Pitfall 3) | Never -- ng-add should skip cache seeding explicitly |
| Reuse the executor `schema.json` for the builder verbatim | One less file | Angular CLI schema-validation warnings / dropped `tsConfig` (Pitfall 7) | Only after verifying Angular CLI accepts every `x-*`/`$default` field (it won't) |
| Skip the on-stack (Angular 22) e2e, rely on Angular-21 fixtures only | Easier fixtures | Never proves the SUPPORTED stack; off-stack masks peer + TS6 issues | Only as an interim; the on-stack e2e is the real gate |
| Verify the ESM bridge only via unit tests / `nx run` | Fast | Never exercises the `ng run` + architect + eager-project-graph path (Pitfall 1) | Never -- the spike must use a real `ng run` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `convertNxExecutor` + `ng run` | Assume the CJS->ESM `import()` bridge might be re-transformed | It is not re-transformed; the risk is the wrapper's eager project-graph prelude + undeclared `require()`s -- prove with a real `ng run` spike |
| `convertNxGenerator` write path | `updateProjectConfiguration` round-trips to `angular.json` | It does NOT; write `angular.json` directly (`updateJson`/`updateWorkspace`) |
| `updateNxJson` on Angular CLI | Expect it to seed caching | No-op when `nx.json` absent; skip init on Angular CLI |
| Angular CLI builder discovery | Reuse the `executors` field | Angular CLI reads `builders` (-> `builders.json`); ADD it alongside `executors` |
| `ng add` discovery | Reuse the `generators` field | Angular CLI reads `schematics` for `ng-add`; ADD it alongside `generators` |
| Builder options schema | Reuse the Nx executor schema | Author a builder schema without `cli:"nx"`/`x-*`/`$default` |
| Runtime `nx` presence | Assume a non-Nx workspace has no `nx` | `convertNxExecutor` needs `nx/src/devkit-internals` at runtime; `nx` installs transitively via `@nx/devkit`'s peer |
| Testing substrate | Use `createTreeWithEmptyWorkspace` for CLI tests | Use `@angular-devkit/schematics/testing` `SchematicTestRunner`/`UnitTestTree` (root patched to `/virtual`) with an `angular.json`; `@angular-devkit/architect/testing` for the builder |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `convertNxExecutor`'s eager `retrieveProjectConfigurationsWithAngularProjects` runs on every `ng run` | Slow builder start; `.nx/` cache appears | Accept (inherent); our executor ignores the result -- only `context.root` is used | Large `angular.json` workspaces |
| No Nx cache on the Angular CLI surface | Every `ng run <p>:typecheck` re-runs the whole-program check | Document; rely on the consumer's CI caching (no `targetDefaults` analog) | Every repeated run |
| Whole-program check per invocation (inherited) | Slow on large apps | Same as the Nx surface (incremental deferred) | Large apps |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Publishing the CLI surface without re-running the tarball audit (`publint`/`attw`) | `builders.json`/`schema.json`/`ng-add` collection missing from the tarball -> `ng add`/`ng run` fails post-publish | Extend the existing tarball-content assertion to include `builders.json`, the builder `schema.json`, and the `ng-add`/schematics collection JSON |
| Adding a broad `nx`/architect peer to satisfy the builder | Widening trusted install surface | Use `peerDependenciesMeta.optional` for architect/rxjs; keep `nx` flowing only via `@nx/devkit`'s existing peer |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `ng add` reports success but seeded no caching (Pitfall 3) | User believes caching is configured | Print an explicit "Angular CLI has no target cache; not configuring caching" notice |
| Single `typecheck` target silently skips specs (Pitfall 8) | User trusts a green run that never checked `.spec.ts` | Document the one-leaf coverage; offer a spec target / `--tsConfig` |
| Cryptic `Cannot update Project ...` from the wrong generator path (Pitfall 2) | Confusing failure with no fix hint | Detect the `angular.json` workspace and take the correct write path (no throw) |

## "Looks Done But Isn't" Checklist

- [ ] **ESM through `ng run`:** A real `ng run <p>:typecheck` in an `angular.json` workspace loads `@angular/compiler-cli` and prints diagnostics with NO `ERR_REQUIRE_ESM` / `Cannot use import statement outside a module` (not just `nx run` / unit tests).
- [ ] **Target wired into `angular.json`:** After `ng generate`/`ng add`, `angular.json` `projects[p].architect.typecheck` exists with `builder: "angular-typechecker:typecheck"` (NOT a `project.json`/`package.json` `nx` block, NOT a throw).
- [ ] **ng-add does the right thing:** Wires the target; does NOT silently call a no-op Nx `init`; prints an explicit no-caching notice.
- [ ] **Builder discovery:** `package.json` has `builders` + `schematics` fields ALONGSIDE `executors` + `generators`; tarball includes `builders.json` and the builder `schema.json`.
- [ ] **Options parse under `ng run`:** `--tsConfig`, `--includeDeps`, `--maxWarnings`, `--failFast`, `--strict` all parse (builder schema, not the raw Nx schema).
- [ ] **Peer friction:** On Angular 21 the install needs `--legacy-peer-deps`; on Angular 22 it does not -- both exercised in e2e.
- [ ] **Spec coverage:** e2e plants BOTH an app error and a spec error; coverage of each matches the documented claim.
- [ ] **Additive:** `nx run <p>:typecheck`, `nx g angular-typechecker:configuration`, `runTypecheck` import, and the executor id are all UNCHANGED after the milestone (no v0.3.0 trigger).
- [ ] **`.nx/` tolerance:** e2e tolerates/cleans the `.nx/` artifact the builder creates in the consumer workspace.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ESM bridge fails under `ng run` (Pitfall 1) | MEDIUM-HIGH | If the wrapper prelude is the cause, confirm daemon/`.js`-only; if a build-config drift downleveled `compiler-loader.js`, restore `nodenext`; worst case, the thin re-export is infeasible and the milestone re-scopes (document, do NOT hand-write an architect builder) |
| Target not wired into `angular.json` (Pitfall 2) | LOW-MEDIUM | Switch the write to `updateJson`/`updateWorkspace` on `angular.json`; add an `angular.json`-substrate test |
| ng-add no-op init shipped (Pitfall 3) | LOW | Remove the init call from ng-add; patch |
| Undeclared architect/rxjs breaks an install (Pitfall 5) | LOW | Add optional peers; patch |
| Peer ERESOLVE on Angular 21 consumer (Pitfall 6) | LOW (docs) | Document `--legacy-peer-deps`; no code change |
| Builder schema rejected by Angular CLI (Pitfall 7) | LOW | Ship a sanitized builder `schema.json`; patch |
| Specs silently unchecked (Pitfall 8) | LOW-MEDIUM | Document + add a spec target / `--tsConfig`; patch |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. ESM `import()` through `convertNxExecutor` + `ng run` | DEDICATED early spike (GATE A') -- first phase, GO/NO-GO | Real `ng run` in a scratch `angular.json` workspace (on-stack + off-stack) loads compiler-cli, no ERR_REQUIRE_ESM; extend the GATE A build-output static assertion to the builder entry |
| 2. `updateProjectConfiguration` can't write `angular.json` | Angular CLI configuration/schematic phase | `angular.json`-substrate test asserts the target lands in `architect`; real-repo e2e `ng run` finds it |
| 3. `init` no-op on Angular CLI | `ng-add` phase | ng-add wires the target and prints a no-caching notice; asserts no `nx.json`/`init` call on an `angular.json` tree |
| 4. `nx` dragged in + required at runtime | Packaging/`ng-add` + docs phase | e2e confirms `nx` installs and the builder runs; README documents the tradeoff + `.nx/` artifact |
| 5. Undeclared architect/rxjs | Packaging/peer-deps phase | Optional peers declared; e2e `ng run` resolves both |
| 6. `ng add` peer friction (Angular < 22) | e2e + docs phase | Angular-21 install with `--legacy-peer-deps`, Angular-22 without; README caveat |
| 7. Builder schema validation | Builder wiring phase | Builder-specific schema; `ng run` parses every option; schema-parity test |
| 8. Walk never engages -> specs unchecked | Resolution reuse + configuration schematic phase | e2e plants app + spec errors; coverage matches the documented claim |
| Additive-only regressions | Every phase (code-review gate) | `nx run`/`nx g`/`runTypecheck`/executor-id unchanged; barrel untouched; `builders`/`schematics` added, not replaced |

## Real OSS Angular CLI (`angular.json`, non-Nx) repos for end-to-end verification

Verified 2026-07-10 via the GitHub API: `angular.json` present, NO `nx.json`/`project.json` at root, Angular version from `package.json`, license, size/stars. Clones are LOCAL-ONLY for e2e (not committed), matching the v0.2.0 radix-ng cross-check pattern.

| Repo | URL | Angular / TS | Non-Nx `angular.json`? | License | Size / Stars | Suitability |
|------|-----|--------------|------------------------|---------|--------------|-------------|
| **realworld-angular/realworld-angular** (TOP PICK, on-stack) | https://github.com/realworld-angular/realworld-angular | **Angular 22.0 / TS 6.0.3** (`@angular/build:application` builder) | YES -- `angular.json`, no `nx`/`@nx` dep, single `application` project | **MIT** | ~1.5 MB, 183 stars, pushed 2026-06-28, active | Best on-stack e2e: EXACT locked stack (Ng22/TS6), small + fast to clone, real Conduit app (auth/routing/HTTP/forms/guards), MIT, uses the modern `@angular/build` esbuild builder -- proves `ng run <p>:typecheck` against the supported stack with NO peer friction. The Angular-CLI analog of radix-ng being the on-stack Ng22 cross-check for v0.2.0. |
| **realworld-apps/angular-realworld-example-app** (off-stack "real app" cross-check) | https://github.com/realworld-apps/angular-realworld-example-app | Angular 21.2 / TS 5.9 | YES -- `angular.json`, LICENSE present | Other (MIT-family, GitHub-unclassified) | 5620 stars, pushed 2026-06-15, active | The canonical, most-starred Conduit RealWorld app: real HTTP/auth/routing/forms. Strong "does it work on a real app" signal off-stack (executor runs off-stack per the established pattern). Install needs `--legacy-peer-deps` (Ng21 vs our `^22` peer, Pitfall 6). Verify the LICENSE text before any redistribution. |
| **Ismaestro/angular-example-app** (off-stack, feature-rich) | https://github.com/Ismaestro/angular-example-app | Angular 21.2 / TS 5.9 | YES -- `angular.json`, no `nx.json` | **NONE (no LICENSE file)** | ~18 MB, 2386 stars, pushed daily (very active) | Feature-rich (i18n, signals, CRUD, auth, lazy loading) and the most actively maintained. Good stress fixture for diagnostics breadth. Two knocks: NO license (local-clone-only, never redistribute/vendor) and larger clone. Off-stack -> `--legacy-peer-deps`. Use as a secondary breadth check, not the primary gate. |
| asadnobi/angular-17-standalone-example (minimal, NOT recommended) | https://github.com/asadnobi/angular-17-standalone-example | Angular 17 | YES -- `angular.json` | none | 1 star, stale (2024) | Only if a deliberately tiny/old Angular-17 smoke fixture is wanted. Too stale/unmaintained and unlicensed to be a real gate; prefer the three above. |

**Recommended e2e set:** `realworld-angular/realworld-angular` as the PRIMARY on-stack gate (Angular 22 / TS 6.0.3, MIT, real app, no peer friction) + `realworld-apps/angular-realworld-example-app` as the off-stack real-app cross-check (with `--legacy-peer-deps`). Add `Ismaestro/angular-example-app` only as an optional breadth check (mind the missing license and size). Angular 22 non-Nx OSS apps are still scarce (Angular 22 is very new), so the exact-stack `realworld-angular` match is a fortunate and decisive find.

## Sources

- Installed `node_modules/@nx/devkit@23.0.1/dist/src/utils/convert-nx-executor.js` + `invoke-nx-generator.js` (read directly) -- HIGH: `convertNxExecutor` uses `require('@angular-devkit/architect')`/`require('rxjs')`, eager `readNxJsonFromDisk` + `retrieveProjectConfigurationsWithAngularProjects`, passes `projectGraph:null`/`root:workspaceRoot`; `convertNxGenerator` adapter + `UnitTestTree` `/virtual` patch.
- Installed `node_modules/nx@23.0.1/dist/src/generators/utils/project-configuration.js` + `nx-json.js` (read directly) -- HIGH: `readProjectConfiguration`/`getProjects` `angular.json` polyfill via `toNewFormat`; `updateProjectConfiguration` writes only `project.json`/`package.json` (throws otherwise); `updateNxJson` no-op when `nx.json` absent.
- Shipped source: `packages/angular-typechecker/src/executors/typecheck/{executor,normalize-options,gate-a-static.spec}.ts`, `src/generators/{configuration,init}/generator.ts`, `src/index.ts`, `package.json`, `executors.json` (read directly) -- HIGH: executor reads only `context.root`; `import(` bridge lives in `compiler-loader.js`; generators use `update*Configuration`/`updateNxJson`.
- [updateProjectConfiguration not compatible with `ng g` (nrwl/nx#19104)](https://github.com/nrwl/nx/issues/19104) -- HIGH: confirms `updateProjectConfiguration` looks for `project.json` and fails on Angular CLI; recommends reading/writing `angular.json` directly.
- [Custom Angular Executor no longer works in 16.9.0-16.10.0 (nrwl/nx#19475)](https://github.com/nrwl/nx/issues/19475) -- MEDIUM: converted Angular executors + `useDaemonProcess:false` -> "Cannot use import statement outside a module" during project-graph build (async executor resolution vs `unregisterPluginTSTranspiler`).
- [convertNxExecutor | Nx](https://nx.dev/docs/reference/devkit/convertNxExecutor) -- HIGH: one-way Nx->Angular builder conversion.
- [Angular Schematics and Builders (deprecated) | Nx](https://nx.dev/docs/reference/deprecated/angular-schematics-builders) + [Angular support for Nx Project Crystal (nrwl/nx#21994)](https://github.com/nrwl/nx/discussions/21994) -- MEDIUM: `@nx/angular` removed `convertNx*` internal usage in Nx 17 (maintenance cost); the devkit functions remain.
- [Better Code Generation in Angular CLI workspaces with Nx Devkit (DEV / Nx)](https://dev.to/nx/better-code-generation-in-angular-cli-workspaces-with-nx-devkit-3m09) -- MEDIUM: official pattern of reading `angular.json` directly (`readJson(tree,'angular.json')`) in a `convertNxGenerator` schematic.
- [Usage of `convertNxExecutor` should not incur installing `@swc` (nrwl/nx#10441)](https://github.com/nrwl/nx/issues/10441) -- LOW-MEDIUM: `convertNxExecutor` pulls extra runtime surface.
- GitHub API (repos + contents + license + package.json), fetched 2026-07-10 -- HIGH: `realworld-angular/realworld-angular` Angular 22.0/TS 6.0.3 MIT no-nx `angular.json`; `realworld-apps/angular-realworld-example-app` Angular 21.2 5620 stars LICENSE; `Ismaestro/angular-example-app` Angular 21.2 no-license; `asadnobi/angular-17-standalone-example` Angular 17 stale.
- Project context: `.planning/PROJECT.md`, `.planning/STATE.md` (dev-repo `.npmrc legacy-peer-deps` does not reach consumers; no TS project references in Angular), `.planning/research/PITFALLS.md` (v0.0.1 ESM/tarball/peer pitfalls) -- HIGH.

---
*Pitfalls research for: Angular CLI (`angular.json`) surface for angular-typechecker via convertNx* + ng-add (milestone v0.2.1)*
*Researched: 2026-07-10*
