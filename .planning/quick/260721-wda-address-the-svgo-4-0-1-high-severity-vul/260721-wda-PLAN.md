---
quick_id: 260721-wda
description: Address the svgo@4.0.1 High severity vulnerability reported by cve-lite
date: 2026-07-21
mode: quick (lean-inline; --full requested, downgraded to lean after the fix was confirmed trivial)
must_haves:
  truths:
    - cve-lite (npm run cve-lite, --fail-on high) exits 0 with NO high/critical finding
    - svgo resolves to 4.0.2 (>= the OSV fixed version 4.0.2) in package-lock.json
    - package.json is byte-unchanged (svgo is transitive/dev; no override, no direct dep)
    - fallow audit exits 0; npm ci resolves (lockfile fully coherent)
  artifacts:
    - package-lock.json (svgo 4.0.1 -> 4.0.2)
  key_links:
    - package-lock.json
    - .github/workflows/ci.yml (cve-lite job -> required ci aggregate)
---

# Quick Task 260721-wda: Fix HIGH svgo@4.0.1 (GHSA-2p49-hgcm-8545)

## Problem

The required `cve-lite` CI gate on PR #55 (v0.2.4 milestone branch) fails on a HIGH advisory:

- **GHSA-2p49-hgcm-8545** -- "SVGO removeScripts plugin leaves some executable scripts intact".
- **svgo@4.0.1**, transitive + dev-scope, pulled by `postcss-svgo@7.1.3` (`svgo: "^4.0.1"`).
- Fixed in the 4.x line at **4.0.2** (OSV: introduced 4.0.0, fixed 4.0.2). Latest svgo is 4.0.2.

This is the SIMPLEST transitive case, NOT the override case: `^4.0.1` (= `>=4.0.1 <5.0.0`)
already permits the fixed `4.0.2`, so no `overrides` entry is needed (skill Rule 1 N/A) and
`4.0.1 -> 4.0.2` is an in-major patch bump (skill Rule 2 N/A). No override => no npm 10/11
override-portability trap. See `.claude/skills/atc-use-cve-lite-cli/`.

## Task 1 -- bump svgo to the in-range fixed version

- **files:** `package-lock.json`
- **action:** `npm update svgo` (lockfile-only; refreshes 4.0.1 -> 4.0.2 within the existing range).
- **verify:** `npm run cve-lite` exits 0 (no high); `npm run fallow` exits 0;
  `npm install --package-lock-only` produces no further diff (npm ci coherence proxy);
  `package.json` unchanged; lockfile svgo === 4.0.2.
- **done:** cve-lite reports no high/critical, PR #55's `cve-lite` + `ci` gates can go green.
