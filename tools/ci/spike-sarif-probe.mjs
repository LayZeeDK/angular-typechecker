// THROWAWAY spike post-processor (branch spike/code-scanning-alert-probe, DO NOT MERGE).
// Injects two things into angular-typechecker's SARIF so we can empirically test in
// GitHub Code Scanning whether:
//   (1) run.artifacts[] with roles:["analysisTarget"] populates the tool-status
//       "Scanned files" panel for a third-party tool, and
//   (2) rule properties.tags[] + a catalog entry per rule light up the tag:/rule:
//       filters and give TS codes a description.
// Family is derived from the ruleId prefix only (NG8*/TS*/ATC*); the template-vs-TS
// distinction is a known-hard taxonomy problem left for the real feature.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sarifPath = process.argv[2];
const scanRoot = process.argv[3] ?? 'apps/ng-spike-app/src';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);

    if (st.isDirectory()) {
      out.push(...walk(p));
    } else if (/\.(ts|html)$/.test(name)) {
      out.push(p.split('\\').join('/'));
    }
  }

  return out;
}

function familyOf(ruleId) {
  if (ruleId.startsWith('NG8')) {
    return 'extended-diagnostics';
  }

  if (ruleId.startsWith('TS')) {
    return 'typescript';
  }

  if (ruleId.startsWith('ATC')) {
    return 'tool';
  }

  return 'other';
}

const sarif = JSON.parse(readFileSync(sarifPath, 'utf8'));
const run = sarif.runs[0];
const driver = run.tool.driver;
driver.rules = driver.rules ?? [];

// Tag existing (cataloged NG8xxx) rules.
for (const rule of driver.rules) {
  rule.properties = { ...(rule.properties ?? {}), tags: [familyOf(rule.id)] };
}

// Add a catalog entry (with tag + level + description) for every result ruleId that
// has none yet (the TS codes today).
const known = new Set(driver.rules.map((r) => r.id));

for (const result of run.results ?? []) {
  const id = result.ruleId;

  if (id && !known.has(id)) {
    known.add(id);
    driver.rules.push({
      id,
      shortDescription: { text: `${familyOf(id)} diagnostic ${id}` },
      defaultConfiguration: { level: result.level ?? 'warning' },
      properties: { tags: [familyOf(id)] },
    });
  }
}

// Declare the scanned files as analysisTarget artifacts (the Scanned-files probe).
run.artifacts = walk(scanRoot).map((uri) => ({
  location: { uri },
  roles: ['analysisTarget'],
}));

writeFileSync(sarifPath, JSON.stringify(sarif));
console.error(
  `[spike] injected ${run.artifacts.length} analysisTarget artifacts + tagged ${driver.rules.length} rules`,
);
