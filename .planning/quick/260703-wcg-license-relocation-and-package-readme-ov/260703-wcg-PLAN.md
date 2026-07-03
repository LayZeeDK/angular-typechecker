---
phase: quick-260703-wcg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - LICENSE
  - packages/angular-typechecker/LICENSE
  - packages/angular-typechecker/project.json
  - README.md
  - packages/angular-typechecker/README.md
autonomous: true
requirements:
  - "quick-260703-wcg: relocate LICENSE to repo root; overhaul the published package README"

must_haves:
  truths:
    - "Repo-root ./LICENSE exists and is git-tracked (moved with git mv, history preserved)"
    - "packages/angular-typechecker/LICENSE no longer exists in source"
    - "After nx build, dist/packages/angular-typechecker/LICENSE exists"
    - "The packed tarball still contains LICENSE (tarball-audit e2e still passes)"
    - "package-manifest.spec still passes (source package.json files array unchanged)"
    - "Root README license link points to ./LICENSE"
    - "Package README has a badge row, an Output section with one real example, a CI-integration snippet, and a Programmatic API section"
    - "Package README documents only real features (no JSON/SARIF, no ng add, no standalone CLI)"
    - "Both changed READMEs and project.json pass prettier --check and the package lint"
  artifacts:
    - path: "LICENSE"
      provides: "MIT license at repo root"
      contains: "MIT License"
    - path: "packages/angular-typechecker/project.json"
      provides: "build asset that copies the ROOT LICENSE into dist"
      contains: "\"glob\": \"LICENSE\""
    - path: "packages/angular-typechecker/README.md"
      provides: "consumer-facing package README (badges, output example, CI, programmatic API)"
      min_lines: 120
    - path: "README.md"
      provides: "root README with corrected license link"
      contains: "(./LICENSE)"
  key_links:
    - from: "packages/angular-typechecker/project.json"
      to: "dist/packages/angular-typechecker/LICENSE"
      via: "build asset input '.' + glob LICENSE"
      pattern: "\"input\": \"\\.\""
    - from: "packages/angular-typechecker/README.md"
      to: "src/index.ts barrel"
      via: "Programmatic API section matches exported runTypecheck/TypecheckInfrastructureError/CoreOptions/CoreResult/SkippedReference"
      pattern: "runTypecheck"
---

<objective>
Two atomic, self-contained changes to the published package's distribution and docs:

1. Relocate the MIT LICENSE from `packages/angular-typechecker/` to the repo root, keeping it in the published tarball via the build asset (root LICENSE is the conventional location and lets shields.io / GitHub resolve `main/LICENSE`).
2. Overhaul `packages/angular-typechecker/README.md` into a consumer-facing README per RESEARCH.md: add a badge row, an honest Output example, a CI-integration snippet, and a brief Programmatic API section, while keeping every feature claim accurate.

Purpose: correct license placement (root convention + working badge/link targets) and make the npm-page README complete and accurate for consumers and AI agents.
Output: root `./LICENSE`, an updated build asset, a corrected root-README link, and a rewritten package README. No version bump, no publish (docs/config only).

NOTE: no `<threat_model>` -- this task moves a file, edits one build-asset path, and rewrites Markdown. It installs no packages, runs no new code path, and crosses no trust boundary. There is nothing to model.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/quick/260703-wcg-license-relocation-and-package-readme-ov/260703-wcg-RESEARCH.md
@packages/angular-typechecker/README.md

<interfaces>
<!-- Executor: use these exact facts. Do NOT explore for feature surface or invent options. -->

