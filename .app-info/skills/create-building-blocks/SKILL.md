---
name: create-building-blocks
description: Create or update PW Studio visual building blocks, block templates, and plugin-backed block features. Use when adding a new block kind to the visual test editor, extending the block library, mapping new Playwright code patterns into blocks, or introducing plugin-specific blocks such as system helpers that still save back into normal Playwright code.
---

# Create Building Blocks

## Overview

Use this skill when PW Studio needs a new visual block in the test editor or block library. Every block has two sides: a **server side** (parse + render + validate in TypeScript) and a **renderer side** (field editing UI + code preview in React). Follow the plugin-first path by default unless the block is generic Playwright behaviour.

## Decision Rule

Put the block in **core** (`src/server/plugins/core.ts`) only when it is standard Playwright behaviour that should be available in every project.

Put the block in a **plugin** (`plugins/<plugin-name>/index.mjs`) when any of these are true:

- it targets a specific platform or product
- it depends on helper functions, imports, or scaffolding
- it needs project-specific setup files
- it should only appear for projects where the plugin is enabled

## Workflow

1. Decide: core or plugin.
2. Define the block contract (kind, fields, display, default title).
3. Implement `parseStatement` (or `parseLeadingStatements`) to read existing code.
4. Implement `render` to write code back.
5. Implement `validate` for user-facing field errors.
6. Register a `BlockTemplate` so users can insert it from the library.
7. Add the `set_checked`-style `case` to the renderer preview switch if the default schema-driven path is insufficient.
8. Verify round-trip: parse → edit → save → re-parse produces equivalent output.

---

## Complete Touchpoint Map

Read these files before editing. Each file has a specific responsibility.

| File | Responsibility |
|---|---|
| `pw-studio/src/shared/types/ipc.ts` | All shared contracts: `BlockDefinition`, `BlockTemplate`, `TestBlock`, `BlockFieldSchema`, `BlockDisplayConfig`, `SelectorValue` |
| `pw-studio/src/server/plugins/runtime.ts` | `ServerBlockDefinition` type, `ServerBlockContext`, `registerBlockDefinition`, `registerBlockTemplate`, `registerProjectSetup` |
| `pw-studio/src/server/plugins/core.ts` | Core block definitions and templates; helper functions `renderSelector`, `renderFlowString`, `renderTitleComment`, `readStringValue`, `readSelectorValue`, `parseSelectorExpression` |
| `pw-studio/src/server/utils/testEditorAst.ts` | Parse loop (`extractBlocksFromBody`), `parseTemplateExpression`, `stringifyFlowTemplate`, constants and locator extraction |
| `pw-studio/src/server/services/TestEditorService.ts` | Block caching, project-scoped definition lookup |
| `pw-studio/src/server/services/BlockLibraryService.ts` | Template visibility, plugin filtering, custom template validation |
| `pw-studio/src/renderer/src/components/TestBlockEditor.tsx` | Field rendering per type, code preview switch, `getSelectorValue`, `getStringValue` |
| `pw-studio/src/renderer/src/pages/BlockLibraryPage.tsx` | User-created template UI, display config in compact mode |
| `plugins/<name>/index.mjs` | Plugin block definition, template, recorder transform, project setup |

---

## Shared Type Reference

### `BlockDefinition` (shared contract)

```typescript
type BlockDefinition = {
  kind: string           // unique snake_case identifier, e.g. 'click_element'
  name: string           // UI display name, e.g. 'Click element'
  description: string    // one-line help text shown in the block library
  category: string       // grouping label, e.g. 'Actions', 'Assertions', 'Mendix'
  defaultTitle: string   // auto-assigned title when block is inserted
  builtIn: boolean       // true for core; false for plugin blocks
  pluginId?: string      // required for plugin blocks; omit for core
  fields: BlockFieldSchema[]
  display?: BlockDisplayConfig
}
```

### `ServerBlockDefinition` (server only — extends `BlockDefinition`)

```typescript
type ServerBlockDefinition = BlockDefinition & {
  parseLeadingStatements?: (
    statements: readonly ts.Statement[],
    sourceFile: ts.SourceFile
  ) => { block: TestBlock; consumedCount: number; locatorConstantNodes?: Map<string, ts.Node> } | null

  parseStatement?: (
    statement: ts.Statement,
    title: string | null,
    constants?: string[],
    locatorConstantNodes?: Map<string, ts.Node>
  ) => TestBlock | null

  render: (block: TestBlock, context: ServerBlockContext) => string

  validate?: (block: TestBlock, context: ServerBlockContext) => string[]
}
```

### `ServerBlockContext`

