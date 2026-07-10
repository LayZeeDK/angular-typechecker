# Phase 23: `init` schematic parity + first-party `ng-add` - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 23-init-schematic-parity-first-party-ng-add
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended options auto-selected; trade-off tables logged below; trap-quadrant check applied -- no user BLOCKER surfaced)
**Areas discussed:** ng-add authoring pattern, ng-add engine-composition, ng-add project selection, init CLI fork, no-caching notice, optional-peer classification, dependency-checks green strategy, charter reconciliation

---

## ng-add authoring pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Nx generator -> `convertNxGenerator(ngAddGenerator)` | Author `ng-add` as an Nx-devkit generator on the `@nx/devkit` Tree, re-export via `convertNxGenerator`; reuses shared generators + is the schematics Rule `ng add` needs | ✓ |
| Hand-written `@angular-devkit/schematics` Rule | Assemble from `@angular-devkit/schematics` primitives | |

**Auto-selected (recommended):** Nx generator -> `convertNxGenerator`.
**Notes:** Keeps `ng-add` on the same Tree abstraction, so it can call `configurationGenerator` directly and needs zero new production dependency. The hand-written Rule would add a dependency and could not reuse the Nx generator. Source: SUMMARY.md Architecture component 3.

## ng-add engine-composition

| Option | Description | Selected |
|--------|-------------|----------|
| Compose the shared `configuration` write-fork per project | Loop in-scope projects, call `configurationGenerator(tree, { project, skipFormat: true })`, format once | ✓ |
| Re-implement per-project target wiring inline | Duplicate the collision/idempotency/leaf-resolution logic in `ng-add` | |

**Auto-selected (recommended):** Compose the shared write-fork.
**Notes:** Inherits collision-by-builder-id, idempotent rewrite, and RF-01 leaf-array resolution for free; matches 22-CONTEXT ("Both compose the SAME write-fork"). Re-implementing risks drift.

## ng-add project selection

| Option | Description | Selected |
|--------|-------------|----------|
| Filter `projectType` in {application, library} | Enumerate `angular.json#projects`, wire only app + library, skip e2e/other | ✓ |
| Wire every project regardless of type | Would wire e2e-only / other project types with no meaningful leaves | |

**Auto-selected (recommended):** app + library only.
**Notes:** Matches NGADD-01. Idempotency delegated to the shared write-fork's collision-by-builder-id guard.

## init CLI fork (ACS-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Additive `tree.exists('angular.json')` early-return fork in the `init` generator | Explicitly skip the `nx.json` seed off-Nx (mirror the Phase-22 configuration fork) | ✓ |
| Plain `convertNxGenerator(initGenerator)` relying on the `updateNxJson` no-op | Depend on the incidental early-return when `nx.json` is absent | |

**Auto-selected (recommended):** explicit fork.
**Notes:** `updateNxJson` IS a verified no-op off-Nx, but the research corpus carries a documented CONTRADICTION on this point (FEATURES.md claimed it creates a stray `nx.json`); the safe design skips explicitly rather than relying on the incidental behavior, and lets `init` print the no-caching notice consistently. Source: PITFALLS.md Pitfall 3 + SUMMARY.md Gaps.

## no-caching notice

| Option | Description | Selected |
|--------|-------------|----------|
| One shared notice string, `logger.info`, printed once by `ng-add` (+optional in the `init` fork) | Single source of truth for wording | ✓ |
| Inline the string separately per call site | Risks wording drift | |

**Auto-selected (recommended):** shared string, printed once.
**Notes:** Exact end-user phrasing is planner discretion (no internal ids).

## optional-peer classification (ACP-01)

| Option | Description | Selected |
|--------|-------------|----------|
| `@angular-devkit/architect ^0.2200.0` + `rxjs ^7.8.0` as OPTIONAL peers | `peerDependenciesMeta.<dep>.optional: true`; accept `nx` transitively + document `.nx/` | ✓ |
| Declare as regular dependencies | Would force them onto pure-Nx consumers who never run the builder | |
| Declare nothing | `@nx/dependency-checks` blind to the `@nx/devkit`-internal runtime `require()`s; undocumented contract | |

**Auto-selected (recommended):** optional peers.
**Notes:** Always present in any Angular CLI workspace; never forced onto Nx-only consumers. `nx` is not declarable (flows in via `@nx/devkit`'s peer) -- accept + document. Source: STACK.md dependency-classification call.

## @nx/dependency-checks green strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the gate green; planner confirms rule config (likely `ignoredDependencies` / peer read) | Verify via the existing `nx lint` required check | ✓ |
| Baseline / disable the finding | Weakens the gate | |

**Auto-selected (recommended):** keep green, confirm config at plan time.

## charter reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Record that first-party `ng-add` does NOT violate the "no hand-written Rule" Out-of-Scope line | The exclusion targets engine adapters; `ng-add` composes the shared core via `convertNxGenerator` | ✓ |

**Auto-selected:** recorded as D-09.
**Notes:** Prevents the milestone audit / planner from reading NGADD-01 and the Out-of-Scope line as a contradiction.

---

## Claude's Discretion

- Plan decomposition (how many plans; how the `ng-add` + `init` fork/schematic + optional-peer work splits).
- Exact no-caching notice wording (end-user language).
- Whether `ng-add` accepts an optional `--project` scope (default + tested behavior is auto-wire-ALL).
- Whether the `ng-add` schema is a minimal hand-authored `schema.json` or reuses an existing shape (confirm Architect/schematics dialect needs, cf. Phase-21 Pitfall 7).

## Research Flags (deferred to gsd-phase-researcher, NOT auto-locked)

- **RF-01 (devDependency ensure/classification):** how `ng-add` guarantees the package lands in `devDependencies` given `ng add` installs to `dependencies` first. Starting hypothesis: `@nx/devkit` `addDependenciesToPackageJson` to devDeps (+ remove from deps); resolve the `GeneratorCallback`-under-`ng add` + re-install-timing sub-questions empirically.
- **RF-02 (`ng-add` on a tree without `angular.json`):** starting hypothesis: guard on `tree.exists('angular.json')` -- dependency-ensure + guidance only, no target wiring, no `nx.json` seed.

## Deferred Ideas

None new -- discussion stayed within phase scope. Tracked deferrals: WALK-FUT-01 (`createNodesV2` Nx auto-provisioning); Phase 24 (real-OSS + scaffolded e2e, additive-only audit, docs).
