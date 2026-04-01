import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { z } from 'zod'
import { ERROR_CODES } from '../../shared/types/ipc'
import type {
  BlockFieldValue,
  FlowInputDefinition,
  TestBlock,
  TestCaseRef,
  TestEditorDocument,
  TestEditorLibraryPayload,
  TestEditorMode,
} from '../../shared/types/ipc'
import { ApiRouteError } from '../middleware/envelope'
import type { PluginRuntimeService } from '../plugins/runtime'
import { resolveUserDataPath } from '../utils/paths'
import { BlockLibraryService } from './BlockLibraryService'
import {
  appendTestToSource,
  buildDocumentFromParsedTest,
  parseSnippetToDocument,
  parseTestSource,
  renderDocumentCode,
  replaceTestInSource,
  validateRawCodeBlocks,
} from '../utils/testEditorAst'

const DEFAULT_TEMPLATE = {
  callee: 'test',
  extraArgs: [],
  callbackStyle: 'arrow' as const,
  callbackParams: '{ page }',
  callbackAsync: true,
}

const persistedTestCaseRefSchema = z.object({
  ordinal: z.number().int().nonnegative(),
  testTitle: z.string(),
})

const selectorSchema = z.object({
  strategy: z.enum(['role', 'text', 'label', 'test_id', 'css']),
  value: z.string(),
  name: z.string().optional(),
})

const testReferenceSchema = z.object({
  filePath: z.string(),
  ordinal: z.number().int().nonnegative(),
  testTitle: z.string(),
})

const flowInputMappingSchema = z.object({
  targetName: z.string(),
  source: z.enum(['flow_input', 'literal']),
  value: z.string(),
})

const blockFieldValueSchema: z.ZodType<BlockFieldValue> = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.null(),
  selectorSchema,
  testReferenceSchema,
  z.array(flowInputMappingSchema),
])

const persistedBlockSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  templateId: z.string().min(1).optional(),
  kind: z.string().min(1),
  values: z.record(z.string(), blockFieldValueSchema),
})

const persistedTemplateSchema = z.object({
  callee: z.string().min(1),
  extraArgs: z.array(z.string()),
  callbackStyle: z.enum(['arrow', 'function']),
  callbackParams: z.string(),
  callbackAsync: z.boolean(),
})

const flowInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  defaultValue: z.string(),
  exposeAtRunStart: z.boolean(),
})

const persistedDocumentSchema = z.object({
  mode: z.enum(['existing', 'create']),
  filePath: z.string().min(1),
  testTitle: z.string(),
  flowInputs: z.array(flowInputSchema),
  constants: z.array(z.string()).default([]),
  locatorConstants: z.array(z.string()).default([]),
  blocks: z.array(persistedBlockSchema),
  code: z.string(),
  warnings: z.array(z.string()),
  template: persistedTemplateSchema,
  testCaseRef: persistedTestCaseRefSchema.optional(),
})

const persistedEntrySchema = z.object({
  filePath: z.string().min(1),
  testCaseRef: persistedTestCaseRefSchema,
  codeFingerprint: z.string().min(1),
  updatedAt: z.string().min(1),
  document: persistedDocumentSchema,
})

const visualStoreSchema = z.record(z.string(), persistedEntrySchema)

export class TestEditorService {
  constructor(
    private readonly blockLibrary: BlockLibraryService,
    private readonly pluginRuntime: PluginRuntimeService
  ) {}

  loadExisting(rootPath: string, filePath: string, testCaseRef: TestCaseRef): TestEditorDocument {
    const source = this.readProjectFile(rootPath, filePath)
    const parsed = parseTestSource(source, filePath)
    const found = parsed.testCases.find((testCase) => testCase.ordinal === testCaseRef.ordinal)

    if (!found) {
      throw new ApiRouteError(
        ERROR_CODES.TEST_CASE_NOT_FOUND,
        `Test case not found in file: ${filePath}`,
        404
      )
    }

    const cached = this.loadPersistedVisualDocument(rootPath, filePath, found.testCaseRef, found.snippet)
    if (cached) {
      return cached
    }

    const stored = this.readPersistedVisualEntry(filePath, found.testCaseRef)
    const built = buildDocumentFromParsedTest(found, filePath, 'existing', this.getDefinitions(rootPath))
    const hydrated = stored ? this.mergeStoredBlockState(built, stored.document) : built
    this.persistVisualDocument(hydrated, found.snippet)
    return hydrated
  }

  createDraft(rootPath: string, filePath: string): TestEditorDocument {
    this.assertProjectFile(rootPath, filePath)

    const draft: TestEditorDocument = {
      mode: 'create',
      filePath,
      testTitle: 'New visual test',
      flowInputs: [],
      constants: [],
      locatorConstants: [],
      blocks: [],
      code: '',
      warnings: [],
      template: DEFAULT_TEMPLATE,
    }

    return {
      ...draft,
      code: renderDocumentCode(draft, this.getDefinitions(rootPath), {
        rootPath,
        documentFilePath: draft.filePath,
        constants: draft.constants,
      }),
    }
  }

