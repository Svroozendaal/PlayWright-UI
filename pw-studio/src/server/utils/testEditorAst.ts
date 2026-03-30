import { randomUUID } from 'crypto'
import ts from 'typescript'
import type {
  FlowInputDefinition,
  TestBlock,
  TestCaseRef,
  TestEditorDocument,
  TestEditorMode,
  TestEditorTemplate,
} from '../../shared/types/ipc'
import type { ServerBlockContext, ServerBlockDefinition } from '../plugins/runtime'

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
  flowInputs: FlowInputDefinition[]
  blocks: TestBlock[]
  warnings: string[]
}

type FlowPrelude = {
  flowInputs: FlowInputDefinition[]
  consumedStatements: Set<ts.Statement>
}

const PLAYWRIGHT_TEST_CALLEE = /^test(?:\.(?:only|skip|fixme|fail|slow))?$/
const FLOW_RESOLVER_NAME = '__pwResolveFlowInputs'
const FLOW_DEFAULTS_NAME = '__pwFlowDefaults'
const FLOW_EXPOSED_NAME = '__pwFlowExposed'
const FLOW_INPUT_NAME = '__pwFlow'
const FLOW_ENV_VAR = 'PW_STUDIO_FLOW_INPUTS'
const PLACEHOLDER_PATTERN = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g

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

export function buildDocumentFromParsedTest(
  parsed: ParsedTestCase,
  filePath: string,
  mode: TestEditorMode,
  definitions: ServerBlockDefinition[]
): TestEditorDocument {
  const extraction = extractBlocksFromBody(parsed.body, definitions)

  return {
    mode,
    filePath,
    testTitle: parsed.title,
    flowInputs: extraction.flowInputs,
    blocks: extraction.blocks,
    code: parsed.snippet,
    warnings: extraction.warnings,
    template: parsed.template,
    testCaseRef: mode === 'existing' ? parsed.testCaseRef : undefined,
  }
}

export function extractFlowInputsFromBody(body: ts.Block): FlowInputDefinition[] {
  return parseFlowPrelude(body).flowInputs
}

export function parseSnippetToDocument(
  code: string,
  filePath: string,
  mode: TestEditorMode,
  definitions: ServerBlockDefinition[]
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

  return buildDocumentFromParsedTest(only, filePath, mode, definitions)
}

export function renderDocumentCode(
  document: Pick<TestEditorDocument, 'testTitle' | 'flowInputs' | 'blocks' | 'template'>,
  definitions: ServerBlockDefinition[],
  context: ServerBlockContext & { eol?: string } = {}
): string {
  const eol = context.eol ?? '\n'
  const body = renderDocumentBody(document, definitions, context, eol)
  const args = [quoteString(document.testTitle), ...document.template.extraArgs]
  const callback = renderCallback(document.template, body, eol)
  args.push(callback)

  return `${document.template.callee}(${args.join(', ')})`
}

export function renderDocumentBody(
  document: Pick<TestEditorDocument, 'flowInputs' | 'blocks'>,
  definitions: ServerBlockDefinition[],
  context: ServerBlockContext = {},
  eol = '\n'
): string {
  const flowPrelude = renderFlowPrelude(document.flowInputs, eol)
  const body = renderBody(document.blocks, definitions, eol, {
    ...context,
    flowInputs: document.flowInputs,
    flowInputAccessor: context.flowInputAccessor ?? FLOW_INPUT_NAME,
  })

  if (flowPrelude.length > 0 && body.length > 0) {
    return `${flowPrelude}${eol}${body}`
  }

  return flowPrelude || body
}

export function renderBlocksOnly(
  blocks: TestBlock[],
  definitions: ServerBlockDefinition[],
  context: ServerBlockContext = {},
  eol = '\n'
): string {
  return renderBody(blocks, definitions, eol, context)
}

export function replaceTestInSource(
  source: string,
  parsed: ParsedTestCase,
  renderedCode: string
): string {
  return `${source.slice(0, parsed.rangeStart)}${renderedCode}${source.slice(parsed.rangeEnd)}`
}

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

