import { type Form, type Layout, type Properties, toForm } from "kisekae";
import type { RecordLocation } from "./location";
import type { Comment, KintoneRecord } from "./types";

export class KintoneApiError extends Error {
  override readonly name = "KintoneApiError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const apiUrl = (
  loc: RecordLocation,
  path: string,
  params: Record<string, string | number>,
): string => {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return `${loc.origin}${loc.apiPrefix}/v1/${path}?${query}`;
};

/** ログイン中のセッションで GET する。`X-Requested-With` がセッション認証の合図 */
const get = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body.message === "string" ? body.message : `HTTP ${res.status}`;
    throw new KintoneApiError(message, res.status);
  }
  return body as T;
};

export const getRecord = async (loc: RecordLocation): Promise<KintoneRecord> => {
  const { record } = await get<{ record: KintoneRecord }>(
    apiUrl(loc, "record.json", { app: loc.appId, id: loc.recordId }),
  );
  return record;
};

/** コメントを全件、古い順で取る。API は 1 回 10 件まで */
export const getAllComments = async (loc: RecordLocation): Promise<Comment[]> => {
  const limit = 10;
  const all: Comment[] = [];
  for (let offset = 0; ; offset += limit) {
    const { comments, newer } = await get<{
      comments: Comment[];
      newer: boolean;
    }>(
      apiUrl(loc, "record/comments.json", {
        app: loc.appId,
        record: loc.recordId,
        order: "asc",
        offset,
        limit,
      }),
    );
    all.push(...comments);
    if (!newer || comments.length < limit) return all;
  }
};

export const getForm = async (loc: RecordLocation): Promise<Form> => {
  const [fields, layout] = await Promise.all([
    get<{ properties: Properties }>(
      apiUrl(loc, "app/form/fields.json", { app: loc.appId, lang: "user" }),
    ),
    get<{ layout: Layout.OneOf[] }>(apiUrl(loc, "app/form/layout.json", { app: loc.appId })),
  ]);
  return toForm(fields.properties, layout.layout);
};

export const fileUrl = (loc: RecordLocation, fileKey: string): string =>
  apiUrl(loc, "file.json", { fileKey });
