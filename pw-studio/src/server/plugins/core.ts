import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import ts from 'typescript'
import type {
  BlockTemplate,
  FlowInputDefinition,
  FlowInputMapping,
  SelectorSpec,
  TestBlock,
  TestReferenceSpec,
} from '../../shared/types/ipc'
import { refineGeneratedCode } from '../services/CodegenRefiner'
import {
  buildDocumentFromParsedTest,
  parseSnippetToDocument,
  parseTemplateExpression,
  parseTestSource,
  renderBlocksOnly,
  stringifyFlowTemplate,
  validateFlowTemplate,
} from '../utils/testEditorAst'
import type { PluginRuntimeService, ServerBlockContext, ServerBlockDefinition } from './runtime'

const SUBFLOW_MARKER = 'pw-studio-subflow:'
const SUBFLOW_INPUT_NAME = '__pwSubflow'
const SUBFLOW_DEFAULTS_NAME = '__pwSubflowDefaults'

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
    kind: 'constants_group',
    name: 'Constants',
    description: 'A grouped block for leading const declarations at the top of the test body.',
    category: 'Setup',
    defaultTitle: 'constants',
    builtIn: true,
    fields: [{ key: 'definitions', label: 'Constant definitions', type: 'textarea', rows: 6 }],
    display: { label: 'Constants', detailSource: 'definitions', separator: ': ' },
    parseLeadingStatements: (statements, sourceFile) => parseConstantsGroup(statements, sourceFile),
    render: (block) => readDefinitionsValue(block).trim(),
    validate: (block) => validateConstantsGroupBlock(readDefinitionsValue(block)),
  },
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
    parseStatement: (statement, title, constants) => parseGotoBlock(statement, title, constants),
    render: (block, context) => `await page.goto(${renderFlowString(readStringValue(block, 'url'), context)});${renderTitleComment(block)}`,
    validate: (block, context) => validateStringTemplates([readStringValue(block, 'url')], context.flowInputs, context.constants),
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
    parseStatement: (statement, title, constants) => parseClickBlock(statement, title, constants),
    render: (block, context) => `await ${renderSelector(readSelectorValue(block, 'selector'), context)}.click();${renderTitleComment(block)}`,
    validate: (block, context) => validateSelectorBlock(block, context.flowInputs),
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
    parseStatement: (statement, title, constants) => parseFillBlock(statement, title, constants),
    render: (block, context) =>
      `await ${renderSelector(readSelectorValue(block, 'selector'), context)}.fill(${renderFlowString(readStringValue(block, 'value'), context)});${renderTitleComment(block)}`,
    validate: (block, context) => [
      ...validateSelectorBlock(block, context.flowInputs),
      ...validateStringTemplates([readStringValue(block, 'value')], context.flowInputs, context.constants),
    ],
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
    parseStatement: (statement, title, constants) => parseExpectUrlBlock(statement, title, constants),
    render: (block, context) => `await expect(page).toHaveURL(${renderFlowString(readStringValue(block, 'url'), context)});${renderTitleComment(block)}`,
    validate: (block, context) => validateStringTemplates([readStringValue(block, 'url')], context.flowInputs, context.constants),
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
      { key: 'inputMappings', label: 'Input mappings', type: 'flow_mapping' },
    ],
    display: { label: 'Use subflow', detailSource: 'test.title', separator: ': ' },
    parseStatement: (statement, title) => parseUseSubflowBlock(statement, title),
    render: (block, context) => renderUseSubflowBlock(block, context),
    validate: (block, context) => validateUseSubflowBlock(block, context),
  },
  {
    kind: 'expect_visible',
    name: 'Expect visible',
    description: 'Assert that an element is visible on the page.',
    category: 'Assertions',
    defaultTitle: 'expect visible',
    builtIn: true,
    fields: [{ key: 'selector', label: 'Selector', type: 'selector', required: true }],
    display: { label: 'Expect visible', detailSource: 'selector.name', quoteDetail: true, separator: ' ' },
    parseStatement: (statement, title, constants) => parseExpectVisibleBlock(statement, title, constants),
    render: (block, context) => `await expect(${renderSelector(readSelectorValue(block, 'selector'), context)}).toBeVisible();${renderTitleComment(block)}`,
    validate: (block, context) => validateSelectorBlock(block, context.flowInputs),
  },
  {
    kind: 'press_key',
    name: 'Press key',
    description: 'Press a keyboard key on an element.',
    category: 'Actions',
    defaultTitle: 'press key',
    builtIn: true,
    fields: [
      { key: 'selector', label: 'Selector', type: 'selector', required: true },
      { key: 'key', label: 'Key', type: 'text', required: true, placeholder: 'Enter' },
    ],
    display: { label: 'Press key', detailSource: 'value', quoteDetail: true, separator: ': ' },
    parseStatement: (statement, title, constants) => parsePressKeyBlock(statement, title, constants),
    render: (block, context) =>
      `await ${renderSelector(readSelectorValue(block, 'selector'), context)}.press(${renderFlowString(readStringValue(block, 'key'), context)});${renderTitleComment(block)}`,
    validate: (block, context) => [
      ...validateSelectorBlock(block, context.flowInputs),
      ...validateStringTemplates([readStringValue(block, 'key')], context.flowInputs, context.constants),
    ],
  },
  {
    kind: 'select_option',
    name: 'Select option',
    description: 'Select an option from a dropdown element.',
    category: 'Actions',
    defaultTitle: 'select option',
    builtIn: true,
    fields: [
      { key: 'selector', label: 'Selector', type: 'selector', required: true },
      { key: 'value', label: 'Option value', type: 'text', required: true, placeholder: 'option-value' },
    ],
    display: { label: 'Select option', detailSource: 'value', quoteDetail: true, separator: ': ' },
    parseStatement: (statement, title, constants) => parseSelectOptionBlock(statement, title, constants),
    render: (block, context) =>
      `await ${renderSelector(readSelectorValue(block, 'selector'), context)}.selectOption(${renderFlowString(readStringValue(block, 'value'), context)});${renderTitleComment(block)}`,
    validate: (block, context) => [
      ...validateSelectorBlock(block, context.flowInputs),
      ...validateStringTemplates([readStringValue(block, 'value')], context.flowInputs, context.constants),
    ],
  },
  {
    kind: 'raw_code',
    name: 'Raw code',
    description: 'Insert raw Playwright or TypeScript statements.',
    category: 'Advanced',
    defaultTitle: 'raw code',
    builtIn: true,
    fields: [{ key: 'code', label: 'Code', type: 'textarea', rows: 1 }],
    display: { label: 'Raw code', detailSource: 'code' },
    render: (block) => {
      const code = readStringValue(block, 'code')
      if (code.trim().length === 0) {
        return `// ${sanitiseTitle(block.title)}`
      }
      return `// ${sanitiseTitle(block.title)}\n${code}\n`
    },
    validate: (block) => validateRawCodeBlock(readStringValue(block, 'code')),
  },
]

