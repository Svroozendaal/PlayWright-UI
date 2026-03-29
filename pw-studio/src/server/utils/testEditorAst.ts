import ts from 'typescript'
import type {
  ClickElementBlock,
  ExpectUrlBlock,
  FillFieldBlock,
  GotoUrlBlock,
  RawCodeBlock,
  SelectorSpec,
  TestBlock,
  TestCaseRef,
  TestEditorDocument,
  TestEditorMode,
  TestEditorTemplate,
} from '../../shared/types/ipc'

type CallbackNode = ts.ArrowFunction | ts.FunctionExpression

export type ParsedTestCase = {
  ordinal: number
  testCaseRef: TestCaseRef
  title: string
  rangeStart: number
  rangeEnd: number
  snippet: string
  template: TestEditorTemplate
  body: ts.Block
}

export type ParsedTestSource = {
  sourceFile: ts.SourceFile
  diagnostics: readonly ts.DiagnosticWithLocation[]
  testCases: ParsedTestCase[]
}

type BlockExtractionResult = {
  blocks: TestBlock[]
  warnings: string[]
}

const PLAYWRIGHT_TEST_CALLEE = /^test(?:\.(?:only|skip|fixme|fail|slow))?$/

/**
 * Parse a Playwright test source file and collect discoverable test calls.
 */
