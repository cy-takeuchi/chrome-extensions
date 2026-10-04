/** background → content script */
export type Command = "copy-default" | "open-palette" | "download-files";
export type CommandMessage = { type: "command"; command: Command };

/** content script → background */
export type DownloadRequest = {
  type: "download";
  files: { url: string; filename: string }[];
};
export type DownloadResult = { ok: number; failed: string[] };

export const isCommand = (c: string): c is Command =>
  c === "copy-default" || c === "open-palette" || c === "download-files";
