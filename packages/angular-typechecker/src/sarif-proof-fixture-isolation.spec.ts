import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// PROOF-01 (structural-isolation half). PROOF-01 itself requires the proof fixture
// to fire its one-known-diagnostic-per-family "from an ISOLATED fixture (outside
// the normal `nx typecheck` gate)" -- enforced by tools/sarif-proof-fixture/ having
// NO project.json (Nx only discovers a directory as a project when it has one), so
// the fixture's deliberate one-per-family errors (TS2322/NG8002/ATC90002) never
// reach `nx run-many -t typecheck`, the fallow new-only gate, or the real Code
// Scanning dogfood analyses.
//
// This was checked ONCE as a plan-execution-time shell command (35-01 Task 1's
// <verify>), but was never a standing regression test -- so a future edit that adds
// a project.json here (e.g. to debug the fixture locally with `nx graph`) would
// silently re-enter the fixture into the real merge gate with nothing in the fast
// `test` tier to catch it before a real CI run fails on the deliberate errors. This
// spec makes that a loud, located, PERMANENT tripwire. Cheap READ-ONLY fs reads, no
// nx invocation -- rides the fast `test` tier like the sibling guard specs
// (ci-e2e-coverage-guard.spec.ts, multi-typecheck-discovery-guard.spec.ts).

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const fixtureDir = join(workspaceRoot, 'tools', 'sarif-proof-fixture');

describe('sarif-proof-fixture stays structurally isolated from the Nx project graph (PROOF-01)', () => {
  it('has NO project.json (invisible to `nx show projects` / `nx run-many -t typecheck`)', () => {
    expect(
      existsSync(join(fixtureDir, 'project.json')),
      'PROOF-01: tools/sarif-proof-fixture/project.json must not exist -- its presence would pull the fixture’s deliberate one-per-family errors (TS2322/NG8002/ATC90002) into the real Nx project graph and fail the merge-gate `nx run-many -t typecheck`.',
    ).toBe(false);
  });

  it('has NO tsconfig.missing.json (its absence is what synthesizes the tool-family ATC90002 diagnostic)', () => {
    expect(
      existsSync(join(fixtureDir, 'tsconfig.missing.json')),
      'PROOF-01: tools/sarif-proof-fixture/tsconfig.missing.json must not exist -- tsconfig.json deliberately references this path, so its ABSENCE is what synthesizes ATC90002 (the tool-family diagnostic). Creating this file would delete the tool-family alert the proof depends on.',
    ).toBe(false);
  });

  it('is not swept into the tools tsc explicit allowlist (tsconfig.tools.json)', () => {
    const toolsConfig = JSON.parse(
      readFileSync(join(workspaceRoot, 'tsconfig.tools.json'), 'utf8'),
    ) as { include?: string[] };

    for (const entry of toolsConfig.include ?? []) {
      expect(
        entry.startsWith('tools/sarif-proof-fixture/'),
        `PROOF-01: tsconfig.tools.json must not include a tools/sarif-proof-fixture/* entry (found "${entry}") -- tsconfig.tools.json is an explicit allowlist, and sweeping the fixture's deliberately-broken .ts sources into it would fail the tools tsc.`,
      ).toBe(false);
    }
  });
});
