#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';

// ============================================================================
// Output Formatting
// ============================================================================

const fmt = {
  bold: (text: string) => chalk.bold(text),
  dim: (text: string) => chalk.dim(text),
  cmd: (text: string) => chalk.yellow(text),
};

const DEFAULT_TEMPLATE = 'galligan/skillstash';
const TEMPLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'template');

function drawBox(title: string, lines: string[]): string {
  const maxContentWidth = Math.max(title.length, ...lines.map((l) => l.length));
  const innerWidth = maxContentWidth + 2; // 1 padding on each side

  const output: string[] = [];

  // Top border
  output.push(`╭${'─'.repeat(innerWidth)}╮`);

  // Title line (bold)
  const titlePadding = innerWidth - title.length - 1;
  output.push(`│ ${fmt.bold(title)}${' '.repeat(titlePadding)}│`);

  // Content lines
  for (const line of lines) {
    const linePadding = innerWidth - line.length - 1;
    output.push(`│ ${fmt.cmd(line)}${' '.repeat(linePadding)}│`);
  }

  // Bottom border
  output.push(`╰${'─'.repeat(innerWidth)}╯`);

  return output.join('\n');
}

// ============================================================================
// Types
// ============================================================================

interface SetupAnswers {
  directory: string;
  ownerName: string;
  defaultAgent: 'claude' | 'codex';
  createRepo: boolean;
  repoVisibility?: 'public' | 'private';
  setupLabels: boolean;
}

interface Options {
  template: string;
  marketplace?: string;
  ownerName?: string;
  origin?: string;
  upstream: boolean;
  createRepo: boolean;
  createRepoTarget?: string;
  visibility: 'public' | 'private';
  defaultAgent: 'claude' | 'codex';
  setupLabels: boolean;
  interactive: boolean;
}

type TemplateSource = 'bundled' | 'local' | 'remote';

interface TemplateInfo {
  source: TemplateSource;
  path?: string;
  url?: string;
  upstreamRepo: string;
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command()
  .name('create-skillstash')
  .description('Scaffold a Skillstash repository for managing agent skills')
  .version('0.1.0')
  .argument('[directory]', 'Target directory for the new repository')
  .option('-t, --template <repo>', 'Template source (owner/repo, URL, or local path)', DEFAULT_TEMPLATE)
  .option('--marketplace <name>', 'Marketplace name (default: directory in kebab-case)')
  .option('--owner-name <name>', 'Marketplace owner name')
  .option('--origin <repo>', 'Set origin remote (owner/repo or URL)')
  .option('--create-repo [target]', 'Create GitHub repo via gh CLI')
  .option('--public', 'Create GitHub repo as public (default)')
  .option('--private', 'Create GitHub repo as private')
  .option('--default-agent <agent>', 'Default agent (claude or codex)', 'claude')
  .option('--setup-labels', 'Create default GitHub labels')
  .option('--skip-label-setup', 'Skip label setup')
  .option('--upstream', 'Keep template as upstream remote (default: true)')
  .option('--no-upstream', 'Remove upstream remote after setup')
  .option('--no-interactive', 'Skip interactive prompts')
  .action(main);

program.parse();

// ============================================================================
// Main Entry
// ============================================================================

async function main(directory: string | undefined, opts: Record<string, unknown>) {
  const options = parseOptions(opts);

  console.log(`\n${drawBox('Skillstash Repository Setup', [])}\n`);

  // Interactive mode if no directory provided or explicitly enabled
  if (!directory && options.interactive) {
    try {
      const answers = await runInteractiveSetup(options);
      directory = answers.directory;
      options.ownerName = answers.ownerName;
      options.defaultAgent = answers.defaultAgent;
      options.createRepo = answers.createRepo;
      if (answers.repoVisibility) {
        options.visibility = answers.repoVisibility;
      }
      options.setupLabels = answers.setupLabels;
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        console.log('\n\nSetup cancelled.');
        process.exit(0);
      }
      throw err;
    }
  }

  if (!directory) {
    console.error('Error: directory is required. Run with --help for usage.');
    process.exit(1);
  }

  const targetPath = resolve(process.cwd(), directory);

  if (existsSync(targetPath) && !isEmptyDir(targetPath)) {
    console.error(`Error: ${targetPath} already exists and is not empty.`);
    process.exit(1);
  }

