# skills-factory — PLAN.md (v2)

## 1. Why this exists

You want to file an issue like _"A skill for the Apple Human Interface Guidelines"_ and have the factory do the rest.

That's it. That's the north star.

### The friction this solves

Creating agent skills today is manual and scattered:

- You research in one place, draft in another, test locally, then manually commit.
- There's no separation between _gathering knowledge_ (which needs web access) and _writing the skill_ (which should be constrained).
- Skills live in various directories across machines with no easy way to share or version them.
- Getting a skill from idea to usable takes too many steps.

### What we're building

A **GitHub template repo** that turns issues into production-ready skills through a structured, automated pipeline:

```
Issue → Research Agent → Authoring Agent → Validation → Review Agent → Merge → Available skill
```

This repo is simultaneously:

1. **A skill workspace** — where skills get authored, reviewed, and maintained
2. **A factory** — GitHub Actions orchestrate research, drafting, review, linting, and auto-merge
3. **A distribution surface** — usable as a Claude Code plugin _and_ a Codex-ready repo

### Design philosophy

**Speed by default, rigor when needed.** The pipeline auto-proceeds with sensible defaults. Use labels to add research depth or review gates when the situation calls for it.

**Two paths to the same destination.** Create skills locally for immediate use, or file issues for hands-off async creation. Both end up in the same repo, same format, same validation.

**Separation of concerns for safety.** The research agent can hit the open web; the authoring agent cannot. This prevents accidental data leakage and keeps skill content deterministic.

**Configuration-driven control.** A single YAML file controls defaults. Labels provide per-issue/PR escape hatches. Smart detection enables MCPs only when credentials are available.

**Back-and-forth is built in.** You can converse with agents in issues and PRs. Comment `@skills-factory research more on accessibility guidelines` and the factory responds.

**Template-first.** You clone this template and own it. Others can fork theirs. The skills you create can then be shared via plugin marketplaces or installed directly.

---

## 2. Two Workflows

### 2.1. Local-First (Immediate Use)

For when you need a skill NOW:

```
You → Create skills/x/SKILL.md locally → Use immediately → Push when ready
                                              ↓
                                        Validation runs async
                                        (non-blocking, you're already using it)
```

**Steps:**

1. Clone this repo locally (one-time setup)
2. Create `skills/my-skill/SKILL.md`
3. Use it immediately in Claude Code
4. `git push` when ready — validation runs in CI
5. Merge to main for permanence

**Latency:** Zero. Skill is usable the moment you save the file.

See `docs/local-first-workflow.md` for details.

### 2.2. Issue-Driven (Async Creation)

For when you want the factory to do the work:

```
You → File issue → Agent creates skill → Merge → You git pull → Use
```

**Steps:**

1. Open issue using template
2. Factory creates branch + runs research (if enabled)
3. Authoring agent writes SKILL.md
4. Validation runs
5. Auto-merge (if enabled)
6. You `git pull` locally to get the skill

**Latency:** 5-10 minutes, but hands-off.

See `docs/issue-driven-workflow.md` for details.

---

## 3. Design principles

### Speed by default

The default configuration optimizes for low friction:

- Auto-proceed between stages (no human checkpoints)
- Minimal research (quick validation, not deep dives)
- Skip review agent (validation is enough for personal use)
- Auto-merge when validation passes

Override with labels when you need more rigor.

### Label-based control

Labels override config defaults per-issue or per-PR:

| Label | Effect | When to use |
|-------|--------|-------------|
| `skip:research` | Bypass research agent | You're providing the content |
| `skip:review` | Bypass review agent | Quick iteration, trusted author |
| `skip:validation` | Bypass lint/validate | Emergency, fix later |
| `research:deep` | Force comprehensive research | Complex external topic |
| `review:required` | Force review even if auto-merge enabled | Higher stakes skill |

### Permission tiers

| Agent role | Network access | File writes | Scope |
|------------|---------------|-------------|-------|
| Research | ✓ (via MCPs) | `.research/` only | Gather sources, summarize |
| Authoring | ✗ | Full skill directory | Write SKILL.md and supporting files |
| Review | ✗ | None (read-only) | Evaluate PR, emit pass/fail verdict |

### Root stays clean

All factory machinery lives in hidden directories. The only visible top-level directories are `skills/`, `docs/`, and `scripts/`.

### One repo, multiple ecosystems

Canonical sources live in one place. Tool-specific adapters are generated:

- Claude: reads from `skills/` directly
- Codex: reads via `project_doc_fallback_filenames` config

---

## 4. Repo structure

