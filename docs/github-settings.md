# GitHub Repository Settings

Recommended settings for skillstash repositories. Configure these at `github.com/<owner>/<repo>/settings`.

## Branch Naming Convention

Skill branches must follow this naming pattern:

| Pattern | Use case |
|---------|----------|
| `skill/add-<slug>` | Creating a new skill |
| `skill/update-<slug>` | Modifying an existing skill |
| `skill/remove-<slug>` | Deleting a skill |

Examples:

```text
skill/add-debugging-workflow
skill/update-commit-message
skill/remove-deprecated-helper
```

The `merge-readiness` check enforces this convention for PRs that touch `skills/**`.

## General → Pull Requests

### Merge Button

| Setting | Value | Why |
|---------|-------|-----|
| Allow merge commits | **Off** | Keeps history clean and linear |
| Allow squash merging | **On** | Single commit per PR |
| Allow rebase merging | Optional | Personal preference |

### Squash Merge Settings

| Setting | Value |
|---------|-------|
| Default commit message | **Pull request title and description** |

This uses the PR title as the commit subject and the PR description as the commit body, giving you clean, descriptive commits.

### Other Options

| Setting | Value | Why |
|---------|-------|-----|
| Always suggest updating pull request branches | **On** | Keeps PRs current with main |
| Allow auto-merge | **On** | PRs merge automatically when requirements pass |
| Automatically delete head branches | **On** | Cleans up merged branches |

## General → Issues

| Setting | Value | Why |
|---------|-------|-----|
| Auto-close issues with merged linked pull requests | **On** | Closes issues when PR merges |

## Branch Protection Rules

Create a rule for `main` (or your default branch) at Settings → Branches → Add rule.

### Recommended Rules

| Rule | Value | Why |
|------|-------|-----|
| Branch name pattern | `main` | Protects default branch |
| Require a pull request before merging | **On** | No direct pushes to main |
| Required approvals | `0` or `1` | Your choice based on team size |
| Require status checks to pass | **On** | Ensures CI passes |
| Status checks that are required | `validate` | The skillstash validation workflow |
| Require branches to be up to date | Optional | Stricter but slower |
| Do not allow bypassing | Optional | Even admins follow rules |

### Minimal Setup (Solo/Small Team)

```text
✓ Require a pull request before merging
  └─ Required approvals: 0
✓ Require status checks to pass before merging
  └─ Status checks: validate
```

This ensures:

- All changes go through PRs (no direct pushes)
- Validation must pass before merge
- Auto-merge works once validation passes

### Stricter Setup (Larger Team)

```text
✓ Require a pull request before merging
  └─ Required approvals: 1
  └─ Dismiss stale reviews when new commits are pushed
✓ Require status checks to pass before merging
  └─ Status checks: validate
  └─ Require branches to be up to date
✓ Require conversation resolution before merging
```

## Quick Setup Checklist

```text
Settings → General → Pull Requests
[ ] Uncheck "Allow merge commits"
[ ] Check "Allow squash merging"
    [ ] Set default to "Pull request title and description"
[ ] Check "Always suggest updating pull request branches"
[ ] Check "Allow auto-merge"
[ ] Check "Automatically delete head branches"

Settings → General → Issues
[ ] Check "Auto-close issues with merged linked pull requests"

Settings → Branches → Add rule (for "main")
[ ] Check "Require a pull request before merging"
[ ] Check "Require status checks to pass"
    [ ] Add "validate" as required check
```

## Using Auto-Merge

Once configured, the workflow is:

1. Create PR (via issue automation or manually)
2. Click **Enable auto-merge** → **Squash and merge**
3. PR merges automatically when validation passes
4. Branch is deleted, linked issues are closed

## Merge Readiness Check

The `merge-readiness` workflow runs on PRs that touch `skills/**` and validates:

| Check | Blocking | What it verifies |
|-------|----------|------------------|
| Branch naming | Yes | Branch follows `skill/add-*`, `skill/update-*`, or `skill/remove-*` |
| Labels configured | No | Required labels exist (`skip:*`, `review:*`, etc.) |
| Auto-merge enabled | No | Repository has auto-merge enabled |
| Merge settings | No | Squash allowed, merge commits disabled |
| Branch protection | No | `main` requires the `validate` check |

**Blocking** checks fail the workflow. **Non-blocking** checks show warnings but allow merge.

If labels are missing, run:

```bash
bun run labels:setup
```

## Skills Packaging Pipeline

When skills merge to main, the `release-skills` workflow automatically:

1. Packages each changed skill into a versioned .zip file
2. Computes SHA256 checksums for integrity verification
3. Creates GitHub releases with the packaged assets

### Versioning

Add a `version` field to your skill's frontmatter for versioned releases:

```yaml
---
name: my-skill
description: What this skill does
version: 1.0.0
---
```

Release tags follow the pattern `{skill-name}-v{version}` (e.g., `my-skill-v1.0.0`).

Skills without a version field will package as `{skill-name}.zip` without a version suffix.

### Validation

PRs touching `skills/**` are validated by both:

1. **Local validator** (`bun run validate`) - checks naming, structure, line limits
2. **Skills packager** - ensures the skill will package correctly

Both must pass before merge.
