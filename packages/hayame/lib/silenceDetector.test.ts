import { describe, expect, it } from "vitest";
import { SilenceDetector } from "./silenceDetector";

const detector = () => new SilenceDetector({ minSilenceMs: 300, hysteresisDb: 2 });

describe("SilenceDetector", () => {
  it("しきい値を下回る状態が最短時間続いたら無音にする", () => {
    const d = detector();
    expect(d.update(0, -60, -40)).toBe("speech");
    expect(d.update(200, -60, -40)).toBe("speech");
    expect(d.update(299, -60, -40)).toBe("speech");
    expect(d.update(300, -60, -40)).toBe("silent");
  });

  it("途中で一度でも上回ったら、最短時間を数え直す", () => {
    const d = detector();
    d.update(0, -60, -40);
    d.update(200, -30, -40);
    d.update(250, -60, -40);
    expect(d.update(500, -60, -40)).toBe("speech");
    expect(d.update(550, -60, -40)).toBe("silent");
  });

  it("無音から発話へは、しきい値以上になった時点ですぐ戻す", () => {
    const d = detector();
    d.update(0, -60, -40);
    d.update(300, -60, -40);
    expect(d.update(340, -40, -40)).toBe("speech");
  });

  it("ヒステリシス: 発話中は しきい値 − 2dB を下回らないと無音の候補にしない", () => {
    const d = detector();
    d.update(0, -41, -40);
    expect(d.update(1000, -41, -40)).toBe("speech");
    d.update(1000, -42.5, -40);
    expect(d.update(1300, -42.5, -40)).toBe("silent");
    // 無音中はしきい値未満なら無音のまま
    expect(d.update(1340, -41, -40)).toBe("silent");
  });

  it("reset で発話に戻り、候補も捨てる", () => {
    const d = detector();
    d.update(0, -60, -40);
    d.reset();
    expect(d.update(300, -60, -40)).toBe("speech");
    expect(d.judgement).toBe("speech");
  });

  it("最短時間は setOptions で変えられる", () => {
    const d = detector();
    d.setOptions({ minSilenceMs: 100, hysteresisDb: 2 });
    d.update(0, -60, -40);
    expect(d.update(100, -60, -40)).toBe("silent");
  });
});
