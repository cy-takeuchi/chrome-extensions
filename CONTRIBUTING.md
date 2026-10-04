# コントリビューションガイド

このリポジトリは、Chrome 拡張機能を [pnpm workspace](https://pnpm.io/workspaces) でまとめたモノレポです。各拡張機能は `packages/` 以下にあり、どれも [WXT](https://wxt.dev/) でビルドします。

ここにはリポジトリ全体のルールを書いています。パッケージごとのコマンドやテストの詳しい説明は、各パッケージの CONTRIBUTING.md を見てください。

- [hoi](packages/hoi/CONTRIBUTING.md)
- [utsushi](packages/utsushi/CONTRIBUTING.md)

## 開発環境のセットアップ

### 必要なツール

- Node.js 22 以上
- pnpm 12

### インストール

依存関係はリポジトリのルートでまとめてインストールします。

```sh
git clone https://github.com/cy-takeuchi/chrome-extensions.git
cd chrome-extensions
pnpm install
```

`pnpm install` の途中で各パッケージの `wxt prepare` が走り、型定義（`.wxt/`）が作られます。`~/.npmrc` で `ignore-scripts=true` にしている場合は、各パッケージで `pnpm prepare` を手で実行してください。

## コマンド

各パッケージのスクリプトは、どのパッケージでも同じ名前です。パッケージのディレクトリで実行するか、ルートから `pnpm <パッケージ名> <スクリプト>` で実行します。

| コマンド | 説明 |
|---|---|
| `pnpm dev` | 拡張機能を読み込んだブラウザを起動（変更すると自動でリロード） |
| `pnpm build` | 本番ビルド（`.output/chrome-mv3`） |
| `pnpm zip` | 配布用 zip を作成 |
| `pnpm typecheck` | 型チェック |
| `pnpm biome:check` | Biome による lint / format チェック |
| `pnpm biome:write` | Biome による lint / format の自動修正 |
| `pnpm test` | 単体テスト（Vitest） |
| `pnpm test:e2e` | E2E テスト（Playwright） |
| `pnpm test:e2e:headed` | E2E テストをブラウザを表示して実行 |

ルートでは次のコマンドも使えます。

```sh
pnpm build          # すべてのパッケージをビルド
pnpm biome:check    # すべてのパッケージを lint / format チェック
pnpm biome:write    # lint / format を自動修正
```

## 拡張機能の動作確認

`pnpm dev` を実行すると、拡張機能を読み込んだ Chrome が起動します。コードを変更すると自動でリビルド・リロードされます。

普段使っている Chrome で確認する場合は、次の手順で読み込みます。

1. パッケージのディレクトリで `pnpm build` を実行
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. パッケージの `.output/chrome-mv3` フォルダを選択

## コーディング規約

[Biome](https://biomejs.dev/) でフォーマットと lint を統一しています。共通の設定はルートの `biome.json` にあり、クォートとセミコロンの書き方だけ各パッケージの `biome.json` で上書きしています。

| | hoi | utsushi |
|---|---|---|
| クォート | シングル | ダブル |
| セミコロン | なし（`asNeeded`） | あり |

共通: 行幅 100 文字、インデントはスペース 2 つ。

コミット前に `pnpm biome:check` で確認してください。意図して lint のルールに反する書き方をするときは、`// biome-ignore <ルール>: <理由>` で理由を残します。

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/ja/) に従ってください。どのパッケージの変更かをスコープに書きます。

```
feat(hoi): 新機能の追加
fix(utsushi): バグ修正
docs: ドキュメントの変更
refactor(hoi): リファクタリング
test(utsushi): テストの追加・修正
chore: ビルド・CI 等の変更
```

## リリース

[release-please](https://github.com/googleapis/release-please) がコミットメッセージを元に、パッケージごとにバージョンと CHANGELOG を更新します。

- そのパッケージのディレクトリを変更したコミットだけが、そのパッケージのリリースに入ります
- タグは `hoi-vX.Y.Z` / `utsushi-vX.Y.Z` で、リリースには `wxt zip` で作った zip を添付します
- `feat` でマイナー、`fix` でパッチが上がります。1.0.0 未満の間は、破壊的変更でもマイナーが上がります
- バージョンは各パッケージの `package.json` にだけ書きます。`manifest.json` の `version` はビルド時に WXT が入れます

## PR の出し方

1. `main` ブランチから作業ブランチを作成
2. 変更をコミット
3. `main` に向けて PR を作成
4. CI（Biome、各パッケージの typecheck と単体テスト）が通ることを確認
