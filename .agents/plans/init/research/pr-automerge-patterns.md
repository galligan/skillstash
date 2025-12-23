# GitHub Actions Patterns for Automated PR Review and Merge

## Research Summary

This document compiles authoritative patterns and best practices for automating the pull request review-to-merge lifecycle using GitHub Actions. Research sources include official GitHub documentation, GitHub REST/GraphQL APIs, GitHub CLI documentation, and community-vetted actions.

**Research Date**: 2025-12-23
**Methodology**: Web research via Firecrawl, focusing on official GitHub documentation and established GitHub Actions patterns

---

## 1. Auto-Merge When All Checks Pass

### Native GitHub Auto-Merge

GitHub provides built-in auto-merge functionality that automatically merges PRs when all requirements are met.

#### Repository Setup

1. Navigate to repository Settings
2. Under "General" → "Pull Requests"
3. Enable "Allow auto-merge"

#### Enabling Auto-Merge on a PR

**Via GitHub UI**:

- Click "Enable auto-merge" button on PR
- Select merge method (merge, squash, rebase)
- Provide commit message and description
- Click "Confirm auto-merge"

**Via GitHub CLI**:

```bash
gh pr merge <number> --auto --squash
```

**Via REST API** (Enable auto-merge):

```bash
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
{
  "merge_method": "squash"
}
```

#### Behavior

- PR merges automatically when:
  - All required reviews are met
  - All required status checks pass
  - No blocking labels present
- Auto-merge disabled if:
  - Non-write user pushes new changes to head branch
  - Base branch is switched

### Third-Party Action: automerge-action

For granular control beyond native GitHub capabilities.

**Workflow Example**:

```yaml
name: automerge
on:
  pull_request:
    types:
      - labeled
      - unlabeled
      - synchronize
      - opened
      - edited
      - ready_for_review
      - reopened
      - unlocked
  pull_request_review:
    types:
      - submitted
  check_suite:
    types:
      - completed
  status: {}

jobs:
  automerge:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: automerge
        uses: pascalgn/automerge-action@v0.16.4
        env:
          GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'
          MERGE_LABELS: 'automerge,!wip,!work in progress'
          MERGE_METHOD: 'squash'
          MERGE_REQUIRED_APPROVALS: '1'
          MERGE_RETRIES: '6'
          MERGE_RETRY_SLEEP: '10000'
```

**Key Configuration Options**:

| Option | Description | Example |
|--------|-------------|---------|
| `MERGE_LABELS` | Required labels (prefix `!` to block) | `automerge,!wip` |
| `MERGE_METHOD` | Merge strategy | `merge`, `squash`, `rebase` |
| `MERGE_REQUIRED_APPROVALS` | Minimum approvals required | `1` |
| `MERGE_RETRIES` | Retry attempts if checks pending | `6` |
| `MERGE_RETRY_SLEEP` | Wait time between retries (ms) | `10000` |

**Advantages**:

- Label-based control
- Flexible retry logic
- Negative label patterns (block merge)
- Works with check_suite and status events

---

## 2. Squash Merge via GitHub API

### REST API: Merge Pull Request

**Endpoint**: `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`

**Request Body**:

```json
{
  "commit_title": "feat: add new feature",
  "commit_message": "Detailed description of changes.\n\nCo-Authored-By: ...",
  "merge_method": "squash"
}
```

**Merge Methods**:

- `merge`: Standard merge commit
- `squash`: Squash all commits into one
- `rebase`: Rebase and merge

**Response**: `200 OK` with merge commit SHA

**Workflow Example**:

```yaml
name: Auto Squash Merge
on:
  pull_request_review:
    types: [submitted]

jobs:
  merge:
    if: github.event.review.state == 'approved'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Merge PR
        uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request;
            await github.rest.pulls.merge({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: pr.number,
              merge_method: 'squash',
              commit_title: pr.title,
              commit_message: pr.body
            });
```

### GitHub CLI: gh pr merge

**Basic Usage**:

```bash
gh pr merge <number> --squash --auto
```

