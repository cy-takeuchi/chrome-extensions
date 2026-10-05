import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { RecordLocation } from "@/lib/kintone/location";
import { defaultPreset, loadAppSettings, type Preset, saveAppSettings } from "@/lib/settings";
import { useAsync } from "./useAsync";

type Props = {
  loc: RecordLocation;
  onClose: () => void;
  onCopy: (preset: Preset) => void;
  onEdit: (presetId: string | null) => void;
  onDownload: () => void;
  onDownloadSettings: () => void;
};

/**
 * ショートカットで開くメニュー。プリセットでのコピーと添付ファイルのダウンロードを選ぶ。
 * キーボードだけで完結させる
 */
export const Palette = ({
  loc,
  onClose,
  onCopy,
  onEdit,
  onDownload,
  onDownloadSettings,
}: Props) => {
  const [reload, setReload] = useState(0);
  const settings = useAsync(() => loadAppSettings(loc), [loc.domain, loc.appId, reload]);
  const [selected, setSelected] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 読み込みが終わってパネルが描画されたらフォーカスする
  useEffect(() => panelRef.current?.focus(), [settings.status]);

  if (settings.status !== "ready") return null;
  const { presets } = settings.value;
  const defaultId = defaultPreset(settings.value)?.id;
  // 開いた直後はデフォルトのプリセットを選んでおき、Enter だけでコピーできるようにする
  const active =
    selected ??
    Math.max(
      0,
      presets.findIndex((p) => p.id === defaultId),
    );
  const current = presets[active];

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
    } else if (e.key === "ArrowDown" && n > 0) setSelected((active + 1) % n);
    else if (e.key === "ArrowUp" && n > 0) setSelected((active - 1 + n) % n);
    else if (e.key === "Enter") current ? onCopy(current) : onEdit(null);
    else if (e.key === "e" && current) onEdit(current.id);
    else if (e.key === "n") onEdit(null);
    else if (e.key === "s" && current) void setDefault(current);
    else if (e.key === "d") onDownload();
    else if (e.key === "D") onDownloadSettings();
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 背景のクリックで閉じる。キーボードでは Esc で閉じる
    <div className="backdrop" onMouseDown={onClose}>
      <div
        className="panel palette"
        role="dialog"
        aria-label="utsushi"
        tabIndex={-1}
        ref={panelRef}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-title">
          utsushi（アプリ {loc.appId} · レコード {loc.recordId}）
        </div>
        <div className="section-title">コピー</div>
        {presets.length === 0 ? (
          <p className="muted">プリセットがありません。Enter か n で作成します。</p>
        ) : (
          <ul className="preset-list">
            {presets.map((p, i) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードではパネルの 1-9 / Enter でコピーする
              <li
                key={p.id}
                className={i === active ? "preset active" : "preset"}
                onMouseEnter={() => setSelected(i)}
                onClick={() => onCopy(p)}
              >
                <span className="preset-key">{i < 9 ? i + 1 : ""}</span>
                <span className="preset-name">{p.name}</span>
                {p.id === defaultId && <span className="badge">デフォルト</span>}
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
          <button type="button" onClick={() => onEdit(null)}>
            新規作成
          </button>
        </div>
        <div className="section-title">添付ファイル</div>
        <div className="palette-actions">
          <button type="button" onClick={onDownload}>
            ダウンロード
          </button>
          <button type="button" onClick={onDownloadSettings}>
            DL設定
          </button>
        </div>
        <div className="keys">
          1-9/Enter コピー · ↑↓ 選択 · e 編集 · n 新規 · s デフォルトにする · d ダウンロード · ⇧D
          DL設定 · Esc 閉じる
        </div>
      </div>
    </div>
  );
};
