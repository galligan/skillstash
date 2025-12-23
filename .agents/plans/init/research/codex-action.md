# OpenAI Codex Action Research

**Official Repository:** <https://github.com/openai/codex-action>
**Documentation:** <https://developers.openai.com/codex/github-action/>
**License:** Apache-2.0
**Latest Version:** v1 (uses tag-based versioning)

## Overview

The `openai/codex-action` is a GitHub Action that enables running the Codex CLI in GitHub Actions workflows with controlled privileges. It handles CLI installation, API proxy configuration, and secure execution of `codex exec` commands.

### Primary Use Cases

- Automated code review on pull requests
- CI/CD failure analysis and auto-fixing
- Release preparation automation
- Quality gate enforcement in CI pipelines
- Codebase migration assistance

## Configuration

### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `openai-api-key` | secret | conditional | `""` | OpenAI API key for authentication |
| `responses-api-endpoint` | string | no | `""` | Custom Responses API endpoint (e.g., Azure) |
| `prompt` | string | conditional | `""` | Inline prompt text (mutually exclusive with `prompt-file`) |
| `prompt-file` | string | conditional | `""` | Path to prompt file relative to repo root |
| `output-file` | string | no | `""` | File path to write final Codex message |
| `working-directory` | string | no | `github.workspace` | Directory for Codex to use as working directory |
| `sandbox` | string | no | `"workspace-write"` | Sandbox mode: `workspace-write`, `read-only`, `danger-full-access` |
| `codex-version` | string | no | latest | Specific version of `@openai/codex` to install |
| `codex-args` | string/array | no | `""` | Additional CLI flags (JSON array or shell string) |
| `output-schema` | string | no | `""` | Inline JSON schema for structured output |
| `output-schema-file` | string | no | `""` | Path to JSON schema file for structured output |
| `model` | string | no | auto | Model to use (e.g., `gpt-5.2-codex`) |
| `effort` | string | no | auto | Reasoning effort level |
| `codex-home` | string | no | default | Custom Codex home directory path |
| `safety-strategy` | string | no | `"drop-sudo"` | Privilege control strategy (see Security section) |
| `codex-user` | string | conditional | `""` | Username for `unprivileged-user` strategy |
| `allow-users` | string | no | `""` | Comma-separated list of allowed GitHub usernames |
| `allow-bots` | boolean | no | `false` | Allow bot accounts to bypass write-access check |

### Outputs

| Output | Description |
|--------|-------------|
| `final-message` | Raw output from `codex exec` command |

### Secrets Management

**Required Secret:**

- `OPENAI_API_KEY` - Store in repository or organization secrets

**For Azure OpenAI:**

- `AZURE_OPENAI_API_KEY` - Use with `responses-api-endpoint` pointing to Azure endpoint
- Endpoint format: `https://YOUR_PROJECT.openai.azure.com/openai/v1/responses`

## Network Access & Sandboxing

### Sandbox Modes

The action supports three sandbox levels via the `sandbox` input:

1. **`workspace-write` (default)**
   - Read/write access to repository workspace
   - No network access by default (install dependencies before action runs)
   - Cannot access files outside workspace

2. **`read-only`**
   - Read-only filesystem access
   - No write capabilities
   - No network access
   - Still runs with elevated privileges unless combined with safety-strategy

3. **`danger-full-access`**
   - Full filesystem access
   - Network access enabled
   - Use only for trusted prompts
   - Required for tasks needing external network calls

### Network Isolation

**Key Point:** The default sandbox disables network access. Install all dependencies (npm, pip, etc.) in a step *before* the Codex action runs.

**Example:**

```yaml
- name: Install dependencies
  run: npm ci

- name: Run Codex
  uses: openai/codex-action@v1
  with:
    sandbox: workspace-write  # No network access
```

## AGENTS.md Discovery

Codex automatically discovers and loads instruction files to provide project-specific guidance.

### Discovery Process

1. **Global Instructions** (`~/.codex/`)
   - Searches for `AGENTS.override.md` first, then `AGENTS.md`
   - Only the first non-empty file is used
   - Applied to all Codex sessions globally

