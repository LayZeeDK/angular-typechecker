import { execFileSync, execSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// GUARD-01 (CI e2e-coverage self-audit). The CI `e2e` job runs as a per-project
// matrix whose project list is discovered by the `discover` job via
// `tools/ci/list-e2e-projects.mjs` and consumed per cell as
// `run-many -t e2e -p ${{ matrix.project }}`. That makes `e2e` coverage depend on
// TWO invariants that both fail SILENTLY:
//   (1) every `e2e/*` project must define an `e2e` target -- a project that drops
//       or renames it is silently never discovered, so never run in CI (the
//       coverage gap a type-checking tool must never tolerate); and
//   (2) NO non-e2e project may define an `e2e` target -- a stray `e2e` target on
//       any other project would be discovered and pulled into the matrix, breaking
//       the "exactly the e2e/* projects" guarantee (see GUARD-01b, which asserts
//       the dynamic-matrix wiring plus the isolation the LOCAL `--parallel=2`
//       full-tier run still relies on).
// This guard asserts BOTH directions so a forgotten target or a stray/misplaced
// one becomes a loud, LOCATED test failure instead of a silent miscoverage.
//
// It is a cheap filesystem/text read (NO build/pack/install), so it lives as a
// plain in-plugin `*.spec.ts` and rides the existing fast `test` matrix -- the
// loudest, earliest signal on every OS x Node cell (no `ci.yml` structural
// change). It is READ-ONLY: it reads `ci.yml` + each `project.json` and asserts;
// it NEVER edits `ci.yml`. YAML is asserted with string/regex (NOT a new parser
// dependency) -- the invariant is line-level, mirroring the release-hygiene
// precedent.

// Resolve the workspace root from this spec's location
// (packages/angular-typechecker/src/<file>); findWorkspaceRoot() walks up to nx.json, so every file read is
// cwd-independent (identical depth to the e2e specs).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

// Enumerate the workspace's e2e projects by the strict `e2e/<dir>/project.json`
// convention (each project's `.name` === its directory name). Do NOT enumerate by
// the `scope:fixture` tag -- three `libs/*` projects also carry it, which would
// over-count 6 vs the 3 real e2e projects and false-RED the guard forever.
function enumerateE2eProjects(root: string): string[] {
  return readdirSync(join(root, 'e2e'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectJson = JSON.parse(
        readFileSync(join(root, 'e2e', entry.name, 'project.json'), 'utf8'),
      ) as { name: string };

      return projectJson.name;
    })
    .sort();
}

// Build/dep-output + planning trees that never host a first-party `project.json`
// and would only slow (or error) the walk. Everything else is scanned so a new
// project anywhere under a standard root is covered without editing this list.
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.nx',
  '.git',
  '.angular',
  '.verdaccio',
  '.planning',
  'coverage',
  'tmp',
]);

// Recursively collect every `project.json` path under `root` (skipping the
// output/planning trees above). A cheap FS walk -- no nx runtime, no new
// dependency -- so the anti-silent-skip guarantee stays a fast-tier check.
function collectProjectJsonPaths(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        collectProjectJsonPaths(join(dir, entry.name), acc);
      }

      continue;
    }

    if (entry.isFile() && entry.name === 'project.json') {
      acc.push(join(dir, entry.name));
    }
  }

  return acc;
}

// Slice the `e2e:` job block (from its key to the next top-level job key) WITHOUT a
// YAML parser (line-level invariant; reuses the release-hygiene no-parser
// precedent). Shared by the e2e --parallel=2 isolation guard (GUARD-01b) and the
// typecheck-coverage guard (GUARD-01c) so there is ONE job-scoping implementation.
// The job-key regex MUST allow digits or it would miss `e2e:` itself (the `2`).
// Throws a clear located Error if the `e2e:` job is absent, so a ci.yml refactor
// fails LOUDLY.
function extractE2eJobLines(ci: string): string[] {
  const lines = ci.split('\n');
  const start = lines.findIndex((line) => /^ {2}e2e:\s*$/.test(line));

  if (start === -1) {
    throw new Error(
      'GUARD-01: could not locate the `e2e:` job in .github/workflows/ci.yml',
    );
  }

  let end = lines.length;

  for (let index = start + 1; index < lines.length; index++) {
    if (/^ {2}[a-z0-9-]+:\s*$/.test(lines[index])) {
      end = index;

      break;
    }
  }

  return lines.slice(start, end);
}

