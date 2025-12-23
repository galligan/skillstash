---
name: skills-validation
description: Validate skills and summarize issues before merge
---

# Skills Validation

Use this skill to review a skill PR and report validation issues.

## When this skill activates

- A PR updates `skills/**`
- A review or validation is requested

## What this skill does

1. Run validation checks (structure, frontmatter, naming, size).
2. Report blocking issues with file/line context.
3. Suggest improvements for non-blocking issues.
