import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  defaultPreset,
  emptySettings,
  exportAll,
  importAll,
  loadAllSettings,
  loadAppSettings,
  type Preset,
  removePreset,
  saveAppSettings,
  upsertPreset,
} from "./settings";
import { doc } from "./template/schema";

const preset = (id: string): Preset => ({
  id,
  name: id,
  template: doc(),
  updatedAt: "2026-10-04T00:00:00Z",
});

beforeEach(() => fakeBrowser.reset());

describe("プリセットの操作", () => {
  it("最初のプリセットは自動でデフォルトになる", () => {
    const s = upsertPreset(emptySettings(), preset("a"), false);
    expect(s.defaultPresetId).toBe("a");
    const s2 = upsertPreset(s, preset("b"), false);
    expect(defaultPreset(s2)?.id).toBe("a");
    expect(defaultPreset(upsertPreset(s2, preset("b"), true))?.id).toBe("b");
  });

  it("デフォルトを消したら先頭がデフォルトになる", () => {
    let s = upsertPreset(emptySettings(), preset("a"), false);
    s = upsertPreset(s, preset("b"), true);
    expect(removePreset(s, "b").defaultPresetId).toBe("a");
    expect(removePreset(removePreset(s, "b"), "a").defaultPresetId).toBeNull();
  });
});

describe("保存", () => {
  const key = { domain: "example.cybozu.com", appId: "12" };

  it("ドメインとアプリIDで保存し、全件を一覧できる", async () => {
    await saveAppSettings(key, upsertPreset(emptySettings(), preset("a"), false));
    await saveAppSettings(
      { domain: "other.kintone.com", appId: "3" },
      { ...emptySettings(), downloadFieldCodes: ["f"] },
    );
    expect((await loadAppSettings(key)).presets).toHaveLength(1);
    expect((await loadAllSettings()).map((x) => x.key)).toEqual([
      key,
      { domain: "other.kintone.com", appId: "3" },
    ]);
  });

  it("空になったら消す", async () => {
    await saveAppSettings(key, upsertPreset(emptySettings(), preset("a"), false));
    await saveAppSettings(key, emptySettings());
    expect(await loadAllSettings()).toEqual([]);
  });

  it("エクスポートしたものをインポートできる", async () => {
    await saveAppSettings(key, upsertPreset(emptySettings(), preset("a"), false));
    const file = JSON.parse(JSON.stringify(await exportAll()));
    fakeBrowser.reset();
    expect(await importAll(file)).toBe(1);
    expect((await loadAppSettings(key)).presets[0]?.id).toBe("a");
    await expect(importAll({ foo: 1 })).rejects.toThrow();
  });
});
