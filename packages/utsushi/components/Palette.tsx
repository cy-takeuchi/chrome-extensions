import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { RecordLocation } from "@/lib/kintone/location";
import {
  type AppSettings,
  loadAppSettings,
  movePreset,
  type Preset,
  removePreset,
  saveAppSettings,
} from "@/lib/settings";

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
 * プリセットの並び替えと削除もここでする。キーボードだけで完結させる
 */
export const Palette = ({
  loc,
  onClose,
  onCopy,
  onEdit,
  onDownload,
  onDownloadSettings,
}: Props) => {
  // 並び替えのたびに読み込み中の表示を挟まないよう、読み込んだ一覧を手元に持つ
  const [presets, setPresets] = useState<Preset[] | null>(null);
  // 開いた直後は先頭を選んでおき、Enter だけでコピーできるようにする
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadAppSettings(loc).then((s) => setPresets(s.presets));
  }, [loc]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 読み込みが終わってパネルが描画されたらフォーカスする
  useEffect(() => panelRef.current?.focus(), [presets === null]);

  if (presets === null) return null;
  const current = presets[selected];

  /** 他のタブで変わっているかもしれないので、読み直してから変えて書く */
  const update = async (change: (s: AppSettings) => AppSettings) => {
    const next = change(await loadAppSettings(loc));
    await saveAppSettings(loc, next);
    setPresets(next.presets);
    return next.presets;
  };

  const move = async (preset: Preset, to: number) => {
    const next = await update((s) => movePreset(s, preset.id, to));
    setSelected(next.findIndex((p) => p.id === preset.id));
  };

  const remove = async (preset: Preset) => {
    if (!confirm(`「${preset.name}」を削除しますか？`)) {
      panelRef.current?.focus();
      return;
    }
    const next = await update((s) => removePreset(s, preset.id));
    setSelected(Math.min(selected, Math.max(0, next.length - 1)));
    panelRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    const n = presets.length;
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= Math.min(n, 9)) {
      const p = presets[digit - 1];
      if (p) onCopy(p);
    } else if (e.key === "ArrowDown" && e.altKey && current) void move(current, selected + 1);
    else if (e.key === "ArrowUp" && e.altKey && current) void move(current, selected - 1);
    else if (e.key === "ArrowDown" && n > 0) setSelected((selected + 1) % n);
    else if (e.key === "ArrowUp" && n > 0) setSelected((selected - 1 + n) % n);
    else if (e.key === "Enter") current ? onCopy(current) : onEdit(null);
    else if (e.key === "e" && current) onEdit(current.id);
    else if (e.key === "n") onEdit(null);
    else if ((e.key === "Delete" || e.key === "Backspace") && current) void remove(current);
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
                className={["preset", i === selected && "active", p.id === dragging && "dragging"]
                  .filter(Boolean)
                  .join(" ")}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(p.id);
                }}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  // 重なった行の位置へ動かす。保存はドロップしたときにする
                  const from = presets.findIndex((x) => x.id === dragging);
                  if (from === i) return;
                  const next = [...presets];
                  const [moved] = next.splice(from, 1);
                  if (moved) next.splice(i, 0, moved);
                  setPresets(next);
                  setSelected(i);
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={() => {
                  const id = dragging;
                  setDragging(null);
                  const to = presets.findIndex((x) => x.id === id);
                  if (id) void update((s) => movePreset(s, id, to));
                }}
                onMouseEnter={() => !dragging && setSelected(i)}
                onClick={() => onCopy(p)}
              >
                <span className="preset-key">{i < 9 ? i + 1 : ""}</span>
                <span className="preset-name">{p.name}</span>
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
                <button
                  type="button"
                  className="link danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(p);
                  }}
                >
                  削除
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
          1-9/Enter コピー · ↑↓ 選択 · ⌥↑↓ 並び替え · e 編集 · n 新規 · Delete 削除 · d ダウンロード
          · ⇧D DL設定 · Esc 閉じる
        </div>
      </div>
    </div>
  );
};
