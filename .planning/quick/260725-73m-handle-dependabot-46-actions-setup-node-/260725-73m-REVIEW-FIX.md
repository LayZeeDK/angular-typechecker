---
quick_id: 260725-73m
fixed_at: 2026-07-25
review_path: .planning/quick/260725-73m-handle-dependabot-46-actions-setup-node-/260725-73m-REVIEW.md
reviewed_commit: 22cd6e9a0bb5d04b4d0cf95aee69b18717970914
fix_commit: 3e9bf8725fb255e489fb03761a20dfb0e1972ee3
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Quick task 260725-73m: Code Review Fix Report

**Fixed at:** 2026-07-25
**Source review:** `260725-73m-REVIEW.md` (verdict: CHANGES REQUIRED, 2 critical / 4 important / 3 suggestion)
**Fix commit:** `3e9bf87` -- `docs: state the CodeQL advanced-setup migration as pending, not done`
**Files modified:** `AGENTS.md`, `.github/workflows/codeql.yml`
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (C1, C2, I1, I2, I3, I4, S1, S2, S3)
- Fixed: 9
- Skipped: 0

All nine landed in ONE atomic commit. They are a single semantic correction --
"the migration is pending, and #46 is not fork evidence" -- threaded through six
locations in `AGENTS.md` plus the `codeql.yml` header. Splitting them would have
produced intermediate commits in which `AGENTS.md` contradicted itself, which the
file's own "Changing this file" rule treats as the defect being fixed.

## The central fact the whole fix turns on

Verified before editing and unchanged by it: the migration is **committed but not
live**.

- `code-scanning/default-setup` -> `state: configured`
- every CodeQL analysis on `refs/heads/main` still carries
  `analysis_key: dynamic/github-code-scanning/codeql:analyze`
- the branch is unpushed, so `.github/workflows/codeql.yml` has never run

Therefore the default-setup analyses on `main` are **LIVE, not orphaned**, and must
not be deleted. Every sentence written here is consistent with that.

## Fixed findings

### C1 (Critical) -- STATUS and the intro stated the migration as DONE

**Locations:** `AGENTS.md` STATUS block, the PR-only intro, **and two the review did
not list** (see "Deliberate deviations" below).

STATUS now reads `COMMITTED but NOT YET LIVE`, cites both pieces of live evidence
(`state: configured`, the `dynamic/...` analysis key), and states explicitly that the
default-setup analyses on `main` "are LIVE, NOT orphaned, and must NOT be deleted".
The intro no longer attributes the required checks to `codeql.yml`; it attributes them
to "whichever CodeQL setup is active: TODAY that is DEFAULT setup", while keeping the
BYTE-LOAD-BEARING job-name warning intact for after the migration.

The guard was also planted **inside step 0**, where the destructive instruction
actually lives -- a reader who jumps straight to the runbook never sees STATUS. Step 0
now says instance (2) is "still PENDING" and that "the CodeQL analyses on `main` today
are LIVE, not orphaned -- do NOT delete them".

### C2 (Critical) -- item 6 retired a fork conclusion that is still true

Both defects addressed:

- **(a) #46 is not fork evidence.** Reframed as proving the **TOKEN half** only, with
  the reason stated: `head.repo.fork` is FALSE for a Dependabot PR, and GitHub's "as if
  opened from a fork" wording "covers the token and secrets only and does NOT set
  `head.repo.fork`".
- **(b) The still-true conclusion is restored**, attributed to the real cause: ci.yml's
  own `github.event.pull_request.head.repo.fork == false` gates on both uploads, naming
  both steps. Since `angular-typechecker` is a REQUIRED tool, real forks are blocked
  "by this repo's OWN gate, independently of whatever CodeQL does after the migration".
- The second-order risk is closed explicitly: "Do NOT remove ci.yml's fork gates on the
  strength of the #46 result -- #46 proves only that a read-only token permits the
  upload, never that a fork PR's upload would be accepted."

### I1 (Important) -- item 7's "(proven)" contradicted item 6

Now `(proven for Dependabot -- see item 6; for real external forks the block has a
second, independent cause, also in item 6)`.

### I2 (Important) -- non-sequitur "outside the exemption -> so never scheduled"

