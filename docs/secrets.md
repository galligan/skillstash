# Secrets and Tokens

Skillstash can run agent workflows in GitHub Actions when LLM credentials are available. This guide focuses on Claude Code (default) and Codex.

## Claude Code Authentication

### OAuth Token (Recommended)

The simplest supported path is to mint a single token and store it in GitHub secrets:

```bash
claude setup-token
```

Save the resulting token as `CLAUDE_CODE_OAUTH_TOKEN` in your repo secrets.

If you prefer the in-product flow, you can run this inside Claude Code:

```text
/install-github-app
```

Guided help is available via the plugin command:

```text
/skillstash:setup-claude-token
```

### Anthropic API Key (Fallback)

If you are not using OAuth, set `ANTHROPIC_API_KEY` from the Anthropic Console.

## Codex Authentication

Codex GitHub Actions require `OPENAI_API_KEY`. Generate a key in the OpenAI API keys page and store it as a repo secret.

## GitHub Actions Secrets

Store secrets at: **Settings → Secrets and variables → Actions**.

```bash
# Claude (OAuth preferred)
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R owner/repo -b "$CLAUDE_CODE_OAUTH_TOKEN"

# Claude fallback API key
gh secret set ANTHROPIC_API_KEY -R owner/repo -b "$ANTHROPIC_API_KEY"

# Codex
gh secret set OPENAI_API_KEY -R owner/repo -b "$OPENAI_API_KEY"
```

### Reference Links

```text
Claude Code: https://docs.claude.com/en/docs/claude-code
Claude Code Action: https://github.com/anthropics/claude-code-action
Anthropic Console: https://console.anthropic.com/
OpenAI API Keys: https://platform.openai.com/api-keys
Codex Action: https://developers.openai.com/codex/github-action/
```
