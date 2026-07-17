---
phase: 22-configuration-schematic-the-angular-json-write-fork
audited: 2026-07-10
asvs_level: 1
block_on: high
threats_total: 8
threats_closed: 8
threats_open: 0
status: SECURED
---

# Phase 22: Security Audit -- SECURED

Verifies that every declared threat mitigation in the two `<threat_model>`
blocks (22-01-PLAN.md, 22-02-PLAN.md) is present in the implemented code.
Documentation and intent are NOT accepted as evidence -- each `mitigate`
threat is tied to a concrete code location; the single `accept` threat is
recorded in the accepted-risks log below.

**Surface.** Config-edit-only on the developer's own workspace tree
(`angular.json` / `package.json` / `project.json` / manifest JSON). No network,
no runtime input, no secrets, no injection surface (paths flow from schema /
project config into `@nx/devkit` `updateJson`, never a shell). ASVS L1.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-22-01 | Tampering | mitigate | CLOSED | `project.architect ??= {}` guard at `generator.ts:258`; `readProjectConfiguration(tree, schema.project)` at `generator.ts:239` runs before `updateJson` and throws on an absent project; WR-01 fix present -- collision read (`project.architect?.[targetName]`, `:248`) and write (`project.architect[targetName]`, `:261`) both use `architect`, and `AngularJsonProject` (`:191-194`) declares only `architect` (no `targets` alias). |
| T-22-02 | Tampering | mitigate | CLOSED | Collision-by-builder-id throw at `generator.ts:250-256` (`existing.builder !== TYPECHECK_EXECUTOR_ID`); idempotent rewrite preserving user keys + options at `:261-265`. Tests: `configuration-angular-cli.spec.ts:171-190` (foreign target throws) and `:134-169` (re-run preserves `maxWarnings` + `configurations`). |
| T-22-03 | Repudiation (correctness) | mitigate | CLOSED | Approach A projectType convention (`tsconfig.app.json`/`tsconfig.lib.json`) at `generator.ts:160-163`; existence probe `.filter((leaf) => tree.exists(leaf))` at `:166`; no-empty-array located throw at `:168-173`; per-project scope via `projectConfig.root` at `:150`. COV-01 two-project no-bleed test at `configuration-angular-cli.spec.ts:95-122`. |
| T-22-05 | Input Validation (ASVS V5) | mitigate | CLOSED | Empty/whitespace `--targetName` reject at `generator.ts:226-231` (test `configuration-angular-cli.spec.ts:192-202`); relative `--tsConfig` existence-probe with located throw at `generator.ts:35-41`; all writes via `updateJson` (`:242`), no string concatenation into JSON. |
| T-22-04 | Tampering | mitigate | CLOSED | `"generators": "./generators.json"` still declared (`package.json:30`); `"schematics": "./collection.json"` added as an additive sibling (`:32`). `nx-generators-surface-regression.spec.ts:41-55` asserts `generators === './generators.json'`, `schematics === './collection.json'`, and the `configuration` generator factory stays resolvable -- proving `generators ?? schematics` keeps `collection.json` Nx-invisible. |
| T-22-06 | Repudiation (correctness) | mitigate | CLOSED | Build-asset glob `"glob": "collection.json", "output": "."` at `project.json:42-46`; `"collection.json"` in the `files` whitelist at `package.json:42`. 22-02-SUMMARY verification records `dist/packages/angular-typechecker/collection.json` present after `nx build`. |
| T-22-07 | Tampering (dependency surface) | mitigate | CLOSED | `schematic.ts` imports only `@nx/devkit` (`:1`, `convertNxGenerator`) + the local generator (`:3`); no third import. `@nx/devkit` is a pinned `dependency` (`package.json:47`). No new production dependency; `@nx/dependency-checks` via `nx lint` reported green (22-02-SUMMARY). |
| T-22-SC | Tampering (supply chain) | accept | CLOSED | Accepted risk -- see log below. Zero external packages installed this phase: `package.json` `dependencies` unchanged (`@nx/devkit` + `tslib`); both SUMMARYs report `tech-stack.added: []`. |

## Accepted Risks Log

### T-22-SC -- npm/pip/cargo installs (supply chain)

**Disposition:** accept. **Rationale:** Phase 22 installs no external packages.
The write-fork (`generator.ts`) imports only `@nx/devkit` + `node:path` + local
modules; the schematic (`schematic.ts`) imports only `@nx/devkit` + the local
generator. `@nx/devkit` was already a pinned `dependency` before this phase.
No new dependency was added to `package.json` (`dependencies` remains
`@nx/devkit` + `tslib`), so there is no new install-time legitimacy checkpoint
to enforce. Accepted at ASVS L1 for a config-edit-only, no-network surface.

## WR-01 Code-Review Fix -- Confirmed Present

22-REVIEW.md flagged WR-01 (write-fork read/write key asymmetry: `targets`
alias read but never written) and marked it resolved. Confirmed in the audited
code: the collision candidate is read from `project.architect` only
(`generator.ts:248`) and written to `project.architect` only (`:261`); the
`AngularJsonProject` interface carries no `targets` field (`:191-194`). Read and
write are symmetric on `architect`.

## Unregistered Flags

None. Neither 22-01-SUMMARY.md nor 22-02-SUMMARY.md contains a
`## Threat Flags` section; no new attack surface was declared during
implementation.

## Result

8/8 threats CLOSED (7 `mitigate` verified in code, 1 `accept` logged).
`threats_open: 0`. No BLOCKER above the `high` block-on threshold. Phase 22 is
SECURED.