```
.
├── AGENTS.md                            # User customization point
├── CLAUDE.md                            # Points to AGENTS.md
├── README.md
│
├── skills/                              # The canonical skill catalog
│   └── <skill-name>/
│       ├── SKILL.md                     # Required: frontmatter + instructions
│       ├── .research/                   # Temporary: removed on merge to main
│       │   ├── SOURCES.md
│       │   └── notes.md
│       ├── references/                  # Optional: extra docs
│       ├── scripts/                     # Optional: executable helpers
│       └── assets/                      # Optional: templates, images
│
├── docs/
│   ├── local-first-workflow.md          # Creating skills locally
│   ├── issue-driven-workflow.md         # Full async pipeline
│   ├── labels.md                        # Label reference
│   └── llm-url-generation.md            # Creating issues via ChatGPT/Claude.ai
│
├── .skills-factory/
│   └── config.yml                       # Factory configuration
│
├── .agents/
│   ├── rules/
│   │   └── AGENTS.md                    # Factory instructions (shared by both tools)
│   ├── skills/
│   │   ├── skills-authoring/
│   │   ├── skills-research/
│   │   └── skills-validation/
│   └── .markdownlint-cli2.jsonc
│   └── templates/
│       └── PR_BODY.md
│
├── .claude/
│   └── settings.json
│
├── .codex/
│   └── config.toml                      # Uses project_doc_fallback_filenames
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── create-skill.yml
│   │   └── create-skill-with-spec.yml
│   ├── workflows/
│   │   ├── issue-create-skill.yml
│   │   ├── pr-author-skill.yml
│   │   ├── pr-review-skill.yml
│   │   ├── pr-validate.yml
│   │   └── pr-automerge.yml
│   └── pull_request_template.md
│
├── scripts/
│   ├── lint/
│   │   └── lint-skills.ts
│   └── sync/
│       └── cleanup-research.ts          # Removes .research/ dirs before merge
│
├── bun.lockb
└── package.json
```

### Instruction file hierarchy

```
AGENTS.md (root)              ← User customization
    ↓ referenced by
CLAUDE.md (root)              ← Points Claude to AGENTS.md
    ↓ also imports
.agents/rules/AGENTS.md       ← Factory instructions (shared by both tools)
```

---

## 5. Configuration

**File:** `.skills-factory/config.yml`

```yaml
version: 1

# Defaults optimized for speed - override with labels when needed
defaults:
  research: minimal          # none | minimal | deep
  review: skip               # skip | optional | required
  auto_proceed: true         # No human checkpoints between stages
  auto_merge: true           # Merge when validation passes

# Label mappings (override defaults per-issue/PR)
labels:
  skip_research: "skip:research"
  skip_review: "skip:review"
  skip_validation: "skip:validation"
  deep_research: "research:deep"
  require_review: "review:required"

# Who can use skip labels
permissions:
  skip_labels_allowed:
    - repo_owner
    - collaborator

# MCP servers for research phase
# Enabled MCPs are only used if their required secrets are available
mcp:
  - name: firecrawl
    enabled: true
  - name: context7
    enabled: true
  - name: octocode
    enabled: true

# Research constraints (when research runs)
research:
  max_sources: 10
  allowed_domains:
    - developer.apple.com
    - docs.anthropic.com
    - platform.openai.com
    - agentskills.io

# Validation rules
validation:
  required_files:
    - SKILL.md
  max_skill_lines: 500
  enforce_kebab_case: true
  required_frontmatter:
    - name
    - description

# Agent configuration
agents:
  provider: claude            # claude | codex
  alternate_review: false     # Use different provider for review

# GitHub integration
github:
  app_id_var: SKILLS_FACTORY_APP_ID
  app_pem_secret: SKILLS_FACTORY_APP_PEM

# Rate limits
rate_limits:
  max_agent_runs_per_issue_per_hour: 3
```

### MCP Smart Detection

For each MCP where `enabled: true`:

1. Check if required secret exists (e.g., `FIRECRAWL_API_KEY`)
2. If missing, skip silently (log warning)
3. If present, make available to research agent

This means:

- Config declares intent
- Runtime checks availability
- No failures if credentials aren't configured
- Works with whatever MCPs are set up

---

## 6. Key workflows

### 6.1. Default flow (fast path)

With default config, an issue flows through:

```
Issue filed
    ↓
[research: minimal] → Quick source check via available MCPs
    ↓
[auto_proceed: true] → Immediately to authoring
    ↓
Authoring agent writes SKILL.md
    ↓
Validation runs (lint, frontmatter, structure)
    ↓
[review: skip] → No review agent
    ↓
[auto_merge: true] → Merged to main
```

### 6.2. With labels (rigorous path)