```typescript
type ServerBlockContext = {
  rootPath?: string
  documentFilePath?: string
  documentTestCaseRef?: TestCaseRef
  flowInputAccessor?: string       // default '__pwFlow'
  flowInputs?: FlowInputDefinition[]
  constants?: string[]             // names of declared const variables
}
```

### `TestBlock` (stored block shape)

```typescript
type TestBlock = {
  id: string
  title: string
  kind: string
  values: Record<string, BlockFieldValue>
}

type BlockFieldValue =
  | string
  | boolean
  | number
  | null
  | SelectorSpec
  | TestReferenceSpec
  | FlowInputMapping[]
```

### `BlockFieldSchema`

```typescript
type BlockFieldSchema = {
  key: string              // matches key in block.values
  label: string            // UI label text
  type: BlockFieldType     // see field types below
  required?: boolean
  placeholder?: string     // for text / textarea
  rows?: number            // for textarea (default 4)
  options?: BlockFieldOption[]  // for select
}

type BlockFieldOption = {
  label: string
  value: string
}
```

### `BlockDisplayConfig`

```typescript
type BlockDisplayConfig = {
  label: string
  detailSource: BlockDisplayValueSource
  quoteDetail?: boolean    // wrap detail in single quotes in summary
  hideTitle?: boolean
  separator?: ': ' | ' '
}

type BlockDisplayValueSource =
  | 'url'           // block.values['url']
  | 'value'         // block.values['value']
  | 'title'         // block.values['title']
  | 'text'          // block.values['text']
  | 'definitions'   // block.values['definitions']
  | 'selector.value' // block.values['selector'].value
  | 'selector.name'  // block.values['selector'].name (or varName if linked)
  | 'test.title'    // block.values['target'].testTitle
  | 'code'          // block.values['code']
```

### `SelectorSpec`

```typescript
type SelectorSpec = {
  strategy: 'role' | 'text' | 'label' | 'test_id' | 'placeholder' | 'css'
  value: string       // supports {{flowInput}} placeholders
  name?: string       // optional accessible name for role strategy
  varName?: string    // set when linked to a locator constant; render uses variable name only
}
```

---

## Field Types Reference

| Type | UI Component | `values` shape | Notes |
|---|---|---|---|
| `text` | `<input type="text">` | `string` | `{}` button to insert `{{flowInput}}` or `{{constant}}` placeholders |
| `textarea` | `<textarea>` | `string` | `rows` prop (default 4); same placeholder support as text |
| `select` | `<select>` | `string` | Requires `options` array; no placeholder support |
| `checkbox` | `<input type="checkbox">` | `boolean` | Simple true/false toggle |
| `selector` | Custom multi-part editor | `SelectorSpec` | Strategy picker + value input + optional link to locator constant via `varName` |
| `test_case` | Test selector + flow mapping | `TestReferenceSpec + FlowInputMapping[]` | Dropdown of available tests; per-input mapping controls for subflow inputs |
| `flow_mapping` | Embedded inside test_case | `FlowInputMapping[]` | Not a standalone field; always paired with test_case |

---

## Core Helper Functions (`core.ts`)

These are already imported/available in core. Plugin authors must reimplement equivalents.

### `readStringValue(block, key): string`
Safe string extraction from `block.values[key]`. Returns `''` if not a string.

### `readSelectorValue(block, key): SelectorSpec | null`
Safe extraction of a `SelectorSpec` object. Returns `null` if not valid.

### `renderSelector(selector, context): string`
Converts a `SelectorSpec` to Playwright code:
- If `selector.varName` is set → returns the bare variable name (ignores strategy/value).
- Otherwise → `page.getByRole('button', { name: 'Save' })` etc.
- All string parts are routed through `renderFlowString`.

### `renderFlowString(value, context): string`
Converts a template string (possibly containing `{{placeholders}}`) to JavaScript code:
- No placeholders and no constants → `'quoted string'`
- Entire value is `{{constantName}}` and constant exists → bare identifier `constantName`
- Mixed or flow input → `` `template ${__pwFlow.inputName}` `` or `` `${constantName}` ``

### `renderTitleComment(block): string`
Returns ` // Title Text` (with leading space). Sanitises whitespace. Append to end of rendered line.

### `parseSelectorExpression(expression, constants, locatorNodes): SelectorSpec | null`
Reads a Playwright locator call from an AST expression:
- Resolves identifier references via `locatorNodes` map (for `const x = page.getByRole(...)`)
- Handles: `page.getByRole`, `page.getByText`, `page.getByLabel`, `page.getByTestId`, `page.getByPlaceholder`, `page.locator`
- Returns `null` for unsupported patterns (causes statement to fall through to raw code)

