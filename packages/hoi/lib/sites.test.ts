import { describe, expect, it } from "vitest";
import { isSupportedUrl } from "./sites";

describe("isSupportedUrl", () => {
  it("cybozu.com と kintone.com のページなら true", () => {
    expect(isSupportedUrl("https://example.cybozu.com/k/#/space/1/thread/1")).toBe(true);
    expect(isSupportedUrl("https://example.kintone.com/k/12/show#record=3")).toBe(true);
    expect(isSupportedUrl("https://example.cybozu.com/g/")).toBe(true);
  });

  it("ほかのサイト、似た名前のドメイン、http、URL が読めないタブは false", () => {
    expect(isSupportedUrl("https://github.com/")).toBe(false);
    expect(isSupportedUrl("https://example.cybozu.com.evil.test/k/")).toBe(false);
    expect(isSupportedUrl("https://notcybozu.com/")).toBe(false);
    expect(isSupportedUrl("http://example.cybozu.com/k/")).toBe(false);
    expect(isSupportedUrl(undefined)).toBe(false);
  });
});