```
Issue filed + labels: "research:deep", "review:required"
    ↓
[research: deep] → Comprehensive research, multiple sources
    ↓
Authoring agent writes SKILL.md
    ↓
Validation runs
    ↓
[review: required] → Review agent evaluates
    ↓
Auto-merge when review passes
```

### 6.3. Issue commands

| Command | Effect |
|---------|--------|
| `@skills-factory research` | Re-run research agent with additional context |
| `@skills-factory build` | Trigger authoring agent |
| `@skills-factory review` | Trigger review agent |
| `@skills-factory merge` | Attempt auto-merge if checks pass |

**Loop prevention:** Max 3 invocations per hour per issue (configurable).

### 6.4. Fast-path for config changes

When the only changed file is `.skills-factory/config.yml` and the actor is a repo owner:

1. Skip research/authoring agents
2. Run config validation only
3. Auto-merge if valid

---

## 7. Agent roles

### 7.1. Research Agent

**Purpose:** Gather sources and synthesize into a compact research packet.

**Tools available:**

- MCPs as configured (firecrawl, context7, octocode)
- Only MCPs with valid credentials are available at runtime

**Outputs:**

- `skills/<name>/.research/SOURCES.md` — links with relevance annotations
- `skills/<name>/.research/notes.md` — structured summary

**Constraints:**

- Domain allowlist (configurable)
- Max sources limit
- No writes outside `.research/`

### 7.2. Authoring Agent

**Purpose:** Write SKILL.md from research packet (or issue description if no research).

**Tools available:**

- File read/write only
- No network, no shell beyond git

**Inputs:**

- Everything in `.research/` (if exists)
- Issue description and comments
- The `.agents/skills/skills-authoring/` meta-skill

**Outputs:**

- `skills/<name>/SKILL.md`
- Optional: `references/`, `scripts/`, `assets/`

### 7.3. Review Agent

**Purpose:** Evaluate PR, emit structured verdict.

**Output format:**

```json
{
  "approved": false,
  "blocking_issues": [
    {
      "file": "skills/apple-hig/SKILL.md",
      "line": 45,
      "severity": "error",
      "message": "Description doesn't specify trigger conditions"
    }
  ],
  "suggestions": [
    {
      "file": "skills/apple-hig/SKILL.md",
      "line": 23,
      "message": "Consider adding an example"
    }
  ]
}
```

Only blocking issues prevent merge. Suggestions are advisory.

---

## 8. Issue templates

### 8.1. create-skill.yml

```yaml
name: Create Skill
description: Request a new agent skill
title: "skill: "
labels: ["skill:create"]
body:
  - type: input
    id: skill-name
    attributes:
      label: Skill name
      description: Use kebab-case (e.g., apple-hig, react-testing)
      placeholder: my-skill-name
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: What should this skill do?
      description: Describe the skill's purpose and when it should activate
    validations:
      required: true

  - type: textarea
    id: sources
    attributes:
      label: Sources to research (optional)
      description: URLs or topics to investigate
      placeholder: |
        - https://developer.apple.com/design/human-interface-guidelines/
        - Apple HIG documentation

  - type: dropdown
    id: research-depth
    attributes:
      label: Research depth
      options:
        - Minimal (quick validation)
        - None (I'll provide the content)
        - Deep (comprehensive research)
    validations:
      required: true
```

### 8.2. create-skill-with-spec.yml

Designed for LLM-generated issues. See `docs/llm-url-generation.md` for how to use ChatGPT/Claude.ai to generate pre-filled issue URLs.

---

## 9. CI orchestration

### Critical: GitHub App token

PRs created by `GITHUB_TOKEN` won't trigger workflows. Use a GitHub App:

1. Create GitHub App with Contents, Pull Requests, Issues permissions
2. Install on repo
3. Store `APP_ID` in vars, `APP_PEM` in secrets
4. Use `actions/create-github-app-token` in workflows

### Workflow summary

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `issue-create-skill.yml` | Issue labeled `skill:create` | Create branch, run research, open draft PR |
| `pr-author-skill.yml` | Draft PR or `@skills-factory build` | Run authoring agent |
| `pr-validate.yml` | Any PR touching `skills/**` | Lint, validate, check frontmatter |
| `pr-review-skill.yml` | PR ready for review | Run review agent (if not skipped) |
| `pr-automerge.yml` | All checks pass | Merge and cleanup `.research/` |

---

## 10. Validation

### Built-in checks

- `markdownlint` with config in `.markdownlint-cli2.jsonc`
- Frontmatter validation (required fields, name matches folder)
- Folder naming (kebab-case)
- Size limits (max 500 lines for SKILL.md)

### Custom scripts

**`scripts/lint/lint-skills.ts`:**

