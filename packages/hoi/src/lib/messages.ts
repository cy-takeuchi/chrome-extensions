/**
 * background と content script の間でやり取りするメッセージ
 */

export interface DraftInput {
  title: string
  body: string
  assignToSelf: boolean
}

/** background → content: ダイアログを開く */
export interface TriggerDialogMessage {
  type: 'TRIGGER_DIALOG'
}

/** content → background: Draft Issue を作成する */
export interface SubmitDraftMessage {
  type: 'SUBMIT_DRAFT'
  payload: DraftInput
}

export type SubmitDraftResponse = { success: true } | { success: false; error: string }
