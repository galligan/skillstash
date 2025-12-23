# Local-First Workflow

The local-first workflow lets you create and use skills immediately—zero latency, no waiting for CI, no merge delays. You write the skill, save it, and start using it in the same session.

## What "Local-First" Means

**Zero latency.** The skill is usable the moment you save the file. Claude Code discovers it automatically from your local directory.

**Immediately usable.** No git push required. No PR review. No waiting for CI to complete. Write it, use it, iterate.

**Async validation.** When you're ready, push to GitHub and validation runs in the background. You're already using the skill—validation is just a safety check for permanence.

## One-Time Setup

### 1. Clone the Repository

```bash
# Clone your skills-factory instance
git clone https://github.com/yourusername/skills-factory.git
cd skills-factory
```

### 2. How Claude Code Discovers Skills

Claude Code automatically discovers skills from this directory through:

- **Root instructions** (`AGENTS.md`, `CLAUDE.md`) that reference the factory instructions
- **Factory instructions** (`.agents/rules/AGENTS.md`) that tell agents how to discover and use skills
- **Skills directory** (`skills/`) containing individual skill definitions

No configuration needed—just clone and start creating.

## Creating a Skill

### 1. Create the Skill Directory

```bash
# Use kebab-case for skill names
mkdir -p skills/my-skill
```

### 2. Create SKILL.md

Every skill requires a `SKILL.md` file with frontmatter and instructions:

```markdown
---
name: my-skill
description: Brief description of what this skill does
---

# My Skill

Detailed instructions for the agent.

## When to Use This Skill

Describe the trigger conditions—when should the agent invoke this skill?

## How to Use This Skill

Step-by-step instructions for the agent:

1. First step
2. Second step
3. Third step

## Examples

### Example 1: Common Use Case

\```
Input: User asks for X
Action: Agent does Y
Output: Z
\```

## Notes

- Any caveats or important considerations
- Edge cases to handle
- Best practices
```

### 3. Required Frontmatter

At minimum, every skill needs:

```yaml
---
name: skill-name           # Must match the directory name (kebab-case)
description: What the skill does  # One-line summary for agent discovery
---
```

Optional frontmatter fields:

```yaml
---
name: skill-name
description: What the skill does
version: 1.0.0            # Semantic version
author: Your Name         # Skill author
tags: [tag1, tag2]        # Categorization tags
---
```

### 4. Basic Structure

A well-structured skill typically includes:

- **Name and description** (frontmatter)
- **When to use** (trigger conditions)
- **How to use** (step-by-step instructions)
- **Examples** (concrete use cases)
- **Notes** (caveats, edge cases)

Optional sections:

- **Prerequisites** (dependencies, setup required)
- **Configuration** (customization options)
- **Troubleshooting** (common issues)

## Using Immediately

### The Magic: Zero Latency

As soon as you save `skills/my-skill/SKILL.md`, the skill is available:

```bash
# Save the file
# That's it. The skill is now discoverable.
```

Claude Code reads from your local `skills/` directory in real-time. No restart required. No plugin refresh. Just save and use.

### Testing Your Skill

Open a new Claude Code session and:

1. **Reference the skill** in your prompt:

   ```text
   "Use the my-skill workflow to..."
   ```

2. **Check if it's discovered**:

   ```text
   "What skills are available for [topic]?"
   ```

3. **Iterate rapidly**:
   - Edit `SKILL.md`
   - Save
   - Test again
   - Repeat

### Local Iteration Loop

```text
Edit skill → Save → Test → Edit skill → Save → Test
  ↑                                              ↓
  └──────────────── Instant feedback ────────────┘
```

No waiting. No friction. Pure flow.

## Pushing for Permanence

### When You're Ready

Once your skill works locally, push it for version control and validation:

```bash
# Create a branch
git checkout -b add-my-skill

# Commit your skill
git add skills/my-skill/
git commit -m "Add my-skill for [purpose]"

# Push to GitHub
git push origin add-my-skill
```

### What Happens Next

1. **Validation runs** (GitHub Actions):
   - Markdown linting
   - Frontmatter validation
   - Structure checks
   - Naming conventions

2. **CI gives feedback**:
   - Pass: Ready to merge
   - Fail: Fix issues and push again

3. **You keep using the skill**:
   - Validation is non-blocking
   - You're already using it locally
   - CI just ensures it's production-ready

### Merge to Main

```bash
# Open a PR on GitHub
gh pr create --title "Add my-skill" --body "Adds skill for [purpose]"

# Or merge directly if you're confident
git checkout main
git merge add-my-skill
git push origin main
```

Once merged to main:

- **Skill is versioned** (in git history)
- **Validated** (passed CI checks)
- **Permanent** (part of the official catalog)
- **Shareable** (others can pull and use)

## Non-Blocking Philosophy

The key insight: **validation doesn't block usage.**

```text
Traditional workflow:
Write → Commit → Push → Wait for CI → Merge → Pull → Use
                         ↑
                    Blocked here

Local-first workflow:
Write → Use immediately → Push async → Validation runs
        ↑                              ↓
        Already using it          Ensures quality
```

You optimize for **time to value** (instant) while maintaining **quality assurance** (async validation).

## Advanced: Optional Supporting Files

Skills can include additional files:

```text
skills/my-skill/
├── SKILL.md              # Required
├── references/           # Optional: external docs, API specs
│   └── api-reference.md
├── scripts/              # Optional: executable helpers
│   └── helper.sh
└── assets/               # Optional: templates, images
    └── template.json
```

Reference these from `SKILL.md`:

```markdown
## Configuration Template

See `assets/template.json` for a starter configuration.

## Helper Script

Run `scripts/helper.sh` to automate setup.
```

## Example: Complete Skill

Here's a complete example for a hypothetical "debug-performance" skill:

```markdown
---
name: debug-performance
description: Systematic performance debugging workflow for web applications
version: 1.0.0
tags: [debugging, performance, profiling]
---

# Debug Performance

A structured workflow for diagnosing and fixing performance issues in web applications.

## When to Use This Skill

Use this skill when:

- Page load times exceed 3 seconds
- User reports "slow" or "laggy" experience
- Lighthouse scores drop below 80
- Bundle sizes grow unexpectedly

## How to Use This Skill

### 1. Measure First

- Run Lighthouse audit
- Check bundle size with `npx vite-bundle-visualizer`
- Profile runtime with Chrome DevTools

### 2. Identify Bottlenecks

- Largest Contentful Paint (LCP) issues
- Long tasks blocking main thread
- Unnecessary re-renders (React)
- Large bundle chunks

### 3. Apply Fixes

- Code splitting at route boundaries
- Lazy load heavy components
- Optimize images (WebP, compression)
- Memoize expensive computations
- Remove unused dependencies

### 4. Verify Impact

- Re-run Lighthouse
- Compare before/after metrics
- Test on slow network (3G throttling)

## Examples

### Example 1: Bundle Size Reduction

\```
Problem: Bundle size is 800KB (gzipped)
Analysis: vite-bundle-visualizer shows moment.js is 200KB
Fix: Replace moment.js with date-fns
Result: Bundle reduced to 600KB
\```

### Example 2: Slow LCP

\```
Problem: LCP is 4.5s
Analysis: Hero image is 2MB PNG
Fix: Convert to WebP, add size attributes, preload
Result: LCP reduced to 2.1s
\```

## Notes

- Always measure before optimizing
- Focus on metrics that impact users (Core Web Vitals)
- Don't sacrifice maintainability for marginal gains
- Profile in production mode, not dev

## References

See `references/web-vitals.md` for Core Web Vitals targets.
```

## Workflow Comparison

### Local-First (This Doc)

```text
You → Create locally → Use immediately → Push when ready
                       ↓
                   Zero latency
```

**Best for:**

- Rapid iteration
- Personal skills
- Experimentation
- Immediate needs

### Issue-Driven (See issue-driven-workflow.md)

```text
You → File issue → Agent creates skill → Merge → Pull → Use
                   ↓
               5-10 minutes, hands-off
```

**Best for:**

- Delegating research
- Complex external topics
- Team collaboration
- Hands-off creation

## Next Steps

1. **Create your first skill** following the structure above
2. **Test it locally** in a Claude Code session
3. **Push when satisfied** to trigger validation
4. **Explore the issue-driven workflow** for automated creation

## Troubleshooting

### Skill Not Discovered

- Check that `SKILL.md` exists and has frontmatter
- Verify skill name matches directory name (kebab-case)
- Ensure `skills/` directory is at repo root
- Restart Claude Code if needed (rare)

### Validation Fails on Push

- Run `bun run validate` locally to catch issues early
- Check frontmatter schema (name and description required)
- Review validation rules in `.skills-factory/config.yml` and `scripts/lint/lint-skills.ts`
- Read CI logs for specific errors

### Skill Works Locally but Not After Merge

- This shouldn't happen—local and remote use the same format
- If it does: file an issue on skills-factory repo
- Workaround: keep using locally while debugging

## Summary

**Local-first = Speed.**

You write skills, save them, and use them immediately. No waiting. No ceremony. Just creation and iteration.

When you're ready, push for validation and permanence. But you're already using the skill by then—validation is just a quality gate, not a blocker.

This is the fastest path from idea to working skill.
