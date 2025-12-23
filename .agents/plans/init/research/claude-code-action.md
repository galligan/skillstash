# Claude Code Action Research

**Repository:** <https://github.com/anthropics/claude-code-action>
**Marketplace:** <https://github.com/marketplace/actions/claude-code-action-official>
**Current Version:** v1.0 (Released Aug 26, 2025)
**License:** MIT

## Executive Summary

The Claude Code Action is a general-purpose GitHub automation platform that brings Claude Code capabilities to GitHub workflows. It operates in two modes: **Interactive Mode** (responds to @claude mentions) and **Automation Mode** (executes custom prompts automatically). The action supports multiple authentication methods including direct Anthropic API, AWS Bedrock, Google Vertex AI, and Microsoft Foundry.

## 1. Workflow Configuration

### 1.1 Core Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `anthropic_api_key` | Anthropic API key | No* | - |
| `claude_code_oauth_token` | OAuth token (alternative to API key) | No* | - |
| `prompt` | Instructions for Claude (triggers automation mode) | No | - |
| `claude_args` | Additional CLI arguments | No | "" |
| `github_token` | GitHub token (optional if using GitHub App) | No | - |
| `use_bedrock` | Use Amazon Bedrock instead of direct API | No | `false` |
| `use_vertex` | Use Google Vertex AI instead of direct API | No | `false` |
| `use_foundry` | Use Microsoft Foundry instead of direct API | No | `false` |
| `trigger_phrase` | Phrase to trigger action (default @claude) | No | `@claude` |
| `assignee_trigger` | Username that triggers via assignment | No | - |
| `label_trigger` | Label that triggers the action | No | `claude` |
| `base_branch` | Base branch for creating new branches | No | repo default |
| `branch_prefix` | Prefix for Claude branches | No | `claude/` |
| `track_progress` | Force progress tracking comments | No | `false` |
| `use_sticky_comment` | Use single comment for PR updates | No | `false` |
| `use_commit_signing` | Enable GitHub commit signature verification | No | `false` |
| `settings` | Claude Code settings JSON or file path | No | "" |
| `plugins` | Newline-separated plugin list | No | "" |
| `plugin_marketplaces` | Newline-separated marketplace URLs | No | "" |
| `additional_permissions` | Additional GitHub permissions (e.g., 'actions: read') | No | "" |
| `allowed_bots` | Comma-separated bot usernames or '*' | No | "" |
| `show_full_output` | Show full JSON output (security risk!) | No | `false` |

*Required when using direct Anthropic API (not needed for Bedrock/Vertex/Foundry)

### 1.2 Core Outputs

| Output | Description |
|--------|-------------|
| `execution_file` | Path to Claude Code execution output file |
| `branch_name` | The branch created by Claude Code |
| `github_token` | The GitHub token used by the action |
| `structured_output` | JSON string containing structured output (when --json-schema used) |
| `session_id` | Claude Code session ID for --resume continuation |

### 1.3 Basic Configuration Example

```yaml
name: Claude Assistant
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned, labeled]
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-response:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 1.4 Authentication Methods

#### Direct Anthropic API

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

#### OAuth Token (Alternative)

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

#### AWS Bedrock with OIDC

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT:role/ROLE
    aws-region: us-east-1
- uses: anthropics/claude-code-action@v1
  with:
    use_bedrock: "true"
```

#### Google Vertex AI with OIDC

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/PROJECT/locations/global/workloadIdentityPools/POOL/providers/PROVIDER
    service_account: SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com
- uses: anthropics/claude-code-action@v1
  with:
    use_vertex: "true"
  env:
    ANTHROPIC_VERTEX_PROJECT_ID: your-project-id
    CLOUD_ML_REGION: us-central1
```

## 2. Tool Control (`allowed_tools` Parameter)

### 2.1 Tool Control via `claude_args`

The `allowed_tools` and `disallowed_tools` parameters are passed via `claude_args`:

```yaml
claude_args: |
  --allowedTools "Edit,Read,Write,Bash(npm install),Bash(npm test)"
  --disallowedTools "WebSearch,TaskOutput,KillTask"
