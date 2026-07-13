import { execSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  run,
  sh,
} from '@workspace/test-util';

// TEST-03: the FULL project-type e2e matrix (D-07). The Phase-5 install-e2e smoke
// proved the packaged tarball resolves + runs for ONE project type (an
// application). This spec extends that proof to ALL FIVE committed project types
// against the INSTALLED tarball: application, local non-buildable library,
// buildable library, publishable library, and the spec-tsconfig sibling target.
//
// It reuses the install-smoke harness VERBATIM (buildCleanEnv, the pack-to-tmp
// beforeAll, the empty-.npmrc + non-existent npm_config_userconfig honesty
// pattern, the green + injected-TS2322 4-way assertion) and installs the tarball
// ONCE into one consumer-workspace tmp copy (D-07: one Angular+Nx install, not
// five -- the per-type logic is PM/OS-independent), then runs the executor green
// + injected-error per type via `it.each`. Runs SEQUENTIALLY on the main tree
// (D-22; real npm pack/install + nested nx run are worktree-hostile).

// The rendered TS diagnostic code the injection deliberately triggers. Asserting
// the full 'TS2322' token (not a bare 4-digit '2322' substring) keeps the check
// from false-PASSing on an unrelated 4-digit occurrence in a stack trace / hash /
// offset. Hoisted to one place so a future code change is a single edit (IN-02).
const INJECTED_TS_CODE = 'TS2322';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-matrix-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every path
// is cwd-independent (D-17 main tree), mirroring install-smoke.
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-matrix-e2e',
  'fixtures',
  'consumer-workspace',
);

// Nested-nx isolation + B-03 honesty: the shared buildCleanEnv strips the outer
// runner's NX_* vars and (default) the legacy-peer-deps override so a leaked
// override cannot MASK a real consumer ERESOLVE, and sets NX_DAEMON=false +
// FORCE_COLOR=0. The tmp workspace also gets its own empty .npmrc + a non-existent
// npm_config_userconfig below so no ancestor config reintroduces the override.
const env = buildCleanEnv();

// Absolute path to the freshly-packed tarball, captured in beforeAll.
let tarballPath = '';

// A per-spec OS-temp dir the tarball is packed INTO so dist stays read-only during
// e2e and no sibling e2e project shares the tarball path.
let packDest = '';

// The ONE per-run consumer-workspace tmp copy the tarball is installed into. The
// install is paid ONCE in beforeAll (D-07) and reused across all five it.each
// rows; afterAll discards it.
let consumerWorkspace = '';

// The shared run() wraps `npx nx run <target> --output-style=static
// --skip-nx-cache`: each green/injected invocation MUST really execute the
// executor. The cacheable typecheck target's `production` input EXCLUDES
// *.spec.ts (nx.json namedInput), so mutating the spec-row source does NOT bust
// the cache -- without --skip-nx-cache the injected spec run would be served the
// cached GREEN (exit 0) and the injected assertion would false-PASS.
// Cache-correctness is the separate cache-e2e project's concern; here we want a
// real run every time.