export function parseTestSource(code: string, filePath: string): ParsedTestSource {
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  )

  const testCases: ParsedTestCase[] = []
  let ordinal = 0

  const visit = (node: ts.Node): void => {
    if (ts.isExpressionStatement(node)) {
      const parsed = parseTestStatement(node, sourceFile, code, ordinal)
      if (parsed) {
        testCases.push(parsed)
        ordinal += 1
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return {
    sourceFile,
    diagnostics: getParseDiagnostics(sourceFile),
    testCases,
  }
}

/**
 * Build the canonical visual editor document for one parsed test case.
 */
export function buildDocumentFromParsedTest(
  parsed: ParsedTestCase,
  filePath: string,
  mode: TestEditorMode
): TestEditorDocument {
  const extraction = extractBlocksFromBody(parsed.body)

  return {
    mode,
    filePath,
    testTitle: parsed.title,
    blocks: extraction.blocks,
    code: parsed.snippet,
    warnings: extraction.warnings,
    template: parsed.template,
    testCaseRef: mode === 'existing' ? parsed.testCaseRef : undefined,
  }
}

/**
 * Convert a single test snippet into the canonical document model.
 */
export function parseSnippetToDocument(
  code: string,
  filePath: string,
  mode: TestEditorMode
): TestEditorDocument {
  const parsed = parseTestSource(code, filePath)
  const diagnostics = formatParseDiagnostics(parsed)

  if (diagnostics.length > 0) {
    throw new Error(diagnostics.join('\n'))
  }

  if (parsed.testCases.length !== 1) {
    throw new Error('The code editor must contain exactly one Playwright test.')
  }

  const only = parsed.testCases[0]
  if (!only) {
    throw new Error('No Playwright test was found in the provided code.')
  }

  if (/\S/.test(code.slice(0, only.rangeStart)) || /\S/.test(code.slice(only.rangeEnd))) {
    throw new Error('Only a single test snippet may be edited in the visual test editor.')
  }

  return buildDocumentFromParsedTest(only, filePath, mode)
}

/**
 * Render the canonical document back into plain Playwright code.
 */
export function renderDocumentCode(
  document: Pick<TestEditorDocument, 'testTitle' | 'blocks' | 'template'>,
  eol = '\n'
): string {
  const body = renderBody(document.blocks, eol)
  const args = [quoteString(document.testTitle), ...document.template.extraArgs]
  const callback = renderCallback(document.template, body, eol)
  args.push(callback)

  return `${document.template.callee}(${args.join(', ')})`
}

/**
 * Replace a selected test snippet in its source file.
 */
export function replaceTestInSource(
  source: string,
  parsed: ParsedTestCase,
  renderedCode: string
): string {
  return `${source.slice(0, parsed.rangeStart)}${renderedCode}${source.slice(parsed.rangeEnd)}`
}

/**
 * Append a new test snippet to an existing test file.
 */
export function appendTestToSource(
  source: string,
  renderedCode: string,
  eol = '\n'
): string {
  const trimmed = source.replace(/\s*$/, '')
  if (trimmed.length === 0) {
    return `${renderedCode}${eol}`
  }

  return `${trimmed}${eol}${eol}${renderedCode}${eol}`
}

/**
 * Validate syntax for all editable raw-code blocks.
 */
export function validateRawCodeBlocks(blocks: TestBlock[]): string[] {
  const errors: string[] = []

  for (const block of blocks) {
    if (block.kind !== 'raw_code') {
      continue
    }

    const wrapped = `async function __pwStudioRaw() {\n${block.code}\n}\n`
    const parsed = parseTestSource(wrapped, '__pwstudio_raw.ts')
    const diagnostics = formatParseDiagnostics(parsed)

    if (diagnostics.length > 0) {
      errors.push(`Raw code block is invalid:\n${diagnostics.join('\n')}`)
    }
  }

  return errors
}

/**
 * Format syntax diagnostics into readable line-based messages.
 */
export function formatParseDiagnostics(parsed: ParsedTestSource): string[] {
  return parsed.diagnostics.map((diagnostic) => {
    const start = diagnostic.start ?? 0
    const position = parsed.sourceFile.getLineAndCharacterOfPosition(start)
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    return `Line ${position.line + 1}, column ${position.character + 1}: ${message}`
  })
}

function getScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (filePath.endsWith('.mjs')) return ts.ScriptKind.JS
  if (filePath.endsWith('.js')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function getParseDiagnostics(sourceFile: ts.SourceFile): readonly ts.DiagnosticWithLocation[] {
  return (sourceFile as ts.SourceFile & {
    parseDiagnostics?: readonly ts.DiagnosticWithLocation[]
  }).parseDiagnostics ?? []
}

function parseTestStatement(
  statement: ts.ExpressionStatement,
  sourceFile: ts.SourceFile,
  sourceText: string,
  ordinal: number
): ParsedTestCase | null {
  if (!ts.isCallExpression(statement.expression)) {
    return null
  }

  const call = statement.expression
  const calleeText = call.expression.getText(sourceFile)
  if (!PLAYWRIGHT_TEST_CALLEE.test(calleeText)) {
    return null
  }

  const titleArg = call.arguments[0]
  const callbackArg = call.arguments.at(-1)
  const callback = getCallbackNode(callbackArg)

  if (!titleArg || !callback || callback.body === undefined) {
    return null
  }

  const title = getTitleText(titleArg, sourceFile)
  const extraArgs = call.arguments.slice(1, -1).map((arg) => arg.getText(sourceFile))
  const callbackParams = callback.parameters.map((parameter) => parameter.getText(sourceFile)).join(', ')
  const body = callback.body as ts.Block

  return {
    ordinal,
    testCaseRef: {
      ordinal,
      testTitle: title,
    },
    title,
    rangeStart: statement.getStart(sourceFile),
    rangeEnd: statement.end,
    snippet: sourceText.slice(statement.getStart(sourceFile), statement.end),
    template: {
      callee: calleeText,
      extraArgs,
      callbackStyle: ts.isArrowFunction(callback) ? 'arrow' : 'function',
      callbackParams,
      callbackAsync: hasAsyncModifier(callback),
    },
    body,
  }
}

function getTitleText(node: ts.Expression, sourceFile: ts.SourceFile): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  return node.getText(sourceFile)
}

function getCallbackNode(node: ts.Node | undefined): CallbackNode | null {
  if (!node) {
    return null
  }

  if (ts.isArrowFunction(node) && ts.isBlock(node.body)) {
    return node
  }

  if (ts.isFunctionExpression(node) && node.body) {
    return node
  }

  return null
}

function hasAsyncModifier(node: CallbackNode): boolean {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false
}

function extractBlocksFromBody(body: ts.Block): BlockExtractionResult {
  const blocks: TestBlock[] = []
  const warnings: string[] = []
  const sourceFile = body.getSourceFile()
  const sourceText = sourceFile.text
  let cursor = body.getStart(sourceFile) + 1
  let sawUnsupportedCode = false

  for (const statement of body.statements) {
    const statementStart = statement.getStart(sourceFile)
    const leading = sourceText.slice(cursor, statementStart)
    if (containsMeaningfulText(leading)) {
      blocks.push(createRawCodeBlock(normaliseRawCode(leading)))
      sawUnsupportedCode = true
    }

    const titleComment = getStatementTitleComment(sourceFile, sourceText, statement)
    const mapped = mapStatementToBlock(statement, titleComment?.title ?? null)
    if (mapped) {
      blocks.push(mapped)
    } else {
      blocks.push(
        createRawCodeBlock(
          normaliseRawCode(sourceText.slice(statementStart, statement.end)),
          titleComment?.title ?? undefined
        )
      )
      sawUnsupportedCode = true
    }

    cursor = titleComment?.end ?? statement.end
  }

  const trailing = sourceText.slice(cursor, body.end - 1)
  if (containsMeaningfulText(trailing)) {
    blocks.push(createRawCodeBlock(normaliseRawCode(trailing)))
    sawUnsupportedCode = true
  }

  const titledBlocks = ensureBlockTitles(blocks)

  if (sawUnsupportedCode) {
    warnings.push('Some lines remain raw code blocks because they do not map to a supported visual block yet.')
  }

  return { blocks: titledBlocks, warnings }
}

function containsMeaningfulText(value: string): boolean {
  return /\S/.test(value)
}

function normaliseRawCode(value: string): string {
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

function extractRawCodeTitle(code: string, preferredTitle?: string): { title: string; code: string } {
  if (preferredTitle && preferredTitle.trim().length > 0) {
    return {
      title: preferredTitle.trim(),
      code,
    }
  }

  const lines = code.split('\n')
  const firstLine = lines[0]?.trim() ?? ''
  const match = firstLine.match(/^\/\/\s*(.+)$/)

  if (match && lines.length > 1) {
    return {
      title: (match[1] ?? '').trim(),
      code: lines.slice(1).join('\n').replace(/^\n+/, ''),
    }
  }

  return {
    title: '',
    code,
  }
}

function ensureBlockTitles(blocks: TestBlock[]): TestBlock[] {
  const used = new Set<string>()
  const counters = new Map<string, number>()

  return blocks.map((block) => {
    const preferred = sanitiseTitle(block.title)
    if (preferred && !used.has(preferred.toLowerCase())) {
      used.add(preferred.toLowerCase())
      return {
        ...block,
        title: preferred,
      }
    }

    const base = defaultTitleForKind(block.kind)
    let next = (counters.get(base) ?? 0) + 1
    let candidate = next === 1 ? base : `${base} ${next}`
    while (used.has(candidate.toLowerCase())) {
      next += 1
      candidate = `${base} ${next}`
    }

    counters.set(base, next)
    used.add(candidate.toLowerCase())

    return {
      ...block,
      title: candidate,
    }
  })
}

function defaultTitleForKind(kind: TestBlock['kind']): string {
  switch (kind) {
    case 'goto_url':
      return 'go to url'
    case 'click_element':
      return 'click element'
    case 'fill_field':
      return 'fill field'
    case 'expect_url':
      return 'expect url'
    case 'raw_code':
      return 'raw code'
  }
}

function sanitiseTitle(title: string): string {
  return title.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function getStatementTitleComment(
  sourceFile: ts.SourceFile,
  sourceText: string,
  statement: ts.Statement
): { title: string; end: number } | null {
  const comments = ts.getTrailingCommentRanges(sourceText, statement.end) ?? []
  for (const comment of comments) {
    if (comment.kind !== ts.SyntaxKind.SingleLineCommentTrivia) {
      continue
    }

    const statementLine = sourceFile.getLineAndCharacterOfPosition(statement.end).line
    const commentLine = sourceFile.getLineAndCharacterOfPosition(comment.pos).line
    if (statementLine !== commentLine) {
      continue
    }

    const raw = sourceText.slice(comment.pos + 2, comment.end).trim()
    if (raw.length > 0) {
      return {
        title: raw,
        end: comment.end,
      }
    }
  }

  return null
}

function createRawCodeBlock(code: string, title?: string): RawCodeBlock {
  const extracted = extractRawCodeTitle(code, title)
  return {
    id: crypto.randomUUID(),
    title: extracted.title,
    kind: 'raw_code',
    code: extracted.code,
  }
}

function mapStatementToBlock(statement: ts.Statement, title: string | null): TestBlock | null {
  if (!ts.isExpressionStatement(statement)) {
    return null
  }

  const expression = unwrapAwait(statement.expression)

  return (
    parseGotoBlock(expression, title) ??
    parseClickBlock(expression, title) ??
    parseFillBlock(expression, title) ??
    parseExpectUrlBlock(expression, title)
  )
}

function unwrapAwait(expression: ts.Expression): ts.Expression {
  return ts.isAwaitExpression(expression) ? expression.expression : expression
}

function parseGotoBlock(expression: ts.Expression, title: string | null): GotoUrlBlock | null {
  if (!ts.isCallExpression(expression)) {
    return null
  }

  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'goto' ||
    !ts.isIdentifier(expression.expression.expression) ||
    expression.expression.expression.text !== 'page'
  ) {
    return null
  }

  const url = getStringArgument(expression.arguments[0])
  if (url === null) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    title: title ?? '',
    kind: 'goto_url',
    url,
  }
}

function parseClickBlock(expression: ts.Expression, title: string | null): ClickElementBlock | null {
  if (!ts.isCallExpression(expression)) {
    return null
  }

  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'click'
  ) {
    return null
  }

  const selector = parseSelectorExpression(expression.expression.expression)
  if (!selector) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    title: title ?? '',
    kind: 'click_element',
    selector,
  }
}

