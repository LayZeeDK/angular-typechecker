# Pitfalls Research

**Domain:** Nx plugin executor wrapping `@angular/compiler-cli`, published to npm, tested across project types and OSes
**Researched:** 2026-06-27
**Confidence:** MEDIUM-HIGH (most findings verified against official Nx/Angular/npm docs + tracked GitHub issues; a few are LOW and flagged inline)

> Scope note: This file deliberately covers ONLY net-new pitfalls beyond the already-identified
> list (ngc `defaultGatherDiagnostics` short-circuit, compiler-cli ESM-only, require()-based Nx
> executor loader, whole-program caching not file-granular, `FsTree` internal import,
> `create-nx-workspace` fresh-dir requirement, Verdaccio/Windows-arm64 e2e friction, extended
> diagnostics default-to-warning). Those are assumed handled. Everything below is an ADDITION.

## Critical Pitfalls

### Pitfall 1: TypeScript silently rewrites `await import()` back to `require()` under `module: commonjs`

**What goes wrong:**
The architecture is a CJS executor that loads ESM `@angular/compiler-cli` via `await import()`. If
the executor is compiled with the legacy `"module": "commonjs"`, the TypeScript compiler
**transforms `import()` into a `Promise.resolve().then(() => require(...))`** in the emitted `.js`.
At runtime this hits `ERR_REQUIRE_ESM` against the ESM-only compiler-cli -- the exact failure the
dynamic-import design was meant to avoid. Source looks correct; compiled output is broken.

**Why it happens:**
`module: commonjs` (the historical default for Nx/`@nx/js:tsc` libraries) downlevels dynamic
`import()`. Only `module: node16` / `node18` / `nodenext` emit leaves dynamic `import()`
**untransformed** so a CJS module can genuinely async-import an ES module. This is a known, durable
TypeScript behavior, not a bug.

**How to avoid:**

- Set `"module": "node16"` (or `nodenext`) + `"moduleResolution": "node16"`/`bundler` in the
  executor's build tsconfig. Keep package emit CJS by NOT setting `"type": "module"` in the
  package's `package.json` (file format is decided by nearest `package.json` `type`).
- Add an integration test that imports the **compiled `.js`** (not the `.ts`) and asserts the
  `import()` actually loads ESM compiler-cli -- i.e. test the build artifact, not source.
- Verify the emitted `.js` literally still contains `import(` (a build-output assertion or
  `git grep`-style check in CI).

**Warning signs:**
Unit tests (which mock compiler-cli) pass; the first run against the real compiler throws
`ERR_REQUIRE_ESM` or `require() of ES Module ... not supported`. Or it works under one Node/TS
combo and breaks under another.

**Phase to address:** Spike phase (engine/module-format spike) + build/packaging phase. This is the
single highest-risk addition because it can pass every unit test and only fail at real-compiler
integration or post-publish.

---

### Pitfall 2: Diagnostic file paths are emitted CWD-relative, but Nx runs executors from the workspace root -- breaking both filtering and cross-OS snapshots

