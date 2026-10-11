import { LevelStats } from "./levelStats";
import { type Judgement, SilenceDetector } from "./silenceDetector";

/**
 * 声の大きさとみなす分位点。喋っている時間が直近の 5% 以上あれば、声の大きさになる
 */
const SPEECH_PERCENTILE = 0.95;
/**
 * 声の大きさよりこれだけ小さい音を「間」の候補にする。喋り続けている間の
 * 小さい音（語尾や弱い音節）は声の大きさから 20 dB ほど下まであるので、それより離す
 */
const PAUSE_GAP_DB = 25;
/** 間の候補が直近のこれだけを占めなければ、はっきりした間がないとみなす */
const MIN_PAUSE_SHARE = 0.03;
/** 統計を取る期間の上限（動画の秒数）。それまでは集まった分をすべて使う */
const STATS_WINDOW_SEC = 60;
/** 判定を始めるまでに集める長さ（動画の秒数） */
const MIN_SEC = 5;
/**
 * 音が取れているかは直近 30 秒で見る。ほかの統計と同じ長い期間で見ると、途中で音が
 * 取れなくなったときに気づくのが遅れ、その間ずっと無音と判定して倍速にしてしまうため
 */
const NO_SIGNAL_WINDOW_SEC = 30;
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
  /** 声と区別できる間がない（喋り続けている、BGM が続いているなど）。倍速にしない */
  | "no-pauses"
  | "ready";

export type JudgeResult = {
  phase: JudgePhase;
  /** 声の大きさ（直近の上位 5%） */
  speechDb: number | null;
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
 * RMS の列から発話／無音を決める。判定が確かでないときは必ず発話を返す。
 *
 * 直近の分布から声の大きさ（上位 5%）を測り、それより 25 dB 以上小さい音を間の候補にする。
 * 候補の中央値をノイズの底とし、しきい値 = ノイズの底 + オフセット とする。
 * 単に下位 10% をノイズの底にすると、喋り続ける動画では下位 10% が小さめの声になり、
 * しきい値が声の分布の中に入って、喋っている途中を無音と判定してしまうため。
 */
export class SilenceJudge {
  private readonly stats = new LevelStats({ windowSec: STATS_WINDOW_SEC, minSec: MIN_SEC });
  private readonly recent = new LevelStats({ windowSec: NO_SIGNAL_WINDOW_SEC, minSec: MIN_SEC });
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
    this.stats.push(db, sec);
    this.recent.push(db, sec);
    const speechDb = this.stats.percentile(SPEECH_PERCENTILE);
    if (speechDb === null) return this.idle("warming", null, null);
    const loud = this.recent.percentile(NO_SIGNAL_PERCENTILE);
    if (loud === null || loud < NO_SIGNAL_DB) return this.idle("no-signal", speechDb, null);
    const cutoffDb = speechDb - PAUSE_GAP_DB;
    const floorDb = this.stats.percentileBelow(0.5, cutoffDb);
    if (floorDb === null || (this.stats.shareBelow(cutoffDb) ?? 0) < MIN_PAUSE_SHARE)
      return this.idle("no-pauses", speechDb, floorDb);
    const thresholdDb = Math.min(floorDb + this.settings.offsetDb, cutoffDb);
    const judgement = this.detector.update(mediaMs, db, thresholdDb);
    return { phase: "ready", speechDb, floorDb, thresholdDb, judgement };
  }

  private idle(phase: JudgePhase, speechDb: number | null, floorDb: number | null): JudgeResult {
    this.detector.reset();
    return { phase, speechDb, floorDb, thresholdDb: null, judgement: "speech" };
  }

  /** 一時停止・シーク・バッファリングのとき。統計は残し、判定だけ発話に戻す */
  interrupt(): void {
    this.detector.reset();
  }

  /** 動画が変わったとき。統計も捨てる */
  reset(): void {
    this.stats.reset();
    this.recent.reset();
    this.detector.reset();
  }
}
