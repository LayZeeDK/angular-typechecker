import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildCleanEnv, findWorkspaceRoot, run } from '@workspace/test-util';

// TEST-04: the phase's central correctness gate. A green run caches a HIT; a
// type error injected into a NON-buildable transitive dep's SOURCE must bust the
// cache (MISS) and surface the new diagnostic with a non-zero exit. A cache that
// serves a stale GREEN result on a broken dep is "a type-checker that lies" --
// worse than none (Pitfall 1). This runs the real green-then-broken transition
// end-to-end through the real Nx CLI + cache + project graph (D-12/D-13), with
// the determinism + crash-safety the panel hardened (D-14/D-15), SEQUENTIALLY on
// the main tree (D-17).

// The static single-target cache-hit summary marker (verified Nx 23.0.1,
// output.dim()-wrapped; this prefix is stable). Its ABSENCE on the post-injection
// run -- together with the new diagnostic + a non-zero exit -- is the defense-in-
// depth CACHE MISS signal (D-12, all three required).
const CACHE_MARKER =
  'Nx read the output from the cache instead of running the command';

const TARGET = 'typecheck-consumer:typecheck';

// The rendered TS diagnostic code the injection deliberately triggers. Asserting
// the full 'TS2322' token (not a bare 4-digit '2322' substring) keeps the cache-
// MISS check from false-PASSing on an unrelated 4-digit occurrence in a stack
// trace / hash / offset (WR-01). Hoisted to one place so a future code change is
// a single edit (IN-02).
const INJECTED_TS_CODE = 'TS2322';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-cache-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every nx
// invocation + file write is cwd-independent (D-17 main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

// The dep SOURCE file mutated to inject the error (a non-.spec file the Vitest
// include glob ignores -- D-15) + its committed byte-identical .pristine sidecar.
const DEP_FILE_REL = 'libs/typecheck-consumer-dep/src/lib/dep.component.ts';
const DEP_FILE = join(workspaceRoot, DEP_FILE_REL);
const PRISTINE = `${DEP_FILE}.pristine`;

// Determinism (D-12/D-14): a per-run isolated cache dir avoids the global .nx
// lock on Windows and guarantees a cold baseline. The shared buildCleanEnv strips
// the outer runner's NX_* vars (see its doc -- most importantly NX_SKIP_NX_CACHE,
// which would force every nested run to a cache-miss and kill the CACHE HIT
// assertion) and sets NX_DAEMON=false + FORCE_COLOR=0; NX_CACHE_DIRECTORY layers
// the isolated cache dir on top.
const cacheDir = mkdtempSync(join(tmpdir(), 'atc-cache-'));
const env: NodeJS.ProcessEnv = {
  ...buildCleanEnv(),
  NX_CACHE_DIRECTORY: cacheDir,
};

function healFromPristine(): void {
  // Restore the dep source from the committed byte-identical sidecar (preserves
  // EOL exactly via a verbatim string round-trip). NOT git checkout (D-15:
  // git checkout masks other working edits, touches the index, and is defeated
  // by a killed worker).
  writeFileSync(DEP_FILE, readFileSync(PRISTINE, 'utf8'));
}

beforeAll(() => {
  // Heal in case a prior crashed run left an injection on disk (D-15).
  healFromPristine();
});

afterEach(() => {
  // Belt-and-braces revert in case a synchronous error skipped a test's finally.
  healFromPristine();
});