```

### 2.2 Default Tools

**Base GitHub Tools (Always Included):**

- File operations: `Read`, `Edit`, `Write`, `NotebookEditCell`
- Comment management: GitHub comment creation/updating
- Basic GitHub operations via MCP servers
- Git commands (read-only by default)

**Not Included by Default:**

- `Bash` - Must explicitly allow specific commands
- `WebSearch`, `WebFetch` - Network tools
- `TaskOutput`, `KillTask` - Task management

### 2.3 Bash Command Whitelisting

Bash commands require explicit whitelisting with pattern matching:

```yaml
# Allow specific commands
claude_args: |
  --allowedTools "Bash(npm install),Bash(npm run test),Bash(gh pr comment:*)"

# Pattern syntax:
# Bash(command)           - Exact command only
# Bash(command:*)         - Command with any arguments
# Bash(gh pr comment:*)   - Command with subcommand and any arguments
```

### 2.4 GitHub Inline Comments

For PR code review with inline annotations:

```yaml
claude_args: |
  --allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*)"
```

### 2.5 Complete Tool Example

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    prompt: "Review this PR and run tests"
    claude_args: |
      --allowedTools "Edit,Read,Write,Bash(npm install),Bash(npm test),Bash(gh pr comment:*),mcp__github_inline_comment__create_inline_comment"
      --disallowedTools "WebSearch,TaskOutput"
```

### 2.6 Available MCP Tools (GitHub Integration)

**Core GitHub MCP Tools:**

- `mcp__github__get_file` - Read file contents
- `mcp__github__create_branch` - Create branches
- `mcp__github__create_commit` - Make commits
- `mcp__github__create_pull_request` - Create PRs
- `mcp__github_inline_comment__create_inline_comment` - PR inline comments

**GitHub CI Tools (require `additional_permissions: "actions: read"`):**

- `mcp__github_ci__get_ci_status` - View workflow run statuses
- `mcp__github_ci__get_workflow_run_details` - Get workflow details
- `mcp__github_ci__download_job_log` - Download job logs

## 3. Structured Output Capabilities

### 3.1 JSON Schema Validation

Claude can return validated JSON results via the `--json-schema` flag:

```yaml
- name: Detect flaky tests
  id: analyze
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      Check CI logs and determine if this is a flaky test.
      Return: is_flaky (boolean), confidence (0-1), summary (string)
    claude_args: |
      --json-schema '{
        "type": "object",
        "properties": {
          "is_flaky": {"type": "boolean"},
          "confidence": {"type": "number", "minimum": 0, "maximum": 1},
          "summary": {"type": "string"}
        },
        "required": ["is_flaky", "confidence", "summary"]
      }'
```

### 3.2 Accessing Structured Outputs

**In GitHub Actions expressions:**

```yaml
- name: Conditional step
  if: fromJSON(steps.analyze.outputs.structured_output).is_flaky == true
  run: echo "Flaky test detected"
```

**In bash with jq:**

```yaml
- name: Process results
  run: |
    OUTPUT='${{ steps.analyze.outputs.structured_output }}'
    IS_FLAKY=$(echo "$OUTPUT" | jq -r '.is_flaky')
    CONFIDENCE=$(echo "$OUTPUT" | jq -r '.confidence')
    SUMMARY=$(echo "$OUTPUT" | jq -r '.summary')

    echo "Flaky: $IS_FLAKY"
    echo "Confidence: $CONFIDENCE"
    echo "Summary: $SUMMARY"
```

### 3.3 Complete Structured Output Example

```yaml
name: Auto-Retry Flaky Tests
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  detect-flaky:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    steps:
      - uses: actions/checkout@v5

      - name: Detect flaky failures
        id: detect
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            CI failed: ${{ github.event.workflow_run.html_url }}
            Check logs: gh run view ${{ github.event.workflow_run.id }} --log-failed

            Determine if flaky by checking for:
            - Timeout errors
            - Race conditions
            - Network errors
            - Intermittent failures
          claude_args: |
            --json-schema '{
              "type": "object",
              "properties": {
                "is_flaky": {"type": "boolean"},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "summary": {"type": "string"}
              },
              "required": ["is_flaky", "confidence", "summary"]
            }'

      - name: Retry if flaky (high confidence)
        if: |
          fromJSON(steps.detect.outputs.structured_output).is_flaky == true &&
          fromJSON(steps.detect.outputs.structured_output).confidence >= 0.7
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          CONFIDENCE=$(echo '${{ steps.detect.outputs.structured_output }}' | jq -r '.confidence')
          echo "🔄 Flaky test detected (confidence: $CONFIDENCE)"
          gh workflow run "${{ github.event.workflow_run.name }}" \
            --ref "${{ github.event.workflow_run.head_branch }}"
```

