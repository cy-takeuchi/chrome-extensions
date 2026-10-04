import type { Form } from "kisekae";
import type { RecordLocation } from "../../kintone/location";
import type { Comment, KintoneRecord } from "../../kintone/types";

export const location: RecordLocation = {
  origin: "https://example.cybozu.com",
  domain: "example.cybozu.com",
  apiPrefix: "/k",
  appId: "12",
  recordId: "34",
};

const base = { noLabel: false, required: false };

/** toForm の出力を手で組んだもの */
export const form = {
  fields: [
    { ...base, type: "SINGLE_LINE_TEXT", code: "subject", label: "件名", parent: null },
    { ...base, type: "RICH_TEXT", code: "body", label: "本文", parent: null },
    {
      ...base,
      type: "SINGLE_LINE_TEXT",
      code: "billing_address",
      label: "住所",
      parent: { type: "GROUP", code: "billing", label: "請求先" },
    },
    {
      ...base,
      type: "SINGLE_LINE_TEXT",
      code: "item",
      label: "品名",
      parent: { type: "SUBTABLE", code: "lines", label: "明細" },
    },
    {
      ...base,
      type: "NUMBER",
      code: "qty",
      label: "数量",
      unit: "個",
      unitPosition: "AFTER",
      parent: { type: "SUBTABLE", code: "lines", label: "明細" },
    },
    { ...base, type: "FILE", code: "attachments", label: "添付", parent: null },
  ],
  tables: [{ type: "SUBTABLE", code: "lines", label: "明細", noLabel: false }],
  groups: [{ type: "GROUP", code: "billing", label: "請求先", noLabel: false, openGroup: true }],
  elements: [],
  unplaced: [
    { type: "STATUS", code: "ステータス", label: "ステータス", enabled: true },
    { type: "CATEGORY", code: "カテゴリー", label: "カテゴリー", enabled: false },
  ],
} as unknown as Form;

export const record: KintoneRecord = {
  subject: { type: "SINGLE_LINE_TEXT", value: "見積もり依頼" },
  body: { type: "RICH_TEXT", value: "<p>至急<b>対応</b></p><ul><li>A</li><li>B</li></ul>" },
  billing_address: { type: "SINGLE_LINE_TEXT", value: "東京都" },
  lines: {
    type: "SUBTABLE",
    value: [
      {
        id: "1",
        value: {
          item: { type: "SINGLE_LINE_TEXT", value: "りんご" },
          qty: { type: "NUMBER", value: "3" },
        },
      },
      {
        id: "2",
        value: {
          item: { type: "SINGLE_LINE_TEXT", value: "みかん" },
          qty: { type: "NUMBER", value: "5" },
        },
      },
    ],
  },
  attachments: {
    type: "FILE",
    value: [{ contentType: "application/pdf", fileKey: "k1", name: "見積書.pdf", size: "100" }],
  },
  ステータス: { type: "STATUS", value: "処理中" },
};

export const comments: Comment[] = [
  {
    id: "1",
    text: "確認します",
    createdAt: "2026-10-01T00:00:00Z",
    creator: { code: "sato", name: "佐藤" },
    mentions: [],
  },
  {
    id: "2",
    text: "お願いします",
    createdAt: "2026-10-02T00:30:00Z",
    creator: { code: "suzuki", name: "鈴木" },
    mentions: [{ code: "sato", type: "USER" }],
  },
];
