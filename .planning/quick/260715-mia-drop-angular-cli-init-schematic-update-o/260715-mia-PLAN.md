---
quick_id: 260715-mia
phase: quick/260715-mia
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
worktree: false # single-plan wave; run on the MAIN checkout (pure source/config/test + docs edit, no e2e/Verdaccio)
files_modified:
  - packages/angular-typechecker/collection.json
  - packages/angular-typechecker/src/schematics/init/schematic.ts # deleted via git rm (init-drop half)
  - packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts
  - packages/angular-typechecker/src/generators/ng-add/schema.json # git mv -> src/schematics/ng-add/schema.json
  - packages/angular-typechecker/src/generators/ng-add/schema.d.ts # git mv -> src/schematics/ng-add/schema.d.ts
  - packages/angular-typechecker/src/schematics/ng-add/schema.json # git mv destination
  - packages/angular-typechecker/src/schematics/ng-add/schema.d.ts # git mv destination
  - packages/angular-typechecker/src/schematics/ng-add/schematic.ts # import path + type rename
  - packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts # import path + type rename
  - .planning/v0.2.1-MILESTONE-AUDIT.md # docs-honesty edit (init half only); committed SEPARATELY by the orchestrator
requirements: [ACS-03, ACS-04, NGADD-01]
must_haves:
  truths:
    - "collection.json exposes exactly two Angular CLI schematics -- ng-add and configuration -- and no init"
    - "The init schematic source file is gone; ng generate angular-typechecker:init is no longer a resolvable Angular CLI surface"
    - "The Nx surface is UNCHANGED: generators.json still declares configuration + init, so nx add angular-typechecker -> <pkg>:init and nx g angular-typechecker:init still resolve via the init GENERATOR"
    - "ng-add has ZERO footprint under src/generators/ (dir gone); its schema lives beside its schematic under src/schematics/ng-add/"
    - "The type NgAddGeneratorSchema is renamed to NgAddSchema (a pre-24-06 vestige; ng-add is a schematic, not a generator)"
    - "ng add angular-typechecker still resolves its schema from dist at the new path (dist/.../src/schematics/ng-add/schema.json exists; dist/.../src/generators/ng-add/ does not)"
    - "The surface-regression spec asserts the init schematic is ABSENT from collection.json and stays green alongside its 6 unchanged siblings"
    - "nx build, test, lint, and format:check all pass on the main checkout"
    - "The milestone audit no longer presents ng generate :init (the Angular CLI SCHEMATIC) as a wired/verified seam; ACS-03's substantive guarantee (init generator fork seeds no stray nx.json) is preserved"
  artifacts:
    - path: "packages/angular-typechecker/collection.json"
      provides: "Angular CLI schematics surface = { ng-add, configuration } (init entry removed; ng-add schema pointer repointed to src/schematics/ng-add/)"
      contains: "\"configuration\""
    - path: "packages/angular-typechecker/src/schematics/ng-add/schema.json"
      provides: "Relocated ng-add schema ($id renamed to NgAddSchema), beside its schematic"
      contains: "NgAddSchema"
    - path: "packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts"
      provides: "Inverted init-absent assertion + 6 unchanged surface contracts"
      contains: "toBeUndefined"
    - path: "packages/angular-typechecker/generators.json"
      provides: "Nx surface UNCHANGED (configuration + init generators) -- explicit NON-GOAL, must stay byte-identical"
      contains: "\"init\""
  key_links:
    - from: "packages/angular-typechecker/collection.json"
      to: "packages/angular-typechecker/src/schematics/init/schematic.ts"
      via: "factory-path string (the only two references to the init schematic, both removed together)"
      pattern: "schematics/init/schematic"
    - from: "packages/angular-typechecker/collection.json"
      to: "packages/angular-typechecker/src/schematics/ng-add/schema.json"
      via: "ng-add `schema` pointer repointed from src/generators/ng-add to src/schematics/ng-add"
      pattern: "schematics/ng-add/schema.json"
    - from: "packages/angular-typechecker/generators.json"
      to: "packages/angular-typechecker/src/generators/init/generator.ts"
      via: "init GENERATOR factory (untouched -- the nx add / nx g :init path stays live)"
      pattern: "generators/init/generator"
---

