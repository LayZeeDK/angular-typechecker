# README Corpus Slice 04 -- Modern TS build/run/dev tooling + README meta conventions

**Researched:** 2026-07-04
**Scope:** (A) 8 real TS-tooling package READMEs, fetched verbatim from source; (B) cross-cutting README best-practice conventions.
**Target we will eventually document (context only):** `angular-typechecker` -- an Nx plugin (typecheck executor + init/config generators + a small `runTypecheck` API) that runs the complete Angular compiler type-check with no build/emit, for CI and AI agents. ASCII-only, no emoji, no hype, Prettier-formatted, npm-published with provenance.

> ASCII-only note: several surveyed READMEs prefix headings with a decorative emoji. Per this repo's hard ASCII-only rule, such headings are transcribed here with an `(emoji)` marker in place of the glyph, and the practice is flagged as an anti-pattern for our package. Curly quotes, em dashes, and arrows in quoted source text are normalized to ASCII (`"`, `--`, `<->`).

---

# PART A -- Tooling README survey (8 packages)

## A1. tsx (privatenumber/tsx)

- **URL:** https://raw.githubusercontent.com/privatenumber/tsx/master/README.md (default branch `master`)
- **Ordered heading outline (verbatim):**
  - `<h1 align="center">` logo + badges (HTML, no text H1)
  - `## Sponsors`
- **First-impression block:** Fully HTML-centered card. Dark/light `<picture>` logo, two badges (`badgen.net/npm/v/tsx` version, `badgen.net/npm/dm/tsx` monthly downloads), a one-line tagline ("TypeScript Execute (tsx): The easiest way to run TypeScript in Node.js"), then a centered nav row: `Documentation | Getting started ->`. No feature list, no TOC.
- **Getting-started shape:** NONE in the README. The README is a landing card that funnels to the docs site (tsx.hirok.io). All install/usage lives off-repo.
- **Options presentation:** None in README (docs site).
- **Programmatic-API section:** None in README.
- **Positioning:** A single tagline line does all the positioning; everything else is deferred to docs.
- **Approx length:** ~32 lines / 1.4 KB. Extremely short.
- **Tone + heading case:** Marketing-lite, centered. Only real heading is `## Sponsors` (Title Case single word).
- **Idioms to borrow:** Crisp one-line "what it is" tagline; explicit `Documentation | Getting started ->` nav so readers instantly know where the real docs are.
- **Anti-patterns for us:** README-as-billboard offloads 100% of usage to an external site -- wrong for a CI/agent tool that must be self-documenting on npm where relative doc links may not resolve. Sponsor block dominating the README is noise for our audience.

## A2. tsup (egoist/tsup)

- **URL:** https://raw.githubusercontent.com/egoist/tsup/main/README.md
- **Ordered heading outline (verbatim):**
  - `> [!WARNING]` deprecation callout (points to tsdown) -- ABOVE the H1
  - `# tsup`
  - `## (emoji) What can it bundle?`
  - `## (emoji) Install`
  - `## (emoji) Usage` -> `### Bundle files`
  - `## (emoji) Documentation`
  - `## (emoji) Discussions`
  - `## Sponsors`
  - `## Project Stats`
  - `## License`
- **First-impression block:** GitHub-alert deprecation warning first (unusual but effective -- tells you immediately the project is unmaintained). Then plain `# tsup` H1, two inline badges (`badgen` version + downloads), one-line tagline ("Bundle your TypeScript library with no config, powered by esbuild"). No logo, no TOC.
- **Getting-started shape:** `Install` (three package managers: npm / yarn / pnpm) then `Usage > Bundle files` with a minimal `tsup [...files]` command and a multi-file example. Front-loads the runnable path.
- **Options presentation:** Deferred -- "For all configuration options, please see the API docs" links to jsdocs.io and the docs site. No options table in README.
- **Programmatic-API section:** None in README (link out only).
- **Positioning:** Tagline + a short "What can it bundle?" section listing supported inputs.
- **Approx length:** ~75 lines / 2.2 KB. Short.
- **Tone + heading case:** Friendly, emoji-prefixed sentence-case headings.
- **Idioms to borrow:** Deprecation/status callout placed ABOVE the title where it cannot be missed; three-package-manager install block; "what can it handle?" scoping section.
- **Anti-patterns for us:** Emoji headings (violates our ASCII rule); config options entirely offloaded to jsdocs.io.

## A3. unbuild (unjs/unbuild)