## 4. Constraining Agent Behavior

### 4.1 Limiting Conversation Turns

Control cost and execution time by limiting turns:

```yaml
claude_args: |
  --max-turns 10  # Limit to 10 conversation turns
```

### 4.2 Model Selection

Specify Claude model for cost/performance tradeoffs:

```yaml
claude_args: |
  --model claude-sonnet-4-5-20250929         # Latest Sonnet (balanced)
  --model claude-opus-4-5-20251101           # Opus (most capable, expensive)
  --model claude-3-7-sonnet-20250219         # Sonnet 3.7
  --model claude-haiku-4-0-20250805          # Haiku (fast, cheap)
```

### 4.3 Network Access Constraints

By default, Claude has **no network access**. Enable selectively:

```yaml
# No network tools by default

# Enable web search (use cautiously)
claude_args: |
  --allowedTools "WebSearch"

# Enable web fetch (use cautiously)
claude_args: |
  --allowedTools "WebFetch"
```

### 4.4 File Write Constraints

Control file modification capabilities:

```yaml
# Read-only access
claude_args: |
  --allowedTools "Read"
  --disallowedTools "Write,Edit"

# Allow specific file operations
claude_args: |
  --allowedTools "Read,Edit"
  --disallowedTools "Write"  # No new files

# Full file access
claude_args: |
  --allowedTools "Read,Write,Edit"
```

### 4.5 Bash Execution Constraints

Whitelist specific commands only:

```yaml
# Read-only git operations
claude_args: |
  --allowedTools "Bash(git status),Bash(git log:*),Bash(git diff:*)"

# Test running only
claude_args: |
  --allowedTools "Bash(npm install),Bash(npm test)"

# GitHub CLI read-only
claude_args: |
  --allowedTools "Bash(gh pr view:*),Bash(gh issue list:*)"
  --disallowedTools "Bash"  # Disallow all other bash
```

### 4.6 Custom System Prompts

Add constraints via system prompts:

```yaml
claude_args: |
  --system-prompt "You are a code reviewer. You can only read files and create comments. Do not modify any code. Focus on security and best practices."
```

### 4.7 Environment Variable Constraints

Pass environment constraints via settings:

```yaml
settings: |
  {
    "env": {
      "NODE_ENV": "test",
      "READ_ONLY": "true",
      "CI": "true"
    }
  }
```

### 4.8 Complete Constrained Example

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "Review this PR for security issues only"
    claude_args: |
      --model claude-haiku-4-0-20250805
      --max-turns 5
      --allowedTools "Read,Bash(gh pr comment:*),mcp__github_inline_comment__create_inline_comment"
      --disallowedTools "Write,Edit,WebSearch,WebFetch,Bash"
      --system-prompt "You are a security reviewer. Only identify security issues. Do not modify code. Do not access the network."
```

## 5. GitHub Event Integration Patterns

### 5.1 Supported Events

The action supports these GitHub event triggers:

- `pull_request` - PR opened, synchronized, ready_for_review, reopened
- `pull_request_target` - Same as above, for external contributors
- `issue_comment` - Comments on issues or PRs
- `pull_request_review_comment` - Comments on PR diffs
- `pull_request_review` - PR reviews submitted
- `issues` - Issues opened, assigned, labeled
- `repository_dispatch` - Custom events via API
- `workflow_dispatch` - Manual triggers
- `workflow_run` - Trigger on other workflow completion
- `schedule` - Cron-based scheduling

### 5.2 Interactive Mode (Comment-Based)

Responds to @claude mentions:

```yaml
name: Claude Interactive
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  claude:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          # No prompt = interactive mode
          # Responds to: "@claude review this code"
```

### 5.3 Automation Mode (Event-Triggered)

Automatic execution when `prompt` is provided:

```yaml
name: Auto PR Review
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
          fetch-depth: 1

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            REPO: ${{ github.repository }}
            PR NUMBER: ${{ github.event.pull_request.number }}

            Review this PR focusing on:
            - Security vulnerabilities
            - Performance issues
            - Best practices
```

### 5.4 Path-Specific Triggers

Review only when specific files change:

```yaml
on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - "src/auth/**"
      - "src/api/**"
      - "config/security.yml"

