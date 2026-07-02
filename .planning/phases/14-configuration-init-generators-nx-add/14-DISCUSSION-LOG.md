# Phase 14: configuration + init generators, nx add - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 14-configuration-init-generators-nx-add
**Mode:** `--analyze --auto --chain` (autonomous single pass; recommended option auto-selected per area; trade-off tables recorded below)
**Areas discussed:** Generator layout + registration, init targetDefaults seeding, nx-add wiring, tsConfig resolution, idempotency + collision, schema surface, testing substrate

---

## Generator source layout + registration (GA-1)

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the executor tier (`src/generators/<name>/`) + root `generators.json` (factory) + `package.json` `generators` field + asset glob | Reuses every existing build/asset/test convention; matches `@nx/vitest`/`@nx/eslint` | checkmark |
| Flat `src/generators/*.ts` without per-generator dirs | Fewer dirs, but breaks the co-located schema/spec convention | |
| Bundle generators into the executor build differently | Fights the multi-file `factory` layout Nx expects | |

**Selected:** Mirror the executor tier. **Impact:** MED. **Confidence:** HIGH (STRUCTURE.md "Where to Add New Code" + GEN-05 + first-party pattern). **Notes:** root `generators.json` needs its OWN asset glob + a `files` entry; `schema.json`/`schema.d.ts` already covered by existing globs. (D-01/D-02/D-03)

---

## init generator -- targetDefaults seeding (GA-2)

| Option | Description | Selected |
|--------|-------------|----------|
| Seed unscoped id with the VERBATIM WALK-02 block; whole-entry `??=` don't-clobber | Reproduces the shipped cacheable contract exactly; safe for customized workspaces | checkmark |
| Hand-retype a "minimal" cache block (`cache:true`, `outputs:[]`, coarse inputs) | Risks drifting from WALK-02 -> `production`/under-hash -> stale PASS landmine | |
| Deep-merge sub-keys into an existing entry | Could silently overwrite a user's customized inputs | |

**Selected:** Verbatim WALK-02 block, unscoped id, whole-entry `??=`. **Impact:** HIGH. **Confidence:** HIGH (nx.json is the authoritative source). **Notes:** `default` NOT `production` is load-bearing (spec-source hashing). Seed only the unscoped `angular-typechecker:typecheck` key, not the dev-repo scoped alias. (D-04/D-05)

---

## nx-add -> init wiring (GA-3) -- borderline

| Option | Description | Selected |
|--------|-------------|----------|
| Register `init` by name in `generators.json`; rely on nx-add's first-party contract; RESEARCH-VERIFY the exact discovery | Matches `@nx/vitest`/`@nx/eslint`; near-free once `init` exists | checkmark |
| Add an explicit Angular-CLI `ng add` schematic | Out of scope (GEN-FUT-02 deferred); wrong surface for `nx add` | |
| Skip nx-add; document a manual `nx g ...:init` step | Fails GEN-09 (cacheable-on-install is the value prop) | |

**Selected:** Register `init`; rely on nx-add; flag research-verify. **Impact:** HIGH. **Confidence:** MED-HIGH (proven by two first-party plugins; exact Nx 23 discovery mechanism + whether `aliases:["ng-add"]` is required is the residual, verifiable-in-source unknown). **Trap-quadrant check:** borderline; residual is a FACT not a user preference, so auto-locked with a mandatory researcher verify rather than escalated to the user. (D-06)

---

## configuration -- tsConfig resolution (GA-5)

| Option | Description | Selected |
|--------|-------------|----------|
| Ordered: `--tsConfig` > solution `tsconfig.json` w/ `references` > flat leaf by projectType (probe) > error | Leans on WALK-01; single simple target; graceful flat fallback | checkmark |
| Always require explicit `--tsConfig` | Poor DX; defeats the "one command" goal | |
| Per-project-type detection wiring N targets | Superseded by the walk (spikes 001-005); evaporates | |

**Selected:** Ordered resolution with flat fallback + clear error. **Impact:** MED-HIGH. **Confidence:** HIGH (GEN-02/03 lock it). **Notes:** Nx workspaces only; prod tsconfigs not walked; spec checking automatic via the walk (case 2) / consumer's responsibility in the flat fallback. (D-07)

---

## configuration -- target write, idempotency, collision (GA-4)

| Option | Description | Selected |
|--------|-------------|----------|
| Config-edit one target; idempotent when ours; throw located error when non-ours; configurable `targetName` | Safe re-runs; never clobbers foreign config; matches GEN-04 | checkmark |
| Always overwrite the same-named target | Clobbers a consumer's unrelated target -> data loss | |
| Skip silently if any same-named target exists | Hides genuine misconfiguration | |

**Selected:** Idempotent-for-ours, error-for-non-ours, config-edit only. **Impact:** MED. **Confidence:** HIGH (GEN-04). **Notes:** caching delegated to `init`, not inlined; `configuration` invokes `init` (GEN-08). (D-08/D-09/D-10)

---

## Schema surface (GA-6) -- Claude's discretion

| Option | Description | Selected |
|--------|-------------|----------|
| configuration: `project`+`tsConfig`+`targetName`+`skipFormat`; init: `skipFormat`/none; `additionalProperties:false` | Conventional Nx generator schema; parity-spec enforced | checkmark |
| Lenient `additionalProperties:true` | Weaker validation for a strict typed tool | |

**Selected:** Strict conventional schema pair per generator. **Impact:** LOW-MED. **Confidence:** HIGH. **Notes:** planner may rename/trim options; keep `schema.json` <-> `schema.d.ts` in parity. (D-11)

---

## Testing substrate (GA-7) -- carried forward (board-locked)

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory `createTreeWithEmptyWorkspace` + schema-parity per generator | Board D1 + GEN-06; zero-value FsTree avoided | checkmark |
| Bespoke real-disk `createFsTree`/`flushFsTreeChanges` | FSTREE-01 deferred; only for a file-emitting generator | |

**Selected:** In-memory substrate only this phase; real-disk fidelity via Phase 15 tarball e2e. **Impact:** LOW. **Confidence:** HIGH (board-ratified). (D-12)

---

## Claude's Discretion

- **D-11 (schema option surface):** recommended options listed; the planner may
  rename/trim, keeping the `schema.json`/`schema.d.ts` pair in parity.
- **D-05 (merge granularity):** whole-entry `??=` recommended; planner may
  refine to finer sub-key `??=` if research shows first-party `init`s do so.

## Deferred Ideas

None newly surfaced -- all deferrals (GE2E/GUARD -> Phase 15; FSTREE-01;
GEN-FUT-01/02; WALK-FUT-01) are already tracked in REQUIREMENTS.md and STATE.md.
