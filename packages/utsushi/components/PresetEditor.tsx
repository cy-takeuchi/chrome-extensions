import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/lib/actions";
import type { RecordLocation } from "@/lib/kintone/location";
import { loadAppSettings, type Preset, saveAppSettings, upsertPreset } from "@/lib/settings";
import { buildDefaultTemplate } from "@/lib/template/defaultTemplate";
import { refreshLabels } from "@/lib/template/refresh";
import type { TemplateDoc } from "@/lib/template/schema";
import { describeProblems, validateTemplate } from "@/lib/template/validate";
import { TemplateEditor } from "./editor/TemplateEditor";
import { type AppData, useAppData } from "./useAppData";

type Props = {
  loc: RecordLocation;
  presetId: string | null;
  /** メニューに戻る */
  onBack: () => void;
  /** 保存後。`copy` なら保存したプリセットでコピーする */
  onSaved: (preset: Preset, copy: boolean) => void;
};

export const PresetEditor = ({ loc, presetId, onBack, onSaved }: Props) => {
  const loaded = useAppData(loc);
  const panelRef = useRef<HTMLDivElement>(null);
  // エディタがフォーカスを取るまでの間も Esc で戻れるように、まずパネルにフォーカスする
  useEffect(() => panelRef.current?.focus(), []);
  return (
    <div className="backdrop">
      <div
        className="panel editor-panel"
        role="dialog"
        aria-label="プリセット編集"
        tabIndex={-1}
        ref={panelRef}
        onKeyDown={(e) => {
          // 中身が受けた Esc は preventDefault されて上がってくる
          if (e.key === "Escape" && !e.defaultPrevented) onBack();
        }}
      >
        {loaded.status === "loading" && <p className="muted">フォーム定義を読み込んでいます…</p>}
        {loaded.status === "error" && (
          <>
            <p className="error">{errorMessage(loaded.error)}</p>
            <div className="actions">
              <button type="button" onClick={onBack}>
                戻る
              </button>
            </div>
          </>
        )}
        {loaded.status === "ready" && (
          <EditorBody
            loc={loc}
            presetId={presetId}
            settings={loaded.value.settings}
            catalog={loaded.value.catalog}
            onBack={onBack}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  );
};

const EditorBody = ({ loc, presetId, settings, catalog, onBack, onSaved }: Props & AppData) => {
  const existing = settings.presets.find((p) => p.id === presetId);
  // 開いた時点の内容で初期化する
  const [initial] = useState(() =>
    existing ? refreshLabels(existing.template, catalog) : buildDefaultTemplate(catalog),
  );
  const [name, setName] = useState(existing?.name ?? `プリセット ${settings.presets.length + 1}`);
  const [doc, setDoc] = useState<TemplateDoc>(initial);
  const [dirty, setDirty] = useState(false);

  const problems = useMemo(() => validateTemplate(doc, catalog), [doc, catalog]);
  const brokenCodes = useMemo(
    () => new Set(problems.filter((p) => p.reason === "missing").map((p) => p.code)),
    [problems],
  );

  const save = async (copy: boolean) => {
    const preset: Preset = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim() || "無題",
      template: doc,
      updatedAt: new Date().toISOString(),
    };
    // 開いている間に他のタブで変わっているかもしれないので読み直してから書く
    const latest = await loadAppSettings(loc);
    const next = upsertPreset(latest, preset);
    await saveAppSettings(loc, next);
    onSaved(preset, copy);
  };

  const back = () => {
    if (dirty && !confirm("変更を破棄して戻りますか？")) return;
    onBack();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      back();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save(e.shiftKey && problems.length === 0);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 入力欄から上がってくる Esc / ⌘Enter をまとめて受ける
    <div className="editor-body" onKeyDown={onKeyDown}>
      <div className="panel-title">
        {existing ? "プリセットを編集" : "プリセットを作成"}（アプリ {loc.appId}）
      </div>
      <div className="row">
        <input
          className="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          placeholder="プリセット名"
        />
      </div>
      <TemplateEditor
        initial={initial}
        catalog={catalog}
        brokenCodes={brokenCodes}
        onChange={(d) => {
          setDoc(d);
          setDirty(true);
        }}
        onEscape={back}
      />
      <p className="muted small">
        @
        でフィールドを差し込みます。サブテーブルやコメントを選ぶと、各行（各件）を繰り返すブロックになります。ブロックから出るには
        ↓ キー。
      </p>
      {problems.length > 0 && (
        <p className="error">
          {describeProblems(problems)}
          {"\n"}このままではコピーできません。
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={back}>
          戻る
        </button>
        <span className="spacer" />
        <button type="button" onClick={() => save(false)} title="⌘Enter">
          保存
        </button>
        <button
          type="button"
          className="primary"
          disabled={problems.length > 0}
          onClick={() => save(true)}
          title="⌘⇧Enter"
        >
          保存してコピー
        </button>
      </div>
    </div>
  );
};
