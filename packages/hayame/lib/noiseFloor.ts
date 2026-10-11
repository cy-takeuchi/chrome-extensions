import { MIN_DB } from "./rms";

type Sample = { bin: number; sec: number };

export type NoiseFloorOptions = {
  /** 統計に使う直近の長さの上限（動画の秒数）。上限までは集まった分をすべて使う */
  windowSec: number;
  /** これだけ集まるまでは推定しない（動画の秒数） */
  minSec: number;
};

/** 分布の刻み（dB） */
const BIN_DB = 0.1;
/** 分布に入れる上限（dBFS）。波形が 1 を少し超えると 0 dBFS を超えるので余裕を持たせる */
const MAX_DB = 20;
const BINS = Math.round((MAX_DB - MIN_DB) / BIN_DB) + 1;

const toBin = (db: number) =>
  Math.round((Math.min(MAX_DB, Math.max(MIN_DB, db)) - MIN_DB) / BIN_DB);
const toDb = (bin: number) => Math.round((MIN_DB + bin * BIN_DB) * 10) / 10;

/**
 * 直近の RMS の分布を持ち、分位点を返す。
 *
 * 各サンプルは、それが表す動画の長さ（間隔 × 再生速度）で重みを付ける。
 * 無音を倍速にするとその区間のサンプル数が減るので、回数で数えると分布が発話側に偏り、
 * しきい値が上がってさらに無音と判定しやすくなる、という自己強化が起きるため。
 *
 * 1 分でも 1,500 件ほどになり、40ms ごとに並べ替えると無駄が多いので、0.1 dB 刻みのヒストグラムで持つ
 */
export class NoiseFloor {
  private samples: Sample[] = [];
  /** 先頭の、まだ捨てていないサンプルの位置 */
  private head = 0;
  private hist = new Float64Array(BINS);
  private totalSec = 0;

  constructor(private readonly options: NoiseFloorOptions) {}

  push(db: number, sec: number): void {
    if (!(sec > 0) || !Number.isFinite(db)) return;
    const bin = toBin(db);
    this.samples.push({ bin, sec });
    this.hist[bin] = (this.hist[bin] ?? 0) + sec;
    this.totalSec += sec;
    // 古いものを、残りが windowSec を下回らない範囲で捨てる
    while (this.samples.length - this.head > 1) {
      const oldest = this.samples[this.head];
      if (!oldest || this.totalSec - oldest.sec < this.options.windowSec) break;
      this.hist[oldest.bin] = Math.max(0, (this.hist[oldest.bin] ?? 0) - oldest.sec);
      this.totalSec -= oldest.sec;
      this.head += 1;
    }
    // 捨てた分が溜まったら詰める
    if (this.head > 1024 && this.head * 2 > this.samples.length) {
      this.samples = this.samples.slice(this.head);
      this.head = 0;
    }
  }

  /** 集まっている長さ（動画の秒数） */
  get durationSec(): number {
    return this.totalSec;
  }

  /** 重み付きの分位点（0〜1）。集まりきっていなければ null */
  percentile(p: number): number | null {
    if (this.totalSec < this.options.minSec) return null;
    const target = p * this.totalSec;
    let acc = 0;
    let last: number | null = null;
    for (let bin = 0; bin < BINS; bin++) {
      const sec = this.hist[bin] ?? 0;
      if (sec <= 0) continue;
      acc += sec;
      last = bin;
      if (acc >= target) return toDb(bin);
    }
    return last === null ? null : toDb(last);
  }

  reset(): void {
    this.samples = [];
    this.head = 0;
    this.hist = new Float64Array(BINS);
    this.totalSec = 0;
  }
}
