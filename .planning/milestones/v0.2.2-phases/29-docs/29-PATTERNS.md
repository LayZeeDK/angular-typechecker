# Phase 29: Docs - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 3 (1 new, 2 modified)
**Analogs found:** 3 / 3 (all exact)

This is a pure documentation phase (no source/behavior changes). Every fact the
docs assert already exists as a locked source string; the correct move is to
MIRROR the analogs below, not re-author. All three files have exact in-repo
analogs.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` (NEW) | test (doc tripwire) | file-I/O (fs read + `toContain`) | `src/angular-cli-docs.spec.ts` | exact |
| `packages/angular-typechecker/README.md` (MODIFY) | documentation | transform (prose + tables) | `## Angular CLI` section (same file, lines 381-471) | exact (same-file sibling) |
| `CHANGELOG.md` (MODIFY, repo root) | documentation | transform (prose) | `## 0.2.1` entry (same file, lines 5-45) | exact (same-file sibling) |

Note: the role enum has no `docs` value; README/CHANGELOG are classified
`documentation` (prose transform). The spec is a genuine `test`.

## Pattern Assignments

### `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` (NEW, test / doc tripwire)

**Analog:** `packages/angular-typechecker/src/angular-cli-docs.spec.ts` (structure) +
`src/cli/parse-args.spec.ts` (the `parseCliArgs(['--help'])` drift-lock + `not.toContain('npx atc')`).

**Imports + README load + whitespace-normalize** (copy verbatim from `angular-cli-docs.spec.ts` lines 1-24):
```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const readmePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../README.md',
);
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');
```
The `\s+` -> single-space normalize is load-bearing: it lets `toContain`
assertions survive prose re-wrapping. Assert exact-heading strings against raw
`readme` (headings have no internal wrapping); assert prose claims and flag
descriptions against `normalized`.

**Heading + ToC anchor assertions** (pattern from `angular-cli-docs.spec.ts` lines 27-29, `storybook-docs.spec.ts` line 27):
```typescript
it('has a Standalone CLI section heading', () => {
  expect(readme).toContain('## Standalone CLI');
});

it('has the ToC anchor', () => {
  expect(readme).toContain('[Standalone CLI](#standalone-cli)');
});
```

**Canonical-invocation + supply-chain guard** (the load-bearing D-05 assertion; mirrors `parse-args.spec.ts` lines 178-179):
```typescript
it('documents npx angular-typechecker and NEVER npx atc', () => {
  expect(normalized).toContain('npx angular-typechecker');
  expect(normalized).not.toContain('npx atc');
});
```
`not.toContain('npx atc')` is the exact precedent from `parse-args.spec.ts:179`
and `:186`. This is the SC#2 tripwire; keep it.

**HELP_TEXT -> README drift-lock** (closes D-06; the genuine `--help`/README single-source guard). Import the exported `parseCliArgs` (NOT the un-exported `HELP_TEXT`) and iterate the flag tokens:
```typescript
import { parseCliArgs } from './cli/parse-args';
// help.text is the ParsedHelp.text field (parse-args.ts:33-36); ParseResult is
// discriminated on `kind`. parseCliArgs(['--help']) -> { kind: 'help', text }.
const help = parseCliArgs(['--help']);
const helpText = help.kind === 'help' ? help.text : '';

it('documents every HELP_TEXT flag token', () => {
  for (const flag of [
    '-c, --tsConfig',
    '--max-warnings',
    '--fail-fast',
    '--include-deps',
    '--strict',
    '-h, --help',
    '--version',
  ]) {
    expect(normalized).toContain(flag);
  }
});
```
Note the import path is `./cli/parse-args` (this new spec lives in `src/`, one
dir ABOVE `src/cli/`; `parse-args.spec.ts` sits inside `src/cli/` so it imports
`./parse-args`). `parseCliArgs` is exported (`parse-args.ts:96`); `HELP_TEXT` is
module-private, so read it via the `help` result. The `expectKind` helper in
`parse-args.spec.ts` (lines 26-33) is a nicer narrowing pattern if the planner
prefers it over the inline `help.kind === 'help'` check.

**Exit-code table assertion** (D-07):
```typescript
it('states the 0/1/2 exit-code contract', () => {
  expect(normalized).toContain('infrastructure-or-usage');
  // Assert the three codes + their meanings appear in the section.
});
```
Precedent for asserting the exit-code triad: `parse-args.spec.ts` lines 189-195
(`toContain('Exit codes: 0')`, `'1'`, `'2'`).

