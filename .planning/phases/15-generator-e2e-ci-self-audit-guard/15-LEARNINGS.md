---
phase: 15
phase_name: "Generator e2e + CI self-audit guard"
project: "angular-typechecker"
generated: "2026-07-02"
counts:
  decisions: 6
  lessons: 4
  patterns: 5
  surprises: 3
missing_artifacts:
  - "15-UAT.md"
---

# Phase 15 Learnings: Generator e2e + CI self-audit guard

## Decisions

### Enumerate e2e projects by directory glob, not the `scope:fixture` tag
GUARD-01 enumerates the e2e project set via `readdirSync('e2e')` + each `project.json` `.name` (sorted), NOT by the `scope:fixture` tag.

**Rationale:** Three `libs/*` fixture projects also carry `scope:fixture`, so a tag-based set would be 6 vs the 3 real e2e projects and false-RED the guard forever. The `e2e/` directory convention is the actual discriminator.
**Source:** 15-01-SUMMARY.md, 15-RESEARCH.md (Finding 2a / Pitfall 1)

### Job-scoped + line-start regex extraction of the CI `-p` list (no YAML parser)
The guard slices `ci.yml` to the `e2e:` job block (job-key regex `/^  [a-z0-9-]+:\s*$/` — digits included so it matches `e2e:` itself) and pulls the line-start folded-scalar `-p`, reusing the `release-hygiene` no-YAML-parser precedent.

**Rationale:** `ci.yml` has TWO `-p` lines; a naive global `/-p\s+/` regex would capture the `test` job's mid-line `-p angular-typechecker`. Job-scope + line-start uniquely selects the e2e list; a line-level invariant does not warrant a YAML dependency.
**Source:** 15-01-SUMMARY.md, 15-RESEARCH.md (Finding 2b / Pitfall 2)

### GUARD-01 lives in-plugin as a plain `*.spec.ts` (not `.int.spec.ts`)
Placed under `packages/angular-typechecker/src/` so it auto-routes into the 6-cell `test` matrix, with no `ci.yml` structural change and no place in the heavy Linux-only e2e gate.

**Rationale:** The guard is a cheap read-only fs/text check; it belongs where it gives the loudest/earliest signal on every OS x Node cell. The `.int.spec.ts` glob is the e2e project's; a plain `*.spec.ts` is excluded from the shipped tarball by `tsconfig.lib.json`.
**Source:** 15-01-SUMMARY.md, 15-CONTEXT.md (D-09)

### The GE2E fixture omits the `targetDefaults` key so `init` seeds from ABSENT
`fixtures/consumer-generator/nx.json` ships `namedInputs` only, with NO `targetDefaults["angular-typechecker:typecheck"]`; the assertions target the init-SEEDED shape (`inputs[0]==='default'`), never a fixture block.

**Rationale:** Copying `consumer-app`'s block (which pre-declares the key with `production`-first inputs) would make `init`'s whole-entry `??=` skip seeding — making GE2E-01(b)/GE2E-03 vacuous — and `production` under-hashes the walked spec leaf (the WALK-02 landmine).
**Source:** 15-02-SUMMARY.md, 15-CONTEXT.md (D-02)

### GE2E-03 proves `nx add` via the deterministic offline internal command, not `nx add <bare>`
The nx-add proof is `npm install <tarball>` + `nx g angular-typechecker:init` — the byte-identical command `nx add`'s `runPluginInitGenerator` constructs internally.

**Rationale:** `nx add angular-typechecker` (bare) resolves `pkg@latest` from the registry (the wrong artifact, and needs network); the internal `nx g <plugin>:init` is the faithful, offline, board-aligned GEN-09 proof (no `ng-add` alias needed). Documented in the spec header.
**Source:** 15-02-SUMMARY.md, 15-RESEARCH.md (Finding 1)

### The lib-leaf error must live in a file no spec imports (code-review WR-01)
The lib-leaf TS2322 injection was moved from the spec-imported component into a new lib-only source `consumer-generator.util.ts` that nothing imports.

**Rationale:** Because the spec imports the component, the spec leaf's program transitively compiles it — so a TS2322 in the component would surface even if only the spec leaf were walked, failing to uniquely prove the lib leaf ran. A lib-only file (a `tsconfig.lib.json` rootName that no spec imports) makes TS2322 attributable solely to the lib leaf.
**Source:** 15-REVIEW.md (WR-01), fix commits 7cd8139 + 6aff6df

---

## Lessons

