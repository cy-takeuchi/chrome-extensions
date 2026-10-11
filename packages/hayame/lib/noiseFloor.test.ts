import { describe, expect, it } from "vitest";
import { NoiseFloor } from "./noiseFloor";

const fill = (floor: NoiseFloor, db: number, sec: number, step = 0.1) => {
  for (let t = 0; t < sec - 1e-9; t += step) floor.push(db, step);
};

describe("NoiseFloor", () => {
  it("minSec 集まるまでは推定しない", () => {
    const floor = new NoiseFloor({ windowSec: 30, minSec: 5 });
    fill(floor, -60, 4.9);
    expect(floor.percentile(0.1)).toBeNull();
    fill(floor, -60, 0.2);
    expect(floor.percentile(0.1)).toBe(-60);
  });

  it("下位 10% を返す", () => {
    const floor = new NoiseFloor({ windowSec: 30, minSec: 5 });
    // 2 秒の無音（-70）と 18 秒の発話（-20）
    fill(floor, -70, 2);
    fill(floor, -20, 18);
    expect(floor.percentile(0.05)).toBe(-70);
    expect(floor.percentile(0.15)).toBe(-20);
    expect(floor.percentile(0.9)).toBe(-20);
  });

  it("windowSec より古いものは捨てる", () => {
    const floor = new NoiseFloor({ windowSec: 30, minSec: 5 });
    fill(floor, -70, 10);
    fill(floor, -20, 30);
    expect(floor.durationSec).toBeCloseTo(30);
    expect(floor.percentile(0)).toBe(-20);
  });

  it("サンプル数ではなく、表す長さで重みを付ける", () => {
    const floor = new NoiseFloor({ windowSec: 30, minSec: 5 });
    // 発話 9 秒を 0.1 秒刻みで 90 回、無音 3 秒を倍速にして 0.3 秒刻みで 10 回
    fill(floor, -20, 9, 0.1);
    fill(floor, -70, 3, 0.3);
    // 回数なら無音は 10%（下位 10% は境目）、長さなら 25%
    expect(floor.percentile(0.2)).toBe(-70);
  });

  it("不正なサンプルは無視し、reset で空にする", () => {
    const floor = new NoiseFloor({ windowSec: 30, minSec: 1 });
    floor.push(Number.NaN, 1);
    floor.push(-30, 0);
    expect(floor.durationSec).toBe(0);
    fill(floor, -30, 2);
    floor.reset();
    expect(floor.percentile(0.1)).toBeNull();
  });
});
