import { SilenceJudge } from "../judge";
import { ConflictGuard, RateTracker, targetRate } from "../rateTracker";
import { rmsDb } from "../rms";
import type { LogEntry } from "../sampleLog";
import type { Settings } from "../settings";
import { emptyStatus, type Status } from "../status";

declare global {
  interface HTMLMediaElement {
    /** Media Capture from DOM Elements。lib.dom に無いので足す */
    captureStream(): MediaStream;
  }
}

/** RMS を測る間隔 */
const TICK_MS = 40;
/** 判定を止めていた後、これだけは測らない。止まっていた間の無音を統計に入れないため */
const SETTLE_MS = 200;
/** 1 回のサンプルの重みの上限（秒）。タイマーが間引かれても統計が偏りすぎないように */
const MAX_SAMPLE_SEC = 0.5;
/** 声の主な帯域（Hz）。これより低い音（空調・風・ハム）と高い音（ヒスノイズ）を除いて測る */
const VOICE_LOW_HZ = 300;
const VOICE_HIGH_HZ = 3400;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 判定しない理由。判定してよければ null */
const pausedReason = (video: HTMLVideoElement): string | null => {
  if (video.ended) return "再生終了";
  if (video.paused) return "一時停止中";
  if (video.seeking) return "シーク中";
  if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return "バッファリング中";
  if (video.muted || video.volume === 0) return "ミュート中";
  return null;
};

/**
 * 1 つの <video> の音声を captureStream() で取り、無音の間だけ速度を上げる。
 *
 * 再生音には一切触らない（createMediaElementSource は使わない）。
 * 音声が取れないときは倍速にせず、基準速度のまま理由を status に出す。
 */
export class VideoSession {
  private readonly abort = new AbortController();
  private readonly analyser: AnalyserNode;
  /** 声の帯域だけを通した音を測る。解析専用の経路なので、再生音には影響しない */
  private readonly voiceFilters: BiquadFilterNode[];
  private readonly voiceAnalyser: AnalyserNode;
  private readonly buffer: Float32Array<ArrayBuffer>;
  private readonly judge: SilenceJudge;
  private readonly rate: RateTracker;
  private readonly conflict = new ConflictGuard(5, 2000);
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private trackId: string | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastTick: number | null = null;
  private settleUntil = 0;
  private silent = false;
  /** 解析できない理由 */
  private failure: string | null = null;
  private current: Status;