2. **Project Instructions** (repository-level)
   - Walks from repository root to current working directory
   - In each directory, checks in order:
     1. `AGENTS.override.md`
     2. `AGENTS.md`
     3. Fallback filenames from `project_doc_fallback_filenames`
   - At most one file per directory is included
   - Files concatenated from root → leaf (deeper files override earlier ones)

3. **Size Limits**
   - Default limit: 32 KiB (`project_doc_max_bytes`)
   - Empty files are skipped
   - Truncation occurs when combined size exceeds limit

### Fallback Filenames Configuration

The `project_doc_fallback_filenames` config option allows custom instruction file names:

```toml
# ~/.codex/config.toml
project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]
project_doc_max_bytes = 65536  # 64 KiB
```

**Discovery order per directory:**

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `TEAM_GUIDE.md` (first fallback)
4. `.agents.md` (second fallback)

### Precedence Summary

Instructions are merged in order of specificity:

1. Global `AGENTS.override.md` or `AGENTS.md`
2. Repository root → current directory, one file per level
3. Deeper/more specific instructions override broader ones

## Security Architecture

### Safety Strategies

The `safety-strategy` input controls privilege isolation:

#### 1. `drop-sudo` (Default, Recommended)

**Behavior:**

- Irreversibly removes sudo privileges before running Codex
- Protects secrets in memory from being read by Codex
- Subsequent steps in the job also lose sudo access

**OS Support:**

- Linux: ✅ Supported
- macOS: ✅ Supported
- Windows: ❌ Not supported

**Critical Security Note:**
Even `read-only` sandbox + sudo can expose secrets via procfs on Linux. Always use `drop-sudo` or `unprivileged-user` when API keys are present.

#### 2. `unprivileged-user`

**Behavior:**

- Runs Codex as a specific non-privileged user account
- User must be pre-created with appropriate permissions
- Provides strongest isolation for self-hosted runners

**Required Setup:**

```yaml
- name: Create unprivileged user
  run: |
    sudo adduser --system --home /home/guest --shell /bin/bash --group guest
    sudo usermod -a -G guest runner
    sudo usermod -a -G runner guest

- name: Fix permissions
  run: |
    sudo chown -R runner:guest "$GITHUB_WORKSPACE"
    sudo chmod -R g+rwX "$GITHUB_WORKSPACE"
    sudo find "$GITHUB_WORKSPACE" -type d -exec chmod g+s {} +

- name: Run Codex
  uses: openai/codex-action@v1
  with:
    safety-strategy: unprivileged-user
    codex-user: guest
```

#### 3. `read-only`

**Behavior:**

- Codex runs in read-only sandbox
- Still executes as default user (typically with sudo)
- **NOT sufficient to protect API keys alone**

#### 4. `unsafe` (Not Recommended)

**Behavior:**

- No privilege restrictions
- Codex runs as default runner user with sudo
- Can access secrets in memory
- **Required on Windows** (only supported option)

**Windows Limitation:**

```yaml
- name: Run Codex (Windows)
  uses: openai/codex-action@v1
  with:
    safety-strategy: unsafe  # Required on Windows
```

### Access Control

**Default Behavior:**

- Only users with write access to the repository can trigger the action
- Prevents untrusted users from consuming API quota or running malicious prompts

**Extended Access:**

```yaml
allow-users: "username1,username2"  # Additional trusted users
allow-bots: true  # Allow GitHub Apps/bots
```

### Security Best Practices

1. **Run as last step in job**
   - Prevents Codex from modifying subsequent steps
   - Isolates potential side effects
   - Can pipe output to a new job on fresh host if needed

2. **Protect API keys**
   - Always use `drop-sudo` or `unprivileged-user` on Linux/macOS
   - Never use `unsafe` unless absolutely necessary (Windows only)
   - Rotate keys immediately if exposure is suspected

3. **Sanitize untrusted input**
   - PR titles, commit messages, issue bodies can contain prompt injection
   - HTML comments can hide malicious instructions
   - Screenshots and media can be injection vectors

4. **Limit who can trigger workflows**
   - Use `allow-users` restrictively
   - Require approval for external contributors
   - Monitor API usage for abuse

5. **Validate structured outputs**
   - Check file paths before using in API calls
   - Verify line numbers are within valid ranges
   - Sanitize any user-facing output

