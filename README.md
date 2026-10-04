# chrome-extensions

kintone / cybozu まわりの Chrome 拡張機能をまとめたモノレポです。

| パッケージ | 説明 |
|---|---|
| [hoi](packages/hoi) | ブラウザで選択したテキストを GitHub Projects に Draft Issue として登録する |
| [utsushi](packages/utsushi) | kintone のレコードとコメントをテンプレートに差し込んでコピーし、添付ファイルを一括ダウンロードする |

## セットアップ

必要なもの: Node.js 22 以上、pnpm 12

```sh
git clone https://github.com/cy-takeuchi/chrome-extensions.git
cd chrome-extensions
pnpm install
```

依存関係は [pnpm workspace](https://pnpm.io/workspaces) でまとめて管理しています。`pnpm install` はルートで実行してください。

## コマンド

各パッケージのスクリプトは、パッケージのディレクトリで実行するか、ルートから次の形で実行します。

```sh
pnpm hoi <script>       # 例: pnpm hoi build
pnpm utsushi <script>   # 例: pnpm utsushi test
pnpm build              # すべてのパッケージをビルド
```

使えるスクリプトは各パッケージの README を見てください。

## リリース

[release-please](https://github.com/googleapis/release-please) がパッケージごとにリリースを作ります。`main` に入ったコミットのうち、そのパッケージのディレクトリを変更したものがリリースに含まれ、タグは `hoi-vX.Y.Z` / `utsushi-vX.Y.Z` になります。コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/ja/) で書いてください。
