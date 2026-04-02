# COMMAND: add-block

## Purpose

Add a new reusable block template to the PW Studio Block Library so it can be inserted into tests via the visual block editor.

## Entry Criteria

- The Playwright action or step the block should represent is clear.
- It is known whether this is a **custom template** (saved by the user) or a **plugin-contributed template** (part of a plugin).

## Workflow

### Option A — Custom Template (no plugin required)

1. Open a `.spec.ts` file in the Explorer and switch to the visual block editor.
2. Build the test step using existing block kinds — configure all fields to the desired defaults.
3. Use the block context menu → **Save as template**.
4. Give the template a clear, descriptive name.
5. Open the Block Library page and confirm the template appears.
6. Enable the template for the relevant project(s) from the Block Library page.

### Option B — Plugin-Contributed Template

Use this when the block represents a system-specific action (e.g., a Mendix widget interaction) that belongs in a plugin rather than the core library.

1. Confirm a plugin exists that should own this template, or invoke **Plugin Manager** to set one up first.
2. See `.agents/commands/ADD_PLUGIN.md` for the plugin creation workflow.
3. Once the plugin is enabled for the project, the template appears automatically in the Block Library.

## Exit Criteria

- The template appears in the Block Library.
- The template can be inserted into a test via the visual block editor.
- The template is enabled for the intended project(s).

## Skill References

- `.agents/skills/block-editor/SKILL.md` — block editor concepts and template management
- `.agents/skills/plugin-system/SKILL.md` — if the template belongs in a plugin
