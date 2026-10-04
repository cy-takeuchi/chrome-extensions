import type { Catalog } from "./template/catalog";
import type { FileValue, KintoneRecord, SubtableRow } from "./kintone/types";

/** 添付ファイルフィールド（サブテーブル内を含む）。DL 設定の選択肢 */
export const fileFields = (catalog: Catalog) =>
  catalog.fields.filter((f) => f.type === "FILE");

/**
 * レコードからダウンロード対象のファイルを集める。
 * `codes` が `null` なら全添付ファイルフィールド。
 */
export const collectFiles = (
  record: KintoneRecord,
  catalog: Catalog,
  codes: string[] | null,
): FileValue[] => {
  const targets = fileFields(catalog).filter(
    (f) => codes === null || codes.includes(f.code),
  );
  return targets.flatMap((f) => {
    if (!f.table) {
      const fv = record[f.code];
      return fv?.type === "FILE" ? (fv.value as FileValue[]) : [];
    }
    const table = record[f.table.code];
    if (table?.type !== "SUBTABLE") return [];
    return (table.value as SubtableRow[]).flatMap((row) => {
      const fv = row.value[f.code];
      return fv?.type === "FILE" ? (fv.value as FileValue[]) : [];
    });
  });
};

/** chrome.downloads が受け付けない文字を置き換える */
export const sanitizeFileName = (name: string): string => {
  const cleaned = name
    // 制御文字と、パスやファイル名に使えない文字
    .replace(/[\u0000-\u001f<>:"/\\|?*~]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return cleaned === "" ? "file" : cleaned;
};

export const downloadDir = (appId: string, recordId: string) =>
  `kintone/${appId}-${recordId}`;