beforeAll(() => {
  // dist is built ONCE upstream by the `e2e` target's dependsOn (nx.json
  // targetDefaults) and is read-only during e2e -- no per-spec rebuild.
  //
  // Pack into a per-spec OS-temp dir so no sibling e2e project shares the tarball
  // path. `npm pack --json --pack-destination <dir>` writes the .tgz into <dir> (the
  // EXACT artifact `nx release publish` ships) and reports the bare filename; cwd
  // stays distDir so pack reads the dist package.
  packDest = mkdtempSync(join(tmpdir(), 'atc-pack-matrix-'));
  const packOutput = execSync(
    `npm pack --json --pack-destination "${packDest}"`,
    {
      cwd: distDir,
      env,
      encoding: 'utf8',
    },
  );
  const packed = JSON.parse(packOutput) as Array<{ filename: string }>;
  tarballPath = join(packDest, packed[0].filename);

  // Install the tarball ONCE into ONE tmp consumer-workspace (D-07). Copy the
  // committed multi-project fixture into the OS temp dir; do NOT copy this repo's
  // .npmrc (it sets the peer override -- D-20 honesty). The empty .npmrc below
  // makes the no-inherited-override guarantee airtight.
  consumerWorkspace = mkdtempSync(join(tmpdir(), 'atc-matrix-'));
  cpSync(fixtureDir, consumerWorkspace, { recursive: true });

  // Remove the committed pnpm-lock.yaml from the NPM-install copy. The lockfile
  // is for the pnpm spec ONLY; left in an npm-installed workspace, Nx's
  // js/dependencies-and-lockfile plugin tries to parse it and HARD-FAILS the
  // project graph ("Could not find .modules.yaml" -- there is no `.pnpm/` store
  // under an npm install), which makes every `nx run` exit non-zero before the
  // executor even starts. Deleting it keeps this consumer a pure npm hoisted
  // layout (the pnpm symlinked layout is the separate pnpm-symlink spec).
  rmSync(join(consumerWorkspace, 'pnpm-lock.yaml'), { force: true });

  // An explicit EMPTY project .npmrc guarantees no inherited peer override (B-03):
  // a clean install must honestly succeed or surface a REAL ERESOLVE.
  writeFileSync(join(consumerWorkspace, '.npmrc'), '');

  // Install the freshly-packed tarball with NO peer-resolution override flag. If
  // this ERESOLVEs on the published peer ranges (D-06), that is a REAL FINDING --
  // let the test FAIL surfacing it; do NOT auto-add the override (the remediation
  // is escalated per B-03). npm_config_userconfig -> a path that does not exist so
  // the user ~/.npmrc cannot reintroduce an override.
  sh(`npm install ${JSON.stringify(tarballPath)}`, {
    cwd: consumerWorkspace,
    env: {
      ...env,
      npm_config_userconfig: join(consumerWorkspace, '.npmrc.nonexistent'),
    },
  });

  // Sanity: the installed package's executor entry is resolvable from the tmp
  // consumer's node_modules -- proves the executor resolves FROM the install, not
  // from a dev path-alias (D-18). The cheap require()-the-package check.
  const installedExecutorsManifest = join(
    consumerWorkspace,
    'node_modules',
    'angular-typechecker',
    'executors.json',
  );
  const executorsManifest = JSON.parse(
    readFileSync(installedExecutorsManifest, 'utf8'),
  ) as { executors: Record<string, { implementation: string }> };
  expect(executorsManifest.executors['typecheck']).toBeDefined();
}, 300000);

afterAll(() => {
  // Remove the per-spec pack dir (the .tgz lives under it) and discard the shared
  // tmp consumer-workspace. force:true keeps teardown non-fatal if either is gone.
  if (packDest) {
    rmSync(packDest, { recursive: true, force: true });
  }

  if (consumerWorkspace) {
    rmSync(consumerWorkspace, { recursive: true, force: true });
  }
});

// The five committed project types (D-07). `target` is the PUBLISHED executor id
// each fixture project.json wires; `injectionFile` is the committed-clean source
// (RELATIVE to the consumer-workspace) the row mutates to introduce a TS2322;
// `originalLabel` is the exact unique line in that file the injection inserts
// ahead of. The spec-tsconfig row injects into the *.spec.ts file (NOT the
// component) so the error provably lands in the spec file set, proving the spec
// tsconfig is genuinely a distinct check baseline.
// `originalLabel` is the unique committed line the injection is inserted AHEAD
// of. `injectedLine` is the TS2322-producing line for that file's CONTEXT: the
// four component rows inject a class FIELD (`readonly broken: number = 'str';`,
// valid in a class body); the spec row injects a `const` STATEMENT
// (`const broken: number = 'str';`, valid inside the `it()` function body where
// its label line lives). Both build the string via JSON.stringify so there is
// no quote/apostrophe escaping hazard (ASCII only): a `number` typed binding
// assigned a string literal -> TS2322.
interface MatrixRow {
  label: string;
  target: string;
  injectionFile: string;
  originalLabel: string;
  injectedLine: string;
}

const BROKEN_FIELD = `readonly broken: number = ${JSON.stringify('str')};`;
const BROKEN_STATEMENT = `const broken: number = ${JSON.stringify('str')};`;

