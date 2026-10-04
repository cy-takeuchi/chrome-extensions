# hoi

ブラウザで選択したテキストを GitHub Projects に Draft Issue として登録する Chrome 拡張機能です。

## 機能

- キーボードショートカットで起動（`Cmd+Shift+G` / `Ctrl+Shift+G`）
- 選択テキストを自動取得して Body に設定
- Title / Body の編集
- Assignees の設定（自分を割り当てるかどうか）

## インストール

### 開発版

1. リポジトリをクローン

```bash
git clone https://github.com/cy-takeuchi/hoi.git
cd hoi
```

2. 依存関係をインストール

```bash
pnpm install
```

3. ビルド

```bash
pnpm run build
```

4. Chrome に読み込み
   - `chrome://extensions` を開く
   - 右上の「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist` フォルダを選択

## 初期設定

### 1. GitHub Personal Access Token の取得

1. GitHub にログイン
2. [Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens) を開く
3. 「Generate new token (classic)」をクリック
4. 以下のスコープを選択:
   - `project` - Projects への読み書きアクセス
   - `read:user` - ユーザー情報の読み取り（Assignees 用）
5. トークンを生成してコピー

### 2. 拡張機能の設定

1. Chrome の拡張機能アイコンを右クリック → 「オプション」
2. 「GitHub Personal Access Token」にトークンを入力
3. 「GitHub Projects URL」に登録先の Project URL を入力
   - 例: `https://github.com/users/username/projects/1`
   - 例: `https://github.com/orgs/orgname/projects/1`
4. 「Save Settings」をクリック

## 使い方

1. Web ページ上でテキストを選択
2. ショートカットを押す
   - **Mac**: `Cmd + Shift + G`
   - **Windows/Linux**: `Ctrl + Shift + G`
3. ダイアログが表示される
4. Title を入力（必須）
5. Body を編集（選択テキストが初期値）
6. Assignees を選択
7. 「Add to Project」をクリック

### ショートカットのカスタマイズ

`chrome://extensions/shortcuts` でショートカットを変更できます。

## 開発

```bash
# 開発サーバー起動（HMR 対応）
pnpm run dev

# 本番ビルド
pnpm run build

# 型チェック
pnpm run typecheck
```

## 技術スタック

- [Vite](https://vitejs.dev/) + [CRXJS](https://crxjs.dev/vite-plugin)
- [React](https://react.dev/) 18
- [Headless UI](https://headlessui.com/)
- [TypeScript](https://www.typescriptlang.org/)
- Chrome Extension Manifest V3

## ライセンス

MIT
