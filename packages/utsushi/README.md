# utsushi

**utsushi**（写し）は、kintone のレコード詳細画面で、レコードとコメントの内容をテンプレートに差し込んでクリップボードにコピーする Chrome 拡張です。添付ファイルの一括ダウンロードもできます。

## インストール

utsushi は [chrome-extensions](https://github.com/cy-takeuchi/chrome-extensions) モノレポの 1 パッケージです。依存関係はリポジトリのルートでインストールします。

```sh
pnpm install       # リポジトリのルートで実行
cd packages/utsushi
pnpm wxt prepare   # ~/.npmrc が ignore-scripts=true なら手で実行する
pnpm build
```

`chrome://extensions` でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3` を選びます。

## 使い方

kintone のレコード詳細画面（`/k/{アプリID}/show#record={レコードID}`。ゲストスペースも可）で次のショートカットを使います。

| ショートカット | 動作 |
|---|---|
| `⌥⇧C` | デフォルトのプリセットでコピー。プリセットが無ければ作成画面を開く |
| `⌥⇧P` | プリセット選択パレット（`1`〜`9`/`Enter` でコピー、`e` 編集、`n` 新規、`s` デフォルトにする、`d` DL設定） |
| `⌥⇧D` | 添付ファイルを一括ダウンロード（`ダウンロード/kintone/{アプリID}-{レコードID}/`） |

キーは `chrome://extensions/shortcuts` で変えられます。

### プリセット

プリセットは「ドメイン＋アプリID」ごとに複数保存できます。中身は自由に書けるテンプレートで、`@`（全角の `＠` も可）を打つとフィールドの候補が出ます。

- フィールドを選ぶとラベル表示のチップになる（保存はフィールドコード）
- サブテーブルを選ぶと「各行を繰り返すブロック」になり、中に書いた文章と列が行ごとに繰り返される。ブロックの外に置いた列は全行の値を `, ` で連結する
- 「コメント」を選ぶと「各件を繰り返すブロック」になり、中で `@投稿者` `@日時` `@本文` `@メンション` が使える。コメントは全件、古い順
- `@レコードURL` `@レコードID` `@アプリID` も使える

新規作成時は、全フィールドを並べたテンプレートが入っています。不要な行を消して使ってください。

値の整形：リッチエディターは Markdown、ユーザー選択などは表示名、添付ファイルはファイル名、日時は利用者のタイムゾーンの `YYYY-MM-DD HH:mm`。閲覧権限のないフィールドは空になります。

テンプレートが参照するフィールドがアプリから消えていた場合は、コピーを中止します（エディタでは赤く表示されます）。

### ダウンロード設定

パレットの `d` から、一括ダウンロードの対象にする添付ファイルフィールドをアプリごとに選べます。未設定なら全フィールド（サブテーブル内を含む）が対象です。コメントの添付ファイルは REST API で取れないため対象外です。

### オプション画面

保存しているプリセットの一覧・削除と、JSON でのエクスポート／インポートができます。

## 仕組み

- データは kintone REST API から、ログイン中のセッション（`X-Requested-With: XMLHttpRequest`）で取ります。編集画面で保存前の内容は反映されません
- フォームのレイアウト順は [kisekae](https://www.npmjs.com/package/kisekae) で取ります
- 添付ファイルはバックグラウンドから `chrome.downloads` で `file.json` を直接ダウンロードします

## 開発

```sh
pnpm dev        # HMR 付きで起動
pnpm test       # 単体テスト
pnpm compile    # 型チェック
pnpm build && CHROMIUM_PATH=/path/to/chromium pnpm e2e   # モックした kintone でのスモークテスト
```

e2e は Playwright で拡張を読み込ませ、`https://example.cybozu.com` へのリクエストをモックに差し替えて動かします。ブランド版の Google Chrome は `--load-extension` を受け付けないので、Chrome for Testing / Chromium を `CHROMIUM_PATH` で指定してください。

| ディレクトリ | 中身 |
|---|---|
| `lib/kintone` | URL の解析と REST API |
| `lib/template` | テンプレートの形式・描画・検証・候補・既定テンプレート（エディタ非依存） |
| `lib/settings.ts` | `chrome.storage.local` への保存 |
| `components` | kintone の画面に出す UI（Shadow DOM 内の React） |
| `components/editor` | TipTap のエディタ |
| `entrypoints` | background / content script / オプション画面 |
