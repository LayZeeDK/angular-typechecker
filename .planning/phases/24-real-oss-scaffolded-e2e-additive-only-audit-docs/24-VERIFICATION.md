---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
verified: 2026-07-11T12:05:00Z
status: human_needed
score: 4/5 truths programmatically verified (ACV-01 is a documented manual gate)
overrides_applied: 0
human_verification:
  - test: "ACV-01 real-clone gate #1 -- bluehalo/ngx-leaflet @ 818e9ae55240b570397ede5a15cb4d466785abdc (app ngx-leaflet-demo + lib ngx-leaflet). Pack the shipped dist tarball, `ng add angular-typechecker` (from the tarball), plant per-leaf errors (app component TS2322, app spec TS2345, lib component TS2554), run `ng run ngx-leaflet-demo:typecheck` and `ng run ngx-leaflet:typecheck`. Full reproducible steps in 24-ACV-01-UAT.md."
    expected: "ng add auto-wires a typecheck target into BOTH projects (two-element tsConfig array, no stray nx.json). Clean baseline: both targets exit 0. Planted: the app target reports TS2322 + TS2345 but NOT TS2554; the lib target reports TS2554 but NEITHER app code. No ERR_REQUIRE_ESM / infrastructure error."
    why_human: "The OSS clone is UNCOMMITTED (reproduced by URL + pinned SHA), so no committed CI test can run it. It is a manual/local confidence gate on top of the CI-authoritative ACV-02 scaffolded e2e. Requires a real `ng`/`npm` toolchain + network clone."
  - test: "ACV-01 real-clone gate #2 -- realworld-angular/realworld-angular @ 9e3528ff27bad5fedaefb879ccc4aaf4717b137b (single application, app-only), run AFTER gate #1. `ng add angular-typechecker`, plant app-component TS2322 + app-spec TS2345, run `ng run realworld-angular:typecheck`. Full steps in 24-ACV-01-UAT.md."
    expected: "ng add wires a typecheck target into the single application (leaves [tsconfig.app.json, tsconfig.spec.json], no stray nx.json). Clean baseline exits 0. Planted: the target reports BOTH TS2322 and TS2345 (build leaf + spec leaf both checked) and exits non-zero; no ERR_REQUIRE_ESM / infrastructure error."
    why_human: "Same as gate #1 -- uncommitted OSS clone reproduced by URL + SHA; on-stack Angular 22 breadth/confidence gate that cannot be a committed CI test."
---

# Phase 24: Real-OSS + Scaffolded e2e, Additive-Only Audit, Docs Verification Report

**Phase Goal:** The full Angular CLI flow (`ng add angular-typechecker` -> `ng run <project>:typecheck`) is proven end-to-end against a real OSS `angular.json` workspace AND a freshly scaffolded workspace; the Angular-CLI-vs-Nx-difference unit/integration coverage is audited and gaps filled; the ADDITIVE-ONLY charter is audited; and the README/CHANGELOG document the new Angular CLI surface in end-user language. (Final phase of milestone v0.2.1.)
**Verified:** 2026-07-11T12:05:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

This is a VERIFICATION + AUDIT + DOCS phase: it deliberately adds NO production engine/generator/schematic surface. Verification is against the ROADMAP success criteria (one per requirement ID), narrowed accordingly.

### Observable Truths

