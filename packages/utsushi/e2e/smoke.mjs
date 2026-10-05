/**
 * ビルドした拡張を Chromium に読み込ませ、モックした kintone で一通り動かす。
 *
 *   pnpm build && CHROMIUM_PATH=... pnpm test:e2e
 *
 * ショートカットはブラウザの UI が受けるので Playwright のキー入力では発火しない。
 * バックグラウンドからタブへ送るメッセージを直接送って代わりにする。
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { installMock, ORIGIN } from "./mock.mjs";

const extensionPath = path.resolve(".output/chrome-mv3");
const userDataDir = await mkdtemp(path.join(tmpdir(), "utsushi-"));
const downloadsDir = await mkdtemp(path.join(tmpdir(), "utsushi-dl-"));

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: process.env.CHROMIUM_PATH,
  headless: !process.env.HEADED,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  permissions: ["clipboard-read", "clipboard-write"],
  acceptDownloads: true,
  downloadsPath: downloadsDir,
});
const apiLog = [];
await installMock(context, apiLog);

const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const page = await context.newPage();
await page.goto(`${ORIGIN}/k/12/show#record=34`);
await page.bringToFront();

const send = (command) =>
  worker.evaluate(async (command) => {
    const [tab] = await chrome.tabs.query({ url: "https://example.cybozu.com/*" });
    await chrome.tabs.sendMessage(tab.id, { type: "command", command });
  }, command);

const host = page.locator("utsushi-root");
const toast = host.locator(".toast");
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
const step = (name) => console.log(`- ${name}`);
/** SCREENSHOTS=dir を渡すと要所でスクリーンショットを撮る */
const shot = (name) =>
  process.env.SCREENSHOTS &&
  page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${name}.png`) });

// content script の読み込みを待つ
await host.waitFor({ state: "attached" });

step("プリセットが無ければ Enter で既定テンプレート入りのエディタが開く");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("Enter");
const editor = host.locator(".tiptap");
await editor.waitFor();
const chips = await host.locator(".chip").allTextContents();
assert.ok(chips.includes("件名") && chips.includes("投稿者"), `chips: ${chips}`);
assert.equal(await host.locator(".loop").count(), 2);
await shot("1-default-template");

step("既定テンプレートで保存してコピー");
await host.getByRole("button", { name: "保存してコピー" }).click();
await toast.filter({ hasText: "コピーしました" }).waitFor();
let text = await clipboard();
assert.match(text, /^レコード: https:\/\/example\.cybozu\.com\/k\/12\/show#record=34/);
assert.match(text, /件名: 見積もり依頼/);
assert.match(text, /本文: 至急\*\*対応\*\*/);
assert.match(text, /【請求先】\n住所: 東京都/);
assert.match(text, /- 品名: りんご \/ 仕様書: 仕様1.txt\n- 品名: みかん \/ 仕様書: \n/);
assert.match(text, /ステータス: 処理中/);
assert.match(text, /コメント12$/, "コメントは 2 ページ目まで取る");
assert.ok(text.indexOf("コメント1\n") < text.indexOf("コメント12"), "コメントは古い順");

step("@ で差し込んだテンプレートを作る");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("n");
await editor.waitFor();
await host.locator("input.name").fill("要約");
await editor.click();
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.press("Backspace");
await page.keyboard.type("件名は");
await page.keyboard.type("@subj");
await host.locator(".suggest-item.active").filter({ hasText: "件名" }).waitFor();
await page.keyboard.press("Enter");
await page.keyboard.type("です。");
await page.keyboard.press("Enter");
await page.keyboard.type("@明細");
await host.locator(".suggest-item.active").filter({ hasText: "明細" }).waitFor();
await page.keyboard.press("Enter");
await host.locator(".loop").waitFor();
await page.keyboard.type("* ");
await page.keyboard.type("@品");
await host.locator(".suggest-item.active").filter({ hasText: "品名" }).waitFor();
await page.keyboard.press("Enter");
await page.keyboard.type("を確認");
// ↓ でブロックの外（末尾の段落）へ出て、全行連結の列を書く
await page.keyboard.press("ArrowDown");
await page.keyboard.type("全品名: ");
await page.keyboard.type("＠品名");
await host.locator(".suggest-item.active").filter({ hasText: "全行連結" }).waitFor();
await shot("2-suggest");
await page.keyboard.press("Enter");
await host.getByRole("button", { name: "保存してコピー" }).click();
await toast.filter({ hasText: "「要約」でコピーしました" }).waitFor();
text = await clipboard();
assert.equal(
  text,
  "件名は見積もり依頼 です。\n* りんご を確認\n* みかん を確認\n全品名: りんご, みかん ",
);

step("パレットから番号でコピー（デフォルトは 1 番目のまま）");
await send("open-menu");
await host.locator(".palette").waitFor();
assert.equal(await host.locator(".preset .badge").count(), 1);
await shot("3-palette");
await page.keyboard.press("2");
await toast.filter({ hasText: "「要約」でコピーしました" }).waitFor();

step("メニューを開いて Enter でデフォルトのプリセットでコピー");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("Enter");
await toast.filter({ hasText: /「(?!要約).+」でコピーしました/ }).waitFor();

step("同じショートカットをもう一度押すとメニューが閉じる");
await send("open-menu");
await host.locator(".palette").waitFor();
await send("open-menu");
await host.locator(".palette").waitFor({ state: "detached" });

step("コメントを使わないテンプレートではコメント API を呼ばない");
apiLog.length = 0;
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("2");
await toast.filter({ hasText: "「要約」でコピーしました" }).waitFor();
assert.ok(!apiLog.some((l) => l.includes("comments")), apiLog.join("\n"));

step("DL設定で仕様書だけにしてダウンロード");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("Shift+D");
await host.getByText("選んだフィールドだけ").click();
await host.getByRole("checkbox", { name: "添付 · attachments" }).uncheck();
const downloads = [];
page.on("download", (d) => downloads.push(d));
context.on("download", (d) => downloads.push(d));
await host.getByRole("button", { name: "保存してダウンロード" }).click();
await toast.filter({ hasText: /ダウンロードを開始しました|失敗/ }).waitFor();
console.log(`  toast: ${await toast.textContent()}`);
const fileRequests = apiLog.filter((l) => l.includes("file.json"));
console.log(`  file.json requests: ${fileRequests.join(", ") || "(なし)"}`);

step("メニューの d でそのままダウンロード");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("d");
await toast.filter({ hasText: "1 件のダウンロードを開始しました" }).waitFor();

await context.close();
console.log("ok");
