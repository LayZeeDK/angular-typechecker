import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// WALK-02 / SC5 / T-13-03: the coarse SINGLE walk target caches on ONE key. The
// target points at a SOLUTION tsconfig.json whose references include a
// tsconfig.spec.json leaf, so one run type-checks BOTH the lib leaf and the spec
// leaf. Because the walk now type-checks the spec leaf, a spec-only source edit
// MUST bust the cache. The `production` named input EXCLUDES *.spec.ts, so under
// `production` a spec-only change would NOT change the input hash -> the cache
// would replay a stale PASS ("a type-checker that lies"). The WALK-02 swap to the
// `default` named input (the lib+spec source union) makes a *.spec.ts edit hash
// into the single-target cache key. This spec proves that end-to-end through the
// real Nx CLI + cache + project graph, MIRRORING the cache-busts-on-dep-error
// harness (per-run isolated cache dir, NX_DAEMON off, byte-restore, R1 pre-flight
// input check) but mutating a *.spec.ts source instead of a dep source.

// The static single-target cache-hit summary marker (verified Nx 23.0.1,
// output.dim()-wrapped; this prefix is stable). Its ABSENCE on the post-edit run
// -- together with the new diagnostic + a non-zero exit -- is the defense-in-depth
// CACHE MISS signal (all three required).
const CACHE_MARKER =
  'Nx read the output from the cache instead of running the command';

const TARGET = 'typecheck-walk-consumer:angular-typecheck';

// The rendered TS diagnostic code the injection deliberately triggers. Asserting
// the full 'TS2322' token (not a bare 4-digit '2322' substring) keeps the cache-
// MISS check from false-PASSing on an unrelated 4-digit occurrence in a stack
// trace / hash / offset (WR-01). Hoisted to one place so a future code change is
// a single edit (IN-02).
const INJECTED_TS_CODE = 'TS2322';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-cache-e2e/src/<file>) -- 3 dirs up -- so every nx
// invocation + file write is cwd-independent.
const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

// The SPEC-leaf source mutated to inject the error (a *.spec.ts file the
// tsconfig.spec.json leaf includes and tsconfig.lib.json EXCLUDES) + its committed
// byte-identical .pristine sidecar for crash-safe revert.
const SPEC_FILE_REL =
  'libs/typecheck-walk-consumer/src/lib/walk-consumer.component.spec.ts';
const SPEC_FILE = join(workspaceRoot, SPEC_FILE_REL);
const PRISTINE = `${SPEC_FILE}.pristine`;

// CRITICAL (nested-nx isolation): this spec runs UNDER `nx run <cache-e2e>:test`,
// so the outer Nx runner injects env vars into this process that a naive
// `...process.env` would propagate into the nested `nx run` and silently break the
// cache test. Most importantly `NX_SKIP_NX_CACHE=true` (set whenever the OUTER
// test task itself ran with --skip-nx-cache) would make EVERY nested run a
// cache-miss -> the CACHE HIT assertion can never pass and the gate is dead. Strip
// them all so the nested `nx run` is a clean top-level invocation regardless of how
// the outer test was invoked.
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

function buildCleanEnv(cacheDirectory: string): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };

  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }

  // Determinism: a per-run isolated cache dir (avoids the global .nx lock on
  // Windows + guarantees a cold baseline) + NX_DAEMON off so a stale daemon
  // cannot serve an outdated graph. FORCE_COLOR=0 keeps the dim() marker
  // un-split by ANSI.
  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
    NX_CACHE_DIRECTORY: cacheDirectory,
  };
}

const cacheDir = mkdtempSync(join(tmpdir(), 'atc-walk-cache-'));
const env = buildCleanEnv(cacheDir);

interface RunResult {
  stdout: string;
  code: number;
}

// execSync throws on a non-zero exit -- so the catch is how we capture the
// CACHE-MISS non-zero exit + the diagnostic output. NEVER pipe nx through
// head/rg: the pipe tail's exit code masks Nx's. No untrusted string reaches the
// shell: a fixed target id + fixed flags only.
function run(extra = ''): RunResult {
  try {
    const stdout = execSync(
      `npx nx run ${TARGET} --output-style=static ${extra}`.trim(),
      { cwd: workspaceRoot, env, encoding: 'utf8' },
    );

    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    return {
      stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
      code: execError.status ?? 1,
    };
  }
}

function healFromPristine(): void {
  // Restore the spec source from the committed byte-identical sidecar (preserves
  // EOL exactly via a verbatim string round-trip). NOT git checkout (git checkout
  // masks other working edits, touches the index, and is defeated by a killed
  // worker).
  writeFileSync(SPEC_FILE, readFileSync(PRISTINE, 'utf8'));
}

