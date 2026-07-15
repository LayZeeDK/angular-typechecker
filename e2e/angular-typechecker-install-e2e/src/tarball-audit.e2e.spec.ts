import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCleanEnv, findWorkspaceRoot } from '@workspace/test-util';

// PKG-02: the phase's packaging-fidelity gate. A source-tree check cannot catch
// a `files`-allowlist defect, a `.d.ts` resolution escape (D-10), or a stale-dist
// ship -- only an audit of the PACKED tarball can (Pitfall 5). This spec builds
// FRESH dist, packs from it, and runs the ecosystem's own tools (publint + attw)
// plus a positive/negative file-set + no-install-scripts + @fixtures-leak gate
// against the `.tgz`. The `attw --pack` problems-empty assertion is the
// AUTHORITATIVE proof that the 05-01 D-10/B-02 self-contained-types fix resolved
// the InternalResolutionError. Runs SEQUENTIALLY on the main tree (D-22) under the
// serialized vitest.config.mts (forks/singleFork/no-parallel/node env, 300000ms).

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every nx /
// npm invocation is cwd-independent.
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

// The plugin build outputPath (project.json build.options.outputPath) -- the dist
// dir we pack from. `@nx/js:tsc` copies the source manifest VERBATIM here and the
// `files` allowlist applies at `npm pack` time.
const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');

// The published files that MUST ship (D-09 positive set). `npm pack --json`
// `files[].path` is package-relative WITHOUT the `package/` prefix.
const REQUIRED_FILES = [
  'executors.json',
  'src/executors/typecheck/schema.json',
  'src/executors/typecheck/executor.js',
  'src/index.js',
  'src/index.d.ts',
  'README.md',
  'LICENSE',
  // Phase 15 D-13: the five shipped generator runtime files `nx g` / `nx add`
  // need. Verified shipped via project.json build assets (the root `generators.json`
  // glob + the `**/!(*.ts)` src glob for the schemas) + the package.json `files`
  // allowlist. The `.spec.ts` generator tests are excluded by tsconfig.lib.json, so
  // the leak guards below do not false-positive on these paths.
  'generators.json',
  'src/generators/configuration/generator.js',
  'src/generators/configuration/schema.json',
  'src/generators/init/generator.js',
  'src/generators/init/schema.json',
];

// The install lifecycle script keys that must be ABSENT from the tarball's
// package.json -- a `postinstall` would execute on every consumer install (the
// s1ngularity payload vector, T-05-07).
const INSTALL_SCRIPT_KEYS = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepublish',
];

// The shared buildCleanEnv strips the outer runner's cache-defeating NX_* vars so
// the nested `nx build` is a clean top-level invocation, and sets NX_DAEMON=false
// + FORCE_COLOR=0 (FORCE_COLOR, NOT --no-color, which the executor schema's
// additionalProperties:false rejects as color:false; 04-02 hand-off). No npm
// install here, so the default (legacy-peer-deps-only) strip is sufficient.
const env = buildCleanEnv();

interface PackEntry {
  path: string;
}

interface PackResult {
  filename: string;
  files: PackEntry[];
}

interface TarballManifest {
  scripts?: Record<string, string>;
}

// Captured in beforeAll, consumed by the it() gates.
let tgz = '';
let filePaths: string[] = [];
// A per-spec OS-temp dir the tarball is packed INTO (via `npm pack
// --pack-destination`) so dist stays read-only during e2e and no sibling e2e
// project shares the tarball path. afterAll removes it recursively.
let packDest = '';
// A tmp dir (created UNDER packDest as a RELATIVE path) into which the tarball is
// extracted so the gates can read the REAL shipped package.json + .d.ts content
// (not the source tree). It is created relative to packDest so the `tar` binary
// never sees a Windows drive-letter path -- GNU tar misreads `D:\...` as a
// remote `host:path` rsh spec ("Cannot connect to D:"), and BSD tar (macOS CI)
// lacks GNU's `--force-local` escape. A relative filename + relative `-C` under a
// shared `cwd` is the one form both tar flavors handle identically.
let extractDir = '';

// Recursively collect the shipped .d.ts text from the extracted tarball so the
// @fixtures-leak guard greps the ACTUAL published declarations (R1:
// readdirSync recursive + entry.parentPath, Node 20.12+; repo targets Node 22+).
// `isFile()` does not follow symlinks -- correct here: `tar -xzf` of an npm
// tarball yields only regular files/dirs (never symlinked .d.ts), so every
// shipped declaration is captured.
function collectDtsText(dir: string): string {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.d.ts'))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    .join('');
}

