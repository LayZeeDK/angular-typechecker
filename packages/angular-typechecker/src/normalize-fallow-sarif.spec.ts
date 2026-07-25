import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot, validateSarif } from '@workspace/test-util';

// Regression guard for the fallow file-less SARIF upload bug. The `fallow audit`
// DUPES sub-analysis emits `fallow/code-duplication` with the `locations` key
// OMITTED, and GitHub rejects the WHOLE multi-run upload with
// `locationFromSarifResult: expected at least one location` -- so one file-less
// clone group cost every fallow alert twice in live CI (runs 30004691193,
// 29772473095). This proves the REAL tools/ci/normalize-fallow-sarif.mjs anchors
// every location-deficient result at `.fallowrc.jsonc` (region-less) WITHOUT
// dropping it or clobbering an already-located result, and keeps the frozen
// `fallow/<index>` id scheme that pins the Code Scanning category to `fallow`.
//
// It drives the real script as a SUBPROCESS (execFileSync) against a hermetic
// mkdtempSync temp dir holding a fixture `fallow.sarif` -- the script's only input
// -- and asserts on the file it rewrites. It does NOT import
// `normalizeFallowSarif` or any tools/ci module by any mechanism: a
// pathToFileURL/file:// dynamic import of a cross-project .mjs fails vitest's
// module runner (it cannot resolve a file URL outside this project's root), and a
// relative `../../../tools/ci/...` import fails @nx/enforce-module-boundaries at
// maxWarnings:0 (a required lint gate). So the spec imports ONLY node builtins +
// vitest + @workspace/test-util, exactly like merge-sarif.spec.ts.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const normalizeScript = join(
  workspaceRoot,
  'tools',
  'ci',
  'normalize-fallow-sarif.mjs',
);

interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: { uri?: string };
    region?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
  };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: SarifLocation[];
  partialFingerprints?: Record<string, string>;
}

interface SarifRun {
  tool: {
    driver: { name: string; version?: string; informationUri?: string };
  };
  automationDetails?: { id: string };
  results: SarifResult[];
}

interface SarifDoc {
  version: string;
  $schema: string;
  runs: SarifRun[];
}

// The real captured multi-run shape. A factory (not a shared const) so the
// in-memory input can be deep-compared against the output without any risk of the
// two aliasing.
function createFixture(): SarifDoc {
  return {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [
      // Run 0 -- dead-code: a fully located result that MUST survive untouched.
      {
        tool: { driver: { name: 'fallow', version: '3.9.1' } },
        automationDetails: { id: 'fallow/audit/dead-code' },
        results: [
          {
            ruleId: 'fallow/unused-file',
            level: 'error',
            message: { text: 'File is never imported' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'tools/ci/merge-sarif.mjs' },
                  region: {
                    startLine: 7,
                    startColumn: 1,
                    endLine: 7,
                    endColumn: 12,
                  },
                },
              },
            ],
            partialFingerprints: { fallowFingerprint: 'abc123' },
          },
        ],
      },
      // Run 1 -- dupes, verbatim from the failing CI run: fallow's own
      // `fallow/audit/dupes` id (which the fix must OVERWRITE), no
      // `tool.driver.rules`, and a single result with `locations` ABSENT and no
      // `partialFingerprints`. This is the shape GitHub rejects.
      {
        tool: {
          driver: {
            name: 'fallow',
            version: '3.9.1',
            informationUri: 'https://github.com/fallow-rs/fallow',
          },
        },
        automationDetails: { id: 'fallow/audit/dupes' },
        results: [
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Clone group 1 (44 lines, 2 instances)' },
          },
        ],
      },
      // Run 2 -- the two UNOBSERVED deficiency shapes GitHub would also reject:
      // an empty `locations` array, and an entry lacking `physicalLocation`.
      {
        tool: { driver: { name: 'fallow', version: '3.9.1' } },
        results: [
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Empty locations array' },
            locations: [],
          },
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Location without physicalLocation' },
            locations: [{}],
          },
        ],
      },
    ],
  };
}

describe('normalize-fallow-sarif.mjs anchors file-less fallow results', () => {
  it('gives every location-deficient result a region-less .fallowrc.jsonc anchor, preserves located results, and keeps the frozen fallow/<index> id scheme', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'normalize-fallow-sarif-'));

    try {
      const sarifFile = join(tempRoot, 'fallow.sarif');

      writeFileSync(sarifFile, JSON.stringify(createFixture()));

      // The script's only input is the file it reads from cwd -- no stub CLI needed.
      execFileSync('node', [normalizeScript], {
        cwd: tempRoot,
        encoding: 'utf8',
      });

      const rewritten = readFileSync(sarifFile, 'utf8');
      const output = JSON.parse(rewritten) as SarifDoc;

      // 1. The file-less dupes finding SURVIVES, anchored at .fallowrc.jsonc with
      // NO region (GitHub back-fills it to line 1 col 1).
      const dupesResults = output.runs[1].results;

      expect(dupesResults).toHaveLength(1);
      expect(dupesResults[0].ruleId).toBe('fallow/code-duplication');
      expect(
        dupesResults[0].locations?.[0].physicalLocation?.artifactLocation?.uri,
      ).toBe('.fallowrc.jsonc');
      expect(
        dupesResults[0].locations?.[0].physicalLocation,
      ).not.toHaveProperty('region');

      // 2. An already-located result is NOT clobbered -- its uri, region, and
      // partialFingerprints survive byte-for-byte.
      expect(output.runs[0].results[0]).toEqual(
        createFixture().runs[0].results[0],
      );

      // 3. THE assertion that guards the bug: every result in every run now has a
      // physicalLocation.artifactLocation.uri, the one condition GitHub's
      // `locationFromSarifResult` enforces. Covers run 2's two unobserved shapes.
      for (const run of output.runs) {
        for (const result of run.results) {
          expect(
            result.locations?.[0].physicalLocation?.artifactLocation?.uri,
          ).toBeTruthy();
        }
      }

      // 4. Orphan-tuple guard: the id scheme is FROZEN at `fallow/<index>` --
      // including overwriting fallow's own `fallow/audit/dupes`, which would
      // otherwise make GitHub derive category `fallow/audit` (a NEW
      // (analysis_key, category, environment) tuple; AGENTS.md GATE-02 step 0).
      expect(output.runs.map((run) => run.automationDetails?.id)).toEqual([
        'fallow/0',
        'fallow/1',
        'fallow/2',
      ]);

      // 5. Envelope regression guard ONLY. validateSarif CANNOT detect this bug --
      // `result.locations` is optional in SARIF 2.1.0, so the validator returns
      // valid: true on the exact payload GitHub rejects. It must never stand in
      // for assertion 3.
      const { valid, errors } = validateSarif(rewritten);

      expect(valid, errors).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
