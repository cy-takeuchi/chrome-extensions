import { describe, expect, it } from "vitest";
import { comments, form, location, record } from "./__fixtures__/sample";
import { buildCatalog } from "./catalog";
import { buildDefaultTemplate } from "./defaultTemplate";
import { renderTemplate, TemplateError } from "./render";
import { doc, field, loop, paragraph, text } from "./schema";

const catalog = buildCatalog(form);
const ctx = { location, catalog, record, comments };

describe("buildCatalog", () => {
  it("無効なカテゴリーは除き、ステータスは末尾に入る", () => {
    expect(catalog.fields.map((f) => f.code)).toEqual([
      "subject",
      "body",
      "billing_address",
      "item",
      "qty",
      "attachments",
      "ステータス",
    ]);
    expect(catalog.byCode.get("billing_address")?.group).toBe("請求先");
    expect(catalog.byCode.get("qty")?.table?.code).toBe("lines");
  });
});

describe("renderTemplate", () => {
  it("文章とフィールドを交互に差し込む", () => {
    const tpl = doc(
      paragraph(text("件名は"), field("subject", "件名"), text("です")),
      paragraph(text("状態: "), field("ステータス", "ステータス")),
    );
    expect(renderTemplate(tpl, ctx)).toBe("件名は見積もり依頼です\n状態: 処理中");
  });

  it("リッチエディターは Markdown になる", () => {
    const tpl = doc(paragraph(field("body", "本文")));
    expect(renderTemplate(tpl, ctx)).toBe("至急**対応**\n\n-   A\n-   B");
  });

  it("サブテーブルのブロックは行ごとに繰り返す", () => {
    const tpl = doc(
      loop(
        { source: "subtable", code: "lines", label: "明細" },
        paragraph(text("品名 "), field("item", "品名"), text(" を "), field("qty", "数量")),
      ),
    );
    expect(renderTemplate(tpl, ctx)).toBe("品名 りんご を 3個\n品名 みかん を 5個");
  });

  it("ブロック外の列は全行連結", () => {
    const tpl = doc(paragraph(text("品名: "), field("item", "品名")));
    expect(renderTemplate(tpl, ctx)).toBe("品名: りんご, みかん");
  });

  it("コメントは古い順に繰り返す", () => {
    const tpl = doc(
      loop(
        { source: "comments", code: null, label: "コメント" },
        paragraph(field("$comment.author", "投稿者"), text(" "), field("$comment.date", "日時")),
        paragraph(field("$comment.body", "本文")),
      ),
    );
    expect(renderTemplate(tpl, ctx)).toBe(
      "佐藤 2026-10-01 09:00\n確認します\n鈴木 2026-10-02 09:30\nお願いします",
    );
  });

  it("繰り返す行が無ければブロックごと出さない", () => {
    const tpl = doc(
      paragraph(text("前")),
      loop({ source: "comments", code: null, label: "コメント" }, paragraph(text("x"))),
      paragraph(text("後")),
    );
    expect(renderTemplate(tpl, { ...ctx, comments: [] })).toBe("前\n後");
  });

  it("レコード URL などの擬似フィールド", () => {
    const tpl = doc(paragraph(field("$record.url", "レコードURL")));
    expect(renderTemplate(tpl, ctx)).toBe(
      "https://example.cybozu.com/k/12/show#record=34",
    );
  });

  it("閲覧権限が無く値が返らないフィールドは空", () => {
    const { subject: _, ...rest } = record;
    const tpl = doc(paragraph(text("["), field("subject", "件名"), text("]")));
    expect(renderTemplate(tpl, { ...ctx, record: rest })).toBe("[]");
  });

  it("アプリに無いフィールドを参照していたら中止する", () => {
    const tpl = doc(
      paragraph(field("deleted", "消えた")),
      paragraph(field("$comment.body", "本文")),
    );
    try {
      renderTemplate(tpl, ctx);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TemplateError);
      expect((e as TemplateError).problems).toEqual([
        { code: "deleted", label: "消えた", reason: "missing" },
        { code: "$comment.body", label: "本文", reason: "outside-comments" },
      ]);
    }
  });
});

describe("buildDefaultTemplate", () => {
  it("全フィールドを並べた初期値がそのまま描画できる", () => {
    const out = renderTemplate(buildDefaultTemplate(catalog), ctx);
    expect(out).toBe(
      [
        "レコード: https://example.cybozu.com/k/12/show#record=34",
        "",
        "件名: 見積もり依頼",
        "本文: 至急**対応**\n\n-   A\n-   B",
        "【請求先】",
        "住所: 東京都",
        "【明細】",
        "- 品名: りんご / 数量: 3個",
        "- 品名: みかん / 数量: 5個",
        "添付: 見積書.pdf",
        "ステータス: 処理中",
        "",
        "【コメント】",
        "■ 佐藤（2026-10-01 09:00）",
        "確認します",
        "",
        "■ 鈴木（2026-10-02 09:30）",
        "お願いします",
      ].join("\n"),
    );
  });
});
