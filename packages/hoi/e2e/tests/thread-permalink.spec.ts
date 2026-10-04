import { expect, test } from '@playwright/test'
import { createKintoneFixtures } from '../fixtures/kintone'
import {
  createKintoneClient,
  getKintoneUrl,
  getKintoneUsername1,
  getSpaceTemplateId,
} from '../helpers/kintone-client'
import { getPermalinkFromSelection, selectContents } from '../helpers/permalink'

test.describe('Thread Comment Permalink', () => {
  let spaceId: string | number
  let threadId: string

  test.beforeAll(async () => {
    const client = createKintoneClient()

    // Create space from template
    const spaceTemplateId = getSpaceTemplateId()
    const space = await client.space.addSpaceFromTemplate({
      id: spaceTemplateId,
      name: `E2E Test ${Date.now()}`,
      members: [
        {
          entity: { type: 'USER', code: getKintoneUsername1() },
          isAdmin: true,
        },
      ],
    })
    spaceId = space.id

    // Get default thread ID from space
    const spaceInfo = await client.space.getSpace({ id: spaceId })
    threadId = spaceInfo.defaultThread
  })

  test.afterAll(async () => {
    if (spaceId) {
      const client = createKintoneClient()
      await client.space.deleteSpace({ id: spaceId })
    }
  })

  test('should get permalink from thread comment', async ({ page }) => {
    const { loginToKintone } = createKintoneFixtures()
    await loginToKintone(page)

    const client = createKintoneClient()

    // Add thread comment
    const commentText = `Test comment ${Date.now()}`
    await client.space.addThreadComment({
      space: spaceId,
      thread: threadId,
      comment: {
        text: commentText,
      },
    })

    // Navigate to thread page
    const baseUrl = getKintoneUrl()
    await page.goto(`${baseUrl}/k/#/space/${spaceId}/thread/${threadId}`)

    // Find and select the comment text
    const commentElement = page.locator('.ck-content', { hasText: commentText })
    await commentElement.waitFor({ state: 'visible', timeout: 10000 })

    // Select text in the comment
    await selectContents(commentElement)

    // Extract permalink with the extension's own code
    const permalink = await getPermalinkFromSelection(page)

    expect(permalink).not.toBeNull()
    expect(permalink).toContain(`/space/${spaceId}`)
    expect(permalink).toContain(`thread/${threadId}`)
  })
})
