# IssueOps Patterns for GitHub Actions

Research findings on using GitHub Issues as an interface for triggering automation workflows.

**Last Updated:** 2025-12-23

## Table of Contents

1. [Issue Template YAML Syntax](#1-issue-template-yaml-syntax)
2. [Parsing Issue Bodies in Workflows](#2-parsing-issue-bodies-in-workflows)
3. [Issue Commands via Comments](#3-issue-commands-via-comments)
4. [Label-Based Workflow Triggers](#4-label-based-workflow-triggers)
5. [Rate Limiting Strategies](#5-rate-limiting-strategies)
6. [Bot Comments and Status Updates](#6-bot-comments-and-status-updates)
7. [Linking Issues to PRs Programmatically](#7-linking-issues-to-prs-programmatically)
8. [Loop Prevention](#8-loop-prevention)
9. [Complete Working Example](#9-complete-working-example)
10. [References](#references)

---

## 1. Issue Template YAML Syntax

### Overview

GitHub Issue Forms use YAML to define structured templates with various input types. Templates are stored in `.github/ISSUE_TEMPLATE/` directory.

### Basic Structure

```yaml
name: Bug Report
description: File a bug report
title: "[Bug]: "
labels: ["bug", "triage"]
projects: ["octo-org/1"]
assignees:
  - octocat
type: bug
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report!

  - type: input
    id: contact
    attributes:
      label: Contact Details
      description: How can we get in touch with you if we need more info?
      placeholder: ex. email@example.com
    validations:
      required: false
```

### Input Types

#### 1. Input (Single Line Text)

```yaml
- type: input
  id: version
  attributes:
    label: Version
    description: What version are you running?
    placeholder: "1.0.0"
  validations:
    required: true
```

#### 2. Textarea (Multi-line Text)

```yaml
- type: textarea
  id: description
  attributes:
    label: What happened?
    description: Describe the issue
    placeholder: Tell us what you see
    value: "A bug happened!"
    render: shell  # Optional: shell, json, yaml, etc.
  validations:
    required: true
```

#### 3. Dropdown (Single/Multiple Select)

```yaml
- type: dropdown
  id: browser
  attributes:
    label: Browser
    description: What browser are you using?
    multiple: false
    options:
      - Chrome
      - Firefox
      - Safari
      - Edge
    default: 0  # Index of default option
  validations:
    required: true
```

**Multiple selection:**

```yaml
- type: dropdown
  id: platforms
  attributes:
    label: Platforms
    multiple: true
    options:
      - Windows
      - macOS
      - Linux
```

#### 4. Checkboxes

```yaml
- type: checkboxes
  id: terms
  attributes:
    label: Code of Conduct
    description: By submitting, you agree to our rules
    options:
      - label: I agree to follow the Code of Conduct
        required: true
      - label: I have searched for existing issues
        required: false
```

#### 5. Markdown (Static Content)

```yaml
- type: markdown
  attributes:
    value: |
      ## Important Notes

      - Please search existing issues first
      - Provide as much detail as possible
```

### Top-Level Keys

| Key | Required | Type | Description |
|-----|----------|------|-------------|
| `name` | Yes | String | Template name shown in chooser |
| `description` | Yes | String | Template description |
| `body` | Yes | Array | Input field definitions |
| `title` | No | String | Pre-populated issue title |
| `labels` | No | Array/String | Auto-applied labels |
| `assignees` | No | Array/String | Auto-assigned users |
| `projects` | No | Array/String | Auto-add to projects (format: `org/project-number`) |
| `type` | No | String | Organization-level issue type |

### Template Chooser Configuration

Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: GitHub Community Support
    url: https://github.com/orgs/community/discussions
    about: Please ask questions here
  - name: Security Issues
    url: https://security.example.com
    about: Report security vulnerabilities privately
```

### Rendered Output Format

When a user submits an issue form, GitHub converts it to markdown:

```markdown
### Contact Details

email@example.com

### What happened?

The application crashed when I clicked submit.

### Browser

Chrome

### Terms

- [X] I agree to follow the Code of Conduct
- [X] I have searched for existing issues
```

---

## 2. Parsing Issue Bodies in Workflows

### Challenge

Issue forms generate markdown output, not structured data. Workflows need to parse this markdown to extract values.

### Parsing Approaches

#### Approach 1: Issue Body Parser Action

**Best for:** JSON/YAML payloads embedded in issues

```yaml
name: Parse Issue
on:
  issues:
    types: [opened, edited]

jobs:
  parse:
    runs-on: ubuntu-latest
    steps:
      - name: Parse Issue Body
        id: parse
        uses: peter-murray/issue-body-parser-action@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          issue_id: ${{ github.event.issue.number }}
          separator: '###'
          label_marker_start: '>>'
          label_marker_end: '<<'

      - name: Use Parsed Data
        env:
          DATA: ${{ steps.parse.outputs.payload }}
        run: |
          echo "$DATA" | jq '.version'
```

**Issue template for this parser:**

```yaml
name: Deployment Request
description: Request a deployment
body:
  - type: input
    id: version
    attributes:
      label: >>version<<
      description: Version to deploy

  - type: dropdown
    id: environment
    attributes:
      label: >>environment<<
      options:
        - production
        - staging
```

#### Approach 2: GitHub Issue Forms Body Parser

**Best for:** Standard issue forms without markers

```yaml
name: Parse Issue Forms
on:
  issues:
    types: [opened]

jobs:
  parse:
    runs-on: ubuntu-latest
    steps:
      - name: Parse Issue
        id: parse
        uses: zentered/issue-forms-body-parser@v2

      - name: Output Parsed Data
        run: echo '${{ steps.parse.outputs.data }}' | jq
```

**Features:**

- Automatically detects field types (date, time, lists, duration)
- No special markers needed
- Slugifies titles to IDs
- Parses checkboxes into boolean objects

**Example output:**

```json
{
  "version": {
    "order": 0,
    "title": "Version",
    "text": "1.2.3"
  },
  "browser": {
    "order": 1,
    "title": "Browser",
    "text": "Chrome"
  },
  "date": {
    "order": 2,
    "title": "Date",
    "text": "2025-12-23",
    "date": "2025-12-23"
  }
}
```

#### Approach 3: stefanbuck/github-issue-parser

**Best for:** Template-driven parsing

```yaml
- name: Parse issue
  uses: stefanbuck/github-issue-parser@v3
  id: issue-parser
  with:
    template-path: .github/ISSUE_TEMPLATE/bug-report.yml

- name: Use parsed data
  run: echo '${{ steps.issue-parser.outputs.jsonString }}'
```

#### Approach 4: Manual Regex Parsing

**Best for:** Simple, one-off extractions

```yaml
- name: Extract Version
  id: extract
  run: |
    ISSUE_BODY="${{ github.event.issue.body }}"
    VERSION=$(echo "$ISSUE_BODY" | grep -A1 "### Version" | tail -n1 | xargs)
    echo "version=$VERSION" >> $GITHUB_OUTPUT

- name: Use Version
  run: echo "Deploying version ${{ steps.extract.outputs.version }}"
```

**Security Warning:** Always escape user input when using in shell commands:

```yaml
# INSECURE - Shell injection risk
- run: echo ${{ github.event.issue.body }}

# SECURE - Use environment variable
- name: Safe Echo
  env:
    BODY: ${{ github.event.issue.body }}
  run: echo "$BODY"
```

### Comparison Matrix

| Parser | Markers Required | Date Parsing | Checkbox Support | NPM Library | Maintained |
|--------|-----------------|--------------|------------------|-------------|------------|
| peter-murray/issue-body-parser | Yes (custom) | No | Yes (as object) | No | ✅ Yes |
| zentered/issue-forms-body-parser | No | Yes | Yes (as object) | Yes | ✅ Yes |
| stefanbuck/github-issue-parser | No | No | Yes | Yes | ✅ Yes |
| Manual regex | N/A | No | Manual | N/A | N/A |

---

## 3. Issue Commands via Comments

### Pattern Overview

Issue commands allow users to trigger actions by commenting on issues with specific command syntax (e.g., `/deploy`, `/approve`).

### Basic Implementation

```yaml
name: Issue Commands
on:
  issue_comment:
    types: [created]

jobs:
  handle-command:
    # Only run on new comments, not edits to existing comments
    if: github.event.action == 'created'
    runs-on: ubuntu-latest
    steps:
      - name: Check for Command
        id: command
        env:
          COMMENT: ${{ github.event.comment.body }}
        run: |
          # Extract command (first word starting with /)
          COMMAND=$(echo "$COMMENT" | grep -oP '^/\w+' | head -n1)
          echo "command=$COMMAND" >> $GITHUB_OUTPUT

          # Extract arguments (everything after command)
          ARGS=$(echo "$COMMENT" | sed 's|^/[^ ]* *||')
          echo "args=$ARGS" >> $GITHUB_OUTPUT

      - name: Handle Deploy Command
        if: steps.command.outputs.command == '/deploy'
        run: |
          echo "Deploying with args: ${{ steps.command.outputs.args }}"
          # Your deployment logic here

      - name: Handle Approve Command
        if: steps.command.outputs.command == '/approve'
        run: |
          echo "Approving..."
          # Add approval label or close issue
```

### Advanced: Multi-Command Handler

```yaml
name: Bot Commands
on:
  issue_comment:
    types: [created]

jobs:
  bot-commands:
    if: |
      github.event.issue.pull_request == null &&
      startsWith(github.event.comment.body, '/')
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: React to Comment
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.reactions.createForIssueComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: context.payload.comment.id,
              content: 'eyes'
            });

      - name: Parse Command
        id: parse
        env:
          COMMENT_BODY: ${{ github.event.comment.body }}
        run: |
          # Parse command and arguments
          COMMAND=$(echo "$COMMENT_BODY" | head -n1 | cut -d' ' -f1)
          ARGS=$(echo "$COMMENT_BODY" | head -n1 | cut -d' ' -f2-)

          echo "command=$COMMAND" >> $GITHUB_OUTPUT
          echo "args=$ARGS" >> $GITHUB_OUTPUT

      - name: Execute Command
        id: execute
        run: |
          case "${{ steps.parse.outputs.command }}" in
            /deploy)
              echo "result=Deployment started for ${{ steps.parse.outputs.args }}" >> $GITHUB_OUTPUT
              ;;
            /approve)
              echo "result=Issue approved" >> $GITHUB_OUTPUT
              ;;
            /assign)
              echo "result=Assigned to ${{ steps.parse.outputs.args }}" >> $GITHUB_OUTPUT
              ;;
            *)
              echo "result=Unknown command: ${{ steps.parse.outputs.command }}" >> $GITHUB_OUTPUT
              exit 1
              ;;
          esac

      - name: Comment Result
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const result = '${{ steps.execute.outputs.result }}';
            const success = '${{ steps.execute.outcome }}' === 'success';

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              body: success
                ? `✅ ${result}`
                : `❌ ${result}`
            });
```

### Permission-Based Commands

```yaml
- name: Check Permissions
  id: permissions
  uses: actions/github-script@v7
  with:
    result-encoding: string
    script: |
      const { data: perms } = await github.rest.repos.getCollaboratorPermissionLevel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        username: context.actor
      });

      const allowed = ['admin', 'write'].includes(perms.permission);
      return allowed ? 'true' : 'false';

