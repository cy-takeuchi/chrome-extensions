import {
  type Command,
  type CommandMessage,
  type DownloadRequest,
  type DownloadResult,
  isCommand,
} from "@/lib/messages";

/** タブの content script にコマンドを送る */
const sendCommand = async (command: Command, tab?: Browser.tabs.Tab) => {
  const target = tab ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  if (target?.id === undefined) return;
  const message: CommandMessage = { type: "command", command };
  // kintone 以外のタブでは受け手がいないので失敗する。それで構わない
  await browser.tabs.sendMessage(target.id, message).catch(() => {});
};

/**
 * content script と同じ、kintone の画面（`/k/` 以下）か。
 * tabs 権限は無いが、host_permissions のサイトのタブなら URL が読める。それ以外は undefined
 */
const isKintonePage = (url: string | undefined) =>
  url !== undefined && /^https:\/\/[^/]+\.(cybozu|kintone)\.com\/k\//.test(url);

/** ツールバーのアイコンは kintone の画面でだけ押せるようにする */
const syncAction = async (tabId: number, url: string | undefined) => {
  if (isKintonePage(url)) await browser.action.enable(tabId);
  else await browser.action.disable(tabId);
};

const syncAllTabs = async () => {
  for (const tab of await browser.tabs.query({}))
    if (tab.id !== undefined) await syncAction(tab.id, tab.url);
};

export default defineBackground(() => {
  // 新しいタブは無効から始める。タブごとの設定はこれより優先される
  void browser.action.disable();
  browser.runtime.onInstalled.addListener(() => void syncAllTabs());
  browser.runtime.onStartup.addListener(() => void syncAllTabs());
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url !== undefined || change.status === "loading") void syncAction(tabId, tab.url);
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (isCommand(command)) await sendCommand(command, tab);
  });

  // ツールバーのアイコンでも、ショートカットと同じくメニューを開閉する。kintone 以外では押せない
  browser.action.onClicked.addListener((tab) => sendCommand("open-menu", tab));

  browser.runtime.onMessage.addListener((message: DownloadRequest, _sender, sendResponse) => {
    if (message?.type !== "download") return;
    download(message).then(sendResponse);
    return true;
  });
});

/**
 * kintone の file.json を直接ダウンロードする。downloads API はブラウザの Cookie を
 * 使うので、`X-Requested-With` を付ければセッション認証で取れる。
 */
const download = async ({ files }: DownloadRequest): Promise<DownloadResult> => {
  const result: DownloadResult = { ok: 0, failed: [] };
  for (const { url, filename } of files) {
    try {
      await browser.downloads.download({
        url,
        filename,
        conflictAction: "uniquify",
        saveAs: false,
        headers: [{ name: "X-Requested-With", value: "XMLHttpRequest" }],
      });
      result.ok += 1;
    } catch (e) {
      result.failed.push(`${filename}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return result;
};