jobs:
  security-review:
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: "Security-focused review for authentication/API changes"
```

### 5.5 Author-Specific Triggers

Different behavior for external contributors:

```yaml
jobs:
  external-review:
    if: github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            First-time contributor: @${{ github.event.pull_request.user.login }}

            Provide comprehensive review focusing on:
            - Project coding standards
            - Test coverage requirements
            - Documentation expectations
```

### 5.6 Label-Based Triggers

Trigger on label application:

```yaml
on:
  issues:
    types: [labeled]

jobs:
  auto-triage:
    if: github.event.label.name == 'needs-triage'
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            Analyze this issue and:
            1. Categorize as bug/feature/question
            2. Suggest appropriate labels
            3. Assess priority
```

### 5.7 Scheduled Automation

Regular maintenance tasks:

```yaml
on:
  schedule:
    - cron: "0 0 * * 0"  # Every Sunday at midnight
  workflow_dispatch:      # Also allow manual trigger

jobs:
  maintenance:
    steps:
      - uses: actions/checkout@v5
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            Weekly maintenance:
            1. Check for outdated dependencies
            2. Scan for security vulnerabilities
            3. Review open issues older than 90 days
            4. Create summary issue
```

### 5.8 Workflow Completion Triggers

React to other workflow results:

```yaml
on:
  workflow_run:
    workflows: ["CI", "Tests"]
    types: [completed]

jobs:
  analyze-failure:
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            CI failed: ${{ github.event.workflow_run.html_url }}
            Analyze logs and determine if it's a real bug or flaky test
```

### 5.9 Progress Tracking Mode

Enable visual progress indicators (like v0.x agent mode):

```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]

jobs:
  review:
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          track_progress: true  # Creates tracking comment with checkboxes
          prompt: "Review this PR comprehensively"
```

## 6. Prompt Engineering Best Practices for CI

### 6.1 Always Include GitHub Context

Essential context variables in automation prompts:

```yaml
prompt: |
  REPO: ${{ github.repository }}
  PR NUMBER: ${{ github.event.pull_request.number }}
  AUTHOR: ${{ github.event.pull_request.user.login }}
  BRANCH: ${{ github.event.pull_request.head.ref }}
  BASE: ${{ github.event.pull_request.base.ref }}

  [Your specific instructions]
```

### 6.2 Specify Expected Output Format

Be explicit about how Claude should respond:

```yaml
prompt: |
  Review this PR for security issues.

  Use `mcp__github_inline_comment__create_inline_comment` for code-specific issues.
  Use `gh pr comment` for general feedback.

  Only post GitHub comments - don't submit review text as messages.
```

### 6.3 Structured Checklist Prompts

Systematic review criteria:

```yaml
prompt: |
  Review this PR against our checklist:

  ## Code Quality
  - [ ] Follows style guide
  - [ ] No commented-out code
  - [ ] Meaningful variable names

  ## Testing
  - [ ] Unit tests for new functions
  - [ ] Test coverage > 80%

  ## Security
  - [ ] No hardcoded credentials
  - [ ] Input validation implemented

  For each item, check if satisfied and comment on any that need attention.
```

### 6.4 Specify Tool Usage

Tell Claude which tools to use:

```yaml
prompt: |
  Analyze the PR and check for performance issues.

  Tools to use:
  - Read files to analyze code
  - gh pr diff to see changes
  - gh pr comment to post findings
  - Create inline comments for specific issues

  Do NOT modify any code.
```

### 6.5 Conditional Logic in Prompts

Use GitHub expressions for dynamic prompts:

```yaml
prompt: |
  ${{ github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'
      && 'This is a first-time contributor. Be welcoming and thorough.'
      || 'Standard code review.' }}

  Review focusing on:
  ${{ contains(github.event.pull_request.title, 'security')
      && '- CRITICAL: Security implications\n' || '' }}
  - Code quality
  - Test coverage
```

### 6.6 Scoped Instructions

Limit scope to reduce costs and improve focus:

```yaml
# Good: Specific scope
prompt: |
  Review ONLY the authentication changes in src/auth/.
  Check for:
  - JWT token validation
  - Password hashing
  - Session management

# Bad: Open-ended
prompt: |
  Review this PR and suggest improvements.
