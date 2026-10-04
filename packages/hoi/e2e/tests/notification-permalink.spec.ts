import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { createKintoneFixtures } from '../fixtures/kintone'
import {
  createKintoneClient,
  createKintoneClient2,
  getKintoneUrl,
  getKintoneUsername1,
  getKintoneUsername2,
  getSpaceTemplateId,
  waitForAppDeployment,
} from '../helpers/kintone-client'

test.describe('Notification Page Permalink', () => {
  let spaceId: string | number
  let threadId: string
  let appId: string
  let recordId: string
  const threadCommentText = `Thread notification test ${Date.now()}`
  const recordCommentText = `Record notification test ${Date.now()}`

  test.beforeAll(async () => {
    const client1 = createKintoneClient()
    const client2 = createKintoneClient2()

    // Create space from template with both users as members
    const spaceTemplateId = getSpaceTemplateId()
    const space = await client1.space.addSpaceFromTemplate({
      id: spaceTemplateId,
      name: `E2E Notification Test ${Date.now()}`,
      members: [
        {
          entity: { type: 'USER', code: getKintoneUsername1() },
          isAdmin: true,
        },
        {
          entity: { type: 'USER', code: getKintoneUsername2() },
          isAdmin: false,
        },
      ],
    })
    spaceId = space.id

    // Get default thread ID from space
    const spaceInfo = await client1.space.getSpace({ id: spaceId })
    threadId = spaceInfo.defaultThread

    // Create app in the space
    const previewApp = await client1.app.addApp({
      name: `E2E Notification App ${Date.now()}`,
      space: spaceId,
    })
    appId = previewApp.app

    // Add a text field to the app
    await client1.app.addFormFields({
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
    await client1.app.deployApp({
      apps: [{ app: appId }],
    })
    await waitForAppDeployment(client1, [{ app: appId }])

    // Add a record
    const record = await client1.record.addRecord({
      app: appId,
      record: {
        title: { value: `Test Record ${Date.now()}` },
      },
    })
    recordId = record.id

    // User 2 posts thread comment mentioning User 1
    await client2.space.addThreadComment({
      space: spaceId,
      thread: threadId,
      comment: {
        text: threadCommentText,
        mentions: [
          {
            code: getKintoneUsername1(),
            type: 'USER',
          },
        ],
      },
    })

    // User 2 posts record comment mentioning User 1
    await client2.record.addRecordComment({
      app: appId,
      record: recordId,
      comment: {
        text: recordCommentText,
        mentions: [
          {
            code: getKintoneUsername1(),
            type: 'USER',
          },
        ],
      },
    })
  })

  test.afterAll(async () => {
    if (spaceId) {
      const client = createKintoneClient()
      await client.space.deleteSpace({ id: spaceId })
    }
  })

  /**
   * Navigate to the new notification page and switch to the new screen if needed
   */
  const navigateToNotifications = async (page: Page) => {
    const baseUrl = getKintoneUrl()
    await page.goto(`${baseUrl}/k/#/ntf/mention`)

    // Check if we need to switch to the new notification screen
    const tryNewButton = page.getByRole('button', {
      name: /Try new notifications screen|新しい通知画面を試す/,
    })
    try {
      await tryNewButton.waitFor({ state: 'visible', timeout: 5000 })
      await tryNewButton.click()
      await page.waitForTimeout(2000)
    } catch {
      // Already on the new notification screen
    }

    // Wait for notification list to load
    await page.waitForTimeout(3000)
  }

  test('should get permalink from thread notification', async ({ page }) => {
    const { loginToKintone } = createKintoneFixtures()
    await loginToKintone(page, 1)

    await navigateToNotifications(page)

    // Click on the thread notification to open detail panel
    const threadNotification = page.locator(`text=${threadCommentText}`).first()
    await threadNotification.waitFor({ state: 'visible', timeout: 15000 })
    await threadNotification.click()

    // Wait for detail panel iframe to load
    const iframe = page.locator('iframe[data-testid="Notification-detail-iframe"]')
    await iframe.waitFor({ state: 'visible', timeout: 10000 })
    const iframeContent = iframe.contentFrame()
    if (!iframeContent) throw new Error('iframe contentFrame is null')

    // Wait for thread comment to appear in iframe
    const commentElement = iframeContent.locator('.ck-content', {
      hasText: threadCommentText,
    })
    await commentElement.waitFor({ state: 'visible', timeout: 10000 })

    // Select text in the comment inside iframe
    await commentElement.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })

    // Extract permalink using the same logic as the extension (inside iframe)
    // Use commentElement.evaluate since FrameLocator doesn't have evaluate
    const permalink = await commentElement.evaluate((el) => {
      const THREAD_COMMENT_ITEM_SELECTOR = '[class*="_commentContent_"]'
      const THREAD_PERMALINK_SELECTOR = 'a[class*="_createdAt_"]'

      const commentItem = el.closest(THREAD_COMMENT_ITEM_SELECTOR)
      if (!commentItem) return null

      return commentItem.querySelector<HTMLAnchorElement>(THREAD_PERMALINK_SELECTOR)?.href ?? null
    })

    expect(permalink).not.toBeNull()
    expect(permalink).toContain(`/space/${spaceId}`)
    expect(permalink).toContain(`thread/${threadId}`)
  })

  test('should get permalink from record notification', async ({ page }) => {
    const { loginToKintone } = createKintoneFixtures()
    await loginToKintone(page, 1)

    await navigateToNotifications(page)

    // Click on the record notification to open detail panel
    const recordNotification = page.locator(`text=${recordCommentText}`).first()
    await recordNotification.waitFor({ state: 'visible', timeout: 15000 })
    await recordNotification.click()

    // Wait for detail panel iframe to load
    const iframe = page.locator('iframe[data-testid="Notification-detail-iframe"]')
    await iframe.waitFor({ state: 'visible', timeout: 10000 })
    const iframeContent = iframe.contentFrame()
    if (!iframeContent) throw new Error('iframe contentFrame is null')

    // Wait for record comment to appear in iframe
    const commentElement = iframeContent.locator('.commentlist-body-gaia', {
      hasText: recordCommentText,
    })
    await commentElement.waitFor({ state: 'visible', timeout: 10000 })

    // Select text in the comment inside iframe
    await commentElement.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })

    // Extract permalink using the same logic as the extension (inside iframe)
    // Use commentElement.evaluate since FrameLocator doesn't have evaluate
    const permalink = await commentElement.evaluate((el) => {
      const RECORD_COMMENT_ITEM_SELECTOR = '.itemlist-item-head-gaia'
      const RECORD_PERMALINK_SELECTOR = '.itemlist-datetime-gaia a'

      const commentItem = el.closest(RECORD_COMMENT_ITEM_SELECTOR)
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
