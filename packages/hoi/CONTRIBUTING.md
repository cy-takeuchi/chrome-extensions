# コントリビューションガイド

## 開発環境のセットアップ

### 必要なツール

- Node.js 22
- pnpm 12

### インストール

hoi は [chrome-extensions](https://github.com/cy-takeuchi/chrome-extensions) モノレポの 1 パッケージです。依存関係はリポジトリのルートでまとめてインストールします。

```bash
git clone https://github.com/cy-takeuchi/chrome-extensions.git
cd chrome-extensions
pnpm install
cd packages/hoi
```

以下のコマンドは `packages/hoi` で実行します。ルートからは `pnpm hoi <script>`（例: `pnpm hoi build`）でも実行できます。

## 開発コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動（HMR 対応） |
| `pnpm build` | 本番ビルド |
| `pnpm typecheck` | 型チェック（`src` と `e2e` 両方） |
| `pnpm biome:check` | Biome による lint / format チェック |
| `pnpm biome:write` | Biome による lint / format の自動修正 |

## 拡張機能の動作確認

1. `pnpm dev` で開発ビルドを実行
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `dist` フォルダを選択

コードを変更すると HMR で自動的にリビルドされます。

## E2E テスト

E2E テストは実際の kintone 環境に対して Playwright で実行します。拡張機能を介さず、kintone の DOM を直接テストします。

### 前提条件

- kintone（または cybozu.com）環境
- 2 つのユーザーアカウント
- スペーステンプレート（1 つ以上）
- [1Password CLI](https://developer.1password.com/docs/cli/)（`op`）

### 環境変数の設定

認証情報は 1Password で管理し、`e2e/.env` には [シークレット参照](https://developer.1password.com/docs/cli/secret-references/)（`op://<vault>/<item>/<field>`）を書きます。`pnpm test:e2e` は `op run` 経由で実行され、参照が実際の値に解決されます。

`.env.example` をコピーして `.env` を作成します。

```bash
cp e2e/.env.example e2e/.env
```

`e2e/.env` を編集して、各値を自分の 1Password のシークレット参照に書き換えてください。参照ではなく値を直接書いても動作します。

| 環境変数 | 説明 |
|---------|------|
| `KINTONE_URL` | kintone の URL（例: `https://example.cybozu.com`） |
| `KINTONE_USERNAME1` | ユーザー 1 のログイン名 |
| `KINTONE_PASSWORD1` | ユーザー 1 のパスワード |
| `KINTONE_USERNAME2` | ユーザー 2 のログイン名 |
| `KINTONE_PASSWORD2` | ユーザー 2 のパスワード |
| `KINTONE_SPACE_TEMPLATE_ID` | スペーステンプレートの ID |

### なぜ 2 ユーザー必要か

通知テストでは、ユーザー 2 がコメントでユーザー 1 をメンションし、ユーザー 1 の通知画面でパーマリンクを取得します。この仕組みにより、通知画面の E2E テストが可能になります。

### スペーステンプレートの準備

1. kintone の管理画面でスペーステンプレートを作成
2. テンプレート ID を `KINTONE_SPACE_TEMPLATE_ID` に設定

テストは実行時にこのテンプレートからスペースを作成し、テスト後に自動で削除します。テンプレートのメンバー設定は不要です（テスト内でメンバーを指定して作成するため）。

### テスト実行

```bash
# ヘッドレスで実行
pnpm test:e2e

# ブラウザを表示して実行
pnpm test:e2e:headed
```

### テストの仕組み

各テストは `beforeAll` でスペースやアプリを自動作成し、`afterAll` で削除します。そのため、テスト実行前に手動でデータを用意する必要はありません。

### デバッグ

ブラウザの動作をゆっくり確認したい場合は、`e2e/playwright.config.ts` の `slowMo` を有効化してください。

```ts
launchOptions: {
  slowMo: 1500,
},
```

## コーディング規約

[Biome](https://biomejs.dev/) でフォーマットと lint を統一しています。

- シングルクォート
- セミコロンなし（`asNeeded`）
- 行幅 100 文字
- インデント: スペース 2 つ

コミット前に `pnpm biome:check` で確認してください。

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) に従ってください。

```
feat: 新機能の追加
fix: バグ修正
docs: ドキュメントの変更
refactor: リファクタリング
test: テストの追加・修正
chore: ビルド・CI 等の変更
```

[release-please](https://github.com/googleapis/release-please) がコミットメッセージを元に自動でバージョニングと CHANGELOG 生成を行います。パッケージごとにリリースされ、`packages/hoi` 以下を変更したコミットだけが hoi のリリース（`hoi-vX.Y.Z`）に入ります。

## PR の出し方

1. `main` ブランチから作業ブランチを作成
2. 変更をコミット
3. `main` に向けて PR を作成
4. CI（typecheck + biome:check）が通ることを確認
