#!/usr/bin/env bun

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface LabelDef {
  name: string;
  color: string;
  description?: string;
}

const args = process.argv.slice(2);
const repo = parseRepoArg(args) ?? (await detectRepo());

if (!repo) {
  console.error('Error: unable to determine repo. Pass --repo owner/repo.');
  process.exit(1);
}

if (!hasGh()) {
  console.error('Error: gh CLI is required. Install from https://cli.github.com/.');
  process.exit(1);
}

if (!ghAuthed()) {
  console.error('Error: gh is not authenticated. Run `gh auth login` and retry.');
  process.exit(1);
}

const labelsPath = join(process.cwd(), '.skillstash', 'labels.json');
const raw = await readFile(labelsPath, 'utf-8');
const labels = JSON.parse(raw) as LabelDef[];

for (const label of labels) {
  const cmd = ['label', 'create', label.name, '--color', label.color, '--repo', repo, '--force'];
  if (label.description) {
    cmd.push('--description', label.description);
  }
  runGh(cmd);
}

console.log(`Done. Ensured ${labels.length} labels on ${repo}.`);

function parseRepoArg(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repo' && argv[i + 1]) {
      return argv[i + 1];
    }
    if (arg.startsWith('--repo=')) {
      return arg.split('=')[1] ?? null;
    }
  }
  return null;
}

async function detectRepo(): Promise<string | null> {
  const result = Bun.spawnSync({
    cmd: ['gh', 'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    stdout: 'pipe',
    stderr: 'ignore',
  });

  if (result.exitCode !== 0) return null;
  const output = result.stdout.toString().trim();
  return output.length > 0 ? output : null;
}

function runGh(args: string[]) {
  const result = Bun.spawnSync({
    cmd: ['gh', ...args],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }
}

function hasGh(): boolean {
  const result = Bun.spawnSync({ cmd: ['gh', '--version'], stdout: 'ignore', stderr: 'ignore' });
  return result.exitCode === 0;
}

function ghAuthed(): boolean {
  const result = Bun.spawnSync({
    cmd: ['gh', 'auth', 'status', '-h', 'github.com'],
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return result.exitCode === 0;
}
