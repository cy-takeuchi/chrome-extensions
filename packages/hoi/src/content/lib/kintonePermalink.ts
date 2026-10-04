/**
 * kintone/cybozu permalink utilities
 *
 * kintoneのコメントページで、一時的なURLの代わりに
 * 永続的なパーマリンクを取得するためのユーティリティ
 *
 * 選択箇所の DOM 祖先から種別（スレッド / レコード）を判定し、
 * 適切な方法で permalink を取得する。
 */

// Thread comment selectors (new React UI, 2026-10~)
// CSS Modules のハッシュ部分はビルドごとに変わるため部分一致で指定する
const THREAD_COMMENT_BODY_SELECTOR = '.ck-content'
const THREAD_COMMENT_ITEM_SELECTOR = '[class*="_commentContent_"]'
const THREAD_PERMALINK_SELECTOR = 'a[class*="_createdAt_"]'

// Thread comment page selectors (legacy ocean UI)
const PERMALINK_LINK_SELECTOR = 'a.ocean-ui-comments-commentbase-link'
const PERMALINK_POPUP_SELECTOR = '.ocean-ui-comments-linkpopup'
const PERMALINK_INPUT_SELECTOR = 'textarea.ocean-ui-comments-linkpopup-input'
const COMMENT_TEXT_SELECTOR = '.ocean-ui-comments-commentbase-text'
const COMMENT_BODY_SELECTOR = '.ocean-ui-comments-commentbase-body'
const TIMEOUT_MS = 3000

// Record detail page selectors
const RECORD_COMMENT_ITEM_SELECTOR = '.itemlist-item-head-gaia'
const RECORD_COMMENT_BODY_SELECTOR = '.commentlist-body-gaia'
const RECORD_PERMALINK_SELECTOR = '.itemlist-datetime-gaia a'

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
 * 選択範囲の祖先要素を取得
 */
const getSelectionAncestorElement = (selection: Selection): Element | null => {
  if (!selection.rangeCount) return null

  const range = selection.getRangeAt(0)
  const node = range.commonAncestorContainer

  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement
  }
  return node as Element
}

/**
 * 選択箇所の DOM 祖先から種別を判定し、permalink を取得
 * - .ck-content が祖先 → 新スレッド方式(直接リンク)
 * - .ocean-ui-comments-commentbase-text が祖先 → 旧スレッド方式(ポップアップ)
 * - .commentlist-body-gaia が祖先 → レコード方式(直接リンク)
 */
export const getKintoneCommentPermalink = async (ctx: SelectionContext): Promise<string | null> => {
  const node = getSelectionAncestorElement(ctx.selection)
  if (!node) return null

  // 新スレッドコメント判定: コメント内の .ck-content が祖先にある
  const threadBody = node.closest(THREAD_COMMENT_BODY_SELECTOR)
  if (threadBody?.closest(THREAD_COMMENT_ITEM_SELECTOR)) {
    return getKintoneThreadPermalink(threadBody)
  }

  // 旧スレッドコメント判定: .ocean-ui-comments-commentbase-text が祖先にある
  if (node.closest(COMMENT_TEXT_SELECTOR) || node.matches(COMMENT_TEXT_SELECTOR)) {
    return getKintonePermalink(ctx.win, ctx.doc)
  }

  // レコードコメント判定: .commentlist-body-gaia が祖先にある
  if (node.closest(RECORD_COMMENT_BODY_SELECTOR) || node.matches(RECORD_COMMENT_BODY_SELECTOR)) {
    return getKintoneRecordPermalink(ctx.win)
  }

  return null
}

// --- Internal functions ---

/**
 * 指定されたdocument/window内で選択範囲を含むコメントのパーマリンクリンクを探す
 */
const findPermalinkLinkFromSelectionInContext = (
  selection: Selection,
): HTMLAnchorElement | null => {
  if (!selection.rangeCount) return null

  const range = selection.getRangeAt(0)
  const node = range.commonAncestorContainer
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  if (!element) return null

  // .ocean-ui-comments-commentbase-text を探す
  const textContainer = element.closest(COMMENT_TEXT_SELECTOR)
  if (!textContainer) {
    console.log('hoi: Comment text container not found')
    return null
  }

  // .ocean-ui-comments-commentbase-body を探す
  const bodyContainer = textContainer.closest(COMMENT_BODY_SELECTOR)
  if (!bodyContainer) {
    console.log('hoi: Comment body container not found')
    return null
  }

  // Permalink リンクを探す
  const links = bodyContainer.querySelectorAll<HTMLAnchorElement>(PERMALINK_LINK_SELECTOR)
  for (const link of links) {
    const text = link.textContent?.trim() || ''
    if (text === 'リンク' || text === 'Permalink') {
      console.log('hoi: Found permalink in comment')
      return link
    }
  }

  console.log('hoi: Permalink link not found in comment')
  return null
}