**Optional (discretionary, Research Open Question 2) CHANGELOG no-leak assertion.** No existing precedent (all current tripwires read README only), so this is optional hygiene. Read the repo-root CHANGELOG via `'../../../CHANGELOG.md'` (spec is in `src/`, so up three: `src/` -> pkg root -> `packages/` -> repo root) and assert the `## 0.2.2` entry contains no internal ids:
```typescript
// discretionary: fails if DOC-01 / CLI-0x / a phase number / SC# leaks in.
```

---

### `packages/angular-typechecker/README.md` (MODIFY, documentation)

**Analog:** the `## Angular CLI` section in the SAME file (lines 381-471). It is
the closest structural template -- a sibling "thin adapter over the same core"
section. Clone its shape.

**Placement (D-01/D-02):** insert the new `## Standalone CLI` section between
`## Angular CLI` (ends line 471) and `## Storybook` (starts line 473). Add the
ToC entry between the existing `Angular CLI` and `Storybook` lines.

**ToC pattern** (README lines 41-42, insert the middle line):
```markdown
- [Angular CLI](#angular-cli)
- [Standalone CLI](#standalone-cli)
- [Storybook](#storybook)
```
GitHub anchor rule: lowercase, spaces -> hyphens -> `#standalone-cli`.

**Section skeleton to mirror** (from `## Angular CLI`, lines 381-420): intro
paragraph, then `###` subsections. The Angular CLI section's own shape:
```markdown
## Angular CLI

You can run angular-typechecker in a plain Angular CLI (`angular.json`) workspace,
with no Nx. ...

### Install and wire every project

```sh
ng add angular-typechecker
```
...
### Run the check

```sh
ng run <project>:typecheck
```

`ng run <project>:typecheck` runs the exact same complete Angular type-check as the
Nx executor ... Everything under [Output](#output) and [Exit codes](#exit-codes)
applies unchanged.
```
Reuse the exact cross-link idiom `[Output](#output)` and `[Exit codes](#exit-codes)`.

**Install-form pattern to mirror for D-03/D-04** (from `## Installation`, lines 79-98).
D-03 leads with the zero-install `npx` form; D-04 shows the installed forms using
the SAME ` ```sh ` fences and the `-Dw` pnpm idiom already in the file:
```sh
npm install --save-dev angular-typechecker    # from line 89
pnpm add -Dw angular-typechecker               # from line 96
```
Canonical uninstalled invocation, used verbatim (matches `HELP_TEXT` synopsis
`parse-args.ts:64`): `npx angular-typechecker -c <tsconfig>`.

**`atc` supply-chain note (D-05, LOAD-BEARING).** Show `atc` ONLY as a
post-install PATH alias, with an inline warning naming `atc@0.0.6` (verified
unrelated 2013 package "Manage fleet spawns" -- RESEARCH.md Package Legitimacy
Audit). NEVER write `npx atc` (the new spec's `not.toContain('npx atc')` fails CI
if it appears).

**Flag reference (D-06)** -- mirror `HELP_TEXT` verbatim (`parse-args.ts` lines 64-82):
```
  -c, --tsConfig <path>   Path to a tsconfig to check (repeatable; required). A
                          single solution tsconfig is reference-walked; two or
                          more are union-checked.
      --max-warnings <n>  Fail the run if the warning count exceeds n (a
                          non-negative integer; 0 fails on any warning).
      --fail-fast         Report only the first failing file.
      --include-deps      Include out-of-project / node_modules diagnostics.
      --strict            Fail on dropped in-graph warnings (verdict only).
  -h, --help              Print this help and exit.
      --version           Print the version and exit.
```
Table-vs-definition-list is planner discretion (D-06), but descriptions MUST
match this text so `--help` and README stay one source.

**Exit-code table (D-07/D-08)** -- use the recommended table from RESEARCH.md
(the `0`/`1`/`2` triad), and explicitly reconcile with the existing `## Exit codes`
section rather than restating it. The existing section (lines 262-277) reads:
```markdown
## Exit codes

The executor reports a pass/fail result that Nx maps to the process exit code ...
- Exit `0`: no error-category diagnostics ... within `maxWarnings`.
- Non-zero: at least one error-category diagnostic ... or warning count exceeded.
- Non-zero: the Angular compiler failed to run at all (an infrastructure error) ...
The exit code signals only pass or fail.
```
D-08 framing: the standalone CLI is the FIRST adapter that owns the literal OS
`2`; Nx/ng collapse `1` and `2` into non-zero. State that relationship; do not
contradict the pass/fail-only text. Cross-link back to `[Exit codes](#exit-codes)`
as the Nx/ng `{success}` view.

