import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { createContext, useContext } from "react";

/** 参照切れのフィールドコード。チップを赤くする */
export const BrokenCodesContext = createContext<ReadonlySet<string>>(new Set());

export const FieldChipView = ({ node, selected }: ReactNodeViewProps) => {
  const broken = useContext(BrokenCodesContext).has(node.attrs.code);
  return (
    <NodeViewWrapper
      as="span"
      className={`chip${broken ? " chip-broken" : ""}${selected ? " chip-selected" : ""}`}
      title={broken ? `${node.attrs.code} はアプリにありません` : node.attrs.code}
    >
      {node.attrs.label}
    </NodeViewWrapper>
  );
};

export const LoopView = ({ node, deleteNode }: ReactNodeViewProps) => {
  const { source, code, label } = node.attrs;
  const broken = useContext(BrokenCodesContext).has(code ?? "");
  const unit = source === "comments" ? "各件" : "各行";
  return (
    <NodeViewWrapper className={`loop${broken ? " loop-broken" : ""}`}>
      <div className="loop-head" contentEditable={false}>
        <span>
          🔁 {label} の{unit}
          {broken ? `（${code} はアプリにありません）` : ""}
        </span>
        <button type="button" className="loop-remove" onClick={deleteNode} title="ブロックを削除">
          ×
        </button>
      </div>
      <NodeViewContent className="loop-body" />
      <div className="loop-foot" contentEditable={false}>
        {label} ここまで
      </div>
    </NodeViewWrapper>
  );
};
