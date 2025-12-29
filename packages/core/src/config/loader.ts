/**
 * Config loader - loads and parses .skillstash/config.yml
 */

import { join } from 'node:path';
import type {
  AgentName,
  DefaultsConfig,
  StashConfig,
  WorkflowRole,
  WorkflowStep,
} from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';

/**
 * Load Skillstash configuration from .skillstash/config.yml
 * Falls back to default config if file doesn't exist
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<StashConfig> {
  const configPath = join(cwd, '.skillstash', 'config.yml');
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    return structuredClone(DEFAULT_CONFIG);
  }

  const raw = await file.text();
  const parsed = (Bun.YAML.parse(raw) ?? {}) as Record<string, unknown>;

  const defaults = (parsed.defaults ?? {}) as Record<string, unknown>;
  const labels = (parsed.labels ?? {}) as Record<string, unknown>;
  const validation = (parsed.validation ?? {}) as Record<string, unknown>;
  const agents = (parsed.agents ?? {}) as Record<string, unknown>;
  const workflow = parsed.workflow;
  const internalSkillsDir =
    typeof parsed.internal_skills_dir === 'string' ? parsed.internal_skills_dir.trim() : '';

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
      research:
        (defaults.research as DefaultsConfig['research']) ?? DEFAULT_CONFIG.defaults.research,
      review: (defaults.review as DefaultsConfig['review']) ?? DEFAULT_CONFIG.defaults.review,
      auto_proceed:
        typeof defaults.auto_proceed === 'boolean'
          ? defaults.auto_proceed
          : DEFAULT_CONFIG.defaults.auto_proceed,
    },
    labels: {
      skip_research: (labels.skip_research as string) ?? DEFAULT_CONFIG.labels.skip_research,
      skip_review: (labels.skip_review as string) ?? DEFAULT_CONFIG.labels.skip_review,
      skip_validation: (labels.skip_validation as string) ?? DEFAULT_CONFIG.labels.skip_validation,
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
    internal_skills_dir:
      internalSkillsDir !== '' ? internalSkillsDir : DEFAULT_CONFIG.internal_skills_dir,
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

function normalizeDefaultAgent(value: unknown, fallback: AgentName): AgentName {
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
    .map((item) => {
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