- Validates skill structure
- Checks frontmatter schema
- Enforces naming conventions

**`scripts/sync/cleanup-research.ts`:**

- Removes `.research/` directories before merge to main
- Keeps main branch clean

---

## 11. Distribution

### As a Claude Code plugin

This repo is a single installable plugin bundling all skills in `skills/`.

```bash
# Add marketplace (account name is the namespace)
/plugin marketplace add galligan/skills-factory

# Install
/plugin install skills-factory@galligan
```

### As Codex-ready repo

Codex discovers instructions via:

- Root `AGENTS.md`
- `.agents/rules/AGENTS.md` via `project_doc_fallback_filenames`

### Skill portability

Skills follow the Agent Skills spec (`agentskills.io`), working across Claude Code, Codex, VS Code Copilot, and any compliant agent.

---

## 12. Security

- Agent workflows only run for collaborators, or when maintainer adds label
- App tokens scoped to specific permissions
- Rate limits prevent runaway agent loops
- MCP domain allowlists constrain research scope
- Never auto-merge from forks

---

## 13. MVP Phases

### Phase 1: Local-First Foundation

- [ ] Create repo structure
- [ ] `.skills-factory/config.yml` with defaults
- [ ] Root `AGENTS.md` + `CLAUDE.md`
- [ ] `.agents/rules/AGENTS.md` (factory instructions)
- [ ] One example skill (`skills/example/`)
- [ ] `docs/local-first-workflow.md`
- [ ] Basic validation script

**Outcome:** Create skills locally and use immediately.

### Phase 2: Validation Pipeline

- [ ] `pr-validate.yml` workflow
- [ ] `scripts/lint/lint-skills.ts`
- [ ] `scripts/sync/cleanup-research.ts`
- [ ] markdownlint config (`.markdownlint-cli2.jsonc`)

**Outcome:** PRs get validated automatically.

### Phase 3: Issue Automation

- [ ] Issue templates
- [ ] `issue-create-skill.yml` workflow
- [ ] GitHub App setup
- [ ] `docs/issue-driven-workflow.md`
- [ ] Label system implementation

**Outcome:** Issues create branches and draft PRs.

### Phase 4: Agent Integration

- [ ] `.agents/skills/skills-research/SKILL.md`
- [ ] `.agents/skills/skills-authoring/SKILL.md`
- [ ] MCP integration (firecrawl, context7, octocode)
- [ ] Research agent workflow
- [ ] Authoring agent workflow

**Outcome:** Agents write skills from issues.

### Phase 5: Review & Merge

- [ ] `.agents/skills/skills-validation/SKILL.md`
- [ ] Review agent with structured output
- [ ] Auto-merge workflow
- [ ] Rate limiting

**Outcome:** Full pipeline works end-to-end.

### Phase 6: Distribution

- [ ] Plugin packaging
- [ ] Codex compatibility
- [ ] `docs/llm-url-generation.md`

**Outcome:** Others can use your skills.

---

## 14. Decisions made

| Question | Decision | Rationale |
|----------|----------|-----------|
| Config location | `.skills-factory/config.yml` | Clear namespace, not confused with other tools |
| Default research | `minimal` | Speed first, deep research opt-in via label |
| Default review | `skip` | Validation script is enough for personal use |
| Auto-proceed | `true` | No human checkpoints by default |
| Human checkpoints | Via labels | `review:required` when you need it |
| `.research/` on main | Remove before merge | Keeps main clean; research is ephemeral |
| MCP availability | Smart detection | Check for secrets, skip if missing |
| Keep `.agents/` nesting | Yes | Will be used for more later |

---

## 15. Open questions

| Question | Options | Notes |
|----------|---------|-------|
| Skill versioning | Frontmatter / Git tags / Both | Spec supports `metadata.version` |
| Skill deprecation | Archive label / Move to `_archive/` | Need graceful sunset path |
| Multi-language | Per-language skill / Single with hints | e.g., apple-hig-ja |
| Local refresh mechanism | Manual git pull / Watcher / Plugin refresh | How merged skills reach active session |

---

## 16. Research sources

| Topic | Source |
|-------|--------|
| Claude Code GitHub Actions | [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) |
| OpenAI Codex GitHub Action | [openai/codex-action](https://github.com/openai/codex-action) |
| Agent Skills specification | [agentskills.io/specification](https://agentskills.io/specification) |
| Claude plugins | [Claude plugin docs](https://code.claude.com/docs/en/plugin-marketplaces) |
| GitHub App tokens | [GitHub docs](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) |
| IssueOps patterns | [GitHub Blog](https://github.blog/engineering/issueops-automate-ci-cd-and-more-with-github-issues-and-actions/) |
