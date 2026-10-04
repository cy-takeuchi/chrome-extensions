import { describe, expect, it } from "vitest";
import { form } from "./__fixtures__/sample";
import { buildCatalog } from "./catalog";
import { refreshLabels } from "./refresh";
import { doc, field, loop, paragraph } from "./schema";

describe("refreshLabels", () => {
  it("今のラベルに合わせ、参照切れは控えのまま", () => {
    const tpl = doc(
      paragraph(field("subject", "旧件名"), field("gone", "消えた")),
      loop(
        { source: "subtable", code: "lines", label: "旧明細" },
        paragraph(field("item", "旧品名")),
      ),
    );
    expect(refreshLabels(tpl, buildCatalog(form))).toEqual(
      doc(
        paragraph(field("subject", "件名"), field("gone", "消えた")),
        loop(
          { source: "subtable", code: "lines", label: "明細" },
          paragraph(field("item", "品名")),
        ),
      ),
    );
  });
});
