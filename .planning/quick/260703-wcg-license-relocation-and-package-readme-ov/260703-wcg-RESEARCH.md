# Package README rewrite - Research

**Researched:** 2026-07-03
**Scope:** Recommended section outline + exemplars + badge patterns + honest "Output" handling + pitfalls, for rewriting `packages/angular-typechecker/README.md`.
**Confidence:** HIGH (structure/exemplars verified against real READMEs; badge URLs cited from shields.io conventions).

## Summary

The CURRENT package README is already close to modern best practice (tight "Why", requirements, generator-first usage, manual recipe, options table). The main gaps versus high-quality dev-tool READMEs are: (1) **no badge row**, (2) **no concrete Output example**, (3) **no CI-integration snippet** (problem matcher / annotations), and (4) **no short Programmatic API section** for the `import { runTypecheck } from 'angular-typechecker'` barrel. The rewrite should add those four while keeping the consumer-facing, non-hype tone.

**Primary recommendation:** Badges -> one-line what -> tight why -> requirements -> install -> quick start (generator) -> manual wiring -> options table -> **Output (one honest format + one example)** -> **CI integration** -> **Programmatic API (brief)** -> License. Do NOT copy the repo-root README's project/milestone/status narrative.

## 1. Recommended section outline (ordered)

1. **`# angular-typechecker`** + one-sentence description (what it is, in one line). Keep the current opening sentence; it is excellent.
2. **Badge row** (immediately under the title): npm version, license, CI. See section 3. `[CITED: shields.io]`
3. **`## Why this exists`** - the positioning paragraph (Brandon Roberts framing, "run the type-check elsewhere", vs `@nx/js` typecheck). KEEP TIGHT - 2 short paragraphs max; the current version is slightly long. This is the differentiator, so it earns space, but trim repetition.
4. **`## Requirements`** - Nx 23.x, Angular 22.x, TS `>=6.0.0 <6.1.0`, Node range; the peer-dep note; the pre-release/`--legacy-peer-deps` note. (Current content is correct - keep.)
5. **`## Installation`** - `npm install --save-dev angular-typechecker` (or `nx add`). One block.
6. **`## Usage` / `## Quick start`** - generator-first (`nx add` -> `nx g angular-typechecker:configuration my-app` -> `nx run my-app:typecheck`), then `### Manual wiring (equivalent)` with the `project.json` + `nx.json` targetDefaults snippets. (Current structure is right.)
7. **`## Options`** - the executor options table (`tsConfig`, `includeDeps`, `maxWarnings`, `failFast`). KEEP.
8. **`## Output`** (NEW) - one honest human-readable format + a real example block + the knobs (color, fail-fast, workspace-relative paths). See section 4.
9. **`## CI integration`** (NEW, or a `### ` under Output) - the non-zero-exit contract + a GitHub Actions problem-matcher snippet for inline annotations. See section 4.
10. **`## Programmatic API`** (NEW, brief) - the barrel exports: `runTypecheck(options): Promise<CoreResult>`, `TypecheckInfrastructureError`, and the `CoreOptions`/`CoreResult`/`SkippedReference` types. One small code block; do NOT document engine internals (they are not exported).
11. **`## License`** - MIT (c) 2026 Lars Gyrup Brink Nielsen.

Rationale for the order: it mirrors the read path of every good dev-tool README - *what -> why should I care -> can I run it (requirements) -> how do I install -> how do I use it -> reference (options/output) -> API -> legal*. Install/quick-start is front-loaded (highest-traffic content); the "why" earns its high placement only because positioning is this tool's whole value prop.

## 2. Exemplars examined

