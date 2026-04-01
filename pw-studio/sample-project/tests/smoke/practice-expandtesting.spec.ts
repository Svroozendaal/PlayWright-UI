import { test, expect } from '@playwright/test';

test('login with valid credentials', async ({ page }) => {
  await page.goto('https://practice.expandtesting.com/login'); // navigate to login
  await page.locator('#username').fill('practice'); // fill username
  await page.locator('#password').fill('SuperSecretPassword!'); // fill password
  await page.getByRole('button', { name: 'Login' }).click(); // click login
  await expect(page).toHaveURL(/\/secure/); // expect secure url
  await expect(page.locator('#flash')).toContainText('You logged into a secure area!'); // expect flash message
});

test('login with invalid credentials', async ({ page }) => {
  await page.goto('https://practice.expandtesting.com/login'); // navigate to login
  await page.locator('#username').fill('wronguser'); // fill wrong username
  await page.locator('#password').fill('wrongpassword'); // fill wrong password
  await page.getByRole('button', { name: 'Login' }).click(); // click login
  await expect(page.locator('#flash')).toContainText('Your password is invalid!'); // expect error flash
});

test('checkboxes - check and uncheck', async ({ page }) => {
  await page.goto('https://practice.expandtesting.com/checkboxes'); // navigate to checkboxes
  const checkbox1 = page.locator('input[type="checkbox"]').first(); // first checkbox
  const checkbox2 = page.locator('input[type="checkbox"]').nth(1); // second checkbox
  await checkbox1.check(); // check first
  await expect(checkbox1).toBeChecked(); // expect checked
  await checkbox2.uncheck(); // uncheck second
  await expect(checkbox2).not.toBeChecked(); // expect unchecked
});

test('dropdown - select an option', async ({ page }) => {
  await page.goto('https://practice.expandtesting.com/dropdown'); // navigate to dropdown
  await page.locator('#dropdown').selectOption('Option 1'); // select option 1
  await expect(page.locator('#dropdown')).toHaveValue('1'); // expect value 1
  await page.locator('#dropdown').selectOption('Option 2'); // select option 2
  await expect(page.locator('#dropdown')).toHaveValue('2'); // expect value 2
});

test('key presses - detect keyboard input', async ({ page }) => {
  await page.goto('https://practice.expandtesting.com/key-presses'); // navigate to key presses
  const input = page.locator('input#target'); // target input
  await input.click(); // focus input
  await input.press('Tab'); // press tab
  await expect(page.locator('#result')).toContainText('TAB'); // expect TAB result
});

test('inputs - fill number field', async ({ page }) => {
  await page.goto('https://practice.expandtesting.com/inputs'); // navigate to inputs
  const numberInput = page.locator('input[type="number"]'); // number input
  await numberInput.fill('42'); // fill with 42
  await expect(numberInput).toHaveValue('42'); // expect value 42
});
