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

  it("上限に達するまでは、集まった分をすべて使う", () => {
    const floor = new NoiseFloor({ windowSec: 300, minSec: 5 });
    // 30 秒の窓なら発話だけになるが、上限 300 秒なので最初の無音も残る
    fill(floor, -70, 40);
    fill(floor, -20, 200, 0.5);
    expect(floor.durationSec).toBeCloseTo(240);
    expect(floor.percentile(0.1)).toBe(-70);
    // 上限を超えたら古いものから捨てる
    fill(floor, -20, 101, 0.5);
    expect(floor.durationSec).toBeCloseTo(300, 0);
    expect(floor.percentile(0)).toBe(-20);
  });

  it("0.1 dB 刻みにそろえる。範囲外は端に寄せる", () => {
    const floor = new NoiseFloor({ windowSec: 30, minSec: 0.5 });
    fill(floor, -70.04, 1);
    expect(floor.percentile(0.5)).toBe(-70);
    floor.reset();
    fill(floor, -200, 1);
    expect(floor.percentile(0.5)).toBe(-100);
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
