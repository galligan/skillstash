# Skillstash

This is a skillstash instance for creating, managing, and distributing AI agent skills.

## Overview

Skillstash is a local-first system for developing reusable agent capabilities. Skills are self-contained directories in `skills/` that can be installed into any agent environment via symlinks or package managers.

**Core principles:**

- **Local-first**: Skills live in `skills/` directory, versioned with git
- **Validated**: Automated checks ensure quality and consistency
- **Discoverable**: SKILL.md frontmatter enables search and cataloging
- **Composable**: Skills can depend on other skills

## Creating Skills

### Local-First Workflow (Default)

For rapid iteration and immediate testing:

1. **Create skill directory**: `skills/my-skill/`
2. **Write SKILL.md**: Define the skill with proper frontmatter
3. **Implement**: Add code, tests, and documentation
4. **Validate**: Run validation checks (naming, size, format)
5. **Test locally**: Symlink into agent environment and test
6. **Commit**: Add to git when ready

### Issue-Driven Workflow

For tracked work or collaborative development:

1. **Create issue**: Use beads to create a task
2. **Plan**: Document approach in issue design notes
3. **Implement**: Follow local-first workflow
4. **Close issue**: Mark complete when validated and tested

### When to Use Which

- **Local-first**: Quick skills, personal use, rapid prototyping
- **Issue-driven**: Complex skills, team collaboration, tracked work

## SKILL.md Format

Every skill MUST have a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skill-name
description: Brief one-line description of what the skill does
---

# Skill Name

## Purpose

Clear statement of what this skill accomplishes.

## Usage

How to invoke and use this skill.

## Implementation Details

Technical details, limitations, edge cases.

## Examples

Concrete usage examples.
```

### Required Frontmatter Fields

- **name**: Skill identifier (must match directory name)
- **description**: One-line summary

### Optional Frontmatter Fields

- **tags**: Array of descriptive tags for discovery
- **version**: Semver version string
- **author**: Creator's GitHub username
- **dependencies**: Array of other skills this depends on
- **license**: License identifier (defaults to MIT)
- **status**: `experimental`, `stable`, `deprecated`
- **platform**: Array of supported platforms if limited

## Validation Rules

All skills MUST pass these automated checks:

### Naming Conventions

- **Directory name**: kebab-case, alphanumeric + hyphens only
- **SKILL.md name field**: Must match directory name exactly

### Size Constraints

- **Max 500 lines** per SKILL.md
- Rationale: Keeps skills focused and maintainable

### Structure Requirements

- **SKILL.md required**: Must exist with valid frontmatter
- **Frontmatter complete**: All required fields present
- **Valid YAML**: Frontmatter must parse correctly

## Label System

Use labels on issues to control skillstash workflows:

### Skip Labels

- **skip:research** - Skip research phase, proceed directly to implementation
- **skip:review** - Skip peer review, auto-approve after validation

### Depth Labels

- **research:deep** - Extended research phase for complex or novel skills
- **research:quick** - Minimal research, use for simple/well-understood skills

### Review Labels

- **review:required** - Mandatory human review before merge
- **review:security** - Security-focused review needed
- **review:performance** - Performance review needed

### Workflow Labels

- **workflow:experimental** - Experimental skill, may change significantly
- **workflow:breaking** - Breaking changes to existing skill

## Agent Roles & Permissions

### Claude (Primary Developer)

**Permissions:**

- Create and modify skills in `skills/`
- Create and update issues in beads
- Run validation checks
- Commit changes to git
- Create pull requests

**Responsibilities:**

- Implement skills following all validation rules
- Write comprehensive SKILL.md documentation
- Add test coverage
- Follow naming and size constraints

### Codex (Code Reviewer)

**Permissions:**

- Read all skills and issues
- Comment on code quality
- Suggest improvements
- Approve/reject changes

**Responsibilities:**

- Review code for correctness and clarity
- Verify adherence to validation rules
- Check test coverage
- Provide constructive feedback

### Skillstash Automation

**Permissions:**

- Run validation checks
- Update issue statuses
- Tag commits
- Generate reports

**Responsibilities:**

- Enforce validation rules automatically
- Block invalid skills from merging
- Notify on validation failures
- Generate skill catalog

## Skill Development Best Practices

1. **Start simple**: Minimal viable skill first, iterate to add features
2. **Document as you go**: Update SKILL.md with implementation
3. **Test early**: Add tests before implementation is complete
4. **Version deliberately**: Use semver, document breaking changes
5. **Depend wisely**: Minimize dependencies, document them clearly
6. **Tag thoughtfully**: Tags enable discovery, choose carefully
7. **Describe clearly**: Description is first impression, make it count

## Markdown Formatting

**Always specify a language for fenced code blocks.** Use `text` for directory trees or plain output.

| Pattern | Language |
|---------|----------|
| Shell commands | `bash` |
| Directory trees | `text` |
| JSON/YAML | `json` / `yaml` |
| Markdown examples | `markdown` |
| Plain output | `text` |

Blocks without a language specifier will fail `bun run lint:md`.

## Common Workflows

### Creating a New Skill

```bash
# 1. Create directory
mkdir -p skills/my-new-skill

