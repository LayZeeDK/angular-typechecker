---
phase: 20
phase_name: "vite-analog-storybook-query-import-guidance-vite-client-read"
project: "angular-typechecker"
generated: "2026-07-07"
counts:
  decisions: 8
  lessons: 4
  patterns: 4
  surprises: 3
missing_artifacts:
  - "20-UAT.md"
---

# Phase 20 Learnings: Vite/Analog Storybook query-import guidance (SB-09)

## Decisions

### Simplest variant of the pure-detector triad (reads the finalize diagnostics directly)
Signal 2 was built as the 4th instance of the shipped `pure-detector -> additive-optional-CoreResult-field -> executor-logger.warn` triad, and the SIMPLEST one: `detectBundlerQueryImports` reads the diagnostics array already held in `finalize`, rather than threading through `walk-references` like the config-derived `notTypeCheckedDeclaredFiles`.

**Rationale:** Zero walk threading -- the signal is derivable entirely from the diagnostic set at the single finalize seam, so no new plumbing was needed.
**Source:** 20-01-SUMMARY.md

### Scan the POST-filter kept set, and gate on code===2307 FIRST
The detector scans the POST-boundary-filter `reported` set (`run-typecheck.ts:671`), NOT the pre-filter superset that `detectTemplateCheckAborted` scans; and the `code === 2307` check runs BEFORE the message parse.

**Rationale:** Pitfall 1 -- scanning the pre-filter set would name node_modules `?query` the consumer cannot fix (information-disclosure). Pitfall 2 -- TS6 has three "Cannot find module '{0}'" messages (2307 plain, 2732 resolveJsonModule hint, 2792 moduleResolution hint) that share the prefix, so a message-only match would capture the 2732/2792 hints.
**Source:** 20-01-SUMMARY.md, 20-VERIFICATION.md

### Verdict-neutrality enforced structurally, not just by convention
`bundlerQueryImports` is deliberately ABSENT from `EvaluateInput`; the field is introduced via a `const` variable and a tripwire spec proves it cannot flip the verdict.

**Rationale:** Excess-property checks fire only on fresh object literals, so a `const`-variable tripwire is the compile-time proof that the field never enters the verdict; `git grep -c bundlerQueryImports evaluate-result.ts` = 0 backs it at review time. Charter: never a silent false pass.
**Source:** 20-01-SUMMARY.md

### Field is plain `string[]`, name `bundlerQueryImports` (dropped the spike's KNOWN label)
Kept the LOCKED D-01 shape: a `readonly string[]` of deduped+sorted specifiers, `[] -> undefined`. Dropped spike 010's proposed KNOWN label.

**Rationale:** Match the existing advisory-field shape (`notTypeCheckedDeclaredFiles`); the label added no consumer value.
**Source:** 20-01-SUMMARY.md

### Executor renders one warn, after warnNotTypeChecked, self-gating on field presence
`warnBundlerQueryImports` fires AFTER `warnNotTypeChecked` (D-04 order), emits ONE `logger.warn` (count + `"types": ["vite/client"]` fix + `declare module` fallback + "ADVISORY: not suppressed" + the specifiers), and self-gates on `result.bundlerQueryImports?.length` (D-03).

**Rationale:** Content-isolation -- the notice names only the consumer's own specifiers (mirrors warnNotTypeChecked / warnSuppressed). Self-gating means no public option is needed: the advisory vanishes once the consumer resolves the imports.
**Source:** 20-02-SUMMARY.md

### Docs restructured in place; no release cut
The README Vite caveat was restructured IN PLACE (no `docs/` dir); the CHANGELOG folds both signals into the EXISTING 0.1.2 entry; `package.json` stays 0.1.1; no `nx release`.

**Rationale:** D-11 -- the release is human-gated and happens post-phase via the Release PR. The phase completes at Gate A + Gate B.
**Source:** 20-03-SUMMARY.md

### Narrow fallow override for the fixture's intentional broken import
Added a scoped FAL-06 override for `fixtures/vite-query-imports` so fallow's unresolved-imports check stops flagging the deliberate `./does-not-exist` control.

**Rationale:** The broken import is an intentional test control, not real dead/unresolved code; the type-check charter for that fixture is enforced by its integration spec, not by fallow.
**Source:** 20-04-SUMMARY.md

### Gate B run autonomously at explicit user instruction
Gate B (real-OSS radix-ng tarball verify) was executed autonomously because the user explicitly instructed it; merge/release stayed human-gated.

**Rationale:** Gate B is a verification, not a deployment approval, so it does not touch the never-approve-deployments rule. D-10's human-only default was overridden only by an explicit user instruction.
**Source:** 20-05-SUMMARY.md

---

## Lessons

### This is the ONE detector that reads diagnostic message text
Unlike the sibling code-only detectors, `detectBundlerQueryImports` extracts the specifier by regex over the English TS2307 message; `filter-diagnostics.ts` explicitly avoids message-text matching as locale-fragile.

