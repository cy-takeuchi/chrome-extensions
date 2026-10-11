import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.resolve(__dirname, "../public/images");
const extensionPath = path.join(ROOT, "packages/hayame/.output/chrome-mv3");

/**
 * トーク系の動画。写すのはポップアップだけで、動画は写さない。
 * 冒頭の完全な無音（ノイズの底が -100 dB になる）を飛ばして 60 秒目から
 */
const VIDEO_URL = "https://www.youtube.com/watch?v=UF8uR6Z6KLc&t=60s";

/**
 * hayame のポップアップを撮る。kintone は使わないので、認証情報なしで撮れる。
 * ポップアップを実際に開く操作は Playwright からできないので、popup.html をタブで開き、
 * 「アクティブなタブ」を YouTube のタブに差し替える
 */
test("hayame", async () => {
  const context = await chromium.launchPersistentContext(
    await mkdtemp(path.join(tmpdir(), "site-hayame-")),
    {
      channel: "chromium",
      locale: "ja-JP",
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    },
  );
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;

  // 再生を始める。クリックはユーザー操作として AudioContext を動かすため
  const video = await context.newPage();
  await video.goto(VIDEO_URL);
  const player = video.locator("video").first();
  await player.waitFor();
  await video.waitForTimeout(3000);
  const box = await player.boundingBox();
  if (box) await video.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await video.waitForTimeout(1000);
  await player.evaluate((v: HTMLVideoElement) => v.play());

  const popup = await context.newPage();
  await popup.addInitScript(() => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = ((_: chrome.tabs.QueryInfo) =>
      query({ url: "https://www.youtube.com/*" })) as typeof chrome.tabs.query;
    // 無音で倍速にした最初の状態で表示を止める。撮る前に発話へ戻らないように
    const connect = chrome.tabs.connect.bind(chrome.tabs);
    let frozen = false;
    chrome.tabs.connect = ((tabId: number, info?: chrome.tabs.ConnectInfo) => {
      const port = connect(tabId, info);
      const addListener = port.onMessage.addListener.bind(port.onMessage);
      port.onMessage.addListener = (fn) =>
        addListener((message, p) => {
          if (frozen) return;
          const s = message.status;
          frozen = s.judgement === "silent" && s.playbackRate > s.baseRate && s.floorDb > -90;
          fn(message, p);
        });
      return port;
    }) as typeof chrome.tabs.connect;
  });
  await popup.setViewportSize({ width: 300, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  // 無音で倍速にしているところを撮る
  await popup.locator("dd.silent").waitFor({ timeout: 60_000 });
  const shot = await popup.locator("main").screenshot();

  // ストアのスクリーンショットと同じ 1280×800 の中央に置く
  const canvas = await context.newPage();
  await canvas.setViewportSize({ width: 640, height: 400 });
  await canvas.setContent(`
    <style>
      html, body { margin: 0; height: 100%; }
      body { display: grid; place-items: center; background: linear-gradient(135deg, #fee2e2, #dbeafe); }
      img { max-height: 352px; border-radius: 8px; box-shadow: 0 8px 32px rgb(0 0 0 / 0.18); background: #fff; }
    </style>
    <img src="data:image/png;base64,${shot.toString("base64")}" />`);
  await canvas.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  await canvas.screenshot({ path: path.join(OUT, "hayame-popup.png") });

  await context.close();
});
