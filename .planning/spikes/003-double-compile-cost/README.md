---
spike: 003
name: double-compile-cost
type: benchmark
validates: "Given a local non-buildable lib dep whose source is pulled into the lib + spec leaves, when compiled once per leaf under the reference-walk, then the double-compile wall-clock cost is measured and characterized; project-references / NgtscProgram incremental declaration-reuse recorded as DEFERRED synergy"
verdict: VALIDATED
related: [001, 005]
tags: [performance, cost, engine]
---

# Spike 003: double-compile-cost [Q1]

## What This Validates

**Given** a local non-buildable lib dep (8 standalone components in `@dep/widgets`) whose SOURCE is
pulled -- via the consumer import chain -- into BOTH the lib leaf and the spec leaf, **when** the
reference-walk runs `performCompilation` once per leaf, **then** the dep is type-checked twice; this
spike measures that double-compile cost and records the incremental-reuse optimization as a DEFERRED
synergy. [Objective 4, Q1]

## Research

The reference-walk does N `performCompilation` calls (one per leaf). A shared local dep source is
re-checked in each leaf that imports it. The question is whether that redundancy is a material
GO/NO-GO cost. Two candidate framings:

- **Absolute ms** -- machine- and scale-dependent; unreliable on a tiny fixture.
- **Ratio + decomposition** -- separate the FIXED per-compile floor (program creation +
  `@angular/core` `.d.ts` load + TCB infra) from the dep's MARGINAL type-check cost, then express the
  walk's tax relative to the single-program lower bound. This is scale-robust.

Chosen: measure a fixed floor (one trivial component), a dep-only leaf, each real leaf, a single
combined program, and the walk; report medians over 7 iterations after warmup; decompose.

## How to Run

```
node .planning/spikes/003-double-compile-cost/harness.mjs
```

Exits 0 on all-pass. Writes `forensic-log.json` (medians, mins, tax decomposition, deferred synergy).

## What to Expect (this machine: Windows arm64, node 24.18, ts 6.0.3, compiler-cli 22.0.4)

| Measurement | Median ms | Note |
|-------------|-----------|------|
| fixed floor (1 trivial component) | ~356 | pure per-compile overhead |
| lib leaf | ~379 | |
| spec leaf | ~383 | |
| dep-only | ~385 | dep MARGINAL = ~30 ms above floor |
| combined (1 program, lib+spec) | ~390 | the single-program lower bound |
| **WALK (lib + spec)** | **~762** | two full compiles |
| **redundancy tax** | **~373 (95.7%)** | walk - combined |

All 3 validity assertions PASS; `VERDICT: VALIDATED`.

## Investigation Trail

1. Built an 8-component dep imported by a thin consumer; the spec imports the consumer, so the dep
   is pulled into both leaf Programs. Confirmed structurally: `dep source files in program: lib=4,
   spec=4` (the dep's 4 `/dep/src/` files present in BOTH).
2. **First run surprise.** lib, spec, dep-only, and combined ALL cost ~380-390 ms -- indistinguishable.
   Compiling *just the dep* cost the same as compiling *everything*. That means the cost is
   fixed-overhead-dominated, and the dep's marginal cost is below the noise floor.
3. **Added a fixed-floor baseline** (one trivial component) to recover the dep marginal by
   subtraction. Floor = ~356 ms; dep-only = ~385 ms -> dep marginal = ~30 ms. The floor is ~92% of a
   dep-only compile. Confirmed: at this scale the double-compile penalty is fixed-overhead-bound,
   not dep-size-bound.

## Results

**VERDICT: VALIDATED (cost measured and characterized).**

- **Per-leaf fixed overhead dominates.** ~356 ms of every ~385 ms compile is fixed
  (`performCompilation` init + `@angular/core` `.d.ts` + TCB infrastructure). The 8-component dep's
  own type-check is only ~30 ms.
- **The walk costs ~one extra full compile per extra leaf.** WALK (762 ms) ≈ 2 × combined (390 ms);
  tax = 373 ms (95.7%). The tax scales with the NUMBER OF LEAVES, essentially independent of dep
  size at this scale (a second program init is the cost, not re-checking the dep).
- **The double-compile of the dep specifically is cheap here (~30 ms), but grows with dep size.**
  At PROJECT.md scale (standalone `ngc --noEmit` ~15 s), the marginal source term dominates and the
  shared-source redundancy becomes material -- that is where the deferred synergy pays off.
- **CRITICAL FRAMING -- the walk adds no compile work vs the multi-target alternative.** Checking N
  leaves costs ~N compiles whether the engine WALKS references behind one target OR the Phase-13
  generator wires N separate targets. The walk's real trade vs multi-target is COARSER caching (one
  target key instead of per-leaf keys -- see Spike 005), not extra compute.

**DEFERRED synergy (recorded, not built):** TypeScript project references + a `NgtscProgram`
per-file incremental migration could compile the dep once and reuse its emitted declarations across
leaves, collapsing the shared-source redundancy toward zero. This is already DEFERRED in PROJECT.md
(the engine uses `performCompilation` Approach A for v0.0.x; `NgtscProgram` per-file migration is a
future milestone). The reference-walk is CORRECT with Approach A today; it is simply not
incrementally optimal, and the optimization is additive later.

**Impact on remaining spikes:** feeds Spike 005 -- the coarse single-target caching is the mechanism
that makes the ~N-compile cost acceptable in a CI/agent loop (a warm cache pays 0). GO on Objective 4
with the incremental-reuse deferral documented.
