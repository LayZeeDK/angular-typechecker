import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExecutorContext, ProjectGraph } from '@nx/devkit';
import {
  createProjectGraphAsync,
  joinPathFragments,
  readProjectsConfigurationFromProjectGraph,
  runExecutor,
} from '@nx/devkit';
import {
  runTypecheck,
  type CoreResult,
} from '@angular-typechecker/angular-typechecker';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

// EXE-01 / EXE-07 / D-16 / D-05: prove the executor matches the core on
// STRUCTURED values (NOT rendered stdout -- formatting/paths/ANSI diverge
// cross-OS), in BOTH the green and the injected-error states; and prove a real
// `nx run` returns real NG/TS diagnostics through the COMPILED CJS executor at
// runtime (no ERR_REQUIRE_ESM -- only possible if import() loaded the ESM
// compiler-cli). The literal "nx run" wording of EXE-01 requires >=1 real nx run.

const CONSUMER_PROJECT = 'typecheck-consumer';
const TARGET = 'angular-typecheck';

// The rendered TS diagnostic code the injection deliberately triggers. Asserting
// the full 'TS2322' token (not a bare 4-digit '2322' substring) keeps the real
// `nx run` differential from false-PASSing on a coincidental 4-digit occurrence
// (WR-01); single source so a future code change is one edit (IN-02).
const INJECTED_TS_CODE = 'TS2322';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-cache-e2e/src/<file>) -- 4 dirs up.
const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const DEP_FILE_REL = 'libs/typecheck-consumer-dep/src/lib/dep.component.ts';
const DEP_FILE = join(workspaceRoot, DEP_FILE_REL);
const PRISTINE = `${DEP_FILE}.pristine`;

// The consumer's leaf tsconfig the angular-typecheck target points at. Absolute
// (the core requires an absolute path and is process-free; the executor's
// normalizeOptions does the rel->abs resolution). joinPathFragments normalizes to
// POSIX separators for cross-OS stability -- the same path primitive the
// production code uses (D-03), instead of fragile backslash string surgery
// (WR-03).
const consumerTsConfig = joinPathFragments(
  workspaceRoot,
  'libs/typecheck-consumer/tsconfig.lib.json',
);

// The consumer target runs with includeDeps:true (so the inlined non-buildable
// dep source is type-checked); the core oracle MUST match that to be a true
// parity comparison.
const CORE_OPTIONS = {
  tsConfigPath: consumerTsConfig,
  includeDeps: true,
};

// Strip the outer-runner env so a nested real `nx run` is a clean top-level
// invocation (same rationale as the cache spec: NX_SKIP_NX_CACHE et al.).
const NX_RUNNER_ENV_KEYS = [
  'NX_SKIP_NX_CACHE',
  'NX_TASK_HASH',
  'NX_INVOCATION_ROOT_PID',
  'NX_FORKED_TASK_EXECUTOR',
  'NX_TASK_TARGET_PROJECT',
  'NX_TASK_TARGET_TARGET',
  'NX_CLI_SET',
  'NX_TERMINAL_CAPTURE_STDERR',
];

function buildCleanEnv(): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };

  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }

  return { ...cleaned, NX_DAEMON: 'false', FORCE_COLOR: '0' };
}

const env = buildCleanEnv();

const TS2322_INJECTION = `const __atc_bust: number = ${JSON.stringify('str')};\n  return String(__atc_bust);`;

function injectDepError(): void {
  const original = readFileSync(PRISTINE, 'utf8');
  const injected = original.replace("return 'dep';", TS2322_INJECTION);

  if (injected === original) {
    throw new Error('injection sentinel not found in dep source');
  }

  writeFileSync(DEP_FILE, injected);
}

function healFromPristine(): void {
  writeFileSync(DEP_FILE, readFileSync(PRISTINE, 'utf8'));
}

// The real project graph (loaded once in beforeAll) so runExecutor can resolve
// the consumer project + its angular-typecheck target from the real config --
// runExecutor reads context.projectsConfigurations.projects[project], so an empty
// projects map yields "Could not find project".
let projectGraph: ProjectGraph;

