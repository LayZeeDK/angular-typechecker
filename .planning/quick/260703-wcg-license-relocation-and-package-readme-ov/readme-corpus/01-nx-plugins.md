# README Corpus Slice 01 -- Nx plugins and devkit executor/generator packages

Survey of how real Nx plugin READMEs are structured. Each entry was fetched from the
actual source (local clone or npm registry `readme` field) and headings are transcribed
in order.

**ASCII transcription note:** this repo is ASCII-only (no emoji in files). Several source
READMEs put emoji glyphs inside headings. Those glyphs are transcribed here as the literal
token `[emoji]` and their presence is recorded as a style signal (angular-typechecker will
NOT copy the emoji style). Heading TEXT is otherwise verbatim.

**Programmatic API note:** none of the surveyed packages document a JS programmatic API in
their README -- every one is CLI/executor/generator-driven. This is called out per entry
because angular-typechecker DOES ship a `runTypecheck` programmatic API and therefore has no
strong ecosystem convention to copy.

Packages surveyed:

1. @push-based/nx-verdaccio -- repo-root README (marketing variant)
2. @push-based/nx-verdaccio -- published-package README (per-executor variant)
3. @analogjs/platform
4. nx-stylelint
5. @nxext/stencil
6. @jscutlery/semver
7. ngx-deploy-npm
8. @jnxplus/nx-maven
9. @nx/* first-party plugins (finding: ship NO README)

---

## 1. @push-based/nx-verdaccio -- repo-root README (marketing variant)

**Source:** `D:\projects\github\push-based\nx-verdaccio\README.md` (local clone)

**Ordered heading outline:**
- `# Enterprise Grade Testing with Verdaccio and Nx` (H1 -- tagline used AS the title)
- `### [emoji] Enterprise Grade Testing with Verdaccio and Nx [emoji]` (H3 -- decorative duplicate of the title)
- `## Why You NEED This Plugin [emoji]`
- `### [emoji] Speed Benchmarks [emoji]`
- `### [emoji] Test Architecture Comparison [emoji]`
- `### [emoji] Tasks Architecture Comparison [emoji]`
- `### [emoji] Testing Dx Comparison [emoji]`
- `### [emoji] Debug Dx Comparison [emoji]`
- `## Getting Started [emoji]`
  - `### Step 1: Register and Configure in nx.json:`
  - `### Optional: Add the Package Under Test as implicitDependencies`
  - `### Step 3: Run the E2E Test`
- `## Configuration Options [emoji]`
  - `### Fine-Grained Control for Publishable Projects [emoji]`
  - `### Custom Test Environment Setup [emoji]`
    - `#### Filter by target names`
  - `### Filter by tags`
  - `### Customize inferred target names`
- `## Benchmarks`
- `## Next Steps`
- `## Stay Connected! [emoji]`

**First impression:** no logo, but many inline architecture-comparison PNGs (bad-vs-good side-by-side tables). The H1 IS the tagline; a decorative H3 repeats the title with emojis. Badge row of 5 (npm version, github release-date, license, commit-activity, CI). Heavy emoji throughout. A "Key Features" bullet list (7 bullets). No TOC. Tone is hype-heavy ("BRUTALLY FAST", "Up to 110x faster", "ZERO configuration", "testing at light speed").

**Getting started:** install is implicit -- you register the plugin in `nx.json` (JSONC block with inline `// Optional` comments), then optionally add `implicitDependencies` in `project.json`, then run `nx run utils-e2e:e2e`. This is the inferred-plugin wiring style, not per-project executor wiring. Steps are mis-numbered (Step 1, Optional, Step 3 -- no Step 2). Uses a `> [!NOTE]` GitHub admonition to show the dynamically added `dependsOn`.

**Options presentation:** one markdown table (Name / type / description) for the plugin options; each advanced feature (publishable filtering, target-name filtering, inferred-target renaming) then gets its own subsection with a JSONC snippet.

**Programmatic API:** none.

**Positioning / how-it-compares:** top-and-throughout. "Why You NEED This Plugin" plus five bad-vs-good comparison tables and two benchmark tables are the core positioning device.

**Length + tone:** long (~283 lines), very verbose, conversational/hype, Title-Case + emoji headings.

**Idioms worth borrowing:** the `nx.json` / `project.json` JSONC snippets with inline `//` comments; the `> [!NOTE]` admonition to show a side effect; the options table.

**Anti-patterns to avoid:** emoji in every heading; hype adjectives; mis-numbered steps; a decorative duplicate title heading; shipping an unfinished "Benchmarks" section with a self-admitted "first draft / data not clean" disclaimer.

---

## 2. @push-based/nx-verdaccio -- published-package README (per-executor variant)

**Source:** `D:\projects\github\push-based\nx-verdaccio\projects\nx-verdaccio\README.md` (local clone -- the README that ships inside the published package, distinct from entry 1)

**Ordered heading outline:**
- `# @push-based/nx-verdaccio`
- `## [emoji] Plugins`
  - `### Verdaccio Test Environment Plugin`
- `## Executor`
  - `### Setup Environment Executor`
  - `### Bootstrap Environment Executor`
  - `### Kill Process Executor`
  - `### NPM Install Executor`
  - `### NPM Publish Executor`
- `## Debugging e2e environments`

**First impression:** H1 = bare package name; 3 badges (npm version, downloads, dependencies via libraries.io). No tagline prose, no features list, no TOC. Terse.

**Getting started:** essentially delegated -- the plugin section is one paragraph plus "See ... docs for details". Each executor H3 = a 1-2 sentence description + a `project.json` JSONC snippet showing an example `options` object + a "Read more under [X executor docs]" relative link to a per-executor sub-README.

**Options presentation:** NOT tabulated here. Each executor shows an example `options` object inline in JSONC; the full option reference is deferred to the per-executor sub-README.

**Programmatic API:** none.

**Positioning:** none.

**Length + tone:** short (~154 lines), terse, near-ASCII (a single emoji), Title-Case headings.

**Idioms worth borrowing:** one H2 per capability class (Plugins / Executor), one H3 per executor, each with a `project.json` snippet, then deep-link to per-executor docs rather than inlining everything. **This is the closest structural match for a multi-executor / multi-generator plugin** like angular-typechecker.

**Notable divergence:** the SAME package ships two very different READMEs -- a hype marketing one at the repo root (entry 1) and this concise capability-indexed one inside the published package. Worth knowing that repo-root README != published README.

---

## 3. @analogjs/platform

**Source:** `D:\projects\github\analogjs\analog\packages\platform\README.md` (local clone)

**Ordered heading outline:**
- `# @analogjs/platform`
- `## Supported Generators`
  - `### app`
- `## Development`
  - `### Building`
  - `### Running unit tests`

**First impression:** H1 = package name; one-line tagline "Official plugin to add Analog to your Nx monorepo." No badges, no logo, no features, no TOC.

**Getting started:** a single generator invocation `nx g @analogjs/platform:application analog-app` under "Supported Generators > app". No install command at all.

**Options presentation:** none.

**Programmatic API:** none.

**Positioning:** none.

**Length + tone:** very short (~24 lines), terse, formal, sentence-case.

**Idioms worth borrowing:** minimal published README for a first-party plugin that leans on the framework's main docs site (analogjs.org). Documents generators by generator name.

**Anti-patterns to avoid:** the bulk of this consumer-facing README is a "Development" section aimed at CONTRIBUTORS (how to build/test the lib) -- that belongs in CONTRIBUTING, not a package README. No install step at all.

---

## 4. nx-stylelint

**Source:** `https://registry.npmjs.org/nx-stylelint` (`readme` field, 16.8 KB) -- repo `github.com/Phillip9587/nx-stylelint`

**Ordered heading outline:** (note: uses H1 `#` for every top-level section, unusual)
- `# nx-stylelint` (centered, under a banner image + bold tagline)
- `# [emoji] Features`
- `# [emoji] Installation`
- `# [emoji] Configuring Stylelint for a project`
  - `## Using the Experimental Plugin`
- `# Examples`
- `# [emoji] Documentation`
  - `## nx-stylelint:configuration generator`
    - `### Usage`
    - `### Options`
  - `## nx-stylelint:lint executor`
    - `### Options`
- `# Custom Formatters`
  - `## Usage`
- `# Compatibility with Nx and Stylelint`

**First impression:** centered banner SVG (logo), centered H1, bold one-line tagline "Nx plugin to use Stylelint in your Nx workspace." Seven-badge row (Nx peer-dep version, Stylelint peer-dep version, CI, LICENSE, npm version, npm downloads, OpenSSF Scorecard). Six-bullet Features list. No TOC. `<hr/>` divider after the header block.

**Getting started:** install block with npm / yarn / pnpm variants; then the generator `nx g nx-stylelint:configuration --project <name>` with prose explaining exactly what files it creates and what it configures. The experimental inferred-target plugin is shown as an `nx.json` snippet.

**Options presentation:** markdown tables. The generator has an Option/Value/Description table; the executor has an exhaustive Option/Value/Default/Description table (18 rows).

**Programmatic API:** none.

**Positioning / how-it-compares:** none at the top; a "Compatibility with Nx and Stylelint" version-matrix table at the BOTTOM (nx-stylelint version x Nx version x Stylelint version).

**Length + tone:** medium (~252 lines), professional/neutral, Title-Case headings, emoji section markers.

**Idioms worth borrowing:** a "# Documentation" section split into a "generator" subsection and an "executor" subsection, each with Usage + an Options table; the compatibility matrix at the bottom; the multi-package-manager install block. **Strong structural template for angular-typechecker** (executor + generators + config + a compatibility matrix).

**Anti-patterns to avoid (for this repo):** emoji in headings; using H1 for every section (breaks the single-H1 document convention).

---

## 5. @nxext/stencil

**Source:** `https://registry.npmjs.org/@nxext/stencil` (`readme` field, 5.4 KB) -- repo `github.com/nxext/nx-extensions`

**Ordered heading outline:**
- `# @nxext/stencil`
- `## Table of Contents`
- `## Features`
- `## Usage`
- `## Project schematics`
- `## Build`
- `## Test`
- `## Watch`
- `## Serve`
- `## Storybook`
- `## React, Angular and Vue`

**First impression:** H1 = package name; 3 badges (license, Windows CI, macOS CI). An explicit markdown TOC (anchor links). Short 3-bullet Features list. No logo, no tagline prose.

**Getting started:** "Usage" section = install (yarn / npm variants). Then "Project schematics" = generator commands (`nx g @nxext/stencil:app`, `:lib`, `:component` / `:c` alias). Then per-task sections.

**Options presentation:** per-command flag tables (Parameter / Type / Default / Description) under Build and Serve.

**Programmatic API:** none.

**Positioning:** none.

**Length + tone:** medium (~160 lines), terse, task-oriented, Title-Case headings, minimal emoji.

**Idioms worth borrowing:** anchor-link TOC; per-target section, each with a flags table; documenting the short-form generator alias (`:c` for `:component`).

**Anti-patterns to avoid:** slightly dated (`workspace.json` / `angular.json` references); several empty cells in the flag tables.

---

## 6. @jscutlery/semver

**Source:** `https://registry.npmjs.org/@jscutlery/semver` (`readme` field, 46.6 KB) -- repo `github.com/jscutlery/semver`

**Ordered heading outline:**
- (2 badges above the title: npm version, codecov)
- `# @jscutlery/semver`
- `## Setup`
  - `### Install`
    - `#### Independent mode (default)`
    - `#### Synced mode`
- `## Usage`
  - `### Release`
    - `#### Independent mode`
    - `#### Synced mode`
    - `#### When run, this executor does the following`
    - `#### Available options`
- `## Guides`
  - `### Overwrite default configuration`
  - `### Customizing Conventional Changelog`
  - `### Customizing the commit parser`
  - `### Version calculation`
    - `#### Specify the level of change`
    - `#### Initial prerelease version`
  - `### Tag prefix customization`
  - `### Commit message customization`
  - `### Skipping release for specific types of commits`
  - `### Skipping commit`
  - `### Skipping Stage`
  - `### Triggering executors post-release`
    - `#### Built-in post-targets`
  - `### Tracking dependencies`
  - `### Running versioning on multiple projects`
- `## CI/CD usage`
  - `### GitHub Actions`
  - `### GitLab CI`
- `## Nx Release migration`
- `## Compatibility overview with Nx`
- `## Changelog`
- `## Contributors`
- `# License`

**First impression:** 2 badges above the H1 (npm version, codecov coverage); H1 = package name; bold one-line tagline "Nx plugin for versioning using SemVer and CHANGELOG generation powered by Conventional Commits." No logo, no features bullets, no TOC.

**Getting started:** install = a two-command block (`npm install -D @jscutlery/semver` + `nx g @jscutlery/semver:install`); immediately explains the two operating modes (Independent / Synced) as H4 subsections.

**Options presentation:** one large "Available options" markdown table (name / type / default / description) where many rows deep-link to a matching detailed subsection under "Guides".

**Programmatic API:** none (executor-driven).

**Positioning / how-it-compares:** no "vs" section at top. Near the bottom: a "Nx Release migration" section (how to migrate AWAY from this plugin to Nx's built-in `nx release`) plus a "Compatibility overview with Nx" version table. Notably honest -- it documents the exit path off the plugin.

**Length + tone:** long (~604 lines), thorough, neutral/technical, Title-Case H2 with sentence-case detail subsections, minimal emoji, uses `> [!NOTE]` admonitions.

**Idioms worth borrowing:** options table where each option deep-links to a detailed "Guides" subsection; a "When run, this executor does the following" numbered list explaining side effects; worked CI/CD examples (GitHub Actions + GitLab CI); "Compatibility overview with Nx" version matrix.

---

## 7. ngx-deploy-npm

**Source:** `https://registry.npmjs.org/ngx-deploy-npm` (`readme` field, 19.7 KB) -- repo `github.com/bikecoders/ngx-deploy-npm`

**Ordered heading outline:**
- `# ngx-deploy-npm [emoji]` (with `<!-- omit in toc -->`)
- (large badge wall + reference-style link definition block, then a cover PNG)
- `## Publish your libraries to NPM with one command` (H2 tagline, `<!-- omit in toc -->`)
- (markdown Table of contents)
- `## [emoji] Quick Start (local development)`
- `## [emoji] Continuous Delivery`
  - `### GitHub Actions (OIDC trusted publishing)`
  - `### GitHub Actions with @jscutlery/semver`
  - `### GitHub Actions with an NPM token`
  - `### Troubleshooting GitHub Actions auth`
  - `### CircleCI`
- `## [emoji] Options`
  - `### install`
    - `#### --dist-folder-path`
    - `#### --project`
    - `#### --access`
  - `### deploy`
    - `#### --check-existing` (and `--check-tag`, `--package-version`, `--tag`, `--access`, `--otp`, `--registry`, `--dry-run`, `--dist-folder-path`)
- `## Compatibility overview with Nx`
- `## [emoji] Configuration File`
- `## [emoji] Essential considerations`
  - `### Version Generation`
  - `### One library per install run`
- `## [emoji] Do you Want to Contribute?`
- `## License`
- `## Recognitions`

**First impression:** cover PNG banner; a large badge wall (~13 badges: npm version, downloads, license, Conventional Commits, three SonarCloud ratings, Linux/macOS/Windows OS badges, publishment status, nx@next tests, nx@latest tests) implemented with reference-style link definitions; H1 with `<!-- omit in toc -->`; an H2 tagline; a markdown TOC.

**Getting started:** numbered "Quick Start (local development)": install + generator per-library, then `nx deploy your-library --dry-run`, then "remove --dry-run when happy". Emphasizes dry-run first.

**Options presentation:** per-flag prose, NOT a table -- H3 per command (install / deploy), H4 per flag (`--tag`, `--otp`, `--registry`, ...) each with a paragraph. More granular than a table.

**Programmatic API:** none.

**Positioning:** none at top; a "Compatibility overview with Nx" table plus an "Essential considerations" gotchas section.

**Length + tone:** long (~481 lines), thorough, some emoji in headings, clean source thanks to reference-style badge/link definitions.

**Idioms worth borrowing:** reference-style link definitions keep the badge block readable in source; OS-support badges; dry-run-first Quick Start; an "Essential considerations" gotchas section; a Troubleshooting subsection; documenting OIDC trusted publishing as the recommended CI path.

**Anti-patterns to avoid:** a 13-badge wall is a lot of noise; emoji headings.

---

## 8. @jnxplus/nx-maven

**Source:** `https://registry.npmjs.org/@jnxplus/nx-maven` (`readme` field, 22.4 KB) -- repo `github.com/gridatek/jnxplus`

**Ordered heading outline:** (abridged for the 13 numbered sub-steps)
- `# @jnxplus/nx-maven`
- `## Quick Start` (single 5-command copy-paste bash block: install -> init -> library -> application -> serve)
- `## Supported versions` (version matrix)
- `## Getting Started`
  - `### 0. Prerequisites`
  - `### 1. Install the plugin`
  - `### 2. Init workspace with Maven support`
  - `### 3. Generate a parent project (optional)`
  - `### 4. Generate applications and libraries`
  - `### 5. Common tasks`
  - `### 6. Executors` (`#### run-task`, `#### quarkus-build-image`)
  - `### 7. Plugin configuration`
  - `### 8. Environment variables` (`#### NX_MAVEN_CLI`, `#### NX_MAVEN_CLI_OPTS`, `#### Using a .env file`)
  - `### 9. Visualizing the project graph`
  - `### 10. Understanding parent projects vs aggregator projects`
  - `### 11. Project tagging`
  - `### 12. Version management`
  - `### 13. Other generators` (`#### Preset`, `#### Wrapper`)
- `## License`

**First impression:** H1 = package name; a single badge (npm version); one-line tagline "This plugin adds Maven multi-module capabilities to Nx workspace." No logo, no features bullets, no TOC.

**Getting started:** two-tier. A compact "Quick Start" up top -- one copy-paste 5-command bash block with `# 1. ...` comments -- then a deep numbered "Getting Started" (0-13) that expands every step, starting with "0. Prerequisites".

**Options presentation:** executor subsections (`run-task`, `quarkus-build-image`) with bash examples; a "Plugin configuration" section; environment-variable subsections.

**Programmatic API:** none.

**Positioning:** none.

**Length + tone:** long (~634 lines), thorough, neutral/technical, Title-Case + numbered headings, essentially ASCII (no emoji).

**Idioms worth borrowing:** "Quick Start = one copy-paste block" at the top, then a numbered deep-dive; a "Supported versions" matrix near the top; "Prerequisites" as an explicit step 0. **Its ASCII / no-emoji tone matches angular-typechecker's house style.**

---

## 9. @nx/* first-party plugins (@nx/eslint, @nx/vite, @nx/js, @nx/angular) -- FINDING

**Source:** `https://registry.npmjs.org/@nx/eslint` (and siblings): the packument `readme` field is empty ("ERROR: No README data found!"); `github.com/nrwl/nx` `packages/<name>/README.md` returns 404 on raw GitHub.

**Finding:** Nx's OWN first-party plugins ship **no README**. Their `package.json` `homepage` points at nx.dev docs, and all discovery/documentation lives on the nx.dev site. There is no README structure to template from these.

**Implication:** angular-typechecker is a COMMUNITY plugin seeking the Nx plugin-registry listing, so it should follow the community pattern (a full, self-contained README -- entries 1-8), NOT the first-party "empty README, defer to a docs site" pattern.

---

## Patterns across this slice

**Common heading order** (the community plugins that ship a real README -- entries 1-8 -- converge on this skeleton):

1. `# <package-name>` as H1 (the hype variant instead makes the tagline the H1).
2. Badge row -- npm-version badge is near-universal; CI, license, and downloads are common.
3. Optional bold one-line tagline (and, for the polished ones, a logo/banner image).
4. Optional Features bullet list.
5. Optional TOC (about half include one).
6. Installation -- an npm command; the polished ones show yarn/pnpm variants too.
7. Getting started / Configuring / Usage -- **generator first** (`nx g <plugin>:configuration|install|init`), then run the executor/target. Wiring is shown as `nx.json` (inferred plugin) or `project.json` (executor target) JSON/JSONC snippets.
8. Options / Configuration -- most use a markdown table (Option / Type / Default / Description); ngx-deploy-npm instead documents per-flag in prose.
9. Optional Guides / advanced / CI-CD worked examples.
10. Compatibility-with-Nx version matrix -- common, placed near the bottom.
11. License / Contributors / Recognitions at the very bottom.

**Nearly all of them do:**
- Lead with an H1 and at least an npm-version badge.
- Make "install command + generator command" the fast path to a first run.
- Wire the plugin via a JSON/JSONC snippet (nx.json inferred plugin, or project.json executor target).
- Put positioning -- when there is any -- as a compatibility matrix, NOT a "why us / vs them" essay. (Only the nx-verdaccio marketing README does heavy top-of-page positioning with benchmarks and bad-vs-good comparison tables.)
- Document options as a table (the dominant form).

**Only some do:**
- A logo/banner image (stylelint, ngx-deploy-npm, nx-verdaccio marketing).
- A TOC (stencil, ngx-deploy-npm).
- Multi-package-manager install blocks (stylelint, stencil).
- Worked CI/CD examples (semver, ngx-deploy-npm).
- Heavy positioning/benchmarks (only nx-verdaccio marketing).
- Emoji headings (nx-verdaccio, stylelint, ngx-deploy-npm) vs strict ASCII (nx-maven, analog, the nx-verdaccio published README).
- **Document a programmatic API: NONE do.** Every surveyed package is CLI/executor/generator-only.

**Direct relevance to angular-typechecker** (an executor + init/configuration generators + a `runTypecheck` programmatic API, ASCII-only, no hype):
- Closest structural templates: **nx-stylelint** (executor + generator + config + bottom compatibility matrix) and the **nx-verdaccio published README** (one H2 per capability, one H3 per executor with a project.json snippet).
- House-style match for tone: **@jnxplus/nx-maven** and **@analogjs/platform** (ASCII, no emoji).
- The `runTypecheck` programmatic API has NO ecosystem convention to copy -- a dedicated `## Programmatic API` H2 (import + signature + a short example) would be a genuine differentiator, not a borrowed pattern.
- A "Compatibility with Nx / Angular / TypeScript" version matrix near the bottom is an idiom worth adopting (stylelint, semver, nx-maven, ngx-deploy-npm all have one), and it fits the project's tightly-pinned stack.
