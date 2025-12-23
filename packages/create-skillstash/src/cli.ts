#!/usr/bin/env bun
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

interface Options {
  template: string;
  marketplace?: string;
  ownerName?: string;
  ownerEmail?: string;
  origin?: string;
  upstream: boolean;
  createRepo: boolean;
  createRepoTarget?: string;
  visibility: 'public' | 'private';
  defaultAgent: 'claude' | 'codex';
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}

const { target, options } = parseArgs(args);

if (!target) {
  console.error('Error: target directory is required.');
  printHelp();
  process.exit(1);
}

const targetPath = resolve(process.cwd(), target);

if (existsSync(targetPath) && !isEmptyDir(targetPath)) {
  console.error(`Error: ${targetPath} already exists and is not empty.`);
  process.exit(1);
}

const templateUrl = normalizeTemplateUrl(options.template);

run('git', ['clone', templateUrl, targetPath]);

const repoName = basename(targetPath);
const marketplaceName = options.marketplace ?? toKebab(repoName);
const ownerName = options.ownerName ?? readGitConfig('user.name') ?? 'Skillstash';
const ownerEmail = options.ownerEmail ?? readGitConfig('user.email') ?? undefined;
let originUrl = options.origin;
const defaultAgent = options.defaultAgent;
const explicitRepoSlug = options.createRepoTarget;

if (options.createRepo) {
  originUrl = await createRepoWithGh(repoName, options.visibility, options.createRepoTarget);
}

await updatePluginManifest(targetPath, ownerName, ownerEmail);
await updateMarketplace(targetPath, marketplaceName, ownerName, ownerEmail);
await updateDefaultAgent(targetPath, defaultAgent);
await updateClaudeSettings(targetPath, resolveRepoSlug(explicitRepoSlug, originUrl));

await updateGitRemotes(targetPath, templateUrl, originUrl, options.upstream);

console.log('\nSkillstash ready:');
console.log(`  cd ${target}`);
if (originUrl) {
  console.log('  git push -u origin main');
} else {
  console.log('  git remote add origin https://github.com/<owner>/<repo>.git');
  console.log('  git push -u origin main');
}

if (defaultAgent === 'claude') {
  console.log('\nNext: configure Claude credentials for automation.');
  console.log('  See docs/secrets.md → Claude Code Authentication');
} else {
  console.log('\nNext: configure Codex credentials for automation.');
  console.log('  See docs/secrets.md → Codex Authentication');
}

function printHelp() {
  console.log(`\ncreate-skillstash <dir> [options]\n\nOptions:\n  --template <owner/repo|url>   Template repo (default: galligan/skillstash)\n  --marketplace <name>          Marketplace name (default: <dir> in kebab-case)\n  --owner-name <name>           Marketplace owner name (default: git user.name)\n  --owner-email <email>         Marketplace owner email (default: git user.email)\n  --origin <owner/repo|url>     Set origin remote (GitHub shorthand supported)\n  --create-repo [owner/repo]    Create GitHub repo via gh and set origin\n  --public                      Create GitHub repo as public (default)\n  --private                     Create GitHub repo as private\n  --default-agent <name>        Set default agent (claude | codex)\n  --upstream                    Keep template as upstream (default: true)\n  --no-upstream                 Remove template remote after clone\n  -h, --help                    Show this help\n`);
}

