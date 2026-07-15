---
status: resolved
source: 24-REVIEW-GAP-2404-2405.md
reviewed_files: 6
findings_total: 5
findings_fixed: 4
findings_intentional: 1
updated: 2026-07-12
---

# Code-review fix report -- Phase 24 gap closure (24-04 + 24-05 + docstring refinement)

Resolves every finding from `24-REVIEW-GAP-2404-2405.md` (gsd-code-reviewer, standard depth,
0 critical / 2 warning / 3 info). Fixes applied inline by the execute-phase orchestrator (the
code_review_gate is advisory; no `--fix` agent run was requested). No product source logic changed
-- the fixes are a test-honesty assertion, doc-accuracy corrections, and a test title.

## Dispositions

- **WR-01 (FIXED)** -- `ng-add-ng-run-yarn.e2e.spec.ts`: the yarn spec asserted the app clean
  baseline but not the library's, unlike the npm/pnpm siblings. Added a `libClean`
  `ng run my-lib:typecheck` exit-0 baseline before planting, so the later lib per-project scoping
  check is a real regression from a known-green start.

- **WR-02 (FIXED)** -- `CLAUDE.md`: the 24-04 doc flip left three statements contradicting the new
  "nx is a direct `^23.0.0` dependency" rule, which could mislead a future agent into reverting the
  fix. Corrected all three: (1) the Installation snippet `# dependencies:` line now lists
  `nx@^23.0.0` and the `# (NO nx ...)` comment now reads "nx IS a direct ^23.0.0 dependency ... NO nx
  in peerDependencies"; (2) the second Version-Compatibility table `nx` row ("Not declared in the
  plugin's package.json") carries the dated `[v0.2.1 CORRECTION ...]` note; (3) the What-NOT-to-Use
  "Use Instead" cell now says "declare `nx` directly at `^23.0.0` ... keep `nx` OUT of
  peerDependencies" instead of "let its peer carry `nx`". CLAUDE.md re-formatted with Prettier.

- **IN-01 (FIXED)** -- `ng-add-ng-run-yarn.e2e.spec.ts:244`: replaced the U+2014 em dash in the test
  title with ASCII (repo ASCII-only convention). Verified the whole spec is ASCII-clean.

- **IN-02 (FIXED)** -- same title: "auto-wires every project" was inaccurate (under yarn `ng add`
  does NOT auto-wire). Retitled to "ng add installs, ng g wires every project, catches planted leaf
  errors -- %s layout".

- **IN-03 (INTENTIONAL / no change)** -- `package-manifest.spec.ts`: the `nx`-is-a-`^23.0.0`-dependency
  assertion appears in two `it` blocks, but under DISTINCT describe contexts with distinct requirement
  traceability (CMP-01 / D-14 general manifest-compatibility contract vs ACP-01 / NGADD-01 RF-01 / D-07
  Angular-CLI-install contract). Keeping both documents both contracts; collapsing them would weaken
  per-requirement coverage. Resolved as intentional.

## Verification

- `npx prettier --check` on the changed files: clean.
- `npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache`: all specs green (validates the new
  `libClean` baseline + the retitled yarn test).
