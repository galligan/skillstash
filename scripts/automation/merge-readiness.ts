#!/usr/bin/env bun

/**
 * Merge Readiness Check
 *
 * Validates that a skill PR is ready for auto-merge by checking:
 * 1. Branch naming convention (skill/add-*, skill/update-*, skill/remove-*)
 * 2. Required labels exist in the repository
 * 3. Repository has auto-merge enabled
 * 4. Merge settings are correct (squash allowed, merge commits disabled)
 */

type PullRequestEvent = {
  pull_request: {
    number: number;
    head: {
      ref: string;
    };
  };
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

type CheckResult = {
  name: string;
  passed: boolean;
  message: string;
  blocking: boolean;
};

const REQUIRED_LABELS = [
  'skip:research',
  'skip:review',
  'skip:validation',
  'research:deep',
  'review:required',
];

const VALID_BRANCH_PREFIXES = ['skill/add-', 'skill/update-', 'skill/remove-'];

function getEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function run(command: string, args: string[]): { stdout: string; exitCode: number } {
  const result = Bun.spawnSync({
    cmd: [command, ...args],
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    stdout: new TextDecoder().decode(result.stdout).trim(),
    exitCode: result.exitCode ?? 1,
  };
}

function checkBranchNaming(branchName: string): CheckResult {
  const isValid = VALID_BRANCH_PREFIXES.some(prefix => branchName.startsWith(prefix));

  return {
    name: 'Branch naming',
    passed: isValid,
    message: isValid
      ? `Branch \`${branchName}\` follows naming convention`
      : `Branch \`${branchName}\` should start with: ${VALID_BRANCH_PREFIXES.join(', ')}`,
    blocking: true,
  };
}

function checkLabelsExist(repoFullName: string): CheckResult {
  const result = run('gh', ['label', 'list', '--repo', repoFullName, '--json', 'name']);

  if (result.exitCode !== 0) {
    return {
      name: 'Labels configured',
      passed: false,
      message: 'Could not fetch repository labels',
      blocking: false,
    };
  }

  const labels = JSON.parse(result.stdout) as Array<{ name: string }>;
  const labelNames = labels.map(l => l.name);
  const missing = REQUIRED_LABELS.filter(l => !labelNames.includes(l));

  return {
    name: 'Labels configured',
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? 'All required labels are configured'
        : `Missing labels: ${missing.join(', ')}. Run \`bun run labels:setup\``,
    blocking: false,
  };
}

function checkAutoMergeEnabled(repoFullName: string): CheckResult {
  const result = run('gh', [
    'api',
    `repos/${repoFullName}`,
    '--jq',
    '.allow_auto_merge // false',
  ]);

  const enabled = result.stdout === 'true';

  return {
    name: 'Auto-merge enabled',
    passed: enabled,
    message: enabled
      ? 'Repository has auto-merge enabled'
      : 'Enable auto-merge in Settings → General → Pull Requests',
    blocking: false,
  };
}

function checkMergeSettings(repoFullName: string): CheckResult {
  const result = run('gh', [
    'api',
    `repos/${repoFullName}`,
    '--jq',
    '{squash: .allow_squash_merge, merge: .allow_merge_commit, rebase: .allow_rebase_merge}',
  ]);

  if (result.exitCode !== 0) {
    return {
      name: 'Merge settings',
      passed: false,
      message: 'Could not fetch repository settings',
      blocking: false,
    };
  }

  const settings = JSON.parse(result.stdout) as {
    squash: boolean;
    merge: boolean;
    rebase: boolean;
  };

  const issues: string[] = [];
  if (!settings.squash) issues.push('enable squash merging');
  if (settings.merge) issues.push('disable merge commits');

  return {
    name: 'Merge settings',
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'Merge settings are correctly configured'
        : `Recommended: ${issues.join(', ')}`,
    blocking: false,
  };
}

function checkBranchProtection(repoFullName: string): CheckResult {
  const result = run('gh', [
    'api',
    `repos/${repoFullName}/branches/main/protection`,
    '--jq',
    '.required_status_checks.contexts // []',
  ]);

  // 404 means no branch protection
  if (result.exitCode !== 0) {
    return {
      name: 'Branch protection',
      passed: false,
      message: 'No branch protection on main. Consider requiring the `validate` check.',
      blocking: false,
    };
  }

  const contexts = JSON.parse(result.stdout) as string[];
  const hasValidate = contexts.some(c => c.includes('validate'));

  return {
    name: 'Branch protection',
    passed: hasValidate,
    message: hasValidate
      ? 'Branch protection requires validation check'
      : 'Consider adding `validate` as a required status check',
    blocking: false,
  };
}

async function main(): Promise<void> {
  const eventPath = getEnv('GITHUB_EVENT_PATH');
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is not set');
  }

  const raw = await Bun.file(eventPath).text();
  const event = JSON.parse(raw) as PullRequestEvent;

  const branchName = event.pull_request.head.ref;
  const repoFullName = event.repository.full_name;

  console.log(`\n🔍 Checking merge readiness for PR #${event.pull_request.number}\n`);
  console.log(`   Branch: ${branchName}`);
  console.log(`   Repository: ${repoFullName}\n`);

  const checks: CheckResult[] = [
    checkBranchNaming(branchName),
    checkLabelsExist(repoFullName),
    checkAutoMergeEnabled(repoFullName),
    checkMergeSettings(repoFullName),
    checkBranchProtection(repoFullName),
  ];

  let hasBlockingFailure = false;

  console.log('Results:\n');

  for (const check of checks) {
    const icon = check.passed ? '✅' : check.blocking ? '❌' : '⚠️';
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}\n`);

    if (!check.passed && check.blocking) {
      hasBlockingFailure = true;
    }
  }

  const passedCount = checks.filter(c => c.passed).length;
  const warningCount = checks.filter(c => !c.passed && !c.blocking).length;

  console.log('---');
  console.log(`Summary: ${passedCount}/${checks.length} passed`);

  if (warningCount > 0) {
    console.log(`         ${warningCount} warnings (non-blocking)`);
  }

  if (hasBlockingFailure) {
    console.log('\n❌ Merge readiness check failed.\n');
    console.log('See docs/github-settings.md for setup instructions.');
    process.exit(1);
  }

  console.log('\n✅ Merge readiness check passed.\n');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
