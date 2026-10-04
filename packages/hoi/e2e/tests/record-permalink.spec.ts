import { expect, test } from '@playwright/test'
import { createKintoneFixtures } from '../fixtures/kintone'
import {
  createKintoneClient,
  getKintoneUrl,
  getKintoneUsername1,
  getSpaceTemplateId,
  waitForAppDeployment,
} from '../helpers/kintone-client'

test.describe('Record Page Permalink', () => {
  let spaceId: string | number
  let appId: string
  let recordId: string

  test.beforeAll(async () => {
    const client = createKintoneClient()

    // Create space from template
    const spaceTemplateId = getSpaceTemplateId()
    const space = await client.space.addSpaceFromTemplate({
      id: spaceTemplateId,
      name: `E2E Test Record ${Date.now()}`,
      members: [
        {
          entity: { type: 'USER', code: getKintoneUsername1() },
          isAdmin: true,
        },
      ],
    })
    spaceId = space.id

    // Create preview app in the space
    const previewApp = await client.app.addApp({
      name: `E2E Test App ${Date.now()}`,
      space: spaceId,
    })
    appId = previewApp.app

    // Add a text field to the app
    await client.app.addFormFields({
      app: appId,
      properties: {
        title: {
          type: 'SINGLE_LINE_TEXT',
          code: 'title',
          label: 'Title',
        },
      },
    })

    // Deploy the app
    await client.app.deployApp({
      apps: [{ app: appId }],
    })

    // Wait for deployment
    await waitForAppDeployment(client, [{ app: appId }])

    // Add a record
    const record = await client.record.addRecord({
      app: appId,
      record: {
        title: { value: `Test Record ${Date.now()}` },
      },
    })
    recordId = record.id

    // Add a comment to the record
    await client.record.addRecordComment({
      app: appId,
      record: recordId,
      comment: {
        text: `Test comment ${Date.now()}`,
      },
    })
  })

  test.afterAll(async () => {
    if (spaceId) {
      const client = createKintoneClient()
      await client.space.deleteSpace({ id: spaceId })
    }
  })

  test('should get permalink from record comment', async ({ page }) => {
    const { loginToKintone } = createKintoneFixtures()
    await loginToKintone(page)

    // Navigate to record detail page
    const baseUrl = getKintoneUrl()
    await page.goto(`${baseUrl}/k/${appId}/show#record=${recordId}`)

    // Wait for comments to load
    await page.waitForSelector('.commentlist-body-gaia', { timeout: 10000 })

    // Select text in the comment
    const commentElement = page.locator('.commentlist-body-gaia').first()
    await commentElement.waitFor({ state: 'visible' })

    await commentElement.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })

    // Extract permalink using the same logic as the extension
    const permalink = await page.evaluate(() => {
      const RECORD_COMMENT_BODY_SELECTOR = '.commentlist-body-gaia'
      const RECORD_COMMENT_ITEM_SELECTOR = '.itemlist-item-head-gaia'
      const RECORD_PERMALINK_SELECTOR = '.itemlist-datetime-gaia a'

      const selection = window.getSelection()
      if (!selection?.toString().trim() || !selection.rangeCount) return null

      const range = selection.getRangeAt(0)
      let node: Node | null = range.commonAncestorContainer
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement
      }

      let commentBody: Element | null = null
      while (node && node instanceof Element) {
        if (node.matches(RECORD_COMMENT_BODY_SELECTOR)) {
          commentBody = node
          break
        }
        node = node.parentElement
      }
      if (!commentBody) return null

      const commentItem = commentBody.closest(RECORD_COMMENT_ITEM_SELECTOR)
      if (!commentItem) return null

      const permalinkLink = commentItem.querySelector<HTMLAnchorElement>(RECORD_PERMALINK_SELECTOR)
      return permalinkLink?.href ?? null
    })

    expect(permalink).not.toBeNull()
    expect(permalink).toContain(`/k/${appId}/`)
    expect(permalink).toContain('record=')
    expect(permalink).toContain('comment=')
  })
})
