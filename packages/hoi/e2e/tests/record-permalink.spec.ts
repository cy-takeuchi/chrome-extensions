import { expect, test } from '@playwright/test'
import { createKintoneFixtures } from '../fixtures/kintone'
import {
  createKintoneClient,
  getKintoneUrl,
  getKintoneUsername1,
  getSpaceTemplateId,
  waitForAppDeployment,
} from '../helpers/kintone-client'
import { getPermalinkFromSelection, selectContents } from '../helpers/permalink'

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
    await selectContents(commentElement)

    // Extract permalink with the extension's own code
    const permalink = await getPermalinkFromSelection(page)

    expect(permalink).not.toBeNull()
    expect(permalink).toContain(`/k/${appId}/`)
    expect(permalink).toContain('record=')
    expect(permalink).toContain('comment=')
  })
})