- name: Execute Privileged Command
  if: steps.permissions.outputs.result == 'true'
  run: |
    echo "User has permission to run this command"
```

### Best Practices for Commands

1. **Always validate permissions** before executing sensitive commands
2. **Provide immediate feedback** with reactions (eyes emoji while processing)
3. **Use consistent command syntax** (`/command arg1 arg2`)
4. **Document available commands** in issue templates or repo README
5. **Handle errors gracefully** with clear error messages
6. **Log command execution** for audit trail

---

## 4. Label-Based Workflow Triggers

### Basic Label Trigger

```yaml
name: Label-Based Workflow
on:
  issues:
    types: [labeled, unlabeled]

jobs:
  handle-label:
    runs-on: ubuntu-latest
    steps:
      - name: Check Label
        if: github.event.label.name == 'deploy'
        run: |
          echo "Deploy label added to issue #${{ github.event.issue.number }}"
```

### Multi-Label Logic

```yaml
name: Multi-Label Handler
on:
  issues:
    types: [labeled, unlabeled]

jobs:
  check-labels:
    runs-on: ubuntu-latest
    steps:
      - name: Get All Labels
        id: labels
        uses: actions/github-script@v7
        with:
          script: |
            const labels = context.payload.issue.labels.map(l => l.name);
            core.setOutput('labels', labels.join(','));
            core.setOutput('has_approved', labels.includes('approved') ? 'true' : 'false');
            core.setOutput('has_deploy', labels.includes('deploy') ? 'true' : 'false');

      - name: Ready to Deploy
        if: |
          steps.labels.outputs.has_approved == 'true' &&
          steps.labels.outputs.has_deploy == 'true'
        run: |
          echo "Issue is approved and ready to deploy!"
