#!/usr/bin/env bun

import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SKILLS_DIR = join(process.cwd(), 'skills');

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findResearchDirs(root: string): Promise<string[]> {
  const results: string[] = [];

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith('.')) {
      continue;
    }

    const skillPath = join(root, entry.name);
    const researchPath = join(skillPath, '.research');

    if (await pathExists(researchPath)) {
      results.push(researchPath);
    }
  }

  return results;
}

async function main(): Promise<void> {
  if (!(await pathExists(SKILLS_DIR))) {
    return;
  }

  const researchDirs = await findResearchDirs(SKILLS_DIR);

  for (const dir of researchDirs) {
    await rm(dir, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
