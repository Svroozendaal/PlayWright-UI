import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { z } from 'zod'
import { ERROR_CODES } from '../../shared/types/ipc'
import type {
  TestBlock,
  TestCaseRef,
  TestEditorDocument,
  TestEditorLibraryPayload,
  TestEditorMode,
} from '../../shared/types/ipc'
import { ApiRouteError } from '../middleware/envelope'
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

const persistedSelectorSchema = z.object({
  strategy: z.enum(['role', 'text', 'label', 'test_id', 'css']),
  value: z.string(),
  name: z.string().optional(),
})

const persistedBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('raw_code'),
    code: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('goto_url'),
    url: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('click_element'),
    selector: persistedSelectorSchema,
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('fill_field'),
    selector: persistedSelectorSchema,
    value: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    templateId: z.string().min(1).optional(),
    kind: z.literal('expect_url'),
    url: z.string(),
  }),
])

const persistedTemplateSchema = z.object({
  callee: z.string().min(1),
  extraArgs: z.array(z.string()),
  callbackStyle: z.enum(['arrow', 'function']),
  callbackParams: z.string(),
  callbackAsync: z.boolean(),
})

const persistedDocumentSchema = z.object({
  mode: z.enum(['existing', 'create']),
  filePath: z.string().min(1),
  testTitle: z.string(),
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
  constructor(private readonly blockLibrary: BlockLibraryService) {}

  /**
   * Load an existing test case into the canonical visual editor document.
   */
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

    const cached = this.loadPersistedVisualDocument(filePath, found.testCaseRef, found.snippet)
    if (cached) {
      return cached
    }

    const stored = this.readPersistedVisualEntry(filePath, found.testCaseRef)
    const built = buildDocumentFromParsedTest(found, filePath, 'existing')
    const hydrated = stored ? this.mergeStoredBlockState(built, stored.document) : built
    this.persistVisualDocument(hydrated, found.snippet)
    return hydrated
  }

  /**
   * Create a blank visual editor draft for appending a new test to a file.
   */
  createDraft(rootPath: string, filePath: string): TestEditorDocument {
    this.assertProjectFile(rootPath, filePath)

    const draft: TestEditorDocument = {
      mode: 'create',
      filePath,
      testTitle: 'New visual test',
      blocks: [],
      code: '',
      warnings: [],
      template: DEFAULT_TEMPLATE,
    }

    return {
      ...draft,
      code: renderDocumentCode(draft),
    }
  }

  /**
   * Reparse edited code into the canonical visual editor document.
   */
  syncCode(
    filePath: string,
    mode: TestEditorMode,
    code: string,
    testCaseRef?: TestCaseRef
  ): TestEditorDocument {
    try {
      const document = parseSnippetToDocument(code, filePath, mode)
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

  /**
   * Persist the canonical editor document back into the source file.
   */
  save(rootPath: string, document: TestEditorDocument): TestEditorDocument {
    const titleErrors = this.validateBlockTitles(document.blocks)
    if (titleErrors.length > 0) {
      throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, titleErrors.join('\n'), 400)
    }

    const syntaxErrors = validateRawCodeBlocks(document.blocks)
    if (syntaxErrors.length > 0) {
      throw new ApiRouteError(ERROR_CODES.INVALID_INPUT, syntaxErrors.join('\n\n'), 400)
    }

    if (document.mode === 'create') {
      return this.saveNewTest(rootPath, document)
    }

    return this.saveExisting(rootPath, document)
  }

  /**
   * Return built-in plus locally configured block templates.
   */
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

    const rendered = renderDocumentCode(document, detectEol(source))
    const synced = this.parseRenderedDocument(rendered, document.filePath, 'existing')
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
      buildDocumentFromParsedTest(saved, document.filePath, 'existing'),
      document
    )
    this.persistVisualDocument(savedDocument, saved.snippet)
    return savedDocument
  }

  private saveNewTest(rootPath: string, document: TestEditorDocument): TestEditorDocument {
    const filePath = this.assertProjectFile(rootPath, document.filePath)
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = parseTestSource(source, document.filePath)
    const rendered = renderDocumentCode(document, detectEol(source))
    const synced = this.parseRenderedDocument(rendered, document.filePath, 'create')
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
      buildDocumentFromParsedTest(saved, document.filePath, 'existing'),
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
    code: string,
    filePath: string,
    mode: TestEditorMode
  ): TestEditorDocument {
    try {
      return parseSnippetToDocument(code, filePath, mode)
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

    return {
      ...parsed,
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
