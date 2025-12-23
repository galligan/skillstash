# GitHub App Tokens for Actions Workflows

Research findings on using GitHub App installation access tokens to trigger workflows from within workflows, particularly for PRs created by automation that need to trigger CI/CD pipelines.

## Research Summary

This investigation focused on the pattern where GitHub Actions workflows create pull requests that need to trigger other workflows (e.g., CI checks, tests, deployments). The standard `GITHUB_TOKEN` cannot accomplish this due to intentional security restrictions, necessitating the use of GitHub App installation access tokens.

**Key Finding**: GitHub App tokens provide a secure, scalable alternative to Personal Access Tokens (PATs) for workflow automation, with fine-grained permissions, automatic expiration, and clear attribution.

## 1. Why GITHUB_TOKEN Cannot Trigger Workflows

### The Problem

When using the repository's `GITHUB_TOKEN` to perform tasks, events triggered by that token (with exceptions for `workflow_dispatch` and `repository_dispatch`) **will not create new workflow runs**.

This is an intentional security feature designed to prevent accidentally creating recursive or infinite workflow loops.

### Official Documentation

From GitHub's official documentation:

> "When you use the repository's `GITHUB_TOKEN` to perform tasks, events triggered by the `GITHUB_TOKEN`, with the exception of `workflow_dispatch` and `repository_dispatch`, will not create a new workflow run. This prevents you from accidentally creating recursive workflow runs."

**Specific Impacts**:

- PRs created with `GITHUB_TOKEN` will not trigger `on: pull_request` workflows
- Pushes made with `GITHUB_TOKEN` will not trigger `on: push` workflows
- Issue/PR labels added with `GITHUB_TOKEN` will not trigger label-based workflows
- Comments created with `GITHUB_TOKEN` will not trigger comment-based workflows

### Example of the Limitation

```yaml
# This workflow creates a PR, but it WON'T trigger CI checks
on:
  push:
    branches: [main]

jobs:
  create-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Make changes and create PR
          gh pr create --title "Automated update" --body "Updates"
          # ❌ This PR will NOT trigger workflows configured with on: pull_request
```

## 2. Solution: GitHub App Installation Access Tokens

### Why GitHub Apps?

GitHub Apps provide several advantages over Personal Access Tokens:

1. **Organizational ownership** - Not tied to a specific user account
2. **Fine-grained permissions** - Grant only what's needed
3. **Clear attribution** - Actions appear as the app, not a user
4. **Automatic expiration** - Tokens expire after 1 hour (security best practice)
5. **Rate limits** - Higher rate limits than user tokens
6. **No SSO complications** - Work seamlessly with SAML/SSO organizations

### How It Works

1. Create and install a GitHub App in your organization/repository
2. Store the App ID and private key as repository/organization secrets
3. Use `actions/create-github-app-token` in workflows to generate installation access tokens
4. Use those tokens to perform actions that should trigger workflows

## 3. Creating a GitHub App

### Step-by-Step Setup Instructions

#### A. Register the GitHub App

1. Navigate to your account/organization settings:
   - **Personal account**: Profile → Settings → Developer settings → GitHub Apps
   - **Organization**: Organization → Settings → Developer settings → GitHub Apps

2. Click **New GitHub App**

3. Configure basic settings:
   - **GitHub App name**: Choose a descriptive name (e.g., "Workflow Automation Bot")
   - **Description**: Explain the app's purpose (e.g., "Creates PRs from automated workflows")
   - **Homepage URL**: Your organization URL or repository URL
   - **Callback URL**: Not needed for workflow automation (leave blank or use org URL)
   - **Webhook**: Deselect "Active" (not needed for this use case)

4. Under **Where can this GitHub App be installed?**:
   - **Only on this account**: Recommended for organization-specific automation
   - **Any account**: If you plan to share the app

5. Click **Create GitHub App**

#### B. Generate a Private Key

1. After creating the app, you'll be on the app's settings page
2. Scroll to **Private keys** section
3. Click **Generate a private key**
4. A `.pem` file will download - **store this securely immediately**

**Important**: GitHub only stores the public portion of the key. If you lose this file, you'll need to generate a new key.

#### C. Note the App ID

1. On the app settings page, find the **App ID** at the top
2. Save this ID - you'll need it for the workflow configuration

## 4. Required Permissions

Configure permissions based on what your workflow automation needs to do.

### Minimum Required Permission

- **Metadata**: Read (automatically granted, required for all apps)