const coreBlockTemplates: BlockTemplate[] = [
  {
    id: 'constants-group',
    name: 'Constants',
    description: 'Group leading const declarations into a single setup step.',
    category: 'Setup',
    block: {
      kind: 'constants_group',
      values: {
        definitions: "const enterKey = 'Enter';\nconst defaultName = 'Simon';",
      },
    },
    display: { label: 'Constants', detailSource: 'definitions', separator: ': ' },
  },
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
      values: { target: null, stepTitle: 'Run selected subflow', inputMappings: [] },
    },
    display: { label: 'Use subflow', detailSource: 'test.title', separator: ': ' },
  },
  {
    id: 'expect-visible',
    name: 'Expect visible',
    description: 'Assert that an element is visible on the page.',
    category: 'Assertions',
    block: {
      kind: 'expect_visible',
      values: { selector: createRoleSelector('heading', 'Page title') },
    },
    display: { label: 'Expect visible', detailSource: 'selector.name', quoteDetail: true, separator: ' ' },
  },
  {
    id: 'press-key',
    name: 'Press key',
    description: 'Press a keyboard key on an element.',
    category: 'Actions',
    block: {
      kind: 'press_key',
      values: { selector: createRoleSelector('textbox', 'Search'), key: 'Enter' },
    },
    display: { label: 'Press key', detailSource: 'value', quoteDetail: true, separator: ': ' },
  },
  {
    id: 'select-option',
    name: 'Select option',
    description: 'Select an option from a dropdown element.',
    category: 'Actions',
    block: {
      kind: 'select_option',
      values: { selector: { strategy: 'css', value: '#myDropdown' }, value: 'option-value' },
    },
    display: { label: 'Select option', detailSource: 'value', quoteDetail: true, separator: ': ' },
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

function parseGotoBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
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

  const url = parseTemplateExpression(expression.arguments[0], undefined, constants)
  if (url === null) return null

  return createParsedBlock('goto_url', title, { url })
}

