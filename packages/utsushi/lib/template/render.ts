import type { RecordLocation } from "../kintone/location";
import { recordUrl } from "../kintone/location";
import { subtableRows } from "../kintone/record";
import type { Comment, KintoneRecord, SubtableRow } from "../kintone/types";
import type { Catalog } from "./catalog";
import { formatDateTime, formatValue } from "./format";
import type { BlockNode, InlineNode, TemplateDoc } from "./schema";
import { validateTemplate, type Problem } from "./validate";

export type RenderContext = {
  location: RecordLocation;
  catalog: Catalog;
  record: KintoneRecord;
  comments: Comment[];
};

export class TemplateError extends Error {
  override readonly name = "TemplateError";
  constructor(readonly problems: Problem[]) {
    super("テンプレートが参照するフィールドに問題があります");
  }
}

type Scope = { row?: SubtableRow; comment?: Comment };

/** ブロック外に置かれたサブテーブルの列は、全行の値をこの区切りで連結する */
const ROW_JOINER = ", ";

/**
 * テンプレートにレコードとコメントを差し込んでテキストにする。
 *
 * 段落は改行でつなぐ。繰り返しブロックは中身を行（件）ごとに描画して改行でつなぎ、
 * 行が 0 件ならブロックごと出さない。末尾の空行は落とす。
 */
export const renderTemplate = (tpl: TemplateDoc, ctx: RenderContext): string => {
  const problems = validateTemplate(tpl, ctx.catalog);
  if (problems.length > 0) throw new TemplateError(problems);

  const fieldText = (code: string, scope: Scope): string => {
    switch (code) {
      case "$record.url":
        return recordUrl(ctx.location);
      case "$record.id":
        return ctx.location.recordId;
      case "$app.id":
        return ctx.location.appId;
      case "$comment.author":
        return scope.comment?.creator.name ?? "";
      case "$comment.date":
        return scope.comment ? formatDateTime(scope.comment.createdAt) : "";
      case "$comment.body":
        return scope.comment?.text ?? "";
      case "$comment.mentions":
        return scope.comment?.mentions.map((m) => m.code).join(", ") ?? "";
    }
    const meta = ctx.catalog.byCode.get(code);
    if (!meta) return "";
    if (!meta.table) return formatValue(ctx.record[code], meta);
    if (scope.row && code in scope.row.value)
      return formatValue(scope.row.value[code], meta);
    return subtableRows(ctx.record, meta.table.code)
      .map((row) => formatValue(row.value[code], meta))
      .filter((v) => v !== "")
      .join(ROW_JOINER);
  };

  const renderInline = (nodes: InlineNode[] | undefined, scope: Scope) =>
    (nodes ?? [])
      .map((n) =>
        n.type === "text"
          ? n.text
          : n.type === "hardBreak"
            ? "\n"
            : fieldText(n.attrs.code, scope),
      )
      .join("");

  const renderBlocks = (blocks: BlockNode[], scope: Scope): string[] =>
    blocks.flatMap((block) => {
      if (block.type === "paragraph") return [renderInline(block.content, scope)];
      const scopes: Scope[] =
        block.attrs.source === "comments"
          ? ctx.comments.map((comment) => ({ comment }))
          : subtableRows(ctx.record, block.attrs.code).map((row) => ({ row }));
      if (scopes.length === 0) return [];
      return [
        scopes.map((s) => renderBlocks(block.content, s).join("\n")).join("\n"),
      ];
    });

  return renderBlocks(tpl.content, {}).join("\n").replace(/\n+$/, "");
};
