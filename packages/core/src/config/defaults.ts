/**
 * Default configuration values for Skillstash
 */

import type { StashConfig } from './types.js';

export const DEFAULT_CONFIG: StashConfig = {
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
  internal_skills_dir: '.agents/skills',
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
