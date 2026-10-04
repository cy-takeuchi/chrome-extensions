import { useState } from "react";
import { errorMessage } from "@/lib/actions";
import { fileFields } from "@/lib/files";
import type { RecordLocation } from "@/lib/kintone/location";
import { loadAppSettings, saveAppSettings } from "@/lib/settings";
import { useAppData, type AppData } from "./useAppData";

type Props = {
  loc: RecordLocation;
  onClose: () => void;
  /** 保存後。`download` なら続けてダウンロードする */
  onSaved: (download: boolean) => void;
};

/** アプリごとの「一括ダウンロードの対象にする添付ファイルフィールド」 */
export const DownloadSettings = ({ loc, onClose, onSaved }: Props) => {
  const loaded = useAppData(loc);
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="panel"
        role="dialog"
        aria-label="ダウンロード設定"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="panel-title">一括ダウンロードの対象（アプリ {loc.appId}）</div>
        {loaded.status === "loading" && <p className="muted">読み込んでいます…</p>}
        {loaded.status === "error" && <p className="error">{errorMessage(loaded.error)}</p>}
        {loaded.status === "ready" && (
          <Body
            loc={loc}
            settings={loaded.value.settings}
            catalog={loaded.value.catalog}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  );
};

const Body = ({
  loc,
  settings,
  catalog,
  onClose,
  onSaved,
}: Props & AppData) => {
  const fields = fileFields(catalog);
  const [all, setAll] = useState(settings.downloadFieldCodes === null);
  const [codes, setCodes] = useState<Set<string>>(
    new Set(settings.downloadFieldCodes ?? fields.map((f) => f.code)),
  );

  const save = async (download: boolean) => {
    const latest = await loadAppSettings(loc);
    // フォームの順に並べて保存する
    const selected = fields.map((f) => f.code).filter((c) => codes.has(c));
    await saveAppSettings(loc, { ...latest, downloadFieldCodes: all ? null : selected });
    onSaved(download);
  };

  if (fields.length === 0)
    return (
      <>
        <p className="muted">このアプリには添付ファイルフィールドがありません。</p>
        <div className="actions">
          <button type="button" onClick={onClose}>閉じる</button>
        </div>
      </>
    );

  return (
    <>
      <label className="check block">
        <input type="radio" checked={all} onChange={() => setAll(true)} autoFocus={all} />
        すべての添付ファイルフィールド
      </label>
      <label className="check block">
        <input type="radio" checked={!all} onChange={() => setAll(false)} autoFocus={!all} />
        選んだフィールドだけ
      </label>
      <ul className="field-list">
        {fields.map((f) => (
          <li key={f.code}>
            <label className={`check${all ? " disabled" : ""}`}>
              <input
                type="checkbox"
                disabled={all}
                checked={all || codes.has(f.code)}
                onChange={(e) => {
                  const next = new Set(codes);
                  e.target.checked ? next.add(f.code) : next.delete(f.code);
                  setCodes(next);
                }}
              />
              {f.label}
              <span className="muted small">
                {f.table ? ` ${f.table.label} の列` : f.group ? ` グループ: ${f.group}` : ""} · {f.code}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="actions">
        <span className="spacer" />
        <button type="button" onClick={onClose}>キャンセル</button>
        <button type="button" onClick={() => save(false)}>保存</button>
        <button
          type="button"
          className="primary"
          disabled={!all && codes.size === 0}
          onClick={() => save(true)}
        >
          保存してダウンロード
        </button>
      </div>
    </>
  );
};
