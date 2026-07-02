# Stack Research — v0.0.4 (typecheck-configuration generator + extended testing strategy)

**Domain:** Nx 23 plugin — adding a config-edit generator + extending the test suite
**Researched:** 2026-07-01
**Confidence:** HIGH (every API verified against the *installed* `nx@23.0.1` / `@nx/devkit@23.0.1`; registry dist-tags re-checked 2026-07-01)

> **Milestone-scoped + builds on the board.** This file covers ONLY the STACK dimension of the
> v0.0.4 NEW features — the `typecheck-configuration` Nx generator and the extended testing
> strategy. It does NOT re-research the shipped executor / `runTypecheck` core, the existing
> 3-tier pyramid, the `typecheck-drift` gate, or the CI matrix. The testing strategy is already
> ratified by the unanimous 8-lens Opus board — `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`
> (D1–D6). This document cites that consensus and confirms versions/APIs; it does not re-derive
> or contradict it.

## Headline finding (read first)

**No new dependencies are required — runtime, dev, or peer.** Everything the generator and the
extended tests need is ALREADY installed and ALREADY classified correctly:

- The generator-authoring APIs (`readProjectConfiguration`, `updateProjectConfiguration`,
  `formatFiles`, the `Tree` type) ship in `@nx/devkit@23.0.1`, which is **already a pinned
  `dependency`** of the published package (`packages/angular-typechecker/package.json` line 41).
  The generator binds to the *same* `@nx/devkit` the executor already uses — zero new runtime deps.
- The generator-test substrate (`createTreeWithEmptyWorkspace`) ships in the **`@nx/devkit/testing`**
  subpath of that same dependency — it is dev/test-only at use-time (the import never reaches the
  published `src/`, so `@nx/dependency-checks` stays clean).
- `@nx/plugin@23.0.1` (already a devDependency) supplies the `@nx/plugin:generator` scaffolder.
- The catalog/tripwire work consumes the *already-present* peer `@angular/compiler-cli@22.0.4`
  (the `ExtendedTemplateDiagnosticName` enum + `ErrorCode` map) — no new dep, no version change.

