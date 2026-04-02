# SKILL: block-editor

## Purpose

Guide the use of the PW Studio visual block editor to author and modify Playwright tests as blocks, and to manage block templates in the Block Library.

## When to Use

- Authoring or editing tests using the visual block editor instead of the code editor.
- Adding a reusable block template to the Block Library.
- Working with constants, parameters, or subflows in a test.
- Understanding what the visual editor can and cannot represent.

## Core Concept

The block editor is an **authoring layer** only. It reads from and writes back to the `.spec.ts` source file. The file is always the source of truth — the block view and code view represent the same content.

Supported Playwright statements are shown as typed blocks. Statements the editor cannot map appear as **raw code blocks** — they are preserved verbatim and are still fully editable in the code view.

## Procedure

### Editing Tests as Blocks

1. Open a `.spec.ts` file in the Explorer.
2. Switch to the visual block editor view.
3. Each `test()` function in the file is shown as a sequence of blocks.
4. Click a block to configure its fields.
5. Drag blocks to reorder steps.
6. Delete blocks to remove steps.
7. Save — changes write back to the `.spec.ts` file immediately.

### Block Features

| Feature | What it does |
|---|---|
| **Constants block** | Groups `const` declarations at the top of the test body; validates syntax before saving |
| **Parameters** | Makes a block's fields configurable when the block is saved as a reusable template |
| **Subflow** | Invokes another test (prefixed `pw-studio-subflow:`) and passes parameters to it |
| **Flow input definitions** | Declares what parameters a test accepts from a calling subflow |
| **Flow input mapping** | Wires constants or block outputs into a subflow's input parameters |

### Adding a Template to the Block Library

1. Configure a block with the desired fields and values.
2. Save it as a template from the block context menu.
3. The template appears in the Block Library and can be inserted into any test in the project (subject to project enablement).
4. To make a template available across all projects, ensure it is saved to the global block library (not project-scoped).

### Managing the Block Library

- Open the Block Library page to view, edit, or delete templates.
- Core templates and plugin-contributed templates are read-only — only custom templates can be edited.
- Per-project availability is controlled on the Block Library page — enable or disable specific templates for a project.

## Notes

- The code view and block view are always in sync — switching between them does not lose any content.
- Raw code blocks (unsupported statements) are never altered by the block editor — they pass through unchanged.
- Plugin-contributed block kinds and templates appear automatically when the plugin is enabled for the project.
