---
phase: 18-packaged-tarball-e2e-docs
verified: 2026-07-06T14:08:18Z
status: passed
score: 4/4 must-haves verified (code + runtime); criterion-1 e2e independently re-run green by the orchestrator
overrides_applied: 0
runtime_verification_resolved:
  - item: "Packaged-tarball Storybook e2e (criterion 1) shipped-artifact runtime pass."
    resolution: "The orchestrator independently re-ran `npx nx test angular-typechecker-install-e2e` (2026-07-06, Windows dev tree, Verdaccio + real `@storybook/angular@10.4.6` force-install): 9 of 10 spec files pass, 33 of 34 tests pass. `storybook-tarball.int.spec.ts` (both Layout A + Layout B `it` blocks) is among the 9 passing files. This confirms the shipped tarball installs via `nx add` (no peer override, B-03) and its `nx typecheck` catches the planted story errors. The verifier's `human_needed` was solely a spot-check-budget deferral of this service-heavy run, now discharged."
  - item: "`nx-add-yarn.int.spec.ts` ECONNREFUSED classification."
    resolution: "Confirmed to be the documented local-only corepack-yarn-4 + local-Verdaccio fetch flake -- it is the SOLE failing spec in the re-run, isolated to its own tmp workspace, referencing none of the Phase-18 fixtures. Per AGENTS.md the CI e2e gate is Linux-only; not counted as a Phase-18 gap (tracked in deferred-items.md)."
---

# Phase 18: Packaged-tarball e2e + docs Verification Report

**Phase Goal:** The SHIPPED artifact (not just the local build) is proven to catch a planted story type error via `nx typecheck` on generator-scaffolded Storybook fixtures, and the README/changelog state the exact coverage claim and caveats.
**Verified:** 2026-07-06T14:08:18Z (initial); criterion-1 runtime re-confirmed 2026-07-06 by orchestrator
**Status:** passed
**Re-verification:** The initial verification returned `human_needed` solely because the service-heavy criterion-1 e2e exceeded the verifier's spot-check budget. The orchestrator then independently re-ran `npx nx test angular-typechecker-install-e2e`: `storybook-tarball.int.spec.ts` (Layout A + B) passed (33/34 install-e2e tests; sole failure is the documented local-only `nx-add-yarn` corepack ECONNREFUSED). Status upgraded to `passed`.

## Goal Achievement

### Observable Truths

| # | Truth (success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Packaged tarball catches a planted `*.stories.ts` error on Layout A + B via `nx add` + `nx g angular-typechecker:configuration` + `nx typecheck` | VERIFIED (code) / human-verify (runtime) | `storybook-tarball.int.spec.ts` committed (bdcbb75, 272 lines), substantive: asserts clean baseline exit 0; planted TS2322 (A) and TS2345 + external-template NG8002 (B) give non-zero exit with the distinct tokens; `not.toMatch(/ERR_REQUIRE_ESM/)`; `not.toContain('infrastructure error')`; Storybook force-installed `--legacy-peer-deps` in a SEPARATE step; angular-typechecker installed via Verdaccio `nx add` with NO peer override (B-03). Fixtures `consumer-storybook-a` + `consumer-storybook-b` committed with correct injection anchors, no committed `node_modules`. Engine exercised by the e2e is green (`nx test` + `nx build`). **Runtime e2e pass routed to CI/human** (see human_verification). |
| 2 | A workspace `paths`-aliased aggregated import compiles clean (no spurious TS2307) | VERIFIED | `paths-alias.integration.spec.ts` asserts `result.diagnostics.every(d => d.code !== 2307)` + `outcome === 'clean'` + `rootNamesCount > 0`. Fixture alias is load-bearing (`@org/*` -> `../../layout-b-paths-alias-lib/*` in `.storybook/tsconfig.json`, resolves only via `paths`). Passes in the green `nx test` run. |
| 3 | `.mdx` (never checked) and `.tsx`-without-`jsx` gaps emit a loud "not type-checked" notice (verdict stays green) | VERIFIED | Net-new `CoreResult.notTypeCheckedDeclaredFiles` (run-typecheck 6 refs, walk 4 refs); pure `detect-unchecked-declared.ts` (`detectTsxWithoutJsx` + `detectUncheckedDeclaredFiles`, core-pure); executor `logger.warn` gated on `result.notTypeCheckedDeclaredFiles?.length`; `not-type-checked.integration.spec.ts` proves the notice fires (incl. real `.mdx` enumeration) with a CLEAN verdict; negative test in `evaluate-result.spec.ts` proves the field does NOT flip the verdict (evaluate-result.ts ref count = 0). Core purity confirmed. All green. |
| 4 | README + changelog carry the exact MUST/MUST-NOT/caveat coverage statement and the false-pass -> true-fail (green->red) callout | VERIFIED | README `## Storybook` section: exact MUST claim ("SOLUTION `tsconfig.json`", "green verdict means every such file type-checked clean"), MUST-NOT (reworded so no forbidden substring; grep for "complete storybook coverage" / "all storybook files" returns 0), all caveats (`.mdx`, `.tsx`-jsx, external templateUrl branch 4a, Layout C, leaf-tsconfig, force-install/`ERR_PNPM_IGNORED_BUILDS`, SB10 `.d.ts` suppression). WR-01 Limitations fix present (zero-root-names leaf -> coverage-incomplete). CoreResult comment includes `notTypeCheckedDeclaredFiles`. CHANGELOG `## 0.1.2` section with a blockquote green->red callout. D-05 honored (see below). WR-01 todo moved to `resolved/`. |