```

### Environment-Based Routing

```yaml
name: Environment Routing
on:
  issues:
    types: [labeled]

jobs:
  deploy-production:
    if: github.event.label.name == 'deploy:production'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploying to production"

  deploy-staging:
    if: github.event.label.name == 'deploy:staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: echo "Deploying to staging"
```

### Auto-Labeling Based on Issue Content

```yaml
name: Auto Label
on:
  issues:
    types: [opened, edited]

jobs:
  auto-label:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.issue.body || '';
            const labels = [];

            // Add labels based on keywords
            if (body.includes('bug')) labels.push('bug');
            if (body.includes('feature')) labels.push('enhancement');
            if (body.includes('urgent')) labels.push('priority:high');

            // Add labels based on issue form fields
            if (body.match(/### Environment.*production/s)) {
              labels.push('env:production');
            }

            if (labels.length > 0) {
              await github.rest.issues.addLabels({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.issue.number,
                labels: labels
              });
            }
```

### Label-Based Issue Assignment

```yaml
name: Auto Assign
on:
  issues:
    types: [labeled]

jobs:
  assign:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const labelToOwner = {
              'team:backend': 'backend-lead',
              'team:frontend': 'frontend-lead',
              'team:devops': 'devops-lead'
            };

            const assignee = labelToOwner[context.payload.label.name];

            if (assignee) {
              await github.rest.issues.addAssignees({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.issue.number,
                assignees: [assignee]
              });
            }
```

---

## 5. Rate Limiting Strategies

### Understanding GitHub Limits

#### API Rate Limits

| Auth Type | Primary Limit | Secondary Limit |
|-----------|--------------|-----------------|
| Unauthenticated | 60/hour | - |
| `GITHUB_TOKEN` | 1,000/hour/repo (15,000 for GHEC) | 100 concurrent requests |
| Personal Access Token | 5,000/hour | 90s CPU time/60s real time |
| GitHub App | 5,000/hour (scales with repos/users) | 900 points/min per endpoint |

#### Workflow Trigger Limits

| Limit Type | Value |
|------------|-------|
| Workflow events | 1,500 events / 10 seconds / repo |
| Queued workflow runs | 500 runs / 10 seconds |
| Job matrix size | 256 jobs |
| Job execution time | 6 hours (GitHub-hosted), 5 days (self-hosted) |

### Strategy 1: Concurrency Groups

Prevent multiple workflow runs from executing simultaneously:

```yaml
name: Deploy
on:
  issues:
    types: [labeled]

concurrency:
  group: deploy-${{ github.event.issue.number }}
  cancel-in-progress: false  # Queue instead of cancel

jobs:
  deploy:
    if: github.event.label.name == 'deploy'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying..."
```

**Advanced concurrency patterns:**

```yaml
# Repository-wide concurrency
concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true

# Label-based concurrency
concurrency:
  group: deploy-${{ contains(github.event.issue.labels.*.name, 'production') && 'prod' || 'staging' }}
  cancel-in-progress: false
```

### Strategy 2: Debouncing with Labels

Use labels to track rate limiting state:

```yaml
name: Rate Limited Workflow
on:
  issues:
    types: [labeled]

jobs:
  check-rate-limit:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Check Last Run
        id: check
        uses: actions/github-script@v7
        with:
          script: |
            const labels = context.payload.issue.labels.map(l => l.name);
            const rateLabel = labels.find(l => l.startsWith('rate-limit:'));

            if (rateLabel) {
              const timestamp = rateLabel.split(':')[1];
              const lastRun = new Date(parseInt(timestamp));
              const now = new Date();
              const diff = (now - lastRun) / 1000 / 60; // minutes

              if (diff < 5) {
                core.setOutput('skip', 'true');
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: context.payload.issue.number,
                  body: `⏱️ Rate limited. Please wait ${Math.ceil(5 - diff)} more minutes.`
                });
                return;
              }

              // Remove old rate limit label
              await github.rest.issues.removeLabel({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.issue.number,
                name: rateLabel
              });
            }

            // Add new rate limit label
            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              labels: [`rate-limit:${Date.now()}`]
            });

            core.setOutput('skip', 'false');

      - name: Run Workflow
        if: steps.check.outputs.skip == 'false'
        run: echo "Executing workflow..."
