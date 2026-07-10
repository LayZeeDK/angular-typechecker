# Phase 17: Input-set-membership boundary + layout support - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 17-input-set-membership-boundary-layout-support
**Mode:** `--auto` (autonomous; recommended options auto-selected, no user prompts)
**Areas discussed:** Boundary keep-rule, Split suppressed counter + coverage-incomplete verdict, Phase-17 test scope

> **Auto-mode note:** the Phase-16 gate spike (verdict = GO, branch 4a) had already
> locked ~90% of this phase's design. The two areas with genuine latitude (verdict
> shape, test scope) were both evidence-backed by the roadmap/spike, so neither hit the
> HIGH-impact + NOT-high-confidence trap quadrant that would force a user checkpoint.
> Auto-selection therefore proceeded; residual plan-time details are flagged in CONTEXT.md.

---

## Boundary keep-rule (SB-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Directory-containment (status quo) | Keep current `isUnderDir(base)` filter | |
| rootNames-only replacement | Keep iff `F` in `inputTs` | |
| Input-set membership + branch 4a | `keep(d, inputSet, options)`: file-less/unresolvable KEEP; node_modules SUPPRESS; in `inputTs` OR under `base` KEEP; external template -> 4a `relatedInformation` map | ✓ |

**Choice:** Input-set membership + branch 4a (LOCKED by spike 006/008).
**Notes:** rootNames-only silently drops external `.html` NG8002 (the kill shot);
directory-containment is the Layout-B false-pass bug being fixed. Branch 4a maps the
`.html` diagnostic to its owning component `.ts` via public `relatedInformation`,
default-keeps the unmappable edge. Zero ngtsc internals (structural `git grep` gate).

## Split suppressed counter + coverage-incomplete verdict (SB-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep single silent count | No change | |
| Split counts, surface loudly, `suppressedInGraph > 0` => non-clean | `suppressedThirdParty` + `suppressedInGraph`; both in stdout + structured result; in-graph drop => non-clean | ✓ |
| Split counts but keep verdict clean | Report but do not fail | |

**Choice:** Split + `suppressedInGraph > 0` => non-clean (direction LOCKED by success
criterion 4; charter = never a silent false pass).
**Notes:** Exact operational shape (fold into `success:false` vs a distinct exit code;
retain `suppressedCount` as the sum) flagged as a plan-time residual — gate in the pure
core, map Nx to `success:false`, ratify the deferred-CLI exit code against `exit-codes.ts`.

## Phase-17 test scope (SB-01, SB-03 proof)

| Option | Description | Selected |
|--------|-------------|----------|
| Unit test on `keep()` only | Defer all fixtures to Phase 18 | |
| Unit + tripwire + minimal integration proof of the 5 criteria | Prove branches + phase success criteria; defer the T1-T11 matrix | ✓ |
| Full T1-T11 matrix + tarball e2e now | Pull SB-06 forward | |

**Choice:** Unit + tripwire + minimum integration proof (roadmap-locked split:
SB-06/07 are Phase 18).
**Notes:** Phase 17's 5 success criteria require SOME behavioral proof under both
layouts, so unit-only is insufficient; the full acceptance matrix + tarball e2e + docs
stay in Phase 18 per the requirement->phase mapping.

## Claude's Discretion

- `keep()` module location + signature; `inputSet` data structure.
- How `walk-references.ts` surfaces each leaf's declared rootNames.
- Exact stdout wording for the two counts.
- D-06 exit-code shape and D-07 `suppressedCount` retention (flagged for planning).

## Deferred Ideas

- Full T1-T11 negative-test matrix + generator fixtures + packaged-tarball e2e -> Phase 18 (SB-06).
- README + changelog coverage claim/caveats + green->red flip callout -> Phase 18 (SB-07).
- `.mdx` / `.tsx`-without-`jsx` "not type-checked" notice -> Phase 18 validation.
- Layout C beyond the no-silent-pass guard -> Phase 19 (SB-08, stretch).