| # | Truth (ROADMAP SC / requirement) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | ACV-01: the packed tarball is proven against a REAL cloned OSS Angular 22 workspace (ngx-leaflet, then realworld-angular) via `ng add` -> `ng run <project>:typecheck` catching planted diagnostics. | ? HUMAN (manual gate) | `24-ACV-01-UAT.md` present with a complete reproducible procedure for BOTH clones IN ORDER, exact SHAs (818e9ae / 9e3528f), pack -> ng add -> plant -> ng run -> assert -> clean steps, marked manual/local. Clones are UNCOMMITTED by design (D-02) -> surfaced as a human item, NOT a gap. |
| 2 | ACV-02: the full flow is proven against a freshly SCAFFOLDED workspace; planted app+spec+library errors each surface, each per-project target catches exactly its own leaves. | ✓ VERIFIED | `e2e/angular-typechecker-ng-cli-e2e/` exists (Nx-discoverable, tags `scope:fixture`+`type:e2e`, `e2e`+`typecheck` targets). Committed pinned Ng22 fixture has app `ng-cli-workspace` + lib `my-lib`, neither pre-wired (non-vacuous baseline). `ng-add-ng-run.e2e.spec.ts` (277 lines) asserts distinct per-leaf codes (TS2322/TS2345 app, TS2554 lib), reverse-direction scoping, `not(ERR_REQUIRE_ESM)`, `not(infrastructure error)`. 4-guard contract green (`ci-e2e-coverage-guard.spec.ts` in the 323-test suite). SUMMARY records the real-`ng` run green (94.6s); CI runs it under `--parallel=1`. |
| 3 | ACV-03: unit+integration coverage of the Angular-CLI-vs-Nx differences (tsConfig[] union; angular.json write-fork; builder over BuilderContext; ng-add auto-wire-all; no stray nx.json). | ✓ VERIFIED | The ONE genuine gap (builder over `BuilderContext`) is filled: `builder.integration.spec.ts` (4 tests) runs the builder via `TestingArchitectHost` and is GREEN. WR-01 hardening confirmed non-vacuous -- planted TS2322 + TS2345 actually surface in captured stdout (observed in the live run). Other 4 sub-items audited as covered by Phases 21-23 (24-ADDITIVE-AUDIT guard map). |
| 4 | ACP-02: additive-only is enforced AND audited -- no break to the executor id, the runTypecheck/CoreResult/CoreOptions API (widened only), or existing schemas; v0.3.0 not triggered. | ✓ VERIFIED | `24-ADDITIVE-AUDIT.md` records the git-diff verdict vs `angular-typechecker@0.2.0` (barrel byte-unchanged; executor schema tsConfig oneOf widen-only; new-file additions). `src/index.drift.ts` locks all 5 barrel exports (2 value void-ref + 3 type in a tuple), wired into `tsconfig.drift.json`; `nx typecheck` (drift tsc --noEmit) GREEN. `package.json` version UNCHANGED at 0.2.0. |
| 5 | ACD-01: README `## Angular CLI` section (all enumerated items) + curated CHANGELOG entry in end-user language, no internal ids. | ✓ VERIFIED | README `## Angular CLI` (line 381) covers ng add auto-wire-all, ng generate ...:configuration, ng run <project>:typecheck, tsConfig-array target shape, nx-transitive + `.nx/` + no-caching notes, off-stack `--legacy-peer-deps`; Storybook "not supported" caveat preserved (line 461-463). `angular-cli-docs.spec.ts` (9 tests) locks claims -- GREEN. CHANGELOG `## 0.2.1` prose entry present, no version bump, no tag. No internal ids / email leaks found. |

**Score:** 4/5 truths programmatically verified. Truth 1 (ACV-01) is a documented manual gate surfaced for human execution (its deliverable -- the reproducible UAT procedure -- exists and is complete).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts` | Builder-over-BuilderContext run + parity (ACV-03) | ✓ VERIFIED | 192 lines; 4 tests GREEN; WR-01-hardened (asserts TS2322/TS2345 in captured stdout). |
| `fixtures/builder-context/angular.json` | Resolvable Angular workspace root | ✓ VERIFIED | Declares `builder-context-app` with builder `angular-typechecker:typecheck` + two-element tsConfig. |
| `packages/angular-typechecker/src/index.drift.ts` | Additive-only barrel tripwire (5 exports) | ✓ VERIFIED | Imports/references all 5 exports; wired into tsconfig.drift.json; drift tsc --noEmit GREEN. |
| `.planning/.../24-ADDITIVE-AUDIT.md` | ACP-02 git-diff verdict vs 0.2.0 | ✓ VERIFIED | Per-path verdict + guard cross-check map; disposition: additive-only holds, stays 0.2.x. |
| `packages/angular-typechecker/README.md` (`## Angular CLI`) | End-user Angular CLI section | ✓ VERIFIED | All D-06 items present; Storybook caveat intact. |
| `packages/angular-typechecker/src/angular-cli-docs.spec.ts` | Docs content tripwire | ✓ VERIFIED | 9 tests GREEN; section-unique substrings locked. |
| `CHANGELOG.md` (`## 0.2.1`) | Curated prose entry, no cut | ✓ VERIFIED | Prose-only; no date/link ref (finalized at Release-PR per AGENTS.md). |
| `e2e/angular-typechecker-ng-cli-e2e/project.json` | 4th e2e project (guard-compliant) | ✓ VERIFIED | e2e + typecheck targets + type:e2e tag; guards green. |
| `e2e/.../fixtures/ng-cli-workspace/` | Committed pinned Ng22 app+lib fixture | ✓ VERIFIED | app + library; package-lock.json committed; REGENERATE.md; no node_modules/.npmrc. |
| `e2e/.../src/ng-add-ng-run.e2e.spec.ts` | ng add -> ng run per-project scoping (ACV-02) | ✓ VERIFIED | 277 lines; distinct per-leaf codes, both scoping directions, non-vacuous baseline. |
| `.planning/.../24-ACV-01-UAT.md` | Reproducible real-clone UAT (ACV-01) | ✓ VERIFIED (as procedure) | Both clones by URL+SHA; marked manual/local; result fields pending manual run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tsconfig.drift.json` | `src/index.drift.ts` | `files` array entry | ✓ WIRED | Listed in `files`; compiled by the `typecheck` target's drift `tsc --noEmit` (GREEN). |
| `builder.integration.spec.ts` | `fixtures/builder-context` | TestingArchitectHost workspaceRoot | ✓ WIRED | `join(workspaceRoot,'fixtures','builder-context')`; run scopes there; tests GREEN. |
| `angular-cli-docs.spec.ts` | `README.md` | `readFileSync('../README.md')` + normalized toContain | ✓ WIRED | 9 assertions target section-unique strings; GREEN. |
| `ng-add-ng-run.e2e.spec.ts` | `fixtures/ng-cli-workspace` | cpSync -> tmp -> npm install -> ng add | ✓ WIRED | Fixture resolved via findWorkspaceRoot; SUMMARY records real run green. |
| `project.json` | `nx run-many -t e2e / -t typecheck -p tag:type:e2e` | e2e+typecheck targets + type:e2e tag | ✓ WIRED | Nx-discoverable; ci-e2e-coverage-guard GREEN with 4th project present. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Drift barrel tripwire + all typecheck legs | `npx nx typecheck angular-typechecker --skip-nx-cache` | Successfully ran target typecheck | ✓ PASS |
| Guard + docs tripwire unit suite | `npx nx test angular-typechecker --skip-nx-cache` | 37 files / 323 tests passed (incl. angular-cli-docs 9, storybook-docs 8, surface-regression, schema-parity, ci-e2e-coverage-guard) | ✓ PASS |
| Integration tier (incl. builder over BuilderContext) | `npx nx integration angular-typechecker --skip-nx-cache` | 20 files / 107 tests passed | ✓ PASS |
| Builder integration non-vacuity (WR-01) | `npx vitest run --config .../vitest.integration.config.mts builder.integration` | 4 tests pass; TS2322 + TS2345 observed in output | ✓ PASS |
| package.json version unchanged (ACP-02) | `node -e "require('.../package.json').version"` | 0.2.0 | ✓ PASS |
| ACV-01 real-clone gate (2 clones) | manual (24-ACV-01-UAT.md) | not run -- uncommitted clones | ? SKIP -> human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACV-03 | 24-01 | Unit+integration Angular-CLI-vs-Nx diff coverage | ✓ SATISFIED | builder.integration.spec.ts green + non-vacuous; other 4 sub-items audited as 21-23 coverage. |
| ACP-02 | 24-01 | Additive-only enforced + audited | ✓ SATISFIED | 24-ADDITIVE-AUDIT.md + index.drift.ts tripwire + version 0.2.0 unchanged. |
| ACD-01 | 24-02 | README `## Angular CLI` + CHANGELOG | ✓ SATISFIED | README section + 9-test docs tripwire + 0.2.1 prose entry. |
| ACV-02 | 24-03 | Scaffolded automated e2e, per-project scoping | ✓ SATISFIED | e2e project + committed fixture + spec; guards green; SUMMARY records green run. |
| ACV-01 | 24-03 | Real-clone tarball final gate | ? NEEDS HUMAN | 24-ACV-01-UAT.md procedure present; manual/local by design (uncommitted clones). |