```

### Strategy 3: Queue Management with Issue Metadata

Use issue metadata (custom fields) to implement a queue:

```yaml
name: Queue Manager
on:
  issues:
    types: [labeled]

jobs:
  queue:
    if: github.event.label.name == 'queue:pending'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            // Get all issues in queue
            const { data: issues } = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              labels: 'queue:processing',
              state: 'open'
            });

            // Check if queue is full
            if (issues.length >= 3) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.issue.number,
                body: '⏳ Queue is full. Your request will be processed when capacity is available.'
              });
              return;
            }

            // Update label to processing
            await github.rest.issues.removeLabel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              name: 'queue:pending'
            });

            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              labels: ['queue:processing']
            });
```

### Strategy 4: Exponential Backoff for API Calls

```yaml
- name: API Call with Retry
  uses: actions/github-script@v7
  with:
    script: |
      const maxRetries = 3;

      async function retryWithBackoff(fn, retries = 0) {
        try {
          return await fn();
        } catch (error) {
          if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
            if (retries < maxRetries) {
              const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
              core.info(`Rate limited. Waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              return retryWithBackoff(fn, retries + 1);
            }
          }
          throw error;
        }
      }

      await retryWithBackoff(async () => {
        return await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.issue.number,
          body: 'Processing complete!'
        });
      });
```

---

## 6. Bot Comments and Status Updates

### Basic Status Comment

```yaml
name: Status Updates
on:
  issues:
    types: [labeled]

jobs:
  update-status:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Add Initial Comment
        id: comment
        uses: actions/github-script@v7
        with:
          script: |
            const { data: comment } = await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              body: '🔄 **Status:** Processing...'
            });
            return comment.id;
          result-encoding: string

      - name: Do Work
        run: |
          sleep 5
          echo "Work complete"

      - name: Update Comment
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.comment.outputs.result }},
              body: '✅ **Status:** Complete!'
            });
```

### Progressive Status Updates

```yaml
- name: Create Progress Comment
  id: progress
  uses: actions/github-script@v7
  with:
    script: |
      const { data } = await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: [
          '## Deployment Progress',
          '',
          '- [ ] Build application',
          '- [ ] Run tests',
          '- [ ] Deploy to staging',
          '- [ ] Run smoke tests',
          '- [ ] Deploy to production'
        ].join('\n')
      });
      return data.id;
    result-encoding: string

- name: Update Step 1
  uses: actions/github-script@v7
  with:
    script: |
      const { data: comment } = await github.rest.issues.getComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: ${{ steps.progress.outputs.result }}
      });

      const updated = comment.body.replace(
        '- [ ] Build application',
        '- [x] Build application ✅'
      );

      await github.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: ${{ steps.progress.outputs.result }},
        body: updated
      });

- name: Build
  run: npm run build

# Repeat for each step...
```

### Status Comment with Details

```yaml
- name: Detailed Status
  uses: actions/github-script@v7
  with:
    script: |
      const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: [
          '## 🚀 Deployment Status',
          '',
          '| Field | Value |',
          '|-------|-------|',
          `| Status | ${'✅ Success' || '❌ Failed'} |`,
          `| Environment | ${process.env.ENVIRONMENT} |`,
          `| Version | ${process.env.VERSION} |`,
          `| Started | ${new Date().toISOString()} |`,
          `| Triggered by | @${context.actor} |`,
          '',
          `[View workflow run](${runUrl})`
        ].join('\n')
      });
```

### Reaction-Based Acknowledgment

```yaml
- name: Acknowledge with Reaction
  uses: actions/github-script@v7
  with:
    script: |
      // Add reaction to issue
      await github.rest.reactions.createForIssue({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        content: 'rocket'
      });
```

**Available reactions:** `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes`

### Error Handling with Status Comments

```yaml
- name: Execute with Error Handling
  id: execute
  continue-on-error: true
  run: |
    # Your command here
    npm run deploy

- name: Report Status
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const success = '${{ steps.execute.outcome }}' === 'success';
      const icon = success ? '✅' : '❌';
      const status = success ? 'Success' : 'Failed';

      let body = `${icon} **Deployment ${status}**\n\n`;

      if (!success) {
        body += '## Error Details\n\n';
        body += '```\n';
        body += '${{ steps.execute.outputs.stderr }}' || 'No error details available';
        body += '\n```\n';
      }

      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: body
      });
```

---

## 7. Linking Issues to PRs Programmatically

### Auto-Create PR from Issue

```yaml
name: Create PR from Issue
on:
  issues:
    types: [labeled]

jobs:
  create-pr:
    if: github.event.label.name == 'create-pr'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4

      - name: Parse Issue
        id: parse
        uses: stefanbuck/github-issue-parser@v3
        with:
          template-path: .github/ISSUE_TEMPLATE/feature.yml

      - name: Create Branch
        run: |
          BRANCH="issue-${{ github.event.issue.number }}"
          git checkout -b "$BRANCH"
          echo "branch=$BRANCH" >> $GITHUB_OUTPUT
        id: branch

      - name: Make Changes
        run: |
          # Your automation logic here
          echo "Automated change" > changes.txt
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "Implement #${{ github.event.issue.number }}"

      - name: Push Branch
        run: git push origin ${{ steps.branch.outputs.branch }}

      - name: Create Pull Request
        uses: actions/github-script@v7
        with:
          script: |
            const issue = context.payload.issue;

            const { data: pr } = await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: issue.title,
              head: '${{ steps.branch.outputs.branch }}',
              base: 'main',
              body: [
                `Closes #${issue.number}`,
                '',
                '## Changes',
                '',
                issue.body
              ].join('\n')
            });

            // Link back to issue
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: issue.number,
              body: `✅ Pull request created: #${pr.number}`
            });