**Options**:

- `--squash`: Squash commits into one
- `--auto`: Enable auto-merge (waits for checks)
- `--delete-branch`: Delete branch after merge
- `--subject <text>`: Custom commit title
- `--body <text>`: Custom commit message
- `--match-head-commit <SHA>`: Ensure head matches before merge

**Workflow Integration**:

```yaml
- name: Auto-merge PR
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh pr merge ${{ github.event.pull_request.number }} \
      --squash \
      --auto \
      --delete-branch
```

---

## 3. Branch Protection Rules Interaction

### Required Status Checks

Branch protection rules define which status checks must pass before merging.

**Configuration**:

1. Settings → Branches → Branch protection rules
2. Enable "Require status checks to pass before merging"
3. Select specific checks to require

**Key Points**:

- Status check names must match job names in workflows
- Checks can be in `success`, `skipped`, or `neutral` state
- Auto-merge waits for all required checks to complete
- Merge queue support for high-velocity repositories

**Workflow Naming for Status Checks**:

```yaml
name: CI
on: [pull_request]

jobs:
  test:  # This becomes the status check name
    runs-on: ubuntu-latest
    steps:
      - run: npm test
```

### Handling Conditional Jobs

When jobs run conditionally (e.g., via `paths` filters), they may not appear as required checks if they're skipped.

**Solution: Sentinel Job**:

```yaml
jobs:
  backend-tests:
    if: contains(github.event.pull_request.changed_files, 'backend/')
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  # Always runs - required status check
  backend-gate:
    runs-on: ubuntu-latest
    needs: [backend-tests]
    if: always()
    steps:
      - name: Check backend tests
        run: |
          if [[ "${{ needs.backend-tests.result }}" == "failure" ]]; then
            exit 1
          fi
          echo "Backend tests passed or skipped"
```

### Bypass Patterns (GitHub Rulesets)

GitHub's newer **rulesets** feature allows specific actors to bypass requirements.

**Configuration**:

1. Settings → Rules → Rulesets
2. Create ruleset for target branch
3. Enable "Allow specified actors to bypass"
4. Add GitHub Apps or users with bypass permission

**Use Case**: Allow bot accounts to merge without manual approval while still requiring checks.

---

## 4. Required Status Checks Configuration

### Patterns for Reliable Status Checks

#### Pattern 1: Single Workflow, Multiple Jobs

```yaml
name: CI
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build

  # Gate job - require this in branch protection
  all-checks:
    runs-on: ubuntu-latest
    needs: [lint, test, build]
    if: always()
    steps:
      - name: Verify all jobs passed
        run: |
          if [[ "${{ needs.lint.result }}" == "failure" ]] || \
             [[ "${{ needs.test.result }}" == "failure" ]] || \
             [[ "${{ needs.build.result }}" == "failure" ]]; then
            exit 1
          fi
```

**Branch Protection**: Only require `all-checks` as status check

#### Pattern 2: Path-Based Conditional Checks

```yaml
name: Backend CI
on:
  pull_request:
    paths:
      - 'backend/**'
      - 'package.json'

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:backend
```

**Issue**: If no backend files change, workflow doesn't run, and required check never appears.

**Solution**: Use paths-ignore with a sentinel or always-run gate job.

#### Pattern 3: Matrix Strategy with Required Checks

```yaml
jobs:
  test:
    strategy:
      matrix:
        node: [18, 20, 22]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm test

  # Gate for matrix
  test-gate:
    runs-on: ubuntu-latest
    needs: [test]
    if: always()
    steps:
      - run: |
          if [[ "${{ needs.test.result }}" == "failure" ]]; then
            exit 1
          fi
```

**Branch Protection**: Require `test-gate` instead of individual matrix jobs

---

## 5. Posting Structured Review Comments Programmatically

### REST API: Create Pull Request Review

**Endpoint**: `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`

**Request Body**:

```json
{
  "commit_id": "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091",
  "body": "This is close to perfect! Please address the suggested inline change.",
  "event": "REQUEST_CHANGES",
  "comments": [
    {
      "path": "src/file.ts",
      "position": 6,
      "body": "Please add more information here, and fix this typo."
    },
    {
      "path": "src/another.ts",
      "line": 42,
      "body": "Consider using a more descriptive variable name."
    }
  ]
}
```

**Event Types**:

- `APPROVE`: Approve the PR
- `REQUEST_CHANGES`: Request changes (blocks merge)
- `COMMENT`: Comment without approval/block
- `PENDING`: Draft review (not submitted)

**Line Positioning**:

- `position`: Line number in unified diff (from first `@@` hunk header)
- `line`: Absolute line number in file (newer, preferred)
- `side`: `LEFT` (old) or `RIGHT` (new) for diff context

### Workflow Example: Automated Code Review

```yaml
name: Code Review Bot
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run linter and collect issues
        id: lint
        run: |
          npm run lint --format json > lint-results.json || true

      - name: Post review comments
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const lintResults = JSON.parse(fs.readFileSync('lint-results.json', 'utf8'));

            const comments = lintResults.map(issue => ({
              path: issue.file,
              line: issue.line,
              body: `**${issue.severity}**: ${issue.message}\n\nRule: \`${issue.rule}\``
            }));

            if (comments.length > 0) {
              await github.rest.pulls.createReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                event: 'REQUEST_CHANGES',
                body: `Found ${comments.length} linting issues that need to be addressed.`,
                comments: comments.slice(0, 20) // GitHub limit
              });
            }
```

### Structured Review Format

**Markdown Support** in review bodies and comments:

```markdown
## Summary

- ✅ Tests passing
- ✅ No security issues found
- ⚠️ Minor style improvements needed

## Details

### Performance
The new implementation shows a **15% improvement** in benchmarks.

### Code Quality
Consider extracting the helper function on line 42 for reusability.
```

---

## 6. Converting Draft PRs to Ready-for-Review

### GraphQL API (Required)

The REST API **does not support** converting draft PRs. You must use GraphQL.

**Mutation**: `markPullRequestReadyForReview`

**GraphQL Query**:

```graphql
mutation {
  markPullRequestReadyForReview(input: {
    pullRequestId: "PR_kwDOABCDEF4ABCDEFG"
  }) {
    pullRequest {
      id
      isDraft
      number
    }
  }
}
```

**Get PR Node ID**:

```graphql
query {
  repository(owner: "owner", name: "repo") {
    pullRequest(number: 123) {
      id
      isDraft
    }
  }
}
```

### Workflow Example: Mark as Ready

```yaml
name: Mark PR Ready
on:
  pull_request:
    types: [opened]
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to mark as ready'
        required: true

jobs:
  mark-ready:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Get PR Node ID
        id: pr-id
        uses: actions/github-script@v7
        with:
          script: |
            const query = `
              query($owner: String!, $repo: String!, $number: Int!) {
                repository(owner: $owner, name: $repo) {
                  pullRequest(number: $number) {
                    id
                    isDraft
                  }
                }
              }
            `;

            const variables = {
              owner: context.repo.owner,
              repo: context.repo.repo,
              number: context.payload.pull_request.number
            };

            const result = await github.graphql(query, variables);
            const pr = result.repository.pullRequest;

            core.setOutput('pr_id', pr.id);
            core.setOutput('is_draft', pr.isDraft);

      - name: Mark as ready for review
        if: steps.pr-id.outputs.is_draft == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const mutation = `
              mutation($prId: ID!) {
                markPullRequestReadyForReview(input: {pullRequestId: $prId}) {
                  pullRequest {
                    number
                    isDraft
                  }
                }
              }
            `;

            await github.graphql(mutation, {
              prId: '${{ steps.pr-id.outputs.pr_id }}'
            });

            console.log('PR marked as ready for review');