- **`@push-based/nx-verdaccio`** (Nx plugin) - `D:\projects\github\push-based\nx-verdaccio\README.md`. Borrow: the **badge row shape** (npm version + release-date + license + CI) and the **numbered "Getting Started" with `nx.json` + `project.json` JSONC snippets** + a **Configuration Options table**. AVOID its emoji/hype tone ("BRUTALLY FAST", "110x faster") and unverified benchmark tables - both are anti-patterns here (and violate this repo's no-emoji rule).
- **dependency-cruiser** (static-analysis CLI) - https://github.com/sverweij/dependency-cruiser. Borrow: the progressive **"What's this do?" -> "How do I use it?" (install / config / run / report)** flow, and an **"I want to know more!"** links section that offloads deep reference instead of bloating the README. Output shown as an "eslint-like format" example - matches our single-human-format story.
- **`@angular-eslint/eslint-plugin`** (Angular tooling) - https://github.com/angular-eslint/angular-eslint. Borrow: a **thin package README that delegates deep docs elsewhere** and leads with a **reference table**. Confirms our Options table is the right idiom for an Nx plugin.
- **knip / publint** (dev tools) - minimal package READMEs (badges + one-liner + links to a docs site). Pattern only applies when you have a separate docs site; angular-typechecker has none, so keep the usage content IN the README (do not strip it to link-outs).

## 3. Badge conventions (exact URLs for `angular-typechecker`)

Repo is `LayZeeDK/angular-typechecker`; CI workflow file is `ci.yml`. Put these on one line right under the `# angular-typechecker` title, each wrapped in a link. `[CITED: shields.io badge conventions]`

```markdown
[![npm version](https://img.shields.io/npm/v/angular-typechecker.svg)](https://www.npmjs.com/package/angular-typechecker)
[![license](https://img.shields.io/npm/l/angular-typechecker.svg)](https://github.com/LayZeeDK/angular-typechecker/blob/main/LICENSE)
[![CI](https://github.com/LayZeeDK/angular-typechecker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LayZeeDK/angular-typechecker/actions/workflows/ci.yml?query=branch%3Amain)
```

Notes:
- `img.shields.io/npm/v/<pkg>` reads the live latest version; `img.shields.io/npm/l/<pkg>` reads the license field from `package.json` (renders "MIT"). Both auto-update - no hardcoding. `[CITED: shields.io]`
- **Provenance:** there is no clean first-party shields badge for npm/SLSA provenance. npm renders the provenance/"Trusted Publisher" checkmark on the package page automatically once published via OIDC (this package already is). Do NOT manufacture a fake provenance badge; either omit it or add a plain `npm downloads` badge (`https://img.shields.io/npm/dm/angular-typechecker.svg`) if you want a fourth. `[ASSUMED]` - no standard provenance shield exists as of research date.
- Keep it to 3 (max 4) badges. Rows of 6+ badges are noise.

## 4. Honest "Output" + CI integration (no manufactured formats matrix)

There is exactly ONE output format (Angular `formatDiagnostics`, a `tsc` superset that renders NG codes + template codeframes). Do NOT build a "formats" table - that implies a choice that does not exist. The pattern good tools use (dependency-cruiser's "eslint-like format", tsc itself):

- **State the single format in one sentence**, then **show ONE fenced example** of real output (a TS error + an NG8xxx template diagnostic with a codeframe) so readers see exactly what they get.
- **List the knobs as prose/bullets, not a matrix:** color is auto-detected via `stdout.isTTY` (stripped for CI/pipes/agents); `failFast` truncates the reported list at the first error (not a speed-up); paths are workspace-root-relative.
- **Set the exit-code contract explicitly:** exits non-zero on any error-category diagnostic (or when warnings exceed `maxWarnings`) - this is the "agent-ready / CI-ready" line.
- **Be honest about what's absent:** one sentence that machine-readable reporters (JSON/SARIF) are not in v0.x. Framing it as a known non-goal is more credible than silence, and prevents a reader from hunting for a `--format json` flag that does not exist.

**CI integration snippet** (this is the concrete payoff of workspace-relative `file:line:col` paths): show registering a `tsc`-style GitHub Actions problem matcher so diagnostics surface as inline PR annotations. Provide a small `.github/matchers/tsc.json` (owner + a regexp capturing `file:line:col: error TSxxxx: message`) and the `echo "::add-matcher::.github/matchers/tsc.json"` step before `nx run <proj>:typecheck`. Because the output is a `tsc` superset with workspace-relative paths, the standard tsc matcher pattern annotates both TS and NG diagnostics. `[CITED: verified_internal_facts - workspace-root-relative paths compatible with the GitHub problem matcher file:line:col]`

## 5. Pitfalls / anti-patterns

- **Do NOT duplicate the repo-root README.** The root README is a project/dev-facing document (Current State, milestone history, LOC counts, roadmap, prior-art). NONE of that belongs in the published package README. The package README is consumer-facing: install -> use -> reference. (This is also why the task pairs "license relocation" with the README rewrite - keep the two READMEs distinct in audience.)
- **No hype, no emoji.** nx-verdaccio's "BRUTALLY FAST / 110x" tone is an anti-pattern here and violates the repo's ASCII-only/no-emoji rule. State facts; let the positioning paragraph do the persuading.
- **No unverified benchmark tables.** If you cite the ~15s ngc vs ~36s build figures, attribute them to Brandon Roberts' analysis (as the current README does) rather than presenting them as this tool's measured numbers.
- **npmjs.com rendering gotchas:** (a) relative image/link paths do NOT resolve on npm - use absolute `https://raw.githubusercontent.com/...` for any image and absolute repo URLs for links; (b) GitHub alert syntax (`> [!NOTE]`) renders as a plain blockquote on npm, not a styled callout - fine, but do not rely on the styling; (c) badges must be absolute `https://` shields URLs; (d) HTML is heavily sanitized - stick to plain Markdown. `[ASSUMED]` for npm-specific rendering details (based on training knowledge of npm's marked-based renderer).
- **Length/scannability:** front-load install + quick start; keep "Why" to ~2 paragraphs; use tables for options; ONE output example, not a wall of sample output. Target a README a reader can scan top-to-bottom in under a minute to the first runnable command.
- **Only document real features.** Per the verified facts: no JSON/SARIF, no standalone CLI, no `ng add` (Angular CLI) - `nx add` only. Do not document the trimmed-away engine internals as if they were public API; the barrel exports exactly `runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`.

## Sources

- `D:\projects\github\push-based\nx-verdaccio\README.md` (local clone) - HIGH: real Nx-plugin README structure + badge row.
- https://github.com/sverweij/dependency-cruiser (README) - HIGH: static-analysis CLI progressive structure + single-format output presentation.
- https://github.com/angular-eslint/angular-eslint (eslint-plugin README) - HIGH: thin Angular-tooling package README + reference-table idiom.
- knip / publint package READMEs (webpro-nl/knip, publint/publint) - MEDIUM: minimal-README-with-docs-site pattern (not adopted; no docs site here).
- shields.io badge path conventions (`/npm/v`, `/npm/l`, `/npm/dm`; GitHub Actions `badge.svg`) - HIGH for URL shapes.
- angular-typechecker CURRENT `packages/angular-typechecker/README.md`, `PROJECT.md`, `AGENTS.md` - HIGH: verified feature surface, repo slug, CI workflow name.