So the entire v0.0.4 "stack add" is, concretely: **(1) a `generators.json` file + a `"generators"`
field in `package.json`, (2) one new asset glob + one `files` entry to ship them, (3) committed
fixtures.** That is configuration and source, not packages.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@nx/devkit` | `23.0.1` (ALREADY a pinned `dependency`) | Generator-authoring API: `readProjectConfiguration` / `updateProjectConfiguration` / `formatFiles` / `Tree` type | All four verified exported from the installed `@nx/devkit@23.0.1` (`typeof` === `function` for the three fns; `Tree` is a `type` re-export from `nx/src/devkit-exports`). The generator reuses the SAME devkit the executor depends on — devkit-as-dependency is also the registry-listing requirement, so this is locked. **Do not bump, do not move to peer.** |
| `@angular/compiler-cli` | `22.0.4` (ALREADY a peer + devDep) | Source of `ExtendedTemplateDiagnosticName` (the 18-member enum) + `ErrorCode` map for CAT-01/04/05 and the DRIFT-01 completeness tripwire | The catalog asserts against the *real* compiler over committed fixtures (board D2) and the tripwire reads the enum at test/build time. Already installed at the locked stable version (registry `latest=22.0.4`; verify-only against `next`/`rc` is forbidden per project memory). No change. |
| `typescript` | `>=6.0.0 <6.1.0` (installed `6.0.3`; ALREADY a peer + devDep) | `ts.DiagnosticCategory` used in CAT-01/02 exact-category assertions | The catalog asserts `code + DiagnosticCategory + count`; `DiagnosticCategory` is the TS enum already in use across the integration specs (`extended.angular13.integration.spec.ts`). No change. |
| `vitest` | `~4.1.0` (installed; ALREADY dev) | Runner for the generator unit specs, the catalog `it.each` table, and the tripwire | Generator specs and the catalog auto-route into the existing 6-cell `test` matrix the moment they match `vitest.config.mts`'s include glob (board D5; no `ci.yml` change). `it.each` keyed on the enum is the board-mandated catalog shape (D2). No new test framework. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nx/devkit/testing` (subpath of `@nx/devkit@23.0.1`) | `23.0.1` | `createTreeWithEmptyWorkspace()` — the **public, in-memory** Tree substrate for generator unit tests (GEN-06) | THE substrate per board D1. Verified: resolves to an `FsTree` rooted at `/virtual` with `nx.json` + `.prettierrc` pre-seeded (so `formatFiles` has a Prettier config). Subpath export present in `@nx/devkit@23.0.1`'s `exports` map (`./testing`). Used only in `*.spec.ts` → never ships. |
| `@nx/devkit` config-tree utils (`addProjectConfiguration`, `readJson`, `readProjectConfiguration`) | `23.0.1` | SEED a project into the empty tree (the generator UPDATES, it does not create) and ASSERT the written target | Generator specs must `addProjectConfiguration(tree, 'demo', {...})` first — `readProjectConfiguration` THROWS on a missing project. Assert via `readProjectConfiguration` / `readJson` (or `toMatchSnapshot()` of the resolved config). All public via `@nx/devkit`. |
| committed fixtures under `fixtures/` (no library) | n/a | Static component+template+tsconfig triples that trigger each NG8xxx / baseline code (CAT-01/03) and the generator e2e's un-wired project (GE2E-01) | Board D2 mandates committed fixtures over the real compiler (not in-memory `NgtscTestEnvironment`, which the public `performCompilation` path can't use). Mirrors the existing `fixtures/extended-v13/` substrate. NO `jscodeshift` / AST-mutation toolkit (board D6 / REQUIREMENTS Out of Scope). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@nx/plugin:generator` (from `@nx/plugin@23.0.1`, already a devDependency) | Scaffold `src/generators/typecheck-configuration/{generator.ts, schema.json, schema.d.ts}` + the `generators.json` registration | Verified present in `@nx/plugin@23.0.1`'s `generators.json` (alongside `executor`, `plugin`, `e2e-project`, `migration`). Path-based in Nx 23; pass `--unitTestRunner=vitest` to match the repo. Scaffolding only — never shipped. After scaffolding, hand-author the schema to match the executor's convention (`cli: "nx"`, `version: 2`, `additionalProperties: false`, a positional `project` via `$default`/argv). |
| `@nx/eslint` `@nx/dependency-checks` (already wired) | Keeps the published `package.json` deps honest after the `generators` field lands | No code import changes for it to police — the generator imports only `@nx/devkit` (already a dependency). `createTreeWithEmptyWorkspace` is a test-only import; ensure the spec is excluded from `tsconfig.lib.json` (it already excludes `*.spec.ts`) so the rule does not see a phantom test dep. |
| existing `schema-parity.spec.ts` idiom (no new tool) | Gate the generator's `schema.json` keys === `schema.d.ts` interface (GEN-06) | Extend the existing executor pattern (`packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts`) to the generator's schema. Pure-unit; auto-routes into the `test` matrix. |

## Installation

```bash
# Core — NOTHING to install. The generator binds to the already-pinned dependency:
#   @nx/devkit@23.0.1  (already in packages/angular-typechecker/package.json "dependencies")
#   and the test substrate is its @nx/devkit/testing subpath (no separate package).

# Supporting — NOTHING to install. The catalog/tripwire consume the already-present peer/devDep:
#   @angular/compiler-cli@22.0.4, typescript@6.0.3, vitest@~4.1.0  (all already installed).

# Dev — NOTHING to install. @nx/plugin@23.0.1 is already a devDependency; use it to scaffold:
npx nx g @nx/plugin:generator typecheck-configuration \
  --project=angular-typechecker --unitTestRunner=vitest