const MATRIX_ROWS: readonly MatrixRow[] = [
  {
    label: 'application',
    target: 'app:typecheck',
    injectionFile: join('apps', 'app', 'src', 'app.component.ts'),
    originalLabel: "readonly label: string = 'angular-typechecker matrix app';",
    injectedLine: BROKEN_FIELD,
  },
  {
    label: 'local non-buildable library',
    target: 'local-lib:typecheck',
    injectionFile: join('libs', 'local-lib', 'src', 'local-lib.component.ts'),
    originalLabel:
      "readonly label: string = 'angular-typechecker matrix local lib';",
    injectedLine: BROKEN_FIELD,
  },
  {
    label: 'buildable library',
    target: 'buildable-lib:typecheck',
    injectionFile: join(
      'libs',
      'buildable-lib',
      'src',
      'buildable-lib.component.ts',
    ),
    originalLabel:
      "readonly label: string = 'angular-typechecker matrix buildable lib';",
    injectedLine: BROKEN_FIELD,
  },
  {
    label: 'publishable library',
    target: 'publishable-lib:typecheck',
    injectionFile: join(
      'libs',
      'publishable-lib',
      'src',
      'publishable-lib.component.ts',
    ),
    originalLabel:
      "readonly label: string = 'angular-typechecker matrix publishable lib';",
    injectedLine: BROKEN_FIELD,
  },
  {
    label: 'spec tsconfig',
    target: 'local-lib:typecheck-spec',
    // The spec-type error lands in the *.spec.ts file set (the file the spec
    // tsconfig INCLUDES and the component targets EXCLUDE), proving the spec
    // tsconfig is checked. The injection point is the `const label = ...` line
    // INSIDE the `it()` callback, so the injected error must be a STATEMENT (a
    // class-field `readonly` declaration would be a syntax error in a function
    // body, masking the intended TS2322).
    injectionFile: join(
      'libs',
      'local-lib',
      'src',
      'local-lib.component.spec.ts',
    ),
    originalLabel: 'const label: string = component.label;',
    injectedLine: BROKEN_STATEMENT,
  },
];

// After each row, restore the original source so the SHARED tmp install is
// reusable across rows (write `original` back in a finally inside the row). This
// guard tracks the most recent (file, original) so a thrown assertion still
// restores -- belt-and-suspenders over the per-row finally.
let lastInjected: { path: string; original: string } | undefined;

afterEach(() => {
  if (lastInjected !== undefined) {
    writeFileSync(lastInjected.path, lastInjected.original);
    lastInjected = undefined;
  }
});

describe('TEST-03: the installed tarball type-checks all five project types green + injected-error', () => {
  it.each(MATRIX_ROWS)(
    '$label: green run exit 0 -> injected TS2322 non-zero + token + no ERR_REQUIRE_ESM',
    ({ target, injectionFile, originalLabel, injectedLine }) => {
      const sourcePath = join(consumerWorkspace, injectionFile);
      const original = readFileSync(sourcePath, 'utf8');

      try {
        // GREEN: the committed-clean fixture type-checks clean from the installed
        // package for this project type.
        const green = run(consumerWorkspace, target, {
          env,
          skipNxCache: true,
        });
        expect(green.code).toBe(0);

        // Inject a known TS2322 ahead of the unique label line, using the row's
        // context-appropriate injected line (a class field for the component
        // rows, a `const` statement for the spec-function-body row).
        const injected = original.replace(
          originalLabel,
          `${injectedLine}\n  ${originalLabel}`,
        );
        expect(injected).not.toBe(original);
        lastInjected = { path: sourcePath, original };
        writeFileSync(sourcePath, injected);

        // INJECTED: the installed executor must report the deliberate type error
        // and exit non-zero for THIS project type. All four together prove the
        // packaged check actually ran for the type:
        //   (1) non-zero exit,
        //   (2) the real rendered TS2322 token is in stdout (the check ran, not a
        //       no-op exit 0),
        //   (3) NO ERR_REQUIRE_ESM -- the CJS executor's dynamic import() of the
        //       ESM compiler-cli survived packaging (D-19),
        //   (4) NO infra-error meta message -- the non-zero exit is the real
        //       diagnostic, not an unrelated crash masquerading as a finding.
        const bad = run(consumerWorkspace, target, {
          env,
          skipNxCache: true,
        });
        expect(bad.code).not.toBe(0);
        expect(bad.stdout).toContain(INJECTED_TS_CODE);
        expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(bad.stdout).not.toContain('infrastructure error');
      } finally {
        // Restore the committed-clean source so the next row sees a clean tree.
        writeFileSync(sourcePath, original);
        lastInjected = undefined;
      }
    },
  );
});
