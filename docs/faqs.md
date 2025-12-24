# FAQs

Common questions about skillstash.

## Labels

Labels override defaults in `.skillstash/config.yml` per-issue or per-PR.

To set up the default label set in a new repo:

```bash
bun run labels:setup
```

If you scaffold with `create-skillstash --create-repo`, label setup runs automatically unless you pass `--skip-label-setup`.

### Skip Labels

| Label | Effect |
|-------|--------|
| `skip:research` | Bypass research phase |
| `skip:review` | Bypass review phase |
| `skip:validation` | Bypass validation (use carefully) |

### Research Labels

| Label | Effect |
|-------|--------|
| `research:deep` | Extended research for complex topics |

### Review Labels

| Label | Effect |
|-------|--------|
| `review:required` | Force review before merge |

## URL Generation

You can generate pre-filled issue URLs for the "Create Skill" template.

### Manual URL Construction

```text
https://github.com/<owner>/<repo>/issues/new?template=create-skill-with-spec.yml&title=skill:%20my-skill&skill-name=my-skill&description=Describe%20the%20skill&research-depth=Minimal%20(quick%20validation)
```

### LLM Prompt

Ask your LLM to generate a GitHub issue URL with:

- `skill-name` - kebab-case identifier
- `description` - what the skill does
- `sources` - reference URLs (optional)
- `research-depth` - Minimal or Deep

## Claude Plugin

Skillstash ships with a Claude Code plugin manifest at `.claude-plugin/plugin.json`.

Install from GitHub (inside Claude Code):

```text
/plugin marketplace add galligan/skillstash
/plugin install skillstash@skillstash
```

If you scaffolded your own repo with `create-skillstash`, use the marketplace name written in `.claude-plugin/marketplace.json`:

```text
/plugin install skillstash@<your-marketplace-name>
```

Test locally:

```bash
claude --plugin-dir .
```

## Troubleshooting

### Skill Not Discovered

- Verify `SKILL.md` exists with valid frontmatter
- Check `name` field matches directory name exactly
- Ensure directory is under `skills/`
- Restart Claude Code session (rare)

### Validation Fails

```bash
bun run validate    # See specific errors
```

Common causes:

- **Name mismatch**: Directory and `name` field don't match
- **Missing frontmatter**: Add `name` and `description`
- **Too long**: Split skills over 500 lines
- **Invalid YAML**: Check frontmatter syntax

### Markdown Linting Fails

```bash
bun run lint:md     # See specific errors
```

Common cause: Code blocks without language specifier. Use `text` for plain output.

### Research Not Running

- Research only runs when MCP credentials are available
- Check `.skillstash/config.yml` for enabled MCPs
- Verify secrets are configured in GitHub

### Auto-Merge Not Working

- Skillstash relies on GitHub's native auto-merge feature
- Enable auto-merge on your PR through GitHub's UI or API
- Ensure all validations and required checks pass
- Review may be required (check labels and branch protection rules)
- Branch protection rules may block auto-merge
