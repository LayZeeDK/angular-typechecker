---
phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
plan: 03
subsystem: docs
tags:
  [
    readme,
    changelog,
    vite-client,
    bundler-query,
    ts2307,
    storybook,
  ]

# Dependency graph
requires:
  - phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
    plan: 01
    provides: "the locked CoreResult field name bundlerQueryImports -- cross-referenced by the README caveat and the changelog"
  - phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
    plan: 02
    provides: "the shipped executor advisory (warnBundlerQueryImports) the README caveat and changelog describe"
provides:
  - "restructured README ## Storybook Vite caveat that LEADS with the \"types\": [\"vite/client\"] fix"
  - "Programmatic-API CoreResult comment lists bundlerQueryImports?: readonly string[]"
  - "curated v0.1.2 CHANGELOG entry documenting both SB-09 signals (guidance + feat advisory) -- prose only, no release cut"
affects: []

# Tech tracking
tech-stack:
  added: [] # docs-only; no runtime/dev dependencies
  patterns:
    - "fix-first caveat: state the one-line remedy before restating the problem"
    - "changelog scope hygiene (AGENTS.md Pitfall 5): public prose, no internal plan-id scopes"

key-files:
  created:
    - .planning/phases/20-vite-analog-storybook-query-import-guidance-vite-client-read/20-03-SUMMARY.md
  modified:
    - packages/angular-typechecker/README.md
    - CHANGELOG.md

key-decisions:
  - "README Vite caveat restructured IN PLACE as a bullet in the same Caveats list (D-07); the whole Storybook story stays in the README (no docs/ dir, consistent with Phase 18/19 D-05)"
  - "hand ambient-shim fallback named and called INCOMPLETE by construction; the wildcard blind spot (a ?query import of a missing base resolves through the wildcard and will not error) is documented honestly as the same build-vs-typecheck split Vite has"
  - "caveat cross-references the bundlerQueryImports advisory (link to Programmatic API) and reaffirms the TS2307 are NEVER auto-suppressed"
  - "changelog: Signal 2 as a ### Features bullet, Signal 1 as a ### Compatibility guidance note, both folded into the EXISTING 0.1.2 entry -- no new version heading, package.json stays 0.1.1, no release cut (D-08/D-11)"

# Metrics
metrics:
  duration: ~5 min
  completed: 2026-07-07
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  commits: 2
---

# Phase 20 Plan 03: README Vite caveat restructure + changelog (Signal 1 docs) Summary

Signal 1 (docs-only, ZERO engine change, D-07/D-08): the README `## Storybook` Vite caveat now LEADS with the proven `"types": ["vite/client"]` fix instead of burying it at the end of a paragraph, names the hand ambient-shim fallback and calls it incomplete, documents the one wildcard blind spot, cross-references the shipped `bundlerQueryImports` advisory, and reaffirms the diagnostics are never auto-suppressed. Both SB-09 signals are folded into the existing curated v0.1.2 CHANGELOG entry as prose. No release cut.

## What Was Built

- **Restructured README Vite caveat** (`packages/angular-typechecker/README.md`, in the `## Storybook` Caveats list): the bullet now opens with the fix -- add `"types": ["vite/client"]` to the checked tsconfig, which resolves the `?raw`/`?url`/`?worker`/`?inline` (and virtual-module) `TS2307` because `vite/client` declares the whole query family as ambient wildcard modules; states it drove one real project's 227 `?query` `TS2307` to 0 with no false pass. It then names the hand `declare module '*?raw' { ... }` `.d.ts` FALLBACK for when `vite` is not resolvable and calls it INCOMPLETE by construction (prefer `vite/client`). It documents the one honest blind spot -- an ambient wildcard matches the SPECIFIER not the file, so a `?query` import of a MISSING base resolves through the wildcard and will NOT error (the same build-vs-typecheck split Vite has; narrow). It closes by reaffirming the tool NEVER auto-suppresses these `TS2307` and cross-referencing the `bundlerQueryImports` advisory (linked to the Programmatic API section).
- **CoreResult API comment field** (same README, Programmatic-API block): `bundlerQueryImports?: readonly string[]` added after `notTypeCheckedDeclaredFiles?`.
- **CHANGELOG 0.1.2 entry** (repo-root `CHANGELOG.md`): a new `### Features` bullet for Signal 2 (the `bundlerQueryImports` advisory -- flags unresolved `?`-query `TS2307`, recommends `vite/client`, verdict-neutral, self-gating, never suppresses), plus a `### Compatibility` guidance note for Signal 1 (the README caveat now leads with the `vite/client` recipe + hand ambient-shim fallback). Both folded into the existing `## 0.1.2` entry -- no new version heading, no `package.json` bump, no release cut.

## How It Works

Purely documentation. The README caveat gives a consumer who hits a wall of `?query` `TS2307` the one-line remedy first, then the fallback, then the honest limitation, then the assurance the tool did not silently pass. The cross-reference ties the docs (Signal 1) to the shipped executor advisory (Signal 2, plan 20-02's `warnBundlerQueryImports`) and the API field (plan 20-01) so all three point at the same `vite/client` fix. The changelog records both signals in public prose for the eventual (human-gated) v0.1.2 cut.

## Verification

- `npx nx run angular-typechecker:lint` -- exits 0 (All files pass linting).
- `npx prettier --check packages/angular-typechecker/README.md CHANGELOG.md` -- All matched files use Prettier code style.
- `git grep -c "bundlerQueryImports" packages/angular-typechecker/README.md` = 2 (caveat cross-ref + CoreResult comment).
- `git grep -c "bundlerQueryImports" CHANGELOG.md` = 1; `git grep -c "vite/client" CHANGELOG.md` = 2; `git grep -c "^## 0.1.2" CHANGELOG.md` = 1 (single heading).
- `packages/angular-typechecker/package.json` version unchanged at `0.1.1` (no release cut).
- No internal plan-id/phase scopes leaked into the changelog; no non-ASCII bytes in either file.

## Deviations from Plan

None - plan executed exactly as written. (Prettier reflowed the restructured caveat into paragraph-separated blocks within the same list item; applied via `prettier --write`, no content change.)

## Threat Model Compliance

- **T-20-04 (accuracy of guidance)** mitigated: the recipe (227 -> 0) and the wildcard blind spot are grounded in spike 009; the caveat reaffirms never-auto-suppressed, so no reader infers a silent false pass.
- **T-20-05 (accidental release)** mitigated: prose only -- no `nx release`, no tag, no version bump; acceptance verified `package.json` stays 0.1.1 and there is exactly one `## 0.1.2` heading.
- **T-20-SC**: accepted -- docs-only plan, no package installs.

## Notes for Next Steps

SB-09 is not closed until phase verification: Gate A (branch pushed + green required CI via PR) and Gate B (real-OSS radix-ng tarball UAT -- the advisory fires and `vite/client` drives the `?query` `TS2307` to 0). Both are human-gated per D-10/D-11; the v0.1.2 cut/publish and PR merge stay human-gated (do NOT auto-approve).

## Self-Check: PASSED

- Files: `README.md`, `CHANGELOG.md`, `20-03-SUMMARY.md` all present.
- Commits: `af003f9` (docs/readme), `a83568d` (docs/changelog) both in history.
