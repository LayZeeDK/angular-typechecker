import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// PKG-03 (release scoping) + PKG-04 (supply-chain-hardened CI) regression gate.
// The hardened release controls are CONFIG, not code -- a single careless edit
// (re-adding the untrusted-PR trigger, granting repo-write to the publish job,
// floating an action back to a mutable tag, dropping persist-credentials, leaking
// a fixture into the release set) silently re-opens the s1ngularity / TanStack /
// tj-actions vectors. This spec reads the repo files directly and asserts the
// invariants so a regression FAILS the suite. It is a fast filesystem/text check
// (no build/pack/install), but lives in the serialized install-e2e project so it
// rides the same vitest.config.mts (forks/singleFork/no-parallel/node env) and
// runs alongside the audit + smoke gates (D-22 main tree). YAML is asserted with
// string/regex checks (NOT a new parser dependency) -- the invariants are
// line-level and a regex is sufficient + cheaper than adding a YAML lib.

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every file
// read is cwd-independent (matches the tarball-audit + install-smoke specs).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const nxJsonPath = join(workspaceRoot, 'nx.json');
const securityMdPath = join(workspaceRoot, 'SECURITY.md');
const releaseWorkflowPath = join(
  workspaceRoot,
  '.github',
  'workflows',
  'release.yml',
);
const dependabotPath = join(workspaceRoot, '.github', 'dependabot.yml');
const changelogPath = join(workspaceRoot, 'CHANGELOG.md');
const projectJsonPath = join(
  workspaceRoot,
  'packages',
  'angular-typechecker',
  'project.json',
);

// The published, unscoped project name nx release must be scoped to. Anything
// else in release.projects would risk versioning/publishing a fixture, the spike
// app, or an e2e project.
const RELEASE_PROJECT = 'angular-typechecker';

// The public (open-source) contact email. The work address must NEVER appear in
// a public repo file -- assert its presence so a copy/paste slip is caught.
const PUBLIC_EMAIL = 'larsbrinknielsen@gmail.com';

