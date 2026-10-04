/** kintone のレコード詳細画面を指す位置情報 */
export type RecordLocation = {
  origin: string;
  domain: string;
  /** ゲストスペースなら `/k/guest/{spaceId}`、通常は `/k` */
  apiPrefix: string;
  appId: string;
  recordId: string;
};

const PATH = /^\/k\/(?:guest\/(\d+)\/)?(\d+)\/show\/?$/;

/**
 * URL からレコード詳細画面の位置を取り出す。詳細画面でなければ `null`。
 *
 * - `/k/123/show#record=45`
 * - `/k/guest/7/123/show#record=45&mode=edit`
 */
export const parseRecordLocation = (href: string): RecordLocation | null => {
  const url = new URL(href);
  const match = PATH.exec(url.pathname);
  if (!match) return null;
  const [, spaceId, appId] = match;
  const recordId = new URLSearchParams(url.hash.slice(1)).get("record");
  if (!appId || !recordId || !/^\d+$/.test(recordId)) return null;
  return {
    origin: url.origin,
    domain: url.hostname,
    apiPrefix: spaceId ? `/k/guest/${spaceId}` : "/k",
    appId,
    recordId,
  };
};

export const recordUrl = (loc: RecordLocation): string =>
  `${loc.origin}${loc.apiPrefix}/${loc.appId}/show#record=${loc.recordId}`;
