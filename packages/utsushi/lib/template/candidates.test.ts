import { describe, expect, it } from "vitest";
import { form } from "./__fixtures__/sample";
import { candidates } from "./candidates";
import { buildCatalog } from "./catalog";

const catalog = buildCatalog(form);
const labels = (cs: ReturnType<typeof candidates>) => cs.map((c) => c.label);

describe("candidates", () => {
  it("ブロック外ではサブテーブルとコメントのブロックも出す", () => {
    const cs = candidates(catalog, "", null);
    expect(cs.filter((c) => c.kind === "loop").map((c) => c.label)).toEqual(["明細", "コメント"]);
    expect(labels(cs)).not.toContain("投稿者");
  });

  it("サブテーブルのブロック内では列が先頭で、ブロックは出さない", () => {
    const cs = candidates(catalog, "", {
      source: "subtable",
      code: "lines",
      label: "明細",
    });
    expect(labels(cs).slice(0, 2)).toEqual(["品名", "数量"]);
    expect(cs.some((c) => c.kind === "loop")).toBe(false);
  });

  it("コメントのブロック内では投稿者などが先頭", () => {
    const cs = candidates(catalog, "", {
      source: "comments",
      code: null,
      label: "コメント",
    });
    expect(labels(cs).slice(0, 4)).toEqual(["投稿者", "日時", "本文", "メンション"]);
  });

  it("コードでもラベルでも絞り込める", () => {
    expect(labels(candidates(catalog, "subj", null))).toEqual(["件名"]);
    expect(labels(candidates(catalog, "件", null))).toEqual(["件名"]);
    expect(labels(candidates(catalog, "LINES", null))).toEqual(["明細"]);
  });
});
