#!/usr/bin/env bun
/**
 * Rename skills-factory to skillstash
 *
 * This script performs a comprehensive rename of the project,
 * including files, directories, and content.
 */

import { readdir, readFile, writeFile, rename as renameFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { existsSync } from 'node:fs';

interface Change {
  type: 'content' | 'directory' | 'path';
  file: string;
  from: string;
  to: string;
  lineNumber?: number;
  context?: string;
}

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.error('Usage: bun run scripts/rename-project.ts [--dry-run | --execute]');
  process.exit(1);
}

const changes: Change[] = [];

// Files and directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /bun\.lock$/,
  /\.beads\//,
];

// Replacement rules
const CONTENT_REPLACEMENTS = [
  { from: /skills-factory/g, to: 'skillstash' },
  { from: /Skills Factory/g, to: 'Skillstash' },
  { from: /SKILLS FACTORY/g, to: 'SKILLSTASH' },
  { from: /Skills-factory/g, to: 'Skillstash' },
  { from: /\.skills-factory/g, to: '.skillstash' },
  { from: /skills-factory-management/g, to: 'skillstash-management' },
  // Context-specific "factory" replacements
  { from: /factory do the work/g, to: 'stash do the work' },
  { from: /factory workflows/g, to: 'stash workflows' },
  { from: /factory creates/g, to: 'stash creates' },
  { from: /factory behavior/g, to: 'stash behavior' },
  { from: /factory configuration/g, to: 'stash configuration' },
  { from: /factory instructions/g, to: 'stash instructions' },
  { from: /Factory instructions/g, to: 'Stash instructions' },
  { from: /factory do the rest/g, to: 'stash do the rest' },
  { from: /Factory configuration/g, to: 'Stash configuration' },
  { from: /factory responds/g, to: 'stash responds' },
  { from: /Factory creates/g, to: 'Stash creates' },
  { from: /factory machinery/g, to: 'stash machinery' },
  { from: /Factory Automation/g, to: 'Stash Automation' },
  { from: /Factory Maintenance/g, to: 'Stash Maintenance' },
  { from: /@skills-factory/g, to: '@skillstash' },
];

const DIRECTORY_RENAMES = [
  { from: '.skills-factory', to: '.skillstash' },
  { from: 'skills/skills-factory-management', to: '.agents/skills/skillstash-management' },
];

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip patterns
    if (SKIP_PATTERNS.some(pattern => pattern.test(fullPath))) {
      continue;
    }

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function scanContentChanges() {
  const root = process.cwd();

  for await (const file of walkFiles(root)) {
    // Only process text files
    if (!isTextFile(file)) continue;

    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    let hasChanges = false;
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const originalLine = line;

      for (const { from, to } of CONTENT_REPLACEMENTS) {
        if (from.test(line)) {
          line = line.replace(from, to);
          if (line !== originalLine) {
            changes.push({
              type: 'content',
              file: file.replace(root + '/', ''),
              from: originalLine.trim(),
              to: line.trim(),
              lineNumber: i + 1,
            });
            hasChanges = true;
          }
        }
      }

      newLines.push(line);
    }

    if (hasChanges && EXECUTE) {
      await writeFile(file, newLines.join('\n'), 'utf-8');
    }
  }
}

function isTextFile(file: string): boolean {
  const textExtensions = [
    '.md', '.ts', '.js', '.json', '.yml', '.yaml',
    '.txt', '.html', '.css', '.sh', '.bash',
  ];
  return textExtensions.some(ext => file.endsWith(ext));
}

async function renameDirectories() {
  const root = process.cwd();

  for (const { from, to } of DIRECTORY_RENAMES) {
    const fromPath = join(root, from);
    const toPath = join(root, to);

    if (existsSync(fromPath)) {
      changes.push({
        type: 'directory',
        file: from,
        from: from,
        to: to,
      });

      if (EXECUTE) {
        // Ensure parent directory exists
        const parentDir = dirname(toPath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }
        await renameFile(fromPath, toPath);
      }
    }
  }
}

function printChanges() {
  console.log('\n📋 CHANGES SUMMARY\n');

  // Group by type
  const byType = changes.reduce((acc, change) => {
    if (!acc[change.type]) acc[change.type] = [];
    acc[change.type].push(change);
    return acc;
  }, {} as Record<string, Change[]>);

  // Directory renames
  if (byType.directory?.length > 0) {
    console.log('📁 DIRECTORY RENAMES:\n');
    for (const change of byType.directory) {
      console.log(`  ${change.from} → ${change.to}`);
    }
    console.log();
  }

  // Content changes
  if (byType.content?.length > 0) {
    console.log('📝 CONTENT CHANGES:\n');

    // Group by file
    const byFile = byType.content.reduce((acc, change) => {
      if (!acc[change.file]) acc[change.file] = [];
      acc[change.file].push(change);
      return acc;
    }, {} as Record<string, Change[]>);

    for (const [file, fileChanges] of Object.entries(byFile)) {
      console.log(`  ${file} (${fileChanges.length} changes)`);
      for (const change of fileChanges.slice(0, 3)) {
        console.log(`    Line ${change.lineNumber}:`);
        console.log(`      - ${change.from}`);
        console.log(`      + ${change.to}`);
      }
      if (fileChanges.length > 3) {
        console.log(`    ... and ${fileChanges.length - 3} more`);
      }
      console.log();
    }
  }

  console.log(`\n✅ Total changes: ${changes.length}\n`);
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN MODE\n' : '🚀 EXECUTING CHANGES\n');

  console.log('Scanning for content changes...');
  await scanContentChanges();

  console.log('Checking directory renames...');
  await renameDirectories();

  printChanges();

  if (DRY_RUN) {
    console.log('💡 To execute these changes, run:');
    console.log('   bun run scripts/rename-project.ts --execute\n');
  } else {
    console.log('✨ Rename complete!\n');
    console.log('Next steps:');
    console.log('  1. Review the changes with: git status');
    console.log('  2. Run validation: bun run validate');
    console.log('  3. Run markdown linting: bun run lint:md');
    console.log('  4. Commit the changes\n');
  }
}

main().catch(console.error);