  const isLocalTemplate = templateExists(options.template);
  const templateInfo = resolveTemplateInfo(options.template, isLocalTemplate);
  const templateSpinner = ora('Setting up template...').start();
  try {
    if (templateInfo.source === 'bundled') {
      await copyDir(TEMPLATE_ROOT, targetPath);
    } else if (templateInfo.source === 'local') {
      if (!templateInfo.path) {
        throw new Error('Local template path not provided');
      }
      await copyDir(templateInfo.path, targetPath);
    } else {
      if (!templateInfo.url) {
        throw new Error('Template URL not provided');
      }
      runQuiet('git', ['clone', '--depth', '1', templateInfo.url, targetPath]);
    }
    removeGitMetadata(targetPath);
    templateSpinner.succeed('Template ready');
  } catch {
    templateSpinner.fail('Failed to set up template');
    process.exit(1);
  }

  const repoName = basename(targetPath);
  const ownerName = options.ownerName ?? ghUserLogin() ?? readGitConfig('user.name') ?? 'Skillstash';
  const userSlug = ghUserLogin() ?? toKebab(ownerName);
  const marketplaceName = options.marketplace ?? `${userSlug}-skillstash`;
  const pluginName = 'my-skills';
  let originUrl = options.origin;
  const upstreamRepo = templateInfo.upstreamRepo;
  const templateUrl = templateInfo.url ?? normalizeTemplateUrl(upstreamRepo);

  // Setup steps with spinners
  const setupSpinner = ora('Setting up repository...').start();
  try {
    setupSpinner.text = 'Initializing git repository...';
    initGitRepo(targetPath);
    setupSpinner.text = 'Generating workflow files...';
    await generateWorkflows(targetPath, upstreamRepo);
    setupSpinner.text = 'Generating package.json...';
    await generatePackageJson(targetPath, repoName);
    setupSpinner.succeed('Repository configured');
  } catch (err) {
    setupSpinner.fail('Failed to configure repository');
    throw err;
  }

  // Create GitHub repo if requested
  if (options.createRepo) {
    const repoSpinner = ora('Creating GitHub repository...').start();
    try {
      originUrl = await createRepoWithGh(repoName, options.visibility, options.createRepoTarget);
      repoSpinner.succeed(`GitHub repository created: ${originUrl.replace('.git', '')}`);
    } catch {
      repoSpinner.fail('Failed to create GitHub repository');
      process.exit(1);
    }
  }

  // Update manifests
  const manifestSpinner = ora('Updating manifests...').start();
  try {
    await updatePluginManifest(targetPath, pluginName, ownerName);
    await updateMarketplace(targetPath, marketplaceName, ownerName);
    await updateDefaultAgent(targetPath, options.defaultAgent);
    const repoSlug = resolveRepoSlug(options.createRepoTarget, originUrl);
    await updateClaudeSettings(targetPath, repoSlug, marketplaceName, pluginName);
    manifestSpinner.succeed('Manifests updated');

    // Setup labels
    if (options.setupLabels && repoSlug) {
      const labelsSpinner = ora('Setting up GitHub labels...').start();
      try {
        await setupGitHubLabels(targetPath, repoSlug);
        labelsSpinner.succeed('GitHub labels configured');
      } catch {
        labelsSpinner.warn('Could not set up labels (will need to be done manually)');
      }
    }
  } catch (err) {
    manifestSpinner.fail('Failed to update manifests');
    throw err;
  }

  // Update git remotes
  const remotesSpinner = ora('Configuring git remotes...').start();
  try {
    await updateGitRemotes(targetPath, templateUrl, originUrl, options.upstream);
    remotesSpinner.succeed('Git remotes configured');
  } catch {
    remotesSpinner.fail('Failed to configure git remotes');
  }

  // Create initial commit with all setup changes
  const commitSpinner = ora('Creating initial commit...').start();
  try {
    runQuiet('git', ['-C', targetPath, 'add', '-A']);
    runQuiet('git', ['-C', targetPath, 'commit', '-m', 'Initial commit from create-skillstash']);
    commitSpinner.succeed('Initial commit created');
  } catch {
    commitSpinner.warn('Could not create initial commit (no changes or git error)');
  }

  // Print success message
  printSuccess(directory, originUrl);
}

