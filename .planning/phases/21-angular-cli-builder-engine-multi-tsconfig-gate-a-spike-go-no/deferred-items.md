# Deferred / out-of-scope items -- Phase 21

Discoveries logged during execution that are OUT OF SCOPE for the current plan
(pre-existing, in files this plan does not own). Per the executor SCOPE BOUNDARY:
logged here, NOT fixed.

## Plan 21-02

- **`.claude/skills/spike-findings-angular-typechecker/SKILL.md` fails
  `nx format:check`.** Pre-existing Prettier drift on this branch from the external
  skill regeneration/reload (the skill "was just regenerated + reloaded" per the
  execution prompt). NOT touched by any 21-02 commit; unrelated to ENG-01. Fixing a
  regenerated skill artifact is out of this plan's scope and risks conflicting with the
  skill-generation tooling. Whoever regenerates the skill (or a follow-up
  `nx format:write`) should reformat it before the phase's format:check CI gate is
  relied upon green.
