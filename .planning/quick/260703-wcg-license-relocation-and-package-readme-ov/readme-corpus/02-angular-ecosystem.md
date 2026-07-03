# README Corpus Slice 02 -- Angular Ecosystem Libraries and Tooling

Surveyed 2026-07-04. Each entry was fetched from the live source (raw GitHub) and
cited. Emoji that appear in source headings are described in prose, not reproduced
(this repo is ASCII-only). Heading outlines are otherwise verbatim and in order.

Packages surveyed (10): angular-eslint (root + eslint-plugin), @analogjs/analog,
ngxtension, ng-packagr, spartan, @jsverse/transloco, @compodoc/compodoc, @ngrx
(platform root), @taiga-ui/core.

Dropped as 404 (the `ngneat` org repos have been moved/removed): @ngneat/spectator,
@ngneat/until-destroy. Note: `@ngneat/transloco` is now published as
`@jsverse/transloco` and surveyed under that name.

---

## 1. angular-eslint (root README)

**Source:** https://raw.githubusercontent.com/angular-eslint/angular-eslint/main/README.md

**Ordered heading outline (H1/H2/H3):**
- (H1, centered) Angular ESLint
- ## Contents
- ## Quick Start
- ## Supported Angular CLI Versions
- ## Supported ESLint Versions
- ## Usage with Nx Monorepos
- ## Packages included in this project
- ## Package Versions
- ## Adding ESLint configuration to an existing Angular CLI project which _has no existing linter_
- ## Using ESLint by default when generating new Projects within your Workspace
- ## Configuring ESLint
- ## Writing Custom ESLint Rules
- ## Philosophy on lint rules which enforce code formatting concerns
- ## Linting with the VSCode extension for ESLint
- ## Notes on performance
- ### Background and understanding the trade-offs
- ## Using `eslint-disable` comments in Angular templates
- ## Migrating an Angular CLI project from Codelyzer and TSLint

