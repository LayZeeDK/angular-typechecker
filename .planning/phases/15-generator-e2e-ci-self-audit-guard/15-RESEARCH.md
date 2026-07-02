# Phase 15: Generator e2e + CI self-audit guard - Research

**Researched:** 2026-07-02
**Domain:** Nx-plugin tarball e2e (generate + run verdict), `nx add` install contract, CI self-audit guard
**Confidence:** HIGH (every load-bearing claim verified against the installed Nx 23.0.1 source and the live codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** New purpose-built multi-leaf solution fixture (recommended name `consumer-generator/`) under `e2e/angular-typechecker-install-e2e/fixtures/`; do NOT reuse `consumer-app` (it is flat, points at `tsconfig.lib.json`, and pre-declares the targetDefaults key with `production` inputs). The new fixture is ONE un-wired Angular **library** whose solution `tsconfig.json` has a non-empty `references[]` -> `tsconfig.lib.json` (a component WITH a template) + `tsconfig.spec.json` (a `*.spec.ts`).
- **D-02** The fixture's `nx.json` MUST NOT pre-declare `targetDefaults["angular-typechecker:typecheck"]` (so `init` genuinely SEEDS it). After seeding, assert the block equals the WALK-02 shape with **`default`** (never `production`) as the first input.
- **D-03** Reuse the established install-smoke harness verbatim: `buildCleanEnv()` (strip `NX_*` runner vars + peer-override keys; `NX_DAEMON=false`, `FORCE_COLOR=0`), `beforeAll` build-`--skip-nx-cache` + `npm pack --json`, per-scenario `mkdtempSync` -> `cpSync` -> empty `.npmrc` + non-existent `npm_config_userconfig` -> `npm install <tarball>`, execSync-throws->catch verdict helper, full-token code assertion + `ERR_REQUIRE_ESM`/`infrastructure error` negative guards, `rmSync` teardown. Runs SEQUENTIALLY on the MAIN tree under the serialized `vitest.config.mts`. NEVER pipe `nx` through `head`/`rg`.
- **D-04** GE2E-01/02 flow: `nx g angular-typechecker:configuration <proj>` -> assert `project.json` ONE `typecheck` target (executor `angular-typechecker:typecheck`, `options.tsConfig` -> solution `tsconfig.json`) -> assert seeded `nx.json` `targetDefaults` (WALK-02 block, `default` inputs, `cache:true`, `outputs:[]`) -> `nx run <proj>:typecheck --skip-nx-cache` clean exit 0 -> inject distinct codes into BOTH lib leaf AND spec leaf -> non-zero + both rendered codes in stdout, no `ERR_REQUIRE_ESM`, no `infrastructure error`. Full code tokens (e.g. `TS2322`, not `2322`).
- **D-05** Inject into the discarded tmp copy (crash-safe, no sidecar); build injected lines via `JSON.stringify`; hoisted const per injected code.
- **D-06** GE2E-03 = distinct scenario, same harness; prove `nx add angular-typechecker` runs `init` on install and seeds `targetDefaults`. **RESEARCH-VERIFY (closed below):** the exact testable invocation, `ng-add` alias requirement, and package.json discovery. Do NOT ship an Angular-CLI `ng add` surface.
- **D-07** New `*.int.spec.ts` files under `install-e2e/src/` (no new nx project). Recommended `generator-e2e.int.spec.ts` (GE2E-01+02) and `nx-add-e2e.int.spec.ts` (GE2E-03); planner MAY combine as a second `describe`. The `include: ['src/**/*.int.spec.ts']` glob auto-picks them up.
- **D-09** Guard is an in-plugin fast test under `packages/angular-typechecker/src/` (auto-routes into the 6-cell `test` matrix; no `ci.yml` structural change). Resolve workspace root from the spec location like `release-hygiene.int.spec.ts`.
- **D-10** Bidirectional set equality, quantifier `every`: every `e2e/*` graph project appears in the `-p` list AND every `-p` entry is a real `e2e/*` project. Single required `ci` gate unchanged.
- **D-12** MANDATORY deliberate-RED proof: transiently add a phantom `e2e/*` project (or drop a `-p` entry) -> guard goes RED with a LOCATED message -> restore.

### Claude's Discretion
- **D-08** Share the packed tarball across the new GE2E scenarios to avoid N redundant builds (pack once, install per-scenario or share one install with config-file restore). Acceptable fallback: per-file fresh build. LOW impact.
- **D-11** Enumeration source: glob `e2e/*/project.json` -> `.name` recommended (RESEARCH-VERIFY the authoritative-graph alternative). Robust `-p` extraction via the `release-hygiene` no-YAML-parser regex precedent.
- **D-13** Extend `tarball-audit` `REQUIRED_FILES` for the shipped generators (recommended hardening; BEYOND the 4 named requirements; planner MAY include or drop). Confirm the leak guards don't false-positive on new generator specs.
- **D-14** Fixture project name / component / spec identifiers and the specific injected diagnostic codes are the planner's choice, provided: two DISTINCT individually-assertable codes (one per leaf), a non-empty `references[]`, and an absent targetDefaults key.

### Deferred Ideas (OUT OF SCOPE)
- **FSTREE-01** bespoke real-disk `createFsTree`/`flushFsTreeChanges`.
- **GEN-FUT-01 / GEN-FUT-02** Angular CLI `angular.json` generator support / `ng add` (Angular CLI) install schematic. (Nx's `nx add` IS in scope -> GE2E-03.)
- **WALK-FUT-01** `createNodesV2` inferred granular per-leaf targets.
- **The 0.1.0 version cut / Release PR** -- the milestone Release PR AFTER Phase 15 closes, NOT part of this phase. (A `test(...)` commit is a no-bump conventional-commit type.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GE2E-01 | Install tarball -> `nx g angular-typechecker:configuration <proj>` on an un-wired project -> assert `project.json` target (executor `angular-typechecker:typecheck`) AND the `init`-seeded `nx.json` `targetDefaults["angular-typechecker:typecheck"]`. | Fixture shape (Finding 3), harness reuse (Finding 4), generator resolution verified against shipped `generator.ts` + `nx.json` WALK-02 block. |
| GE2E-02 | Same scenario runs `nx run <proj>:typecheck --skip-nx-cache`: clean -> success; errors injected into BOTH lib leaf AND spec leaf -> failure with both diagnostic codes visible. | Two-leaf verdict pattern verified against `matrix-5types` + `cache-busts-on-spec-edit`; distinct-code recommendation (Finding 3e). |
| GE2E-03 | Prove `nx add angular-typechecker` runs `init` and seeds `targetDefaults` on install (proves GEN-09). | `nx add` source traced (Finding 1): the deterministic offline stand-in `npm install <tarball>` + `nx g angular-typechecker:init` invokes the EXACT command `nx add` runs internally. |
| GUARD-01 | Guard test asserts the `e2e` job's `-p` list EQUALS the set of `e2e/*` graph projects (`every`, bidirectional); forgotten `-p` becomes a loud located failure. | Enumeration source resolved (Finding 2a: glob beats tag/graph), `-p` extraction (Finding 2b), in-plugin placement + path resolution (Finding 2c), assertion + deliberate-RED (Finding 2d). |
</phase_requirements>

## Summary

Phase 15 ships NO plugin/engine/generator source. It writes tests + one CI-config guard test that exercise the Phase 14 generator suite end-to-end against the freshly-packed tarball, plus a self-audit guard for the CI `e2e` job's project coverage. Every mechanism this phase depends on already exists in the codebase: the `install-e2e` pack/install harness (`install-smoke`, `tarball-audit`, `matrix-5types`, `cache-busts-on-spec-edit`), the `release-hygiene` root-file-read-from-a-spec pattern, the shipped `configuration`/`init` generators, and the WALK-02 `targetDefaults` block. This research closes the five RESEARCH-VERIFY items by tracing the installed Nx 23.0.1 source and the live fixtures so the planner writes tests without guessing.

The three decisive findings: (1) **`nx add angular-typechecker` runs `nx g angular-typechecker:init` verbatim** and needs ONLY the literal `init` generator key (no `ng-add` alias) -- but `nx add <bare-name>` always resolves `pkg@latest` from the registry, so the deterministic offline GE2E-03 proof is `npm install <tarball>` then `nx g angular-typechecker:init` (the exact internal command); (2) **the GUARD-01 enumeration MUST use the `e2e/*/project.json` glob, NOT the `scope:fixture` tag** -- three `libs/*` projects also carry `scope:fixture`, so a tag enumeration would over-count 6 vs the 3 e2e projects in the `-p` list; and (3) **there are TWO `-p` lines in `ci.yml`** (line 116 test job `-p angular-typechecker`, line 145 e2e job), so the extraction must be job-scoped -- but the folded (`>`) e2e run puts `-p` at physical-line-start, a robust discriminator the test-job `-p` (mid-line) never matches.

**Primary recommendation:** Clone the `matrix-5types.int.spec.ts` harness for GE2E-01/02/03 (pack once, install into a shared tmp copy, byte-restore `nx.json`/`project.json` between scenarios); write GUARD-01 as an in-plugin `*.spec.ts` that reads `.github/workflows/ci.yml` + globs `e2e/*/project.json`, asserts bidirectional `every` set equality, and carries a documented deliberate-RED recipe. Extend `tarball-audit` `REQUIRED_FILES` with the five shipped generator paths (D-13, low-cost hardening).

## Architectural Responsibility Map

For a testing + CI-config phase the "tiers" are test tiers, not app tiers. Each requirement is owned by exactly one tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GE2E-01/02 generate-then-run verdict | Heavy tarball e2e (`e2e/angular-typechecker-install-e2e`, Linux-only gate) | -- | Needs a real `npm pack` + `npm install` + nested `nx run`; worktree-hostile; already the tier that packs the tarball. |
| GE2E-03 `nx add`->`init` proof | Heavy tarball e2e (same project) | -- | Needs the installed package + a real `nx g ...:init` run against it. |
| GUARD-01 CI `-p` set equality | Cheap in-plugin static test (`packages/angular-typechecker/src/`, 6-cell matrix) | -- | Pure filesystem/text read; no build/pack/install; belongs in the loud/early 6-cell gate, not the Linux-only heavy gate (D-09). |
| D-13 tarball packaging audit for generators | Heavy tarball e2e (`tarball-audit.int.spec.ts`) | -- | Only a packed-tarball audit can prove the `files` allowlist + asset globs ship the generators. |

## Standard Stack

No new runtime or test packages are introduced by this phase. Everything is already installed and version-locked in the workspace.

### Core (all pre-existing)
| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| `vitest` | 4.1.9 | Test runner (via `@nx/vitest:test`) | `[VERIFIED: workspace package.json / TESTING.md]` |
| `@nx/vitest` | 23.0.1 | Nx Vitest executor | `[VERIFIED: workspace]` |
| `nx` | 23.0.1 | Workspace runtime; `nx g`, `nx run`, `nx add` under test | `[VERIFIED: node -e require('nx/package.json').version]` |
| node built-ins | Node 22/24/26 | `node:child_process` (execSync), `node:fs`, `node:os`, `node:path`, `node:url` | `[VERIFIED: existing specs import these]` |
| `publint` / `@arethetypeswrong/cli` (attw) | pre-existing devDeps | tarball-audit gates (D-13 extension reuses them) | `[VERIFIED: tarball-audit.int.spec.ts uses npx publint / npx attw]` |

**Installation:** none. Phase 15 adds test files only.

## Package Legitimacy Audit

**No external packages are installed by this phase.** All dependencies (vitest, @nx/vitest, node built-ins, publint, attw) are already present in the lockfile and were legitimacy-vetted in prior phases. The Package Legitimacy Gate is not applicable -- there is nothing new to slopcheck. `[VERIFIED: no `npm install` / new dependency in phase scope]`

---

## Finding 1 -- [D-06 / GE2E-03] The exact `nx add` install-time init contract (RESEARCH-VERIFY CLOSED)

Traced against `node_modules/nx/dist/src/command-line/add/add.js` and `.../init/configure-plugins.js` (Nx 23.0.1). `[VERIFIED: nx 23.0.1 source]`

### (a) Can `nx add <pkg>` target a LOCAL tarball / already-installed package offline?

**No, not in the natural `nx add angular-typechecker` form.** `add.js` `addHandler` -> `parsePackageSpecifier` splits the specifier on the LAST `@`; a bare name yields `['angular-typechecker', 'latest']`. `installPackage` then runs (when `package.json` exists):

```
${pmc.addDev} ${pkgName}@${version}      # i.e.  npm add --save-dev angular-typechecker@latest
```

So `nx add angular-typechecker` ALWAYS resolves `angular-typechecker@latest` from the configured registry -- it would install the REAL published version (currently 0.0.3, soon 0.1.0), NOT the freshly-packed tarball under test, and requires network. Nx's own e2e suite proves `nx add` faithfully only via a local Verdaccio registry -- which the board explicitly rejected (no second registry mechanism). `[VERIFIED: add.js lines 34-60, 108-119]`

*(A `nx add angular-typechecker@file:<abs-tarball>` form would parse to `version='file:...'` and run `npm add --save-dev angular-typechecker@file:...`. This MIGHT work, but is `[ASSUMED]` -- untested, more fragile, and adds no plugin-specific coverage over the stand-in below. Do NOT depend on it.)*

### (b) Is an `aliases: ["ng-add"]` on `init` required, or is the literal `init` key sufficient?

**The literal `init` key is sufficient; NO `ng-add` alias is needed.** The `nx add` code path is `add.js` `initializePlugin` -> `configure-plugins.js` `runPluginInitGenerator(plugin, ...)`, which constructs the command **verbatim**:

```js
let command = `g ${plugin}:init ${verbose ? '--verbose' : ''}`;   // -> `nx g angular-typechecker:init`
```

It then calls `getGeneratorInformation(plugin, 'init', workspaceRoot, {})`; if the `init` generator does not exist, that throws, the `catch` fires, and the function NO-OPS (logs "No 'init' generator found ... Skipping"). The `findInitGenerator` helper (which considers `ng-add`/aliases) is used by the DIFFERENT `nx init` flow, NOT by `nx add`'s `runPluginInitGenerator`. So `nx add`'s init discovery is a hardcoded `<plugin>:init`. This confirms Phase 14 D-06's registration (`@nx/eslint`'s `init` has no `ng-add` alias and still works with `nx add`). `[VERIFIED: configure-plugins.js lines 57-83, 158-168]`

### (c) Anything beyond the `generators` field for discovery?

**No.** `getGeneratorInformation` -> `readGeneratorsJson` reads the installed package's `package.json` `generators` field (`packageJson.generators ?? packageJson.schematics`), resolves `generators.json` relative to the package dir, and finds the `init` entry by name -> its `factory`. The shipped `packages/angular-typechecker/package.json` already has `"generators": "./generators.json"` and `generators.json` registers `init` with `factory: ./src/generators/init/generator`. Nothing else is required. `[VERIFIED: generator-utils.js lines 44-62 + shipped package.json/generators.json]`

### Deliverable -- the concrete, copy-pasteable GE2E-03 recipe

The **deterministic, offline, board-aligned** proof invokes the EXACT command `nx add` runs internally, against the freshly-packed tarball:

```ts
// nx-add-e2e.int.spec.ts (GE2E-03) -- reuse the install-smoke harness verbatim.
// 1. Fresh tmp copy of the consumer-generator fixture (nx.json has NO
//    targetDefaults["angular-typechecker:typecheck"] key -- D-02).
cpSync(fixtureDir, tmp, { recursive: true });
writeFileSync(join(tmp, '.npmrc'), '');

// 2. Place the package exactly as `nx add`'s installPackage step does after a
//    registry fetch (here from the local tarball -- deterministic + offline for
//    the package under test; fixture deps still resolve from the registry, like
//    every existing install-e2e spec).
execSync(`npm install ${JSON.stringify(tarballPath)}`, {
  cwd: tmp,
  env: { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') },
  encoding: 'utf8',
});

// 3. Run the SAME init generator `nx add`'s runPluginInitGenerator constructs
//    (`g <plugin>:init`). This resolves the installed package's generators.json
//    `init` entry -- the load-bearing half of GEN-09.
execSync('npx nx g angular-typechecker:init --skipFormat', { cwd: tmp, env, encoding: 'utf8' });

// 4. Assert init SEEDED the key (was absent -> now present, WALK-02 shape).
const nxJson = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8'));
const seeded = nxJson.targetDefaults['angular-typechecker:typecheck'];
expect(seeded).toBeDefined();
expect(seeded.cache).toBe(true);
expect(seeded.outputs).toEqual([]);
expect(seeded.inputs[0]).toBe('default');          // never 'production' (WALK-02 landmine)
```

**Why this is the right proof, not a shortcut:** GEN-09's plugin-specific behavior is "the registered `init` generator runs and seeds `targetDefaults`." The `nx add` install wrapper (`npm add --save-dev pkg@ver`) is generic package-manager plumbing, not plugin behavior, and cannot be exercised offline without a registry. The stand-in runs the byte-identical internal command (`nx g <plugin>:init`) resolved from the real installed tarball, so it proves discovery + seeding faithfully. Document this equivalence in the spec header so a reviewer sees it is deliberate, not a gap. `[VERIFIED]`

---

## Finding 2 -- [D-11 / GUARD-01] Enumeration source, `-p` extraction, placement, assertion

### (a) Enumeration source -- glob `e2e/*/project.json` -> `.name` (NOT the tag, NOT the graph)

**Use the glob. Reject the `scope:fixture` tag enumeration.** A concrete codebase scan found `scope:fixture` on SIX projects, only three of which are e2e:

```
libs/typecheck-walk-consumer      -> scope:fixture   (NOT e2e, NOT in the -p list)
libs/typecheck-consumer-dep       -> scope:fixture   (NOT e2e)
libs/typecheck-consumer           -> scope:fixture   (NOT e2e)
e2e/angular-typechecker-cache-e2e     -> scope:fixture
e2e/angular-typechecker-install-e2e   -> scope:fixture
e2e/angular-typechecker-matrix-e2e    -> scope:fixture
```

A tag-based set would be 6 projects vs the 3 in the `-p` list -> the guard would false-RED permanently. The glob `e2e/*/project.json` -> read `.name` yields exactly `{angular-typechecker-install-e2e, angular-typechecker-cache-e2e, angular-typechecker-matrix-e2e}`, and each project's `.name` === its directory name (verified). This is deterministic, daemon-free, cheap, and matches the strict `e2e/`-dir convention every e2e project follows. `[VERIFIED: scan of all project.json tags]`

**The authoritative-graph alternative (`nx show projects --json` / project-graph filtered by `root` prefix `e2e/`) is NOT recommended** here: it needs the daemon/graph load, and to be correct it would have to filter by `root` starting with `e2e/` -- which is exactly what the glob already encodes, only slower and daemon-dependent. Keep the guard a pure fs read. `[VERIFIED: reasoning + tag scan]`

```ts
import { globSync } from 'node:fs';           // Node 22+; or 'glob'/fast-glob if preferred
// From the guard spec, workspaceRoot resolved as in (c):
const e2eProjectNames = globSync('e2e/*/project.json', { cwd: workspaceRoot })
  .map((rel) => JSON.parse(readFileSync(join(workspaceRoot, rel), 'utf8')).name as string)
  .sort();
```

*(If `node:fs` `globSync` is not desired across the Node matrix, `readdirSync('e2e', { withFileTypes: true })` -> filter dirs -> read each `e2e/<dir>/project.json` `.name` is an equally deterministic, zero-dependency alternative. `[ASSUMED: globSync availability across Node 22/24/26]` -- prefer `readdirSync` to avoid the version question.)*

### (b) `-p` extraction from the folded (`>`) e2e run scalar -- job-scoped, no YAML parser

**There are TWO `-p` occurrences in `ci.yml`** (verified):
- Line 116 (`test` job): `- run: npx nx run-many -t typecheck-drift test -p angular-typechecker`  (mid-line `-p`)
- Line 145 (`e2e` job): `-p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`  (folded continuation; `-p` at physical-line-start)

A naive global `/-p\s+(\S+)/` would match BOTH and mis-read the guard. Two robustness levers, use both (belt-and-suspenders), reusing the `release-hygiene` no-YAML-parser precedent:

1. **Job-scope to the `e2e:` block.** Slice from the `  e2e:` job key to the next top-level job key. **GOTCHA (verified):** the job-key regex MUST allow digits -- the job is literally `e2e:` and `/^  [a-z-]+:$/` would NOT match `e2e:` (the `2`). Use `/^  [a-z0-9-]+:\s*$/`.
2. **Match the physical-line-start `-p`.** The folded scalar puts the e2e `-p` at line-start (after indent); the test-job `-p` is mid-line, so `/^\s*-p\s+\S/` uniquely selects line 145 even without scoping.

```ts
function extractE2ePListFromCi(ci: string): string[] {
  const lines = ci.split('\n');
  const start = lines.findIndex((l) => /^  e2e:\s*$/.test(l));
  if (start === -1) throw new Error('GUARD-01: could not locate the `e2e:` job in ci.yml');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [a-z0-9-]+:\s*$/.test(lines[i])) { end = i; break; }   // digits allowed -> matches `fallow:` etc.
  }
  const block = lines.slice(start, end);
  const pLine = block.find((l) => /^\s*-p\s+\S/.test(l));           // folded continuation, line-start `-p`
  if (!pLine) throw new Error('GUARD-01: no `-p` project list found in the `e2e:` job');
  return pLine.trim().replace(/^-p\s+/, '').split(/\s+/).sort();
}
```

A YAML parser is NOT warranted: the invariant is line-level, and adding a YAML dependency would contradict the `release-hygiene` precedent (`stripCommentLines` + regex, "cheaper than adding a YAML lib"). `[VERIFIED: rg over ci.yml + job-key digit gotcha]`

### (c) In-plugin placement + workspace-root resolution

Place the guard at `packages/angular-typechecker/src/<name>.spec.ts` (e.g. `ci-e2e-coverage-guard.spec.ts`). It is auto-included by the plugin's vitest glob `{src,tests}/**/*.{test,spec}.{...,ts,mts,...}` and runs in the 6-cell matrix. **It must be a plain `*.spec.ts`, NOT `*.int.spec.ts`** (that glob is the e2e project's), and it is excluded from the tarball by `tsconfig.lib.json`'s `src/**/*.spec.ts` exclude. `[VERIFIED: packages/angular-typechecker/vitest.config.mts + tsconfig.lib.json]`

**Path depth is identical to the e2e specs -- 3 dirs up.** `packages/angular-typechecker/src/<file>` -> `dirname` -> `..` = `packages/angular-typechecker` -> `../..` = `packages` -> `../../..` = workspace root:

```ts
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
```

**jsdom note (not a blocker):** the plugin config uses `environment: 'jsdom'` (vs the e2e project's `node`). jsdom only shims DOM globals; `node:fs`/`node:path`/`node:url`/`fileURLToPath(import.meta.url)` all work normally under Vitest+jsdom. The guard reads repo-root files with no issue. `[VERIFIED: vitest.config.mts environment: jsdom + node built-ins are always available under Vitest]`

### (d) The `every`-quantifier bidirectional set-equality assertion + deliberate-RED

```ts
const ci = readFileSync(join(workspaceRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
const pList = extractE2ePListFromCi(ci);                    // from (b)
const graphE2e = enumerateE2eProjects(workspaceRoot);       // from (a)

// Forgotten `-p` entry (the PRIMARY landmine: a real e2e project silently skipped).
for (const project of graphE2e) {
  expect(pList, `e2e/${project} is a graph e2e project but is MISSING from the ci.yml e2e job -p list`)
    .toContain(project);
}
// Stale/typo `-p` entry (a name in -p that is not a real e2e/* project).
for (const project of pList) {
  expect(graphE2e, `"${project}" is in the ci.yml e2e job -p list but is not an e2e/* project`)
    .toContain(project);
}
// Bidirectional exact equality (the `every` quantifier, both directions collapsed).
expect(pList).toEqual(graphE2e);   // both sorted -> exact set equality
```

The per-element loops with located messages satisfy the ROADMAP SC4 `every`-quantifier intent (each direction is a universally-quantified membership check) AND give the "loud, LOCATED failure" the requirement demands (the message names the offending project). The final `toEqual` on the sorted arrays is the compact set-equality backstop.

**Deliberate-RED recipe (D-12, MANDATORY -- same rigor as Phase 12's tripwire proof):** because a self-audit guard that silently false-PASSes defeats its purpose, the plan MUST include a transient RED proof, then restore. Two equivalent probes (pick one, document it in the SUMMARY):
1. Transiently add `e2e/phantom-e2e/project.json` (`{"name":"phantom-e2e"}`) -> run the guard -> confirm it RED-fails with `e2e/phantom-e2e is a graph e2e project but is MISSING from the ci.yml e2e job -p list` -> `rm` the phantom dir.
2. OR transiently drop one `-p` entry from `ci.yml` -> confirm the same located RED -> restore the line.

This is a manual/scripted verification during execution (not a committed test), mirroring `12-`'s tripwire deliberate-RED. `[VERIFIED: matches release-hygiene + Phase 12 precedent]`

---

## Finding 3 -- [D-01/D-02/D-14 / GE2E-01/02] The `consumer-generator` fixture shape

The existing `matrix-e2e` `local-lib` project is the near-exact template for the multi-leaf shape; `consumer-app` is the near-exact template for the installable flat-workspace packaging. Combine them. `[VERIFIED: read both fixtures]`

### Minimal file set (recommended: flat single-project-at-root workspace, mirroring `consumer-app`)

```
e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/
|-- package.json          # deps identical to consumer-app (see below)
|-- nx.json               # namedInputs (default/production/sharedGlobals); NO targetDefaults key (D-02)
|-- project.json          # name: consumer-generator; projectType: "library"; NO typecheck target (un-wired)
|-- tsconfig.json         # SOLUTION: files:[], include:[], references -> ./tsconfig.lib.json + ./tsconfig.spec.json
|-- tsconfig.lib.json     # include src/**/*.ts; exclude *.spec.ts; strictTemplates:true (copy local-lib)
|-- tsconfig.spec.json    # include src/**/*.spec.ts; strictTemplates:true (copy local-lib)
`-- src/
    |-- consumer-generator.component.ts        # standalone component WITH a template (lib leaf)
    `-- consumer-generator.component.spec.ts   # a *.spec.ts with inline-declared test globals (spec leaf)
```

Each part's load-bearing requirement:
- **(a) `npm install <tarball>` resolves:** `package.json` must carry the same dep set as `consumer-app`/`consumer-workspace` -- `@angular/common|compiler|core@22.0.4`, `rxjs@7.8.2`, `zone.js@0.16.0`, devDeps `@angular/compiler-cli@22.0.4`, `@nx/devkit@23.0.1`, `nx@23.0.1`, `typescript@6.0.3`. `private:true`. **NO lockfile** (a stray `pnpm-lock.yaml` makes Nx's lockfile plugin hard-fail an npm install -- the matrix spec deletes it for exactly this reason). `[VERIFIED: consumer-app/package.json + matrix spec pnpm-lock removal]`
- **(b) `nx g angular-typechecker:configuration <proj>` resolves the solution tsconfig (D-07 case 2):** the solution `tsconfig.json` must exist at the project root with a NON-EMPTY `references[]`. The shipped `resolveTsConfig` reads `joinPathFragments(projectConfig.root, 'tsconfig.json')` via the Tree and takes case (2) when `references.length > 0`. For a root-level project (`root` = `.`) this is `tsconfig.json` at the workspace root -- exactly the `consumer-app` layout. `[VERIFIED: configuration/generator.ts resolveTsConfig lines 78-87]`
- **(c) `init` seeds the WALK-02 block:** guaranteed by (a)+D-02 -- the fixture `nx.json` has no `angular-typechecker:typecheck` key, so the shipped `init`'s whole-entry `??=` writes the block. `[VERIFIED: init/generator.ts lines 62-64]`
- **(d) clean `nx run <proj>:typecheck --skip-nx-cache` exits 0:** the committed component + spec must be type-clean (copy the `local-lib` committed-clean pattern: a standalone component with a `<p>{{ label }}</p>` template + a spec with inline `declare function describe/it/expect` so it needs no test-runner package under `types:["node"]`). `[VERIFIED: local-lib.component.ts + .spec.ts]`
- **(e) distinct per-leaf diagnostic codes (D-14):** see below.

### (e) Recommended two DISTINCT injected codes (one per leaf)

To prove BOTH leaves were walked, the two injected errors MUST carry DIFFERENT code tokens -- if both were `TS2322`, a single `TS2322` in stdout would not distinguish "both leaves walked" from "one leaf walked twice." Recommended pair:

| Leaf | Injected source | Produces | Assertion |
|------|-----------------|----------|-----------|
| lib (component class body) | `readonly broken: number = ${JSON.stringify('str')};` | **TS2322** (Type 'string' not assignable to 'number') | `expect(bad.stdout).toContain('TS2322')` |
| spec (`*.spec.ts`, statement inside `it()`) | `declare function needsNumber(n: number): void; needsNumber(${JSON.stringify('str')});` (or the simplest distinct code you can pin) | **TS2345** (Argument of type 'string' not assignable to parameter of type 'number') | `expect(bad.stdout).toContain('TS2345')` |

Both build the injected string via `JSON.stringify` (ASCII-only, no quote/apostrophe hazard -- D-05). Assert BOTH tokens present + `bad.code !== 0` + NO `ERR_REQUIRE_ESM` + NO `infrastructure error`. The lib injection is a class FIELD (valid in a class body); the spec injection is a STATEMENT (valid inside the `it()` function body -- a `readonly` field would be a syntax error there, masking the intended code) -- exactly the matrix spec's `BROKEN_FIELD` vs `BROKEN_STATEMENT` distinction. `[VERIFIED: matrix-5types injected-line context rules]`

**Optional value-add (planner discretion, D-14):** the lib-leaf error could instead be a TEMPLATE type error (strictTemplates is on) to exercise angular-typechecker's template-type-check differentiator end-to-end. Trade-off: a class-body `TS2322` is more deterministic/pinnable than a template error's rendered code. Recommend the deterministic TS pair above; a template error is acceptable only if its code proves stable under Angular 22.0.4.

### Placement note (flat-at-root vs subfolder)

Flat-at-root (project root = workspace root, like `consumer-app`) is minimal and makes `resolveTsConfig` resolve `tsconfig.json` at the workspace root. A `projectType: "library"` at the workspace root is valid in Nx 23. The planner MAY instead nest under `libs/<name>/` (like `matrix-e2e`'s `local-lib`) if a root-level library feels awkward -- then the solution tsconfig lives at `libs/<name>/tsconfig.json` and `resolveTsConfig` picks it up via `projectConfig.root`. Either is D-01-compliant. `[VERIFIED: generator resolveTsConfig uses projectConfig.root]`

---

## Finding 4 -- [D-03/D-08 / harness contract] The reusable install-e2e harness

The `matrix-5types.int.spec.ts` harness is the closest template for GE2E (it already packs once, installs into ONE shared tmp workspace, and injects errors into BOTH a component and a spec). Reuse its exact shape. `[VERIFIED: read matrix-5types + install-smoke + tarball-audit + vitest.config.mts + project.json]`

Confirmed harness contract (copy verbatim, change only the operation):
- **`buildCleanEnv()`** strips `NX_RUNNER_ENV_KEYS` (`NX_SKIP_NX_CACHE`, `NX_TASK_HASH`, `NX_INVOCATION_ROOT_PID`, `NX_FORKED_TASK_EXECUTOR`, `NX_TASK_TARGET_PROJECT`, `NX_TASK_TARGET_TARGET`, `NX_CLI_SET`, `NX_TERMINAL_CAPTURE_STDERR`) + the peer-override keys (`npm_config_legacy_peer_deps`, `NPM_CONFIG_LEGACY_PEER_DEPS`), then sets `NX_DAEMON=false`, `FORCE_COLOR=0`.
- **`beforeAll`** (300000ms): `npx nx build angular-typechecker --skip-nx-cache` then `npm pack --json` from `dist/packages/angular-typechecker` -> `tarballPath`.
- **per-scenario tmp install:** `mkdtempSync(join(tmpdir(), 'atc-gen-'))` -> `cpSync(fixtureDir, tmp)` -> `writeFileSync(join(tmp,'.npmrc'),'')` -> `npm install <tarball>` with `env: { ...env, npm_config_userconfig: join(tmp,'.npmrc.nonexistent') }` (B-03 honesty: no leaked peer override) -> operate -> `rmSync(tmp,{recursive:true,force:true})` in `finally`.
- **`run()` verdict helper:** `execSync('npx nx run <proj>:typecheck --skip-nx-cache --output-style=static', {cwd, env, encoding:'utf8'})` inside try/catch; the catch captures the non-zero exit + `stdout+stderr`. NEVER pipe `nx` through `head`/`rg` (the pipe tail's exit code masks Nx's).
- **`afterAll`** removes the `.tgz`.

### `nx g` / `nx run` in the tmp workspace with the cleaned env
- Generate: `execSync('npx nx g angular-typechecker:configuration <proj> --skipFormat', {cwd: tmp, env, encoding:'utf8'})`. **Pass `--skipFormat`** so `formatFiles` (Prettier) is a no-op -- the fixture installs no Prettier, and the assertions read JSON via `JSON.parse` (formatting is irrelevant). This keeps the run deterministic and avoids Prettier-not-found noise. `[VERIFIED: configuration schema has skipFormat; formatFiles is skipped when schema.skipFormat]`
- **Do NOT pass `--output-style=static` to `nx g`** -- that is a `run`/`run-many` flag, not a generate flag (CONTEXT D-04's `--output-style=static` on the generate step is a copy-paste from the run helper; drop it for `nx g`). `--output-style=static` belongs on the `nx run <proj>:typecheck` invocation. `[ASSUMED: --output-style is run-scoped]` -- planner should confirm empirically; harmless either way if Nx ignores an unknown generate flag, but cleaner to omit.
- Run: `--skip-nx-cache` is MANDATORY on every `nx run` in GE2E-02 (the injected-error re-run must really execute; the coarse cache could otherwise replay a stale verdict). `[VERIFIED: matrix + cache-e2e both --skip-nx-cache]`

### D-08 -- share the pack (recommended)

Pack ONCE and install ONCE into a shared tmp workspace, then **byte-restore the mutated config files between scenarios** -- extending the matrix spec's `afterEach` source-restore discipline to the two files the generators touch: `nx.json` (seeded by `init`) and `project.json` (target written by `configuration`), plus any injected sources. This pays the single expensive `npm install` once across GE2E-01/02/03. **LOAD-BEARING:** GE2E-01 and GE2E-03 both assert `init` SEEDS the key from ABSENT -- so `nx.json` MUST be byte-restored to its un-seeded state before each such scenario; a missed restore makes the "seeded from absent" assertion vacuous (the same class of bug D-01/D-02 warn about). Acceptable fallback (D-08): per-scenario fresh `cpSync` + `npm install` for isolation parity with the existing specs (simpler, slower). `[VERIFIED: matrix afterEach restore pattern]`

---

## Finding 5 -- [D-13 discretionary] tarball-audit extension for the shipped generators

The shipped tarball MUST contain these package-relative paths (matching `npm pack --json` `files[].path`, no `package/` prefix). Derived from `packages/angular-typechecker/project.json` build `assets` + `package.json` `files` + `tsconfig.lib.json`. `[VERIFIED: all three files read]`

| Shipped path | How it ships |
|--------------|--------------|
| `generators.json` | root asset glob `{input: ./packages/angular-typechecker, glob: "generators.json", output: "."}` (added Phase 14) + `files` allowlist |
| `src/generators/configuration/generator.js` | compiled by `@nx/js:tsc` from `generator.ts` |
| `src/generators/configuration/schema.json` | `**/!(*.ts)` asset glob (copies non-.ts under src) |
| `src/generators/init/generator.js` | compiled |
| `src/generators/init/schema.json` | `**/!(*.ts)` asset glob |

Recommended `REQUIRED_FILES` additions (the three load-bearing runtime files `nx g`/`nx add` need at minimum): `generators.json`, `src/generators/configuration/generator.js`, `src/generators/configuration/schema.json`, `src/generators/init/generator.js`, `src/generators/init/schema.json`. (The `schema.d.ts` + `generator.d.ts` also ship via the `**/*.d.ts` glob but are not load-bearing for generator execution -- include only if the planner wants completeness.)

**Leak guards do NOT false-positive on the new generators:** `tsconfig.lib.json` excludes `src/**/*.spec.ts`, so `configuration.spec.ts` / `init.spec.ts` / `schema-parity.spec.ts` are NOT compiled into the tarball; the `**/!(*.ts)` asset glob excludes `.ts` files. The audit's guards -- `/\.spec\./`, `/tsconfig\.spec/`, `/(libs|fixtures|e2e)\//`, `/typecheck-consumer/` -- see no match on `src/generators/*/generator.js` or `schema.json`. `[VERIFIED: tsconfig.lib.json excludes + asset globs + tarball-audit leak-guard regexes]`

**CAVEAT (do not silently expand scope):** D-13 is NOT one of GE2E-01..03 / GUARD-01. The GE2E scenarios already EMPIRICALLY prove the generators ship (you cannot `nx g angular-typechecker:configuration` from a clean install if `generators.json` is unpacked). The audit extension is belt-and-suspenders (a fast static gate vs the heavy e2e's implicit proof). Planner MAY include it (low-cost, ~5 `toContain` lines) or drop it to stay minimal.

---

## Architecture Patterns

### System flow (GE2E generate-then-run)

```
beforeAll (once):
  nx build angular-typechecker --skip-nx-cache  ->  dist/packages/angular-typechecker
  npm pack --json  ->  angular-typechecker-<ver>.tgz  (tarballPath)
  [D-08] npm install <tarball> into ONE shared tmp copy of consumer-generator/

GE2E-01/02 scenario:
  (restore nx.json + project.json to committed/un-seeded state)
  nx g angular-typechecker:configuration consumer-generator --skipFormat
    -> configuration calls init  ->  nx.json targetDefaults[angular-typechecker:typecheck] seeded (WALK-02, default input)
    -> project.json gains ONE typecheck target (executor angular-typechecker:typecheck, options.tsConfig -> tsconfig.json)
  assert project.json target shape + nx.json seeded block
  nx run consumer-generator:typecheck --skip-nx-cache           -> exit 0 (clean)
  inject TS2322 (lib component field) + TS2345 (spec it()-body statement)
  nx run consumer-generator:typecheck --skip-nx-cache           -> exit != 0, stdout contains TS2322 AND TS2345,
                                                                    no ERR_REQUIRE_ESM, no "infrastructure error"

GE2E-03 scenario (nx-add proof):
  (restore nx.json to un-seeded state)
  nx g angular-typechecker:init --skipFormat        (== the command nx add's runPluginInitGenerator runs)
  assert nx.json targetDefaults[angular-typechecker:typecheck] seeded (WALK-02, inputs[0]==='default')

GUARD-01 (in-plugin, 6-cell matrix, no build/pack/install):
  read .github/workflows/ci.yml  -> extract e2e-job -p list (job-scoped, line-start -p)
  glob e2e/*/project.json -> .name  -> graph e2e set
  assert bidirectional every set-equality (located messages)
```

### Anti-patterns to avoid
- **Tag-based e2e enumeration (`scope:fixture`)** -- over-counts by 3 (the `libs/*` fixtures). Use the `e2e/*/project.json` glob.
- **Global `-p` regex over ci.yml** -- matches the `test` job's `-p angular-typechecker` too. Job-scope + line-start `-p`.
- **Reusing `consumer-app`** -- its `nx.json` pre-declares the key with `production` inputs -> `init`'s `??=` skips seeding (vacuous GE2E-01(b)) AND `production` under-hashes the spec leaf (potential stale-PASS masking GE2E-02).
- **Job-key regex `[a-z-]+`** -- misses `e2e:` (the digit). Use `[a-z0-9-]+`.
- **`nx run` without `--skip-nx-cache` in GE2E-02** -- a warm coarse cache could replay a stale verdict on the injected re-run.
- **Piping `nx` through `head`/`rg`** -- the pipe tail's exit code masks Nx's; use `execSync` + catch.
- **Leaving a lockfile in the fixture** -- a `pnpm-lock.yaml` hard-fails Nx's lockfile plugin under npm install.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pack/install a consumer + run the executor | A new registry/Verdaccio harness | The existing `install-smoke`/`matrix-5types` `buildCleanEnv` + pack + tmp-install pattern | Board-locked (no Verdaccio); the pattern is proven Windows-arm64-safe and handles nested-nx env isolation + peer honesty. |
| Read root files (ci.yml) from a spec | A YAML parser dependency | `release-hygiene`'s `readFileSync` + `stripCommentLines` + regex | Line-level invariants; a YAML lib contradicts the established no-parser precedent. |
| Prove `nx add` runs init | A real registry publish | `npm install <tarball>` + `nx g <plugin>:init` (the exact internal command) | `nx add <bare>` hits the registry (wrong artifact, needs network); the stand-in runs the byte-identical resolved command offline. |
| Enumerate e2e projects | An `nx show projects` graph load | `e2e/*/project.json` glob -> `.name` | Deterministic, daemon-free, matches the strict `e2e/` dir convention; the graph would need the same `root` filter, only slower. |

## Common Pitfalls

### Pitfall 1: The `scope:fixture` tag is not an e2e discriminator
**What goes wrong:** enumerating e2e projects by tag returns 6 (three `libs/*` + three `e2e/*`), so the guard false-REDs forever.
**How to avoid:** glob `e2e/*/project.json`. **Warning sign:** the guard fails immediately on first green-path run with `libs/typecheck-*` names in the diff.

### Pitfall 2: Two `-p` lines in ci.yml
**What goes wrong:** a global `-p` regex captures the `test` job's `-p angular-typechecker` and corrupts the expected set.
**How to avoid:** job-scope to `e2e:` (job-key regex with digits) + match line-start `-p` (the folded continuation). **Warning sign:** the guard's expected set contains `angular-typechecker` (the plugin, not an e2e project).

### Pitfall 3: A pre-seeded / `production`-input fixture makes GE2E-01 vacuous
**What goes wrong:** if the fixture `nx.json` already has the key, `init`'s `??=` skips seeding and the "init seeded it" assertion passes for the wrong reason; `production` inputs additionally under-hash the spec leaf.
**How to avoid:** D-02 -- the fixture `nx.json` must have NO `angular-typechecker:typecheck` key; assert `inputs[0] === 'default'`. **Warning sign:** the seeded block's first input is `production`.

### Pitfall 4: Both leaves injected with the same code
**What goes wrong:** if lib and spec both emit `TS2322`, seeing one `TS2322` doesn't prove BOTH leaves walked.
**How to avoid:** distinct codes (TS2322 lib / TS2345 spec); assert both tokens. **Warning sign:** the two-leaf claim rests on a single code token.

### Pitfall 5: Missed config restore under a shared install (D-08)
**What goes wrong:** GE2E-01 seeds `nx.json`; if not restored, GE2E-03's "seeded from absent" is vacuous.
**How to avoid:** byte-restore `nx.json` + `project.json` before each scenario that asserts seeding-from-absent (or use per-scenario fresh installs). **Warning sign:** GE2E-03 passes even when `init` is stubbed to no-op.

## Code Examples

### GUARD-01 core (in-plugin spec) -- verified pattern
```ts
// packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function enumerateE2eProjects(root: string): string[] {
  return readdirSync(join(root, 'e2e'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => JSON.parse(readFileSync(join(root, 'e2e', d.name, 'project.json'), 'utf8')).name as string)
    .sort();
}
function extractE2ePList(ci: string): string[] { /* Finding 2b */ }

describe('GUARD-01: the ci.yml e2e -p list equals the e2e/* project set', () => {
  const ci = readFileSync(join(workspaceRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const pList = extractE2ePList(ci);
  const graph = enumerateE2eProjects(workspaceRoot);

  it('covers every e2e/* project (no forgotten -p entry -> no silent skip)', () => {
    for (const p of graph) {
      expect(pList, `e2e/${p} is missing from the ci.yml e2e job -p list`).toContain(p);
    }
  });
  it('lists no stale/non-e2e project', () => {
    for (const p of pList) {
      expect(graph, `"${p}" in the -p list is not an e2e/* project`).toContain(p);
    }
  });
  it('is an exact set match', () => { expect(pList).toEqual(graph); });
});
```

## Runtime State Inventory

Not applicable -- Phase 15 is a testing + CI-config phase, not a rename/refactor/migration. It adds test files + fixture data and reads (never rewrites) `ci.yml`. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry a renamed identifier. **None -- verified: no rename/migration in scope.**

## Environment Availability

The heavy GE2E specs need the same toolchain the existing `install-e2e` specs already use (all present in CI's `npm ci` + the dev tree). The guard needs only node built-ins + Vitest.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | Yes | 22/24/26 (CI matrix) | -- |
| nx CLI (`npx nx`) | GE2E build/pack/generate/run | Yes | 23.0.1 | -- |
| npm (`npm pack`, `npm install`) | GE2E tarball flow | Yes | bundled | -- |
| network (registry) for fixture deps | GE2E `npm install <tarball>` resolving @angular/nx/typescript | Yes (CI e2e job) | -- | none -- same as every existing install-e2e spec |
| Vitest | all specs | Yes | 4.1.9 | -- |
| publint / attw | D-13 tarball-audit extension | Yes (devDeps) | pre-existing | -- |

**Missing dependencies with no fallback:** none.
**Note:** the GE2E specs are network-dependent for the fixture's Angular/Nx/TS deps (like all `install-e2e` specs) -- this is inherent and acceptable on the CI e2e gate; the PACKAGE UNDER TEST comes from the local tarball, not the registry.

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`). This section lets the orchestrator derive VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 via `@nx/vitest:test` |
| Config (e2e) | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (forks/singleFork/fileParallelism:false/node env/300000ms) |
| Config (guard) | `packages/angular-typechecker/vitest.config.mts` (jsdom, 30000ms) |
| Quick run (guard) | `npx nx test angular-typechecker` |
| Full e2e run | `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` |

### Phase Requirements -> Test Map
| Req ID | Observable signal that proves it | Test type | Automated command | File exists? |
|--------|----------------------------------|-----------|-------------------|--------------|
| GE2E-01 | After `nx g configuration`, tmp `project.json` has ONE `typecheck` target (executor `angular-typechecker:typecheck`, `options.tsConfig` -> `tsconfig.json`) AND tmp `nx.json` `targetDefaults["angular-typechecker:typecheck"]` seeded with WALK-02 block (`inputs[0]==='default'`, `cache:true`, `outputs:[]`) | e2e (tarball) | `npx nx test angular-typechecker-install-e2e` (`generator-e2e.int.spec.ts`) | Wave 0 |
| GE2E-02 | Clean `nx run <proj>:typecheck --skip-nx-cache` exit 0; after injecting TS2322 (lib) + TS2345 (spec), exit != 0 AND stdout contains BOTH tokens AND no `ERR_REQUIRE_ESM`/`infrastructure error` (two-leaf verdict pairing) | e2e (tarball) | same file | Wave 0 |
| GE2E-03 | After `npm install <tarball>` + `nx g angular-typechecker:init`, tmp `nx.json` carries the seeded `targetDefaults` (from absent) | e2e (tarball) | `nx-add-e2e.int.spec.ts` (or a `describe` in the GE2E file) | Wave 0 |
| GUARD-01 | `e2e`-job `-p` set (job-scoped extraction) === `e2e/*/project.json` `.name` set, bidirectional (`every`), with located failure messages; + deliberate-RED proof (phantom project or dropped `-p` -> located RED -> restore) | in-plugin unit (6-cell) | `npx nx test angular-typechecker` (`ci-e2e-coverage-guard.spec.ts`) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (guard + all plugin specs; fast).
- **Per wave / phase gate:** the full e2e run-many (the three e2e projects) on the merged main tree; plus the GUARD-01 deliberate-RED manual proof recorded once in the phase SUMMARY.
- **Phase gate:** full suite green before `/gsd:verify-work`.

### Wave 0 Gaps (files to create)
- [ ] `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` (fixture workspace -- Finding 3) -- covers GE2E-01/02/03
- [ ] `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts` -- GE2E-01 + GE2E-02
- [ ] `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts` (or fold into the above) -- GE2E-03
- [ ] `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` -- GUARD-01
- [ ] (optional, D-13) extend `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` `REQUIRED_FILES` with the five generator paths

*Framework install: none needed -- Vitest + @nx/vitest are already configured for both projects.*

## Security Domain

`security_enforcement` is absent from config -> treated as enabled. This phase adds test code and reads (never modifies) CI workflow config, so the attack surface is minimal. The relevant ASVS/threat considerations:

| ASVS Category | Applies | Standard control (as it manifests here) |
|---------------|---------|------------------------------------------|
| V5 Input Validation | no | No external/user input; specs use fixed target ids + flags only (no PR-metadata interpolation). |
| V6 Cryptography | no | None. |
| V14 Config / Supply chain | yes | The GE2E tarball flow keeps the `install-smoke` honesty controls (empty `.npmrc`, non-existent `npm_config_userconfig`, no peer-override) so a real consumer ERESOLVE is not masked. The D-13 audit re-asserts the `no-install-scripts` guard (a `postinstall` in the shipped tarball is the s1ngularity vector). |

| Threat pattern | STRIDE | Mitigation |
|----------------|--------|------------|
| Shell injection via `execSync` in specs | Tampering | Fixed target ids + fixed flags only; `JSON.stringify` for injected source lines; no untrusted string reaches the shell (verified pattern in all existing specs). |
| The guard silently false-PASSing (defeats its purpose) | Repudiation | Mandatory deliberate-RED proof (D-12). |
| The guard modifying `ci.yml` (privilege change) | Elevation | The guard is read-only (`readFileSync`); it asserts, never edits -- no `ci.yml` structural change (D-09). |

No new secrets, permissions, or workflow-permission changes are introduced. The single required `ci` gate stays byte-unchanged; the guard rides the existing 6-cell `test` job.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `nx add angular-typechecker@file:<tgz>` would install a local tarball | Finding 1a | LOW -- explicitly NOT recommended; the stand-in does not use it. If wrong, no impact (stand-in is the proof). |
| A2 | `--output-style` is a run/run-many flag, not a generate flag | Finding 4 | LOW -- planner should confirm; if Nx ignores an unknown generate flag it is harmless either way. Recommendation is to omit it on `nx g`. |
| A3 | `node:fs` `globSync` availability across Node 22/24/26 is uncertain | Finding 2a | LOW -- mitigated by recommending `readdirSync` instead (zero version question). |
| A4 | A template-type-check error's rendered code is stable enough to pin under Angular 22.0.4 | Finding 3e | LOW -- recommendation avoids this by using a class-body TS code; template error is only an optional value-add. |

All other claims in this research are `[VERIFIED]` against the installed Nx 23.0.1 source or the live codebase.

## Open Questions

1. **Should GE2E-03 also attempt the real `nx add angular-typechecker@file:<tgz>` as a second, best-effort assertion?**
   - What we know: `nx add` runs `nx g <plugin>:init` internally; the `@file:` specifier MIGHT install a local tarball.
   - What's unclear: reliability of `npm add --save-dev pkg@file:...` under the honesty env, and whether it adds coverage beyond the stand-in.
   - Recommendation: ship ONLY the deterministic stand-in (`npm install <tarball>` + `nx g ...:init`). Treat a real-`nx add` attempt as strictly optional and non-blocking; do not let its fragility gate GE2E-03.

2. **GE2E-01/02 and GE2E-03 in one file (shared install + config restore) or two files (fresh install each)?**
   - Recommendation: one file with a shared `beforeAll` install + between-scenario byte-restore of `nx.json`/`project.json` (D-08 preferred; cheaper Linux gate). Two files is the acceptable isolation-parity fallback. Planner's call; both satisfy the requirements.

## Sources

### Primary (HIGH confidence -- installed source / live codebase)
- `node_modules/nx/dist/src/command-line/add/add.js` -- `nx add` handler, `parsePackageSpecifier`, `installPackage` (`npm add --save-dev pkg@version`), `initializePlugin`.
- `node_modules/nx/dist/src/command-line/init/configure-plugins.js` -- `runPluginInitGenerator` (hardcodes `g <plugin>:init`), `findInitGenerator` (used by `nx init`, not `nx add`).
- `node_modules/nx/dist/src/command-line/generate/generator-utils.js` -- `getGeneratorInformation` / `readGeneratorsJson` (reads installed package `generators` field).
- `packages/angular-typechecker/src/generators/{configuration,init}/generator.ts` + `schema.json`; `generators.json`; `package.json`; `project.json` (build assets); `tsconfig.lib.json`; `nx.json` (WALK-02 block).
- `e2e/angular-typechecker-install-e2e/src/{install-smoke,tarball-audit,release-hygiene}.int.spec.ts`; `vitest.config.mts`; `project.json`; `fixtures/consumer-app/*`.
- `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts`; `fixtures/consumer-workspace/libs/local-lib/*`.
- `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-spec-edit.int.spec.ts`.
- `.github/workflows/ci.yml` (the two `-p` lines: 116 test, 145 e2e; folded `>` scalar; the `ci` aggregate).
- Codebase scan: `scope:fixture` tag present on 6 projects (3 `libs/*` + 3 `e2e/*`).

### Secondary (project decision records)
- `.planning/phases/15-.../15-CONTEXT.md`; `.planning/phases/14-.../14-CONTEXT.md`; `.planning/REQUIREMENTS.md`; `.planning/ROADMAP.md`; `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`; `.planning/codebase/TESTING.md`; `AGENTS.md`.

## Metadata

**Confidence breakdown:**
- `nx add` contract (Finding 1): HIGH -- traced the exact Nx 23.0.1 source path.
- GUARD-01 enumeration + extraction (Finding 2): HIGH -- verified the tag over-count and the two-`-p` gotcha directly in the repo.
- Fixture shape (Finding 3): HIGH -- `local-lib` + `consumer-app` are exact templates; generator resolution read from source.
- Harness contract (Finding 4): HIGH -- all four e2e specs + configs read.
- Tarball paths (Finding 5): HIGH -- derived from project.json assets + package.json files + tsconfig excludes.

**Research date:** 2026-07-02
**Valid until:** ~30 days (stable stack: Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, all pinned)

## RESEARCH COMPLETE

**Phase:** 15 - Generator e2e + CI self-audit guard
**Confidence:** HIGH

### Key findings
- `nx add angular-typechecker` runs `nx g angular-typechecker:init` verbatim and needs ONLY the literal `init` key (no `ng-add` alias) -- but `nx add <bare>` hits the registry, so GE2E-03's deterministic offline proof is `npm install <tarball>` + `nx g angular-typechecker:init` (the exact internal command).
- GUARD-01 MUST enumerate via the `e2e/*/project.json` glob, NOT the `scope:fixture` tag (three `libs/*` projects also carry it -> 6 vs 3).
- `ci.yml` has TWO `-p` lines (test job line 116, e2e job line 145); the extraction must be job-scoped (job-key regex needs digits for `e2e:`) + match the line-start `-p` of the folded scalar.
- The `matrix-5types` harness is the exact template (pack once, shared install, inject into both a component and a spec); use DISTINCT per-leaf codes (TS2322 lib / TS2345 spec) to prove both leaves walked.
- D-13: five shipped generator paths for the tarball-audit `REQUIRED_FILES`; leak guards don't false-positive.

### File created
`.planning/phases/15-generator-e2e-ci-self-audit-guard/15-RESEARCH.md`

### Ready for planning
All four RESEARCH-VERIFY items (D-06, D-11, D-01/D-02, D-13) are closed with copy-pasteable recipes and verified assertions. The planner can create PLAN.md files without further investigation.
