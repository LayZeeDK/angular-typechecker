---
spike: 001
name: reference-walk-aggregation
type: standard
validates: "Given a solution tsconfig.json referencing tsconfig.lib.json + tsconfig.spec.json that share a source file, when the engine runs performCompilation per leaf and unions+dedupes the diagnostics by identity (file+start+length+code+message), then the aggregated set is complete and duplicate-free with correct errorCount/warningCount"
verdict: VALIDATED
related: [002, 003, 004]
tags: [aggregation, dedupe, counts, engine]
---

# Spike 001: reference-walk-aggregation

## What This Validates

**Given** a solution `tsconfig.json` (`files: []`, `references: [tsconfig.lib.json, tsconfig.spec.json]`)
whose two leaves share a source file (`widget.component.ts` is a rootName of the lib leaf and
is pulled into the spec leaf's program by the spec's `import './widget.component'`),
**when** the engine resolves the leaves from `parsed.projectReferences`, runs
`performCompilation` per leaf with the real emit-neutralizing override + `gatherAllDiagnostics`,
unions the raw diagnostics, and runs the real `finalize` pipeline (boundary-filter -> sort ->
`ts.sortAndDeduplicateDiagnostics` -> explicit category counts) over the union,
**then** the aggregated set is COMPLETE (exact set-union of what each leaf reports; the
spec-only error is present), DUPLICATE-FREE (the shared-source overlap collapses to one), and
`errorCount`/`warningCount` are correct (no double-count). [Objective 1, Q2]

This is the make-or-break gate for the whole idea: if diagnostics from two separate `Program`
objects could not be deduped by value, the reference-walk would double-report every shared
source and the idea would be NO-GO.

## Research

### Docs / source checked

- **`ts.sortAndDeduplicateDiagnostics` semantics (typescript@6.0.3, `node_modules/typescript/lib/typescript.js`).**
  It is `sortAndDeduplicate(diagnostics, compareDiagnostics, diagnosticsEqualityComparer)`.
  The equality comparer is:
  ```js
  function getDiagnosticFilePath(d) { return d.file ? d.file.path : void 0; } // a STRING
  function diagnosticsEqualityComparer(d1, d2) {
    return compareStringsCaseSensitive(getDiagnosticFilePath(d1), getDiagnosticFilePath(d2)) === 0
      && compareValues(d1.start, d2.start) === 0
      && compareValues(d1.length, d2.length) === 0
      && code1 === code2
      && messageTextEqualityComparer(msg1, msg2);
  }
  ```
  It keys on `diagnostic.file.path` (the canonical **Path string**), never the `SourceFile`
  **object**. So two diagnostics from two different `performCompilation` runs collapse iff their
  `(file.path, start, length, code, messageText)` tuples match. This is EXACTLY the identity the
  idea specifies -- the engine's existing `finalize` already implements it; the only change the
  real feature needs is to run one `finalize` over the UNION of leaves instead of per single leaf.

- **Reference resolution.** `ng.readConfiguration(solution)` populates `parsed.projectReferences`
  (the same field the shipped `synthesizeZeroRootNamesDiagnostic` already inspects via
  `.length`). Each `ref.path` resolves to an absolute path; if it names a directory, append
  `tsconfig.json` (mirrors `ts.resolveProjectReferencePath`).

### Approach

| Approach | Mechanism | Pros | Cons | Status |
|----------|-----------|------|------|--------|
| Union raw, single finalize | union all leaves' raw gathered diagnostics, then ONE boundary-filter + `sortAndDeduplicate` + count over the union | reuses `filter-diagnostics` + counting UNCHANGED; dedupes cross-leaf overlap in one place; project-dir basePath covers all leaves (they live under `<project>/`) | pre-dedup union is larger (more to sort) -- negligible | **CHOSEN** |
| Per-leaf finalize then merge results | finalize each leaf, then merge + re-dedupe the CoreResults | keeps per-leaf reports | re-implements a second dedupe/merge layer on top of the per-leaf ones; count reconciliation is fiddly | rejected |

**Chosen:** union raw -> single `finalize`. It is the minimal delta over today's engine.

## How to Run

```
node .planning/spikes/001-reference-walk-aggregation/harness.mjs
```

Exits 0 on all-pass, 1 on any failed assertion. Writes `forensic-log.json` next to the harness.

## What to Expect

- 2 leaves resolved from the solution's `references[]`.
- Aggregated (walk) result: `err=2 warn=2 suppressed=0`, exactly 4 reported diagnostics after
  dedupe (down from 11 in-project pre-dedupe -- 7 collapsed).
