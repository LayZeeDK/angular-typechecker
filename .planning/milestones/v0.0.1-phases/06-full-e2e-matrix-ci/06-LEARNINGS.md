# Phase 6 — Learnings: Full e2e Matrix + CI

**Extracted:** 2026-06-29
**Phase:** 6-full-e2e-matrix-ci (executed + locally verified; SC3 matrix-green human-gated via draft PR)

## Decisions (the RD-01..RD-12 contract, distilled)

- **Lean 6-cell matrix, standard runners, NO arm64-specific cells** (RD-01): `ubuntu-latest×{22,24,26}` + `windows-latest×{24,26}` + `macos-latest×{24}`. Driven by axis-independence, not platform-matching.
- **e2e = npm + pnpm only** (RD-03): the two viable on-disk layout classes; yarn/bun map onto them; Yarn PnP out-of-scope.
- **act suite + act-compat CI job** (RD-05/06): `act --validate` (parseability) + `act -n` (trigger/condition fidelity), container-free; never plain `act` execution in CI.
- **release.yml publish `if:` ref gate** (RD-07): additive defense-in-depth that also makes the workflow act-testable.
- **Validation via throwaway draft PR** (RD-10): the only way to prove the cross-OS matrix green.

## Lessons

- **arch is correctness-irrelevant for a pure-JS (ngtsc/Node) type-checker.** `node:path` + FS case behavior are OS-determined, byte-identical across arm64/amd64. The real test axes are **OS** (case-sensitivity + separators) and **Node version** (the CJS->ESM `import()` bridge / `node16` resolution). Spend the matrix budget on OS + Node, not arch. Node and OS are independent -> full Node sweep on one OS + OS axis on one Node + one cross-cell is sufficient (6 cells, not 9).
- **`act` does NOT evaluate `on:` filters** (`branches`/`tags`/`paths`/`types`) in v0.2.89 — only the event NAME. The `--apply-event-filters` PR (#2729) is unmerged. So tag-vs-branch discrimination can't come from act's trigger selection; it must be an **`if:` ref gate** asserted via **`act -n` (dry-run) + injected `GITHUB_REF`**. act DOES evaluate `if:` faithfully. This reshaped the entire act-test design.
- **`act` runs native arm64 on Windows arm64** — the `catthehacker/ubuntu:act-*` images are multi-arch (`linux/arm64/v8`); Docker auto-selects arm64. The "amd64-only -> QEMU" claim was stale folklore; the trap is _forcing_ `--container-architecture linux/amd64`.
- **Free native arm64 GitHub runners now exist for all 3 OSes** (public repos): `ubuntu-24.04-arm`, `windows-11-arm`, `macos-latest` (already arm64). Intel macOS is RETIRED (`macos-13` gone Dec 2025). Not needed here (arch-irrelevant tool), but available.
- **Windows GitHub runners are NTFS** (not ReFS/Dev Drive). NTFS ≈ ReFS for case-insensitivity + realpath + symlink resolution; the only gap (8.3 short names, NTFS-only) is unreachable by TS/ngtsc/Node. CI-on-NTFS is a _superset_ of a local ReFS Dev Drive — no FS-divergence blind spot.
- **Package-manager coverage is a LAYOUT question, not a brand question.** Officially-supported PMs collapse to: hoisted real dirs (npm = yarn classic = yarn-berry-node-modules = bun-hoisted) and symlinked store (pnpm = yarn-berry-pnpm-linker = bun-isolated). npm + pnpm span both. The bun `.bun` vs pnpm `.pnpm` store-dir nuance is covered by a cheap UNIT test (the `node_modules`-segment exclusion generalizes), not a slow extra e2e.
- **Place each cross-platform difference at the CHEAPEST tier that exercises it:** case-fold/separators/store-dir -> unit (all OSes, fast); ESM bridge -> integration per-Node; symlink/realpath + packaged-tarball + 5 project types -> e2e (needs a real install).
- **The heavy install-and-run e2e is a genuine validator** — it surfaced 5 real bugs (Rule-1 fixes in 06-02): a stray fixture `pnpm-lock.yaml` breaking the Nx graph under npm, an invalid `pnpm add` flag, a `types:["node"]` fixture defect (TS2688), a class-field injection syntax error, and a cacheable-target serving a stale green for the spec-row injection (needed `--skip-nx-cache`). A spec that only asserts exit-0 would have missed these.
- **SC3 (cross-OS matrix green) is fundamentally push-gated** — `act` can't emulate Windows/macOS runners; the draft PR on real runners is the authoritative gate. Everything else (5-type e2e, pnpm, mixed-case, act triggers/conditions, actionlint, release if-gate) validates locally on the Windows arm64 box.

## Patterns established

- **Lean `matrix.include` + a single aggregate `ci` gate** (`needs:[test,e2e,act-compat,lint-workflows]`, `if:always()`, fail-closed on `failure||cancelled||skipped`). The gate name `ci` is the Phase-7 branch-protection contract; cells can be added/removed without touching the ruleset (require only `ci`).
- **act compatibility as a committed Bash suite + event-payload fixtures** (`tools/act/act-compat.sh` + `tools/act/events/*.json`), runnable identically locally (native arm64) and in CI (the `act-compat` job, container-free). Assert job-FAMILY tokens (`ci/test-`), not positional cells, to survive matrix reordering.
- **`.nxignore` to isolate a nested consumer-workspace fixture from the main Nx graph** — fixtures with build targets (that intentionally can't build) must NOT be main-graph projects or they break `nx run-many -t build` (the release preVersionCommand). The fixture is exercised only via per-run tmp copies.
- **Hand-authored buildable/publishable Angular libs WITHOUT an `@nx/angular` dependency** — the type-check executor only reads `tsConfig`; Nx 23 ignores the sibling build executor at graph time, so the structural type distinction needs no `@nx/angular` install (preserves the clean-install honesty invariant).
- **Two complementary, container-free workflow validators:** `actionlint` (GitHub-spec + expressions) and `act --validate` (act-ingestibility) — neither subsumes the other.

## Surprises

- **act silently ignoring `on:` filters** was the biggest design-reshaper — intuitively `act push` should respect a `tags:` filter; it does not. Caught by testing against the installed v0.2.89, not by reading docs.
- **A test fixture broke the release command.** Adding ng-packagr build targets to a fixture (for the 5-type shape) made `nx run-many -t build` fail because the nested fixture projects leaked into the main graph — an interaction nobody plans for until the dry-run trips on it (DI-06-01).
- **The "amd64-only act / QEMU-slow" belief was wrong** for Windows arm64 in 2026 — a stale-secondary-source trap corrected only by inspecting the live image manifests on the actual machine.

## For Phase 7 (consumes this phase)

- The required status check is **`ci`** (and only `ci`) — wire exactly that into the "Default branch" ruleset; do not require individual matrix cells (their names are dynamic).
- The `release.yml` publish job now carries `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` — note (code-review WR-01) this also gates `workflow_dispatch`, so a manual dispatch must target a **tag ref** to publish (a branch dispatch skips publish). Decide in Phase 7 whether to document that at the `if:` or add `|| github.event_name == 'workflow_dispatch'`.
- SC3's draft-PR validation must be green before Phase 7 enables the ruleset that requires `ci`.
