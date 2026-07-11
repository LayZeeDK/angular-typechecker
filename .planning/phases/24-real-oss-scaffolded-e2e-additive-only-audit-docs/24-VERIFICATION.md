---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
verified: 2026-07-11T14:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "ACV-01 real-clone gate #1 (bluehalo/ngx-leaflet @818e9ae, app+lib) -- executed autonomously: PASS. ng add auto-wired both projects (2-element tsConfig arrays), no stray nx.json, clean baseline exit 0, per-project scoping proven (app=TS2322+TS2345, lib=TS2554, bidirectional no-bleed), no ERR_REQUIRE_ESM."
    - "ACV-01 real-clone gate #2 (realworld-angular @9e3528f, app-only) -- executed autonomously: initially FAILED (found a real generator defect: silent app-build-leaf drop on an Angular-CLI-that-is-also-a-pnpm-workspace with a name-colliding root package.json). Defect root-caused, FIXED (commit 1837b25: read root/projectType straight from angular.json on the CLI write-fork), regression-tested (4 new tests), and gate #2 RE-VERIFIED on the real clone with the fixed tarball: PASS."
  gaps_remaining: []
  regressions: []
---

# Phase 24: Real-OSS + Scaffolded e2e, Additive-Only Audit, Docs Verification Report

**Phase Goal:** The full Angular CLI flow (`ng add angular-typechecker` -> `ng run <project>:typecheck`) is proven end-to-end against a real OSS `angular.json` workspace AND a freshly scaffolded workspace; the Angular-CLI-vs-Nx-difference unit/integration coverage is audited and gaps filled; the ADDITIVE-ONLY charter is audited; and the README/CHANGELOG document the new Angular CLI surface in end-user language. (Final phase of milestone v0.2.1.)
**Verified:** 2026-07-11T14:35:00Z
**Status:** passed
**Re-verification:** Yes -- after ACV-01 real-clone gate execution + gap-fix (was `human_needed`, 4/5)

## Goal Achievement

This is a VERIFICATION + AUDIT + DOCS phase that also carries the milestone's FINAL real-clone gate (ACV-01). The initial verification (2026-07-11T12:05Z) confirmed 4/5 automatable truths and surfaced the two ACV-01 real-clone executions as human items. Those have now been executed autonomously per the phase HANDOFF. Gate #1 passed; gate #2 caught a REAL generator defect (exactly the class of bug a real-clone gate exists to catch), which was root-caused, fixed, regression-tested, and re-verified PASS on the real clone with the fixed build. All 5 truths are now VERIFIED.

### Observable Truths

| # | Truth (ROADMAP SC / requirement) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | ACV-01: the packed tarball is proven against REAL cloned OSS Angular 22 workspaces (ngx-leaflet, then realworld-angular) via `ng add` -> `ng run <project>:typecheck` catching planted diagnostics. | ✓ VERIFIED | `24-ACV-01-UAT.md` frontmatter `outcome`: both gates executed; total 3 / passed 3. `24-HUMAN-UAT.md` records gate #1 (ngx-leaflet) PASS (auto-wire-all, 2-element arrays, no stray nx.json, per-project scoping, no ERR_REQUIRE_ESM) and gate #2 (realworld-angular) PASS AFTER FIX. Gate #2 initially FAILED on a genuine defect (spec-only under-check on an Angular-CLI+pnpm-workspace+name-collision); defect fixed in `generator.ts` (commit 1837b25), re-verified on the real clone: ng-add auto-wired `[tsconfig.app.json, tsconfig.spec.json]`, planted TS2322 (build leaf) + TS2345 (spec leaf) both caught, exit 1, no infra error. |
| 2 | ACV-02: the full flow is proven against a freshly SCAFFOLDED workspace; planted app+spec+library errors each surface, each per-project target catches exactly its own leaves. | ✓ VERIFIED | `e2e/angular-typechecker-ng-cli-e2e/` (Nx-discoverable; `e2e`+`typecheck` targets; `type:e2e` tag). Committed pinned Ng22 fixture (app `ng-cli-workspace` + lib `my-lib`, non-vacuous baseline). `ng-add-ng-run.e2e.spec.ts` asserts distinct per-leaf codes (TS2322/TS2345 app, TS2554 lib), both scoping directions, `not(ERR_REQUIRE_ESM)`, `not(infrastructure error)`. 4-guard contract green in the 327-test suite. |
| 3 | ACV-03: unit+integration coverage of the Angular-CLI-vs-Nx differences (tsConfig[] union; angular.json write-fork; builder over BuilderContext; ng-add auto-wire-all; no stray nx.json). | ✓ VERIFIED | `builder.integration.spec.ts` (4 tests, WR-01-hardened: planted TS2322+TS2345 surface in captured stdout) GREEN via `TestingArchitectHost`. Other 4 sub-items audited as Phases 21-23 coverage (24-ADDITIVE-AUDIT guard map). The write-fork's tsConfig[]-array resolution now ALSO covered by the ACV-01 regression suite (`configuration-angular-cli.spec.ts`: root-app, subdir-app, subdir-lib under pnpm collision). |
| 4 | ACP-02: additive-only enforced AND audited -- no break to the executor id, the runTypecheck/CoreResult/CoreOptions API (widened only), or existing schemas; v0.3.0 not triggered. | ✓ VERIFIED | `24-ADDITIVE-AUDIT.md` git-diff verdict vs `angular-typechecker@0.2.0` (barrel byte-unchanged; executor schema tsConfig oneOf widen-only; new-file additions). Section 5 confirms the ACV-01 gap-fix stays additive-only: it lives inside the NEW/UNRELEASED Angular CLI generator (0.2.0 has none), touches NO schema/barrel/collection/manifest. Verified independently: `git show --name-only 1837b25` = only `generator.ts` + 2 spec files. `src/index.drift.ts` tripwire GREEN under `nx typecheck`. `package.json` version UNCHANGED at 0.2.0. |
| 5 | ACD-01: README `## Angular CLI` section (all enumerated items) + curated CHANGELOG entry in end-user language, no internal ids. | ✓ VERIFIED | README `## Angular CLI` covers ng add auto-wire-all, ng generate ...:configuration, ng run <project>:typecheck, tsConfig-array target shape, nx-transitive + `.nx/` + no-caching notes, off-stack `--legacy-peer-deps`; Storybook "not supported" caveat preserved. `angular-cli-docs.spec.ts` (9 tests) GREEN. CHANGELOG `## 0.2.1` prose entry present (no cut/date/link -- finalized at Release-PR per AGENTS.md). No internal ids / email leaks. |