### "Injected error visible" is not the same as "this leaf was independently walked"
A two-leaf walk proof can pass vacuously if the injected error can reach the assertion via more than one compilation path. The lib error must be uniquely attributable to the lib leaf (a file no other leaf's program compiles).

**Context:** The initial GE2E-02 injected the lib TS2322 into the component, which the spec imports; the spec leaf transitively compiled the component, so both codes would appear even if the lib leaf were skipped. Caught by deep code review, not by the green suite.
**Source:** 15-REVIEW.md (WR-01)

### Windows tmp teardown after a nested nx run can stay locked past `execSync` return
A lingering nx subprocess holds the tmp-dir root (`\\?\C:\...`) open, so a recursive `rmSync` in `finally` can `EPERM` even though all assertions already passed; Node's `maxRetries`/`retryDelay` linear backoff did not outwait the persistent lock.

**Context:** `nx-add-e2e`'s teardown failed the whole (otherwise-green) scenario. Resolved with a best-effort `removeTmpWorkspace` helper that swallows the teardown error without touching assertions; the CI e2e gate is Linux-only where recursive `rmSync` never `EPERM`s.
**Source:** 15-02-SUMMARY.md (Deviations)

### A shared tag is not a reliable set discriminator
`scope:fixture` spans 6 projects (3 `libs/*` + 3 `e2e/*`); using it to enumerate "e2e projects" over-counts and would permanently false-RED the guard. The narrowest true invariant (the `e2e/` directory) is the correct source.

**Context:** Surfaced during GUARD-01 enumeration-source selection.
**Source:** 15-01-SUMMARY.md, 15-RESEARCH.md (Pitfall 1)

### CI-config guards must read at collection time to fail loud on structural drift
Reading `ci.yml` at `describe`-body level (not lazily inside an `it`) makes a refactor that removes the `e2e:` job or its `-p` line throw a clear located Error at collection — failing loudly rather than silently passing zero assertions.

**Context:** GUARD-01 design; a guard that silently passes on a shape change defeats its own purpose.
**Source:** 15-01-SUMMARY.md

---

## Patterns

### Deliberate-RED proof for any self-audit guard
A guard that codifies "current-correct" coverage MUST be proven to go RED on drift (transiently introduce the drift — e.g. a phantom `e2e/phantom-e2e/project.json` — confirm the LOCATED failure message, then fully restore), same rigor as the Phase 12 completeness tripwire.

**When to use:** Any test whose value is "fail when X drifts"; a green-only observation cannot distinguish a real guard from a vacuous one.
**Source:** 15-01-SUMMARY.md (patterns-established), 15-CONTEXT.md (D-12)

### Composite un-wired multi-leaf consumer fixture
Build a new install-e2e fixture as a composite: the multi-leaf shape from `matrix-e2e`'s `local-lib` (a solution `tsconfig.json` with a 2-entry `references[]` → lib + spec leaves, a template-bearing component, an inline-globals spec) + the installable packaging from `consumer-app` (flat `package.json`/`nx.json`), MINUS the `targetDefaults` key (so `init` seeds from absent) and MINUS any lockfile (a stray `pnpm-lock.yaml` hard-fails Nx's lockfile plugin under `npm install`).

**When to use:** Any tarball e2e that must prove a generator wires + an engine walks a real multi-leaf solution from a clean consumer install.
**Source:** 15-02-SUMMARY.md, 15-RESEARCH.md (Finding 3)

### Reuse the pack + tmp-install honesty harness verbatim
`generator-e2e`/`nx-add-e2e` clone the `matrix-5types`/`install-smoke` harness unchanged (`buildCleanEnv` NX_*+peer-override strip; `beforeAll` `nx build --skip-nx-cache` + `npm pack --json`; per-scenario `mkdtemp` + `cpSync` + empty `.npmrc` + non-existent `npm_config_userconfig` + `npm install <tarball>`; execSync-catch verdict helper); only the operation changes.

**When to use:** Every heavy tarball e2e in this repo — the harness already encodes nested-nx env isolation, peer-honesty, and Windows-arm64 safety.
**Source:** 15-02-SUMMARY.md

### Two DISTINCT per-leaf diagnostic codes prove BOTH leaves walked
Inject a different, individually-assertable code per leaf (TS2322 in a lib-only source; TS2345 via `('x').padStart('str')` in the spec `it()` body) and assert BOTH full tokens. A single shared code cannot distinguish "both leaves walked" from "one leaf walked twice."

**When to use:** Any test asserting that N independent compilation units were each exercised.
**Source:** 15-02-SUMMARY.md, 15-REVIEW.md

### Before-absent baseline makes a "seeded it" assertion non-vacuous
Before the seeding action, assert the target key is `undefined` (`toBeUndefined()`); only then does the post-action "it was seeded" assertion prove seeding-from-absent rather than passing on a pre-existing value.

**When to use:** Any test asserting an idempotent/`??=` writer created a key — pair the after-present check with a before-absent baseline.
**Source:** 15-REVIEW.md (WR-02), nx-add-e2e.int.spec.ts

---

## Surprises

### The Windows tmp-dir lock outlived `execSync`'s return
The nested `nx` subprocess kept the tmp-workspace root handle open after `execSync` returned, so even a retrying recursive `rmSync` `EPERM`ed. Impact: a fully-green scenario failed in teardown; fixed by making teardown best-effort (swallow) — assertions stay authoritative and the Linux CI gate is unaffected.

**Impact:** Required a teardown-hardening helper on both new heavy specs; established the "Windows tmp teardown must be best-effort" pattern for this repo.
**Source:** 15-02-SUMMARY.md

### No ERESOLVE under the honesty controls
With an empty `.npmrc` + non-existent `npm_config_userconfig` + no peer-override, the fixture's Angular 22.0.4 / Nx 23.0.1 / TS 6.0.3 deps resolved cleanly against the packed tarball — the published peer ranges are honest for a real consumer install (no masking needed).

**Impact:** Confirms the shipped peer ranges do not force consumers into `--legacy-peer-deps`; the dev-repo `.npmrc legacy-peer-deps=true` remains a dev-only concern.
**Source:** 15-02-SUMMARY.md

### `nx add <bare-name>` never installs the local tarball
Tracing the Nx 23.0.1 source showed `nx add` always resolves `pkg@latest` from the registry (via `npm add --save-dev pkg@latest`) — it cannot be pointed at a local `.tgz` in the natural form, so an offline tarball e2e must invoke the internal `nx g <plugin>:init` command directly.

**Impact:** Shaped GE2E-03's design (deterministic offline stand-in) and confirmed no `ng-add` alias is needed for `nx add` discovery.
**Source:** 15-RESEARCH.md (Finding 1), 15-02-SUMMARY.md
