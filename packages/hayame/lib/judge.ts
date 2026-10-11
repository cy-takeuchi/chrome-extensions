import { NoiseFloor } from "./noiseFloor";
import { type Judgement, SilenceDetector } from "./silenceDetector";

/** ノイズの底とみなす分位点 */
const FLOOR_PERCENTILE = 0.1;
/** 直近の上位 10% がこれより小さければ、音が取れていないとみなす（dBFS） */
const NO_SIGNAL_DB = -80;
const NO_SIGNAL_PERCENTILE = 0.9;
const HYSTERESIS_DB = 2;

export type JudgeSettings = {
  /** しきい値 = ノイズの底 + offsetDb */
  offsetDb: number;
  minSilenceMs: number;
};

export type JudgePhase =
  /** 統計が集まりきっていない */
  | "warming"
  /** 直近ずっと音が無い。取り損ねている可能性があるので倍速にしない */
  | "no-signal"
  | "ready";

export type JudgeResult = {
  phase: JudgePhase;
  floorDb: number | null;
  thresholdDb: number | null;
  judgement: Judgement;
};

export type Sample = {
  /** RMS（dBFS） */
  db: number;
  /** 動画の再生位置（ミリ秒）。無音が続いた長さを測る */
  mediaMs: number;
  /** このサンプルが表す動画の長さ（秒）。統計の重みにする */
  sec: number;
};

/**
 * RMS の列から発話／無音を決める。ノイズの底を直近の分布から推定し、
 * しきい値 = ノイズの底 + オフセット とする。判定が確かでないときは必ず発話を返す。
 */
export class SilenceJudge {
  private readonly floor = new NoiseFloor({ windowSec: 30, minSec: 5 });
  private readonly detector: SilenceDetector;

  constructor(private settings: JudgeSettings) {
    this.detector = new SilenceDetector(this.detectorOptions());
  }

  private detectorOptions() {
    return { minSilenceMs: this.settings.minSilenceMs, hysteresisDb: HYSTERESIS_DB };
  }

  setSettings(settings: JudgeSettings): void {
    this.settings = settings;
    this.detector.setOptions(this.detectorOptions());
  }

  process({ db, mediaMs, sec }: Sample): JudgeResult {
    this.floor.push(db, sec);
    const floorDb = this.floor.percentile(FLOOR_PERCENTILE);
    if (floorDb === null) return this.idle("warming", null);
    const loud = this.floor.percentile(NO_SIGNAL_PERCENTILE);
    if (loud === null || loud < NO_SIGNAL_DB) return this.idle("no-signal", floorDb);
    const thresholdDb = floorDb + this.settings.offsetDb;
    const judgement = this.detector.update(mediaMs, db, thresholdDb);
    return { phase: "ready", floorDb, thresholdDb, judgement };
  }

  private idle(phase: JudgePhase, floorDb: number | null): JudgeResult {
    this.detector.reset();
    return { phase, floorDb, thresholdDb: null, judgement: "speech" };
  }

  /** 一時停止・シーク・バッファリングのとき。統計は残し、判定だけ発話に戻す */
  interrupt(): void {
    this.detector.reset();
  }

  /** 動画が変わったとき。統計も捨てる */
  reset(): void {
    this.floor.reset();
    this.detector.reset();
  }
}
