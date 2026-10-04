import {
  COMMENT_PSEUDO,
  COMMENTS_LABEL,
  RECORD_PSEUDO,
  type Catalog,
} from "./catalog";
import {
  doc,
  field,
  loop,
  paragraph,
  text,
  type BlockNode,
  type FieldNode,
} from "./schema";

const pseudo = (list: readonly { code: string; label: string }[], code: string) => {
  const p = list.find((x) => x.code === code);
  if (!p) throw new Error(`unknown pseudo field: ${code}`);
  return field(p.code, p.label);
};

/**
 * 新規プリセットの初期値。全フィールドをレイアウト順に「ラベル: 値」で並べ、
 * サブテーブルは繰り返しブロック、最後にコメントブロックを置く。
 * 利用者は不要な行を消すだけでプリセットを作れる。
 */
export const buildDefaultTemplate = (catalog: Catalog) => {
  const blocks: BlockNode[] = [
    paragraph(text("レコード: "), pseudo(RECORD_PSEUDO, "$record.url")),
    paragraph(),
  ];
  let currentGroup: string | undefined;
  const emittedTables = new Set<string>();

  for (const f of catalog.fields) {
    if (f.table) {
      if (emittedTables.has(f.table.code)) continue;
      emittedTables.add(f.table.code);
      const columns = catalog.fields.filter(
        (c) => c.table?.code === f.table?.code,
      );
      const row: (FieldNode | ReturnType<typeof text>)[] = [text("- ")];
      columns.forEach((c, i) => {
        if (i > 0) row.push(text(" / "));
        row.push(text(`${c.label}: `), field(c.code, c.label));
      });
      blocks.push(
        paragraph(text(`【${f.table.label}】`)),
        loop(
          { source: "subtable", code: f.table.code, label: f.table.label },
          paragraph(...row),
        ),
      );
      currentGroup = undefined;
      continue;
    }
    if (f.group !== currentGroup) {
      currentGroup = f.group;
      if (f.group) blocks.push(paragraph(text(`【${f.group}】`)));
    }
    blocks.push(paragraph(text(`${f.label}: `), field(f.code, f.label)));
  }

  blocks.push(
    paragraph(),
    paragraph(text(`【${COMMENTS_LABEL}】`)),
    loop(
      { source: "comments", code: null, label: COMMENTS_LABEL },
      paragraph(
        text("■ "),
        pseudo(COMMENT_PSEUDO, "$comment.author"),
        text("（"),
        pseudo(COMMENT_PSEUDO, "$comment.date"),
        text("）"),
      ),
      paragraph(pseudo(COMMENT_PSEUDO, "$comment.body")),
      paragraph(),
    ),
  );
  return doc(...blocks);
};
