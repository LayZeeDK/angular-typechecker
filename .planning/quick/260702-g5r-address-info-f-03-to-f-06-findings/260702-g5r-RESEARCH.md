# Quick Task 260702-g5r: Address INFO findings F-03..F-06 - Research

**Researched:** 2026-07-02
**Domain:** repo docs + a public type/label + SUMMARY bookkeeping (all INFO, verdict-neutral)
**Confidence:** HIGH (all findings resolved from codebase evidence; no web research needed)
**ASCII-only:** yes.

## Summary

Four INFO-severity findings from the v0.1.0 milestone audit. None affect the shipped
runtime verdict. Recommended dispositions, cheapest-safest first:

- **F-03** (root README is Nx scaffold): rewrite the root `README.md` header + generic-Nx tail as a monorepo overview linking ONLY real files. LOW risk.
- **F-04** (awkward skipped-reference notice grammar): reword the `logger.warn` string while preserving the two asserted substrings (`referencePath` + raw `reason` token). LOW risk.
- **F-05** (duplicate leaf labeled `'self-reference'`): **recommend Option (i) - comment-only clarification. Do NOT add a `'duplicate'` reason member.** `SkippedReference` is a PUBLIC exported type and two specs pin `reason:'self-reference'` on the duplicate edge; widening the union + changing the shipped label right before a 0.1.0 release is unjustified for an advisory-only label. LOW risk if comment-only; MEDIUM+ if the union is widened.
- **F-06** (3 reqs absent from SUMMARY `requirements-completed`): add the hyphenated `requirements-completed` array to 3 closed SUMMARYs. LOW risk; passive doc edit, no GSD re-trigger.

---

## F-03: Root workspace README is the Nx scaffold default

**Current state:** `README.md` (repo root) line 1 title is `# AtcTemp`; lines 3-7 are the Nx logo + "Your new, shiny Nx workspace is ready" boilerplate; lines 78-168 are generic Nx scaffold sections ("Run tasks", "Add new projects", "Set up CI!", "Install Nx Console", "Useful links"). Lines 9-77 already contain a real, useful "single-target walk recipe" section (added in Phase 13-06). NOT shipped in the npm tarball (the shipped README is `packages/angular-typechecker/README.md`). Cosmetic; zero consumer impact.

**Real files that exist at the repo root (link ONLY these - do not invent):**
- `packages/angular-typechecker/README.md` - the shipped/consumer usage doc (canonical usage lives here).
- `AGENTS.md` - agent/contributor working rules (there is NO `CONTRIBUTING.md`).
- `SECURITY.md` - security policy.
- `CHANGELOG.md` - release history.
- `packages/angular-typechecker/LICENSE` - MIT license text. **There is NO root `LICENSE` file** (verified: `git ls-files` shows only `packages/angular-typechecker/LICENSE`). Root `package.json` declares `"license": "MIT"`.
- `.github/` contains ONLY `dependabot.yml`, `workflows/ci.yml`, `workflows/release.yml`. **No issue templates, no PR template** - do not reference any.

**Recommended fix:** Replace the `# AtcTemp` title + Nx boilerplate header with a monorepo overview (name `angular-typechecker`, one-line purpose from the package description, that this is the Nx-plugin monorepo and the published package lives at `packages/angular-typechecker/`). Keep/trim the existing walk-recipe section OR defer usage to the package README to avoid drift (prefer a short "Usage: see [packages/angular-typechecker/README.md]"). Replace the generic Nx tail with links to the real files above + a License line ("MIT (c) Lars Gyrup Brink Nielsen; see packages/angular-typechecker/LICENSE"). Use the public contact `larsbrinknielsen@gmail.com` if any contact is added.

**Risk:** LOW. Not shipped. **Constraint:** link only files that exist; ASCII-only. **Verify:** `git grep -n "AtcTemp" -- README.md` returns nothing; every markdown link target resolves (`git ls-files` check).

---

## F-04: Skipped-reference `logger.warn` notice reads awkwardly

**Current state:** `packages/angular-typechecker/src/executors/typecheck/executor.ts` lines 78-83, inside the `for (const skipped of result.skippedReferences)` loop:

```
`angular-typechecker: referenced tsconfig '${skipped.referencePath}' was ` +
  `${skipped.reason} and was skipped or reclassified during the ` +
  `solution-tsconfig reference walk. This notice is advisory only -- the ` +
  `type-check verdict is unchanged.`
```

Awkward because `${skipped.reason}` is an adjectival hyphenated token, so it renders e.g. "...tsconfig 'X' was not-found and was skipped..." / "was out-of-project and was skipped".

**Asserted substrings that MUST be preserved** (`executor.spec.ts` test "WALK-01 D-02: emits one logger.warn per skippedReferences entry naming the path + reason", lines 234-272):
- The interpolated `skipped.referencePath` verbatim - asserted via `stringContaining('/ws/fixtures/solution-style-oop/tsconfig.app.json')` (line 256) and `stringContaining('/ws/fixtures/solution-style/tsconfig.missing.json')` (line 264).
- The raw `skipped.reason` token verbatim - asserted via `stringContaining('out-of-project')` (line 261) and `stringContaining('not-found')` (line 269).
- (No assertion on any surrounding prose; only path + reason token must survive.)

