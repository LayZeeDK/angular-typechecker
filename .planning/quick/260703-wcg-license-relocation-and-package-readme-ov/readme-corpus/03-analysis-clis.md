# README corpus slice 03: static-analysis / lint / type-check CLIs

**Slice scope:** modern JS/TS tools you run to get diagnostics + a non-zero exit -- the
closest job-family peers of `angular-typechecker`. Surveyed for tone, the "Output" section,
and CI/exit-code framing.

**Method:** each README below was FETCHED from raw GitHub (source URL cited per entry) on
2026-07-04, not recalled from memory. Heading outlines are transcribed verbatim in ORDER.

**ASCII note (house rule):** several of these READMEs prefix headings with emoji. Per this
repo's ASCII-only rule I transcribe the heading TEXT verbatim and mark a stripped emoji
prefix as `[e]`. The presence/absence of emoji is still recorded in each entry's
first-impression + tone fields, since that is a real design signal for our own README.

Entries are ordered most-relevant-to-us first (single-format check CLIs), then linters,
then the landing-page-stub pattern.

---

## 1. @arethetypeswrong/cli (attw) -- HIGHEST-RELEVANCE PEER

- **Source:** https://raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/packages/cli/README.md
- **Heading outline (verbatim, in order):**
  - `# arethetypeswrong/cli`
  - `## Installation`
  - `## Usage`
  - `## Configuration`
  - `### Options`
  - `#### Help`
  - `#### Version`
  - `### Pack`
  - `#### From NPM`
  - `#### DefinitelyTyped`
  - `#### Format`
  - `#### Entrypoints`
  - `#### Profiles`
  - `#### Ignore Rules`
  - `#### Summary/No Summary`
  - `#### Emoji/No Emoji`
  - `#### Color/No Color`
  - `#### Quiet`
  - `#### Config Path`
- **First impression:** NO logo, NO badges, NO TOC. Opens with one sentence
  ("A CLI for arethetypeswrong.github.io.") then a paragraph of what it detects, then a
  bulleted list of the 12 problem KINDS it can find -- each bullet links to a dedicated
  docs page (`docs/problems/NoResolution.md` etc.). That problem-catalog-as-intro is the
  standout idiom: the reader immediately sees the full diagnostic surface.
- **Getting started:** `npm i -g @arethetypeswrong/cli`, then several run shapes:
  check a packed tarball (`attw cool-package-1.0.0.tgz`), pack-in-place (`attw --pack .`),
  or from the registry (`attw --from-npm <pkg>`). No `init` step; config is optional.
- **OUTPUT presentation:** does NOT paste a rendered example table in the README (relies on
  the linked website for visuals), but is unusually explicit about output FORMATS via the
  `--format` flag: `table` (columns=entrypoints, rows=resolution kinds), `table-flipped`,
  `ascii` (for clunky wide tables), `auto` (picks best fit for terminal width), and `json`
  ("outputs the raw JSON data, overriding all other rendering options"). This is the model
  for a tool that has ONE conceptual result but several renderings -- default is
  human/`auto`, `json` is the machine escape hatch.
- **CI framing:** implicit. No explicit exit-code section, no problem-matcher, no CI recipe.
  `--quiet` ("nothing printed to STDOUT") and a JSON format are the CI affordances. This is
  a gap relative to type-coverage / ts-unused-exports below.
- **Options presentation:** PER-OPTION prose (not a table). Each option gets an H4/H3 with:
  one-line description, the CLI flag form (`In the CLI: --format, -f`), a shell example, and
  the config-file key + type (`In the config file, format can be a string value`). Very
  disciplined 1:1 CLI-flag <-> config-key mapping, stated once up front and repeated per
  option.
- **Programmatic API:** none in this README (the core lib is a separate package).
- **Positioning/why:** none -- assumes you know why you want it.
- **Length/tone/case:** ~265 lines, medium. Tone: dry, precise, reference-manual.
  Title Case headings.
- **Borrow:** (a) intro-as-problem-catalog with each diagnostic class linking to a detail
  page; (b) the explicit `--format ... json overrides everything` contract; (c) the
  "CLI flag <-> config key are 1:1 camelCase" statement. **Anti-pattern for us:** no exit
  code / CI section despite being a canonical CI gate tool.

---

## 2. type-coverage -- HIGH-RELEVANCE PEER (tsconfig-driven check + threshold + exit)

- **Source:** https://raw.githubusercontent.com/plantain-00/type-coverage/master/README.md
- **Heading outline (verbatim, in order):**
  - `# type-coverage`
  - `## use cases`
  - `## install`
  - `## usage`
  - `## arguments`
  - `### strict mode`
  - `### enable cache`
  - `### ignore catch`
  - `### ignore files`
  - `## config in package.json`
  - `## ignore line`
  - `## migrate to stricter typescript`
  - `## add dynamic badges of type coverage rate`
  - `## integrating with PRs`
  - `## typescript coverage report`
  - `## API(Added in v1.3)`
  - `## The typescript language service plugin of type-coverage(Added in v2.12)`
  - `## VSCode plugin(Added in v2.13)`
  - `## FAQ`
  - `## Changelogs`
  - `### v2`
- **First impression:** plain `# type-coverage` H1, one-line description, a formula sentence
  defining the metric, then a stack of badges (incl. a dynamic self-referential coverage
  badge). No logo, no TOC. Starts with `## use cases` (3 bullets) BEFORE install -- sells
  the "why" first, cheaply.
