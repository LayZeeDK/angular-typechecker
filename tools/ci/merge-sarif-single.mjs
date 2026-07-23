// SPIKE 012 variant of merge-sarif.mjs: produce a SINGLE-run angular-typechecker
// SARIF covering EVERY discovered project, so GitHub Code Scanning sees ONE
// analysis under ONE (tool, category) -- the shape the "Require code scanning
// results" merge gate can reconcile (the per-project multi-run fan-out cannot).
//
// It reuses the CLI's own multi-tsConfig union (ENG-01): one invocation with
// every project's leaf tsconfigs (`-c leafA -c leafB ...`) unions all diagnostics
// into ONE report -> ONE SARIF run whose results[] span all projects (each
// result keeps its repo-relative artifactLocation.uri, so per-project mapping is
// preserved). This is also the natural consumer pattern:
//   npx angular-typechecker -c <all tsconfigs> --format sarif
//
// Run from the repo ROOT so artifactLocation URIs stay repo-relative.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listTypecheckProjects } from './list-typecheck-projects.mjs';

const BIN = 'dist/packages/angular-typechecker/src/cli/bin.js';
const OUTPUT = 'angular-typechecker.sarif';
// One stable category for the single analysis. automationDetails.id overrides the
// upload-sarif `category` input, so pin it here for a deterministic category.
const CATEGORY = 'angular-typecheck';

/**
 * Flatten every discovered project's leaf tsConfigs into one CLI arg list.
 * @param {string} root
 * @returns {string[]} the `-c <leaf>` ... args across ALL projects, then --format sarif
 */
export function buildSingleRunArgs(root) {
  const args = [BIN];

  for (const { tsConfig } of listTypecheckProjects(root)) {
    for (const leaf of tsConfig) {
      args.push('-c', leaf);
    }
  }

  args.push('--format', 'sarif');

  return args;
}

// CLI entry: one invocation over all leaves, stamp a stable category, write single-run.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const args = buildSingleRunArgs(root);

  // No projects discovered (only BIN + --format sarif) -> write nothing so the
  // job's `[ -s ]` produced-guard skips the upload.
  if (args.length <= 3) {
    process.exit(0);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = (result.stdout ?? '').trim();

  if (stdout.length === 0) {
    const stderrLine = (result.stderr ?? '').trim().split('\n')[0];
    console.error(
      `merge-sarif-single: empty stdout (status ${result.status}${stderrLine ? `: ${stderrLine}` : ''})`,
    );
    process.exit(0);
  }

  const doc = JSON.parse(stdout);
  const run = (doc.runs ?? [])[0];

  if (!run) {
    process.exit(0);
  }

  // Category is set via the upload-sarif `category` input (documented, reliable);
  // do NOT stamp automationDetails.id (it would override the input and showed
  // empty in the analyses API during the spike). CATEGORY kept for reference.
  void CATEGORY;
  writeFileSync(OUTPUT, JSON.stringify({ version: doc.version, $schema: doc.$schema, runs: [run] }));
}
