import { describe, expect, it } from "vitest";
import { ConflictGuard, RateTracker, targetRate } from "./rateTracker";

/** <video> の playbackRate と、非同期に届く ratechange を真似る */
const fakeVideo = (initial: number) => {
  const video = { playbackRate: initial, pending: 0 };
  return {
    video,
    set: (rate: number) => {
      if (video.playbackRate === rate) return;
      video.playbackRate = rate;
      video.pending += 1;
    },
    /** 溜まっている ratechange を届ける。どれも届いた時点の playbackRate を読む */
    flush: (tracker: RateTracker) => {
      const external: boolean[] = [];
      for (; video.pending > 0; video.pending--)
        external.push(tracker.onRateChange(video.playbackRate));
      return external;
    },
  };
};

describe("RateTracker", () => {
  it("拡張の変更は基準速度にしない", () => {
    const tracker = new RateTracker(1);
    const v = fakeVideo(1);
    if (tracker.apply(v.video.playbackRate, 3)) v.set(3);
    expect(v.flush(tracker)).toEqual([false]);
    expect(tracker.base).toBe(1);
  });

  it("拡張以外の変更は基準速度にする", () => {
    const tracker = new RateTracker(1);
    const v = fakeVideo(1);
    v.set(1.5);
    expect(v.flush(tracker)).toEqual([true]);
    expect(tracker.base).toBe(1.5);
  });

  it("倍速中にユーザーが変えたら、ratechange が後から届いても基準速度になる", () => {
    const tracker = new RateTracker(1);
    const v = fakeVideo(1);
    if (tracker.apply(v.video.playbackRate, 3)) v.set(3);
    // 拡張の ratechange が届く前にユーザーが 1.5 にした
    v.set(1.5);
    expect(v.flush(tracker)).toEqual([true, true]);
    expect(tracker.base).toBe(1.5);
  });

  it("倍速 → 基準と続けて変えても、拡張の変更とみなす", () => {
    const tracker = new RateTracker(1.25);
    const v = fakeVideo(1.25);
    if (tracker.apply(v.video.playbackRate, 3)) v.set(3);
    if (tracker.apply(v.video.playbackRate, 1.25)) v.set(1.25);
    expect(v.flush(tracker)).toEqual([false, false]);
    expect(tracker.base).toBe(1.25);
  });

  it("resync で、ratechange なしに変わった値を基準速度にし、手を離す", () => {
    const tracker = new RateTracker(1.5);
    tracker.apply(1.5, 3);
    // ソースの読み込みで 1 に戻った（ratechange は来ない）
    tracker.resync(1);
    expect(tracker.base).toBe(1);
    expect(tracker.release(1)).toBeNull();
  });

  it("同じ値なら代入しない", () => {
    const tracker = new RateTracker(1);
    expect(tracker.apply(1, 1)).toBe(false);
  });

  it("release は、拡張の値のままなら基準速度を返す", () => {
    const tracker = new RateTracker(1.5);
    tracker.apply(1.5, 3);
    expect(tracker.release(3)).toBe(1.5);
    // 手を離した後の変更はすべて拡張以外
    expect(tracker.onRateChange(3)).toBe(true);
  });

  it("release は、ほかが変えた値や基準速度のままなら何も返さない", () => {
    const tracker = new RateTracker(1);
    tracker.apply(1, 3);
    expect(tracker.release(2)).toBeNull();
    tracker.apply(1, 1);
    expect(tracker.release(1)).toBeNull();
  });
});

describe("targetRate", () => {
  it("無音なら無音速度、発話なら基準速度。基準速度の方が速ければ無音でも基準速度", () => {
    expect(targetRate(true, 1, 3)).toBe(3);
    expect(targetRate(false, 1.5, 3)).toBe(1.5);
    expect(targetRate(true, 3.5, 3)).toBe(3.5);
  });
});

describe("ConflictGuard", () => {
  it("windowMs の間に limit 回に達したら true", () => {
    const guard = new ConflictGuard(3, 1000);
    expect(guard.record(0)).toBe(false);
    expect(guard.record(500)).toBe(false);
    expect(guard.record(900)).toBe(true);
  });

  it("古い記録は数えない", () => {
    const guard = new ConflictGuard(3, 1000);
    guard.record(0);
    guard.record(100);
    expect(guard.record(1200)).toBe(false);
    guard.reset();
    expect(guard.record(1300)).toBe(false);
  });
});