- **URL:** https://raw.githubusercontent.com/unjs/unbuild/main/README.md
- **Ordered heading outline (verbatim):**
  - `# unbuild`
  - (badges via `<!-- automd:badges -->` autogen block)
  - `> A unified JavaScript build system` (blockquote tagline)
  - `> [!NOTE]` callout (experimenting with successor obuild)
  - `### (emoji) Optimized bundler`
  - `### (emoji) Automated config`
  - `### (emoji) Bundleless build`
  - `### (emoji) Passive watcher`
  - `### (emoji) Untype Generator`
  - `### (emoji) Secure builds`
  - `## Usage`
  - `## Configuration`
  - `## Recipes` -> `### Decorators support`, `### Generate sourcemaps`
  - `## (emoji) Development`
  - `## License`
- **First-impression block:** Plain H1, two auto-generated shields.io badges (version + downloads, wrapped in `automd` markers), a blockquote one-liner, then a NOTE callout. Feature list is rendered as a run of `###` sub-headings (each feature = a heading with a paragraph) rather than a bullet list. No TOC.
- **Getting-started shape:** `Usage` walks a full happy path: create `src/index.ts`, edit `package.json` (full exports/main/types/files block shown), then `npx unbuild`. Config is inferred, so getting-started needs almost no config.
- **Options presentation:** `Configuration` shows `build.config.ts` with `defineBuildConfig(...)`, inline-commented option examples, and single-config vs array-of-configs variants. Full option list linked to `./src/types.ts` (a relative link -- a caveat on npm). Inline comments carry the per-option docs.
- **Programmatic-API section:** `defineBuildConfig` config helper is the "API"; no runtime/imported-function API.
- **Positioning:** Feature-heading run + tagline near the top.
- **Approx length:** ~221 lines / 5.7 KB. Medium.
- **Tone + heading case:** Neutral, sentence-case; feature headings emoji-prefixed. Uses `automd` to keep badges/sections in sync with code.
- **Idioms to borrow:** Full `package.json` snippet in getting-started (shows exactly what to add); config via a typed `defineX()` helper with inline-commented options; `Recipes` section for common one-off needs; NOTE callout for project direction.
- **Anti-patterns for us:** Option reference points to a relative `./src/types.ts` link (breaks on npm and is not human-readable docs); emoji headings; badges hidden behind autogen markers (fine, but do not depend on tooling we do not run).

## A4. tshy (isaacs/tshy)

- **URL:** https://raw.githubusercontent.com/isaacs/tshy/main/README.md
- **Ordered heading outline (verbatim, H1-H3):**
  - `# tshy - TypeScript HYbridizer`
  - `> [!NOTICE]` upgrade block (v3->v4/v5)
  - `## USAGE`
  - `## Dual Package Hazards` -> `### What Does tshy Do Instead?`, `### "Dual Module Hazard" is a fact of life anyway`, `### Module Local State`
  - `## Handling Default Exports`
  - `## Very Old Module Resolution Algorithms`
  - `## Configuration` -> `### How to Configure Tshy`, `### exports`, `### Glob Exports`, `### Live Dev`, `### Package #imports`, `### Setting the Compiler (Temporary Preview Beta Only!)`, `### Making Noise`, `### Selecting Dialects`, `### Suppressing the self-link`, `### Old Style Exports (top-level main, module, types)`
  - `## CommonJS Dialect Polyfills`
  - `## Excluding from a build using .cts and .mts files`
  - `## Excluding Files Entirely From All Builds`
  - `## Other Targets: browser, deno, etc.`
  - `## Atomic Builds`
  - `## Exports Management`
  - `## TSConfigs` -> `### Loading from Source`, `### Custom project`
  - `## src/package.json`
  - `## Local Package exports`
- **First-impression block:** Plain text H1 with an expanded acronym in the title itself ("TypeScript HYbridizer"), a two-paragraph description, then a NOTICE upgrade block. No logo, no badges, no feature bullets, no TOC (despite being ~1076 lines -- a scannability problem).
- **Getting-started shape:** `## USAGE` (all-caps) immediately: `npm i -D tshy`, the minimal `package.json` (`files` + `prepare` script), where to put source, where output lands. Fast runnable path.
- **Options presentation:** A long prose-heavy `Configuration` section, one `###` per option, with rationale and edge cases. Reference-manual style, not a table -- deep but hard to scan.
- **Programmatic-API section:** None -- config is entirely `package.json`-driven.
- **Positioning:** The intro paragraphs plus the entire `Dual Package Hazards` essay ARE the positioning (why this tool exists vs the alternatives).
- **Approx length:** ~1076 lines / 31 KB. Very long, monolithic single-page reference.
- **Tone + heading case:** Authoritative, essayistic; inconsistent heading case (`USAGE` all-caps next to `Dual Package Hazards` Title Case). No TOC hurts navigation badly at this length.
- **Idioms to borrow:** Expanding the acronym in the H1; a dedicated "why this problem is hard / what we do instead" section for a nuanced domain (our analog: why the whole-program type-check is separable and why a bare `ngc --noEmit` is not enough); minimal `package.json`-based getting-started.
- **Anti-patterns for us:** 1000+ lines with NO table of contents is the textbook scannability failure (standard-readme mandates a TOC above 100 lines); inconsistent heading case; options as prose walls instead of a scannable table.

