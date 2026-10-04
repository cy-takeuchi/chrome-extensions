import type { Form } from "kisekae";
import { type FieldNode, field } from "./schema";

/**
 * 差し込みに使える項目の一覧。オートコンプリート候補と、
 * テンプレートの参照チェック・値の整形の両方がこれを見る。
 */
export type FieldMeta = {
  code: string;
  label: string;
  type: string;
  /** サブテーブルの列なら、そのテーブル */
  table?: { code: string; label: string };
  /** グループ内なら、そのグループのラベル */
  group?: string;
  unit?: string;
  unitPosition?: "BEFORE" | "AFTER";
  /** 計算フィールドの表示形式 */
  calcFormat?: string;
};

export type TableMeta = { code: string; label: string };

/** フォームに無い、拡張が用意する差し込み項目 */
export const RECORD_PSEUDO = [
  { code: "$record.url", label: "レコードURL" },
  { code: "$record.id", label: "レコードID" },
  { code: "$app.id", label: "アプリID" },
] as const;

/** コメントブロックの中でだけ使える差し込み項目 */
export const COMMENT_PSEUDO = [
  { code: "$comment.author", label: "投稿者" },
  { code: "$comment.date", label: "日時" },
  { code: "$comment.body", label: "本文" },
  { code: "$comment.mentions", label: "メンション" },
] as const;

export const COMMENTS_LABEL = "コメント";

export type PseudoCode =
  | (typeof RECORD_PSEUDO)[number]["code"]
  | (typeof COMMENT_PSEUDO)[number]["code"];

const PSEUDO_LABELS: ReadonlyMap<string, string> = new Map(
  [...RECORD_PSEUDO, ...COMMENT_PSEUDO].map((p) => [p.code, p.label]),
);

/** 拡張が用意する差し込み項目の表示名。該当しなければ `undefined` */
export const pseudoLabel = (code: string): string | undefined => PSEUDO_LABELS.get(code);

/** 拡張が用意する差し込み項目のチップ */
export const pseudoField = (code: PseudoCode): FieldNode => field(code, pseudoLabel(code) ?? code);

export type Catalog = {
  /** レイアウト順。フォーム外の項目（ステータスなど）は末尾 */
  fields: FieldMeta[];
  tables: TableMeta[];
  byCode: Map<string, FieldMeta>;
};

const NOT_A_VALUE = new Set(["SUBTABLE", "GROUP", "REFERENCE_TABLE"]);

const unitOf = (f: object) =>
  "unit" in f && typeof f.unit === "string" && f.unit !== ""
    ? {
        unit: f.unit,
        unitPosition: ("unitPosition" in f && f.unitPosition === "BEFORE" ? "BEFORE" : "AFTER") as
          | "BEFORE"
          | "AFTER",
      }
    : {};

export const buildCatalog = (form: Form): Catalog => {
  const fields: FieldMeta[] = [];
  for (const f of form.fields) {
    if (NOT_A_VALUE.has(f.type)) continue;
    const parent = f.parent;
    fields.push({
      code: f.code,
      label: f.label,
      type: f.type,
      ...(parent?.type === "SUBTABLE" ? { table: { code: parent.code, label: parent.label } } : {}),
      ...(parent?.type === "GROUP" ? { group: parent.label } : {}),
      ...unitOf(f),
      ...(f.type === "CALC" ? { calcFormat: f.format } : {}),
    });
  }
  for (const f of form.unplaced) {
    if (NOT_A_VALUE.has(f.type)) continue;
    if ("enabled" in f && !f.enabled) continue;
    fields.push({ code: f.code, label: f.label, type: f.type, ...unitOf(f) });
  }
  const tables = form.tables.map((t) => ({ code: t.code, label: t.label }));
  return { fields, tables, byCode: new Map(fields.map((f) => [f.code, f])) };
};
