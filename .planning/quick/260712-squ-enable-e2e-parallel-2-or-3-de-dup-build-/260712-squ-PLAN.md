---
phase: quick-260712-squ
plan: squ
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [SQU-01]
files_modified:
  - nx.json
  - project.json
  - e2e/angular-typechecker-install-e2e/src/global-setup.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
  - e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts
  - e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts
  - e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.e2e.spec.ts
  - e2e/angular-typechecker-cache-e2e/project.json
  - .github/workflows/ci.yml
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts

must_haves:
  truths:
    - "`NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache` runs GREEN across all four e2e projects with NO ENOENT / EADDRINUSE / EPUBLISHCONFLICT / 'already invoked by a parent Nx process in this chain', on three consecutive runs (non-flaky)."
    - "dist/packages/angular-typechecker is built exactly ONCE upstream (via `e2e dependsOn angular-typechecker:build`) and is read-only during e2e: NO `nx build` runs inside any spec or global-setup."
    - "The two registry-starting projects run on DISTINCT Verdaccio ports (install-e2e 4873, ng-cli-e2e 4874) with DISTINCT storage dirs, both still 127.0.0.1-loopback and both still gated by the 'refusing to publish to non-local registry' SAFETY check."
    - "Every `npm pack --json` writes to a per-spec OS-temp `--pack-destination`, never the shared dist dir; no two e2e projects share a tarball path."
    - "cache-e2e's `e2e` target carries `parallelism: false`, so the cache-correctness gate never co-runs with a nested-nx sibling."
    - "GUARD-01b is REWRITTEN (not deleted) to fail loudly on regression of each NEW invariant (--parallel=2 present + --parallel=1 absent; every packing spec uses --pack-destination; the two global-setups use distinct registry targets AND storage; cache-e2e parallelism:false; NO non-comment `nx build angular-typechecker` line in any e2e spec/global-setup -- the de-dup / dist-read-only invariant); GUARD-01/01c/01d stay green; `nx test angular-typechecker` + `nx lint angular-typechecker` pass at maxWarnings:0."
    - "Additive/release-safe: test-harness + config only; NO production/source change; NO package.json version mutation; the 260712-n7z `delete process.env.NX_INVOCATION_ROOT_PID` lines are preserved in both global-setups."
  artifacts:
    - path: "nx.json"
      provides: "an `e2e` targetDefault whose dependsOn builds the plugin once upstream"
      contains: "angular-typechecker:build"
    - path: "project.json"
      provides: "a second root Verdaccio target `local-registry-ngcli` on port 4874 with its own storage dir"
      contains: "local-registry-ngcli"
    - path: "e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts"
      provides: "startLocalRegistry pointed at the ngcli target on a distinct storage dir; no nx build; SAFETY gate + n7z NX_INVOCATION_ROOT_PID delete preserved"
      contains: "local-registry-ngcli"
    - path: "e2e/angular-typechecker-cache-e2e/project.json"
      provides: "parallelism:false on the e2e target"
      contains: "\"parallelism\": false"
    - path: ".github/workflows/ci.yml"
      provides: "the e2e job runs run-many -t e2e --parallel=2 with a rewritten rationale comment"
      contains: "--parallel=2"
    - path: "packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts"
      provides: "GUARD-01b rewritten to assert the new isolation invariants (incl. the no-in-spec-build de-dup guard)"
      contains: "--pack-destination"
  key_links:
    - from: "e2e/*/project.json `e2e` target"
      to: "angular-typechecker:build"
      via: "nx.json targetDefaults e2e.dependsOn (build once, read-only dist)"
      pattern: "angular-typechecker:build"
    - from: "e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts"
      to: "root project.json `local-registry-ngcli` target (port 4874)"
      via: "startLocalRegistry localRegistryTarget = `${rootProjectName}:local-registry-ngcli`"
      pattern: "local-registry-ngcli"
    - from: "packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts (GUARD-01b)"
      to: ".github/workflows/ci.yml + the 6 pack specs + both global-setups + cache-e2e project.json"
      via: "read-only text/JSON assertions on --parallel=2, --pack-destination, distinct registry target+storage, parallelism:false, no in-spec nx build"
      pattern: "--parallel=2"