function parseFillBlock(expression: ts.Expression, title: string | null): FillFieldBlock | null {
  if (!ts.isCallExpression(expression)) {
    return null
  }

  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'fill'
  ) {
    return null
  }

  const selector = parseSelectorExpression(expression.expression.expression)
  const value = getStringArgument(expression.arguments[0])

  if (!selector || value === null) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    title: title ?? '',
    kind: 'fill_field',
    selector,
    value,
  }
}

function parseExpectUrlBlock(expression: ts.Expression, title: string | null): ExpectUrlBlock | null {
  if (!ts.isCallExpression(expression)) {
    return null
  }

  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'toHaveURL'
  ) {
    return null
  }

  const target = expression.expression.expression
  if (!ts.isCallExpression(target) || !ts.isIdentifier(target.expression) || target.expression.text !== 'expect') {
    return null
  }

  const actual = target.arguments[0]
  if (!actual || !ts.isIdentifier(actual) || actual.text !== 'page') {
    return null
  }

  const url = getStringArgument(expression.arguments[0])
  if (url === null) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    title: title ?? '',
    kind: 'expect_url',
    url,
  }
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
      if (role === null) {
        return null
      }

      const name = getRoleNameOption(expression.arguments[1])
      return {
        strategy: 'role',
        value: role,
        name: name ?? undefined,
      }
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
  if (!node || !ts.isObjectLiteralExpression(node)) {
    return null
  }

  for (const property of node.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'name'
    ) {
      return getStringArgument(property.initializer)
    }
  }

  return null
}

