import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  emptySettings,
  exportAll,
  importAll,
  loadAllSettings,
  loadAppSettings,
  movePreset,
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

const ids = (s: { presets: Preset[] }) => s.presets.map((p) => p.id);

describe("プリセットの操作", () => {
  const abc = [preset("a"), preset("b"), preset("c")].reduce(upsertPreset, emptySettings());

  it("新規は末尾に足し、既存は同じ位置で置き換える", () => {
    expect(ids(abc)).toEqual(["a", "b", "c"]);
    const renamed = upsertPreset(abc, { ...preset("b"), name: "B" });
    expect(renamed.presets.map((p) => p.name)).toEqual(["a", "B", "c"]);
  });

  it("並び替える。範囲外は端に寄せる", () => {
    expect(ids(movePreset(abc, "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(movePreset(abc, "a", 1))).toEqual(["b", "a", "c"]);
    expect(ids(movePreset(abc, "a", 9))).toEqual(["b", "c", "a"]);
    expect(ids(movePreset(abc, "b", -1))).toEqual(["b", "a", "c"]);
    expect(ids(movePreset(abc, "x", 0))).toEqual(["a", "b", "c"]);
  });

  it("削除する", () => {
    expect(ids(removePreset(abc, "b"))).toEqual(["a", "c"]);
  });
});

describe("保存", () => {
  const key = { domain: "example.cybozu.com", appId: "12" };

  it("ドメインとアプリIDで保存し、全件を一覧できる", async () => {
    await saveAppSettings(key, upsertPreset(emptySettings(), preset("a")));
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

  it("以前のデフォルト指定は、そのプリセットを先頭に移して読む", async () => {
    await fakeBrowser.storage.local.set({
      "app:example.cybozu.com:12": {
        presets: [preset("a"), preset("b")],
        defaultPresetId: "b",
        downloadFieldCodes: null,
      },
    });
    const s = await loadAppSettings(key);
    expect(ids(s)).toEqual(["b", "a"]);
    expect(s).not.toHaveProperty("defaultPresetId");
    expect(ids((await loadAllSettings())[0]?.settings ?? emptySettings())).toEqual(["b", "a"]);
  });

  it("空になったら消す", async () => {
    await saveAppSettings(key, upsertPreset(emptySettings(), preset("a")));
    await saveAppSettings(key, emptySettings());
    expect(await loadAllSettings()).toEqual([]);
  });

  it("エクスポートしたものをインポートできる", async () => {
    await saveAppSettings(key, upsertPreset(emptySettings(), preset("a")));
    const file = JSON.parse(JSON.stringify(await exportAll()));
    fakeBrowser.reset();
    expect(await importAll(file)).toBe(1);
    expect((await loadAppSettings(key)).presets[0]?.id).toBe("a");
    await expect(importAll({ foo: 1 })).rejects.toThrow();
  });
});