---

<objective>
Cut the e2e CI wall-clock (~40 min -> ~23 min) by isolating the four shared resources that
force `nx run-many -t e2e --parallel=1` and raising the run to `--parallel=2`, following
RESEARCH Option 1 (per-project isolation) verbatim. Update GUARD-01b in lockstep so every new
invariant is loud-on-regression.

Purpose: The e2e tier is its own CI job (concurrent with test/fallow/format-lint) and, at
~40 min, is the CI long pole -- so shortening it shortens PR feedback for the v0.2.1 release.
The lever is overlapping the internally-serial install-e2e (~20 min floor) with ng-cli-e2e,
matrix-e2e, and cache-e2e, which is only safe once the shared dist build, the shared tarball
path, the fixed Verdaccio port, and the shared registry storage are all isolated.

Output: test-harness + config edits only (nx.json, project.json, both e2e global-setups, the
6 pack specs, cache-e2e project.json, ci.yml, and the coverage-guard spec). NO production/source
change, NO package.json version mutation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260712-squ-enable-e2e-parallel-2-or-3-de-dup-build-/260712-squ-RESEARCH.md
@AGENTS.md
@nx.json
@project.json
@e2e/angular-typechecker-install-e2e/src/global-setup.ts
@e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
@e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts
@e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts
@e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts
@e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts
@e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts
@e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.e2e.spec.ts
@e2e/angular-typechecker-cache-e2e/project.json
@.github/workflows/ci.yml
@packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
@libs/test-util/src/lib/e2e-process.ts

The four e2e projects and their shared-resource footprint (RESEARCH table):
- install-e2e: starts Verdaccio (port 4873, storage `./tmp/local-registry/storage`), builds dist
  in global-setup, publishes once, and PACKS the shared dist tarball in 4 specs.
- ng-cli-e2e: starts Verdaccio (SAME 4873 + SAME storage today), builds dist in global-setup,
  publishes once, installs BY-NAME via `ng add` (does NOT pack).
- matrix-e2e: no registry; builds dist in each of 2 spec beforeAlls; PACKS the shared dist
  tarball in those 2 specs.
- cache-e2e: no registry, no pack, no build (uses the source barrel via nxViteTsPaths); asserts
  Nx CACHE hit/miss against the real workspace `.nx` db -- the correctness gate that must not
  co-run with a nested-nx sibling.

The four `nx build angular-typechecker` sites to DELETE (T1): install global-setup:144,
ng-cli global-setup:149, matrix matrix-5types beforeAll:85, matrix pnpm-symlink beforeAll:85.

The 6 `npm pack --json` sites to isolate (T2): install-e2e tarball-audit:117, install-smoke:74,
generator-e2e:96, nx-add-e2e:68; matrix-e2e matrix-5types:93, pnpm-symlink:91. (storybook-tarball
and verdaccio-publish only MENTION pack in `//` comments and install by-name -- do NOT touch them.)

Verified constraints (do not re-derive): `startLocalRegistry` has NO port param -- the port
comes from the referenced target, so a distinct port REQUIRES a second root Verdaccio target;
`parallelism` is a real per-target Nx 23 option; `parallelism:false` runs a task alone
(blocks all sibling scheduling). Distinct ports write DISTINCT global `~/.npmrc` authToken lines
(no collision). Preserve in BOTH global-setups: the 127.0.0.1 loopback, the "refusing to publish
to non-local registry" SAFETY gate, the real-token mint, the provenance strip, `--first-release`,
`--excludeTaskDependencies`, and the n7z `delete process.env.NX_INVOCATION_ROOT_PID` line.
</context>

<tasks>

<task type="auto">
  <name>Task 1: De-dup the build -- e2e dependsOn angular-typechecker:build, delete all in-spec/in-setup nx build</name>
  <files>nx.json, e2e/angular-typechecker-install-e2e/src/global-setup.ts, e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts, e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts, e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.e2e.spec.ts</files>
  <action>
