---
quick_id: 260714-nub
status: blocked
outcome: deferred-measurement + regression-found
date: 2026-07-14
---

# Quick Task 260714-nub: CI actions/cache (Verdaccio uplink storage) -- SUMMARY

**Outcome: the actions/cache step is AUTHORED + CODE-REVIEWED but NOT applied and NOT measured.**
The throwaway-PR measurement was BLOCKED by a pre-existing, Release-PR-blocking e2e-CI regression it
surfaced (dist not built on a fresh CI runner). Per the user decision, the e2e regression is handled
as its own priority task first; the cache measurement resumes only after CI e2e is green. Nothing was
applied to the feature branch; no package.json version mutation.

## What was done

1. **Research (260714-nub-RESEARCH.md):** confirmed the cache is ADDITIVE over the existing
   `setup-node cache: npm` -- that warms `~/.npm` (npm<->Verdaccio); caching `tmp/local-registry/storage`
   warms the Verdaccio<->npmjs uplink (empty on every fresh runner), which yarn (fresh
   `cacheFolder`+`enableMirror:false`, never uses `~/.npm`) and the pnpm store never get. No new
   permission scope (cache auths via `ACTIONS_CACHE_URL`, not the `permissions:` block). Honest caveat:
   the e2e step is CPU-bound-typecheck-dominated, so the wall-clock delta is a fraction.
2. **Cache step authored (SHA-pinned `actions/cache/restore`+`save@v6.1.0`,** path
   `tmp/local-registry/storage` excluding the reset-each-run `angular-typechecker` + `.htpasswd`, keyed
   on the fixture/plugin manifests + ci.yml, save-on-success-and-miss). It lived ONLY on the throwaway
   scratch branch (never committed to the feature branch).
3. **Code review (260714-nub-REVIEW.md, gsd-code-reviewer): APPROVE, 0 blockers/majors/minors**
   (3 advisory info notes incl. a low-risk `.verdaccio-db.json`-in-cache observation -- see below).
   `lint-workflows` (actionlint) also passed in CI, structurally validating the YAML.
4. **Measurement attempt (throwaway draft PR #34, base = feature branch):** CI run 1 ran. The
   `actions/cache/restore` step behaved correctly -- a clean cold **MISS** ("Cache not found", exactly
   as designed). BUT the e2e tier FAILED (below), so there was no install work to time -> no valid
   miss->hit. PR #34 was closed + the scratch branch deleted (cache step preserved in RESEARCH.md).

## The regression this surfaced (the valuable finding -- Release-PR blocker)

**`nx run-many -t e2e --parallel=2` fails in CI: `install-e2e`, `matrix-e2e`, `ng-cli-e2e` all ENOENT
on `dist/packages/angular-typechecker/package.json`** (their globalSetups read the built dist manifest
for the provenance-strip). The build did NOT run before the specs (ENOENT ~2s in). Root cause:
quick-260712-squ's de-dup removed the in-globalSetup `nx build` and relied on the `e2e` targetDefault
`dependsOn: ["angular-typechecker:build"]` (the e2e projects even declare
`implicitDependencies: ["angular-typechecker"]`), but on a **fresh CI runner** that dependsOn did NOT
produce dist before the e2e tasks. It was **masked locally** two ways: (a) `dist/` already existed from
prior manual builds, and (b) every local e2e run used `--skip-nx-cache` (which force-runs deps). The CI
e2e command uses **no `--skip-nx-cache`**, and because feature-branch pushes do not trigger CI
(`on: push: [main]` only) and no PR was open, this NEVER ran in CI until this probe. It would fail the
Release-PR identically. `cache-e2e` passes (it uses the source barrel, never reads dist).

Likely fix (for the follow-up task): ensure dist is built in CI before the e2e tier -- e.g. an explicit
single `- run: npx nx build angular-typechecker` step in the e2e job before `nx run-many -t e2e`
(preserves squ's build-once/no-per-spec-build intent; one build, before the parallel tier, so no
concurrent-dist-write), OR repair the dependsOn so it actually schedules the build on a cold cache.
Verify by re-running an e2e CI job (a throwaway PR or the Release-PR's first run).

## Status of the cache step

READY but PARKED: authored + code-reviewed (APPROVE). The exact YAML is in
`260714-nub-RESEARCH.md` Section 2. When CI e2e is green, re-apply it, re-run the throwaway PR (base =
feature branch) to read the miss->hit, and KEEP only if the e2e-step HIT beats MISS beyond CI noise.
Advisory follow-up (info note 3): consider also excluding `tmp/local-registry/storage/.verdaccio-db.json`
(the local-registry JWT secret) from the cached path -- low risk (throwaway 127.0.0.1 registry secret),
not a blocker.

## Artifacts

- `260714-nub-RESEARCH.md` -- additive-verdict, exact cache-step YAML, measurement-under-CI-constraint analysis.
- `260714-nub-PLAN.md` -- the 3-task plan (checker PASSED, 0 blockers).
- `260714-nub-REVIEW.md` -- gsd-code-reviewer APPROVE on the ci.yml diff.
- No VERIFICATION.md: the apply gate ("proven faster") was never reached (measurement blocked).
