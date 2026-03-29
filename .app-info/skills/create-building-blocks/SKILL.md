---
name: create-building-blocks
description: Create or update PW Studio visual building blocks, block templates, and plugin-backed block features. Use when adding a new block kind to the visual test editor, extending the block library, mapping new Playwright code patterns into blocks, or introducing plugin-specific blocks such as system helpers that still save back into normal Playwright code.
---

# Create Building Blocks

## Overview

Use this skill when PW Studio needs a new visual block in the test editor or block library. Follow the plugin-first path by default: add the block to a plugin unless the block is generic enough to belong in core.

## Workflow

1. Decide whether the block belongs in core or in a plugin.
2. Define the block contract: kind, fields, default title, display summary, and template defaults.
3. Implement server-side parse, render, and validation behaviour.
4. Ensure the block library exposes the block definition and template.
5. Ensure the renderer can edit the block fields and show a compact summary.
6. Validate that the saved `.spec.ts` remains the only runnable source of truth.

## Decision Rule

Put the block in core only when it is generic Playwright behaviour that should be available in every project.

Put the block in a plugin when any of these are true:

- it targets a specific platform or product
- it depends on helper functions or scaffolding
- it needs project-specific setup files
- it should only appear for projects where a plugin is enabled

## Required Touchpoints

Read `references/runtime-touchpoints.md` before editing.

At a minimum, check these files:

- `pw-studio/src/shared/types/ipc.ts`
- `pw-studio/src/server/plugins/runtime.ts`
- `pw-studio/src/server/plugins/core.ts`
- `pw-studio/src/server/services/BlockLibraryService.ts`
- `pw-studio/src/server/services/TestEditorService.ts`
- `pw-studio/src/server/utils/testEditorAst.ts`
- `pw-studio/src/renderer/src/components/TestBlockEditor.tsx`
- `pw-studio/src/renderer/src/pages/BlockLibraryPage.tsx`

## Implementation Rules

### 1. Keep Code As Truth

- The block must render back into normal Playwright or helper-call code.
- The saved file must still be what PW Studio runs.
- Do not introduce a separate runtime format for tests.

### 2. Register Definitions Through The Runtime

For each new block, define:

- `kind`
- `name`
- `description`
- `category`
- `defaultTitle`
- `fields`
- optional `display`
- `render(block)`
- optional `parseStatement(statement, title)`
- optional `validate(block)`

### 3. Add A Template

If users should be able to insert the block from the library, also register a `BlockTemplate` with:

- `id`
- `name`
- `description`
- `category`
- optional `pluginId`
- `block.kind`
- `block.values`
- optional compact `display`

### 4. Prefer Plugin Registration

For plugin blocks:

- register the block definition in the plugin `setup`
- register the template in the same plugin
- use `pluginId` so the block only appears for enabled projects
- add project setup hooks if helper files or config files are required

### 5. Make The Renderer Schema-Driven

Do not add renderer-side hardcoded switches unless absolutely necessary.

Prefer:

- field schemas from `BlockDefinition`
- compact summary from `display`
- `TestBlock.values` rather than block-specific object shapes

If renderer preview needs special formatting, keep it minimal and aligned with the server render behaviour.

## Validation Checklist

Always verify:

1. the block loads from existing code when `parseStatement` is implemented
2. the block saves back to valid code
3. the code still runs through the existing run pipeline unchanged
4. the block appears in the library only where expected
5. plugin blocks only appear for enabled projects
6. unsupported code still falls back to raw code blocks

Run:

```bash
cd pw-studio
npm run typecheck
npm run build
```

## Common Patterns

### Generic Core Block

Use this for common Playwright statements such as navigation, assertions, and simple actions.

Primary edit points:

- `src/server/plugins/core.ts`
- `src/renderer/src/components/TestBlockEditor.tsx`

### Plugin Helper Block

Use this for helper-driven code such as:

```ts
await mx.clickRowCell(page, { valueHint: 'Example', container: 'auto', confidence: 'high' });
```

Primary edit points:

- `plugins/<plugin-name>/index.mjs`
- optional plugin assets and scaffold files
- project setup hook registration

## Do Not

- do not make the block editor the execution source
- do not bypass the plugin runtime for plugin-specific blocks
- do not store per-project plugin state in SQLite
- do not hardcode a block to one project when it should be a plugin capability