**Fence conventions** (RESEARCH.md Architecture Patterns): ` ```sh ` for shell,
` ```jsonc ` for annotated config, ` ```json ` plain JSON, bare ` ``` ` for
captured tool output. ASCII only (`--`, `->`, straight quotes).

---

### `CHANGELOG.md` (MODIFY, repo root, documentation)

**Analog:** the `## 0.2.1` entry in the SAME file (lines 5-45). Clone its shape
exactly.

**Structure to clone** (from `## 0.2.1`, lines 5-45):
```markdown
## 0.2.1

**Angular CLI workspace support.** <one bold lead sentence + one framing paragraph>

### Features

- <what the user gains, consumer language>

### Notes

- <caveats>

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`,
  Node `^22.22.3 || ^24.15.0 || ^26.0.0`. No new runtime dependency.
```

**Placement:** new `## 0.2.2` entry goes ABOVE `## 0.2.1` (line 5), directly
after the file preamble (line 3). Newest-first ordering (0.2.1 sits above
0.2.0 at line 47).

**Dating (D-09, Research Open Q1):** leave `## 0.2.2` UNDATED -- `## 0.2.1` is
undated; the date is stamped at the Release-PR cut (AGENTS.md). Matches sibling.

**Compatibility line (D-10):** repeat the 0.2.1 line VERBATIM (line 44-45):
```markdown
- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`,
  Node `^22.22.3 || ^24.15.0 || ^26.0.0`. No new runtime dependency.
```
Accurate: the CLI adds no npm dependency (Node built-ins only; `node:util` is the
notable one -- RESEARCH.md Standard Stack).

**Content (D-10):** a standalone `angular-typechecker` command runnable via
`npx angular-typechecker` in any repo (no Nx, no Angular CLI needed), same complete
Angular type-check; the flag set; and the `0`/`1`/`2` exit codes as the new
capability (first adapter owning literal exit `2`). Frame as additive.

**Hygiene (D-09, hard rule):** end-user language ONLY. NO internal ids/scopes --
no `DOC-01`, `CLI-0x`, `SC#2`, phase/plan numbers. (Memory
`changelog-readme-end-user-facing`; AGENTS.md changelog-hygiene.)

## Shared Patterns

### Whitespace-normalized fs-read doc tripwire
**Source:** `src/angular-cli-docs.spec.ts` (lines 19-24), `src/storybook-docs.spec.ts` (lines 18-23)
**Apply to:** the new `standalone-cli-docs.spec.ts`
```typescript
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');
// assert headings against `readme`, prose/claims against `normalized`.
```
Pure deterministic fs read -- no compiler load, no build artifact -- runs in the
fast `nx test` loop on every PR including docs-only ones.

### `not.toContain('npx atc')` supply-chain assertion
**Source:** `src/cli/parse-args.spec.ts` lines 179, 186
**Apply to:** the new spec (README section) + the README prose itself must never emit it.

### `parseCliArgs(['--help'])` -> `.text` drift-lock
**Source:** `src/cli/parse-args.spec.ts` lines 176-195; `ParseResult`/`ParsedHelp` type at `parse-args.ts` lines 33-57
**Apply to:** the new spec, to assert each flag token from live HELP_TEXT appears in the README section. `parseCliArgs` is the exported seam; `HELP_TEXT` is private.

### Same-file sibling clone (README section + CHANGELOG entry)
**Source:** README `## Angular CLI` (381-471); CHANGELOG `## 0.2.1` (5-45)
**Apply to:** README `## Standalone CLI`; CHANGELOG `## 0.2.2`. Both are structural
clones of an existing sibling in the same file -- match heading depth, fence
kinds, cross-link idioms, and section ordering (`### Features`/`### Notes`/
`### Compatibility`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | - | - | All 3 files have exact in-repo analogs. |

The only discretionary gap (no precedent): a CHANGELOG-reading assertion in the
new spec -- existing tripwires read README only. Optional hygiene, not required.

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/*.spec.ts` (doc
tripwires), `packages/angular-typechecker/src/cli/` (CLI source of truth),
`packages/angular-typechecker/README.md`, repo-root `CHANGELOG.md`.
**Files scanned:** 7 (angular-cli-docs.spec.ts, storybook-docs.spec.ts,
parse-args.spec.ts, parse-args.ts, README.md, CHANGELOG.md, CONTEXT + RESEARCH).
**Pattern extraction date:** 2026-07-17
