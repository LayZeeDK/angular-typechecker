# Phase 29: Docs - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** `--auto --analyze --chain` (single-pass autonomous; all gray areas auto-locked)

<domain>
## Phase Boundary

Document the standalone CLI that shipped in Phases 25-28. Two deliverables, no
code changes:

1. A new README `## Standalone CLI` section (installation, the full flag set,
   and the `0`/`1`/`2` exit-code contract table).
2. A curated public `## 0.2.2` CHANGELOG entry in end-user language.

**In scope:** prose + tables in `packages/angular-typechecker/README.md` and the
repo-root `CHANGELOG.md` describing the already-built CLI.

**Out of scope:** any change to CLI behavior, flags, exit codes, or packaging
(all locked in Phases 25-28); the release cut itself (a separate Release PR per
`AGENTS.md`); `--watch` docs (CLIX-01 is deferred, no engine yet).
</domain>

<decisions>
## Implementation Decisions

### README section placement
- **D-01:** Add `## Standalone CLI` immediately AFTER `## Angular CLI`
  (currently line 381) and BEFORE `## Storybook`. This groups the three thin
  adapters over the same core in adapter order (Nx executor -> Angular CLI
  builder -> standalone CLI), matching how the milestone frames the CLI as "a
  third thin adapter."
- **D-02:** Add a matching `- [Standalone CLI](#standalone-cli)` entry to the
  `## Contents` table of contents (line 28), positioned between the
  `Angular CLI` and `Storybook` entries to mirror the section order.

### Installation methods
- **D-03:** Canonical uninstalled invocation is **`npx angular-typechecker -c <tsconfig>`**
  (SC#2). Show it first, as the zero-install entry point that works in any repo
  with no Nx / no Angular CLI.
- **D-04:** Also show the installed form: `npm install --save-dev angular-typechecker`
  (or the `-Dw` pnpm / yarn equivalents already used elsewhere in the README),
  then run via the `angular-typechecker` bin, with `atc` as the short PATH alias.

### `atc` supply-chain guidance (LOAD-BEARING — SC#2)
- **D-05:** Docs NEVER instruct `npx atc`. `atc` appears ONLY as a post-install
  PATH shorthand (after the package is a local dependency, `atc` resolves to the
  installed bin). Include an explicit inline note that `npx atc` would fetch the
  unrelated published package `atc@0.0.6` — a supply-chain hazard — so the
  uninstalled path is always `npx angular-typechecker`.

### Flag reference format
- **D-06:** Document the flag set by mirroring the CLI's own `HELP_TEXT`
  (`parse-args.ts` lines 64-82) as the single source of truth, so the README and
  `--help` never drift. Flags to document, verbatim from HELP_TEXT:
  `-c, --tsConfig <path>` (repeatable; required; single = solution reference-walk,
  two+ = union), `--max-warnings <n>`, `--fail-fast`, `--include-deps`,
  `--strict`, `-h, --help`, `--version`. Present as a definition list or table —
  planner's discretion, but the descriptions must match HELP_TEXT text.

### Exit-code contract table (SC#1)
- **D-07:** The `## Standalone CLI` section gets its OWN exit-code table with the
  three literal codes: `0` clean / `1` verdict-fail (type/template/NG8xxx errors,
  warnings-exceeded, or coverage-incomplete) / `2` infrastructure-or-usage
  (compiler failed to run, missing/unreadable tsconfig, unknown flag, missing
  required `--tsConfig`, non-integer `--max-warnings`).
- **D-08:** Do NOT contradict the existing `## Exit codes` section (line 262),
  which describes only pass/fail (`0` vs non-zero) because the Nx executor and
  Angular CLI builder surface a `{success}` boolean and let the host map it. The
  standalone CLI is the FIRST adapter that owns the literal OS `2`; the new table
  must make that distinction explicit (CLI splits `1` vs `2`; Nx/ng collapse both
  to non-zero) rather than restating the pass/fail-only text.

### CHANGELOG entry (SC#3)
- **D-09:** Write a curated `## 0.2.2` entry in `CHANGELOG.md`, matching the
  `## 0.2.1` entry's shape (lead paragraph + `### Features` + `### Notes` +
  `### Compatibility`). End-user language only — NO internal ids/scopes (no
  `DOC-01`, no `CLI-0x`, no phase/plan numbers), per the changelog-hygiene rule.