  syncCode(
    rootPath: string,
    filePath: string,
    mode: TestEditorMode,
    code: string,
    testCaseRef?: TestCaseRef
  ): TestEditorDocument {
    try {
      const document = parseSnippetToDocument(code, filePath, mode, this.getDefinitions(rootPath))
      return {
        ...document,
        testCaseRef: mode === 'existing' ? testCaseRef ?? document.testCaseRef : document.testCaseRef,
      }
    } catch (error) {
      throw new ApiRouteError(
        ERROR_CODES.INVALID_INPUT,
        error instanceof Error ? error.message : String(error),
        400
      )
    }
  }

  save(rootPath: string, document: TestEditorDocument): TestEditorDocument {
    const inputErrors = this.validateFlowInputs(document.flowInputs)
    if (inputErrors.length > 0) {
      throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, inputErrors.join('\n'), 400)
    }

    const titleErrors = this.validateBlockTitles(document.blocks)
    if (titleErrors.length > 0) {
      throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, titleErrors.join('\n'), 400)
    }

    const syntaxErrors = validateRawCodeBlocks(document.blocks, this.getDefinitions(rootPath), {
      rootPath,
      documentFilePath: document.filePath,
      documentTestCaseRef: document.testCaseRef,
    })
    if (syntaxErrors.length > 0) {
      throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, syntaxErrors.join('\n\n'), 400)
    }

    if (document.mode === 'create') {
      return this.saveNewTest(rootPath, document)
    }

    return this.saveExisting(rootPath, document)
  }

  getLibraryTemplates(rootPath?: string): TestEditorLibraryPayload {
    return this.blockLibrary.getEditorLibrary(rootPath)
  }

  private saveExisting(rootPath: string, document: TestEditorDocument): TestEditorDocument {
    if (!document.testCaseRef) {
      throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, 'Existing test edits require a test reference.', 400)
    }

    const source = this.readProjectFile(rootPath, document.filePath)
    const parsed = parseTestSource(source, document.filePath)
    const current = parsed.testCases.find((testCase) => testCase.ordinal === document.testCaseRef?.ordinal)

    if (!current) {
      throw new ApiRouteError(
        ERROR_CODES.TEST_CASE_NOT_FOUND,
        `Test case not found in file: ${document.filePath}`,
        404
      )
    }

    const rendered = renderDocumentCode(document, this.getDefinitions(rootPath), {
      eol: detectEol(source),
      rootPath,
      documentFilePath: document.filePath,
      documentTestCaseRef: document.testCaseRef,
      constants: document.constants,
    })
    const synced = this.parseRenderedDocument(rootPath, rendered, document.filePath, 'existing')
    const nextSource = replaceTestInSource(source, current, synced.code)
    fs.writeFileSync(this.assertProjectFile(rootPath, document.filePath), nextSource, 'utf8')

    const updated = parseTestSource(nextSource, document.filePath)
    const saved = updated.testCases.find((testCase) => testCase.ordinal === document.testCaseRef?.ordinal)

    if (!saved) {
      throw new ApiRouteError(
        ERROR_CODES.TEST_CASE_NOT_FOUND,
        `Saved test case could not be reloaded from file: ${document.filePath}`,
        404
      )
    }

    const savedDocument = this.mergeStoredBlockState(
      buildDocumentFromParsedTest(saved, document.filePath, 'existing', this.getDefinitions(rootPath)),
      document
    )
    this.persistVisualDocument(savedDocument, saved.snippet)
    return savedDocument
  }

  private saveNewTest(rootPath: string, document: TestEditorDocument): TestEditorDocument {
    const filePath = this.assertProjectFile(rootPath, document.filePath)
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = parseTestSource(source, document.filePath)
    const rendered = renderDocumentCode(document, this.getDefinitions(rootPath), {
      eol: detectEol(source),
      rootPath,
      documentFilePath: document.filePath,
      constants: document.constants,
    })
    const synced = this.parseRenderedDocument(rootPath, rendered, document.filePath, 'create')
    const nextSource = appendTestToSource(source, synced.code, detectEol(source))

    fs.writeFileSync(filePath, nextSource, 'utf8')

    const updated = parseTestSource(nextSource, document.filePath)
    const saved = updated.testCases[parsed.testCases.length]
    if (!saved) {
      throw new ApiRouteError(
        ERROR_CODES.TEST_CASE_NOT_FOUND,
        `New test could not be reloaded from file: ${document.filePath}`,
        404
      )
    }

    const savedDocument = this.mergeStoredBlockState(
      buildDocumentFromParsedTest(saved, document.filePath, 'existing', this.getDefinitions(rootPath)),
      document
    )
    this.persistVisualDocument(savedDocument, saved.snippet)
    return savedDocument
  }

  private readProjectFile(rootPath: string, filePath: string): string {
    const absolute = this.assertProjectFile(rootPath, filePath)
    return fs.readFileSync(absolute, 'utf8')
  }

  private parseRenderedDocument(
    rootPath: string,
    code: string,
    filePath: string,
    mode: TestEditorMode
  ): TestEditorDocument {
    try {
      return parseSnippetToDocument(code, filePath, mode, this.getDefinitions(rootPath))
    } catch (error) {
      throw new ApiRouteError(
        ERROR_CODES.INVALID_INPUT,
        error instanceof Error ? error.message : String(error),
        400
      )
    }
  }

  private validateBlockTitles(blocks: TestBlock[]): string[] {
    const seen = new Set<string>()
    const errors: string[] = []

    for (const block of blocks) {
      const title = block.title.replace(/\s+/g, ' ').trim()
      if (title.length === 0) {
        errors.push(`Block "${block.kind}" is missing a title.`)
        continue
      }

      const normalised = title.toLowerCase()
      if (seen.has(normalised)) {
        errors.push(`Block title must be unique: "${title}".`)
        continue
      }

      seen.add(normalised)
    }

    return errors
  }

  private loadPersistedVisualDocument(
    rootPath: string,
    filePath: string,
    testCaseRef: TestCaseRef,
    snippetCode: string
  ): TestEditorDocument | null {
    const entry = this.readPersistedVisualEntry(filePath, testCaseRef)
    if (!entry) {
      return null
    }

    if (entry.codeFingerprint !== this.hashCode(snippetCode)) {
      return null
    }

    const availableKinds = new Set(this.getDefinitions(rootPath).map((definition) => definition.kind))
    if (!entry.document.blocks.every((block) => availableKinds.has(block.kind))) {
      return null
    }

    return {
      ...entry.document,
      mode: 'existing',
      filePath,
      code: snippetCode,
      testCaseRef,
    }
  }

  private readPersistedVisualEntry(
    filePath: string,
    testCaseRef: TestCaseRef
  ): z.infer<typeof persistedEntrySchema> | null {
    const store = this.readVisualStore()
    return store[this.getVisualStoreKey(filePath, testCaseRef)] ?? null
  }

  private mergeStoredBlockState(
    parsed: TestEditorDocument,
    stored: TestEditorDocument
  ): TestEditorDocument {
    const storedBlocks = new Map(
      stored.blocks.map((block) => [block.title.trim().toLowerCase(), block] as const)
    )
    const storedInputs = new Map(
      stored.flowInputs.map((input) => [input.name.trim().toLowerCase(), input] as const)
    )

    return {
      ...parsed,
      flowInputs: parsed.flowInputs.map((input) => {
        const cached = storedInputs.get(input.name.trim().toLowerCase())
        if (!cached) {
          return input
        }

        return {
          ...input,
          id: cached.id,
        }
      }),
      blocks: parsed.blocks.map((block) => {
        const cached = storedBlocks.get(block.title.trim().toLowerCase())
        if (!cached || cached.kind !== block.kind) {
          return block
        }

        return {
          ...block,
          id: cached.id,
          title: cached.title,
          templateId: cached.templateId,
        }
      }),
    }
  }

  private persistVisualDocument(document: TestEditorDocument, snippetCode: string): void {
    if (!document.testCaseRef) {
      return
    }

    const store = this.readVisualStore()
    store[this.getVisualStoreKey(document.filePath, document.testCaseRef)] = {
      filePath: document.filePath,
      testCaseRef: document.testCaseRef,
      codeFingerprint: this.hashCode(snippetCode),
      updatedAt: new Date().toISOString(),
      document: {
        ...document,
        mode: 'existing',
        code: snippetCode,
      },
    }

    this.writeVisualStore(store)
  }

  private readVisualStore(): Record<string, z.infer<typeof persistedEntrySchema>> {
    const storePath = resolveUserDataPath('visual-test-documents.json')
    if (!fs.existsSync(storePath)) {
      return {}
    }

    try {
      const raw = fs.readFileSync(storePath, 'utf8')
      const parsed = JSON.parse(raw)
      const result = visualStoreSchema.safeParse(parsed)
      return result.success ? result.data : {}
    } catch {
      return {}
    }
  }

  private writeVisualStore(store: Record<string, z.infer<typeof persistedEntrySchema>>): void {
    const storePath = resolveUserDataPath('visual-test-documents.json')
    fs.mkdirSync(path.dirname(storePath), { recursive: true })
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8')
  }

  private getVisualStoreKey(filePath: string, testCaseRef: TestCaseRef): string {
    return `${filePath.replace(/\\/g, '/')}::${testCaseRef.ordinal}`
  }

  private hashCode(value: string): string {
    return createHash('sha1').update(value).digest('hex')
  }

  private validateFlowInputs(flowInputs: FlowInputDefinition[]): string[] {
    const errors: string[] = []
    const seen = new Set<string>()

    for (const input of flowInputs) {
      const name = input.name.trim()
      if (name.length === 0) {
        errors.push('Flow inputs must have a name.')
        continue
      }

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        errors.push(`Invalid flow input name: "${input.name}". Use letters, numbers, and underscores only, and start with a letter or underscore.`)
        continue
      }

      const normalised = name.toLowerCase()
      if (seen.has(normalised)) {
        errors.push(`Flow input names must be unique: "${input.name}".`)
        continue
      }

      seen.add(normalised)
    }

    return errors
  }

  mergeRecordedOutput(
    rootPath: string,
    outputPath: string,
    originalDocument: TestEditorDocument
  ): TestEditorDocument | null {
    const result = this.parseRecordedOutput(rootPath, outputPath, originalDocument)
    if (!result || result.newBlocks.length === 0) return null
    return { ...originalDocument, blocks: [...originalDocument.blocks, ...result.newBlocks] }
  }

  // Returns { newBlocks } — all blocks recorded in the output file — without saving or deleting.
  // The caller decides whether to append or replace.
  parseRecordedOutput(
    rootPath: string,
    outputPath: string,
    originalDocument: TestEditorDocument
  ): { newBlocks: TestBlock[] } | null {
    if (!fs.existsSync(outputPath)) {
      console.log('[parseRecordedOutput] file not found:', outputPath)
      return null
    }
    const recordedSource = fs.readFileSync(outputPath, 'utf8')
    console.log('[parseRecordedOutput] source length:', recordedSource.length, '\n', recordedSource.slice(0, 300))
    const parsed = parseTestSource(recordedSource, outputPath)
    if (parsed.testCases.length === 0) {
      console.log('[parseRecordedOutput] no test cases found')
      return null
    }
    const firstTest = parsed.testCases[0]
    if (!firstTest) return null
    const defs = this.getDefinitions(rootPath)
    const recordedDoc = buildDocumentFromParsedTest(firstTest, originalDocument.filePath, 'existing', defs)
    console.log('[parseRecordedOutput] all blocks:', recordedDoc.blocks.length, recordedDoc.blocks.map(b => b.definitionId))
    // Return only blocks beyond the original prelude count
    const newBlocks = recordedDoc.blocks.slice(originalDocument.blocks.length)
    console.log('[parseRecordedOutput] newBlocks after slice:', newBlocks.length)
    return { newBlocks }
  }

  // Returns the full document from the recorded output (for replace mode), without saving
  parseRecordedOutputFull(
    rootPath: string,
    outputPath: string,
    originalDocument: TestEditorDocument
  ): TestEditorDocument | null {
    if (!fs.existsSync(outputPath)) return null
    const recordedSource = fs.readFileSync(outputPath, 'utf8')
    const parsed = parseTestSource(recordedSource, outputPath)
    if (parsed.testCases.length === 0) return null
    const firstTest = parsed.testCases[0]
    if (!firstTest) return null
    const defs = this.getDefinitions(rootPath)
    const recordedDoc = buildDocumentFromParsedTest(firstTest, originalDocument.filePath, 'existing', defs)
    // Keep original metadata (title, testCaseRef, filePath) but replace blocks
    return { ...originalDocument, blocks: recordedDoc.blocks }
  }

  renderSnippet(rootPath: string, document: TestEditorDocument): string {
    return renderDocumentCode(document, this.getDefinitions(rootPath), {
      rootPath,
      documentFilePath: document.filePath,
      documentTestCaseRef: document.testCaseRef,
      constants: document.constants,
    })
  }

  private getDefinitions(rootPath?: string) {
    return this.pluginRuntime.getAvailableBlockDefinitions(rootPath)
  }

  private assertProjectFile(rootPath: string, filePath: string): string {
    const resolvedRoot = path.resolve(rootPath)
    const resolvedFile = path.resolve(rootPath, filePath)
    if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
      throw new ApiRouteError(
        ERROR_CODES.INVALID_PATH,
        `Path is outside the project root: ${filePath}`,
        400
      )
    }

    if (!fs.existsSync(resolvedFile)) {
      throw new ApiRouteError(ERROR_CODES.INVALID_PATH, `File not found: ${filePath}`, 400)
    }

    const stat = fs.statSync(resolvedFile)
    if (!stat.isFile()) {
      throw new ApiRouteError(ERROR_CODES.INVALID_PATH, `Not a file: ${filePath}`, 400)
    }

    return resolvedFile
  }
}

function detectEol(value: string): string {
  return value.includes('\r\n') ? '\r\n' : '\n'
}
