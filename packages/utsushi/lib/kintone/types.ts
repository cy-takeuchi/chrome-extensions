/** REST API が返すレコードの値。必要な形だけを書く */
export type Entity = { code: string; name: string };

export type FileValue = {
  contentType: string;
  fileKey: string;
  name: string;
  size: string;
};

export type SubtableRow = { id: string; value: Record<string, FieldValue> };

export type FieldValue =
  | { type: "SUBTABLE"; value: SubtableRow[] }
  | { type: "FILE"; value: FileValue[] }
  | { type: "CREATOR" | "MODIFIER"; value: Entity }
  | {
      type:
        | "USER_SELECT"
        | "ORGANIZATION_SELECT"
        | "GROUP_SELECT"
        | "STATUS_ASSIGNEE";
      value: Entity[];
    }
  | { type: "CHECK_BOX" | "MULTI_SELECT" | "CATEGORY"; value: string[] }
  | { type: string; value: string | null };

export type KintoneRecord = Record<string, FieldValue>;

export type Comment = {
  id: string;
  text: string;
  createdAt: string;
  creator: Entity;
  mentions: { code: string; type: "USER" | "GROUP" | "ORGANIZATION" }[];
};
