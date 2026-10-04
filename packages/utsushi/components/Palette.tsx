import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { RecordLocation } from "@/lib/kintone/location";
import { defaultPreset, loadAppSettings, saveAppSettings, type Preset } from "@/lib/settings";
import { useAsync } from "./useAsync";

type Props = {
  loc: RecordLocation;
  onClose: () => void;
  onCopy: (preset: Preset) => void;
  onEdit: (presetId: string | null) => void;
  onDownloadSettings: () => void;
};

/** プリセット選択パレット。キーボードだけで完結させる */
export const Palette = ({ loc, onClose, onCopy, onEdit, onDownloadSettings }: Props) => {
  const [reload, setReload] = useState(0);
  const settings = useAsync(() => loadAppSettings(loc), [loc.domain, loc.appId, reload]);
  const [selected, setSelected] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => panelRef.current?.focus(), [settings.status]);

  if (settings.status !== "ready") return null;
  const { presets } = settings.value;
  const defaultId = defaultPreset(settings.value)?.id;
  const current = presets[selected];

  const setDefault = async (preset: Preset) => {
    await saveAppSettings(loc, { ...settings.value, defaultPresetId: preset.id });
    setReload((n) => n + 1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    const n = presets.length;
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= Math.min(n, 9)) {
      const p = presets[digit - 1];
      if (p) onCopy(p);
    } else if (e.key === "ArrowDown" && n > 0) setSelected((selected + 1) % n);
    else if (e.key === "ArrowUp" && n > 0) setSelected((selected - 1 + n) % n);
    else if (e.key === "Enter" && current) onCopy(current);
    else if (e.key === "e" && current) onEdit(current.id);
    else if (e.key === "n") onEdit(null);
    else if (e.key === "s" && current) void setDefault(current);
    else if (e.key === "d") onDownloadSettings();
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="panel palette"
        role="dialog"
        aria-label="プリセット"
        tabIndex={-1}
        ref={panelRef}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-title">プリセット（アプリ {loc.appId}）</div>
        {presets.length === 0 ? (
          <p className="muted">プリセットがありません。n で作成します。</p>
        ) : (
          <ul className="preset-list">
            {presets.map((p, i) => (
              <li
                key={p.id}
                className={i === selected ? "preset active" : "preset"}
                onMouseEnter={() => setSelected(i)}
                onClick={() => onCopy(p)}
              >
                <span className="preset-key">{i < 9 ? i + 1 : ""}</span>
                <span className="preset-name">{p.name}</span>
                {p.id === defaultId && (
                  <span className="badge">デフォルト</span>
                )}
                <button
                  type="button"
                  className="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(p.id);
                  }}
                >
                  編集
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="palette-actions">
          <button type="button" onClick={() => onEdit(null)}>新規作成</button>
          <button type="button" onClick={onDownloadSettings}>DL設定</button>
        </div>
        <div className="keys">
          1-9/Enter コピー · ↑↓ 選択 · e 編集 · n 新規 · s デフォルトにする · d DL設定 · Esc 閉じる
        </div>
      </div>
    </div>
  );
};
