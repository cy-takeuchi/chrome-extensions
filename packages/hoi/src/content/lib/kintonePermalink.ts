/**
 * kintone/cybozu permalink utilities
 *
 * kintoneのコメントページで、一時的なURLの代わりに
 * 永続的なパーマリンクを取得するためのユーティリティ
 *
 * 選択箇所の DOM 祖先から種別（スレッド / レコード）を判定し、
 * 適切な方法で permalink を取得する。
 */

/**
 * コメントの日時リンクにパーマリンクが直接入っている画面
 * body: 選択範囲を含むコメント本文, item: コメント 1 件, link: パーマリンク
 */
interface DirectLinkLayout {
  name: string
  body: string
  item: string
  link: string
}

const DIRECT_LINK_LAYOUTS: DirectLinkLayout[] = [
  // スレッドコメント (React UI, 2026-10~)
  // CSS Modules のハッシュ部分はビルドごとに変わるため部分一致で指定する
  {
    name: 'thread',
    body: '.ck-content',
    item: '[class*="_commentContent_"]',
    link: 'a[class*="_createdAt_"]',
  },
  // レコード詳細画面のコメント
  {
    name: 'record',
    body: '.commentlist-body-gaia',
    item: '.itemlist-item-head-gaia',
    link: '.itemlist-datetime-gaia a',
  },
]

// Thread comment page selectors (legacy ocean UI)
// リンクをクリックして開くポップアップからパーマリンクを読む
const LEGACY_COMMENT_TEXT_SELECTOR = '.ocean-ui-comments-commentbase-text'
const LEGACY_COMMENT_BODY_SELECTOR = '.ocean-ui-comments-commentbase-body'
const LEGACY_PERMALINK_LINK_SELECTOR = 'a.ocean-ui-comments-commentbase-link'
const LEGACY_PERMALINK_LINK_TEXTS = ['リンク', 'Permalink']
const LEGACY_PERMALINK_POPUP_SELECTOR = '.ocean-ui-comments-linkpopup'
const LEGACY_PERMALINK_INPUT_SELECTOR = 'textarea.ocean-ui-comments-linkpopup-input'
const LEGACY_POPUP_TIMEOUT_MS = 3000

// Notification page selectors
// 新しい通知画面: data-testid, 旧通知画面: class
const NOTIFICATION_DETAIL_IFRAME_SELECTOR =
  'iframe[data-testid="Notification-detail-iframe"], iframe.ocean-ntf-detail-iframe'

export interface SelectionContext {
  selection: Selection
  win: Window
  doc: Document
}

/**
 * 現在のURLがkintone/cybozuのページかどうかを判定
 */
export const isKintonePage = (url: string): boolean => {
  return url.includes('.cybozu.com/k/') || url.includes('.kintone.com/k/')
}

/**
 * アクティブな選択コンテキストを探す
 * 1. window.getSelection() にテキストがあればそれを使う
 * 2. なければ、既知の iframe (通知詳細パネル等) 内を探す
 */
export const findActiveSelectionContext = (): SelectionContext | null => {
  // 1. メインウィンドウの選択を確認
  const mainSel = window.getSelection()
  if (mainSel?.toString().trim()) {
    return { selection: mainSel, win: window, doc: document }
  }

  // 2. iframe 内の選択を確認
  const iframe = document.querySelector<HTMLIFrameElement>(NOTIFICATION_DETAIL_IFRAME_SELECTOR)
  if (iframe) {
    try {
      const iframeWin = iframe.contentWindow
      const iframeDoc = iframe.contentDocument
      if (iframeWin && iframeDoc) {
        const iframeSel = iframeWin.getSelection()
        if (iframeSel?.toString().trim()) {
          return { selection: iframeSel, win: iframeWin, doc: iframeDoc }
        }
      }
    } catch {
      /* cross-origin */
    }
  }

  return null
}

/**
 * 選択箇所の DOM 祖先から種別を判定し、permalink を取得
 * - DIRECT_LINK_LAYOUTS の本文が祖先 → 日時リンクから直接取得
 * - .ocean-ui-comments-commentbase-text が祖先 → 旧スレッド方式(ポップアップ)
 */
export const getKintoneCommentPermalink = async (ctx: SelectionContext): Promise<string | null> => {
  const element = getSelectionAncestorElement(ctx.selection)
  if (!element) return null

  try {
    for (const layout of DIRECT_LINK_LAYOUTS) {
      const body = element.closest(layout.body)
      const item = body?.closest(layout.item)
      if (item) return getDirectPermalink(item, layout)
    }

    const legacyText = element.closest(LEGACY_COMMENT_TEXT_SELECTOR)
    if (legacyText) return await getLegacyThreadPermalink(legacyText, ctx.doc)
  } catch (error) {
    console.error('hoi: Error getting permalink:', error)
  }

  return null
}

// --- Internal functions ---

/**
 * 選択範囲の祖先要素を取得
 */
const getSelectionAncestorElement = (selection: Selection): Element | null => {
  if (!selection.rangeCount) return null

  const node = selection.getRangeAt(0).commonAncestorContainer
  return node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
}

/**
 * コメントの日時リンクからパーマリンクを取得
 * 日時はコメントヘッダーにあり本文や返信より前に来るため、最初にマッチしたものが自コメントのリンク
 */
const getDirectPermalink = (item: Element, layout: DirectLinkLayout): string | null => {
  const link = item.querySelector<HTMLAnchorElement>(layout.link)
  if (!link?.href) {
    console.log(`hoi: ${layout.name} permalink link not found`)
    return null
  }

  console.log(`hoi: Got ${layout.name} permalink:`, link.href)
  return link.href
}

/**
 * 旧スレッドコメントのパーマリンクを取得（ポップアップ経由）
 */
const getLegacyThreadPermalink = async (
  textContainer: Element,
  doc: Document,
): Promise<string | null> => {
  const link = findLegacyPermalinkLink(textContainer)
  if (!link) {
    console.log('hoi: Permalink link not found in comment')
    return null
  }

  removePopups(doc)
  link.click()
  const permalink = await waitForPopupValue(doc)
  removePopups(doc)

  if (!permalink) {
    console.log('hoi: Could not get permalink from popup')
    return null
  }

  console.log('hoi: Got permalink:', permalink)
  return permalink
}

const findLegacyPermalinkLink = (textContainer: Element): HTMLAnchorElement | null => {
  const body = textContainer.closest(LEGACY_COMMENT_BODY_SELECTOR)
  if (!body) return null

  const links = body.querySelectorAll<HTMLAnchorElement>(LEGACY_PERMALINK_LINK_SELECTOR)
  for (const link of links) {
    if (LEGACY_PERMALINK_LINK_TEXTS.includes(link.textContent?.trim() ?? '')) return link
  }
  return null
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * ポップアップが表示されるまで待機し、URLを取得
 */
const waitForPopupValue = async (doc: Document): Promise<string | null> => {
  const startTime = Date.now()

  while (Date.now() - startTime < LEGACY_POPUP_TIMEOUT_MS) {
    const textarea = doc.querySelector<HTMLTextAreaElement>(
      `${LEGACY_PERMALINK_POPUP_SELECTOR} ${LEGACY_PERMALINK_INPUT_SELECTOR}`,
    )
    if (textarea?.value) return textarea.value
    await wait(100)
  }

  return null
}

const removePopups = (doc: Document): void => {
  for (const popup of doc.querySelectorAll(LEGACY_PERMALINK_POPUP_SELECTOR)) {
    popup.remove()
  }
}
