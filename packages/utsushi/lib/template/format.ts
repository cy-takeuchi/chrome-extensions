import TurndownService from "turndown";
// @ts-expect-error 型定義が無い
import { gfm } from "turndown-plugin-gfm";
import type { Entity, FieldValue } from "../kintone/types";
import type { FieldMeta } from "./catalog";

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO 8601（UTC）を利用者のタイムゾーンの `YYYY-MM-DD HH:mm` にする */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

let turndown: TurndownService | undefined;

/** リッチエディターの HTML を Markdown にする */
export const htmlToMarkdown = (html: string): string => {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
    });
    turndown.use(gfm);
  }
  return turndown.turndown(html).trim();
};

const names = (entities: Entity[]) => entities.map((e) => e.name).join(", ");

const withUnit = (value: string, meta: FieldMeta) => {
  if (value === "" || !meta.unit) return value;
  return meta.unitPosition === "BEFORE"
    ? `${meta.unit}${value}`
    : `${value}${meta.unit}`;
};

/**
 * フィールドの値を差し込み用の文字列にする。
 * 値が無い（閲覧権限が無くて API が返さなかった場合を含む）ときは空文字。
 */
export const formatValue = (
  fv: FieldValue | undefined,
  meta: FieldMeta,
): string => {
  if (!fv || fv.value === null || fv.value === undefined) return "";
  switch (fv.type) {
    case "SUBTABLE":
      return "";
    case "FILE":
      return (fv.value as { name: string }[]).map((f) => f.name).join(", ");
    case "CREATOR":
    case "MODIFIER":
      return (fv.value as Entity).name;
    case "USER_SELECT":
    case "ORGANIZATION_SELECT":
    case "GROUP_SELECT":
    case "STATUS_ASSIGNEE":
      return names(fv.value as Entity[]);
    case "CHECK_BOX":
    case "MULTI_SELECT":
    case "CATEGORY":
      return (fv.value as string[]).join(", ");
    case "DATETIME":
    case "CREATED_TIME":
    case "UPDATED_TIME":
      return fv.value === "" ? "" : formatDateTime(fv.value as string);
    case "RICH_TEXT":
      return htmlToMarkdown(fv.value as string);
    case "CALC":
      if (meta.calcFormat === "DATETIME" && fv.value !== "")
        return formatDateTime(fv.value as string);
      return withUnit(fv.value as string, meta);
    case "NUMBER":
      return withUnit(fv.value as string, meta);
    default:
      return typeof fv.value === "string" ? fv.value : "";
  }
};
