import { defineConfig } from 'wxt'
import manifest from './manifest.json'

// background / content_scripts / options_ui は entrypoints から、
// version は package.json から WXT が生成する
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest,
})