### Common Automation Scenarios

#### For Creating/Managing Pull Requests

**Required Permissions**:

- **Contents**: Read & Write (to push branches, read repository content)
- **Pull requests**: Read & Write (to create, update, comment on PRs)
- **Metadata**: Read (automatic)

**Optional but Recommended**:

- **Issues**: Read & Write (if workflows also manage issues)
- **Workflows**: Read & Write (if modifying workflow files in PRs)

#### For Issue Management

**Required Permissions**:

- **Issues**: Read & Write
- **Metadata**: Read

#### For Content Updates Only

**Required Permissions**:

- **Contents**: Read & Write
- **Metadata**: Read

### Setting Permissions

1. Go to your GitHub App settings
2. Navigate to **Permissions & events**
3. Under **Repository permissions**, set:
   - Contents: Read & Write
   - Pull requests: Read & Write
   - Issues: Read & Write (if needed)
   - Workflows: Read & Write (if needed)
4. Click **Save changes**

**Important**: If the app is already installed, users will need to accept the new permissions.

## 5. Installing the GitHub App

### Organization-Wide Installation

**Pros**:

- Single installation for all repositories
- Centralized management
- Easier to maintain

**Cons**:

- Requires organization admin approval
- Broader access scope

**Steps**:

1. Go to GitHub App settings
2. Click **Install App** in the left sidebar
3. Select your organization
4. Choose:
   - **All repositories** (for org-wide automation)
   - **Only select repositories** (recommended for security)
5. Click **Install**

### Repository-Specific Installation

**Pros**:

- More granular control
- Limited blast radius
- Easier to audit

**Cons**:

- Must install separately for each repo
- More overhead for multi-repo setups

**Steps**:

1. Same as above, but select specific repositories during installation
2. You can modify repository access later in the installation settings

### Getting the Installation ID

You'll need the installation ID for some operations. Get it via:

```bash
# Using GitHub CLI
gh api /repos/{owner}/{repo}/installation --jq '.id'

# Or for all installations
gh api /app/installations --jq '.[].id'
```

## 6. Storing Credentials Securely

### Security Best Practices

#### Private Key Storage

**Recommended Approaches** (in order of security):

1. **Key Vault / Secrets Manager** (Best)
   - Azure Key Vault
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Cloud Secret Manager

   Benefits:
   - Keys are sign-only (cannot be read after upload)
   - Automatic rotation capabilities
   - Audit logging
   - Access controls via infrastructure policies

2. **GitHub Secrets** (Good for most use cases)
   - Repository secrets (repo-specific workflows)
   - Organization secrets (org-wide workflows)
   - Environment secrets (deployment-specific)

   Benefits:
   - Built-in to GitHub Actions
   - Encrypted at rest
   - Masked in logs
   - Simple to use

3. **Environment Variables** (Acceptable but less secure)
   - Only for development/testing
   - Not recommended for production

**Never**:

- Hard-code private keys in code
- Commit private keys to repositories (even private ones)
- Share private keys via email/chat
- Store unencrypted on disk long-term

#### Storing App ID and Private Key

**For Repository Secrets**:

1. Navigate to: Repository → Settings → Secrets and variables → Actions
2. Click **New repository secret**
3. Create two secrets:
   - Name: `APP_ID`, Value: Your app's ID (e.g., `123456`)
   - Name: `APP_PRIVATE_KEY`, Value: Entire contents of the `.pem` file

**For Organization Secrets**:

1. Navigate to: Organization → Settings → Secrets and variables → Actions
2. Click **New organization secret**
3. Create the same two secrets
4. Select repository access:
   - All repositories (for org-wide automation)
   - Selected repositories (recommended)

#### Private Key Format

The private key should be stored exactly as generated:

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(multiple lines)
...end of key content
-----END RSA PRIVATE KEY-----
```

**Important**: The `actions/create-github-app-token` action automatically handles escaped newlines (`\n`), so you can paste the key as-is.

### Private Key Rotation

**Best Practices**:

- Generate up to 25 keys per app (for zero-downtime rotation)
- Rotate keys every 90 days minimum
- Immediately rotate if:
  - Key is compromised or suspected leak
  - Team member with access leaves
  - Repository/workflow is made public
  - Unusual activity detected

**Rotation Process**:

1. Generate a new private key in GitHub App settings
2. Update the secret in GitHub Actions with the new key
3. Test workflows with the new key
4. Delete the old private key after confirming new key works
5. Document the rotation in your security log

## 7. Using actions/create-github-app-token

### Basic Usage

```yaml
name: Create PR with workflow triggers

