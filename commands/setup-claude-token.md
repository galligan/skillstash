---
description: Generate a Claude OAuth token and store it as a GitHub Actions secret
---

# Setup Claude OAuth Token

## What this does

This command **guides you** through generating a Claude Code OAuth token and storing it in GitHub Secrets. It does not execute commands automatically.

## Steps

1) Generate a token **manually** in your terminal:

```bash
claude setup-token
```

1) Store it in GitHub Secrets for this repo (you will be prompted to paste the token):

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R owner/repo
```

Paste the token when prompted.

### Optional: Org-level secret

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN --org my-org
```