function parseConstantsGroup(
  statements: readonly ts.Statement[],
  sourceFile: ts.SourceFile
): { block: TestBlock; consumedCount: number } | null {
  const contiguousConstStatements: ts.Statement[] = []

  for (const statement of statements) {
    if (!isConstStatement(statement)) {
      break
    }

    contiguousConstStatements.push(statement)
  }

  if (contiguousConstStatements.length === 0) {
    return null
  }

  const first = contiguousConstStatements[0]
  const last = contiguousConstStatements[contiguousConstStatements.length - 1]
  if (!first || !last) {
    return null
  }

  const code = sourceFile.text
    .slice(first.getStart(sourceFile), last.end)
    .replace(/\r\n/g, '\n')

  return {
    block: createParsedBlock('constants_group', 'constants', {
      definitions: code,
    }),
    consumedCount: contiguousConstStatements.length,
  }
}

function parseClickBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'click') return null
  const selector = parseSelectorExpression(expression.expression.expression, constants)
  if (!selector) return null
  return createParsedBlock('click_element', title, { selector })
}

function parseFillBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'fill') return null
  const selector = parseSelectorExpression(expression.expression.expression, constants)
  const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
  if (!selector || value === null) return null
  return createParsedBlock('fill_field', title, { selector, value })
}

function parseExpectUrlBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'toHaveURL') return null
  const target = expression.expression.expression
  if (!ts.isCallExpression(target) || !ts.isIdentifier(target.expression) || target.expression.text !== 'expect') return null
  const actual = target.arguments[0]
  if (!actual || !ts.isIdentifier(actual) || actual.text !== 'page') return null
  const url = parseTemplateExpression(expression.arguments[0], undefined, constants)
  if (url === null) return null
  return createParsedBlock('expect_url', title, { url })
}

function parseExpectVisibleBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'toBeVisible') return null
  const target = expression.expression.expression
  if (!ts.isCallExpression(target) || !ts.isIdentifier(target.expression) || target.expression.text !== 'expect') return null
  const selectorArg = target.arguments[0]
  if (!selectorArg) return null
  const selector = parseSelectorExpression(selectorArg, constants)
  if (!selector) return null
  return createParsedBlock('expect_visible', title, { selector })
}

function parsePressKeyBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'press') return null
  const selector = parseSelectorExpression(expression.expression.expression, constants)
  const key = parseTemplateExpression(expression.arguments[0], undefined, constants)
  if (!selector || key === null) return null
  return createParsedBlock('press_key', title, { selector, key })
}

function parseSelectOptionBlock(statement: ts.Statement, title: string | null, constants: string[] = []): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) return null
  const expression = unwrapAwait(statement.expression)
  if (!ts.isCallExpression(expression)) return null
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== 'selectOption') return null
  const selector = parseSelectorExpression(expression.expression.expression, constants)
  const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
  if (!selector || value === null) return null
  return createParsedBlock('select_option', title, { selector, value })
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

  const stepTitle = parseTemplateExpression(expression.arguments[0])
  const callbackBody = getInlineCallbackBody(expression.arguments[1])
  if (!stepTitle || !callbackBody) {
    return null
  }

  const metadata = parseSubflowMetadata(callbackBody)
  if (!metadata) {
    return null
  }

  return createParsedBlock('use_subflow', title, {
    target: metadata.target,
    stepTitle,
    inputMappings: metadata.inputMappings,
  })
}