Programmatic API barrel (packages/angular-typechecker/src/index.ts) exports EXACTLY:
```typescript
export { runTypecheck, TypecheckInfrastructureError } from './core/run-typecheck';
export type { CoreOptions, CoreResult } from './core/run-typecheck';
export type { SkippedReference } from './core/walk-references';
```
- runTypecheck(options: CoreOptions): Promise<CoreResult>
- CoreOptions = { tsConfigPath: string /* absolute, required */; includeDeps?: boolean; pathBase? }
- CoreResult = { tsConfigPath, rootNamesCount, diagnostics: readonly ts.Diagnostic[], errorCount, warningCount, suppressedCount, durationMs, templateCheckAborted?, skippedReferences? }
- maxWarnings / failFast / formatter are EXECUTOR options only -- NOT part of the barrel API.

Executor `angular-typechecker:typecheck` options: `tsConfig` (required), `includeDeps?` (default false), `maxWarnings?`, `failFast?` (report-only truncation, NOT a speed-up). Writes human-readable report to RAW stdout; exits non-zero on any error-category diagnostic or when warnings exceed maxWarnings. Emits loud logger.warn advisories for a TCB-generation Fatal (NG3004) and for skipped references in a solution-tsconfig walk.

Generators: `init` (via `nx add angular-typechecker`; `{ skipFormat? }`; seeds cacheable `angular-typechecker:typecheck` targetDefaults into nx.json) and `configuration` (`{ project (required), tsConfig?, targetName?, skipFormat? }`).

Output: ONE format only -- Angular `formatDiagnostics` (a tsc superset with NG codes + template codeframes). Knobs: color auto-detected via `stdout.isTTY` (stripped off-TTY for CI/agents); `failFast` truncates the reported list; paths are workspace-root-relative (problem-matcher compatible). NO JSON/SARIF in v0.x (state as a known non-goal). No standalone CLI. `nx add`, never `ng add`.

Exact badge shields URLs and the CI problem-matcher recipe are in RESEARCH.md sections 3 and 4 -- use them verbatim.
</interfaces>

Current build asset (packages/angular-typechecker/project.json, LICENSE entry):
`{ "input": "./packages/angular-typechecker", "glob": "LICENSE", "output": "." }`

Root README license link (README.md ~line 85):
`MIT (c) Lars Gyrup Brink Nielsen. See [\`packages/angular-typechecker/LICENSE\`](packages/angular-typechecker/LICENSE).`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Relocate LICENSE to repo root and keep it in the tarball</name>
  <files>LICENSE, packages/angular-typechecker/LICENSE, packages/angular-typechecker/project.json, README.md</files>
  <action>
Move the license file and rewire the build asset so the root LICENSE still ships in the tarball.

1. Move the file with `git mv packages/angular-typechecker/LICENSE LICENSE` (from the repo root). This preserves history and stages both the source deletion and the root addition atomically. Do NOT hand-copy or re-create the file -- use `git mv`.

2. In `packages/angular-typechecker/project.json`, the `build` target `assets` array has a LICENSE entry currently `{ "input": "./packages/angular-typechecker", "glob": "LICENSE", "output": "." }`. Change ONLY its `input` to `"."`. `@nx/js:tsc` resolves asset `input` relative to the workspace root, so `input: "."` + `glob: "LICENSE"` + `output: "."` copies the ROOT LICENSE into `dist/packages/angular-typechecker/LICENSE`. Leave `glob` and `output` untouched. Touch NO other asset entry.

3. In the root `README.md` (~line 85), update the license link target from `(packages/angular-typechecker/LICENSE)` to `(./LICENSE)`. Leave the link text and the attribution prose ("MIT (c) Lars Gyrup Brink Nielsen. See ...") exactly as-is.

DO NOT touch `packages/angular-typechecker/package.json`. Its `files` array lists `"LICENSE"` relative to the published package root in dist (where the asset lands), so it stays correct -- and `src/package-manifest.spec.ts` asserts that exact array against the SOURCE package.json, so any edit would break the test.