**Recommended reword** (keeps both `${skipped.referencePath}` and `${skipped.reason}` intact):

```
`angular-typechecker: referenced tsconfig '${skipped.referencePath}' was skipped ` +
  `or reclassified during the solution-tsconfig reference walk (reason: ${skipped.reason}). ` +
  `This notice is advisory only -- the type-check verdict is unchanged.`
```

Renders cleanly: "...referenced tsconfig 'X' was skipped or reclassified during the solution-tsconfig reference walk (reason: not-found)."

**Risk:** LOW. Advisory-only; verdict path untouched. **Constraint:** both interpolations must remain literal so the four `stringContaining` assertions pass; ASCII-only (keep the existing `--` double-hyphen, not an em dash). **Verify:** `nx test angular-typechecker` (the executor.spec.ts skipped-ref test stays green).

---

## F-05: Duplicate reference labeled `reason:'self-reference'`

**Current state:** `packages/angular-typechecker/src/core/walk-references.ts` lines 122-133 - ONE branch pushes `reason:'self-reference'` for BOTH the true self-reference (`canonicalLeaf === canonicalSolutionPath`) AND a repeated/duplicate leaf (`seenCanonicalLeaves.has(canonicalLeaf)`). So a duplicate is imprecisely labeled `self-reference`.

**(a) Exact `reason` union today** (walk-references.ts line 69): `'out-of-project' | 'zero-root-names' | 'self-reference' | 'not-found'` - NO `'duplicate'` member (intentional).

**(b) Public exposure + spec assertions:**
- `SkippedReference` is re-exported from `packages/angular-typechecker/src/index.ts` line 16 - it is a **PUBLIC package type**. Adding `'duplicate'` widens a shipped public union (semver-relevant) AND changes the shipped runtime label string emitted by the executor's `logger.warn`.
- `walk-references.spec.ts` (unit) test "skips a self-reference / duplicate leaf and compiles at most once (D-04)" lines 414-462 asserts the exact skippedReferences array, including line 461 `{ referencePath: SOLUTION_TSCONFIG, reason:'self-reference' }` (true self) AND **line 462 `{ referencePath: appPath, reason:'self-reference' }` (the DUPLICATE app leaf)**.
- `walk-references.integration.spec.ts` line 263 test "...records reason self-reference" asserts `reason:'self-reference'` (line 282) for the self+duplicate case.
- `executor.spec.ts` line 294 uses `reason:'self-reference'` in a fixture but does NOT assert the literal string is rendered (only `toHaveBeenCalledOnce`), so it is unaffected either way.

**(c) Safety of adding `'duplicate'`:** Adding a member + relabeling would (1) widen a public exported union, (2) change shipped runtime advisory output for duplicate leaves, and (3) require editing at least 2 spec assertions (walk-references.spec.ts:462 and walk-references.integration.spec.ts:282). All of that for a purely advisory label on a leaf that is never compiled.

**Recommended resolution (ranked):**
- **(i) LOWEST RISK - RECOMMEND:** leave code + public type + specs unchanged; only sharpen the internal comment at walk-references.ts:118-121 to state explicitly that a duplicate in-project leaf is deliberately folded under `'self-reference'` (both are output-neutral repeats of an already-covered leaf) and that the union intentionally omits `'duplicate'` to keep the public type stable pre-1.0. No public/behavior/spec change. Bias toward this per the "don't change public type before release" instruction.
- (ii) HIGHER RISK: add `'duplicate'` to the union + a distinct branch + relabel; update walk-references.spec.ts:462 and walk-references.integration.spec.ts:282; document the widened public type in CHANGELOG. Only justified if the label precision is a real consumer need (no evidence it is).
- (iii) N/A.

**Risk:** LOW for (i) (comment-only); MEDIUM for (ii) (public-type widening + shipped-label change + 2 spec edits) right before v0.1.0. **Verify (i):** `git grep -n "'duplicate'" -- packages/angular-typechecker/src` still returns nothing; `nx test angular-typechecker` green (no assertion touched).

---

## F-06: CAT-05, WALK-02, GEN-06 absent from SUMMARY `requirements-completed`

