import { loadCatalog } from "@/lib/actions";
import type { RecordLocation } from "@/lib/kintone/location";
import { loadAppSettings, type AppSettings } from "@/lib/settings";
import type { Catalog } from "@/lib/template/catalog";
import { useAsync } from "./useAsync";

export type AppData = { settings: AppSettings; catalog: Catalog };

/** アプリの保存済み設定とフォーム定義を読み込む */
export const useAppData = (loc: RecordLocation) =>
  useAsync<AppData>(async () => {
    const [settings, catalog] = await Promise.all([loadAppSettings(loc), loadCatalog(loc)]);
    return { settings, catalog };
  }, [loc.domain, loc.appId]);