```

### 6.7 Context Preservation

Note about pre-checked out branches:

```yaml
prompt: |
  REPO: ${{ github.repository }}
  PR NUMBER: ${{ github.event.pull_request.number }}

  NOTE: The PR branch is already checked out in the current working directory.
  Use Read/Edit tools to examine files directly.
```

### 6.8 Error Handling Guidance

Tell Claude how to handle failures:

```yaml
prompt: |
  Review this PR. If you encounter errors:

  1. Log the error to a comment
  2. Continue with remaining checks
  3. Mark as partial review

  Do not fail silently.
```

### 6.9 Priority and Severity

Establish priority frameworks:

```yaml
prompt: |
  Security review using OWASP Top 10.

  Rate findings by severity:
  - CRITICAL: Immediate fix required, blocks merge
  - HIGH: Fix before merge
  - MEDIUM: Fix in follow-up PR
  - LOW: Nice to have

  Only block merge on CRITICAL findings.
```

### 6.10 Complete Best Practice Example

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      # Context
      REPO: ${{ github.repository }}
      PR NUMBER: ${{ github.event.pull_request.number }}
      AUTHOR: ${{ github.event.pull_request.user.login }}
      FILES CHANGED: ${{ github.event.pull_request.changed_files }}

      # Task
      Perform a security-focused code review for authentication changes.

      # Scope
      Review ONLY files in src/auth/ and src/middleware/auth.ts

      # Criteria
      Check for:
      1. SQL injection vulnerabilities (CRITICAL)
      2. XSS vulnerabilities (CRITICAL)
      3. Authentication bypass (CRITICAL)
      4. Weak password policies (HIGH)
      5. Missing rate limiting (MEDIUM)

      # Output Format
      - Use inline comments for code-specific issues
      - Use `gh pr comment` for summary
      - Rate each finding: CRITICAL/HIGH/MEDIUM/LOW
      - Block merge only on CRITICAL findings

      # Notes
      - PR branch is already checked out
      - Post only GitHub comments, not messages
      - Be constructive and specific

    claude_args: |
      --model claude-sonnet-4-5-20250929
      --max-turns 10
      --allowedTools "Read,mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*)"
      --disallowedTools "Write,Edit,WebSearch"
```

## 7. Rate Limiting and Cost Considerations

### 7.1 API Rate Limits

**Anthropic API Limits:**

- Rate limits vary by plan (see Anthropic pricing)
- Default: 50,000 tokens/minute for API tier 1
- Monitor via `x-ratelimit-*` headers
- No action-specific rate limiting

**GitHub API Limits:**

- App authentication: 15,000 requests/hour
- PAT authentication: 5,000 requests/hour
- Applies to gh CLI and MCP tool calls

### 7.2 Cost Factors

**Per-Execution Costs:**

- Model selection: Opus > Sonnet > Haiku
- Token consumption: Prompt tokens + completion tokens
- Tool usage: Each tool call = additional tokens
- Conversation turns: More turns = more tokens

**Example Pricing (as of Dec 2025):**

- Claude Opus 4.5: $15/MTok input, $75/MTok output
- Claude Sonnet 4.5: $3/MTok input, $15/MTok output
- Claude Haiku 4.0: $0.80/MTok input, $4/MTok output

### 7.3 Cost Optimization Strategies

#### 7.3.1 Use Appropriate Models

```yaml
# Use Haiku for simple tasks
- name: Issue triage
  uses: anthropics/claude-code-action@v1
  with:
    claude_args: |
      --model claude-haiku-4-0-20250805  # Cheap for classification

# Use Sonnet for complex analysis
- name: Security review
  uses: anthropics/claude-code-action@v1
  with:
    claude_args: |
      --model claude-sonnet-4-5-20250929  # Balanced for deep analysis

# Reserve Opus for critical tasks only
- name: Architecture review
  uses: anthropics/claude-code-action@v1
  with:
    claude_args: |
      --model claude-opus-4-5-20251101  # Expensive but thorough
```

#### 7.3.2 Limit Conversation Turns

```yaml
claude_args: |
  --max-turns 5  # Prevent runaway costs
```

#### 7.3.3 Constrain Scope

```yaml
# Trigger only on specific paths
on:
  pull_request:
    paths:
      - "src/critical/**"  # Only review critical files

# Or in prompt
prompt: |
  Review ONLY the authentication logic in src/auth/login.ts
  Do not analyze other files.
```

