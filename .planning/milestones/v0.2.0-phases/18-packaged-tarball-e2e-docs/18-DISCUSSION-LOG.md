# Phase 18: Packaged-tarball e2e + docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 18-packaged-tarball-e2e-docs
**Mode:** `--auto --analyze --chain` (autonomous; recommended option auto-locked per area; trade-off tables logged)
**Areas discussed:** `.mdx`/`.tsx` not-type-checked notice, packaged-tarball Storybook e2e strategy, T1-T11 tier placement, README + changelog docs, release-cut boundary

---

## `.mdx` / `.tsx`-without-`jsx` "not type-checked" notice (criterion 3 / T11)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Pure detection in core + loud render in executor | Mirror `skippedReferences`/`templateCheckAborted`; structured advisory field; verdict green | [x] |
| B. Executor-only scan of the tsconfig include | No core change, but structured `CoreResult` misses it | |
| C. Docs-only caveat, no runtime notice | Zero code -- VIOLATES criterion 3 ("emit a loud notice") | |

**Auto choice:** A (recommended). **Notes:** Verified 2026-07-06 that NO such notice exists in the engine today (net-new work). High-impact but high-confidence (explicit roadmap criterion 3 + "loud, never silent" charter + established detection/render pattern) -> auto-lockable, NOT trap-quadrant. Detection mechanism deferred to research. Flagged in CONTEXT.md because it changes the phase shape from "e2e + docs" to "+ a small engine addition".

---

## Packaged-tarball Storybook e2e fixture + install strategy (criterion 1)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Committed generator-shaped fixtures + force-install `@storybook/angular@10.4.6`; tarball with NO override | Reuses install-e2e harness; deterministic; B-03 honesty; matches D4 | [x] |
| B. Run `nx g @nx/angular:storybook-configuration` live per e2e run | Most faithful, but heavy/fragile Storybook install per OS-matrix job | |
| C. Stub `@storybook/angular` types | No install, but fake imports = weakest proof | |

**Auto choice:** A (recommended). **Notes:** Spike-007 forced-SB10 scaffold was scratchpad-only (never committed). Force-install SB10 as a SEPARATE `--legacy-peer-deps` step; install OUR tarball override-free. Serialize with the shared-tarball e2e tier (`nx --parallel=1`, singleFork).

---

## T1-T11 acceptance-matrix tier placement (SB-06)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Boundary-semantics T-cases as fast in-repo integration; e2e proves only the shipped artifact | Fast; no duplication of Phase 17's minimum proof | [x] |
| B. Duplicate the full T1-T11 in the e2e | Heavy; redundant with Phase 17 | |

**Auto choice:** A (recommended). **Notes:** Phase 17 shipped the minimum integration proof; Phase 18 fills only gaps (likely T5/T6/T9/T10/T11) in-repo + the tarball story proof (criterion 1) in e2e. Research must map Phase 17 coverage vs T1-T11 first.

---

## README + changelog (SB-07 criterion 4)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Dedicated README "Storybook" section + updated Limitations + curated 0.1.2 CHANGELOG with green->red callout | Discoverable; exact MUST/MUST-NOT/caveat claim; folds WR-01 | [x] |
| B. Fold everything into Limitations only | Less discoverable | |

**Auto choice:** A (recommended). **Notes:** Source the exact release claim from board CONSENSUS.md. Fold WR-01 (empty/zero-root-names is now coverage-incomplete, not advisory-skip).

---

## Release-cut boundary

| Option | Description | Selected |
|--------|-------------|----------|
| A. Author docs/changelog PROSE only; release CUT via AGENTS.md Release-PR flow after milestone close | Keeps the irreversible publish behind the manual OIDC gate | [x] |
| B. Cut the release in Phase 18 | Contradicts the Release-PR flow + PR-only main | |

**Auto choice:** A (recommended). **Notes:** Do not run `nx release` during Phase 18.

---

## Claude's Discretion

- Exact detection mechanism + `CoreResult` field name for the D-01 `.mdx`/`.tsx` notice (decision locked; HOW is research).
- Exact committed fixture shapes + planted-error anchors/tokens for the Storybook e2e.
- The exact residual T-case gap set after mapping Phase 17 coverage.
- README section placement/wording and CHANGELOG prose (content locked; phrasing discretion).

## Deferred Ideas

- Layout C beyond the no-silent-pass guard -> Phase 19 (SB-08, stretch).
- Actual type-CHECKING of `.mdx`/`.tsx` beyond the loud notice -> Phase 19 (SB-08, stretch).
- Opt-in strict mode failing on `suppressedInGraph > 0` -> Phase 19 (SB-08, stretch).
- The v0.1.2 release CUT (nx release / tag / publish) -> AGENTS.md Release-PR flow after milestone close.
