# create-skillstash

Scaffold a new Skillstash repo from the bundled template.

```bash
bunx create-skillstash
```

By default the bundled template is used (no clone) and the Skillstash repo is added as `upstream`. To force a remote template, pass a full URL.

Create a GitHub repo automatically (requires `gh`):

```bash
bunx create-skillstash skillstash --create-repo --public
```

Create under an org or explicit owner:

```bash
bunx create-skillstash skillstash --create-repo acme/skillstash
```

Use a local template:

```bash
bunx create-skillstash skillstash --template ../path/to/template
```

Set up GitHub labels (requires `gh` and a repo URL). When you use `--create-repo`, labels are set up by default.

```bash
bunx create-skillstash skillstash --create-repo
bunx create-skillstash skillstash --create-repo --skip-label-setup
```

## Naming Convention

| Item        | Default                  | Example               |
| ----------- | ------------------------ | --------------------- |
| Directory   | `skillstash`             | `skillstash/`         |
| Marketplace | `<username>-skillstash`  | `galligan-skillstash` |
| Plugin      | `my-skills`              | `my-skills`           |

The marketplace name is derived from your GitHub username (via `gh`) or git user.name.

## Options

```text
--template <owner/repo|url>   Template source (owner/repo, URL, or local path)
--marketplace <name>          Marketplace name (default: <username>-skillstash)
--owner-name <name>           Marketplace owner name (default: git user.name)
--origin <owner/repo|url>     Set origin remote (GitHub shorthand supported)
--create-repo [owner/repo]    Create GitHub repo via gh and set origin
--public                      Create GitHub repo as public (default)
--private                     Create GitHub repo as private
--default-agent <name>        Set default agent (claude | codex)
--setup-labels                Create default GitHub labels (requires gh)
--skip-label-setup            Skip label setup when creating a repo
--upstream                    Add upstream remote (default: true)
--no-upstream                 Remove upstream remote after setup
```