- **D-10:** Entry content: a standalone `angular-typechecker` command you can run
  with `npx angular-typechecker` in any repo (no Nx, no Angular CLI needed),
  running the same complete Angular type-check; the flag set; and the `0`/`1`/`2`
  exit codes as the new capability (owning literal exit `2`). Frame as additive —
  nothing changes for existing Nx / Angular CLI users. `### Compatibility` block
  repeats the 0.2.1 stack line (no new runtime dependency — the CLI uses only
  `node:util`).

### Claude's Discretion
- Exact table-vs-list rendering for the flag reference (D-06), the precise prose
  wording, and whether to show a short worked example (e.g. an npx invocation
  with a planted error -> exit `1`). Keep examples consistent with the README's
  existing tone and the UAT-verified invocations.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirement
- `.planning/ROADMAP.md` — "### Phase 29: Docs" (goal + the 3 success criteria
  that lock D-01..D-10).
- `.planning/REQUIREMENTS.md` — DOC-01 (the single requirement this phase closes).

### Files to edit
- `packages/angular-typechecker/README.md` — target file. Match existing section
  conventions: `## Contents` ToC (line 28), `## Installation` (line 77),
  `## Exit codes` (line 262), `## Angular CLI` (line 381, the closest structural
  analog for the new section), `## Storybook` (line 502).
- `CHANGELOG.md` (repo root) — target file for the `## 0.2.2` entry; match the
  `## 0.2.1` entry (lines 5-45) for structure and voice.

### Source of truth for CLI facts
- `packages/angular-typechecker/src/cli/parse-args.ts` §`HELP_TEXT` (lines 64-82)
  — authoritative flag names, short flags, descriptions, and the
  `Exit codes: 0 clean / 1 verdict-fail / 2 infrastructure-or-usage` line. Docs
  must mirror this exactly.
- `packages/angular-typechecker/src/cli/bin.ts` — confirms the two bin names
  (`angular-typechecker` + `atc`) resolve to one compiled `bin.js`.

### Hygiene rules (governing)
- `AGENTS.md` — "The auto-generated changelog renders the commit SCOPE" +
  changelog-hygiene: no internal scopes/ids in a public CHANGELOG; curate before
  release.
- Memory `changelog-readme-end-user-facing` — curated CHANGELOG/README text must
  use consumer language, not internal/board jargon.
- Memory `angular-typechecker-npm-releases-ship-source` — historical: the docs
  describe the SHIPPED artifact; the CLI ships as compiled `.js` under the
  packageRoot fix (0.1.1+).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`## Angular CLI` section** (README lines 381-500): the structural template
  for the new `## Standalone CLI` section — intro paragraph + `###` subsections
  (install / wire / run) + cross-links back to `## Output` and `## Exit codes`.
- **`HELP_TEXT`** (`parse-args.ts` 64-82): copy the flag descriptions from here
  so `--help` and the README are one source.
- **`## 0.2.1` CHANGELOG entry** (lines 5-45): the shape to clone for `## 0.2.2`.

### Established Patterns
- README sections are `##`; subsections `###`. Code fences use ```sh for
  commands. Cross-references use in-page anchors (e.g. `[Exit codes](#exit-codes)`).
- CHANGELOG entries: `## <version>` heading, bold lead sentence, then
  `### Features` / `### Notes` / `### Compatibility`. Some entries are dated,
  some not — 0.2.1 is undated; the actual date is stamped at release time, so the
  planner can leave 0.2.2 undated or date it at the Release PR.

### Integration Points
- The `## Contents` ToC (line 28) must gain the `Standalone CLI` anchor (D-02).
- The new exit-code table must reconcile with, not contradict, the existing
  `## Exit codes` section (D-08).
</code_context>

<specifics>
## Specific Ideas

- Canonical invocation string, used verbatim in docs: `npx angular-typechecker -c <tsconfig>`.
- Explicit anti-pattern to warn against: `npx atc` (fetches unrelated `atc@0.0.6`).
- Exit-code table columns: code | meaning (`0` clean / `1` verdict-fail /
  `2` infrastructure-or-usage), mirroring the HELP_TEXT wording.
</specifics>

<deferred>
## Deferred Ideas

- `--watch` mode documentation — CLIX-01 is deferred (needs the `NgtscProgram`
  incremental engine, WALK-FUT-02). Not built, so not documented.
- A dedicated top-of-README "three ways to run it" comparison (Nx / Angular CLI /
  CLI) — a nice-to-have polish, but the `## How it compares` and per-adapter
  sections already cover it; only add if it falls out naturally.

None of these expand this phase's scope — discussion stayed within DOC-01.
</deferred>

---

*Phase: 29-docs*
*Context gathered: 2026-07-17*
