# Architecture

How skillstash is organized and how it works.

## Directory Structure

```text
skillstash/
├── skills/                    # All skills live here
│   └── my-skill/
│       ├── SKILL.md           # Required - skill definition
│       ├── references/        # Optional - docs, specs
│       ├── scripts/           # Optional - executable helpers
│       └── assets/            # Optional - templates, configs
├── .skillstash/
│   └── config.yml             # Skillstash configuration
├── .claude-plugin/
│   ├── plugin.json             # Claude plugin manifest
│   └── marketplace.json        # Claude marketplace (this plugin)
├── .agents/
│   ├── rules/AGENTS.md        # Agent instructions
│   ├── skills/                # Internal agent skills
│   └── templates/             # PR/issue templates
├── commands/                  # Claude Code plugin commands
├── docs/                      # This documentation
├── packages/                  # Published tools (npm)
│   └── create-skillstash/      # bunx create-skillstash
└── scripts/                   # Skillstash automation
```

## Internal Agent Skills

Skillstash uses role-specific skills in `.agents/skills/` so agents can be hot-swapped without changing prompts:

- `skillstash-research`
- `skillstash-author`
- `skillstash-review`

## SKILL.md Format

Every skill requires a `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name          # Must match directory name (kebab-case)
description: One-line summary
---

# Skill Name

Content here.
```

### Optional Frontmatter

| Field | Description |
|-------|-------------|
| `version` | Semver (e.g., `1.0.0`) |
| `author` | GitHub username |
| `tags` | Array for categorization |
| `status` | `experimental`, `stable`, `deprecated` |

## Validation

Skills must pass these checks:

| Rule | Requirement |
|------|-------------|
| SKILL.md exists | Required file in skill directory |
| Valid frontmatter | YAML parses, required fields present |
| Name matches | `name` field equals directory name |
| Kebab-case | Directory name: lowercase, hyphens only |
| Max 500 lines | Keeps skills focused |

Run locally:

```bash
bun run validate    # Skill structure
bun run lint:md     # Markdown formatting
```

## Workflows

### Local-First (Default)

1. Create `skills/my-skill/SKILL.md`
2. Save → skill is immediately usable
3. Iterate locally
4. Push when ready for version control

### Issue-Driven

For tracked, automated skill creation:

```text
Issue → Research → Authoring → Validation → Review → Merge
```

1. Open issue with "Create Skill" template
2. Add labels to control workflow (optional)
3. Skillstash creates draft PR
4. Validation runs
5. Review (if required), merge

### Issue Commands

Comment on an issue to trigger actions:

| Command | Action |
|---------|--------|
| `@skillstash research` | Re-run research |
| `@skillstash build` | Re-run authoring |
| `@skillstash review` | Run review |
| `@skillstash merge` | Attempt auto-merge |

## Configuration

`.skillstash/config.yml` controls skillstash behavior:

```yaml
defaults:
  research: minimal      # none | minimal | deep
  review: skip           # skip | optional | required
  auto_merge: true       # Merge when validation passes

agents:
  default: claude        # claude | codex
  roles:
    research: default
    author: default
    review: default

# workflow:
#   - role: research
#     agent: default
#   - role: author
#     agent: default
#   - role: review
#     agent: default

validation:
  required_files: [SKILL.md]
  max_skill_lines: 500
  enforce_kebab_case: true
  required_frontmatter: [name, description]
```

See the config file for full options including MCP servers, rate limits, and GitHub integration.