  constructor(
    readonly video: HTMLVideoElement,
    private readonly audio: AudioContext,
    private settings: Settings,
    private readonly onSample: (entry: LogEntry) => void = () => {},
  ) {
    this.analyser = audio.createAnalyser();
    this.analyser.fftSize = 2048;
    this.voiceAnalyser = audio.createAnalyser();
    this.voiceAnalyser.fftSize = 2048;
    this.voiceFilters = [
      new BiquadFilterNode(audio, { type: "highpass", frequency: VOICE_LOW_HZ }),
      new BiquadFilterNode(audio, { type: "lowpass", frequency: VOICE_HIGH_HZ }),
    ];
    const [highpass, lowpass] = this.voiceFilters;
    highpass?.connect(lowpass as BiquadFilterNode).connect(this.voiceAnalyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.judge = new SilenceJudge(settings);
    this.rate = new RateTracker(video.playbackRate);
    this.current = emptyStatus("ok");
  }

  start(): void {
    const { signal } = this.abort;
    const on = (type: string, fn: () => void) => this.video.addEventListener(type, fn, { signal });
    on("ratechange", () => this.onRateChange());
    // SPA で同じ <video> のままソースが変わる。統計を捨て、音声トラックを取り直す
    for (const type of ["loadstart", "emptied", "loadedmetadata"])
      on(type, () => {
        this.judge.reset();
        this.conflict.reset();
        this.silent = false;
        this.rate.resync(this.video.playbackRate);
        this.connect();
      });
    for (const type of ["pause", "seeking", "waiting", "volumechange"])
      on(type, () => this.interrupt());

    try {
      this.stream = this.video.captureStream();
    } catch (e) {
      this.failure = `captureStream に失敗: ${errorMessage(e)}`;
      this.update(this.failure);
      return;
    }
    this.stream.addEventListener("addtrack", (e) => this.connect(e.track), { signal });
    this.stream.addEventListener("removetrack", () => this.connect(), { signal });
    this.connect();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.abort.abort();
    this.source?.disconnect();
    this.analyser.disconnect();
    for (const filter of this.voiceFilters) filter.disconnect();
    this.voiceAnalyser.disconnect();
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.silent = false;
    const base = this.rate.release(this.video.playbackRate);
    if (base !== null) this.video.playbackRate = base;
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
    this.judge.setSettings(settings);
    this.applyRate();
  }

  get status(): Status {
    return this.current;
  }

  /**
   * いまの音声トラックを解析につなぐ。トラックが変わっていなければ何もしない。
   *
   * ソースが変わると、Chrome は新しいトラックを addtrack で足すが、古いトラックは
   * 無音のまま live で残る。足されたトラックか、最後に足された live のトラックを使う
   */
  private connect(added?: MediaStreamTrack): void {
    if (!this.stream) return;
    const track =
      added?.kind === "audio" && added.readyState === "live"
        ? added
        : this.stream.getAudioTracks().findLast((t) => t.readyState === "live");
    if (track?.id === this.trackId) return;
    this.source?.disconnect();
    this.source = null;
    // 古いトラックは止めて、次から選ばれないようにする（再生音には影響しない）
    for (const old of this.stream.getAudioTracks()) if (old !== track) old.stop();
    this.trackId = null;
    if (!track) {
      this.failure = "音声トラックがありません";
      this.setSilent(false);
      return;
    }
    try {
      this.source = this.audio.createMediaStreamSource(new MediaStream([track]));
      this.source.connect(this.analyser);
      if (this.voiceFilters[0]) this.source.connect(this.voiceFilters[0]);
      this.trackId = track.id;
      this.failure = null;
    } catch (e) {
      this.failure = `音声をつなげません: ${errorMessage(e)}`;
      this.setSilent(false);
    }
  }

  private interrupt(): void {
    this.judge.interrupt();
    this.setSilent(false);
  }

  private tick(): void {
    const now = performance.now();
    const elapsed = this.lastTick === null ? TICK_MS : now - this.lastTick;
    this.lastTick = now;

    const failure =
      this.failure ??
      (this.audio.state === "running" ? null : `AudioContext が ${this.audio.state}`);
    const weightSec = Math.min(MAX_SAMPLE_SEC, (elapsed / 1000) * this.video.playbackRate);
    if (failure) {
      this.interrupt();
      this.update(failure);
      this.log(now, weightSec, null, null, failure);
      return;
    }
    const paused = pausedReason(this.video);
    if (paused) {
      this.interrupt();
      this.settleUntil = now + SETTLE_MS;
      this.update(paused);
      this.log(now, weightSec, null, null, paused);
      return;
    }
    this.analyser.getFloatTimeDomainData(this.buffer);
    const db = rmsDb(this.buffer);
    this.voiceAnalyser.getFloatTimeDomainData(this.buffer);
    const voiceDb = rmsDb(this.buffer);
    if (now < this.settleUntil) {
      this.update(null, { db });
      this.log(now, weightSec, db, voiceDb, "再開直後");
      return;
    }
    const result = this.judge.process({
      db,
      mediaMs: this.video.currentTime * 1000,
      sec: weightSec,
    });
    this.setSilent(result.judgement === "silent");
    const note =
      result.phase === "warming"
        ? "統計を集めています"
        : result.phase === "no-signal"
          ? "音が取れていません"
          : result.phase === "no-pauses"
            ? "声と区別できる間がありません"
            : null;
    this.update(note, { db, ...result });
    this.log(now, weightSec, db, voiceDb, note, result);
  }

  private log(
    wallMs: number,
    weightSec: number,
    fullDb: number | null,
    bandDb: number | null,
    note: string | null,
    result?: {
      phase: LogEntry["phase"];
      speechDb: number | null;
      floorDb: number | null;
      thresholdDb: number | null;
    },
  ): void {
    this.onSample({
      wallMs,
      mediaSec: this.video.currentTime,
      weightSec,
      fullDb,
      bandDb,
      speechDb: result?.speechDb ?? null,
      noiseDb: result?.floorDb ?? null,
      thresholdDb: result?.thresholdDb ?? null,
      phase: result?.phase ?? null,
      judgement: this.silent ? "silent" : "speech",
      playbackRate: this.video.playbackRate,
      baseRate: this.rate.base,
      note,
    });
  }

  private setSilent(silent: boolean): void {
    if (this.silent === silent) return;
    this.silent = silent;
    this.applyRate();
  }

  private applyRate(): void {
    const target = targetRate(this.silent, this.rate.base, this.settings.silentRate);
    if (this.rate.apply(this.video.playbackRate, target)) this.video.playbackRate = target;
  }

  private onRateChange(): void {
    if (!this.rate.onRateChange(this.video.playbackRate)) return;
    // 無音で倍速にしている間に何度も戻されるなら、取り合いになっている
    if (this.silent && this.conflict.record(performance.now())) {
      this.failure = "速度がほかから戻されます";
      this.silent = false;
      this.judge.interrupt();
      return;
    }
    if (this.silent) this.applyRate();
  }

  private update(
    note: string | null = null,
    values: Partial<{
      db: number;
      phase: Status["phase"];
      speechDb: number | null;
      floorDb: number | null;
      thresholdDb: number | null;
      judgement: Status["judgement"];
    }> = {},
  ): void {
    this.current = {
      analysis: this.failure || this.audio.state !== "running" ? "unavailable" : "ok",
      note,
      phase: values.phase ?? null,
      rmsDb: values.db ?? null,
      speechDb: values.speechDb ?? null,
      floorDb: values.floorDb ?? null,
      thresholdDb: values.thresholdDb ?? null,
      judgement: values.judgement ?? (this.silent ? "silent" : "speech"),
      playbackRate: this.video.playbackRate,
      baseRate: this.rate.base,
    };
  }
}
