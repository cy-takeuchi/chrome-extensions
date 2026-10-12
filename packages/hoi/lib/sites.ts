/** hoi が動くサイト。content script の matches と manifest の host_permissions と同じ */
export const SITE_MATCHES = ["https://*.cybozu.com/*", "https://*.kintone.com/*"];

/**
 * hoi が動くサイトの URL か。tabs 権限は無いが、host_permissions のサイトのタブなら
 * URL が読める。それ以外のタブの URL は undefined になる
 */
export const isSupportedUrl = (url: string | undefined): boolean =>
  url !== undefined && /^https:\/\/([^/]+\.)?(cybozu|kintone)\.com\//.test(url);
