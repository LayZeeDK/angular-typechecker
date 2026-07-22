---
quick_id: 260721-wda
description: Address the svgo@4.0.1 High severity vulnerability reported by cve-lite
date: 2026-07-21
status: complete
commit: 4c38ab7
verification: Verified
---

# Quick Task 260721-wda: Fix HIGH svgo@4.0.1 -- SUMMARY

## What changed

`npm update svgo` refreshed `package-lock.json` from **svgo 4.0.1 -> 4.0.2** (commit `4c38ab7`).
Nothing else changed: `package.json` is byte-unchanged, no `overrides` entry was added, and no
dependency crossed a major line.

## Why this shape (informed by the atc-use-cve-lite-cli skill)

- Advisory: **GHSA-2p49-hgcm-8545** (HIGH) -- "SVGO removeScripts plugin leaves some executable
  scripts intact". OSV fixed the 4.x line at **4.0.2**.
- svgo is **transitive + dev-scope** (via `postcss-svgo@7.1.3`, which declares `svgo: "^4.0.1"`).
- `^4.0.1` (= `>=4.0.1 <5.0.0`) already permits the fixed `4.0.2`, so the skill's transitive-override
  path does NOT apply: **Rule 1** (nested override) is unnecessary because the parent range already
  allows a safe version, and **Rule 2** (no cross-major) is a non-issue for an in-major patch bump.
  No override => no npm 10/11 override-portability trap => `npm ci` stays clean on the Node-22 runner.

## Verification (run on the main working tree)

| Gate | Command | Result |
|------|---------|--------|
| CVE (required CI gate) | `npm run cve-lite` (`--fail-on high`) | **exit 0** -- HIGH svgo gone (one MEDIUM transitive remains; below the gate) |
| Structural | `npm run fallow` | **exit 0** -- "No issues in 78 changed files" |
| Lockfile coherence (npm ci proxy) | `npm install --package-lock-only` | no further diff -> lockfile fully consistent, `npm ci` will resolve |
| Resolved version | lockfile inspect | `node_modules/svgo` === `4.0.2` |

## Notes

- Ran lean-inline on the main tree (no worktree): single-plan, dependency-changing, verification-heavy
  -- the AGENTS.md "single-plan wave: skip worktrees" case (a junction is invalid for a lockfile change).
- `--full` was requested; after the skill confirmed the fix was a trivial in-range patch bump with no
  override complexity, the user chose lean-inline over the subagent pipeline. Verification guarantees
  preserved (all three CI gates run + recorded above).
- The MEDIUM transitive CVE that remains does not gate `--fail-on high`; out of scope for this task.
- Real-CI confirmation (PR #55 `cve-lite` + `ci` turning green) lands on the next push.
