import type { Page } from '@playwright/test'

/** [置き換え前, 置き換え後]。長いものから順に置き換える */
export type Replacement = [from: string, to: string]

const ATTRIBUTES = ['title', 'href', 'alt', 'aria-label', 'placeholder', 'data-mention-name']

/**
 * ページ内の実在のドメインやユーザー名を架空のものに書き換える。
 * 撮影直前に呼ぶ（画面が再描画されると元に戻るため）。
 * 開いている Shadow DOM（拡張機能のダイアログ）と iframe（通知の詳細パネル）の中も書き換える。
 */
export const anonymize = async (page: Page, replacements: Replacement[]) => {
  const sorted = [...replacements]
    .filter(([from]) => from !== '')
    .sort(([a], [b]) => b.length - a.length)

  for (const frame of page.frames()) {
    await frame
      .evaluate(
        ({ sorted, attributes }) => {
          const replace = (s: string) =>
            sorted.reduce((acc, [from, to]) => acc.split(from).join(to), s)

          const visit = (root: Document | ShadowRoot) => {
            const walker = document.createTreeWalker(
              root,
              NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            )
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent ?? ''
                const next = replace(text)
                if (next !== text) node.textContent = next
                continue
              }
              const el = node as Element
              for (const name of attributes) {
                const value = el.getAttribute(name)
                if (value !== null) el.setAttribute(name, replace(value))
              }
              if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                el.value = replace(el.value)
              }
              if (el.shadowRoot) visit(el.shadowRoot)
            }
          }
          visit(document)
          document.title = replace(document.title)
        },
        { sorted, attributes: ATTRIBUTES },
      )
      // 読み込み途中で消えたフレームは無視する
      .catch(() => {})
  }
}
