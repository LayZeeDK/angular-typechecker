// Prove the shipped SARIF -> GitHub Code Scanning contract landed end-to-end for
// the isolated one-per-family proof fixture (PROOF-01/02). Driven by the
// code-scanning-red-proof CI job on a pull_request: the fixture SARIF is uploaded
// under its OWN Code Scanning tool -- driver.name `angular-typechecker-red-proof`
// (D-02), rewritten in the job right before upload -- so the fixture's DELIBERATE
// errors never contaminate the clean dogfood `angular-typechecker` tool. This
// script polls GitHub via `gh api` until ingestion completes, then asserts the
// EXACT SET of (rule id, file path) tuples that landed under our category on the PR
// merge-ref (D-03) -- failing LOUD (non-zero exit) on a MISSING tuple, an EXTRA
// tuple, a right-code-wrong-file attribution, a `processing_status: failed`, or a
// poll timeout. The exact-set assertion REPLACES the earlier family-tag
// set-membership check (which deliberately never asserted a count).
//
// Determinism (D-03a/b): `upload-sarif`'s wait-for-processing gives up SILENTLY on
// timeout, so this script owns the wait -- poll `sarifs/{id}` to `complete` (the
// deterministic handle), cross-check that an analysis landed under our category,
// then bounded-retry the alerts query while ingestion propagates. A single query
// right after upload is flaky (P4); a true timeout is a red check, never a silent
// pass (PROOF-02; mirrors list-typecheck-projects.mjs's throw-on-empty).
//
// NO `state` query param (BLOCKING, research P1): D-01 dismissal is GLOBAL and
// PERMANENT ("dismissed in all branches"), so a `state=open` filter would let the
// FIRST post-D-01 PR pass and make every later one permanently RED -- the dismissed
// alerts would be filtered out and reported missing. The query is state-agnostic and
// the dismissal is idempotent instead.
//
// Dismissal (D-01): after a PASSING assert, dismiss exactly those alerts with
// `dismissed_reason: used in tests`, so a later PR that touches the fixture does not
// re-post unresolved `github-advanced-security` review threads. Three properties are
// load-bearing:
//   * assert-before-dismiss is STRUCTURAL -- `dismissAlerts` consumes only the array
//     RETURNED by a passing `assertAlerts`, so a throwing assert cannot reach it (no
//     boolean flag, no convention: the data dependency IS the enforcement);
//   * scope -- that array is `tool_name=angular-typechecker-red-proof` +
//     category-filtered, so a dogfood `angular-typechecker`, `fallow`, or CodeQL
//     alert can never enter the PATCH list;
//   * non-fatal (research P3) -- this job is a member of the required `ci` aggregate,
//     so a PATCH 400/404 emits `::warning::` and leaves the job GREEN rather than
//     deadlocking the empty-bypass `main` ruleset.
//
// Category isolation (Pattern 2, T-35-11): category and driver.name are ORTHOGONAL
// axes, and the alerts API has no category filter, so the CLI entry client-filters
// alerts to most_recent_instance.category === CATEGORY BEFORE the exact-set check.
//
// Injection-safe (T-35-08, V5): `gh` is spawned via a FIXED arg array (no
// shell:true), and PR data (PR_NUMBER / SARIF_ID) is read from env, never
// interpolated into a shell string. Alert numbers are `Number()`-coerced before they
// reach an API path. `gh` reads its token from GH_TOKEN in env.
//
// Shape mirrors tools/ci/merge-sarif.mjs + list-typecheck-projects.mjs: NO shebang,
// node:* imports, an exported PURE matcher (`tupleDiff`), and a
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
// D-02: the proof's OWN Code Scanning tool. MUST stay byte-identical to the
// driver.name literal the `code-scanning-red-proof` job rewrites into proof.sarif --
// drift makes the proof permanently RED (the tool_name query would match nothing).
// The ci-e2e-coverage-guard spec locks the two together.
const TOOL = 'angular-typechecker-red-proof';

