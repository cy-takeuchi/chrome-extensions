import { Button, Description, Field, Input, Label } from '@headlessui/react'
import { useEffect, useState } from 'react'
import { getSettings, parseProjectUrl, saveSettings } from '@/lib/storage'

const App = () => {
  const [token, setToken] = useState('')
  const [projectUrl, setProjectUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getSettings().then((settings) => {
      setToken(settings.githubToken)
      setProjectUrl(settings.projectUrl)
    })
  }, [])

  const handleSave = async () => {
    // Validate project URL
    if (projectUrl && !parseProjectUrl(projectUrl)) {
      setMessage({ type: 'error', text: 'Project の URL の形式が正しくありません' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      await saveSettings({ githubToken: token, projectUrl })
      setMessage({ type: 'success', text: '保存しました' })
    } catch {
      setMessage({ type: 'error', text: '保存できませんでした' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="container">
      <h1>hoi</h1>
      <p className="description">
        GitHub の Personal Access Token と、登録先の Project の URL を設定してください。
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <Field className="field">
          <Label className="label">GitHub Personal Access Token</Label>
          <Description className="hint">
            GitHub の Settings → Developer settings → Personal access tokens で作成します。
            <br />
            必要なスコープ: <code>project</code>, <code>read:user</code>
          </Description>
          <Input
            type="password"
            className="input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
          />
        </Field>

        <Field className="field">
          <Label className="label">GitHub Projects の URL</Label>
          <Description className="hint">
            登録先の Project の URL（例: https://github.com/users/username/projects/1）
          </Description>
          <Input
            type="url"
            className="input"
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            placeholder="https://github.com/users/username/projects/1"
          />
        </Field>

        <div className="actions">
          <Button type="submit" className="button primary" disabled={saving}>
            {saving ? '保存しています…' : '保存'}
          </Button>
          {message && <span className={`message ${message.type}`}>{message.text}</span>}
        </div>
      </form>
    </div>
  )
}

export default App