function unwrapAwait(expression: ts.Expression): ts.Expression {
  return ts.isAwaitExpression(expression) ? expression.expression : expression
}

function parseSelectorExpression(expression: ts.Expression, constants: string[] = []): SelectorSpec | null {
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
      const role = parseTemplateExpression(expression.arguments[0], undefined, constants)
      if (role === null) return null
      return { strategy: 'role', value: role, name: getRoleNameOption(expression.arguments[1], constants) ?? undefined }
    }
    case 'getByText': {
      const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
      return value === null ? null : { strategy: 'text', value }
    }
    case 'getByLabel': {
      const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
      return value === null ? null : { strategy: 'label', value }
    }
    case 'getByTestId': {
      const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
      return value === null ? null : { strategy: 'test_id', value }
    }
    case 'getByPlaceholder': {
      const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
      return value === null ? null : { strategy: 'placeholder', value }
    }
    case 'locator': {
      const value = parseTemplateExpression(expression.arguments[0], undefined, constants)
      return value === null ? null : { strategy: 'css', value }
    }
    default:
      return null
  }
}

function getRoleNameOption(node: ts.Expression | undefined, constants: string[] = []): string | null {
  if (!node || !ts.isObjectLiteralExpression(node)) return null
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'name') {
      return parseTemplateExpression(property.initializer, undefined, constants)
    }
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

