/** playbackRate の比較に使う許容誤差。Chrome は代入した値をそのまま返すが念のため */
const EPSILON = 1e-3;

const near = (a: number, b: number) => Math.abs(a - b) < EPSILON;

/**
 * 基準速度（ユーザーが選んだ速度）を追う。
 *
 * 拡張が playbackRate を代入するときは apply() を通し、その値を覚えておく。
 * ratechange のときに playbackRate が覚えている値と違えば、拡張以外（YouTube の UI など）が
 * 変えたとみなして基準速度にする。ratechange は代入より後に非同期で届くので、
 * 「いつ代入したか」ではなく「いまの値が拡張の代入した値か」で見分ける。
 */
export class RateTracker {
  private applied: number | null = null;

  constructor(private baseRate: number) {}

  get base(): number {
    return this.baseRate;
  }

  /**
   * ソースが変わったときに呼ぶ。読み込みで playbackRate は ratechange なしに
   * defaultPlaybackRate へ戻るので、いまの値を基準速度として取り直す
   */
  resync(current: number): void {
    this.baseRate = current;
    this.applied = null;
  }

  /** 拡張が playbackRate を `rate` にする前に呼ぶ。代入が要らなければ false */
  apply(current: number, rate: number): boolean {
    this.applied = rate;
    return !near(current, rate);
  }

  /** ratechange で呼ぶ。拡張以外の変更なら基準速度を更新して true */
  onRateChange(observed: number): boolean {
    if (this.applied !== null && near(observed, this.applied)) return false;
    this.baseRate = observed;
    this.applied = null;
    return true;
  }

  /**
   * 手を離す。いまの速度が拡張の代入した値なら、戻すべき基準速度を返す（同じなら null）。
   * 以降の変更はすべて拡張以外によるものとして扱う
   */
  release(current: number): number | null {
    const owned = this.applied !== null && near(current, this.applied);
    this.applied = null;
    return owned && !near(current, this.baseRate) ? this.baseRate : null;
  }
}

/** 判定に応じた目標の速度。基準速度が無音速度より速ければ、無音でも基準速度のまま */
export const targetRate = (silent: boolean, base: number, silentRate: number): number =>
  silent ? Math.max(base, silentRate) : base;

/**
 * 速度の取り合いを見つける。拡張が速度を変えた直後に、拡張以外が何度も戻してくるなら、
 * 相手と取り合いになっているので諦める
 */
export class ConflictGuard {
  private times: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** 拡張以外による変更を記録する。windowMs の間に limit 回に達したら true */
  record(nowMs: number): boolean {
    this.times = [...this.times.filter((t) => nowMs - t < this.windowMs), nowMs];
    return this.times.length >= this.limit;
  }

  reset(): void {
    this.times = [];
  }
}
