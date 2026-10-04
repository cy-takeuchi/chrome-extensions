import HardBreak from "@tiptap/extension-hard-break";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Gapcursor, Placeholder, TrailingNode, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Catalog } from "@/lib/template/catalog";
import type { TemplateDoc } from "@/lib/template/schema";
import { FieldNode, FieldSuggestion, LoopNode, TemplateDocument } from "./extensions";
import { BrokenCodesContext } from "./NodeViews";
import { createSuggestionStore, type SuggestionStore } from "./suggestionStore";

type Props = {
  initial: TemplateDoc;
  catalog: Catalog;
  brokenCodes: ReadonlySet<string>;
  onChange: (doc: TemplateDoc) => void;
};

export const TemplateEditor = ({ initial, catalog, brokenCodes, onChange }: Props) => {
  const store = useMemo(createSuggestionStore, []);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      TemplateDocument,
      Paragraph,
      Text,
      HardBreak,
      UndoRedo,
      Gapcursor,
      // 末尾がブロックでも、その後ろに書けるようにする
      TrailingNode.configure({ node: "paragraph" }),
      Placeholder.configure({ placeholder: "@ でフィールドを差し込む" }),
      FieldNode,
      LoopNode,
      FieldSuggestion.configure({ getCatalog: () => catalogRef.current, store }),
    ],
    content: initial,
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON() as TemplateDoc),
  });

  useEffect(() => {
    editor?.commands.focus("start");
  }, [editor]);

  return (
    <BrokenCodesContext.Provider value={brokenCodes}>
      <div className="editor">
        <EditorContent editor={editor} />
        <SuggestionPopup store={store} />
      </div>
    </BrokenCodesContext.Provider>
  );
};

const SuggestionPopup = ({ store }: { store: SuggestionStore }) => {
  const state = useSyncExternalStore(store.subscribe, store.get);
  const listRef = useRef<HTMLUListElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 選択が動いたら選択中の候補が見えるようにスクロールする
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [state?.selected]);

  if (!state?.rect) return null;
  const { rect, items, selected, select } = state;
  const below = rect.bottom + 260 < window.innerHeight;
  return (
    <ul
      ref={listRef}
      className="suggest"
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: エディタにフォーカスを残したまま出す候補一覧
      role="listbox"
      style={{
        left: Math.min(rect.left, window.innerWidth - 340),
        ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
      }}
    >
      {items.length === 0 && <li className="suggest-empty">該当なし</li>}
      {items.map((c, i) => (
        // biome-ignore lint/a11y/useFocusableInteractive: 候補はエディタの ↑↓ で選び、フォーカスは移さない
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: 同じコードの候補が並ぶことがあるため順番も含める
          key={`${c.kind}:${c.kind === "field" ? c.code : c.attrs.code}:${i}`}
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: 候補一覧の項目
          role="option"
          aria-selected={i === selected}
          className={i === selected ? "suggest-item active" : "suggest-item"}
          onMouseDown={(e) => {
            e.preventDefault();
            select(c);
          }}
        >
          <span className="suggest-label">
            {c.kind === "loop" ? "🔁 " : ""}
            {c.label}
          </span>
          <span className="suggest-hint">
            {c.hint}
            {c.kind === "field" && !c.code.startsWith("$") ? ` · ${c.code}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
};
