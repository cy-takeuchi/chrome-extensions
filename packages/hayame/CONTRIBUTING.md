# hayame の開発

セットアップ、コマンド、コーディング規約、コミット規約、リリースはリポジトリ共通です。[ルートの CONTRIBUTING.md](../../CONTRIBUTING.md) を見てください。ここには hayame 固有のことを書きます。

コマンドは `packages/hayame` で実行します。ルートからは `pnpm hayame <script>`（例: `pnpm hayame test`）でも実行できます。

## ディレクトリ構成

| ディレクトリ | 中身 |
|---|---|
| `entrypoints/background.ts` | バッジの表示と、ショートカットでの PiP の開閉 |
| `entrypoints/content.ts` | YouTube のページで解析する `<video>` を選び、セッションを作る |
| `entrypoints/popup` | ポップアップ（設定とデバッグ表示） |
| `lib/player` | DOM に触る部分。`<video>` ごとの解析と速度の制御（`session.ts`）、対象の選び方（`pick.ts`） |
| `lib/judge.ts` ほか | DOM から切り離した判定ロジック。音量の分布（`levelStats.ts`）、無音の判定（`silenceDetector.ts`）、基準速度の追跡（`rateTracker.ts`）、RMS（`rms.ts`）、バッジ（`status.ts`）、書き出す計測のログ（`sampleLog.ts`） |
| `lib/pip.ts` | PiP のためにページへ注入する関数 |
| `lib/settings.ts` | `chrome.storage.local` への保存 |
| `assets/icon.svg` | アイコンの元画像。`public/icon/*.png` は `scripts/render-icons.mjs` で書き出す |

## 技術スタック

- [WXT](https://wxt.dev/)
- [React](https://react.dev/) 19（ポップアップ）
- [TypeScript](https://www.typescriptlang.org/)
- Chrome Extension Manifest V3

## テスト

```sh
pnpm test
```

[Vitest](https://vitest.dev/) で、判定ロジック（声の大きさとノイズの底の推定、間のない動画の扱い、しきい値・最短時間・ヒステリシスによる状態遷移、基準速度の追跡）、バッジ、設定を確かめます。

## 実機での確認

`pnpm dev` か、`pnpm build` して読み込んだ Chrome で、YouTube のトーク系の動画を再生し、ポップアップのデバッグ表示を見ます。

- ソースが変わると、Chrome は captureStream の MediaStream に新しい音声トラックを足すが、古いトラックは無音のまま `live` で残る。古いトラックを解析すると音が取れないので、新しいトラックにつなぎ直している
- 判定がおかしい動画では、ポップアップの「ログを保存」で CSV を取る。`fullDb`（判定に使う全帯域の RMS）と `bandDb`（声の帯域 300〜3400 Hz の RMS、比較用）を並べてあるので、分布やしきい値の位置を見て調整する
- ショートカットはブラウザの UI が受けるため、Playwright のキー入力では発火しない。⌥P は手で押して確かめる
