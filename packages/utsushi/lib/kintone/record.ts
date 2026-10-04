import type { FieldValue, FileValue, KintoneRecord, SubtableRow } from "./types";

/** サブテーブルの行。サブテーブルでなければ（閲覧権限が無い場合を含む）空 */
export const subtableRows = (record: KintoneRecord, tableCode: string): SubtableRow[] => {
  const fv = record[tableCode];
  return fv?.type === "SUBTABLE" ? (fv.value as SubtableRow[]) : [];
};

/** 添付ファイルフィールドのファイル。添付ファイルでなければ空 */
export const filesOf = (fv: FieldValue | undefined): FileValue[] =>
  fv?.type === "FILE" ? (fv.value as FileValue[]) : [];
