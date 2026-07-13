import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// GUARD-01 (CI e2e-coverage self-audit). The CI `e2e` job runs the e2e tier with
// `nx run-many -t e2e` (no explicit `-p` list): run-many runs the target for
// EVERY project that defines it. That makes `e2e` coverage depend on TWO
// invariants that both fail SILENTLY:
//   (1) every `e2e/*` project must define an `e2e` target -- a project that drops
//       or renames it is silently never run in CI (the coverage gap a
//       type-checking tool must never tolerate); and
//   (2) NO non-e2e project may define an `e2e` target -- a stray `e2e` target on
//       any other project would be pulled into `run-many -t e2e`, breaking the
//       "exactly the e2e/* projects" guarantee (see GUARD-01b, which asserts the
//       isolation that makes running the tier at --parallel=2 safe).
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

// GUARD-01b (e2e --parallel=2 isolation guard). The CI `e2e` job runs the tier at
// `--parallel=2`: install-e2e and cache-e2e each run ALONE (parallelism:false) while
// ng-cli-e2e and matrix-e2e may overlap. That is safe ONLY while the four formerly
// shared resources stay isolated, so this guard (REWRITTEN from the old
// `--parallel=1` serialization guard) fails LOUDLY on regression of ANY invariant.
// Each assertion is fail-loud + located; all are cheap READ-ONLY filesystem/text
// checks that NEVER edit a file. The ci.yml scan (a) uses the YAML `#` comment
// marker; the TS-source scans (b, e) use the `//`/`*` marker via isTsComment.
describe('GUARD-01b: the ci.yml e2e job runs --parallel=2 with the shared resources isolated', () => {
  const ci = readFileSync(
    join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );

  it('the e2e job passes --parallel=2 and NOT --parallel=1', () => {
    const e2eBlock = extractE2eJobLines(ci).join('\n');

    expect(
      // Run-step line only (this block's comments also mention `--parallel=2`).
      /^(?!\s*#).*--parallel=2\b/m.test(e2eBlock),
      'GUARD-01b: the `e2e` job must pass `--parallel=2` to `nx run-many`. This is safe only because dist is built once upstream (no in-spec build), each packing spec uses --pack-destination, and install-e2e + cache-e2e are parallelism:false. If you deliberately fell back to serial, update this guard too.',
    ).toBe(true);

    expect(
      // Reject a lingering `--parallel=1` run step (a revert of the flip).
      /^(?!\s*#).*--parallel=1\b/m.test(e2eBlock),
      'GUARD-01b: the `e2e` job must NOT pass `--parallel=1` -- the isolation work (build de-dup, per-spec --pack-destination, install-e2e + cache-e2e parallelism:false) exists precisely so the tier runs at --parallel=2.',
    ).toBe(false);
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
      'GUARD-01b: e2e/angular-typechecker-install-e2e must set `parallelism: false` on its `e2e` target. It is the sole Verdaccio publisher; running it alone keeps exactly ONE local registry live (no port/storage/htpasswd/authToken contention, and no cross-registry yarn metadata-cache poisoning -- yarn 4 keys that cache by host, not host:port).',
    ).toBe(false);
  });

  it('cache-e2e serializes its e2e target (parallelism:false)', () => {
    expect(
      e2eTargetParallelism('angular-typechecker-cache-e2e'),
      'GUARD-01b: e2e/angular-typechecker-cache-e2e must set `parallelism: false` on its `e2e` target so the cache-correctness gate (real workspace .nx SQLite db) never co-runs with a nested-nx sibling under --parallel=2.',
    ).toBe(false);
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
          `GUARD-01b: ${relativePath}:${index + 1} rebuilds dist (\`nx build angular-typechecker\`). Under --parallel=2 concurrent dist writes corrupt every packer/publisher. dist is built ONCE upstream via the e2e target's dependsOn -- remove the in-spec/in-setup build.`,
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

// GUARD-01d (e2e tag-membership guard). The CI `e2e` job scopes its pre-install
// fast type-check with `nx run-many -t typecheck -p tag:type:e2e` -- a selector by
// the `type:e2e` tag. That selection is correct ONLY if the `type:e2e` tag set is
// EXACTLY the e2e/* projects: (axis 1) a new e2e project that forgets the tag is
// silently dropped from the pre-install gate, and (axis 2) a stray `type:e2e` on a
// non-e2e project would pull it into the e2e-scoped run. (The AUTHORITATIVE
// whole-repo type-check is the unscoped `test`-job `run-many -t typecheck`; this
// guard keeps the e2e job's fail-fast gate from silently drifting.) Same cheap,
// READ-ONLY, enumerate-both-directions shape as GUARD-01.
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
        `GUARD-01d: e2e/${project} is missing the \`type:e2e\` tag -- \`nx run-many -t typecheck -p tag:type:e2e\` (the ci.yml e2e pre-install gate) would silently skip it.`,
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
        `GUARD-01d: ${relativePath} carries the \`type:e2e\` tag but is not an e2e/* project. \`-p tag:type:e2e\` would pull it into the e2e-scoped type-check. Remove the tag or move the project under e2e/.`,
      ).not.toContain('type:e2e');
    }
  });
});
