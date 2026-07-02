---
quick_id: 260702-hsv
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [FAL-01, FAL-02, FAL-03, FAL-04]
files_modified:
  - .fallowrc.jsonc
  - packages/angular-typechecker/src/core/walk-references.ts
must_haves:
  truths:
    - "`npx fallow audit --format human --base origin/main` (the exact CI `fallow` job command) exits 0 on the cumulative v0.1.0 diff."
    - "No product-code fallow gate is weakened: unused-files stays error for non-spec product files; unlisted-dependencies stays error for the published package; complexity stays gated for packages/angular-typechecker/src/**/*.ts (non-spec); duplication stays gated everywhere except the one reviewed D-05 mirror."
    - "No shipped engine logic changes -- walk-references.ts is comment-only (a fallow-ignore directive + rationale); the reason union and all behavior are byte-unchanged."
    - "nx format:check, nx lint angular-typechecker (maxWarnings:0), and nx test angular-typechecker are all green."
  artifacts:
    - path: ".fallowrc.jsonc"
      provides: "Targeted test-scaffolding suppressions: entry (2 drift files), ignoreDependencies (@angular/core), health.ignore (test/fixture complexity), overrides (spec unused-files, fixture/dev-lib unrendered+inputs)"
      contains: "extended-catalog.drift.ts"
    - path: "packages/angular-typechecker/src/core/walk-references.ts"
      provides: "Inline code-duplication suppression on the D-05 emit-neutralizing mirror, with rationale"
      contains: "fallow-ignore-next-line code-duplication"
  key_links:
    - from: ".fallowrc.jsonc"
      to: ".github/workflows/ci.yml fallow job"
      via: "npx fallow audit --format human --base origin/main (new-only gate)"
      pattern: "fallow audit"
---

<objective>
Make the CI `fallow` quality gate pass on PR #15 (the cumulative v0.1.0 milestone diff)
WITHOUT weakening the gate for real product code and WITHOUT refactoring shipped, verified
engine code right before release. All gating findings are test-scaffolding false-positives
except one intentional, documented D-05 contract-mirror duplication.
</objective>

<tasks>
<task type="auto">
  <name>Task 1 (FAL-01/02/03): targeted .fallowrc.jsonc suppressions for test-scaffolding false-positives</name>
  <files>.fallowrc.jsonc</files>
  <action>
Add, with rationale comments: (a) `extended-catalog.drift.ts` to `entry` (Phase 12 DRIFT-01
tripwire, tsconfig.drift.json-only reachability, same class as compiler-cli-types.drift.ts);
(b) `ignoreDependencies: ["@angular/core"]` (declared at root; imported only by
fixtures/dev-libs; published pkg uses @angular/compiler-cli); (c) `health.ignore` for
`e2e/**`, `fixtures/**`, `**/*.spec.ts`, `**/*.int.spec.ts` (test/fixture complexity only);
(d) an override `unused-files: off` for `**/*.spec.ts` + `**/*.int.spec.ts` (Vitest entry
points); (e) broaden the fault-isolation `unrendered-components`/`unused-component-inputs`
override to `fixtures/**`, `e2e/**/fixtures/**`, `libs/**`. Keep it Prettier-clean.
  </action>
  <verify>
    <automated>FALLOW_AUDIT_BASE=origin/main npx fallow audit --format human --base origin/main</automated>
    <automated>npx nx format:check</automated>
  </verify>
  <done>Config additions present with rationale; fallow moves toward exit 0; format:check green.</done>
</task>

<task type="auto">
  <name>Task 2 (FAL-04): scoped inline duplication suppression on the D-05 mirror</name>
  <files>packages/angular-typechecker/src/core/walk-references.ts</files>
  <action>
COMMENT-ONLY. Add `// fallow-ignore-next-line code-duplication` immediately before the
per-leaf `ng.performCompilation({...})` call (the emit-neutralizing block documented as
"verbatim from run-typecheck.ts"), preceded by a rationale comment: the block is a deliberate
D-05 contract-mirror of the direct-leaf path; suppress this one reviewed instance rather than
refactor verified engine code pre-release; product-code duplication elsewhere stays gated. Do
NOT change any logic, the SkippedReference union, or the shipped label.
  </action>
  <verify>
    <automated>FALLOW_AUDIT_BASE=origin/main npx fallow audit --format human --base origin/main</automated>
    <automated>NX_DAEMON=false npx nx run-many -t lint test -p angular-typechecker --skip-nx-cache</automated>
  </verify>
  <done>fallow exits 0 ("No issues in 347 changed files"); lint + 239/239 tests green; walk-references.ts diff is comment-only.</done>
</task>
</tasks>

<verification>
- `FALLOW_AUDIT_BASE=origin/main npx fallow audit --format human --base origin/main` -> exit 0.
- `npx nx format:check` -> exit 0. `npx nx lint angular-typechecker` -> clean (maxWarnings:0).
- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` -> 239/239.
- `git diff` on walk-references.ts is comment-only (no logic).
</verification>
