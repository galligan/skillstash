# Claude Code Plugin System Research

**Research Date**: 2025-12-23
**Author**: Research Agent
**Sources**: Official Claude Code Documentation, Community Resources

## Executive Summary

Claude Code's plugin system enables modular extensions through a marketplace-based distribution model. Plugins bundle commands, agents, Skills, hooks, and MCP/LSP servers into installable units identified by the `plugin-name@marketplace-name` pattern.

---

## 1. Plugin.json Structure and Required Fields

### Location

`plugin-name/.claude-plugin/plugin.json`

**Critical**: The `.claude-plugin/` directory contains ONLY `plugin.json`. All other directories (commands/, agents/, skills/, hooks/) must be at the plugin root level.

### Required Fields

```json
{
  "name": "my-plugin",
  "description": "Brief description of plugin functionality",
  "version": "1.0.0"
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | kebab-case, no spaces | Plugin identifier and slash command namespace |
| `description` | string | max 1024 chars | Shown in plugin manager during browsing/installation |
| `version` | string | semver format | Track releases using semantic versioning |

### Optional Fields

```json
{
  "name": "my-plugin",
  "description": "Advanced plugin example",
  "version": "2.1.0",
  "author": {
    "name": "Developer Name",
    "email": "dev@example.com"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/owner/plugin",
  "license": "MIT",
  "keywords": ["productivity", "automation"],
  "category": "development",
  "commands": ["./commands/core/", "./commands/experimental/preview.md"],
  "agents": ["./agents/security-reviewer.md"],
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
      }]
    }]
  },
  "mcpServers": {
    "custom-server": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"]
    }
  },
  "lspServers": {
    "go": {
      "command": "gopls",
      "args": ["serve"],
      "extensionToLanguage": {
        ".go": "go"
      }
    }
  }
}
```

### Component Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `commands` | string\|array | Paths to command files/directories |
| `agents` | string\|array | Paths to agent definition files |
| `hooks` | string\|object | Hooks configuration or path to hooks file |
| `mcpServers` | string\|object | MCP server configurations |
| `lspServers` | string\|object | LSP server configurations |

### Complete Plugin.json Example

```json
{
  "name": "enterprise-tools",
  "description": "Enterprise workflow automation and security tools",
  "version": "2.1.0",
  "author": {
    "name": "Enterprise Team",
    "email": "enterprise@example.com"
  },
  "homepage": "https://docs.example.com/plugins/enterprise-tools",
  "repository": "https://github.com/company/enterprise-plugin",
  "license": "MIT",
  "keywords": ["enterprise", "workflow", "automation", "security"],
  "category": "productivity",
  "commands": [
    "./commands/core/",
    "./commands/enterprise/",
    "./commands/experimental/preview.md"
  ],
  "agents": [
    "./agents/security-reviewer.md",
    "./agents/compliance-checker.md"
  ],
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
      }]
    }]
  },
  "mcpServers": {
    "enterprise-db": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"]
    }
  }
}
```

---

## 2. Making a Repository Installable as a Plugin

### Directory Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Required manifest
├── commands/                # Optional slash commands
│   ├── hello.md
│   └── deploy.md
├── agents/                  # Optional custom agents
│   └── reviewer.md
├── skills/                  # Optional Agent Skills
│   └── pdf-processing/
│       └── SKILL.md
├── hooks/                   # Optional event hooks
│   └── hooks.json
├── scripts/                 # Optional utility scripts
│   └── helper.py
├── .mcp.json               # Optional MCP server config
├── .lsp.json               # Optional LSP server config
└── README.md               # Documentation
```

### Plugin Root Directory Rules

1. **Only `.claude-plugin/plugin.json` goes in `.claude-plugin/`**
2. **All component directories must be at plugin root**: commands/, agents/, skills/, hooks/
3. **Supporting files can be anywhere**: scripts/, templates/, etc.

### Minimal Working Plugin