```

### Link Existing PR to Issue

```yaml
name: Link PR to Issue
on:
  pull_request:
    types: [opened]

jobs:
  link:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      issues: write
    steps:
      - name: Extract Issue Number
        id: issue
        run: |
          # Extract from branch name (e.g., issue-123)
          BRANCH="${{ github.head_ref }}"
          ISSUE_NUM=$(echo "$BRANCH" | grep -oP 'issue-\K\d+' || echo "")

          if [ -z "$ISSUE_NUM" ]; then
            # Extract from PR title or body
            ISSUE_NUM=$(echo "${{ github.event.pull_request.title }}" | grep -oP '#\K\d+' | head -n1 || echo "")
          fi

          echo "number=$ISSUE_NUM" >> $GITHUB_OUTPUT

      - name: Link to Issue
        if: steps.issue.outputs.number != ''
        uses: actions/github-script@v7
        with:
          script: |
            const issueNumber = ${{ steps.issue.outputs.number }};
            const prNumber = context.payload.pull_request.number;

            // Add comment to issue
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: issueNumber,
              body: `🔗 Linked to PR #${prNumber}`
            });

            // Add comment to PR
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: prNumber,
              body: `📋 Implements #${issueNumber}`
            });
```

### Auto-Close Issue on PR Merge

```yaml
name: Auto Close Issue
on:
  pull_request:
    types: [closed]

