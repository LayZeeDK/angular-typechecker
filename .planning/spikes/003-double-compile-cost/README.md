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

Authoritative timing (Vitest `bench` -- warmup + samples + p99 + RME):

```
npx vitest bench --config .planning/spikes/003-double-compile-cost/vitest.bench.config.mts --run
```

Assertion-bearing correctness cross-check + tax decomposition (standalone node process,
production-representative absolutes):

```
node .planning/spikes/003-double-compile-cost/harness.mjs
```

The node harness exits 0 on all-pass and writes `forensic-log.json` (medians, mins, tax
decomposition, deferred synergy). Two runners are kept ON PURPOSE: Vitest `bench` gives standardized
statistics but its absolute ms are inflated ~2.5x by the vite/vitest pool instrumentation; the
standalone node process gives cleaner production-representative absolutes. They AGREE on the ratio.

## What to Expect (this machine: Windows arm64, node 24.18, ts 6.0.3, compiler-cli 22.0.4)

**Vitest `bench` (authoritative statistics, 12 samples + 3 warmup):**

```
name                             hz       min       max      mean      p99      rme  samples
floor (1 trivial component)  1.0272    507.91  1,775.32    973.50  1,775.32  ±22.10%   12
lib leaf                     1.0476    712.88  1,199.45    954.54  1,199.45  ±11.00%   12
spec leaf                    1.0685    726.97  1,136.34    935.85  1,136.34   ±7.48%   12
dep-only                     0.9911    828.79  1,181.92  1,009.00  1,181.92   ±6.29%   12
combined (single program)    1.1361    757.92  1,016.70    880.23  1,016.70   ±6.76%   12
WALK (lib + spec)            0.5536  1,519.34  1,962.81  1,806.22  1,962.81   ±4.86%   12
```
Summary: combined (single program) is **2.05x faster than WALK (lib + spec)** -> tax ~105%. floor
(973) ~ lib (954) ~ spec (936) ~ dep-only (1009): per-compile time is fixed-overhead-dominated;
content barely moves it. (Absolute ms are ~2.5x the node-harness numbers below -- vite/vitest pool
instrumentation overhead -- so read the RATIO, not the ms.)

**Standalone node harness (production-representative absolutes, median of 7):**

| Measurement | Median ms | Note |
|-------------|-----------|------|
| fixed floor (1 trivial component) | ~356 | pure per-compile overhead |
| lib leaf | ~379 | |
| spec leaf | ~383 | |
| dep-only | ~385 | dep MARGINAL = ~30 ms above floor |
| combined (1 program, lib+spec) | ~390 | the single-program lower bound |
| **WALK (lib + spec)** | **~762** | two full compiles |
| **redundancy tax** | **~373 (95.7%)** | walk - combined |

Both runners agree: **WALK ≈ 2x a single combined program** (vitest 2.05x / node 1.96x). All 3
node-harness validity assertions PASS; `VERDICT: VALIDATED`.

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
4. **Re-measured with Vitest `bench`** (`benchmark.bench.mts` + `vitest.bench.config.mts`, per the
   maintainer's request) for standardized statistics (samples, p99, RME). It independently confirms
   the ratio -- combined is 2.05x faster than the WALK, and floor/lib/spec/dep-only cluster together
   -- validating the node-harness conclusion with a second, industry-standard measurement path. The
   vitest absolutes run ~2.5x higher (pool instrumentation), so the ms are not production-representative
   but the ratio is the durable signal.

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