beforeAll(() => {
  // Heal in case a prior crashed run left an injection on disk.
  healFromPristine();
});

afterEach(() => {
  // Belt-and-braces revert in case a synchronous error skipped a test's finally.
  healFromPristine();
});

afterAll(() => {
  // Remove the per-run isolated cache dir so each CI/local run does not leak a
  // populated atc-walk-cache-* directory under the OS temp dir. force:true keeps
  // teardown non-fatal if the dir is already gone.
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('WALK-02/SC5: a spec-only edit busts the coarse single walk-target cache', () => {
  it('R1 pre-flight (BLOCKING): the spec source IS an input for the walk target (default input hashes *.spec.ts)', () => {
    // Headline correctness guard: if the *.spec.ts source is NOT an input, the
    // cache is permanently green on a broken spec leaf and the WALK-02 swap is
    // dead. This is what a `production` input would fail. execSync throws on
    // exit 1 -> this test fails BEFORE the dynamic test trusts the cache. No
    // head/rg pipe (it would mask Nx's exit code).
    const stdout = execSync(
      `npx nx show target inputs ${TARGET} --check ${SPEC_FILE_REL}`,
      { cwd: workspaceRoot, env, encoding: 'utf8' },
    );

    // ASCII-only assertion: match the "is an input" substring, not the non-ASCII
    // check glyph Nx emits.
    expect(stdout).toContain(`${SPEC_FILE_REL} is an input`);
  });

  it('green run #1 -> run #2 CACHE HIT -> edit ONLY a *.spec.ts source -> run #3 CACHE MISS + new diagnostic + non-zero exit', () => {
    const original = readFileSync(SPEC_FILE, 'utf8');

    try {
      // Green baseline: the first run executes (cold per-run cache).
      const first = run();
      expect(first.code).toBe(0);

      // CACHE HIT: the 2nd identical green run is served from the cache -- proves
      // caching is live (without this, a permanently-disabled cache would also
      // "pass" the MISS case for the wrong reason).
      const second = run();
      expect(second.stdout).toContain(CACHE_MARKER);
      expect(second.code).toBe(0);

      // Inject a known, self-contained TS2322 into the SPEC source only (a
      // *.spec.ts file the tsconfig.lib.json leaf EXCLUDES, so the error can only
      // land via the spec leaf the solution tsconfig walks). Build the string
      // literal via JSON.stringify (no quote/apostrophe escaping hazard;
      // ASCII-only). The injected const is stand-alone so exactly one TS2322 fires
      // (no follow-on cascade).
      const injected = original.replace(
        'const component = new WalkConsumerComponent();',
        `const component = new WalkConsumerComponent();\n    const __atc_bust: number = ${JSON.stringify('str')};\n    void __atc_bust;`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(SPEC_FILE, injected);

      // CACHE MISS (defense-in-depth, all three required):
      //   (1) the cache-hit marker is ABSENT (the run actually executed),
      //   (2) the freshly-injected diagnostic code is present in stdout,
      //   (3) the exit code is non-zero.
      const third = run();
      expect(third.stdout).not.toContain(CACHE_MARKER);
      // Require the real, rendered TS code token (not a bare 4-digit substring)
      // so the cache was busted AND the genuine spec-leaf diagnostic was reported
      // -- not a coincidental '2322' from a stack trace / offset / hash (WR-01).
      expect(third.stdout).toContain(INJECTED_TS_CODE);
      // Guard the MISS case against an UNRELATED infrastructure failure
      // masquerading as a bust (a crashed run also satisfies marker-absent +
      // exit-nonzero for the wrong reason) (WR-01).
      expect(third.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(third.stdout).not.toContain('infrastructure error');
      expect(third.code).not.toBe(0);
    } finally {
      // Byte-restore of the captured original (preserves EOL exactly).
      writeFileSync(SPEC_FILE, original);
    }
  });

  it('anti-lying-cache differential: --skip-nx-cache surfaces the spec error a cached green run could otherwise hide', () => {
    const original = readFileSync(SPEC_FILE, 'utf8');

    try {
      const injected = original.replace(
        'const component = new WalkConsumerComponent();',
        `const component = new WalkConsumerComponent();\n    const __atc_bust: number = ${JSON.stringify('str')};\n    void __atc_bust;`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(SPEC_FILE, injected);

      // A forced real run (never cached) must report the spec error + non-zero
      // exit -- the explicit "the cache is not lying" check. The marker can never
      // appear with --skip-nx-cache.
      const forced = run('--skip-nx-cache');
      expect(forced.stdout).not.toContain(CACHE_MARKER);
      expect(forced.stdout).toContain(INJECTED_TS_CODE);
      expect(forced.code).not.toBe(0);
    } finally {
      writeFileSync(SPEC_FILE, original);
    }
  });
});
