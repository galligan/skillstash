#!/usr/bin/env bun

/**
 * Skill Validation Script
 *
 * Validates skills in the skills/ directory:
 * - Directory structure (SKILL.md exists, kebab-case naming)
 * - Frontmatter (valid YAML, required fields, name matches folder)
 * - Size limits (SKILL.md under 500 lines)
 *
 * Exit codes:
 * 0 - All validations passed
 * 1 - Validation failures found
 */

import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

/**
 * Validation error with file context
 */
interface ValidationError {
  file: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Frontmatter structure
 */
interface SkillFrontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Validation results for a single skill
 */
interface SkillValidation {
  skillPath: string;
  skillName: string;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Configuration for validation rules
 */
const DEFAULT_CONFIG = {
  skillsDir: 'skills',
  maxLines: 500,
  requiredFiles: ['SKILL.md'],
  requiredFrontmatter: ['name', 'description'],
  enforceKebabCase: true,
} as const;

type RuntimeConfig = {
  skillsDir: string;
  maxLines: number;
  requiredFiles: string[];
  requiredFrontmatter: string[];
  enforceKebabCase: boolean;
};

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
} as const;

/**
 * Check if a directory name follows kebab-case convention
 */
function isKebabCase(name: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

/**
 * Extract and parse frontmatter from SKILL.md content
 */
function extractFrontmatter(content: string): {
  frontmatter: SkillFrontmatter | null;
  error: string | null;
} {
  const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: null,
      error: 'No YAML frontmatter found (must start with --- and end with ---)',
    };
  }

