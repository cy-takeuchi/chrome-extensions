/**
 * assets/icon.svg から public/icon/{16,32,48,128}.png を書き出す。
 *
 *   CHROMIUM_PATH=... node scripts/render-icons.mjs
 *
 * 文字はシステムのフォントで描くので、日本語フォントのある環境で実行する。
 */
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const svg = await readFile("assets/icon.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