- **Getting started:** `yarn global add type-coverage typescript` then `run type-coverage`.
  Note it ships `typescript` as a PEER (documented in the `### v2` changelog note) -- same
  posture as ours. No init step; `-p` points at tsconfig.
- **OUTPUT presentation:** does not paste a full sample report, but documents `--detail`
  (show each uncovered identifier), `--json-output`, and `--show-relative-path`. Single
  conceptual output (a coverage %) with a detail mode and a JSON mode -- again the
  human-default + JSON-escape-hatch pattern.
- **CI framing:** STRONG and directly relevant. `--at-least <n>` fails if coverage < n;
  `--is <n>` fails if != n; `--suppressError` forces exit 0 "even failed or errored";
  `--report-semantic-error` makes it surface tsc semantic errors too. The "Avoid introducing
  accidental any by running in CI" use case is stated up top. Threshold-as-exit-gate is the
  core CI idiom.
- **Options presentation:** a single big `## arguments` MARKDOWN TABLE
  (name | type | description), and critically EVERY row annotates the version it was
  `(Added in vX.Y)`. Then a parallel `## config in package.json` block showing the SAME
  options as a `typeCoverage` key with `// same as --flag` comments on each line -- an
  explicit, exhaustive CLI<->config mirror.
- **Programmatic API:** yes, `## API` section with full `import { lint } from
  'type-coverage-core'`, exported function signatures, `LintOptions`/`FileTypeCheckResult`
  interfaces, and a `FileAnyInfoKind` enum pasted verbatim. Note the API moved to a separate
  `-core` package (documented) -- a clean split of CLI vs library.
- **Positioning/why:** `## use cases` at TOP (progressive migration, block `any` in CI).
- **Length/tone/case:** ~320 lines, long. Tone: terse, functional, lots of inline version
  tags. lowercase headings (`## usage`, `## arguments`) -- a distinctive low-ceremony style.
- **Borrow:** (a) threshold flag -> exit code as the CI contract; (b) `--suppressError`
  to decouple "report" from "gate"; (c) exhaustive CLI-flag <-> package.json-key mirror
  table; (d) `(Added in vX)` annotations for options. **Anti-pattern:** the flat lowercase
  headings + 20 top-level H2s make it hard to scan; no clear sectioning between user/CLI
  and integration/plugin content.

---

## 3. ts-unused-exports -- HIGH-RELEVANCE PEER (best explicit exit-code section)

- **Source:** https://raw.githubusercontent.com/pzavolinsky/ts-unused-exports/master/README.md
- **Heading outline (verbatim, in order):**
  - `# ts-unused-exports`
  - `## Installation`
  - `## Usage`
  - `## Usage Options`
  - `### Usage as a library`
  - `#### Usage as a library - From TypeScript (was built with ES5 + commonjs)`
  - `#### Usage as a library - From JavaScript`
  - `## Why should I use this?`
  - `## Example`
  - `## Exit Code`
  - `## Specifying which TypeScript files to check`
  - `## Tooling`
  - `### eslint plugins`
  - `## Changelog (Release History)`
  - `## Contributing`
  - `## Licence: MIT`
- **First impression:** plain H1, one-sentence description, then a column of badges (CI,
  coverage, npm, downloads, license, ko-fi). No logo, no TOC.
- **Getting started:** `npm install --save-dev ts-unused-exports`, then
  `ts-unused-exports path/to/tsconfig.json [file1.ts ...] [options]`. The tsconfig path is a
  positional arg. Documents that TypeScript is a PEER dep since 7.0.0 (same posture as ours).
- **OUTPUT presentation:** pastes a REAL example run and its literal output:
  ```
  2 modules with unused exports
  /home/.../math.ts: add1
  /home/.../unused.ts: unused
  ```
  Single text format; no JSON. Honestly presents the one format by just showing it.
- **CI framing:** the GOLD-STANDARD `## Exit Code` section for our purposes. States it
  "follows the convention used by eslint": `0` = success no errors, `1` = success with >=1
  error, `2` = unsuccessful due to bad args / internal error. Then documents how flags mutate
  the exit code: `--maxIssues=n` (success if <= n issues), `--exitWithCount` (exit status ==
  number of offending modules, with a `echo $?` demo), `--exitWithUnusedTypesCount`. This is
  exactly the contract a CI/agent consumer needs, spelled out.
- **Options presentation:** a MARKDOWN TABLE (Option name | Description | Example), long
  descriptions. Flags are the reporting/exit knobs (`--ignoreTestFiles`, `--silent`, etc.).
- **Programmatic API:** yes, `### Usage as a library` for both TS and JS, showing
  `analyzeTsConfig(...)` and the returned `ExportNameAndLocation` shape inline as comments.
- **Positioning/why:** `## Why should I use this?` sits AFTER usage/options -- a narrative
  comparing itself to tslint's `no-unused-variable` and explaining the cross-module gap it
  fills. Explicitly says it "does not replace tslint but complements it."