Split into effect and reason: the EFFECT is proven (#64/#65 vs #46/#59), the REASON is
INFERENCE, "and the `pull_request` exemption governs upload PERMISSION, not run
SCHEDULING, so it cannot by itself explain a run that was never created."

### I3 (Important) -- ordering constraints framed as hypothetical

`THE MIGRATION ITSELF IS STILL PENDING (see STATUS)` + `Two ORDERING constraints bite,
NOW and on any future re-run`. Constraint (b) now spells out the live hazard: deleting
"including now, while default setup is still the ONLY producer" causes step 0's
PERMANENT block.

### I4 (Important) -- unsupported "likelier of the two to recur"

Clause deleted. Replaced with the factual status of each instance: (1) "ALREADY
orphaned and cleaned up", (2) "still PENDING".

### S1 (Suggestion) -- non-verbatim GitHub Docs quote

Corrected to the verbatim source wording -- "always allows **the** uploading of results
when the `pull_request` event triggers the action run" -- in **both** `AGENTS.md` and
`.github/workflows/codeql.yml`'s header comment.

### S2 (Suggestion) -- one timestamp attributed to both uploads

Split: `angular-typechecker 2026-07-25T02:58:33Z, fallow 02:58:39Z`. The
`angular-typechecker-red-proof` upload stays omitted (not gate-required).

### S3 (Suggestion) -- orphan half-lines

Both paragraphs re-wrapped to the surrounding ~95-column width; max line width in the
GATE-02 region is now 93. Re-wrapping the step 0 insertion exposed two further ragged
lines, which were reflowed too.

### Cross-cutting note -- ordering stated once

Item 7 is now the single source: "This item is the SINGLE place the ordering is stated
-- step 0 and item 6 point here." Step 0 points there ("item 7 is the single place that
states when the CodeQL deletion becomes safe"); item 6 points there ("item 7 owns its
ordering ... Do not run step 0's CodeQL cleanup before then").

## Deliberate deviations from the review's proposed wording

1. **Fixed a `))` typo in the review's own C1 replacement text.** The proposed intro
   snippet closes with a doubled paren; re-balanced.

2. **Extended C1 to two locations the review did not flag.** Step 1's parenthetical
   said CodeQL's "analyses **now come from** the committed advanced-setup workflow ...
   not from default setup", and item 7 said "If that migration is ever re-run" -- both
   the same false-liveness claim C1 targets. Fixing only the two cited lines would have
   left the contradiction in the runbook itself. Step 1 now reads "DEFAULT setup today,
   the committed `.github/workflows/codeql.yml` after item 7's still-PENDING migration".

3. **Applied the I2 correction to `codeql.yml`'s header comment as well**, not just the
   S1 quote fix the review scoped there. The header carried the same
   exemption-causes-scheduling non-sequitur; leaving it would reintroduce the defect in
   the file a reader consults first. Also added one clause noting #46 is not a fork and
   that ci.yml's fork gates must stay -- the C2 second-order risk, placed where someone
   would act on it.

4. **Kept the substance of the old EVIDENCE BOUNDARY rather than deleting it.** The
   review's replacement drops the paragraph; the "untested here" fact is still true and
   now sits in its accurate frame: "Whether GitHub would ACCEPT a fork-PR upload is
   untested here, precisely because that gate prevents the attempt." The old framing
   ("the expectation that fork PRs now produce CodeQL analyses is an INFERENCE") was
   dropped, since the block no longer depends on that open question.

5. **Restated the human-only rule at item 7's constraint (a)** -- "the maintainer
   disables default setup" plus "Disabling default setup is itself human-only, per the
   prohibition above". Additive; no rule weakened.

## Verification

| Check | Result |
| --- | --- |
| `npx prettier --check AGENTS.md .github/workflows/codeql.yml` | PASS |
| `act --validate` (codeql.yml parses) | PASS, exit 0 |
| Runbook steps 2, 3, 4, 5 byte-identical | PASS -- `7292cefa3d31`, `c88929c1fa27`, `bc558b4b5c42`, `664eca4e915c`, reproducing the reviewer's SHAs exactly |
| Everything after `## Parallel execution` byte-identical | PASS -- `1f62ba276c91` |
| 16 preserve-verbatim strings present | PASS |
| 6 banned strings absent (incl. all four false-liveness claims + the non-verbatim quote in both files) | PASS |
| Negative control: same assertions run against `22cd6e9` | FAIL 17/22 as expected -- the assertions discriminate |
| Human-only prohibition intact (`disabling default setup, or switching default -> advanced`) | PASS |
| Max line width, GATE-02 region | 93 columns |
| `git status --porcelain` | only the untracked `.planning/quick/` dir; the two intended files committed |
| Unpushed | PASS -- `origin/main...HEAD` = `0 4`, nothing pushed |

Steps 0, 1, 6, 7 changed -- exactly the four intended.

**A caveat worth flagging:** the first hash script matched `AGENTS.md:112`
(`1. **When there is no releasable ...`) instead of the GATE-02 runbook, so its
"steps 2-5 unchanged" result was vacuous for steps 2 and 3 -- steps 4 and 5 matched the
reviewer only because no earlier `4. **` / `5. **` exists. Caught by noticing step 1's
hash did not move after step 1 was edited. The rerun scopes extraction to the GATE-02
section and then reproduced all four of the reviewer's SHAs on the old blob, which is
what makes the invariance claim above trustworthy. Anyone re-verifying should scope to
the section, not grep the whole file.

## Not done (out of scope by constraint)

No push, no PR, no merge, no ruleset edit, no default-setup change, no Code Scanning
API call. All remain human-only maintainer actions. The migration is still PENDING --
which is now exactly what the documentation says.

---

_Fixed: 2026-07-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
