import { describe, expect, it } from "vitest";
import { SilenceJudge } from "./judge";

const STEP_MS = 40;

/** 40ms ごとに db を流し、最後の結果を返す */
const feed = (judge: SilenceJudge, clock: { ms: number }, db: number, durationMs: number) => {
  let last = judge.process({ db, mediaMs: clock.ms, sec: STEP_MS / 1000 });
  for (let t = STEP_MS; t < durationMs; t += STEP_MS) {
    clock.ms += STEP_MS;
    last = judge.process({ db, mediaMs: clock.ms, sec: STEP_MS / 1000 });
  }
  clock.ms += STEP_MS;
  return last;
};

/** 間（-60）と発話（-20）を交互に流して統計を作る。発話で終わる */
const warm = (judge: SilenceJudge, clock: { ms: number }) => {
  for (let i = 0; i < 5; i++) {
    feed(judge, clock, -60, 400);
    feed(judge, clock, -20, 1600);
  }
};

describe("SilenceJudge", () => {
  it("統計が集まるまでは判定しない（発話のまま）", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    const result = feed(judge, { ms: 0 }, -60, 4000);
    expect(result).toMatchObject({ phase: "warming", judgement: "speech", thresholdDb: null });
  });

  it("しきい値 = ノイズの底 + オフセット で、最短時間を超えた無音だけを無音にする", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    const clock = { ms: 0 };
    warm(judge, clock);
    expect(feed(judge, clock, -60, 200)).toMatchObject({
      phase: "ready",
      floorDb: -60,
      thresholdDb: -54,
      judgement: "speech",
    });
    expect(feed(judge, clock, -60, 200).judgement).toBe("silent");
    expect(feed(judge, clock, -20, 40).judgement).toBe("speech");
  });

  it("オフセットを変えるとしきい値が変わる", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    const clock = { ms: 0 };
    warm(judge, clock);
    judge.setSettings({ offsetDb: 10, minSilenceMs: 300 });
    expect(feed(judge, clock, -53, 400)).toMatchObject({ thresholdDb: -50, judgement: "silent" });
  });

  it("直近ずっと音が無ければ、取り損ねているとみなして倍速にしない", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    expect(feed(judge, { ms: 0 }, -100, 10000)).toMatchObject({
      phase: "no-signal",
      judgement: "speech",
    });
  });

  it("途中で音が取れなくなったら、ノイズの底の期間より短い 30 秒で気づく", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    const clock = { ms: 0 };
    for (let i = 0; i < 6; i++) warm(judge, clock);
    expect(feed(judge, clock, -100, 31_000)).toMatchObject({
      phase: "no-signal",
      judgement: "speech",
    });
  });

  it("interrupt で判定だけ発話に戻し、統計は残す", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    const clock = { ms: 0 };
    warm(judge, clock);
    feed(judge, clock, -60, 400);
    judge.interrupt();
    expect(judge.process({ db: -60, mediaMs: clock.ms, sec: 0.04 })).toMatchObject({
      phase: "ready",
      judgement: "speech",
    });
  });

  it("reset で統計も捨てる", () => {
    const judge = new SilenceJudge({ offsetDb: 6, minSilenceMs: 300 });
    const clock = { ms: 0 };
    warm(judge, clock);
    judge.reset();
    expect(judge.process({ db: -60, mediaMs: clock.ms, sec: 0.04 }).phase).toBe("warming");
  });
});