## A5. pkgroll (privatenumber/pkgroll)

- **URL:** https://raw.githubusercontent.com/privatenumber/pkgroll/master/README.md (default branch `master`)
- **Ordered heading outline (verbatim, H1-H4):**
  - `<h1 align="center">` logo + `<sup>pkgroll</sup>` + badges (HTML)
  - `### Features`
  - `## Install`
  - `## Quick setup`
  - `## Usage` -> `### Entry-points` (-> `#### Wildcard exports`, `#### Subpath Imports`), `### Output formats`, `### Bin hashbang`, `### Dependency bundling & externalization`, `### Aliases` (-> `#### Import map`, `#### Tsconfig paths`), `### Target` (-> `#### Strip node: protocol`), `### Custom tsconfig.json path`, `### Export condition`, `### ESM <-> CJS interoperability` (-> `#### require() in ESM`), `### Native modules` (-> `#### Handling dependencies with native modules`), `### Import attributes`, `### Environment variables`, `### Define`, `### Minification`, `### Watch mode`, `### Clean dist`, `### License extraction` (-> `#### Custom output path`, `#### Auto-detection`, `#### Content placement`), `### Source maps` (-> `#### Declaration source maps`), `### Filtering package.json entry points`
  - `## Dev vs Prod config`
  - `## FAQ` -> `### Why bundle with Rollup?`, `### Why bundle Node.js packages?`, `### How does it compare to tsup?`
  - `## Sponsors`
- **First-impression block:** Centered HTML header (small logo, `<sup>` package name, version + downloads badges), then a two-line italic tagline ("pkgroll is a JavaScript package bundler powered by Rollup that automatically builds your package from entry-points defined in package.json. No config necessary!"), then a compact checkmark `### Features` bullet list. No TOC despite length (GitHub renders its own sidebar TOC, which softens this).
- **Getting-started shape:** `Install` (one line) -> `Quick setup` (numbered 1-2-3: set up src/dist, define entry-files in `package.json` with a fully-commented json5 block, then `npm run build`). Excellent front-loaded runnable path with a TIP callout.
- **Options presentation:** Each capability is its own `###`/`####` under `Usage`, with a short "what/why" paragraph and a code/CLI snippet. Feature-per-heading rather than one big flag table -- scannable via GitHub's heading sidebar.
- **Programmatic-API section:** None -- it is a CLI/bin; all interaction is via `package.json` + CLI flags.
- **Positioning:** Tagline + Features up top; a `FAQ` at the BOTTOM handles comparative positioning ("Why bundle with Rollup?", "How does it compare to tsup?").
- **Approx length:** ~535 lines / 21 KB. Long, but well-sectioned.
- **Tone + heading case:** Practical, sentence-case headings. Italic tagline. Consistent "one capability = one heading + one snippet" rhythm.
- **Idioms to borrow:** Numbered `Quick setup` with a single fully-commented config block; comparative `FAQ` at the end ("How does it compare to X?" -- directly analogous to our "vs `@nx/js` typecheck / vs bare `ngc --noEmit`" positioning); checkmark feature list.
- **Anti-patterns for us:** No in-README TOC at 535 lines (relies on GitHub sidebar, which is absent on npm); centered HTML header may not render on npm.

## A6. vitest (vitest-dev/vitest)

- **URL:** https://raw.githubusercontent.com/vitest-dev/vitest/main/README.md
- **Ordered heading outline (verbatim):**
  - `<p align="center">` logo + `<h1 align="center">Vitest` + centered tagline + version badge + nav row (Documentation | Getting Started | Examples | Why Vitest?) + zh docs link (HTML)
  - `## Features`
  - `## Sponsors`
  - `## Credits`
  - `## Contribution`
  - `## License`
