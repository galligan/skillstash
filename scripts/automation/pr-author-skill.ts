#!/usr/bin/env bun

import { mkdir, stat, writeFile } from 'node:fs/promises';
import {
  branchName,
  buildSkillMarkdown,
  extractField,
  issueTitleToName,
  loadConfig,
  normalizeSkillName,
  resolveAutomationMode,
  skillDirectory,
  skillFilePath,
} from './lib';

type PullRequestEvent = {
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    head: { ref: string };
    labels: Array<{ name: string }>;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
};

function getEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const result = Bun.spawnSync({
    cmd: [command, ...args],
    env: { ...process.env, ...env },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.exitCode}`);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function parsePrDetails(pr: PullRequestEvent['pull_request']) {
  const body = pr.body ?? '';

  const rawName =
    extractField(body, 'Skill name') ?? issueTitleToName(pr.title) ?? pr.title;
  const description = extractField(body, 'What should this skill do?') ?? '';
  const sources = extractField(body, 'Sources to research (optional)');
  const spec = extractField(body, 'Additional spec (optional)');

  return {
    rawName: rawName.trim(),
    description: description.trim(),
    sources: sources?.trim() ?? null,
    spec: spec?.trim() ?? null,
  };
}

async function main(): Promise<void> {
  const eventPath = getEnv('GITHUB_EVENT_PATH');
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is not set');
  }

  const rawEvent = await Bun.file(eventPath).text();
  const event = JSON.parse(rawEvent) as PullRequestEvent;

  const config = await loadConfig();
  const appToken = getEnv('APP_TOKEN');
  const githubToken = getEnv('GITHUB_TOKEN');
  const mode = resolveAutomationMode(config, appToken.length > 0);
  const token = mode === 'app' ? appToken : githubToken;

  if (!token) {
    throw new Error('No GitHub token available');
  }

  const { rawName, description, sources, spec } = parsePrDetails(event.pull_request);
  const normalized = normalizeSkillName(rawName);

  if (!normalized.name) {
    console.log('No skill name detected; skipping authoring.');
    return;
  }

  if (!description) {
    console.log('No description detected; skipping authoring.');
    return;
  }

  const skillDir = skillDirectory(normalized.name);
  const skillPath = skillFilePath(normalized.name);

  if (await fileExists(skillPath)) {
    console.log('SKILL.md already exists; skipping authoring.');
    return;
  }

  await mkdir(skillDir, { recursive: true });

  const markdown = buildSkillMarkdown({
    name: normalized.name,
    description,
    sources,
    spec,
  });

  await writeFile(skillPath, markdown, 'utf-8');

  run('git', ['config', 'user.name', 'github-actions[bot]']);
  run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  run('git', ['add', skillPath]);
  run('git', ['commit', '-m', `feat(skills): add ${normalized.name}`]);

  const repo = `${event.repository.owner.login}/${event.repository.name}`;
  const remote = `https://x-access-token:${token}@github.com/${repo}.git`;
  run('git', ['remote', 'set-url', 'origin', remote]);

  const branch = event.pull_request.head.ref || branchName(normalized.name);
  run('git', ['push', 'origin', `HEAD:${branch}`]);

  console.log(`Authored ${skillPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
