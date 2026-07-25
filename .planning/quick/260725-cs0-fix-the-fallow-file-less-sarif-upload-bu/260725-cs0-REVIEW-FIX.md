---
quick_id: 260725-cs0
fixed_at: 2026-07-25
review_path: .planning/quick/260725-cs0-fix-the-fallow-file-less-sarif-upload-bu/260725-cs0-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Quick Task 260725-cs0: Code Review Fix Report

**Fixed at:** 2026-07-25
**Source review:** `.planning/quick/260725-cs0-fix-the-fallow-file-less-sarif-upload-bu/260725-cs0-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (2 Important, 5 Suggestions)
- Fixed: 7
- Skipped: 0

Commits (on `fix/fallow-fileless-sarif`, mirroring the branch's existing script -> spec -> ci.yml
commit shape):

| SHA | Subject |
| --- | --- |
| `6397d65` | `ci(code-scanning): normalize fallow SARIF locations per entry and fingerprint anchored results` |
| `d792c5e` | `test(code-scanning): cover mixed locations arrays and anchored-result fingerprints` |
| `4fdcc46` | `ci(code-scanning): reconcile the fallow SARIF normalizer comment with per-entry anchoring` |

No `fix` commit type was used (the spec lives inside `packages/angular-typechecker/`, so `fix` would
attribute to the released project and bump the 0.x version). No internal plan id in any scope.

## Fixed Issues

### IM-01: A MIXED `locations` array still ships the upload-killing shape

**Files modified:** `tools/ci/normalize-fallow-sarif.mjs`,
`packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts`, `.github/workflows/ci.yml`
**Commits:** `6397d65`, `d792c5e`, `4fdcc46`

**Applied fix.** The per-RESULT `.some()` predicate became a per-ENTRY normalization. The deficiency
test is now `locations.length > 0 && locations.every(hasUri)` -- `every`, not `some`, is what catches
the mixed array GitHub would still reject on `locations[0]`, and the length check is what catches
`locations: []` and the absent key (`every` is vacuously true on an empty array). When deficient,
each entry is mapped individually: a usable entry passes through byte-unchanged, a deficient one is
replaced with the region-less `.fallowrc.jsonc` anchor, and an absent/empty array still receives
exactly one fallback. The `usable`-entry predicate was lifted into a documented `hasUri()` helper so
the loop body stays readable and the `every`/`map` pair cannot drift apart.

Prose reconciled in all three places that overstated the old behaviour:

- the header's "give every location-deficient result a region-less fallback location" now reads
  "`locations` ENTRY", and a dedicated `WHY per ENTRY rather than per result` block explains that
  GitHub derives an alert's location from `locations[0]`;
- the inline "One condition covers all three deficiency shapes" comment now states exactly which
  check catches which shape, including the mixed case;
- `ci.yml`'s "every location-deficient result" now reads "every location-deficient `locations`
  ENTRY", with two added sentences on the `locations[0]` rationale and on fingerprinting.

`ci.yml` remains a COMMENT-ONLY change: the `produced` contract, the
`Assert fallow SARIF was produced (non-fork PR)` step, the no-`category` upload, the
`head.repo.fork == false` gate, `FALLOW_AUDIT_BASE`, and every `angular-typechecker` / red-proof path
are byte-unchanged.

**Note on the lossy `uriBaseId`-only shape** (the review's "related, informational" item): left as-is
deliberately. fallow never emits it (84/84 located results carry a plain `uri`), and widening the
predicate would trade a real hazard for a hypothetical one. The new `hasUri()` JSDoc names the exact
condition it tests, so a future widening cannot happen by accident.

### IM-02: Co-located file-less results carry no `partialFingerprints`

**Files modified:** `tools/ci/normalize-fallow-sarif.mjs`,
`packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts`, `.github/workflows/ci.yml`
**Commits:** `6397d65`, `d792c5e`, `4fdcc46`

**Path taken: IMPLEMENTED the fingerprint** (not the honest-limitation note).

Every result that receives a synthesized location also receives
`partialFingerprints['normalizedFallowFingerprint/v1']` -- a `sha256` over the newline-joined
`ruleId` + `message.text`, assigned with `??=` so a fingerprint fallow already supplied is never
clobbered. The key is versioned like the in-repo precedent (`atcFingerprint/v1`) and like GitHub's own
`primaryLocationLineHash/v1`, so the tuple can be revised later without silently re-keying every
existing alert. `node:crypto` is a builtin -- no new dependency.

**Why this path rather than the honest-limitation note.** The stability objection was weighed
explicitly and does not hold up:

- The fingerprint is byte-stable across runs for unchanged input. It changes only when the finding
  itself changes -- fallow's clone-group message carries the line and instance counts, so a message
  change means the clone group genuinely changed.
- That is the SAME churn characteristic the cited in-repo precedent already accepts:
  `sarif-report.ts`'s `fingerprintOf` includes `line` and `column`, so a shipped alert re-keys
  whenever the diagnostic moves. This repo has been running that trade since Phase 35.
- The failure modes are not symmetric. Churn closes an alert and opens a replacement -- noisy, and
  visible. Collapse makes clone groups 2..N disappear with no trace, which is the exact silent drop
  CONTEXT.md decision 2 forbids ("a dropped finding is worse than the current loud failure"). Trading
  a visible failure for an invisible one is the wrong direction.
- `ruleId` + `message.text` is the whole distinguishing surface available: after anchoring, every one
  of these results shares an identical ruleId and an identical region-less location, and the SARIF
  result carries no other field.

The header's `mirrors the shipped reporter's own file-less fallback` claim -- previously true of the
anchor half only -- is now accurate, and a dedicated `WHY a synthesized fingerprint` block spells out
both halves of the precedent and names the churn characteristic openly rather than implying the
fingerprint is inert.

