import { storage } from "wxt/utils/storage";
import type { TemplateDoc } from "./template/schema";

export type Preset = {
  id: string;
  name: string;
  template: TemplateDoc;
  updatedAt: string;
};

/** アプリ（ドメイン＋アプリID）ごとの設定 */
export type AppSettings = {
  presets: Preset[];
  defaultPresetId: string | null;
  /** ダウンロード対象の添付ファイルフィールド。`null` は全フィールド */
  downloadFieldCodes: string[] | null;
};

export type AppKey = { domain: string; appId: string };

const PREFIX = "app:";

const itemKey = ({ domain, appId }: AppKey) =>
  `local:${PREFIX}${domain}:${appId}` as const;

export const emptySettings = (): AppSettings => ({
  presets: [],
  defaultPresetId: null,
  downloadFieldCodes: null,
});

export const loadAppSettings = async (key: AppKey): Promise<AppSettings> =>
  (await storage.getItem<AppSettings>(itemKey(key))) ?? emptySettings();

export const saveAppSettings = async (
  key: AppKey,
  settings: AppSettings,
): Promise<void> => {
  if (settings.presets.length === 0 && settings.downloadFieldCodes === null) {
    await storage.removeItem(itemKey(key));
    return;
  }
  await storage.setItem(itemKey(key), settings);
};

/** デフォルトのプリセット。指定が消えていれば先頭 */
export const defaultPreset = (s: AppSettings): Preset | undefined =>
  s.presets.find((p) => p.id === s.defaultPresetId) ?? s.presets[0];

export const upsertPreset = (
  s: AppSettings,
  preset: Preset,
  makeDefault: boolean,
): AppSettings => {
  const exists = s.presets.some((p) => p.id === preset.id);
  const presets = exists
    ? s.presets.map((p) => (p.id === preset.id ? preset : p))
    : [...s.presets, preset];
  const defaultPresetId =
    makeDefault || presets.length === 1 ? preset.id : s.defaultPresetId;
  return { ...s, presets, defaultPresetId };
};

export const removePreset = (s: AppSettings, id: string): AppSettings => {
  const presets = s.presets.filter((p) => p.id !== id);
  return {
    ...s,
    presets,
    defaultPresetId:
      s.defaultPresetId === id ? (presets[0]?.id ?? null) : s.defaultPresetId,
  };
};

/** 全アプリの設定。オプション画面の一覧とエクスポートに使う */
export type AllSettings = Record<string, AppSettings>;

const parseKey = (raw: string): AppKey | null => {
  if (!raw.startsWith(PREFIX)) return null;
  const rest = raw.slice(PREFIX.length);
  const i = rest.lastIndexOf(":");
  if (i <= 0) return null;
  return { domain: rest.slice(0, i), appId: rest.slice(i + 1) };
};

export const loadAllSettings = async (): Promise<
  { key: AppKey; settings: AppSettings }[]
> => {
  const all = await browser.storage.local.get(null);
  return Object.entries(all).flatMap(([raw, value]) => {
    const key = parseKey(raw);
    return key ? [{ key, settings: value as AppSettings }] : [];
  });
};

export const EXPORT_FORMAT = "utsushi/v1";

export type ExportFile = {
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  apps: { domain: string; appId: string; settings: AppSettings }[];
};

export const exportAll = async (): Promise<ExportFile> => ({
  format: EXPORT_FORMAT,
  exportedAt: new Date().toISOString(),
  apps: (await loadAllSettings()).map(({ key, settings }) => ({
    ...key,
    settings,
  })),
});

/** インポートしたアプリの設定で上書きする。ファイルに無いアプリはそのまま */
export const importAll = async (file: unknown): Promise<number> => {
  if (
    typeof file !== "object" ||
    file === null ||
    (file as ExportFile).format !== EXPORT_FORMAT ||
    !Array.isArray((file as ExportFile).apps)
  )
    throw new Error("このファイルは utsushi のエクスポートではありません");
  const { apps } = file as ExportFile;
  for (const { domain, appId, settings } of apps)
    await saveAppSettings({ domain, appId }, settings);
  return apps.length;
};
