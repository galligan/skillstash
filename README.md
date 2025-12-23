# skills-factory

A GitHub template repo that turns issues into production-ready agent skills through a structured, automated pipeline.

## Why this exists

You want to file an issue like “A skill for the Apple Human Interface Guidelines” and have the factory do the rest. This repo provides the structure and automation to make that possible.

## Quick start

### Local-first (immediate)

1. Create `skills/my-skill/SKILL.md` with frontmatter.
2. Use it immediately in your agent session.
3. Push when ready; validation runs in CI.

See `docs/local-first-workflow.md` for details.

### Issue-driven (async)

1. Open a new issue using the “Create Skill” template.
2. The factory can research, author, validate, and open a PR.
3. Merge to make it available to everyone.

See `docs/issue-driven-workflow.md` for details.

## Validation

Run locally:

```bash
bun run validate
```

Markdownlint config lives in `.markdownlint-cli2.jsonc`.

## Automation mode

By default, the factory uses built-in `GITHUB_TOKEN` credentials. If a GitHub App is configured, it will switch to App tokens automatically when `github.automation_mode` is set to `auto` in `.skills-factory/config.yml`.

## Pre-commit formatting

Markdown fixes run on pre-commit via `.githooks/pre-commit`. If the hook is not installed automatically, run:

```bash
bun run hooks:install
```

## Repo layout

```
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── skills/
├── docs/
├── .skills-factory/config.yml
├── .agents/
├── .github/
├── scripts/
└── .markdownlint-cli2.jsonc
```

## License

MIT
