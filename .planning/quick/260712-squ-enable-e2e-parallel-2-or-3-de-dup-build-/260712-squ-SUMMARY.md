---
phase: quick-260712-squ
plan: squ
subsystem: e2e-ci
tags: [e2e, ci, nx, verdaccio, parallelism, yarn]
requirements: [SQU-01]
requires:
  - The four e2e projects (install-e2e, ng-cli-e2e, matrix-e2e, cache-e2e) and their
    `e2e` + `typecheck` targets, `type:e2e` tags (GUARD-01/01c/01d contract)
  - The single `local-registry` Verdaccio target (port 4873) on the root project
provides:
  - e2e tier runs at `nx run-many -t e2e --parallel=2` (build once upstream; per-spec
    tarballs; install-e2e + cache-e2e serialized; single 4873 registry)
  - GUARD-01b rewritten to fail loud on regression of the five parallel-2 isolation
    invariants
affects:
  - .github/workflows/ci.yml (e2e job)
  - nx.json (e2e targetDefault)
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts (GUARD-01b)
tech-stack:
  added: []
  patterns:
    - "nx targetDefault dependsOn for build-once-upstream (dist read-only during e2e)"
    - "per-spec `npm pack --json --pack-destination <mkdtemp>` (no shared dist tarball)"
    - "Nx `parallelism: false` to serialize the registry publisher + cache-correctness gate"
key-files:
  created: []
  modified:
    - nx.json
    - .github/workflows/ci.yml
    - e2e/angular-typechecker-install-e2e/project.json
    - e2e/angular-typechecker-cache-e2e/project.json
    - e2e/angular-typechecker-install-e2e/src/global-setup.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
    - e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts
    - e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts
    - e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts
    - e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts
    - e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts
    - e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.e2e.spec.ts
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
decisions:
  - "Adopted Fallback A (single registry + install-e2e serialized) over Option 1's second
    registry: yarn 4's global metadata cache is keyed by HOST not host:port, so a second
    Verdaccio port on 127.0.0.1 makes yarn reuse stale cross-registry __archiveUrl -> ECONNREFUSED"
metrics:
  tasks_completed: 3
  files_modified: 13
  production_source_changed: false
  package_version_mutated: false
  completed: 2026-07-13
---

# Quick Task 260712-squ: Enable e2e --parallel=2 (de-dup build + isolate shared resources) Summary

Raised the CI e2e tier from `nx run-many -t e2e --parallel=1` to `--parallel=2` by building
the plugin once upstream (read-only dist), isolating each pack spec's tarball to its own
OS-temp `--pack-destination`, and serializing the sole Verdaccio publisher (install-e2e) and
the cache-correctness gate (cache-e2e) with Nx `parallelism: false` on a single 127.0.0.1:4873
registry. GUARD-01b was rewritten in lockstep to fail loud on regression of every new
invariant. Verified GREEN across all four e2e projects on three consecutive `--parallel=2`
runs; `nx test` (370, incl. GUARD-01b) and `nx lint` (maxWarnings:0) pass. No production
source and no `package.json` version were touched.

## Path taken

**Fallback A, correctly realized** (NOT full Option 1, NOT Fallback B):

- `ci.yml` runs `nx run-many -t e2e --parallel=2` (the primary flag).
- `install-e2e` and `cache-e2e` `e2e` targets are `parallelism: false`, so install (the only
  Verdaccio publisher) and cache each run ALONE while `ng-cli-e2e` and `matrix-e2e` overlap.
- A SINGLE `local-registry` (port 4873) is used by both registry projects (they never co-run).
  The plan's second registry (`local-registry-ngcli`, port 4874) was built and then reverted --
  see Deviation 1.

This is the plan's Fallback A (`--parallel=2` + install serialized), with the extra correctness
fix that a second registry is unnecessary and actively harmful (Deviation 1). It removes the
redundant builds and overlaps install-e2e's shadow with ng-cli/matrix -- a real wall-clock win
over the prior serial tier.

## Tasks

1. **T1 -- build once upstream (`982c158`).** Added an `e2e` targetDefault
   `dependsOn: ["angular-typechecker:build"]` to `nx.json`; deleted all four in-spec/in-setup
   `nx build angular-typechecker` calls (both registry global-setups, both matrix specs) so dist
   is built once, cached, and read-only during e2e. Gate: `nx run-many -t e2e --parallel=1
   --skip-nx-cache` GREEN (4/4).
2. **T2 -- isolate resources + serialize (`38e603a`).** Six pack specs write to a per-spec
   OS-temp `--pack-destination` dir (dist stays read-only, no shared tarball path); `install-e2e`
   and `cache-e2e` `e2e` targets set `parallelism: false`. Gate: `nx run-many -t e2e --parallel=1
   --skip-nx-cache` GREEN (4/4).
3. **T3 -- flip CI + rewrite GUARD-01b (`6db144d`).** `ci.yml` e2e job -> `--parallel=2` with a
   rewritten rationale; GUARD-01b rewritten to assert the five isolation invariants; stale
   GUARD-01 prose + the `extractE2eJobLines` doc-comment corrected (no surviving assertion
   changed). Gate: `nx run-many -t e2e --parallel=2 --skip-nx-cache` GREEN x3 (non-flaky) +
   `nx test` + `nx lint` green.

## Verify results (each honest)