jobs:
  close-issue:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Extract and Close Issues
        uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.pull_request.body || '';

            // Match "Closes #123", "Fixes #456", etc.
            const regex = /(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
            const matches = [...body.matchAll(regex)];

            for (const match of matches) {
              const issueNumber = parseInt(match[3]);

              await github.rest.issues.update({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issueNumber,
                state: 'closed'
              });

              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issueNumber,
                body: `✅ Closed by PR #${context.payload.pull_request.number}`
              });
            }
```

### Create Development Issue from PR

```yaml
name: Create Issue from PR
on:
  pull_request:
    types: [opened]

jobs:
  create-issue:
    if: contains(github.event.pull_request.labels.*.name, 'needs-issue')
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request;

            const { data: issue } = await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Track: ${pr.title}`,
              body: [
                `Created from PR #${pr.number}`,
                '',
                '## Description',
                '',
                pr.body || 'No description provided'
              ].join('\n'),
              labels: ['tracking']
            });

            // Update PR body to reference issue
            await github.rest.pulls.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: pr.number,
              body: `Closes #${issue.number}\n\n${pr.body}`
            });
```

---

## 8. Loop Prevention

### Challenge

IssueOps workflows can trigger themselves, creating infinite loops:

- Workflow adds label → triggers workflow → adds label → ...
- Workflow comments → triggers on comment → comments → ...
- Workflow updates issue → triggers workflow → updates issue → ...

### Strategy 1: Filter by Actor

```yaml
name: Prevent Bot Loops
on:
  issues:
    types: [opened, edited, labeled]
  issue_comment:
    types: [created]

jobs:
  process:
    # Skip if triggered by bot
    if: github.actor != 'github-actions[bot]'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Processing issue..."
```

**Variations:**

```yaml
# Skip any bot
if: github.actor != 'github-actions[bot]' && !endsWith(github.actor, '[bot]')

# Skip specific bot
if: github.actor != 'my-custom-bot[bot]'

# Only allow humans
if: github.event.sender.type == 'User'
```

### Strategy 2: Sentinel Labels

Use a special label to mark processed issues:

```yaml
name: Process Once
on:
  issues:
    types: [opened, labeled]

jobs:
  process:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Check if Already Processed
        id: check
        uses: actions/github-script@v7
        with:
          script: |
            const labels = context.payload.issue.labels.map(l => l.name);
            const processed = labels.includes('processed');
            core.setOutput('skip', processed ? 'true' : 'false');

      - name: Process Issue
        if: steps.check.outputs.skip == 'false'
        run: echo "Processing..."

      - name: Mark as Processed
        if: steps.check.outputs.skip == 'false'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              labels: ['processed']
            });
```

### Strategy 3: Event Action Filtering

Only trigger on specific sub-events:

```yaml
name: Precise Triggering
on:
  issues:
    types: [opened]  # Not labeled, edited, etc.
  issue_comment:
    types: [created]  # Not edited, deleted

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Only runs on new issues/comments"
```

### Strategy 4: Idempotency with Issue Body Markers

Track processing in issue body:

```yaml
name: Idempotent Processing
on:
  issues:
    types: [opened, edited]

jobs:
  process:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Check if Processed
        id: check
        env:
          BODY: ${{ github.event.issue.body }}
        run: |
          if echo "$BODY" | grep -q "<!-- processed:"; then
            echo "skip=true" >> $GITHUB_OUTPUT
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi

      - name: Process
        if: steps.check.outputs.skip == 'false'
        run: echo "Processing..."

      - name: Mark Processed
        if: steps.check.outputs.skip == 'false'
        uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.issue.body;
            const timestamp = new Date().toISOString();
            const marker = `\n\n<!-- processed:${timestamp} -->`;

            await github.rest.issues.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              body: body + marker
            });
```

### Strategy 5: Workflow Dispatch Only

Remove event triggers and use manual/API dispatch only:

```yaml
name: Controlled Execution
on:
  workflow_dispatch:
    inputs:
      issue_number:
        required: true
        type: number

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Processing issue ${{ inputs.issue_number }}"
```

Trigger from another workflow:

```yaml
- name: Trigger Processing
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: 'process.yml',
        ref: 'main',
        inputs: {
          issue_number: context.payload.issue.number.toString()
        }
      });
```

### Strategy 6: Concurrency with Auto-Cancel

```yaml
name: Auto-Cancel Duplicates
on:
  issues:
    types: [labeled]

concurrency:
  group: process-${{ github.event.issue.number }}
  cancel-in-progress: true  # Cancel previous run

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Only latest run continues"
```

### Strategy 7: Rate Limiting Guard

```yaml
- name: Check Run Frequency
  id: frequency
  uses: actions/github-script@v7
  with:
    script: |
      const { data: runs } = await github.rest.actions.listWorkflowRuns({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: 'process.yml',
        per_page: 10
      });

      const recentRuns = runs.workflow_runs.filter(run => {
        const age = Date.now() - new Date(run.created_at);
        return age < 5 * 60 * 1000; // Last 5 minutes
      });

      if (recentRuns.length > 3) {
        core.setFailed('Too many workflow runs in the last 5 minutes');
      }