Commit atomically with a public-changelog-safe conventional commit (per AGENTS.md changelog hygiene): `chore(license): relocate LICENSE to repo root` -- scope `license`, type `chore`, NOT the internal plan id. Stage only the four touched paths by name (never `git add .`).
  </action>
  <verify>
    <automated>nx build angular-typechecker --skip-nx-cache && test -f dist/packages/angular-typechecker/LICENSE && test -f LICENSE && test ! -f packages/angular-typechecker/LICENSE</automated>
    <automated>nx test angular-typechecker --skip-nx-cache</automated>
    <automated>nx test angular-typechecker-install-e2e --skip-nx-cache</automated>
  </verify>
  <done>
Root `./LICENSE` exists and is git-tracked; `packages/angular-typechecker/LICENSE` is gone; `dist/packages/angular-typechecker/LICENSE` is produced by the build; `package-manifest.spec` and the `tarball-audit.int.spec` e2e both pass (LICENSE still in the packed tarball); root README license link points to `./LICENSE`. Committed as `chore(license): ...`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Overhaul the published package README</name>
  <files>packages/angular-typechecker/README.md</files>
  <action>
Rewrite `packages/angular-typechecker/README.md` following the RESEARCH.md outline and the verified feature facts in `<interfaces>`. This is a consumer-facing README (install -> use -> reference) -- do NOT duplicate the repo-root README's project/milestone/status narrative.

