/**
 * Config type definitions for Skillstash
 */

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
  internal_skills_dir: string;
  agents: AgentsConfig;
  workflow: WorkflowStep[];
};
