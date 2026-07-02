# Research: fallow CI gate failure on the v0.1.0 milestone PR (#15)

**Mode:** quick-task (--research). **Reproduced locally** with the exact CI command
`FALLOW_AUDIT_BASE=origin/main npx fallow audit --format human --base origin/main` (exit 1).

## Why it failed now (and not per-phase)

The CI `fallow` job gates `new-only` against `origin/main`. This is the FIRST time the
cumulative v0.1.0 diff (347 changed files, phases 12-15) is gated as a whole against main,
so ALL milestone-added test scaffolding counts as "new." The `.fallowrc.jsonc` was never
extended to cover the test scaffolding added in phases 12-15.

## Findings, categorized (all verified against files + the fallow JSON schema)

| Finding | Count | Sev | Category | Resolution |
|---|---|---|---|---|
| `unused-files` (e2e `*.int.spec.ts` + dev-lib `*.spec.ts`) | 11 | error (gates) | FALSE-POSITIVE: Vitest test-runner entry points, not import-graph reachable | override `unused-files: off` for `**/*.spec.ts` + `**/*.int.spec.ts` |
| `unlisted-dependencies` `@angular/core` | 1 | error (gates) | FALSE-POSITIVE: `@angular/core` IS declared (root package.json:52); imported only by fixtures/dev-libs; published pkg uses `@angular/compiler-cli` (dep hygiene owned by @nx/dependency-checks) | `ignoreDependencies: ["@angular/core"]` |
| `unrendered-components` (fixtures + dev-lib consumer components) | 22 | warn (non-gating) | FALSE-POSITIVE: test fixtures / dogfood dev-libs rendered nowhere by design | extend the existing fault-isolation override to `fixtures/**`, `e2e/**/fixtures/**`, `libs/**` |
| complexity / CRAP | 10 | (gates) | FALSE-POSITIVE: ALL are e2e `*.int.spec.ts` + one fixture template (heavy self-contained tarball tests). `walkReferences`/`runTypecheck` are only in the informational "Large functions" list, NOT the gating set | `health.ignore: ["e2e/**","fixtures/**","**/*.spec.ts","**/*.int.spec.ts"]` |
| duplication clone (112 lines) | 1 | (gates) | REAL but INTENTIONAL: `run-typecheck.ts` direct-leaf path vs `walk-references.ts` walk path share the byte-identical D-05 emit-neutralizing `performCompilation` options block (documented "verbatim") | scoped inline `// fallow-ignore-next-line code-duplication` on the walk-references instance + D-05 rationale (drops the 2-instance group below `minOccurrences`); NOT a refactor of shipped engine code |
| `unused-files` `extended-catalog.drift.ts` | 1 | error (gates) | FALSE-POSITIVE: Phase 12 DRIFT-01 tripwire reachable only via `tsconfig.drift.json` files, same class as the already-listed `compiler-cli-types.drift.ts` | add to `entry` |

## Guardrails honored

- No product-code gate weakened: `unused-files` stays `error` for non-spec product files;
  `unlisted-dependencies` stays `error` for the published package; `health` complexity stays
  gated for `packages/angular-typechecker/src/**/*.ts` (non-spec); duplication stays gated
  everywhere except the one reviewed, documented D-05 mirror.
- No shipped engine logic touched (walk-references.ts change is comment-only).
- All real fallow config keys (verified against `node_modules/fallow/schema.json`):
  `entry`, `ignoreDependencies`, `health.ignore`, `overrides[].rules`, inline
  `code-duplication` token (from `node_modules/fallow/skills/.../gotchas.md`).

## Verified resolution

After the config + inline suppression: `npx fallow audit --format human --base origin/main`
-> `✓ No issues in 347 changed files` (exit 0). `nx format:check`, `nx lint`, and
`nx test angular-typechecker` (239/239) all green.
