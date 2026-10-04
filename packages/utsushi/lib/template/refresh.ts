import { type Catalog, pseudoLabel } from "./catalog";
import type { BlockNode, InlineNode, TemplateDoc } from "./schema";

/**
 * チップとブロックの表示名を、今のアプリのラベルに合わせる。
 * 管理者がラベルを変えてもテンプレートはコードで参照しているので動くが、
 * 表示は古いままになるため、エディタを開くときに直す。参照切れは控えのまま残す。
 */
export const refreshLabels = (tpl: TemplateDoc, catalog: Catalog): TemplateDoc => {
  const tableLabels = new Map(catalog.tables.map((t) => [t.code, t.label]));
  const label = (code: string, fallback: string) =>
    pseudoLabel(code) ?? catalog.byCode.get(code)?.label ?? fallback;

  const inline = (nodes: InlineNode[] | undefined) =>
    nodes?.map((n) =>
      n.type === "field"
        ? { ...n, attrs: { ...n.attrs, label: label(n.attrs.code, n.attrs.label) } }
        : n,
    );

  const blocks = (bs: BlockNode[]): BlockNode[] =>
    bs.map((b) => {
      if (b.type === "paragraph") return b.content ? { ...b, content: inline(b.content) } : b;
      const attrs =
        b.attrs.source === "subtable"
          ? { ...b.attrs, label: tableLabels.get(b.attrs.code) ?? b.attrs.label }
          : b.attrs;
      return {
        ...b,
        attrs,
        content: blocks(b.content) as typeof b.content,
      };
    });

  return { ...tpl, content: blocks(tpl.content) };
};