### `parseTemplateExpression(node, accessorNames, knownIdentifiers): string | null`
Reads an AST expression representing a string value:
- `StringLiteral` → plain string
- `NoSubstitutionTemplateLiteral` → plain string
- `Identifier` matching a `knownIdentifier` (constant) → `{{constantName}}`
- `TemplateExpression` with spans matching `__pwFlow.name` or a known identifier → `{{name}}` segments
- Anything else → `null` (caller should fall back to raw code)

---

## `parseStatement` Implementation Guide

```typescript
parseStatement: (statement, title, constants = [], locatorConstantNodes = new Map()) => {
  // 1. Guard: must be an expression statement
  if (!ts.isExpressionStatement(statement)) return null

  // 2. Unwrap await
  const expression = ts.isAwaitExpression(statement.expression)
    ? statement.expression.expression
    : statement.expression

  // 3. Guard: must be a call expression
  if (!ts.isCallExpression(expression)) return null

  // 4. Guard: must be a property access with the expected method name
  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'expectedMethodName'
  ) return null

  // 5. Extract selector (if needed)
  const selector = parseSelectorExpression(
    expression.expression.expression,
    constants,
    locatorConstantNodes
  )
  if (!selector) return null

  // 6. Extract string arguments (if needed)
  const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
  if (value === null) return null

  // 7. Return the block
  return createParsedBlock('your_kind', title, { selector, value })
}
```

**Key rules:**
- Always return `null` if the statement does not match. Never throw.
- `title` is the trailing inline comment text, or `null`. Pass it through to `createParsedBlock`.
- `constants` lists declared const names from a preceding `constants_group` block. Pass to `parseSelectorExpression` and `parseTemplateExpression`.
- `locatorConstantNodes` maps constant names to their AST initialiser nodes. Pass to `parseSelectorExpression`.
- The first definition whose `parseStatement` returns non-null wins for that statement.

---

## `render` Implementation Guide

```typescript
render: (block, context) => {
  const sel = renderSelector(readSelectorValue(block, 'selector'), context)
  const value = renderFlowString(readStringValue(block, 'value'), context)
  return `await ${sel}.someMethod(${value});${renderTitleComment(block)}`
}
```

**Key rules:**
- Always use `renderSelector` for selector values, not manual string building.
- Always use `renderFlowString` for text values that may contain `{{placeholders}}`.
- Always append `renderTitleComment(block)` at the end.
- `context.constants` and `context.flowInputs` are available for runtime decisions.
- For plugin blocks without flow input support, use `escapeString` and build the string directly.

---

## `validate` Implementation Guide

```typescript
validate: (block, context) => {
  return [
    ...validateSelectorBlock(block, context.flowInputs),
    ...validateStringTemplates(
      [readStringValue(block, 'value')],
      context.flowInputs,
      context.constants
    ),
  ]
}
```

- `validateSelectorBlock(block, flowInputs)` — checks that the selector field is present and that any `{{placeholders}}` in selector values match known flow inputs.
- `validateStringTemplates(values, flowInputs, constants)` — checks that `{{placeholders}}` in string values match declared flow inputs or constants.
- Return an empty array if validation passes.
- Messages are shown inline in the block editor.

---

## `BlockTemplate` Registration

Every block that should appear in the library needs a template:

```typescript
{
  id: 'your-block-id',          // kebab-case, globally unique
  name: 'Your block name',
  description: 'One-line description shown in library.',
  category: 'Actions',          // must match the definition's category
  pluginId?: 'plugin-id',       // required for plugin templates; omit for core
  block: {
    kind: 'your_kind',
    values: {
      selector: createRoleSelector('button', 'Submit'),  // use helpers for defaults
      value: 'default text',
    },
  },
  display: {                    // same shape as definition display; can differ for compact view
    label: 'Your block',
    detailSource: 'value',
    quoteDetail: true,
    separator: ': ',
  },
}
```

Use `createRoleSelector(role, name)` for selector defaults. The template sets the initial values when a user inserts the block from the library.

---

## Frontend Preview (`TestBlockEditor.tsx`)

The renderer has a `renderBlockPreview(block, ...)` switch. Most blocks do not need a custom case because the schema-driven path handles field rendering. Add a case only when:

- the rendered output logic cannot be inferred from field values alone, OR
- the block combines multiple fields into a non-trivial code pattern.

```typescript
case 'your_kind': {
  const action = getStringValue(block.values['action'])
  const sel = sel(getSelectorValue(block.values['selector']))
  return `await ${sel}.${action}();${titleComment}`
}
```

Mirror the server `render` function exactly. The preview is client-only; the server render is the authoritative output.

---

## Legacy / Backwards-Compatible Blocks

When replacing two blocks with one unified block:

1. Add the new unified definition **before** the legacy ones in the definitions array.
2. Set the legacy `parseStatement` to `() => null` — they no longer parse new code.
3. Keep the legacy `render` intact — existing blocks in saved state still render.
4. Add legacy cases to the frontend preview switch for the same reason.
5. Add a comment marking them as legacy.