### SG-01: The header's cwd rationale is copied from `merge-sarif.mjs`

**Files modified:** `tools/ci/normalize-fallow-sarif.mjs`
**Commit:** `6397d65`

**Applied.** The sentence now ends at "(it reads/writes `fallow.sarif` relative to cwd)". This script
computes no URI from cwd -- fallow's URIs are already in the file and `FALLBACK_URI` is a hardcoded
relative literal -- so the borrowed "so `artifactLocation` URIs stay repo-relative" clause was simply
false here.

### SG-02: "all 98 existing analyses" is an undated snapshot

**Files modified:** `tools/ci/normalize-fallow-sarif.mjs`
**Commit:** `6397d65`

**Applied.** Now reads "every existing analysis reports exactly that: 98/98 as of 2026-07-25". Keeps
the evidence while making the count self-dating, so a future reader seeing 130 analyses does not read
the comment as stale and distrust the surrounding (correct) reasoning.

### SG-03: "the verbatim port of the inline `node -e`"

**Files modified:** `tools/ci/normalize-fallow-sarif.mjs`
**Commit:** `6397d65`

**Applied.** Now "an effect-equivalent port of". The id SCHEME is byte-identical (which is the frozen
part), but the code uses `??` and `for...of .entries()` rather than `||` and `forEach`, and the
divergence on `runs: 0` (throw vs silent no-op) is a deliberate improvement under `bash -e`. The
weaker word stops anyone "restoring" the `||` in the name of fidelity.

### SG-04: Spec assertions throw a TypeError on the `locations: []` regression

**Files modified:** `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts`
**Commit:** `d792c5e`

**Applied at all three sites** (`?.[0]?.physicalLocation`). `?.[0]` short-circuits only when
`locations` is nullish, so a regression on the empty-array shape produced an opaque
`Cannot read properties of undefined` instead of the intended `expected undefined to be truthy`. The
guard still fired either way; this is purely diagnostic quality -- and it now matters more, because
the new per-entry loop reads more entries.

### SG-05: Vacuum-able nested loop, and the "one-line swap" claim spans two files

**Files modified:** `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts`,
`tools/ci/normalize-fallow-sarif.mjs`
**Commits:** `d792c5e`, `6397d65`

**(a) Applied.** `expect(output.runs.flatMap((run) => run.results)).toHaveLength(5)` now pins the
result count before the nested loop, so a transform that DROPPED results can no longer pass by making
the inner loop iterate zero times. This closes a locked decision (PLAN truth 2, "No finding is
dropped") that had no direct assertion.

**(b) Applied.** The header now reads "stays one load-bearing line (the spec pins the expected value,
so update it too)". `FALLBACK_URI` remains ONE named constant -- the `package.json` swap is untouched
in difficulty, the comment just no longer overstates it as a single-file edit.

