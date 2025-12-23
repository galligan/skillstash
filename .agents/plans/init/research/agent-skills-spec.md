# Agent Skills Specification Research

**Research Date:** 2025-12-23
**Specification Source:** [agentskills.io](https://agentskills.io)
**Version:** Current as of December 2025

## Executive Summary

Agent Skills is an open standard for extending AI agent capabilities through structured, portable skill packages. Originally developed by Anthropic and released as an open standard, it has been adopted by major agent platforms including Claude Code, VS Code Copilot, OpenAI Codex, Cursor, Goose, and others.

**Key Insight:** Skills use progressive disclosure (metadata → instructions → resources) to manage context efficiently, allowing agents to access specialized capabilities on-demand without consuming context until needed.

---

## 1. SKILL.md Format Overview

### 1.1 Basic Structure

A skill is a directory containing at minimum a `SKILL.md` file:

```
skill-name/
└── SKILL.md          # Required
```

The `SKILL.md` file must contain YAML frontmatter followed by Markdown content:

```markdown
---
name: skill-name
description: Description of what this skill does and when to use it
---

# Skill Instructions

Your detailed instructions, guidelines, and examples go here...
```

### 1.2 Complete File Structure

Skills can optionally include additional directories:

```
skill-name/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

---

## 2. Required Frontmatter Fields

### 2.1 `name` Field

**Constraints:**

- Required: Yes
- Length: 1-64 characters
- Format: Lowercase letters (a-z), numbers, and hyphens (-) only
- Must not start or end with hyphen
- Must not contain consecutive hyphens (--)
- Must match the parent directory name

**Valid Examples:**

```yaml
name: pdf-processing
name: data-analysis
name: code-review
```

**Invalid Examples:**

```yaml
name: PDF-Processing    # uppercase not allowed
name: -pdf              # cannot start with hyphen
name: pdf--processing   # consecutive hyphens not allowed
```

### 2.2 `description` Field

**Constraints:**

- Required: Yes
- Length: 1-1024 characters
- Should describe both what the skill does AND when to use it
- Should include specific keywords that help agents identify relevant tasks

**Good Example:**

```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

**Poor Example:**

```yaml
description: Helps with PDFs.  # Too vague, missing trigger conditions
```

---

## 3. Optional Metadata Fields

### 3.1 `license` Field

**Purpose:** Specify the license applied to the skill
**Recommendation:** Keep it short (license name or reference to bundled file)

**Example:**

```yaml
license: Apache-2.0
license: Proprietary. LICENSE.txt has complete terms
```

### 3.2 `compatibility` Field

**Constraints:**

- Length: 1-500 characters (if provided)
- Only include if skill has specific environment requirements
- Can indicate intended product, required system packages, network access needs

**Examples:**

```yaml
compatibility: Designed for Claude Code (or similar products)
compatibility: Requires git, docker, jq, and access to the internet
```

**Note:** Most skills do not need this field.

### 3.3 `metadata` Field

**Purpose:** Arbitrary key-value mapping for additional metadata
**Usage:** Clients can use this to store properties not defined by the spec

**Example:**

```yaml
metadata:
  author: example-org
  version: "1.0"
  short-description: Optional user-facing description
```

**Recommendation:** Make key names reasonably unique to avoid conflicts.

### 3.4 `allowed-tools` Field (Experimental)

**Purpose:** Space-delimited list of pre-approved tools the skill may use
**Status:** Experimental; support varies between agent implementations

**Example:**

```yaml
allowed-tools: Bash(git:*) Bash(jq:*) Read
```

---

## 4. Body Content Structure

### 4.1 Guidelines

The Markdown body after frontmatter contains skill instructions. There are no format restrictions, but recommended sections include:

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases
- When to use this skill
- Guidelines and best practices

### 4.2 Recommendations

- Keep main `SKILL.md` under 500 lines
- Under 5000 tokens recommended for the body
- Move detailed reference material to separate files
- Use clear, specific instructions
- Include examples
- Document common pitfalls

---

## 5. Directory Structure Conventions

### 5.1 Optional Directories

#### `scripts/`

Contains executable code that agents can run.

**Best Practices:**

- Be self-contained or clearly document dependencies
- Include helpful error messages
- Handle edge cases gracefully
- Supported languages depend on agent implementation (commonly: Python, Bash, JavaScript)

#### `references/`

Contains additional documentation loaded on demand.

**Common Files:**

- `REFERENCE.md` - Detailed technical reference
- `FORMS.md` - Form templates or structured data formats
- Domain-specific files (`finance.md`, `legal.md`, etc.)

**Best Practices:**

- Keep individual files focused
- Smaller files = less context usage when loaded
- Agents load these only when needed

#### `assets/`

Contains static resources.

**Common Contents:**

- Templates (document templates, configuration templates)
- Images (diagrams, examples)
- Data files (lookup tables, schemas)

### 5.2 File References

When referencing other files in your skill, use relative paths from the skill root:

```markdown
See [the reference guide](references/REFERENCE.md) for details.

Run the extraction script:
scripts/extract.py
```

**Best Practice:** Keep file references one level deep from `SKILL.md`. Avoid deeply nested reference chains.

---

## 6. How Different Tools Consume Skills

### 6.1 Skill Locations by Platform

#### Claude Code

- **Primary:** `.github/skills/` (recommended for all new skills)
- **Legacy:** `.claude/skills/` (also supported for backward compatibility)

#### VS Code Copilot

- **Primary:** `.github/skills/`
- **Legacy:** `.claude/skills/`
- **Setting:** Requires `chat.useAgentSkills` enabled (preview feature in VS Code Insiders)

#### OpenAI Codex

Codex loads skills from multiple locations with precedence (high to low):

| Scope | Location | Use Case |
|-------|----------|----------|
| `REPO` | `$CWD/.codex/skills` | Skills specific to current working folder |
| `REPO` | `$CWD/../.codex/skills` | Skills for parent folder in git repo |
| `REPO` | `$REPO_ROOT/.codex/skills` | Repository-wide skills (root level) |
| `USER` | `$CODEX_HOME/skills` (default: `~/.codex/skills`) | User's personal skills |
| `ADMIN` | `/etc/codex/skills` | System-wide admin skills |
| `SYSTEM` | Bundled with Codex | Built-in skills |

**Note:** Skills with the same name from higher precedence locations overwrite lower precedence ones.

#### Cursor

- Similar pattern to VS Code Copilot
- `.github/skills/` supported

#### Other Platforms

- **Goose, Letta, Amp, OpenCode, GitHub:** All support the standard `.github/skills/` location

### 6.2 Integration Approaches

#### Filesystem-Based Agents

- Operate within computer environment (bash/unix)
- Skills activated via shell commands (e.g., `cat /path/to/skill/SKILL.md`)
- Most capable option
- Bundled resources accessed through shell commands

#### Tool-Based Agents

- Function without dedicated computer environment
- Implement tools allowing models to trigger skills
- Access bundled assets through custom tools
- Specific tool implementation is up to the developer

---

## 7. Trigger Conditions and Activation Patterns

### 7.1 Progressive Disclosure

Skills use a three-level loading system:

**Level 1: Skill Discovery (~100 tokens)**

- At startup, agents load only `name` and `description` of each skill
- Just enough to know when skill might be relevant
- All skills' metadata loaded at once

**Level 2: Instructions Loading (<5000 tokens recommended)**

- When task matches skill's description, agent reads full `SKILL.md` body
- Instructions become available in context
- Only loaded when skill is activated

**Level 3: Resource Access (on-demand)**

- Additional files in skill directory loaded only as needed
- Scripts, examples, documentation don't load until referenced
- Keeps context efficient

### 7.2 Activation Methods

#### Implicit Invocation

- Agent automatically decides to use a skill when user's task matches the skill's description
- Based on semantic matching of task to description field
- No user action required

#### Explicit Invocation

- User directly mentions or selects a skill
- Methods vary by platform:
  - Codex CLI/IDE: `/skills` slash command or `$skill-name` mention
  - VS Code: Skill selector in chat
  - Claude Code: Mention in prompt

**Note:** Codex web and iOS don't support explicit invocation yet, but can still use skills checked into repos via implicit invocation.

### 7.3 Context Injection Format

For Claude models, the recommended format uses XML:

```xml
<available_skills>
  <skill>
    <name>pdf-processing</name>
    <description>Extracts text and tables from PDF files, fills forms, merges documents.</description>
    <location>/path/to/skills/pdf-processing/SKILL.md</location>
  </skill>
  <skill>
    <name>data-analysis</name>
    <description>Analyzes datasets, generates charts, and creates summary reports.</description>
    <location>/path/to/skills/data-analysis/SKILL.md</location>
  </skill>
</available_skills>
```

**Guidelines:**

- For filesystem-based agents, include `location` field with absolute path
- For tool-based agents, location can be omitted
- Keep metadata concise (50-100 tokens per skill)

---

## 8. Progressive Disclosure with references/

### 8.1 Context Management Strategy

Skills should be structured for efficient context usage:

1. **Metadata** (~100 tokens): Name and description loaded at startup for all skills
2. **Instructions** (<5000 tokens recommended): Full `SKILL.md` body loaded when skill activates
3. **Resources** (as needed): Files loaded only when required

### 8.2 Reference Files Best Practices

**Purpose of references/ Directory:**

- Detailed technical documentation
- Form templates or structured data formats
- Domain-specific knowledge
- Extended examples

**Organization:**

```
skill-name/
├── SKILL.md
└── references/
    ├── REFERENCE.md      # Main technical reference
    ├── FORMS.md          # Form templates
    ├── finance.md        # Domain-specific content
    └── legal.md          # Domain-specific content
```

**Key Principle:** Keep individual reference files focused. Agents load these on demand, so smaller files mean less context usage.

---

## 9. Portability Across Different Agent Platforms

### 9.1 Adoption Status

Agent Skills are supported by leading AI development tools:

- **Claude Code** (Anthropic) - Full support
- **Claude.ai** (Anthropic) - Built-in skills + custom upload
- **VS Code Copilot** (Microsoft/GitHub) - Preview support
- **OpenAI Codex** (OpenAI) - Full support with extended features
- **GitHub Copilot CLI** (GitHub) - Full support
- **Cursor** - Full support
- **Goose** (Block) - Full support
- **Letta** - Full support
- **Amp** - Full support
- **OpenCode** - Full support

### 9.2 Portability Characteristics

**For Skill Authors:**

- Build capabilities once
- Deploy across multiple agent products
- Version control as files
- Easy to edit and share

**For Compatible Agents:**

- Support for skills lets end users extend capabilities out of the box
- Standard format reduces implementation complexity

**For Teams and Enterprises:**

- Capture organizational knowledge in portable packages
- Version-controlled
- Shareable across tools
- Auditable and reviewable

### 9.3 Platform-Specific Features

While the core standard is portable, some platforms add extensions:

**Codex:**

- Multiple skill scope levels (REPO, USER, ADMIN, SYSTEM)
- Skill installer (`$skill-installer`) for downloading from GitHub
- Built-in `$skill-creator` and `$create-plan` skills

**Claude Code:**

- Plugin marketplace for skill distribution
- Document skills (docx, pdf, pptx, xlsx) bundled

**VS Code Copilot:**

- Terminal tool integration
- Auto-approve options for scripts
- Security controls for automated approval

---

## 10. Validation and Tooling

### 10.1 skills-ref Reference Library

The official reference library provides validation and utilities:

**GitHub:** [agentskills/agentskills/skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)

**Validation:**

```bash
skills-ref validate ./my-skill
```

Checks:

- YAML frontmatter is valid
- All naming conventions followed
- Required fields present

**Prompt Generation:**

```bash
skills-ref to-prompt <path>...
```

Generates `<available_skills>` XML for agent prompts.

### 10.2 Creating Skills

#### Using Built-in Tools

**Codex:**

```
$skill-creator
```

Describe what you want, and Codex bootstraps your skill.

**With Planning (Experimental):**

```
$skill-installer create-plan
$skill-creator
```

Codex first creates a plan, then implements the skill.

#### Manual Creation

1. Create folder with valid name (lowercase, hyphens)
2. Create `SKILL.md` with required frontmatter
3. Add instructions in Markdown body
4. Optionally add `scripts/`, `references/`, `assets/`
5. Validate with `skills-ref validate`

---

## 11. Security Considerations

### 11.1 Script Execution Risks

Script execution introduces security risks. Platforms implement various controls:

**Sandboxing:**

- Run scripts in isolated environments
- Limit file system access
- Restrict network access

**Allowlisting:**

- Only execute scripts from trusted skills
- Verify skill source before execution

**Confirmation:**

- Ask users before running potentially dangerous operations
- Show what commands will be executed
- Provide clear approval mechanisms

**Logging:**

- Record all script executions for auditing
- Track which skills were activated
- Monitor resource access

### 11.2 Platform-Specific Security

**VS Code Copilot:**

- Terminal tool with execution controls
- Auto-approve options with configurable allow-lists
- Tight controls over which code runs

**Codex:**

- Experimental `allowed-tools` field for pre-approval
- Skill scope controls (USER vs ADMIN vs SYSTEM)

---

## 12. Best Practices

### 12.1 Skill Design

**Description Field:**

- Include both capabilities AND trigger conditions
- Use specific keywords agents can match
- Be comprehensive (up to 1024 characters allowed)

**Instructions:**

- Write clear, step-by-step procedures
- Include examples of inputs and outputs
- Document edge cases and common pitfalls
- Keep main SKILL.md under 500 lines

**Organization:**

- Move detailed content to `references/`
- Keep files focused and single-purpose
- Use meaningful names for reference files

### 12.2 Context Efficiency

**Progressive Disclosure:**

- Design for three-level loading
- Keep metadata minimal
- Structure instructions for quick scanning
- Move bulk content to separate files

**Token Budgets:**

- Metadata: ~50-100 tokens per skill
- Instructions: <5000 tokens recommended
- References: Load only what's needed

### 12.3 Portability

**Standard Compliance:**

- Follow specification exactly
- Avoid platform-specific extensions in core skill
- Test across multiple platforms if targeting wide adoption
- Use recommended directory structure

**Documentation:**

- Include clear examples
- Document dependencies
- Specify compatibility requirements if needed
- Provide usage instructions

---

## 13. Example Skills Repository

### 13.1 Official Examples

**Anthropic Repository:** [anthropics/skills](https://github.com/anthropics/skills)

**Categories:**

- Creative & Design skills
- Development & Technical skills
- Enterprise & Communication skills
- Document skills (docx, pdf, pptx, xlsx)

**License:**

- Most skills: Apache 2.0 (open source)
- Document skills: Source-available (reference only)

### 13.2 Community Skills

**GitHub Awesome List:** [github/awesome-copilot](https://github.com/github/awesome-copilot)

Contains:

- Community skills
- Custom agents
- Instructions
- Prompts

**Partner Skills:**

- **Notion:** [Notion Skills for Claude](https://www.notion.so/notiondevs/Notion-Skills-for-Claude-28da4445d27180c7af1df7d8615723d0)

---

## 14. Complete SKILL.md Template

### 14.1 Minimal Template

```markdown
---
name: skill-name
description: A clear description of what this skill does and when to use it
---

# Skill Name

[Add your instructions here that Claude will follow when this skill is active]

## Examples
- Example usage 1
- Example usage 2

## Guidelines
- Guideline 1
- Guideline 2
```

### 14.2 Complete Template with All Fields

```markdown
---
# REQUIRED FIELDS
name: my-skill-name
description: |
  Comprehensive description of what this skill does. Include both capabilities
  and trigger conditions. Use when the user needs to [specific task]. Handles
  [specific scenarios]. Keywords: keyword1, keyword2, keyword3.

# OPTIONAL FIELDS
license: Apache-2.0

compatibility: |
  Designed for filesystem-based agents with bash access.
  Requires: git, jq, curl. Network access needed for API calls.

metadata:
  author: your-org
  version: "1.0.0"
  category: development
  tags: [automation, testing, ci-cd]
  short-description: Brief user-facing description

allowed-tools: Bash(git:*) Bash(jq:*) Read Write Edit
---

# Skill Name

Brief overview of what this skill accomplishes and its primary use cases.

## When to use this skill

Describe specific scenarios where this skill should be activated:
- Scenario 1: [description]
- Scenario 2: [description]
- Scenario 3: [description]

## Prerequisites

List any requirements:
- Required tools or software
- Environment setup
- Configuration needed
- API keys or credentials (if applicable)

## Instructions

### Step 1: [First Major Step]

Detailed instructions for the first step:

1. Sub-step 1
2. Sub-step 2
3. Sub-step 3

**Example:**
```bash
# Example command or code
command --flag argument
```

### Step 2: [Second Major Step]

Continue with subsequent steps...

## Examples

### Example 1: [Use Case Name]

**Input:**

```
Example input or trigger
```

**Process:**

1. Step taken
2. Step taken
3. Step taken

**Output:**

```
Expected output or result
```

### Example 2: [Another Use Case]

[Repeat pattern for additional examples]

## Edge Cases and Error Handling

### Common Issues

**Issue 1: [Description]**

- Cause: [Why this happens]
- Solution: [How to resolve]

**Issue 2: [Description]**

- Cause: [Why this happens]
- Solution: [How to resolve]

### Validation

How to verify the skill executed correctly:

- Check 1
- Check 2
- Check 3

## Guidelines

Best practices for using this skill:

- Guideline 1
- Guideline 2
- Guideline 3

## References

Additional documentation available in this skill:

- [Technical Reference](references/REFERENCE.md) - Detailed technical documentation
- [API Documentation](references/API.md) - API reference
- [Templates](references/FORMS.md) - Form and template examples

## Scripts

Executable scripts included:

- `scripts/setup.sh` - Initial setup and configuration
- `scripts/execute.py` - Main execution script
- `scripts/validate.sh` - Validation and testing

## Assets

Templates and resources:

- `assets/template.json` - Configuration template
- `assets/diagram.png` - Architecture diagram
- `assets/schema.yaml` - Data schema

## Limitations

Known limitations of this skill:

- Limitation 1
- Limitation 2
- Limitation 3

## Version History

**v1.0.0** (2025-12-23)

- Initial release
- Features: [list key features]

---

*This skill follows the [Agent Skills specification](https://agentskills.io/specification)*

```

---

## 15. Key Takeaways

### 15.1 For Skill Authors

1. **Start Simple:** Minimum viable skill needs only `name`, `description`, and instructions
2. **Think Progressive:** Design for three-level loading (metadata → instructions → resources)
3. **Be Descriptive:** The `description` field is critical for skill discovery
4. **Stay Portable:** Follow the standard for maximum compatibility
5. **Validate:** Use `skills-ref validate` before deploying

### 15.2 For Agent Implementers

1. **Progressive Disclosure:** Load metadata first, instructions on activation, resources on demand
2. **Security First:** Implement sandboxing, confirmation, and logging for script execution
3. **Standard Compliance:** Follow the specification for ecosystem compatibility
4. **Flexible Locations:** Support both `.github/skills/` and `.claude/skills/`

### 15.3 For Organizations

1. **Version Control:** Skills are just files—check them into git
2. **Share Broadly:** Open standard enables sharing across teams and tools
3. **Iterate Rapidly:** Easy to edit and test
4. **Audit Trail:** All instructions are readable and reviewable

---

## 16. Additional Resources

### Official Documentation
- **Specification:** [agentskills.io/specification](https://agentskills.io/specification)
- **Overview:** [agentskills.io](https://agentskills.io)
- **Integration Guide:** [agentskills.io/integrate-skills](https://agentskills.io/integrate-skills)

### Reference Implementation
- **GitHub Repository:** [agentskills/agentskills](https://github.com/agentskills/agentskills)
- **Reference Library:** [agentskills/agentskills/skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref)

### Example Skills
- **Anthropic Examples:** [anthropics/skills](https://github.com/anthropics/skills)
- **Community Collection:** [github/awesome-copilot](https://github.com/github/awesome-copilot)

### Platform-Specific Guides
- **Claude:** [support.claude.com - Custom Skills](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
- **VS Code:** [code.visualstudio.com - Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- **Codex:** [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills/)
- **Cursor:** [cursor.com/docs/context/skills](https://cursor.com/docs/context/skills)

### Related Standards
- **Agent Skills Blog:** [Anthropic - Equipping agents for the real world](https://anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

---

## Appendix A: Field Validation Rules

### Name Field Validation
- **Pattern:** `^[a-z0-9]+(-[a-z0-9]+)*$`
- **Min Length:** 1
- **Max Length:** 64
- **Must Match:** Parent directory name

### Description Field Validation
- **Min Length:** 1
- **Max Length:** 1024
- **Must Include:** Both capabilities and trigger conditions

### Compatibility Field Validation
- **Min Length:** 1 (if provided)
- **Max Length:** 500
- **Optional:** Only include if needed

### License Field Validation
- **Format:** Free text or SPDX identifier
- **Recommendation:** Short reference

---

## Appendix B: Agent Skills vs Other Standards

| Feature | Agent Skills | Custom Instructions | MCP Servers |
|---------|-------------|-------------------|-------------|
| **Format** | Markdown + YAML | Markdown | JSON-RPC |
| **Scope** | Task-specific capabilities | Project-wide guidelines | Tool/resource providers |
| **Loading** | On-demand (progressive) | Always loaded | Connection-based |
| **Portability** | High (open standard) | Medium (platform-specific) | High (open standard) |
| **Content Type** | Instructions + scripts + assets | Instructions only | Tools + resources |
| **Standard Body** | agentskills.io | Platform-specific | modelcontextprotocol.io |

**Use Agent Skills when:** You need portable, task-specific capabilities with optional scripts/assets

**Use Custom Instructions when:** You need project-wide coding standards or conventions

**Use MCP Servers when:** You need to provide tools, resources, or external integrations

---

*Research compiled from official Agent Skills specification and platform documentation*
*Last Updated: 2025-12-23*
