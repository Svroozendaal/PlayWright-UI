import path from 'path'
import type {
  CodegenExtraction,
  CodegenExtractionKind,
  CodegenOptions,
  CodegenSuggestion,
  RecorderSaveResult,
} from '../../shared/types/ipc'

type RefineResult = RecorderSaveResult & {
  content: string
}

type ValueOccurrence = {
  method: 'goto' | 'fill' | 'press' | 'selectOption'
  literal: string
  occurrences: number
}

type ValueMapping = ValueOccurrence & {
  kind: CodegenExtractionKind
  name: string
}

const ACTION_METHODS = [
  'click',
  'fill',
  'press',
  'check',
  'uncheck',
  'hover',
  'dblclick',
  'selectOption',
  'focus',
  'blur',
  'setInputFiles',
  'dragTo',
]

const GENERIC_TEST_TITLES = new Set(['', 'test', 'recorded test', 'recording'])

function toWords(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function toCamelCase(value: string, fallback: string): string {
  const words = toWords(value)
  const first = words[0]

  if (!first) {
    return fallback
  }

  const rest = words.slice(1)
  const initial = `${first.charAt(0).toLowerCase()}${first.slice(1)}`
  const combined = `${initial}${rest
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join('')}`

  if (!/^[A-Za-z_]/.test(combined)) {
    return `${fallback}${combined.charAt(0).toUpperCase()}${combined.slice(1)}`
  }

  return combined
}

function humanizeFileName(outputPath: string): string {
  const baseName = path.basename(outputPath).replace(/\.[^.]+$/, '')
  const stripped = baseName.replace(/\.(spec|test)$/i, '')
  const words = toWords(stripped)

  if (words.length === 0) {
    return 'recorded flow'
  }

  return words.map((word) => word.toLowerCase()).join(' ')
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function makeUniqueName(baseName: string, usedNames: Set<string>, fallbackPrefix: string): string {
  let candidate = baseName || fallbackPrefix
  let suffix = 2

  while (usedNames.has(candidate)) {
    candidate = `${baseName || fallbackPrefix}${suffix}`
    suffix += 1
  }

  usedNames.add(candidate)
  return candidate
}

function extractTestTitle(content: string): string {
  const match = content.match(/test\(\s*(['"`])([^'"`]*)\1\s*,\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{/)
  return match?.[2]?.trim() ?? 'recorded flow'
}

function renameGenericTestTitle(content: string, outputPath: string): {
  content: string
  renamed: boolean
  title: string
} {
  const currentTitle = extractTestTitle(content)
  if (!GENERIC_TEST_TITLES.has(currentTitle.toLowerCase())) {
    return { content, renamed: false, title: currentTitle }
  }

  const nextTitle = humanizeFileName(outputPath)
  return {
    content: content.replace(
      /test\(\s*(['"`])([^'"`]*)\1(\s*,\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{)/,
      `test(${quoteLiteral(nextTitle)}$3`
    ),
    renamed: true,
    title: nextTitle,
  }
}

function extractLocatorExpression(line: string): string | null {
  const pattern = new RegExp(`await\\s+(page\\..+?)(?=\\.(?:${ACTION_METHODS.join('|')})\\()`)
  const match = line.match(pattern)
  return match?.[1] ?? null
}

function deriveNameFromSelector(selector: string): string {
  const testIdMatch = selector.match(/data-testid=["']([^"']+)["']/i)
  if (testIdMatch?.[1]) {
    return `${toCamelCase(testIdMatch[1], 'item')}TestId`
  }

  const idMatch = selector.match(/#([A-Za-z0-9_-]+)/)
  if (idMatch?.[1]) {
    return `${toCamelCase(idMatch[1], 'item')}Element`
  }

  const classMatch = selector.match(/\.([A-Za-z0-9_-]+)/)
  if (classMatch?.[1]) {
    return `${toCamelCase(classMatch[1], 'item')}Element`
  }

  return `${toCamelCase(selector, 'target')}Locator`
}

function deriveLocatorName(expression: string, usedNames: Set<string>): string {
  const roleMatch = expression.match(
    /getByRole\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`][^}]*\}\s*\)/
  )
  if (roleMatch?.[1] && roleMatch?.[2]) {
    const base = toCamelCase(`${roleMatch[2]} ${roleMatch[1]}`, 'locator')
    return makeUniqueName(base, usedNames, 'locator')
  }

  const textMethodMatch = expression.match(
    /getBy(Label|Text|Placeholder|TestId|AltText|Title)\(\s*['"`]([^'"`]+)['"`]/
  )
  if (textMethodMatch?.[1] && textMethodMatch?.[2]) {
    const suffixMap: Record<string, string> = {
      Label: 'Field',
      Text: 'Text',
      Placeholder: 'Field',
      TestId: 'TestId',
      AltText: 'Image',
      Title: 'Element',
    }
    const suffix = suffixMap[textMethodMatch[1]] ?? 'Element'
    const base = toCamelCase(`${textMethodMatch[2]} ${suffix}`, 'locator')
    return makeUniqueName(base, usedNames, 'locator')
  }

  const locatorMatch = expression.match(/locator\(\s*['"`]([^'"`]+)['"`]\s*\)/)
  if (locatorMatch?.[1]) {
    const base = deriveNameFromSelector(locatorMatch[1])
    return makeUniqueName(base, usedNames, 'locator')
  }

  return makeUniqueName('targetLocator', usedNames, 'locator')
}

function collectLocatorMappings(lines: string[]): ValueMapping[] {
  const counts = new Map<string, number>()

  for (const line of lines) {
    const locatorExpression = extractLocatorExpression(line)
    if (!locatorExpression) {
      continue
    }

    counts.set(locatorExpression, (counts.get(locatorExpression) ?? 0) + 1)
  }

  const usedNames = new Set<string>()

  return [...counts.entries()]
    .filter(([, occurrences]) => occurrences >= 2)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([value, occurrences]) => ({
      kind: 'selector' as const,
      method: 'fill',
      literal: value,
      occurrences,
      name: deriveLocatorName(value, usedNames),
    }))
}

function deriveValueName(
  occurrence: ValueOccurrence,
  options: CodegenOptions,
  usedNames: Set<string>
): {
  name: string
  kind: CodegenExtractionKind
} {
  if (occurrence.method === 'goto') {
    if (options.startUrl && occurrence.literal === options.startUrl) {
      return {
        name: makeUniqueName('startUrl', usedNames, 'pageUrl'),
        kind: 'url',
      }
    }

    return {
      name: makeUniqueName('pageUrl', usedNames, 'pageUrl'),
      kind: 'url',
    }
  }

  if (occurrence.method === 'press') {
    const keyName = occurrence.literal.replace(/\+/g, ' plus ')
    return {
      name: makeUniqueName(`${toCamelCase(keyName, 'key')}Key`, usedNames, 'shortcutKey'),
      kind: 'value',
    }
  }

  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(occurrence.literal)) {
    return {
      name: makeUniqueName('emailAddress', usedNames, 'value'),
      kind: 'value',
    }
  }

  if (/password/i.test(occurrence.literal)) {
    return {
      name: makeUniqueName('passwordValue', usedNames, 'value'),
      kind: 'value',
    }
  }

  return {
    name: makeUniqueName(`${toCamelCase(occurrence.literal, 'value')}Value`, usedNames, 'value'),
    kind: 'value',
  }
}

function collectValueMappings(lines: string[], options: CodegenOptions): ValueMapping[] {
  const counts = new Map<string, ValueOccurrence>()
  const pattern = /\.(goto|fill|press|selectOption)\((['"`])([^'"`]+)\2\)/

  for (const line of lines) {
    const match = line.match(pattern)
    if (!match?.[1] || !match[3]) {
      continue
    }

    const method = match[1] as ValueOccurrence['method']
    const literal = match[3]
    const key = `${method}:${literal}`
    const existing = counts.get(key)

    counts.set(key, {
      method,
      literal,
      occurrences: (existing?.occurrences ?? 0) + 1,
    })
  }

  const usedNames = new Set<string>()

  return [...counts.values()]
    .filter(
      (occurrence) =>
        occurrence.occurrences >= 2 ||
        (occurrence.method === 'goto' &&
          !!options.startUrl &&
          occurrence.literal === options.startUrl)
    )
    .map((occurrence) => {
      const derived = deriveValueName(occurrence, options, usedNames)
      return {
        ...occurrence,
        ...derived,
      }
    })
}

function replaceLocators(lines: string[], mappings: ValueMapping[]): string[] {
  const locatorMappings = mappings
    .filter((mapping) => mapping.kind === 'selector')
    .sort((a, b) => b.literal.length - a.literal.length)

  return lines.map((line) => {
    let nextLine = line

    for (const mapping of locatorMappings) {
      if (nextLine.includes(mapping.literal)) {
        nextLine = nextLine.split(mapping.literal).join(mapping.name)
      }
    }

    return nextLine
  })
}

function replaceValues(lines: string[], mappings: ValueMapping[]): string[] {
  const valueMappings = new Map(
    mappings
      .filter((mapping) => mapping.kind !== 'selector')
      .map((mapping) => [`${mapping.method}:${mapping.literal}`, mapping.name])
  )

  return lines.map((line) =>
    line.replace(
      /\.(goto|fill|press|selectOption)\((['"`])([^'"`]+)\2\)/g,
      (match, method: string, _quote: string, literal: string) => {
        const replacement = valueMappings.get(`${method}:${literal}`)
        if (!replacement) {
          return match
        }

        return `.${method}(${replacement})`
      }
    )
  )
}

function insertConstantBlock(content: string, constantLines: string[]): string {
  if (constantLines.length === 0) {
    return content
  }

  const lines = content.split('\n')
  const bodyStartIndex = lines.findIndex((line) => /async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{/.test(line))

  if (bodyStartIndex === -1) {
    return content
  }

  return [
    ...lines.slice(0, bodyStartIndex + 1),
    ...constantLines.map((line) => `  ${line}`),
    '',
    ...lines.slice(bodyStartIndex + 1),
  ].join('\n')
}

function normaliseWhitespace(content: string): {
  content: string
  changed: boolean
} {
  const lines = content.split(/\r?\n/).map((line) => line.replace(/\s+$/, ''))
  const compacted: string[] = []

  for (const line of lines) {
    if (line === '' && compacted[compacted.length - 1] === '') {
      continue
    }

    compacted.push(line)
  }

  const nextContent = `${compacted.join('\n').trimEnd()}\n`
  return {
    content: nextContent,
    changed: nextContent !== content,
  }
}

function buildExtractions(mappings: ValueMapping[]): CodegenExtraction[] {
  return mappings.map((mapping) => ({
    kind: mapping.kind,
    name: mapping.name,
    value: mapping.literal,
    occurrences: mapping.occurrences,
  }))
}

function buildSuggestions(params: {
  content: string
  actionCount: number
  extractions: CodegenExtraction[]
}): CodegenSuggestion[] {
  const suggestions: CodegenSuggestion[] = []
  const selectorCount = params.extractions.filter((extraction) => extraction.kind === 'selector').length
  const valueCount = params.extractions.filter((extraction) => extraction.kind !== 'selector').length

  if (!/expect\s*\(/.test(params.content)) {
    suggestions.push({
      kind: 'structure',
      title: 'Add assertions to the recorded journey',
      detail: 'The generated flow is interaction-heavy. Add `expect(...)` checks so the test proves behaviour instead of only replaying clicks and input.',
    })
  }

  if (selectorCount > 0) {
    suggestions.push({
      kind: 'selector',
      title: 'Promote extracted selectors into reusable UI helpers',
      detail: 'Repeated locators were promoted into constants. If this flow becomes stable, move the strongest ones into a page object or helper module.',
    })
  }

  if (valueCount > 0) {
    suggestions.push({
      kind: 'cleanup',
      title: 'Review extracted literal values',
      detail: 'Repeated URLs and input values were promoted into constants. If they represent environment data or credentials, move them into fixtures or environment config next.',
    })
  }

  if (params.actionCount >= 12) {
    suggestions.push({
      kind: 'maintainability',
      title: 'Consider splitting the journey into smaller steps',
      detail: `This recording contains ${params.actionCount} awaited actions. Breaking it into smaller tests or helper functions will make failures easier to diagnose.`,
    })
  }

  return suggestions
}

export function refineGeneratedCode(content: string, options: CodegenOptions): RefineResult {
  let workingContent = content.replace(/\r\n/g, '\n')
  const appliedChanges: string[] = []

  const renamed = renameGenericTestTitle(workingContent, options.outputPath)
  workingContent = renamed.content
  if (renamed.renamed) {
    appliedChanges.push(`Renamed the generic test title to "${renamed.title}".`)
  }

  let lines = workingContent.split('\n')
  const locatorMappings = collectLocatorMappings(lines)
  lines = replaceLocators(lines, locatorMappings)

  const valueMappings = collectValueMappings(lines, options)
  lines = replaceValues(lines, valueMappings)

  const constantLines = [
    ...valueMappings.map((mapping) => `const ${mapping.name} = ${quoteLiteral(mapping.literal)}`),
    ...locatorMappings.map((mapping) => `const ${mapping.name} = ${mapping.literal}`),
  ]

  if (locatorMappings.length > 0) {
    appliedChanges.push(
      `Promoted ${locatorMappings.length} repeated selector${locatorMappings.length === 1 ? '' : 's'} into local constants.`
    )
  }

  if (valueMappings.length > 0) {
    appliedChanges.push(
      `Promoted ${valueMappings.length} repeated literal ${valueMappings.length === 1 ? 'value' : 'values'} into local constants.`
    )
  }

  workingContent = insertConstantBlock(lines.join('\n'), constantLines)

  const normalised = normaliseWhitespace(workingContent)
  workingContent = normalised.content
  if (normalised.changed) {
    appliedChanges.push('Removed redundant blank lines and normalised generated formatting.')
  }

  const extractions = buildExtractions([...valueMappings, ...locatorMappings])
  const actionCount = workingContent
    .split('\n')
    .filter((line) => line.trimStart().startsWith('await '))
    .length
  const suggestions = buildSuggestions({
    content: workingContent,
    actionCount,
    extractions,
  })

  return {
    outputPath: options.outputPath,
    testTitle: extractTestTitle(workingContent),
    transformed: appliedChanges.length > 0,
    actionCount,
    appliedChanges,
    extractions,
    suggestions,
    content: workingContent,
  }
}