## New regression coverage

Both fixes would FAIL if reverted -- proven, not assumed: reverting
`tools/ci/normalize-fallow-sarif.mjs` to its pre-fix state and re-running the spec produced
`AssertionError: expected undefined to be truthy` (the mixed array's `locations[0]` had no uri). The
script was then restored and the full suite re-run green.

Added to the fixture:

- **Run 3, a MIXED array** `[{}, {located with region}]` -- the shape the old `.some()` predicate
  passed through untouched. It also carries a fallow-supplied
  `partialFingerprints: { fallowFingerprint: 'def456' }`, which gives the `??=` its own coverage
  (previously the only fingerprinted fixture result was a LOCATED one that never enters the branch).

Added assertions:

- assertion 3 now iterates every ENTRY of every result, not just `locations[0]` -- while still
  asserting `locations[0]` explicitly, so a regression to a `.some()`-style per-result predicate fails
  here;
- assertion 3 opens with the `toHaveLength(5)` never-drop count (SG-05a);
- **3b** deep-equals the mixed result's `locations` against `[anchor, original usable entry]` --
  proving the usable entry survives byte-unchanged, in place, un-reordered;
- **3c** asserts every anchored result ends up with a fingerprint AND that all of them are distinct
  (run 2's two results share a ruleId and, post-anchor, an identical location -- exactly the collapse
  pair);
- **3d** asserts the fallow-supplied fingerprint on the mixed result was NOT overwritten (`??=`, not
  `=`).

All five original assertions still pass; the id-scheme guard extends to `fallow/3`.

## Verification

| Check | Result |
| --- | --- |
| `npx nx test angular-typechecker` | PASS -- 59 files / 593 tests |
| `npx nx typecheck angular-typechecker` | PASS |
| `npx nx lint angular-typechecker` (`maxWarnings: 0`) | PASS -- still no `tools/ci` import |
| `npx nx format:check` | PASS (the script was `prettier --write`n after authoring) |
| `act --validate` | PASS (exit 0; only the expected no-Docker warning) |
| `npm run fallow` | PASS -- no issues in the changed files; no `entry` / `duplicates.ignore` needed |
| `node --check tools/ci/normalize-fallow-sarif.mjs` | PASS |
| Reverted-script proof | Spec FAILS as intended, then restored and re-run green |
| `bash tools/act/act-compat.sh` | **SKIPPED** -- no Docker daemon on this machine (pre-existing environment gap, per the task brief) |

Ran twice: once inside an isolated worktree (junctioned `node_modules`, Pattern A -- no dependency
changes), then again on the merged main checkout as the authoritative post-merge gate. The junction
was removed link-only (non-recursive `rm`) before `git worktree remove`; the main checkout's
`node_modules` held at 955 entries throughout.

## Untouched by design

- `automationDetails` id scheme -- still exactly `{ id: 'fallow/' + index }` per run (GATE-02 step 0
  orphan hazard).
- `FALLBACK_URI` -- still ONE named constant; the REAL-CI-ONLY `package.json` swap is still one
  load-bearing code line.
- The spec still drives the script via `execFileSync` and imports no `tools/ci` module.
- fallow version, `.fallowrc.jsonc`, and every `angular-typechecker` / red-proof SARIF path.
- No push, no PR, no merge, no ruleset edit, no Code Scanning API call.

## Still REAL-CI-ONLY

Unchanged by this work, and deliberately not faked locally: whether GitHub accepts a DOTFILE
`artifactLocation.uri`, and whether the synthesized `partialFingerprints` actually keep co-located
clone groups as distinct alerts. Both need a PR whose diff contains a real fallow finding --
`Upload fallow SARIF` reaching `Analysis upload status is complete.` with no `locationFromSarifResult`,
then `gh api ".../code-scanning/alerts?tool_name=fallow"` showing N alerts for N clone groups. A green
`ci` on a clean-diff PR is not evidence.

---

_Fixed: 2026-07-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