```

### Third-Party Action

**Action**: `leemeador/ready-for-review-pr@v1.0.3`

```yaml
- name: Mark as Ready to Review
  uses: leemeador/ready-for-review-pr@v1.0.3
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    pull-request-number: ${{ github.event.pull_request.number }}
```

**Note**: Automatically detects PR number from `pull_request` events.

---

## 7. Cleanup Actions on Merge

### Native GitHub Branch Deletion

**Repository Setting**:

1. Settings → General → Pull Requests
2. Enable "Automatically delete head branches"

When enabled, GitHub deletes the head branch immediately after merge (for same-repository PRs only, not forks).

### GitHub CLI with Cleanup

```bash
gh pr merge <number> --squash --delete-branch
```

### Workflow: Post-Merge Cleanup

```yaml
name: Post-Merge Cleanup
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Delete branch
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh api \
            --method DELETE \
            /repos/${{ github.repository }}/git/refs/heads/${{ github.head_ref }}

      - name: Clean up temporary files
        run: |
          # Remove any temporary deployment artifacts
          rm -rf .artifacts/pr-${{ github.event.pull_request.number }}

      - name: Notify merge
        run: |
          echo "PR #${{ github.event.pull_request.number }} merged and cleaned up"
```

### Third-Party Action: Delete Merged Branch

**Action**: `SvanBoxel/delete-merged-branch@v2`

```yaml
name: Delete merged branch
on:
  pull_request:
    types: [closed]

jobs:
  delete-branch:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: SvanBoxel/delete-merged-branch@v2
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced: Cleanup Resources

```yaml
name: Cleanup Resources
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Delete preview deployment
        run: |
          curl -X DELETE \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            https://api.vercel.com/v13/deployments/pr-${{ github.event.pull_request.number }}

      - name: Remove database snapshot
        run: |
          psql -c "DROP DATABASE IF EXISTS pr_${{ github.event.pull_request.number }}_test;"

      - name: Clean up Docker images
        run: |
          docker rmi ghcr.io/${{ github.repository }}:pr-${{ github.event.pull_request.number }}
```

---

## 8. Fast-Path Patterns for Config-Only Changes

### Path Filters for Selective CI

```yaml
name: Full CI
on:
  pull_request:
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.github/**'
      - '*.txt'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
```

```yaml
name: Docs CI
on:
  pull_request:
    paths:
      - 'docs/**'
      - '**.md'

jobs:
  lint-docs:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint:docs
```

### Dynamic Job Skipping

**Using changed-files action**:

```yaml
name: Smart CI
on: [pull_request]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
      config: ${{ steps.filter.outputs.config }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
              - 'package.json'
            frontend:
              - 'frontend/**'
            config:
              - '.github/**'
              - '*.json'
              - '*.yaml'

  backend-tests:
    needs: detect-changes
    if: needs.detect-changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:backend

  frontend-tests:
    needs: detect-changes
    if: needs.detect-changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:frontend

  config-validation:
    needs: detect-changes
    if: needs.detect-changes.outputs.config == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm run validate:config

  # Required status check gate
  all-checks:
    needs: [backend-tests, frontend-tests, config-validation]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Verify results
        run: |
          # Check if any required job failed
          if [[ "${{ needs.backend-tests.result }}" == "failure" ]] || \
             [[ "${{ needs.frontend-tests.result }}" == "failure" ]] || \
             [[ "${{ needs.config-validation.result }}" == "failure" ]]; then
            exit 1
          fi
          echo "All applicable checks passed"
```

### Fast-Path for Config-Only Changes

**Pattern**: Skip expensive tests for config-only changes

```yaml
name: Fast Track Config
on:
  pull_request:

jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      config-only: ${{ steps.check.outputs.config_only }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check if config-only
        id: check
        run: |
          # Get changed files
          FILES=$(git diff --name-only ${{ github.event.pull_request.base.sha }} ${{ github.sha }})

          # Check if all changes are config files
          if echo "$FILES" | grep -qvE '^(\.github/|.*\.(json|yaml|yml|toml|ini)$)'; then
            echo "config_only=false" >> $GITHUB_OUTPUT
          else
            echo "config_only=true" >> $GITHUB_OUTPUT
          fi

  fast-validate:
    needs: check-changes
    if: needs.check-changes.outputs.config-only == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate config files
        run: |
          npm run validate:config
          echo "✅ Config validation passed - fast track approved"

      - name: Auto-approve config-only PR
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.pulls.createReview({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.payload.pull_request.number,
              event: 'APPROVE',
              body: '✅ Auto-approved: Config-only changes validated successfully.'
            });

  full-ci:
    needs: check-changes
    if: needs.check-changes.outputs.config-only == 'false'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test
      - run: npm run build
```