export function validateRawCodeBlocks(
  blocks: TestBlock[],
  definitions: ServerBlockDefinition[],
  context: ServerBlockContext = {}
): string[] {
  const errors: string[] = []
  const definitionsByKind = new Map(definitions.map((definition) => [definition.kind, definition] as const))

  for (const block of blocks) {
    const validate = definitionsByKind.get(block.kind)?.validate
    if (!validate) {
      continue
    }

    errors.push(...validate(block, context))
  }

  return errors
}

export function formatParseDiagnostics(parsed: ParsedTestSource): string[] {
  return parsed.diagnostics.map((diagnostic) => {
    const start = diagnostic.start ?? 0
    const position = parsed.sourceFile.getLineAndCharacterOfPosition(start)
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    return `Line ${position.line + 1}, column ${position.character + 1}: ${message}`
  })
}

export function stringifyFlowTemplate(value: string, accessor = FLOW_INPUT_NAME): string {
  const tokens = collectTemplateTokens(value)
  if (tokens.length === 0) {
    return quoteString(value)
  }

  let output = '`'
  let cursor = 0

  for (const token of tokens) {
    output += escapeTemplateSegment(value.slice(cursor, token.index))
    output += `\${${accessor}.${token.name}}`
    cursor = token.index + token.match.length
  }

  output += escapeTemplateSegment(value.slice(cursor))
  output += '`'

  return output
}