on:
  push:
    branches: [main]

jobs:
  create-automated-pr:
    runs-on: ubuntu-latest
    steps:
      # Generate GitHub App token
      - name: Generate token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      # Use token to create PR that WILL trigger workflows
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ steps.app-token.outputs.token }}

      - name: Make changes
        run: |
          echo "automated change" > update.txt
          git config user.name "workflow-bot[bot]"
          git config user.email "workflow-bot[bot]@users.noreply.github.com"
          git checkout -b automated-update
          git add update.txt
          git commit -m "Automated update"
          git push origin automated-update

      - name: Create PR
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh pr create \
            --title "Automated update" \
            --body "This PR was created by automation" \
            --base main \
            --head automated-update
          # ✅ This PR WILL trigger on: pull_request workflows
```

### Token Scoping Options

#### Scope to Current Repository (Default)

```yaml
- uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
  # Token has access only to current repository
```

#### Scope to Specific Repositories

```yaml
- uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    owner: ${{ github.repository_owner }}
    repositories: |
      repo1
      repo2
      repo3
```

#### Scope to All Repositories in Organization

```yaml
- uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    owner: my-org-name
  # Token has access to all repos where the app is installed
```

#### Scope with Specific Permissions

```yaml
- uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    # Limit to only these permissions (must be granted to app installation)
    permission-contents: write
    permission-pull-requests: write
    permission-issues: read
```

### Token Outputs

```yaml
- uses: actions/create-github-app-token@v2
  id: app-token
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}

# Available outputs:
# ${{ steps.app-token.outputs.token }}           # The installation access token
# ${{ steps.app-token.outputs.installation-id }} # Installation ID
# ${{ steps.app-token.outputs.app-slug }}        # App slug (for commit attribution)
```

### Configuring Git User for Commits

```yaml
- name: Generate token
  id: app-token
  uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}

# Get the bot user ID for proper commit attribution
- name: Get App User ID
  id: get-user-id
  run: |
    USER_ID=$(gh api "/users/${{ steps.app-token.outputs.app-slug }}[bot]" --jq .id)
    echo "user-id=$USER_ID" >> "$GITHUB_OUTPUT"
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}

# Configure git with the app's bot user
- name: Configure git
  run: |
    git config --global user.name '${{ steps.app-token.outputs.app-slug }}[bot]'
    git config --global user.email '${{ steps.get-user-id.outputs.user-id }}+${{ steps.app-token.outputs.app-slug }}[bot]@users.noreply.github.com'
```

## 8. Token Expiration and Refresh

### Expiration Policy

**Key Constraint**: Installation access tokens expire after exactly **1 hour**.

This is a security feature with **no way to extend the expiration time**.

### Implications for Workflows

#### Short-Running Workflows (< 1 hour)

No special handling needed - tokens will remain valid for the workflow duration.

```yaml
jobs:
  quick-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v2
        id: token
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      # All subsequent steps will complete within 1 hour
      - run: echo "Do work..."
```

#### Long-Running Workflows (> 1 hour)

**Problem**: Token will expire mid-workflow, causing authentication failures.

**Solutions**:

##### Option 1: Regenerate Token as Needed (Recommended)

```yaml
jobs:
  long-job:
    runs-on: ubuntu-latest
    steps:
      - name: Initial work
        run: echo "Starting..."

      # First token generation
      - uses: actions/create-github-app-token@v2
        id: token1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Use token for API calls
        env:
          GH_TOKEN: ${{ steps.token1.outputs.token }}
        run: gh pr list

      # Long-running process
      - name: Wait for external process
        run: sleep 7200  # 2 hours

      # Regenerate token before next API call
      - uses: actions/create-github-app-token@v2
        id: token2
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Use fresh token
        env:
          GH_TOKEN: ${{ steps.token2.outputs.token }}
        run: gh pr comment 123 --body "Completed"
```

##### Option 2: Pass App Credentials to Custom Actions

For JavaScript/TypeScript actions, use Octokit with auto-renewal:

```yaml
jobs:
  long-job:
    runs-on: ubuntu-latest
    steps:
      # Pass app credentials to custom action
      - uses: ./.github/actions/my-long-action
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

Custom action implementation:

```javascript
// In your custom action
import { App } from "octokit";

const app = new App({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY,
});

// This automatically handles token renewal
const octokit = await app.getInstallationOctokit(installationId);

// Token is automatically refreshed before each API call
await octokit.request("GET /repos/{owner}/{repo}/pulls", {
  owner: "my-org",
  repo: "my-repo",
});
```

##### Option 3: Use `skip-token-revoke` for Multiple Jobs

By default, tokens are revoked in the post-action step. For cross-job usage:

```yaml
jobs:
  generate-token:
    runs-on: ubuntu-latest
    outputs:
      token: ${{ steps.app-token.outputs.token }}
    steps:
      - uses: actions/create-github-app-token@v2
        id: app-token
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          skip-token-revoke: true  # Don't revoke after job

  use-token:
    needs: generate-token
    runs-on: ubuntu-latest
    steps:
      - run: echo "Using token..."
        env:
          GH_TOKEN: ${{ needs.generate-token.outputs.token }}
```

**Warning**: This only works if both jobs complete within 1 hour total.

### Handling Expiration in Git Operations

For long-running git operations (e.g., large LFS checkouts):

```yaml
steps:
  - uses: actions/create-github-app-token@v2
    id: app-token
    with:
      app-id: ${{ vars.APP_ID }}
      private-key: ${{ secrets.APP_PRIVATE_KEY }}

  # Will fail if checkout takes > 1 hour
  - uses: actions/checkout@v4
    with:
      token: ${{ steps.app-token.outputs.token }}
      lfs: true  # Can be slow for large files
```

**Mitigation**:

- Split into smaller operations
- Use artifact caching
- Increase parallelization
- Consider non-token authentication for very large operations

## 9. Complete Workflow Examples

### Example 1: Auto-format PR Workflow

Creates a PR with formatting changes that triggers CI checks:

```yaml
name: Auto-format Code

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  format:
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Checkout with app token
        uses: actions/checkout@v4
        with:
          token: ${{ steps.app-token.outputs.token }}
          ref: ${{ github.head_ref }}
          # Don't persist GITHUB_TOKEN
          persist-credentials: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run formatter
        run: npm run format

      - name: Get App user info
        id: app-user
        run: |
          USER_ID=$(gh api "/users/${{ steps.app-token.outputs.app-slug }}[bot]" --jq .id)
          echo "user-id=$USER_ID" >> "$GITHUB_OUTPUT"
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}

      - name: Commit and push changes
        run: |
          git config user.name '${{ steps.app-token.outputs.app-slug }}[bot]'
          git config user.email '${{ steps.app-user.outputs.user-id }}+${{ steps.app-token.outputs.app-slug }}[bot]@users.noreply.github.com'

          git checkout -b auto-format-$(date +%Y%m%d-%H%M%S)
          git add .
          git commit -m "chore: auto-format code" || exit 0
          git push origin HEAD
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}

      - name: Create Pull Request
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh pr create \
            --title "chore: auto-format code" \
            --body "Automated code formatting changes" \
            --label "automated" \
            --label "formatting"
          # ✅ This PR will trigger CI workflows configured with on: pull_request
```

### Example 2: Cross-Repository Workflow Trigger

Trigger a workflow in another repository:

```yaml
name: Trigger Deployment

on:
  release:
    types: [published]

jobs:
  trigger-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Generate token for target repo
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}
          repositories: |
            deployment-repo
            infrastructure-repo

      - name: Trigger deployment workflow
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh workflow run deploy.yml \
            --repo ${{ github.repository_owner }}/deployment-repo \
            --ref main \
            --field version=${{ github.event.release.tag_name }} \
            --field environment=production
```

### Example 3: Multi-Repository PR Creation

Create PRs across multiple repositories:

```yaml
name: Update Dependencies Across Repos

on:
  workflow_dispatch:
    inputs:
      dependency:
        description: 'Dependency to update'
        required: true
      version:
        description: 'New version'
        required: true

jobs:
  update-repos:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        repo: [repo1, repo2, repo3]
    steps:
      - name: Generate token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}
          repositories: ${{ matrix.repo }}

      - name: Checkout target repo
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/${{ matrix.repo }}
          token: ${{ steps.app-token.outputs.token }}

      - name: Update dependency
        run: |
          # Update package.json, requirements.txt, etc.
          npm install ${{ inputs.dependency }}@${{ inputs.version }}

      - name: Create PR
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          git checkout -b update-${{ inputs.dependency }}
          git add .
          git commit -m "chore: update ${{ inputs.dependency }} to ${{ inputs.version }}"
          git push origin HEAD

          gh pr create \
            --repo ${{ github.repository_owner }}/${{ matrix.repo }} \
            --title "chore: update ${{ inputs.dependency }} to ${{ inputs.version }}" \
            --body "Automated dependency update"
```

