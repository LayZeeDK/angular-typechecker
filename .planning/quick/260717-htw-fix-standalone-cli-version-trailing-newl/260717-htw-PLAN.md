---
phase: quick-260717-htw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/angular-typechecker/src/cli/parse-args.ts
  - packages/angular-typechecker/src/cli/parse-args.spec.ts
  - packages/angular-typechecker/src/cli/main.spec.ts
autonomous: true
requirements: [PR42-N-1]
must_haves:
  truths:
    - "`atc --version` prints the version followed by a trailing newline (symmetric with --help)"
    - "parse-args and main specs drift-lock the exact version stdout string including the newline"
  artifacts:
    - path: packages/angular-typechecker/src/cli/parse-args.ts
      provides: "version result text carries its own trailing newline"
      contains: "packageManifest.version + '\\n'"
  key_links:
    - from: packages/angular-typechecker/src/cli/parse-args.ts
      to: packages/angular-typechecker/src/cli/bin.ts
      via: "version payload carries its own newline; bin.ts writes stdout verbatim (unchanged)"
      pattern: "kind: 'version'"
---

<objective>
Fix PR #42 review finding N-1: the standalone CLI `--version` output is missing a
trailing newline, so `atc --version` prints e.g. `0.2.1` glued to the shell prompt.
This is inconsistent with `--help` (HELP_TEXT ends in `\n`) and with universal CLI
`--version` convention.

Purpose: Make `--version` stdout consistent with `--help` and shell convention.
Output: One-line source change plus two drift-lock spec updates, in a single
bisect-safe commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./AGENTS.md

<interfaces>
<!-- The exact lines to change. Confirmed against the codebase; no exploration needed. -->

packages/angular-typechecker/src/cli/parse-args.ts:129
```ts
    if (values.version === true) {
      return { kind: 'version', text: packageManifest.version };
    }
```

packages/angular-typechecker/src/cli/parse-args.spec.ts:236
```ts
      expect(version.text).toBe(manifestVersion);
```

packages/angular-typechecker/src/cli/main.spec.ts:210
```ts
      expect(result.stdout).toBe(manifestVersion);
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Append a trailing newline to --version output and drift-lock both specs</name>
  <files>
    packages/angular-typechecker/src/cli/parse-args.ts
    packages/angular-typechecker/src/cli/parse-args.spec.ts
    packages/angular-typechecker/src/cli/main.spec.ts
  </files>
  <behavior>
    - parse-args.spec.ts: `parseCliArgs(['--version'])` returns `text === manifestVersion + '\n'` (was `manifestVersion`).
    - main.spec.ts: `run(['--version'])` returns `stdout === manifestVersion + '\n'`, exitCode 0, empty stderr (was `stdout === manifestVersion`).
  </behavior>
  <action>
    Make the version payload carry its own newline, symmetric with HELP_TEXT, so
    run()/bin.ts stay untouched (bin.ts writes stdout verbatim).

    1. parse-args.ts:129 -- change the version result text from
       `packageManifest.version` to `packageManifest.version + '\n'` (single quotes,
       ASCII escape). Leave everything else on that branch as-is.
    2. parse-args.spec.ts:236 -- change the assertion from
       `expect(version.text).toBe(manifestVersion)` to
       `expect(version.text).toBe(manifestVersion + '\n')`.
    3. main.spec.ts:210 -- change the assertion from
       `expect(result.stdout).toBe(manifestVersion)` to
       `expect(result.stdout).toBe(manifestVersion + '\n')`.

    Do NOT touch bin.ts, main.ts run(), HELP_TEXT, e2e specs, or standalone-cli-docs.spec.ts
    (scope pre-verified: no other spec asserts the CLI's own --version stdout). This is
    additive/behavior-consistent, changes no public API, and stays within the v0.2.2
    additive-only charter (ADD-01). Honor repo JS/TS style (singleQuote, ASCII-only).

    Commit all three files together in ONE atomic, bisect-safe commit on branch
    gsd/v0.2.2-standalone-cli. Suggested message:
    `fix(cli): append trailing newline to --version output`.
  </action>
  <verify>
    <automated>npx nx test angular-typechecker && npx nx typecheck angular-typechecker && npx nx lint angular-typechecker && npx nx format:check</automated>
  </verify>
  <done>
    - parse-args.ts version branch returns `packageManifest.version + '\n'`.
    - Both spec assertions expect `manifestVersion + '\n'`.
    - `nx test`, `nx typecheck` (tsc spec+lib+drift), `nx lint` (maxWarnings:0), and
      `nx format:check` all pass green.
    - All three files land in a single commit on gsd/v0.2.2-standalone-cli.
  </done>
</task>

</tasks>

<verification>
Run all four gates against the angular-typechecker project; every one must be green
before committing:
- `npx nx test angular-typechecker`
- `npx nx typecheck angular-typechecker`
- `npx nx lint angular-typechecker`
- `npx nx format:check`
</verification>

<success_criteria>
`atc --version` prints the version followed by a trailing newline; both drift-lock
specs assert `manifestVersion + '\n'`; all four gates pass; the fix and both spec
updates ship in one atomic, bisect-safe commit.
</success_criteria>

<output>
Create `.planning/quick/260717-htw-fix-standalone-cli-version-trailing-newl/260717-htw-SUMMARY.md` when done.
</output>