<objective>
Complete the surface-symmetry cleanup so each install-time hook lives ONLY on its own ecosystem's
surface:

- `init` -> **Nx-only**. `init` is the Nx post-install hook (`nx add` -> `<pkg>:init`, plus explicit
  `nx g ...:init`). Drop its no-op Angular CLI counterpart (`ng generate angular-typechecker:init`)
  from `collection.json` + `src/schematics/`. (Task 1)
- `ng-add` -> **Angular-CLI-only**. `ng add` -> `<pkg>:ng-add` is the Angular CLI post-install hook.
  Its Nx-tree footprint is now just a MISPLACED schema under `src/generators/ng-add/` -- the ng-add
  GENERATOR itself was already removed in 24-06 (this task deletes NO generator). Relocate the schema
  beside its schematic and drop the misleading "Generator" from its type name. (Task 2)

`configuration` legitimately belongs on BOTH surfaces and is untouched. After this task:
`collection.json` = { ng-add, configuration }; `generators.json` = { init, configuration } (UNCHANGED);
`configuration` is the sole convertNx Angular-CLI schematic (`ng-add` is vanilla nx-free since 24-06).

Purpose: make the consumer-visible surface honest and symmetric -- each hook on exactly one surface,
no cross-ecosystem no-op parity artifacts, no vestigial "Generator" naming for a schematic.
Output: trimmed `collection.json`, deleted init schematic, relocated + renamed ng-add schema, inverted
surface-regression assertion, and a surgical docs-honesty edit to the milestone audit.

NON-GOALS (do NOT edit -- substantive safety guarantees / correct-as-is; must stay green):
- `src/generators/init/generator.ts` (the Nx init GENERATOR + its `tree.exists('angular.json') &&
  !tree.exists('nx.json')` early-return fork, the T-23-06 stray-nx.json mitigation, reached via
  `nx g ...:init`).
- `src/generators/init/*.spec.ts` + `src/generators/init/schema.json`/`schema.d.ts` (init GENERATOR).
- `generators.json` (the Nx surface -- byte-identical).
- `src/schematics/ng-add/schematic.ts` LOGIC (only its schema import path + the type name change).
- `README.md` (documents the Nx `nx g :init` / `nx add` surface + the `ng add`/`ng g :ng-add` behavior,
  all correct; no `ng generate angular-typechecker:init`, and the ng-add relocation is internal).
- `package-manifest.spec.ts` (asserts the `schematics` FIELD = './collection.json', unaffected).
- No new ng-add schema-parity spec (only configuration + init have one; do NOT add one -- YAGNI).
</objective>

<context>
@.planning/STATE.md
@packages/angular-typechecker/collection.json
@packages/angular-typechecker/generators.json
@packages/angular-typechecker/project.json
@packages/angular-typechecker/src/schematics/init/schematic.ts
@packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts
@packages/angular-typechecker/src/schematics/ng-add/schematic.ts
@packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts

<interfaces>
<!-- INIT DROP (Task 1). The init schematic (schematic.ts) is referenced in EXACTLY two places
     (verified `git grep schematics/init`); NO TypeScript import, NO index re-export: -->

collection.json "init" entry to REMOVE:
  "init": { "factory": "./src/schematics/init/schematic", "schema": "./src/generators/init/schema.json", "description": "..." }