**First impression:** Centered logo (128x128 PNG via HTML `<p align="center">`),
centered H1 title, one-line centered tagline ("Monorepo for all the tooling which
enables ESLint to lint Angular projects"), then a centered badge row: Build Status,
NPM Version, GitHub license, NPM Downloads, Codecov, Commitizen-friendly. A
blockquote credits typescript-eslint and codelyzer. A markdown `## Contents` TOC of
14 anchor links follows.

**Getting-started shape:** `## Quick Start` is a numbered 3-step list culminating in
a single `ng add angular-eslint` command, then "...and that's it!" prose explaining
what `ng add` auto-wired (including the `angular.json` `schematicCollections`
snippet). Very fast to first working state -- the schematic does the work; almost no
code the user writes by hand.

**API / usage reference:** Prose-heavy with fenced `sh`/`json` snippets. No API
tables in the root README -- it is an orientation/routing document. A "Packages
included in this project" section is a bulleted directory of the 7 sub-packages, each
linking to that package's own README.

**Programmatic API:** Not applicable at root; "Writing Custom ESLint Rules" points to
`@angular-eslint/utils` and `test-utils` sub-packages for the programmatic surface.

**Why / comparison positioning:** No dedicated "why" section. Positioning is implicit
(the tagline + the codelyzer/TSLint migration section at the very bottom). A notable
"Usage with Nx Monorepos" caveat section tells Nx users to defer to Nx tooling
instead -- boundary-setting rather than selling.

**Length + tone:** Long (~300 lines). Conversational-but-precise, Title Case
headings, uses bold warnings ("**Please do not open issues...**"). Heavy on
"here's why this default exists" explanation.

**Idioms worth borrowing:** (a) `ng add <pkg>` as the entire quick start, then
explain what it wired; (b) explicit "Supported <X> Versions" sections with a
major-version-alignment rule stated as a policy; (c) a "Usage with Nx" boundary
section clarifying what the plugin does and does NOT own; (d) TOC of anchor links for
a long doc. **Anti-patterns:** the root README doubles as a monorepo hub, so it is
long and unfocused for any single package -- fine for a monorepo, wrong for a single
publishable package.

---

## 2. @angular-eslint/eslint-plugin (sub-package README)

**Source:** https://raw.githubusercontent.com/angular-eslint/angular-eslint/main/packages/eslint-plugin/README.md

**Ordered heading outline:**
- # @angular-eslint/eslint-plugin
- ## Premade configs
- ## Rules
- ### Possible problems
- ### Suggestions

**First impression:** No logo, no badges, no TOC. Opens with one sentence redirecting
to the monorepo root for "full usage instructions and guidance," then a "Premade
configs" pointer. This is a deliberate thin sub-package README that defers narrative
to the root.

**Getting-started shape:** None here -- install/setup lives at the root. This README
is purely a rules reference.

**API / usage reference:** This is the standout artifact: two large markdown TABLES
(one per rule category, "Possible problems" and "Suggestions"), columns = Rule (linked
to per-rule doc) | Description | recommended | fixable | has-suggestions. The last
three columns use emoji glyphs (check / wrench / bulb) with a "Key" legend above each
table. Tables are auto-generated (fenced by `<!-- begin/end ... rule list -->` and
`<!-- prettier-ignore -->` markers).

**Programmatic API:** No -- it documents lint rules, not an importable API.

**Why / comparison:** None.

**Length + tone:** Medium (~99 lines, mostly table). Terse, reference-grade, no prose.

**Idioms worth borrowing:** (a) a machine-generated capability table with a legend
key and per-item deep links -- ideal shape for enumerating a fixed set of things (for
us: the NG8xxx extended diagnostics or supported project types could be a generated
table); (b) thin sub-package README that redirects to a single canonical doc instead
of duplicating. **Anti-pattern for a standalone publishable package:** a README that
says "see the other repo for how to use this" is fine only inside a monorepo where the
root is co-published context; a solo npm package must be self-sufficient.

---

## 3. @analogjs/analog

**Source:** https://raw.githubusercontent.com/analogjs/analog/main/README.md

**Ordered heading outline:**
- # Analog
- ## Documentation
- ## Features
- ## Getting Started
- ### Partners
- ### Sponsors
- ## Supporting Analog
- ## Contributing
- ## Credits
- ## Contributors (heading ends with a sparkle emoji)

**First impression:** No logo image; an all-contributors badge, then a left-aligned
badge row (NPM Downloads, Discord, Twitter/follow, Vite Plugin Registry). One-line
positioning sentence ("Analog is the meta-framework for building applications and
websites with Angular") plus a comparison sentence ("Similar to other meta-frameworks
such as Next.JS, Nuxt, SvelteKit, Qwik City..."). No TOC.

**Getting-started shape:** `## Documentation` immediately points to analogjs.org (docs
offloaded to a site). `## Getting Started` gives four package-manager variants of
`npm create analog@latest` (npm/pnpm/bun/yarn) plus an "Open in StackBlitz" button.
Fast to scaffold; no inline code sample of the framework itself -- the create-command
is the whole getting-started.

**Features:** A flat bullet list (9 bullets: Vite, Vitest/Storybook, Nitro, file-based
routing, SSR data fetching, markdown content routes, API routes, hybrid SSR/SSG, CLI +
Nx support).

**API / usage reference:** None in README -- entirely delegated to the docs site.

**Programmatic API:** Not documented in README.

**Why / comparison:** Top-of-README, in the opening two sentences (the "similar to
Next/Nuxt/SvelteKit" framing). No dedicated section, but positioning is the first
thing you read.

**Length + tone:** Long by line count (~300) but that is almost entirely the
all-contributors table and sponsor logos; the substantive README is short. Terse,
conversational, Title Case.

**Idioms worth borrowing:** (a) lead with a one-line comparison to well-known peers so
readers instantly place the tool; (b) `npm create <x>@latest` scaffolding as the
getting-started; (c) offload deep docs to a site and keep README as a landing page.
**Anti-pattern:** the huge inline all-contributors table + sponsor logo wall balloons
the README and buries the (short) real content; fine for a community project, noise
for a focused tool.

---

## 4. ngxtension

**Source:** https://raw.githubusercontent.com/ngxtension/ngxtension-platform/main/README.md

**Ordered heading outline (leading emoji in several headings omitted here):**
- (H1, centered) ngxtension - Angular Extensions
- ## Features & Utilities  (heading begins with a sparkle emoji)
- ## Installation  (rocket emoji)
- ### For Angular CLI or Nx workspaces
- ## Usage  (package emoji)
- ## Documentation  (books emoji)
- ## Version Compatibility Table
- ## Contributors  (sparkle emoji)
- ## License

**First impression:** Centered H1 tagline title, centered 100x100 SVG logo, badge row
(NPM Version, NPM downloads, all-contributors). One-line positioning ("A modern
collection of utilities for Angular -- signals, forms, effects, DOM helpers, and
more"). Horizontal rules (`---`) separate every section. No TOC (defers to docs site).

**Getting-started shape:** `## Installation` = `npm install ngxtension` (with pnpm
variant), then a sub-section: "For Angular CLI or Nx workspaces" runs an init
schematic (`ng generate ngxtension-plugin:init` / `nx generate ...`). `## Usage` shows
two import lines demonstrating the per-entry-point deep-import convention
(`import { injectParams } from 'ngxtension/inject-params'`) and states "All utilities
are tree-shakable and designed for Angular 16+."

**API / usage reference:** README lists feature CATEGORIES as bullets (Signal
Utilities, DOM & Event helpers, Forms, RxJS & Effects, Injection & DI, etc.) with a
"see the full documentation for a complete list and usage examples" pointer. No
per-utility tables -- delegated to ngxtension.dev.

**Programmatic API:** Yes -- the whole library IS an importable API; documented via the
deep-import usage pattern and the categorized feature list, with details on the site.

**Why / comparison:** None explicit; positioning is the one-liner.

**Length + tone:** README body is short (~87 lines before the contributors table).
Terse, category-first, sentence-case-ish with emoji section markers.

**Idioms worth borrowing:** (a) a **Version Compatibility Table** (columns: library
version | release date | Angular version support) -- directly relevant to us for a
Nx/Angular/TS compatibility matrix; (b) show the tree-shakable deep-import convention
in the very first usage example; (c) categorize a large API surface into named buckets
rather than listing everything. **Anti-pattern:** emoji-prefixed headings (breaks in
ASCII-only pipelines like ours -- avoid).

---

## 5. ng-packagr

**Source:** https://raw.githubusercontent.com/ng-packagr/ng-packagr/main/README.md

**Ordered heading outline:**
- # ng-packagr
- ## Installation
- ## Usage Example
- ## Features
- ## How to...
- ## Knowledge
- ## Contributing to ng-packagr

**First impression:** No logo; a one-line blockquote tagline ("> Compile and package
Angular libraries in Angular Package Format (APF)"), then a badge row across two lines
(npm version, npm License, CircleCI, GitHub stars, npm Downloads, Renovate). No TOC.

**Getting-started shape:** `## Installation` = `npm install -D ng-packagr` (note the
`-D` dev-dependency convention for a build tool). `## Usage Example` is a walk-through:
create an `ng-package.json` with a `$schema` reference, add an npm `build` script, run
`yarn build`, output lands in `dist`, then `npm publish dist`. Concrete, end-to-end,
and fast -- from install to a published library in one screen. Good code-sample density
(json + bash blocks interleaved with short prose).

**API / usage reference:** `## How to...` is a bulleted list of task-oriented deep
links into `docs/*.md` (Copy Assets, Embed Assets in CSS, Managing Dependencies,
Override tsconfig, Secondary Entrypoints, etc.) -- a "recipes" index. `## Knowledge`
links out to the APF spec and conference talks (with YouTube thumbnails).

**Programmatic API:** Not emphasized; it is a CLI/config-driven tool. Usage is via the
`ng-packagr -p ng-package.json` command and a JSON config schema.

**Why / comparison:** None as a section; the tagline + Features list carry positioning
(APF, FESM2022 bundles, `.d.ts`, SCSS, asset inlining).

**Length + tone:** Short (~106 lines). Practical, task-first, Title Case, uses emoji
in the Features bullets (gift/flag/etc.) but plain-text headings.

**Idioms worth borrowing (most relevant peer for us -- a build/config CLI tool):**
(a) a single concrete end-to-end "Usage Example" that goes install -> config ->
run -> output -> next step; (b) `npm install -D` framing for a dev/CI tool; (c) a
`$schema`-referenced JSON config shown in the first example; (d) a "How to..." recipes
index linking to `docs/*.md` instead of inlining every option. **Anti-pattern:** the
"Knowledge" section is a wall of old conference-talk video thumbnails (2017-2018) --
dated and adds README weight.

---

## 6. spartan

**Source:** https://raw.githubusercontent.com/spartan-ng/spartan/main/README.md

**Ordered heading outline:**
- # spartan
- ## Packages
- ## The 300 spartans
- ### Sponsor spartan
- ## Zerops: The Strategic Alliance
- ## spartan/ui
- ### Install Dependencies
- ### Development with storybook
- ### Testing
- ### e2e testing
- ## spartan/stack
- ### Example App
- ## Understand this workspace
- ## Documentation
- ## Community
- ## License

**First impression:** HTML-anchored SVG logo (100px), a badge row (License MIT,
Discord), and a "pill" nav line of bullet-separated links (Website / Documentation /
Components / Blocks / GitHub). A blockquote tagline ("Cutting-edge tools that power
Angular full-stack development... Build like a spartan."), then a two-paragraph
orientation. Notably states maturity up front: "spartan/ui is 1.0 and stable:
production-ready, semantically versioned, shipping more than 55 components."

**Getting-started shape:** A `## Packages` markdown table (Package | Description | npm
link) is the primary router. Actual install for consumers is the `@spartan-ng/cli`
copy-paste model (shadcn-style); the README's own `### Install Dependencies` /
storybook / testing / e2e sections are CONTRIBUTOR setup for the monorepo, not
consumer getting-started. Mixed audience.

**API / usage reference:** Prose describing the brain/helm split (headless behavior
lib published to npm; styled components copied into your project by the CLI). No API
tables.

**Programmatic API:** `@spartan-ng/brain` is the importable headless primitive
library; documented in prose with npm links. Deep usage on spartan.ng.

**Why / comparison:** In the opening prose -- explicitly positions as "the shadcn/ui
philosophy for Angular... inspired by Radix, built on Angular CDK." Comparison sits at
the top.

**Length + tone:** Medium-long (~356 lines, much of it the "300 spartans"
contributor/sponsor list). Conversational, brand-voiced ("Build like a spartan"),
Title Case + slash-namespaced subsections.

**Idioms worth borrowing:** (a) state stability/maturity and version explicitly near
the top ("1.0 and stable, SemVer, 55+ components"); (b) a Packages table mapping each
published package to a one-line description and its npm link (great for a multi-entry
package); (c) mention of an AI-agent "skill" and an MCP server -- relevant given our
tool targets AI agents. **Anti-pattern:** mixing consumer install with monorepo
contributor setup under generic headings ("Testing", "e2e testing") confuses which
audience each section serves.

---

## 7. @jsverse/transloco (formerly @ngneat/transloco)

**Source:** https://raw.githubusercontent.com/jsverse/transloco/master/README.md

**Ordered heading outline:**
- (No markdown H1; title is an HTML-centered logo image)
- (HTML `<p align="center">` tagline: "The internationalization (i18n) library for Angular")
- (empty `<h3>`)
- ## Contributors  (sparkle emoji)

**First impression:** Opens with a GitHub callout admonition (`> [!IMPORTANT]`) about
the scope rename to `@jsverse`. Centered 50% logo, centered one-line tagline, then a
badge row (npm, Bundlephobia min size, monthly downloads, Build Status, PRs-welcome,
GitBook, pkg.pr.new). The body is a paragraph plus a checklist of ~12 features
rendered as green-check emoji bullets (Signal-based API, standalone support, lazy
loading, SSR, L10N, schematics, etc.). Then a bullet list of doc links (documentation,
sandbox, schematics, blog posts, FAQs) -- all pointing to a GitBook site.

**Getting-started shape:** None in README -- entirely offloaded to GitBook. The README
is a marketing landing page: tagline + feature checklist + "go to the docs" links.

**API / usage reference:** None inline; everything is on jsverse.gitbook.io.

**Programmatic API:** Mentioned only as a feature ("Signal-based API"); documented off-
site.

**Why / comparison:** None; the feature checklist is the pitch.

**Length + tone:** Very short (~50 lines). HTML-centered presentation, emoji-heavy,
conversational.

**Idioms worth borrowing:** (a) a `> [!IMPORTANT]` GitHub admonition at the very top
to flag a rename/breaking notice -- useful for a young package that may move; (b) a
concise feature checklist as the pitch; (c) bundlephobia size badge (signals "we care
about bundle cost"). **Anti-pattern:** a README with essentially zero inline usage --
a reader cannot see a single line of how to use it without leaving for GitBook; too
thin for a package that wants trust from a cold visitor.

---

## 8. @compodoc/compodoc

**Source:** https://raw.githubusercontent.com/compodoc/compodoc/master/README.md

**Ordered heading outline (uses H1s as section headings, no H2s):**
- (HTML-centered logo + badge block, no markdown H1 title)
- # Live Demo
- # Features
- # Documentation
- # Installation
- # Backers  (medal emoji)
- # Sponsors  (medal emoji)
- # Contributing
- # Contributors
- # Big Thanks
- # License

**First impression:** Heavy HTML centered block: logo (226px), CI/Codecov/npm/
SonarCloud/downloads/license badges, an OpenCollective backers+sponsors badge, a
SauceLabs browser-matrix image, a Gitter badge, a one-line centered tagline ("The
missing documentation tool for your Angular application."), and an animated GIF
screenshot of the product. No TOC.

**Getting-started shape:** `# Live Demo` (link to a hosted demo of a TodoMVC app)
comes FIRST -- show, then tell. `# Installation` is a single sentence linking to the
docs site's installation page (offloaded). Minimal inline setup.

**API / usage reference:** `# Features` is a bulleted list with bold lead-ins (Clean
simple design, Beautiful themes, Search via lunr.js, Automatic TOC, JSDoc light
support, Documentation coverage, Angular CLI-friendly, Offline). Deep usage on the docs
site.

**Programmatic API:** Not emphasized; it is a CLI documentation generator.

**Why / comparison:** The tagline "The missing documentation tool" is the positioning;
no comparison section. The live demo + GIF do the selling.

**Length + tone:** Medium (~121 lines). Marketing-forward, centered HTML, mixes emoji
into some headings. Title Case.

**Idioms worth borrowing (peer tooling package):** (a) lead with a live demo link and
an animated GIF/screenshot so a visitor sees output in seconds -- strong for a tool
whose value is visual/CLI output; (b) feature bullets with bold lead-in labels + short
explanation; (c) badges that signal quality gates (SonarCloud, Codecov). **Anti-
patterns:** SauceLabs browser-matrix and Gitter badges are stale/dead-ecosystem
signals; all-H1 heading structure is flat and hurts document outline/navigation (use
H2/H3 hierarchy).

---

## 9. @ngrx (platform root; @ngrx/store package README)

**Sources:**
- Root: https://raw.githubusercontent.com/ngrx/platform/main/README.md
- Package stub: https://raw.githubusercontent.com/ngrx/platform/main/modules/store/README.md

**Ordered heading outline (root):**
- # @ngrx
- ## Documentation
- ## Contributing
- ## Sponsoring NgRx
- ### Gold Sponsors
- ### Silver Sponsors
- ### Bronze Sponsors
- ## Enterprise Support

**@ngrx/store package README (the actual published-package README) in full:**
> # @ngrx/store
> The sources for this package are in the main NgRx repo. Please file issues and pull
> requests against that repo.
> License: MIT

**First impression (root):** No logo; tagline "Reactive State for Angular"; badge row
(CI, Discord, Commitizen-friendly, npm version). No TOC, no features list, no code.

**Getting-started shape:** None -- `## Documentation` is a single link to ngrx.io.
Everything is on the docs site.

**API / usage reference:** None in either README. The published `@ngrx/store` README
is a 3-line stub that points back to the monorepo and states the license.

**Programmatic API:** The library is entirely a programmatic API, but the README
documents none of it -- 100% offloaded to ngrx.io.

**Why / comparison:** None.

**Length + tone:** Root is short and sponsor-focused; the package stub is minimal.
Formal, terse.

**Idioms worth borrowing:** (a) minimal viable package README that states purpose +
canonical-docs link + license (only defensible for a hugely-established brand where
the docs site is the known destination). **Anti-pattern (important negative example
for us):** a bare stub README on the PUBLISHED npm package is a poor experience for a
new/unknown package -- npm shows this stub as the package landing page. A young tool
like ours must NOT ship a stub; the npm README is the first and often only thing a
prospective user reads. NgRx gets away with it on brand alone.

---

## 10. @taiga-ui/core

**Sources:**
- Package: https://raw.githubusercontent.com/taiga-family/taiga-ui/main/projects/core/README.md
- Root (for the "Why" section): https://raw.githubusercontent.com/taiga-family/taiga-ui/main/README.md

**Ordered heading outline (@taiga-ui/core package README):**
- # Taiga UI -- Core
- ## How to install
- ## Docs

**First impression (package README):** Per-package title "Taiga UI -- Core", a compact
badge row (npm version, bundlephobia minzip size, Discord), a nav line (Website /
Documentation / Core team), and a one-line blockquote tagline ("Basic elements needed
to develop components, directives and more using Taiga UI design system"). Then one
sentence placing this package within the larger Taiga UI monorepo.

**Getting-started shape:** `## How to install` = `npm i @taiga-ui/{cdk,core}` (brace-
expansion to show the required companion package), plus a note that the library is
fully tree-shakable. `## Docs` links to taiga-ui.dev. Very short.

**API / usage reference:** None in the package README -- delegated to the docs site.

**Programmatic API:** The package is an importable API; documented off-site.

**Why / comparison:** The ROOT README has an explicit `## Why Taiga UI` section (near
the top) with bold lead-in bullets (Modular and fully-treeshakable, Agnostic, etc.).
The per-package README omits "why" and defers to the root -- positioning lives at the
monorepo root, not the leaf.

**Length + tone (package README):** Very short (~1.2 KB). Terse, reference-grade,
sentence-case tagline, Title Case headings.

**Idioms worth borrowing:** (a) per-package README with its own badges (version, and
notably a bundle-SIZE badge) and a one-line scoped tagline; (b) show the required
companion package in the install command via brace expansion; (c) an explicit
"## Why <Product>" section at the top of the root README with bold-labeled bullets --
a clean positioning pattern. **Anti-pattern:** the leaf README is so thin it only makes
sense as part of the monorepo constellation; standalone it lacks any usage example.

---

## Patterns across this slice

**Structure / ordering.** The dominant order is: logo (optional) -> tagline (one line,
often an HTML-centered `<p>` or a `>` blockquote) -> badge row -> short positioning
paragraph -> Features/Feature-checklist -> Installation -> Usage -> Documentation link
-> Contributing/Sponsors/Contributors/License. Positioning ("what this is and why")
almost always sits at the TOP (Analog's Next/Nuxt comparison, spartan's shadcn framing,
Taiga's root "Why" section) -- never buried at the bottom. Only angular-eslint puts a
formal TOC in; most omit it and rely on the docs site.

**Getting-started is command-first, not code-first.** The strongest tooling READMEs
(angular-eslint, ng-packagr, ngxtension, analog) get you working with a single command:
`ng add`, `npm create @latest`, `npm install -D` + a `-p config.json` run, or an init
schematic. ng-packagr is the best model for us: one concrete end-to-end example
(install -> `$schema`-referenced JSON config -> run -> output -> next step). Angular-
specific idioms recur: `ng add <pkg>`, `ng generate <plugin>:init` / `nx generate`,
schematics, and "Supported Angular/CLI Versions" policy sections.

**Docs are heavily offloaded.** Most (analog, transloco, compodoc, ngrx, taiga,
ngxtension) delegate deep API/usage to a docs site and keep the README as a landing
page. The failure mode: transloco and the `@ngrx/store` stub offload SO much that a
cold reader sees essentially no inline usage. For a NEW/unknown package (like ours),
that is the wrong end of the spectrum -- ng-packagr and angular-eslint (self-sufficient,
show real usage inline) are the right models.

**Tables are the reference idiom.** Two high-value table patterns to borrow: (1)
ngxtension's **Version Compatibility Table** (library version | date | Angular support)
-- directly applicable to our Nx 23 / Angular 22 / TS 6 matrix; (2) angular-eslint's
auto-generated **capability table** with a legend key and per-row deep links -- a good
shape for enumerating our extended-diagnostic (NG8xxx) coverage or supported project
types. spartan's Packages table (package | description | npm link) suits multi-entry
packages.

**Badges converge on a core set:** npm version, npm downloads, license, CI/build
status, and a community link (Discord/Twitter). Quality-signal badges (Codecov,
SonarCloud, bundle size via Bundlephobia) appear on the more mature/tooling projects
and read as credibility. Stale badges (SauceLabs matrix, Gitter) are an anti-pattern.

**Anti-patterns to avoid for our package.** (a) Emoji in headings (ngxtension,
transloco, analog) -- breaks our ASCII-only pipeline; the plain-heading projects
(ng-packagr, angular-eslint root) are the model. (b) A stub/near-empty published README
(`@ngrx/store`) -- only survivable on established brand; fatal for a new tool where the
npm README is the first impression. (c) Giant inline all-contributors / sponsor tables
(analog, spartan, ngxtension) that bury the real content. (d) All-H1 flat heading
structure (compodoc) that destroys the document outline. (e) Mixing consumer install
with monorepo-contributor setup under generic headings (spartan).

**Most relevant peers for angular-typechecker** (a build/CI/agent-facing Nx tooling
package): **ng-packagr** (CLI + JSON config tool: one concrete end-to-end usage
example, `-D` install, recipes index, self-sufficient) and **angular-eslint**
(`ng add` quick start + "Supported Versions" policy + generated capability tables + an
explicit "what this does/doesn't own vs Nx" boundary section). Borrow their
command-first getting-started, version-compatibility table, and self-contained inline
usage; skip the emoji, the contributor walls, and the docs-only stub extreme. spartan's
callout that it ships an AI-agent skill + MCP server is a notable cue given our
AI-agent audience.
