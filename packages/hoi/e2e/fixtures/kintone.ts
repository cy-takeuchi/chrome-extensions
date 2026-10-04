import type { Page } from '@playwright/test'
import {
  createKintoneClient,
  createKintoneClient2,
  getKintoneUrl,
  getKintoneUsername1,
  getKintoneUsername2,
  type KintoneClient,
} from '../helpers/kintone-client'

export interface KintoneFixtures {
  kintoneClient: KintoneClient
  kintoneClient2: KintoneClient
  loginToKintone: (page: Page, user?: 1 | 2) => Promise<void>
}

/**
 * Create kintone fixtures for testing
 */
export const createKintoneFixtures = (): KintoneFixtures => {
  const kintoneClient = createKintoneClient()
  const kintoneClient2 = createKintoneClient2()

  const loginToKintone = async (page: Page, user: 1 | 2 = 1): Promise<void> => {
    const baseUrl = getKintoneUrl()
    const username = user === 1 ? getKintoneUsername1() : getKintoneUsername2()
    const password =
      user === 1 ? process.env.KINTONE_PASSWORD1 || '' : process.env.KINTONE_PASSWORD2 || ''

    await page.goto(`${baseUrl}/login`)

    // Wait for login form and fill credentials
    await page.getByRole('textbox', { name: 'Login name' }).fill(username)
    await page.getByRole('textbox', { name: 'Password' }).fill(password)

    // Submit login form and wait for navigation
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  }

  return {
    kintoneClient,
    kintoneClient2,
    loginToKintone,
  }
}
