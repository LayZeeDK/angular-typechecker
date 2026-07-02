---
phase: 14-configuration-init-generators-nx-add
plan: 03
subsystem: infra
tags: [nx-plugin, generators-json, nx-add, packaging, tarball, package-manifest, nx-plugin-checks]

# Dependency graph
requires:
  - phase: 14-configuration-init-generators-nx-add (plan 14-01)
    provides: the standalone init generator (factory ./src/generators/init/generator, schema ./src/generators/init/schema.json) registered by literal key so nx add resolves it (GEN-09)
  - phase: 14-configuration-init-generators-nx-add (plan 14-02)
    provides: the configuration generator (factory ./src/generators/configuration/generator, schema ./src/generators/configuration/schema.json) registered in the collection
provides:
  - root packages/angular-typechecker/generators.json (factory-keyed, mirroring executors.json) registering configuration + init, no ng-add alias
  - package.json generators field (./generators.json) + generators.json in the files allowlist
  - project.json build asset glob shipping generators.json to the dist package root
  - package-manifest.spec.ts assertions pinning the generators field + the generators.json files entry
  - the discovery mechanism for nx add angular-typechecker (resolves init by literal key via packageJson.generators) - GEN-09 mechanism (install-time e2e is Phase 15/GE2E-03)
affects: [15-generator-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root generators.json mirrors executors.json exactly, swapping implementation->factory and dropping outputCapture (D-02)"
    - "generators.json ships to the dist root via a dedicated build asset glob mirroring the executors.json entry; per-generator schema.json/schema.d.ts already ship via the existing **/!(*.ts) and **/*.d.ts globs (D-03)"
    - "nx add discovery needs only the package.json generators field + init registered by literal key; NO ng-add alias, no extra manifest key (D-06/Landmine 7)"

key-files:
  created:
    - packages/angular-typechecker/generators.json
  modified:
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/project.json
    - packages/angular-typechecker/src/package-manifest.spec.ts

key-decisions:
  - "Register init by its LITERAL key with NO ng-add alias (D-06): nx add angular-typechecker resolves init by key via packageJson.generators; an ng-add alias would imply the deferred Angular-CLI schematic surface (GEN-FUT-02)"
  - "generators.json uses factory (extensionless compiled path) not implementation, and omits outputCapture (D-02); top-level $schema/name/version:0.1 mirror the first-party @nx/vitest/@nx/eslint manifests"
  - "generators field added beside executors; generators.json added to the files allowlist between executors.json and README.md (D-03); no nx/schematics manifest key (the generators field alone suffices)"
  - "Only the root generators.json needs a new build asset glob; schema.json/schema.d.ts already ship via the existing **/!(*.ts) and **/*.d.ts globs - not duplicated"

requirements-completed: [GEN-05, GEN-09]

# Metrics
duration: 10min
completed: 2026-07-02
---

# Phase 14 Plan 03: generators.json registration + nx add packaging Summary

**Registers both generators in a new factory-keyed root `generators.json` (mirroring `executors.json`), declares the `package.json` `generators` field + `generators.json` in the tarball `files` allowlist, ships it to the dist root via a build asset glob, and pins both in `package-manifest.spec.ts` - the mechanism that makes `nx g` and `nx add angular-typechecker` discover the generators and the tarball ship them.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `packages/angular-typechecker/generators.json`: factory-keyed manifest mirroring `executors.json`, registering `configuration` (factory `./src/generators/configuration/generator`, schema `./src/generators/configuration/schema.json`) and `init` (factory `./src/generators/init/generator`, schema `./src/generators/init/schema.json`), each with a `description`. `init` is registered by its LITERAL key - NO `ng-add` alias (D-06/Landmine 7).
- Wired the published `package.json`: added `"generators": "./generators.json"` beside `"executors"`, and added `"generators.json"` to the `files` allowlist (now `["src", "executors.json", "generators.json", "README.md", "LICENSE"]`). No `nx`/`schematics` manifest key added - the `generators` field alone suffices for `nx add` discovery (14-RESEARCH.md).
- Added a `project.json` build asset glob (`{ input: ./packages/angular-typechecker, glob: "generators.json", output: "." }`) mirroring the `executors.json` entry, so `generators.json` ships to the dist package root. The per-generator `schema.json`/`schema.d.ts` files already ship via the existing `**/!(*.ts)` and `**/*.d.ts` globs - not duplicated (D-03).
- Extended `package-manifest.spec.ts`: added `generators?: string;` to the `PluginManifest` interface, extended the files-allowlist `.toEqual([...])` to include `'generators.json'` in file order, and added `it('registers the generators collection (D-02)', ...)` asserting `manifest.generators === './generators.json'`.
- `nx lint angular-typechecker` (`@nx/nx-plugin-checks`) is GREEN - the free proof that every `factory`/`schema` path in `generators.json` resolves and the schemas are well-formed (T-14-06 mitigation).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generators.json + wire package.json + project.json to ship it** - `281b293` (feat)
2. **Task 2: Extend package-manifest.spec.ts to pin the generators registration + files entry** - `3747403` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `packages/angular-typechecker/generators.json` (created) - factory-keyed root manifest registering `configuration` + `init`; `$schema`/`name`/`version:"0.1"` top-level; no `ng-add` alias, no `outputCapture`.
- `packages/angular-typechecker/package.json` (modified) - added `"generators": "./generators.json"` beside `executors`; added `"generators.json"` to `files`.
- `packages/angular-typechecker/project.json` (modified) - added the `generators.json` build asset glob mirroring `executors.json`.
- `packages/angular-typechecker/src/package-manifest.spec.ts` (modified) - `generators?: string` interface field; files-allowlist assertion extended; new `manifest.generators === './generators.json'` assertion.

## Decisions Made
None beyond the locked phase decisions (D-02, D-03, D-06). Followed the plan, 14-CONTEXT, 14-RESEARCH (Pattern 4 + the RESOLVED nx-add->init contract), and 14-PATTERNS exactly. `init` registered by literal key with no `ng-add` alias (RESEARCH: `@nx/eslint`'s `init` carries no alias and proves the alias is not required for `nx add`).

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were required (Rules 1-4 did not trigger); lint, build, and test all passed on the first run.

## Issues Encountered
None. The factory/schema paths in `generators.json` matched the compiled output of the Plan 14-01/14-02 generators, so `@nx/nx-plugin-checks` validated the collection on the first `nx lint` run.

## Threat Model Verification
- **T-14-06 (Tampering - unresolvable factory/schema):** MITIGATED. `nx lint angular-typechecker` (`@nx/nx-plugin-checks`, ERROR on `package.json`) is green, proving every `factory`/`schema` path in `generators.json` resolves.
- **T-14-07 (Tampering - files allowlist / build asset glob):** MITIGATED. Explicit `files` allowlist (never npm defaults) + a dedicated build asset glob ship `generators.json`; `package-manifest.spec.ts` pins both the field and the `files` entry. The tarball-audit `REQUIRED_FILES` update that proves the compiled `generator.js` files ship is Phase 15's job (GE2E) - NOT touched here.
- **T-14-SC (package installs):** ACCEPTED as scoped - no npm/pip/cargo install occurred; only manifest/config edits. No `postinstall`/lifecycle script added.

No new security-relevant surface introduced beyond the plan's threat model - packaging/registration edits only, no network/runtime/credential surface.

## Requirement Status
- **GEN-05: COMPLETE** - both generators registered via `generators.json` + the `package.json` `generators` field, included in the tarball `files`; the per-generator `schema.json`/`schema.d.ts` already ship via the existing asset globs. This closes the registration/packaging slice that Plans 14-01/14-02 left Pending.
- **GEN-09: COMPLETE (mechanism)** - `nx add angular-typechecker` resolves `init` by its literal key via `packageJson.generators -> generators.json`. Registration is the mechanism; the install-time e2e proof is Phase 15 (GE2E-03).
- **GEN-06 (unit tests): CUMULATIVELY SATISFIED (not marked here).** GEN-06 is not in this plan's frontmatter `requirements`. Its coverage is now complete across the phase (14-01 `init` specs, 14-02 `configuration` specs + this plan's manifest assertions), but per the plan contract it is left for the verifier / milestone audit to close - flagged here to avoid a false negative, NOT self-closed.

## Out-of-Scope Notes (for Phase 15)
- The e2e `tarball-audit` `REQUIRED_FILES` list must be extended to include `generators.json` and the compiled `src/generators/{configuration,init}/generator.js` + `schema.json` paths - this is Phase 15's job (14-RESEARCH.md), deliberately NOT touched here.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `generators.json` is registered, shipped by the build, and pinned by the manifest spec. `nx g angular-typechecker:configuration` / `nx g angular-typechecker:init` are discoverable, and `nx add angular-typechecker` will resolve `init` by key.
- Phase 15 consumes this shipped `generators.json` + the registered generators for the folded tarball e2e (GE2E-01/02), the `nx add` e2e (GE2E-03), and the `-p` set-equality guard (GUARD-01), and updates the tarball-audit expected-files list.

## Self-Check: PASSED

- `packages/angular-typechecker/generators.json` verified present on disk.
- Both task commits verified in git history (`281b293`, `3747403`).
- `nx lint angular-typechecker` green; `nx build angular-typechecker` green and emits `dist/packages/angular-typechecker/generators.json` + `src/generators/{configuration,init}/generator.js` + their `schema.json`; `nx test angular-typechecker` green (234 tests, 31 files).

---
*Phase: 14-configuration-init-generators-nx-add*
*Completed: 2026-07-02*
