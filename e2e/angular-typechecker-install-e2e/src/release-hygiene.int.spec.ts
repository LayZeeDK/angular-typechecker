import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
// (e2e/angular-typechecker-install-e2e/src/<file>) -- 3 dirs up -- so every file
// read is cwd-independent (matches the tarball-audit + install-smoke specs).
const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
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
    const usesRefs = [...workflow.matchAll(/uses:\s*\S+@(\S+)/g)].map(
      (match) => match[1].trim(),
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
});

describe('PKG-04: Dependabot keeps the SHA pins fresh', () => {
  it('tracks the github-actions ecosystem', () => {
    expect(existsSync(dependabotPath)).toBe(true);

    const dependabot = readFileSync(dependabotPath, 'utf8');

    expect(dependabot).toMatch(/package-ecosystem:\s*github-actions/);
  });
});