export function parseTemplateExpression(
  node: ts.Node | undefined,
  accessorNames = [FLOW_INPUT_NAME]
): string | null {
  if (!node) {
    return null
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  if (!ts.isTemplateExpression(node)) {
    return null
  }

  let value = node.head.text

  for (const span of node.templateSpans) {
    const name = parseTemplatePlaceholder(span.expression, accessorNames)
    if (!name) {
      return null
    }

    value += `{{${name}}}${span.literal.text}`
  }

  return value
}

export function validateFlowTemplate(value: string, flowInputs: FlowInputDefinition[]): string[] {
  const available = new Set(flowInputs.map((entry) => entry.name))
  const errors: string[] = []
  const tokens = collectTemplateTokens(value)
  const seen = new Set<string>()

  for (const token of tokens) {
    if (!available.has(token.name) && !seen.has(token.name)) {
      errors.push(`Unknown flow input placeholder: {{${token.name}}}`)
      seen.add(token.name)
    }
  }

  const unmatchedOpen = value.match(/{{/g)?.length ?? 0
  if (unmatchedOpen !== tokens.length) {
    errors.push('Unresolved placeholder syntax found. Use {{InputName}} with a valid input name.')
  }

  return errors
}

export function validateFlowInputName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
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

function extractBlocksFromBody(body: ts.Block, definitions: ServerBlockDefinition[]): BlockExtractionResult {
  const flowPrelude = parseFlowPrelude(body)
  const blocks: TestBlock[] = []
  const warnings: string[] = []
  const sourceFile = body.getSourceFile()
  const sourceText = sourceFile.text
  const groupParsers = definitions.filter(
    (definition) => typeof definition.parseLeadingStatements === 'function'
  )
  const parsers = definitions.filter((definition) => typeof definition.parseStatement === 'function')
  const statements = [...body.statements]
  let cursor = body.getStart(sourceFile) + 1
  let sawUnsupportedCode = false

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index]
    if (!statement) {
      continue
    }

    const statementStart = statement.getStart(sourceFile)
    const statementEnd = statement.end
    const leading = sourceText.slice(cursor, statementStart)
    if (containsMeaningfulText(leading)) {
      blocks.push(createRawCodeBlock(normaliseRawCode(leading)))
      sawUnsupportedCode = true
    }

    if (flowPrelude.consumedStatements.has(statement)) {
      cursor = statementEnd
      continue
    }

    if (blocks.length === 0 && !sawUnsupportedCode) {
      const remainingStatements = statements.slice(index)
      const grouped = groupParsers
        .map((definition) => definition.parseLeadingStatements?.(remainingStatements, sourceFile))
        .find((value): value is { block: TestBlock; consumedCount: number } => Boolean(value && value.consumedCount > 0))

      if (grouped) {
        const lastStatement = remainingStatements[grouped.consumedCount - 1]
        blocks.push(grouped.block)
        cursor = lastStatement?.end ?? statementEnd
        index += grouped.consumedCount - 1
        continue
      }
    }

    const titleComment = getStatementTitleComment(sourceFile, sourceText, statement)
    const mapped = parsers
      .map((definition) => definition.parseStatement?.(statement, titleComment?.title ?? null))
      .find((value): value is TestBlock => Boolean(value))

    if (mapped) {
      blocks.push(mapped)
    } else {
      blocks.push(
        createRawCodeBlock(
          normaliseRawCode(sourceText.slice(statementStart, statementEnd)),
          titleComment?.title ?? undefined
        )
      )
      sawUnsupportedCode = true
    }

    cursor = titleComment?.end ?? statementEnd
  }

  const trailing = sourceText.slice(cursor, body.end - 1)
  if (containsMeaningfulText(trailing)) {
    blocks.push(createRawCodeBlock(normaliseRawCode(trailing)))
    sawUnsupportedCode = true
  }

  const titledBlocks = ensureBlockTitles(blocks, definitions)

  if (sawUnsupportedCode) {
    warnings.push('Some lines remain raw code blocks because they do not map to a supported visual block yet.')
  }

  return { flowInputs: flowPrelude.flowInputs, blocks: titledBlocks, warnings }
}

function parseFlowPrelude(body: ts.Block): FlowPrelude {
  const consumedStatements = new Set<ts.Statement>()
  const statements = [...body.statements]
  let index = 0

  if (isFlowResolverDeclaration(statements[index])) {
    consumedStatements.add(statements[index] as ts.Statement)
    index += 1
  }

  const defaultsStatement = statements[index]
  const defaults = parseFlowDefaultsStatement(defaultsStatement)
  if (!defaults) {
    return { flowInputs: [], consumedStatements: new Set() }
  }

  consumedStatements.add(defaultsStatement as ts.Statement)
  index += 1

  let exposedNames: string[] = []
  const exposedStatement = statements[index]
  const parsedExposed = parseFlowExposedStatement(exposedStatement)
  if (parsedExposed) {
    exposedNames = parsedExposed
    consumedStatements.add(exposedStatement as ts.Statement)
    index += 1
  }

  const resolvedStatement = statements[index]
  if (isFlowResolverAssignment(resolvedStatement)) {
    consumedStatements.add(resolvedStatement as ts.Statement)
  }

  return {
    flowInputs: Object.entries(defaults).map(([name, defaultValue]) => ({
      id: randomUUID(),
      name,
      defaultValue,
      exposeAtRunStart: exposedNames.includes(name),
    })),
    consumedStatements,
  }
}

function isFlowResolverDeclaration(statement: ts.Statement | undefined): boolean {
  return Boolean(
    statement &&
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === FLOW_RESOLVER_NAME
  )
}

function parseFlowDefaultsStatement(statement: ts.Statement | undefined): Record<string, string> | null {
  if (!statement || !ts.isVariableStatement(statement)) {
    return null
  }

  const declaration = statement.declarationList.declarations[0]
  if (!declaration || !ts.isIdentifier(declaration.name) || declaration.name.text !== FLOW_DEFAULTS_NAME) {
    return null
  }

  if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
    return null
  }

  const values: Record<string, string> = {}
  for (const property of declaration.initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      return null
    }

    const key = getPropertyNameText(property.name)
    const value = parseTemplateExpression(property.initializer)
    if (!key || value === null) {
      return null
    }

    values[key] = value
  }

  return values
}

function parseFlowExposedStatement(statement: ts.Statement | undefined): string[] | null {
  if (!statement || !ts.isVariableStatement(statement)) {
    return null
  }

  const declaration = statement.declarationList.declarations[0]
  if (!declaration || !ts.isIdentifier(declaration.name) || declaration.name.text !== FLOW_EXPOSED_NAME) {
    return null
  }

  if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) {
    return null
  }

  const values: string[] = []
  for (const element of declaration.initializer.elements) {
    const value = parseTemplateExpression(element)
    if (value === null) {
      return null
    }
    values.push(value)
  }

  return values
}

function isFlowResolverAssignment(statement: ts.Statement | undefined): boolean {
  if (!statement || !ts.isVariableStatement(statement)) {
    return false
  }

  const declaration = statement.declarationList.declarations[0]
  if (!declaration || !ts.isIdentifier(declaration.name) || declaration.name.text !== FLOW_INPUT_NAME) {
    return false
  }

  if (!declaration.initializer || !ts.isCallExpression(declaration.initializer)) {
    return false
  }

  const expression = declaration.initializer.expression
  return ts.isIdentifier(expression) && expression.text === FLOW_RESOLVER_NAME
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }

  return null
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

