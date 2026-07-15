# Phase 22: `configuration` schematic + the `angular.json` write-fork - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 22-configuration-schematic-the-angular-json-write-fork
**Mode:** `--analyze --auto --chain` (autonomous single pass; recommended options
auto-selected; `--analyze` trade-off tables below are the audit trail; no AskUserQuestion
prompts were issued). Trap-quadrant check applied per the `--auto` discuss rule: all
auto-locks are evidence-backed HIGH-confidence (source-verified in the v0.2.1 research),
so none fall in the HIGH-impact + NOT-HIGH-confidence trap quadrant; the one
NOT-HIGH-confidence item (leaf-set discovery) is a researcher question, recorded as a
research flag (RF-01), not auto-locked.
**Areas discussed:** Write-fork location, CLI target shape / tsConfig array, `angular.json`
write mechanism, `init` gating on CLI, idempotency+collision, additive-safety regression,
test substrate, leaf-set discovery (research flag).

---

## Write-fork location (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| A: one shared generator with `tree.exists('angular.json')` fork | Existing `configuration` generator gains an early workspace-type branch; `convertNxGenerator` re-exports it for free. DRY, one test surface. | check |
| B: separate Angular-CLI generator/schematic | Duplicates resolution + collision logic; two files to keep in sync; drift risk. | |

**Auto-selected:** A (recommended). **Rationale:** ARCHITECTURE.md marks Option A
RECOMMENDED and source-verifies the mechanics; the Nx path stays byte-unchanged. HIGH
confidence -> auto-locked (not trap quadrant).

## CLI target shape / tsConfig array (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| `tsConfig: [buildLeaf, specLeaf]` array (Option A) | Point one per-project `architect` target at the project's leaf array; consumed by the shipped ENG-01 union engine. | check |
| Emitted per-project solution tsconfig | Generator writes a new solution tsconfig file per project. | |
| Runtime workspace parsing in the builder | Builder resolves leaves at run time from angular.json. | |

**Auto-selected:** leaf array (LOCKED by SUMMARY.md CORRECTION point 2 + ROADMAP SC1 +
21-CONTEXT D-06). The other two are explicitly Out of Scope in REQUIREMENTS.md.

## `angular.json` write mechanism (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| `@nx/devkit` `readJson`/`updateJson` (direct edit) | Operates transparently on the adapter tree; ZERO new production dependency. | check |
| `@schematics/angular/utility` `updateWorkspace` | More idiomatic, but adds a dependency. | |
| `updateProjectConfiguration` | BROKEN off-Nx: throws on an app, mis-writes a lib's package.json nx block (nrwl/nx#19104). | |

**Auto-selected:** direct `updateJson` (charter: additive-only, zero new dep). HIGH
confidence.

## `init` gating on the CLI branch (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip `init` explicitly on CLI | No nx.json/targetDefaults/cache analog; cleaner, avoids redundant formatFiles. | check |
| Call `init` (relies on the no-op) | `updateNxJson` early-returns when no nx.json -- incidental no-op. | |

**Auto-selected:** skip explicitly (recommended). The Nx branch keeps init-first
unchanged. (The `init` SCHEMATIC parity + the "no caching" notice are Phase 23.)

## Idempotency + collision + targetName (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the shipped Nx generator semantics | Default targetName `typecheck`; reject empty name; collision-by-id (throw on non-ours); idempotent rewrite preserving user keys. | check |
| Re-invent CLI-specific semantics | New collision/idempotency rules for the CLI branch. | |

**Auto-selected:** mirror the shipped path (GEN-04/D-09). The builder id equals the
executor id (`angular-typechecker:typecheck`), so the check is uniform.

## Additive-safety / Nx-surface regression (D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| New `collection.json` + `schematics` field siblings + regression assertion | `generators ?? schematics` keeps collection.json Nx-invisible; assert `nx g` still resolves. | check |
| Edit `generators.json` / merge collections | Would risk the Nx surface. | |

**Auto-selected:** additive siblings + `generators ?? schematics` regression spec
(mirror Phase 21's `executors ?? builders`). Source-verified HIGH confidence.

## Test substrate (D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| `angular.json`-seeded schematics test tree (both substrates) | Nx tree (byte-unchanged) + angular.json tree (architect target written, no stray nx.json, idempotent, per-project scoped). | check |
| `createTreeWithEmptyWorkspace` only | Would not exercise the angular.json write-fork. | |

**Auto-selected:** seeded angular.json tree for the integration proof; the fresh
`ng g library` real-scaffold proof is Phase 24 (ACV-02).

---

## Claude's Discretion

- Plan decomposition (plan count; whether the write-fork, `collection.json`, and the
  regression assertion split across plans or land together).
- Whether the CLI leaf resolver is a new helper alongside `resolveTsConfig` or an added
  return-mode of it (Nx-branch output must stay byte-identical).

## Research Flag (NOT auto-locked -- RF-01)

- **Leaf-set discovery:** how the CLI branch computes `[buildLeaf, specLeaf]` for a
  project. Competing approaches -- (A) projectType-convention + existence-probe, (B) read
  the project's `architect.build`/`architect.test` `tsConfig`. Starting hypothesis
  (recommended, NOT locked): prefer (B), fall back to (A). HIGH-impact (COV-01 + Phase
  23/24 inherit) but reversible-within-milestone and test-gated, so it is deliberately
  left to the Phase-22 researcher to resolve against the ngx-leaflet clone + a scaffolded
  workspace, rather than auto-locked. Recorded so it is investigated, not silently
  settled.

## Deferred Ideas

None new -- discussion stayed within phase scope.