```bash
# 1. Create plugin structure
mkdir -p my-plugin/.claude-plugin
mkdir -p my-plugin/commands

# 2. Create manifest
cat > my-plugin/.claude-plugin/plugin.json << 'EOF'
{
  "name": "my-plugin",
  "description": "A greeting plugin",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
EOF

# 3. Create a command
cat > my-plugin/commands/hello.md << 'EOF'
---
description: Greet the user with a friendly message
---

# Hello Command

Greet the user warmly and ask how you can help them today.
EOF
```

### Testing Locally

```bash
# Load plugin during development
claude --plugin-dir ./my-plugin

# Use the command
/my-plugin:hello
```

### Making it Installable

**Option 1: GitHub Repository** (Recommended)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial plugin"
git remote add origin https://github.com/username/my-plugin.git
git push -u origin main
```

Users install via:

```bash
/plugin marketplace add username/my-plugin
/plugin install my-plugin@username-my-plugin
```

**Option 2: Via Marketplace** (For Distribution)
Add to a marketplace's `.claude-plugin/marketplace.json` (see section 3).

---

## 3. Marketplace Concepts

### What is a Marketplace?

A marketplace is a catalog that lists available plugins with metadata and source locations. It's like an app store for Claude Code extensions.

### Marketplace File Location

`.claude-plugin/marketplace.json` at repository root

### Marketplace Schema

```json
{
  "name": "company-tools",
  "owner": {
    "name": "DevTools Team",
    "email": "devtools@example.com"
  },
  "metadata": {
    "description": "Company-wide development tools",
    "version": "1.0.0",
    "pluginRoot": "./plugins"
  },
  "plugins": [
    {
      "name": "code-formatter",
      "source": "./plugins/formatter",
      "description": "Automatic code formatting",
      "version": "2.1.0",
      "author": {
        "name": "DevTools Team"
      }
    },
    {
      "name": "deployment-tools",
      "source": {
        "source": "github",
        "repo": "company/deploy-plugin"
      },
      "description": "Deployment automation"
    }
  ]
}
```

### Required Marketplace Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Marketplace identifier (kebab-case) |
| `owner` | object | Maintainer info (`name` required, `email` optional) |
| `plugins` | array | List of available plugins |

### Reserved Marketplace Names

The following names are reserved and cannot be used:

- `claude-code-marketplace`
- `claude-code-plugins`
- `claude-plugins-official`
- `anthropic-marketplace`
- `anthropic-plugins`
- `agent-skills`
- `life-sciences`
- Names impersonating official marketplaces

### Plugin Entry Schema

**Required fields per plugin:**

```json
{
  "name": "plugin-name",
  "source": "<source-specification>"
}
```

**Optional plugin fields:**

- `description`: Brief description
- `version`: Plugin version
- `author`: Author information
- `homepage`: Documentation URL
- `repository`: Source code URL
- `license`: SPDX license identifier (e.g., MIT, Apache-2.0)
- `keywords`: Array of tags
- `category`: Category for organization
- `tags`: Additional searchability tags
- `strict`: Boolean controlling plugin.json requirement (default: true)

### Plugin Source Types

**1. Relative Paths** (same repository)

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin"
}
```

**2. GitHub Repositories**

```json
{
  "name": "github-plugin",
  "source": {
    "source": "github",
    "repo": "owner/plugin-repo"
  }
}
```

**3. Git Repositories** (GitLab, Bitbucket, self-hosted)

```json
{
  "name": "git-plugin",
  "source": {
    "source": "git",
    "url": "https://gitlab.com/team/plugin.git"
  }
}
```

**4. URL-based** (remote marketplace.json)

```json
{
  "name": "url-plugin",
  "source": {
    "source": "url",
    "url": "https://example.com/marketplace.json"
  }
}
```

### The `strict` Field

Controls whether plugins need their own `plugin.json`:

- `true` (default): Plugin source must contain `plugin.json`, marketplace entry merges with it
- `false`: Plugin defined entirely in marketplace entry, no `plugin.json` needed

### Adding Marketplaces

**From GitHub:**