| Gate | Command | Result |
| ---- | ------- | ------ |
| T1 p1 | `NX_DAEMON=false npx nx run-many -t e2e --parallel=1 --skip-nx-cache` | GREEN (4/4) |
| T2 p1 | `NX_DAEMON=false npx nx run-many -t e2e --parallel=1 --skip-nx-cache` | GREEN (4/4) |
| T3 p2 x3 (AUTHORITATIVE) | `NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache` (x3) | GREEN (4/4) all three runs; "Successfully ran target e2e for 4 projects" x3; no ENOENT/EADDRINUSE/EPUBLISHCONFLICT/ECONNREFUSED/torn-manifest/"already invoked by a parent Nx process" |
| nx test | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | GREEN (39 files, 370 tests; GUARD-01/01b/01c/01d) |
| nx lint | `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | GREEN (maxWarnings:0) |

## GUARD-01b (five invariants asserted, fail-loud + located)

1. ci.yml e2e job passes `--parallel=2` AND NOT `--parallel=1` (non-comment YAML lines).
2. every `e2e/**/*.e2e.spec.ts` line running `npm pack --json` (non-comment TS) also uses
   `--pack-destination`.
3. `install-e2e` `e2e` target `parallelism === false` (single live registry).
4. `cache-e2e` `e2e` target `parallelism === false`.
5. no non-comment `nx build angular-typechecker` in any `e2e/**/*.e2e.spec.ts` or
   `e2e/**/global-setup.ts` (de-dup / dist-read-only).

Note: invariant 3 (install-e2e serialized) REPLACES the plan's literal "distinct registry
targets + storage" invariant, because the second registry was dropped (Deviation 1). GUARD-01,
01c, 01d assertions are unchanged and green.

## Deviations from Plan

### Auto-fixed / blocking issues (no user permission needed)

**1. [Rule 3 - Blocking] Second Verdaccio registry abandoned; adopted single-registry Fallback A.**
- **Found during:** T2 parallel=1 gate, then confirmed at the yarn specs.
- **Issue:** The plan's Option 1 (and its literal Fallback A) add a second registry
  `local-registry-ngcli` on port 4874 with its own storage, so install-e2e (4873) and ng-cli-e2e
  (4874) can co-run. Two independent defects made this unworkable:
  (a) `.verdaccio/config.yml` hardcodes the htpasswd file to install-e2e's storage dir, so a
      second registry sharing that config 409s on the ci-user sign-up ("username is already
      registered") because its own `clearStorage` never wipes the shared htpasswd.
  (b) MORE FUNDAMENTAL: yarn 4's global metadata cache is keyed by HOST (`127.0.0.1`), NOT
      host:port, and bakes the port into `__archiveUrl`. A second registry on a distinct port of
      the same host makes yarn reuse stale cross-registry tarball URLs from whichever port
      populated the cache -- `RequestError: connect ECONNREFUSED 127.0.0.1:<other-port>`. This
      would break the yarn e2e specs on CI too (not just the dev box), whenever the two registries
      are not simultaneously live.
- **Fix:** Adopt the plan's Fallback A but realize it with a SINGLE `local-registry` (4873):
  `install-e2e` `e2e` target `parallelism: false` so install (the sole publisher) never co-runs
  with ng-cli-e2e; ng-cli-e2e and matrix-e2e overlap; cache-e2e stays serialized. Only ONE
  registry is ever live, so the shared registry/storage/htpasswd/authToken are never touched
  concurrently AND yarn always sees a live 4873 matching its host-keyed cache. This removes the
  409, the authToken race, and the yarn ECONNREFUSED at once.
- **Files:** reverted the `local-registry-ngcli` target in `project.json` and deleted the
  transient `.verdaccio/config-ngcli.yml` (both created mid-task, neither committed); ng-cli
  global-setup kept on `local-registry` + `storage`; added `parallelism: false` to
  install-e2e `project.json`.
- **Commits:** 38e603a (T2), 6db144d (T3).

**2. [Environment, not a code change] Cleared poisoned dev-box yarn metadata cache to verify.**
- During the abandoned second-registry experiments, this dev box's yarn global metadata cache
  (`D:\packages\.yarn\berry\global\metadata\npm\...\127.0.0.1\*.json`) was poisoned with 4874
  `__archiveUrl` entries. Removed the `127.0.0.1` and `localhost` metadata subdirs (yarn re-fetches
  fresh) so the single-4873 design could be verified. No repo change; CI runs a fresh `npm ci`
  per job and never accumulates this cache.

## Blocking invariants (confirmed)

- **SAFETY gate:** both global-setups retain the `registryUrl.startsWith('http://127.0.0.1:')`
  "refusing to publish to non-local registry" gate (1 each). (The 4874 registry no longer exists;
  the single 4873 registry stays 127.0.0.1-loopback + publish-gated.)
- **n7z line:** `delete process.env.NX_INVOCATION_ROOT_PID` preserved in both global-setups (1 each).
- **No version mutation:** `packages/angular-typechecker/package.json` untouched by all three
  commits (verified via git diff).
- **Guards rewritten, not deleted:** GUARD-01b rewritten (5 invariants); GUARD-01/01c/01d
  assertions untouched; all green.
- **Additive / release-safe:** test-harness + config + ci only; zero production/source change.

## Self-Check: PASSED

- Commits exist: `982c158`, `38e603a`, `6db144d` (git log verified).
- No `package.json` version change (git diff verified).
- SAFETY gate + n7z line present in both global-setups (git grep verified).
- Authoritative `--parallel=2` gate GREEN x3 (background run blmam9qfw, 3x "Successfully ran
  target e2e for 4 projects", zero failure markers).