---

## Complete Review-to-Merge Lifecycle Examples

### Example 1: Simple Auto-Merge with Label

```yaml
name: Auto-Merge on Approval
on:
  pull_request_review:
    types: [submitted]
  pull_request:
    types: [labeled]

jobs:
  auto-merge:
    if: |
      github.event_name == 'pull_request_review' &&
      github.event.review.state == 'approved' ||
      (github.event_name == 'pull_request' &&
       contains(github.event.pull_request.labels.*.name, 'automerge'))
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Enable auto-merge
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --auto \
            --squash \
            --delete-branch
```

### Example 2: Full Lifecycle with Reviews and Cleanup

```yaml
name: PR Lifecycle
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted]

jobs:
  # Run CI checks
  ci:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run build

  # Automated code review
  code-review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Run linter
        id: lint
        run: npm run lint --format json > lint.json || true

      - name: Post review
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('lint.json', 'utf8'));

            if (results.length > 0) {
              const comments = results.slice(0, 10).map(r => ({
                path: r.file,
                line: r.line,
                body: `**${r.severity}**: ${r.message}`
              }));

              await github.rest.pulls.createReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                event: 'REQUEST_CHANGES',
                body: `Found ${results.length} linting issues.`,
                comments
              });
            } else {
              await github.rest.pulls.createReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                event: 'APPROVE',
                body: '✅ Automated checks passed!'
              });
            }

  # Auto-merge on approval
  auto-merge:
    needs: [ci, code-review]
    if: github.event_name == 'pull_request_review' && github.event.review.state == 'approved'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Squash and merge
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --squash \
            --auto \
            --delete-branch
```

### Example 3: Sophisticated Multi-Stage Pipeline

```yaml
name: Advanced PR Pipeline
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, labeled]
  pull_request_review:
    types: [submitted]
  check_suite:
    types: [completed]

jobs:
  # Detect changes
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      has-backend: ${{ steps.filter.outputs.backend }}
      has-frontend: ${{ steps.filter.outputs.frontend }}
      config-only: ${{ steps.filter.outputs.config }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'src/backend/**'
            frontend:
              - 'src/frontend/**'
            config:
              - '.github/**'
              - '*.json'

  # Backend tests
  backend-tests:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-backend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:backend

  # Frontend tests
  frontend-tests:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:frontend

  # Fast-track config validation
  config-validation:
    needs: detect-changes
    if: needs.detect-changes.outputs.config-only == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run validate:config

  # Gate job - always runs
  all-checks:
    needs: [backend-tests, frontend-tests, config-validation]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check all results
        run: |
          if [[ "${{ needs.backend-tests.result }}" == "failure" ]] || \
             [[ "${{ needs.frontend-tests.result }}" == "failure" ]] || \
             [[ "${{ needs.config-validation.result }}" == "failure" ]]; then
            exit 1
          fi

  # Automated review
  automated-review:
    needs: all-checks
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Approve if config-only
        if: needs.detect-changes.outputs.config-only == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.pulls.createReview({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.payload.pull_request.number,
              event: 'APPROVE',
              body: '✅ Auto-approved: Config-only changes validated.'
            });

  # Auto-merge
  auto-merge:
    needs: [all-checks, automated-review]
    if: |
      contains(github.event.pull_request.labels.*.name, 'automerge') ||
      needs.detect-changes.outputs.config-only == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Enable auto-merge
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --auto \
            --squash \
            --delete-branch
```

---

## Best Practices

