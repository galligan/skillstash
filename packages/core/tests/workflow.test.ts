import { describe, expect, test } from 'bun:test';
import { branchName, type BranchAction } from '../src/workflow/branch.js';
import { resolveAgent, resolveWorkflow, resolveReviewMode } from '../src/workflow/resolver.js';
import type { StashConfig } from '../src/config/types.js';

const createMockConfig = (overrides?: Partial<StashConfig>): StashConfig => ({
  defaults: {
    research: 'minimal',
    review: 'optional',
    auto_proceed: false,
  },
  labels: {
    skip_research: 'skip-research',
    skip_review: 'skip-review',
    skip_validation: 'skip-validation',
    deep_research: 'deep-research',
    require_review: 'require-review',
  },
  validation: {
    max_skill_lines: 500,
    required_files: ['SKILL.md'],
    required_frontmatter: ['name', 'description'],
    enforce_kebab_case: true,
  },
  internal_skills_dir: '.agents/skills',
  agents: {
    default: 'claude',
    roles: {
      research: 'claude',
      author: 'claude',
      review: 'claude',
    },
  },
  workflow: [],
  ...overrides,
});

describe('branchName', () => {
  test('generates add branch name (default)', () => {
    const name = branchName('my-new-skill');
    expect(name).toBe('skill/add-my-new-skill');
  });

  test('generates add branch name explicitly', () => {
    const name = branchName('my-skill', 'add');
    expect(name).toBe('skill/add-my-skill');
  });

  test('generates update branch name', () => {
    const name = branchName('my-skill', 'update');
    expect(name).toBe('skill/update-my-skill');
  });

  test('generates remove branch name', () => {
    const name = branchName('my-skill', 'remove');
    expect(name).toBe('skill/remove-my-skill');
  });
});

describe('resolveAgent', () => {
  test('returns role agent from config', () => {
    const config = createMockConfig({
      agents: {
        default: 'claude',
        roles: {
          research: 'codex',
          author: 'claude',
          review: 'codex',
        },
      },
    });
    expect(resolveAgent(config, 'research')).toBe('codex');
    expect(resolveAgent(config, 'author')).toBe('claude');
    expect(resolveAgent(config, 'review')).toBe('codex');
  });

  test('returns override when provided', () => {
    const config = createMockConfig();
    expect(resolveAgent(config, 'author', 'codex')).toBe('codex');
  });

  test('returns default agent for unknown override', () => {
    const config = createMockConfig();
    expect(resolveAgent(config, 'author', 'unknown')).toBe('claude');
  });

  test('returns default agent when role is set to default', () => {
    const config = createMockConfig({
      agents: {
        default: 'claude',
        roles: {
          research: 'default',
          author: 'claude',
          review: 'claude',
        },
      },
    });
    expect(resolveAgent(config, 'research')).toBe('claude');
  });
});

describe('resolveWorkflow', () => {
  test('returns configured workflow steps', () => {
    const config = createMockConfig({
      workflow: [
        { role: 'research', agent: 'claude' },
        { role: 'author', agent: 'codex' },
      ],
    });
    const workflow = resolveWorkflow(config);
    expect(workflow).toHaveLength(2);
    expect(workflow[0]).toEqual({ role: 'research', agent: 'claude' });
    expect(workflow[1]).toEqual({ role: 'author', agent: 'codex' });
  });

  test('returns default workflow when not configured', () => {
    const config = createMockConfig();
    const workflow = resolveWorkflow(config);
    expect(workflow).toHaveLength(3);
    expect(workflow.map((w) => w.role)).toEqual(['research', 'author', 'review']);
  });
});

describe('resolveReviewMode', () => {
  test('returns required when require_review label is present', () => {
    const config = createMockConfig();
    expect(resolveReviewMode(['require-review'], config)).toBe('required');
  });

  test('returns skip when skip_review label is present', () => {
    const config = createMockConfig();
    expect(resolveReviewMode(['skip-review'], config)).toBe('skip');
  });

  test('returns default review mode when no labels match', () => {
    const config = createMockConfig({ defaults: { research: 'minimal', review: 'optional', auto_proceed: false } });
    expect(resolveReviewMode([], config)).toBe('optional');
  });

  test('require_review takes precedence over skip_review', () => {
    const config = createMockConfig();
    expect(resolveReviewMode(['skip-review', 'require-review'], config)).toBe('required');
  });
});