This ensures existing `.spec.ts` files continue to round-trip without migration.

---

## Plugin Block Implementation Guide

A plugin block lives in `plugins/<plugin-name>/index.mjs` and is registered via `ctx.runtime`:

```javascript
const plugin = {
  setup(ctx) {
    // Optional: scaffold project files on plugin enable
    ctx.runtime.registerProjectSetup(PLUGIN_ID, {
      onEnable: async (rootPath) => {
        scaffoldProject(rootPath, ctx.logger)
      },
    })

    // Optional: transform recorded code before it reaches the editor
    ctx.runtime.registerRecorderTransform({
      id: `${PLUGIN_ID}.my-transform`,
      name: 'My Transform',
      pluginId: PLUGIN_ID,
      transform: (input) => {
        // input: { rootPath, outputPath, content, startUrl, browser }
        // return: { content, testTitle?, appliedChanges?, suggestions? }
        return { content: transform(input.content) }
      },
    })

    // Register block definition
    ctx.runtime.registerBlockDefinition({
      kind: 'my_block',
      builtIn: false,
      pluginId: PLUGIN_ID,
      // ... all fields same as core
      parseStatement: (statement, title) => parseMyBlock(statement, title),
      render: (block) => renderMyBlock(block),
    })

    // Register block template
    ctx.runtime.registerBlockTemplate({
      id: 'my-block',
      pluginId: PLUGIN_ID,
      // ... all fields same as core templates
    })
  },
}

export default plugin
```

**Plugin-specific notes:**
- `pluginId` is **required** on both the definition and the template.
- Plugin blocks only appear for projects where the plugin is enabled.
- `parseStatement` in plugins does **not** receive `constants` or `locatorConstantNodes` — the signature accepts them but they are undefined unless you declare them in the function signature and handle accordingly.
- Plugin render functions do not have access to `renderSelector`, `renderFlowString`, etc. Implement equivalents locally or use simple string building with `escapeString`.
- Use `ctx.runtime.getProjectPluginConfig(rootPath, pluginId)` to read per-project plugin config.
- Use `ctx.runtime.saveProjectPluginConfig(rootPath, pluginId, config)` to write it.
- `ctx.logger.info(...)` is available for setup logging.

---

## `parseLeadingStatements` (advanced — multi-statement blocks)

Use this only for blocks that consume multiple consecutive statements (e.g., `constants_group`):

```typescript
parseLeadingStatements: (statements, sourceFile) => {
  // Try to consume as many statements as you need from the front
  // Return null if the pattern does not match at all
  return {
    block: { id: randomUUID(), title: '', kind: 'your_kind', values: { ... } },
    consumedCount: 3,                             // how many statements were consumed
    locatorConstantNodes: new Map([...]),         // optional: expose locator AST nodes
  }
}
```

- Only the **first** definition in the list with a matching `parseLeadingStatements` is tried, and only when no blocks have been emitted yet (leading position).
- If `locatorConstantNodes` is returned, subsequent `parseStatement` calls receive them.
- Extracted constant names from the block's `values['definitions']` string are also made available.

---

## Validation Checklist

Always verify:

1. `parseStatement` returns a block for the expected code patterns.
2. `render` produces valid TypeScript that Playwright can run.
3. `parse → render → re-parse` produces an equivalent block (round-trip stable).
4. The block appears in the library only for the expected projects.
5. Plugin blocks are invisible when the plugin is disabled.
6. Unrecognised statements still fall back to `raw_code` blocks.
7. Flow input placeholders round-trip correctly through `parseTemplateExpression` / `renderFlowString`.
8. The frontend preview matches the server render output.

Run after implementation:

```bash
cd pw-studio
npm run typecheck
npm run build
```

---

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Returning `null` for a valid statement | Block falls to raw code on load | Check guard conditions step by step |
| Not passing `constants` / `locatorConstantNodes` to `parseSelectorExpression` | Locator variable references silently fail | Always forward both parameters |
| Using string interpolation instead of `renderFlowString` | `{{placeholders}}` appear as literal text in saved code | Use `renderFlowString` for all user-entered text |
| Omitting `renderTitleComment(block)` | Block title comment lost on save, different on reload | Always append to end of rendered line |
| Setting `pluginId` on a core block | TypeScript error; core blocks must omit `pluginId` | Remove `pluginId` for core blocks |
| Two definitions both matching the same statement | First one in the array wins silently | Ensure guards are specific enough to avoid overlap |
| Frontend preview not matching server render | User sees different code than what is saved | Mirror server `render` logic exactly in the preview case |
| Not registering a `BlockTemplate` | Block kind exists but users cannot insert it from library | Always register a template with sensible defaults |
