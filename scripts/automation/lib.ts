#!/usr/bin/env bun

import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

export type DefaultsConfig = {
  research: 'none' | 'minimal' | 'deep';
  review: 'skip' | 'optional' | 'required';
  auto_proceed: boolean;
};

export type LabelsConfig = {
  skip_research: string;
  skip_review: string;
  skip_validation: string;
  deep_research: string;
  require_review: string;
};

export type ValidationConfig = {
  required_files: string[];
  max_skill_lines: number;
  enforce_kebab_case: boolean;
  required_frontmatter: string[];
};

export type AgentName = 'claude' | 'codex';
export type WorkflowRole = 'research' | 'author' | 'review';

export type AgentsConfig = {
  default: AgentName;
  roles: Record<WorkflowRole, string>;
};

export type WorkflowStep = {
  role: WorkflowRole;
  agent: string;
};

export type StashConfig = {
  defaults: DefaultsConfig;
  labels: LabelsConfig;
  validation: ValidationConfig;
  agents: AgentsConfig;
  workflow: WorkflowStep[];
};

const DEFAULT_CONFIG: StashConfig = {
  defaults: {
    research: 'minimal',
    review: 'skip',
    auto_proceed: true,
  },
  labels: {
    skip_research: 'skip:research',
    skip_review: 'skip:review',
    skip_validation: 'skip:validation',
    deep_research: 'research:deep',
    require_review: 'review:required',
  },
  validation: {
    required_files: ['SKILL.md'],
    max_skill_lines: 500,
    enforce_kebab_case: true,
    required_frontmatter: ['name', 'description'],
  },
  agents: {
    default: 'claude',
    roles: {
      research: 'default',
      author: 'default',
      review: 'default',
    },
  },
  workflow: [],
};

export async function loadConfig(): Promise<StashConfig> {
  const configPath = join(process.cwd(), '.skillstash', 'config.yml');

  try {
    await stat(configPath);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }

  const raw = await readFile(configPath, 'utf-8');
  const parsed = (Bun.YAML.parse(raw) ?? {}) as Record<string, unknown>;

  const defaults = (parsed.defaults ?? {}) as Record<string, unknown>;
  const labels = (parsed.labels ?? {}) as Record<string, unknown>;
  const validation = (parsed.validation ?? {}) as Record<string, unknown>;
  const agents = (parsed.agents ?? {}) as Record<string, unknown>;
  const workflow = parsed.workflow;

  const defaultAgent = normalizeDefaultAgent(
    typeof agents.default === 'string' ? agents.default : agents.provider,
    DEFAULT_CONFIG.agents.default,
  );
  const roleOverrides = (agents.roles ?? {}) as Record<string, unknown>;
  const alternateReview =
    typeof agents.alternate_review === 'boolean' ? agents.alternate_review : false;
  const reviewOverride = normalizeRoleAgent(roleOverrides.review);
  const reviewAgent =
    reviewOverride === 'default' && alternateReview
      ? defaultAgent === 'claude'
        ? 'codex'
        : 'claude'
      : reviewOverride;

  return {
    defaults: {
      research: (defaults.research as DefaultsConfig['research']) ?? DEFAULT_CONFIG.defaults.research,
      review: (defaults.review as DefaultsConfig['review']) ?? DEFAULT_CONFIG.defaults.review,
      auto_proceed:
        typeof defaults.auto_proceed === 'boolean'
          ? defaults.auto_proceed
          : DEFAULT_CONFIG.defaults.auto_proceed,
    },
    labels: {
      skip_research: (labels.skip_research as string) ?? DEFAULT_CONFIG.labels.skip_research,
      skip_review: (labels.skip_review as string) ?? DEFAULT_CONFIG.labels.skip_review,
      skip_validation:
        (labels.skip_validation as string) ?? DEFAULT_CONFIG.labels.skip_validation,
      deep_research: (labels.deep_research as string) ?? DEFAULT_CONFIG.labels.deep_research,
      require_review: (labels.require_review as string) ?? DEFAULT_CONFIG.labels.require_review,
    },
    validation: {
      required_files:
        (validation.required_files as string[]) ?? DEFAULT_CONFIG.validation.required_files,
      max_skill_lines:
        typeof validation.max_skill_lines === 'number'
          ? validation.max_skill_lines
          : DEFAULT_CONFIG.validation.max_skill_lines,
      enforce_kebab_case:
        typeof validation.enforce_kebab_case === 'boolean'
          ? validation.enforce_kebab_case
          : DEFAULT_CONFIG.validation.enforce_kebab_case,
      required_frontmatter:
        (validation.required_frontmatter as string[]) ??
        DEFAULT_CONFIG.validation.required_frontmatter,
    },
    agents: {
      default: defaultAgent,
      roles: {
        research: normalizeRoleAgent(roleOverrides.research),
        author: normalizeRoleAgent(roleOverrides.author),
        review: reviewAgent,
      },
    },
    workflow: normalizeWorkflow(workflow),
  };
}