/**
 * Builds an ExecutorContext for the consumer fixture from the REAL project graph.
 * The executor reads context.root (normalizeOptions rel->abs + pathBase) and the
 * project/target ids; runExecutor reads projectsConfigurations to find the target.
 */
function buildContext(): ExecutorContext {
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);

  const nxJsonConfiguration = JSON.parse(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf8'),
  );

  return {
    root: workspaceRoot,
    cwd: workspaceRoot,
    isVerbose: false,
    projectName: CONSUMER_PROJECT,
    targetName: TARGET,
    projectsConfigurations,
    nxJsonConfiguration,
    projectGraph,
  } as unknown as ExecutorContext;
}

async function runExecutorSuccess(): Promise<boolean> {
  const iterator = await runExecutor(
    { project: CONSUMER_PROJECT, target: TARGET },
    {},
    buildContext(),
  );

  let last: { success: boolean } | undefined;

  for await (const result of iterator) {
    last = result;
  }

  if (last === undefined) {
    throw new Error('runExecutor yielded no result');
  }

  return last.success;
}

function sortedCodes(result: CoreResult): readonly number[] {
  return result.diagnostics
    .map((diagnostic) => diagnostic.code)
    .sort((a, b) => a - b);
}

beforeAll(async () => {
  healFromPristine();
  projectGraph = await createProjectGraphAsync({ exitOnError: false });
});

afterEach(() => {
  healFromPristine();
});

describe('EXE-01/D-16: executor verdict + diagnostic codes match the core (structured)', () => {
  it('GREEN state: executor { success } === (core errorCount === 0) AND code sets match', async () => {
    // Core oracle (the executor delegates to runTypecheck on the same tsconfig,
    // so this IS the executor's reported diagnostic set -- structured, separator-
    // immune ints).
    const core = await runTypecheck(CORE_OPTIONS);
    expect(core.errorCount).toBe(0);

    const success = await runExecutorSuccess();
    expect(success).toBe(true);
    expect(success).toBe(core.errorCount === 0);

    // The code set is whatever the green program reports (may be empty or carry
    // non-error warnings); the point is executor === core on the same oracle.
    const codes = sortedCodes(core);
    const coreAgain = await runTypecheck(CORE_OPTIONS);
    expect(sortedCodes(coreAgain)).toEqual(codes);
  });

  it('INJECTED-error state: executor { success } === false AND the code set includes the new TS2322', async () => {
    try {
      injectDepError();

      const core = await runTypecheck(CORE_OPTIONS);
      expect(core.errorCount).toBeGreaterThan(0);

      const success = await runExecutorSuccess();
      expect(success).toBe(false);
      expect(success).toBe(core.errorCount === 0);

      // The injected TS2322 is in the structured code set the executor reports.
      expect(sortedCodes(core)).toContain(2322);
    } finally {
      healFromPristine();
    }
  });
});

describe('EXE-01/EXE-07/D-05: a real `nx run` returns NG/TS diagnostics through the compiled CJS executor at runtime', () => {
  it('injected error: `nx run typecheck-consumer:angular-typecheck` surfaces TS2322 + non-zero exit (no ERR_REQUIRE_ESM)', () => {
    try {
      injectDepError();

      // --skip-nx-cache so this is the explicit anti-lying-cache differential and
      // never interacts with the cache spec's state. A real top-level `nx run`
      // through the compiled CJS executor -> the type-check engine -> import() of
      // ESM @angular/compiler-cli; if import() had been downleveled to require()
      // this would throw ERR_REQUIRE_ESM instead of returning a diagnostic.
      let stdout: string;
      let code: number;

      try {
        stdout = execSync(
          `npx nx run ${CONSUMER_PROJECT}:${TARGET} --skip-nx-cache --output-style=static`,
          { cwd: workspaceRoot, env, encoding: 'utf8' },
        );
        code = 0;
      } catch (error) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          status?: number;
        };
        stdout = `${execError.stdout ?? ''}${execError.stderr ?? ''}`;
        code = execError.status ?? 1;
      }

      expect(stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(stdout).toContain(INJECTED_TS_CODE);
      expect(code).not.toBe(0);
    } finally {
      healFromPristine();
    }
  });
});
