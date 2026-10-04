import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

// 日時の整形を検証するのでタイムゾーンを固定する
process.env.TZ = "Asia/Tokyo";

export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: "happy-dom" },
});
