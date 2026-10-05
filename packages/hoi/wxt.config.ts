import { mkdirSync } from 'node:fs'
import { defineConfig } from 'wxt'
import manifest from './manifest.json'

// pnpm dev で起動する Chrome のプロファイル。残しておき、ログイン状態を次回も引き継ぐ。
// web-ext はフォルダがないと起動に失敗するので先に作る
const chromiumProfile = '.wxt/chrome-data'
mkdirSync(chromiumProfile, { recursive: true })

// background / content_scripts / options_ui は entrypoints から、
// version は package.json から WXT が生成する
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest,
  webExt: {
    chromiumProfile,
    keepProfileChanges: true,
  },
})
