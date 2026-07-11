import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BuilderOutput } from '@angular-devkit/architect';
import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { json, schema } from '@angular-devkit/core';
import type { ExecutorContext } from '@nx/devkit';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import typecheckExecutor from '../../executors/typecheck/executor';
import builderDefault from './builder';

// ACV-03 gap-fill (Phase 24): the builder RUN over a real BuilderContext. The
// existing `builder.spec.ts` proves the STRUCTURE (thin `convertNxExecutor`
// re-export + the Architect brand + a `handler`) but NEVER RUNS the builder. This
// integration spec drives it end-to-end through `@angular-devkit/architect`'s
// `TestingArchitectHost` -- exactly how `ng run <project>:typecheck` reaches it --
// and asserts the two verdicts a consumer sees (success:true on a clean run,
// success:false on a planted-error run) PLUS parity with the Nx executor for the
// identical fixture + tsConfig array.
//
// The builder wraps the SAME `typecheckExecutor` (parity is structural because it
// IS that executor), but running it here proves the WRAPPER path works: the eager
// `retrieveProjectConfigurationsWithAngularProjects(workspaceRoot)` prelude
// `convertNxExecutor` runs before the executor, the CJS->ESM
// `await import('@angular/compiler-cli')` bridge survives inside a real
// `BuilderContext`, and `BuilderOutput.success` mirrors `{ success }`.
//
// Assumption A1 (24-RESEARCH) -- CONFIRMED WITH A CAVEAT: `TestingArchitectHost(
// fixtureRoot, fixtureRoot)` DOES scope the eager prelude to the fixture (which is
// why the fixture is a resolvable Angular CLI workspace root --
// `fixtures/builder-context/angular.json`, Pitfall F -- not a bare tsconfig tree),
// but ONLY once the ambient Nx daemon + isolated plugin workers are turned off for
// THIS process. In the dev repo the daemon + `NX_ISOLATE_PLUGINS` machinery is
// pinned to the REAL workspace root; when `convertNxExecutor`'s prelude calls
// `retrieveProjectConfigurationsWithAngularProjects(fixtureRoot)`, an isolated
// plugin worker (or the real-repo daemon) resolves package.json paths against the
// real repo while the main process expects the fixture root -> `readJsonFile`
// ENOENT -> `ProjectConfigurationsError: Failed to create project configurations`.
// Forcing the prelude in-process + daemonless re-roots the Rust workspace context
// cleanly to the fixture (which has no package.json, so the package-json plugin
// finds nothing) and the builder runs. This is set at module scope so the spec is
// green under `nx integration` (daemon on at the nx level) regardless of the
// invocation; the integration config's `forks` pool isolates this env change to
// this file's worker.
process.env['NX_DAEMON'] = 'false';
process.env['NX_ISOLATE_PLUGINS'] = 'false';

const BUILDER_NAME = 'angular-typechecker:typecheck';

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

// The resolvable Angular CLI workspace root the builder's eager prelude reads from
// disk. Its angular.json declares `builder-context-app` with the
// `angular-typechecker:typecheck` builder and the two-element tsConfig array.
const fixtureRoot = join(workspaceRoot, 'fixtures', 'builder-context');

// The planted-error leaves (absolute, so normalizeOptions passes them through
// unchanged): app.component.ts carries TS2322, app.component.spec.ts carries TS2345.
const appLeaf = join(fixtureRoot, 'tsconfig.app.json');
const specLeaf = join(fixtureRoot, 'tsconfig.spec.json');

// A known-CLEAN sibling leaf (classified GREEN in fixtures/tsconfig.clean.json) for
// the success:true case -- both builder-context leaves carry planted errors by
// design, so the clean run points at an existing clean fixture leaf.
const cleanLeaf = join(
  workspaceRoot,
  'fixtures',
  'clean-template-host',
  'tsconfig.app.json',
);

/**
 * Drive the Angular CLI builder over a real BuilderContext via the installed
 * `@angular-devkit/architect` testing harness and return its BuilderOutput. A fresh
 * host + architect per run keeps the runs independent; `workspaceRoot` is the
 * fixture so the wrapper's eager project-graph prelude scopes there.
 */
