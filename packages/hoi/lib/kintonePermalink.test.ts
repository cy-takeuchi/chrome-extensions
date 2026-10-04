import { afterEach, describe, expect, it } from 'vitest'
import {
  findActiveSelectionContext,
  getKintoneCommentPermalink,
  isKintonePage,
} from './kintonePermalink'

const ORIGIN = 'https://example.cybozu.com'

/** 要素の中身を選択して、拡張機能と同じ手順でパーマリンクを取る */
const permalinkOf = async (selector: string): Promise<string | null> => {
  const el = document.querySelector(selector)
  if (!el) throw new Error(`${selector} not found`)
  const range = document.createRange()
  range.selectNodeContents(el)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  const ctx = findActiveSelectionContext()
  return ctx ? getKintoneCommentPermalink(ctx) : null
}

afterEach(() => {
  window.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
})

describe('isKintonePage', () => {
  it('cybozu.com / kintone.com の /k/ 以下', () => {
    expect(isKintonePage(`${ORIGIN}/k/#/space/1/thread/1`)).toBe(true)
    expect(isKintonePage('https://example.kintone.com/k/12/show#record=3')).toBe(true)
  })

  it('それ以外', () => {
    expect(isKintonePage(`${ORIGIN}/g/`)).toBe(false)
    expect(isKintonePage('https://github.com/')).toBe(false)
  })
})

describe('getKintoneCommentPermalink', () => {
  it('スレッドコメントは日時リンクの URL', async () => {
    // 2026-10 時点のスレッド画面（CSS Modules のハッシュは変わる）
    document.body.innerHTML = `
      <div class="_comment_1wot7_1">
        <div class="_commentContent_1wot7_37">
          <div class="_commentRight_1wot7_51">
            <div class="_header_1wot7_68">
              <a href="${ORIGIN}/k/#/space/1/thread/2/10" class="_createdAt_1wot7_81">2:33</a>
            </div>
            <div class="ck-content _body_1wot7_108"><div id="body">親コメント</div></div>
            <div class="_commentContent_1wot7_37">
              <div class="_header_1wot7_68">
                <a href="${ORIGIN}/k/#/space/1/thread/2/10/11" class="_createdAt_1wot7_81">2:34</a>
              </div>
              <div class="ck-content _body_1wot7_108"><div id="reply">返信</div></div>
            </div>
          </div>
        </div>
      </div>`

    expect(await permalinkOf('#body')).toBe(`${ORIGIN}/k/#/space/1/thread/2/10`)
    // 返信は親ではなく自分のリンク
    expect(await permalinkOf('#reply')).toBe(`${ORIGIN}/k/#/space/1/thread/2/10/11`)
  })

  it('レコードのコメントは日時リンクの URL', async () => {
    document.body.innerHTML = `
      <div class="itemlist-item-head-gaia">
        <div class="itemlist-datetime-gaia">
          <a href="${ORIGIN}/k/12/show#record=3&comment=5">2026-10-05 2:33</a>
        </div>
        <div class="commentlist-body-gaia"><div id="body">レコードのコメント</div></div>
      </div>`

    expect(await permalinkOf('#body')).toBe(`${ORIGIN}/k/12/show#record=3&comment=5`)
  })

  it('旧スレッド画面はリンクのポップアップから読む', async () => {
    document.body.innerHTML = `
      <div class="ocean-ui-comments-commentbase-body">
        <div class="ocean-ui-comments-commentbase-text" id="body">旧画面のコメント</div>
        <a class="ocean-ui-comments-commentbase-link" id="link">リンク</a>
      </div>`
    // kintone はリンクのクリックでポップアップを出す
    document.getElementById('link')?.addEventListener('click', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="ocean-ui-comments-linkpopup">
          <textarea class="ocean-ui-comments-linkpopup-input">${ORIGIN}/k/#/space/1/thread/2/9</textarea>
        </div>`,
      )
    })

    expect(await permalinkOf('#body')).toBe(`${ORIGIN}/k/#/space/1/thread/2/9`)
    // 開いたポップアップは片付ける
    expect(document.querySelector('.ocean-ui-comments-linkpopup')).toBeNull()
  })

  it('コメント以外を選択したときは null', async () => {
    document.body.innerHTML = '<p id="other">コメントではない</p>'
    expect(await permalinkOf('#other')).toBeNull()
  })
})