describe('GUARD-01: run-many -t e2e covers exactly the e2e/* projects', () => {
  const e2eProjects = enumerateE2eProjects(workspaceRoot);

  it('every e2e/* project defines an `e2e` target (no forgotten target -> no silent skip)', () => {
    for (const project of e2eProjects) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as { targets?: Record<string, unknown> };

      expect(
        projectJson.targets?.['e2e'],
        `GUARD-01: e2e/${project} does not define an \`e2e\` target -- \`nx run-many -t e2e\` would silently skip it (run-many runs the target only for projects that define it).`,
      ).toBeDefined();
    }
  });

  it('no non-e2e project defines an `e2e` target (run-many -t e2e stays scoped to the tarball projects)', () => {
    for (const path of collectProjectJsonPaths(workspaceRoot)) {
      const relativePath = relative(workspaceRoot, path).split(sep).join('/');

      if (relativePath.startsWith('e2e/')) {
        continue;
      }

      const projectJson = JSON.parse(readFileSync(path, 'utf8')) as {
        targets?: Record<string, unknown>;
      };

      expect(
        projectJson.targets?.['e2e'],
        `GUARD-01: ${relativePath} defines an \`e2e\` target but is not an e2e/* project. \`nx run-many -t e2e\` would run it too, breaking the "exactly the e2e/* projects" guarantee. Give the target a different name, or move the project under e2e/.`,
      ).toBeUndefined();
    }
  });

  // The two invariants above are moot if the ci.yml e2e job never runs
  // `nx run-many -t e2e` at all. A typo/drop/merge revert (`-t e2e` -> `-t e2ee`,
  // or back to `-t test`) matches ZERO projects, exits 0, and silently disables the
  // entire tarball-install tier -- the gate that proves the PUBLISHED artifact
  // works. Assert the RUN-STEP line specifically: the regex excludes comment lines
  // (this block's prose also mentions `run-many -t e2e`), so a dropped invocation
  // cannot pass vacuously behind a stale comment.
  it('the ci.yml e2e job actually runs `nx run-many -t e2e`', () => {
    const ci = readFileSync(
      join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
      'utf8',
    );
    const e2eBlock = extractE2eJobLines(ci).join('\n');

    expect(
      /^(?!\s*#).*\brun-many\s+-t\s+e2e\b/m.test(e2eBlock),
      'GUARD-01: the ci.yml `e2e` job must actually RUN `nx run-many -t e2e`. With zero matching projects run-many exits 0, so a typo/drop/revert of this invocation silently disables the entire tarball-install tier (the gate that proves the published artifact works).',
    ).toBe(true);
  });
});

// Is `line` a TypeScript comment line? True when the first non-space chars are `//`
// (line comment) or `*` (block-comment continuation). Used by the TS-source scans
// below so a `npm pack --json` / `nx build` mentioned in a comment does NOT
// false-trigger. NOTE: this is the TS marker; the ci.yml scans use the YAML `#`
// marker built into their regexes -- do not conflate the two.
function isTsComment(line: string): boolean {
  const trimmed = line.trimStart();

  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

// Recursively collect every file under `e2e/` whose name ends with `suffix`
// (e.g. `.e2e.spec.ts` for the pack specs, `global-setup.ts` for the registry
// setups), skipping the output/planning trees in IGNORED_DIRS. A cheap FS walk --
// no nx runtime -- so the isolation guard stays a fast-tier check.
function collectE2eFiles(suffix: string): string[] {
  const acc: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(join(dir, entry.name));
        }

        continue;
      }

      if (entry.isFile() && entry.name.endsWith(suffix)) {
        acc.push(join(dir, entry.name));
      }
    }
  };

  walk(join(workspaceRoot, 'e2e'));

  return acc.sort();
}