async function runBuilder(tsConfig: readonly string[]): Promise<BuilderOutput> {
  const registry = new schema.CoreSchemaRegistry();
  const host = new TestingArchitectHost(fixtureRoot, fixtureRoot);
  host.addBuilder(
    BUILDER_NAME,
    builderDefault as Parameters<TestingArchitectHost['addBuilder']>[1],
  );
  const architect = new Architect(host, registry);

  const options: json.JsonObject = { tsConfig: [...tsConfig] };
  const run = await architect.scheduleBuilder(BUILDER_NAME, options);

  try {
    return await run.result;
  } finally {
    await run.stop();
  }
}

/**
 * Run the SAME Nx executor the builder wraps, with `context.root` set to the same
 * fixture root `convertNxExecutor` would pass (only `context.root` is read, by
 * normalizeOptions). This is the parity oracle: the builder's { success } MUST equal
 * this for the identical fixture + tsConfig.
 */
async function runNxExecutor(
  tsConfig: readonly string[],
): Promise<{ success: boolean }> {
  const context = { root: fixtureRoot } as ExecutorContext;

  return typecheckExecutor({ tsConfig: [...tsConfig] }, context);
}

/**
 * Run the builder while capturing the raw `process.stdout.write` the executor
 * uses for its diagnostic report (executor.ts writes `formatDiagnostics` output to
 * RAW stdout; infra errors go to `logger.error`/stderr or re-throw). WR-01 fix
 * (Phase 24 code review): a bare `success === false` is VACUOUS on its own -- a
 * `TypecheckInfrastructureError` (e.g. the fixture tsconfig ceasing to resolve)
 * would ALSO yield `success:false` without the planted TS2322/TS2345 ever
 * surfacing. Asserting the specific codes appear in the report proves the
 * builder-context fixture actually loaded and the real type-errors drove the
 * verdict.
 */
async function runBuilderCapturingStdout(
  tsConfig: readonly string[],
): Promise<{ output: BuilderOutput; stdout: string }> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk));

    return true;
  }) as typeof process.stdout.write;

  try {
    const output = await runBuilder(tsConfig);

    return { output, stdout: chunks.join('') };
  } finally {
    process.stdout.write = originalWrite;
  }
}

describe('typecheck builder over a real BuilderContext (ACV-03 gap-fill)', () => {
  it('a CLEAN run yields BuilderOutput.success === true', async () => {
    const output = await runBuilder([cleanLeaf]);

    expect(output.success).toBe(true);
  });

  it('a PLANTED-error run (two-element tsConfig array) fails BECAUSE the planted TS2322 + TS2345 surfaced (not an infra error)', async () => {
    const { output, stdout } = await runBuilderCapturingStdout([
      appLeaf,
      specLeaf,
    ]);

    expect(output.success).toBe(false);
    // WR-01: prove the failure is DRIVEN by the planted diagnostics -- the app
    // build leaf's TS2322 and the app spec leaf's TS2345 both surfaced in the
    // report -- so `success:false` is not a masked infrastructure error and the
    // builder-context fixture genuinely resolved + type-checked.
    expect(stdout).toContain('TS2322');
    expect(stdout).toContain('TS2345');
  });

  it('the builder { success } equals the Nx executor { success } on the CLEAN leaf', async () => {
    const builderOutput = await runBuilder([cleanLeaf]);
    const executorResult = await runNxExecutor([cleanLeaf]);

    expect(builderOutput.success).toBe(executorResult.success);
    expect(builderOutput.success).toBe(true);
  });

  it('the builder { success } equals the Nx executor { success } on the planted-error tsConfig array', async () => {
    const { output: builderOutput, stdout } = await runBuilderCapturingStdout([
      appLeaf,
      specLeaf,
    ]);
    const executorResult = await runNxExecutor([appLeaf, specLeaf]);

    // Parity is the load-bearing claim: the builder IS the executor, so their
    // verdicts must be identical for the same fixture + tsConfig array.
    expect(builderOutput.success).toBe(executorResult.success);
    expect(builderOutput.success).toBe(false);
    // WR-01: and the shared failure is real (planted codes surfaced), not infra.
    expect(stdout).toContain('TS2322');
    expect(stdout).toContain('TS2345');
  });
});
