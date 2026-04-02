# SKILL: block-editor

## Purpose

Guide the correct implementation of visual block authoring features — block definitions, templates, the code round-trip, and new block kinds — in PW Studio.

## When to Use

- Adding a new visual block kind (a new statement type the editor can represent as a block).
- Adding or modifying block templates in the library.
- Modifying the code-to-block or block-to-code mapping logic.
- Working with constants blocks, parameters, subflows, or flow input definitions.

## Procedure

### Core Concepts

- The visual editor is an **authoring layer only** — it reads from and writes back to the `.spec.ts` source file.
- The `.spec.ts` file is always the source of truth for execution.
- Statements the editor cannot map to a block are kept as **raw code blocks** — they are preserved verbatim.
- The visual document is cached locally for faster reloads but is always regenerated from the source file when the file changes.

### Block Kinds

Each block kind maps to one or more Playwright API call patterns. A block kind definition must include:

1. A unique `kind` identifier string.
2. A code-to-block parser that recognises the statement pattern.
3. A block-to-code generator that produces valid Playwright TypeScript.
4. A UI descriptor (label, icon, configurable fields).

When adding a new block kind:
1. Define the kind in the block definitions module (`src/server/services/` block service or equivalent).
2. Register it with the block registry.
3. Add a default template to the block library if the kind has a common usage pattern.
4. Test the round-trip: source file → parse to blocks → save back to file → file content matches original.

### Special Block Features

| Feature | Description |
|---|---|
| Constants block | Groups `const` declarations at the top of the test body; validates syntax before saving |
| Parameters | Blocks may expose configurable input fields shown in the block UI |
| Subflows | Test blocks that invoke other tests (marked with `pw-studio-subflow:` prefix) and pass parameters |
| Flow input definitions | Declare what parameters a test accepts and how they map to variables |
| Flow input mapping | Configure which constants or block outputs feed into subflow inputs |

### Block Templates

- Block templates live in the global block library (file-backed in app data).
- Core templates are built into the app.
- Plugin-contributed templates are registered via the plugin extension point.
- Custom templates are stored per user in the app data directory.
- Projects only control which templates are **enabled** — they do not store the templates themselves.

### Code Round-Trip Rules

1. A round-trip (parse → edit → save → reparse) must produce the same block structure.
2. Never silently discard code that cannot be mapped — keep it as a raw code block.
3. Constant declarations at test scope must be preserved at the top of the test body.
4. The editor must not alter whitespace or comments outside the blocks it manages.

## Output / Expected Result

- A new block kind with a working parser, generator, and UI descriptor.
- A round-trip test confirming the code-to-block-to-code transformation is lossless.
- New templates registered in the block library.

## Notes

- Block definitions that are system-specific (e.g., Mendix-specific actions) belong in a plugin, not in core.
- The block editor must gracefully degrade when it encounters unsupported statements — the raw code block is the fallback.
