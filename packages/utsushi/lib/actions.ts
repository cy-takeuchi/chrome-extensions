import { collectFiles, downloadDir, sanitizeFileName } from "./files";
import {
  fileUrl,
  getAllComments,
  getForm,
  getRecord,
  KintoneApiError,
} from "./kintone/api";
import type { RecordLocation } from "./kintone/location";
import type { DownloadRequest, DownloadResult } from "./messages";
import { loadAppSettings, type Preset } from "./settings";
import { buildCatalog, type Catalog } from "./template/catalog";
import { renderTemplate, TemplateError } from "./template/render";
import type { TemplateDoc } from "./template/schema";
import { describeProblems } from "./template/validate";

export type Outcome = { ok: boolean; message: string };

export const loadCatalog = async (loc: RecordLocation): Promise<Catalog> =>
  buildCatalog(await getForm(loc));

const usesComments = (tpl: TemplateDoc) =>
  tpl.content.some((b) => b.type === "loop" && b.attrs.source === "comments");

/** テンプレートを描画する。コメントはテンプレートが使うときだけ取る */
export const renderForRecord = async (
  loc: RecordLocation,
  template: TemplateDoc,
): Promise<string> => {
  const [catalog, record, comments] = await Promise.all([
    loadCatalog(loc),
    getRecord(loc),
    usesComments(template) ? getAllComments(loc) : Promise.resolve([]),
  ]);
  return renderTemplate(template, { location: loc, catalog, record, comments });
};

/**
 * クリップボードに書く。ショートカットはページにフォーカスがある前提だが、
 * Clipboard API が拒否されたら execCommand で書く。
 */
export const writeClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("クリップボードに書き込めませんでした。ページをクリックしてからもう一度試してください");
  }
};

export const errorMessage = (e: unknown): string => {
  if (e instanceof TemplateError)
    return `コピーを中止しました。プリセットを直してください。\n${describeProblems(e.problems)}`;
  if (e instanceof KintoneApiError) return `kintone API エラー: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
};

export const copyWithPreset = async (
  loc: RecordLocation,
  preset: Preset,
): Promise<Outcome> => {
  try {
    const text = await renderForRecord(loc, preset.template);
    await writeClipboard(text);
    return {
      ok: true,
      message: `「${preset.name}」でコピーしました（${text.length.toLocaleString()} 文字）`,
    };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
};

export const downloadAttachments = async (
  loc: RecordLocation,
): Promise<Outcome> => {
  try {
    const [settings, catalog, record] = await Promise.all([
      loadAppSettings(loc),
      loadCatalog(loc),
      getRecord(loc),
    ]);
    const files = collectFiles(record, catalog, settings.downloadFieldCodes);
    if (files.length === 0)
      return { ok: true, message: "ダウンロードする添付ファイルがありません" };
    const dir = downloadDir(loc.appId, loc.recordId);
    const request: DownloadRequest = {
      type: "download",
      files: files.map((f) => ({
        url: fileUrl(loc, f.fileKey),
        filename: `${dir}/${sanitizeFileName(f.name)}`,
      })),
    };
    const result: DownloadResult = await browser.runtime.sendMessage(request);
    if (result.failed.length > 0)
      return {
        ok: false,
        message: `${result.failed.length} 件失敗しました\n${result.failed.join("\n")}`,
      };
    return { ok: true, message: `${result.ok} 件のダウンロードを開始しました（${dir}）` };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
};
