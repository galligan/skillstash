# Issue-Driven Workflow

The issue-driven workflow lets you delegate skill creation to the factory. You file an issue and the pipeline handles research, authoring, validation, and PR creation.

## When to use

- You want hands-off creation
- The topic needs research
- You want a tracked, reviewable change

## Flow

```text
Issue → Research Agent → Authoring Agent → Validation → Review Agent → Merge → Available skill
```

## Steps

1. Open a new issue with the **Create Skill** template.
2. Optional: add labels to control research depth or review requirements.
3. The factory opens a draft PR and writes the skill.
4. Validation runs on the PR.
5. Review (if required), then merge.

## Labels

Labels override defaults in `.skills-factory/config.yml`. See `docs/labels.md` for the full list.

## Issue commands

Comment with one of the following to re-run stages:

- `@skills-factory research` — re-run research
- `@skills-factory build` — re-run authoring
- `@skills-factory review` — run review
- `@skills-factory merge` — attempt auto-merge

## Notes

- Research only runs when credentials are available.
- Validation always runs on `skills/**` changes.
- Auto-merge is enabled by default but can be disabled in config.
- GitHub App automation is optional; `github.automation_mode: auto` will use it when credentials are present and fall back to built-in tokens otherwise.
