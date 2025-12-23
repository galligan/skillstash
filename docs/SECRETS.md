# Secrets and Tokens

Skillstash can run agent workflows in GitHub Actions when LLM credentials are available. This doc covers which secrets to set and where to put them.

## Required Secrets (GitHub Actions)

| Provider | Secret | Notes |
|----------|--------|-------|
| Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` | **Preferred** for Claude Code; use OAuth when possible |
| Claude (API) | `ANTHROPIC_API_KEY` | Fallback if you do not use OAuth |
| Codex | `OPENAI_API_KEY` | Required for the Codex Action |

> Store these as repository secrets (Settings → Secrets and variables → Actions).

## Set Secrets with gh

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R owner/repo -b "$CLAUDE_CODE_OAUTH_TOKEN"
gh secret set OPENAI_API_KEY -R owner/repo -b "$OPENAI_API_KEY"
```

## Claude Code OAuth Setup (Recommended)

From inside Claude Code, run:

```text
/install-github-app
```

This guided flow installs the Claude GitHub App and provides an OAuth token. Save that token as `CLAUDE_CODE_OAUTH_TOKEN` in your repo secrets.

## Where to Get Tokens

Follow the official docs for your provider and copy the token they issue:

```text
Claude Code: https://docs.claude.com/en/docs/claude-code
Claude Code Action: https://github.com/anthropics/claude-code-action
Anthropic Console: https://console.anthropic.com/
OpenAI API Keys: https://platform.openai.com/api-keys
Codex Action: https://developers.openai.com/codex/github-action/
```

## Notes

- If you only want local workflows, you can skip GitHub secrets.
- The default automation mode falls back to GitHub's built-in token if app tokens are missing.
