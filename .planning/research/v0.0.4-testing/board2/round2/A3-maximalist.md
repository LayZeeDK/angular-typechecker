# A3 -- Maximalist (round 2): CONVERGE on all decisions

Board role: adversarial maximalism / completeness. Mandate: keep probing for correctness
holes that leave a silent false-PASS risk. Round-2 verdict: every decision CONVERGES. No
fact sustains a HOLD; the two places where round-1 maximalism diverged from §D are each
disarmed by a verified fact that meets my OWN round-1 drop-trigger.

## How the reconciliation answers the maximalist mandate

The silent-false-PASS failure mode is the spine of my mandate. §D defends against it on
every axis I raised in round 1:

- **All 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG by exact code +
  `DiagnosticCategory` + count + one promotion case** (D2-scope). This closes the measured
  12.5%-covered headline-feature hole. Verified the machinery is real and sunk:
  `NG()` negative-encoding helper (`diagnostic-codes.ts`), the exact-code + `.category`
  idiom (`extended.angular13.integration.spec.ts:37`), and the promotion fixture
  (`extended.promotion.integration.spec.ts:38`, `defaultCategory: "error"`). Marginal cost
  per code is one fixture + one `it`.
- **Completeness tripwire: catalog rows === the enum, run in `test`** (D2-tripwire). This is
  the fail-CLOSED insurance I demanded against a future Angular major adding an NG8xxx the
  catalog silently misses. Adopted verbatim.
- **skip-with-reason, never silent** (D2). My exact round-1 mind-change handling for any
  member proven untriggerable at v22.0.4. Adopted verbatim.
- **`-p`-list set-equality guard** (D5). Fact A5 confirmed (grep: no such guard exists). This
  closes the round-1 risk-ledger entry "new e2e project without the `-p`-list -> fail-open:
  green-by-omission." §D5 adds exactly this guard. Adopted.
- **D4 runs the generated target with `--skip-nx-cache`**. Proves the generator+executor
  CONTRACT, not just the generator's Tree output -- my round-1 non-negotiable.

## The two round-1 divergences, each disarmed by a verified fact

### D1 -- do NOT author `createFsTree` (round 1: author it now). CONVERGE.

My round-1 drop-trigger was explicit: "generator guaranteed file-emission-free AND D4 runs
the generated target -> gate FsTree's single use." Decision B locks the generator as a
project.json-edit-only, no-file-emission, no-project-type-branching shape (the 33-line
sandbox grade). Verified: no generator, no `generators.json`, and zero `generateFiles`
anywhere in `packages/` today -- so nothing in the codebase contradicts decision B; the
shape is a forward decision, not a discovered constraint. With no file emitted that any
in-process step reads back, the real-disk `FsTree` tier's UNIQUE catch (a compiler reads
flushed on-disk output) has nothing to observe at the unit/mid tier, and the
flushed-output-consumability claim is covered at the e2e tier by D4 running the real target.
Trigger met. Authoring `createFsTree` would add an internal-API (`nx/src/generators/tree`)
import + drift tripwire with no regression class left for it to catch. CONVERGE.

### D3 -- no mid-tier executor-against-workspace test (round 1: add it). CONVERGE.

My round-1 non-negotiable was "path resolution + published-id binding covered on a
Windows-running tier," with the drop-trigger "executor path logic is 100% node:path with
zero hand-rolled separators." Fact A4 verified directly in source
(`normalize-options.ts:45-47`): the `context.root`->`tsConfig` resolution is a two-branch
pure function -- `isAbsolute(options.tsConfig)` passthrough, else
`joinPathFragments(context.root, options.tsConfig)`. `joinPathFragments` is the
devkit/POSIX-stable helper (arch-irrelevant; the function's own doc comment notes it is used
over `node:path.join` precisely for separator stability on Windows arm64). BOTH branches are
covered by `normalize-options.spec.ts` (relative case line 16, absolute case line 30), and
that unit spec runs in the 6-cell `test` matrix INCLUDING the Windows cells. There is no
executor-only resolution branch unreached by this unit + the e2e tier (fact A4 states this;
I confirmed no other path-join logic in the file). Trigger met. Fact A3 separately confirms
the core has zero per-code branching (only `UNKNOWN_ERROR_CODE=500`, the `NG()` helper, and
`NG3004`), so there is no hidden code-dependent path either. The mid-tier's claimed unique
catch (cross-OS path resolution) is already covered on Windows by the unit spec. CONVERGE.

## Residual adversarial check (nothing left to HOLD on)

- Cold-compile cost (A1): ~0.5s/fixture, ~9s added per matrix cell, parallelized by Vitest
  workers under the existing 30000ms margin. §D5 keeps the catalog in all `test` cells with
  no split unless a measured regression appears -- this preserves the cross-OS/Node
  defense-in-depth I argued for, and A1 shows the budget is comfortable, so my round-1
  fallback (full-on-1-cell + smoke-on-5) is not needed.
- Two extended codes outside the 81xx range (A2: 8011, 8021) are real members and ARE in the
  all-18 scope -- no special-casing needed since the core buckets by category, not code.

Verdict: CONVERGE on D1, D2-organization, D2-scope, D2-tripwire, D3, D4, D5, D6. No fact
gets the reconciliation wrong.

```
ROUND2
D1: CONVERGE
D2-organization: CONVERGE
D2-scope: CONVERGE
D2-tripwire: CONVERGE
D3: CONVERGE
D4: CONVERGE
D5: CONVERGE
D6: CONVERGE
NEW-FACTS-NEEDED: none
```
