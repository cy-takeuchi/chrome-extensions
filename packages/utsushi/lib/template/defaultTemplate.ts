import { type Catalog, COMMENTS_LABEL, pseudoField } from "./catalog";
import { type BlockNode, doc, type FieldNode, field, loop, paragraph, text } from "./schema";

/**
 * 新規プリセットの初期値。全フィールドをレイアウト順に「ラベル: 値」で並べ、
 * サブテーブルは繰り返しブロック、最後にコメントブロックを置く。
 * 利用者は不要な行を消すだけでプリセットを作れる。
 * 行末がチップで終わるとドラッグで行を選びにくいので、チップの後ろに半角スペースを置く。
 */
export const buildDefaultTemplate = (catalog: Catalog) => {
  const blocks: BlockNode[] = [
    paragraph(text("レコード: "), pseudoField("$record.url"), text(" ")),
    paragraph(),
  ];
  let currentGroup: string | undefined;
  const emittedTables = new Set<string>();

  for (const f of catalog.fields) {
    if (f.table) {
      if (emittedTables.has(f.table.code)) continue;
      emittedTables.add(f.table.code);
      const columns = catalog.fields.filter((c) => c.table?.code === f.table?.code);
      const row: (FieldNode | ReturnType<typeof text>)[] = [text("- ")];
      columns.forEach((c, i) => {
        if (i > 0) row.push(text(" / "));
        row.push(text(`${c.label}: `), field(c.code, c.label));
      });
      row.push(text(" "));
      blocks.push(
        paragraph(text(`【${f.table.label}】`)),
        loop({ source: "subtable", code: f.table.code, label: f.table.label }, paragraph(...row)),
      );
      currentGroup = undefined;
      continue;
    }
    if (f.group !== currentGroup) {
      currentGroup = f.group;
      if (f.group) blocks.push(paragraph(text(`【${f.group}】`)));
    }
    blocks.push(paragraph(text(`${f.label}: `), field(f.code, f.label), text(" ")));
  }

  blocks.push(
    paragraph(),
    paragraph(text(`【${COMMENTS_LABEL}】`)),
    loop(
      { source: "comments", code: null, label: COMMENTS_LABEL },
      paragraph(
        text("■ "),
        pseudoField("$comment.author"),
        text("（"),
        pseudoField("$comment.date"),
        text("）"),
      ),
      paragraph(pseudoField("$comment.body"), text(" ")),
      paragraph(),
    ),
  );
  return doc(...blocks);
};
