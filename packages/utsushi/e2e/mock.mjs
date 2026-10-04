/** e2e 用の kintone のモック。アプリ 12 のレコード 34 */
export const ORIGIN = "https://example.cybozu.com";

const text = (code, label) => ({
  type: "SINGLE_LINE_TEXT",
  code,
  label,
  noLabel: false,
  required: false,
});

export const properties = {
  subject: text("subject", "件名"),
  body: {
    type: "RICH_TEXT",
    code: "body",
    label: "本文",
    noLabel: false,
    required: false,
    defaultValue: "",
  },
  billing: { type: "GROUP", code: "billing", label: "請求先", noLabel: false, openGroup: true },
  billing_address: text("billing_address", "住所"),
  lines: {
    type: "SUBTABLE",
    code: "lines",
    label: "明細",
    noLabel: false,
    fields: {
      item: text("item", "品名"),
      spec: {
        type: "FILE",
        code: "spec",
        label: "仕様書",
        noLabel: false,
        required: false,
        thumbnailSize: "150",
      },
    },
  },
  attachments: {
    type: "FILE",
    code: "attachments",
    label: "添付",
    noLabel: false,
    required: false,
    thumbnailSize: "150",
  },
  ステータス: { type: "STATUS", code: "ステータス", label: "ステータス", enabled: true },
};

export const layout = [
  { type: "ROW", fields: [{ type: "SINGLE_LINE_TEXT", code: "subject", size: { width: "200" } }] },
  {
    type: "ROW",
    fields: [{ type: "RICH_TEXT", code: "body", size: { width: "400", innerHeight: "100" } }],
  },
  {
    type: "GROUP",
    code: "billing",
    layout: [
      {
        type: "ROW",
        fields: [{ type: "SINGLE_LINE_TEXT", code: "billing_address", size: { width: "200" } }],
      },
    ],
  },
  {
    type: "SUBTABLE",
    code: "lines",
    fields: [
      { type: "SINGLE_LINE_TEXT", code: "item", size: { width: "200" } },
      { type: "FILE", code: "spec", size: { width: "200" } },
    ],
  },
  { type: "ROW", fields: [{ type: "FILE", code: "attachments", size: { width: "200" } }] },
];

const file = (fileKey, name) => ({ contentType: "text/plain", fileKey, name, size: "5" });

export const record = {
  subject: { type: "SINGLE_LINE_TEXT", value: "見積もり依頼" },
  body: { type: "RICH_TEXT", value: "<p>至急<b>対応</b></p>" },
  billing_address: { type: "SINGLE_LINE_TEXT", value: "東京都" },
  lines: {
    type: "SUBTABLE",
    value: [
      {
        id: "1",
        value: {
          item: { type: "SINGLE_LINE_TEXT", value: "りんご" },
          spec: { type: "FILE", value: [file("k-spec1", "仕様1.txt")] },
        },
      },
      {
        id: "2",
        value: {
          item: { type: "SINGLE_LINE_TEXT", value: "みかん" },
          spec: { type: "FILE", value: [] },
        },
      },
    ],
  },
  attachments: { type: "FILE", value: [file("k-att", "見積書.txt")] },
  ステータス: { type: "STATUS", value: "処理中" },
};

/** 12 件。API は 10 件ずつしか返さないのでページングを確かめられる */
export const comments = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  text: `コメント${i + 1}`,
  createdAt: `2026-10-01T0${Math.floor(i / 10)}:${String(i % 10).padStart(2, "0")}:00Z`,
  creator: { code: "sato", name: "佐藤" },
  mentions: [],
}));

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** @param {import("playwright").BrowserContext} context */
export const installMock = async (context, log) => {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/k/v1/")) {
      log.push(`${url.pathname}${url.search}`);
      if (req.headers()["x-requested-with"] !== "XMLHttpRequest")
        return json(route, { message: "X-Requested-With がありません" }, 401);
    }
    switch (url.pathname) {
      case "/k/12/show":
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><html><body><h1>kintone mock</h1></body></html>",
        });
      case "/k/v1/app/form/fields.json":
        return json(route, { properties, revision: "1" });
      case "/k/v1/app/form/layout.json":
        return json(route, { layout, revision: "1" });
      case "/k/v1/record.json":
        return json(route, { record });
      case "/k/v1/record/comments.json": {
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        const page = comments.slice(offset, offset + limit);
        return json(route, {
          comments: page,
          older: offset > 0,
          newer: offset + limit < comments.length,
        });
      }
      case "/k/v1/file.json":
        return route.fulfill({
          contentType: "text/plain",
          body: `file:${url.searchParams.get("fileKey")}`,
        });
      default:
        return route.fulfill({ status: 404, body: "not found" });
    }
  });
};
