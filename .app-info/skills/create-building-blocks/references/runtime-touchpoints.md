# Runtime Touchpoints

Use this reference when adding a new PW Studio block.

## Shared Contracts

`pw-studio/src/shared/types/ipc.ts`

Check:

- `BlockDefinition`
- `BlockTemplate`
- `TestBlock`
- `TestBlockTemplate`
- `BlockFieldSchema`
- `BlockDisplayConfig`

## Runtime Registry

`pw-studio/src/server/plugins/runtime.ts`

Check:

- block definition registration
- block template registration
- plugin enablement behaviour
- project setup hooks

## Core Block Registration

`pw-studio/src/server/plugins/core.ts`

Use when the block is generic enough to be built into PW Studio for every project.

## Plugin Block Registration

`pw-studio/plugins/<plugin>/index.mjs`

Use when the block is platform-specific or depends on helper code, config files, or project scaffolding.

## Server-Side Editor Flow

`pw-studio/src/server/utils/testEditorAst.ts`

Confirm:

- parse path still falls back to raw code for unsupported statements
- render path produces valid code
- validation only blocks invalid raw or invalid structured values

`pw-studio/src/server/services/TestEditorService.ts`

Confirm:

- block caching still works
- project-enabled block definitions are used

## Block Library

`pw-studio/src/server/services/BlockLibraryService.ts`

Confirm:

- templates are visible globally when appropriate
- plugin templates are filtered by project enablement
- custom templates validate against the block definition schema

## Renderer

`pw-studio/src/renderer/src/components/TestBlockEditor.tsx`

Confirm:

- the block fields render from the schema
- compact display is sensible
- code preview still matches the saved server-side render

`pw-studio/src/renderer/src/pages/BlockLibraryPage.tsx`

Confirm:

- users can create a template for the new block
- display configuration makes sense for compact mode

## Final Check

After implementation:

1. create or load a test with the new block
2. save it back to code
3. reload the editor
4. run the test normally
