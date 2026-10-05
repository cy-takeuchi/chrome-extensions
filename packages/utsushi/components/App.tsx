import { useCallback, useEffect, useRef, useState } from "react";
import { copyWithPreset, downloadAttachments, type Outcome } from "@/lib/actions";
import { parseRecordLocation, type RecordLocation } from "@/lib/kintone/location";
import type { Command } from "@/lib/messages";
import type { Preset } from "@/lib/settings";
import { DownloadSettings } from "./DownloadSettings";
import { Palette } from "./Palette";
import { PresetEditor } from "./PresetEditor";
import { Toast, type ToastState } from "./Toast";

type View =
  | { kind: "palette"; loc: RecordLocation }
  | { kind: "editor"; loc: RecordLocation; presetId: string | null }
  | { kind: "download"; loc: RecordLocation }
  | null;

export type CommandSource = { subscribe: (fn: (c: Command) => void) => () => void };

export const App = ({ commands }: { commands: CommandSource }) => {
  const [view, setView] = useState<View>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);

  const show = useCallback((kind: ToastState["kind"], message: string) => {
    seq.current += 1;
    setToast({ kind, message, id: seq.current });
  }, []);
  const report = useCallback((o: Outcome) => show(o.ok ? "ok" : "error", o.message), [show]);
  const hideToast = useCallback(() => setToast(null), []);

  const copy = useCallback(
    async (loc: RecordLocation, preset: Preset) => {
      show("info", `「${preset.name}」でコピーしています…`);
      report(await copyWithPreset(loc, preset));
    },
    [show, report],
  );

  const download = useCallback(
    async (loc: RecordLocation) => {
      show("info", "添付ファイルを確認しています…");
      report(await downloadAttachments(loc));
    },
    [show, report],
  );

  const viewRef = useRef(view);
  viewRef.current = view;

  const handle = useCallback(
    (_command: Command) => {
      const current = viewRef.current;
      if (current?.kind === "editor" || current?.kind === "download") return;
      // もう一度押したら閉じる
      if (current?.kind === "palette") {
        setView(null);
        return;
      }
      const loc = parseRecordLocation(location.href);
      if (!loc) {
        show("error", "レコード詳細画面で使ってください");
        return;
      }
      setView({ kind: "palette", loc });
    },
    [show],
  );

  useEffect(() => commands.subscribe(handle), [commands, handle]);

  return (
    <>
      {view?.kind === "palette" && (
        <Palette
          loc={view.loc}
          onClose={() => setView(null)}
          onCopy={(p) => {
            setView(null);
            void copy(view.loc, p);
          }}
          onEdit={(presetId) => setView({ kind: "editor", loc: view.loc, presetId })}
          onDownload={() => {
            setView(null);
            void download(view.loc);
          }}
          onDownloadSettings={() => setView({ kind: "download", loc: view.loc })}
        />
      )}
      {view?.kind === "editor" && (
        <PresetEditor
          loc={view.loc}
          presetId={view.presetId}
          onClose={() => setView(null)}
          onSaved={(preset, andCopy) => {
            setView(null);
            if (andCopy) void copy(view.loc, preset);
            else show("ok", `「${preset.name}」を保存しました`);
          }}
        />
      )}
      {view?.kind === "download" && (
        <DownloadSettings
          loc={view.loc}
          onClose={() => setView(null)}
          onBack={() => setView({ kind: "palette", loc: view.loc })}
          onSaved={(andDownload) => {
            if (andDownload) {
              setView(null);
              void download(view.loc);
            } else {
              setView({ kind: "palette", loc: view.loc });
              show("ok", "ダウンロード設定を保存しました");
            }
          }}
        />
      )}
      <Toast key={toast?.id} toast={toast} onClose={hideToast} />
    </>
  );
};