**Score:** 4/4 truths' code artifacts verified. Truth 1's shipped-tarball RUNTIME confirmation is routed to human/CI (per Step 9, a non-empty human-verification section takes priority over `passed`).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `e2e/.../src/storybook-tarball.int.spec.ts` | Criterion 1 proof (both layouts) | VERIFIED | Committed bdcbb75; substantive assertions confirmed |
| `e2e/.../fixtures/consumer-storybook-a/**` | Layout-A generator-shaped consumer | VERIFIED | 9 files, project.json + .storybook + clean story anchor, no node_modules |
| `e2e/.../fixtures/consumer-storybook-b/**` | Layout-B centralized host + external template | VERIFIED | host references only `./.storybook/tsconfig.json`; aggregated sibling `aggregated-ui/` with external `card.component.html` + `card.stories.ts` anchors |
| `src/core/paths-alias.integration.spec.ts` (+ fixtures) | Criterion 2 (T9) | VERIFIED | asserts `code !== 2307` + clean; load-bearing alias |
| `src/core/detect-unchecked-declared.ts` | Pure D-01 detector | VERIFIED | core-pure; `ScriptKind.Deferred` fix present (cd6cc6a) |
| `src/core/run-typecheck.ts` + `walk-references.ts` | `notTypeCheckedDeclaredFiles` on both engine paths | VERIFIED | field decl + walk spread + direct spread; walk aggregation |
| `src/executors/typecheck/executor.ts` | Loud `logger.warn` render | VERIFIED | one block gated on `?.length`, after suppressedInGraph, before renderReport |
| `src/core/not-type-checked.integration.spec.ts` | Criterion 3 integration proof | VERIFIED | notice fires (incl. `.mdx`) + clean verdict; negative control |
| `src/core/evaluate-result.spec.ts` | Negative verdict-lock test | VERIFIED | field non-empty + errorCount 0 -> clean (incl. maxWarnings 0) |
| `src/core/story-less-guard.integration.spec.ts` (T6) | No silent clean pass | VERIFIED | 90001 guard + `success === false` |
| `src/core/layout-b.integration.spec.ts` (T10) | No 90001 on host-story-error | VERIFIED | `code !== 90001` assertion added |
| `README.md` `## Storybook` + Limitations + CoreResult | Criterion 4 (SB-07) | VERIFIED | section, WR-01 fix, CoreResult comment all present |
| `CHANGELOG.md` `## 0.1.2` | Criterion 4 green->red callout | VERIFIED | blockquote behavior-change callout + `[0.1.2]` ref-link |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| storybook-tarball spec | shipped tarball | `nx add angular-typechecker` (Verdaccio, no override) | WIRED | install helper step (2) |
| storybook-tarball spec | `@storybook/angular@10.4.6` | separate `--legacy-peer-deps` step | WIRED | install helper step (3), B-03 preserved |
| run-typecheck.ts / walk-references.ts | detect-unchecked-declared.ts | `detectUncheckedDeclaredFiles` | WIRED | both engine paths |
| executor.ts | `result.notTypeCheckedDeclaredFiles` | `?.length` gate before renderReport | WIRED | one logger.warn |
| README.md | board CONSENSUS.md | verbatim `SOLUTION tsconfig` claim | WIRED | exact MUST claim present |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Shipped engine tree green (unit + integration; covers criteria 2/3) | `npx nx test angular-typechecker --skip-nx-cache` | 44 files, 323 tests passed | PASS |
| Build succeeds (vendored-type drift guard) | `npx nx build angular-typechecker --skip-nx-cache` | Successfully ran build (exit 0) | PASS |
| Lint clean (maxWarnings:0) | `npx nx lint angular-typechecker --skip-nx-cache` | Successfully ran lint (exit 0) | PASS |
| Format clean on touched files | `npx prettier --check <touched>` | All matched files use Prettier code style | PASS |
| Criterion-1 shipped-tarball e2e | `npx nx test angular-typechecker-install-e2e` (orchestrator re-run) | `storybook-tarball` Layout A + B pass; 33/34 install-e2e tests pass (sole failure = documented local-only `nx-add-yarn` corepack ECONNREFUSED) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SB-06 | 18-01, 18-02, 18-03, 18-04 | Negative-test acceptance gate + T1-T11 matrix + packaged-tarball e2e | SATISFIED (in-repo) / human-verify (e2e runtime) | All in-repo tiers green (nx test 323 passed); criterion-1 e2e artifacts present + substantive; runtime pass routed to CI/human. REQUIREMENTS.md still `[ ]` (closes at phase verification / milestone audit) |
| SB-07 | 18-05 | README + changelog exact coverage claim + green->red callout | SATISFIED | README `## Storybook` + Limitations WR-01 fix + CoreResult comment; CHANGELOG `## 0.1.2` green->red callout; REQUIREMENTS.md marked `[x]` |

