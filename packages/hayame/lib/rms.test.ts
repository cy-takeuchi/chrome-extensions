import { describe, expect, it } from "vitest";
import { MIN_DB, rmsDb } from "./rms";

describe("rmsDb", () => {
  it("振幅 1 の矩形波は 0 dBFS、0.5 なら約 -6 dBFS", () => {
    expect(rmsDb(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(0);
    expect(rmsDb(new Float32Array([0.5, -0.5]))).toBeCloseTo(-6.02, 1);
  });

  it("完全な無音や空は MIN_DB で止める", () => {
    expect(rmsDb(new Float32Array(128))).toBe(MIN_DB);
    expect(rmsDb(new Float32Array(0))).toBe(MIN_DB);
  });
});