```bash
/plugin marketplace add anthropics/claude-code
```

**From Git URL:**

```bash
/plugin marketplace add https://gitlab.com/company/plugins.git
/plugin marketplace add git@gitlab.com:company/plugins.git
```

**From Local Path:**

```bash
/plugin marketplace add ./my-marketplace
/plugin marketplace add ./path/to/marketplace.json
```

**With Specific Branch/Tag:**

```bash
/plugin marketplace add https://gitlab.com/company/plugins.git#v1.0.0
```

### Installing from Marketplaces

```bash
# Install plugin from marketplace
/plugin install plugin-name@marketplace-name

# Or use interactive UI
/plugin
# Navigate to Discover tab, select plugin, choose scope
```

### Managing Marketplaces

```bash
# List all marketplaces
/plugin marketplace list

# Update marketplace listings
/plugin marketplace update marketplace-name

# Remove marketplace
/plugin marketplace remove marketplace-name
```

### Complete Marketplace Example

```json
{
  "name": "acme-tools",
  "owner": {
    "name": "ACME Corp DevTools",
    "email": "devtools@acme.com"
  },
  "metadata": {
    "description": "ACME Corporation's official Claude Code plugins",
    "version": "2.0.0",
    "pluginRoot": "./plugins"
  },
  "plugins": [
    {
      "name": "code-formatter",
      "source": "formatter",
      "description": "Automatic code formatting on save",
      "version": "3.1.0",
      "author": {
        "name": "Format Team"
      },
      "keywords": ["formatting", "linting"],
      "category": "code-quality"
    },
    {
      "name": "security-scanner",
      "source": {
        "source": "github",
        "repo": "acme-corp/security-plugin"
      },
      "description": "Security vulnerability scanning",
      "version": "2.5.0",
      "license": "Apache-2.0"
    }
  ]
}
```

---

## 4. The @namespace Suffix Pattern

### Plugin Namespace Pattern

Claude Code uses the `@marketplace-name` suffix to identify plugin sources and prevent conflicts.

### Format

```
plugin-name@marketplace-name
```

### Examples

```bash
# Install from specific marketplace
/plugin install formatter@acme-tools
/plugin install security-scanner@company-plugins

# Enable/disable with namespace
/plugin enable deployer@team-tools
/plugin disable experimental@personal-plugins

# Uninstall with namespace
/plugin uninstall old-plugin@deprecated-marketplace
```

### Why Namespacing?

1. **Conflict Prevention**: Multiple marketplaces can have plugins with the same name
2. **Source Identification**: Know exactly where a plugin comes from
3. **Version Management**: Different marketplaces may have different versions
4. **Security**: Explicitly specify trusted sources

### Slash Command Namespacing

Plugin commands are also namespaced by plugin name:

```bash
# Plugin manifest: "name": "my-plugin"
# Command file: commands/hello.md
# Resulting command: /my-plugin:hello

/my-plugin:hello Alex
```

**Difference from standalone commands:**

- Standalone in `.claude/commands/hello.md` → `/hello`
- Plugin command in `my-plugin/commands/hello.md` → `/my-plugin:hello`

### Full Installation Pattern

```bash
# 1. Add marketplace
/plugin marketplace add acme-corp/plugins

# 2. Browse available plugins
/plugin
# Navigate to Discover tab

# 3. Install specific plugin
/plugin install formatter@acme-corp-plugins

# 4. Use namespaced command
/formatter:fix src/main.ts
```

### CLI Scope Specification

```bash
# Install to specific scope
claude plugin install formatter@acme-tools --scope project
claude plugin install analyzer@team-tools --scope user
claude plugin install experimental@dev-tools --scope local

# Uninstall from specific scope
claude plugin uninstall formatter@acme-tools --scope project
```

---

## 5. What Gets Installed

### Installation Components

When a plugin is installed, Claude Code copies the entire plugin directory to a cache location and makes the following components available:

### 1. Slash Commands (commands/)

**Location in plugin:** `commands/*.md`

**Markdown format with YAML frontmatter:**