#### 7.3.4 Use Conditional Execution

```yaml
jobs:
  review:
    # Only run on PRs with specific labels
    if: contains(github.event.pull_request.labels.*.name, 'needs-review')

    # Or only for external contributors
    if: github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'

    # Or only on business hours
    if: github.event_name == 'pull_request' && !contains(github.event.head_commit.message, '[skip-claude]')
```

#### 7.3.5 Disable Expensive Tools

```yaml
claude_args: |
  --disallowedTools "WebSearch,WebFetch"  # Prevent network calls
```

#### 7.3.6 Use Sticky Comments

```yaml
with:
  use_sticky_comment: true  # Update single comment vs creating many
```

### 7.4 Cost Monitoring

#### 7.4.1 Track Execution File Outputs

```yaml
- uses: anthropics/claude-code-action@v1
  id: claude

- name: Log token usage
  run: |
    if [ -f "${{ steps.claude.outputs.execution_file }}" ]; then
      echo "Execution file: ${{ steps.claude.outputs.execution_file }}"
      # Parse for token usage metrics
    fi
```

#### 7.4.2 Set Budget Alerts

Use GitHub repository secrets to set monthly budgets:

```yaml
env:
  MONTHLY_BUDGET_TOKENS: 1000000  # 1M tokens/month

- name: Check budget
  run: |
    # Implement custom budget tracking
    # Fail workflow if budget exceeded
```

### 7.5 Rate Limit Handling

#### 7.5.1 Implement Backoff

```yaml
- name: Claude with retry
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 30
    command: |
      # Your claude-code-action invocation
```

#### 7.5.2 Stagger Workflows

```yaml
# Use different schedules for different repos
schedule:
  - cron: "0 */4 * * *"  # Every 4 hours, offset by repo
```

### 7.6 Cost Estimation Formula

**Estimated Cost Per PR Review:**

```
Base Cost = (Prompt Tokens + Completion Tokens) × Model Price

Factors:
- PR size: ~500 tokens per file
- Review depth: 2-5 conversation turns
- Model selection: Haiku/Sonnet/Opus

Example (Sonnet, 10 files, 3 turns):
- Input: ~7,000 tokens ($0.021)
- Output: ~2,000 tokens ($0.030)
- Total: ~$0.051 per review

Monthly (100 PRs): ~$5.10
```

### 7.7 Cost Control Checklist

- [ ] Use Haiku for simple classification tasks
- [ ] Set `--max-turns` limit (5-10 typical)
- [ ] Constrain tool access via `--allowedTools`
- [ ] Use path filters to limit execution
- [ ] Implement conditional execution (labels, authors)
- [ ] Disable expensive tools (WebSearch, WebFetch)
- [ ] Use `use_sticky_comment` to reduce comment churn
- [ ] Monitor execution file outputs for token usage
- [ ] Set up budget alerts
- [ ] Review and optimize prompts monthly

## 8. Security Best Practices

### 8.1 Never Hardcode Secrets

```yaml
# CORRECT ✅
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# NEVER DO THIS ❌
anthropic_api_key: "sk-ant-api03-..." # Exposed!
```

### 8.2 Access Control

- Action only triggered by users with write access
- Use `allowed_bots` carefully
- `allowed_non_write_users` is RISKY - use only for limited workflows

### 8.3 Prompt Injection Risks

Be aware of hidden instructions in:

- HTML comments in PR descriptions
- Invisible characters
- Markdown image alt text
- Hidden HTML attributes

The action sanitizes content but new bypasses may emerge.

### 8.4 Commit Signing

```yaml
with:
  use_commit_signing: true  # Enable GitHub signature verification
```

### 8.5 Full Output Security

```yaml
# DANGEROUS - exposes all tool outputs
show_full_output: false  # Keep disabled unless debugging privately
```

## 9. Advanced Features

### 9.1 Custom MCP Servers

Add additional capabilities via MCP:

```yaml
- name: Create MCP Config
  run: |
    cat > /tmp/mcp-config.json << 'EOF'
    {
      "mcpServers": {
        "sequential-thinking": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
        }
      }
    }
    EOF

- uses: anthropics/claude-code-action@v1
  with:
    claude_args: |
      --mcp-config /tmp/mcp-config.json
      --allowedTools mcp__sequential-thinking__sequentialthinking
```

