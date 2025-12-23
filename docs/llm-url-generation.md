# LLM URL Generation

You can generate pre-filled issue URLs for the “Create Skill (with spec)” template to speed up requests.

## Example prompt

Ask your LLM to output a GitHub issue URL with these fields:

- `skill-name`
- `description`
- `sources`
- `research-depth`

## Manual example

Replace the placeholders and open the URL in your browser:

```text
https://github.com/<owner>/<repo>/issues/new?template=create-skill-with-spec.yml&title=skill:%20my-skill&skill-name=my-skill&description=Describe%20the%20skill&research-depth=Minimal%20(quick%20validation)
```

Add `sources` as a multi-line list if desired.