- **Length/tone/case:** ~205 lines, medium. Tone: conversational, first-person ("if you've
  ever found yourself mid-refactor..."). Title Case headings.
- **Borrow:** (a) the explicit eslint-convention `## Exit Code` section -- copy this shape
  wholesale; (b) paste the literal text output rather than describe it; (c) the "complements,
  does not replace" positioning framing. **Anti-pattern:** none major; "why" could arguably
  be higher.

---

## 4. ts-prune -- HIGH-RELEVANCE PEER (best "example output" + CI recipes)

- **Source:** https://raw.githubusercontent.com/nadeesha/ts-prune/master/README.md
- **Heading outline (verbatim, in order):**
  - `# ts-prune`
  - `## [e] Maintenance Notice`
  - `## What is ts-prune?`
  - `## Quick Start`
  - `### Installation`
  - `### Basic Usage`
  - `## Examples`
  - `### Example 1: Finding Unused Exports`
  - `### Example 2: Ignoring Specific Exports`
  - `### Example 3: Working with Different File Types`
  - `## Configuration`
  - `### CLI Options`
  - `### Configuration File`
  - `## Common Use Cases`
  - `### 1. CI/CD Integration`
  - `### 2. Pre-commit Hook`
  - `### 3. Count Unused Exports`
  - `### 4. Filter Results`
  - `## Understanding the Output`
  - `## Limitations`
  - `## FAQ`
  - `## Acknowledgements`
  - `## Contributors`
- **First impression:** plain H1, badges, a BOLD one-line tagline ("Find potentially unused
  exports ... with zero configuration."). First real section is a blockquoted maintenance
  notice steering new users to knip -- honest deprecation signposting. Feature bullets use
  emoji. No TOC, no logo.
- **Getting started:** three package-manager install snippets, then `npx ts-prune`. "Zero
  configuration" is a repeated selling point.
- **OUTPUT presentation:** BEST in slice for a single-format tool. Under `### Basic Usage`
  it pastes an **Example output** block and then a legend line: "Each line shows:
  `file:line - exportName`". `## Understanding the Output` further categorizes output line
  variants (regular unused vs `(used in module)`), tying each to the flag that toggles it.
  Single text format, made legible by (1) showing it, (2) naming the columns, (3) enumerating
  the line variants.
- **CI framing:** `## Common Use Cases` -> `### 1. CI/CD Integration` shows package.json
  scripts (`"deadcode:ci": "ts-prune --error"`), a husky pre-commit hook, and shell-pipe
  recipes (`ts-prune | wc -l`, `ts-prune | grep -v ...`). `--error` = "exit with error code
  if unused exports found" is the gate. Frames CI via copy-paste recipes rather than a formal
  exit-code table.
- **Options presentation:** `### CLI Options` markdown table (Option | Description | Example),
  plus a `### Configuration File` block (`.ts-prunerc` JSON or package.json key).
- **Programmatic API:** none.
- **Positioning/why:** `## What is ts-prune?` right after the notice -- benefit bullets
  ("Clean up dead code", "Reduce bundle size"). The maintenance notice itself is a
  comparison-to-knip.
- **Length/tone/case:** ~415 lines (mostly a huge contributor avatar table at the bottom).
  Body is medium. Tone: friendly, tutorial, worked examples with before/after code. Title
  Case headings.
- **Borrow:** (a) paste example output + a one-line "each line shows X:Y - Z" legend;
  (b) `## Understanding the Output` enumerating output line variants; (c) `## Limitations`
  section listing known false-positive sources honestly; (d) `## Common Use Cases` with
  copy-paste CI + pre-commit snippets. **Anti-pattern:** the enormous inline contributor
  `<table>` (hundreds of lines) bloats the file with zero reader value in a README.

---

## 5. nx-stylelint -- STRUCTURAL PEER (an Nx plugin wrapping a checker; same shape as us)

- **Source:** https://raw.githubusercontent.com/Phillip9587/nx-stylelint/main/README.md
  (fetched deliberately -- this is the closest STRUCTURAL analogue: an Nx executor/plugin that
  wraps a linter, exactly angular-typechecker's category)
- **Heading outline (verbatim, in order):**
  - `# nx-stylelint`
  - `# [e] Features`
  - `# [e] Installation`
  - `# [e] Configuring Stylelint for a project`
  - `## Using the Experimental Plugin`
  - `# Examples`
  - `# [e] Documentation`
  - `## nx-stylelint:configuration generator`
  - `### Usage`
  - `### Options`
  - `## nx-stylelint:lint executor`
  - `### Options`
  - `# Custom Formatters`
  - `## Usage`
  - `# Compatibility with Nx and Stylelint`
- **First impression:** centered banner image + centered H1 + centered tagline
  ("Nx plugin to use Stylelint in your Nx workspace."). Badge row includes **peer-dependency
  version badges for Nx and Stylelint** (img.shields.io dependency-version) and an OpenSSF
  Scorecard badge. Feature bullets (emoji-prefixed) list Plugin / Executor / Generators /
  Config / Only-Affected / Cache. No TOC.
- **Getting started:** three install snippets (npm/yarn/pnpm) then the GENERATOR
  (`nx g nx-stylelint:configuration --project <p>`) that wires the target -- i.e. its
  first-run IS a config-init via generator. Also documents the experimental inference plugin
  via `nx.json`. (angular-typechecker v0.0.1 has NO generator, so our getting-started is
  manual `project.json` target wiring instead -- a deliberate difference to call out.)
- **OUTPUT presentation:** does NOT paste sample output; delegates the actual diagnostic
  format to Stylelint's own `formatter` option. Documents `formatter` values
  (`compact | github | json | string | tap | unix | verbose` + custom-package/local-path).
  Because it wraps another tool, "output" == "which Stylelint formatter" -- it exposes the
  choice rather than rendering it.
- **CI framing:** executor-option-driven, not exit-code prose. Relevant options:
  `maxWarnings` ("Number of warnings to trigger a nonzero exit code"), `force` ("Succeeds
  even if there were linting errors"), `formatter: github` (GitHub annotations!),
  `outputFile`, `quiet`, `allowEmptyInput`. Plus Nx-native `nx affected --target=stylelint`
  for CI. This is how an Nx executor frames CI: options table + Nx run commands.
- **Options presentation:** two OPTIONS tables (Option | Value | Default | Description), one
  per generator/executor -- the canonical Nx executor documentation shape. This is the most
  directly copyable table layout for our `typecheck` executor's schema options.
- **Programmatic API:** none (executors are invoked via Nx, not imported).
- **Positioning/why:** no dedicated "why", but `# Compatibility with Nx and Stylelint` at the
  BOTTOM is a full version-matrix table (nx-stylelint version | Nx range | Stylelint range) --
  exactly the kind of matrix our constrained Nx 23 / Angular 22 / TS 6 pairing wants.
- **Length/tone/case:** ~251 lines, medium. Tone: practical, Nx-idiomatic. Title Case headings,
  emoji on top-level H1s.
- **Borrow:** (a) the per-target `### Options` table (Option|Value|Default|Description) --
  our executor schema doc; (b) a bottom `## Compatibility` version-matrix table; (c) peer-dep
  version BADGES for the framework(s) we pin; (d) framing CI via executor options
  (`maxWarnings`, `force`/suppress) + `nx affected`. **Anti-pattern for us:** it leans on a
  generator for first-run; we must instead SHOW the manual `project.json` target block since
  v0.0.1 ships no generator.

---

## 6. dependency-cruiser -- MEDIUM-RELEVANCE (validate-against-rules + eslint-like report)

- **Source:** https://raw.githubusercontent.com/sverweij/dependency-cruiser/main/README.md
- **Heading outline (verbatim, in order):**
  - `# Dependency cruiser`
  - `## What's this do?`
  - `## How do I use it?`
  - `### Install it ...`
  - `### ... and generate a config`
  - `### Show stuff to your grandma`
  - `### Validate things`
  - `#### Declare some rules`
  - `#### Report them`
  - `## I want to know more!`
  - `## License`
  - `## Thanks`
  - `## Build status`
- **First impression:** H1 with an inline logo image, an italic tagline ("Validate and
  visualise dependencies. With your rules."), then immediately an embedded SAMPLE OUTPUT
  IMAGE ("...to whet your appetite") under `## What's this do?`. Badges are at the BOTTOM
  (`## Build status`). Playful voice ("impress your grandma").
- **Getting started:** install snippet, THEN a real config-init step: `npx depcruise --init`
  ("look around your environment, ask you some questions, create a `.dependency-cruiser.js`").
  Then a one-liner to pipe DOT output through GraphViz.
- **OUTPUT presentation:** two modes shown as IMAGES -- a graph (dot->svg) and an
  "eslint-like format" text-violation screenshot ("shows any violations in an eslint-like
  format"). Explicitly enumerates other reporters (text/dot/mermaid/json/csv/html) with links.
  Multi-format tool; anchors on the two headline visuals and links the rest.
- **CI framing:** light. "in text (for your builds)" vs "in graphics (for your eyeballs)" is
  the framing; it uses itself in its own build (`depcruise` npm script, linked). No explicit
  exit-code section in the README (deferred to `doc/cli.md`).
- **Options presentation:** none inline -- all deferred to `doc/cli.md`,
  `doc/rules-reference.md`, `doc/options-reference.md` via a link hub (`## I want to know
  more!`).
- **Programmatic API:** mentioned only as a link (`doc/api.md`).
- **Positioning/why:** `## What's this do?` at top (validates + reports + visualizes).
- **Length/tone/case:** ~199 lines, medium. Tone: whimsical/personable, uses footnotes and
  collapsible `<details>` for version caveats. Sentence-case headings.
- **Borrow:** (a) show a real violation-report visual immediately under a "what's this do?"
  heading; (b) `--init` interactive config generation; (c) `<details>` collapsibles for
  version-specific caveats (we could use for Nx/Angular version notes). **Anti-pattern for
  our slice:** README is a link-hub -- almost all reference detail lives on external docs;
  fine for a big project with a doc site, but a standalone npm README should carry more.

---

## 7. eslint -- MEDIUM-RELEVANCE (the reference-point for exit codes + severity levels)

- **Source:** https://raw.githubusercontent.com/eslint/eslint/main/README.md
- **Heading outline (verbatim, in order):**
  - `# ESLint`
  - `## Table of Contents`
  - `## Installation and Usage`
  - `### Prerequisites`
  - `### npm Installation`
  - `### pnpm Installation`
  - `## Configuration`
  - `## Version Support`
  - `## Code of Conduct`
  - `## Filing Issues`
  - `## Frequently Asked Questions`
  - (FAQ sub-questions as H3) `### Does ESLint support JSX?` ... `### Why doesn't ESLint lock dependency versions?`
  - `## Releases`
  - `## Security Policy`
  - `## Semantic Versioning Policy`
  - `## ESM Dependencies`
  - `## License`
  - `## Team`
  - `## Sponsors`
- **First impression:** badges at very top, H1, then a horizontal LINK BAR
  (Website | Configure | Rules | Contribute | ...). A numbered `## Table of Contents`. No
  logo. Prose intro comparing to JSLint/JSHint.
- **Getting started:** prerequisites (exact Node ranges, TS>=5.3 for types), then
  `npm init @eslint/config@latest` (an init/scaffold), then `npx eslint yourfile.js`.
- **OUTPUT presentation:** README does NOT paste diagnostic output (defers to website). BUT
  it defines the SEVERITY MODEL inline in `## Configuration`: `"off"/0`, `"warn"/1`
  ("doesn't affect exit code"), `"error"/2` ("exit code will be 1"). That severity->exit
  coupling is the canonical model the whole ecosystem (and our tool) implicitly cites.
- **CI framing:** the severity/exit-code note above is the core. No CI recipe block; there is
  a `## Semantic Versioning Policy` explaining how "reports more/fewer errors" maps to
  semver bumps -- a check-tool-specific versioning concern worth noting.
- **Options presentation:** none inline (config example only); all rules/CLI on the website.
- **Programmatic API:** none inline.
- **Positioning/why:** intro paragraph (AST-based, pluggable) + a FAQ that includes the
  pointed "Does Prettier replace ESLint?" ("No ... different jobs") -- comparison handled in
  FAQ, not a dedicated section.
- **Length/tone/case:** ~370 lines (huge autogenerated Team/Sponsors tail). Body is short.
  Tone: institutional, authoritative. Title Case headings.
- **Borrow:** (a) the severity-to-exit-code statement ("error => exit 1") -- our warning vs
  error diagnostics need the same one-liner; (b) a `## Semantic Versioning Policy` clarifying
  that "reports more errors" can be a minor/major -- relevant to a diagnostic tool's 0.x
  promises; (c) top link-bar for navigation. **Anti-pattern:** enormous autogenerated
  team/sponsor tables dominate the file.

---

## 8. stylelint (official) -- MEDIUM-RELEVANCE (features-forward, docs-hub)

- **Source:** https://raw.githubusercontent.com/stylelint/stylelint/main/README.md
- **Heading outline (verbatim, in order):**
  - `# Stylelint`
  - `## Features`
  - `## How it'll help you`
  - `### Example output`
  - `## Guides`
  - `## Contributors`
  - `### Alumni`
  - `### Sponsors, backers and donors`
  - `#### Website hosting`
  - `## License`
- **First impression:** plain H1, three badges (npm version, downloads, CI), one-line
  tagline ("A mighty CSS linter that helps you avoid errors and enforce conventions."). No
  logo, no TOC. Leads with `## Features` bullets ("over 100 built-in rules", "15k unit
  tests", "trusted by ... Google and GitHub").
- **Getting started:** NOT in the README -- there is no install/usage snippet; it points to
  `docs/user-guide/get-started.md` under `## Guides`. Pure docs-hub README.
- **OUTPUT presentation:** `### Example output` exists but is JUST an image
  (`![Example](example.png)`) -- shows, doesn't transcribe. Single implied format.
- **CI framing:** none in README (deferred to CLI docs).
- **Options presentation:** none inline; `## Guides` is a nested link tree to the doc site
  (Getting started / Configuring / CLI / Node.js API / Options / Errors & warnings).
- **Programmatic API:** link only (`Node.js API` guide).
- **Positioning/why:** `## Features` + `## How it'll help you` (avoid errors / enforce
  conventions, with sub-bullets) IS the why, at the top. Recommends Prettier alongside
  ("complementary tools") -- same complements-not-replaces framing as ts-unused-exports.
- **Length/tone/case:** ~113 lines, short. Tone: confident, benefit-led. Sentence-case
  headings, contraction-heavy ("How it'll help you").
- **Borrow:** (a) `## How it'll help you` framing that splits the value into concrete
  example categories; (b) "we recommend X alongside" complementary-tool positioning.
  **Anti-pattern for a standalone npm package:** no install/usage/output at all in the README
  -- acceptable only because a mature doc site exists; a young package needs the basics inline.

---

## 9. @biomejs/biome -- LOWER-RELEVANCE (multi-tool toolchain, landing-page style)

- **Source:** https://raw.githubusercontent.com/biomejs/biome/main/packages/@biomejs/biome/README.md
- **Heading outline (verbatim, in order):**
  - (centered banner + badges + language-translation link row, no heading)
  - `### Installation`
  - `### Usage`
  - `## Documentation`
  - `## More about Biome`
  - `## Funding`
  - `### Project sponsorship and funding`
  - `## Sponsors`
  - `### Platinum Sponsors`
  - `### Silver Sponsors`
  - `### Bronze Sponsors`
- **First impression:** big centered dark/light banner (`<picture>`), 5 badges, a row of 12
  translated-README links. Bold prose intro pitching it as "a performant toolchain for web
  projects" (formatter + linter, "97% Prettier compatibility", "500+ rules"). No TOC.
- **Getting started:** `npm install --save-dev --save-exact @biomejs/biome`, then a Usage
  block of 4 commands (`biome format --write`, `biome lint --write`, `biome check --write`,
  `biome ci`). Notably ships a dedicated `biome ci` subcommand -- CI is a first-class VERB.
- **OUTPUT presentation:** none in README ("outputs detailed and contextualized diagnostics"
  is asserted in prose, shown on the website/playground). Delegates.
- **CI framing:** the `biome ci` subcommand ("check all files ... in CI environments") is the
  headline CI affordance; no exit-code/annotation detail inline.
- **Options presentation:** none inline; `## Documentation` links to the getting-started guide.
- **Programmatic API:** none inline.
- **Positioning/why:** `## More about Biome` (sane defaults, no config required, no Node.js
  required, first-class LSP, unifies previously-separate tools) is the why, mid-README.
- **Length/tone/case:** ~180 lines but ~half is sponsor `<table>`s. Tone: marketing-forward,
  bold-lead sentences. Mixed heading case, emoji-free headings.
- **Borrow:** (a) a dedicated CI verb/subcommand framing (`biome ci`); (b) tight 4-line Usage
  block that shows the common invocations at a glance. **Anti-pattern for us:** heavy
  marketing prose + large sponsor tables; asserts diagnostic quality without showing any.

---

## 10. oxc / oxlint -- LOWER-RELEVANCE (monorepo umbrella README + thin package stub)

- **Source (umbrella):** https://raw.githubusercontent.com/oxc-project/oxc/main/README.md
- **Source (oxlint package):** https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/README.md
- **Umbrella heading outline (verbatim, in order):**
  - `## [e] Oxc`
  - `## [e] Who's using Oxc?`
  - `## [e] Lint or Format a Codebase`
  - `## [e] Build Tooling on Top of Oxc`
  - `## [e] Contribute`
  - `## [e] Other Resources`
  - `## [e] Who's Sponsoring Oxc?`
  - `## [e] License`
- **oxlint package heading outline (verbatim):**
  - `# [e] Oxc`
  - `## Oxlint`
- **First impression:** centered logo `<picture>`, two rows of badges (license/CI/coverage/
  codspeed/sponsors, then discord/playground/website). Pronunciation guide, one-line pitch
  ("high-performance tools for JS/TS written in Rust"), VoidZero positioning. Emoji on every
  heading. No TOC.
- **Getting started:** umbrella just gives `npx oxlint@latest` / `npx oxfmt@latest` one-liners
  under `## Lint or Format a Codebase`. The oxlint PACKAGE README is a ~15-line stub: "This is
  the linter for oxc", a link to usage docs, and four `npx oxlint@latest ...` run lines
  ("complete in milliseconds. No configurations are required.").
- **OUTPUT presentation:** none in either README. Delegates entirely to oxc.rs.
- **CI framing:** none inline (docs site).
- **Options presentation:** `npx oxlint@latest --help` / `--rules` pointers only.
- **Programmatic API:** none inline (links to the parser/transformer/resolver guides).
- **Positioning/why:** `## Who's using Oxc?` (Rolldown, Nuxt, knip, Shopify...) as social
  proof, and the "part of VoidZero's unified toolchain" narrative.
- **Length/tone/case:** umbrella ~120 lines, package ~15 lines. Tone: fast/benchmark-proud,
  emoji-heavy. Title Case headings.
- **Borrow:** (a) "No configuration required, runs in milliseconds" zero-config promise up
  front (if true for our default run); (b) `--help` / `--rules` discoverability pointers.
  **Anti-pattern for us:** the per-package README is a near-empty stub -- fine inside a huge
  monorepo with a doc site, useless as a standalone npm listing (see the landing-page pattern
  below).

---

## 11. madge -- LOWER-RELEVANCE (graph/analysis, API-first, config-table)

- **Source:** https://raw.githubusercontent.com/pahen/madge/master/README.md
- **Heading outline (verbatim, in order):**
  - (centered logo + badges, no heading)
  - `## Examples`
  - `## See it in action`
  - `# Installation`
  - `## Graphviz (optional)`
  - `### Mac OS X`
  - `### Ubuntu`
  - `# API`
  - `## madge(path, config)`
  - `## Functions`
  - (per-method H4s: `#### .obj()`, `#### .warnings()`, `#### .circular()`, `#### .depends()`, `#### .orphans()`, `#### .leaves()`, `#### .dot()`, `#### .image()`, `#### .svg()`)
  - `# Configuration`
  - `# CLI`
  - `## Examples`
  - `# Debugging`
  - `# Running tests`
  - `# Creating a release`
  - `# FAQ`
- **First impression:** centered logo + version/npm/donate badges. Bold prose intro, feature
  bullets, then TWO example graph IMAGES and an asciinema "See it in action" recording. No TOC.
- **Getting started:** `npm -g install madge`, plus an OPTIONAL external-dependency section
  (Graphviz, with per-OS install commands) -- honest about a non-npm prerequisite.
- **OUTPUT presentation:** API methods each return a specific shape (`.obj()`, `.circular()`
  -> Array, `.dot()` -> DOT string, `.svg()` -> Buffer, `.image()` -> writes file). CLI
  `--json`, `--dot`, `--image` map to these. Multiple formats, documented per-method and
  per-CLI-flag. Shows a neat pipe idiom: `madge --json ... | tr ... | madge --stdin`.
- **CI framing:** light; `--circular` is the gate people use in CI (exit non-zero on cycles),
  though the README doesn't spell out the exit code. `--warning`/`--debug` for triage.
- **Options presentation:** `# Configuration` is a MARKDOWN TABLE
  (Property | Type | Default | Description), plus `.madgerc` and package.json config examples.
  `# CLI` is an EXAMPLES-driven list (blockquote-labeled snippet per task) rather than a flag
  table.
- **Programmatic API:** yes -- API is the PRIMARY section, ahead of CLI. Each function has a
  blockquote description + a runnable `require('madge')` snippet.
- **Positioning/why:** feature bullets up top; no comparison section.
- **Length/tone/case:** ~557 lines (thorough), long. Tone: personal (maintainer voice,
  donation ask), practical. Mixed `#`/`##` levels used somewhat loosely.
- **Borrow:** (a) Config markdown table (Property|Type|Default|Description); (b) an explicit
  OPTIONAL external-dependency section with per-OS install (analogous to us noting Angular/TS
  peers must be installed by the consumer); (c) task-labeled CLI example snippets.
  **Anti-pattern:** inconsistent heading levels (mix of `#` and `##` for peer sections);
  API-before-CLI ordering is odd for a tool most people run as a CLI.

---

## 12. publint -- LANDING-PAGE STUB pattern (minimal README -> website)

- **Source:** https://raw.githubusercontent.com/publint/publint/master/README.md
- **Heading outline (verbatim, in order):**
  - (centered logo + `publint` H1 + tagline + "Try it online / Read the docs" links)
  - `## Usage`
  - `## Development`
  - `## Sponsors`
  - `## License`
- **First impression:** centered logo image, centered H1 `publint`, centered tagline
  ("Lint packaging errors. Ensure compatibility across environments."), centered
  "Try it online / Read the docs" links. No badges, no feature list, no TOC.
- **Getting started:** `## Usage` is just `npx publint` and `npx publint ./packages/my-lib`,
  then "try it online" + read-the-docs links. No config-init.
- **OUTPUT presentation:** NONE in README -- delegated to publint.dev and its docs.
- **CI framing:** none in README.
- **Options / API / why:** all delegated to the docs site.
- **Length/tone/case:** ~55 lines, very short. Tone: minimal, brand-forward. Title Case.
- **Note:** classic "the README is a landing page, the docs live on a website" pattern. Same
  as knip and the oxlint package stub.

---

## 13. knip -- LANDING-PAGE STUB pattern (package README != docs)

- **Source:** https://raw.githubusercontent.com/webpro-nl/knip/main/packages/knip/README.md
- **Heading outline (verbatim, in order):**
  - (centered logo H1 + centered badge row)
  - `## Contributors`
  - `## Knip`
  - `## License`
- **First impression:** centered logo, three badges (version/downloads/stars), a two-sentence
  pitch ("Knip finds and fixes unused dependencies, exports and files..."), then a link list
  (Website / GitHub / npm packages / VS Code / Contributing / Sponsor). No TOC, no usage.
- **Getting started:** NOT present -- "Website: knip.dev" is the pointer. The published npm
  README is intentionally a stub; all real docs (install, config, output, CI) live on knip.dev.
- **OUTPUT / CI / options / API:** none in README; all on the website.
- **Length/tone/case:** ~75 lines (mostly link-reference definitions). Tone: minimal +
  a charming `## Knip` pronunciation aside. Title Case.
- **Note:** the market-leading tool in this exact niche ships a near-empty package README.
  Signal: a mature project can do this ONLY because it has a strong doc site; a new package
  (like ours) should NOT -- the npm README is the only surface most consumers/agents see.

---

## 14. prettier -- CONTEXT PEER (formatter, not a diagnostic tool, but the ecosystem's README template)

- **Source:** https://raw.githubusercontent.com/prettier/prettier/main/README.md
- **Heading outline (verbatim, in order):**
  - (centered banner + language list + badges, no heading)
  - `## Intro`
  - `### Input`
  - `### Output`
  - `## Badge`
  - `## Contributing`
- **First impression:** centered banner logo, a centered list of supported LANGUAGES, a badge
  row (incl. a joke "blazing fast" badge). No TOC.
- **Getting started:** none inline -- a centered docs link bar (Install / Options / CLI / API)
  points to prettier.io. README body is deliberately tiny.
- **OUTPUT presentation:** brilliant `### Input` / `### Output` before/after code pair showing
  a long line reflowed. For a transform tool this IS the output demo -- concrete, instant.
- **CI framing:** one sentence -- run it "in CI environments (`--list-different`)" -- links out
  for detail.
- **Options / API:** link bar only.
- **Positioning/why:** `## Intro` ("opinionated code formatter... so devs never post a
  nit-picky review comment again"). Plus a `## Badge` section giving users a shields.io badge
  to advertise usage -- a growth idiom.
- **Length/tone/case:** ~104 lines, short. Tone: confident, opinionated. Title Case.
- **Borrow:** (a) the Input/Output before-after demo (for us: a snippet of BAD Angular code +
  the exact diagnostic report our tool prints); (b) a top docs link bar; (c) `--list-different`
  as the named CI mode. **Anti-pattern for us:** too sparse for a young package.

---

## Patterns across this slice

**On presenting OUTPUT (the section we care most about):**

1. **Show it, don't just assert it.** The most useful check READMEs (ts-prune,
   ts-unused-exports, prettier) paste a LITERAL output block. The weakest (biome, knip,
   publint, stylelint, oxlint) only assert "detailed diagnostics" and delegate to a website.
   For a young standalone npm package, PASTE a real report -- a BAD Angular component +
   the exact `ngtsc`-style diagnostic text (file:line:col, NG-code, message, code frame) our
   tool prints. That single block does more than a paragraph of adjectives.
2. **Name the columns / line format.** ts-prune's "Each line shows: `file:line - exportName`"
   and its `## Understanding the Output` (enumerating output line variants) are the model.
   Follow the pasted report with a legend and a short enumeration of the diagnostic categories
   (TS error vs template type-check vs NG8xxx extended).
3. **Single-format tools stay honest by (a) showing the one text format and (b) offering a
   `--format json` / `--json` machine escape hatch.** attw, type-coverage, and madge all
   default to a human-readable format and document JSON as the "overrides all rendering"
   machine mode. If angular-typechecker is human-text-only in v0.0.1, say so plainly and note
   JSON as a documented non-goal / future item -- don't imply formats that don't exist.
4. **When you wrap another engine (our case: the Angular compiler; nx-stylelint's case:
   Stylelint), "output" becomes "which formatter/verbosity".** nx-stylelint exposes
   Stylelint's `formatter` values instead of rendering samples. We render the compiler's
   diagnostics ourselves, so we're closer to the "show the real text" camp than the
   "expose a formatter option" camp -- lean into showing it.

**On CI / exit-code framing:**

1. **A dedicated `## Exit Code` section is the single highest-value borrow.**
   ts-unused-exports' eslint-convention block (`0` clean, `1` found problems, `2` tool error)
   is exactly what a CI pipeline and an AI agent need. eslint's severity->exit note
   ("error => exit 1; warn => no effect on exit") is the ecosystem's canonical mental model.
   angular-typechecker should state its exit contract explicitly: exit non-zero iff any
   Angular/TS diagnostic of error severity is emitted.
2. **Provide copy-paste CI recipes, not just a description.** ts-prune (package.json scripts +
   husky hook + shell pipes) and nx-stylelint (`nx affected --target`) show the recipe. For an
   Nx executor, the idiomatic CI framing is: the `project.json` target block + `nx run`/
   `nx affected` commands + the exit contract.
3. **Threshold/suppression flags decouple "report" from "gate".** type-coverage's
   `--at-least`/`--suppressError` and ts-unused-exports' `--maxIssues` show the pattern: let
   CI choose whether findings fail the build. (v0.0.1 likely just "any error => fail", but
   note the pattern.)
4. **GitHub annotations = a `github` formatter, not bespoke code.** nx-stylelint exposes
   `formatter: github`; that (or `::error` workflow-command output) is how tools surface
   inline PR annotations. Worth a one-line mention even if deferred.

**On structure / first impression (for an Nx-plugin check tool like ours):**

- **The closest structural template is nx-stylelint**, not the big linters: install ->
  target wiring -> per-target Options table (Option|Value|Default|Description) -> a bottom
  Compatibility version-matrix. Copy that spine. Difference to flag: nx-stylelint's first-run
  is a GENERATOR; angular-typechecker v0.0.1 ships NO generator, so our getting-started must
  SHOW the manual `project.json` target block.
- **Options as a markdown table is the dominant idiom** (type-coverage, ts-unused-exports,
  nx-stylelint, madge). attw's per-option prose is the alternative -- more room per option,
  worse to scan. For a small executor schema, one table wins.
- **A CLI-flag <-> config-key mirror should be stated once and be exhaustive** (attw:
  "1:1 camelCase"; type-coverage: `// same as --flag` on every package.json line). Our
  executor options map to `project.json` target options -- state that mapping once.
- **"Complements, does not replace X" positioning is common and disarming**
  (ts-unused-exports vs tslint; stylelint + prettier; eslint vs prettier FAQ). Ours writes
  itself: complements `nx build` / the Angular Language Service / a bare `ngc --noEmit` by
  being the decoupled, complete, cacheable whole-program check -- put this near the top.

**On tone / length / ASCII (directly applicable to our constraints):**

- Effective check-CLI READMEs run ~100-320 lines of BODY; the 400-550 line files (ts-prune,
  madge) are inflated by contributor/avatar tables that add no reader value -- keep those out.
- Heading case is split (Title Case is the plurality: attw, eslint, ts-*, nx-stylelint;
  sentence/lowercase minority: stylelint, type-coverage). Pick Title Case for consistency.
- **Emoji is common in this slice (oxc, biome, ts-prune, nx-stylelint) but NOT universal**
  (attw, eslint, type-coverage, ts-unused-exports, dependency-cruiser are emoji-free and read
  as more serious/reference-grade). angular-typechecker's ASCII-only, no-hype mandate puts it
  squarely with the attw/eslint/type-coverage cohort -- which is exactly the right company
  for a correctness tool. No competitive disadvantage in dropping emoji.
- **Do NOT adopt the landing-page-stub pattern (knip, publint, oxlint-package).** It only
  works when a strong doc site exists. A v0.0.1 npm package's README is the sole surface for
  most consumers and every AI agent scraping npm -- carry install, a real output sample, the
  exit contract, the options table, and a version matrix INLINE.
