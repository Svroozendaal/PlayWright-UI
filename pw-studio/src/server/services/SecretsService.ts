const SERVICE_NAME = 'pw-studio'

export class SecretsService {
  async setSecret(projectId: string, envName: string, key: string, value: string): Promise<void> {
    const keytar = await this.getKeytar()
    const account = `project/${projectId}/${envName}/${key}`
    await keytar.setPassword(SERVICE_NAME, account, value)
  }

  async getSecret(projectId: string, envName: string, key: string): Promise<string | null> {
    const keytar = await this.getKeytar()
    const account = `project/${projectId}/${envName}/${key}`
    return keytar.getPassword(SERVICE_NAME, account)
  }

  async deleteSecret(projectId: string, envName: string, key: string): Promise<void> {
    const keytar = await this.getKeytar()
    const account = `project/${projectId}/${envName}/${key}`
    await keytar.deletePassword(SERVICE_NAME, account).catch(() => {
      // Secret may not exist, ignore.
    })
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const keytar = await this.getKeytar()
      await keytar.getPassword(SERVICE_NAME, '__availability_check__')
      return true
    } catch {
      return false
    }
  }

  private async getKeytar(): Promise<typeof import('keytar')> {
    try {
      return await import('keytar')
    } catch {
      throw new SecretsUnavailableError(
        'Keychain not available. Ensure the platform credential store is available before using secrets.'
      )
    }
  }
}

export class SecretsUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretsUnavailableError'
  }
}