```

### Best Practices Matrix

| Strategy | Use Case | Pros | Cons |
|----------|----------|------|------|
| Actor filtering | Bot-triggered events | Simple, reliable | Doesn't prevent human loops |
| Sentinel labels | One-time processing | Clear state | Label pollution |
| Event filtering | Precise control | No extra state | Limited flexibility |
| Body markers | Idempotency | Hidden from users | Issue body edits |
| Workflow dispatch | Full control | No loops possible | Manual trigger required |
| Concurrency | Duplicate prevention | Built-in feature | Doesn't prevent different triggers |
| Rate limiting | Abuse prevention | Comprehensive | Complex logic |

---

## 9. Complete Working Example

### Use Case: Deployment Request System

Complete end-to-end example implementing all patterns.

#### Issue Template

`.github/ISSUE_TEMPLATE/deploy.yml`:

```yaml
name: Deployment Request
description: Request a deployment to staging or production
title: "[Deploy] "
labels: ["deploy:pending", "automation"]
body:
  - type: markdown
    attributes:
      value: |
        ## Deployment Request

        Fill out this form to request a deployment.

  - type: dropdown
    id: environment
    attributes:
      label: Environment
      description: Target environment
      options:
        - staging
        - production
      default: 0
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Version
      description: Version tag to deploy (e.g., v1.2.3)
      placeholder: v1.2.3
    validations:
      required: true

  - type: textarea
    id: reason
    attributes:
      label: Deployment Reason
      description: Why is this deployment needed?
      placeholder: Bug fix for critical issue
    validations:
      required: true

  - type: checkboxes
    id: checks
    attributes:
      label: Pre-deployment Checklist
      options:
        - label: Tests are passing
          required: true
        - label: Documentation updated
          required: false
        - label: Team notified
          required: true
```

#### Main Workflow

`.github/workflows/deploy-issueops.yml`:

```yaml
name: IssueOps Deployment
on:
  issues:
    types: [opened, labeled]
  issue_comment:
    types: [created]

concurrency:
  group: deploy-${{ github.event.issue.number }}
  cancel-in-progress: false

permissions:
  issues: write
  contents: write

jobs:
  # Job 1: Parse and validate deployment request
  validate:
    if: |
      github.event.issue.state == 'open' &&
      contains(github.event.issue.labels.*.name, 'deploy:pending') &&
      github.actor != 'github-actions[bot]'
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.parse.outputs.environment }}
      version: ${{ steps.parse.outputs.version }}
      reason: ${{ steps.parse.outputs.reason }}
    steps:
      - name: React to Issue
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.reactions.createForIssue({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              content: 'eyes'
            });

      - name: Parse Issue
        id: parse
        uses: zentered/issue-forms-body-parser@v2

      - name: Validate Request
        env:
          DATA: ${{ steps.parse.outputs.data }}
        run: |
          ENV=$(echo "$DATA" | jq -r '.environment.text')
          VERSION=$(echo "$DATA" | jq -r '.version.text')

          echo "environment=$ENV" >> $GITHUB_OUTPUT
          echo "version=$VERSION" >> $GITHUB_OUTPUT

          # Validate version format
          if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid version format: $VERSION"
            exit 1
          fi

      - name: Update Labels
        uses: actions/github-script@v7
        with:
          script: |
            // Remove pending, add validated
            await github.rest.issues.removeLabel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              name: 'deploy:pending'
            });

            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              labels: ['deploy:validated']
            });

  # Job 2: Handle approval commands
  approval:
    if: |
      github.event_name == 'issue_comment' &&
      contains(github.event.issue.labels.*.name, 'deploy:validated') &&
      startsWith(github.event.comment.body, '/approve')
    runs-on: ubuntu-latest
    steps:
      - name: Check Permissions
        id: perms
        uses: actions/github-script@v7
        with:
          result-encoding: string
          script: |
            const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              username: context.actor
            });

            const allowed = ['admin', 'write'].includes(data.permission);
            return allowed ? 'true' : 'false';

      - name: Approve Deployment
        if: steps.perms.outputs.result == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.removeLabel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              name: 'deploy:validated'
            });

            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              labels: ['deploy:approved']
            });

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              body: `✅ Deployment approved by @${context.actor}`
            });

      - name: Reject if No Permission
        if: steps.perms.outputs.result == 'false'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              body: `❌ @${context.actor} does not have permission to approve deployments`
            });

  # Job 3: Execute deployment
  deploy:
    if: |
      contains(github.event.issue.labels.*.name, 'deploy:approved') &&
      !contains(github.event.issue.labels.*.name, 'deploy:complete')
    runs-on: ubuntu-latest
    environment:
      name: ${{ fromJSON(needs.validate.outputs.environment == 'production' && 'production' || 'staging') }}
    needs: validate
    steps:
      - name: Create Status Comment
        id: status
        uses: actions/github-script@v7
        with:
          script: |
            const { data } = await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              body: [
                '## 🚀 Deployment in Progress',
                '',
                '| Step | Status |',
                '|------|--------|',
                '| Checkout | ⏳ Pending |',
                '| Build | ⏳ Pending |',
                '| Test | ⏳ Pending |',
                '| Deploy | ⏳ Pending |',
                '| Verify | ⏳ Pending |'
              ].join('\n')
            });
            return data.id;
          result-encoding: string

      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ needs.validate.outputs.version }}

      - name: Update Status - Checkout
        uses: actions/github-script@v7
        with:
          script: |
            const { data } = await github.rest.issues.getComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.status.outputs.result }}
            });

            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.status.outputs.result }},
              body: data.body.replace('| Checkout | ⏳ Pending |', '| Checkout | ✅ Complete |')
            });

      - name: Build
        run: |
          echo "Building version ${{ needs.validate.outputs.version }}"
          # Your build commands here

      - name: Update Status - Build
        uses: actions/github-script@v7
        with:
          script: |
            const { data } = await github.rest.issues.getComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.status.outputs.result }}
            });

            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.status.outputs.result }},
              body: data.body.replace('| Build | ⏳ Pending |', '| Build | ✅ Complete |')
            });

      - name: Deploy
        env:
          ENVIRONMENT: ${{ needs.validate.outputs.environment }}
          VERSION: ${{ needs.validate.outputs.version }}
        run: |
          echo "Deploying $VERSION to $ENVIRONMENT"
          # Your deployment commands here

      - name: Update Status - Deploy
        uses: actions/github-script@v7
        with:
          script: |
            const { data } = await github.rest.issues.getComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.status.outputs.result }}
            });

            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: ${{ steps.status.outputs.result }},
              body: data.body.replace('| Deploy | ⏳ Pending |', '| Deploy | ✅ Complete |')
            });

      - name: Mark Complete
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.removeLabel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              name: 'deploy:approved'
            });

            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              labels: ['deploy:complete']
            });

            await github.rest.issues.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.issue.number,
              state: 'closed'
            });
