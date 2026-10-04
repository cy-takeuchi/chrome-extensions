import { addDraftIssue, getProjectId, getViewer } from '../lib/github'
import { getSettings, parseProjectUrl } from '../lib/storage'

interface SubmitDraftPayload {
  title: string
  body: string
  assignToSelf: boolean
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'add-to-project') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_DIALOG' }, { frameId: 0 })
      }
    })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBMIT_DRAFT') {
    handleSubmitDraft(message.payload, sender.tab?.id)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Keep the message channel open for async response
  }
  return false
})

async function handleSubmitDraft(
  payload: SubmitDraftPayload,
  tabId?: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSettings()

    if (!settings.githubToken) {
      return {
        success: false,
        error: 'GitHub token not configured. Please set it in the extension options.',
      }
    }

    if (!settings.projectUrl) {
      return {
        success: false,
        error: 'Project URL not configured. Please set it in the extension options.',
      }
    }

    const projectInfo = parseProjectUrl(settings.projectUrl)
    if (!projectInfo) {
      return { success: false, error: 'Invalid Project URL format.' }
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

    // Notify content script of success
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'RESULT', success: true })
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Failed to submit draft:', errorMessage)

    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'RESULT', success: false, error: errorMessage })
    }

    return { success: false, error: errorMessage }
  }
}

console.log('hoi: Background service worker loaded')
