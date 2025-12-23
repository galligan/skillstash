# create-skillstash

Scaffold a new Skillstash repo from the template.

```bash
bunx create-skillstash my-skillstash
```

By default the template remote is renamed to `upstream` so you can’t accidentally push to it.

Create a GitHub repo automatically (requires `gh`):

```bash
bunx create-skillstash my-skillstash --create-repo --public
```

Create under an org or explicit owner:

```bash
bunx create-skillstash my-skillstash --create-repo acme/skillstash
```

## Options

```text
--template <owner/repo|url>   Template repo (default: galligan/skillstash)
--marketplace <name>          Marketplace name (default: <dir> in kebab-case)
--owner-name <name>           Marketplace owner name (default: git user.name)
--owner-email <email>         Marketplace owner email (default: git user.email)
--origin <owner/repo|url>     Set origin remote (GitHub shorthand supported)
--create-repo [owner/repo]    Create GitHub repo via gh and set origin
--public                      Create GitHub repo as public (default)
--private                     Create GitHub repo as private
--default-agent <name>        Set default agent (claude | codex)
--upstream                    Add upstream remote (default: true)
--no-upstream                 Remove template remote after clone
```
