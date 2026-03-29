import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import ts from 'typescript'
import type { BlockTemplate, SelectorSpec, TestBlock, TestReferenceSpec } from '../../shared/types/ipc'
import { refineGeneratedCode } from '../services/CodegenRefiner'
import { parseTestSource } from '../utils/testEditorAst'
import type { PluginRuntimeService, ServerBlockDefinition } from './runtime'

const SUBFLOW_MARKER = 'pw-studio-subflow:'

export function registerCorePluginContributions(runtime: PluginRuntimeService): void {
  runtime.registerRecorderTransform({
    id: 'core.codegen-refiner',
    name: 'Core Codegen Refiner',
    transform: (input) => {
      const refined = refineGeneratedCode(input.content, {
        outputPath: input.outputPath,
        startUrl: input.startUrl,
        browser: input.browser,
      })

      return {
        content: refined.content,
        testTitle: refined.testTitle,
        appliedChanges: refined.appliedChanges,
        extractions: refined.extractions,
        suggestions: refined.suggestions,
      }
    },
  })

  for (const definition of coreBlockDefinitions) {
    runtime.registerBlockDefinition(definition)
  }

  for (const template of coreBlockTemplates) {
    runtime.registerBlockTemplate(template)
  }
}

const coreBlockDefinitions: ServerBlockDefinition[] = [
  {
    kind: 'goto_url',
    name: 'Go to URL',
    description: 'Navigate the page to a specific URL.',
    category: 'Navigation',
    defaultTitle: 'go to url',
    builtIn: true,
    fields: [
      { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com/' },
    ],
    display: { label: 'Go to URL', detailSource: 'url', separator: ': ' },
    parseStatement: (statement, title) => parseGotoBlock(statement, title),
    render: (block) => `await page.goto(${quoteString(readStringValue(block, 'url'))});${renderTitleComment(block)}`,
  },
  {
    kind: 'click_element',
    name: 'Click element',
    description: 'Click an element using a supported selector.',
    category: 'Actions',
    defaultTitle: 'click element',
    builtIn: true,
    fields: [{ key: 'selector', label: 'Selector', type: 'selector', required: true }],
    display: { label: 'Click element', detailSource: 'selector.name', quoteDetail: true, separator: ' ' },
    parseStatement: (statement, title) => parseClickBlock(statement, title),
    render: (block) => `await ${renderSelector(readSelectorValue(block, 'selector'))}.click();${renderTitleComment(block)}`,
  },
  {
    kind: 'fill_field',
    name: 'Fill field',
    description: 'Fill an input field using a supported selector.',
    category: 'Actions',
    defaultTitle: 'fill field',
    builtIn: true,
    fields: [
      { key: 'selector', label: 'Selector', type: 'selector', required: true },
      { key: 'value', label: 'Value', type: 'text', required: true },
    ],
    display: { label: 'Fill field', detailSource: 'selector.value', quoteDetail: true, separator: ': ' },
    parseStatement: (statement, title) => parseFillBlock(statement, title),
    render: (block) =>
      `await ${renderSelector(readSelectorValue(block, 'selector'))}.fill(${quoteString(readStringValue(block, 'value'))});${renderTitleComment(block)}`,
  },
  {
    kind: 'expect_url',
    name: 'Expect URL',
    description: 'Assert that the page has a specific URL.',
    category: 'Assertions',
    defaultTitle: 'expect url',
    builtIn: true,
    fields: [
      { key: 'url', label: 'Expected URL', type: 'text', required: true, placeholder: 'https://example.com/dashboard' },
    ],
    display: { label: 'Expect URL', detailSource: 'url', separator: ': ' },
    parseStatement: (statement, title) => parseExpectUrlBlock(statement, title),
    render: (block) => `await expect(page).toHaveURL(${quoteString(readStringValue(block, 'url'))});${renderTitleComment(block)}`,
  },
  {
    kind: 'use_subflow',
    name: 'Use subflow',
    description: 'Expand another indexed test into an inline test.step subflow.',
    category: 'Flows',
    defaultTitle: 'use subflow',
    builtIn: true,
    fields: [
      { key: 'target', label: 'Source test', type: 'test_case' },
      { key: 'stepTitle', label: 'Step label', type: 'text', placeholder: 'Run selected subflow' },
    ],
    display: { label: 'Use subflow', detailSource: 'test.title', separator: ': ' },
    parseStatement: (statement, title) => parseUseSubflowBlock(statement, title),
    render: (block, context) => renderUseSubflowBlock(block, context),
    validate: (block, context) => validateUseSubflowBlock(block, context),
  },
  {
    kind: 'raw_code',
    name: 'Raw code',
    description: 'Insert raw Playwright or TypeScript statements.',
    category: 'Advanced',
    defaultTitle: 'raw code',
    builtIn: true,
    fields: [{ key: 'code', label: 'Code', type: 'textarea', rows: 6 }],
    display: { label: 'Raw code', detailSource: 'code' },
    render: (block) => {
      const code = readStringValue(block, 'code')
      if (code.trim().length === 0) {
        return `// ${sanitiseTitle(block.title)}`
      }
      return `// ${sanitiseTitle(block.title)}\n${code}`
    },
    validate: (block) => validateRawCodeBlock(readStringValue(block, 'code')),
  },
]

const coreBlockTemplates: BlockTemplate[] = [
  {
    id: 'goto-url',
    name: 'Go to URL',
    description: 'Navigate the page to a specific URL.',
    category: 'Navigation',
    block: {
      kind: 'goto_url',
      values: { url: 'https://example.com/' },
    },
    display: { label: 'Go to URL', detailSource: 'url', separator: ': ' },
  },
  {
    id: 'click-link',
    name: 'Click element',
    description: 'Click a page element by role, text, label, test id, or CSS selector.',
    category: 'Actions',
    block: {
      kind: 'click_element',
      values: { selector: createRoleSelector('link', 'Example') },
    },
    display: { label: 'Click element', detailSource: 'selector.name', quoteDetail: true, separator: ' ' },
  },
  {
    id: 'fill-field',
    name: 'Fill field',
    description: 'Fill an input field through a supported selector strategy.',
    category: 'Actions',
    block: {
      kind: 'fill_field',
      values: { selector: createTextSelector('Email'), value: 'user@example.com' },
    },
    display: { label: 'Fill field', detailSource: 'selector.value', quoteDetail: true, separator: ': ' },
  },
  {
    id: 'expect-url',
    name: 'Expect URL',
    description: 'Assert that the browser is currently on a specific URL.',
    category: 'Assertions',
    block: {
      kind: 'expect_url',
      values: { url: 'https://example.com/dashboard' },
    },
    display: { label: 'Expect URL', detailSource: 'url', separator: ': ' },
  },
  {
    id: 'use-subflow',
    name: 'Use subflow',
    description: 'Reuse another indexed test as an inline test.step block.',
    category: 'Flows',
    block: {
      kind: 'use_subflow',
      values: { target: null, stepTitle: 'Run selected subflow' },
    },
    display: { label: 'Use subflow', detailSource: 'test.title', separator: ': ' },
  },
  {
    id: 'raw-code',
    name: 'Raw code',
    description: 'Insert plain Playwright or TypeScript statements when no visual block exists yet.',
    category: 'Advanced',
    block: {
      kind: 'raw_code',
      values: { code: "await expect(page.getByText('Done')).toBeVisible();" },
    },
    display: { label: 'Raw code', detailSource: 'code' },
  },
]

function parseGotoBlock(statement: ts.Statement, title: string | null): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'goto' ||
    !ts.isIdentifier(expression.expression.expression) ||
    expression.expression.expression.text !== 'page'
  ) {
    return null
  }

  const url = getStringArgument(expression.arguments[0])
  if (url === null) return null

  return createParsedBlock('goto_url', title, { url })
}

