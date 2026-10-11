export type Judgement = "speech" | "silent";

export type SilenceDetectorOptions = {
  /** しきい値を下回る状態がこれだけ続いたら無音にする（ミリ秒） */
  minSilenceMs: number;
  /**
   * 発話中は「しきい値 − hysteresisDb」を下回ったときだけ無音の候補として数える。
   * 無音から発話へは、しきい値以上になった時点ですぐ戻す（戻りは遅らせない）
   */
  hysteresisDb: number;
};

/** RMS としきい値から、発話か無音かを決める状態機械 */
export class SilenceDetector {
  private state: Judgement = "speech";
  /** 無音の候補になった時刻。候補でなければ null */
  private quietSince: number | null = null;

  constructor(private options: SilenceDetectorOptions) {}

  setOptions(options: SilenceDetectorOptions): void {
    this.options = options;
  }

  get judgement(): Judgement {
    return this.state;
  }

  /** `nowMs` は単調に増える時刻。戻ったときは reset() してから渡す */
  update(nowMs: number, db: number, thresholdDb: number): Judgement {
    if (this.state === "silent") {
      if (db >= thresholdDb) this.reset();
      return this.state;
    }
    if (db < thresholdDb - this.options.hysteresisDb) {
      this.quietSince ??= nowMs;
      if (nowMs - this.quietSince >= this.options.minSilenceMs) this.state = "silent";
    } else {
      this.quietSince = null;
    }
    return this.state;
  }

  /** 発話に戻し、無音の候補も捨てる */
  reset(): void {
    this.state = "speech";
    this.quietSince = null;
  }
}
