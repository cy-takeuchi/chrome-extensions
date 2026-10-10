# utsushi の開発

セットアップ、コマンド、コーディング規約、コミット規約、リリースはリポジトリ共通です。[ルートの CONTRIBUTING.md](../../CONTRIBUTING.md) を見てください。ここには utsushi 固有のことを書きます。

コマンドは `packages/utsushi` で実行します。ルートからは `pnpm utsushi <script>`（例: `pnpm utsushi test`）でも実行できます。

## ディレクトリ構成

| ディレクトリ | 中身 |
|---|---|
| `entrypoints/background.ts` | ショートカットとツールバーのアイコンの受付、添付ファイルのダウンロード |
| `entrypoints/content` | kintone の画面に UI を出す（Shadow DOM 内の React） |
| `entrypoints/options` | オプション画面（プリセットの一覧・削除、エクスポート／インポート） |
| `components` | メニュー（`Palette.tsx`）、プリセット編集、DL 設定、トースト |
| `components/editor` | TipTap のテンプレートエディタ |
| `lib/kintone` | URL の解析、REST API、レコードの値の取り出し |
| `lib/template` | テンプレートの形式・描画・検証・候補・既定テンプレート（エディタ非依存） |
| `lib/actions.ts` | コピーと一括ダウンロードの処理 |
| `lib/files.ts` | ダウンロード対象の添付ファイルの収集 |
| `lib/settings.ts` | `chrome.storage.local` への保存 |
| `lib/messages.ts` | background と content script の間のメッセージ |
| `e2e` | モックした kintone でのスモークテスト |
| `assets/icon.svg` | アイコンの元画像。`public/icon/*.png` は `scripts/render-icons.mjs` で書き出す |

## 技術スタック

- [WXT](https://wxt.dev/)
- [React](https://react.dev/) 19
- [TipTap](https://tiptap.dev/)（テンプレートエディタ）
- [kisekae](https://www.npmjs.com/package/kisekae)（フォームのレイアウト順）
- [Turndown](https://github.com/mixmark-io/turndown)（リッチエディターの HTML を Markdown に変換）
- [TypeScript](https://www.typescriptlang.org/)
- Chrome Extension Manifest V3

## テスト

### 単体テスト

```sh
pnpm test
```

[Vitest](https://vitest.dev/) と happy-dom で実行します。日時の整形を確かめるテストがあるため、タイムゾーンは `Asia/Tokyo` に固定しています（`vitest.config.ts`）。

### E2E テスト

```sh
pnpm build
CHROMIUM_PATH=/path/to/chromium pnpm test:e2e          # ヘッドレスで実行
CHROMIUM_PATH=/path/to/chromium pnpm test:e2e:headed   # ブラウザを表示して実行
```

ビルドした拡張機能を Playwright で Chromium に読み込ませ、`https://example.cybozu.com` へのリクエストをモック（`e2e/mock.mjs`）に差し替えて、プリセットの作成からコピー、ダウンロードまでを一通り動かします。実際の kintone 環境は要りません。

- ブランド版の Google Chrome は `--load-extension` を受け付けないので、Chrome for Testing か Chromium を `CHROMIUM_PATH` で指定してください。Playwright が入れた Chrome for Testing（`~/Library/Caches/ms-playwright/chromium-*/` 以下）も使えます
- ショートカットはブラウザの UI が受けるため、Playwright のキー入力では発火しません。テストは background から content script へ送るメッセージを直接送って代わりにしています