// Read the `parallelism` flag off an e2e project's `e2e` target.
function e2eTargetParallelism(project: string): boolean | undefined {
  const projectJson = JSON.parse(
    readFileSync(join(workspaceRoot, 'e2e', project, 'project.json'), 'utf8'),
  ) as { targets?: { e2e?: { parallelism?: boolean } } };

  return projectJson.targets?.e2e?.parallelism;
}

// GUARD-01b (e2e split-matrix wiring + local-run isolation guard). CI runs the
// e2e tier as a per-project matrix (quick-260715-050): a separate `discover` job
// enumerates the e2e projects via `tools/ci/list-e2e-projects.mjs` and the `e2e`
// job derives its matrix from `fromJSON(needs.discover.outputs.projects)`, so one
// cell runs per e2e project and a NEW e2e project is auto-covered. This guard
// asserts that dynamic wiring stays intact (a static list here would silently
// drop a newly added tier), that the discovery script's CLI output stays in sync
// with GUARD-01's enumeration (so the matrix cannot drift from the real e2e
// projects), AND that the isolation invariants the LOCAL full-tier run
// (`nx run-many -t e2e --parallel=2`) still relies on stay in place: install-e2e +
// cache-e2e parallelism:false, per-spec --pack-destination, and no in-spec rebuild
// of dist. Each assertion is fail-loud + located; the text checks are cheap
// READ-ONLY filesystem/text reads that NEVER edit a file. The ci.yml scans use the
// YAML `#` comment marker; the TS-source scans use the `//`/`*` marker via
// isTsComment.
describe('GUARD-01b: the ci.yml e2e job is a dynamic per-project matrix with the local-run resources isolated', () => {
  const ci = readFileSync(
    join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );

  it('the e2e job uses a dynamic fromJSON matrix fed by the discover job', () => {
    const e2eBlock = extractE2eJobLines(ci).join('\n');

    expect(
      // Matrix line only (this block's comments also mention the wiring).
      /^(?!\s*#).*fromJSON\(\s*needs\.discover\.outputs\.projects/m.test(
        e2eBlock,
      ),
      'GUARD-01b: the `e2e` job must derive its matrix from `fromJSON(needs.discover.outputs.projects ...)`. This dynamic wiring is what auto-covers any NEW e2e project -- a static project list here would silently drop a newly added tier from CI.',
    ).toBe(true);

    expect(
      // The `discover` job's enumeration command lives in the full ci string.
      /^(?!\s*#).*tools\/ci\/list-e2e-projects\.mjs/m.test(ci),
      'GUARD-01b: the `discover` job must enumerate e2e projects via `node tools/ci/list-e2e-projects.mjs` (the source of needs.discover.outputs.projects). Without it the dynamic matrix has no upstream and CI e2e coverage silently drops to the static fallback list.',
    ).toBe(true);

    expect(
      // Each cell still runs the e2e target (scoped by -p ${{ matrix.project }}).
      /^(?!\s*#).*\brun-many\s+-t\s+e2e\b/m.test(e2eBlock),
      'GUARD-01b: each e2e matrix cell must still RUN `nx run-many -t e2e` -- a dropped invocation would silently disable the tarball-install tier (run-many with zero matching projects exits 0).',
    ).toBe(true);
  });

  it('the discover script enumerates EXACTLY the e2e/* projects (matrix cannot drift)', () => {
    // Run the real CLI the `discover` job runs and assert its JSON output equals
    // GUARD-01's independent enumeration. This catches a discovery script that is
    // edited to hardcode/omit a project -- which would silently mis-cover the CI
    // matrix even while the ci.yml wiring regex above still passes.
    const cliOutput = execSync('node tools/ci/list-e2e-projects.mjs', {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });
    const discovered = JSON.parse(cliOutput) as string[];

    expect(
      discovered,
      'GUARD-01b: `tools/ci/list-e2e-projects.mjs` output must equal GUARD-01 enumerateE2eProjects() -- the CI matrix must cover exactly the e2e/* projects, no more, no less.',
    ).toEqual(enumerateE2eProjects(workspaceRoot));
  });

  it('every e2e spec that packs uses --pack-destination (no shared dist tarball path)', () => {
    for (const specPath of collectE2eFiles('.e2e.spec.ts')) {
      const relativePath = relative(workspaceRoot, specPath)
        .split(sep)
        .join('/');
      const lines = readFileSync(specPath, 'utf8').split('\n');

      lines.forEach((line, index) => {
        if (isTsComment(line) || !/npm pack --json/.test(line)) {
          return;
        }

        expect(
          line.includes('--pack-destination'),
          `GUARD-01b: ${relativePath}:${index + 1} runs \`npm pack --json\` without \`--pack-destination\`. A bare pack writes into the shared dist dir, reintroducing the cross-project tarball race under --parallel=2. Pack to a per-spec mkdtemp dir instead.`,
        ).toBe(true);
      });
    }
  });

  it('install-e2e serializes its e2e target (parallelism:false -> single live registry)', () => {
    expect(
      e2eTargetParallelism('angular-typechecker-install-e2e'),
      'GUARD-01b: e2e/angular-typechecker-install-e2e must set `parallelism: false` on its `e2e` target. It is one of two Verdaccio publishers (with angular-typechecker-ng-cli-e2e), and both are serialized; running install-e2e alone keeps exactly ONE local registry live (no port/storage/htpasswd/authToken contention, and no cross-registry yarn metadata-cache poisoning -- yarn 4 keys that cache by host, not host:port).',
    ).toBe(false);
  });

  it('cache-e2e serializes its e2e target (parallelism:false)', () => {
    expect(
      e2eTargetParallelism('angular-typechecker-cache-e2e'),
      'GUARD-01b: e2e/angular-typechecker-cache-e2e must set `parallelism: false` on its `e2e` target so the cache-correctness gate (real workspace .nx SQLite db) never co-runs with a nested-nx sibling under --parallel=2.',
    ).toBe(false);
  });

  // The REAL invariant behind the two dedicated its above: ANY e2e project whose
  // global-setup boots a local Verdaccio registry MUST run solo under the LOCAL
  // `nx run-many -t e2e --parallel=2` command. All registry-starters share ONE
  // registry on 127.0.0.1:4873 (storage / htpasswd / authToken, plus yarn 4's
  // host-keyed metadata cache), so two publishers co-running would contend on that
  // shared state. This generalizes the dedicated its so a FUTURE registry-starting
  // e2e project is caught too -- not just install-e2e and ng-cli-e2e. The setup boots
  // a registry either by calling `startLocalRegistry` directly OR by delegating to the
  // shared `createVerdaccioGlobalSetup` factory (Q2 extraction) -- match both markers.
  it('every registry-starting e2e project serializes its e2e target (parallelism:false)', () => {
    const registryStarters = collectE2eFiles('global-setup.ts')
      .filter((setupPath) => {
        const lines = readFileSync(setupPath, 'utf8').split('\n');

        return lines.some(
          (line) =>
            !isTsComment(line) &&
            (line.includes('startLocalRegistry') ||
              line.includes('createVerdaccioGlobalSetup')),
        );
      })
      // e2e/<project>/src/global-setup.ts -> project name is the parent of src/.
      .map((setupPath) => basename(dirname(dirname(setupPath))));

    // Anti-vacuous-green (this file's pattern): a rename that hides EVERY
    // registry-starter would make the loop below assert nothing and pass
    // silently. Require at least one so a drifted detection marker fails loud.
    expect(
      registryStarters.length,
      'GUARD-01b: expected at least one e2e project whose global-setup calls startLocalRegistry, but found none -- the detection marker likely drifted (a rename?), which would make the serialization invariant pass vacuously.',
    ).toBeGreaterThan(0);

    for (const project of registryStarters) {
      expect(
        e2eTargetParallelism(project),
        `GUARD-01b: e2e/${project} boots a local registry in its global-setup, so its \`e2e\` target MUST set \`parallelism: false\`. Two registry publishers co-running under \`nx run-many -t e2e --parallel=2\` contend on the shared 127.0.0.1:4873 registry (storage / htpasswd / authToken, plus yarn 4's host-keyed metadata cache).`,
      ).toBe(false);
    }
  });

  it('no e2e spec or global-setup rebuilds dist (build runs once upstream)', () => {
    const files = [
      ...collectE2eFiles('.e2e.spec.ts'),
      ...collectE2eFiles('global-setup.ts'),
    ];

    for (const filePath of files) {
      const relativePath = relative(workspaceRoot, filePath)
        .split(sep)
        .join('/');
      const lines = readFileSync(filePath, 'utf8').split('\n');

      lines.forEach((line, index) => {
        if (isTsComment(line)) {
          return;
        }

        expect(
          /nx build angular-typechecker/.test(line),
          `GUARD-01b: ${relativePath}:${index + 1} rebuilds dist (\`nx build angular-typechecker\`). Under --parallel=2 concurrent dist writes corrupt every packer/publisher. dist is built ONCE upstream via each e2e project's own \`e2e\`-target dependsOn -- remove the in-spec/in-setup build.`,
        ).toBe(false);
      });
    }
  });
});

// GUARD-01c (typecheck coverage guard). The e2e sources are statically
// type-checked by the unified `nx run-many -t typecheck`, which relies on TWO
// conventions that both fail SILENTLY: `nx run-many -t <target>` with ZERO matching
// projects EXITS 0. So (axis 1) if an `e2e/*` project drops or renames its
// `typecheck` target it silently stops type-checking its own specs, and (axis 2) if
// the target name is renamed/typo'd in the ci.yml e2e job the run-many matches zero
// projects and passes vacuously -- a false green either way. This guard closes both
// axes so a drop or a rename becomes a loud, LOCATED failure:
//   (1) EVERY `e2e/*` project (enumerated by the same name===dir convention as
//       GUARD-01) defines a `typecheck` target; a missing one names the project.
//   (2) The ci.yml `e2e` job actually RUNS `nx run-many -t typecheck` (folding the
//       former `typecheck-e2e` gate before the multi-minute tarball install).
// Like GUARD-01/01b it is a cheap READ-ONLY filesystem/text check (reads each
// e2e/*/project.json + ci.yml and asserts; NEVER edits either) asserted with
// string/regex, no YAML parser, riding the existing fast `test` matrix.
describe('GUARD-01c: every e2e project defines typecheck and the ci.yml e2e job runs it', () => {
  it('every e2e/* project defines a typecheck target', () => {
    for (const project of enumerateE2eProjects(workspaceRoot)) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as { targets?: Record<string, unknown> };

      expect(
        projectJson.targets?.['typecheck'],
        `GUARD-01c: e2e/${project} does not define a \`typecheck\` target -- it silently stops type-checking its specs while \`nx run-many -t typecheck\` still exits 0 (run-many with zero matches is a no-op green).`,
      ).toBeDefined();
    }
  });

  it('the ci.yml e2e job runs `nx run-many -t typecheck`', () => {
    const ci = readFileSync(
      join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
      'utf8',
    );
    const e2eBlock = extractE2eJobLines(ci).join('\n');

    expect(
      // Run-step line only (this block's comments also mention `run-many -t typecheck`).
      /^(?!\s*#).*\brun-many\s+-t\s+typecheck\b/m.test(e2eBlock),
      'GUARD-01c: the ci.yml `e2e` job must run `nx run-many -t typecheck`. A rename/typo of the target name here would match zero projects and pass vacuously (run-many with zero matches exits 0), silently skipping the e2e static type-check gate.',
    ).toBe(true);
  });
});

// GUARD-01d (e2e tag-membership guard). `type:e2e` is the project-taxonomy marker
// for the e2e tier. The CI `e2e` matrix no longer SELECTS by it (the split scopes
// each cell with `-p ${{ matrix.project }}`, and the project list is enumerated by
// `tools/ci/list-e2e-projects.mjs`, not the tag). But the `type:e2e` tag set
// must stay EXACTLY the e2e/* projects so the taxonomy remains a truthful single
// source for any tag-based selection or tooling: (axis 1) a new e2e project that
// forgets the tag drifts out of the e2e taxonomy, and (axis 2) a stray `type:e2e`
// on a non-e2e project wrongly claims e2e membership. Same cheap, READ-ONLY,
// enumerate-both-directions shape as GUARD-01.
describe('GUARD-01d: the `type:e2e` tag set is exactly the e2e/* projects', () => {
  it('every e2e/* project carries the `type:e2e` tag', () => {
    for (const project of enumerateE2eProjects(workspaceRoot)) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as { tags?: string[] };

      expect(
        projectJson.tags ?? [],
        `GUARD-01d: e2e/${project} is missing the \`type:e2e\` tag -- it would drift out of the e2e-tier taxonomy that \`type:e2e\` is the single source of.`,
      ).toContain('type:e2e');
    }
  });

  it('no non-e2e project carries the `type:e2e` tag', () => {
    for (const path of collectProjectJsonPaths(workspaceRoot)) {
      const relativePath = relative(workspaceRoot, path).split(sep).join('/');

      if (relativePath.startsWith('e2e/')) {
        continue;
      }

      const projectJson = JSON.parse(readFileSync(path, 'utf8')) as {
        tags?: string[];
      };

      expect(
        projectJson.tags ?? [],
        `GUARD-01d: ${relativePath} carries the \`type:e2e\` tag but is not an e2e/* project -- it wrongly claims e2e-tier membership. Remove the tag or move the project under e2e/.`,
      ).not.toContain('type:e2e');
    }
  });
});

// GUARD-01e (per-project e2e-target build-dependsOn guard). On a fresh runner
// `dist/packages/angular-typechecker` does not exist, so `nx run-many -t e2e` MUST
// schedule `angular-typechecker:build` before the e2e tasks or every global-setup
// ENOENTs on the built `package.json`. The build edge lives on each e2e project's
// OWN `e2e`-target `dependsOn` -- NOT an nx.json name-keyed `e2e` targetDefault:
// all four e2e targets use `@nx/vitest:test`, and nx's
// readTargetDefaultsForTarget returns the EXECUTOR-keyed default and
// short-circuits BEFORE the name-keyed `e2e` default, so a name-keyed default is
// silently inert (config-present-but-inert was the exact failure mode). Because
// the fix lives on the target's OWN config (the most-specific location, which
// always applies), a pure-FS read of each e2e project.json is authoritative and
// cheap. READ-ONLY, fail-loud + located, same enumerate convention as GUARD-01.
describe('GUARD-01e: every e2e project builds angular-typechecker before its e2e target runs', () => {
  it('every e2e/* project declares an `e2e`-target dependsOn that builds angular-typechecker', () => {
    for (const project of enumerateE2eProjects(workspaceRoot)) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as {
        targets?: {
          e2e?: {
            dependsOn?: Array<
              string | { projects?: string[]; target?: string }
            >;
          };
        };
      };

      const dependsOn = projectJson.targets?.e2e?.dependsOn ?? [];

      const buildsPlugin = dependsOn.some((entry) => {
        if (typeof entry === 'string') {
          return entry === 'angular-typechecker:build' || entry === '^build';
        }

        return (
          entry.target === 'build' &&
          (entry.projects ?? []).includes('angular-typechecker')
        );
      });

      expect(
        buildsPlugin,
        `GUARD-01e: e2e/${project} \`e2e\` target has no dependsOn that builds angular-typechecker -- on a fresh runner dist is never built and every spec ENOENTs on dist/.../package.json.`,
      ).toBe(true);
    }
  });

  it('nx.json targetDefaults has no `e2e` key (the inert name-keyed default stays deleted)', () => {
    const nxJson = JSON.parse(
      readFileSync(join(workspaceRoot, 'nx.json'), 'utf8'),
    ) as { targetDefaults?: Record<string, unknown> };

    expect(
      nxJson.targetDefaults?.['e2e'],
      'GUARD-01e: nx.json `targetDefaults.e2e` must stay removed -- a name-keyed `e2e` default is inert for @nx/vitest:test-backed targets (readTargetDefaultsForTarget returns the executor-keyed default and never reads the name key), so re-adding it silently drops the build edge. Put the build dependsOn directly on each e2e target instead.',
    ).toBeUndefined();
  });
});

