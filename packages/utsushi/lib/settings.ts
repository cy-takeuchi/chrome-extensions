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
  /** メニューに出す順。先頭を最初に選んでおく */
  presets: Preset[];
  /** ダウンロード対象の添付ファイルフィールド。`null` は全フィールド */
  downloadFieldCodes: string[] | null;
};

export type AppKey = { domain: string; appId: string };

const PREFIX = "app:";

const itemKey = ({ domain, appId }: AppKey) => `local:${PREFIX}${domain}:${appId}` as const;

export const emptySettings = (): AppSettings => ({
  presets: [],
  downloadFieldCodes: null,
});

/**
 * 保存されている形をいまの形にそろえる。以前はデフォルトのプリセットを
 * `defaultPresetId` で指定していたので、そのプリセットを先頭に移す
 */
const normalize = (raw: AppSettings & { defaultPresetId?: string | null }): AppSettings => {
  const { defaultPresetId, ...settings } = raw;
  const first = settings.presets.find((p) => p.id === defaultPresetId);
  if (!first) return settings;
  return { ...settings, presets: [first, ...settings.presets.filter((p) => p !== first)] };
};

export const loadAppSettings = async (key: AppKey): Promise<AppSettings> => {
  const raw = await storage.getItem<AppSettings>(itemKey(key));
  return raw ? normalize(raw) : emptySettings();
};

export const saveAppSettings = async (key: AppKey, settings: AppSettings): Promise<void> => {
  if (settings.presets.length === 0 && settings.downloadFieldCodes === null) {
    await storage.removeItem(itemKey(key));
    return;
  }
  await storage.setItem(itemKey(key), normalize(settings));
};

/** 既存なら置き換え、新規なら末尾に足す */
export const upsertPreset = (s: AppSettings, preset: Preset): AppSettings => {
  const exists = s.presets.some((p) => p.id === preset.id);
  const presets = exists
    ? s.presets.map((p) => (p.id === preset.id ? preset : p))
    : [...s.presets, preset];
  return { ...s, presets };
};

export const removePreset = (s: AppSettings, id: string): AppSettings => ({
  ...s,
  presets: s.presets.filter((p) => p.id !== id),
});

/** プリセットを `to` 番目に移す。範囲外なら端に寄せる */
export const movePreset = (s: AppSettings, id: string, to: number): AppSettings => {
  const preset = s.presets.find((p) => p.id === id);
  if (!preset) return s;
  const rest = s.presets.filter((p) => p.id !== id);
  const i = Math.max(0, Math.min(to, rest.length));
  return { ...s, presets: [...rest.slice(0, i), preset, ...rest.slice(i)] };
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

export const loadAllSettings = async (): Promise<{ key: AppKey; settings: AppSettings }[]> => {
  const all = await browser.storage.local.get(null);
  return Object.entries(all).flatMap(([raw, value]) => {
    const key = parseKey(raw);
    return key ? [{ key, settings: normalize(value as AppSettings) }] : [];
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
