import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "utsushi",
    description:
      "kintone のレコードとコメントをテンプレートに差し込んでコピーし、添付ファイルを一括ダウンロードする",
    permissions: ["storage", "downloads", "unlimitedStorage", "clipboardWrite"],
    host_permissions: ["https://*.cybozu.com/*", "https://*.kintone.com/*"],
    commands: {
      "copy-default": {
        suggested_key: { default: "Alt+Shift+C" },
        description: "デフォルトのプリセットでコピー",
      },
      "open-palette": {
        suggested_key: { default: "Alt+Shift+P" },
        description: "プリセット選択パレットを開く",
      },
      "download-files": {
        suggested_key: { default: "Alt+Shift+D" },
        description: "添付ファイルを一括ダウンロード",
      },
    },
  },
});
