import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from "./settings";

beforeEach(() => fakeBrowser.reset());

describe("settings", () => {
  it("保存していなければ既定値", async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("保存して読み直せる", async () => {
    const settings = { enabled: false, silentRate: 2.5, offsetDb: 8, minSilenceMs: 500 };
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
  });

  it("範囲外は範囲内に、欠けた項目や不正な値は既定値にする", () => {
    expect(normalizeSettings({ silentRate: 16, offsetDb: -3 })).toEqual({
      ...DEFAULT_SETTINGS,
      silentRate: 4,
      offsetDb: 1,
    });
    expect(
      normalizeSettings({ enabled: "yes", minSilenceMs: Number.NaN } as unknown as object),
    ).toEqual(DEFAULT_SETTINGS);
  });
});
