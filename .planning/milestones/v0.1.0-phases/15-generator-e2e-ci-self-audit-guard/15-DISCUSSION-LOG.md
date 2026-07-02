# Phase 15: Generator e2e + CI self-audit guard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 15-generator-e2e-ci-self-audit-guard
**Mode:** `--analyze --auto --chain` (autonomous; recommended option auto-selected per area; trade-off tables logged here for the audit trail)
**Areas discussed:** New consumer fixture shape (GA-1), E2E harness + scenario flow (GA-2), nx add e2e (GA-3), Test-file organization (GA-4), GUARD-01 mechanics (GA-5)

**Auto-lock discipline:** Each area rated IMPACT x CONFIDENCE. This is the milestone's FINAL phase (no downstream phase inherits these choices) and every artifact is a reversible internal test/fixture, so nothing is HIGH-impact -> the trap quadrant (HIGH-impact + NOT-high-confidence) is empty; no BLOCKER recorded. Two residual-uncertainty items (GUARD-01 enumeration source; tarball-audit extension) are auto-locked with RESEARCH-VERIFY / discretion flags -- verifiable engineering facts, not user preferences.

---

## GA-1: New consumer fixture shape (GE2E-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Purpose-built multi-leaf solution fixture (new `consumer-generator/` library; solution `tsconfig.json` -> `tsconfig.lib.json` + `tsconfig.spec.json`; `nx.json` WITHOUT the targetDefaults key) | Clean init-seeds-fresh semantics; correct `default`-input walk of the spec leaf; `consumer-app` untouched | ✓ |
| Add a 2nd project to the existing `consumer-app` workspace | Reuses the smoke workspace, but `consumer-app/nx.json` pre-declares the targetDefaults key with `production` inputs -> `init`'s `??=` don't-clobber SKIPS seeding (vacuous GE2E-01 assertion) AND `production` under-hashes the walked spec leaf (stale-PASS risk masking GE2E-02) | |

**Auto-selected:** Purpose-built multi-leaf solution fixture (D-01/D-02).
**IMPACT:** MEDIUM (test fixture; reversible -- but a subtle correctness trap: the `production`-vs-`default` WALK-02 landmine + the don't-clobber-requires-absent-key interaction). **CONFIDENCE:** HIGH.
**Notes:** The generator's Phase 14 D-07 case (2) resolves a solution `tsconfig.json` with a non-empty `references[]` to the ONE target and relies on WALK-01 to walk lib + spec. The fixture must match that shape AND omit the pre-seeded targetDefaults so `init` genuinely writes it. Landmine flagged for the planner.

---

## GA-2: E2E harness + scenario flow (GE2E-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the `install-smoke` harness verbatim (buildCleanEnv, beforeAll build+pack, tmp-install with empty `.npmrc`, execSync-catch verdict) | Proven, honest (no peer override), sequential main-tree, inherits the serialized vitest config | ✓ |
| Author a new bespoke harness | Redundant; risks diverging from the proven NX_*-strip + peer-honesty discipline | |

**Auto-selected:** Reuse the established harness (D-03/D-04/D-05).
**IMPACT:** LOW. **CONFIDENCE:** HIGH.
**Notes:** Flow = generate -> assert project.json + nx.json -> clean run exit 0 -> inject a code in BOTH the lib leaf AND the spec leaf -> broken run non-zero with both codes visible (two-leaf-walked proof) + no `ERR_REQUIRE_ESM` / `infrastructure error`. Full-token code assertions (IN-02).

---

## GA-3: nx add e2e (GE2E-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct scenario, same tmp-install harness; assert seeded targetDefaults after the add-time init runs | Proves GEN-09 end-to-end on install | ✓ |
| Fold into the smoke test | Conflates concerns; the add-time init path deserves its own located assertion | |

**Auto-selected:** Distinct scenario (D-06) with a carried-forward **RESEARCH-VERIFY**.
**IMPACT:** MEDIUM. **CONFIDENCE:** MEDIUM-HIGH (the assertion is invariant; the exact `nx add` invocation against an INSTALLED tarball is the verifiable-fact residual).
**Notes:** Phase 14 registered `init` by literal key, no `ng-add` alias. The researcher must confirm the exact testable `nx add` invocation for an e2e against a local tarball / already-installed package (or install-then-`nx g angular-typechecker:init` as the stand-in for the add-time init). Do NOT ship an Angular-CLI `ng add` surface.

---

## GA-4: Test-file organization

| Option | Description | Selected |
|--------|-------------|----------|
| New `*.int.spec.ts` files inside `angular-typechecker-install-e2e/src/` (no new nx project) | Board-locked (no Verdaccio, no new e2e project); matches the per-concern one-file convention; auto-included by the glob | ✓ |
| A new nx e2e project | Board-rejected (fragility/no-gain) | |

**Auto-selected:** New spec files in `install-e2e/src/` (D-07); share one packed tarball where practical (D-08, planner discretion).
**IMPACT:** LOW. **CONFIDENCE:** HIGH.

---

## GA-5: GUARD-01 mechanics (placement, enumeration, ci.yml parse)

| Option | Description | Selected |
|--------|-------------|----------|
| In-plugin fast spec (6-cell `test` matrix); glob `e2e/*/project.json` for the graph set; regex-parse the `e2e:` job `-p` list (no YAML dep); bidirectional set-equality (`every`) + deliberate-RED proof | Loudest/earliest signal on every cell; cheap; matches the `release-hygiene` no-YAML-parser precedent | ✓ |
| Place in the heavy Linux-only e2e gate | Slower, single-cell signal; unnecessary for an fs/text check | |
| Source the authoritative nx graph (`nx show projects` / graph JSON) instead of a glob | More authoritative but heavier / daemon-coupled; only needed if an e2e project could live outside `e2e/` (none do today) | RESEARCH-VERIFY |

**Auto-selected:** In-plugin fast spec + glob enumeration + regex ci.yml parse + bidirectional `every` set-equality (D-09/D-10/D-11) with a MANDATORY deliberate-RED proof (D-12).
**IMPACT:** MEDIUM (the phase's marquee self-audit; a silent false-PASS would defeat it -- hence the mandatory RED proof -- but it is a reversible internal test). **CONFIDENCE:** MEDIUM-HIGH.
**Notes:** RESEARCH-VERIFY the glob-vs-authoritative-graph enumeration and the robust extraction of the `-p` args from the folded (`>`) `run:` scalar. Today the `-p` list and the `e2e/*` set match exactly (3 projects), so the guard codifies the current-correct state.

---

## Claude's Discretion

- **D-13 -- Extend `tarball-audit` `REQUIRED_FILES` for the shipped generators** (`generators.json` + generator schema/impl). Phase-14-flagged completeness item, BEYOND the 4 named requirements (the GE2E scenarios already prove shipment empirically). Planner MAY include as a small static gate or drop to stay minimal. LOW impact.
- **D-14 -- Fixture/component/spec names + the specific injected diagnostic codes** (two distinct, individually-assertable codes -- one per leaf), and template-bearing-component vs plain-class for the lib leaf. Planner's choice within the stated invariants (non-empty `references[]`; absent targetDefaults key).

## Deferred Ideas

None newly surfaced -- all already tracked (FSTREE-01; GEN-FUT-01/02; WALK-FUT-01; the 0.1.0 Release PR is the post-phase milestone cut, not this phase).