No orphaned requirements: REQUIREMENTS.md traceability maps SB-06 + SB-07 to Phase 18, both claimed by the plans. SB-08 is correctly deferred to Phase 19.

### D-05 (no release cut) verification

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| `packages/angular-typechecker/package.json` version | UNCHANGED (0.1.1) | `0.1.1` | PASS |
| `angular-typechecker@0.1.2` git tag | ABSENT | not present (`git tag -l` empty) | PASS |

Phase 18 authored prose only; no `nx release`, no version bump, no tag. Honored.

### Anti-Patterns Found

None. No unreferenced `TBD`/`FIXME`/`XXX` debt markers in touched files. Core-purity `console`/`process` scan under `src/core/**` returned only documentation-comment matches (explaining the purity discipline), zero runtime calls; `detect-unchecked-declared.ts` is clean. No stub/placeholder patterns; the `notTypeCheckedDeclaredFiles` field is deliberately kept out of `evaluate-result.ts` (verified count = 0) and that omission is a locked design tripwire, not a gap.

### Human Verification Required — RESOLVED by orchestrator re-run

Both items the initial verification routed to human/CI were discharged by the orchestrator independently re-running the e2e (2026-07-06):

1. **Packaged-tarball Storybook e2e (criterion 1) — RESOLVED / PASS.** `npx nx test angular-typechecker-install-e2e` re-run: `storybook-tarball.int.spec.ts` Layout A + B `it` blocks pass (among 9/10 passing spec files, 33/34 tests). The shipped tarball installs via `nx add` (no peer override) and its `nx typecheck` catches the planted Layout-A `TS2322` and Layout-B `TS2345` + external-template `NG8002`; no `ERR_REQUIRE_ESM`, no infrastructure error.
2. **`nx-add-yarn` ECONNREFUSED — RESOLVED / classified.** It is the SOLE failing spec in the re-run — the documented local-only corepack-yarn-4 + local-Verdaccio fetch flake, isolated to its own tmp workspace. CI e2e is Linux-only (AGENTS.md); not a Phase-18 gap (tracked in `deferred-items.md`).

Remaining CI confirmation is a formality — the same specs run in the Linux CI e2e gate on the Release PR.

### Gaps Summary

No blocking gaps. All four success criteria are present, substantive, wired, and covered green: the in-repo suite (`nx test` 44 files / 323 tests, `nx build` exit 0, `nx lint` clean, prettier clean) AND the shipped-tarball criterion-1 e2e (`storybook-tarball.int.spec.ts` Layout A + B pass in the orchestrator's `nx test angular-typechecker-install-e2e` re-run). D-05 is honored (version 0.1.1, no 0.1.2 tag). The initial `human_needed` (criterion-1 runtime) has been discharged by that re-run; status upgraded to `passed`. The `nx-add-yarn` ECONNREFUSED is an out-of-scope, documented local-environment flake (sole failing spec; isolated tmp workspace) and is NOT counted as a phase gap.

---

_Verified: 2026-07-06T14:08:18Z_
_Verifier: Claude (gsd-verifier)_