- **First-impression block:** Centered HTML logo, H1, one-line tagline ("Next generation testing framework powered by Vite."), a SINGLE version badge, a "Get involved!" chat link, and a centered nav row to docs sections. A bulleted `## Features` list (each item deep-links into the docs) plus a Node/Vite version requirement blockquote and one tiny runnable example (a `describe/it/expect` snippet + `npx vitest`).
- **Getting-started shape:** Minimal -- a single illustrative test snippet and `$ npx vitest`; real getting-started deferred to the docs site via the nav row.
- **Options presentation:** None in README -- all config/options in docs.
- **Programmatic-API section:** None -- one usage snippet only.
- **Positioning:** Tagline + a rich `## Features` bullet list (each linking to docs) does the positioning at the top.
- **Approx length:** ~112 lines / 4.2 KB. Short.
- **Tone + heading case:** Polished, centered, single-word Title-case headings (`Features`, `Sponsors`, `Credits`, `License`).
- **Idioms to borrow:** Feature bullets that each deep-link to the relevant doc page; a nav row of key doc destinations right under the tagline; one minimal runnable snippet even in a docs-offloaded README; explicit runtime-version requirement blockquote.
- **Anti-patterns for us:** Heavy reliance on the external docs site (all options/API off-repo); single badge is arguably too few for a published lib.

## A7. @changesets/cli (changesets/changesets, packages/cli)

- **URL:** https://raw.githubusercontent.com/changesets/changesets/main/packages/cli/README.md
- **Ordered heading outline (verbatim):**
  - `## @changesets/cli (emoji)` (note: package uses an H2, not H1, as its title)
  - (two `npmx.dev` badges: version + "View changelog")
  - `## Getting Started`
  - `## Core Concepts`
  - `## Base workflow`
  - `## Commands` -> `### init`, `### add`, `### version`, `### publish`, `### status`, `### pre`, `### Bumping peerDependencies`
- **First-impression block:** Title as `## @changesets/cli` (emoji suffix), two badges (npmx.dev version + a "View changelog" badge linking to `./CHANGELOG.md`), a one-line description ("A tool to manage versioning and changelogs with a focus on monorepos."), then "Read the docs to learn more" link. No logo, no feature list, no TOC.
- **Getting-started shape:** `Getting Started` gives monorepo vs non-monorepo install variants (`yarn add ...` + `yarn changeset init`), then "add your first changeset" (`yarn changeset`). Runnable path is front-loaded and branches by scenario.
- **Options presentation:** `Commands` section = one `###` per subcommand, each with a usage code block, prose, and dash-bulleted flags (e.g. `--empty`, `--open`, `--message`). This is the closest thing in the corpus to a clean CLI reference embedded in the README.
- **Programmatic-API section:** None -- it is a CLI; commands ARE the interface.
- **Positioning:** `Core Concepts` (after Getting Started) explains the mental model ("intent to release stored as data"); comparative positioning is light.
- **Approx length:** ~219 lines / 7.5 KB. Medium.
- **Tone + heading case:** Instructional, Title Case section headings, lowercase command sub-headings (matching the actual command names -- good).
- **Idioms to borrow:** Per-command sub-headings named exactly after the command; usage code block + prose + flag bullets per command (directly reusable for our executor options and CLI-ish invocation); scenario-branched install (monorepo vs single).
- **Anti-patterns for us:** Uses H2 as the title (no H1); flags as loose bullets rather than a table (fine at this size, weaker at scale); emoji in title.

## A8. np (sindresorhus/np)

- **URL:** https://raw.githubusercontent.com/sindresorhus/np/main/readme.md (lowercase `readme.md`)
- **Ordered heading outline (verbatim, H1-H3):**
  - `# np` (with an inline XO-code-style shields badge in the H1)
  - `> A better npm publish` (blockquote tagline)
  - (animated screenshot GIF)
  - `## Why` -> `### Why not`
  - `## Prerequisite`
  - `## Install`
  - `## Usage`
  - `## Interactive UI`
  - `## Config`
  - `## Tips` -> `### npm hooks`, `### Release script`, `### User-defined tests`, `### Signed Git tag`, `### Private packages`, `### Public scoped packages`, `### Private Org-scoped packages`, `### Publish to a custom registry`, `### Package managers`, `### Publish with a CI`, `### Publish to gh-pages`, `### Initial version`, `### Release an update to an old major version`, `### The prerequisite step runs forever on macOS`, `### Ignore strategy`
  - `## FAQ` -> `### I get an error when publishing my package through Yarn`, `### np hangs during the "Publishing package" step`
  - `## Maintainers`