Keep "ng-add" and "configuration" (but repoint ng-add's `schema` in Task 2).

nx-generators-surface-regression.spec.ts, assertion to INVERT in place (~L64-68):
  it('declares the additive init schematic in collection.json ...', () => {
    expect(collectionManifest.schematics?.init?.factory).toBe('./src/schematics/init/schematic');
  });
The 6 SIBLING `it(...)` blocks stay UNCHANGED (esp. the two locking the Nx surface).

<!-- NG-ADD RELOCATION (Task 2). All 6 NgAddGeneratorSchema references are inside ng-add's own
     files (verified `git grep NgAddGeneratorSchema` -- no other importer, no schema-parity spec): -->

Current (to move/rename):
  src/generators/ng-add/schema.d.ts:1   export interface NgAddGeneratorSchema { ... }
  src/generators/ng-add/schema.json:3   "$id": "NgAddGeneratorSchema"
  src/schematics/ng-add/schematic.ts:10 import type { NgAddGeneratorSchema } from '../../generators/ng-add/schema';
  src/schematics/ng-add/schematic.ts:36 export default function ngAdd(options: NgAddGeneratorSchema): Rule
  src/schematics/ng-add/ng-add.spec.ts:16 import type { NgAddGeneratorSchema } from '../../generators/ng-add/schema';
  src/schematics/ng-add/ng-add.spec.ts:95 async function run(options: NgAddGeneratorSchema = {}): Promise<void>

collection.json ng-add entry `schema` to repoint:
  "./src/generators/ng-add/schema.json" -> "./src/schematics/ng-add/schema.json"
  (the `factory` "./src/schematics/ng-add/schematic" is already correct; leave it.)

Build assets that ship the moved files (project.json, verified path-agnostic under ./src):
  { "input": "./packages/angular-typechecker/src", "glob": "**/!(*.ts)", "output": "./src" }  # schema.json
  { "input": "./packages/angular-typechecker/src", "glob": "**/*.d.ts",  "output": "./src" }  # schema.d.ts
So a move WITHIN src/ keeps both shipping at dist/.../src/schematics/ng-add/.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Drop the init schematic from the Angular CLI surface</name>
  <files>packages/angular-typechecker/collection.json, packages/angular-typechecker/src/schematics/init/schematic.ts, packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts</files>
  <action>
    Three coordinated edits (per ACS-04 surface-symmetry cleanup; ACS-03 clause (a) dropped, clause (b) intact):

    1. `collection.json`: remove the entire `"init"` schematics entry (the object at the `"init"` key,
       factory `./src/schematics/init/schematic`). Keep `"ng-add"` and `"configuration"` (Task 2 will
       repoint ng-add's `schema`). Result so far: `schematics` = { "ng-add", "configuration" }.

    2. `src/schematics/init/schematic.ts`: DELETE with `git rm packages/angular-typechecker/src/schematics/init/schematic.ts`
       (leaves an empty `src/schematics/init/` dir -- fine). Referenced ONLY by collection.json (edit 1)
       and the surface-regression spec (edit 3) -- no TS import, no index re-export (verified).

    3. `nx-generators-surface-regression.spec.ts`: INVERT the init-schematic assertion (~L64-68) in place --
       do NOT delete the `it(...)` block. Rename the `it(...)` title to explain that `init` is the Nx
       post-install hook (`nx add` -> `<pkg>:init`) whose Angular CLI counterpart is `ng-add`, so there is
       deliberately NO Angular CLI init schematic. Change the body to
       `expect(collectionManifest.schematics?.init).toBeUndefined();`. KEEP the other 6 tests unchanged --
       especially the two locking the UNCHANGED Nx surface (init GENERATOR present in generators.json;
       ng-add absent from generators.json).

    Do NOT touch any NON-GOAL file listed in the objective.
  </action>
  <verify>
    <automated>node -e "const c=require('./packages/angular-typechecker/collection.json');const g=require('./packages/angular-typechecker/generators.json');const ok=c.schematics.init===undefined && c.schematics['ng-add'] && c.schematics.configuration && g.generators.init && g.generators.configuration && !g.generators['ng-add'];process.exit(ok?0:1)"</automated>
    <automated>test ! -e packages/angular-typechecker/src/schematics/init/schematic.ts</automated>
  </verify>
  <done>
    collection.json `schematics` = { ng-add, configuration } (no init); init schematic.ts is git-removed
    (not tracked, not on disk); generators.json byte-unchanged; the surface-regression `it` now asserts
    `collectionManifest.schematics?.init` is undefined.
  </done>
</task>

<task type="auto">
  <name>Task 2: Relocate the ng-add schema out of the generators tree + de-"Generator" its type</name>
  <files>packages/angular-typechecker/src/generators/ng-add/schema.json, packages/angular-typechecker/src/generators/ng-add/schema.d.ts, packages/angular-typechecker/src/schematics/ng-add/schema.json, packages/angular-typechecker/src/schematics/ng-add/schema.d.ts, packages/angular-typechecker/collection.json, packages/angular-typechecker/src/schematics/ng-add/schematic.ts, packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts</files>
  <action>
    The ng-add GENERATOR was already removed in 24-06; what remains is its MISPLACED schema under
    `src/generators/ng-add/`. This task removes that residual footprint -- it deletes NO generator.

    1. Move the schema beside its schematic with `git mv` (stages source-delete + dest-add atomically):
       `git mv packages/angular-typechecker/src/generators/ng-add/schema.json packages/angular-typechecker/src/schematics/ng-add/schema.json`
       `git mv packages/angular-typechecker/src/generators/ng-add/schema.d.ts packages/angular-typechecker/src/schematics/ng-add/schema.d.ts`
       Then REMOVE the now-empty source dir -- `git mv` moves the files but does NOT rmdir the emptied
       parent, so the empty `src/generators/ng-add/` lingers on disk (git does not track empty dirs) and
       would fail the `test ! -e` gate below:
       `rmdir packages/angular-typechecker/src/generators/ng-add`
       (use `rmdir`, not `rm -rf` -- it errors if the dir is unexpectedly non-empty, surfacing a leftover).
       After this, `src/generators/ng-add/` is gone; ng-add has ZERO footprint under `src/generators/`.

    2. `collection.json`: update the ng-add entry `"schema"` from `"./src/generators/ng-add/schema.json"`
       to `"./src/schematics/ng-add/schema.json"`. Leave `"factory": "./src/schematics/ng-add/schematic"`.

    3. Update the two type imports from `'../../generators/ng-add/schema'` to `'./schema'`:
       - `src/schematics/ng-add/schematic.ts` (line ~10)
       - `src/schematics/ng-add/ng-add.spec.ts` (line ~16)

    4. RENAME the type `NgAddGeneratorSchema` -> `NgAddSchema` (ng-add is a schematic, not a generator; the
       name is a pre-24-06 vestige). All 6 references are contained within ng-add's own files (verified --
       no external importer, no schema-parity spec asserts it):
       - `src/schematics/ng-add/schema.d.ts` (the `export interface` name)
       - `src/schematics/ng-add/schema.json` (`"$id": "NgAddGeneratorSchema"` -> `"NgAddSchema"`)
       - `src/schematics/ng-add/schematic.ts` (the type import + the `options: NgAddSchema` param at `ngAdd`)
       - `src/schematics/ng-add/ng-add.spec.ts` (the type import + the `run(options: NgAddSchema = {})` helper)

    Consumer-visible surface is UNCHANGED: `ng add angular-typechecker` still resolves the same schema
    SHAPE from the new dist path; the type rename is internal.
  </action>
  <verify>
    <automated>test -f packages/angular-typechecker/src/schematics/ng-add/schema.json && test -f packages/angular-typechecker/src/schematics/ng-add/schema.d.ts && test ! -e packages/angular-typechecker/src/generators/ng-add</automated>
    <automated>node -e "const c=require('./packages/angular-typechecker/collection.json');process.exit(c.schematics['ng-add'].schema==='./src/schematics/ng-add/schema.json'?0:1)"</automated>
    <automated>test -z "$(git grep -l 'NgAddGeneratorSchema\|generators/ng-add/schema' -- packages/)"</automated>
  </verify>
  <done>
    `src/generators/ng-add/` no longer exists; `src/schematics/ng-add/` holds schema.json + schema.d.ts +
    schematic.ts + ng-add.spec.ts; collection.json ng-add `schema` points at
    `./src/schematics/ng-add/schema.json`; no file anywhere references `NgAddGeneratorSchema` or
    `generators/ng-add/schema` (all renamed to `NgAddSchema` / `./schema`); the ng-add unit spec stays green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Regression gates + surgical milestone-audit honesty edit</name>
  <files>.planning/v0.2.1-MILESTONE-AUDIT.md</files>
  <action>
    First run the four regression gates on the MAIN checkout (no worktree) -- they cover BOTH halves: build
    proves the trimmed collection.json + repointed ng-add schema pointer + removed init schematic all still
    build; test proves the surface-regression spec (inverted init assertion) + the ng-add unit spec + the
    init GENERATOR specs all stay green; lint + format:check catch drift.

    DIST-SHIP GATE (ng-add relocation): after `nx build`, assert the moved schema ships at its new dist path
    and the old path is gone:
      test -f dist/packages/angular-typechecker/src/schematics/ng-add/schema.json
      test -f dist/packages/angular-typechecker/src/schematics/ng-add/schema.d.ts
      test ! -e dist/packages/angular-typechecker/src/generators/ng-add

    Then the docs-honesty edit to `.planning/v0.2.1-MILESTONE-AUDIT.md` -- SURGICAL, minimal, INIT-HALF ONLY.
    (The ng-add relocation is internal -- schema file location + type name -- and changes NO audit statement:
    the audit references ng-add only by BEHAVIOR, never by the `generators/ng-add/schema` PATH; verified.
    So make NO ng-add edit to the audit.) Do NOT re-derive scores, do NOT restructure, do NOT re-audit.

    Correct ONLY the statements that present `ng generate angular-typechecker:init` (the Angular CLI
    SCHEMATIC) as a live/wired/verified seam (content anchors, not line numbers -- lines shift as you edit):
    - The "8th seam WIRED (former WARNING, RESOLVED 260715-jho)" note ("`ng generate :configuration` /
      `:init` flow still loads @nx/devkit via convertNxGenerator").
    - The Resolved Debt block "Phase 22/23 -- yarn-4 `ng generate :configuration` / `:init` load path" (names
      "the two schematics"; ends "(`init` shares the identical `convertNxGenerator` factory-load path, so the
      factory-load crash surface is settled for both)").
    - The ACS-03 status/evidence row: "...init CLI early-return fork + yarn-4 `ng generate` load path
      e2e-verified-safe (260715-jho)".
    - The tech_debt resolution note near the top: parenthetical "(and, by the identical `convertNxGenerator`
      factory-load mechanism, `init`)".

    Correction to encode: the Angular CLI `init` schematic was deliberately DROPPED for surface symmetry
    (quick 260715-mia). Consequences: `configuration` is now the ONLY convertNx Angular-CLI schematic
    (`ng-add` vanilla nx-free since 24-06); the init GENERATOR + its CLI early-return fork + the Nx
    `nx add` -> `<pkg>:init` / `nx g :init` path are UNCHANGED; ACS-03's substantive guarantee (init generator
    fork seeds no stray nx.json) still holds -- only the redundant `ng generate ...:init` schematic surface is
    removed. For the historical resolution records (the top tech_debt note and the Resolved-Debt block),
    prefer a short bracketed supersession pointer over rewriting the finding, e.g. "[Superseded 260715-mia:
    the Angular CLI init schematic was subsequently dropped for surface symmetry; only `configuration` remains
    convertNx]". Do NOT alter the `nx g :init` / `nx add -> <pkg>:init` (GENERATOR) references.
  </action>
  <verify>
    <automated>NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache</automated>
    <automated>test -f dist/packages/angular-typechecker/src/schematics/ng-add/schema.json && test -f dist/packages/angular-typechecker/src/schematics/ng-add/schema.d.ts && test ! -e dist/packages/angular-typechecker/src/generators/ng-add</automated>
    <automated>NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache</automated>
    <automated>npx nx lint angular-typechecker</automated>
    <automated>npx nx format:check</automated>
  </verify>
  <done>
    All four gates GREEN + the dist-ship gate passes: build succeeds against the trimmed collection.json +
    removed init schematic + repointed/relocated ng-add schema; the ng-add schema ships at
    dist/.../src/schematics/ng-add/ and NOT under src/generators/ng-add/; the unit test target passes
    (surface-regression init-absent assertion green; ng-add unit spec green; init GENERATOR specs green);
    lint clean at maxWarnings:0; format:check clean.
    The milestone audit no longer presents `ng generate :init` (the SCHEMATIC) as a wired/verified seam; the
    init GENERATOR / `nx add` / `nx g :init` statements and ACS-03's no-stray-nx.json guarantee are intact;
    no ng-add audit statement was changed (relocation is internal).
  </done>
