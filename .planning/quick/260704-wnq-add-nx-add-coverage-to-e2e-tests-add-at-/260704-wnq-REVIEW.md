---
phase: 260704-wnq
reviewed: 2026-07-04T22:38:24Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 260704-wnq: Code Review Report

**Reviewed:** 2026-07-04T22:38:24Z
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Three new Vitest integration specs (`nx-add-{npm,pnpm,yarn}.int.spec.ts`) plus a
one-line CI change (`corepack enable` in the e2e job). They drive the REAL
`nx add angular-typechecker` against the shared local Verdaccio registry for all
three package managers.

Overall this is careful, well-documented test code. I verified the focus areas
adversarially and found NO correctness/false-pass defects and NO security issues:

- **Non-vacuous asserts (confirmed).** npm/yarn seed the absent-before baseline
  (`toBeUndefined()`) then assert the specific WALK-02 shape; pnpm uses the
  `let caught` flag + `expect(caught).toBe(true)` so an unexpected `nx add`
  success is RED, never silently green. None can false-pass.
- **Substring assertions are appropriately loose.** pnpm asserts the stable error
  code `ERR_PNPM_IGNORED_BUILDS` + the nx wrapper prefix `Failed to install
  angular-typechecker` (not the full trailing sentence), so a patch-bump wording
  change will not flake it.
- **Registry/token safety (confirmed).** Registry + token come only from
  `inject('verdaccioUrl'/'verdaccioToken')`; each spec re-asserts
  `startsWith('http://localhost:')`; npm/pnpm pin `npm_config_userconfig` to a
  nonexistent path; no hardcoded external registry, no real secret.
- **Resource hygiene (mostly good).** Every `mkdtempSync` dir is removed via
  `removeTmpDir(tmp)` in `finally`; the yarn cache is per-fixture (`./.yarn/cache`
  under tmp) and cleaned with tmp; the fixture is `cpSync`-copied so no shared
  mutable state. The one exception is the unbounded `corepack enable` mutation
  (WR-01).
- **CI change (confirmed clean).** `- run: corepack enable` sits after
  `setup-node` and before `pnpm/action-setup`, is a fixed command with no
  PR-metadata interpolation, adds no unpinned action, and the YAML is valid.
- **Style (confirmed).** ASCII-only (scanned, zero non-ASCII bytes), braces on all
  control-flow bodies, single quotes, blank line before `return`.

The SUMMARY confirms the authoritative signal is green: `install-e2e` 9 files /
32 tests pass, `format:check` + `lint` clean.

Pre-existing context (NOT a finding, per the task's already-triaged note):
standalone `tsc -p tsconfig.spec.json` reports `inject(...)` -> `never` on ALL
install-e2e specs including the committed analog, because `tsconfig.spec.json`'s
`include` omits `src/global-setup.ts` where the `ProvidedContext` augmentation
lives. No CI gate runs that tsc; the change did not introduce it.

## Warnings

### WR-01: `corepack enable` is an unbounded global machine mutation with no teardown

**File:** `e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts:124`
**Issue:** `sh('corepack enable', { cwd: tmp, env })` is not scoped to the tmp
fixture -- `corepack enable` installs the `yarn`/`pnpm` shims into the active Node
installation's bin directory (a machine-global, PATH-level change), and nothing in
the `finally` ever runs `corepack disable`. On the ephemeral Linux CI runner this
is harmless (and the CI job does the same thing explicitly). But this suite's
primary dev environment is Windows arm64, where running the spec locally leaves
corepack permanently enabled on the developer's machine after the test exits --
exactly the "corepack/global-shim mutation that could bleed into ... the parent
runner" the review brief calls out.

I traced the sibling-spec bleed risk and it does NOT cause a wrong result: whether
or not the yarn spec's `corepack enable` has run first, the pnpm spec's
`pnpm@11.9.0` `packageManager` pin routes to the gated major either via the
corepack shim or via host-pnpm self-management, so the gate fires the same way.
So this is a hygiene defect (persistent side effect), not a correctness defect --
hence Warning, not Blocker.

**Fix:** Either document the side effect explicitly (a `ponytail:`-style comment
that this deliberately mutates global corepack state and is not torn down, because
`corepack disable` in `finally` could clobber a developer's pre-existing corepack
setup), OR guard it so it only enables when the `yarn` shim is not already
resolvable. Minimal, lowest-risk option -- add a one-line comment at the call site
naming the persistent global effect so a future reader does not assume it is
tmp-scoped:

```ts
// NOTE: corepack enable is a MACHINE-GLOBAL shim install (not tmp-scoped) and is
// intentionally NOT torn down -- corepack disable in finally could clobber a
// developer's pre-existing corepack setup. CI runners are ephemeral; on a local
// dev machine this leaves corepack enabled after the run.
sh('corepack enable', { cwd: tmp, env });
```

## Info

### IN-01: skip guards probe tool *presence*, not routing/network *capability*

**File:** `e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts:74-84`, `e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts:47-57`
**Issue:** `it.skipIf(!pnpmAvailable)` only checks that `pnpm --version` runs, and
`it.skipIf(!corepackAvailable)` only checks that `corepack --version` runs. Neither
verifies the deeper precondition each test actually needs: the pnpm spec needs the
host pnpm to self-route to the gated `pnpm@11.9.0` via the `packageManager` field
(a host with pnpm but `manage-package-manager-versions` disabled would not fire the
gate), and the yarn spec needs corepack to be able to fetch `yarn@4.17.0` (an
offline host with corepack present cannot). On such a host the test fails RED
rather than skipping. This is not a false-pass (the pnpm non-vacuous guard and the
yarn structural asserts both hold), and CI provisions both PMs deterministically,
so CI is unaffected -- it only surfaces as a confusing local RED on a
differently-configured host. Acceptable as-is; noted so the failure mode is not
mistaken for a real regression.
**Fix:** None required. Optionally widen the pnpm probe to run through the
`packageManager` pin (or note in the header comment that a local RED here can mean
"host pnpm cannot self-route", not "the plugin regressed").

### IN-02: the pnpm spec is an inverted tripwire -- it flips RED when the upstream bug is FIXED

**File:** `e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts:169-176`
**Issue:** This spec pins the CURRENT `nx add` + pnpm-11 build-gate FAILURE as a
regression tripwire. The non-vacuous guard (`expect(caught).toBe(true)`) is correct
and intentional, but it means that when Nx/pnpm eventually fix this UX bug (so
`nx add` succeeds on a hardened pnpm workspace), this test will fail RED and must be
rewritten to assert the new success + seeded targetDefaults. The header comment
documents the bug thoroughly but does not call out this fix-flip maintenance
semantic, so a future maintainer could read a green->red flip here as "a new
regression" instead of "the bug got fixed."
**Fix:** Add one line to the header comment noting that a RED here can mean the
upstream pnpm/nx-add bug was fixed (rewrite the spec to assert success), not that
angular-typechecker regressed.

---

_Reviewed: 2026-07-04T22:38:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