function ensureBlockTitles(blocks: TestBlock[], definitions: ServerBlockDefinition[]): TestBlock[] {
  const used = new Set<string>()
  const counters = new Map<string, number>()
  const definitionsByKind = new Map(definitions.map((definition) => [definition.kind, definition] as const))

  return blocks.map((block) => {
    const preferred = sanitiseTitle(block.title)
    if (preferred && !used.has(preferred.toLowerCase())) {
      used.add(preferred.toLowerCase())
      return {
        ...block,
        title: preferred,
      }
    }

    const base = definitionsByKind.get(block.kind)?.defaultTitle ?? block.kind.replace(/_/g, ' ')
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

function createRawCodeBlock(code: string, title?: string): TestBlock {
  const extracted = extractRawCodeTitle(code, title)
  return {
    id: randomUUID(),
    title: extracted.title,
    kind: 'raw_code',
    values: {
      code: extracted.code,
    },
  }
}

function renderFlowPrelude(flowInputs: FlowInputDefinition[], eol: string): string {
  if (flowInputs.length === 0) {
    return ''
  }

  const defaultsEntries = flowInputs
    .map((input) => `  ${input.name}: ${quoteString(input.defaultValue)},`)
    .join(eol)
  const exposedEntries = flowInputs
    .filter((input) => input.exposeAtRunStart)
    .map((input) => quoteString(input.name))
    .join(', ')

  return [
    `function ${FLOW_RESOLVER_NAME}(defaults: Record<string, string>, _exposedAtRunStart: readonly string[], rawOverrides?: string) {`,
    '  if (!rawOverrides) {',
    '    return defaults',
    '  }',
    '',
    '  try {',
    '    const parsed = JSON.parse(rawOverrides) as Record<string, unknown>',
    "    const overrides = Object.fromEntries(Object.entries(parsed ?? {}).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'))",
    '    return { ...defaults, ...overrides }',
    '  } catch {',
    '    return defaults',
    '  }',
    '}',
    `const ${FLOW_DEFAULTS_NAME} = {`,
    defaultsEntries,
    '};',
    `const ${FLOW_EXPOSED_NAME} = [${exposedEntries}];`,
    `const ${FLOW_INPUT_NAME} = ${FLOW_RESOLVER_NAME}(${FLOW_DEFAULTS_NAME}, ${FLOW_EXPOSED_NAME}, process.env.${FLOW_ENV_VAR});`,
  ].join(eol)
}

function renderBody(
  blocks: TestBlock[],
  definitions: ServerBlockDefinition[],
  eol: string,
  context: ServerBlockContext = {}
): string {
  if (blocks.length === 0) {
    return ''
  }

  const definitionsByKind = new Map(definitions.map((definition) => [definition.kind, definition] as const))
  return blocks
    .map((block) => indentBlock(renderBlock(block, definitionsByKind, context), eol, '  '))
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

function renderBlock(
  block: TestBlock,
  definitionsByKind: Map<string, ServerBlockDefinition>,
  context: ServerBlockContext
): string {
  const definition = definitionsByKind.get(block.kind)
  if (definition) {
    return definition.render(block, context)
  }

  const code = typeof block.values['code'] === 'string' ? block.values['code'] : ''
  if (code.trim().length === 0) {
    return `// ${sanitiseTitle(block.title)}`
  }
  return `// ${sanitiseTitle(block.title)}\n${code}`
}

function parseTemplatePlaceholder(expression: ts.Expression, accessorNames: string[]): string | null {
  if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
    return null
  }

  if (!accessorNames.includes(expression.expression.text)) {
    return null
  }

  return expression.name.text
}

function collectTemplateTokens(value: string): Array<{ match: string; name: string; index: number }> {
  const matches: Array<{ match: string; name: string; index: number }> = []
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    matches.push({
      match: match[0],
      name: match[1] ?? '',
      index: match.index ?? 0,
    })
  }
  return matches
}

function quoteString(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`
}

function escapeTemplateSegment(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

function indentBlock(block: string, eol: string, indent: string): string {
  return block
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : indent))
    .join(eol)
}

function sanitiseTitle(title: string): string {
  return title.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}
