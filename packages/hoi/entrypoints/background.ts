import { addDraftIssue, getProjectId, getViewer } from '@/lib/github'
import type {
  DraftInput,
  SubmitDraftMessage,
  SubmitDraftResponse,
  TriggerDialogMessage,
} from '@/lib/messages'
import { getSettings, parseProjectUrl } from '@/lib/storage'

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'add-to-project') return

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      const message: TriggerDialogMessage = { type: 'TRIGGER_DIALOG' }
      browser.tabs.sendMessage(tab.id, message, { frameId: 0 })
    }
  })

  browser.runtime.onMessage.addListener((message: SubmitDraftMessage, _sender, sendResponse) => {
    if (message.type === 'SUBMIT_DRAFT') {
      handleSubmitDraft(message.payload).then(sendResponse)
      return true // Keep the message channel open for async response
    }
    return false
  })

  console.log('hoi: Background service worker loaded')
})

async function handleSubmitDraft(payload: DraftInput): Promise<SubmitDraftResponse> {
  try {
    const settings = await getSettings()

    if (!settings.githubToken) {
      return {
        success: false,
        error: 'GitHub のトークンが設定されていません。オプション画面で設定してください',
      }
    }

    if (!settings.projectUrl) {
      return {
        success: false,
        error: 'Project の URL が設定されていません。オプション画面で設定してください',
      }
    }

    const projectInfo = parseProjectUrl(settings.projectUrl)
    if (!projectInfo) {
      return { success: false, error: 'Project の URL の形式が正しくありません' }
    }

    // Get user info if assigning to self
    let assigneeIds: string[] | undefined
    if (payload.assignToSelf) {
      const viewer = await getViewer(settings.githubToken)
      assigneeIds = [viewer.id]
    }

    // Get project ID
    const projectId = await getProjectId(
      settings.githubToken,
      projectInfo.owner,
      projectInfo.number,
      projectInfo.type,
    )

    // Create draft issue
    await addDraftIssue(settings.githubToken, projectId, payload.title, payload.body, assigneeIds)

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました'
    console.error('Failed to submit draft:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
