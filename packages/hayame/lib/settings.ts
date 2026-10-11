import { storage } from "wxt/utils/storage";

export type Settings = {
  enabled: boolean;
  /** 無音の間の再生速度 */
  silentRate: number;
  /** しきい値 = ノイズの底 + offsetDb */
  offsetDb: number;
  /** 無音と判定するまでの最短時間（ミリ秒、動画の時間） */
  minSilenceMs: number;
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  silentRate: 3,
  offsetDb: 6,
  minSilenceMs: 300,
};

/**
 * ポップアップの入力範囲。Chrome は 4 倍を超えると音声をミュートするので、無音速度は 4 倍まで
 */
export const LIMITS = {
  silentRate: { min: 1.25, max: 4, step: 0.25 },
  offsetDb: { min: 1, max: 20, step: 1 },
  minSilenceMs: { min: 100, max: 2000, step: 50 },
} as const;

const clamp = (value: unknown, { min, max }: { min: number; max: number }, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

/** 保存されている値を範囲内にそろえる。欠けている項目は既定値にする */
export const normalizeSettings = (raw: Partial<Settings> | null | undefined): Settings => ({
  enabled: typeof raw?.enabled === "boolean" ? raw.enabled : DEFAULT_SETTINGS.enabled,
  silentRate: clamp(raw?.silentRate, LIMITS.silentRate, DEFAULT_SETTINGS.silentRate),
  offsetDb: clamp(raw?.offsetDb, LIMITS.offsetDb, DEFAULT_SETTINGS.offsetDb),
  minSilenceMs: clamp(raw?.minSilenceMs, LIMITS.minSilenceMs, DEFAULT_SETTINGS.minSilenceMs),
});

const item = storage.defineItem<Partial<Settings>>("local:settings", { fallback: {} });

export const loadSettings = async (): Promise<Settings> => normalizeSettings(await item.getValue());

export const saveSettings = async (settings: Settings): Promise<void> =>
  item.setValue(normalizeSettings(settings));

export const watchSettings = (fn: (settings: Settings) => void): (() => void) =>
  item.watch((raw) => fn(normalizeSettings(raw)));
