/**
 * Skill path utilities
 */

import { join } from 'node:path';
import { loadConfig } from '../config/index.js';
import type { WorkflowRole } from '../config/types.js';

/**
 * Get the directory path for a skill
 */
export function skillDirectory(name: string, cwd: string = process.cwd()): string {
  return join(cwd, 'skills', name);
}

/**
 * Get the SKILL.md file path for a skill
 */
export function skillFilePath(name: string, cwd: string = process.cwd()): string {
  return join(skillDirectory(name, cwd), 'SKILL.md');
}

const SKILLSTASH_ROLE_SKILL = {
  research: 'skillstash-research',
  author: 'skillstash-author',
  review: 'skillstash-review',
} as const;

function resolveInternalSkillsDir(value?: string): string {
  if (typeof value !== 'string') {
    return '.agents/skills';
  }
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : '.agents/skills';
}

/**
 * Get the path to a skillstash internal skill
 */
export function skillstashSkillPath(
  role: WorkflowRole,
  cwd: string = process.cwd(),
  internalSkillsDir?: string,
): string {
  const skillName = SKILLSTASH_ROLE_SKILL[role];
  const baseDir = resolveInternalSkillsDir(internalSkillsDir);
  return join(cwd, baseDir, skillName, 'SKILL.md');
}

/**
 * Load a skillstash internal skill content
 */
export async function loadSkillstashSkill(
  role: WorkflowRole,
  cwd: string = process.cwd(),
): Promise<string> {
  const config = await loadConfig(cwd);
  const path = skillstashSkillPath(role, cwd, config.internal_skills_dir);
  return Bun.file(path).text();
}

/**
 * Compose a prompt from a skill and optional context blocks
 */
export async function composePrompt(
  role: WorkflowRole,
  contextBlocks: string[] = [],
  cwd: string = process.cwd(),
): Promise<string> {
  const skill = await loadSkillstashSkill(role, cwd);
  const parts = [skill.trim(), ...contextBlocks.map((block) => block.trim()).filter(Boolean)];
  return parts.join('\n\n');
}
