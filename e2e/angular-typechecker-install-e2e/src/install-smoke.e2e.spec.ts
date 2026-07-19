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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADVISORY_NOTICE_PREFIX,
  buildCleanEnv,
  extractJsonPayload,
  findWorkspaceRoot,
  removeTmpDir,
  run,
  sh,
  validateSarif,
} from '@workspace/test-util';

// TEST-05: THE tracer bullet (D-22). 05-02 proved the packed tarball is SHAPED
// correctly (publint/attw against the .tgz); this smoke proves it actually WORKS
// from a clean consumer install. It packs the exact artifact `nx release publish`
// would ship, installs it into an isolated per-run tmp workspace with NO
// peer-resolution override flag (B-03 honesty), and runs the executor by its
// PUBLISHED id both green and against a deliberately broken source. The pairing is
// what distinguishes "the check ran and passed" from "a no-op exited 0" -- a
// type-checker that lies is worse than none. Runs SEQUENTIALLY on the main tree
// (D-17/D-22); real npm pack/install + nx run are worktree-hostile.

// The rendered TS diagnostic code the injection deliberately triggers. Asserting
// the full 'TS2322' token (not a bare 4-digit '2322' substring) keeps the check
// from false-PASSing on an unrelated 4-digit occurrence in a stack trace / hash /
// offset. Hoisted to one place so a future code change is a single edit (IN-02).
const INJECTED_TS_CODE = 'TS2322';

// The published, unscoped executor id the fixture wires (D-18). The dev
// workspace-scoped key would NOT bind in a consumer install.
const TARGET = 'consumer-app:typecheck';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every path
// is cwd-independent (D-17 main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-app',
);

// Nested-nx isolation + B-03 honesty: the shared buildCleanEnv strips the outer
// runner's NX_* vars and (default) the legacy-peer-deps override so a leaked
// override cannot MASK a real consumer ERESOLVE, and sets NX_DAEMON=false +
// FORCE_COLOR=0 (FORCE_COLOR, NOT --no-color: Nx forwards --no-color as
// color:false into the executor options, which additionalProperties:false rejects;
// 04-02 hand-off). The tmp workspace also gets its own empty .npmrc + a
// non-existent npm_config_userconfig below so no ancestor config reintroduces it.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Absolute path to the freshly-packed tarball, captured in beforeAll.
let tarballPath = '';
// A per-spec OS-temp dir the tarball is packed INTO so dist stays read-only during
// e2e and no sibling e2e project shares the tarball path.
let packDest = '';

beforeAll(() => {
  // dist is built ONCE upstream by the e2e target's dependsOn (read-only during
  // e2e); pack it into a per-spec OS-temp dir so no sibling e2e project shares the
  // tarball path. `npm pack --json --pack-destination <dir>` writes the .tgz into
  // <dir> (the EXACT artifact `nx release publish` ships) and reports the bare
  // filename; cwd stays distDir so pack reads the dist package.
  packDest = mkdtempSync(join(tmpdir(), 'atc-pack-smoke-'));
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
}, 300000);

afterAll(() => {
  // Remove the per-spec pack dir (the .tgz lives under it) so each run leaks no
  // artifact (WR-02). force:true keeps teardown non-fatal if it is already gone.
  if (packDest) {
    rmSync(packDest, { recursive: true, force: true });
  }
});

