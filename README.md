# chrome-extensions

kintone / cybozu まわりを中心とした Chrome 拡張機能をまとめたモノレポです。

| パッケージ | 説明 |
|---|---|
| [hayame](packages/hayame) | YouTube の動画で、人が喋っていない区間だけを自動で速く再生する。標準の Picture-in-Picture もショートカットで開ける |
| [hoi](packages/hoi) | kintone の画面で選択したテキストを、元ページへのリンク付きで GitHub Projects に Draft Issue として登録する |
| [utsushi](packages/utsushi) | kintone のレコードとコメントをテンプレートに差し込んでコピーし、添付ファイルを一括ダウンロードする |

## インストール

各拡張機能の README を見てください。

## 開発

依存関係はルートの `pnpm install` でまとめて入ります。各パッケージのスクリプトはルートから `pnpm hayame <script>` / `pnpm hoi <script>` / `pnpm utsushi <script>` でも実行できます。

```sh
pnpm install
pnpm hoi dev        # hoi を読み込んだブラウザを起動
pnpm utsushi test   # utsushi の単体テスト
pnpm build          # すべてのパッケージをビルド
pnpm biome:check    # すべてのパッケージを lint / format チェック
```

セットアップ、コマンド、コーディング規約、コミット規約、リリースの流れは [CONTRIBUTING.md](CONTRIBUTING.md) にあります。

## ライセンス

[MIT](LICENSE)