### 9.2 Custom Plugins

Install Claude Code plugins:

```yaml
with:
  plugins: |
    code-review@claude-code-plugins
    feature-dev@claude-code-plugins
  plugin_marketplaces: |
    https://github.com/user/marketplace1.git
```

### 9.3 CI/CD Integration

Enable access to workflow information:

```yaml
permissions:
  actions: read  # Required for CI access

with:
  additional_permissions: |
    actions: read
```

This enables MCP tools:

- `mcp__github_ci__get_ci_status`
- `mcp__github_ci__get_workflow_run_details`
- `mcp__github_ci__download_job_log`

### 9.4 Session Continuation

Resume previous sessions:

```yaml
- name: Initial run
  id: initial
  uses: anthropics/claude-code-action@v1

- name: Continue session
  uses: anthropics/claude-code-action@v1
  with:
    claude_args: |
      --resume ${{ steps.initial.outputs.session_id }}
```

## 10. Common Patterns

### 10.1 Automatic PR Review

```yaml
name: Auto PR Review
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
          fetch-depth: 1

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            REPO: ${{ github.repository }}
            PR NUMBER: ${{ github.event.pull_request.number }}

            Review for:
            - Code quality
            - Security issues
            - Performance concerns

            Use inline comments for specific issues.
          claude_args: |
            --allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*)"
```

### 10.2 Issue Triage

```yaml
name: Auto-Triage Issues
on:
  issues:
    types: [opened]

jobs:
  triage:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            ISSUE NUMBER: ${{ github.event.issue.number }}
            TITLE: ${{ github.event.issue.title }}

            Categorize as bug/feature/question and suggest labels.
          claude_args: |
            --model claude-haiku-4-0-20250805
            --allowedTools "Bash(gh issue edit:*)"
```

### 10.3 Documentation Updates

```yaml
name: Sync API Docs
on:
  pull_request:
    paths:
      - "src/api/**/*.ts"

jobs:
  doc-sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v5
        with:
          ref: ${{ github.event.pull_request.head.ref }}

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            API endpoints changed. Update API.md to reflect the changes.
          claude_args: |
            --allowedTools "Read,Write,Edit,Bash(git:*)"
```

## 11. Troubleshooting

### 11.1 Common Issues

**Action doesn't trigger:**

- Check if user has write access
- Verify trigger phrase (default: @claude)
- Check workflow permissions
- Review event triggers in workflow file

**Tool access denied:**

- Explicitly allow tools via `--allowedTools`
- Check for typos in tool names
- Verify tool patterns (e.g., `Bash(command:*)`)

**Token/authentication errors:**

- Verify secret is set correctly
- Check expiration of OAuth tokens
- Ensure OIDC configuration for Bedrock/Vertex

**Cost overruns:**

- Set `--max-turns` limit
- Use cheaper models (Haiku)
- Constrain scope via path filters
- Implement conditional execution

## 12. Reference Links

**Official Resources:**

- GitHub Action: <https://github.com/anthropics/claude-code-action>
- Marketplace: <https://github.com/marketplace/actions/claude-code-action-official>
- Claude Code Docs: <https://docs.claude.com/en/docs/claude-code>
- Agent SDK: <https://docs.claude.com/en/docs/agent-sdk>

**Documentation:**

- Setup Guide: <https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md>
- Usage Guide: <https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md>
- Configuration: <https://github.com/anthropics/claude-code-action/blob/main/docs/configuration.md>
- Solutions Guide: <https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md>
- Security: <https://github.com/anthropics/claude-code-action/blob/main/docs/security.md>

**Examples:**

- <https://github.com/anthropics/claude-code-action/tree/main/examples>

## 13. Key Takeaways

1. **Two Modes:** Interactive (@claude mentions) and Automation (custom prompts)
2. **Tool Control:** Explicit whitelisting required for Bash, network tools
3. **Structured Outputs:** Use `--json-schema` for validated JSON responses
4. **Cost Control:** Use appropriate models, limit turns, constrain scope
5. **Security:** Never hardcode secrets, be aware of prompt injection
6. **Best Practices:** Always include GitHub context, specify expected output
7. **GitHub Integration:** Rich MCP tools for PRs, issues, CI/CD
8. **Flexibility:** Multiple auth methods, custom MCP servers, plugins