afterAll(() => {
  // Remove the per-run isolated cache dir so each CI/local run does not leak a
  // populated atc-cache-* directory under the OS temp dir (WR-02). force:true
  // keeps teardown non-fatal if the dir is already gone.
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('TEST-04: a dep type error busts the consumer cache', () => {
  it('R1 pre-flight (BLOCKING): the dep source IS an input for the consumer target (the consumer->dep graph edge exists)', () => {
    // D-10 headline correctness guard: if the edge is missing, ^default reaches
    // nothing and the cache is permanently green on a broken dep. execSync throws
    // on exit 1 -> this test fails BEFORE the dynamic test trusts the cache. No
    // head/rg pipe (it would mask Nx's exit code).
    const stdout = execSync(
      `npx nx show target inputs ${TARGET} --check ${DEP_FILE_REL}`,
      { cwd: workspaceRoot, env, encoding: 'utf8' },
    );

    // ASCII-only assertion: match the "is an input" substring, not the non-ASCII
    // check glyph Nx emits.
    expect(stdout).toContain(`${DEP_FILE_REL} is an input`);
  });

  it('green run #1 -> run #2 CACHE HIT -> inject a dep error -> run #3 CACHE MISS + new diagnostic + non-zero exit', () => {
    const original = readFileSync(DEP_FILE, 'utf8');

    try {
      // Green baseline: the first run executes (cold per-run cache).
      const first = run(workspaceRoot, TARGET, { env });
      expect(first.code).toBe(0);

      // CACHE HIT: the 2nd identical green run is served from the cache -- proves
      // caching is live (without this, a permanently-disabled cache would also
      // "pass" the MISS case for the wrong reason).
      const second = run(workspaceRoot, TARGET, { env });
      expect(second.stdout).toContain(CACHE_MARKER);
      expect(second.code).toBe(0);

      // Inject a known TS2322 INTO depLabel's body -- a value the consumer
      // actually exercises -- so the error lands IN the consumer's program (the
      // consumer target runs with includeDeps:true so the inlined non-buildable
      // dep source is type-checked). Build the string literal via JSON.stringify
      // (no quote/apostrophe escaping hazard; ASCII-only). The widening cast keeps
      // depLabel's string return type valid except for the deliberate TS2322 on
      // the const initializer.
      const injected = original.replace(
        "return 'dep';",
        `const __atc_bust: number = ${JSON.stringify('str')};\n  return String(__atc_bust);`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(DEP_FILE, injected);

      // CACHE MISS (defense-in-depth, all three required by D-12):
      //   (1) the cache-hit marker is ABSENT (the run actually executed),
      //   (2) the freshly-injected diagnostic code is present in stdout,
      //   (3) the exit code is non-zero.
      const third = run(workspaceRoot, TARGET, { env });
      expect(third.stdout).not.toContain(CACHE_MARKER);
      // Require the real, rendered TS code token (not a bare 4-digit substring)
      // so the cache was busted AND the genuine dep diagnostic was reported --
      // not a coincidental '2322' from a stack trace / offset / hash (WR-01).
      expect(third.stdout).toContain(INJECTED_TS_CODE);
      // Guard the MISS case against an UNRELATED infrastructure failure
      // masquerading as a bust (a crashed run also satisfies marker-absent +
      // exit-nonzero for the wrong reason) (WR-01).
      expect(third.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(third.stdout).not.toContain('infrastructure error');
      expect(third.code).not.toBe(0);
    } finally {
      // D-15 byte-restore of the captured original (preserves EOL exactly).
      writeFileSync(DEP_FILE, original);
    }
  });

  it('anti-lying-cache differential: --skip-nx-cache surfaces the dep error a cached green run could otherwise hide', () => {
    const original = readFileSync(DEP_FILE, 'utf8');

    try {
      const injected = original.replace(
        "return 'dep';",
        `const __atc_bust: number = ${JSON.stringify('str')};\n  return String(__atc_bust);`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(DEP_FILE, injected);

      // A forced real run (never cached) must report the dep error + non-zero
      // exit -- the explicit "the cache is not lying" check (D-12 optional
      // differential). The marker can never appear with --skip-nx-cache.
      const forced = run(workspaceRoot, TARGET, { env, skipNxCache: true });
      expect(forced.stdout).not.toContain(CACHE_MARKER);
      expect(forced.stdout).toContain(INJECTED_TS_CODE);
      expect(forced.code).not.toBe(0);
    } finally {
      writeFileSync(DEP_FILE, original);
    }
  });
});
