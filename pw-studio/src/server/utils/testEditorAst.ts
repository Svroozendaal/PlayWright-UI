import { randomUUID } from 'crypto'
import ts from 'typescript'
import type {
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
  blocks: TestBlock[]
  warnings: string[]
}

const PLAYWRIGHT_TEST_CALLEE = /^test(?:\.(?:only|skip|fixme|fail|slow))?$/

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
    blocks: extraction.blocks,
    code: parsed.snippet,
    warnings: extraction.warnings,
    template: parsed.template,
    testCaseRef: mode === 'existing' ? parsed.testCaseRef : undefined,
  }
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
  document: Pick<TestEditorDocument, 'testTitle' | 'blocks' | 'template'>,
  definitions: ServerBlockDefinition[],
  context: ServerBlockContext & { eol?: string } = {}
): string {
  const eol = context.eol ?? '\n'
  const body = renderBody(document.blocks, definitions, eol, context)
  const args = [quoteString(document.testTitle), ...document.template.extraArgs]
  const callback = renderCallback(document.template, body, eol)
  args.push(callback)

  return `${document.template.callee}(${args.join(', ')})`
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
  const blocks: TestBlock[] = []
  const warnings: string[] = []
  const sourceFile = body.getSourceFile()
  const sourceText = sourceFile.text
  const parsers = definitions.filter((definition) => typeof definition.parseStatement === 'function')
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
    const mapped = parsers
      .map((definition) => definition.parseStatement?.(statement, titleComment?.title ?? null))
      .find((value): value is TestBlock => Boolean(value))

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

  const titledBlocks = ensureBlockTitles(blocks, definitions)

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

function sanitiseTitle(title: string): string {
  return title.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}
