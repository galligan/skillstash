#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const gitDir = join(repoRoot, '.git');
const hooksPath = join(repoRoot, '.githooks');

if (!existsSync(gitDir)) {
  process.exit(0);
}

const gitCheck = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
if (gitCheck.status !== 0) {
  process.exit(0);
}

const result = spawnSync('git', ['config', 'core.hooksPath', hooksPath], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
