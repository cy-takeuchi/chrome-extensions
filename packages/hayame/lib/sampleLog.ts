import type { JudgePhase } from "./judge";
import type { Judgement } from "./silenceDetector";

/** 1 回の計測。判定のロジックを調整するために CSV に書き出す */
export type LogEntry = {
  /** 計測した時刻（ミリ秒、performance.now） */
  wallMs: number;
  /** 動画の再生位置（秒） */
  mediaSec: number;
  /** 統計での重み（動画の秒数） */
  weightSec: number;
  /** 全帯域の RMS（dBFS）。測っていなければ null */
  fullDb: number | null;
  /** 声の帯域（300〜3400 Hz）の RMS（dBFS） */
  bandDb: number | null;
  speechDb: number | null;
  noiseDb: number | null;
  thresholdDb: number | null;
  phase: JudgePhase | null;
  judgement: Judgement;
  playbackRate: number;
  baseRate: number;
  /** 判定していない理由など */
  note: string | null;
};

const COLUMNS = [
  "wallMs",
  "mediaSec",
  "weightSec",
  "fullDb",
  "bandDb",
  "speechDb",
  "noiseDb",
  "thresholdDb",
  "phase",
  "judgement",
  "playbackRate",
  "baseRate",
  "note",
] as const satisfies readonly (keyof LogEntry)[];

const cell = (value: LogEntry[keyof LogEntry]) => {
  if (value === null) return "";
  if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

/** 直近の計測を、件数の上限まで持つ */
export class SampleLog {
  private items: LogEntry[] = [];
  private next = 0;

  constructor(private readonly capacity: number) {}

  push(entry: LogEntry): void {
    if (this.items.length < this.capacity) this.items.push(entry);
    else this.items[this.next] = entry;
    this.next = (this.next + 1) % this.capacity;
  }

  /** 古い順 */
  entries(): LogEntry[] {
    if (this.items.length < this.capacity) return [...this.items];
    return [...this.items.slice(this.next), ...this.items.slice(0, this.next)];
  }

  toCsv(): string {
    const rows = this.entries().map((e) => COLUMNS.map((c) => cell(e[c])).join(","));
    return [COLUMNS.join(","), ...rows].join("\n");
  }
}