function parseSubflowMetadata(body: ts.Block): { target: TestReferenceSpec; inputMappings: FlowInputMapping[] } | null {
  const sourceFile = body.getSourceFile()
  const sourceText = sourceFile.text
  const leading = sourceText.slice(body.getStart(sourceFile) + 1, body.statements[0]?.getStart(sourceFile) ?? body.end - 1)

  for (const line of leading.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.trim().match(/^\/\/\s*pw-studio-subflow:\s*(.+)$/)
    if (!match?.[1]) {
      continue
    }

    try {
      const parsed = JSON.parse(match[1]) as {
        target?: Partial<TestReferenceSpec>
        inputMappings?: FlowInputMapping[]
      }

      if (
        typeof parsed.target?.filePath === 'string' &&
        typeof parsed.target.ordinal === 'number' &&
        typeof parsed.target.testTitle === 'string'
      ) {
        return {
          target: {
            filePath: parsed.target.filePath,
            ordinal: parsed.target.ordinal,
            testTitle: parsed.target.testTitle,
          },
          inputMappings: Array.isArray(parsed.inputMappings)
            ? parsed.inputMappings.filter(isFlowInputMapping)
            : [],
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

function renderSelector(selector: SelectorSpec | null, context: ServerBlockContext): string {
  if (!selector) {
    return "page.locator('')"
  }

  switch (selector.strategy) {
    case 'role':
      if (selector.name && selector.name.trim().length > 0) {
        return `page.getByRole(${renderFlowString(selector.value, context)}, { name: ${renderFlowString(selector.name, context)} })`
      }
      return `page.getByRole(${renderFlowString(selector.value, context)})`
    case 'text':
      return `page.getByText(${renderFlowString(selector.value, context)})`
    case 'label':
      return `page.getByLabel(${renderFlowString(selector.value, context)})`
    case 'test_id':
      return `page.getByTestId(${renderFlowString(selector.value, context)})`
    case 'placeholder':
      return `page.getByPlaceholder(${renderFlowString(selector.value, context)})`
    case 'css':
      return `page.locator(${renderFlowString(selector.value, context)})`
  }
}

function renderUseSubflowBlock(block: TestBlock, context: ServerBlockContext): string {
  const target = readTestReferenceValue(block, 'target')
  const inputMappings = readFlowInputMappings(block, 'inputMappings')
  const metadata = JSON.stringify({
    target: target ?? { filePath: '', ordinal: 0, testTitle: '' },
    inputMappings,
  })
  const stepTitle = readStringValue(block, 'stepTitle').trim() || target?.testTitle || 'Run subflow'
  const body = target && context.rootPath
    ? renderReferencedSubflowBody(context.rootPath, target, inputMappings, context)
    : '// Select a source test to expand this subflow.'

  const lines = [
    `await test.step(${renderFlowString(stepTitle, context)}, async () => {`,
    `  // ${SUBFLOW_MARKER} ${metadata}`,
    ...body.replace(/\r\n/g, '\n').split('\n').map((line) => `  ${line}`),
    `});${renderTitleComment(block)}`,
  ]

  return lines.join('\n')
}

function renderReferencedSubflowBody(
  rootPath: string,
  target: TestReferenceSpec,
  inputMappings: FlowInputMapping[],
  context: ServerBlockContext
): string {
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

  const childDocument = buildDocumentFromParsedTest(found, target.filePath, 'existing', coreBlockDefinitions)
  const mappingPrelude = renderSubflowInputPrelude(childDocument.flowInputs, inputMappings, context)
  const body = renderBlocksOnly(childDocument.blocks, coreBlockDefinitions, {
    ...context,
    documentFilePath: target.filePath,
    documentTestCaseRef: found.testCaseRef,
    flowInputs: childDocument.flowInputs,
    flowInputAccessor: SUBFLOW_INPUT_NAME,
  })

  if (mappingPrelude.length > 0 && body.length > 0) {
    return `${mappingPrelude}\n${body}`
  }

  return mappingPrelude || body
}

function renderSubflowInputPrelude(
  flowInputs: FlowInputDefinition[],
  mappings: FlowInputMapping[],
  context: ServerBlockContext
): string {
  if (flowInputs.length === 0) {
    return ''
  }

  const defaultsEntries = flowInputs
    .map((input) => `  ${input.name}: ${quoteString(input.defaultValue)},`)
    .join('\n')
  const mappedEntries = mappings
    .filter((mapping) => flowInputs.some((input) => input.name === mapping.targetName))
    .map((mapping) => {
      const value =
        mapping.source === 'flow_input'
          ? `${context.flowInputAccessor ?? '__pwFlow'}.${mapping.value}`
          : renderFlowString(mapping.value, context)
      return `  ${mapping.targetName}: ${value},`
    })
    .join('\n')

  if (mappedEntries.length === 0) {
    return [
      `const ${SUBFLOW_DEFAULTS_NAME} = {`,
      defaultsEntries,
      '};',
      `const ${SUBFLOW_INPUT_NAME} = { ...${SUBFLOW_DEFAULTS_NAME} };`,
    ].join('\n')
  }

  return [
    `const ${SUBFLOW_DEFAULTS_NAME} = {`,
    defaultsEntries,
    '};',
    `const ${SUBFLOW_INPUT_NAME} = {`,
    `  ...${SUBFLOW_DEFAULTS_NAME},`,
    mappedEntries,
    '};',
  ].join('\n')
}

function validateSelectorBlock(block: TestBlock, flowInputs: FlowInputDefinition[] | undefined): string[] {
  const selector = readSelectorValue(block, 'selector')
  if (!selector) {
    return ['Selector is required.']
  }

  return validateStringTemplates(
    [selector.value, selector.name ?? ''],
    flowInputs
  )
}

function validateConstantsGroupBlock(code: string): string[] {
  if (code.trim().length === 0) {
    return ['Constants block requires at least one const declaration.']
  }

  const wrapped = `async function __pwStudioConstants() {\n${code}\n}\n`
  const sourceFile = ts.createSourceFile(
    '__pwstudio_constants.ts',
    wrapped,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const bodyStatements =
    sourceFile.statements[0] && ts.isFunctionDeclaration(sourceFile.statements[0]) && sourceFile.statements[0].body
      ? sourceFile.statements[0].body.statements
      : []

  if (bodyStatements.length === 0) {
    return ['Constants block requires at least one const declaration.']
  }

  if (bodyStatements.some((statement) => !isConstStatement(statement))) {
    return ['Constants block may only contain const declarations.']
  }

  const diagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? []
  return diagnostics.map((diagnostic) => {
    const start = diagnostic.start ?? 0
    const position = sourceFile.getLineAndCharacterOfPosition(start)
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    return `Line ${position.line + 1}, column ${position.character + 1}: ${message}`
  })
}

function validateUseSubflowBlock(block: TestBlock, context: ServerBlockContext): string[] {
  const errors: string[] = []
  const target = readTestReferenceValue(block, 'target')
  const mappings = readFlowInputMappings(block, 'inputMappings')

  if (!target || target.filePath.trim().length === 0 || target.testTitle.trim().length === 0) {
    errors.push('Use subflow block requires a source test selection.')
    return errors
  }

  errors.push(...validateStringTemplates([readStringValue(block, 'stepTitle')], context.flowInputs))

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
    return errors
  }

  const childDocument = buildDocumentFromParsedTest(found, target.filePath, 'existing', coreBlockDefinitions)
  const childNames = new Set(childDocument.flowInputs.map((input) => input.name))
  const parentNames = new Set((context.flowInputs ?? []).map((input) => input.name))
  const seenTargets = new Set<string>()

  for (const mapping of mappings) {
    if (!childNames.has(mapping.targetName)) {
      errors.push(`Unknown child flow input mapping target: "${mapping.targetName}".`)
      continue
    }

    if (seenTargets.has(mapping.targetName)) {
      errors.push(`Duplicate subflow input mapping target: "${mapping.targetName}".`)
      continue
    }

    seenTargets.add(mapping.targetName)

    if (mapping.source === 'flow_input') {
      if (!parentNames.has(mapping.value)) {
        errors.push(`Unknown parent flow input in subflow mapping: "${mapping.value}".`)
      }
      continue
    }

    errors.push(...validateStringTemplates([mapping.value], context.flowInputs))
  }

  return errors
}

function renderFlowString(value: string, context: ServerBlockContext): string {
  const accessor = context.flowInputAccessor ?? '__pwFlow'
  return stringifyFlowTemplate(value, accessor, context.constants ?? [])
}

function validateStringTemplates(values: string[], flowInputs: FlowInputDefinition[] | undefined, constants: string[] = []): string[] {
  if (!flowInputs) {
    return []
  }

  return values
    .filter((value) => value.trim().length > 0)
    .flatMap((value) => validateFlowTemplate(value, flowInputs, constants))
}

function readStringValue(block: TestBlock, key: string): string {
  const value = block.values[key]
  return typeof value === 'string' ? value : ''
}

function readDefinitionsValue(block: TestBlock): string {
  const value = block.values['definitions']
  return typeof value === 'string' ? value : ''
}

function readSelectorValue(block: TestBlock, key: string): SelectorSpec | null {
  const value = block.values[key]
  if (value && typeof value === 'object' && 'strategy' in value && 'value' in value) {
    return value as SelectorSpec
  }
  return null
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

function readFlowInputMappings(block: TestBlock, key: string): FlowInputMapping[] {
  const value = block.values[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isFlowInputMapping)
}

function isFlowInputMapping(value: unknown): value is FlowInputMapping {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'targetName' in value &&
    'source' in value &&
    'value' in value &&
    typeof (value as FlowInputMapping).targetName === 'string' &&
    ((value as FlowInputMapping).source === 'flow_input' || (value as FlowInputMapping).source === 'literal') &&
    typeof (value as FlowInputMapping).value === 'string'
  )
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
  if (code.includes('{{')) {
    return ['Raw code blocks do not support flow input placeholders in v1.']
  }

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

function isConstStatement(statement: ts.Statement): boolean {
  return (
    ts.isVariableStatement(statement) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
  )
}

function createRoleSelector(role: string, name: string): SelectorSpec {
  return { strategy: 'role', value: role, name }
}

function createTextSelector(value: string): SelectorSpec {
  return { strategy: 'text', value }
}
