---
status: complete
---

# 260704-mse-A1 - Adopt @nx/js first-party Verdaccio local-registry (execution summary)

**Executed:** 2026-07-04
**Branch:** `release/0.1.1` (PR #23), MAIN working tree (no worktree)
**Base commit:** `07c91cf`
**Result:** All 7 tasks complete + 1 coordinator-added requirement. Full suite green.
Nothing pushed/tagged/published/merged (orchestrator owns those). The plan doc
(`260704-mse-A1-RESEARCH.md`) and this SUMMARY are left UNCOMMITTED for the
orchestrator's docs commit.

---

## Commits (in order)

| # | Task | Commit | Subject |
|---|------|--------|---------|
| 1 | 1a (M8/M9 helpers) | `59c022c` | test(e2e): add shared e2e process helpers to test-util |
| 2 | 1b (migrate specs) | `85e93a5` | test(e2e): consume shared test-util helpers in e2e specs |
| 3 | 2 (verdaccio scaffold) | `e18fc00` | chore(e2e): scaffold @nx/js verdaccio local-registry |
| 4 | 3 (globalSetup + rewrite) | `fbbe860` | test(e2e): publish once via @nx/js verdaccio globalSetup |
| 5 | 4 (E1 + R1 + M9) | `610487f` | test(e2e): share the globalSetup build; apply R1 + M9 |
| 6 | 5 (A3 delete) | `5c92ca2` | test(e2e): delete tautological dist-version-parity test (A3) |
| 7 | 6 (M14 dependsOn) | `e1bd0df` | test(release): make nx-release-publish depend on build (M14) |
| 8 | NEW REQ (barrel smoke) | `29777b8` | test(e2e): assert the installed barrel loads its programmatic API |
| 9 | (task-3 defect fix) | `1896291` | test(e2e): derive verdaccio local-registry target from root package name |
| 10 | 7 (shipped source) | `0c16285` | refactor(core): dedup loadTypescript into a private leaf; fix exit-codes note |

Task 1 was split 1a/1b as the plan suggested. Commit `1896291` is a task-3 defect
fix surfaced during task-7's `nx test` gate (see Deviations).

---

## What each task did

**Task 1 - shared test-util helpers (M8/M9).**
`libs/test-util/src/lib/e2e-process.ts` now exports `NX_RUNNER_ENV_KEYS`,
`buildCleanEnv({ stripAllNpmConfig })`, `RunResult`, `run(cwd, target, { env, skipNxCache })`,
`sh(cmd, { cwd, env })`, `removeTmpDir` (re-exported from the barrel). `buildCleanEnv`
default strips only legacy-peer-deps; `stripAllNpmConfig: true` strips every
`npm_config_*` (load-bearing for the verdaccio consumer + globalSetup). Migrated all
duplicating specs off their per-file copies: cache-e2e x3, install-e2e x4
(install-smoke, tarball-audit, nx-add-e2e, generator-e2e), matrix-e2e x2
(matrix-5types, pnpm-symlink). `run()` defaults `options.env` to a default-strip
`buildCleanEnv()` so a forgotten env still keeps nested-nx isolation.

**Task 2 - @nx/js verdaccio scaffold.** `nx g @nx/js:setup-verdaccio` created
`.verdaccio/config.yml`, a ROOT `project.json` (project `@angular-typechecker/source`,
`local-registry` target) and a `package.json` `nx.includedScripts: []` marker.
`nx.json` has no `plugins` key, so the root project attracts NO inferred targets - it
is inert and stays out of `release.projects`. Customized `config.yml` with the three
deltas: `angular-typechecker` no-proxy block above `'**'`, `auth.htpasswd`,
`log.level: http`. `verdaccio` devDep already `6.7.4` (satisfies `^6.3.2`) - unchanged.

**Task 3 - globalSetup + verdaccio-publish rewrite.**
`e2e/angular-typechecker-install-e2e/src/global-setup.ts`: `startLocalRegistry` (forks
nx, log-scrape readiness) + single `nx build` + real token mint via global `fetch`
(S2) + provenance-strip + `nx release publish --registry <local> --first-release` +
`provide(verdaccioUrl/verdaccioToken)`; keeps the never-publish-to-npmjs SAFETY gate.
Wired `globalSetup` + a `ProvidedContext` augmentation into `vitest.config.mts`.
Rewrote `verdaccio-publish.int.spec.ts` to `inject` URL+token, install-by-name ->
init -> configuration -> typecheck green, assert compiled `.js` + a `.d.ts` (M13) +
zero `.ts`/`.spec` via `readdirSync(recursive)` + `entry.parentPath` (R1).

**Task 4 - share the globalSetup build (E1) + R1 + M9.** Dropped the redundant
per-spec `nx build` from tarball-audit/install-smoke/nx-add-e2e/generator-e2e (they
pack the dist globalSetup built; kept their own `npm pack`). Applied R1 to
tarball-audit's `collectDtsText` (drops the now-unused `statSync` import). Wrapped the
bare `npm install` / `nx g :init` / `nx g :configuration` calls with `sh` (M9) in
install-smoke, nx-add-e2e, generator-e2e, and matrix-5types (pnpm-symlink already has
a richer bespoke stdout/stderr diagnostic, so it was left as-is).

**Task 5 - A3.** Deleted tarball-audit's tautological REL-04 version-parity `describe`
(dist===source is true by construction of `@nx/js:tsc`; the real invariant is guarded
by release-hygiene REL-04 and subsumed by the publish->install round-trip). 7 -> 6 tests.

**Task 6 - M14.** Added `dependsOn: ["build"]` to `nx-release-publish` in
`packages/angular-typechecker/project.json`; guarded by a new release-hygiene
assertion (18 -> 19 tests). The globalSetup publish now passes
`--excludeTaskDependencies` (see Deviations - the dependsOn build would otherwise
cache-restore dist and clobber the provenance strip).

**NEW REQ - programmatic-API barrel-load smoke.** In verdaccio-publish, after
install-by-name, `require()` the INSTALLED package and assert `runTypecheck`
(function) + `TypecheckInfrastructureError` (constructible). Angular-INDEPENDENT:
requiring the barrel does not load `@angular/compiler-cli` or `typescript` (both
lazy-imported inside `runTypecheck`); it never calls `runTypecheck`. Directly catches
the dangling-`main`/missing-`index.js` defect (MODULE_NOT_FOUND on require).

**Task 7 - shipped source.**
7a: fixed the `exit-codes.ts` header - the Nx executor consumes `evaluateResult`
(verified `executor.ts:4,104`), NOT `toExitCode`; `toExitCode` has no live consumer
(deferred-CLI scaffold). Kept `toExitCode`.
7b: extracted the byte-identical `loadTypescript` memo into module-private
`packages/angular-typechecker/src/core/load-typescript.ts` (one shared memo), imported
by `run-typecheck.ts` + `render-report.ts`. NEVER barrel-exported (D-02 anti-leak -
confirmed absent from `src/index.ts`). Removed the now-unused `import type ts` from
`render-report.ts`. `TemplateCheckAborted.code` untouched.

---

## Verification (exact commands + results)

All run from the workspace root; e2e projects run individually (never together) so
they never race on the shared dist tarball.

| Command | Result |
|---------|--------|
| `npx nx test test-util --skip-nx-cache` | 4/4 pass |
| `npx nx run angular-typechecker-cache-e2e:test --skip-nx-cache` | 3 files, 9 tests pass |
| `npx nx run angular-typechecker-matrix-e2e:test --skip-nx-cache` | 2 files, 7 tests pass |
| `npx nx run angular-typechecker-install-e2e:test --skip-nx-cache` | 6 files, 29 tests pass |
| `npx nx build angular-typechecker --skip-nx-cache` | build OK (type-checks shipped source) |
| `npx nx test angular-typechecker --skip-nx-cache` | 35 files, 252 tests pass |
| `npx nx lint angular-typechecker --skip-nx-cache` | pass (maxWarnings 0) |
| `npx nx release publish --dry-run --first-release` | runs `angular-typechecker:build` before `nx-release-publish` (M14 dependsOn honored), no error, scoped to `angular-typechecker` only |
| `npx nx format:check` (whole repo) | clean |
| `npx nx run-many -t lint --skip-nx-cache` | 3 projects pass (maxWarnings 0) |

install-e2e test-count evolution: 29 throughout (tarball-audit 7->6 via A3;
release-hygiene 18->19 via the M14 guard; verdaccio-publish 1 test now also carries
the barrel-load smoke). Final tarball-audit gate for task 7 (publint --strict, attw
--pack --profile node16 problems-empty, @fixtures-leak) all green on the new dist that
includes `core/load-typescript.js`/`.d.ts`.

---

## Windows caveat (benign; CI is Linux-only)

`startLocalRegistry` forks `nx` which forks `verdaccio` (double fork). On teardown the
returned `stop()` calls `childProcess.kill()` on the nx fork; on Windows a `.kill()`
maps to an abrupt `TerminateProcess`, so nx's SIGTERM handler (which kills verdaccio)
may not run and verdaccio CAN be orphaned. This is benign (leaks a process + port;
`detect-port` picks a new port next run) and CANNOT happen in CI (e2e is Linux-only,
where `.kill()` delivers a real SIGTERM and the cascade completes).

Observed across all ~6 install-e2e runs on this Windows arm64 box: teardown printed
`local registry exit 143` (SIGTERM), the vitest suite reported success, and NO orphan
warning surfaced. No irreducible teardown orphan occurred; no red test was committed.
`.htpasswd` idempotency is handled by `clearStorage: true` (the executor wipes the
storage dir - including the in-storage htpasswd - before each run), giving a
deterministic fresh ci-user sign-up.

---

## Deviations from the plan (all tracked)

1. **verdaccio-publish NOT migrated in task 1b** (Ponytail / anti-churn). The plan
   listed it among the 9 files for 1b, but task 3 rewrites it wholesale, so migrating
   its helpers in 1b then deleting them in 3 is pure churn. Left it on its own copies
   through 1b (suite stayed green), and the task-3 rewrite consumes the shared helpers
   from the start. Net: 9 files migrated in 1b + verdaccio-publish handled in 3.

2. **`--excludeTaskDependencies` on the globalSetup publish** (Rule 3 - blocking issue
   from M14). After task 6 added `dependsOn: ["build"]`, the globalSetup's
   `nx release publish` re-ran build as a CACHE HIT, which RE-MATERIALIZED dist from
   cache and CLOBBERED the provenance strip (re-introducing
   `publishConfig.provenance: true`, which aborts a non-CI publish). Fix: the harness
   builds + strips explicitly, then publishes with `--excludeTaskDependencies` so the
   dependent build does not re-run. M14's dependsOn remains correct for the real CI
   release (an explicit build runs first there; the dependency is a belt/cache-hit).

3. **globalSetup target derived from root package name** (Rule 3 - blocking issue from
   task 3, surfaced by task-7's `nx test`). The `scoped-name-guard` spec deliberately
   flags the scoped executor-id form `<scope>/source:<target>`; the hardcoded
   `'@angular-typechecker/source:local-registry'` target tripped it. Fixed per the
   guard's sanctioned pattern: read the root `package.json` name and append
   `:local-registry` at runtime (no banned contiguous literal; rename-robust). Commit
   `1896291`. (This was a latent defect in task 3 - `nx test angular-typechecker` was
   not run until the task-7 gate.)

4. **matrix-5types `npm install` wrapped with `sh` (M9)** - the reconciliation table's
   M9 applies to "the remaining bare `execSync('npm install ...')`" calls, and
   matrix-5types had one. pnpm-symlink was intentionally left alone: its bespoke
   try/catch already surfaces status/signal/stdout/stderr (richer than `sh`).

5. **NEW REQUIREMENT folded in** (coordinator mid-task message): the programmatic-API
   barrel-load smoke, its own commit `29777b8` in the task-3/4 neighborhood.

No `RULE 4` architectural escalations were needed. No auth gates.

---

## Notes

- The coordinator flagged a half-migrated appearance in the IDE LSP feed (import
  conflicts, `run()` arity, `removeTmpWorkspace`, `statSync`, unused imports). This was
  a STALE LSP snapshot: a real `git grep` found zero leftover local helper
  declarations and zero old call shapes, and the three e2e projects run green
  (authoritative per the repo's "LSP is not authoritative" rule). No action needed
  beyond confirming.
- No stubs introduced. No new threat surface (the Verdaccio registry is local-only,
  gated by the never-publish-to-npmjs SAFETY assertion; `tmp/` is gitignored).