```

#### Available Commands

Users can comment on issues with:

- `/approve` - Approve deployment (requires write permission)
- `/cancel` - Cancel deployment
- `/rollback` - Rollback to previous version

---

## References

### Official Documentation

- [GitHub Issue Forms Syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub Actions Events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- [GitHub REST API - Issues](https://docs.github.com/en/rest/issues)
- [GitHub Actions Rate Limits](https://docs.github.com/en/actions/reference/limits)
- [REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

### Community Actions

- [peter-murray/issue-body-parser-action](https://github.com/marketplace/actions/issue-body-parser) - Parse JSON/YAML from issue bodies
- [zentered/issue-forms-body-parser](https://github.com/marketplace/actions/github-issue-forms-body-parser) - Parse issue forms with date/time support
- [stefanbuck/github-issue-parser](https://github.com/stefanbuck/github-issue-parser) - Template-driven parsing
- [actions/github-script](https://github.com/marketplace/actions/github-script) - Run inline JavaScript with GitHub API

### Community Discussions

- [Using Issue Forms with GitHub Actions](https://github.com/orgs/community/discussions/6838)
- [Issue Forms Dropdown Dynamic Options](https://github.com/orgs/community/discussions/4299)
- [GitHub Actions Throttling Best Practices](https://github.com/octokit/discussions/issues/2)

### Key Insights

1. **Structured Input is Key** - Issue forms provide much better structure than free-form markdown
2. **Security First** - Always validate permissions and escape user input
3. **Idempotency Matters** - Design workflows to handle re-runs safely
4. **User Feedback** - Provide clear status updates and error messages
5. **Rate Limiting** - Implement concurrency controls and exponential backoff
6. **Loop Prevention** - Use multiple strategies (actor filtering, sentinel labels, event filtering)
7. **Observability** - Log actions and provide audit trails

### Common Pitfalls

1. **Shell Injection** - Never interpolate user input directly into shell commands
2. **Infinite Loops** - Bot actions triggering workflows that trigger bot actions
3. **Rate Limiting** - Hitting API limits with high-frequency operations
4. **Permission Issues** - Workflows failing due to insufficient token permissions
5. **Concurrency Problems** - Multiple workflow runs modifying the same issue
6. **Label Pollution** - Creating too many labels for state management
7. **Missing Error Handling** - Not handling failures gracefully

### Production Checklist

- [ ] Input validation implemented
- [ ] Permission checks in place
- [ ] Loop prevention strategies applied
- [ ] Rate limiting guards configured
- [ ] Error handling and user feedback
- [ ] Audit logging enabled
- [ ] Concurrency controls set
- [ ] Documentation for users
- [ ] Rollback procedures defined
- [ ] Monitoring and alerts configured