```markdown
---
description: Brief command description
---

# Command Instructions

Step-by-step guidance for Claude.
Use $ARGUMENTS for user input.
Use $1, $2, etc. for individual parameters.
```

**Example:**

```markdown
---
description: Deploy application to specified environment
---

# Deploy Command

Deploy the application to the environment specified in $1 (dev, staging, prod).

1. Run pre-deployment checks
2. Build the application
3. Deploy to $1 environment
4. Run post-deployment verification
```

**Usage:** `/plugin-name:command-name argument`

### 2. Custom Agents (agents/)

**Location in plugin:** `agents/*.md`

**Format:** Markdown files with agent-specific prompts and configurations

**Activated via:** Agent selection in Claude Code

### 3. Agent Skills (skills/)

**Location in plugin:** `skills/skill-name/SKILL.md`

**Skills are model-invoked** (Claude autonomously uses them based on task context)

**SKILL.md format:**

```markdown
---
name: skill-name
description: What the skill does and when to use it
allowed-tools: Read, Grep, Glob
---

# Skill Name

## Instructions
Step-by-step guidance

## Examples
Concrete usage examples
```

**Directory structure:**

```
skills/
└── pdf-processing/
    ├── SKILL.md
    ├── reference.md
    ├── examples.md
    └── scripts/
        └── helper.py
```

### 4. Hooks (hooks/)

**Location in plugin:** `hooks/hooks.json`

**Format:**

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/lint.sh $FILE"
      }]
    }],
    "SessionStart": [{
      "matcher": "startup",
      "hooks": [{
        "type": "command",
        "command": "echo 'Plugin loaded'"
      }]
    }]
  }
}
```

**Hook types:**

- `PreToolUse`: Before tool execution
- `PostToolUse`: After tool execution
- `SessionStart`: When Claude Code session starts

### 5. MCP Servers (.mcp.json)

**Location in plugin root:** `.mcp.json`

**Format:**

```json
{
  "mcpServers": {
    "server-name": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/server-binary",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

**Note:** Use `${CLAUDE_PLUGIN_ROOT}` to reference plugin installation directory

### 6. LSP Servers (.lsp.json)

**Location in plugin root:** `.lsp.json`

**Format:**

```json
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": {
      ".go": "go"
    }
  }
}
```

**Note:** For common languages (TypeScript, Python, Rust), use pre-built LSP plugins from official marketplace rather than creating custom ones.

### Plugin Caching and File Resolution

**Critical behavior:**

- Plugins are **copied to a cache location** during installation
- Files outside the plugin directory (e.g., `../shared-utils`) **will not be copied**
- Use `${CLAUDE_PLUGIN_ROOT}` to reference files within the plugin
- Symlinks are followed during copying

**Path example:**

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh $FILE"
      }]
    }]
  }
}
```

---

## 6. settings.json Configuration for Claude Code

### Configuration Scopes

| Scope | Location | Shared with Team | Use Case |
|-------|----------|------------------|----------|
| **Enterprise** | System-level `managed-settings.json` | Yes (IT deployed) | Security policies, compliance |
| **User** | `~/.claude/settings.json` | No | Personal preferences |
| **Project** | `.claude/settings.json` | Yes (committed to git) | Team-shared settings |
| **Local** | `.claude/settings.local.json` | No (gitignored) | Personal project overrides |

### Settings Precedence (Highest to Lowest)

1. **Managed settings** (Enterprise) - Cannot be overridden
2. **Command line arguments** - Temporary session overrides
3. **Local project settings** - `.claude/settings.local.json`
4. **Shared project settings** - `.claude/settings.json`
5. **User settings** - `~/.claude/settings.json`

### Plugin-Related Settings

```json
{
  "enabledPlugins": {
    "formatter@acme-tools": true,
    "deployer@acme-tools": true,
    "experimental@personal": false
  },
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": {
        "source": "github",
        "repo": "acme-corp/claude-plugins"
      }
    }
  }
}
```

### enabledPlugins

Controls which plugins are enabled across different scopes.

**Format:** `"plugin-name@marketplace-name": true/false`

**Example:**

```json
{
  "enabledPlugins": {
    "code-formatter@team-tools": true,
    "deployment-tools@team-tools": true,
    "experimental-features@personal": false
  }
}
```

**Scopes:**

- User settings: Personal plugin preferences
- Project settings: Project-specific plugins (shared with team)
- Local settings: Per-machine overrides (not committed)

### extraKnownMarketplaces

Defines additional marketplaces for repository-level auto-installation.

**When used in `.claude/settings.json`:**

1. Team members are prompted to install marketplace when they trust the folder
2. Team members are prompted to install plugins from that marketplace
3. Users can skip unwanted marketplaces/plugins (stored in user settings)
4. Requires explicit consent (respects trust boundaries)

**Example:**

```json
{
  "extraKnownMarketplaces": {
    "company-tools": {
      "source": {
        "source": "github",
        "repo": "company/plugins"
      }
    },
    "security-plugins": {
      "source": {
        "source": "git",
        "url": "https://git.example.com/security/plugins.git"
      }
    }
  },
  "enabledPlugins": {
    "formatter@company-tools": true,
    "scanner@security-plugins": true
  }
}
```

### strictKnownMarketplaces (Enterprise Only)

**Available in:** `managed-settings.json` ONLY

**Purpose:** Control which marketplaces users can add

**Behavior:**

- `undefined` (default): No restrictions
- `[]` (empty array): Complete lockdown, no marketplace additions allowed
- Array of sources: Users can only add exact matches

**Example - Allow specific marketplaces:**

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "github",
      "repo": "acme-corp/approved-plugins"
    },
    {
      "source": "github",
      "repo": "acme-corp/security-tools",
      "ref": "v2.0"
    },
    {
      "source": "url",
      "url": "https://plugins.example.com/marketplace.json"
    }
  ]
}
```