## Structured Output Patterns

### Output Schema Support

Codex supports JSON Schema for structured outputs via:

- `output-schema`: Inline JSON schema string
- `output-schema-file`: Path to schema file

### Code Review Pattern

**Schema Definition:**

```json
{
  "type": "object",
  "properties": {
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {"type": "string", "maxLength": 80},
          "body": {"type": "string", "minLength": 1},
          "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
          "priority": {"type": "integer", "minimum": 0, "maximum": 3},
          "code_location": {
            "type": "object",
            "properties": {
              "absolute_file_path": {"type": "string"},
              "line_range": {
                "type": "object",
                "properties": {
                  "start": {"type": "integer", "minimum": 1},
                  "end": {"type": "integer", "minimum": 1}
                },
                "required": ["start", "end"]
              }
            },
            "required": ["absolute_file_path", "line_range"]
          }
        },
        "required": ["title", "body", "confidence_score", "code_location"]
      }
    },
    "overall_correctness": {
      "type": "string",
      "enum": ["patch is correct", "patch is incorrect"]
    },
    "overall_explanation": {"type": "string"},
    "overall_confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
  },
  "required": ["findings", "overall_correctness", "overall_explanation"]
}
```

**Usage:**

```yaml
- name: Run Codex review
  uses: openai/codex-action@v1
  with:
    prompt-file: review-prompt.md
    output-schema-file: review-schema.json
    output-file: review-output.json
```

### Verdict Pattern

For binary decisions or quality gates:

```json
{
  "type": "object",
  "properties": {
    "verdict": {"type": "string", "enum": ["approved", "rejected"]},
    "reason": {"type": "string"},
    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    "suggested_actions": {
      "type": "array",
      "items": {"type": "string"}
    }
  },
  "required": ["verdict", "reason", "confidence"]
}
```

## GitHub Events Integration

### Supported Events

The action works with any GitHub Actions event. Common patterns:

#### Pull Request Review

```yaml
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
```

#### Issue Comment Trigger

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  codex:
    if: |
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '/codex-review')
```

#### Scheduled Workflows

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
```

#### Manual Trigger

```yaml
on:
  workflow_dispatch:
    inputs:
      prompt:
        description: 'Prompt for Codex'
        required: true
```

### Event Context Access

**Pull Request Context:**

```yaml
env:
  PR_NUMBER: ${{ github.event.pull_request.number }}
  BASE_SHA: ${{ github.event.pull_request.base.sha }}
  HEAD_SHA: ${{ github.event.pull_request.head.sha }}
```

**Fetching PR Refs:**

```yaml
- uses: actions/checkout@v5
  with:
    ref: refs/pull/${{ github.event.pull_request.number }}/merge

- name: Fetch base and head
  run: |
    git fetch --no-tags origin \
      ${{ github.event.pull_request.base.ref }} \
      +refs/pull/${{ github.event.pull_request.number }}/head
```

## Code Examples

### Basic Pull Request Review

```yaml
name: Codex PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
        with:
          ref: refs/pull/${{ github.event.pull_request.number }}/merge

      - name: Fetch refs
        run: |
          git fetch --no-tags origin \
            ${{ github.event.pull_request.base.ref }} \
            +refs/pull/${{ github.event.pull_request.number }}/head

      - name: Review with Codex
        id: codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          sandbox: read-only
          model: gpt-5.2-codex
          prompt: |
            Review PR #${{ github.event.pull_request.number }}.
            Focus on: correctness, security, performance, maintainability.

            Changed files:
            $(git diff --name-only ${{ github.event.pull_request.base.sha }} ${{ github.event.pull_request.head.sha }})

      - name: Post review
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body: process.env.CODEX_OUTPUT
            })
        env:
          CODEX_OUTPUT: ${{ steps.codex.outputs.final-message }}
```

### Structured Code Review with Inline Comments