function parseArgs(argv: string[]): { target: string | null; options: Options } {
  const options: Options = {
    template: 'galligan/skillstash',
    upstream: true,
    createRepo: false,
    visibility: 'public',
    defaultAgent: 'claude',
  };
  let target: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg.startsWith('--create-repo=')) {
      options.createRepo = true;
      const value = arg.split('=')[1];
      if (value) {
        options.createRepoTarget = value;
      }
      continue;
    }

    if (arg.startsWith('--default-agent=')) {
      const value = arg.split('=')[1];
      if (value !== 'claude' && value !== 'codex') {
        console.error('Error: --default-agent must be "claude" or "codex".');
        process.exit(1);
      }
      options.defaultAgent = value as 'claude' | 'codex';
      continue;
    }

    if (!arg.startsWith('-') && !target) {
      target = arg;
      continue;
    }

    switch (arg) {
      case '--template':
      case '-t':
        options.template = argv[++i] ?? options.template;
        break;
      case '--marketplace':
        options.marketplace = argv[++i];
        break;
      case '--owner-name':
        options.ownerName = argv[++i];
        break;
      case '--owner-email':
        options.ownerEmail = argv[++i];
        break;
      case '--origin':
        options.origin = argv[++i];
        break;
      case '--create-repo':
        options.createRepo = true;
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          options.createRepoTarget = argv[++i];
        }
        break;
      case '--public':
        options.visibility = 'public';
        break;
      case '--private':
        options.visibility = 'private';
        break;
      case '--default-agent': {
        const value = argv[++i];
        if (value !== 'claude' && value !== 'codex') {
          console.error('Error: --default-agent must be "claude" or "codex".');
          process.exit(1);
        }
        options.defaultAgent = value;
        break;
      }
      case '--upstream':
        options.upstream = true;
        break;
      case '--no-upstream':
        options.upstream = false;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (options.createRepo && options.origin) {
    console.error('Error: --create-repo cannot be used with --origin.');
    process.exit(1);
  }

  return { target, options };
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

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
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
  try {
    const value = execSync(`git config --get ${key}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function createRepoWithGh(
  repoName: string,
  visibility: 'public' | 'private',
  explicitTarget?: string,
): Promise<string> {
  if (!hasGh()) {
    console.error('Error: gh CLI is required for --create-repo. Install from https://cli.github.com/.');
    process.exit(1);
  }
  if (!ghAuthed()) {
    console.error('Error: gh is not authenticated. Run `gh auth login` and retry.');
    process.exit(1);
  }

  let owner: string | null = null;
  let finalRepoName = repoName;

  if (explicitTarget) {
    if (!explicitTarget.includes('/')) {
      console.error('Error: --create-repo expects "owner/repo" when a value is provided.');
      process.exit(1);
    }
    const [explicitOwner, explicitRepo] = explicitTarget.split('/');
    if (!explicitOwner || !explicitRepo) {
      console.error('Error: --create-repo expects "owner/repo" when a value is provided.');
      process.exit(1);
    }
    owner = explicitOwner;
    finalRepoName = explicitRepo;
  } else {
    owner = ghUserLogin();
    if (!owner) {
      console.error('Error: unable to determine GitHub user via `gh api user`.');
      process.exit(1);
    }
  }

  const visibilityFlag = visibility === 'private' ? '--private' : '--public';
  run('gh', ['repo', 'create', `${owner}/${finalRepoName}`, visibilityFlag, '--confirm']);

  return `https://github.com/${owner}/${finalRepoName}.git`;
}

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

async function updateClaudeSettings(root: string, repoSlug: string | undefined) {
  const path = join(root, '.claude', 'settings.json');
  if (!existsSync(path)) return;

  try {
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    const marketplaces = (data.extraKnownMarketplaces as Record<string, unknown>) ?? {};
    const skillstashMarketplace = (marketplaces.skillstash as Record<string, unknown>) ?? {};
    const source = (skillstashMarketplace.source as Record<string, unknown>) ?? {};

    if (repoSlug) {
      source.source = 'github';
      source.repo = repoSlug;
      skillstashMarketplace.source = source;
      marketplaces.skillstash = skillstashMarketplace;
      data.extraKnownMarketplaces = marketplaces;
    }

    const enabledPlugins = (data.enabledPlugins as Record<string, unknown>) ?? {};
    enabledPlugins['skillstash@skillstash'] = true;
    data.enabledPlugins = enabledPlugins;

    await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch {
    // Skip if settings.json is not valid JSON.
  }
}

async function updatePluginManifest(root: string, ownerName: string, ownerEmail?: string) {
  const path = join(root, '.claude-plugin', 'plugin.json');
  if (!existsSync(path)) return;

  const raw = await readFile(path, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const author: Record<string, string> = { name: ownerName };
  if (ownerEmail) author.email = ownerEmail;
  data.author = author;

  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function updateMarketplace(root: string, marketplace: string, ownerName: string, ownerEmail?: string) {
  const path = join(root, '.claude-plugin', 'marketplace.json');
  if (!existsSync(path)) return;

  const raw = await readFile(path, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;

  data.name = marketplace;

  const owner: Record<string, string> = { name: ownerName };
  if (ownerEmail) owner.email = ownerEmail;
  data.owner = owner;

  if (Array.isArray(data.plugins)) {
    data.plugins = data.plugins.map(plugin => {
      if (!plugin || typeof plugin !== 'object') return plugin;
      const updated = { ...plugin } as Record<string, unknown>;
      if (typeof updated.author === 'object' && updated.author) {
        updated.author = { ...(updated.author as Record<string, unknown>), name: ownerName };
        if (ownerEmail) {
          (updated.author as Record<string, unknown>).email = ownerEmail;
        }
      } else {
        const author: Record<string, string> = { name: ownerName };
        if (ownerEmail) author.email = ownerEmail;
        updated.author = author;
      }
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
      run('git', ['-C', root, 'remote', 'set-url', 'origin', normalizedOrigin]);
    } else {
      run('git', ['-C', root, 'remote', 'add', 'origin', normalizedOrigin]);
    }
    if (upstream) {
      if (!hasUpstream) {
        run('git', ['-C', root, 'remote', 'add', 'upstream', templateUrl]);
      }
    }
    return;
  }

  if (upstream) {
    if (hasOrigin && !hasUpstream) {
      run('git', ['-C', root, 'remote', 'rename', 'origin', 'upstream']);
      return;
    }
    if (hasOrigin && hasUpstream) {
      run('git', ['-C', root, 'remote', 'remove', 'origin']);
      return;
    }
    if (!hasOrigin && !hasUpstream) {
      run('git', ['-C', root, 'remote', 'add', 'upstream', templateUrl]);
    }
    return;
  }

  if (hasOrigin) {
    run('git', ['-C', root, 'remote', 'remove', 'origin']);
  }
}
