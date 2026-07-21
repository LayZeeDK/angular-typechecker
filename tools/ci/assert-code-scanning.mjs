// Prove the shipped SARIF -> GitHub Code Scanning contract landed end-to-end for
// the isolated one-per-family proof fixture (PROOF-01/02). Driven by the
// code-scanning-proof CI job (35-03) on a pull_request: after the fixture SARIF is
// uploaded under the dedicated `angular-typecheck-proof` category, this script
// polls GitHub via `gh api` until ingestion completes, then asserts SET-MEMBERSHIP
// of the four (family tag, severity) tuples among the alerts that landed under our
// category on the PR merge-ref -- failing LOUD (non-zero exit) on any missing
// tuple, a `processing_status: failed`, or a poll timeout. It NEVER asserts an
// exact alert count (D-03c) and NEVER queries the default-branch alerts view (P3).
//
// Determinism (D-03a/b): `upload-sarif`'s wait-for-processing gives up SILENTLY on
// timeout, so this script owns the wait -- poll `sarifs/{id}` to `complete` (the
// deterministic handle), cross-check that an analysis landed under our category,
// then bounded-retry the alerts query while ingestion propagates. A single query
// right after upload is flaky (P4); a true timeout is a red check, never a silent
// pass (PROOF-02; mirrors list-typecheck-projects.mjs's throw-on-empty).
//
// Category isolation (Pattern 2, T-35-11): the dogfood `code-scanning` job runs on
// the SAME PR under the SAME tool_name, and the alerts API has NO category filter,
// so the CLI entry client-filters alerts to most_recent_instance.category ===
// CATEGORY BEFORE the set-membership check -- otherwise a real dogfood alert could
// mask a genuine proof regression.
//
// Injection-safe (T-35-08, V5): `gh` is spawned via a FIXED arg array (no
// shell:true), and PR data (PR_NUMBER / SARIF_ID) is read from env, never
// interpolated into a shell string. `gh` reads its token from GH_TOKEN in env.
//
// Shape mirrors tools/ci/merge-sarif.mjs + list-typecheck-projects.mjs: NO shebang,
// node:* imports, an exported PURE matcher (`missingTuples`), and a
// `process.argv[1] === fileURLToPath(import.meta.url)` CLI entry. JSDoc types, not
// TS. The plugin-side subprocess spec drives this file's ASSERT_ALERTS_FILE seam
// rather than importing the matcher (a cross-project .mjs import breaks both
// @nx/enforce-module-boundaries and vitest's module runner -- see
// assert-code-scanning.spec.ts).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = 'LayZeeDK/angular-typechecker';
const CATEGORY = 'angular-typecheck-proof';
const TOOL = 'angular-typechecker';

// D-03d: the contract this proof locks -- one alert PRESENT per family, matched on
// the SARIF rule's family tag + severity (SARIF level maps 1:1 to the alert's
// rule.severity). This set is LOCKED locally by the 35-01 drift-lock integration
// spec ("SARIF reporter integration -- sarif-proof-fixture (one rule per family,
// one run)" in machine-reporters-sarif.integration.spec.ts) and grounded in
// diagnostic-family.ts's four Family literals -- the two MUST NOT drift.
// Set-membership only, NEVER an exact count (D-03c).
const EXPECTED = [
  { tag: 'typescript', severity: 'error' },
  { tag: 'template-type-check', severity: 'error' },
  { tag: 'extended-diagnostics', severity: 'warning' },
  { tag: 'tool', severity: 'error' },
];

// Bounded poll: ~20 x 6s per phase (~2 min ceiling each). Generous for GitHub's
// async ingestion; too-short only causes a false RED (timeout), never a false pass.
const PROCESSING_ATTEMPTS = 20;
const ALERTS_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 6000;

/**
 * Category match tolerant of upload-sarif's trailing-slash normalization. This job
 * uploads with a `category:` INPUT and the CLI's single-run SARIF carries NO
 * runs[].automationDetails.id, so github/codeql-action/upload-sarif synthesizes the
 * id from the category and appends a trailing '/' when it doesn't already end in one.
 * GitHub's analyses.category / alerts[].most_recent_instance.category can therefore
 * report EITHER `angular-typecheck-proof` OR `angular-typecheck-proof/` -- accept both
 * so the proof never permanently false-REDs on the exact string GitHub returns.
 *
 * @param {string | undefined} value
 * @returns {boolean}
 */
function categoryMatches(value) {
  return value === CATEGORY || value === `${CATEGORY}/`;
}

/**
 * The PURE set-membership matcher (no I/O, no spawn). Returns the expected tuples
 * for which NO alert carries the family tag AND matching severity. Empty => every
 * expected family landed. The CLI entry filters alerts by category BEFORE calling
 * this, so `alerts` here is already category-scoped.
 *
 * @param {{ rule?: { tags?: string[], severity?: string } }[]} alerts
 * @param {{ tag: string, severity: string }[]} expected
 * @returns {{ tag: string, severity: string }[]} The missing tuples (empty => pass).
 */
export function missingTuples(alerts, expected) {
  return expected.filter(
    (tuple) =>
      !alerts.some(
        (alert) =>
          (alert.rule?.tags ?? []).includes(tuple.tag) &&
          alert.rule?.severity === tuple.severity,
      ),
  );
}

