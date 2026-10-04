# hoi の開発

セットアップ、コマンド、コーディング規約、コミット規約、リリースはリポジトリ共通です。[ルートの CONTRIBUTING.md](../../CONTRIBUTING.md) を見てください。ここには hoi 固有のことを書きます。

コマンドは `packages/hoi` で実行します。ルートからは `pnpm hoi <script>`（例: `pnpm hoi test`）でも実行できます。

## ディレクトリ構成

| ディレクトリ | 中身 |
|---|---|
| `entrypoints/background.ts` | ショートカットの受付と GitHub への登録 |
| `entrypoints/content` | 選択テキストの取得とダイアログの表示（Shadow DOM 内の React） |
| `entrypoints/options` | オプション画面（トークンと Project URL の設定） |
| `components` | ダイアログの UI |
| `lib/kintonePermalink.ts` | kintone のコメントのパーマリンク取得 |
| `lib/github.ts` | GitHub GraphQL API |
| `lib/storage.ts` | `chrome.storage.sync` への保存と Project URL の解析 |
| `lib/messages.ts` | background と content script の間のメッセージ |
| `e2e` | 実際の kintone に対する E2E テスト |

## 技術スタック

- [WXT](https://wxt.dev/)
- [React](https://react.dev/) 19
- [Headless UI](https://headlessui.com/)（オプション画面）
- [TypeScript](https://www.typescriptlang.org/)
- Chrome Extension Manifest V3

## kintone のパーマリンク取得

kintone の画面の URL は、選択したコメントそのものを指していないことがあります（通知画面など）。そこで、選択したコメントのパーマリンクを DOM から取り出して、Body に付けます。

URL ではなく、**選択箇所の DOM の祖先**で画面の種類を判定します（`lib/kintonePermalink.ts`）。

1. `findActiveSelectionContext()` が選択範囲を探す。まずページ本体、なければ通知画面の詳細パネル（iframe）の中
2. `getKintoneCommentPermalink()` が、選択箇所の祖先から次のどれかを探してパーマリンクを取る

| 画面 | 判定（選択箇所の祖先） | 取り方 |
|---|---|---|
| スペースのスレッド | `.ck-content` を含む `[class*="_commentContent_"]` | コメントの日時リンク `a[class*="_createdAt_"]` の `href` |
| レコード詳細 | `.commentlist-body-gaia` を含む `.itemlist-item-head-gaia` | 日時リンク `.itemlist-datetime-gaia a` の `href` |
| 旧スレッド画面 | `.ocean-ui-comments-commentbase-text` | 「リンク」をクリックして出るポップアップの `textarea` から読む |

通知画面の詳細パネルの中も、スレッド・レコードと同じ DOM です。

- スレッド画面は CSS Modules のため、クラス名の後ろのハッシュ（`_createdAt_1wot7_81` の `1wot7_81`）がビルドごとに変わります。部分一致で指定しています
- 返信は親コメントの中に入れ子になります。コメントのヘッダー（日時リンク）は本文や返信より前にあるので、最も内側のコメントで最初に見つかった日時リンクが、そのコメント自身のリンクです
- 旧スレッド画面（`ocean-ui`）は、新しい画面が届いていない環境のために残しています

kintone のアップデートで DOM が変わると、ここが壊れます。単体テストと E2E テストで検出できます。

## テスト

### 単体テスト

```sh
pnpm test
```

[Vitest](https://vitest.dev/) と happy-dom で実行します。kintone の DOM を組み立てて、パーマリンク取得を確かめています（`lib/*.test.ts`）。

### E2E テスト

E2E テストは実際の kintone 環境に対して Playwright で実行します。テストは kintone のページに `lib/kintonePermalink.ts` を注入し、拡張機能と同じコードでパーマリンクを取ります。

#### 前提条件

- kintone（または cybozu.com）環境
- 2 つのユーザーアカウント
- スペーステンプレート（1 つ以上）
- [1Password CLI](https://developer.1password.com/docs/cli/)（`op`）

#### 環境変数の設定

認証情報は 1Password で管理し、`e2e/.env` には [シークレット参照](https://developer.1password.com/docs/cli/secret-references/)（`op://<vault>/<item>/<field>`）を書きます。`pnpm test:e2e` は `op run` 経由で実行され、参照が実際の値に解決されます。

`.env.example` をコピーして `.env` を作成します。

```sh
cp e2e/.env.example e2e/.env
```

`e2e/.env` を編集して、各値を自分の 1Password のシークレット参照に書き換えてください。参照ではなく値を直接書いても動作します。

| 環境変数 | 説明 |
|---|---|
| `KINTONE_URL` | kintone の URL（例: `https://example.cybozu.com`） |
| `KINTONE_USERNAME1` | ユーザー 1 のログイン名 |
| `KINTONE_PASSWORD1` | ユーザー 1 のパスワード |
| `KINTONE_USERNAME2` | ユーザー 2 のログイン名 |
| `KINTONE_PASSWORD2` | ユーザー 2 のパスワード |
| `KINTONE_SPACE_TEMPLATE_ID` | スペーステンプレートの ID |

1Password で同じ名前の item が複数ある（アーカイブ済みを含む）と、`op run` が解決に失敗することがあります。その場合は item 名の代わりに item の ID を書いてください。

#### なぜ 2 ユーザー必要か

通知テストでは、ユーザー 2 がコメントでユーザー 1 をメンションし、ユーザー 1 の通知画面でパーマリンクを取得します。

#### スペーステンプレートの準備

1. kintone の管理画面でスペーステンプレートを作成
2. テンプレート ID を `KINTONE_SPACE_TEMPLATE_ID` に設定

テストは実行時にこのテンプレートからスペースを作成し、テスト後に自動で削除します。テンプレートのメンバー設定は不要です（テスト内でメンバーを指定して作成するため）。

#### 実行

```sh
pnpm test:e2e          # ヘッドレスで実行
pnpm test:e2e:headed   # ブラウザを表示して実行
```

各テストは `beforeAll` でスペースやアプリを自動作成し、`afterAll` で削除します。テスト実行前に手動でデータを用意する必要はありません。

ブラウザの動作をゆっくり確認したい場合は、`e2e/playwright.config.ts` の `slowMo` を有効にしてください。
