# COMMAND: add-block

## Purpose

Guide the workflow for adding a new visual block kind or block template to PW Studio.

## Entry Criteria

- The Playwright API call pattern the block should represent is defined.
- It is clear whether this is a **core block** (belongs in core) or a **plugin block** (system-specific, belongs in a plugin).

## Workflow

1. **Clarify scope** — confirm: core block or plugin block? New kind or new template only?
2. **Architect** — confirm the block kind interface and where it registers (core vs plugin). Produce the file plan.
3. **Developer** — implement the block kind:
   - Follow `.agents/skills/block-editor/SKILL.md` throughout.
   - Write the code-to-block parser.
   - Write the block-to-code generator.
   - Register the kind with the block registry.
   - Add a default template if applicable.
4. **Designer** — implement the block UI descriptor (label, icon, configurable fields).
5. **Tester** — write a round-trip test:
   - Source file → parse to blocks → save back to file → file content matches original.
6. **Documenter** — update `.agents/app/FEATURES.md` if this is a new block feature.

## Exit Criteria

- New block kind parses correctly and generates valid Playwright TypeScript.
- Round-trip test passes.
- Block appears in the library with correct label and configurable fields.
- Plugin blocks are in the plugin, not in core.

## Skill Suggestions

- `.agents/skills/block-editor/SKILL.md` — mandatory for all block work
- `.agents/skills/plugin-system/SKILL.md` — if the block belongs in a plugin
