import { useCallback, useEffect, useRef, useState } from "react";
import { copyWithPreset, downloadAttachments, type Outcome } from "@/lib/actions";
import { parseRecordLocation, type RecordLocation } from "@/lib/kintone/location";
import type { Command } from "@/lib/messages";
import { defaultPreset, loadAppSettings, type Preset } from "@/lib/settings";
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
    async (command: Command) => {
      const current = viewRef.current;
      if (current?.kind === "editor" || current?.kind === "download") return;
      if (current?.kind === "palette" && command === "open-palette") {
        setView(null);
        return;
      }
      const loc = parseRecordLocation(location.href);
      if (!loc) {
        show("error", "レコード詳細画面で使ってください");
        return;
      }
      setView(null);
      if (command === "open-palette") {
        setView({ kind: "palette", loc });
      } else if (command === "download-files") {
        await download(loc);
      } else {
        const preset = defaultPreset(await loadAppSettings(loc));
        if (preset) await copy(loc, preset);
        else {
          show("info", "このアプリにはまだプリセットがありません。作成してください");
          setView({ kind: "editor", loc, presetId: null });
        }
      }
    },
    [copy, download, show],
  );

  useEffect(() => commands.subscribe((c) => void handle(c)), [commands, handle]);

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
          onSaved={(andDownload) => {
            setView(null);
            if (andDownload) void download(view.loc);
            else show("ok", "ダウンロード設定を保存しました");
          }}
        />
      )}
      <Toast key={toast?.id} toast={toast} onClose={hideToast} />
    </>
  );
};
