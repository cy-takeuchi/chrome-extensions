import { createRoot, type Root } from 'react-dom/client'
import type {
  DraftInput,
  SubmitDraftMessage,
  SubmitDraftResponse,
  TriggerDialogMessage,
} from '../lib/messages'
import { AddDialog, type DialogStatus } from './components/AddDialog'
import dialogStyles from './dialog.css?inline'
import {
  findActiveSelectionContext,
  getKintoneCommentPermalink,
  isKintonePage,
} from './lib/kintonePermalink'

let shadowRoot: ShadowRoot | null = null
let reactRoot: Root | null = null

interface DialogState {
  isOpen: boolean
  initialBody: string
  status: DialogStatus
  errorMessage?: string
}

let dialogState: DialogState = {
  isOpen: false,
  initialBody: '',
  status: 'idle',
}

const getOrCreateShadowContainer = (): ShadowRoot => {
  if (shadowRoot) return shadowRoot

  const container = document.createElement('div')
  container.id = 'hoi-root'
  document.body.appendChild(container)

  shadowRoot = container.attachShadow({ mode: 'open' })

  // Inject styles into shadow DOM
  const styleEl = document.createElement('style')
  styleEl.textContent = dialogStyles
  shadowRoot.appendChild(styleEl)

  // Create mount point for React
  const mountPoint = document.createElement('div')
  mountPoint.id = 'tgp-mount'
  shadowRoot.appendChild(mountPoint)

  reactRoot = createRoot(mountPoint)

  return shadowRoot
}

const updateDialogState = (updates: Partial<DialogState>) => {
  dialogState = { ...dialogState, ...updates }
  renderDialog()
}

const showDialog = (selectedText: string) => {
  if (dialogState.isOpen) return

  getOrCreateShadowContainer()
  updateDialogState({
    isOpen: true,
    initialBody: selectedText,
    status: 'idle',
    errorMessage: undefined,
  })
}

const closeDialog = () => {
  updateDialogState({
    isOpen: false,
    status: 'idle',
    errorMessage: undefined,
  })
}

const handleSubmit = (data: DraftInput) => {
  updateDialogState({ status: 'loading', errorMessage: undefined })

  const message: SubmitDraftMessage = { type: 'SUBMIT_DRAFT', payload: data }
  chrome.runtime.sendMessage(message, (response?: SubmitDraftResponse) => {
    if (chrome.runtime.lastError) {
      updateDialogState({
        status: 'error',
        errorMessage: 'Failed to communicate with extension. Please refresh the page.',
      })
      return
    }

    if (response?.success) {
      updateDialogState({ status: 'success' })
    } else {
      updateDialogState({
        status: 'error',
        errorMessage: response?.error || 'An unknown error occurred',
      })
    }
  })
}

const renderDialog = () => {
  if (!reactRoot) return

  reactRoot.render(
    <AddDialog
      isOpen={dialogState.isOpen}
      initialBody={dialogState.initialBody}
      status={dialogState.status}
      errorMessage={dialogState.errorMessage}
      onClose={closeDialog}
      onSubmit={handleSubmit}
    />,
  )
}

const handleTriggerDialog = async (): Promise<void> => {
  let selectedText = window.getSelection()?.toString() || ''
  let url = window.location.href

  if (isKintonePage(url)) {
    const ctx = findActiveSelectionContext()
    if (ctx) {
      selectedText = ctx.selection.toString()
      const permalink = await getKintoneCommentPermalink(ctx)
      if (permalink) {
        url = permalink
      }
    }
  }

  const bodyWithUrl = selectedText ? `${selectedText}\n\n${url}` : url
  showDialog(bodyWithUrl)
}

chrome.runtime.onMessage.addListener((message: TriggerDialogMessage, _sender, sendResponse) => {
  if (message.type === 'TRIGGER_DIALOG') {
    handleTriggerDialog().then(() => {
      sendResponse({ success: true })
    })
    return true // Keep message channel open for async response
  }
  return false
})

console.log('hoi: Content script loaded')
