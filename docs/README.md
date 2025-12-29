# Skillstash Documentation

This is a skillstash instance for creating, managing, and distributing AI agent skills.

## Quick Start

**Scaffold a new repo (recommended):**

```bash
bunx create-skillstash my-skillstash
```

Create a GitHub repo automatically (requires `gh`):

```bash
bunx create-skillstash my-skillstash --create-repo --public
```

**Create a skill locally (fastest):**

```bash
mkdir -p skills/my-skill
cat > skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: What this skill does
---

# My Skill

Instructions for the agent.
EOF
```

The skill is immediately usable. No push required.

**Validate before committing:**

```bash
bun run validate    # Check skill structure
bun run lint:md     # Check markdown formatting
```

## Documentation

| Document | Purpose |
| -------- | ------- |
| [architecture.md](./architecture.md) | System design, directory structure, configuration |
| [faqs.md](./faqs.md) | Common questions, labels, troubleshooting |
| [github-settings.md](./github-settings.md) | Recommended GitHub repo settings and branch protection |
| [secrets.md](./secrets.md) | LLM tokens and GitHub Actions secrets |

## Key Concepts

- **Local-first**: Skills work immediately after saving, no git push needed
- **Validated**: Automated checks enforce quality and consistency
- **SKILL.md**: Every skill has one, with YAML frontmatter for discovery

## Related Files

| File | Purpose |
| ---- | ------- |
| `.agents/rules/AGENTS.md` | Full agent instructions and validation rules |
| `.skillstash/config.yml` | Skillstash configuration |
| `src/skillstash/skills/skillstash-management/SKILL.md` | Internal skill for working with this repo |
