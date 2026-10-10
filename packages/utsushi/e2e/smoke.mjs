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
  "件名は見積もり依頼 です。\n* りんご を確認\n* みかん を確認\n全品名: りんご, みかん",
);

const presetNames = () => host.locator(".preset-name").allTextContents();

step("メニューから番号でコピー（新しいプリセットは末尾に並ぶ）");
await send("open-menu");
await host.locator(".palette").waitFor();
assert.deepEqual(await presetNames(), ["プリセット 1", "要約"]);
await shot("3-palette");
await page.keyboard.press("2");
await toast.filter({ hasText: "「要約」でコピーしました" }).waitFor();

step("メニューを開いて Enter で先頭のプリセットでコピー");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("Enter");
await toast.filter({ hasText: "「プリセット 1」でコピーしました" }).waitFor();

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

step("DL設定から Esc と「戻る」でメニューに戻る");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("Shift+D");
await host.getByText("一括ダウンロードの対象").waitFor();
await page.keyboard.press("Escape");
await host.locator(".palette").waitFor();
await page.keyboard.press("Shift+D");
await host.getByRole("button", { name: "戻る" }).click();
await host.locator(".palette").waitFor();
await page.keyboard.press("Escape");
await host.locator(".palette").waitFor({ state: "detached" });

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

step("プリセット編集から「戻る」と Esc でメニューに戻る");
await send("open-menu");
await host.locator(".palette").waitFor();
await page.keyboard.press("e");
await editor.waitFor();
await host.getByRole("button", { name: "戻る" }).click();
await host.locator(".palette").waitFor();
await page.keyboard.press("e");
await editor.waitFor();
await page.keyboard.press("Escape");
await host.locator(".palette").waitFor();

step("⌥↓ で並び替えると、先頭が開いた直後の選択になる");
await page.keyboard.press("Alt+ArrowDown");
// 動かしたプリセットは選んだまま
await host.locator(".preset.active").nth(0).filter({ hasText: "プリセット 1" }).waitFor();
await host.locator(".preset").nth(1).filter({ hasText: "プリセット 1" }).waitFor();
assert.deepEqual(await presetNames(), ["要約", "プリセット 1"]);
await page.keyboard.press("Escape");
await send("open-menu");
await host.locator(".palette").waitFor();
assert.deepEqual(await presetNames(), ["要約", "プリセット 1"], "並び順は保存される");
await page.keyboard.press("Enter");
await toast.filter({ hasText: "「要約」でコピーしました" }).waitFor();

step("つまみのドラッグで並び替える（つまみのクリックではコピーしない）");
await send("open-menu");
await host.locator(".palette").waitFor();
const handles = host.locator(".drag-handle");
await handles.nth(0).click();
await page.waitForTimeout(300);
assert.equal(await host.locator(".palette").count(), 1, "メニューは開いたまま");
await handles.nth(1).dragTo(host.locator(".preset").nth(0));
await host.locator(".preset").nth(0).filter({ hasText: "プリセット 1" }).waitFor();
await page.keyboard.press("Escape");
await send("open-menu");
await host.locator(".palette").waitFor();
assert.deepEqual(await presetNames(), ["プリセット 1", "要約"], "並び順は保存される");

step("メニューの Delete で削除する（確認でキャンセルしたら残す）");
page.once("dialog", (d) => d.dismiss());
await page.keyboard.press("Delete");
await page.waitForTimeout(300);
assert.deepEqual(await presetNames(), ["プリセット 1", "要約"]);
page.once("dialog", (d) => d.accept());
await page.keyboard.press("Delete");
await host
  .locator(".preset-name")
  .filter({ hasText: "プリセット 1" })
  .waitFor({ state: "detached" });
assert.deepEqual(await presetNames(), ["要約"]);
await page.keyboard.press("Enter");
await toast.filter({ hasText: "「要約」でコピーしました" }).waitFor();

step("ツールバーのアイコンは kintone の画面でだけ押せる");
{
  // kintone 以外のタブは URL が読めない（tabs 権限が無い）ので undefined になる
  const enabled = () =>
    worker.evaluate(async () => {
      const state = {};
      for (const t of await chrome.tabs.query({}))
        state[t.url ?? "other"] = await chrome.action.isEnabled(t.id);
      return state;
    });
  const kintone = `${ORIGIN}/k/12/show#record=34`;
  const other = await context.newPage();
  await other.goto("about:blank");
  assert.deepEqual(await enabled(), { [kintone]: true, other: false });
  // 同じタブで kintone を開くと押せるようになり、離れると押せなくなる
  await other.goto(`${ORIGIN}/k/12/show#record=35`);
  assert.equal((await enabled())[`${ORIGIN}/k/12/show#record=35`], true);
  await other.goto("about:blank");
  assert.deepEqual(await enabled(), { [kintone]: true, other: false });
  await other.close();
}

await context.close();
console.log("ok");
