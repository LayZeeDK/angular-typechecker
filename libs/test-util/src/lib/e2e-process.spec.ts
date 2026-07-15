import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sh } from './e2e-process';

// A trivial cross-platform always-succeeding command (no shell quoting needed) and
// an always-failing one (node exists, exits non-zero -> execSync throws).
const OK_COMMAND = 'node --version';
const FAILING_COMMAND = 'node -e "process.exit(1)"';

describe('sh install timing (ATC_TIME_INSTALLS)', () => {
  const originalFlag = process.env['ATC_TIME_INSTALLS'];
  const originalOut = process.env['ATC_TIMING_OUT'];

  let workDir: string;
  let timingFile: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'atc-sh-timing-'));
    timingFile = join(workDir, 'timings.jsonl');
    process.env['ATC_TIMING_OUT'] = timingFile;
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env['ATC_TIME_INSTALLS'];
    } else {
      process.env['ATC_TIME_INSTALLS'] = originalFlag;
    }

    if (originalOut === undefined) {
      delete process.env['ATC_TIMING_OUT'];
    } else {
      process.env['ATC_TIMING_OUT'] = originalOut;
    }

    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes no timing file and returns stdout normally when the flag is unset', () => {
    delete process.env['ATC_TIME_INSTALLS'];

    const stdout = sh(OK_COMMAND, { cwd: workDir, env: process.env });

    expect(stdout).toContain('v');
    expect(existsSync(timingFile)).toBe(false);
  });

  it('appends one ok:true JSONL line for a successful command when the flag is set', () => {
    process.env['ATC_TIME_INSTALLS'] = '1';

    sh(OK_COMMAND, { cwd: workDir, env: process.env });

    const lines = readFileSync(timingFile, 'utf8').split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);

    expect(last).toMatchObject({ ok: true, cmd: OK_COMMAND, cwd: workDir });
    expect(typeof last.ms).toBe('number');
    expect(typeof last.ts).toBe('number');
  });

  it('still throws with the command in the message and appends an ok:false line on failure when the flag is set', () => {
    process.env['ATC_TIME_INSTALLS'] = '1';

    expect(() =>
      sh(FAILING_COMMAND, { cwd: workDir, env: process.env }),
    ).toThrow(/node -e/);

    const lines = readFileSync(timingFile, 'utf8').split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);

    expect(last.ok).toBe(false);
    expect(last.cmd).toBe(FAILING_COMMAND);
  });

  it('returns stdout for a successful command even when the timing write fails', () => {
    process.env['ATC_TIME_INSTALLS'] = '1';
    // A path whose parent directory does not exist -> appendFileSync throws ENOENT.
    // The best-effort write must swallow it, not invert the succeeded command.
    process.env['ATC_TIMING_OUT'] = join(
      workDir,
      'missing-dir',
      'timings.jsonl',
    );

    const stdout = sh(OK_COMMAND, { cwd: workDir, env: process.env });

    expect(stdout).toContain('v');
  });

  it('still throws the informative command error (not a bare fs error) when the timing write fails on a failing command', () => {
    process.env['ATC_TIME_INSTALLS'] = '1';
    process.env['ATC_TIMING_OUT'] = join(
      workDir,
      'missing-dir',
      'timings.jsonl',
    );

    expect(() =>
      sh(FAILING_COMMAND, { cwd: workDir, env: process.env }),
    ).toThrow(/node -e/);
  });
});
