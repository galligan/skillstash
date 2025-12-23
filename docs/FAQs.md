# FAQs

Common questions about skillstash.

## Labels

Labels override defaults in `.skillstash/config.yml` per-issue or per-PR.

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

- Check `auto_merge: true` in config
- Ensure all validations pass
- Review may be required (check labels)
- Branch protection rules may block it