/**
 * パーマリンクリンク要素を探す
 * 選択範囲がない場合は null を返す（window.location.href にフォールバック）
 */
const findPermalinkLink = (win: Window = window): HTMLAnchorElement | null => {
  const selection = win.getSelection()
  if (!selection?.toString().trim()) {
    console.log('hoi: No selection, skipping permalink')
    return null
  }

  return findPermalinkLinkFromSelectionInContext(selection)
}

/**
 * 指定時間待機するPromise
 */
const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * ポップアップが表示されるまで待機し、URLを取得
 */
const waitForPermalinkPopup = async (doc: Document = document): Promise<string | null> => {
  const startTime = Date.now()

  while (Date.now() - startTime < TIMEOUT_MS) {
    const popup = doc.querySelector(PERMALINK_POPUP_SELECTOR)
    if (popup) {
      // ポップアップ内のtextareaを探す
      const textarea = popup.querySelector<HTMLTextAreaElement>(PERMALINK_INPUT_SELECTOR)
      if (textarea?.value) {
        return textarea.value
      }
    }
    await wait(100)
  }

  return null
}

/**
 * 既存のポップアップをすべて削除
 */
const removeExistingPopups = (doc: Document = document): void => {
  const existingPopups = doc.querySelectorAll(PERMALINK_POPUP_SELECTOR)
  for (const popup of existingPopups) {
    popup.remove()
  }
}

/**
 * スレッドコメントのパーマリンクを取得（ポップアップ経由）
 */
const getKintonePermalink = async (
  win: Window = window,
  doc: Document = document,
): Promise<string | null> => {
  try {
    // パーマリンクリンクを探す
    const permalinkLink = findPermalinkLink(win)
    if (!permalinkLink) {
      console.log('hoi: Permalink link not found')
      return null
    }

    // 既存のポップアップを削除
    removeExistingPopups(doc)

    // リンクをクリックしてポップアップを開く
    permalinkLink.click()

    // ポップアップからURLを取得
    const permalink = await waitForPermalinkPopup(doc)

    // ポップアップを閉じる
    removeExistingPopups(doc)

    if (permalink) {
      console.log('hoi: Got permalink:', permalink)
      return permalink
    }

    console.log('hoi: Could not get permalink from popup')
    return null
  } catch (error) {
    console.error('hoi: Error getting permalink:', error)
    return null
  }
}

/**
 * 新スレッドコメントのパーマリンクを取得
 * コメントヘッダーの日時リンクからURLを直接取得
 */
const getKintoneThreadPermalink = (body: Element): string | null => {
  const commentItem = body.closest(THREAD_COMMENT_ITEM_SELECTOR)
  if (!commentItem) {
    console.log('hoi: Thread comment item not found')
    return null
  }

  // ヘッダーは本文や返信より前にあるため、最初にマッチしたものが自コメントのリンク
  const permalinkLink = commentItem.querySelector<HTMLAnchorElement>(THREAD_PERMALINK_SELECTOR)
  if (!permalinkLink?.href) {
    console.log('hoi: Thread permalink link not found')
    return null
  }

  console.log('hoi: Got thread permalink:', permalinkLink.href)
  return permalinkLink.href
}

/**
 * レコード詳細ページでコメントのパーマリンクを取得
 * 選択範囲を含むコメントの日時リンクからURLを直接取得
 */
const getKintoneRecordPermalink = (win: Window = window): string | null => {
  try {
    const selection = win.getSelection()
    if (!selection?.toString().trim()) {
      console.log('hoi: No selection, skipping record permalink')
      return null
    }

    if (!selection.rangeCount) return null

    const range = selection.getRangeAt(0)
    const node = range.commonAncestorContainer
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
    if (!element) return null

    // .commentlist-body-gaia を探す（選択範囲を含むコメント本文）
    const commentBody = element.closest(RECORD_COMMENT_BODY_SELECTOR)
    if (!commentBody) {
      console.log('hoi: Record comment body not found')
      return null
    }

    // 親の .itemlist-item-head-gaia を探す
    const commentItem = commentBody.closest(RECORD_COMMENT_ITEM_SELECTOR)
    if (!commentItem) {
      console.log('hoi: Record comment item not found')
      return null
    }

    // .itemlist-datetime-gaia a からpermalinkを取得
    const permalinkLink = commentItem.querySelector<HTMLAnchorElement>(RECORD_PERMALINK_SELECTOR)
    if (!permalinkLink?.href) {
      console.log('hoi: Record permalink link not found')
      return null
    }

    console.log('hoi: Got record permalink:', permalinkLink.href)
    return permalinkLink.href
  } catch (error) {
    console.error('hoi: Error getting record permalink:', error)
    return null
  }
}
