import { describe, expect, it } from "vitest";
import { parseRecordLocation, recordUrl } from "./location";

describe("parseRecordLocation", () => {
  it("通常の詳細画面", () => {
    const loc = parseRecordLocation("https://example.cybozu.com/k/123/show#record=45&l.view=1");
    expect(loc).toEqual({
      origin: "https://example.cybozu.com",
      domain: "example.cybozu.com",
      apiPrefix: "/k",
      appId: "123",
      recordId: "45",
    });
  });

  it("ゲストスペースの編集画面", () => {
    const loc = parseRecordLocation(
      "https://example.cybozu.com/k/guest/7/123/show#record=45&mode=edit",
    );
    expect(loc?.apiPrefix).toBe("/k/guest/7");
    expect(loc && recordUrl(loc)).toBe("https://example.cybozu.com/k/guest/7/123/show#record=45");
  });

  it.each([
    "https://example.cybozu.com/k/123/",
    "https://example.cybozu.com/k/123/show",
    "https://example.cybozu.com/k/123/edit",
    "https://example.cybozu.com/k/#/portal",
  ])("詳細画面以外は null: %s", (href) => {
    expect(parseRecordLocation(href)).toBeNull();
  });
});