**What goes wrong:**
`@angular/compiler-cli`'s `formatDiagnostics` reports file names **relative to `process.cwd()`**
(intentional, since PR #19748: "diagnostics file paths relative to cwd, not tsconfig"). But Nx
executors run with `process.cwd()` === the **workspace root**, never the project root. Two
consequences: (1) the project-boundary diagnostic filter ("exclude out-of-project + `node_modules`")
gets confused if it assumes paths are project-relative or absolute; (2) human-output snapshots embed
workspace-root-relative paths that differ by OS separator (`\` vs `/`) and by how deep the fixture
workspace lives, making golden-file tests flaky across the CI matrix.

**Why it happens:**
Two independent facts collide: compiler-cli formats relative to CWD; Nx never changes CWD to the
project root (confirmed: use `context.root` for workspace root, derive project root from
`context.projectsConfigurations.projects[context.projectName].root`; `process.cwd()` is unreliable
and even differs with/without the Nx daemon). Developers assume diagnostics are absolute or
project-relative.

**How to avoid:**

- Do boundary filtering on **absolute, realpath-normalized** `ts.SourceFile.fileName` values from
  the program (use `absoluteFromSourceFile` + the host's `getCanonicalFileName`/`realpath`), NOT on
  the formatted string. Compute "in project" against `context.root` + project root, not CWD.
- For output, decide an explicit, documented base (project root recommended) and rewrite paths to
  it deterministically; normalize separators to `/` before printing AND before snapshotting.
- In tests, normalize both expected and actual to forward slashes (`slash`-style) and to a stable
  base before asserting.

**Warning signs:**
Filter passes locally (project happens to sit at a path that makes CWD-relative look right) but lets
`node_modules`/sibling-project diagnostics through in a real workspace; snapshot tests pass on Linux
and fail on Windows with `\`-vs-`/` diffs.

**Phase to address:** Engine/filtering phase (correct the filter to use absolute paths) + output/
formatting phase + cross-OS CI phase.

---

### Pitfall 3: Project-boundary diagnostic filtering breaks under pnpm/symlinked `node_modules` and case-insensitive filesystems

**What goes wrong:**
The default "exclude out-of-project + `node_modules`" filter compares file paths. Under pnpm, deps
live behind symlinks (`node_modules/.pnpm/...` realpaths); under Windows/macOS the filesystem is
case-insensitive. If the filter does naive string comparison of `fileName` against a project-root
prefix, it will: (a) misclassify symlinked dep files (logical vs real path mismatch) -- either
leaking `node_modules` errors or suppressing real project errors that resolve through a symlink;
(b) mismatch on case (`C:\Proj` vs `c:\proj`) and wrongly include/exclude files.

**Why it happens:**
TypeScript's host already grapples with this via `getCanonicalFileName` (lowercases on
case-insensitive FS), `useCaseSensitiveFileNames`, and `realpath`. Re-implementing path membership
without these three is the classic mistake. pnpm's layout is the stress test; npm/yarn hide the
problem in dev so it only surfaces for pnpm consumers post-publish.

**How to avoid:**

- Derive in/out-of-project membership using the program host's `getCanonicalFileName` and
  `realpath` (resolve symlinks to physical paths before comparing), exactly as TS module resolution
  does. Do not hand-roll prefix checks on raw `fileName`.
- Add a pnpm fixture to the integration/e2e matrix (not only npm). Add a mixed-case path assertion
  on Windows/macOS runners.
- Be explicit about `preserveSymlinks` semantics in the program options and document the chosen
  behavior (it inverts vs bundlers).

**Warning signs:**
Works under npm, fails under pnpm consumer ("why is it reporting errors in `.pnpm`?" or "why does it
pass when there's clearly a template error in a symlinked local lib?"). Filter behaves differently
on Linux CI vs Windows dev.

**Phase to address:** Engine/filtering phase; pnpm + case-sensitivity fixtures in the validation/e2e phase.

---

### Pitfall 4: Stale Nx cache hides real type errors (false cache hit) for whole-program checks with non-buildable dependency changes

**What goes wrong:**
The target is cacheable (`cache: true`, `outputs: []`). A whole-program check's correctness depends
on **every transitive source file** of every non-buildable (source/inlined) dependency being in the
cache inputs. If the inputs miss a dep's files (or `namedInputs` exclusions are silently not honored
for source libs -- a tracked Nx behavior), Nx restores a green result from cache while a real error
was introduced in a dependency. A type-checker that lies (says PASS when the code is broken) is worse
than no type-checker -- it actively erodes trust and lets broken code through CI.

**Why it happens:**
Whole-program checks have a fan-out of inputs that simple per-project `inputs` globs don't capture.
Nx's defaults hash all external deps (over-invalidation, annoying but safe) but **project-source**
inputs for transitive non-buildable deps must be wired explicitly; `namedInputs` exclusions for
source/inlined libraries have known gaps. Also the lockfile/`externalDependencies` interplay can
both over- and under-invalidate.

**How to avoid:**

- Inputs MUST include: the tsconfig include/exclude globs, the full `extends` chain, sibling
  `package.json`, AND `^production` (or equivalent) from all transitive deps so a dep source change
  busts the cache. Use `dependentTasksOutputFiles`/project-dependency inputs, not just self globs.
- `externalDependencies: ['typescript', '@angular/compiler-cli']` is necessary but NOT sufficient --
  add the project-graph dep inputs.
- Test the cache contract directly: run check (green) -> introduce a type error in a non-buildable
  dep -> re-run -> assert it does NOT restore from cache and reports the error. This is a
  correctness test, not a perf test.
- Inspect with `nx show project <p> --web` to confirm the computed inputs.

**Warning signs:**
"It passed in CI but the app doesn't compile." Re-running with `--skip-nx-cache` surfaces errors the
cached run missed. Changing a `.ts` in a local lib doesn't change the check's hash.

**Phase to address:** Caching/inputs phase -- with an explicit "stale-cache cannot hide an error"
verification gate. This deserves a dedicated correctness test, flagged for deeper research.

---

### Pitfall 5: Packaging errors -- `schema.json` / `executors.json` (and the compiled executor) missing from the published tarball

**What goes wrong:**
Nx loads an executor by reading `executors.json` -> `implementation` + `schema`. If `package.json`
`files`/`exports` don't include `executors.json`, the per-executor `schema.json`, AND the compiled
`.js`, the package installs but the executor fails to resolve at the consumer ("cannot find
executor" / "schema not found"). The source tree tests fine; the **tarball** is what ships and is
what's broken.

**Why it happens:**

- `files` defaults or a `dist`-only allowlist that forgets non-`.js` assets (the JSON manifests).
- A `.gitignore` that ignores `dist/` with no `.npmignore` -> build output silently excluded.
- Auditing the source tree instead of `npm pack` output.
- `bin` (if ever added) pointing at a file excluded by `files`.

**How to avoid:**

- Run `npm pack` (or `nx release publish --dry-run`) and inspect the actual tarball contents:
  confirm `executors.json`, every executor `schema.json`, the compiled executor `.js`, `README`,
  and `LICENSE` are present.
- Run **`publint`** and **`@arethetypeswrong/cli` (`attw --pack`)** in CI against the tarball, not
  the source. For an ESM-consuming-from-CJS dual situation, `attw` catches resolution-mode gaps.
- Explicit `files` allowlist that names the JSON manifests, not just `**/*.js`.

**Warning signs:**
Local `nx run` works (resolves from workspace source); a fresh `npm i` in a clean workspace +
`nx run app:typecheck` fails to find the executor or its schema. Tarball size looks too small.

**Phase to address:** Packaging/publish phase, with a tarball-content assertion + `publint`/`attw` CI
gate. The full real-workspace-install e2e (late phase) is the backstop.

---

### Pitfall 6: `peerDependencies` range mistakes -- pre-release Angular/Nx and `@nx/dependency-checks` semantics

**What goes wrong:**
compiler-cli/typescript/nx are peers resolved from the consumer. Two failure modes: (1) ranges too
tight or too loose -- e.g. `@angular/compiler-cli: 22.x` won't satisfy a consumer on a **pre-release**
`22.1.0-next.3` because semver ranges exclude pre-releases unless the range itself is a pre-release
(`>=22.0.0-0`); the project's own constraints already reference `22.1.0-next.*`. (2) `@nx/dependency-checks`
auto-fixers copy the **workspace-root installed version** into the package's range, which is fine for
buildable libs but wrong for a **publishable** plugin that must declare a broad consumer-facing range.
Also: TS pinned `>=6.0.0 <6.1.0` must actually intersect what Angular 22 + Nx 23 allow, or consumers
get `ERESOLVE`.

**Why it happens:**
Pre-release semver semantics are non-obvious. The dependency-checks fixer optimizes for "matches what's
installed here," not "what consumers can have." npm 7+ enforces peers strictly (`ERESOLVE`).

**How to avoid:**

- Author peer ranges by hand for the publishable package; treat dependency-checks autofix output as a
  suggestion and review it (this caveat is explicitly documented).
- If supporting pre-release Angular/Nx, use pre-release-inclusive ranges (`>=22.0.0-0 <23.0.0`) or
  document that consumers on `-next`/`-rc` must use `--legacy-peer-deps`.
- Add an install-matrix e2e that actually `npm i`s the tarball against the lowest and highest
  supported Angular/Nx/TS, asserting no `ERESOLVE`/`EBADENGINE`.
- Keep `@nx/dependency-checks` enabled to catch missing/obsolete deps, but ignore version-mismatch
  autofix for the public range or pin `peerDepsVersionStrategy` deliberately.

**Warning signs:**
`EBADENGINE`/`ERESOLVE` on `npm i` in the install matrix; dependency-checks rewrites the public range
to an exact local version after `--fix`.

**Phase to address:** Packaging/peer-deps phase + install-matrix e2e phase.

---

### Pitfall 7: tsconfig `extends`/`paths` resolution edge cases -- spec/editor configs, solution-style references, and `noEmit` interactions

**What goes wrong:**
The executor takes a single `tsConfig`. Real Angular workspaces use: solution-style root
`tsconfig.json` with `references` (no files of its own), per-target `tsconfig.app.json` /
`tsconfig.spec.json` that `extends` a base, editor-only `tsconfig.editor.json`, and `paths` aliases
for local libs. Pitfalls: (a) pointing the target at a solution-style root that has `references` but
no `include`/`files` -> compiler sees zero files -> "0 errors" false pass; (b) the `extends` chain
must be fully resolved to compute correct inputs/options, or a base change isn't detected; (c) Angular's
ngtsc can resolve local libs to their **compiled `node_modules` artifacts** instead of `paths`-mapped
source -> spurious `TS2307` or stale types; (d) `noEmit`/`emitDeclarationOnly` interactions: some TS
features (import-path forms) are only legal under `--noEmit`, and the check must set `noEmit: true`
without inheriting an emit-oriented base that conflicts.

**Why it happens:**
Angular's multi-tsconfig conventions are subtle; `tsconfig.app.json` "is not `tsconfig.json`" and some
tooling only honors true `tsconfig.json`. `paths` vs compiled-artifact resolution is a recurring,
documented ngtsc issue.

**How to avoid:**

- Detect and reject (or warn loudly on) a target pointed at a `references`-only solution-style config
  with no resolvable input files -- "0 files checked" should never be a silent success.
- Resolve and hash the entire `extends` chain for inputs; load options the way ngtsc does
  (`readConfiguration` from compiler-cli) rather than parsing tsconfig by hand.
- Force `noEmit: true` in the effective options regardless of the inherited base.
- Test all five tsconfig flavors as fixtures: app, local non-buildable lib, buildable lib,
  publishable lib, and `tsconfig.spec.json` -- with `paths` aliases to a local lib that has a real
  template error, asserting it's caught via source (not stale compiled types).

**Warning signs:**
A check reports 0 diagnostics for a project you know has errors (wrong/empty file set);
`TS2307: Cannot find module '@myorg/lib'` only under the checker but not in the editor; spec configs
silently unchecked.

**Phase to address:** Engine/tsconfig-resolution phase + the five-project-type validation phase.

---

### Pitfall 8: `strictTemplates` / extended-diagnostics detection -- silently checking nothing or mismatching the consumer's configured severities

**What goes wrong:**
Extended diagnostics (NG8xxx) **only emit when `strictTemplates: true`**. If a consumer project
hasn't enabled `strictTemplates`, the "complete" check silently produces zero template/extended
diagnostics -- giving a false sense of completeness. Conversely, if the tool **forces** strict
settings that the consumer didn't choose, it reports errors the consumer's actual build never would,
producing false positives. And `extendedDiagnostics.defaultCategory`/`checks` severities (warning/
error/suppress) plus prerequisites like `strictNullChecks` for `nullishCoalescingNotNullable` must be
read from the consumer's resolved config, not assumed.

**Why it happens:**
The coupling (strictTemplates gates extended diagnostics) and the per-check severity model are easy to
overlook. The product promise is "the complete Angular type-check," which tempts forcing strictness --
but the project's own design says "project-configured diagnostic categories respected."

**How to avoid:**

- Read the consumer's resolved `angularCompilerOptions` (via compiler-cli's `readConfiguration`) and
  honor `strictTemplates`, `extendedDiagnostics.defaultCategory`, per-check `checks`, and the
  `strictNullChecks` prerequisite -- do not override.
- Surface a clear (opt-in) notice when `strictTemplates` is off so users understand template checks
  are not running, without silently changing their config.
- The `--max-warnings` feature must map warning-category diagnostics correctly (default category is
  `warning`, not error) -- count the right bucket.
- Fixtures must cover: strictTemplates on/off, a project with `defaultCategory: error`, and a project
  that suppresses a specific check -- asserting the tool mirrors each.

**Warning signs:**
"Why does angular-typechecker report fewer/more errors than `ng build`?" Zero NG8xxx output on a
project that clearly has template issues. `--max-warnings 0` doesn't fail on a project full of NG8xxx
warnings.

**Phase to address:** Engine/config-detection phase; severity-fidelity fixtures in validation phase.

---

## Technical Debt Patterns

| Shortcut                                                                       | Immediate Benefit                 | Long-term Cost                                                              | When Acceptable                                      |
| ------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| String-prefix path filtering instead of host `getCanonicalFileName`+`realpath` | Quick to write; passes npm/Linux  | Breaks on pnpm + case-insensitive FS post-publish; correctness bug          | Never (correctness-critical tool)                    |
| Self-only `inputs` globs on the cacheable target                               | Simpler config; faster cold cache | Stale-cache false PASS on dep changes -- erodes all trust                   | Never -- the cache must never hide an error          |
| Hand-parsing tsconfig instead of compiler-cli `readConfiguration`              | Avoids an import                  | Misses `extends` chain, solution-style references, ng options               | Only in throwaway spikes                             |
| Forcing `strictTemplates: true` to "be complete"                               | More diagnostics, looks thorough  | False positives vs consumer's real build; violates "respect project config" | Only behind an explicit opt-in flag, clearly labeled |
| Auditing source tree, not `npm pack` tarball                                   | Faster CI                         | Missing `schema.json`/`executors.json`/compiled `.js` ships broken          | Never before a publish gate                          |
| Snapshotting raw `formatDiagnostics` output                                    | Easy golden files                 | CWD-relative + `\`/`/` differences -> cross-OS flake                        | Only after path/separator normalization              |
| `module: commonjs` for the executor build                                      | Matches old Nx default            | TS rewrites `import()`->`require()`; ESM load fails at runtime              | Never (use node16/nodenext)                          |

## Integration Gotchas

| Integration                          | Common Mistake                                        | Correct Approach                                                                                 |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Nx executor loader                   | Assuming executor runs from project root              | Use `context.root` + project config; never trust `process.cwd()` (differs with/without daemon)   |
| `@angular/compiler-cli` ESM from CJS | Compile with `module: commonjs` (rewrites `import()`) | `module: node16`/`nodenext`; keep CJS via no `type:module`; test compiled `.js`                  |
| pnpm consumer                        | Test only against npm                                 | pnpm symlink fixture; resolve realpaths before path membership                                   |
| `@nx/dependency-checks`              | Trust `--fix` to set the public peer range            | Hand-author publishable peer ranges; review autofix                                              |
| nx release first publish             | Run without `--first-release`                         | First publish needs `--first-release` (no tags/changelog yet); always `--dry-run` first          |
| npm provenance                       | Expect a CLI flag                                     | Set `NPM_CONFIG_PROVENANCE=true` env + `id-token: write` permission in the publish job           |
| Scoped/access                        | Forget `--access public` / publishConfig              | Set `publishConfig.access: public` (n/a if unscoped `angular-typechecker`, but verify)           |
| Executor schema positional args      | Map two options to `$default` argv index 0 and 1      | Only index 0 is reliable; pass the rest as named flags (`tsConfig` is required -- prefer a flag) |

## Performance Traps

| Trap                                                        | Symptoms                                     | Prevention                                                                               | When It Breaks                           |
| ----------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| Whole-program rebuild every run, no incremental             | Slow on large apps; agent loop sluggish      | v0.0.1 accepts this (incremental deferred); rely on Nx cache for unchanged targets       | Large monolith apps / monorepo-wide runs |
| Over-broad cache inputs (hash all external deps + lockfile) | Cache busts on any unrelated dep bump        | Scope `externalDependencies` to TS + compiler-cli where safe, but keep correctness first | Frequent dep churn workspaces            |
| Cold-start ESM dynamic import per invocation                | Per-run import overhead                      | Acceptable for v0.0.1; note for future watch-mode                                        | Many tiny per-project runs               |
| Running compiler-cli on solution-style root                 | Either 0 files (wrong) or whole-graph (slow) | Require a leaf tsconfig per target                                                       | Misconfigured target                     |

## Security Mistakes

| Mistake                                                | Risk                                                                     | Prevention                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Publishing without npm provenance                      | Consumers can't verify build origin; supply-chain trust gap              | `NPM_CONFIG_PROVENANCE=true` + `id-token: write` in CI publish step                     |
| Over-broad npm token in CI                             | Token leak compromises the package                                       | Granular token scoped to this package only; OIDC/provenance flow over long-lived tokens |
| Shipping source/internal files in tarball              | Leaks internals; larger attack surface                                   | Explicit `files` allowlist; inspect `npm pack`                                          |
| Executing arbitrary consumer config without bounds     | Reads consumer tsconfig/paths -- low risk but errors leak absolute paths | Normalize/relativize paths in output; don't log full env                                |
| `bin` (future CLI) trusting `process.cwd()` for config | Path confusion / reading unexpected files                                | Resolve config relative to explicit args, not CWD                                       |

## "Looks Done But Isn't" Checklist

- [ ] **ESM load:** Source uses `await import()` -- verify the **compiled `.js`** still contains `import(` and actually loads ESM compiler-cli at runtime (not rewritten to `require()`).
- [ ] **Tarball:** `npm pack` includes `executors.json`, every `schema.json`, the compiled executor `.js`, `README`, `LICENSE` -- not just `**/*.js`.
- [ ] **Cache correctness:** Introducing an error in a non-buildable dep busts the cache (no false PASS). Tested explicitly.
- [ ] **pnpm:** Boundary filter verified against a symlinked pnpm fixture, not only npm.
- [ ] **Cross-OS paths:** Snapshots normalized to `/` and a stable base; pass on Windows + macOS + Linux runners.
- [ ] **strictTemplates off:** Tool clearly signals (not silently produces 0 template diagnostics).
- [ ] **Solution-style tsconfig:** Target pointed at a `references`-only root does NOT silently report "0 errors / success."
- [ ] **Spec config:** `tsconfig.spec.json` target actually type-checks spec files (not an empty file set).
- [ ] **Peer ranges:** `npm i` of the tarball succeeds (no `ERESOLVE`/`EBADENGINE`) across lowest+highest supported Angular/Nx/TS, including pre-release if claimed.
- [ ] **First publish:** Dry-run + `--first-release` path validated before the real publish.
- [ ] **Provenance:** Published package page shows the provenance checkmark.
- [ ] **`--max-warnings`:** Counts the `warning`-category bucket correctly (default category is warning).

## Recovery Strategies

| Pitfall                              | Recovery Cost | Recovery Steps                                                                                     |
| ------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| `import()` rewritten to `require()`  | LOW (config)  | Switch build tsconfig to `node16`/`nodenext`; re-emit; re-test compiled output; republish patch    |
| Missing files in tarball             | LOW (config)  | Fix `files`/`exports`; `npm pack` verify; publish patch (cannot unpublish cleanly after 72h)       |
| Stale-cache false PASS shipped       | MEDIUM        | Fix inputs; bump version; advise consumers to clear cache; add correctness test to prevent regress |
| pnpm/symlink filter bug              | MEDIUM        | Rework filter to realpath+canonical; add pnpm fixture; patch release                               |
| Bad peer range published             | LOW-MEDIUM    | Publish patch widening range; consumers on broken range need reinstall                             |
| Provenance/token misconfig           | LOW           | Fix CI env/permissions; next release carries provenance                                            |
| Solution-style "0 errors" false pass | MEDIUM        | Add file-set guard; re-validate all five project types; patch                                      |

## Pitfall-to-Phase Mapping

| Pitfall                                  | Prevention Phase                               | Verification                                                                  |
| ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. `import()`->`require()` rewrite       | Spike + Build/Packaging                        | Integration test loads compiled `.js`; CI asserts emitted `import(` present   |
| 2. CWD-relative paths + filter/snapshot  | Engine/Filtering + Output + Cross-OS CI        | Filter uses absolute paths; snapshots normalized; matrix green                |
| 3. pnpm/symlink/case filtering           | Engine/Filtering + Validation/e2e              | pnpm + mixed-case fixtures assert correct membership                          |
| 4. Stale-cache false PASS                | Caching/Inputs (dedicated correctness gate)    | Dep-error-busts-cache test; `nx show project` input audit                     |
| 5. Tarball missing manifests             | Packaging/Publish                              | `npm pack` content assertion + `publint` + `attw --pack` in CI                |
| 6. Peer-range / pre-release              | Packaging + Install-matrix e2e                 | `npm i` matrix asserts no ERESOLVE/EBADENGINE                                 |
| 7. tsconfig extends/paths/solution-style | Engine/tsconfig-resolution + 5-type validation | All five tsconfig flavors as fixtures; "0 files" guard                        |
| 8. strictTemplates/severity detection    | Engine/config-detection + Validation           | Fixtures: strict on/off, defaultCategory error, suppress -- tool mirrors each |

## Sources

- [Dependency Checks ESLint Rule | Nx](https://nx.dev/docs/technologies/eslint/eslint-plugin/guides/dependency-checks) -- HIGH
- [Manage Nx library dependencies with the @nx/dependency-checks ESLint rule (Lars Brink Nielsen / DEV)](https://dev.to/this-is-learning/manage-nx-library-dependencies-with-the-nxdependency-checks-eslint-rule-2lem) -- MEDIUM
- [@nx/dependency-check version mismatch pre-release handling (nrwl/nx#30589)](https://github.com/nrwl/nx/issues/30589) -- MEDIUM
- [Executors and Configurations | Nx](https://nx.dev/docs/concepts/executors-and-configurations) -- HIGH
- [Write a Simple Executor | Nx](https://nx.dev/docs/extending-nx/local-executors) -- HIGH
- [ExecutorContext | Nx](https://nx.dev/docs/reference/devkit/ExecutorContext) -- HIGH
- [nx Executors reference | Nx](https://nx.dev/docs/reference/nx/executors) -- HIGH
- [@nx/js:tsc schema.json (x-completion-type/glob, x-priority)](https://github.com/nrwl/nx/blob/master/packages/js/src/executors/tsc/schema.json) -- HIGH
- [Jest executor schema.json ($default argv, x-deprecated)](https://github.com/nrwl/nx/blob/master/packages/jest/src/executors/jest/schema.json) -- HIGH
- [NX Schema does not support positional arguments (nrwl/nx#11559)](https://github.com/nrwl/nx/issues/11559) -- MEDIUM
- [process.cwd() differs with/without daemon (nrwl/nx#9147)](https://github.com/nrwl/nx/issues/9147) -- MEDIUM
- [run-commands cwd / projectRoot interpolation (nrwl/nx#18158, #26928)](https://github.com/nrwl/nx/issues/18158) -- MEDIUM
- [Inputs and Named Inputs | Nx](https://nx.dev/docs/reference/inputs) -- HIGH
- [externalDependencies not working as expected (nrwl/nx#22277)](https://github.com/nrwl/nx/issues/22277) -- MEDIUM
- [NX build pulling from cache when libs changed (nrwl/nx#22265)](https://github.com/nrwl/nx/issues/22265) -- MEDIUM
- [namedInputs not respected for source/inlined libs (nrwl/nx#32182)](https://github.com/nrwl/nx/issues/32182) -- MEDIUM
- [Cache not cleared when external package changed (nrwl/nx#15964)](https://github.com/nrwl/nx/issues/15964) -- MEDIUM
- [Release TypeScript/JavaScript Packages to NPM | Nx](https://nx.dev/docs/guides/nx-release/release-npm-packages) -- HIGH
- [Publish in CI/CD | Nx (provenance, id-token)](https://nx.dev/docs/guides/nx-release/publish-in-ci-cd) -- HIGH
- [nx release --first-release breaks without version field (nrwl/nx#27887)](https://github.com/nrwl/nx/issues/27887) -- MEDIUM
- [Lib package.json prevents root .npmrc resolution (nrwl/nx#21798)](https://github.com/nrwl/nx/issues/21798) -- MEDIUM
- [package.json | npm Docs (files, bin, exports)](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) -- HIGH
- [Guide to the package.json exports field (Hiroki Osame)](https://hirok.io/posts/package-json-exports) -- MEDIUM
- [The package.json exports Map ... (DEV) -- publint/attw, types-first](https://dev.to/gabrielanhaia/the-packagejson-exports-map-is-the-most-important-file-youre-writing-wrong-5a0o) -- MEDIUM
- [files field doesn't work / .npmignore vs .gitignore (npm/cli#4928)](https://github.com/npm/cli/issues/4928) -- MEDIUM
- [Angular compiler options (strictTemplates, extendedDiagnostics) | angular.dev](https://angular.dev/reference/configs/angular-compiler-options) -- HIGH
- [Extended Diagnostics overview | angular.dev](https://angular.dev/extended-diagnostics) -- HIGH
- [enable extended diagnostics by default (angular/angular#44712)](https://github.com/angular/angular/pull/44712) -- HIGH
- [diagnostics file paths relative to cwd, not tsconfig (angular/angular#19748)](https://github.com/angular/angular/pull/19748) -- HIGH
- [@angular/compiler-cli API (absoluteFromSourceFile, relative, readConfiguration) | jsdocs.io](https://www.jsdocs.io/package/@angular/compiler-cli) -- MEDIUM
- [ngtsc ignores tsconfig paths, resolves compiled artifacts (angular/angular-cli#28388)](https://github.com/angular/angular-cli/issues/28388) -- MEDIUM
- [TSConfig module/moduleResolution node16 (import() untransformed) | TS docs](https://www.typescriptlang.org/docs/handbook/modules/reference.html) -- HIGH
- [Dynamic import() with module:commonjs (TypeStrong/ts-node#1290)](https://github.com/TypeStrong/ts-node/discussions/1290) -- MEDIUM
- [Difficult to call import() from CommonJS (microsoft/TypeScript#52775)](https://github.com/microsoft/TypeScript/issues/52775) -- HIGH
- [getCanonicalFileName/realpath case-sensitivity (microsoft/TypeScript#44966)](https://github.com/microsoft/TypeScript/pull/44966) -- HIGH
- [Symlink cache + .pnpm last-resort realpath (microsoft/TypeScript#44259)](https://github.com/microsoft/TypeScript/pull/44259) -- HIGH
- [Symlinked node_modules structure | pnpm](https://pnpm.io/symlinked-node-modules-structure) -- HIGH
- [TSConfig preserveSymlinks | typescriptlang.org](https://www.typescriptlang.org/tsconfig/preserveSymlinks.html) -- HIGH
- [Building and testing Node.js (matrix) | GitHub Docs](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs) -- HIGH
- [actions/setup-node (caching, ordering)](https://github.com/actions/setup-node) -- HIGH
- [node-glob normalizes to forward slashes on Windows (isaacs/node-glob#419)](https://github.com/isaacs/node-glob/issues/419) -- MEDIUM
- [Path | Node.js docs (separators, normalize)](https://nodejs.org/api/path.html) -- HIGH
- [npm engines / engine-strict / EBADENGINE (RepoFlow)](https://www.repoflow.io/errors/npm/npm-err-code-ebadengine) -- MEDIUM

---

_Pitfalls research for: Nx plugin executor wrapping @angular/compiler-cli, published to npm_
_Researched: 2026-06-27_
