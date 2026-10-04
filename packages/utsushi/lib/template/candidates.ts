import { type Catalog, COMMENT_PSEUDO, COMMENTS_LABEL, RECORD_PSEUDO } from "./catalog";
import type { LoopAttrs } from "./schema";

/** `@` で出す候補 */
export type Candidate =
  | { kind: "field"; code: string; label: string; hint: string }
  | { kind: "loop"; attrs: LoopAttrs; label: string; hint: string };

const matches = (query: string, ...texts: string[]) => {
  const q = query.trim().toLowerCase();
  return q === "" || texts.some((t) => t.toLowerCase().includes(q));
};

/**
 * カーソル位置に応じた候補。
 *
 * - サブテーブルのブロック内: そのテーブルの列を先頭に出す。ブロックは出さない（入れ子にしない）
 * - コメントのブロック内: 投稿者・日時などを先頭に出す
 * - ブロック外: フィールド・サブテーブル（ブロック挿入）・コメント（ブロック挿入）
 */
export const candidates = (
  catalog: Catalog,
  query: string,
  loop: LoopAttrs | null,
): Candidate[] => {
  const list: Candidate[] = [];

  if (loop?.source === "comments")
    for (const p of COMMENT_PSEUDO)
      list.push({ kind: "field", code: p.code, label: p.label, hint: "コメント" });

  if (loop?.source === "subtable")
    for (const f of catalog.fields)
      if (f.table?.code === loop.code)
        list.push({ kind: "field", code: f.code, label: f.label, hint: `${f.table.label} の列` });

  for (const f of catalog.fields) {
    if (loop?.source === "subtable" && f.table?.code === loop.code) continue;
    const hint = f.table
      ? `${f.table.label} の列（全行連結）`
      : f.group
        ? `グループ: ${f.group}`
        : f.type;
    list.push({ kind: "field", code: f.code, label: f.label, hint });
  }

  if (!loop) {
    for (const t of catalog.tables)
      list.push({
        kind: "loop",
        attrs: { source: "subtable", code: t.code, label: t.label },
        label: t.label,
        hint: "サブテーブル（各行を繰り返す）",
      });
    list.push({
      kind: "loop",
      attrs: { source: "comments", code: null, label: COMMENTS_LABEL },
      label: COMMENTS_LABEL,
      hint: "コメント（各件を繰り返す）",
    });
  }

  for (const p of RECORD_PSEUDO)
    list.push({ kind: "field", code: p.code, label: p.label, hint: "レコード情報" });

  return list.filter((c) =>
    matches(query, c.label, c.kind === "field" ? c.code : (c.attrs.code ?? "")),
  );
};
