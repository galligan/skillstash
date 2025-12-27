# skillstash

**File an issue. Agents research, build, and ship skills.**

```text
┌─────────────┐     ┌─────────────────────────────────┐     ┌───────────┐
│ File Issue  │────▶│  Research → Author → Validate   │────▶│  Merged   │
│ "I need X"  │     │         (agent loop)            │     │  & Live   │
└─────────────┘     └─────────────────────────────────┘     └───────────┘
```

## What is this?

A template repo for building your own skill library through GitHub issues. File a skill idea, and skillstash turns it into a vetted `SKILL.md` that’s immediately usable.

**Issue-first**: GitHub issues drive research, authoring, review, and validation.

**Validated**: Linting and structure checks catch mistakes before they spread.

**Composable**: Build a library of skills your agents can discover and use.

**Local-first (optional)**: You can still create `skills/<name>/SKILL.md` manually when you want.

## Get Started

1. **Scaffold a new repo** → `bunx create-skillstash my-skillstash --create-repo`
2. **Set up secrets** → `docs/secrets.md`
3. **File a skill issue** → Use the “Create skill” issue template

## Learn More

| Doc | What it covers |
| --- | -------------- |
| [docs/README.md](./docs/README.md) | Quick start and overview |
| [docs/architecture.md](./docs/architecture.md) | How it all works |
| [docs/faqs.md](./docs/faqs.md) | Common questions |
| [docs/secrets.md](./docs/secrets.md) | LLM tokens and GitHub secrets |

## License

MIT
