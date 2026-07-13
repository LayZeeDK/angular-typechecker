#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

// Standalone dev-tool CLI: read the ATC_TIME_INSTALLS JSONL emitted by sh()
// (libs/test-util/src/lib/e2e-process.ts) and print per-(PM x scenario x action)
// install-timing tables. Never imported by product or test code.
//
//   node tools/e2e-timing/aggregate-install-timings.mjs [path-to.jsonl]
//
// Default path = os.tmpdir()/atc-install-timings.jsonl (the sh() default sink).

const inputPath =
  process.argv[2] ?? join(tmpdir(), 'atc-install-timings.jsonl');

function derivePm(cmd, cwd) {
  // ORDER MATTERS. `corepack yarn install` -- the heaviest yarn workload -- leads
  // with the token `corepack`, so a naive leading-token rule would misfile it as
  // corepack/other and corrupt the per-PM yarn total. Special-case yarn FIRST.
  if (/^(corepack yarn|yarn)\b/.test(cmd)) {
    return 'yarn';
  }

  if (/^pnpm\b/.test(cmd)) {
    return 'pnpm';
  }

  if (/^npm\b/.test(cmd)) {
    return 'npm';
  }

  // nx add / ng add / a bare tarball install: the PM is ambient -- read it off the
  // cwd tmp-dir basename prefix (atc-*-yarn / atc-ng-yarn-* / atc-*-pnpm / etc.).
  const name = basename(cwd);

  if (/yarn/.test(name)) {
    return 'yarn';
  }

  if (/pnpm/.test(name)) {
    return 'pnpm';
  }

  return 'npm';
}

function deriveAction(cmd) {
  if (/\bnx add\b/.test(cmd)) {
    return 'nx add';
  }

  if (/\bng add\b/.test(cmd)) {
    return 'ng add';
  }

  if (/@storybook/.test(cmd)) {
    return 'storybook install';
  }

  if (/\.tgz\b/.test(cmd) || /\.tar\.gz\b/.test(cmd)) {
    return /^pnpm\b/.test(cmd) ? 'pnpm add <tgz>' : 'npm install <tgz>';
  }

  if (/^(corepack yarn|yarn) install\b/.test(cmd)) {
    return 'corepack yarn install';
  }

  if (/^pnpm install\b/.test(cmd)) {
    return 'pnpm install';
  }

  if (/^npm install\b/.test(cmd)) {
    return 'npm install';
  }

  return 'other';
}

function deriveScenario(cwd) {
  const name = basename(cwd);

  if (!name.startsWith('atc-')) {
    return name;
  }

  const parts = name.split('-');

  // Drop the trailing random mkdtemp suffix (atc-add-npm-Ab3De9 -> atc-add-npm).
  return parts.length > 1 ? parts.slice(0, -1).join('-') : name;
}

function parseLines(raw) {
  const rows = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '') {
      continue;
    }

    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      process.stderr.write(
        `skipped unparseable line: ${trimmed.slice(0, 80)}\n`,
      );
    }
  }

  return rows;
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((cells) => `| ${cells.join(' | ')} |`).join('\n');

  return `${head}\n${sep}\n${body}`;
}

const rows = parseLines(readFileSync(inputPath, 'utf8'));

if (rows.length === 0) {
  process.stderr.write(`no parseable timing rows in ${inputPath}\n`);
  process.exit(1);
}

const groups = new Map();

for (const row of rows) {
  const cmd = String(row.cmd ?? '');
  const cwd = String(row.cwd ?? '');
  const ms = Number(row.ms ?? 0);
  const pm = derivePm(cmd, cwd);
  const action = deriveAction(cmd);
  const scenario = deriveScenario(cwd);
  const key = `${pm}|${scenario}|${action}`;
  const group = groups.get(key) ?? {
    pm,
    scenario,
    action,
    count: 0,
    total: 0,
    max: 0,
  };

  group.count += 1;
  group.total += ms;
  group.max = Math.max(group.max, ms);
  groups.set(key, group);
}

const detail = [...groups.values()].sort((a, b) => b.total - a.total);

const detailRows = detail.map((group) => [
  group.pm,
  group.scenario,
  group.action,
  String(group.count),
  String(group.total),
  String(Math.round(group.total / group.count)),
  String(group.max),
]);

const perPm = new Map();

for (const group of detail) {
  const entry = perPm.get(group.pm) ?? { pm: group.pm, count: 0, total: 0 };

  entry.count += group.count;
  entry.total += group.total;
  perPm.set(group.pm, entry);
}

const pmRows = [...perPm.values()]
  .sort((a, b) => b.total - a.total)
  .map((entry) => [entry.pm, String(entry.count), String(entry.total)]);

const grandTotal = detail.reduce((sum, group) => sum + group.total, 0);

process.stdout.write('### Install timing by PM x scenario x action\n\n');
process.stdout.write(
  `${mdTable(
    ['PM', 'scenario', 'action', 'count', 'total ms', 'mean ms', 'max ms'],
    detailRows,
  )}\n\n`,
);
process.stdout.write('### Per-PM totals\n\n');
process.stdout.write(`${mdTable(['PM', 'count', 'total ms'], pmRows)}\n\n`);
process.stdout.write(
  `Grand total: ${rows.length} sh() calls, ${grandTotal} ms\n`,
);