- **First-impression block:** Plain `# np` H1 with a single inline badge (XO code style), a blockquote tagline ("A better npm publish"), then an animated `screenshot.gif` demonstrating the tool in action. The `## Why` section IS a long benefit-bullet list (what np does for you), immediately followed by `### Why not` (honest limitations: no monorepos, not for CI). No TOC (the `## Why` bullets partly double as one).
- **Getting-started shape:** `Prerequisite` (Node/npm/Git versions) -> `Install` (`npm i -g np`) -> `Usage` shows the full `np --help` output verbatim (version specifiers, every flag, examples). CLI-help-as-usage is very effective for a CLI.
- **Options presentation:** The `np --help` block enumerates every flag with one-line descriptions; `Config` explains config file locations and precedence in prose; `Tips` is a large recipe cookbook (one `###` per scenario).
- **Programmatic-API section:** None -- CLI-only.
- **Positioning:** `## Why` (benefits) + `### Why not` (anti-scope) placed FIRST after the tagline -- a standout idiom: it lets a reader disqualify the tool in seconds (honest, respects the reader's time per Art-of-README).
- **Approx length:** ~396 lines / 15.6 KB. Long-ish, recipe-heavy.
- **Tone + heading case:** Direct, sentence-case headings. GIF demo up top. Honest scoping.
- **Idioms to borrow:** `Why` + `Why not` pair right after the tagline (perfect fit for us: "why a decoupled complete type-check" + "not a build, not a linter, not a test runner, no monorepo-wide orchestration in v0.0.1"); `Prerequisite` version block (Node/Angular/Nx/TS ranges); embedding `--help` output as the usage reference; a `Tips`/recipes cookbook for CI and scenario wiring.
- **Anti-patterns for us:** GIF-as-critical-info (Art-of-README warns: do not rely on images to relay critical information -- and npm may not render it); no in-README TOC at ~400 lines.

### Cross-corpus observations (Part A)

- **Two archetypes.** (1) Docs-offloaded landing cards -- tsx, tsup, vitest -- short, centered, badge + tagline + nav to an external docs site, minimal or zero options in-README. (2) Self-contained references -- tshy, pkgroll, np, changesets, unbuild -- the README IS the manual.
- **None ship a prominent programmatic-API section.** All 8 are CLIs / build tools / config-driven. The nearest thing to "API docs" is (a) a typed `defineConfig()` helper with inline-commented options (unbuild), or (b) a per-command / per-flag reference (changesets, np). This is a GAP relative to `angular-typechecker`, which has BOTH a config-driven Nx executor AND a small imported `runTypecheck` API -- so we cannot copy any single exemplar wholesale for the API part; combine the changesets-style option reference with a compact standard-readme-style `API` section.
- **Badges are minimal:** almost always just version + monthly downloads (1-2 badges). Providers vary: `badgen.net` (privatenumber: tsx, pkgroll), `shields.io`/`img.shields.io` (unbuild, np, vitest), `npmx.dev` (changesets, vitest). No one shows a wall of badges.
- **Front-loaded runnable path is near-universal:** Install -> minimal config/command -> run, within the first screenful (tsup, unbuild, tshy, pkgroll, changesets, np). Even docs-offloaded READMEs (vitest) keep one runnable snippet.
- **Callouts (`> [!NOTE]` / `> [!WARNING]` / `> [!TIP]`) are heavily used** for status/deprecation/upgrade notices (tsup, unbuild, tshy, pkgroll) -- but these degrade to plain blockquotes on npm (see Part B).
- **TOC discipline is weak in practice:** the two longest (tshy ~1076 lines, pkgroll ~535, np ~396) have NO in-README TOC, leaning on GitHub's rendered heading sidebar -- which does NOT exist on npm. This is the single most common gap vs the standard-readme spec.
- **Comparative positioning lives at the edges:** either a top feature list / `Why` (vitest, np, unbuild) or a bottom `FAQ` ("How does it compare to tsup?" -- pkgroll). np's `Why` + `Why not` pairing is the strongest reader-respecting pattern.
- **Emoji in headings is common (tsup, unbuild, changesets) -- explicitly OFF-LIMITS for us.**

---

# PART B -- README meta conventions (with sources)

## B1. Badge conventions (shields.io and peers)

- **Standard, high-signal badges for an npm library:** npm version, npm monthly downloads, license, CI build status, and (increasingly) provenance/security. The surveyed corpus confirms version + downloads as the near-universal minimum; most stop there. [CITED: shields.io badge catalog, shields.io/badges/npm-version] [VERIFIED: corpus -- tsx/tsup/pkgroll use badgen version+downloads; unbuild/np/vitest use shields.io/npmx]
- **shields.io URL patterns (dynamic):**
  - Version: `https://img.shields.io/npm/v/<package>` (scoped: `https://img.shields.io/npm/v/@scope/name`)
  - Downloads: `https://img.shields.io/npm/dm/<package>` (monthly), `.../npm/dw/`, `.../npm/dt/` (weekly/total)
  - License: `https://img.shields.io/npm/l/<package>`
  - CI (GitHub Actions): `https://img.shields.io/github/actions/workflow/status/<owner>/<repo>/<workflow-file>.yml`
  - Node engine: `https://img.shields.io/node/v/<package>`
  Common style query params on all endpoints: `?style=flat|flat-square|plastic|for-the-badge|social`, plus `label`, `labelColor`, `color`, `logo`, `logoColor`, `cacheSeconds`, `link`. Default style is `flat`. [CITED: shields.io/badges/npm-version -- documents packageName param + style/label/color/logo params; style values flat|flat-square|plastic|for-the-badge|social]
- **Static badges:** `https://img.shields.io/badge/<label>-<message>-<color>` for things with no live endpoint (e.g. "code style: XO", which np uses in its H1). [VERIFIED: corpus -- np H1 XO badge]
- **How many is too many:** Keep it to a tight row of the few that carry real signal (version, downloads, CI, license, provenance). The standard-readme spec requires badges to be newline-delimited and to have no heading of their own; makeareadme.com lists badges as OPTIONAL metadata. A badge wall is a recognized smell -- none of the 8 surveyed READMEs exceed ~2-3 badges. [CITED: RichardLitt/standard-readme spec -- Badges "Optional", "must be newline delimited", "must not have its own title", "Use shields.io"] [CITED: makeareadme.com]
- **Provenance for us:** since we publish with npm provenance, a provenance/"published with provenance" signal is legitimate; npm itself shows a provenance checkmark on the package page, so a README badge is optional garnish, not required.

## B2. Tagline norms

- Exactly one short sentence immediately under the title, describing what it is (with context), matching the package.json `description` and the GitHub repo description. standard-readme mandates: no heading, under 120 characters, its own line, must NOT start with `> ` (though in practice many popular READMEs -- np, unbuild, tshy -- use a blockquote tagline; treat the 120-char + one-line + matches-description rules as the load-bearing ones). [CITED: RichardLitt/standard-readme -- Short Description: "less than 120 characters", "on its own line", "match the description in the package manager's description field", "match GitHub's description"]
- Art-of-README frames the one-liner as step 2 of "cognitive funneling": name -> one-liner -> usage -> API -> install -> license, ordered by how fast it lets a reader disqualify your tool. Define unfamiliar terms in the tagline itself. [CITED: hackergrrl/art-of-readme -- Key elements / Cognitive funneling]

## B3. Table of contents

- **When a README warrants one:** standard-readme makes a TOC REQUIRED, and explicitly optional only for READMEs shorter than ~100 lines. It must link to all sections, start at the first real section (not the title/TOC), and capture at least all H2s (H3/H4 optional). [CITED: RichardLitt/standard-readme -- Table of Contents: "Required; optional for READMEs shorter than 100 lines", "must capture all level two headings"]
- **Corpus reality:** the long ones (tshy, pkgroll, np) omit it and lean on GitHub's rendered sidebar -- which is ABSENT on npm and in plain-text viewers. For a package that markets itself to CI and AI agents reading the npm/raw README, an explicit TOC above ~100 lines is worth the maintenance.

## B4. Heading case: sentence-case vs Title-Case

- No hard spec rule, but the modern convention (and the corpus majority: unbuild, pkgroll, np) is **sentence case** ("Getting started", "Watch mode"). tshy demonstrates the anti-pattern: inconsistent mix (`USAGE` all-caps beside `Dual Package Hazards` Title Case). Pick one and be consistent -- consistency matters more than which. [VERIFIED: corpus -- sentence-case majority; tshy inconsistency] [CITED: hackergrrl/art-of-readme -- "predictable format ... be consistent to save your users precious cognitive cycles"]
- For a CLI/executor, name command/option sub-headings EXACTLY after the real command or flag (changesets `### init/add/version`, np `--flag` help block). [VERIFIED: corpus]

## B5. Length and scannability; front-load the runnable path

- "The ideal README is as short as it can be without being any shorter. Detailed documentation is good -- make separate pages for it -- but keep your README succinct." [CITED: hackergrrl/art-of-readme -- Brevity]
- makeareadme.com counter-weighs: "Too long is better than too short" -- do not cut information, move depth to separate docs. Net rule: cover the full runnable path + options in the README, push exhaustive reference/edge-cases to docs. [CITED: makeareadme.com]
- **Front-load the runnable path:** Perl's `perlmodstyle` (quoted by both standard-readme and art-of-readme): the SYNOPSIS should contain a minimal example of use (as little as one line), the DESCRIPTION a few broad paragraphs, with detail deepening as the reader scrolls -- "someone slightly familiar should refresh their memory without hitting page down." Corpus confirms: install + minimal command within the first screenful. [CITED: standard-readme + art-of-readme, quoting perlmodstyle]
- **Cognitive funneling / care about people's time:** order sections so a reader can disqualify fast (name -> one-liner -> usage -> API -> install -> caveats -> license). np's `Why` + `Why not` is the exemplar. [CITED: hackergrrl/art-of-readme -- Cognitive funneling, Care about people's time; README Checklist: "Caveats and limitations mentioned up-front", "Doesn't rely on images to relay critical information"]

## B6. npmjs.com markdown rendering caveats

npm renders READMEs with **marky-markdown** (markdown-it + sanitize-html), NOT GitHub's renderer. Concrete consequences:

- **Relative links and images are unreliable.** marky-markdown is supposed to rewrite relative URLs to absolute GitHub URLs using the `repository` field, but this frequently fails (documented registry-side bugs, especially for scoped packages; sometimes fixed only by republishing). Relative images via HTML `<img src="./...">` are a known failure; markdown-syntax relative images fare better but are still fragile. **Rule: use absolute (raw.githubusercontent.com) URLs for every image and every doc link you need to work on npm.** [CITED: npm/marky-markdown README + issues #320/#432; npm blog "nicely presented markup"; npm/www #119] [VERIFIED: corpus -- unbuild links options to a relative ./src/types.ts, which would not resolve on npm]
- **HTML is sanitized.** marky-markdown runs sanitize-html: `<script>`, `<iframe>`, inline styles, and many attributes are stripped; links get `rel="nofollow"`. Do not rely on arbitrary HTML/CSS. [CITED: npm/marky-markdown README -- uses sanitize-html to strip script/iframe/inline styles for XSS protection]
- **Centered HTML (`<p align="center">` / `<h1 align="center">`) is not guaranteed.** Several corpus READMEs (tsx, vitest, pkgroll, np) rely on it; the sanitizer's allowed-attribute set decides whether `align` survives, and centering commonly does NOT render the same on npm as on GitHub. Prefer a layout that reads fine left-aligned. [CITED: npm/marky-markdown sanitize-html behavior] [VERIFIED: corpus -- tsx/vitest/pkgroll centered headers]
- **GitHub alert syntax degrades.** `> [!NOTE]` / `> [!WARNING]` / `> [!TIP]` (used by tsup, unbuild, tshy, pkgroll) is a GitHub-only extension; on npm it renders as a plain blockquote with the literal `[!NOTE]` text visible. Safe, but do not depend on the styled callout box; keep the text self-explanatory (e.g. start the line with "Note:"). [CITED: GitHub alerts are a GFM extension not in marky-markdown/CommonMark] [VERIFIED: corpus -- 4 of 8 use alert callouts]
- **Emoji render on npm** but violate this repo's ASCII-only rule regardless -- moot for us.

---

# PART C -- Section-level guidance distilled from the specs

- **standard-readme required order:** Title -> Banner(opt) -> Badges(opt) -> Short Description -> Long Description(opt) -> TOC(req >100 lines) -> Security(opt) -> Background(opt) -> Install -> Usage -> [Extra Sections] -> API(opt) -> Maintainers(opt) -> Thanks(opt) -> Contributing(req) -> License(req, must be last). Sections must appear in this order; optional ones may be omitted. [CITED: RichardLitt/standard-readme spec]
- **makeareadme.com suggested sections:** Name, Description, Badges, Visuals, Installation, Usage, Support, Roadmap, Contributing, Authors/acknowledgment, License, Project status. [CITED: makeareadme.com]
- **art-of-readme checklist:** one-liner; background context + links; unfamiliar terms linked; a clear RUNNABLE example; install instructions; extensive API docs; cognitive funneling; caveats/limitations up-front; do not rely on images for critical info; license. [CITED: hackergrrl/art-of-readme -- README Checklist]

---

# PART D -- Synthesis: a recommended modern outline

Ordered section list for `angular-typechecker` (an ASCII-only, provenance-published Nx plugin with an executor + generators + a small `runTypecheck` API), drawn from Parts A-C. One-line rationale each. Left-aligned, sentence-case headings, absolute image/doc URLs, no emoji, TOC because it will exceed ~100 lines.

1. **Title (`# angular-typechecker`)** -- self-evident H1 matching the npm package name (standard-readme Title rule; avoid changesets' H2-as-title miss).
2. **Badges row (version, downloads, CI, license; provenance optional)** -- 3-4 shields.io badges, newline/space-delimited, no heading; matches the minimal-badge corpus norm and standard-readme.
3. **One-line tagline (<120 chars, matches package.json description)** -- "Run the complete Angular compiler type-check (TS + template + NG8xxx) with no build or emit, for CI and AI agents." Cognitive-funneling step 2; must match GitHub + npm description.
4. **Why / Why not (short benefit bullets + honest anti-scope)** -- np's strongest idiom; states what it does AND that it is not a build, not a linter, not a test runner, no monorepo-wide orchestration in v0.0.1 -- lets a reader disqualify in seconds (art-of-readme "care about people's time").
5. **Table of contents** -- required above ~100 lines and load-bearing on npm where GitHub's sidebar is absent (standard-readme).
6. **Prerequisites / compatibility (Nx 23.x, Angular 22.x, TS >=6.0 <6.1, Node ranges)** -- np's `Prerequisite` block; sets the exact supported matrix up front so consumers self-qualify.
7. **Install** -- one `npm i -D angular-typechecker` block; corpus-universal front-loaded step.
8. **Quick start / Usage (front-loaded runnable path)** -- minimal `project.json` target wiring (manual, per v0.0.1) + the `nx run <project>:typecheck` invocation, within the first screenful; pkgroll/tshy numbered-setup idiom.
9. **Executor options** -- a scannable options TABLE (name / type / default / description) derived from `schema.json`, plus one fully-commented config snippet (changesets flag-reference + unbuild commented-config idioms); front-load the runnable path, keep exhaustive edge cases in docs.
10. **Generators (init / configuration)** -- per-generator sub-heading named after the generator, usage block + prose (changesets per-command pattern).
11. **Programmatic API (`runTypecheck`)** -- compact standard-readme `API` section: signature, params, return type, one runnable import example, caveats -- the corpus gap we must fill ourselves rather than copy.
12. **How it compares (vs `@nx/js`/`tsgo` typecheck, vs bare `ngc --noEmit`, vs the build's coupled check)** -- pkgroll's bottom-FAQ comparative-positioning idiom; the core differentiator, so give it a named section.
13. **Recipes / CI (cache, agent loop, per-project runs)** -- np's `Tips`/cookbook idiom for scenario wiring; where the CI/agent audience actually lives.
14. **Caveats and limitations** -- surfaced explicitly (art-of-readme checklist: caveats up-front); e.g. Approach A gatherer scope, stable-Angular-only support.
15. **Contributing** -- link to CONTRIBUTING / issues (standard-readme required).
16. **License** -- MIT, (c) Lars Gyrup Brink Nielsen; last section (standard-readme: License must be last).

**Overriding rendering rules (Part B6), applied throughout:** absolute `raw.githubusercontent.com` URLs for any image/badge/doc link; no reliance on centered HTML or `> [!NOTE]` styled boxes (write "Note:" text that stands alone); no emoji; left-aligned; Prettier-formatted markdown.

---

## Sources

Primary (HIGH -- fetched verbatim this session):
- tsx README -- https://raw.githubusercontent.com/privatenumber/tsx/master/README.md
- tsup README -- https://raw.githubusercontent.com/egoist/tsup/main/README.md
- unbuild README -- https://raw.githubusercontent.com/unjs/unbuild/main/README.md
- tshy README -- https://raw.githubusercontent.com/isaacs/tshy/main/README.md
- pkgroll README -- https://raw.githubusercontent.com/privatenumber/pkgroll/master/README.md
- vitest README -- https://raw.githubusercontent.com/vitest-dev/vitest/main/README.md
- @changesets/cli README -- https://raw.githubusercontent.com/changesets/changesets/main/packages/cli/README.md
- np README -- https://raw.githubusercontent.com/sindresorhus/np/main/readme.md
- standard-readme spec -- https://raw.githubusercontent.com/RichardLitt/standard-readme/master/spec.md
- art-of-readme -- https://raw.githubusercontent.com/hackergrrl/art-of-readme/master/README.md

Secondary (MEDIUM -- consulted/summarized):
- makeareadme.com -- https://www.makeareadme.com/
- shields.io npm version badge docs -- https://shields.io/badges/npm-version
- npm marky-markdown parser + rendering issues -- https://github.com/npm/marky-markdown (issues #320, #432), https://github.com/npm/www/issues/119, npm blog "nicely presented markup" (https://blog.npmjs.org/post/109508231330/nicely-presented-markup)
