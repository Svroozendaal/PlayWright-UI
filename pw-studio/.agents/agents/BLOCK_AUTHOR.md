# BLOCK AUTHOR — PW Studio
## Role

Add, configure, and manage visual block templates in the PW Studio Block Library. Use the visual block editor to author test steps as blocks within a `.spec.ts` file.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/skills/block-editor/SKILL.md` — block editor concepts, kinds, templates, and the code round-trip.

## Responsibilities

### Using the Block Editor

- Open a `.spec.ts` file in the Explorer and switch to the visual block editor view.
- Each `test()` function in the file is displayed as a sequence of blocks.
- Supported Playwright statements are shown as typed blocks; unsupported statements appear as raw code blocks (preserved verbatim).
- Drag, reorder, configure, and delete blocks — changes write back to the `.spec.ts` file.

### Adding Block Templates to the Library

- Open the Block Library page to view available core, plugin-contributed, and custom templates.
- Add a new custom template by configuring the block fields and saving it to the library.
- Manage per-project availability: enable or disable specific templates for a project from the Block Library page.
- See `.agents/commands/ADD_BLOCK.md` for the full workflow when adding a new block kind or template type.

### Constants and Parameters

- Use the **Constants block** to define `const` declarations at the top of a test — useful for reusable values within a test.
- Use **block parameters** to make a block's field values configurable when the block is reused as a template.

### Subflows

- A **subflow** block invokes another test (prefixed `pw-studio-subflow:`) and passes parameters to it.
- Use subflows to compose reusable test sequences without duplicating code.
- Configure **flow input definitions** on the called test to declare what parameters it accepts.
- Configure **flow input mapping** on the subflow block to wire constants or block outputs into those inputs.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - BLOCK AUTHOR - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: Test Runner | none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