// D-03: the EXACT set of (rule id, file path) tuples this proof locks -- no more, no
// less. A missing tuple, an extra tuple, or a right-code-wrong-file attribution all
// fail the job. The four codes and their families are locked locally by the 35-01
// drift-lock integration spec ("SARIF reporter integration -- sarif-proof-fixture
// (one rule per family, one run)" in machine-reporters-sarif.integration.spec.ts);
// the PATHS are proven here + in real CI.
//
// ATC90002 is NOT file-less: phase 35-04 gave file-less SARIF results a REGION-LESS
// whole-file fallback location whose artifactLocation.uri is the relativized
// tsConfigPath, so GitHub reports it at tools/sarif-proof-fixture/tsconfig.json
// line 1 (verified against the live alerts payload). Expecting an ABSENT location
// would fail permanently.
const EXPECTED = [
  { ruleId: 'TS2322', path: 'tools/sarif-proof-fixture/type-error.ts' },
  { ruleId: 'NG8002', path: 'tools/sarif-proof-fixture/proof.component.html' },
  { ruleId: 'NG8101', path: 'tools/sarif-proof-fixture/proof.component.html' },
  { ruleId: 'ATC90002', path: 'tools/sarif-proof-fixture/tsconfig.json' },
];

// Bounded poll: ~20 x 6s per phase (~2 min ceiling each). Generous for GitHub's
// async ingestion; too-short only causes a false RED (timeout), never a false pass.
const PROCESSING_ATTEMPTS = 20;
const ALERTS_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 6000;
// GitHub applies a SECONDARY rate limit to mutating requests (research P6); space
// the handful of dismissal PATCHes out rather than bursting them.
const DISMISS_INTERVAL_MS = 1000;

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
 * `ruleId@path` -- the identity a tuple is compared on, and how it renders in a loud
 * (RED) error message.
 *
 * @param {string | undefined} ruleId
 * @param {string | undefined} path
 * @returns {string}
 */
function tupleKey(ruleId, path) {
  return `${ruleId}@${path}`;
}

/**
 * The PURE exact-set matcher (no I/O, no spawn). Matches each alert on `rule.id` +
 * `most_recent_instance.location.path` and returns BOTH directions of the D-03
 * difference: `missing` = expected tuples no alert satisfies, `extra` = alerts whose
 * tuple is not expected (deduped by `ruleId@path`). Both empty => the alert set is
 * EXACTLY the expected set. A right-code-wrong-file attribution shows up in both.
 * The CLI entry filters alerts by category BEFORE calling this, so `alerts` here is
 * already category-scoped.
 *
 * @param {{ rule?: { id?: string }, most_recent_instance?: { location?: { path?: string } } }[]} alerts
 * @param {{ ruleId: string, path: string }[]} expected
 * @returns {{ missing: { ruleId: string, path: string }[], extra: { ruleId: string | undefined, path: string | undefined }[] }}
 */