```yaml
name: Structured Code Review
on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v5

      - name: Generate schema
        run: |
          cat > schema.json <<'EOF'
          {
            "type": "object",
            "properties": {
              "findings": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "path": {"type": "string"},
                    "line": {"type": "integer"}
                  },
                  "required": ["title", "body", "path", "line"]
                }
              }
            }
          }
          EOF

      - name: Run Codex
        id: codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          output-schema-file: schema.json
          output-file: output.json
          prompt-file: .github/prompts/review.md

      - name: Post inline comments
        run: |
          jq -c '.findings[]' output.json | while read finding; do
            curl -X POST \
              -H "Authorization: Bearer ${{ github.token }}" \
              -H "Accept: application/vnd.github+json" \
              "https://api.github.com/repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/comments" \
              -d "$(echo "$finding" | jq '{
                body: .body,
                path: .path,
                line: .line,
                commit_id: "${{ github.event.pull_request.head.sha }}"
              }')"
          done
```

### Azure OpenAI Configuration

```yaml
- name: Run Codex with Azure
  uses: openai/codex-action@v1
  with:
    openai-api-key: ${{ secrets.AZURE_OPENAI_API_KEY }}
    responses-api-endpoint: https://YOUR-RESOURCE.openai.azure.com/openai/v1/responses
    prompt: "Analyze the codebase for security issues"
```

### Unprivileged User Pattern

```yaml
- name: Setup unprivileged user
  run: |
    sudo adduser --system --home /home/codex-agent --shell /bin/bash --group codex-agent
    sudo usermod -a -G codex-agent runner
    sudo usermod -a -G runner codex-agent

- uses: actions/checkout@v5

- name: Fix ownership
  run: |
    sudo chown -R runner:codex-agent "$GITHUB_WORKSPACE"
    sudo chmod -R g+rwX "$GITHUB_WORKSPACE"
    sudo find "$GITHUB_WORKSPACE" -type d -exec chmod g+s {} +

- name: Run Codex
  uses: openai/codex-action@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    safety-strategy: unprivileged-user
    codex-user: codex-agent
    prompt: "Run security audit"
```

### Multi-Job Pattern (Security Isolation)

```yaml
jobs:
  codex-exec:
    runs-on: ubuntu-latest
    outputs:
      result: ${{ steps.codex.outputs.final-message }}
    steps:
      - uses: actions/checkout@v5
      - name: Run Codex
        id: codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          prompt: "Analyze code"

  process-result:
    needs: codex-exec
    runs-on: ubuntu-latest  # Fresh host, no API key exposure
    steps:
      - name: Process Codex output
        run: echo "${{ needs.codex-exec.outputs.result }}"

      - name: Run privileged operations
        run: sudo ./deploy.sh  # Safe to use sudo here
```

## Key Differences from Claude Code Action

Based on research of both tools, here are the notable differences:

### Architecture

**Codex Action:**

- Installs Codex CLI on-demand in the runner
- Uses a secure proxy for Responses API
- Manages API key in memory with isolation strategies
- Built on Codex CLI (Rust-based)

**Claude Code Action:**

- Uses different underlying agent architecture
- Focused on Claude-specific capabilities
- Different tool integration patterns

### Capabilities

**Codex Action:**

- Native support for AGENTS.md discovery
- Built-in structured output via JSON Schema
- Granular sandbox and safety controls
- Optimized for code review workflows (trained on GPT-5.2-codex)

**Claude Code:**

- Stronger at web search and browsing
- Different reasoning approach (more verbose reasoning, less concise output)
- Better at searching through codebases
- Different file operation patterns

### Security Model

**Codex Action:**

- Four distinct safety strategies with clear documentation
- Explicit procfs vulnerability documentation
- Designed for untrusted PR scenarios
- Windows requires unsafe mode

**Claude Code:**

- Different security boundary approach
- Focused on local/trusted execution contexts

### Performance Characteristics

**Codex:**

- Tends to reason longer upfront
- Faster token output once reasoning completes
- More concise final outputs
- Optimized for strategic planning and design phases

**Claude Code:**

- Reasons less, iterates more
- Better at rapid iteration on code changes
- More verbose explanations

## Best Practices

### 1. Workflow Organization

**DO:**

- Run Codex action as the last step in a job
- Use separate jobs for Codex and privileged operations
- Install all dependencies before the Codex step
- Store prompts in version-controlled files

**DON'T:**

