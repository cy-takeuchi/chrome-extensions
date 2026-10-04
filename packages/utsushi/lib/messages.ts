/** manifest.json の commands と同じ名前 */
const COMMANDS = ["copy-default", "open-palette", "download-files"] as const;

/** background → content script */
export type Command = (typeof COMMANDS)[number];
export type CommandMessage = { type: "command"; command: Command };

/** content script → background */
export type DownloadRequest = {
  type: "download";
  files: { url: string; filename: string }[];
};
export type DownloadResult = { ok: number; failed: string[] };

export const isCommand = (c: string): c is Command => (COMMANDS as readonly string[]).includes(c);
