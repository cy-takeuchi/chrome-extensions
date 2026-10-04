import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type BrowserContext,
  chromium,
  type Locator,
  type Page,
  test,
  type Worker,
} from '@playwright/test'
import { anonymize, type Replacement } from './anonymize'
import { baseUrl, createSampleData, deleteSampleData, type SampleData, users } from './kintone-data'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT = path.resolve(__dirname, '../public/images')
const extensionPath = (name: string) => path.join(ROOT, 'packages', name, '.output/chrome-mv3')

/** Chrome ウェブストアのスクリーンショットの大きさ */
const VIEWPORT = { width: 1280, height: 800 }

/** 写り込む実在の名前の置き換え先 */
const ALIASES = [
  { name: '佐藤 花子', code: 'sato' },
  { name: '鈴木 一郎', code: 'suzuki' },
]

let data: SampleData
let context: BrowserContext
let page: Page
let replacements: Replacement[]
const workers = new Map<string, Worker>()

const shot = async (target: Page, name: string) => {
  await anonymize(target, replacements)
  await target.screenshot({ path: path.join(OUT, `${name}.png`) })
}

/** 要素の中身を選択状態にする */
const select = (locator: Locator) =>
  locator.evaluate((el) => {
    const range = el.ownerDocument.createRange()
    range.selectNodeContents(el)
    const selection = el.ownerDocument.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })

/** ショートカットの代わりに、background から content script へ送るメッセージを送る */
const sendToTab = (extension: string, message: unknown) =>
  workers.get(extension)?.evaluate(async (message) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 })
  }, message)

const login = async () => {
  const { user1 } = users()
  await page.goto(`${baseUrl()}/login`)
  await page.getByRole('textbox', { name: /ログイン名|Login name/ }).fill(user1.username)
  await page.getByRole('textbox', { name: /パスワード|Password/ }).fill(user1.password)
  await page.getByRole('button', { name: /ログイン|Login/ }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'))
}

test.beforeAll(async () => {
  data = await createSampleData()

  const host = new URL(baseUrl()).host
  const { user1, user2 } = users()
  const [alias1, alias2] = ALIASES
  const byCode = new Map(data.people.map((p) => [p.code, p.name]))
  replacements = [
    [host, 'example.cybozu.com'],
    [byCode.get(user1.username) ?? user1.username, alias1.name],
    [byCode.get(user2.username) ?? user2.username, alias2.name],
    [user1.username, alias1.code],
    [user2.username, alias2.code],
  ]

  const extensions = ['hoi', 'utsushi'].map(extensionPath).join(',')
  context = await chromium.launchPersistentContext(await mkdtemp(path.join(tmpdir(), 'site-')), {
    channel: 'chromium',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: VIEWPORT,
    permissions: ['clipboard-read', 'clipboard-write'],
    args: [`--disable-extensions-except=${extensions}`, `--load-extension=${extensions}`],
  })
  while (workers.size < 2) {
    const worker = context.serviceWorkers().find((w) => !workers.has(w.url()))
    const w = worker ?? (await context.waitForEvent('serviceworker'))
    const name = await w.evaluate(() => chrome.runtime.getManifest().name)
    workers.set(name, w)
  }
  page = await context.newPage()
  await login()
})

test.afterAll(async () => {
  await context?.close()
  if (data) await deleteSampleData(data)
})

test('hoi', async () => {
  await page.goto(`${baseUrl()}/k/#/space/${data.spaceId}/thread/${data.threadId}`)
  const comment = page.locator('.ck-content', { hasText: '納期を 2 週間前倒し' })
  await comment.waitFor()
  await page.waitForTimeout(1000)
  await select(comment)
  await page.bringToFront()
  await sendToTab('hoi', { type: 'TRIGGER_DIALOG' })
  const dialog = page.locator('#hoi-root .tgp-dialog-panel')
  await dialog.waitFor()
  await page.locator('#hoi-root #tgp-title').fill('株式会社サンプル: 納期前倒しの可否を回答する')
  await shot(page, 'hoi-dialog')

  const options = await context.newPage()
  const hoiId = new URL(workers.get('hoi')?.url() ?? '').host
  await options.goto(`chrome-extension://${hoiId}/options.html`)
  await options.locator('input[type=password]').fill('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx')
  await options.locator('input[type=url]').fill('https://github.com/users/example/projects/1')
  await shot(options, 'hoi-options')
  await options.close()
})
