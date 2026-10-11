type Sample = { db: number; sec: number };

export type NoiseFloorOptions = {
  /** 統計に使う直近の長さ（動画の秒数） */
  windowSec: number;
  /** これだけ集まるまでは推定しない（動画の秒数） */
  minSec: number;
};

/**
 * 直近の RMS の分布を持ち、分位点を返す。
 *
 * 各サンプルは、それが表す動画の長さ（間隔 × 再生速度）で重みを付ける。
 * 無音を倍速にするとその区間のサンプル数が減るので、回数で数えると分布が発話側に偏り、
 * しきい値が上がってさらに無音と判定しやすくなる、という自己強化が起きるため。
 */
export class NoiseFloor {
  private samples: Sample[] = [];
  private totalSec = 0;

  constructor(private readonly options: NoiseFloorOptions) {}

  push(db: number, sec: number): void {
    if (!(sec > 0) || !Number.isFinite(db)) return;
    this.samples.push({ db, sec });
    this.totalSec += sec;
    // 古いものを、残りが windowSec を下回らない範囲で捨てる
    while (this.samples.length > 1) {
      const oldest = this.samples[0];
      if (!oldest || this.totalSec - oldest.sec < this.options.windowSec) break;
      this.samples.shift();
      this.totalSec -= oldest.sec;
    }
  }

  /** 集まっている長さ（動画の秒数） */
  get durationSec(): number {
    return this.totalSec;
  }

  /** 重み付きの分位点（0〜1）。集まりきっていなければ null */
  percentile(p: number): number | null {
    if (this.totalSec < this.options.minSec) return null;
    const sorted = [...this.samples].sort((a, b) => a.db - b.db);
    const target = p * this.totalSec;
    let acc = 0;
    for (const s of sorted) {
      acc += s.sec;
      if (acc >= target) return s.db;
    }
    return sorted.at(-1)?.db ?? null;
  }

  reset(): void {
    this.samples = [];
    this.totalSec = 0;
  }
}