function parseClickBlock(statement: ts.Statement, title: string | null): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'click') return null
  const selector = parseSelectorExpression(expression.expression.expression)
  if (!selector) return null
  return createParsedBlock('click_element', title, { selector })
}

function parseFillBlock(statement: ts.Statement, title: string | null): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'fill') return null
  const selector = parseSelectorExpression(expression.expression.expression)
  const value = getStringArgument(expression.arguments[0])
  if (!selector || value === null) return null
  return createParsedBlock('fill_field', title, { selector, value })
}

function parseExpectUrlBlock(statement: ts.Statement, title: string | null): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'toHaveURL') return null
  const target = expression.expression.expression
  if (!ts.isCallExpression(target) || !ts.isIdentifier(target.expression) || target.expression.text !== 'expect') return null
  const actual = target.arguments[0]
  if (!actual || !ts.isIdentifier(actual) || actual.text !== 'page') return null
  const url = getStringArgument(expression.arguments[0])
  if (url === null) return null
  return createParsedBlock('expect_url', title, { url })
}

function parseUseSubflowBlock(statement: ts.Statement, title: string | null): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'step' ||
    !ts.isIdentifier(expression.expression.expression) ||
    expression.expression.expression.text !== 'test'
  ) {
    return null
  }

  const stepTitle = getStringArgument(expression.arguments[0])
  const callbackBody = getInlineCallbackBody(expression.arguments[1])
  if (!stepTitle || !callbackBody) {
    return null
  }

  const target = parseSubflowMetadata(callbackBody)
  if (!target) {
    return null
  }

  return createParsedBlock('use_subflow', title, { target, stepTitle })
}

