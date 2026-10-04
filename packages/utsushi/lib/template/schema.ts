/**
 * テンプレートの保存形式。TipTap（ProseMirror）の JSON と同じ形で、
 * エディタはこれをそのまま読み書きし、レンダラはエディタに依存せずに走査する。
 *
 * - `field` はフィールドコードで保存し、`label` は挿入時点の表示名（表示用の控え）
 * - `loop` はサブテーブルの各行、またはコメントの各件で中身を繰り返す。入れ子にしない
 */
export type TextNode = { type: "text"; text: string };
export type HardBreakNode = { type: "hardBreak" };
export type FieldNode = {
  type: "field";
  attrs: { code: string; label: string };
};
export type InlineNode = TextNode | HardBreakNode | FieldNode;

export type ParagraphNode = { type: "paragraph"; content?: InlineNode[] };

export type LoopAttrs =
  | { source: "subtable"; code: string; label: string }
  | { source: "comments"; code: null; label: string };

export type LoopNode = {
  type: "loop";
  attrs: LoopAttrs;
  content: ParagraphNode[];
};

export type BlockNode = ParagraphNode | LoopNode;

export type TemplateDoc = { type: "doc"; content: BlockNode[] };

export const text = (t: string): TextNode => ({ type: "text", text: t });

export const field = (code: string, label: string): FieldNode => ({
  type: "field",
  attrs: { code, label },
});

export const paragraph = (...content: InlineNode[]): ParagraphNode =>
  content.length === 0 ? { type: "paragraph" } : { type: "paragraph", content };

export const loop = (attrs: LoopAttrs, ...content: ParagraphNode[]): LoopNode => ({
  type: "loop",
  attrs,
  content: content.length === 0 ? [paragraph()] : content,
});

export const doc = (...content: BlockNode[]): TemplateDoc => ({
  type: "doc",
  content: content.length === 0 ? [paragraph()] : content,
});
