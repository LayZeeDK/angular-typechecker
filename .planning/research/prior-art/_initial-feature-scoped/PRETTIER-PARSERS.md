# Prettier Angular Parsers — Prior Art Learnings

Research date: 2026-06-29. Sources are two local clones:

- `D:\projects\github\prettier\angular-html-parser\` — a FORK of the entire Angular monorepo (`packages/...`, `BUILD.bazel`, `MODULE.bazel`, the full Angular `CHANGELOG.md`), with the published npm package living at `packages/angular-html-parser/`.
- `D:\projects\github\prettier\angular-estree-parser\` — a small, from-scratch standalone package (`src/`, `test/`, `tsdown.config.ts`).

Both are maintained under the `prettier` GitHub org and authored originally by Ika (ikatyang). They are the two parsers Prettier uses to format Angular templates.

> Bottom-line relevance to angular-typechecker: these parsers are _front-end syntax/AST_ tools (HTML structure + expression AST→ESTree), NOT type-checkers. They deliberately exclude the type system. Their direct usefulness to a whole-program type-checker is LOW. Their usefulness as a **vendoring/forking discipline playbook** — especially `angular-html-parser`'s "fork the whole monorepo, mark every divergence, rebase on upstream tags" model — is HIGH and is the real takeaway.

---

## angular-html-parser

### What it actually is

The repo is NOT a slimmed-down extract checked into a clean tree. It is a **full fork of `angular/angular`** (root `package.json` is literally `"name": "angular-srcs"`, `"version": "22.1.0-next.2"`, Bazel + pnpm + the entire Angular workspace). The published artifact is a thin wrapper package at `packages/angular-html-parser/` whose `src/` contains a **single file**: `index.ts`.

`packages/angular-html-parser/src/index.ts` imports the parser DIRECTLY from the in-tree Angular compiler source via relative `.ts` paths:

```ts
import { HtmlParser } from '../../compiler/src/ml_parser/html_parser.ts';
import { XmlParser } from '../../compiler/src/ml_parser/xml_parser.ts';
import type { TagContentType } from '../../compiler/src/ml_parser/tags.ts';
import { ParseTreeResult as HtmlParseTreeResult } from '../../compiler/src/ml_parser/parser.ts';
// ...
// For prettier
export { TagContentType } from '../../compiler/src/ml_parser/tags.ts';
export { RecursiveVisitor, visitAll } from '../../compiler/src/ml_parser/ast.ts';
export { ParseSourceSpan, ParseLocation, ParseSourceFile } from '../../compiler/src/parse_util.ts';
export { getHtmlTagDefinition } from '../../compiler/src/ml_parser/html_tags.ts';
export { SUPPORTED_BLOCKS as SUPPORTED_ANGULAR_BLOCKS } from '../../compiler/src/ml_parser/lexer.ts';
export type { ParseTreeResult } from '../../compiler/src/ml_parser/parser.ts';
export type * as Ast from '../../compiler/src/ml_parser/ast.ts';
```

### Exactly which Angular source files form the package

The published parser is composed of these `packages/compiler/src/ml_parser/*.ts` files (plus `parse_util.ts` one level up), pulled in transitively from `index.ts`:

| File                            | Size    | Role                                                            |
| ------------------------------- | ------- | --------------------------------------------------------------- |
| `ml_parser/lexer.ts`            | ~64 KB  | Tokenizer (incl. Angular blocks / `@let` / selectorless lexing) |
| `ml_parser/parser.ts`           | ~40 KB  | Tree builder → `ParseTreeResult`                                |
| `ml_parser/entities.ts`         | ~50 KB  | HTML named-entity table                                         |
| `ml_parser/ast.ts`              | ~10 KB  | Node classes + `visitAll`/`RecursiveVisitor`                    |
| `ml_parser/html_tags.ts`        | ~8 KB   | HTML tag definitions / `getHtmlTagDefinition`                   |
| `ml_parser/html_whitespaces.ts` | ~13 KB  | Whitespace handling                                             |
| `ml_parser/tokens.ts`           | ~8 KB   | Token type defs                                                 |
| `ml_parser/html_parser.ts`      | ~1 KB   | `HtmlParser extends Parser` wrapper                             |
| `ml_parser/xml_parser.ts`       | ~0.8 KB | `XmlParser extends Parser` wrapper                              |
| `ml_parser/tags.ts`             | ~2 KB   | `TagContentType`, `TagDefinition`                               |
| `ml_parser/xml_tags.ts`         | ~0.9 KB | XML tag defs                                                    |
| `parse_util.ts` (one dir up)    | —       | `ParseSourceSpan`/`ParseLocation`/`ParseSourceFile`             |

### What Prettier STRIPPED to ship "just the parser"

Nothing is physically deleted from the fork — the whole Angular tree is still present (compiler-cli, core, router, language-service, Bazel, etc.). Stripping happens at TWO points instead:

1. **Import boundary**: `index.ts` only reaches `ml_parser/` + `parse_util`. The template _binding_ parser, type-checking, `render3` codegen, i18n extraction, the rest of `@angular/compiler` — never imported, so the bundler never pulls them.
2. **Publish boundary**: the published `package.json` (`packages/angular-html-parser/package.json`) has `"files": ["dist", "ThirdPartyNoticeText.txt"]`. Only the compiled `dist/` ships; none of the monorepo, none of the `.ts` source, no tests.

The net published surface is just `parse`/`parseXml` + a handful of AST/span re-exports. Notably the published package has **zero `dependencies` and zero `peerDependencies`** (verified: no `@angular/*` anywhere in `packages/angular-html-parser/package.json`) — the parser code is inlined into `dist/` at build time, so consumers do NOT install `@angular/compiler`.

### How it's built / published from the monorepo fork

- **Build tool: `tsdown --unbundle`** (`"build": "tsdown --unbundle"`). `--unbundle` emits one output file per input rather than a single bundle, preserving the multi-file shape.
- The package's `tsconfig.json` is what makes the cross-package `.ts` imports compile:
  ```json
  {
    "compilerOptions": {
      "target": "esnext",
      "module": "esnext",
      "allowImportingTsExtensions": true,
      "rewriteRelativeImportExtensions": true,
      "paths": { "@angular/*": ["../*"] },
      "skipLibCheck": true,
      "noEmit": true,
      "moduleResolution": "bundler"
    }
  }
  ```
  `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` let `index.ts` import `*.ts` directly and have the emitted JS reference the rewritten extensions; `paths` maps `@angular/*` into the sibling package dirs.
- **Output format is ESM**: published `exports` → `{ ".": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" }, "./*": "./*" }`, `"type": "module"`, `"sideEffects": false`. (Contrast with angular-typechecker, which must ship CommonJS for Nx's `require()` loader.)
- **Publish workflow** (`.github/workflows/angular-html-parser-publish.yml`): triggers `on: push: tags: v*`; runs from `working-directory: packages/angular-html-parser`; `yarn --immutable && yarn build`; then `npm pkg delete scripts devDependencies packageManager` to scrub the manifest before `npm publish`; uses OIDC (`permissions: id-token: write`). The release itself is cut with `release-it` (`.release-it.json`: `tagName: "v${version}"`, `npm.publish: false` — npm publish is delegated to the tag-triggered workflow, not release-it).
- **Tests run against the upstream specs in place**: `packages/angular-html-parser/vitest.config.ts` includes `"../compiler/test/ml_parser/*_spec.ts"` plus the package's own `./test/*_spec.ts`. So the fork re-runs Angular's own ml_parser test suite (patched where behavior diverges) as the package's test suite.

### The modifications, and how they are marked (KEY pattern)

Every divergence from upstream is tagged in-place with a literal `// angular-html-parser:` comment. The README lists the behavioral modifications; the code markers make them greppable. Verified via `git grep -i "angular-html-parser" -- packages/compiler/`:

Source modifications (only **4** in `src/`):

- `ml_parser/html_parser.ts:19` — `// angular-html-parser: More options` (adds `isTagNameCaseSensitive` + `getTagContentType` params to `parse`).
- `ml_parser/ast.ts:122` — `// angular-html-parser: backwards compatibility for Prettier` (adds a `nameSpan` getter aliasing `keySpan`).
- `ml_parser/html_tags.ts:192` — `// angular-html-parser: modification` (removes the lowercase fallback in tag lookup; the upstream line is left commented out right below as documentation of the diff).
- `ml_parser/parser.ts:677` — `// @ts-expect-error -- in angular-html-parser endTagToken.parts.length can be 0 (HTM component end-tags)`.

Test modifications (~32): `packages/compiler/test/ml_parser/{html_parser_spec,lexer_spec}.ts` carry `// angular-html-parser: diverge`, `// angular-html-parser: valueSpan contains quotes`, `// angular-html-parser: different docType parse`, etc. — each marks a spec assertion intentionally changed to match the forked behavior.

The discipline: **keep the source diff tiny and self-documenting** (commented-out upstream line + a marker comment), and push the bulk of "we behave differently here" into the test suite where it's explicit and machine-checkable.

---

## angular-estree-parser

### What it is and what it consumes

A from-scratch package (own `src/`, `tsdown.config.ts`, Vitest). It does NOT vendor Angular — it **depends on `@angular/compiler` as a true `peerDependency`**:

```json
"peerDependencies": { "@angular/compiler": ">=21" },
"devDependencies": { "@angular/compiler": "22.0.1", "@babel/types": "8.0.0-rc.6", ... }
```

The README install line is explicit: `npm install --save angular-estree-parser @angular/compiler` — the consumer supplies the compiler. (This mirrors angular-typechecker's own `@angular/compiler-cli` peer-dependency model.)

### The Angular APIs it consumes

From `src/angular-parser.ts`, the public expression-parser surface of `@angular/compiler`:

```ts
import { type ASTWithSource, Lexer, ParseError, ParseLocation, Parser, ParseSourceFile, ParseSourceSpan, type TemplateBindingParseResult } from '@angular/compiler';

let parser: Parser;
function getParser() {
  return (parser ??= new Parser(new Lexer()));
}
```

It then calls the compiler's expression-parser methods directly: `parser.parseBinding`, `parseSimpleBinding`, `parseAction`, `parseInterpolationExpression`, and `parseTemplateBindings`. It even reaches a **private** method via `// @ts-expect-error`:

```ts
const getCommentStart = (text: string): number | null =>
  // @ts-expect-error -- need to call private _commentStart
  Parser.prototype._commentStart(text);
```

The four public entry points (`src/index.ts`) match the README API:

- `parseAction` → `(target)="..."`
- `parseBinding` → `[target]="..."`
- `parseInterpolationExpression` → `{{ ... }}`
- `parseTemplateBindings` → `*directive="..."`
- (`parseSimpleBinding` is exported but undocumented.)

Beyond parsing, it consumes Angular's AST node classes and the visitor contract for the transform layer. From `src/ast-transform/`:

- `AstVisitor` (the visitor interface — `visitors.ts` declares `type TransformVisitors = Required<Omit<AstVisitor, 'visit'>>`, so TypeScript forces a transform fn for EVERY Angular AST node kind; a new node added upstream becomes a compile error here).
- Concrete node types, one transform file each: `Binary`, `BindingPipe`, `Call`/`SafeCall`, `Chain`, `Conditional`, `Interpolation`, `LiteralArray`, `ArrowFunction`, `NonNullAssert`, `ParenthesizedExpression`, `SpreadElement`, `ImplicitReceiver`, plus literal/member/template-literal/unary transforms. `node-transformer.ts` special-cases `ParenthesizedExpression` to set `extra.parenthesized`.

### How it maps Angular's expression AST → ESTree

- Output nodes are **`@babel/types` (Babel ESTree) shapes** with custom `NG`-prefixed extensions for things ESTree has no concept of: `NGPipeExpression`, `NGChainedExpression`, `NGEmptyExpression` (`src/ast-transform/node-types.ts`), and a separate microsyntax family (`NGMicrosyntax`, `NGMicrosyntaxLet`, `NGMicrosyntaxAs`, `NGMicrosyntaxKeyedExpression`, …) in `src/microsyntax/`.
- Example mapping (`transform-pipe-expression.ts`): Angular `BindingPipe { exp, name, args }` → `{ type: 'NGPipeExpression', left: transform(exp), right: Identifier(name), arguments: args.map(transform) }`.
- Transformation is a recursive visitor: `NodeTransformer.transform()` calls `node.visit(transformVisitors, this)` then wraps the result with location info. Children recurse via `transformChild`, threading `ancestors` so a child can see it sits under a `ParenthesizedExpression`.
- **Location remapping is the hard part.** `src/source.ts` (`Source.createNode`) recomputes `start`/`end`/`range` against the original source text (Angular spans are sometimes offset/approximate), and for numeric/string/regexp literals it slices the raw text to populate `extra.raw` / `extra.rawValue` so downstream Prettier can re-print verbatim. `src/utilities.ts` does character-index scanning to fix spans Angular reports imprecisely.

### Build / dependency footprint

- **Build tool: `tsdown --unbundle`** (same as html-parser), config `tsdown.config.ts`: `{ deps: { neverBundle: ['@babel/types'] }, fixedExtension: false, dts: true }`. `@babel/types` is types-only so it is never bundled; `@angular/compiler` stays external (peer).
- `exports: "./dist/index.js"`, `"type": "module"`, `"sideEffects": false`, `"files": ["dist"]`, `engines.node >= 20`.
- Released with `release-it`; tested with Vitest; lint via ESLint flat config (`eslint.config.js`) + Prettier. TypeScript `6.0.3` (same TS-6 window as angular-typechecker).

---

## Upstream-sync / vendoring strategy — the maintainability playbook

This is the most transferable section. `angular-html-parser` and `angular-estree-parser` solve the same "track a fast-moving Angular internal API" problem **two different ways**.

### A. `angular-html-parser` — "fork the whole monorepo, rebase on upstream" (deep vendoring)

1. **Two-branch model.** README "Diff from upstream" points at `compare/main...prettier:angular-html-parser:dev`. Confirmed by the CI workflow comment:
   `# @fisker don't run on main branch, since workflows there are from upstream`
   So: **`main` = a pristine mirror of `angular/angular`** (workflows, code, all from upstream); **`dev` = `main` + Prettier's parser-only modifications** (the `// angular-html-parser:` markers). The published package is built from `dev`.
2. **Sync = rebase `dev` onto a newer `main`.** The README literally instructs maintainers: _"Try sync `main` and `dev` branch with upstream first."_ Because the modifications are tiny and marker-tagged, replaying them onto a new Angular release is a small, reviewable diff. The whole `compare/main...dev` link IS the maintained patch set.
3. **Version mapping is loose, not 1:1.** Package version is `10.10.0` while the forked tree is Angular `22.1.0-next.2`. The package CHANGELOG cadence is dominated by literal `Sync with upstream.` entries (e.g. `8.0.0 (2024-11-25) — Sync with upstream.`). They bump the package version on each sync rather than tracking Angular's number. (Side effect: because the fork carries Angular's whole `CHANGELOG.md`, the package changelog has leaked hundreds of irrelevant `compiler-cli:`/`core:` upstream entries — a cautionary tale about changelog hygiene when you fork a whole repo.)
4. **Tests are the regression net.** The package re-runs Angular's own `compiler/test/ml_parser/*_spec.ts` (with `// angular-html-parser: diverge` patches). After a sync, a broken upstream behavior change shows up as a failing upstream spec — that's the early-warning system.
5. **Self-contained output.** Because `tsdown` inlines the compiler source into `dist/`, the published package has zero Angular runtime deps — the consumer is fully decoupled from Angular versioning. The cost is that you re-vendor on every sync.

### B. `angular-estree-parser` — "peer-depend + structurally track via the visitor type" (shallow vendoring)

1. **No fork.** It imports `@angular/compiler` as a peer and writes its own transform layer.
2. **The compiler's own types are the drift detector.** `Required<Omit<AstVisitor, 'visit'>>` means if Angular adds/renames an AST node, the build breaks until a matching transform exists. Reaching a private API (`Parser.prototype._commentStart`) is fenced with `@ts-expect-error` + a reason comment — same discipline as angular-typechecker's quarantined internal-surface files.
3. **Wide peer range, explicit per-version support.** `peerDependencies: { "@angular/compiler": ">=21" }`, with CHANGELOG entries like `support angular 19`, `support typeof expression`, `support TemplateExpression` — they add support for new Angular syntax as features and widen the range deliberately.

### Which model maps to angular-typechecker

angular-typechecker already uses **model B** (peer-depend on `@angular/compiler-cli`, vendor only the _type surface_ via `compiler-cli-types.ts`, quarantine internal nx surfaces). The Prettier estree-parser is direct precedent for B and validates our choices (peer dep, `@ts-expect-error`-fenced private access, structural type re-declaration). Model A (deep monorepo fork) is the alternative we explicitly do NOT want — it's only justified when you must _ship runtime parser code with zero Angular dep_, which a type-checker (that loads the real compiler anyway) never needs.

---

## LEARNINGS FOR angular-typechecker

### Directly applicable to type-checking

1. **[tangential-leaning / SUR] Expression-parser entry points are reusable for lightweight pre-flight checks.** `angular-estree-parser` shows the exact `@angular/compiler` calls (`new Parser(new Lexer())`, `parseBinding`/`parseAction`/`parseInterpolationExpression`/`parseTemplateBindings`) that turn a template-expression string into an AST with `.errors`. If we ever want a _fast syntax-only_ pre-flight pass (catch malformed `{{ }}`/`[x]=""` before paying for the full `performCompilation`), this is the minimal API — but be honest: our whole-program path already reports these via the real compiler, so this only matters for a future fast/partial mode.
2. **[vendoring-discipline] `@ts-expect-error` + reason is the sanctioned way to touch a private compiler symbol.** Both Prettier packages reach internal/private surfaces (`Parser.prototype._commentStart`, the `endTagToken.parts.length` divergence) with a single-line `@ts-expect-error -- <why>`. This validates our quarantine approach and gives us a citable precedent for keeping such accesses narrow and commented rather than re-typing whole modules.

### Applicable only to our packaging / vendoring discipline

3. **[vendoring-discipline] Mark every divergence from upstream with a greppable, namespaced comment.** `// angular-html-parser:` lets a maintainer enumerate the entire patch set with one `git grep`. For our `compiler-cli-types.ts` shim and nx-internal quarantine files, adopt an equivalent `// angular-typechecker: vendored — <reason>` marker so future Angular/Nx bumps can be audited in seconds. (Bonus: keep the original upstream line commented directly beneath a modification, as `html_tags.ts:192` does, so the diff is self-documenting.)
4. **[vendoring-discipline] Let the type system be the drift detector.** `Required<Omit<AstVisitor, 'visit'>>` forces a compile error when Angular changes its AST. We should structure `compiler-cli-types.ts` so that a mismatch with the real compiler surface fails our own `tsc`/test build (it already half-does this); treat any future "structurally re-declare" as "make the re-declaration a constraint that breaks loudly", not a loose `any`.
5. **[vendoring-discipline / SUP] Prefer peer-dep + per-version support entries over deep forking.** estree-parser's `>=21` peer + CHANGELOG "support angular NN" entries is the maintainable pattern for broadening version support (our SUP family). Widen the `@angular/compiler-cli` peer range deliberately and record each newly-supported Angular major as a feature, rather than vendoring more code.
6. **[vendoring-discipline] Self-contained `dist/` (Model A) is the wrong trade for us — note why.** html-parser inlines compiler source to ship zero deps, paying a re-vendor cost every sync. A type-checker must load the consumer's real `@angular/compiler-cli` anyway, so inlining buys nothing and forfeits version-matching. Document this as a rejected alternative so it isn't re-litigated.
7. **[vendoring-discipline] Re-run upstream's own specs as a sync safety net.** html-parser's vitest config includes `../compiler/test/ml_parser/*_spec.ts`. If we ever vendor behavior (not just types), pulling the upstream spec for that surface into our test run is the cheapest early-warning for a breaking Angular change.
8. **[release-discipline] Scrub the manifest at publish and keep the changelog hand-curated.** html-parser's publish step runs `npm pkg delete scripts devDependencies packageManager` before `npm publish`, and its changelog drowned in leaked upstream entries. This reinforces our existing AGENTS.md rule to hand-curate `CHANGELOG.md` and ship a tight `files` whitelist.

### Tangential / not applicable

9. **[tangential] HTML structural parsing (`angular-html-parser`) is irrelevant to type-checking.** It deliberately excludes binding/type analysis — it answers "is this valid HTML/Angular template _structure_", not "do the bindings type-check". A whole-program type-checker gets structure for free from the real compiler. Only relevant as the vendoring case study above.
10. **[tangential → SUR-adjacent] ESTree output is a Prettier-printing concern, not a diagnostics concern.** The Babel/ESTree mapping + span-fixups exist so Prettier can re-print. A type-checker emits diagnostics, not formatted code, so the AST-transform layer is not something we'd reuse — unless a far-future SUR (e.g. a custom NG-style lint/diagnostic that needs an expression AST without the full compiler-cli) wanted a lightweight expression AST. Flagged as speculative.

---

## Open questions

1. **Exact sync mechanics for `angular-html-parser`.** The local clone is a single-commit `dev` checkout (no `main` branch, shallow history), so I could not inspect _how_ the rebase-onto-upstream is performed (manual cherry-pick? scripted rebase? frequency vs Angular release cadence). The README/CI comments establish the two-branch model and "sync first" instruction, but the operational runbook would need the live GitHub repo. Not blocking for us (we're not adopting Model A), but it's the one gap if we ever wanted the full deep-fork playbook.
2. **Does `angular-estree-parser` ever break on Angular _patch_ releases**, or only majors? CHANGELOG shows per-major "support angular NN" entries but not whether minor/patch AST tweaks have forced fixes — relevant to how wide we dare set our own peer range.
3. **Is `parseSimpleBinding` (exported but undocumented) a stable API** we'd rely on, or an internal detail? Minor; only matters if we ever consume the estree-parser directly (unlikely).