describe('TEST-05: a clean install of the packed tarball resolves + runs the executor', () => {
  it('packs -> clean tmp install (no peer override) -> green run exit 0 -> injected TS2322 non-zero + no ERR_REQUIRE_ESM', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'atc-smoke-'));

    try {
      // Copy the committed consumer fixture into the tmp workspace. We do NOT
      // copy this repo's .npmrc (it sets the peer override) -- D-20 honesty.
      // Because tmp lives under the OS temp dir, the repo .npmrc is not in tmp's
      // ancestor chain either; the empty .npmrc below makes that airtight.
      cpSync(fixtureDir, tmp, { recursive: true });

      // An explicit EMPTY project .npmrc guarantees no inherited peer override
      // (B-03): a clean install must honestly succeed or ERESOLVE.
      writeFileSync(join(tmp, '.npmrc'), '');

      // Install the freshly-packed tarball with NO peer-resolution override flag.
      // If this ERESOLVEs on the published peer ranges (D-06), that is a REAL
      // FINDING -- let the test FAIL surfacing it; do NOT auto-add the override
      // (the remediation is escalated per B-03). npm_config_userconfig -> a path
      // that does not exist so the user ~/.npmrc cannot reintroduce an override.
      sh(
        `npm install ${JSON.stringify(tarballPath)} --no-audit --no-fund --prefer-offline`,
        {
          cwd: tmp,
          env: {
            ...env,
            npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
          },
        },
      );

      // Sanity: the installed package's executor entry is resolvable from the tmp
      // consumer's node_modules -- proves the executor resolves FROM the install,
      // not from a dev path-alias (D-18). This is the cheap require()-the-package
      // check left to discretion in D-18.
      const installedExecutorsManifest = join(
        tmp,
        'node_modules',
        'angular-typechecker',
        'executors.json',
      );
      const executorsManifest = JSON.parse(
        readFileSync(installedExecutorsManifest, 'utf8'),
      ) as { executors: Record<string, { implementation: string }> };
      expect(executorsManifest.executors['typecheck']).toBeDefined();

      // GREEN: the committed fixture type-checks clean from the installed package.
      const green = run(tmp, TARGET, { env });
      expect(green.code).toBe(0);

      // VER-03 (Nx executor adapter): the shipped executor emits a parseable JSON +
      // schema-valid SARIF payload and returns the IDENTICAL exit code across
      // --format human|json|sarif for the SAME input. `nx run` frames the executor's
      // raw stdout, so extractJsonPayload isolates the single JSON object and we
      // assert no Nx chrome / advisory text is INSIDE the payload boundary (the
      // executor gates advisory notices to the human format, so json/sarif never emit
      // them). NX_DAEMON=false comes from buildCleanEnv; --skip-nx-cache keeps each
      // format a fresh run rather than a cache replay.
      const cleanHuman = run(tmp, `${TARGET} --format human`, {
        env,
        skipNxCache: true,
      });
      const cleanJson = run(tmp, `${TARGET} --format json`, {
        env,
        skipNxCache: true,
      });
      const cleanSarif = run(tmp, `${TARGET} --format sarif`, {
        env,
        skipNxCache: true,
      });

      // exit-code parity: every format exits 0 on the clean consumer project.
      expect(cleanHuman.code, cleanHuman.stdout).toBe(0);
      expect(cleanJson.code, cleanJson.stdout).toBe(0);
      expect(cleanSarif.code, cleanSarif.stdout).toBe(0);

      // Observed framing (Nx 23 `nx run consumer-app:typecheck --format json
      // --output-style=static`): stdout IS framed -- a leading `> nx run ...` task
      // echo + a Node NO_COLOR/FORCE_COLOR warning, and a trailing ` NX  Successfully
      // ran target ...` summary. extractJsonPayload (first `{` .. last `}`) isolates the
      // single executor payload; a JSON.parse / validateSarif on the slice then fails
      // LOUDLY (never a false pass) if chrome ever bled inside the braces.
      // json payload: parseable + shaped (formatVersion + diagnostics[] + summary);
      // no Nx chrome / advisory text bled into the payload boundary.
      const jsonPayload = extractJsonPayload(cleanJson.stdout);
      const parsedJson = JSON.parse(jsonPayload) as {
        formatVersion: number;
        summary: unknown;
        diagnostics: unknown[];
      };
      expect(parsedJson.formatVersion).toBe(1);
      expect(Array.isArray(parsedJson.diagnostics)).toBe(true);
      expect(parsedJson.summary).toBeDefined();
      expect(jsonPayload).not.toContain(ADVISORY_NOTICE_PREFIX);

      // sarif payload: schema-valid SARIF 2.1.0 (shared dev-only validateSarif); no
      // Nx chrome / advisory text inside the payload.
      const sarifPayload = extractJsonPayload(cleanSarif.stdout);
      const sarif = validateSarif(sarifPayload);
      expect(sarif.valid, sarif.errors).toBe(true);
      expect(sarifPayload).not.toContain(ADVISORY_NOTICE_PREFIX);

      // Inject a known TS2322 into the TMP copy's component source. Because the
      // tmp workspace is discarded via rmSync, mutating the copy is inherently
      // crash-safe -- no .pristine sidecar needed (D-18). Build the broken line
      // via JSON.stringify (no quote/apostrophe escaping hazard; ASCII-only).
      const componentPath = join(tmp, 'src', 'app.component.ts');
      const original = readFileSync(componentPath, 'utf8');
      const injected = original.replace(
        "readonly label: string = 'angular-typechecker install smoke';",
        `readonly broken: number = ${JSON.stringify('str')};\n  readonly label: string = 'angular-typechecker install smoke';`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(componentPath, injected);

      // INJECTED: the installed executor must report the deliberate type error and
      // exit non-zero. All four together prove the packaged check actually ran:
      //   (1) non-zero exit,
      //   (2) the real rendered TS2322 token is in stdout (the check ran, not a
      //       no-op exit 0),
      //   (3) NO ERR_REQUIRE_ESM -- the CJS executor's dynamic import() of the
      //       ESM compiler-cli survived packaging (D-19),
      //   (4) NO infra-error meta message -- the non-zero exit is the real
      //       diagnostic, not an unrelated crash masquerading as a finding.
      const bad = run(tmp, TARGET, { env });
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(INJECTED_TS_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');

      // VER-03 exit-code parity under a planted verdict-fail: the code is IDENTICAL
      // and non-zero across all three formats (the cardinal anti-false-pass -- a
      // machine format must never mask the verdict).
      const badJson = run(tmp, `${TARGET} --format json`, {
        env,
        skipNxCache: true,
      });
      const badSarif = run(tmp, `${TARGET} --format sarif`, {
        env,
        skipNxCache: true,
      });
      expect(badJson.code, badJson.stdout).toBe(bad.code);
      expect(badSarif.code, badSarif.stdout).toBe(bad.code);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
