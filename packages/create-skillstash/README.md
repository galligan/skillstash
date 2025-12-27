# create-skillstash

Scaffold a new Skillstash repo from the template.

```bash
bunx create-skillstash
```

By default the template remote is renamed to `upstream` so you can't accidentally push to it.

Create a GitHub repo automatically (requires `gh`):

```bash
bunx create-skillstash skillstash --create-repo --public
```

Create under an org or explicit owner:

```bash
bunx create-skillstash skillstash --create-repo acme/skillstash
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
--template <owner/repo|url>   Template repo (default: galligan/skillstash)
--marketplace <name>          Marketplace name (default: <username>-skillstash)
--owner-name <name>           Marketplace owner name (default: git user.name)
--owner-email <email>         Marketplace owner email (default: git user.email)
--origin <owner/repo|url>     Set origin remote (GitHub shorthand supported)
--create-repo [owner/repo]    Create GitHub repo via gh and set origin
--public                      Create GitHub repo as public (default)
--private                     Create GitHub repo as private
--default-agent <name>        Set default agent (claude | codex)
--setup-labels                Create default GitHub labels (requires gh)
--skip-label-setup            Skip label setup when creating a repo
--upstream                    Add upstream remote (default: true)
--no-upstream                 Remove template remote after clone
```
