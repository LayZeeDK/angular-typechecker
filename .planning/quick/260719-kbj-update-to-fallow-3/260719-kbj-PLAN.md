---
phase: 260719-kbj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - .fallowrc.jsonc
  - .planning/PROJECT.md
  - .planning/codebase/STACK.md
autonomous: true
requirements:
  - fallow-3-migration
must_haves:
  truths:
    - "`npx fallow --version` reports 3.6.0; `npm run fallow` (= `fallow audit --format human --base origin/main`, new-only gate) exits 0 with our advanced .fallowrc.jsonc loaded clean."
    - "Our advanced setup is preserved: every .fallowrc.jsonc key (entry/ignoreExports/ignoreDependencies/rules/health/overrides/duplicates/audit) still valid on 3.6.0; the new-only audit strategy is unchanged (NOT switched to the reference repo's dead-code gate)."
    - "The lockfile diff is scoped to fallow + @fallow-cli/* platform packages only; no unrelated dependency churn."
  artifacts:
    - package.json
    - .fallowrc.jsonc
  key_links:
    - "Research (260719-kbj-RESEARCH.md) proved Fallow 3.0.0 = zero breaking changes; migration = exact-pin bump + lockfile refresh + one config line for the new v3.1.0 dev-dependencies-in-production warn rule."
---

<objective>
Migrate the repo's CI code-quality gate from Fallow 2.103.0 to Fallow 3 (3.6.0), PRESERVING
our advanced `.fallowrc.jsonc` setup and our `audit --gate new-only` diff-based strategy. The
`op-nx/github-cache` reference is a minimal OpenGSD-check example (whole-repo `dead-code`), NOT
a model to copy -- we keep our richer config and strategy. Research verdict: zero breaking
changes; migration is a version bump.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Bump fallow to 3.6.0 (exact), refresh lockfile, silence the new v3.1.0 warn rule</name>
  <files>package.json, package-lock.json, .fallowrc.jsonc</files>
  <action>
    Root package.json: `"fallow": "2.103.0"` -> `"fallow": "3.6.0"` (EXACT, no ^/~ -- repo
    invariant so a release cannot silently flip the gate). `npm install` to refresh the
    lockfile (fallow + @fallow-cli/* -> 3.6.0). .fallowrc.jsonc: add
    `"dev-dependencies-in-production": "off"` to the `rules` block (FAL-13) -- the v3.1.0 rule
    surfaces 6 non-published apps/fixtures/tooling false positives, same class as the sibling
    dev-dep rules already off. NO change to ci.yml, .planning/config.json, or the published
    package manifest.
  </action>
  <verify>
    <automated>npx fallow --version &amp;&amp; npm run fallow &amp;&amp; npx prettier --check package.json .fallowrc.jsonc</automated>
  </verify>
  <done>fallow 3.6.0; `npm run fallow` exit 0, clean report (dev-deps warns silenced); lockfile diff scoped to fallow.</done>
</task>

<task type="auto">
  <name>Task 2: Refresh current-state fallow version references in live docs</name>
  <files>.planning/PROJECT.md, .planning/codebase/STACK.md</files>
  <action>
    Update the CURRENT-state tech-stack references `fallow@2.103.0` -> `fallow@3.6.0`
    (PROJECT.md tech-stack lines; STACK.md). Leave HISTORICAL v0.0.3-tagged records
    ("`fallow@2.103.0` adopted...") as-is -- they correctly record what was true then.
  </action>
  <verify>
    <automated>git grep -n "fallow@3.6.0" -- .planning/PROJECT.md</automated>
  </verify>
  <done>Live-doc current-state version references read 3.6.0; historical records untouched.</done>
</task>

</tasks>

<success_criteria>
- fallow 3.6.0 installed and pinned exact; `npm run fallow` new-only gate exits 0 with our full config.
- Advanced setup + strategy preserved (no config keys dropped, no switch to dead-code).
- Lockfile change minimal; docs current-state version refreshed.
</success_criteria>