/** Format tuples as `tag/severity, ...` for loud (RED) error messages. */
function formatTuples(tuples) {
  return tuples.map((tuple) => `${tuple.tag}/${tuple.severity}`).join(', ');
}

/**
 * One authenticated `gh api` GET -> parsed JSON. Fixed arg array (NO shell:true, NO
 * interpolated PR data); `gh` reads GH_TOKEN from env. maxBuffer bumped for large
 * alert payloads (mirrors merge-sarif.mjs).
 *
 * @param {string} pathAndQuery e.g. `repos/OWNER/REPO/code-scanning/alerts?ref=...`
 * @param {{ paginate?: boolean }} [options] paginate follows all pages of an array
 *   endpoint (gh concatenates them into one JSON array). `--paginate` is a fixed
 *   literal arg -- no PR data is interpolated, so injection safety is preserved.
 * @returns {any} The parsed JSON response.
 */
function ghApi(pathAndQuery, { paginate = false } = {}) {
  const args = ['api'];

  if (paginate) {
    args.push('--paginate');
  }

  args.push(pathAndQuery);

  const out = execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return JSON.parse(out);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * D-03a deterministic wait handle: poll processing_status until `complete`. Throws
 * immediately on `failed` (with the ingestion errors) and on timeout.
 *
 * @param {string} sarifId
 */
async function waitForProcessing(sarifId) {
  for (let attempt = 0; attempt < PROCESSING_ATTEMPTS; attempt++) {
    const status = ghApi(`repos/${REPO}/code-scanning/sarifs/${sarifId}`);

    if (status.processing_status === 'complete') {
      return;
    }

    if (status.processing_status === 'failed') {
      throw new Error(
        `SARIF processing failed: ${JSON.stringify(status.errors ?? [])}`,
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('timed out waiting for SARIF processing_status === complete');
}

/**
 * Analyses cross-check (D-03, Discretion): assert an analysis for this upload
 * landed under our dedicated category, independent of the alerts loop.
 *
 * @param {string} ref refs/pull/<n>/merge
 * @param {string} sarifId
 */
function assertAnalysisCategory(ref, sarifId) {
  const analyses = ghApi(
    `repos/${REPO}/code-scanning/analyses?ref=${ref}&tool_name=${TOOL}&sarif_id=${sarifId}`,
  );

  if (!analyses.some((analysis) => categoryMatches(analysis.category))) {
    throw new Error(
      `no analysis with category ${CATEGORY} for sarif_id ${sarifId} on ${ref}`,
    );
  }
}

/**
 * D-03b/c set-membership over PROOF alerts (category-isolated, Pattern 2), bounded
 * retry while ingestion propagates. Throws on timeout naming the still-missing
 * tuples (PROOF-02).
 *
 * @param {string} ref refs/pull/<n>/merge
 */
async function assertAlerts(ref) {
  let stillMissing = EXPECTED;

  for (let attempt = 0; attempt < ALERTS_ATTEMPTS; attempt++) {
    const alerts = ghApi(
      `repos/${REPO}/code-scanning/alerts?ref=${ref}&tool_name=${TOOL}&state=open&per_page=100`,
      { paginate: true },
    ).filter((alert) => categoryMatches(alert.most_recent_instance?.category));
    stillMissing = missingTuples(alerts, EXPECTED);

    if (stillMissing.length === 0) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `proof alerts missing expected (family tag, severity) tuples after polling: ${formatTuples(stillMissing)}`,
  );
}

/**
 * TEST SEAM (ASSERT_ALERTS_FILE): read a canned alerts payload from disk, apply the
 * SAME category filter + set-membership decision the normal branch uses, and throw
 * on any missing tuple -- so the set-membership decision + fail-loud (RED) path are
 * unit-testable locally WITHOUT hitting GitHub. This branch never calls `gh`; the
 * ingestion path stays real-CI-only (the 35-03 job).
 *
 * @param {string} file
 */
function assertFromFile(file) {
  const alerts = JSON.parse(readFileSync(file, 'utf8')).filter((alert) =>
    categoryMatches(alert.most_recent_instance?.category),
  );
  const missing = missingTuples(alerts, EXPECTED);

  if (missing.length > 0) {
    throw new Error(
      `proof alerts missing expected (family tag, severity) tuples: ${formatTuples(missing)}`,
    );
  }

  console.log(
    'code-scanning proof (seam): all expected (family tag, severity) tuples present',
  );
}

/** CLI entry: the local test seam OR the real bounded gh-api poll + set-membership. */
async function runCli() {
  const alertsFile = process.env.ASSERT_ALERTS_FILE;

  if (alertsFile) {
    assertFromFile(alertsFile);
    return;
  }

  const prNumber = process.env.PR_NUMBER;
  const sarifId = process.env.SARIF_ID;
  const ref = `refs/pull/${prNumber}/merge`;

  await waitForProcessing(sarifId);
  assertAnalysisCategory(ref, sarifId);
  await assertAlerts(ref);

  console.log(
    `code-scanning proof: all expected (category, family tag, severity) tuples present on ${ref}`,
  );
}

// CLI entry: runs only when invoked directly (never when the pure matcher is
// imported). Flush-safe fail-loud (mirrors the shipped bin.ts D-02 pattern):
// set process.exitCode = 1 and let streams drain naturally, NEVER process.exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
