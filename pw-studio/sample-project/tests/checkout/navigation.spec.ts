import { test, expect } from '@playwright/test'

test('docs link navigates to intro page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/.*intro/)
})

test('search opens search dialog', async ({ page }) => {
  await page.goto('/')
  const searchButton = page.getByRole('button', { name: 'Search' })
  await searchButton.click()
  await expect(page.getByPlaceholder('Search docs')).toBeVisible()
})
