import { addDraftIssue, getProjectId, getViewer } from "@/lib/github";
import type {
  DraftInput,
  OpenOptionsMessage,
  SubmitDraftMessage,
  SubmitDraftResponse,
  TriggerDialogMessage,
} from "@/lib/messages";
import { isSupportedUrl } from "@/lib/sites";
import { getSettings, parseProjectUrl } from "@/lib/storage";

/** kintone（cybozu.com・kintone.com）以外のタブでは何もしない */
const openDialog = async (tab: Browser.tabs.Tab | undefined) => {
  if (tab?.id !== undefined && isSupportedUrl(tab.url)) await triggerDialog(tab.id);
};

/** ツールバーのアイコンは kintone の画面でだけ押せるようにする。無効なアイコンは Chrome がグレーで表示する */
const syncAction = async (tabId: number, url: string | undefined) => {
  if (isSupportedUrl(url)) await browser.action.enable(tabId);
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

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "add-to-project") return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    await openDialog(tab);
  });

  browser.action.onClicked.addListener((tab) => openDialog(tab));

  browser.runtime.onMessage.addListener(
    (message: SubmitDraftMessage | OpenOptionsMessage, _sender, sendResponse) => {
      if (message.type === "OPEN_OPTIONS") {
        void browser.runtime.openOptionsPage();
        return false;
      }
      if (message.type === "SUBMIT_DRAFT") {
        handleSubmitDraft(message.payload).then(sendResponse);
        return true; // Keep the message channel open for async response
      }
      return false;
    },
  );

  console.log("hoi: Background service worker loaded");
});

/**
 * タブの content script にダイアログを開かせる。
 * 拡張機能の読み込み・リロード前から開いていたタブには content script がないので、
 * そのときは注入してから送り直す（host_permissions のサイトなので注入できる）
 */
async function triggerDialog(tabId: number): Promise<void> {
  const message: TriggerDialogMessage = { type: "TRIGGER_DIALOG" };
  try {
    await browser.tabs.sendMessage(tabId, message, { frameId: 0 });
    return;
  } catch {
    // content script がまだない
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ["/content-scripts/content.js"],
    });
    await browser.tabs.sendMessage(tabId, message, { frameId: 0 });
  } catch (error) {
    // chrome:// のページなど、content script を入れられないページ
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("hoi: このページではダイアログを開けません:", errorMessage);
  }
}

async function handleSubmitDraft(payload: DraftInput): Promise<SubmitDraftResponse> {
  try {
    const settings = await getSettings();

    if (!settings.githubToken) {
      return {
        success: false,
        error: "GitHub のトークンが設定されていません。オプション画面で設定してください",
      };
    }

    if (!settings.projectUrl) {
      return {
        success: false,
        error: "Project の URL が設定されていません。オプション画面で設定してください",
      };
    }

    const projectInfo = parseProjectUrl(settings.projectUrl);
    if (!projectInfo) {
      return { success: false, error: "Project の URL の形式が正しくありません" };
    }

    // Get user info if assigning to self
    let assigneeIds: string[] | undefined;
    if (payload.assignToSelf) {
      const viewer = await getViewer(settings.githubToken);
      assigneeIds = [viewer.id];
    }

    // Get project ID
    const projectId = await getProjectId(
      settings.githubToken,
      projectInfo.owner,
      projectInfo.number,
      projectInfo.type,
    );

    // Create draft issue
    await addDraftIssue(settings.githubToken, projectId, payload.title, payload.body, assigneeIds);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    console.error("Failed to submit draft:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