// Strip full-line YAML comments (lines whose first non-whitespace char is `#`)
// so the assertions see only ACTIVE config. Trailing inline `# vN` comments on a
// `uses:` SHA-pin line are intentionally PRESERVED (they document the pinned
// version) -- only whole-line comments are removed.
function stripCommentLines(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

describe('PKG-03: nx release is scoped to angular-typechecker only', () => {
  it('declares a release block in nx.json', () => {
    const nx = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as {
      release?: { projects?: string[] };
    };

    expect(nx.release).toBeDefined();
  });

  it('scopes release.projects to exactly [angular-typechecker]', () => {
    const nx = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as {
      release?: { projects?: string[] };
    };

    // Exact scoping: no fixture, spike app, or e2e project may ever be versioned
    // or published.
    expect(nx.release?.projects).toEqual([RELEASE_PROJECT]);
  });

  it('keeps the cut decoupled from push + GitHub release (PKG-05 / D-13)', () => {
    const nx = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as {
      release?: {
        git?: { push?: boolean };
        changelog?: { workspaceChangelog?: { createRelease?: unknown } };
      };
    };

    // Hard-won in 0.0.2: nx FORCES `git push` on when `createRelease` is set,
    // which would push an UN-CURATED version commit + tag before the changelog is
    // hand-curated. The Phase-7 Release-PR flow requires both disabled -- the cut
    // happens on a release/* branch (committed, not pushed), the change merges via
    // PR, and the maintainer tags the merge commit + creates the Release after
    // curation. Re-enabling either re-opens the un-curated-push hazard.
    expect(nx.release?.git?.push).toBe(false);
    expect(nx.release?.changelog?.workspaceChangelog?.createRelease).toBe(
      false,
    );
  });

  it('keeps the cut decoupled from git tagging (REL-01 / D-01)', () => {
    const nx = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as {
      release?: { git?: { tag?: boolean } };
    };

    // Phase 7 Release-PR flow: the cut must create NO tag. With git.tag:false the
    // `nx release --skip-publish` cut commits the version + curated CHANGELOG on a
    // release/* branch but never tags it; the change merges via PR and the
    // maintainer tags the MERGE COMMIT (`angular-typechecker@x.y.z`) post-merge,
    // which is what fires the frozen tag-triggered OIDC release.yml (D-01/D-03).
    // Re-flipping this to true would re-couple the version commit to the publish
    // trigger and bypass the PR gate -- so assert it stays false.
    expect(nx.release?.git?.tag).toBe(false);
  });
});

describe('REL-04: nx release publishes the built dist, not the source tree', () => {
  it('sets nx-release-publish packageRoot to the build outputPath (dist/packages/angular-typechecker)', () => {
    const projectConfig = JSON.parse(readFileSync(projectJsonPath, 'utf8')) as {
      targets?: Record<
        string,
        { options?: { packageRoot?: string; outputPath?: string } }
      >;
    };

    // Load-bearing regression guard. `nx release publish` joins
    // `context.root + (options.packageRoot ?? projectConfig.root)` (the @nx/js
    // release-publish executor). With NO packageRoot it falls back to the project
    // SOURCE root, whose package.json `files: ["src", ...]` globs `src/**/*.ts`
    // -- so the published tarball would ship raw TypeScript with zero compiled
    // .js (the exact defect this target fixes). Reverting the fix deletes this
    // target and fails here instantly -- a pure config read, before any
    // build/pack/publish -- so a source-vs-dist regression can never ship.
    const publishPackageRoot =
      projectConfig.targets?.['nx-release-publish']?.options?.packageRoot;

    expect(publishPackageRoot).toBe('dist/packages/angular-typechecker');
    // Assert the INVARIANT, not just the literal: publish MUST pack the same dir
    // the build emits. A future `outputPath` change that forgot to update
    // packageRoot would ship stale/empty output but still pass a literal check.
    expect(publishPackageRoot).toBe(
      projectConfig.targets?.build?.options?.outputPath,
    );
  });
});

describe('PKG-04: SECURITY.md is present at the repo root', () => {
  it('exists at the repo root', () => {
    expect(existsSync(securityMdPath)).toBe(true);
  });

  it('directs reporters to the private disclosure channel + public email', () => {
    const security = readFileSync(securityMdPath, 'utf8');

    // GitHub Private Vulnerability Reporting ("Report a vulnerability") primary +
    // the public email fallback.
    expect(security).toContain('Report a vulnerability');
    expect(security).toContain(PUBLIC_EMAIL);
  });
});

describe('PKG-04: the release workflow is supply-chain hardened', () => {
  it('exists', () => {
    expect(existsSync(releaseWorkflowPath)).toBe(true);
  });

  it('triggers on a tag push and NEVER on the untrusted-PR trigger', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    // pull_request_target was the exact s1ngularity command-injection vector.
    expect(workflow).not.toContain('pull_request_target');
    // Tag-push trigger present.
    expect(workflow).toMatch(/tags:/);
  });

  it('sets top-level least-privilege contents: read', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    expect(workflow).toMatch(/contents:\s*read/);
  });

  it('grants the publish job ONLY id-token: write (no repo-write)', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    expect(workflow).toMatch(/id-token:\s*write/);
    // The GitHub release is cut locally (D-13); the CI job must NOT hold
    // contents: write.
    expect(workflow).not.toMatch(/contents:\s*write/);
  });

  it('names a deployment environment (the required-reviewer gate)', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    expect(workflow).toMatch(/environment:\s*\S+/);
  });

  it('SHA-pins every action to a 40-char commit SHA (no mutable tag refs)', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    // Collect every `uses:` reference and assert each pins a full 40-char hex
    // commit SHA -- never a `@vN` / `@branch` mutable ref (the tj-actions vector).
    const usesRefs = [...workflow.matchAll(/uses:\s*\S+@(\S+)/g)].map((match) =>
      match[1].trim(),
    );

    expect(usesRefs.length).toBeGreaterThan(0);

    for (const ref of usesRefs) {
      expect(ref).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('disables credential persistence on checkout', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    expect(workflow).toMatch(/persist-credentials:\s*false/);
  });

  it('keeps provenance on and the npm auth token unset for OIDC', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    expect(workflow).toMatch(/NPM_CONFIG_PROVENANCE:\s*true/);
    // An empty NODE_AUTH_TOKEN value breaks OIDC; the var must be entirely unset,
    // so it must NOT appear as an active env declaration anywhere in the workflow.
    expect(workflow).not.toContain('NODE_AUTH_TOKEN');
  });

  it('retains setup-node registry-url so npm detects the OIDC trusted publisher (PKG-05 / D-03)', () => {
    const workflow = stripCommentLines(
      readFileSync(releaseWorkflowPath, 'utf8'),
    );

    // PKG-05's central empirical finding (0.0.2 steady-state verification): the
    // setup-node `registry-url` is REQUIRED for npm to DETECT the OIDC
    // trusted-publishing environment. Dropping it (the now-superseded D-04
    // "drop registry-url on 404" contingency) makes npm skip the OIDC handshake
    // entirely and fail with ENEEDAUTH on npm >= 11.5.1. A careless edit removing
    // this line silently breaks every tokenless publish, so assert it stays.
    expect(workflow).toMatch(
      /registry-url:\s*https:\/\/registry\.npmjs\.org\/?/,
    );
  });
});

