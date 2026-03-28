// AI Interface Preparation — stub only, not implemented in v1.
// Providers planned for v2: OpenAI, Anthropic, local model.
// AI is built on top of the project model — not woven into it.

export interface TestGenerationProvider {
  generateTest(prompt: string, context: ProjectContext): Promise<GeneratedTest>
}

export type ProjectContext = {
  rootPath: string
  testFiles: string[]
  framework: 'playwright'
}

export type GeneratedTest = {
  code: string
  suggestedPath: string
}