// ============================================================================
// Interactive Setup
// ============================================================================

async function runInteractiveSetup(options: Options): Promise<SetupAnswers> {
  const gitName = readGitConfig('user.name');
  const ghAvailable = hasGh() && ghAuthed();
  const ghUsername = ghAvailable ? ghUserLogin() : null;
  const ownerName = ghUsername ?? gitName ?? 'user';

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'directory',
      message: 'Your skillstash name:',
      default: 'my-skillstash',
      validate: (input: string) => {
        if (!input.trim()) return 'Name is required';
        const path = resolve(process.cwd(), input);
        if (existsSync(path) && !isEmptyDir(path)) {
          return `${path} already exists and is not empty`;
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'createRepo',
      message: 'Create a GitHub repository?',
      default: true,
      when: () => ghAvailable,
    },
    {
      type: 'list',
      name: 'repoVisibility',
      message: 'Repository visibility:',
      choices: [
        { name: 'Public', value: 'public' },
        { name: 'Private', value: 'private' },
      ],
      default: 'public',
      when: (ans: { createRepo?: boolean }) => ans.createRepo,
    },
    {
      type: 'confirm',
      name: 'setupLabels',
      message: 'Set up GitHub labels for skill workflow?',
      default: true,
      when: (ans: { createRepo?: boolean }) => ans.createRepo,
    },
  ]);

  return {
    directory: answers.directory,
    ownerName, // Auto-detected from gh username or git user.name
    defaultAgent: options.defaultAgent,
    createRepo: answers.createRepo ?? false,
    repoVisibility: answers.repoVisibility,
    setupLabels: answers.setupLabels ?? false,
  };
}

// ============================================================================
// Option Parsing
// ============================================================================

function parseOptions(opts: Record<string, unknown>): Options {
  const createRepo = opts.createRepo !== undefined;
  const createRepoTarget = typeof opts.createRepo === 'string' ? opts.createRepo : undefined;

  // Determine visibility
  let visibility: 'public' | 'private' = 'public';
  if (opts.private) visibility = 'private';

  // Determine label setup
  let setupLabels = false;
  if (opts.setupLabels) setupLabels = true;
  if (opts.skipLabelSetup) setupLabels = false;
  if (!opts.setupLabels && !opts.skipLabelSetup && createRepo) setupLabels = true;

  // Validate agent
  const defaultAgent = opts.defaultAgent as string;
  if (defaultAgent !== 'claude' && defaultAgent !== 'codex') {
    console.error('Error: --default-agent must be "claude" or "codex".');
    process.exit(1);
  }

  // Validate conflicting options
  if (createRepo && opts.origin) {
    console.error('Error: --create-repo cannot be used with --origin.');
    process.exit(1);
  }

  return {
    template: opts.template as string,
    marketplace: opts.marketplace as string | undefined,
    ownerName: opts.ownerName as string | undefined,
    origin: opts.origin as string | undefined,
    upstream: opts.upstream !== false,
    createRepo,
    createRepoTarget,
    visibility,
    defaultAgent: defaultAgent as 'claude' | 'codex',
    setupLabels,
    interactive: opts.interactive !== false,
  };
}

// ============================================================================
// Success Output
// ============================================================================

function printSuccess(directory: string, originUrl: string | undefined) {
  console.log(`\n${drawBox('Skillstash repository ready!', [])}`);
  console.log(`\n${fmt.bold('→ Next Steps')}`);
  console.log(`  ${fmt.cmd(`cd ${directory}`)}`);
  console.log(`  ${fmt.cmd('bunx @skillstash/core validate')}  ${fmt.dim('# Validate skills')}`);

  if (originUrl) {
    console.log(`  ${fmt.cmd('git push -u origin main')}`);
  } else {
    console.log(`  ${fmt.cmd('git remote add origin https://github.com/<owner>/<repo>.git')}`);
    console.log(`  ${fmt.cmd('git push -u origin main')}`);
  }

  console.log('');
}

// ============================================================================
// Utility Functions
// ============================================================================

function resolveTemplatePath(template: string): string {
  return resolve(process.cwd(), template);
}