Make the plugin build happen exactly ONCE upstream (Nx-cached), then remove every redundant
`nx build` so `dist/packages/angular-typechecker` is read-only during e2e -- the load-bearing
prerequisite for ANY parallelism (concurrent dist writes corrupt every packer/publisher).

1. In `nx.json`, add an `e2e` entry to `targetDefaults` with `dependsOn: ["angular-typechecker:build"]`.
   A single targetDefault covers all four e2e projects (GUARD-01 guarantees only e2e/* projects
   define an `e2e` target). Do not add `cache`/`outputs` here -- the e2e targets already declare
   their own `outputs`. The extra build dependency on cache-e2e (which uses the source barrel) is
   a harmless cached no-op.

2. In BOTH global-setups (`install-e2e/src/global-setup.ts` line 144,
   `ng-cli-e2e/src/global-setup.ts` line 149), DELETE the
   `sh('npx nx build angular-typechecker --skip-nx-cache', { cwd: root, env });` statement. Keep
   everything else: `mintCiToken`, the provenance strip that reads/writes the dist manifest
   (dist now exists because the `e2e` target dependsOn build), the publish with `--first-release
   --excludeTaskDependencies`, and the n7z `delete process.env.NX_INVOCATION_ROOT_PID`. Adjust
   the neighbouring comment that says "build FRESH dist ONCE (finding E1)" to reflect that the
   build now runs upstream via the `e2e` target's dependsOn (freshness is preserved by Nx input
   hashing over src -- the `--skip-nx-cache` was belt-and-suspenders). `--excludeTaskDependencies`
   on publish STAYS -- it stops the publish's own dependsOn:["build"] from re-materializing dist
   from cache and clobbering the provenance strip.

3. In `matrix-5types.e2e.spec.ts` (beforeAll, line 85) and `pnpm-symlink.e2e.spec.ts` (beforeAll,
   line 85), DELETE the `execSync('npx nx build angular-typechecker --skip-nx-cache', {...})`
   call. Leave the subsequent `npm pack --json` (isolated in T2) and everything else. Update the
   adjacent "Build a FRESH dist" / "FRESH dist" comment to note dist is provided upstream by the
   `e2e` target's dependsOn build.

Test-harness/config only -- no production source, no package.json, no version. Stage files by
name (never `git add .` / `-A`).
  </action>
  <verify>
    <automated>NX_DAEMON=false npx nx run-many -t typecheck -p tag:type:e2e --skip-nx-cache</automated>
    Confirm zero `nx build` calls survive in the e2e specs/setups (tracked files):
    `git grep -n "nx build angular-typechecker" -- "e2e/"` -> NO matches.
    Confirm the targetDefault landed:
    `git grep -n "angular-typechecker:build" -- nx.json` -> 1 match under an `e2e` targetDefault.
    Then the SLOW gate (several minutes -- Verdaccio build+publish + installs; run with a generous
    timeout or in the background; a long runtime is NOT a failure):
    `NX_DAEMON=false npx nx run-many -t e2e --parallel=1 --skip-nx-cache` -> GREEN for all four
    e2e projects (this is Fallback B on its own -- proves de-dup is correct before parallelism).
  </verify>
  <done>
`nx.json` has an `e2e` targetDefault with `dependsOn: ["angular-typechecker:build"]`; no `nx build`
call remains in any e2e spec or global-setup; `nx run-many -t e2e --parallel=1 --skip-nx-cache`
is GREEN across all four projects; the n7z NX_INVOCATION_ROOT_PID deletes and both SAFETY gates
are intact; no package.json / version changed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Isolate the three shared resources -- per-spec tarball, second registry (port 4874 + own storage), cache-e2e parallelism:false</name>
  <files>e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts, e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts, e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts, e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts, e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts, e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.e2e.spec.ts, project.json, e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts, e2e/angular-typechecker-cache-e2e/project.json</files>
  <action>
Isolate the remaining three shared resources so install-e2e can safely overlap its siblings.

RESOURCE 1 -- tarball path (the 6 pack specs). For EACH of the 6 `npm pack --json` sites, pack
to a per-spec OS-temp destination instead of into `dist`, so dist stays read-only and no two
projects share a tarball path:
  - Create a unique dir per spec: `const packDest = mkdtempSync(join(tmpdir(), 'atc-pack-<slug>-'))`
    (import `mkdtempSync` from `node:fs` and `tmpdir` from `node:os` where not already imported;
    use a distinct `<slug>` per spec, e.g. `audit`, `smoke`, `gen`, `nxadd`, `matrix`, `pnpm`).
  - Change the pack command to `npm pack --json --pack-destination "<packDest>"` (npm 7+ writes
    the tgz to `<packDest>` and reports `filename` as the bare base name; angular-typechecker is
    unscoped so the scoped-filename bug does not apply). Keep `cwd: distDir` so pack reads the
    dist package.
  - Set the tarball path to `join(packDest, packResult.filename)` (was `join(distDir, filename)`).
  - In `afterAll`, remove `packDest` recursively (`rmSync(packDest, { recursive: true, force: true })`
    or `removeTmpDir(packDest)`) instead of only `rmSync(tgz)`; drop any leftover distDir-relative
    tarball cleanup.
  - tarball-audit ALSO extracts the tgz. Keep the extraction UNDER `packDest` (not distDir) and
    PRESERVE the GNU-vs-BSD `tar` relative-path workaround: run `tar` with `cwd: packDest`, the
    BARE tgz filename, and a `packDest`-relative `-C` extract dir -- never a Windows drive-letter
    path (the AUTHORITATIVE verify runs on the Windows dev box). Point publint/attw at the
    absolute `tgz` under packDest.

RESOURCE 2 -- Verdaccio port + storage (ng-cli-e2e only; install-e2e keeps 4873 + its storage):
  - In root `project.json`, ADD a second target `local-registry-ngcli` (executor `@nx/js:verdaccio`),
    a verbatim copy of `local-registry` EXCEPT `port: 4874` and `storage: "tmp/local-registry/storage-ngcli"`
    (keep `listenAddress: "127.0.0.1"` and `config: ".verdaccio/config.yml"`).
  - In `ng-cli-e2e/src/global-setup.ts`, change the `startLocalRegistry` `localRegistryTarget`
    from `` `${rootProjectName}:local-registry` `` to `` `${rootProjectName}:local-registry-ngcli` ``
    (keep it assembled from `${rootProjectName}` + the literal suffix so NO contiguous
    `<scope>/source:<target>` literal appears -- the scoped-name guard). Change the `storage`
    param from `'./tmp/local-registry/storage'` to `'./tmp/local-registry/storage-ngcli'`.
  - LOAD-BEARING: leave the `if (!registryUrl.startsWith('http://127.0.0.1:'))` SAFETY gate exactly
    as-is -- `http://127.0.0.1:4874` still matches it, so the second registry is publish-gated
    identically. Do NOT touch install-e2e's global-setup here (it keeps 4873 + `storage`; the two
    are now distinct in both target and storage).

RESOURCE 3 -- cache-e2e serialization:
  - In `e2e/angular-typechecker-cache-e2e/project.json`, add `"parallelism": false` to the `e2e`
    target so the cache-correctness gate never co-runs with a nested-nx sibling (avoids the
    transient `.nx` SQLite-lock flake; RESEARCH Pitfall 1).

Overlap ceilings under --parallel=2 (ponytail -- BOTH resolved by Fallback A, NOT by re-running):
install-e2e and ng-cli-e2e can now co-run and both hit TWO shared read-modify-write races that the
distinct ports do NOT protect:
  (i) the shared dist manifest provenance strip -- both write `provenance:false`, an idempotent
      same-value write (worst case a torn read of the manifest by a concurrent publish); and
  (ii) the shared USER `~/.npmrc` -- `startLocalRegistry` runs `npm config set //host:port/:_authToken`
      against the single user `~/.npmrc`, so two live registries co-running can LOSE a
      read-modify-write update to that ONE file. This is independent of the distinct ports / distinct
      authToken LINES: the safety is per-LINE, but the FILE itself is the shared mutable resource.
Leave both as-is for Option 1. If EITHER surfaces in the T3 --parallel=2 runs (a registry-auth /
publish / EPUBLISHCONFLICT / torn-manifest flake), read it as an "adopt Fallback A" signal
(install-e2e parallelism:false -> only ONE registry ever starts and no concurrent dist strip),
NOT as a "re-run and hope".

Test-harness/config only -- no production source, no package.json, no version. Stage files by name.
  </action>
  <verify>
    <automated>NX_DAEMON=false npx nx run-many -t typecheck -p tag:type:e2e --skip-nx-cache</automated>
    Confirm every pack site now isolates its destination (tracked files):
    `git grep -c -- "--pack-destination" "e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts" "e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts" "e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts" "e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts" "e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts" "e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.e2e.spec.ts"` -> each reports >=1.
    Confirm the second registry + serialization landed:
    `git grep -n "local-registry-ngcli" -- project.json e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` -> matches in both;
    `git grep -n "\"parallelism\": false" -- e2e/angular-typechecker-cache-e2e/project.json` -> 1 match;
    `git grep -n "http://127.0.0.1:" -- e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` -> SAFETY gate still present.
    Then the SLOW gate (several minutes; generous timeout / background; long runtime is not failure) --
    prove each isolated project standalone AND still-serial-safe:
    `NX_DAEMON=false npx nx run-many -t e2e --parallel=1 --skip-nx-cache` -> GREEN for all four projects.
  </verify>
  <done>
All 6 pack sites write to a per-spec `--pack-destination` temp dir (dist untouched by pack); root
project.json has a `local-registry-ngcli` target on port 4874 with storage `storage-ngcli`;
ng-cli-e2e global-setup references that target + `storage-ngcli` and still enforces the 127.0.0.1
SAFETY gate; cache-e2e's e2e target has `parallelism:false`; `nx run-many -t e2e --parallel=1
--skip-nx-cache` stays GREEN; no package.json / version changed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Flip CI to --parallel=2 and rewrite GUARD-01b (+ stale GUARD-01 / helper prose) in lockstep</name>
  <files>.github/workflows/ci.yml, packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts</files>
  <action>
Raise the parallel degree and update every guard/comment in lockstep so no invariant silently
weakens (AGENTS.md: a guard that would pass on regression is unacceptable).

1. In `.github/workflows/ci.yml`, change the e2e-job run step `npx nx run-many -t e2e --parallel=1`
   to `--parallel=2`. Rewrite the preceding comment block (currently the "share one dist tarball
   path" / ENOENT-race / "--parallel=1 runs the three projects one at a time" rationale, ~lines
   192-203): the new rationale is that dist is built once upstream (e2e dependsOn build), each spec
   packs to its own --pack-destination, the two registries use distinct ports+storage, and cache-e2e
   is parallelism:false -- so up to two e2e projects run concurrently safely. Do NOT add a `-p`
   project list (GUARD-01/Pitfall 4: the unscoped run-many is what auto-covers every e2e project).

2. In `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`, REWRITE the GUARD-01b
   describe block (do NOT delete it) to assert the NEW invariants, each fail-loud + located.
   Reuse the existing `extractE2eJobLines` helper for reading the ci.yml e2e block. Assert:
   a. The ci.yml e2e run step passes `--parallel=2` (non-comment line regex `/^(?!\s*#).*--parallel=2\b/m`
      over the e2e block) AND does NOT pass `--parallel=1` (non-comment line regex for `--parallel=1\b`
      must NOT match). NOTE: this block reads YAML, so `#` is the comment marker here -- distinct
      from the TS-source scans in b/e below, which exclude `//` and `*`. Message: name the isolation
      prerequisites that make >1 safe.
   b. Every e2e spec that actually packs uses `--pack-destination`. Scan each `e2e/**/*.e2e.spec.ts`;
      for any line matching `npm pack --json` that is NOT a TS comment, assert that same line also
      contains `--pack-destination`. TS-comment exclusion = skip lines whose first non-space chars
      are `//` OR `*` (block-comment continuation) -- NOT the YAML `#` extractE2eJobLines uses;
      several specs mention `npm pack --json` in `//` comments (and storybook-tarball /
      verdaccio-publish mention `npm pack` in prose), which must NOT false-trigger, while a future
      bare pack IS caught. Message: a bare `npm pack --json` into the shared dist dir reintroduces
      the cross-project tarball race.
   c. The two registry-starting global-setups use DISTINCT registry targets AND distinct storage.
      Read `install-e2e/src/global-setup.ts` and `ng-cli-e2e/src/global-setup.ts`; extract the
      `localRegistryTarget` suffix (the part after `${rootProjectName}:`) and the `storage:` string
      literal from each; assert install's target-suffix !== ng-cli's AND install's storage !==
      ng-cli's. Message: same port/storage under parallel collides (EADDRINUSE / clearStorage wipe).
   d. cache-e2e's `e2e` target has `parallelism: false`. Read `e2e/angular-typechecker-cache-e2e/project.json`
      and assert `targets.e2e.parallelism === false`. Message: the cache-correctness gate must not
      co-run with a nested-nx sibling.
   e. NO spec/global-setup rebuilds dist (the de-dup / dist-read-only invariant -- blocker 1's guard,
      the load-bearing lockstep). Scan each `e2e/**/*.e2e.spec.ts` AND each `e2e/**/global-setup.ts`;
      assert NO line matching `nx build angular-typechecker` that is NOT a TS comment (same `//`/`*`
      exclusion as b). Message: an in-spec / in-setup `nx build` reintroduces concurrent dist writes
      that corrupt every packer/publisher under --parallel=2 with no other loud guard.

3. Update the now-stale PROSE + comments so they stay accurate (AGENTS.md), WITHOUT changing any
   surviving assertion:
   - The GUARD-01 header comment and its error messages (the "exactly the three tarball projects,
     serialized" and "they share one dist tarball path; see GUARD-01b" phrasings, ~lines 14-18 and
     the error string ~line 153): there are FOUR e2e projects, they no longer share one tarball
     path, and they run at --parallel=2. Do NOT change GUARD-01's ASSERTIONS (every e2e/* project
     defines `e2e`; no non-e2e project defines `e2e`; ci.yml runs `run-many -t e2e`) -- those
     remain valid and unaffected, as do GUARD-01c/01d.
   - The `extractE2eJobLines` doc-comment (~lines 92-93) currently says it is "Shared by the
     `--parallel=1` serialization guard (GUARD-01b) ...". After the rewrite GUARD-01b asserts
     --parallel=2, so reword neutrally (e.g. "Shared by the e2e job-scoping guard (GUARD-01b) and
     the typecheck-coverage guard (GUARD-01c)") -- the helper is unchanged; only the label is stale.

Test-harness/config only -- no production source, no package.json, no version. Stage files by name.
  </action>
  <verify>
    <automated>NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache</automated>
    (GUARD-01/01b/01c/01d green with the rewritten 01b -- incl. the new no-in-spec-build assertion.)
    Then lint:
    `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache`.
    Confirm the flip + guard landed (tracked files):
    `git grep -n -- "--parallel=2" .github/workflows/ci.yml` -> 1 match (run step);
    `git grep -n -- "--parallel=1" .github/workflows/ci.yml` -> NO run-step match (comments may
    reference it historically only if non-run lines; prefer none).
    Then the AUTHORITATIVE gate -- run THREE times to prove non-flaky (each run is MANY minutes:
    Verdaccio build+publish + npm/yarn/pnpm installs across four projects; use a generous timeout
    or run in the background; a slow run is NOT a failure):
    `NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache` -> GREEN for ALL FOUR
    projects on all three runs, with NO ENOENT / EADDRINUSE / EPUBLISHCONFLICT / "already invoked
    by a parent Nx process in this chain". A registry-auth / publish flake here = adopt Fallback A.
  </verify>
  <done>
ci.yml runs `nx run-many -t e2e --parallel=2` with a corrected rationale comment; GUARD-01b is
rewritten to assert --parallel=2 (and reject --parallel=1), per-spec --pack-destination, distinct
registry target+storage, cache-e2e parallelism:false, AND no in-spec/in-setup `nx build`; GUARD-01
stale prose + the extractE2eJobLines doc-comment are corrected without changing any assertion;
`nx test`/`nx lint angular-typechecker` are green; and `nx run-many -t e2e --parallel=2
--skip-nx-cache` is GREEN across all four projects on three consecutive runs. No package.json /
version changed.
  </done>
</task>

</tasks>

<fallback>
If `--parallel=2` proves flaky across the three T3 runs, take the defined off-ramp instead of
thrashing (all still additive / release-safe). A registry-auth / publish / EPUBLISHCONFLICT /
torn-manifest flake is a Fallback-A signal (both overlap ceilings named in T2 are resolved by it),
NOT a re-run candidate:

- Fallback A (RESEARCH Option 2): keep the T1 build-dedup and the T2 isolation, but set
  `parallelism: false` on install-e2e's `e2e` target as well (in addition to cache-e2e). install
  then runs alone -- only ONE registry ever starts (no shared `~/.npmrc` authToken write-race, no
  concurrent dist provenance strip) and only ng-cli x matrix overlap. Keep ci.yml at `--parallel=2`;
  the GUARD-01b `--parallel=2` assertion still holds. Add an install-e2e `parallelism:false`
  assertion if you adopt this. Expected ~33-35 min.
- Fallback B (RESEARCH Option 3): keep ONLY the T1 build-dedup; revert ci.yml to `--parallel=1`
  and restore GUARD-01b's `--parallel=1` assertion. Guaranteed-safe, still removes the redundant
  builds. Expected ~40 min (marginal win).

Prefer A over B; both are strictly safer subsets of Option 1.
</fallback>

<threat_model>
No new trust boundary. The only new externally-observable surface is the second Verdaccio
registry (`local-registry-ngcli`, port 4874). It is bound to `127.0.0.1` (numeric IPv4 loopback,
same as 4873), reachable only from the same host, and the ng-cli-e2e global-setup's "refusing to
publish to non-local registry" SAFETY gate (`registryUrl.startsWith('http://127.0.0.1:')`) applies
to it unchanged -- so no publish can escape to a public registry. `startLocalRegistry` writes a
GLOBAL `~/.npmrc` authToken line keyed by host:port; because the two registries use DISTINCT ports
they write DISTINCT lines and `stop()` deletes each independently (no cross-project token
collision -- the read-modify-write ORDERING on that one shared file is a liveness ceiling handled
by the T2 note / Fallback A, not a trust concern). No secret is added, no package.json version is
mutated, and no production/consumer code changes. STRIDE register omitted -- no boundary is added
or moved.
</threat_model>

<verification>
- Build runs once upstream; zero `nx build` calls remain in any e2e spec/global-setup; dist is
  read-only during e2e.
- `nx run-many -t e2e --parallel=2 --skip-nx-cache` is GREEN across all four projects on three
  consecutive runs with none of ENOENT / EADDRINUSE / EPUBLISHCONFLICT / "already invoked by a
  parent Nx process in this chain".
- The two registries run on distinct ports (4873/4874) with distinct storage; both stay
  127.0.0.1-loopback and publish-gated.
- All 6 pack sites use a per-spec `--pack-destination`; cache-e2e is `parallelism:false`.
- GUARD-01b is rewritten to assert every new invariant -- incl. the no-in-spec-build de-dup guard
  (loud on regression); GUARD-01/01c/01d stay green; `nx test` + `nx lint angular-typechecker`
  pass at maxWarnings:0.
- Additive / release-safe: no production source, no package.json, no version; the n7z
  NX_INVOCATION_ROOT_PID deletes and both SAFETY gates preserved.
</verification>

<success_criteria>
The CI e2e job runs `nx run-many -t e2e --parallel=2`, all four e2e projects pass GREEN and
non-flaky (3x) under `--parallel=2` locally with the four shared resources fully isolated (build
once, per-spec tarballs, distinct registry ports+storage, cache-e2e serialized), GUARD-01b is
rewritten to fail loudly on any regression -- including a re-added in-spec `nx build` -- and
nothing outside the test harness / config (no source, no package.json, no version) is touched.
</success_criteria>

<output>
Create `.planning/quick/260712-squ-enable-e2e-parallel-2-or-3-de-dup-build-/260712-squ-SUMMARY.md` when done
</output>
