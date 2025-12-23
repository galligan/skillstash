# skillstash

**Turn ideas into agent skills in seconds.**

```bash
mkdir -p skills/react-testing
cat > skills/react-testing/SKILL.md << 'EOF'
---
name: react-testing
description: Best practices for testing React components
---

# React Testing

When to use: Testing React components with Jest and Testing Library.

## Guidelines

1. Test behavior, not implementation
2. Use screen queries over container queries
3. Prefer userEvent over fireEvent
EOF
```

That's it. The skill is live. No deploy, no wait, no ceremony.

Or file an issue and let skillstash do the work:

```text
┌─────────────┐     ┌─────────────────────────────────┐     ┌───────────┐
│ File Issue  │────▶│  Research → Author → Validate   │────▶│  Merged   │
│ "I need X"  │     │         (agent loop)            │     │  & Live   │
└─────────────┘     └─────────────────────────────────┘     └───────────┘
```

## What is this?

A template repo for building your own skill library. Skills are markdown files that teach AI agents how to do specific things—coding patterns, workflows, domain knowledge, whatever you need.

**Local-first**: Skills work the moment you save them. Push to git when you're ready.

**Validated**: Linting and structure checks catch mistakes before they spread.

**Composable**: Build a library of skills your agents can discover and use.

## Get Started

1. **Use this template** → Create your own skillstash
2. **Create a skill** → `skills/my-skill/SKILL.md`
3. **Use it** → Your agent finds it automatically

## Learn More

| Doc | What it covers |
|-----|----------------|
| [docs/README.md](./docs/README.md) | Quick start and overview |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | How it all works |
| [docs/FAQs.md](./docs/FAQs.md) | Common questions |

## License

MIT