// B3 (discovery robustness). `tools/ci/list-e2e-projects.mjs` feeds the CI
// `discover` job. Two future edge cases must not break it: a stray e2e/ subdir
// with NO project.json (a fixtures/scratch/tooling folder) must not ENOENT-crash
// the discovery, and a project.json with a falsy `name` must not inject a
// null/undefined cell into the dynamic matrix. This exercises the REAL module
// against a synthetic temp workspace root so the two skips are proven directly
// (GUARD-01b already proves the CLI output equals the enumeration on the real
// tree).
describe('listE2eProjects: tolerates a stray subdir + a falsy project name (B3)', () => {
  it('skips a subdir without project.json and an entry with a falsy name, returning only the valid project', () => {
    // Exercise the REAL discovery module through its CLI entry (the same path CI
    // runs): the CLI calls `listE2eProjects(process.cwd())`, so running it with
    // `cwd` = the synthetic temp root proves `listE2eProjects(tempRoot)` directly.
    // (A `file://`/relative dynamic `import()` of the .mjs is not viable here --
    // vitest's module runner cannot resolve a file:// URL outside this project's
    // root, and @nx/enforce-module-boundaries bans a literal cross-project path.
    // execFileSync mirrors GUARD-01b's existing CLI-invocation precedent.)
    const script = join(workspaceRoot, 'tools', 'ci', 'list-e2e-projects.mjs');
    const tempRoot = mkdtempSync(join(tmpdir(), 'list-e2e-projects-'));

    try {
      const e2eDir = join(tempRoot, 'e2e');

      // (a) a valid e2e project: a project.json with a truthy name + an `e2e` target.
      mkdirSync(join(e2eDir, 'valid-e2e'), { recursive: true });
      writeFileSync(
        join(e2eDir, 'valid-e2e', 'project.json'),
        JSON.stringify({ name: 'valid-e2e', targets: { e2e: {} } }),
      );

      // (b) a stray dir with NO project.json (the ENOENT case).
      mkdirSync(join(e2eDir, 'stray-no-project-json'), { recursive: true });

      // (c) a project.json with no `name` and no `e2e` target (the falsy-name case).
      mkdirSync(join(e2eDir, 'nameless'), { recursive: true });
      writeFileSync(
        join(e2eDir, 'nameless', 'project.json'),
        JSON.stringify({ targets: {} }),
      );

      const output = execFileSync('node', [script], {
        cwd: tempRoot,
        encoding: 'utf8',
      });

      expect(JSON.parse(output) as string[]).toEqual(['valid-e2e']);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