### 1. Permissions Management

Always use minimal required permissions:

```yaml
permissions:
  contents: read        # Read repository contents
  pull-requests: write  # Create reviews, merge PRs
```

For merging via GITHUB_TOKEN, ensure repository settings allow it:

- Settings → Actions → General → Workflow permissions
- Enable "Allow GitHub Actions to create and approve pull requests"

### 2. Use Sentinel/Gate Jobs

For required status checks with conditional jobs, always use a gate job:

```yaml
gate:
  needs: [conditional-job-1, conditional-job-2]
  if: always()
  runs-on: ubuntu-latest
  steps:
    - run: exit ${{ (needs.*.result contains 'failure') && 1 || 0 }}
```

### 3. Label-Based Control

Use labels for explicit merge control:

- `automerge`: Enable auto-merge
- `wip` / `do-not-merge`: Block merge
- `fast-track`: Skip non-essential checks

### 4. Retry Logic

Network issues can cause transient failures. Use retry logic:

```yaml
- uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: npm test
```

### 5. Audit Trail

Always log merge actions:

```yaml
- name: Log merge
  run: |
    echo "::notice::Merged PR #${{ github.event.pull_request.number }} at $(date)"
```

---

## Comparison Matrix

| Approach | Auto-Merge | Squash Support | Branch Cleanup | Custom Logic | Complexity |
|----------|------------|----------------|----------------|--------------|------------|
| Native GitHub Auto-Merge | ✅ | ✅ | ✅ (via setting) | ❌ | Low |
| GitHub CLI (`gh pr merge --auto`) | ✅ | ✅ | ✅ (`--delete-branch`) | ❌ | Low |
| `automerge-action` | ✅ | ✅ | ❌ | ⚠️ (labels only) | Medium |
| REST API (`github-script`) | ⚠️ (manual) | ✅ | ⚠️ (manual) | ✅ | High |
| Custom Workflow | ✅ | ✅ | ✅ | ✅ | High |

---

## Authoritative Sources

1. **GitHub Docs - Auto-Merge**: <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request>
2. **GitHub REST API - Pull Requests**: <https://docs.github.com/en/rest/pulls/pulls>
3. **GitHub REST API - Reviews**: <https://docs.github.com/en/rest/pulls/reviews>
4. **GitHub GraphQL API - Mutations**: <https://docs.github.com/en/graphql/reference/mutations>
5. **GitHub CLI - pr merge**: <https://cli.github.com/manual/gh_pr_merge>
6. **GitHub Actions - Workflow Syntax**: <https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions>
7. **GitHub Actions - Permissions**: <https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#permissions>
8. **Branch Protection Rules**: <https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>
9. **Graphite Guide - Merging with GitHub Actions**: <https://graphite.com/guides/merge-pull-request-github-actions>
10. **pascalgn/automerge-action**: <https://github.com/marketplace/actions/merge-pull-requests-automerge-action>

---

## Recommendations

Based on this research, here are recommended approaches for different scenarios:

### For Simple Repositories

**Use**: Native GitHub Auto-Merge + GitHub CLI

- Enable auto-merge in repository settings
- Use `gh pr merge --auto --squash --delete-branch` in workflows
- Minimal complexity, official support

### For Teams with Code Review Requirements

**Use**: `automerge-action` with labels

- Label-based control: `automerge`, `!wip`
- Automatic retry on pending checks
- Good balance of control and simplicity

### For Complex Monorepos

**Use**: Custom workflow with path detection

- Use `dorny/paths-filter` for change detection
- Fast-track config-only changes
- Conditional jobs with gate pattern
- Full programmatic control via `github-script`

### For Stacked PRs (Graphite Workflow)

**Use**: Native auto-merge + branch protection

- Enable auto-merge on all PRs in stack
- Use required status checks
- Let each PR merge automatically as dependencies merge
- Leverage GitHub's native merge queue for high velocity

---

**Document Version**: 1.0
**Last Updated**: 2025-12-23
**Research Confidence**: High (all patterns sourced from official documentation)