**Example - Disable all marketplace additions:**

```json
{
  "strictKnownMarketplaces": []
}
```

**Matching rules:**

- Requires **exact match** of all fields
- For GitHub/Git sources: `repo`/`url`, `ref`, and `path` must all match
- Enforced BEFORE network/filesystem operations
- Cannot be overridden (highest precedence)

### Managed Settings File Locations

**macOS:** `/Library/Application Support/ClaudeCode/managed-settings.json`
**Linux/WSL:** `/etc/claude-code/managed-settings.json`
**Windows:** `C:\ProgramData\ClaudeCode\managed-settings.json`

### Other Key Settings

```json
{
  "permissions": {
    "allow": ["Bash(npm run lint)", "Read(~/.zshrc)"],
    "deny": ["Read(.env)", "Read(.env.*)", "Bash(curl:*)"]
  },
  "env": {
    "NODE_ENV": "development"
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "npm run lint:fix $FILE"
      }]
    }]
  },
  "enableAllProjectMcpServers": true,
  "model": "claude-sonnet-4-5-20250929",
  "outputStyle": "Explanatory"
}
```

### Settings File Locations Summary

| File | Location | Purpose |
|------|----------|---------|
| User settings | `~/.claude/settings.json` | Personal global config |
| Project settings | `.claude/settings.json` | Team-shared config (committed) |
| Local settings | `.claude/settings.local.json` | Personal project config (gitignored) |
| Managed settings | System paths (see above) | Enterprise policies |
| Other config | `~/.claude.json` | Preferences, OAuth, MCP servers, caches |

---

## 7. How Plugins Interact with Local .claude/ Directories

### Plugin vs. Standalone Configuration

| Aspect | Standalone (`.claude/`) | Plugin |
|--------|-------------------------|--------|
| **Slash commands** | `/command` (short) | `/plugin-name:command` (namespaced) |
| **Location** | `.claude/commands/` | `plugin/commands/` |
| **Sharing** | Manual copy or git | Marketplace installation |
| **Updates** | Manual | Automatic via marketplace |
| **Scope** | Single project | Cross-project (via user/project scopes) |