## 10. Troubleshooting Common Issues

### Issue: "Bad credentials" after 1 hour

**Cause**: Token expired (tokens only last 1 hour)

**Solution**: Regenerate token before use in long-running workflows

```yaml
# If you see "Bad credentials" after ~1 hour
- uses: actions/create-github-app-token@v2
  id: fresh-token
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

### Issue: "Resource not accessible by integration"

**Cause**: App lacks required permissions

**Solution**:

1. Check app permissions in Settings → Developer settings → GitHub Apps → Edit
2. Grant required permissions
3. Accept updated permissions in installation settings

### Issue: PR created but workflows not triggering

**Cause**: Using `GITHUB_TOKEN` instead of app token

**Solution**: Verify token is from app:

```yaml
# ❌ Wrong - uses default token
- uses: actions/checkout@v4

# ✅ Correct - uses app token
- uses: actions/checkout@v4
  with:
    token: ${{ steps.app-token.outputs.token }}
```

### Issue: "Could not find installation for owner"

**Cause**: App not installed on the repository/organization

**Solution**:

1. Go to GitHub App settings
2. Click "Install App"
3. Select the target organization/repositories
4. Complete installation

### Issue: Rate limiting

**Cause**: Too many API requests

**Solution**: GitHub Apps have higher rate limits, but you can:

- Add delays between requests
- Use conditional logic to reduce unnecessary calls
- Check rate limit status:

```yaml
- name: Check rate limit
  run: gh api rate_limit
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}
```

## 11. Security Considerations

### Principle of Least Privilege

- Grant only the minimum permissions needed
- Scope tokens to specific repositories when possible
- Use repository secrets over organization secrets when appropriate
- Regularly audit app permissions and usage

### Audit Trail

- All actions performed with app tokens are attributed to the app
- Review app activity in organization audit logs
- Monitor for unexpected behavior

### Secret Scanning

GitHub automatically scans for leaked private keys. If detected:

1. GitHub will alert you
2. Immediately revoke the compromised key
3. Generate a new key
4. Update secrets
5. Investigate how the leak occurred

### Monitoring

Monitor for:

- Unusual API usage patterns
- Failed authentication attempts
- Changes to app permissions
- New installations

## 12. Comparison: GitHub Apps vs Personal Access Tokens

| Feature | GitHub App | Personal Access Token |
|---------|------------|----------------------|
| **Attribution** | App (e.g., "bot[bot]") | User account |
| **Ownership** | Organization/repo | Individual user |
| **Permissions** | Fine-grained, auditable | Broad, user-level |
| **Expiration** | 1 hour (automatic) | User-configurable (or never) |
| **Rate Limits** | 5,000 req/hour per installation | 5,000 req/hour per user |
| **Revocation** | Automatic (post-job) | Manual |
| **SSO/SAML** | No complications | May require SSO authorization |
| **User departure** | Unaffected | Breaks if user leaves |
| **Audit trail** | Clear (app actions) | Mixed with user actions |
| **Recommended for** | Automation, CI/CD | Development, testing |

**Recommendation**: Use GitHub Apps for production automation, PATs for personal development only.

## 13. Additional Resources

### Official GitHub Documentation

- [Triggering a workflow from a workflow](https://docs.github.com/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow)
- [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Managing private keys for GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps)
- [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [Permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)
- [Using secrets in GitHub Actions](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions)

### Actions & Tools

- [actions/create-github-app-token](https://github.com/actions/create-github-app-token) - Official action for generating tokens
- [Octokit.js](https://github.com/octokit/octokit.js) - JavaScript SDK with auto-renewal support

### Community Resources

- [Token expiration discussion](https://github.com/actions/create-github-app-token/issues/121) - Understanding 1-hour limitation
- [Workflow trigger limitations](https://github.com/orgs/community/discussions/25702) - Community discussion on GITHUB_TOKEN restrictions

---

**Document Version**: 1.0
**Last Updated**: 2025-12-23
**Research Methodology**: Systematic investigation of official GitHub documentation, GitHub Actions marketplace, and community discussions focusing on authoritative sources and real-world implementation patterns.
