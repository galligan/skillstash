#!/usr/bin/env bun

import { loadConfig, resolveAutomationMode, resolveReviewMode } from './lib';

type PullRequestEvent = {
  pull_request: {
    number: number;
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
  const event = JSON.parse(raw) as PullRequestEvent;

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
    ['pr', 'view', String(event.pull_request.number), '--json', 'labels,number'],
    { GH_TOKEN: token },
  );

  const parsed = JSON.parse(prData) as {
    number: number;
    labels: Array<{ name: string }>;
  };

  const labels = parsed.labels.map(label => label.name);
  const reviewMode = resolveReviewMode(labels, config);

  if (reviewMode !== 'required') {
    console.log(`Review not required (mode: ${reviewMode}).`);
    return;
  }

  const repo = `${event.repository.owner.login}/${event.repository.name}`;
  const message = 'Manual review required before merge (label review:required).';

  run(
    'gh',
    ['api', `repos/${repo}/issues/${parsed.number}/comments`, '-f', `body=${message}`],
    { GH_TOKEN: token },
  );

  process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
