import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { DraftInput } from '@/lib/messages'

export type DialogStatus = 'idle' | 'loading' | 'success' | 'error'

interface AddDialogProps {
  isOpen: boolean
  initialBody: string
  onClose: () => void
  onSubmit: (data: DraftInput) => void
  status?: DialogStatus
  errorMessage?: string
}

interface DialogFrameProps {
  label: string
  /** false の間は背景クリックや Enter で閉じない */
  closable: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * 背景とパネルの外枠。キーイベントはページ側のショートカットに渡さない
 */
function DialogFrame({ label, closable, onClose, children }: DialogFrameProps) {
  return (
    <div
      className="tgp-dialog-root"
      role="dialog"
      aria-label={label}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div
        className="tgp-backdrop"
        onClick={closable ? onClose : undefined}
        onKeyDown={(e) => closable && e.key === 'Enter' && onClose()}
        role="button"
        tabIndex={closable ? 0 : -1}
        aria-label="Close dialog"
      />
      <div className="tgp-dialog-container">{children}</div>
    </div>
  )
}

export function AddDialog({
  isOpen,
  initialBody,
  onClose,
  onSubmit,
  status = 'idle',
  errorMessage,
}: AddDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState(initialBody)
  const [assignToSelf, setAssignToSelf] = useState(true)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setBody(initialBody)
      setAssignToSelf(true)
      setTimeout(() => titleInputRef.current?.focus(), 0)
    }
  }, [isOpen, initialBody])

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(onClose, 600)
      return () => clearTimeout(timer)
    }
  }, [status, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && status !== 'loading') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, status, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    onSubmit({ title, body, assignToSelf })
  }

  const isLoading = status === 'loading'
  const isSuccess = status === 'success'

  if (isSuccess) {
    return (
      <DialogFrame label="Added to Project" closable onClose={onClose}>
        <div className="tgp-dialog-panel tgp-success-panel">
          <div className="tgp-success-icon">✓</div>
          <h2 className="tgp-success-title">Added to Project!</h2>
          <p className="tgp-success-message">The draft issue has been created successfully.</p>
          <button type="button" className="tgp-button primary" onClick={onClose}>
            Close
          </button>
        </div>
      </DialogFrame>
    )
  }

  return (
    <DialogFrame label="Add to GitHub Projects" closable={!isLoading} onClose={onClose}>
      <div className="tgp-dialog-panel">
        <h2 className="tgp-dialog-title">Add to GitHub Projects</h2>

        {errorMessage && (
          <div className="tgp-error-banner">
            <span className="tgp-error-icon">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="tgp-field">
            <label htmlFor="tgp-title" className="tgp-label">
              Title
            </label>
            <input
              ref={titleInputRef}
              id="tgp-title"
              type="text"
              className="tgp-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title..."
              disabled={isLoading}
            />
          </div>

          <div className="tgp-field">
            <label htmlFor="tgp-body" className="tgp-label">
              Body
            </label>
            <textarea
              id="tgp-body"
              className="tgp-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Enter description..."
              disabled={isLoading}
            />
          </div>

          <div className="tgp-field">
            <span className="tgp-label">Assignees</span>
            <div className="tgp-radio-group" role="radiogroup" aria-label="Assignee options">
              <label className="tgp-radio">
                <span className={`tgp-radio-option ${assignToSelf ? 'checked' : ''}`}>
                  <input
                    type="radio"
                    name="assignee"
                    checked={assignToSelf}
                    onChange={() => setAssignToSelf(true)}
                    disabled={isLoading}
                    className="tgp-radio-input"
                  />
                  <span className="tgp-radio-indicator" />
                  Assign to myself
                </span>
              </label>
              <label className="tgp-radio">
                <span className={`tgp-radio-option ${!assignToSelf ? 'checked' : ''}`}>
                  <input
                    type="radio"
                    name="assignee"
                    checked={!assignToSelf}
                    onChange={() => setAssignToSelf(false)}
                    disabled={isLoading}
                    className="tgp-radio-input"
                  />
                  <span className="tgp-radio-indicator" />
                  Do not assign
                </span>
              </label>
            </div>
          </div>

          <div className="tgp-actions">
            <button
              type="button"
              className="tgp-button secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tgp-button primary"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? (
                <>
                  <span className="tgp-spinner" />
                  Adding...
                </>
              ) : (
                'Add to Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  )
}