Section order (RESEARCH.md section 1):
1. `# angular-typechecker` + the current one-sentence description (keep the excellent opening sentence).
2. Badge row directly under the title: npm version, license, CI. Use the EXACT shields URLs from RESEARCH.md section 3 verbatim (npm/v, npm/l, and the ci.yml Actions badge). Keep to 3 badges (4 max). Do NOT manufacture a provenance badge.
3. `## Why this exists` -- keep the Brandon Roberts positioning but TRIM to <=2 short paragraphs (the current version is slightly long). Keep the reference link.
4. `## Requirements` -- keep current content (Nx 23.x, Angular 22.x, TS >=6.0.0 <6.1.0, Node range, peer-dep note, pre-release/--legacy-peer-deps note).
5. `## Installation` -- `npm install --save-dev angular-typechecker` (or `nx add`).
6. `## Usage` -- generator-first: `nx add angular-typechecker` -> `nx g angular-typechecker:configuration my-app` -> `nx run my-app:typecheck`, then `### Manual wiring (equivalent)` with the project.json + nx.json targetDefaults snippets (preserve the current correct snippets, including the `default`-not-`production` and published-unscoped-id warnings, and the `includeDeps` note).
7. `## Options` -- keep the executor options table (`tsConfig`, `includeDeps`, `maxWarnings`, `failFast`) exactly as the feature facts describe.
8. `## Output` (NEW) -- state the SINGLE format in one sentence (Angular `formatDiagnostics`, a tsc superset rendering NG codes + template codeframes). Show ONE fenced example block of real output containing a TS error AND an NG8xxx template diagnostic with a codeframe. List knobs as prose/bullets (NOT a matrix): color auto-detected via `stdout.isTTY` (stripped off-TTY for CI/agents); `failFast` truncates the reported list (not a speed-up); paths are workspace-root-relative. State the exit-code contract explicitly (non-zero on any error-category diagnostic, or when warnings exceed `maxWarnings`). Add one honest sentence that machine-readable reporters (JSON/SARIF) are a known non-goal in v0.x.
9. `## CI integration` (NEW) -- non-zero-exit contract + a tsc-style GitHub Actions problem-matcher recipe (a small `.github/matchers/tsc.json` capturing `file:line:col: error TSxxxx: message`, and the `echo "::add-matcher::.github/matchers/tsc.json"` step before `nx run <proj>:typecheck`). Use the recipe in RESEARCH.md section 4. Note that because the output is a tsc superset with workspace-relative paths, the standard tsc matcher annotates both TS and NG diagnostics.
10. `## Programmatic API` (NEW, brief) -- ONE small code block for the barrel: `import { runTypecheck } from 'angular-typechecker'`, `runTypecheck(options: CoreOptions): Promise<CoreResult>`, `TypecheckInfrastructureError`, and the `CoreOptions`/`CoreResult`/`SkippedReference` types. Match the exact exports and shapes in `<interfaces>`. Do NOT document engine internals (they are not exported). Note `CoreOptions.tsConfigPath` is an absolute path (distinct from the executor's workspace-relative `tsConfig`), and that maxWarnings/failFast/formatter are executor-only, not barrel API.
11. `## License` -- `MIT (c) 2026 Lars Gyrup Brink Nielsen`.

Constraints: ASCII-only, no emoji, no hype (repo rule). Only document REAL features -- no JSON/SARIF, no standalone CLI, no `ng add`. Keep Markdown Prettier-clean (`singleQuote: true` config applies; CI runs `prettier --check` with `maxWarnings: 0` on lint). Use absolute `https://` URLs for badges and any repo links (relative links do not resolve on npmjs.com).

Commit atomically with a public-changelog-safe conventional commit: `docs(readme): overhaul the published package README` -- scope `readme`, NOT the internal plan id. Stage only `packages/angular-typechecker/README.md` by name.
  </action>
  <verify>
    <automated>npx prettier --check packages/angular-typechecker/README.md packages/angular-typechecker/project.json README.md</automated>
    <automated>nx run angular-typechecker:lint --skip-nx-cache</automated>
    <automated>node -e "const t=require('fs').readFileSync('packages/angular-typechecker/README.md','utf8'); for (const s of ['img.shields.io/npm/v/angular-typechecker','## Output','## CI integration','## Programmatic API','runTypecheck']) { if(!t.includes(s)) throw new Error('README missing: '+s); } if(/\bng add\b/.test(t)) throw new Error('README must not mention ng add'); if(/\bSARIF\b/i.test(t) && !/non-goal|not.*(in v0|planned)/i.test(t)) throw new Error('SARIF mentioned without non-goal framing');"</automated>
  </verify>
  <done>
Package README follows the RESEARCH.md section order; badge row uses the exact shields URLs; Output section has one honest format sentence + one real example (TS error + NG8xxx codeframe) + prose knobs + exit-code contract + JSON/SARIF non-goal line; CI-integration problem-matcher snippet present; Programmatic API section matches the barrel exports exactly; no ng add / CLI / JSON reporter claims; passes `prettier --check` and `angular-typechecker:lint`. Committed as `docs(readme): ...`.
  </done>
</task>

</tasks>

<verification>
Run from the main checkout (single-plan wave, no worktree):
- `nx build angular-typechecker --skip-nx-cache` then confirm `dist/packages/angular-typechecker/LICENSE` exists and root `./LICENSE` exists while `packages/angular-typechecker/LICENSE` does not.
- `nx test angular-typechecker --skip-nx-cache` (package-manifest spec passes -- source package.json `files` unchanged).
- `nx test angular-typechecker-install-e2e --skip-nx-cache` (tarball-audit e2e passes -- LICENSE still packed).
- `npx prettier --check packages/angular-typechecker/README.md packages/angular-typechecker/project.json README.md`.
- `nx run angular-typechecker:lint --skip-nx-cache` (maxWarnings: 0).
</verification>

<success_criteria>
- LICENSE lives at repo root, is git-tracked (history preserved), and still ships in the built package (`dist/.../LICENSE`) and the packed tarball.
- Source `packages/angular-typechecker/package.json` is unchanged; `package-manifest.spec` and `tarball-audit.int.spec` pass.
- Root README license link resolves to `./LICENSE`.
- Package README is a complete, accurate consumer README: badges, tight Why, requirements, install, generator-first usage + manual wiring, options table, honest Output (one format + one example), CI integration, brief Programmatic API, License.
- No invented features; ASCII-only; Prettier- and lint-clean.
- Two atomic commits with public-changelog-safe scopes (`chore(license)`, `docs(readme)`).
</success_criteria>

<output>
Create `.planning/quick/260703-wcg-license-relocation-and-package-readme-ov/260703-wcg-SUMMARY.md` when done.
</output>
