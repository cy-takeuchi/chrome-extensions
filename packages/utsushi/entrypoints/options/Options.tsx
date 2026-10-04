import { useEffect, useState } from "react";
import {
  exportAll,
  importAll,
  loadAllSettings,
  removePreset,
  saveAppSettings,
  type AppKey,
  type AppSettings,
} from "@/lib/settings";

type Entry = { key: AppKey; settings: AppSettings };

export const Options = () => {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [message, setMessage] = useState("");
  const [shortcuts, setShortcuts] = useState<{ description?: string; shortcut?: string }[]>([]);

  const reload = async () => setEntries(await loadAllSettings());

  useEffect(() => {
    void reload();
    browser.commands.getAll().then(setShortcuts);
    const onChange = () => void reload();
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, []);

  const deletePreset = async ({ key, settings }: Entry, id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await saveAppSettings(key, removePreset(settings, id));
  };

  const deleteApp = async ({ key }: Entry) => {
    if (!confirm(`${key.domain} のアプリ ${key.appId} の設定をすべて削除しますか？`)) return;
    await saveAppSettings(key, { presets: [], defaultPresetId: null, downloadFieldCodes: null });
  };

  const download = async () => {
    const file = await exportAll();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `utsushi-${file.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const n = await importAll(JSON.parse(await file.text()));
      setMessage(`${n} アプリ分の設定をインポートしました`);
    } catch (e) {
      setMessage(`インポートに失敗しました: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <main>
      <h1>utsushi</h1>

      <section>
        <h2>ショートカット</h2>
        <table>
          <tbody>
            {shortcuts
              .filter((c) => c.description)
              .map((c) => (
                <tr key={c.description}>
                  <td>{c.description}</td>
                  <td>
                    <kbd>{c.shortcut || "未設定"}</kbd>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="muted">
          変更は <code>chrome://extensions/shortcuts</code> で行えます。
          プリセットの作成・編集は、kintone のレコード詳細画面でパレットを開いて行います。
        </p>
      </section>

      <section>
        <h2>保存しているプリセット</h2>
        {entries === null ? (
          <p className="muted">読み込み中…</p>
        ) : entries.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          entries.map((entry) => (
            <div className="app" key={`${entry.key.domain}:${entry.key.appId}`}>
              <div className="app-head">
                <strong>
                  {entry.key.domain} / アプリ {entry.key.appId}
                </strong>
                <button type="button" className="danger" onClick={() => deleteApp(entry)}>
                  すべて削除
                </button>
              </div>
              <ul>
                {entry.settings.presets.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.id === (entry.settings.defaultPresetId ?? entry.settings.presets[0]?.id) && (
                      <span className="badge">デフォルト</span>
                    )}
                    <span className="muted"> 更新 {p.updatedAt.slice(0, 10)}</span>
                    <button type="button" className="link danger" onClick={() => deletePreset(entry, p.id, p.name)}>
                      削除
                    </button>
                  </li>
                ))}
              </ul>
              <p className="muted">
                DL対象:{" "}
                {entry.settings.downloadFieldCodes === null
                  ? "すべての添付ファイルフィールド"
                  : entry.settings.downloadFieldCodes.join(", ") || "なし"}
              </p>
            </div>
          ))
        )}
      </section>

      <section>
        <h2>エクスポート / インポート</h2>
        <p className="muted">インポートすると、ファイルに含まれるアプリの設定を上書きします。</p>
        <div className="row">
          <button type="button" onClick={download}>エクスポート</button>
          <label className="button">
            インポート
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {message && <p>{message}</p>}
      </section>
    </main>
  );
};