- Run privileged operations after Codex in the same job
- Assume network access works in default sandbox
- Share API keys across multiple workflows unnecessarily

### 2. Prompt Engineering

**DO:**

- Be specific about what to analyze (files, diffs, specific issues)
- Request structured output for downstream processing
- Include context (PR number, changed files, base/head SHAs)
- Use prompt files for complex, reusable prompts

**DON'T:**

- Include large diffs inline (use git commands in prompt)
- Mix multiple unrelated tasks in one prompt
- Trust user-provided content without sanitization

### 3. Security

**DO:**

- Use `drop-sudo` or `unprivileged-user` strategies
- Limit workflow triggers to trusted users
- Rotate API keys on schedule
- Monitor API usage for abuse
- Validate structured outputs before use

**DON'T:**

- Use `unsafe` except on Windows
- Trust that `read-only` protects secrets
- Allow unlimited external user triggers
- Skip input sanitization

### 4. Cost Management

**DO:**

- Use `model` input to control which model is used
- Set appropriate `effort` levels
- Cache dependencies to speed up jobs
- Use concurrency controls to prevent duplicate runs

**DON'T:**

- Run on every commit without concurrency limits
- Use most expensive models for simple tasks
- Allow unbounded API usage

### 5. Output Handling

**DO:**

- Use structured output schemas for programmatic processing
- Write output to files for debugging
- Archive output as artifacts
- Validate output format before acting on it

**DON'T:**

- Trust file paths or line numbers without validation
- Execute commands from Codex output without review
- Assume output format is consistent without schema

## Limitations

1. **Platform Support**
   - Windows requires `unsafe` safety strategy
   - No viable sandbox on Windows runners
   - Self-hosted runners need additional setup for `unprivileged-user`

2. **Network Restrictions**
   - Default sandbox blocks network access
   - Dependencies must be installed beforehand
   - No dynamic package installation within Codex

3. **Size Limits**
   - AGENTS.md combined size: 32 KiB default
   - Large diffs may need truncation
   - Token limits apply to prompts and outputs

4. **Concurrency**
   - API rate limits apply
   - Concurrent runs on same PR should be controlled
   - No built-in queuing mechanism

5. **State Management**
   - Each run is independent (no persistent memory)
   - AGENTS.md provides only static context
   - Cannot maintain conversation history across runs

## Troubleshooting

### Common Issues

**"Only one of prompt or prompt-file may be specified"**

- Ensure only one input is provided
- Check for empty string vs. undefined in conditional logic

**"responses-api-proxy did not write server info"**

- Verify `openai-api-key` is set and valid
- Check API key has necessary permissions
- Ensure proxy can bind to port

**"Expected sudo to be disabled, but sudo succeeded"**

- Another step may have re-enabled sudo
- Not running on Linux/macOS
- Action may have failed before dropping privileges

**Permission errors with unprivileged user**

- Verify user has read access to checkout
- Check group permissions are set correctly
- Ensure setgid bit is applied to directories

**Truncated instructions**

- Increase `project_doc_max_bytes` in config
- Split large files across nested directories
- Remove unnecessary content from AGENTS.md

**Workflow blocked by access control**

- Add username to `allow-users` input
- Ensure user has write access to repo
- Check if `allow-bots` needs to be enabled

## Resources

- **Official Repository:** <https://github.com/openai/codex-action>
- **Documentation:** <https://developers.openai.com/codex/github-action/>
- **Security Guide:** <https://github.com/openai/codex-action/blob/main/docs/security.md>
- **Codex CLI Docs:** <https://developers.openai.com/codex/cli>
- **AGENTS.md Spec:** <https://agents.md/>
- **Example Workflows:** <https://github.com/openai/codex-action/tree/main/examples>
- **OpenAI Cookbook:** <https://cookbook.openai.com/examples/codex/>
- **Auto-fix CI Guide:** <https://developers.openai.com/codex/autofix-ci/>

## Version History

- **v1.4** (Nov 2025): CLI version auto-detection, GHE support
- **v1.1** (Nov 2025): Output schema support, improved safety
- **v1.0** (Oct 2025): Initial stable release

See [CHANGELOG.md](https://github.com/openai/codex-action/blob/main/CHANGELOG.md) for detailed release notes.
