import {
  type BadgeMessage,
  type LogMessage,
  type LogRequest,
  STATUS_PORT,
  type StatusMessage,
} from "@/lib/messages";
import { pickVideo } from "@/lib/player/pick";
import { VideoSession } from "@/lib/player/session";
import { SampleLog } from "@/lib/sampleLog";
import { loadSettings, type Settings, watchSettings } from "@/lib/settings";
import { badgeFor, emptyStatus, type Status } from "@/lib/status";

/** ポップアップへ状態を流す間隔 */
const REPORT_MS = 100;
/** 書き出せる計測の件数。40ms ごとなので約 2 分 */
const LOG_CAPACITY = 3000;

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  async main(ctx) {
    let settings: Settings = await loadSettings();
    let session: VideoSession | null = null;
    let audio: AudioContext | null = null;
    const log = new SampleLog(LOG_CAPACITY);

    /**
     * 解析専用の AudioContext。出力にはつながないので、止まっていても再生音には影響しない。
     * 自動再生の制限で suspended のまま作られたら、ページの操作を待って再開する
     */
    const audioContext = () => {
      audio ??= new AudioContext();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      return audio;
    };

    const stopSession = () => {
      session?.stop();
      session = null;
    };

    const sync = () => {
      if (!settings.enabled) {
        stopSession();
        return;
      }
      const video = pickVideo(document, session?.video ?? null);
      if (video === session?.video) return;
      stopSession();
      if (!video) return;
      session = new VideoSession(video, audioContext(), settings, (entry) => log.push(entry));
      session.start();
    };

    const status = (): Status => session?.status ?? emptyStatus(settings.enabled ? "idle" : "off");

    // バッジは変わったときだけ background に送る。background から求められたら送り直す
    let lastBadge = "";
    const sendBadge = (force = false) => {
      const badge = badgeFor(status());
      const key = JSON.stringify(badge);
      if (!force && key === lastBadge) return;
      lastBadge = key;
      const message: BadgeMessage = { type: "badge", badge };
      browser.runtime.sendMessage(message).catch(() => {});
    };

    const ports = new Set<Browser.runtime.Port>();
    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== STATUS_PORT) return;
      ports.add(port);
      port.onDisconnect.addListener(() => ports.delete(port));
      port.onMessage.addListener((message: LogRequest) => {
        if (message?.type !== "log") return;
        const reply: LogMessage = { type: "log", csv: log.toCsv() };
        port.postMessage(reply);
      });
    });
    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type === "resend-badge") sendBadge(true);
    });

    ctx.setInterval(() => {
      sendBadge();
      if (ports.size === 0) return;
      const message: StatusMessage = { type: "status", status: status() };
      for (const port of ports) port.postMessage(message);
    }, REPORT_MS);

    // メディアのイベントはバブリングしないので capture で拾う。
    // <video> が差し替わっても、新しい要素の play などで拾える
    for (const type of ["play", "playing", "loadedmetadata", "emptied"])
      ctx.addEventListener(document, type, sync, { capture: true });
    // 解析している <video> が DOM から外れたら選び直す
    const observer = new MutationObserver(() => {
      if (session && !session.video.isConnected) sync();
    });
    observer.observe(document, { childList: true, subtree: true });

    for (const type of ["pointerdown", "keydown"])
      ctx.addEventListener(window, type, () => audio?.resume().catch(() => {}), { capture: true });

    // ページを離れるときは基準速度に戻す。bfcache から戻ったら選び直す
    ctx.addEventListener(window, "pagehide", stopSession);
    ctx.addEventListener(window, "pageshow", sync);

    const unwatch = watchSettings((next) => {
      settings = next;
      session?.setSettings(next);
      sync();
    });

    // 拡張の更新・無効化で content script が止まるときも基準速度に戻す
    ctx.onInvalidated(() => {
      unwatch();
      observer.disconnect();
      stopSession();
      audio?.close().catch(() => {});
    });

    sync();
    sendBadge(true);
  },
});