All 5 PLAN-declared requirement IDs (ACV-01, ACV-02, ACV-03, ACP-02, ACD-01) are accounted for and each maps to Phase 24 in REQUIREMENTS.md (all marked Complete). No orphaned requirements: REQUIREMENTS.md maps exactly these 5 IDs to Phase 24.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TBD/FIXME/XXX in phase-new files | - | Clean |
| (none) | - | No work-email / consensus.dk leak in phase docs, README, CHANGELOG | - | Public-repo hygiene OK |

Note: the CHANGELOG `## 0.2.1` entry intentionally omits the date and bottom link reference (code-review IN-03) -- this is the documented work-in-progress state finalized at the human-gated Release-PR cut (AGENTS.md), not a defect.

### Human Verification Required

Two items (both from ACV-01, the milestone-final real-clone gate). Both are documented, reproducible, and manual BY DESIGN (the OSS clones are uncommitted; reproduction is by URL + pinned SHA). Full step-by-step in `24-ACV-01-UAT.md`. See the `human_verification` frontmatter for the exact test/expected/why-human of each.

1. **ngx-leaflet real-clone gate** (app + lib, @818e9ae) -- run first.
2. **realworld-angular real-clone gate** (app-only, @9e3528f) -- run second.

These are a confidence gate ON TOP of the CI-authoritative ACV-02 scaffolded e2e (which IS committed and green). Per the phase design (D-02) and REQUIREMENTS.md, ACV-01 is a manual/local gate -- its absence of an automated test is NOT a phase gap.

### Gaps Summary

No gaps. All committed deliverables exist, are substantive, are wired, and pass their automated checks (unit 323, integration 107, drift typecheck, guard suite -- all green). The additive-only charter holds (version unchanged at 0.2.0; barrel byte-unchanged; only widen-only schema delta). The single non-automated item (ACV-01) is a documented manual gate surfaced for human execution, not a missing artifact. Overall status is `human_needed` solely because the two real-clone UAT executions require a human with a real toolchain; every automatable must-have is VERIFIED.

---

_Verified: 2026-07-11T12:05:00Z_
_Verifier: Claude (gsd-verifier)_
