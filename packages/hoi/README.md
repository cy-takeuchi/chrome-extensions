# hoi

kintone などの画面で選択したテキストを、元ページへのリンク付きで GitHub Projects に Draft Issue として登録する Chrome 拡張機能です。

kintone のスレッドやレコードのコメントを選択した場合は、一時的なページの URL ではなく、そのコメントのパーマリンクを付けます。

## 機能

- キーボードショートカットで起動（`Cmd+Shift+G` / `Ctrl+Shift+G`）
- 選択テキストと元ページの URL を自動取得して本文に設定
- kintone のコメント（スペースのスレッド、レコード、通知画面）を選択した場合は、そのコメントのパーマリンクを設定
- タイトルと本文の編集
- 担当者の設定（自分を担当者にするかどうか）

## インストール

Chrome ウェブストアには公開していないので、パッケージ化されていない拡張機能として読み込みます。

1. 拡張機能のファイルを用意する。次のどちらか
   - [リリース](https://github.com/cy-takeuchi/chrome-extensions/releases)から `hoi-X.Y.Z-chrome.zip` をダウンロードして展開する
   - ソースからビルドする

     ```sh
     git clone https://github.com/cy-takeuchi/chrome-extensions.git
     cd chrome-extensions
     pnpm install
     pnpm hoi build   # packages/hoi/.output/chrome-mv3 にできる
     ```

2. Chrome で `chrome://extensions` を開き、右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」で、展開したフォルダ（ビルドした場合は `packages/hoi/.output/chrome-mv3`）を選ぶ

## 初期設定

### 1. GitHub Personal Access Token の取得

1. GitHub にログイン
2. [Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens) を開く
3. 「Generate new token (classic)」をクリック
4. 以下のスコープを選択:
   - `project` - Projects への読み書きアクセス
   - `read:user` - ユーザー情報の読み取り（担当者の設定用）
5. トークンを生成してコピー

### 2. 拡張機能の設定

1. Chrome の拡張機能アイコンを右クリック → 「オプション」
2. 「GitHub Personal Access Token」にトークンを入力
3. 「GitHub Projects の URL」に登録先の Project の URL を入力
   - 例: `https://github.com/users/username/projects/1`
   - 例: `https://github.com/orgs/orgname/projects/1`
4. 「保存」をクリック

## 使い方

1. Web ページ上でテキストを選択
2. ショートカットを押す
   - **Mac**: `Cmd + Shift + G`
   - **Windows/Linux**: `Ctrl + Shift + G`
3. ダイアログが表示される
4. タイトルを入力（必須）
5. 本文を編集（選択テキストと URL が初期値）
6. 担当者を選択
7. 「Project に追加」をクリック

### ショートカットのカスタマイズ

`chrome://extensions/shortcuts` でショートカットを変更できます。

## 仕組み

- 本文には、選択したテキストと、いま開いているページの URL を入れます
- kintone の画面でコメントを選択した場合は、ページの URL の代わりに、そのコメントのパーマリンクを入れます。スペースのスレッド、レコード詳細、通知画面のコメントに対応しています
- GitHub への登録は、オプション画面で設定したトークンを使って [GitHub GraphQL API](https://docs.github.com/ja/graphql) で行います。トークンは `chrome.storage.sync` に保存されます

## 開発

[CONTRIBUTING.md](CONTRIBUTING.md) を見てください。リポジトリ共通のルールは[ルートの CONTRIBUTING.md](../../CONTRIBUTING.md) にあります。

## ライセンス

[MIT](../../LICENSE)
