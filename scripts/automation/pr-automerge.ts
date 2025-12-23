#!/usr/bin/env bun

import { loadConfig, resolveAutomationMode, resolveReviewMode, shouldAutoMerge } from './lib';

type WorkflowRunEvent = {
  workflow_run: {
    pull_requests: Array<{ number: number }>;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
};

function getEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): string {
  const result = Bun.spawnSync({
    cmd: [command, ...args],
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.exitCode}`);
  }

  return new TextDecoder().decode(result.stdout).trim();
}

async function main(): Promise<void> {
  const eventPath = getEnv('GITHUB_EVENT_PATH');
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is not set');
  }

  const raw = await Bun.file(eventPath).text();
  const event = JSON.parse(raw) as WorkflowRunEvent;

  const pr = event.workflow_run.pull_requests[0];
  if (!pr) {
    console.log('No pull request associated with this workflow run.');
    return;
  }

  const config = await loadConfig();

  const appToken = getEnv('APP_TOKEN');
  const githubToken = getEnv('GITHUB_TOKEN');
  const mode = resolveAutomationMode(config, appToken.length > 0);
  const token = mode === 'app' ? appToken : githubToken;

  if (!token) {
    throw new Error('No GitHub token available');
  }

  const prData = run(
    'gh',
    ['pr', 'view', String(pr.number), '--json', 'labels,number'],
    { GH_TOKEN: token },
  );

  const parsed = JSON.parse(prData) as {
    number: number;
    labels: Array<{ name: string }>;
  };

  const labels = parsed.labels.map(label => label.name);

  if (!shouldAutoMerge(labels, config)) {
    const mode = resolveReviewMode(labels, config);
    console.log(`Auto-merge disabled (review mode: ${mode}).`);
    return;
  }

  run(
    'gh',
    ['pr', 'merge', String(parsed.number), '--auto', '--squash', '--delete-branch'],
    { GH_TOKEN: token },
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