function normalizeDefaultAgent(
  value: unknown,
  fallback: AgentName,
): AgentName {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'codex' || normalized === 'claude' ? normalized : fallback;
}

function normalizeRoleAgent(value: unknown): string {
  if (typeof value !== 'string') {
    return 'default';
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '' ? 'default' : normalized;
}

function normalizeWorkflow(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const role = typeof item.role === 'string' ? item.role.trim().toLowerCase() : '';
      if (role !== 'research' && role !== 'author' && role !== 'review') {
        return null;
      }
      const agent = normalizeRoleAgent(item.agent);
      return { role: role as WorkflowRole, agent };
    })
    .filter((item): item is WorkflowStep => Boolean(item));
}

export function resolveAgent(
  config: StashConfig,
  role: WorkflowRole,
  override?: string,
): AgentName {
  const candidate = override ?? config.agents.roles[role] ?? 'default';
  if (candidate === 'default') {
    return config.agents.default;
  }
  return candidate === 'codex' || candidate === 'claude'
    ? candidate
    : config.agents.default;
}

export function resolveWorkflow(config: StashConfig): Array<{ role: WorkflowRole; agent: AgentName }> {
  const base =
    config.workflow.length > 0
      ? config.workflow
      : (['research', 'author', 'review'] as WorkflowRole[]).map(role => ({
          role,
          agent: config.agents.roles[role] ?? 'default',
        }));

  return base.map(step => ({
    role: step.role,
    agent: resolveAgent(config, step.role, step.agent),
  }));
}

const SKILLSTASH_ROLE_SKILL = {
  research: 'skillstash-research',
  author: 'skillstash-author',
  review: 'skillstash-review',
} as const;

export function skillstashSkillPath(role: WorkflowRole): string {
  const skillName = SKILLSTASH_ROLE_SKILL[role];
  return join(process.cwd(), '.agents', 'skills', skillName, 'SKILL.md');
}

export async function loadSkillstashSkill(role: WorkflowRole): Promise<string> {
  const path = skillstashSkillPath(role);
  return Bun.file(path).text();
}

export async function composePrompt(
  role: WorkflowRole,
  contextBlocks: string[] = [],
): Promise<string> {
  const skill = await loadSkillstashSkill(role);
  const parts = [skill.trim(), ...contextBlocks.map(block => block.trim()).filter(Boolean)];
  return parts.join('\n\n');
}

export function extractField(body: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`###\\s+${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n###\\s|$)`, 'i');
  const match = body.match(pattern);
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  return value === '' ? null : value;
}

export function normalizeSkillName(raw: string): { name: string; changed: boolean } {
  const trimmed = raw.trim();
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return { name: normalized, changed: normalized !== trimmed };
}

export function titleFromKebab(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildSkillMarkdown(options: {
  name: string;
  description: string;
  sources?: string | null;
  spec?: string | null;
}): string {
  const title = titleFromKebab(options.name);
  const lines: string[] = [
    '---',
    `name: ${options.name}`,
    `description: ${options.description}`,
    '---',
    '',
    `# ${title}`,
    '',
    options.description,
    '',
    '## When this skill activates',
    '',
    `- When a user asks for ${options.name} by name`,
    `- When a request aligns with: ${options.description}`,
    '',
    '## What this skill does',
    '',
    `- Provides guidance and workflows related to ${options.description}`,
  ];

  if (options.spec) {
    lines.push('', '## Additional spec', '', options.spec.trim());
  }

  if (options.sources) {
    lines.push('', '## Sources', '', options.sources.trim());
  }

  lines.push('');
  return lines.join('\n');
}

export function resolveReviewMode(
  labels: string[],
  config: StashConfig,
): DefaultsConfig['review'] {
  if (labels.includes(config.labels.require_review)) {
    return 'required';
  }

  if (labels.includes(config.labels.skip_review)) {
    return 'skip';
  }

  return config.defaults.review;
}

export function skillDirectory(name: string): string {
  return join(process.cwd(), 'skills', name);
}

export function skillFilePath(name: string): string {
  return join(skillDirectory(name), 'SKILL.md');
}

export function issueTitleToName(title: string): string | null {
  const match = title.match(/skill:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

export function sanitizeLines(value: string): string {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function isKebabCase(name: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

export type BranchAction = 'add' | 'update' | 'remove';

export function branchName(name: string, action: BranchAction = 'add'): string {
  return `skill/${action}-${name}`;
}

export function fileBasename(path: string): string {
  return basename(path);
}