### Directory Structure Comparison

**Standalone configuration:**

```
project/
├── .claude/
│   ├── settings.json        # Project settings
│   ├── settings.local.json  # Personal overrides
│   ├── commands/            # Slash commands
│   │   └── hello.md
│   ├── agents/              # Custom agents
│   │   └── reviewer.md
│   └── skills/              # Agent Skills
│       └── pdf-processing/
│           └── SKILL.md
├── .mcp.json               # Project MCP servers
└── CLAUDE.md               # Project memory/instructions
```

**Plugin installation adds:**

```
~/.claude/
└── plugins/                 # Plugin cache (user scope)
    └── formatter@acme-tools/
        ├── .claude-plugin/
        │   └── plugin.json
        ├── commands/
        ├── agents/
        └── skills/

project/
├── .claude/
│   ├── settings.json        # May include enabledPlugins
│   └── plugins/             # Project-scoped plugin cache
│       └── deployer@team-tools/
└── .mcp.json
```

### Skill Discovery Order

Claude Code discovers Skills from three sources (in order):

1. **Personal Skills:** `~/.claude/skills/`
2. **Project Skills:** `.claude/skills/`
3. **Plugin Skills:** Bundled with installed plugins

**All are automatically available** - no manual configuration needed.

### Settings Merging

Plugin settings merge with local `.claude/settings.json`:

**Project `.claude/settings.json`:**

```json
{
  "permissions": {
    "allow": ["Bash(npm run:*)"]
  },
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": {"source": "github", "repo": "company/plugins"}
    }
  },
  "enabledPlugins": {
    "formatter@team-tools": true
  }
}
```

**User `~/.claude/settings.json`:**

```json
{
  "permissions": {
    "allow": ["Read(~/.zshrc)"]
  },
  "enabledPlugins": {
    "personal-tool@my-marketplace": true
  }
}
```

**Merged result:**

- Both marketplaces available
- Both sets of plugins enabled
- Permissions merged (project takes precedence for conflicts)

### Converting Standalone to Plugin

**Migration steps:**

```bash
# 1. Create plugin structure
mkdir -p my-plugin/.claude-plugin

# 2. Create manifest
cat > my-plugin/.claude-plugin/plugin.json << 'EOF'
{
  "name": "my-plugin",
  "description": "Migrated from standalone",
  "version": "1.0.0"
}
EOF

# 3. Copy existing files
cp -r .claude/commands my-plugin/
cp -r .claude/agents my-plugin/
cp -r .claude/skills my-plugin/

# 4. Migrate hooks
mkdir my-plugin/hooks
# Copy hooks object from .claude/settings.json to my-plugin/hooks/hooks.json

# 5. Test
claude --plugin-dir ./my-plugin

# 6. Remove originals (optional)
rm -rf .claude/commands .claude/agents .claude/skills
```

### Interaction Patterns

**1. Plugin enhances project:**

```json
// .claude/settings.json
{
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": {"source": "github", "repo": "company/plugins"}
    }
  },
  "enabledPlugins": {
    "formatter@team-tools": true,
    "linter@team-tools": true
  },
  "permissions": {
    "allow": ["Bash(npm run:*)"]
  }
}
```

**2. Local overrides plugin:**

```json
// .claude/settings.local.json
{
  "enabledPlugins": {
    "experimental@team-tools": false  // Disable for this machine only
  }
}
```

**3. User globally enables plugin:**

```json
// ~/.claude/settings.json
{
  "enabledPlugins": {
    "my-favorite@personal-marketplace": true  // Available in all projects
  }
}
```

---

## Complete Installation Examples

### Example 1: Basic GitHub Plugin

```bash
# 1. Add marketplace from GitHub
/plugin marketplace add acme-corp/plugins

# 2. View available plugins
/plugin
# Navigate to Discover tab

# 3. Install to user scope (available in all projects)
/plugin install formatter@acme-corp-plugins

# 4. Use the plugin command
/formatter:fix src/
```

