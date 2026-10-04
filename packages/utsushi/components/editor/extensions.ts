import { type Editor, Extension, mergeAttributes, Node } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import { PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { type Candidate, candidates } from "@/lib/template/candidates";
import { type Catalog, pseudoField } from "@/lib/template/catalog";
import { type LoopAttrs, type ParagraphNode, paragraph, text } from "@/lib/template/schema";
import { FieldChipView, LoopView } from "./NodeViews";
import type { SuggestionStore } from "./suggestionStore";

/** ルートは段落と繰り返しブロックだけを持つ */
export const TemplateDocument = Document.extend({ content: "(paragraph | loop)+" });

/** 差し込みフィールド。フィールドコードで保存し、ラベルで表示するチップ */
export const FieldNode = Node.create({
  name: "field",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    code: { default: "" },
    label: { default: "" },
  }),
  parseHTML: () => [{ tag: "span[data-field]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, { "data-field": node.attrs.code }),
    `@${node.attrs.label}`,
  ],
  renderText: ({ node }) => `@${node.attrs.label}`,
  addNodeView: () => ReactNodeViewRenderer(FieldChipView),
});

/** サブテーブルの各行・コメントの各件で中身を繰り返すブロック。入れ子にしない */
export const LoopNode = Node.create({
  name: "loop",
  content: "paragraph+",
  defining: true,
  isolating: true,
  addAttributes: () => ({
    source: { default: "subtable" },
    code: { default: null },
    label: { default: "" },
  }),
  parseHTML: () => [{ tag: "div[data-loop]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-loop": "" }),
    0,
  ],
  addNodeView: () => ReactNodeViewRenderer(LoopView),
});

/** カーソルを含む繰り返しブロック */
export const loopAt = (editor: Editor): LoopAttrs | null => {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "loop") return node.attrs as LoopAttrs;
  }
  return null;
};

/** ブロックを挿入したときの中身。コメントは投稿者・日時・本文を入れておく */
const loopInner = (attrs: LoopAttrs): ParagraphNode[] =>
  attrs.source === "comments"
    ? [
        paragraph(
          pseudoField("$comment.author"),
          text("（"),
          pseudoField("$comment.date"),
          text("）"),
        ),
        paragraph(pseudoField("$comment.body")),
      ]
    : [paragraph()];

export type FieldSuggestionOptions = {
  getCatalog: () => Catalog | null;
  store: SuggestionStore;
};

/**
 * `@`（全角の `＠` も）で候補を出す。日本語の文中でも出したいので、
 * 直前が空白でなくても反応させる。
 */
export const FieldSuggestion = Extension.create<FieldSuggestionOptions>({
  name: "fieldSuggestion",
  addOptions: () => ({ getCatalog: () => null, store: null as unknown as SuggestionStore }),
  addProseMirrorPlugins() {
    const { getCatalog, store } = this.options;
    return ["@", "＠"].map((char, i) =>
      Suggestion<Candidate, Candidate>({
        editor: this.editor,
        char,
        pluginKey: new PluginKey(`fieldSuggestion${i}`),
        allowedPrefixes: null,
        items: ({ query, editor }) => {
          const catalog = getCatalog();
          return catalog ? candidates(catalog, query, loopAt(editor)).slice(0, 50) : [];
        },
        command: ({ editor, range, props: c }) => {
          const chain = editor.chain().focus().deleteRange(range);
          if (c.kind === "field") {
            chain
              .insertContent([
                { type: "field", attrs: { code: c.code, label: c.label } },
                { type: "text", text: " " },
              ])
              .run();
            return;
          }
          chain.insertContent({ type: "loop", attrs: c.attrs, content: loopInner(c.attrs) }).run();
        },
        render: () => {
          let selected = 0;
          let latest: {
            items: Candidate[];
            command: (c: Candidate) => void;
            rect: DOMRect | null;
          } = {
            items: [],
            command: () => {},
            rect: null,
          };
          const publish = () =>
            store.set({
              items: latest.items,
              selected,
              rect: latest.rect,
              select: latest.command,
            });
          return {
            onStart: (props) => {
              selected = 0;
              latest = {
                items: props.items,
                command: props.command,
                rect: props.clientRect?.() ?? null,
              };
              publish();
            },
            onUpdate: (props) => {
              selected = 0;
              latest = {
                items: props.items,
                command: props.command,
                rect: props.clientRect?.() ?? null,
              };
              publish();
            },
            onKeyDown: ({ event }) => {
              const n = latest.items.length;
              if (event.key === "Escape") {
                store.set(null);
                return true;
              }
              if (n === 0) return false;
              if (event.key === "ArrowDown") {
                selected = (selected + 1) % n;
                publish();
                return true;
              }
              if (event.key === "ArrowUp") {
                selected = (selected - 1 + n) % n;
                publish();
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                if (event.isComposing) return false;
                const item = latest.items[selected];
                if (item) latest.command(item);
                return true;
              }
              return false;
            },
            onExit: () => store.set(null),
          };
        },
      }),
    );
  },
});