```

> The single concrete "add" is NOT an npm install — it is the `generators.json` registration + the
> `package.json` `"generators"` field + the build/`files` wiring (see Integration below).

## `generators.json` + `package.json` `generators` conventions (Nx 23.0.1)

Mirror the EXISTING `executors.json` / `"executors"` setup exactly — the executor already proves
the pattern in this repo.

1. **`generators.json` at the package root** (sibling of `executors.json`):
   ```jsonc
   {
     "$schema": "../../node_modules/nx/schemas/collection.schema.json",
     "generators": {
       "typecheck-configuration": {
         "factory": "./src/generators/typecheck-configuration/generator",
         "schema": "./src/generators/typecheck-configuration/schema.json",
         "description": "Wire the angular-typecheck target into a project's project.json."
       }
     }
   }
   ```
   `factory` is an **extensionless path relative to the published package root** (Nx appends the
   extension and `require()`s the compiled `.js`) — identical to how `executors.json`'s
   `implementation` is written.

2. **`"generators": "./generators.json"`** added to the published `package.json`, sibling to the
   existing `"executors": "./executors.json"` (line 29). This field is THE marker that makes Nx
   discover the generator collection.

3. **`schema.json`** uses the repo's executor convention: `"cli": "nx"`, `"version": 2`,
   `"additionalProperties": false`, and a **positional `project` arg** via
   `"$default": { "$source": "argv", "index": 0 }`. Hand-author a matching `schema.d.ts`
   interface (Nx does NOT generate it) and gate parity with the existing `schema-parity.spec.ts`
   idiom (GEN-06).

4. **Generator function shape** (verified API): a default-exported
   `async function (tree: Tree, options: Schema): Promise<void>` that calls
   `readProjectConfiguration` → mutate `project.targets['angular-typecheck']` (idempotency guard:
   skip/merge if present, GEN-04) → `updateProjectConfiguration` → `await formatFiles(tree)`.
   It does **NOT** call `generateFiles` and does **NOT** emit files (board "decision B" /
   GEN-01) — so `OverwriteStrategy` and a `files/` template tree are not needed in v0.0.4.

## Integration with the existing build/package

| Touch point | File | Change |
|-------------|------|--------|
| Ship `generators.json` in the tarball | `packages/angular-typechecker/package.json` `files` (line 34–39) | Add `"generators.json"` to the allowlist (today it lists `src`, `executors.json`, `README.md`, `LICENSE`). Without this it won't publish. |
| Copy `generators.json` into the build output | `packages/angular-typechecker/project.json` `build.assets` (line 17–39) | Add ONE asset block globbing `generators.json` → `.`, mirroring the existing `executors.json` block (lines 29–33). `generators.json` is NOT compiled. |
| `schema.json` into output | (already covered) | The existing `**/!(*.ts)` asset glob (lines 19–23) already copies any `schema.json` under `src/` — no change needed, same as the executor's schema. |
| `schema.d.ts` into output | (already covered) | The existing `**/*.d.ts` asset glob (lines 25–28) already copies hand-authored `.d.ts` — no change. |
| Generator unit + catalog + tripwire specs | CI `test` job | AUTO-route into the existing 6-cell matrix via `vitest.config.mts`'s include glob — **no `ci.yml` change** (board D5; confirmed by the audit's A.4). |
| Generator e2e | `e2e/angular-typechecker-install-e2e` | FOLD into the existing tarball harness (board D4 / GE2E-01/02): add an un-wired project to the consumer fixture, `nx g` → assert `project.json` → `nx run …:angular-typecheck --skip-nx-cache`. **No new e2e project**, so the `e2e` job's explicit `-p` list is unchanged — and the new GUARD-01 set-equality test makes any future omission loud. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| In-memory `createTreeWithEmptyWorkspace` (`@nx/devkit/testing`) | Bespoke real-disk `createFsTree`/`flushFsTreeChanges` over the internal `nx/src/generators/tree` (`FsTree`/`flushChanges`) | ONLY if a FUTURE generator emits files a real compiler must read back mid-run (tracked as FSTREE-01). For a `project.json`-edit-only generator it adds a non-public deep import + ESLint quarantine + a drift tripwire for zero behavioral gain (board D1; Nx's own ratio is 452 in-memory : 1 real-disk). Real-disk fidelity already lives in the tarball e2e tier. |
| Existing `npm pack` + tmp-install tarball e2e harness | Verdaccio local registry + `createTestProject()` (the Nx-canonical generator-e2e route) | Effectively never for this repo: a second e2e mechanism, and the scaffolded `start-local-registry.ts` `execFileSync(nx, …)` is known-broken on Windows-arm64 (the primary dev box). The existing harness already installs the real tarball (board D4; REQUIREMENTS Out of Scope). |
| `@nx/devkit` config utils only | `generateFiles` + EJS templates + `OverwriteStrategy` | Only if the generator must SCAFFOLD a file (e.g. a `tsconfig.typecheck.json`). v0.0.4 edits `project.json` only, so the file-emitting path (and its `files/` template tree) is out of scope. |
| Committed static fixtures | `jscodeshift` error-injection toolkit | Never in v0.0.4: committed fixtures reproduce every diagnostic deterministically; no AST-mutation apparatus is warranted (board D6 / Out of Scope). |

## What NOT to Use (and NOT to add)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any NEW runtime `dependency` for the generator | The generator imports only `@nx/devkit`, which is already pinned at `23.0.1`. A new dep would also have to clear `@nx/dependency-checks` for no reason. | The existing `@nx/devkit` dependency. |
| Moving `@nx/devkit` to a `peerDependency` "because it's now also a generator dep" | Breaks the tested-version pin AND disqualifies Nx registry listing (the same rule that already drives devkit-as-dependency for the executor). | Keep `@nx/devkit` a pinned `dependency`. |
| `createFsTree`/`flushFsTreeChanges` via `import … from 'nx/src/generators/tree'` | Non-public deep import (NOT in any `@nx/devkit` barrel — only the `Tree`/`FileChange` *types* are public); needs a quarantine + drift tripwire; the generator needs no real-disk semantics. | Public `createTreeWithEmptyWorkspace` from `@nx/devkit/testing` (board D1). Defer FSTREE-01. |
| Verdaccio (`verdaccio`, `start-local-registry.ts`) | Second e2e mechanism; Windows-arm64 `execFileSync` breakage; the `npm pack` harness already proves install fidelity. | Extend the existing `install-e2e` tarball harness (board D4). |
| Adding `migrations`/`schematics`/`builders` fields or a `migrations.json` | v0.0.4 ships the config generator only — no `ng add`/`nx add`, no breaking-change migrations (GEN-FUT-02 deferred). | Only the `"generators"` field + `generators.json`. |
| A new top-level `"generators"` collection at the WORKSPACE root, or registering via `nx.json` | The collection belongs in the PUBLISHED package next to `executors.json`; that is what consumers resolve `nx g angular-typechecker:typecheck-configuration` against. | Package-root `generators.json` + the package `"generators"` field. |
| Numeric `NG81xx` filtering for the catalog | Two of the 18 members (NG8011, NG8021) sit OUTSIDE the 81xx range — a numeric filter silently drops them (board D2). | Iterate the `ExtendedTemplateDiagnosticName` enum directly (the tripwire enforces row === enum). |

## Stack Patterns by Variant

**If the generator stays a pure `project.json` edit (the ratified v0.0.4 shape, board "decision B"):**
- Use `@nx/devkit` config utils + in-memory `createTreeWithEmptyWorkspace`; NO `generateFiles`,
  NO `OverwriteStrategy`, NO real-disk FsTree, NO new deps. This is the assumed-and-confirmed path.

**If a future milestone makes the generator EMIT a file (e.g. a `tsconfig.typecheck.json`):**
- Add `generateFiles` + an EJS `files/` template tree + `OverwriteStrategy.KeepExisting` for
  idempotency (all already in `@nx/devkit`, still no new dep), and re-open the FSTREE-01 decision
  (a real-disk test tier may then earn its keep). Board D1/D6 explicitly condition the current
  convergence on the generator NOT emitting files.

**If a future milestone adds the Angular CLI (`angular.json`) surface (GEN-FUT-01):**
- Re-export the generator as a schematic via `convertNxGenerator` (verified present in
  `@nx/devkit@23.0.1`) — a thin adapter over the same generator, still no new dep. Deferred.

## Version Compatibility

| Package | Pin / range | Notes |
|---------|-------------|-------|
| `@nx/devkit` | `23.0.1` (exact, already pinned) | Registry `latest=23.0.1` (re-checked 2026-07-01). Carries `nx` via its peer (`>= 22 <= 24 \|\| ^23.0.0-0`); generator + `@nx/devkit/testing` both ship here. |
| `nx` | `23.0.1` (workspace runtime; not declared in the package) | Registry `latest=23.0.1`. The internal `nx/src/generators/tree` (`FsTree`/`flushChanges`) is byte-identical 23.0.1 → 23.1.0-beta.4 — but it is NOT used under board D1, so no tripwire is needed for v0.0.4. |
| `@nx/plugin` | `23.0.1` (devDependency, not shipped) | Registry `latest=23.0.1`. Supplies `@nx/plugin:generator` (verified in its `generators.json`). Path-based in Nx 23; `--unitTestRunner=vitest`. |
| `@nx/vitest` / `vitest` | `23.0.1` / `~4.1.0` (already dev) | Registry `@nx/vitest latest=23.0.1`. Generator + catalog specs ride the existing `@nx/vitest:test` 6-cell matrix. |
| `@angular/compiler-cli` | `^22.0.0` peer (installed `22.0.4`) | Registry `latest=22.0.4`. Source of the 18-member `ExtendedTemplateDiagnosticName` enum; verify each code/name against the INSTALLED `error_code.d.ts` + `extended_template_diagnostic_name.d.ts` at implementation time (CAT-05). Stable only — never `next`/`rc`. |
| `typescript` | `>=6.0.0 <6.1.0` peer (installed `6.0.3`) | `ts.DiagnosticCategory` for the catalog's category assertions. No change. |

## Sources

- Installed `@nx/devkit@23.0.1` + `nx@23.0.1` in this repo (HIGH, verified THIS session 2026-07-01):
  `require('@nx/devkit')` exposes `readProjectConfiguration`/`updateProjectConfiguration`/`addProjectConfiguration`/`formatFiles`/`generateFiles`/`joinPathFragments`/`readJson`/`getProjects`/`convertNxGenerator` as functions and `OverwriteStrategy` (`{Overwrite,KeepExisting,ThrowIfExisting}`) as an object; `require('@nx/devkit/testing').createTreeWithEmptyWorkspace()` returns an `FsTree` rooted at `/virtual` with `nx.json` + `.prettierrc` seeded; `@nx/devkit/package.json` `exports` includes `./testing`; `public-api.d.ts` exports `formatFiles`/`generateFiles`/`OverwriteStrategy`/`convertNxGenerator`; `Tree` is a `type` re-export from `nx/src/devkit-exports`.
- `@nx/plugin@23.0.1` `generators.json` (HIGH, read THIS session): `generator` factory `./dist/src/generators/generator/generator`; `executor` present; collection also has `plugin`/`e2e-project`/`migration`/`preset`.
- `registry.npmjs.org` dist-tags (HIGH, fetched 2026-07-01): `nx`, `@nx/devkit`, `@nx/plugin`, `@nx/vitest`, `@nx/js`, `@nx/eslint` all `latest=23.0.1`; `@angular/compiler-cli latest=22.0.4`; `typescript` window `6.0.x`.
- Repo source (HIGH, read THIS session): `packages/angular-typechecker/{package.json, executors.json, project.json, src/executors/angular-typecheck/schema.json}` — the executor's registration + assets + schema convention this generator mirrors.
- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` (board D1–D6) and `CURRENT-AUDIT-AND-GENERATOR.md` / `NX-FSTREE-INTERNALS.md` (HIGH): the ratified strategy this STACK builds on — in-memory substrate, no bespoke FsTree, no Verdaccio, 18-member enum-keyed catalog, folded generator e2e, `-p` guard.
- `.planning/codebase/STACK.md` + `.planning/PROJECT.md` (HIGH, snapshot 2026-06-30): the locked stack and dependency-classification rules carried forward unchanged.

---
*Stack research for: Nx 23 plugin generator + extended test suite (v0.0.4 new features)*
*Researched: 2026-07-01*
