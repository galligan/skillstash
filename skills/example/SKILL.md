---
name: example
description: A simple example skill demonstrating the skills-factory format
---

# Example Skill

This skill serves as a reference implementation for the skills-factory format. Use it as a template when creating your own skills.

## When this skill activates

Skills can activate based on:

- **Explicit user request**: When the user asks for the skill by name (e.g., "use the example skill")
- **Context matching**: When the conversation topic aligns with the skill's domain
- **Pattern detection**: When the user's request matches specific patterns or workflows

For this example skill, it would activate when:

- The user asks about skill structure or formatting
- The user requests help creating a new skill
- The user asks "how do I write a skill?"

## What this skill does

This skill demonstrates the essential components of a well-structured skill file:

1. **YAML Frontmatter** (required)
   - `name`: Matches the directory name, uses kebab-case
   - `description`: Brief one-line summary of the skill's purpose

2. **Clear Activation Conditions**
   - Helps users and agents understand when to use this skill
   - Can include patterns, keywords, or scenarios

3. **Functionality Description**
   - Explains what the skill does and how it helps
   - Includes examples and best practices

4. **Example Interactions**
   - Shows the skill in action
   - Demonstrates expected inputs and outputs

## Structure guidelines

**Keep it focused**: Each skill should solve one specific problem well.

**Be explicit**: Clearly state when the skill should and shouldn't activate.

**Provide examples**: Show don't tell. Include real conversation snippets.

**Stay concise**: Aim for under 100 lines. If it's longer, consider splitting it.

**Use headings**: Organize content with clear markdown headings.

## Example interactions

**User**: "How should I structure a skill for React testing best practices?"

**Agent** (using this skill): "I'll help you create a skill following the skills-factory format. Your skill should include:

1. YAML frontmatter with name `react-testing` and a clear description
2. A section explaining when it activates (e.g., when users ask about React testing, Jest, or component testing)
3. What it does (provides testing best practices, suggests patterns, reviews test code)
4. Example interactions showing the skill in action

Would you like me to create the initial structure?"

---

**User**: "Show me a minimal skill example"

**Agent** (using this skill): "Here's the minimum viable skill:

```markdown
---
name: my-skill
description: Does something useful
---

# My Skill

## When this skill activates

When users ask about [topic]

## What this skill does

Helps with [specific task]
```

That's it! Start simple and iterate."

## Additional resources

Skills can optionally include:

- `references/` - Documentation, guides, or spec files
- `scripts/` - Executable helper scripts
- `assets/` - Templates, images, or configuration files
- `.research/` - Temporary research notes (removed on merge)

For more details, see the skills-factory documentation at `/docs/local-first-workflow.md`.
