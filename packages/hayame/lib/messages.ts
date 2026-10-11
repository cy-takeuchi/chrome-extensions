import type { Badge, Status } from "./status";

/** content script → background。バッジを変える */
export type BadgeMessage = { type: "badge"; badge: Badge };

/** ポップアップが content script に繋ぐポートの名前。繋いでいる間、状態を流す */
export const STATUS_PORT = "status";

/** content script → ポップアップ */
export type StatusMessage = { type: "status"; status: Status };
/** ポップアップ → content script。直近の計測を CSV で求める */
export type LogRequest = { type: "log" };
/** content script → ポップアップ */
export type LogMessage = { type: "log"; csv: string };

export const isBadgeMessage = (m: unknown): m is BadgeMessage =>
  typeof m === "object" && m !== null && (m as { type?: unknown }).type === "badge";
