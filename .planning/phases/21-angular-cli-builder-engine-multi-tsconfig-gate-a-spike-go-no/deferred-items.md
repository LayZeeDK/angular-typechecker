# Deferred / out-of-scope items -- Phase 21

Discoveries logged during execution that are OUT OF SCOPE for the current plan
(pre-existing, in files this plan does not own). Per the executor SCOPE BOUNDARY:
logged here, NOT fixed.

## Plan 21-02

- **RESOLVED (orchestrator, post-21-02):** `.claude/skills/spike-findings-angular-typechecker/SKILL.md`
  fails `nx format:check`. Pre-existing Prettier drift from 21-01's skill regeneration
  (commit `57c391c`); NOT touched by any 21-02 commit; unrelated to ENG-01. Correctly logged
  out-of-scope by the 21-02 executor. Fixed at the Wave 2/3 boundary via
  `nx format:write --files=.claude/skills/spike-findings-angular-typechecker/SKILL.md`
  (whitespace-only reformat; no semantic change to the skill, so no `/reload-skills` needed);
  `nx format:check` now green.
