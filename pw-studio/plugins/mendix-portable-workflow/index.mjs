import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLUGIN_ID = 'mendix-portable-workflow'

const DEFAULT_HELPER_TARGET = path.join('tests', 'support', 'mendix-pointers.ts')
const DEFAULT_MAP_TARGET = path.join('.pw-studio', 'plugins', PLUGIN_ID, 'mendix-map.json')
const DEFAULT_RECORDINGS_DIR = path.join('tests', 'recordings')
const DEFAULT_PORTABLE_DIR = path.join('tests', 'portable')

function readAsset(relativePath) {
  return fs.readFileSync(path.join(__dirname, 'assets', relativePath), 'utf8')
}

function ensureDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
}

function ensureProjectFile(targetPath, content, logger) {
  if (fs.existsSync(targetPath)) {
    return false
  }

  ensureDir(targetPath)
  fs.writeFileSync(targetPath, content, 'utf8')
  logger.info(`created ${targetPath}`)
  return true
}

function scaffoldProject(rootPath, logger) {
  fs.mkdirSync(path.join(rootPath, DEFAULT_RECORDINGS_DIR), { recursive: true })
  fs.mkdirSync(path.join(rootPath, DEFAULT_PORTABLE_DIR), { recursive: true })

  ensureProjectFile(
    path.join(rootPath, DEFAULT_HELPER_TARGET),
    readAsset('mendix-pointers.ts'),
    logger
  )
  ensureProjectFile(
    path.join(rootPath, DEFAULT_MAP_TARGET),
    readAsset('mendix-map.example.json'),
    logger
  )
}

function getPluginConfig(runtime, rootPath) {
  const config = runtime.getProjectPluginConfig(rootPath, PLUGIN_ID) ?? {}
  const helperFile = typeof config.helperFile === 'string' && config.helperFile.trim()
    ? config.helperFile
    : DEFAULT_HELPER_TARGET
  const mapFile = typeof config.mapFile === 'string' && config.mapFile.trim()
    ? config.mapFile
    : DEFAULT_MAP_TARGET

  if (!config.helperFile || !config.mapFile) {
    runtime.saveProjectPluginConfig(rootPath, PLUGIN_ID, {
      ...config,
      helperFile,
      mapFile,
    })
  }

  return { helperFile, mapFile }
}

function readMap(rootPath, runtime) {
  const { mapFile } = getPluginConfig(runtime, rootPath)
  const mapPath = path.join(rootPath, mapFile)
  if (!fs.existsSync(mapPath)) {
    return {}
  }

  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'))
  } catch {
    return {}
  }
}

function getHelperImport(rootPath, outputPath, runtime) {
  const { helperFile } = getPluginConfig(runtime, rootPath)
  const helperAbsolute = path.join(rootPath, helperFile)
  const importPath = path.relative(path.dirname(outputPath), helperAbsolute).replace(/\\/g, '/')
  return importPath.startsWith('.') ? importPath.replace(/\.ts$/, '') : `./${importPath.replace(/\.ts$/, '')}`
}

function isLikelyDynamicValue(value) {
  return /\d/.test(value) || /[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)
}

function inferContainerHint(state, mapConfig) {
  const key = `${state.lastMenu || ''}::${state.lastTab || ''}`.toLowerCase()
  if (mapConfig.contextToContainer && mapConfig.contextToContainer[key]) {
    return mapConfig.contextToContainer[key]
  }
  return mapConfig.defaultContainer || 'auto'
}

function injectHelperImport(source, helperImport) {
  if (source.includes(`from '${helperImport}'`) || source.includes(`from "${helperImport}"`)) {
    return { source, inserted: false }
  }

  const importLine = `import { mx } from '${helperImport}';`
  if (source.includes("import { test")) {
    return {
      source: source.replace(/import\s+\{\s*test[^;]*;\s*/, (match) => `${match}\n${importLine}\n`),
      inserted: true,
    }
  }

  return {
    source: `${importLine}\n${source}`,
    inserted: true,
  }
}

function normalizeRecorderSource(source, mapConfig, helperImport) {
  const lines = source.split(/\r?\n/)
  const state = { lastMenu: '', lastTab: '' }
  let changed = false
  const appliedChanges = []

  const out = lines.map((line) => {
    const menuMatch = line.match(/getByRole\('menuitem',\s*\{\s*name:\s*'([^']+)'\s*\}\)\.click/)
    if (menuMatch) state.lastMenu = menuMatch[1]

    const tabMatch = line.match(/getByRole\('tab',\s*\{\s*name:\s*'([^']+)'\s*\}\)\.click/)
    if (tabMatch) state.lastTab = tabMatch[1]

    const cellMatch = line.match(
      /^(\s*)await\s+(.+?)\.getByRole\('cell',\s*\{\s*name:\s*'([^']+)'\s*\}\)\.click\(\);?\s*$/
    )
    if (!cellMatch) {
      return line
    }

    const indent = cellMatch[1]
    const scope = cellMatch[2]
    const value = cellMatch[3]
    const container = inferContainerHint(state, mapConfig)
    const confidence = isLikelyDynamicValue(value) ? 'high' : 'medium'
    changed = true
    appliedChanges.push(`Replaced brittle Mendix cell click for "${value}" with mx.clickRowCell().`)

    return `${indent}await mx.clickRowCell(${scope}, { valueHint: '${escapeString(value)}', container: '${escapeString(container)}', confidence: '${confidence}' });`
  })

  let code = out.join('\n')
  let insertedImport = false

  if (changed) {
    const imported = injectHelperImport(code, helperImport)
    code = imported.source
    insertedImport = imported.inserted
    if (insertedImport) {
      appliedChanges.push('Injected Mendix helper import.')
    }
  }

  return { code, changed, insertedImport, appliedChanges }
}

function escapeString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function readStringValue(block, key) {
  const value = block.values[key]
  return typeof value === 'string' ? value : ''
}

function parseMendixClickRowCell(statement, title) {
  if (!ts.isExpressionStatement(statement)) {
    return null
  }

  const expression = ts.isAwaitExpression(statement.expression)
    ? statement.expression.expression
    : statement.expression

  if (!ts.isCallExpression(expression)) {
    return null
  }

  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'clickRowCell' ||
    !ts.isIdentifier(expression.expression.expression) ||
    expression.expression.expression.text !== 'mx'
  ) {
    return null
  }

  const scope = expression.arguments[0]?.getText(statement.getSourceFile()) ?? 'page'
  const options = expression.arguments[1]
  if (!options || !ts.isObjectLiteralExpression(options)) {
    return null
  }

  let value = ''
  let container = 'auto'
  let confidence = 'medium'

  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      continue
    }

    const key = property.name.text
    const stringValue = getStringLiteral(property.initializer)
    if (key === 'valueHint' && stringValue !== null) {
      value = stringValue
    }
    if (key === 'container' && stringValue !== null) {
      container = stringValue
    }
    if (key === 'confidence' && stringValue !== null) {
      confidence = stringValue
    }
  }

  return {
    id: randomUUID(),
    title: title ?? '',
    kind: 'mx_click_row_cell',
    values: {
      scope,
      value,
      container,
      confidence,
    },
  }
}

function getStringLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  return null
}

function renderMendixClickRowCell(block) {
  const scope = readStringValue(block, 'scope') || 'page'
  const value = readStringValue(block, 'value')
  const container = readStringValue(block, 'container') || 'auto'
  const confidence = readStringValue(block, 'confidence') || 'medium'
  const titleComment = block.title.trim().length > 0 ? ` // ${block.title.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()}` : ''

  return `await mx.clickRowCell(${scope}, { valueHint: '${escapeString(value)}', container: '${escapeString(container)}', confidence: '${escapeString(confidence)}' });${titleComment}`
}

const plugin = {
  setup(ctx) {
    ctx.runtime.registerProjectSetup(PLUGIN_ID, {
      onEnable: async (rootPath) => {
        scaffoldProject(rootPath, ctx.logger)
        getPluginConfig(ctx.runtime, rootPath)
      },
    })

    ctx.runtime.registerRecorderTransform({
      id: `${PLUGIN_ID}.normalize-recorder`,
      name: 'Mendix Portable Normalizer',
      pluginId: PLUGIN_ID,
      transform: (input) => {
        const mapConfig = readMap(input.rootPath, ctx.runtime)
        const helperImport = getHelperImport(input.rootPath, input.outputPath, ctx.runtime)
        const normalized = normalizeRecorderSource(input.content, mapConfig, helperImport)
        if (!normalized.changed) {
          return { content: input.content }
        }

        return {
          content: normalized.code,
          appliedChanges: normalized.appliedChanges,
          suggestions: [
            {
              kind: 'maintainability',
              title: 'Review generated Mendix helper clicks',
              detail: 'The recorder replaced data-specific Mendix cell clicks with mx.clickRowCell(). Verify container hints on the resulting test.',
            },
          ],
        }
      },
    })

    ctx.runtime.registerBlockDefinition({
      kind: 'mx_click_row_cell',
      name: 'Mendix row cell click',
      description: 'Click a Mendix grid row cell through the portable helper instead of data-specific selectors.',
      category: 'Mendix',
      defaultTitle: 'click mendix row cell',
      builtIn: false,
      pluginId: PLUGIN_ID,
      fields: [
        { key: 'scope', label: 'Scope', type: 'text', required: true, placeholder: 'page' },
        { key: 'value', label: 'Value hint', type: 'text', required: true, placeholder: 'Achternaam1023' },
        { key: 'container', label: 'Container', type: 'text', required: true, placeholder: 'auto' },
        {
          key: 'confidence',
          label: 'Confidence',
          type: 'select',
          required: true,
          options: [
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
            { label: 'Low', value: 'low' },
          ],
        },
      ],
      display: {
        label: 'Click Mendix row cell',
        detailSource: 'value',
        quoteDetail: true,
        separator: ' ',
      },
      parseStatement: (statement, title) => parseMendixClickRowCell(statement, title),
      render: (block) => renderMendixClickRowCell(block),
    })

    ctx.runtime.registerBlockTemplate({
      id: 'mendix-click-row-cell',
      name: 'Mendix row cell click',
      description: 'Portable Mendix row-cell click through the mx helper.',
      category: 'Mendix',
      pluginId: PLUGIN_ID,
      block: {
        kind: 'mx_click_row_cell',
        values: {
          scope: 'page',
          value: 'Example value',
          container: 'auto',
          confidence: 'medium',
        },
      },
      display: {
        label: 'Click Mendix row cell',
        detailSource: 'value',
        quoteDetail: true,
        separator: ' ',
      },
    })
  },
}

export default plugin