function unwrapAwait(expression: ts.Expression): ts.Expression {
  return ts.isAwaitExpression(expression) ? expression.expression : expression
}

function parseSelectorExpression(expression: ts.Expression): SelectorSpec | null {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return null
  }

  const property = expression.expression.name.text
  const owner = expression.expression.expression
  if (!ts.isIdentifier(owner) || owner.text !== 'page') {
    return null
  }

  switch (property) {
    case 'getByRole': {
      const role = getStringArgument(expression.arguments[0])
      if (role === null) return null
      return { strategy: 'role', value: role, name: getRoleNameOption(expression.arguments[1]) ?? undefined }
    }
    case 'getByText': {
      const value = getStringArgument(expression.arguments[0])
      return value === null ? null : { strategy: 'text', value }
    }
    case 'getByLabel': {
      const value = getStringArgument(expression.arguments[0])
      return value === null ? null : { strategy: 'label', value }
    }
    case 'getByTestId': {
      const value = getStringArgument(expression.arguments[0])
      return value === null ? null : { strategy: 'test_id', value }
    }
    case 'locator': {
      const value = getStringArgument(expression.arguments[0])
      return value === null ? null : { strategy: 'css', value }
    }
    default:
      return null
  }
}

function getRoleNameOption(node: ts.Expression | undefined): string | null {
  if (!node || !ts.isObjectLiteralExpression(node)) return null
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'name') {
      return getStringArgument(property.initializer)
    }
  }
  return null
}

function getStringArgument(node: ts.Node | undefined): string | null {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  return null
}

function getInlineCallbackBody(node: ts.Node | undefined): ts.Block | null {
  if (!node) {
    return null
  }

  if (ts.isArrowFunction(node) && ts.isBlock(node.body)) {
    return node.body
  }

  if (ts.isFunctionExpression(node) && node.body) {
    return node.body
  }

  return null
}

function parseSubflowMetadata(body: ts.Block): TestReferenceSpec | null {
  const sourceFile = body.getSourceFile()
  const sourceText = sourceFile.text
  const leading = sourceText.slice(body.getStart(sourceFile) + 1, body.statements[0]?.getStart(sourceFile) ?? body.end - 1)

  for (const line of leading.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.trim().match(/^\/\/\s*pw-studio-subflow:\s*(.+)$/)
    if (!match?.[1]) {
      continue
    }

    try {
      const parsed = JSON.parse(match[1]) as Partial<TestReferenceSpec>
      if (
        typeof parsed.filePath === 'string' &&
        typeof parsed.ordinal === 'number' &&
        typeof parsed.testTitle === 'string'
      ) {
        return {
          filePath: parsed.filePath,
          ordinal: parsed.ordinal,
          testTitle: parsed.testTitle,
        }
      }
    } catch {
      return null
    }
  }

  return null
}

function createParsedBlock(kind: string, title: string | null, values: TestBlock['values']): TestBlock {
  return {
    id: randomUUID(),
    title: title ?? '',
    kind,
    values,
  }
}

function renderSelector(selector: SelectorSpec): string {
  switch (selector.strategy) {
    case 'role':
      if (selector.name && selector.name.trim().length > 0) {
        return `page.getByRole(${quoteString(selector.value)}, { name: ${quoteString(selector.name)} })`
      }
      return `page.getByRole(${quoteString(selector.value)})`
    case 'text':
      return `page.getByText(${quoteString(selector.value)})`
    case 'label':
      return `page.getByLabel(${quoteString(selector.value)})`
    case 'test_id':
      return `page.getByTestId(${quoteString(selector.value)})`
    case 'css':
      return `page.locator(${quoteString(selector.value)})`
  }
}

function renderUseSubflowBlock(
  block: TestBlock,
  context: { rootPath?: string }
): string {
  const target = readTestReferenceValue(block, 'target')
  const metadata = target ? JSON.stringify(target) : JSON.stringify({ filePath: '', ordinal: 0, testTitle: '' })
  const stepTitle = readStringValue(block, 'stepTitle').trim() || target?.testTitle || 'Run subflow'
  const body = target && context.rootPath
    ? loadReferencedSubflowBody(context.rootPath, target)
    : '// Select a source test to expand this subflow.'

  const lines = [
    `await test.step(${quoteString(stepTitle)}, async () => {`,
    `  // ${SUBFLOW_MARKER} ${metadata}`,
    ...body.replace(/\r\n/g, '\n').split('\n').map((line) => `  ${line}`),
    `});${renderTitleComment(block)}`,
  ]

  return lines.join('\n')
}

