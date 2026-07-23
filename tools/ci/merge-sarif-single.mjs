// Produce a SINGLE-run angular-typechecker SARIF covering EVERY discovered
// project, so GitHub Code Scanning sees ONE analysis under ONE (tool, category).
// The "Require code scanning results" merge gate compares CONFIGURATIONS (tool +
// category) between the base branch and the PR; the per-project multi-run fan-out
// (one config per project) makes the gate report "N configurations not found" and
// block. One run = one config the base and PR both carry -> the gate reconciles.
//
// It reuses the CLI's own multi-tsConfig union (ENG-01): one invocation with
// every project's leaf tsconfigs (`-c leafA -c leafB ...`) unions all diagnostics
// into ONE report -> ONE SARIF run whose results[] span all projects (each result
// keeps its repo-relative artifactLocation.uri, so per-project mapping is
// preserved). This is also the natural single-project consumer pattern:
//   npx angular-typechecker -c <all tsconfigs> --format sarif
//
// The single stable category is applied by the upload step's `category` input.
// Run from the repo ROOT so artifactLocation URIs stay repo-relative.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listTypecheckProjects } from './list-typecheck-projects.mjs';

const BIN = 'dist/packages/angular-typechecker/src/cli/bin.js';
const OUTPUT = 'angular-typechecker.sarif';

/**
 * Flatten every discovered project's leaf tsConfigs into one CLI arg list.
 * @param {string} root
 * @returns {string[]} `-c <leaf>` ... across ALL projects, then --format sarif
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

// CLI entry: one invocation over all leaves, write the single run.
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

  writeFileSync(
    OUTPUT,
    JSON.stringify({ version: doc.version, $schema: doc.$schema, runs: [run] }),
  );
}