### Example 2: Team Project Setup

**In `.claude/settings.json` (committed to git):**

```json
{
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": {
        "source": "github",
        "repo": "mycompany/team-plugins"
      }
    }
  },
  "enabledPlugins": {
    "code-standards@team-tools": true,
    "deployment@team-tools": true
  }
}
```

**Team members:**

```bash
# 1. Clone repo
git clone https://github.com/mycompany/project.git
cd project

# 2. Trust folder
claude
# Prompted to install team-tools marketplace
# Prompted to install code-standards and deployment plugins

# 3. Plugins auto-configured
/code-standards:check
/deployment:staging
```

### Example 3: Local Development Plugin

```bash
# 1. Create plugin locally
mkdir -p ~/my-dev-plugin/.claude-plugin
mkdir -p ~/my-dev-plugin/commands

# 2. Create manifest and commands
# (see section 2)

# 3. Add local marketplace
/plugin marketplace add ~/my-dev-plugin

# 4. Install and test
/plugin install my-dev-plugin@my-dev-plugin
/my-dev-plugin:test-command
```

---

## Installation Commands Reference

### Marketplace Management

```bash
# Add marketplace
/plugin marketplace add <source>
/plugin marketplace add anthropics/claude-code
/plugin marketplace add https://gitlab.com/company/plugins.git
/plugin marketplace add ./local-marketplace

# List marketplaces
/plugin marketplace list

# Update marketplace listings
/plugin marketplace update <name>

# Remove marketplace
/plugin marketplace remove <name>
```

### Plugin Management

```bash
# Install plugin
/plugin install <plugin-name>@<marketplace-name>

# Enable/disable plugin
/plugin enable <plugin-name>@<marketplace-name>
/plugin disable <plugin-name>@<marketplace-name>

# Uninstall plugin
/plugin uninstall <plugin-name>@<marketplace-name>

# Interactive UI
/plugin
```

### CLI Commands with Scopes

```bash
# Install to specific scope
claude plugin install formatter@tools --scope user
claude plugin install deployer@tools --scope project
claude plugin install test@tools --scope local

# Uninstall from specific scope
claude plugin uninstall formatter@tools --scope project
```

### Testing and Debugging

```bash
# Load plugin during development
claude --plugin-dir ./my-plugin

# Load multiple plugins
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two

# Validate plugin/marketplace
claude plugin validate .
/plugin validate .

# Debug mode
claude --debug
```

---

## Best Practices

### For Plugin Authors

1. **Use kebab-case for names**: `my-plugin-name`, not `MyPluginName`
2. **Keep descriptions under 1024 characters**
3. **Use semantic versioning**: `1.2.3`, not `v1.2.3`
4. **Include README.md** with installation and usage instructions
5. **Use `${CLAUDE_PLUGIN_ROOT}`** for all internal file references
6. **Test locally** with `--plugin-dir` before publishing
7. **Document dependencies** in description (e.g., "Requires pypdf package")
8. **Avoid path traversal**: Don't reference files outside plugin directory

### For Marketplace Maintainers

1. **Reserve marketplace names** that won't conflict with official names
2. **Validate marketplace.json** before publishing
3. **Use semantic versioning** for marketplace metadata
4. **Document plugin sources** clearly
5. **Group related plugins** by category
6. **Provide homepage URLs** for each plugin
7. **Test installation flow** before sharing with team

### For Team Configuration

1. **Use `.claude/settings.json`** for team-shared plugin configuration
2. **Include `extraKnownMarketplaces`** to auto-prompt installation
3. **Enable required plugins** via `enabledPlugins`
4. **Document in README** which plugins are required
5. **Use project scope** for team-wide plugins
6. **Use local scope** for personal experimentation
7. **Version control** `.claude/settings.json`, ignore `.claude/settings.local.json`

---

## Authoritative Sources

