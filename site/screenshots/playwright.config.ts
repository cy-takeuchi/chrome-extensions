import { defineConfig } from '@playwright/test'

/**
 * サイトとストアに載せるスクリーンショットを、実際の kintone 環境で撮る。
 * 認証情報は hoi の E2E と同じ e2e/.env（1Password の参照）を使う。
 */
export default defineConfig({
  testDir: '.',
  timeout: 5 * 60_000,
  workers: 1,
  reporter: 'line',
  use: { trace: 'retain-on-failure' },
})