**Exact field name:** `requirements-completed` (HYPHENATED), a top-level YAML frontmatter array. Proven by 11 existing SUMMARYs, e.g. `12-01-SUMMARY.md:41 requirements-completed: [DRIFT-01]`, `14-02-SUMMARY.md:44 requirements-completed: [GEN-01, GEN-02, GEN-03, GEN-04, GEN-08]`. (The task's `--fields requirements_completed` is approximate; the on-disk key every SUMMARY and the milestone audit read is the hyphenated form - match it exactly.) Note: gsd-tools exposes `frontmatter`/`verify-summary` (there is no `summary-extract` subcommand); all read the literal key, so the hyphenated form is authoritative.

**Home summary per requirement + current frontmatter (field is absent in all three):**

- **CAT-05 -> `.planning/phases/12-extended-diagnostic-catalog-completeness-tripwire/12-04-SUMMARY.md`.** Frontmatter keys present: `phase, plan, subsystem, tags:[diagnostics, catalog, documentation, CAT-05], requires, provides, affects, tech-stack, key-files, decisions, metrics`. No `requirements-completed`. Add: `requirements-completed: [CAT-05]`.

- **WALK-02 -> `.planning/phases/13-engine-solution-tsconfig-reference-walking/13-06-SUMMARY.md`.** Frontmatter keys: `phase, plan, subsystem, tags:[nx-caching, walk, cache-e2e, docs, WALK-02], requires, provides, affects, tech-stack, key-files, decisions, metrics`. No `requirements-completed`. Add: `requirements-completed: [WALK-02]`.

- **GEN-06 -> split across `14-01-SUMMARY.md` and `14-02-SUMMARY.md`** (Phase 14). Evidence: `14-01-PLAN.md:14 requirements:[GEN-05, GEN-06, GEN-07]` (init unit tests + init schema-parity slice) and `14-02-PLAN.md:14 requirements:[..., GEN-06, ...]` (configuration unit tests + configuration schema-parity slice). `14-VERIFICATION.md:91` credits GEN-06 to "14-01/02". **14-03 does NOT contribute GEN-06 test work** (it is registration/packaging, GEN-05/GEN-09). This mirrors the existing precedent where the spanning WALK-01 is listed in BOTH 13-03 and 13-04 SUMMARYs. Current frontmatter: `14-01-SUMMARY.md:46 requirements-completed:[GEN-07]`; `14-02-SUMMARY.md:44 requirements-completed:[GEN-01, GEN-02, GEN-03, GEN-04, GEN-08]`.
  - **Recommended (precedent-consistent):** append `GEN-06` to BOTH -> `14-01: [GEN-07, GEN-06]` and `14-02: [GEN-01, GEN-02, GEN-03, GEN-04, GEN-08, GEN-06]` (renders as "14-01/02" in the audit's SUMMARY-frontmatter column, exactly like WALK-01).
  - **Acceptable minimal alternative:** add `GEN-06` to `14-02` only (the plan where the cumulative requirement is finally satisfied). Do NOT add it to 14-03.

**Re-trigger risk of editing a closed-phase SUMMARY's frontmatter:** None. The milestone is `status: completed` and phases 12-15 are closed. GSD tools that read SUMMARYs (`frontmatter`, `verify-summary`, `milestone`, `audit-open`, `state`) are passive readers - adding a frontmatter array does not re-run execution, verification, or planning. The ONLY effect is the desired one: the milestone audit's 3-source cross-reference now finds the field in-source (the audit already independently confirmed all three SATISFIED via VERIFICATION.md, so this only closes the cosmetic bookkeeping gap). No `.planning` tool watches for content changes.

**Risk:** LOW (docs-only). **Constraint:** hyphenated `requirements-completed`; keep valid YAML array syntax; ASCII-only. **Verify:** `git grep -n "requirements-completed" -- .planning/phases/12-*/12-04-SUMMARY.md .planning/phases/13-*/13-06-SUMMARY.md .planning/phases/14-*/14-0[12]-SUMMARY.md` shows the added arrays including CAT-05, WALK-02, GEN-06.

---

## Project Constraints honored (from CLAUDE.md / AGENTS.md)
- ASCII-only output; `--` not em dash; no smart quotes/emoji.
- `git grep` for tracked files; `rg -uu` reserved for node_modules (not needed here).
- Any `AGENTS.md` change requires code review - N/A (none of these four touch AGENTS.md).
- Commit scope hygiene for the eventual fix: prefer a release-meaningful scope (e.g. `docs`, `fix(executor)`) - these are pre-release cleanups; `docs`/`chore` produce no version bump, `fix` (F-04 executor string) is a patch. Verify with `npx nx release --dry-run` before any release cut.

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims verified against codebase (grep + file reads) | - | - |

## Sources (all HIGH - direct file inspection 2026-07-02)
- `README.md`, `packages/angular-typechecker/README.md`, root `package.json`, `packages/angular-typechecker/package.json`
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` + `executor.spec.ts`
- `packages/angular-typechecker/src/core/walk-references.ts` + `walk-references.spec.ts` + `walk-references.integration.spec.ts`; `src/index.ts`
- `.planning/phases/12-04, 13-06, 14-01, 14-02, 14-03` SUMMARYs; `14-01/14-02-PLAN.md`; `14-VERIFICATION.md`; `.planning/v0.1.0-MILESTONE-AUDIT.md`
- `git ls-files` (root LICENSE/CONTRIBUTING absence), `find .github` (no issue/PR templates), `gsd-tools` command list