</task>

</tasks>

<threat_model>
Both halves are surface CLEANUPS -- an Angular CLI schematic REMOVAL (init) and an internal file
RELOCATION + type RENAME (ng-add). No new inputs, no new trust boundary, no package installs -> no new
STRIDE threats.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-mia-01 | Tampering (surface regression) | collection.json / generators.json | mitigate | Task-1 node gate asserts collection.json = { ng-add, configuration } AND generators.json UNCHANGED; the 6 unchanged surface-regression `it`s lock the Nx surface. |
| T-mia-02 | Denial (init generator path breaks) | src/generators/init/generator.ts | accept | NON-GOAL file, untouched; the init GENERATOR + T-23-06 stray-nx.json fork stay live, specs green. Only a duplicate CLI schematic entry (pointing at the shared generator) is removed. |
| T-mia-03 | Denial (ng add can't resolve its schema after the move) | collection.json ng-add `schema` pointer + build assets | mitigate | Task-2 repoints the pointer; Task-3 dist-ship gate asserts the schema ships at the new dist path and the old path is gone. Path-agnostic `**/!(*.ts)` + `**/*.d.ts` globs (verified) keep both shipping. |
| T-mia-04 | Tampering (dangling type/import ref) | ng-add schematic.ts / ng-add.spec.ts | mitigate | Task-2 verify greps that NO file references `NgAddGeneratorSchema` or `generators/ng-add/schema`; `nx build`/`nx test` fail loud on any dangling import. |
| T-mia-SC | Tampering | npm/pip/cargo installs | n/a | No package installs in this task. |
</threat_model>

<verification>
- `NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache` -- builds against trimmed collection.json
  + repointed/relocated ng-add schema.
- Dist-ship gate: `dist/.../src/schematics/ng-add/schema.json` + `schema.d.ts` EXIST; `dist/.../src/generators/ng-add` does NOT.
- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` -- unit target GREEN (surface-regression init-absent + ng-add unit + init GENERATOR specs).
- `npx nx lint angular-typechecker` -- maxWarnings:0. `npx nx format:check` -- clean.
- No e2e tier needed: no e2e runs `ng generate angular-typechecker:init`, and the ng-add relocation keeps the
  consumer-facing `ng add` schema SHAPE + dist availability identical (verified).

Test-count note (flagged discrepancy): the blast radius specifies an in-place INVERT of the init `it`
(rename + flip assertion), which keeps 7 `it` blocks in the surface-regression spec, and the ng-add spec's
`it` count is unchanged by an import-path + type-name edit -> the unit count stays 373, NOT 372. The
constraints' summary "373 -> 372" assumed the init assertion would be deleted. Gate on GREEN + the specific
assertions/greps, not the exact integer.
</verification>

<success_criteria>
- collection.json exposes exactly { ng-add, configuration }; `ng generate angular-typechecker:init` is no
  longer resolvable; ng-add's `schema` points at `./src/schematics/ng-add/schema.json`.
- init schematic.ts is git-removed; `src/generators/ng-add/` is gone; ng-add schema + type live under
  `src/schematics/ng-add/`; `NgAddGeneratorSchema` renamed to `NgAddSchema` everywhere.
- generators.json (the Nx surface) is byte-unchanged.
- build / test / lint / format:check all GREEN on the main checkout; the ng-add schema ships at the new dist
  path and not the old one.
- milestone audit reflects the init-schematic drop without presenting `ng generate :init` as a live seam;
  ACS-03's no-stray-nx.json guarantee + all Nx-surface + all ng-add-behavior statements preserved.
- No version bump (stays 0.2.0), no release.
</success_criteria>

<commit_guidance>
Commits (AGENTS.md conventions; stage by name; `git mv`/`git rm` stage source+dest atomically; NEVER
`git add .`; no AI attribution). The code/config/test changes are release-meaningful (touch
packages/angular-typechecker) -- use `refactor(schematics)` scopes, NOT plan-id scopes. Either two commits
or fold the relocation into the same commit:

1. `refactor(schematics): drop redundant Angular CLI init schematic`
   Stage: `collection.json` (init entry removed), the surface-regression spec, and the `git rm`-staged
   deletion of `src/schematics/init/schematic.ts`.
2. `refactor(schematics): move ng-add schema out of the generators tree`
   Stage: the two `git mv`'d schema paths (old->new), `collection.json` (ng-add `schema` repoint -- if
   folded with commit 1, stage collection.json once), `src/schematics/ng-add/schematic.ts`,
   `src/schematics/ng-add/ng-add.spec.ts`.

The `.planning/v0.2.1-MILESTONE-AUDIT.md` docs edit is committed SEPARATELY by the orchestrator (do NOT
stage `.planning/` into a code commit; do NOT have the executor commit `.planning/`).
</commit_guidance>

<output>
Create `.planning/quick/260715-mia-drop-angular-cli-init-schematic-update-o/260715-mia-SUMMARY.md` when done.
</output>
