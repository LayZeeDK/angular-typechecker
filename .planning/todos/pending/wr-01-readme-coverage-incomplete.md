---
status: pending
resolves_phase: 18
created: 2026-07-06
source: 17-REVIEW.md (WR-01)
---

# Correct README Limitations: zero-root-names is now coverage-incomplete (WR-01)

`packages/angular-typechecker/README.md` (Limitations section, the "reference walk is
single-level" bullet) still says references that are "out-of-project, empty, or themselves
solution tsconfigs are skipped with an advisory warning and do not change the verdict."

Phase 17 (D-06) made that FALSE for the *empty* case: a referenced in-project leaf that
resolves to zero input files (empty, or a references-only/solution tsconfig whose inner
projects are not walked) now yields a non-clean **coverage-incomplete** verdict, not an
advisory-only skip. Out-of-project / duplicate / self references remain advisory.

Deferred to Phase 18 deliberately: Phase 18 ("Packaged-tarball e2e + docs", success
criterion 4) rewrites the README + changelog with the authoritative MUST/MUST-NOT/caveat
coverage statement, which restates exactly this coverage-incomplete behavior. Fixing it
piecemeal in Phase 17 would touch a doc Phase 18 rewrites wholesale. v0.1.2 does not ship
before Phase 18 completes, so the stale line never reaches users first.

Action for Phase 18: ensure the coverage-incomplete behavior (incl. the zero-root-names
leaf) is stated correctly in the rewritten Limitations / coverage-claim section.