export function tupleDiff(alerts, expected) {
  const actual = alerts.map((alert) => ({
    ruleId: alert.rule?.id,
    path: alert.most_recent_instance?.location?.path,
  }));
  const actualKeys = new Set(
    actual.map((tuple) => tupleKey(tuple.ruleId, tuple.path)),
  );
  const expectedKeys = new Set(
    expected.map((tuple) => tupleKey(tuple.ruleId, tuple.path)),
  );
  const seen = new Set();

  const missing = expected.filter(
    (tuple) => !actualKeys.has(tupleKey(tuple.ruleId, tuple.path)),
  );
  const extra = actual.filter((tuple) => {
    const key = tupleKey(tuple.ruleId, tuple.path);

    if (expectedKeys.has(key) || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });

  return { missing, extra };
}

/** Format tuples as `ruleId@path, ...` for loud (RED) error messages. */
function formatTuples(tuples) {
  return tuples.map((tuple) => tupleKey(tuple.ruleId, tuple.path)).join(', ');
}

/**
 * The PURE dismissal selection: only alerts that are currently OPEN. Reads
 * `most_recent_instance.state`, NEVER the top-level `state` -- the by-number GET
 * reports `state: null` for a PR-only alert with no default-branch instance
 * (research P7). Because D-01 dismissal is global and permanent, a re-run sees the
 * alerts already dismissed and selects nothing: the dismissal is idempotent.
 *
 * @param {{ number?: number, most_recent_instance?: { state?: string } }[]} alerts
 * @returns {{ number?: number }[]}
 */
export function dismissable(alerts) {
  return alerts.filter((alert) => alert.most_recent_instance?.state === 'open');
}

/**
 * One authenticated `gh api` call -> parsed JSON. Fixed arg array (NO shell:true, NO
 * interpolated PR data); `gh` reads GH_TOKEN from env. maxBuffer bumped for large
 * alert payloads (mirrors merge-sarif.mjs).
 *
 * @param {string} pathAndQuery e.g. `repos/OWNER/REPO/code-scanning/alerts?ref=...`
 * @param {{ paginate?: boolean, method?: string, fields?: [string, string][] }} [options]
 *   `paginate` follows all pages of an array endpoint (gh concatenates them into one
 *   JSON array). `method` + `fields` drive the D-01 dismissal PATCH. Every added arg
 *   is a fixed literal or a caller-supplied constant -- no PR data is interpolated,
 *   so injection safety is preserved.
 * @returns {any} The parsed JSON response.
 */
function ghApi(pathAndQuery, { paginate = false, method, fields = [] } = {}) {
  const args = ['api'];

  if (paginate) {
    args.push('--paginate');
  }

  if (method) {
    args.push('--method', method);
  }

  args.push(pathAndQuery);

  for (const [name, value] of fields) {
    args.push('-f', `${name}=${value}`);
  }

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
 * Analyses cross-check (D-03, Discretion): assert an analysis for this upload landed
 * under our dedicated category, independent of the alerts loop. This is what
 * independently proves THIS sarif_id landed on THIS ref, so the recurrence fallback
 * below cannot be greened by a stale repo-wide alert alone.
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
 * List proof-tool alerts and apply the client-side category filter (Pattern 2).
 * Deliberately carries NO `state` param -- see the header (research P1).
 *
 * @param {string} query the query string appended to the alerts endpoint
 * @returns {any[]}
 */
function proofAlerts(query) {
  return ghApi(`repos/${REPO}/code-scanning/alerts?${query}`, {
    paginate: true,
  }).filter((alert) => categoryMatches(alert.most_recent_instance?.category));
}

/**
 * Recurrence fallback (research P2, hedges assumption A2): confirm the alert has at
 * least one instance on THIS ref, so a stale repo-wide alert from an earlier PR
 * cannot satisfy an expected tuple.
 *
 * @param {{ number?: number }} alert
 * @param {string} ref
 * @returns {boolean}
 */
function hasInstanceOnRef(alert, ref) {
  const number = Number(alert.number);

  if (!Number.isInteger(number)) {
    return false;
  }

  const instances = ghApi(
    `repos/${REPO}/code-scanning/alerts/${number}/instances?ref=${ref}`,
    { paginate: true },
  );

  return Array.isArray(instances) && instances.length > 0;
}

/**
 * Throw on an EXTRA alert (the second D-03 direction). Only ever reached once
 * `missing` is empty, so a still-propagating ingestion is never mistaken for one.
 *
 * @param {{ ruleId: string | undefined, path: string | undefined }[]} extra
 */
function assertNoExtra(extra) {
  if (extra.length > 0) {
    throw new Error(
      `unexpected EXTRA alerts under the proof tool (rule id, file path): ${formatTuples(extra)}`,
    );
  }
}

/**
 * D-03 exact-set assertion over PROOF alerts (category-isolated, Pattern 2), bounded
 * retry while ingestion propagates. RETURNS the matched, category-filtered alert
 * array -- the ONLY input the D-01 dismissal consumes, so a throw here makes
 * dismissal structurally unreachable. Throws on timeout naming the still-missing
 * tuples (PROOF-02).
 *
 * @param {string} ref refs/pull/<n>/merge
 * @returns {Promise<any[]>} the matched proof alerts
 */
async function assertAlerts(ref) {
  let stillMissing = EXPECTED;
  let sawAnyProofAlert = false;

  for (let attempt = 0; attempt < ALERTS_ATTEMPTS; attempt++) {
    const alerts = proofAlerts(`ref=${ref}&tool_name=${TOOL}&per_page=100`);
    sawAnyProofAlert = sawAnyProofAlert || alerts.length > 0;

    const { missing, extra } = tupleDiff(alerts, EXPECTED);

    if (missing.length === 0) {
      assertNoExtra(extra);

      return alerts;
    }

    stillMissing = missing;

    await sleep(POLL_INTERVAL_MS);
  }

  // Research P2: if the ref-scoped query never saw a single proof-tool alert, a
  // permanently dismissed alert may simply not produce a ref-scoped list entry.
  // Retry repo-wide (all refs, all states), keep only alerts with a confirmed
  // instance on THIS ref, then run the SAME exact-set decision -- the proof survives
  // either recurrence semantics without weakening.
  if (!sawAnyProofAlert) {
    const repoWide = proofAlerts(`tool_name=${TOOL}&per_page=100`).filter(
      (alert) => hasInstanceOnRef(alert, ref),
    );
    const { missing, extra } = tupleDiff(repoWide, EXPECTED);

    if (missing.length === 0) {
      assertNoExtra(extra);
      console.log(
        `code-scanning red proof: matched via the repo-wide recurrence fallback (no ref-scoped list entry on ${ref})`,
      );

      return repoWide;
    }

    stillMissing = missing;
  }

  throw new Error(
    `proof alerts missing expected (rule id, file path) tuples after polling: ${formatTuples(stillMissing)}`,
  );
}

/**
 * D-01: dismiss exactly the alerts a PASSING assert returned. NEVER throws and NEVER
 * sets a non-zero exit -- each PATCH is individually try/caught and a failure emits
 * `::warning::` (research P3): the assert already passed, which is what this job is
 * contracted to prove, and a required-check deadlock on the empty-bypass `main`
 * ruleset would be far worse than a missed dismissal.
 *
 * @param {any[]} alerts the array RETURNED by assertAlerts (scope enforcement)
 */
async function dismissAlerts(alerts) {
  const open = dismissable(alerts);

  if (open.length === 0) {
    console.log(
      'code-scanning red proof: no open proof alerts to dismiss (already dismissed -- D-01 is idempotent)',
    );

    return;
  }

  for (const alert of open) {
    const number = Number(alert.number);

    if (!Number.isInteger(number)) {
      console.log('::warning::skipping a proof alert with no numeric number');

      continue;
    }

    try {
      ghApi(`repos/${REPO}/code-scanning/alerts/${number}`, {
        method: 'PATCH',
        fields: [
          ['state', 'dismissed'],
          ['dismissed_reason', 'used in tests'],
          [
            'dismissed_comment',
            'Deliberate diagnostic from tools/sarif-proof-fixture/ -- the CI proof that the SARIF -> Code Scanning contract works.',
          ],
        ],
      });
      console.log(`code-scanning red proof: dismissed alert ${number}`);
    } catch (error) {
      console.log(
        `::warning::failed to dismiss proof alert ${number}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await sleep(DISMISS_INTERVAL_MS);
  }
}

/**
 * TEST SEAM (ASSERT_ALERTS_FILE): read a canned alerts payload from disk, apply the
 * SAME category filter + exact-set decision the normal branch uses, throw on a
 * MISSING or an EXTRA tuple, and on success print the dismissal DRY-RUN (the alert
 * numbers `dismissable` selects) instead of PATCHing -- so both D-03 directions AND
 * the D-01 scope/idempotence discipline are unit-testable locally WITHOUT hitting
 * GitHub. This branch never calls `gh`; the ingestion path stays real-CI-only.
 *
 * @param {string} file
 */
function assertFromFile(file) {
  const alerts = JSON.parse(readFileSync(file, 'utf8')).filter((alert) =>
    categoryMatches(alert.most_recent_instance?.category),
  );
  const { missing, extra } = tupleDiff(alerts, EXPECTED);

  if (missing.length > 0) {
    throw new Error(
      `proof alerts missing expected (rule id, file path) tuples: ${formatTuples(missing)}`,
    );
  }

  assertNoExtra(extra);

  const numbers = dismissable(alerts)
    .map((alert) => alert.number)
    .join(', ');

  console.log(
    'code-scanning red proof (seam): all expected (rule id, file path) tuples present',
  );
  console.log(
    `code-scanning red proof (seam): would dismiss alerts ${numbers || '(none)'}`,
  );
}

/** CLI entry: the local test seam OR the real bounded gh-api poll + exact-set assert. */
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

  // D-01 assert-before-dismiss is STRUCTURAL: `dismissAlerts` consumes ONLY what a
  // PASSING `assertAlerts` returned, so a throw above dismisses nothing.
  const matched = await assertAlerts(ref);

  console.log(
    `code-scanning red proof: all expected (rule id, file path) tuples present on ${ref}`,
  );

  await dismissAlerts(matched);
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
