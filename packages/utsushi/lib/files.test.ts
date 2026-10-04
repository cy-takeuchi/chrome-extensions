import { describe, expect, it } from "vitest";
import type { Form } from "kisekae";
import { collectFiles, sanitizeFileName } from "./files";
import { buildCatalog } from "./template/catalog";
import type { KintoneRecord } from "./kintone/types";

const base = { noLabel: false, required: false };
const catalog = buildCatalog({
  fields: [
    { ...base, type: "FILE", code: "top", label: "上", parent: null },
    {
      ...base,
      type: "FILE",
      code: "inner",
      label: "中",
      parent: { type: "SUBTABLE", code: "t", label: "表" },
    },
  ],
  tables: [{ type: "SUBTABLE", code: "t", label: "表", noLabel: false }],
  groups: [],
  elements: [],
  unplaced: [],
} as unknown as Form);

const file = (name: string) => ({
  contentType: "text/plain",
  fileKey: name,
  name,
  size: "1",
});

const record: KintoneRecord = {
  top: { type: "FILE", value: [file("a.txt")] },
  t: {
    type: "SUBTABLE",
    value: [
      { id: "1", value: { inner: { type: "FILE", value: [file("b.txt")] } } },
      { id: "2", value: { inner: { type: "FILE", value: [file("c.txt")] } } },
    ],
  },
};

describe("collectFiles", () => {
  it("未設定ならサブテーブル内を含む全ファイル", () => {
    expect(collectFiles(record, catalog, null).map((f) => f.name)).toEqual([
      "a.txt",
      "b.txt",
      "c.txt",
    ]);
  });

  it("選んだフィールドだけ", () => {
    expect(collectFiles(record, catalog, ["inner"]).map((f) => f.name)).toEqual([
      "b.txt",
      "c.txt",
    ]);
  });
});

describe("sanitizeFileName", () => {
  it.each([
    ["見積書.pdf", "見積書.pdf"],
    ["a/b:c?.txt", "a_b_c_.txt"],
    [" .hidden ", "hidden"],
    ["...", "file"],
  ])("%s → %s", (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });
});
