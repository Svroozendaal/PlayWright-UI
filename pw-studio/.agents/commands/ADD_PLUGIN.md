# COMMAND: add-plugin

## Purpose

Guide the creation of a new shipped local plugin for PW Studio.

## Entry Criteria

- The plugin's purpose and the extension points it will use are defined.
- It is clear this behaviour is system-specific and does not belong in core.

## Workflow

1. **Architect** — confirm the plugin's extension points, manifest structure, and directory location (`plugins/<plugin-name>/`). Produce the file plan.
2. **Developer** — implement the plugin:
   - Follow `.agents/skills/plugin-system/SKILL.md` throughout.
   - Create the plugin directory under `plugins/`.
   - Write the plugin manifest.
   - Implement the declared extension points (recorder transforms, block definitions, templates, routes, UI metadata).
   - Keep plugin logic self-contained — do not reach into core internals beyond the defined extension points.
3. **Designer** — implement any UI metadata or block UI descriptors the plugin contributes.
4. **Tester** — write tests that:
   - Verify the plugin loads and validates its manifest.
   - Verify each extension point behaves correctly.
5. **Documenter** — document the plugin in a `README.md` inside the plugin directory.

## Exit Criteria

- Plugin loads cleanly with a valid manifest.
- All declared extension points are registered and tested.
- Plugin is self-contained with no core internals access.
- Plugin documented.

## Skill Suggestions

- `.agents/skills/plugin-system/SKILL.md` — mandatory
- `.agents/skills/block-editor/SKILL.md` — if the plugin contributes blocks or templates
- `.agents/skills/server-api/SKILL.md` — if the plugin adds routes
