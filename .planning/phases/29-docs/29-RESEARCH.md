# Phase 29: Docs - Research

**Researched:** 2026-07-17
**Domain:** Technical documentation of an already-shipped CLI surface (README + CHANGELOG)
**Confidence:** HIGH -- every CLI fact verified against the actual shipped source; `atc@0.0.6` verified against the live npm registry.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**README section placement**
- **D-01:** Add `## Standalone CLI` immediately AFTER `## Angular CLI` (currently line 381) and BEFORE `## Storybook`. Groups the three thin adapters in adapter order (Nx executor -> Angular CLI builder -> standalone CLI).
- **D-02:** Add a matching `- [Standalone CLI](#standalone-cli)` entry to the `## Contents` ToC (line 28), positioned between the `Angular CLI` and `Storybook` entries.

**Installation methods**
- **D-03:** Canonical uninstalled invocation is **`npx angular-typechecker -c <tsconfig>`** (SC#2). Show it first, as the zero-install entry point that works in any repo with no Nx / no Angular CLI.
- **D-04:** Also show the installed form: `npm install --save-dev angular-typechecker` (or `-Dw` pnpm / yarn equivalents already used elsewhere in the README), then run via the `angular-typechecker` bin, with `atc` as the short PATH alias.

**`atc` supply-chain guidance (LOAD-BEARING -- SC#2)**
- **D-05:** Docs NEVER instruct `npx atc`. `atc` appears ONLY as a post-install PATH shorthand (after the package is a local dependency, `atc` resolves to the installed bin). Include an explicit inline note that `npx atc` would fetch the unrelated published package `atc@0.0.6` -- a supply-chain hazard -- so the uninstalled path is always `npx angular-typechecker`.

**Flag reference format**
- **D-06:** Document the flag set by mirroring the CLI's own `HELP_TEXT` (`parse-args.ts` lines 64-82) as the single source of truth, so the README and `--help` never drift. Flags to document, verbatim from HELP_TEXT: `-c, --tsConfig <path>` (repeatable; required; single = solution reference-walk, two+ = union), `--max-warnings <n>`, `--fail-fast`, `--include-deps`, `--strict`, `-h, --help`, `--version`. Present as a definition list or table -- planner's discretion, but the descriptions must match HELP_TEXT text.

**Exit-code contract table (SC#1)**
- **D-07:** The `## Standalone CLI` section gets its OWN exit-code table with the three literal codes: `0` clean / `1` verdict-fail (type/template/NG8xxx errors, warnings-exceeded, or coverage-incomplete) / `2` infrastructure-or-usage (compiler failed to run, missing/unreadable tsconfig, unknown flag, missing required `--tsConfig`, non-integer `--max-warnings`).
- **D-08:** Do NOT contradict the existing `## Exit codes` section (line 262), which describes only pass/fail (`0` vs non-zero) because the Nx executor and Angular CLI builder surface a `{success}` boolean and let the host map it. The standalone CLI is the FIRST adapter that owns the literal OS `2`; the new table must make that distinction explicit (CLI splits `1` vs `2`; Nx/ng collapse both to non-zero) rather than restating the pass/fail-only text.

**CHANGELOG entry (SC#3)**
- **D-09:** Write a curated `## 0.2.2` entry in `CHANGELOG.md`, matching the `## 0.2.1` entry's shape (lead paragraph + `### Features` + `### Notes` + `### Compatibility`). End-user language only -- NO internal ids/scopes (no `DOC-01`, no `CLI-0x`, no phase/plan numbers), per the changelog-hygiene rule.
- **D-10:** Entry content: a standalone `angular-typechecker` command you can run with `npx angular-typechecker` in any repo (no Nx, no Angular CLI needed), running the same complete Angular type-check; the flag set; and the `0`/`1`/`2` exit codes as the new capability (owning literal exit `2`). Frame as additive -- nothing changes for existing Nx / Angular CLI users. `### Compatibility` block repeats the 0.2.1 stack line (no new runtime dependency -- the CLI uses only `node:util`).

### Claude's Discretion
- Exact table-vs-list rendering for the flag reference (D-06), the precise prose wording, and whether to show a short worked example (e.g. an npx invocation with a planted error -> exit `1`). Keep examples consistent with the README's existing tone and the UAT-verified invocations.

### Deferred Ideas (OUT OF SCOPE)
- `--watch` mode documentation -- CLIX-01 is deferred (needs the `NgtscProgram` incremental engine, WALK-FUT-02). Not built, so not documented.
- A dedicated top-of-README "three ways to run it" comparison (Nx / Angular CLI / CLI) -- a nice-to-have polish; only add if it falls out naturally.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | A README `## Standalone CLI` section documents installation, the flag set, and the exit-code contract table (`0` clean / `1` verdict-fail / `2` infra-or-usage); canonical uninstalled invocation is `npx angular-typechecker` (docs NEVER instruct `npx atc` -- `atc@0.0.6` is an unrelated published package; `atc` documented only as an installed PATH shorthand). A curated public CHANGELOG entry in end-user language (no internal ids). | Exact flag set + exit-code composition reported below (verbatim from `parse-args.ts` HELP_TEXT and `main.ts`); `atc@0.0.6` verified unrelated on the npm registry; README/CHANGELOG conventions and the existing doc-tripwire test pattern documented for the planner to mirror. |
</phase_requirements>

## Summary

This is a pure documentation phase. The standalone CLI already shipped in Phases 25-28; Phase 29 only describes it. There are no code changes, no new packages, and no runtime behavior to design. Every fact the docs must state is already fixed in the source, so the research value is (1) reporting those facts EXACTLY so the docs mirror the shipped `--help` and exit-code contract without drift, (2) documenting the README/CHANGELOG conventions the new content must match, (3) verifying the load-bearing `atc@0.0.6` supply-chain fact, and (4) identifying the correct Nyquist validation (the repo already has a doc-tripwire test pattern to clone).

The one genuine hazard is the `npx atc` supply-chain trap: `atc@0.0.6` is a real, unrelated 2013 npm package ("Manage fleet spawns"), so `npx atc` would fetch and execute it. The docs must present `npx angular-typechecker` as the only uninstalled invocation and mention `atc` solely as a post-install PATH shorthand. This is already enforced in the CLI's own HELP_TEXT and drift-locked in `parse-args.spec.ts`; the README must not reintroduce the hazard.

**Primary recommendation:** Mirror `HELP_TEXT` (parse-args.ts:64-82) and the `main.ts` two-step exit-code compose VERBATIM into the new README `## Standalone CLI` section; clone the `## 0.2.1` CHANGELOG shape for `## 0.2.2`; add ONE new doc-tripwire test `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` (following the existing `angular-cli-docs.spec.ts` pattern), ideally with a HELP_TEXT-to-README drift-lock via the exported `parseCliArgs(['--help'])`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `## Standalone CLI` README section | Package docs (`packages/angular-typechecker/README.md`) | npm tarball | README.md IS in the package `files` whitelist, so this section ships to npm consumers and the plugin registry listing. |
| `## 0.2.2` CHANGELOG entry | Repo-root docs (`CHANGELOG.md`) | GitHub Release notes | CHANGELOG.md is repo-root and NOT in the package `files` whitelist -- it does NOT ship to npm. It serves repo readers and is the source for the curated GitHub Release notes at the later Release-PR cut. |
| Doc-drift guard | Vitest unit test (`src/*.spec.ts`) | CI `nx test` loop | A pure filesystem-read tripwire; runs in the fast test loop on every PR, including docs-only ones. |

## Standard Stack

**No packages installed this phase.** Pure prose + Markdown tables in two existing files. The only tools touched are the ones already present: the repo's Vitest runner (`@nx/vitest:test`) for the doc-tripwire test, and Prettier for formatting the Markdown.

The CLI being documented **adds no new runtime dependency**. Verified from source:
- `parse-args.ts` imports only `node:util` (`parseArgs`) + the package.json manifest (for `--version`).
- `main.ts` imports only Node built-ins (`node:fs`, `node:path`) + pure `../core/*` modules + the two CLI seams (`./parse-args`, `./console-logger`).
- `bin.ts` imports only `./main`.

The D-10 CHANGELOG line "uses only `node:util`" is accurate as the notable built-in (it is what replaced a hand-rolled parser); the broader true claim is "no new npm dependency -- Node built-ins only." Keep the D-10 wording.

## Package Legitimacy Audit

**No external packages installed -- pure documentation phase.** slopcheck/registry-install verification is N/A.

**Supply-chain verification (load-bearing for D-05 / SC#2):** verified against the live npm registry (`curl -s https://registry.npmjs.org/atc`, 2026-07-17):

| Fact | Value |
|------|-------|
| Package | `atc` |
| Latest version | `0.0.6` |
| Description | "Manage fleet spawns" |
| First published | 2013-03-27 |
| `0.0.6` published | 2013-03-27 |
| Repository | none declared |
| Relation to angular-typechecker | **NONE** -- unrelated 2013 package |

`[VERIFIED: registry.npmjs.org/atc]` `atc@0.0.6` exists and is unrelated. `npx atc` would fetch and execute it. The docs must therefore present `atc` ONLY as a post-install PATH shorthand and NEVER as `npx atc`. This exactly matches the CLI's HELP_TEXT comment (`parse-args.ts` lines 59-63) and is drift-locked in `parse-args.spec.ts` (`expect(help.text).not.toContain('npx atc')`, lines 179/186).

## Architecture Patterns

### README conventions to match (verified from `packages/angular-typechecker/README.md`)

- **Headings:** sections are `##`, subsections `###`.
- **Code fences by kind:** ` ```sh ` for shell commands, ` ```jsonc ` for annotated config, ` ```json ` for plain JSON, ` ```ts ` for TypeScript, ` ```yaml ` for CI, and a **bare** ` ``` ` for captured tool output (see the `## Output` sample, lines 229-238).
- **Cross-links:** in-page anchors, e.g. `[Exit codes](#exit-codes)`, `[Output](#output)`, `[Partial coverage](#partial-coverage)`, `[Programmatic API](#programmatic-api)`.
- **ToC (line 28-45):** lists every `##` section in document order. GitHub anchor rule: lowercase, spaces -> hyphens, punctuation stripped. `## Standalone CLI` -> `#standalone-cli`. Insert `- [Standalone CLI](#standalone-cli)` between `- [Angular CLI](#angular-cli)` and `- [Storybook](#storybook)` (D-02).
- **ASCII only** (project rule): use `--` not em-dash, `->` not arrows, straight quotes.

### Structural template: the `## Angular CLI` section (README lines 381-471, the closest analog)

Follow its shape (intro paragraph, then `###` subsections):
1. Intro paragraph: what the standalone CLI is (the third thin adapter; runs anywhere with no Nx / no Angular CLI).
2. `### Install and run` (or split install / run) -- lead with the zero-install `npx angular-typechecker -c <tsconfig>` (D-03), then the installed `npm install --save-dev` / `-Dw` forms with the `atc` PATH-shorthand note + the `npx atc` anti-pattern warning (D-04/D-05).
3. Flag reference -- table or definition list mirroring HELP_TEXT (D-06).
4. Exit-code table -- the CLI's own `0`/`1`/`2` (D-07), with the explicit "Nx/ng collapse `1` and `2` into non-zero; the CLI splits them" reconciliation (D-08).
5. Cross-link back to `[Output](#output)` and note `[Exit codes](#exit-codes)` describes the Nx/ng pass-fail-only view.
6. Optional worked example (Claude's discretion): an `npx angular-typechecker -c tsconfig.json` invocation with a planted error -> exit `1`.

### CHANGELOG conventions to match (verified from `CHANGELOG.md`)

- Entry heading `## <version>`. **`## 0.2.1` is UNDATED**; `## 0.2.0` is dated `(2026-07-07)`. The date is stamped at release-cut time, so `## 0.2.2` may be left undated now (the version is cut later in a separate Release PR per AGENTS.md).
- Shape (clone `## 0.2.1`, lines 5-45): **bold lead sentence** summarizing the release + one framing paragraph -> `### Features` -> `### Notes` -> `### Compatibility`.
- The `### Compatibility` line to repeat (D-10), from the 0.2.1 entry verbatim: `Nx 23, Angular 22 (\`@angular/compiler-cli\` \`^22.0.0\`), TypeScript \`>=6.0.0 <6.1.0\`, Node \`^22.22.3 || ^24.15.0 || ^26.0.0\`. No new runtime dependency.`
- Behavior-change callouts use a `>` blockquote (see 0.2.0). Not needed here -- the CLI is purely additive.

### Anti-Patterns to Avoid
- **`npx atc` anywhere in the docs** -- fetches the unrelated `atc@0.0.6` (SC#2). `atc` is post-install PATH only.
- **Restating the pass/fail-only `## Exit codes` text in the new table** -- it would contradict D-08. The new table owns the literal `2`; the old section stays as the Nx/ng `{success}` view.
- **Internal ids/scopes in the CHANGELOG** (`DOC-01`, `CLI-0x`, phase/plan numbers, `SC#2`) -- violates changelog-hygiene (AGENTS.md + memory `changelog-readme-end-user-facing`).
- **Paraphrasing HELP_TEXT loosely** -- descriptions must match so `--help` and README stay one source.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flag descriptions | Freshly-worded flag docs | Copy HELP_TEXT (parse-args.ts:64-82) verbatim | Single source of truth; prevents README/`--help` drift (D-06). |
| CHANGELOG structure | A new entry format | Clone the `## 0.2.1` entry shape | Consistency + the release machinery expectations (AGENTS.md). |
| Doc-drift test | A new bespoke assertion harness | Clone `angular-cli-docs.spec.ts` | Established repo pattern: pure fs read + `\s+`-normalized `toContain`. |

**Key insight:** everything this phase documents already exists as a locked source string. The lazy, correct move is to MIRROR, not re-author.

## Common Pitfalls

### Pitfall 1: The `npx atc` supply-chain trap
**What goes wrong:** Docs suggest `npx atc` as a shorthand; a reader runs it and npx fetches the unrelated `atc@0.0.6`.
**Why it happens:** `atc` is a legitimate PATH alias AFTER install, so it is tempting to show it uninstalled too.
**How to avoid:** `npx angular-typechecker` is the ONLY uninstalled form. Show `atc` only after a local install, with an explicit one-line warning naming `atc@0.0.6`.
**Warning signs:** any `npx atc`, `npm exec atc`, or "run `atc` without installing" phrasing.

### Pitfall 2: Contradicting the existing `## Exit codes` section
**What goes wrong:** The new table says "2 = infrastructure" while the old section (line 262) says "non-zero = any failure", reading as a contradiction.
**Why it happens:** The old section deliberately documents only pass/fail because the Nx executor and Angular CLI builder surface a `{success}` boolean.
**How to avoid:** Explicitly frame the CLI as the first adapter that owns the literal OS `2`; Nx/ng collapse `1` and `2` into non-zero. State the relationship, don't restate the pass/fail text (D-08).

### Pitfall 3: CHANGELOG internal-id leak
**What goes wrong:** `DOC-01`, `CLI-01`, `Phase 29`, or `SC#2` land in the public `## 0.2.2` entry (and later the GitHub Release notes).
**Why it happens:** Copying from planning artifacts/requirement text.
**How to avoid:** End-user language only; describe what a user gains, not the internal tracking. Cheap guard: a regex assertion in the doc test (see Validation).

### Pitfall 4: HELP_TEXT / README drift over time
**What goes wrong:** A future flag change updates HELP_TEXT but not the README (or vice versa).
**How to avoid:** Add the drift-lock test that reads HELP_TEXT via `parseCliArgs(['--help'])` and asserts each flag token appears in the README section (see Validation).

## Code Examples

### Exact flag set -- verbatim from `HELP_TEXT` (parse-args.ts:64-82)

```
Usage: npx angular-typechecker -c <tsconfig> [options]

Run the complete Angular type-check (TypeScript + template type-check + extended
NG8xxx diagnostics), no emit, without building the app or running the tests.

Options:
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

Exit codes: 0 clean / 1 verdict-fail / 2 infrastructure-or-usage.
```

Notes for the flag table (from parse-args.ts behavior):
- `-c`/`--tsConfig` is repeatable and REQUIRED. A single value is solution reference-walked; two or more are union-checked. `-p`/`--project` is deliberately NOT registered (would collide with Nx/ng project selection) and surfaces as an unknown-flag usage error -> exit `2`.
- `--max-warnings <n>` accepts a non-negative INTEGER only; `0` is valid (fails on any warning). Non-integer/negative/fractional -> usage error -> exit `2`.
- `--strict` / `--fail-fast` / `--include-deps` are boolean, default false. Semantics mirror the executor options table (README lines 183-189).

### Exit-code composition -- verified from `main.ts` + `exit-codes.ts` + `bin.ts`

The literal code is a two-step compose (main.ts:111-186):

| Code | Condition | Source |
|------|-----------|--------|
| `2` | Usage error (before the core runs): unknown flag, missing `-c` value, missing required `--tsConfig`, non-integer `--max-warnings` | `main.ts:120-124` returns `2` directly (NOT via `toExitCode`) |
| `0` | `--help` / `-h` / `--version` short-circuit | `main.ts:128-130` -> stdout, exit `0` |
| `2` | Infrastructure error: the Angular compiler failed to RUN (missing/unreadable tsconfig, config-resolution crash, internal createProgram/host crash) -> `TypecheckInfrastructureError` | `main.ts:174-180` -> `toExitCode(error)` = `2` (`exit-codes.ts:48-49`) |
| `0` vs `1` | Completed run: `evaluateResult(result, { maxWarnings, strict }).success ? 0 : 1` | `main.ts:164-169` |
| `2` | Any other (unknown) error re-thrown by `run()` | `bin.ts:27-34` catch -> `process.exitCode = 2` |

**`1` (verdict-fail) covers:** error-category diagnostics (TS/template/NG8xxx, `errorCount > 0`), OR warning count exceeded `--max-warnings`, OR coverage-incomplete (e.g. an aborted fatal-template-error run, zero root names, or -- under `--strict` -- a warning-only uncovered first-party file). A coverage-incomplete run has `errorCount === 0` but `success === false`; the code deliberately reads `evaluateResult().success`, never raw counts, so this is not a false pass (main.ts:160-163).

**Recommended docs exit-code table (D-07):**

| Code | Meaning | When |
|------|---------|------|
| `0` | clean | Run completed; no error-category diagnostics; warnings within `--max-warnings`; coverage complete. |
| `1` | verdict-fail | Type / template / NG8xxx errors, OR warning count exceeded `--max-warnings`, OR coverage-incomplete (a first-party file the check could not fully cover). |
| `2` | infrastructure-or-usage | Compiler failed to run (missing/unreadable tsconfig, config-resolution failure), OR a usage error (unknown flag, missing required `--tsConfig`, non-integer `--max-warnings`). |

### bin names (package.json:33-36, bin.ts)

```json
"bin": {
  "angular-typechecker": "./src/cli/bin.js",
  "atc": "./src/cli/bin.js"
}
```
Both names resolve to the same compiled `src/cli/bin.js` (the OS shell that writes stdout/stderr and sets `process.exitCode`). `angular-typechecker` is primary; `atc` is the short alias -- installed PATH only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| - | (none) | - | All claims verified from repo source or the live npm registry. |

**All claims in this research were verified or cited -- no user confirmation needed.** The docs decisions themselves are already locked in CONTEXT.md (D-01..D-10).

## Open Questions

1. **Should the CHANGELOG entry be date-stamped now or left undated until the Release PR?**
   - What we know: `## 0.2.1` is undated; `## 0.2.0` is dated. The date is normally stamped at the release cut (AGENTS.md: version cut in a separate Release PR).
   - Recommendation: leave `## 0.2.2` UNDATED now (matches 0.2.1 and the "cut later" flow). Low-impact; the release cut can add the date.

2. **Should the doc test also cover the repo-root CHANGELOG?**
   - What we know: the existing doc-tripwires (`angular-cli-docs.spec.ts`, `storybook-docs.spec.ts`) cover README only; no CHANGELOG test precedent.
   - Recommendation: keep the README tripwire as the required Wave 0 test; add a lightweight CHANGELOG "no internal-id leak" assertion only as discretionary hygiene (it can read `../../../CHANGELOG.md`). See Validation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `@nx/vitest:test`) |
| Config file | `packages/angular-typechecker/vitest.config.ts` (existing) |
| Quick run command | `nx test angular-typechecker` |
| Full suite command | `nx run-many -t test` |

### Existing precedent (clone this)
`packages/angular-typechecker/src/angular-cli-docs.spec.ts` and `src/storybook-docs.spec.ts` are pure filesystem-read doc tripwires: they read `../README.md`, normalize whitespace (`readme.replace(/\s+/g, ' ')` so assertions survive prose re-wrapping), and assert load-bearing claims with `toContain`. No compiler load, no build artifact -- they run in the fast `nx test` loop on every PR, including docs-only ones. This is the exact model for Phase 29's Wave 0 test.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | README `## Standalone CLI` heading + ToC anchor present | unit (doc tripwire) | `nx test angular-typechecker` | Wave 0 |
| DOC-01 | Canonical `npx angular-typechecker` present; section never says `npx atc` | unit | `nx test angular-typechecker` | Wave 0 |
| DOC-01 | All 7 flags documented; each HELP_TEXT flag token appears in the README (drift-lock via exported `parseCliArgs(['--help'])`) | unit | `nx test angular-typechecker` | Wave 0 |
| DOC-01 | Exit-code table states `0` clean / `1` verdict-fail / `2` infrastructure-or-usage | unit | `nx test angular-typechecker` | Wave 0 |
| DOC-01 | (discretionary) CHANGELOG `## 0.2.2` exists; no internal-id leak | unit | `nx test angular-typechecker` | Wave 0 (optional) |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker`
- **Per wave merge:** `nx run-many -t test`
- **Phase gate:** full suite green before `/gsd:verify-work`. Docs also fall under the non-test gates the repo enforces (`nx format:check`, `nx lint angular-typechecker`, `nx typecheck angular-typechecker`) -- run all three (memory `verify-format-and-lint-before-release`).

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` -- new doc tripwire for the `## Standalone CLI` section (covers DOC-01). Model on `angular-cli-docs.spec.ts`.
  - Highest-value assertions: (a) `## Standalone CLI` heading present; (b) ToC has `[Standalone CLI](#standalone-cli)`; (c) `npx angular-typechecker` present AND the section does NOT contain `npx atc` (mirrors `parse-args.spec.ts` line 179); (d) each of the 7 flag tokens present; (e) the three exit codes `0`/`1`/`2` with their meanings.
  - Recommended drift-lock (closes D-06): `const help = parseCliArgs(['--help']);` then assert each flag token in `help.text` also appears in the README section. `parseCliArgs` is exported; `HELP_TEXT` need not be. This is the genuine README/`--help` drift guard.
- No framework install needed -- Vitest infrastructure already exists.

*(Everything else is prose/table edits to two existing files -- no new test infrastructure.)*

## Security Domain

Pure documentation phase; ASVS categories (auth, session, access control, crypto) are N/A -- no code, no inputs, no trust boundary changes.

The one security-relevant dimension is **supply-chain / typosquat avoidance (STRIDE: Spoofing / Tampering)**:

| Pattern | STRIDE | Mitigation (already in the docs' design) |
|---------|--------|------------------------------------------|
| A reader runs `npx atc` and executes the unrelated `atc@0.0.6` | Spoofing / Tampering | D-05: docs present `npx angular-typechecker` as the only uninstalled invocation; `atc` documented only as a post-install PATH alias, with an explicit warning naming `atc@0.0.6`. Verified against the npm registry; drift-locked in `parse-args.spec.ts`. |

No new threats introduced by documenting an already-shipped surface.

## Sources

### Primary (HIGH confidence)
- `packages/angular-typechecker/src/cli/parse-args.ts` (HELP_TEXT lines 64-82, flag options, validation) -- authoritative flag set.
- `packages/angular-typechecker/src/cli/main.ts` (lines 111-186) -- exit-code two-step compose.
- `packages/angular-typechecker/src/core/exit-codes.ts` -- `toExitCode` = 2 for infra.
- `packages/angular-typechecker/src/cli/bin.ts` -- OS shell, unknown-crash -> 2.
- `packages/angular-typechecker/package.json` -- `bin` map (two names -> one bin.js), `files` whitelist (README ships, CHANGELOG does not), no new npm dependency.
- `packages/angular-typechecker/README.md` -- section order, ToC (line 28), `## Exit codes` (262), `## Angular CLI` (381), fence/cross-link conventions.
- `CHANGELOG.md` (repo root) -- `## 0.2.1` shape (5-45), dating convention, Compatibility line.
- `packages/angular-typechecker/src/angular-cli-docs.spec.ts` + `src/cli/parse-args.spec.ts` -- doc-tripwire + `not.toContain('npx atc')` precedents.
- `.planning/REQUIREMENTS.md` (DOC-01, CLI-01), `.planning/ROADMAP.md` (Phase 29 success criteria), `AGENTS.md` (changelog-hygiene, Release-PR flow).
- npm registry API `https://registry.npmjs.org/atc` (fetched 2026-07-17) -- `atc@0.0.6`, "Manage fleet spawns", published 2013-03-27, unrelated.

### Secondary / Tertiary
- (none needed -- all facts are first-party repo source or the authoritative registry.)

## Metadata

**Confidence breakdown:**
- CLI facts (flags, exit codes, bin names): HIGH -- read directly from the shipped source.
- README/CHANGELOG conventions: HIGH -- read from the actual files.
- `atc@0.0.6` supply-chain fact: HIGH -- verified against the live npm registry.
- Validation approach: HIGH -- an established doc-tripwire pattern already exists in the repo.

**Research date:** 2026-07-17
**Valid until:** stable -- facts are pinned to shipped source; re-verify only if the CLI's HELP_TEXT or exit-code logic changes (out of scope for this phase).