  try {
    const frontmatter = Bun.YAML.parse(match[1]) as SkillFrontmatter;
    return { frontmatter, error: null };
  } catch (err) {
    return {
      frontmatter: null,
      error: `Invalid YAML in frontmatter: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
    ? value
    : fallback;
}

async function loadConfig(): Promise<RuntimeConfig> {
  const configPath = join(process.cwd(), '.skillstash', 'config.yml');
  const fallback: RuntimeConfig = {
    skillsDir: DEFAULT_CONFIG.skillsDir,
    maxLines: DEFAULT_CONFIG.maxLines,
    requiredFiles: [...DEFAULT_CONFIG.requiredFiles],
    requiredFrontmatter: [...DEFAULT_CONFIG.requiredFrontmatter],
    enforceKebabCase: DEFAULT_CONFIG.enforceKebabCase,
  };

  try {
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      return fallback;
    }

    const content = await file.text();
    const parsed = Bun.YAML.parse(content) as {
      validation?: {
        max_skill_lines?: unknown;
        required_files?: unknown;
        required_frontmatter?: unknown;
        enforce_kebab_case?: unknown;
      };
      skills_dir?: unknown;
    };

    const validation = parsed?.validation ?? {};

    return {
      skillsDir:
        typeof parsed?.skills_dir === 'string' && parsed.skills_dir.trim() !== ''
          ? parsed.skills_dir
          : fallback.skillsDir,
      maxLines: asNumber(validation.max_skill_lines, fallback.maxLines),
      requiredFiles: asStringArray(validation.required_files, fallback.requiredFiles),
      requiredFrontmatter: asStringArray(
        validation.required_frontmatter,
        fallback.requiredFrontmatter,
      ),
      enforceKebabCase: asBoolean(validation.enforce_kebab_case, fallback.enforceKebabCase),
    };
  } catch {
    return fallback;
  }
}

/**
 * Count lines in a string
 */
function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Validate a single skill directory
 */
async function validateSkill(
  skillPath: string,
  config: RuntimeConfig,
): Promise<SkillValidation> {
  const skillName = basename(skillPath);
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check kebab-case naming
  if (config.enforceKebabCase && !isKebabCase(skillName)) {
    errors.push({
      file: skillPath,
      message: `Skill directory name '${skillName}' must be kebab-case (lowercase with hyphens)`,
      severity: 'error',
    });
  }

  // Check for SKILL.md (always validate if present)
  const skillMdPath = join(skillPath, 'SKILL.md');
  let skillMdExists = false;

  try {
    await stat(skillMdPath);
    skillMdExists = true;
  } catch {}

  // Check required files
  for (const requiredFile of config.requiredFiles) {
    const requiredPath = join(skillPath, requiredFile);
    try {
      await stat(requiredPath);
    } catch {
      errors.push({
        file: skillPath,
        message: `Missing required file: ${requiredFile}`,
        severity: 'error',
      });
    }
  }

  // If SKILL.md exists, validate its contents
  if (skillMdExists) {
    try {
      const file = Bun.file(skillMdPath);
      const content = await file.text();

      // Check line count
      const lineCount = countLines(content);
      if (lineCount > config.maxLines) {
        errors.push({
          file: skillMdPath,
          message: `SKILL.md has ${lineCount} lines (max: ${config.maxLines})`,
          severity: 'error',
        });
      }

      // Extract and validate frontmatter
      const { frontmatter, error } = extractFrontmatter(content);

      if (error) {
        errors.push({
          file: skillMdPath,
          message: error,
          severity: 'error',
        });
      } else if (frontmatter) {
        // Check required fields
        for (const field of config.requiredFrontmatter) {
          if (!frontmatter[field] || String(frontmatter[field]).trim() === '') {
            errors.push({
              file: skillMdPath,
              message: `Missing or empty required frontmatter field: '${field}'`,
              severity: 'error',
            });
          }
        }

        // Check if name matches folder name
        if (frontmatter.name && frontmatter.name !== skillName) {
          errors.push({
            file: skillMdPath,
            message: `Frontmatter 'name' field ('${frontmatter.name}') must match directory name ('${skillName}')`,
            severity: 'error',
          });
        }
      }
    } catch (err) {
      errors.push({
        file: skillMdPath,
        message: `Failed to read or parse SKILL.md: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  return { skillPath, skillName, errors, warnings };
}

/**
 * Find all skill directories in the skills/ folder
 */
async function findSkills(config: RuntimeConfig): Promise<string[]> {
  const skillsPath = join(process.cwd(), config.skillsDir);

  try {
    await stat(skillsPath);
  } catch {
    // skills/ directory doesn't exist - return empty array
    return [];
  }

  const entries = await readdir(skillsPath, { withFileTypes: true });

  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => join(skillsPath, entry.name));
}

/**
 * Format and print validation results
 */
function printResults(results: SkillValidation[], config: RuntimeConfig): void {
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log(`\n${colors.bold}Skills Validation Report${colors.reset}\n`);

  if (results.length === 0) {
    console.log(`${colors.gray}No skills found in ${config.skillsDir}/${colors.reset}\n`);
    return;
  }

  // Print results for each skill
  for (const result of results) {
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
    const statusIcon = hasIssues ? '✗' : '✓';
    const statusColor = hasIssues ? colors.red : colors.green;

    console.log(`${statusColor}${statusIcon}${colors.reset} ${colors.bold}${result.skillName}${colors.reset}`);

    // Print errors
    for (const error of result.errors) {
      console.log(`  ${colors.red}ERROR${colors.reset} ${error.message}`);
      console.log(`  ${colors.gray}${error.file}${colors.reset}`);
    }

    // Print warnings
    for (const warning of result.warnings) {
      console.log(`  ${colors.yellow}WARN${colors.reset} ${warning.message}`);
      console.log(`  ${colors.gray}${warning.file}${colors.reset}`);
    }

    if (!hasIssues) {
      console.log(`  ${colors.gray}All checks passed${colors.reset}`);
    }

    console.log('');
  }

  // Print summary
  console.log(`${colors.bold}Summary${colors.reset}`);
  console.log(`  Skills checked: ${results.length}`);
  console.log(`  Errors: ${totalErrors > 0 ? colors.red : colors.green}${totalErrors}${colors.reset}`);
  console.log(`  Warnings: ${totalWarnings > 0 ? colors.yellow : colors.green}${totalWarnings}${colors.reset}`);
  console.log('');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const config = await loadConfig();
    const skillPaths = await findSkills(config);
    const results = await Promise.all(skillPaths.map(path => validateSkill(path, config)));

    printResults(results, config);

    const hasErrors = results.some(r => r.errors.length > 0);
    process.exit(hasErrors ? 1 : 0);
  } catch (err) {
    console.error(`${colors.red}${colors.bold}Fatal error:${colors.reset} ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Run the script
main();