function templateExists(template: string): boolean {
  if (template.startsWith('http://') || template.startsWith('https://') || template.startsWith('git@')) {
    return false;
  }
  const resolved = resolveTemplatePath(template);
  if (!existsSync(resolved)) return false;
  try {
    return statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

function isDefaultTemplate(template: string): boolean {
  return template === DEFAULT_TEMPLATE;
}

function resolveTemplateInfo(template: string, isLocal: boolean): TemplateInfo {
  if (isLocal) {
    return {
      source: 'local',
      path: resolveTemplatePath(template),
      upstreamRepo: DEFAULT_TEMPLATE,
    };
  }

  if (isDefaultTemplate(template)) {
    return {
      source: 'bundled',
      upstreamRepo: DEFAULT_TEMPLATE,
    };
  }

  const url = normalizeTemplateUrl(template);
  return {
    source: 'remote',
    url,
    upstreamRepo: extractRepoFromUrl(url),
  };
}

async function copyDir(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const srcPath = join(source, entry.name);
    const destPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

function removeGitMetadata(root: string) {
  const gitPath = join(root, '.git');
  if (existsSync(gitPath)) {
    rmSync(gitPath, { recursive: true, force: true });
  }
  const gitModules = join(root, '.gitmodules');
  if (existsSync(gitModules)) {
    rmSync(gitModules, { force: true });
  }
}

function initGitRepo(root: string) {
  try {
    runQuiet('git', ['-C', root, 'init', '-b', 'main']);
  } catch {
    runQuiet('git', ['-C', root, 'init']);
    try {
      runQuiet('git', ['-C', root, 'branch', '-M', 'main']);
    } catch {
      // Ignore branch rename failures.
    }
  }
}

function normalizeTemplateUrl(template: string): string {
  if (template.startsWith('http://') || template.startsWith('https://')) {
    return template;
  }
  if (template.startsWith('git@')) {
    return template;
  }
  if (template.endsWith('.git')) {
    return `https://github.com/${template}`;
  }
  return `https://github.com/${template}.git`;
}

function normalizeOriginUrl(origin: string): string {
  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    return origin;
  }
  if (origin.startsWith('git@')) {
    return origin;
  }
  if (/^[^/\s]+\/[^/\s]+$/.test(origin)) {
    return `https://github.com/${origin}.git`;
  }
  return origin.endsWith('.git') ? origin : origin;
}

function extractRepoFromUrl(url: string): string {
  if (/^[^/\s]+\/[^/\s]+$/.test(url.replace(/\.git$/, ''))) {
    return url.replace(/\.git$/, '');
  }
  const httpsMatch = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch?.[1]) {
    return httpsMatch[1];
  }
  const sshMatch = url.match(/git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch?.[1]) {
    return sshMatch[1];
  }
  return DEFAULT_TEMPLATE;
}

function resolveRepoSlug(explicit: string | undefined, origin: string | undefined): string | undefined {
  if (explicit && explicit.includes('/')) {
    return explicit.replace(/\.git$/, '');
  }
  if (!origin) return undefined;
  const trimmed = origin.replace(/\.git$/, '');
  const httpsMatch = trimmed.match(/github\.com[/:]([^/]+\/[^/]+)$/);
  if (httpsMatch?.[1]) return httpsMatch[1];
  return undefined;
}

function runQuiet(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function listRemotes(root: string): string[] {
  const result = spawnSync('git', ['-C', root, 'remote'], { encoding: 'utf-8' });
  if (result.status !== 0) return [];
  const output = result.stdout?.trim();
  if (!output) return [];
  return output.split('\n').map(line => line.trim()).filter(Boolean);
}

function isEmptyDir(path: string): boolean {
  try {
    return readdirSync(path).length === 0;
  } catch {
    return true;
  }
}

function readGitConfig(key: string): string | null {
  const result = spawnSync('git', ['config', '--get', key], { encoding: 'utf-8' });
  if (result.status !== 0) return null;
  const value = result.stdout?.trim();
  return value && value.length > 0 ? value : null;
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// ============================================================================
// GitHub CLI Functions
// ============================================================================

function hasGh(): boolean {
  const result = spawnSync('gh', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function ghAuthed(): boolean {
  const result = spawnSync('gh', ['auth', 'status', '-h', 'github.com'], { stdio: 'ignore' });
  return result.status === 0;
}

function ghUserLogin(): string | null {
  const result = spawnSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf-8' });
  if (result.status !== 0) return null;
  const login = result.stdout?.trim();
  return login && login.length > 0 ? login : null;
}

async function createRepoWithGh(
  repoName: string,
  visibility: 'public' | 'private',
  explicitTarget?: string,
): Promise<string> {
  if (!hasGh()) {
    throw new Error('gh CLI is required. Install from https://cli.github.com/');
  }
  if (!ghAuthed()) {
    throw new Error('gh is not authenticated. Run `gh auth login` first.');
  }

  let owner: string | null = null;
  let finalRepoName = repoName;

  if (explicitTarget) {
    if (!explicitTarget.includes('/')) {
      throw new Error('--create-repo expects "owner/repo" format');
    }
    const [explicitOwner, explicitRepo] = explicitTarget.split('/');
    if (!explicitOwner || !explicitRepo) {
      throw new Error('--create-repo expects "owner/repo" format');
    }
    owner = explicitOwner;
    finalRepoName = explicitRepo;
  } else {
    owner = ghUserLogin();
    if (!owner) {
      throw new Error('Unable to determine GitHub user');
    }
  }

  const visibilityFlag = visibility === 'private' ? '--private' : '--public';
  run('gh', ['repo', 'create', `${owner}/${finalRepoName}`, visibilityFlag]);

  return `https://github.com/${owner}/${finalRepoName}.git`;
}

async function setupGitHubLabels(root: string, repoSlug: string) {
  const labelsPath = join(root, '.skillstash', 'labels.json');
  if (!existsSync(labelsPath)) {
    return;
  }

  const raw = await readFile(labelsPath, 'utf-8');
  const labels = JSON.parse(raw) as Array<{ name: string; color: string; description?: string }>;

  for (const label of labels) {
    const args = ['label', 'create', label.name, '--color', label.color, '--repo', repoSlug, '--force'];
    if (label.description) {
      args.push('--description', label.description);
    }
    try {
      runQuiet('gh', args);
    } catch {
      // Ignore individual label failures
    }
  }
}

// ============================================================================
// Configuration Updates
// ============================================================================

async function updateDefaultAgent(root: string, agent: 'claude' | 'codex') {
  const path = join(root, '.skillstash', 'config.yml');
  if (!existsSync(path)) return;

  const raw = await readFile(path, 'utf-8');
  const lines = raw.split('\n');
  let inAgents = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^\s*agents:\s*$/.test(line)) {
      inAgents = true;
      continue;
    }

    if (inAgents) {
      if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
        continue;
      }
      if (!/^\s+/.test(line)) {
        inAgents = false;
        continue;
      }
      if (/^\s*default:\s*/.test(line)) {
        const commentIndex = line.indexOf('#');
        const comment = commentIndex >= 0 ? line.slice(commentIndex).trim() : '';
        const prefix = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
        const updatedPrefix = prefix.replace(/(default:\s*)([^#\s]+)/, `$1${agent}`);
        lines[i] = updatedPrefix.trimEnd() + (comment ? ` ${comment}` : '');
        break;
      }
    }
  }

  await writeFile(path, lines.join('\n'), 'utf-8');
}

async function updateClaudeSettings(
  root: string,
  repoSlug: string | undefined,
  marketplaceName: string,
  pluginName: string,
) {
  const path = join(root, '.claude', 'settings.json');
  if (!existsSync(path)) return;

  try {
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    // Clear template defaults and set up user's marketplace
    const marketplaces: Record<string, unknown> = {};
    if (repoSlug) {
      marketplaces[marketplaceName] = {
        source: {
          source: 'github',
          repo: repoSlug,
        },
      };
    }
    data.extraKnownMarketplaces = marketplaces;

    // Only enable user's plugin
    data.enabledPlugins = {
      [`${pluginName}@${marketplaceName}`]: true,
    };

    await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch {
    // Skip if settings.json is not valid JSON
  }
}

async function updatePluginManifest(root: string, pluginName: string, ownerName: string) {
  const path = join(root, '.claude-plugin', 'plugin.json');
  if (!existsSync(path)) return;

  const raw = await readFile(path, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  data.name = pluginName;
  data.author = { name: ownerName };

  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function updateMarketplace(root: string, marketplace: string, ownerName: string) {
  const path = join(root, '.claude-plugin', 'marketplace.json');
  if (!existsSync(path)) return;

  const raw = await readFile(path, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;

  data.name = marketplace;
  data.owner = { name: ownerName };

  if (Array.isArray(data.plugins)) {
    data.plugins = data.plugins.map(plugin => {
      if (!plugin || typeof plugin !== 'object') return plugin;
      const updated = { ...plugin } as Record<string, unknown>;
      updated.author = { name: ownerName };
      return updated;
    });
  }

  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function updateGitRemotes(
  root: string,
  templateUrl: string,
  originUrl: string | undefined,
  upstream: boolean,
) {
  const remotes = listRemotes(root);
  const hasOrigin = remotes.includes('origin');
  const hasUpstream = remotes.includes('upstream');

  if (originUrl) {
    const normalizedOrigin = normalizeOriginUrl(originUrl);
    if (hasOrigin) {
      runQuiet('git', ['-C', root, 'remote', 'set-url', 'origin', normalizedOrigin]);
    } else {
      runQuiet('git', ['-C', root, 'remote', 'add', 'origin', normalizedOrigin]);
    }
    if (upstream && !hasUpstream) {
      runQuiet('git', ['-C', root, 'remote', 'add', 'upstream', templateUrl]);
    }
    return;
  }

  if (upstream) {
    if (hasOrigin && !hasUpstream) {
      runQuiet('git', ['-C', root, 'remote', 'rename', 'origin', 'upstream']);
      return;
    }
    if (hasOrigin && hasUpstream) {
      runQuiet('git', ['-C', root, 'remote', 'remove', 'origin']);
      return;
    }
    if (!hasOrigin && !hasUpstream) {
      runQuiet('git', ['-C', root, 'remote', 'add', 'upstream', templateUrl]);
    }
    return;
  }

  if (hasOrigin) {
    runQuiet('git', ['-C', root, 'remote', 'remove', 'origin']);
  }
}

// ============================================================================
// Repository Setup Functions
// ============================================================================

async function generateWorkflows(root: string, upstreamRepo: string) {
  const workflowsDir = join(root, '.github', 'workflows');
  await mkdir(workflowsDir, { recursive: true });

  const validateWorkflow = `name: Validate Skills

on:
  pull_request:
    paths:
      - "skills/**"
  push:
    branches: [main]
    paths:
      - "skills/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ${upstreamRepo}/.github/actions/setup@main

      - uses: ${upstreamRepo}/.github/actions/validate@main
`;

  const issueCreateWorkflow = `name: Issue Create Skill

on:
  issues:
    types: [labeled]

jobs:
  create-skill:
    if: github.event.label.name == 'skill:create'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ${upstreamRepo}/.github/actions/setup@main

      - uses: ${upstreamRepo}/.github/actions/create-skill@main
        with:
          github-token: \${{ github.token }}
`;

  const mergeReadinessWorkflow = `name: Merge Readiness

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - "skills/**"

jobs:
  check-readiness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ${upstreamRepo}/.github/actions/setup@main

      - uses: ${upstreamRepo}/.github/actions/merge-readiness@main
        with:
          github-token: \${{ github.token }}
`;

  const releaseWorkflow = `name: Release Skills

on:
  push:
    branches: [main]
    paths:
      - "skills/**"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: galligan/skills-packager@v1
        with:
          github-token: \${{ github.token }}
`;

  await writeFile(join(workflowsDir, 'validate.yml'), validateWorkflow);
  await writeFile(join(workflowsDir, 'issue-create-skill.yml'), issueCreateWorkflow);
  await writeFile(join(workflowsDir, 'merge-readiness.yml'), mergeReadinessWorkflow);
  await writeFile(join(workflowsDir, 'release.yml'), releaseWorkflow);
}

async function generatePackageJson(root: string, repoName: string) {
  const packageJson = {
    name: toKebab(repoName),
    version: '0.1.0',
    type: 'module',
    description: 'Skills repository powered by Skillstash',
    scripts: {
      validate: 'bunx @skillstash/core validate',
      'lint:md': 'bunx markdownlint-cli2 --config .markdownlint-cli2.jsonc',
      'lint:md:fix': 'bunx markdownlint-cli2 --config .markdownlint-cli2.jsonc --fix',
    },
  };

  await writeFile(join(root, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
}