# 2. Create SKILL.md with frontmatter
cat > skills/my-new-skill/SKILL.md << 'EOF'
---
name: my-new-skill
description: Does something useful
---

# My New Skill

[Content here]
EOF

# 3. Implement, test, validate
# 4. Commit when ready
```

### Updating an Existing Skill

1. **Bump version** in frontmatter (follow semver)
2. **Update description** if behavior changes
3. **Add to changelog** or SKILL.md what changed
4. **Update tests** to cover new behavior
5. **Re-validate** before committing

### Deprecating a Skill

1. **Set status**: `status: deprecated` in frontmatter
2. **Document replacement**: Point to alternative skill
3. **Keep in repo**: Don't delete, allows old dependents to work
4. **Remove from catalog**: Exclude from new installations

## Skillstash Maintenance

### Regular Tasks

- **Validate all skills**: Run validation suite periodically
- **Update dependencies**: Keep skill dependencies current
- **Prune deprecated**: Remove old deprecated skills after grace period
- **Catalog refresh**: Regenerate skill catalog for discovery

### Quality Standards

- **All skills validated**: No unvalidated skills in main branch
- **Documentation complete**: Every skill has comprehensive SKILL.md
- **Tests passing**: All skills have passing tests
- **No duplication**: Similar skills should be merged or clearly differentiated

## Integration Points

### Installation

Skills can be installed via:

- **Symlink**: `ln -s /path/to/skills/my-skill ~/.agents/skills/`
- **Copy**: `cp -r skills/my-skill ~/.agents/skills/`
- **Package manager**: Future support for npm/cargo packages

### Discovery

Skills are discoverable via:

- **Catalog**: Generated JSON catalog of all skills
- **Tags**: Search by tags in frontmatter
- **Description**: Full-text search in descriptions
- **Dependencies**: Dependency graph traversal

### Execution

Skills are invoked by:

- **Agent command**: `/skill-name` in agent interface
- **API call**: HTTP API for remote execution
- **CLI**: Command-line invocation for automation

## Troubleshooting

### Validation Failures

**Name mismatch**: Ensure directory name matches SKILL.md `name` field
**Size exceeded**: Split large skills into smaller focused skills
**Missing frontmatter**: Add required YAML frontmatter to SKILL.md
**Invalid YAML**: Check frontmatter syntax with YAML linter

### Common Issues

**Skill not found**: Check symlink or installation path
**Dependency missing**: Install dependent skills first
**Version conflict**: Update dependencies to compatible versions
**Test failures**: Fix broken tests before committing

## Resources

- **Validation script**: `scripts/lint/lint-skills.ts`
