---
phase: 15-generator-e2e-ci-self-audit-guard
verified: 2026-07-02T08:34:03Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 15: Generator e2e + CI self-audit guard Verification Report

**Phase Goal:** The generator is proven end-to-end against the installed tarball -- a real consumer installs the package, generates the single `typecheck` target on a previously un-wired project, and runs it to a correct multi-leaf walk verdict -- and the CI e2e job can no longer silently skip a project via a forgotten `-p` entry.
**Verified:** 2026-07-02T08:34:03Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

This is a testing + CI-config phase (no production source shipped). "Goal achieved"
means the four proofs EXIST, are GREEN, and are NON-VACUOUS. Each observable truth below
maps to a ROADMAP success criterion and its requirement ID; every artifact was read for
substance (not just existence) and its wiring + non-vacuity independently confirmed.

### Observable Truths

| # | Truth (ROADMAP SC / REQ) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1/GE2E-01: clean tarball install + `nx g configuration` on the un-wired `consumer-generator` yields exactly ONE `typecheck` target (executor `angular-typechecker:typecheck`, tsConfig -> solution `tsconfig.json`) AND `init`-seeded `nx.json` targetDefaults (`cache:true`, `outputs:[]`, `inputs[0]==='default'`) | VERIFIED | `generator-e2e.int.spec.ts:268-296` asserts `Object.keys(targets)===['typecheck']`, executor id, `tsConfig.endsWith('tsconfig.json')` AND not a leaf, and the seeded WALK-02 block. WR-02 before-absent baseline present (`:241-246`, `toBeUndefined()` prior to `nx g`) so "seeded from absent" is non-vacuous. |
| 2 | SC2/GE2E-02: clean run exit 0; lib-leaf (TS2322) + spec-leaf (TS2345) injected errors -> non-zero with BOTH distinct tokens, no `ERR_REQUIRE_ESM`, no `infrastructure error` | VERIFIED | `generator-e2e.int.spec.ts:300-346`. WR-01 fix: TS2322 injected into `consumer-generator.util.ts`, a lib-ONLY file no spec imports (confirmed via `git grep` -- no spec references it), so it uniquely attributes to the lib leaf. TS2345 injected as a spec-body statement (spec-leaf only). Codes are distinct; asserted as full tokens; each injection guarded `.not.toBe(original)`. |
| 3 | SC3/GE2E-03: `nx add`'s init path (`npm install <tarball>` + `nx g angular-typechecker:init`) seeds targetDefaults from ABSENT | VERIFIED | `nx-add-e2e.int.spec.ts:162-203` asserts the key is `undefined` before install/init, then defined with `cache:true`/`outputs:[]`/`inputs[0]==='default'` after the byte-identical internal command. Header documents the `nx add` -> `nx g :init` equivalence. |
| 4 | SC4/GUARD-01: the CI `e2e`-job `-p` list EQUALS the `e2e/*` project set (bidirectional `every`); a forgotten/stale `-p` is a loud, LOCATED failure | VERIFIED | `ci-e2e-coverage-guard.spec.ts`: job-scoped (`/^  e2e:\s*$/` + digit-allowing job-key boundary) line-start `-p` extraction + `readdirSync('e2e')` `.name` enumeration + bidirectional per-element `toContain` with located messages + `toEqual` backstop. Independently replicated: pList == graph == `[cache-e2e, install-e2e, matrix-e2e]`. Deliberate-RED proof (phantom `e2e/phantom-e2e`) recorded in 15-01-SUMMARY with the exact located RED message, then restored to green. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` | GUARD-01 bidirectional set-equality guard | VERIFIED | 121 lines (min 55); contains `extractE2ePList`; read-only (`readFileSync`/`readdirSync`); SDK artifacts+key-links all pass. |
| `e2e/.../src/generator-e2e.int.spec.ts` | GE2E-01 + GE2E-02 | VERIFIED | 351 lines (min 120); contains `consumer-generator:typecheck`; WR-01/WR-02 fixes committed (7cd8139). |
| `e2e/.../src/nx-add-e2e.int.spec.ts` | GE2E-03 | VERIFIED | 208 lines (min 60); contains `angular-typechecker:init`; before-absent baseline present. |
| `e2e/.../fixtures/consumer-generator/tsconfig.json` | solution tsconfig, non-empty references[] | VERIFIED | `references` length 2 -> `./tsconfig.lib.json` + `./tsconfig.spec.json`; `files:[]`, `include:[]`. |
| `e2e/.../fixtures/consumer-generator/nx.json` | namedInputs, NO targetDefaults key (D-02) | VERIFIED | `namedInputs` present; `targetDefaults` block entirely absent -> `init` genuinely seeds from absent. |
| `e2e/.../fixtures/consumer-generator/src/consumer-generator.util.ts` | lib-only leaf source (WR-01) | VERIFIED | Contains the exact `UTIL_ANCHOR_LINE`; included by `tsconfig.lib.json` `src/**/*.ts`; NOT imported by any spec (git grep confirmed). |
| `e2e/.../src/tarball-audit.int.spec.ts` (modified) | D-13: 5 generator paths in REQUIRED_FILES | VERIFIED | `generators.json` + `src/generators/{configuration,init}/{generator.js,schema.json}` appended; leak guards + no-install-scripts guard unchanged. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `ci-e2e-coverage-guard.spec.ts` | `.github/workflows/ci.yml` | job-scoped line-start `-p` extraction | WIRED |
| `ci-e2e-coverage-guard.spec.ts` | `e2e/*/project.json` | `readdirSync('e2e')` + `.name` | WIRED |
| `generator-e2e.int.spec.ts` | `fixtures/consumer-generator` | cpSync + npm install tarball + `nx g configuration` + `nx run` | WIRED |
| `nx-add-e2e.int.spec.ts` | `nx.json targetDefaults` | `nx g angular-typechecker:init` | WIRED |

### Data-Flow Trace (Level 4)

Not applicable in the rendering-component sense. The "data" here is the assertion inputs
(the real `ci.yml`, `e2e/*/project.json`, and the packed tarball). Traced and confirmed
real: (a) GUARD-01 reads the committed `ci.yml` (line 145 `-p` list) + the 3 real
`e2e/*/project.json` `.name`s -- both sides non-empty; (b) the GE2E specs build+pack a
FRESH dist (`nx build --skip-nx-cache` then `npm pack`) and install THAT tarball, so the
proofs flow from the real published artifact, not a stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| GUARD-01 extraction == enumeration today | node replication of `extractE2ePList`/`enumerateE2eProjects` over the live repo | pList == graph == `[cache-e2e, install-e2e, matrix-e2e]`, EQUAL: true | PASS |
| GUARD-01 non-vacuity | inspect both sets | 3 real entries each side (not empty; `-p` regex requires a non-whitespace token) | PASS |
| WR-01 lib isolation | `git grep` for spec imports of util.ts | no spec imports the lib-only file | PASS |
| Full plugin suite (incl. GUARD-01) | `npx nx test angular-typechecker` (orchestrator-run) | 32 files / 239 tests GREEN | PASS |
| Heavy install-e2e suite | `npx nx test angular-typechecker-install-e2e --skip-nx-cache` (orchestrator-run) | 5 files / 26 tests GREEN | PASS |
| Plugin build | `npx nx build angular-typechecker` (orchestrator-run) | exit 0 | PASS |

Heavy e2e (multi-minute pack/install) not re-run by the verifier per instruction; the
orchestrator's green observations were cross-checked against the specs' non-vacuity by
reading each assertion.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| GE2E-01 | 15-02 | install + `nx g configuration` -> assert project.json + init-seeded targetDefaults | SATISFIED | Truth 1 |
| GE2E-02 | 15-02 | `nx run :typecheck` clean success + two-leaf injection verdict | SATISFIED | Truth 2 |
| GE2E-03 | 15-02 | `nx add` init path seeds targetDefaults on install | SATISFIED | Truth 3 |
| GUARD-01 | 15-01 | `e2e`-job `-p` list == `e2e/*` set (bidirectional) | SATISFIED | Truth 4 |

All 4 phase requirement IDs accounted for; REQUIREMENTS.md maps exactly these 4 to Phase 15
(no orphaned requirements). Out-of-scope items (FSTREE-01, GEN-FUT-01/02, WALK-FUT-01, the
0.1.0 version cut) are explicitly deferred/future and correctly NOT part of this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | - | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any phase-modified file | - | Clean |

Fixture hardcoded label is intentional clean test data (the committed-green anchor), not a
stub. Working tree carries no stray phase artifacts (only unrelated `.planning/config.json`
is modified; the WR-01/WR-02 fixes landed in commits 7cd8139 + 6aff6df).

### Code-Review Follow-Through

15-REVIEW.md reported 0 BLOCKER, 2 WARNING, 1 INFO. Both warnings are FIXED and committed:
- **WR-01** (lib-leaf TS2322 leaked across the spec import graph): fixed by moving the lib
  injection to `consumer-generator.util.ts`, a lib-only file no spec imports -- independently
  confirmed via git grep. TS2322 now uniquely attributes to the lib reference.
- **WR-02** (missing before-absent baseline in generator-e2e): fixed -- the spec now asserts
  `targetDefaults['angular-typechecker:typecheck']` is `undefined` before `nx g` (`:241-246`).
- **IN-01** (GUARD-01 `-p` extraction coupled to the folded-scalar form): informational;
  fails SAFE (loud error / false-RED, never a false-PASS). Accepted.

### Human Verification Required

None. This phase's deliverables are automated proofs that already run GREEN; there is no
visual, real-time, external-service, or UX surface requiring human confirmation. Both PLANs
declare only `<automated>` verify blocks (no deferred `<human-check>` items).

### Gaps Summary

No gaps. All four observable truths are VERIFIED against the committed test files, fixture,
and guard spec: the artifacts exist, are substantive (line counts, non-vacuous assertions
with before-absent baselines and distinct full-token codes), are wired (SDK key-links +
manual trace), and the proofs are GREEN. GUARD-01's non-vacuity and RED-on-drift behavior
were independently replicated and recorded. The phase goal is achieved.

---

_Verified: 2026-07-02T08:34:03Z_
_Verifier: Claude (gsd-verifier)_