beforeAll(() => {
  // dist is built ONCE upstream by the e2e target's dependsOn (read-only during
  // e2e); pack it into a per-spec OS-temp dir so no sibling e2e project shares the
  // tarball path. NEVER pipe nx/npm through head/rg: the pipe tail's exit code masks
  // the tool's (RESEARCH anti-pattern).
  //
  // `npm pack --json --pack-destination <dir>` writes the `.tgz` into <dir> and
  // reports `filename` as the bare base name (angular-typechecker is unscoped, so
  // the scoped-filename bug does not apply). cwd stays distDir so pack reads the dist
  // package. files[].path is package-relative (no `package/` prefix). Keep the bare
  // filename for the relative `tar` call.
  packDest = mkdtempSync(join(tmpdir(), 'atc-pack-audit-'));
  const packOutput = execSync(
    `npm pack --json --pack-destination "${packDest}"`,
    {
      cwd: distDir,
      encoding: 'utf8',
    },
  );
  const parsed = JSON.parse(packOutput) as PackResult[];
  const packResult = parsed[0];
  const tgzFilename = packResult.filename;

  tgz = join(packDest, tgzFilename);
  filePaths = packResult.files.map((file) => file.path);

  // Extract the tarball into an isolated dir UNDER packDest so the no-install-
  // scripts + @fixtures-leak gates read the REAL packed content (the npm tarball
  // nests everything under a top-level `package/` dir). Run `tar` with cwd=packDest
  // and RELATIVE paths only (bare tgz filename + relative -C) so neither a Windows
  // drive letter nor a GNU-vs-BSD flag divergence trips it.
  extractDir = mkdtempSync(join(packDest, 'atc-audit-'));
  const extractRel = extractDir.slice(packDest.length + 1);
  execSync(`tar -xzf "${tgzFilename}" -C "${extractRel}"`, {
    cwd: packDest,
    encoding: 'utf8',
  });
});

afterAll(() => {
  // Remove the per-spec pack dir (tarball + extraction dir live under it) so no
  // audit artifact leaks between runs. force:true keeps teardown non-fatal.
  if (packDest) {
    rmSync(packDest, { recursive: true, force: true });
  }
});

describe('PKG-02: the packed tarball is publish-correct', () => {
  it('publint --strict reports no error-level messages', () => {
    // execSync throws on a non-zero exit, so an error-level publint message fails
    // this test. --strict promotes warnings to errors.
    expect(() =>
      execSync(`npx publint "${tgz}" --strict`, {
        cwd: distDir,
        env,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });

  it('attw --pack --profile node16 reports problems empty (D-10/B-02 verified)', () => {
    // THE authoritative proof the 05-01 self-contained-types fix landed: a
    // resolvable shipped `.d.ts` surface returns no problems. The attw command
    // below passes NO rule-suppression flag whatsoever -- an InternalResolution
    // error is a REAL consumer-facing defect, never a CJS false-positive
    // (Pitfall 1). If this ever fails with a resolution problem, that is the
    // B-02 escalation trigger -- do NOT mask it.
    const attwOutput = execSync(
      `npx attw "${tgz}" --profile node16 --format json`,
      { cwd: distDir, env, encoding: 'utf8' },
    );
    const analysis = JSON.parse(attwOutput) as {
      analysis?: { problems?: unknown[] };
    };

    expect(analysis.analysis?.problems ?? []).toEqual([]);
  });

  it('ships the required published files', () => {
    for (const required of REQUIRED_FILES) {
      expect(filePaths).toContain(required);
    }
  });

  it('leaks no spec/tsconfig.spec/fixture/consumer files', () => {
    for (const path of filePaths) {
      expect(path).not.toMatch(/\.spec\./);
      expect(path).not.toMatch(/tsconfig\.spec/);
      expect(path).not.toMatch(/(libs|fixtures|e2e)\//);
      expect(path).not.toMatch(/typecheck-consumer/);
    }
  });

  it('ships no @fixtures reference in any shipped .d.ts', () => {
    // Regression guard: the dev consumer imports plugin source via a @fixtures/*
    // path alias; ZERO @fixtures references must reach the published declarations.
    const dtsText = collectDtsText(join(extractDir, 'package'));

    expect(dtsText).not.toContain('@fixtures');
  });

  it('declares no install scripts in the tarball package.json', () => {
    const manifestPath = join(extractDir, 'package', 'package.json');
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as TarballManifest;

    for (const key of INSTALL_SCRIPT_KEYS) {
      expect(manifest.scripts?.[key]).toBeUndefined();
    }
  });
});

// A3: the former "REL-04 version parity (dist === source)" describe is DELETED. It
// was tautological -- @nx/js:tsc copies the source package.json verbatim into dist,
// so dist version ALWAYS equals source version by construction. The REAL invariant
// (publish packs dist, not source) is guarded by release-hygiene REL-04
// (packageRoot === build.outputPath), and the globalSetup + verdaccio-publish
// publish->install-by-name->run round-trip subsumes version parity (a wrong dist
// version would fail install-by-name).
