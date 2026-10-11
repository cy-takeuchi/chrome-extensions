import { describe, expect, it } from "vitest";
import { type LogEntry, SampleLog } from "./sampleLog";

const entry = (wallMs: number, patch: Partial<LogEntry> = {}): LogEntry => ({
  wallMs,
  mediaSec: wallMs / 1000,
  weightSec: 0.04,
  fullDb: -30,
  bandDb: -32.12345,
  speechDb: null,
  noiseDb: null,
  thresholdDb: null,
  phase: "warming",
  judgement: "speech",
  playbackRate: 1,
  baseRate: 1,
  note: null,
  ...patch,
});

describe("SampleLog", () => {
  it("上限を超えたら古いものから捨て、古い順に返す", () => {
    const log = new SampleLog(3);
    for (const t of [1, 2, 3, 4, 5]) log.push(entry(t));
    expect(log.entries().map((e) => e.wallMs)).toEqual([3, 4, 5]);
  });

  it("CSV にする。null は空、数値は小数 3 桁、カンマを含む文字列は引用符で囲む", () => {
    const log = new SampleLog(10);
    log.push(entry(40, { note: '一時停止中, "test"' }));
    const [header, row] = log.toCsv().split("\n");
    expect(header).toBe(
      "wallMs,mediaSec,weightSec,fullDb,bandDb,speechDb,noiseDb,thresholdDb,phase,judgement,playbackRate,baseRate,note",
    );
    expect(row).toBe('40,0.04,0.04,-30,-32.123,,,,warming,speech,1,1,"一時停止中, ""test"""');
  });
});