function readStringValue(block: TestBlock, key: string): string {
  const value = block.values[key]
  return typeof value === 'string' ? value : ''
}

function readSelectorValue(block: TestBlock, key: string): SelectorSpec {
  const value = block.values[key]
  if (value && typeof value === 'object' && 'strategy' in value && 'value' in value) {
    return value as SelectorSpec
  }
  return { strategy: 'css', value: '' }
}

function readTestReferenceValue(block: TestBlock, key: string): TestReferenceSpec | null {
  const value = block.values[key]
  if (
    value &&
    typeof value === 'object' &&
    'filePath' in value &&
    'ordinal' in value &&
    'testTitle' in value &&
    typeof value.filePath === 'string' &&
    typeof value.ordinal === 'number' &&
    typeof value.testTitle === 'string'
  ) {
    return value as TestReferenceSpec
  }

  return null
}

function renderTitleComment(block: TestBlock): string {
  return ` // ${sanitiseTitle(block.title)}`
}

function sanitiseTitle(title: string): string {
  return title.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function quoteString(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`
}

function validateRawCodeBlock(code: string): string[] {
  const wrapped = `async function __pwStudioRaw() {\n${code}\n}\n`
  const sourceFile = ts.createSourceFile('__pwstudio_raw.ts', wrapped, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const diagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? []
  return diagnostics.map((diagnostic) => {
    const start = diagnostic.start ?? 0
    const position = sourceFile.getLineAndCharacterOfPosition(start)
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    return `Line ${position.line + 1}, column ${position.character + 1}: ${message}`
  })
}

function validateUseSubflowBlock(
  block: TestBlock,
  context: { rootPath?: string; documentFilePath?: string; documentTestCaseRef?: { ordinal: number } }
): string[] {
  const errors: string[] = []
  const target = readTestReferenceValue(block, 'target')

  if (!target || target.filePath.trim().length === 0 || target.testTitle.trim().length === 0) {
    errors.push('Use subflow block requires a source test selection.')
    return errors
  }

  if (!context.rootPath) {
    return errors
  }

  const currentRelativePath =
    context.documentFilePath && context.rootPath
      ? path.relative(context.rootPath, path.resolve(context.rootPath, context.documentFilePath)).replace(/\\/g, '/')
      : null

  if (currentRelativePath === target.filePath.replace(/\\/g, '/') && context.documentTestCaseRef?.ordinal === target.ordinal) {
    errors.push('A subflow block cannot reference the current test.')
  }

  const absoluteTarget = path.resolve(context.rootPath, target.filePath)
  if (!fs.existsSync(absoluteTarget)) {
    errors.push(`Referenced subflow test file not found: ${target.filePath}`)
    return errors
  }

  const parsed = parseTestSource(fs.readFileSync(absoluteTarget, 'utf8'), absoluteTarget)
  const found = parsed.testCases.find((testCase) => testCase.ordinal === target.ordinal)
  if (!found) {
    errors.push(`Referenced subflow test not found: ${target.testTitle}`)
  }

  return errors
}

function loadReferencedSubflowBody(rootPath: string, target: TestReferenceSpec): string {
  const absoluteTarget = path.resolve(rootPath, target.filePath)
  if (!fs.existsSync(absoluteTarget)) {
    return `// Referenced subflow file not found: ${target.filePath}`
  }

  const source = fs.readFileSync(absoluteTarget, 'utf8')
  const parsed = parseTestSource(source, absoluteTarget)
  const found = parsed.testCases.find((testCase) => testCase.ordinal === target.ordinal)
  if (!found) {
    return `// Referenced subflow test not found: ${target.testTitle}`
  }

  const bodyText = source.slice(found.body.getStart(found.body.getSourceFile()) + 1, found.body.end - 1)
  const normalised = normaliseNestedBody(bodyText)
  return normalised.trim().length > 0 ? normalised : '// Referenced subflow is empty.'
}

function normaliseNestedBody(value: string): string {
  const normalised = value.replace(/\r\n/g, '\n')
  const lines = normalised.split('\n')

  while (lines.length > 0 && lines[0]?.trim() === '') {
    lines.shift()
  }

  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop()
  }

  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0)

  const minIndent = indents.length > 0 ? Math.min(...indents) : 0
  return lines.map((line) => line.slice(Math.min(minIndent, line.length))).join('\n')
}

function createRoleSelector(role: string, name: string): SelectorSpec {
  return { strategy: 'role', value: role, name }
}

function createTextSelector(value: string): SelectorSpec {
  return { strategy: 'text', value }
}
