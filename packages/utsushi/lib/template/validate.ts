import {
  COMMENT_PSEUDO,
  RECORD_PSEUDO,
  type Catalog,
} from "./catalog";
import type { BlockNode, InlineNode, LoopAttrs, TemplateDoc } from "./schema";

export type Problem = {
  /** 問題のあるフィールドコード（ブロックならサブテーブルのコード） */
  code: string;
  /** テンプレートに控えてある表示名 */
  label: string;
  reason: "missing" | "outside-comments";
};

const RECORD_CODES = new Set<string>(RECORD_PSEUDO.map((p) => p.code));
const COMMENT_CODES = new Set<string>(COMMENT_PSEUDO.map((p) => p.code));

/**
 * テンプレートが参照するフィールドがアプリに実在するかを調べる。
 * 1 件でも問題があればコピーを中止する（黙って欠けたデータを渡さない）。
 */
export const validateTemplate = (
  tpl: TemplateDoc,
  catalog: Catalog,
): Problem[] => {
  const problems: Problem[] = [];
  const tableCodes = new Set(catalog.tables.map((t) => t.code));

  const visitInline = (nodes: InlineNode[] | undefined, loop?: LoopAttrs) => {
    for (const node of nodes ?? []) {
      if (node.type !== "field") continue;
      const { code, label } = node.attrs;
      if (RECORD_CODES.has(code)) continue;
      if (COMMENT_CODES.has(code)) {
        if (loop?.source !== "comments")
          problems.push({ code, label, reason: "outside-comments" });
        continue;
      }
      if (!catalog.byCode.has(code))
        problems.push({ code, label, reason: "missing" });
    }
  };

  const visitBlocks = (blocks: BlockNode[], loop?: LoopAttrs) => {
    for (const block of blocks) {
      if (block.type === "paragraph") {
        visitInline(block.content, loop);
        continue;
      }
      if (block.attrs.source === "subtable" && !tableCodes.has(block.attrs.code))
        problems.push({
          code: block.attrs.code,
          label: block.attrs.label,
          reason: "missing",
        });
      visitBlocks(block.content, block.attrs);
    }
  };

  visitBlocks(tpl.content);
  return problems;
};

export const describeProblems = (problems: Problem[]): string =>
  problems
    .map((p) =>
      p.reason === "missing"
        ? `「${p.label}」(${p.code}) がアプリにありません`
        : `「${p.label}」はコメントブロックの中でしか使えません`,
    )
    .join("\n");
