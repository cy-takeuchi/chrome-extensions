import { isBadgeMessage } from "@/lib/messages";
import { type PipProbe, probePictureInPicture, togglePictureInPicture } from "@/lib/pip";

/** PiP の失敗をバッジに出しておく時間 */
const PIP_ERROR_MS = 3000;

const setBadge = async (tabId: number, text: string, color: string, title: string) => {
  await browser.action.setBadgeText({ tabId, text });
  await browser.action.setBadgeBackgroundColor({ tabId, color });
  await browser.action.setTitle({ tabId, title });
};

/** content script にバッジを送り直してもらう。YouTube 以外では受け手がいないので消す */
const refreshBadge = async (tabId: number) => {
  await browser.tabs.sendMessage(tabId, { type: "resend-badge" }).catch(async () => {
    await setBadge(tabId, "", "#6b7280", "hayame").catch(() => {});
  });
};

/**
 * 再生中の動画を PiP で開く。すでに PiP 中なら戻す。
 *
 * ショートカットから呼ばれたときは、activeTab でそのタブに注入でき、
 * 注入したスクリプトはユーザー操作中として実行される（requestPictureInPicture の条件を満たす）。
 * どのフレームの動画を使うかを先に調べ、そのフレームでだけ開閉する
 */
const togglePip = async (tabId: number) => {
  const probes = await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: probePictureInPicture,
  });
  const frames = probes
    .filter((p) => p.result)
    .map((p) => ({ frameId: p.frameId, ...(p.result as PipProbe) }));
  const target =
    frames.find((f) => f.active) ??
    frames.filter((f) => f.area > 0).sort((a, b) => b.area - a.area)[0];
  if (!target) throw new Error("再生中の動画がありません");
  const [result] = await browser.scripting.executeScript({
    target: { tabId, frameIds: [target.frameId] },
    func: togglePictureInPicture,
  });
  if (result?.result) throw new Error(String(result.result));
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const tabId = sender.tab?.id;
    if (!isBadgeMessage(message) || tabId === undefined) return;
    const { text, color, title } = message.badge;
    void setBadge(tabId, text, color, title);
  });

  // 別のページへ移ったら古いバッジを消す。YouTube なら content script が送り直す
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === "complete") void refreshBadge(tabId);
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "toggle-pip" || tab?.id === undefined) return;
    const tabId = tab.id;
    try {
      await togglePip(tabId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("hayame: PiP", message);
      await setBadge(tabId, "PiP", "#dc2626", `hayame: PiP を開けません（${message}）`);
      setTimeout(() => void refreshBadge(tabId), PIP_ERROR_MS);
    }
  });
});
