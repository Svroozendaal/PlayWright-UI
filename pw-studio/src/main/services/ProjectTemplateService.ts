import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import type { WizardParams } from '../../shared/types/ipc'

export class ProjectTemplateService {
  async create(params: WizardParams): Promise<void> {
    const { rootPath, projectName, browsers, includeExampleTests, includeAuth, includePageObjects, includeFixtures } = params

    // Conflict check
    const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']
    for (const f of configFiles) {
      if (fs.existsSync(path.join(rootPath, f))) {
        throw new ConflictError('Folder already contains a Playwright project')
      }
    }

    // Create root if needed
    fs.mkdirSync(rootPath, { recursive: true })

    // Generate package.json
    const pkg = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      description: `Playwright tests for ${projectName}`,
      scripts: {
        test: 'npx playwright test',
        'test:headed': 'npx playwright test --headed',
        'test:ui': 'npx playwright test --ui',
      },
      devDependencies: {
        '@playwright/test': '^1.48.0',
      },
    }
    fs.writeFileSync(path.join(rootPath, 'package.json'), JSON.stringify(pkg, null, 2))

    // Generate playwright.config.ts
    const configContent = buildPlaywrightConfig(browsers)
    fs.writeFileSync(path.join(rootPath, 'playwright.config.ts'), configContent)

    // Create directories
    fs.mkdirSync(path.join(rootPath, 'tests'), { recursive: true })

    if (includePageObjects) {
      fs.mkdirSync(path.join(rootPath, 'pages'), { recursive: true })
      fs.writeFileSync(
        path.join(rootPath, 'pages', 'example.page.ts'),
        buildExamplePage()
      )
    }

    if (includeFixtures) {
      fs.mkdirSync(path.join(rootPath, 'fixtures'), { recursive: true })
      fs.writeFileSync(
        path.join(rootPath, 'fixtures', 'base.ts'),
        buildBaseFixture(includePageObjects)
      )
    }

    if (includeAuth) {
      fs.mkdirSync(path.join(rootPath, 'tests', 'auth'), { recursive: true })
      fs.writeFileSync(
        path.join(rootPath, 'tests', 'auth', 'login.spec.ts'),
        buildAuthSpec()
      )
    }

    if (includeExampleTests) {
      fs.writeFileSync(
        path.join(rootPath, 'tests', 'example.spec.ts'),
        buildExampleSpec()
      )
    }

    // Create environments directory with local template
    fs.mkdirSync(path.join(rootPath, 'environments'), { recursive: true })
    fs.writeFileSync(
      path.join(rootPath, 'environments', 'local.json'),
      JSON.stringify({ baseURL: 'http://localhost:3000' }, null, 2)
    )

    // Create .pwstudio/project.json
    fs.mkdirSync(path.join(rootPath, '.pwstudio'), { recursive: true })
    fs.writeFileSync(
      path.join(rootPath, '.pwstudio', 'project.json'),
      JSON.stringify(
        {
          defaultBrowser: browsers[0] ?? 'chromium',
          activeEnvironment: 'local',
          artifactPolicy: 'failures-only',
        },
        null,
        2
      )
    )

    // Run npm install
    await runNpmInstall(rootPath)
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

function runNpmInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec('npm install', { cwd, timeout: 120_000 }, (err) => {
      if (err) {
        reject(new Error(`npm install failed: ${err.message}`))
      } else {
        resolve()
      }
    })
  })
}

function buildPlaywrightConfig(browsers: string[]): string {
  const projects = browsers
    .map(
      (b) => `    { name: '${b}', use: { ...devices['Desktop ${browserDevice(b)}'] } },`
    )
    .join('\n')

  return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['json', { outputFile: 'test-results/results.json' }], ['html']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
${projects}
  ],
});
`
}

function browserDevice(browser: string): string {
  switch (browser) {
    case 'firefox':
      return 'Firefox'
    case 'webkit':
      return 'Safari'
    default:
      return 'Chrome'
  }
}

function buildExampleSpec(): string {
  return `import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/./);
});

test('navigates to about', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /about/i }).click();
  await expect(page).toHaveURL(/about/);
});
`
}

function buildAuthSpec(): string {
  return `import { test, expect } from '@playwright/test';

test('login with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
});
`
}

function buildExamplePage(): string {
  return `import type { Page, Locator } from '@playwright/test';

export class ExamplePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }
}
`
}

function buildBaseFixture(includePageObjects: boolean): string {
  if (includePageObjects) {
    return `import { test as base } from '@playwright/test';
import { ExamplePage } from '../pages/example.page';

type Fixtures = {
  examplePage: ExamplePage;
};

export const test = base.extend<Fixtures>({
  examplePage: async ({ page }, use) => {
    await use(new ExamplePage(page));
  },
});

export { expect } from '@playwright/test';
`
  }

  return `import { test as base } from '@playwright/test';

// Add custom fixtures here
export const test = base.extend({});

export { expect } from '@playwright/test';
`
}
