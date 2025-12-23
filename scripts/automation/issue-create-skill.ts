#!/usr/bin/env bun

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  branchName,
  buildSkillMarkdown,
  extractField,
  issueTitleToName,
  loadConfig,
  normalizeSkillName,
  resolveAutomationMode,
  sanitizeLines,
  shouldAutoMerge,
  skillDirectory,
  skillFilePath,
} from './lib';

type IssueEvent = {
  issue: {
    number: number;
    title: string;
    body: string | null;
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

function runCapture(command: string, args: string[], env?: NodeJS.ProcessEnv): string {
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function commentIssue(repo: string, issueNumber: number, body: string, token: string) {
  run('gh', ['api', `repos/${repo}/issues/${issueNumber}/comments`, '-f', `body=${body}`], {
    GH_TOKEN: token,
  });
}

function parseIssueDetails(issue: IssueEvent['issue']) {
  const body = issue.body ?? '';

  const rawName =
    extractField(body, 'Skill name') ?? issueTitleToName(issue.title) ?? issue.title;
  const description = extractField(body, 'What should this skill do?') ?? '';
  const sources = extractField(body, 'Sources to research (optional)');
  const spec = extractField(body, 'Additional spec (optional)');

  return {
    rawName: rawName.trim(),
    description: description.trim(),
    sources: sources ? sanitizeLines(sources) : null,
    spec: spec ? spec.trim() : null,
  };
}

async function main(): Promise<void> {
  const eventPath = getEnv('GITHUB_EVENT_PATH');
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is not set');
  }

  const rawEvent = await Bun.file(eventPath).text();
  const event = JSON.parse(rawEvent) as IssueEvent;

  const repo = `${event.repository.owner.login}/${event.repository.name}`;
  const labels = event.issue.labels.map(label => label.name);

  const config = await loadConfig();

  const appToken = getEnv('APP_TOKEN');
  const githubToken = getEnv('GITHUB_TOKEN');
  const automationMode = resolveAutomationMode(config, appToken.length > 0);
  const token = automationMode === 'app' ? appToken : githubToken;

  if (!token) {
    throw new Error('No GitHub token available');
  }

  const { rawName, description, sources, spec } = parseIssueDetails(event.issue);
  const normalized = normalizeSkillName(rawName);

  if (!normalized.name) {
    await commentIssue(
      repo,
      event.issue.number,
      'Unable to determine a valid skill name from the issue. Please provide a kebab-case name.',
      token,
    );
    return;
  }

  if (!description) {
    await commentIssue(
      repo,
      event.issue.number,
      'Please provide a description for this skill. The issue template field "What should this skill do?" is required.',
      token,
    );
    return;
  }

  if (normalized.changed) {
    await commentIssue(
      repo,
      event.issue.number,
      `Normalized skill name to \\`${normalized.name}\\`.`,
      token,
    );
  }

  const skillDir = skillDirectory(normalized.name);
  const skillPath = skillFilePath(normalized.name);

  if (await fileExists(skillPath)) {
    await commentIssue(
      repo,
      event.issue.number,
      `Skill \\`${normalized.name}\\` already exists. No changes applied.`,
      token,
    );
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

  const branch = branchName(normalized.name);

  run('git', ['config', 'user.name', 'github-actions[bot]']);
  run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  run('git', ['checkout', '-b', branch]);
  run('git', ['add', skillPath]);
  run('git', ['commit', '-m', `feat(skills): add ${normalized.name}`]);

  const remote = `https://x-access-token:${token}@github.com/${repo}.git`;
  run('git', ['remote', 'set-url', 'origin', remote]);
  run('git', ['push', '--set-upstream', 'origin', branch]);

  const prTitle = `skill: ${normalized.name}`;
  const prBody = `Generated skill for ${normalized.name}.\n\nCloses #${event.issue.number}.`;
  const prLabels = labels.filter(label => label !== 'skill:create');
  const prArgs = [
    'pr',
    'create',
    '--title',
    prTitle,
    '--body',
    prBody,
    '--base',
    'main',
    '--head',
    branch,
  ];

  for (const label of prLabels) {
    prArgs.push('--label', label);
  }

  run('gh', prArgs, { GH_TOKEN: token });

  if (automationMode === 'builtin') {
    run('bun', ['run', 'validate']);
    try {
      run('bun', ['run', 'lint:md']);
    } catch {
      console.warn('Markdownlint reported issues (warn-only).');
    }

    if (shouldAutoMerge(labels, config)) {
      try {
        const prNumber = runCapture(
          'gh',
          ['pr', 'view', '--json', 'number', '--jq', '.number'],
          {
          GH_TOKEN: token,
        },
        );

        run('gh', ['pr', 'merge', prNumber, '--squash', '--delete-branch'], { GH_TOKEN: token });
      } catch {
        await commentIssue(
          repo,
          event.issue.number,
          'Auto-merge was attempted but failed (likely due to branch protection). Please merge the PR manually.',
          token,
        );
      }
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