**Context:** Code review WR-01. Accepted as a trade-off because it is verdict-neutral -- under a non-English `--locale` the regex misses and the advisory silently returns [], but the TS2307 still counts and fails the build (only the fix HINT is lost). The assumption is now disclosed in the detector docstring.
**Source:** 20-REVIEW.md

### A pnpm major-version mismatch blocks installing a local tarball
`pnpm add` of the local `.tgz` failed with `ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF` because the radix checkout's node_modules was created with pnpm 11 while this environment runs pnpm 9.15.7.

**Context:** Worked around by overlaying the built package files onto the already-resolved pnpm store path for angular-typechecker (node/nx resolution follows the symlinks; the pnpm-CLI store check does not affect `nx typecheck`). Faithful to the shipped `.js`; only the install mechanism differed.
**Source:** 20-05-SUMMARY.md

### fallow false-positives on intentional test controls
fallow's unresolved-imports flagged the fixture's deliberately-broken `./does-not-exist` control as a real finding, which would have turned the CI fallow gate red.

**Context:** Deliberately-broken test imports need a narrow scoped fallow override; do not weaken the global profile.
**Source:** 20-04-SUMMARY.md

### Prettier drift in a branch-introduced file goes red in CI, not just on source
A Prettier format-drift in the branch-introduced skill reference (a `.md` doc) would have failed the CI format-lint gate.

**Context:** Reinforces the standing rule to run `format:check` + `lint` (maxWarnings 0) before opening the Release PR -- CI format-lint covers docs and config, not just package source.
**Source:** 20-04-SUMMARY.md

---

## Patterns

### Pure-detector -> additive-optional-field -> executor-warn triad
A pure `readonly`-returning detector set on `CoreResult` as an optional field (`[] -> undefined`), rendered only by the Nx executor adapter as one `logger.warn`; core stays pure (no console/process).

**When to use:** Adding a verdict-neutral advisory signal. The simplest variant reads the diagnostics already available at the finalize seam (no walk threading); a config-derived variant threads through walk-references.
**Source:** 20-01-SUMMARY.md, 20-02-SUMMARY.md

### const-variable verdict-neutrality tripwire
Introduce a new advisory field via a `const` variable (not a fresh literal) so TS excess-property checks would fire if it leaked into the verdict input; pair with `git grep -c <field> evaluate-result.ts` = 0.

**When to use:** Any additive `CoreResult` field that must be provably excluded from the pass/fail verdict.
**Source:** 20-01-SUMMARY.md, 20-VERIFICATION.md

### Non-brittle integration assertions
Assert presence + `errorCount` strictly greater than the flagged set, never exact counts against fixture source content.

**When to use:** Real-compiler integration specs over hermetic fixtures, so incidental fixture edits do not make the test flaky (see surprise IN-02 for the exact-count trade-off).
**Source:** 20-01-SUMMARY.md

### Real-OSS Gate B three-leg tarball verification
Pack the built DIST tarball (never the source root or the published artifact), install into a throwaway external checkout, and run three legs: baseline (advisory fires, run fails), fix (`"types": ["vite/client"]` self-gates the advisory to 0), planted plain-missing (still errors, never flagged).

**When to use:** Empirically re-confirming no-false-pass on a real project before a release, beyond the hermetic fixtures.
**Source:** 20-05-SUMMARY.md

---

## Surprises

### Gate B: vite/client dropped TS2307 229 -> 2, and the 2 survivors were correct
On radix-ng/primitives, adding `"types": ["vite/client"]` drove the `?query` TS2307 to 0, dropping total TS2307 from 229 to 2 -- and the 2 survivors are genuine plain-missing modules (`react` in `manager.tsx`, a generated `../documentation.json`) that correctly keep failing because they have no `?`.

**Impact:** Confirmed the wildcard blind spot documented in Signal 1 holds exactly (it resolves `*?query` specifiers only) and that the fix masks nothing real. Count was 226 vs spike 009's 227 -- benign repo drift.
**Source:** 20-05-SUMMARY.md

### Three TS6 codes share the "Cannot find module" prefix
TypeScript 6.0.3 emits 2307 (plain), 2732 (resolveJsonModule hint), and 2792 (moduleResolution hint) all with the "Cannot find module '{0}'" prefix.

**Impact:** A message-only match would have captured the 2732/2792 hints; the `code === 2307` gate must run first (Pitfall 2). Drove the gate ordering and a dedicated unit test.
**Source:** 20-VERIFICATION.md, detect-bundler-query-imports.ts

### The engine/executor/docs work was minutes; the gates dominated
Per the SUMMARY metrics, 20-01/20-02/20-03 each landed in roughly 3-5 minutes, while Gate A (~25 min) and the Gate B real-repo run dominated the phase's wall-clock.

**Impact:** For a small additive change riding a well-worn pattern, the verification/CI/real-repo gates are the real cost -- not the implementation.
**Source:** 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md
