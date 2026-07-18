# Phase 25: Extract the advisory-notice seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 25-extract-the-advisory-notice-seam
**Mode:** `--auto --chain --analyze` (autonomous single-pass; recommended option auto-selected per gray area; trade-off tables logged for audit)
**Areas discussed:** Logger seam, Module contract, Byte-identical guarantee, Executor swap scope

---

## Logger seam (shape + location)

| Option | Description | Selected |
|--------|-------------|----------|
| New `core/logger.ts` structural `Logger` (`info`/`warn`/`error`), no imports | Phase 26 CLI + `run()` import the type without pulling the advisory module; `core/**` lint keeps it pure; `@nx/devkit` `logger` is structurally assignable so the executor passes it in directly | ✓ |
| Declare `Logger` inline in `emit-advisory-notices.ts` | Fewer files, but Phase 26 must import the advisory module just for the type | |
| Reuse `@nx/devkit`'s `Logger` type | Rejected — importing nx into `src/core/**` violates the D-11 lint boundary | |

**Auto-selected:** dedicated `core/logger.ts`, structural `{ info/warn/error }(message: string): void`, no imports (recommended default).
**Notes:** `error` included now (though the five advisories use only `info`/`warn`) to freeze the full seam shape once — it is the CLI's Phase-26 infra path. IMPACT medium-high (freezes an inherited contract), CONFIDENCE high (dictated by success criterion 1 + existing nx logger shape) → not trap-quadrant → safe to auto-lock.

---

## Module contract

| Option | Description | Selected |
|--------|-------------|----------|
| `emitAdvisoryNotices(result, logger): void`, exact current emission order preserved | Synchronous; order = templateCheckAborted → skippedReferences → suppressed (info then warn) → notTypeChecked → bundlerQueryImports; strings verbatim | ✓ |
| Re-order / consolidate notices | Rejected — would break the byte-identical requirement (criterion 2) | |

**Auto-selected:** exact-order, verbatim strings, five private helpers retained, `skippedReferenceVerdictNote` moves with `warnSkippedReferences` (recommended default).
**Notes:** Signature is essentially dictated by success criterion 1/2. High confidence.

---

## Byte-identical guarantee

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim move + existing executor/builder specs as the guard | Criterion 2 already requires those tests stay green; no new fragile fixture | ✓ |
| Add snapshot/golden regression fixture | Explicit byte lock but new maintenance surface for already-asserted output | |

**Auto-selected:** verbatim move; existing executor + builder specs are the byte-identical guard; the NEW unit spec asserts each message + stream routing against a mock Logger (recommended default).
**Notes:** Notice output is already asserted by executor/builder tests. High confidence.

---

## Executor swap scope

| Option | Description | Selected |
|--------|-------------|----------|
| Swap five inline `warn*` calls for one `emitAdvisoryNotices(result, logger)`; delete the helpers; LEAVE the catch-block infra `logger.error` | The infra error is adapter error-handling over a thrown error, not a `CoreResult` advisory | ✓ |
| Also move the infra `logger.error` into the seam | Rejected — it is not a `CoreResult` advisory; the seam is for the five additive notices | |

**Auto-selected:** move the five advisories only; keep the infra `catch`/`logger.error` in the executor (recommended default).
**Notes:** High confidence — the infra path is distinct from advisory rendering.

---

## Claude's Discretion

- Internal private-helper names inside the new module (message text is what is locked).
- Straight-sequence calls vs iterating an internal helper list (observably identical).
- Keeping `core/logger.ts` type-only for this phase (a console impl arrives in Phase 26).

## Deferred Ideas

- Console `Logger` implementation + stdout/stderr routing (CLI-03) — Phase 26.
- Wiring `Logger.error` to the CLI infrastructure path + `toExitCode` — Phase 26.
