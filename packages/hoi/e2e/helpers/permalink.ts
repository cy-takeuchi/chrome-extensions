import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from '@playwright/test'
import { build, type Rolldown } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENTRY = path.resolve(__dirname, '../../lib/kintonePermalink.ts')
const GLOBAL_NAME = '__hoiPermalink'

let bundle: Promise<string> | undefined

/**
 * 拡張機能の kintonePermalink.ts をページに注入できる 1 ファイルの IIFE にまとめる
 */
const bundlePermalinkModule = (): Promise<string> => {
  bundle ??= build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry: ENTRY, formats: ['iife'], name: GLOBAL_NAME },
    },
  }).then((result) => {
    const output = (Array.isArray(result) ? result[0] : result) as Rolldown.RolldownOutput
    return output.output[0].code
  })
  return bundle
}

/**
 * 選択中のテキストから、拡張機能と同じコードで kintone コメントのパーマリンクを取得する
 * page.evaluate は CSP の影響を受けないため、kintone 上でもそのまま注入できる
 */
export const getPermalinkFromSelection = async (page: Page): Promise<string | null> => {
  const code = await bundlePermalinkModule()
  await page.evaluate(code)

  return page.evaluate(async (globalName) => {
    const lib = (window as unknown as Record<string, typeof import('../../lib/kintonePermalink')>)[
      globalName
    ]
    const ctx = lib.findActiveSelectionContext()
    return ctx ? lib.getKintoneCommentPermalink(ctx) : null
  }, GLOBAL_NAME)
}

/**
 * 要素の中身を選択状態にする（要素が iframe 内にあれば iframe の選択になる）
 */
export const selectContents = async (locator: Locator): Promise<void> => {
  await locator.evaluate((el) => {
    const range = el.ownerDocument.createRange()
    range.selectNodeContents(el)
    const selection = el.ownerDocument.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
}
