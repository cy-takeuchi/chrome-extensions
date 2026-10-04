# kintone Permalink 取得機能

kintone/cybozu のページでは一時的な URL（セッション依存）が使われることがあるため、永続的なパーマリンクを取得する機能を実装しています。

## アーキテクチャ

URL ベースの分岐ではなく、**選択箇所の DOM 祖先で種別を判定** する統一的なアプローチを採用しています。

```
選択コンテキスト解決(window or iframe) → DOM 祖先で種別判定 → permalink 取得
```

### フロー

1. `findActiveSelectionContext()` でアクティブな選択コンテキストを取得
   - まず `window.getSelection()` を確認
   - なければ通知ページの iframe (`iframe.ocean-ntf-detail-iframe`) 内を確認
2. `getKintoneCommentPermalink(ctx)` で DOM 祖先から種別を判定し permalink を取得
   - `.ocean-ui-comments-commentbase-text` が祖先 → スレッドコメント（ポップアップ経由）
   - `.commentlist-body-gaia` が祖先 → レコードコメント（直接リンク取得）

## 対応ページ

| ページ種別 | URL パターン | 判定方法 | 取得方法 |
|-----------|-------------|---------|---------|
| スレッドコメント | `/k/*/thread.html#/` | `.ocean-ui-comments-commentbase-text` 祖先 | ポップアップ経由 |
| レコード詳細 | `/k/*/show#record=` | `.commentlist-body-gaia` 祖先 | 直接取得 |
| 通知ページ（スレッド） | `/k/#/ntf/mention` | iframe 内 `.ocean-ui-comments-commentbase-text` 祖先 | iframe 内ポップアップ経由 |
| 通知ページ（レコード） | `/k/#/ntf/mention` | iframe 内 `.commentlist-body-gaia` 祖先 | iframe 内直接取得 |

## 実装詳細

### エクスポート API

```typescript
interface SelectionContext {
  selection: Selection
  win: Window
  doc: Document
}

// kintone/cybozu ページかどうか
export const isKintonePage = (url: string): boolean

// アクティブな選択コンテキストを探す (window → iframe の順)
export const findActiveSelectionContext = (): SelectionContext | null

// 選択箇所の DOM 祖先から種別を判定し permalink を取得
export const getKintoneCommentPermalink = async (ctx: SelectionContext): Promise<string | null>
```

### 1. スレッドコメント

#### DOM 構造

```
div.ocean-ui-comments-commentbase-body
├── div.ocean-ui-comments-commentbase-text  ← コメント本文（祖先判定に使用）
└── a.ocean-ui-comments-commentbase-link    ← "リンク" or "Permalink"
    └── (click) → div.ocean-ui-comments-linkpopup
                  └── textarea.ocean-ui-comments-linkpopup-input  ← permalink URL
```

#### 取得フロー

1. 選択範囲の祖先に `.ocean-ui-comments-commentbase-text` があることを確認
2. 親の `.ocean-ui-comments-commentbase-body` を取得
3. 配下の `a.ocean-ui-comments-commentbase-link`（"リンク" or "Permalink"）をクリック
4. ポップアップ `.ocean-ui-comments-linkpopup` が表示されるまで待機（最大3秒）
5. ポップアップ内の `textarea.ocean-ui-comments-linkpopup-input` から URL を取得
6. ポップアップを閉じる

### 2. レコード詳細

#### DOM 構造

```
li.itemlist-item-head-gaia
├── div.itemlist-head-gaia
│   └── div.itemlist-datetime-gaia
│       └── a[href="...#record=60&comment=N"]  ← permalink URL（直接取得可能）
├── div.commentlist-body-gaia  ← コメント本文（祖先判定に使用）
└── div.itemlist-footer-gaia
```

#### 取得フロー

1. 選択範囲の祖先に `.commentlist-body-gaia` があることを確認
2. 親の `.itemlist-item-head-gaia` を取得
3. 配下の `.itemlist-datetime-gaia a` の `href` 属性から permalink を直接取得

### 3. 通知ページ

通知ページ (`/k/#/ntf/mention`) の右パネルは `iframe.ocean-ntf-detail-iframe` 内にコンテンツが表示される。`findActiveSelectionContext()` が iframe 内の選択を自動的に検出し、iframe 内の DOM 構造はスレッド/レコードと同一のため `getKintoneCommentPermalink()` がそのまま動作する。

## 呼び出しフロー

```typescript
// content/index.tsx
async function handleTriggerDialog(): Promise<void> {
  let selectedText = window.getSelection()?.toString() || ''
  let url = window.location.href

  if (isKintonePage(url)) {
    const ctx = findActiveSelectionContext()
    if (ctx) {
      selectedText = ctx.selection.toString()
      const permalink = await getKintoneCommentPermalink(ctx)
      if (permalink) url = permalink
    }
  }

  // ...
}
```

## 関連ファイル

- `src/content/lib/kintonePermalink.ts` - permalink 取得ユーティリティ
- `src/content/index.tsx` - コンテンツスクリプト（呼び出し元）