1. **Official Documentation**
   - [Create plugins](https://code.claude.com/docs/en/plugins)
   - [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
   - [Discover and install prebuilt plugins](https://code.claude.com/docs/en/discover-plugins)
   - [Claude Code settings](https://code.claude.com/docs/en/settings)
   - [Agent Skills](https://code.claude.com/docs/en/skills)

2. **GitHub Resources**
   - [anthropics/claude-code repository](https://github.com/anthropics/claude-code)
   - Official demo marketplace: `anthropics/claude-code`
   - Official plugins marketplace: `claude-plugins-official`

3. **Community Examples**
   - [SuperClaude Plugin](https://github.com/SuperClaude-Org/SuperClaude_Plugin)
   - [Kanopi Claude Toolbox](https://github.com/kanopi/claude-toolbox)
   - Various community marketplaces on GitHub

---

## Key Insights and Recommendations

### Architecture Insights

1. **Plugin caching is immutable**: Plugins are copied to cache, not symlinked
2. **Namespace collision prevention**: `@marketplace-name` suffix prevents conflicts
3. **Skills are model-invoked**: Unlike commands, Skills activate automatically
4. **Settings are hierarchical**: Enterprise > CLI > Local > Project > User
5. **Marketplaces are catalogs**: They don't host plugins, just reference them

### Distribution Strategy

For personal use:

- Use `~/.claude/` standalone configuration
- Quick iteration, no packaging needed

For team use:

- Package as plugin in project repo
- Add to `.claude/settings.json` with `extraKnownMarketplaces`
- Team members get auto-prompted to install

For community distribution:

- Create dedicated plugin repository
- Publish marketplace.json
- Share marketplace addition command

For enterprise:

- Use `managed-settings.json` with `strictKnownMarketplaces`
- Control approved sources centrally
- Deploy via IT/DevOps

### Security Considerations

1. **Trust boundaries**: Users must explicitly trust marketplaces and plugins
2. **Enterprise controls**: `strictKnownMarketplaces` enforces allowlists
3. **Permissions apply**: Plugins respect same permission rules as standalone
4. **No auto-execution**: Plugins don't run code automatically on installation
5. **Marketplace verification**: Anthropic doesn't verify third-party marketplaces

---

## Quick Reference Card

```bash
# MARKETPLACE OPERATIONS
/plugin marketplace add <source>              # Add marketplace
/plugin marketplace list                      # List marketplaces
/plugin marketplace update <name>             # Update marketplace
/plugin marketplace remove <name>             # Remove marketplace

# PLUGIN OPERATIONS
/plugin install <name>@<marketplace>          # Install plugin
/plugin enable <name>@<marketplace>           # Enable plugin
/plugin disable <name>@<marketplace>          # Disable plugin
/plugin uninstall <name>@<marketplace>        # Uninstall plugin
/plugin                                       # Interactive UI

# DEVELOPMENT
claude --plugin-dir ./my-plugin               # Test plugin locally
claude plugin validate .                      # Validate structure
claude --debug                                # Debug mode

# USING PLUGINS
/plugin-name:command args                     # Run plugin command
```

**Plugin structure:**

```
plugin-name/
├── .claude-plugin/plugin.json    # Required
├── commands/*.md                 # Optional
├── agents/*.md                   # Optional
├── skills/*/SKILL.md            # Optional
├── hooks/hooks.json             # Optional
├── .mcp.json                    # Optional
└── .lsp.json                    # Optional
```

---

## Conclusion

Claude Code's plugin system provides a robust, marketplace-based distribution model for extending functionality. The `@namespace` pattern ensures source identification and conflict prevention, while the hierarchical settings system balances team standardization with personal customization. Enterprise controls via `strictKnownMarketplaces` enable security-conscious organizations to maintain compliance while leveraging the plugin ecosystem.

The key to effective plugin usage is understanding the three-tier model:

1. **Plugins** provide functionality (commands, agents, Skills, hooks, servers)
2. **Marketplaces** catalog and distribute plugins
3. **Settings** control which plugins are enabled and where they come from

This research document provides complete technical specifications for creating, distributing, installing, and managing Claude Code plugins and marketplaces.