function getStringArgument(node: ts.Node | undefined): string | null {
  if (!node) {
    return null
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  return null
}

function renderBody(blocks: TestBlock[], eol: string): string {
  if (blocks.length === 0) {
    return ''
  }

  return blocks
    .map((block) => indentBlock(renderBlock(block), eol, '  '))
    .join(eol)
}

function renderCallback(template: TestEditorTemplate, body: string, eol: string): string {
  const asyncPrefix = template.callbackAsync ? 'async ' : ''
  const params = template.callbackParams.trim().length > 0 ? template.callbackParams : ''

  if (template.callbackStyle === 'function') {
    return `${asyncPrefix}function(${params}) {${body ? `${eol}${body}${eol}` : eol}}`
  }

  return `${asyncPrefix}(${params}) => {${body ? `${eol}${body}${eol}` : eol}}`
}

function renderBlock(block: TestBlock): string {
  const titleComment = ` // ${sanitiseTitle(block.title)}`

  switch (block.kind) {
    case 'goto_url':
      return `await page.goto(${quoteString(block.url)});${titleComment}`
    case 'click_element':
      return `await ${renderSelector(block.selector)}.click();${titleComment}`
    case 'fill_field':
      return `await ${renderSelector(block.selector)}.fill(${quoteString(block.value)});${titleComment}`
    case 'expect_url':
      return `await expect(page).toHaveURL(${quoteString(block.url)});${titleComment}`
    case 'raw_code':
      if (block.code.trim().length === 0) {
        return `// ${sanitiseTitle(block.title)}`
      }
      return `// ${sanitiseTitle(block.title)}\n${block.code}`
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

function quoteString(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`
}

function indentBlock(block: string, eol: string, indent: string): string {
  return block
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : indent))
    .join(eol)
}