describe('PKG-04: Dependabot keeps the SHA pins fresh', () => {
  it('tracks the github-actions ecosystem', () => {
    expect(existsSync(dependabotPath)).toBe(true);

    const dependabot = readFileSync(dependabotPath, 'utf8');

    expect(dependabot).toMatch(/package-ecosystem:\s*github-actions/);
  });
});

describe('REL-03: the public changelog exposes no internal GSD plan-id scope', () => {
  it('carries no NN / NN-NN plan-id scope token anywhere in CHANGELOG.md (REL-03 / D-13 / D-15)', () => {
    const changelog = readFileSync(changelogPath, 'utf8');

    // The public CHANGELOG.md (and the GitHub Release notes it sources via
    // `gh release create --notes-file`, never `--generate-notes`) must NOT leak
    // an internal GSD phase/plan scope. A live `nx release --dry-run` PROVED the
    // RAW generated changelog leaks `**06-02:**` plan-id scopes -- so the entry
    // must be hand-curated (D-13) and scope-hygiene enforced (D-15). This guards
    // the CURATED CHANGELOG content, not the raw nx output. The three leak shapes
    // are each anchored to the leak GRAMMAR so legitimate prose (a version like
    // `Node (22)`, a phrase like `Angular 22:`, or a time `14:30`) does NOT
    // false-positive and wrongly fail a future curated entry (WR-01):
    //   1. a conventional-commit scope, e.g. `feat(05-01):` -- requires a
    //      commit-type keyword before `(NN[-NN])`, so `Node (22)` does not match.
    //   2. a bold heading token,        e.g. `**06-02:**` -- nx renders a scope as
    //      `**scope:**`; requires the trailing colon so bold prose `**22**` is safe.
    //   3. a bare leading scope at line start, e.g. `05-01:` / `06:` -- anchored to
    //      line start (multiline), so mid-line `Angular 22:` / `14:30` is safe.
    const conventionalCommitScope =
      /\b(?:feat|fix|docs|chore|refactor|perf|test|build|ci|style|revert)\(\d{2}(?:-\d{2})*\)/;
    const boldHeadingScope = /\*\*\d{2}(?:-\d{2})*:/;
    const bareLeadingScope = /^\s*\d{2}(?:-\d{2})*:/m;

    expect(changelog).not.toMatch(conventionalCommitScope);
    expect(changelog).not.toMatch(boldHeadingScope);
    expect(changelog).not.toMatch(bareLeadingScope);
  });
});
