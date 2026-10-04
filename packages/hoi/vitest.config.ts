import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  plugins: [WxtVitest()],
  // e2e/ は Playwright で実行する
  test: { environment: 'happy-dom', exclude: [...configDefaults.exclude, 'e2e/**'] },
})
