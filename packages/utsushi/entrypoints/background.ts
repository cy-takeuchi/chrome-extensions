import {
  type CommandMessage,
  type DownloadRequest,
  type DownloadResult,
  isCommand,
} from "@/lib/messages";

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (!isCommand(command)) return;
    const target = tab ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    if (target?.id === undefined) return;
    const message: CommandMessage = { type: "command", command };
    // kintone 以外のタブでは受け手がいないので失敗する。それで構わない
    await browser.tabs.sendMessage(target.id, message).catch(() => {});
  });

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