**Score:** 5/5 truths verified. The single previously-open item (ACV-01, truth 1) is now executed and PASS on both real clones.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/generators/configuration/generator.ts` | CLI write-fork reads root/projectType from angular.json (ACV-01 fix) | ✓ VERIFIED | Fix present in HEAD (commit 1837b25 is ancestor of HEAD): `resolveTsConfigLeaves(tree, root, projectType, schema)`; caller reads `readJson(angular.json).projects[project]`; Nx else-branch byte-unchanged. No debt markers. |
| `.../configuration/configuration-angular-cli.spec.ts` | ACV-01 pnpm-collision regression (root/subdir app, subdir lib) | ✓ VERIFIED | 3 new RED-turned-GREEN cases assert the full `[app/lib, spec]` array read straight from angular.json (old code would emit `[spec]`-only / throw). Non-vacuous. |
| `.../configuration/configuration.spec.ts` | Nx-branch package/project name-collision lock | ✓ VERIFIED | New case: pnpm-workspace + colliding package.json name still wires the target correctly on the Nx branch (project.json authoritative). |
| `packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts` | Builder-over-BuilderContext run + parity (ACV-03) | ✓ VERIFIED | 4 tests GREEN; WR-01-hardened. |
| `packages/angular-typechecker/src/index.drift.ts` | Additive-only barrel tripwire (5 exports) | ✓ VERIFIED | Wired into tsconfig.drift.json; drift tsc --noEmit GREEN. |
| `.planning/.../24-ADDITIVE-AUDIT.md` | ACP-02 git-diff verdict vs 0.2.0 (+ fix disposition) | ✓ VERIFIED | Per-path verdict + guard map + section 5 (fix stays additive-only). |
| `packages/angular-typechecker/README.md` (`## Angular CLI`) | End-user Angular CLI section | ✓ VERIFIED | All D-06 items; Storybook caveat intact. |
| `packages/angular-typechecker/src/angular-cli-docs.spec.ts` | Docs content tripwire | ✓ VERIFIED | 9 tests GREEN. |
| `CHANGELOG.md` (`## 0.2.1`) | Curated prose entry, no cut | ✓ VERIFIED | Prose-only; finalized at Release-PR. |
| `e2e/angular-typechecker-ng-cli-e2e/**` | 4th e2e project + committed fixture + ng-add->ng-run spec (ACV-02) | ✓ VERIFIED | Guard-compliant; per-leaf scoping spec; committed pinned Ng22 fixture. |
| `.planning/.../24-ACV-01-UAT.md` | Reproducible real-clone UAT (ACV-01) | ✓ VERIFIED (executed) | Both clones by URL+SHA; frontmatter `outcome` records executed results; total 3 / passed 3. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `configurationGenerator` (CLI fork) | `angular.json` projects map | `readJson(angular.json).projects[project]` root/projectType | ✓ WIRED | Fix bypasses the pnpm-shadowed `readProjectConfiguration` stub; regression suite proves the leaf array resolves correctly. |
| `tsconfig.drift.json` | `src/index.drift.ts` | `files` array entry | ✓ WIRED | Compiled by the `typecheck` target's drift `tsc --noEmit` (GREEN). |
| `builder.integration.spec.ts` | `fixtures/builder-context` | TestingArchitectHost workspaceRoot | ✓ WIRED | Tests GREEN. |
| `angular-cli-docs.spec.ts` | `README.md` | `readFileSync` + normalized toContain | ✓ WIRED | 9 assertions GREEN. |
| `ng-add-ng-run.e2e.spec.ts` | `fixtures/ng-cli-workspace` | cpSync -> tmp -> npm install -> ng add | ✓ WIRED | Committed fixture; per-leaf scoping asserted. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite (incl. 4 new ACV-01 regression tests, docs + drift + guard tripwires) | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 37 files / 327 tests passed (was 323; +4 = the fix's regression tests) | ✓ PASS |
| Lint (maxWarnings:0 CI gate) | `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | All files pass linting | ✓ PASS |
| Typecheck incl. drift barrel tripwire (additive-only) | `NX_DAEMON=false npx nx typecheck angular-typechecker --skip-nx-cache` | spec + drift + tools tsc --noEmit all pass | ✓ PASS |
| Build (compiled .js executor artifact) | `NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache` | Done compiling | ✓ PASS |
| package.json version unchanged (ACP-02) | `node -e require(...).version` | 0.2.0 (no v0.3.0) | ✓ PASS |
| Fix commit in HEAD | `git merge-base --is-ancestor 1837b25 HEAD` | ancestor of HEAD (working tree clean) | ✓ PASS |
| Fix touched no schema/barrel/manifest (additive-only) | `git show --name-only 1837b25` | only generator.ts + 2 spec files | ✓ PASS |
| ACV-01 real-clone gates (2 clones, 3 tests) | autonomous execution (24-HUMAN-UAT.md / 24-ACV-01-UAT.md) | 3/3 PASS (gate #2 after fix + re-verification on the real clone) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACV-01 | 24-03 | Real-clone tarball final gate | ✓ SATISFIED | Both clones executed; 3/3 PASS. Found + fixed a real generator defect; re-verified on the real clone. |
| ACV-02 | 24-03 | Scaffolded automated e2e, per-project scoping | ✓ SATISFIED | e2e project + committed fixture + spec; guards green. |
| ACV-03 | 24-01 | Unit+integration Angular-CLI-vs-Nx diff coverage | ✓ SATISFIED | builder.integration green + non-vacuous; write-fork array resolution now also covered by ACV-01 regression suite. |
| ACP-02 | 24-01 | Additive-only enforced + audited | ✓ SATISFIED | 24-ADDITIVE-AUDIT (incl. fix disposition) + index.drift.ts tripwire + version 0.2.0; fix touches only unreleased CLI generator. |
| ACD-01 | 24-02 | README `## Angular CLI` + CHANGELOG | ✓ SATISFIED | README section + 9-test docs tripwire + 0.2.1 prose entry. |

All 5 PLAN-declared requirement IDs (ACV-01, ACV-02, ACV-03, ACP-02, ACD-01) map to Phase 24 in REQUIREMENTS.md. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TBD/FIXME/XXX in fix-touched files (generator.ts + 2 specs) | - | Clean |
| (none) | - | No work-email / consensus.dk leak in phase docs, README, CHANGELOG | - | Public-repo hygiene OK |

Note: the CHANGELOG `## 0.2.1` entry intentionally omits the date + bottom link reference (code-review IN-03) -- the documented work-in-progress state finalized at the human-gated Release-PR cut (AGENTS.md), not a defect.

### Human Verification Required

None. Both ACV-01 real-clone gates (the only prior human items) have been executed and PASS. The remaining Release-PR steps (tag, OIDC publish, GitHub Release) are milestone-completion / release actions governed by AGENTS.md, not phase-24 verification items.

### Gaps Summary

No gaps. The one open item at initial verification -- the ACV-01 milestone-final real-clone gate -- has been executed on both on-stack Angular 22 clones (ngx-leaflet app+lib, realworld-angular app-only) and both PASS. Gate #2 initially failed on a genuine, previously-uncaught generator defect (the CLI write-fork silently dropped the app build leaf on an Angular-CLI workspace that is also a pnpm workspace with a name-colliding root package.json -- the worst failure mode for a complete-type-check tool). The defect was root-caused (Nx infers a shadowing package stub with `projectType: undefined`), fixed at root cause (read root/projectType straight from angular.json on the CLI branch; commit 1837b25), regression-tested (4 new tests: 3 CLI pnpm-collision cases + 1 Nx-branch collision lock, all in the 327-test green suite), and re-verified PASS on the real clone with the fixed tarball. Additive-only holds: the fix lives entirely inside the new/unreleased Angular CLI generator, touches no released schema/barrel/collection/manifest, and version stays 0.2.0 (no v0.3.0). All four CI gates are green (test 327, lint, typecheck incl. drift tripwire, build). Phase goal achieved.

---

_Verified: 2026-07-11T14:35:00Z_
_Verifier: Claude (gsd-verifier)_