- The 4 reported: `Error 2322` (widget.component.spec.ts, spec-only), `Warning NG8117` +
  `Warning NG8109` (widget.component.ts template), `Error 2322` (widget.component.ts).
- Shared-file evidence: `differentObjects: true, samePath: true, sameFileName: true`.
- All 7 assertions PASS; `VERDICT: VALIDATED`.

## Observability

`forensic-log.json` records: environment (node/ts/compiler-cli), resolved references, per-leaf
report (rootNames, err/warn, identities, parse/compile ms), union counters
(rawUnion / inProjectPreDedup / reported / duplicatesCollapsed / suppressed / err / warn), the
shared-file cross-Program object evidence, the full reported set, and every assertion's pass/detail.

## Investigation Trail

1. **Static source verification first.** Before building, read `ts.sortAndDeduplicateDiagnostics`'
   comparators in the real TS 6.0.3 bundle to confirm dedupe keys on `file.path` (string), not
   the `SourceFile` object. Confirmed -- cross-`Program` value-dedupe is theoretically sound.
2. **Hermetic fixture.** Built a solution `tsconfig.json` -> `tsconfig.lib.json` (`include src/**/*.ts`,
   `exclude **/*.spec.ts`) + `tsconfig.spec.json` (`include src/**/*.spec.ts`). `widget.component.ts`
   (TS2322 + an un-invoked-signal interpolation) is the shared source; `widget.component.spec.ts`
   imports it and carries its own unique TS2322. A clean `@spike/dep` path-mapped dep is present
   for reuse by 002/003. Did NOT touch `libs/typecheck-consumer*`.
3. **First run -> 6/7 PASS, 1 FAIL.** All aggregation mechanics passed. The lone failure was the
   COUNT expectation: I predicted 1 warning; the compiler produced 2.
4. **SURPRISE, isolated and explained.** An un-invoked signal getter inside a **text interpolation**
   (`{{ status }}`) co-fires TWO extended warnings, not one: **NG8117**
   (`Function in text interpolation should be invoked`) AND **NG8109**
   (`... is a function and should be invoked`). Both are legitimate; both appear in BOTH leaves
   (widget is compiled in each); both dedupe correctly. The engine was right; my by-hand
   expectation was wrong.
5. **Pinned the exact deduped multiset.** Corrected the expectation to `errorCount 2 / warningCount 2`
   and added a strict `code+category` multiset assertion
   (`["Error:2322","Error:2322","Warning:-998109","Warning:-998117"]`). Re-run: 7/7 PASS.

## Results

**VERDICT: VALIDATED.**

- **Cross-`Program` value-dedupe works (B3).** The shared `widget.component.ts` is a DIFFERENT
  `SourceFile` object in the lib program vs the spec program (`differentObjects: true`) but has the
  IDENTICAL canonical `.path` and `.fileName`. `ts.sortAndDeduplicateDiagnostics` over the union
  collapses the overlap by value -- an object-identity dedupe would have failed here. This is the
  single fact the idea most depended on, and it holds against the real compiler.
- **Completeness holds (A1/A2/A3).** The aggregated set is the exact set-union of the per-leaf
  reports -- nothing lost, nothing phantom -- and the spec-only TS2322 (reachable ONLY through the
  spec leaf; a build never compiles specs) is present. This is the named differentiator vs a build
  check, now proven at the aggregation layer.
- **Dedupe is real and load-bearing (B1/B2).** 11 in-project diagnostics pre-dedupe collapse to 4;
  the reported set has zero duplicates. The overlap the walk must handle is not hypothetical -- it
  is 7 diagnostics here (the unconditional all-getter gathers each NG diagnostic multiple times
  even within one leaf, so the dedupe already earns its keep today; the walk just widens its input).
- **Counts are correct on the deduped set (C1).** `errorCount`/`warningCount` are counted
  explicitly by category on the POST-dedupe `reported` set -- the D-01 invariant carries forward
  to the union with no change.

**Surprise captured:** un-invoked signal in a text interpolation co-fires NG8117 + NG8109 (relevant
to any future catalog/count assertions that use interpolated signals).

**Impact on remaining spikes:** the aggregation design (union raw -> single `finalize` over the
union, project-dir basePath) is proven and becomes the substrate for 002 (boundary guard operates
at reference-resolution, above this), 003 (the double-compile cost is measured on this exact
per-leaf compile path), and 004 (the D-03a split gates whether we reach this walk at all). No pivot
needed. GO on Objective 1 / Q2.
