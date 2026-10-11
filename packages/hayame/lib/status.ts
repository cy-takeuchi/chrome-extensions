import type { JudgePhase } from "./judge";
import type { Judgement } from "./silenceDetector";

export type Analysis =
  /** 拡張が OFF */
  | "off"
  /** 対象の動画がない */
  | "idle"
  /** 解析している（一時停止中なども含む） */
  | "ok"
  /** 音声が取れない。倍速にしない */
  | "unavailable";

/** content script の状態。ポップアップのデバッグ表示とバッジに使う */
export type Status = {
  analysis: Analysis;
  /** unavailable の理由や、判定していない理由 */
  note: string | null;
  phase: JudgePhase | null;
  rmsDb: number | null;
  floorDb: number | null;
  thresholdDb: number | null;
  judgement: Judgement | null;
  playbackRate: number | null;
  baseRate: number | null;
};

export const emptyStatus = (analysis: Analysis, note: string | null = null): Status => ({
  analysis,
  note,
  phase: null,
  rmsDb: null,
  floorDb: null,
  thresholdDb: null,
  judgement: null,
  playbackRate: null,
  baseRate: null,
});

export type Badge = { text: string; color: string; title: string };

const formatRate = (rate: number) => {
  const text = `${Number(rate.toFixed(2))}x`;
  // バッジは 4 文字まで
  return text.length <= 4 ? text : text.slice(0, -1);
};

export const badgeFor = (status: Status): Badge => {
  switch (status.analysis) {
    case "off":
      return { text: "OFF", color: "#6b7280", title: "hayame: OFF" };
    case "idle":
      return { text: "", color: "#6b7280", title: "hayame: 動画がありません" };
    case "unavailable":
      return {
        text: "!",
        color: "#dc2626",
        title: `hayame: 解析できません${status.note ? `（${status.note}）` : ""}`,
      };
    case "ok":
      if (status.judgement === "silent" && status.playbackRate !== null)
        return {
          text: formatRate(status.playbackRate),
          color: "#2563eb",
          title: "hayame: 無音を倍速中",
        };
      return { text: "ON", color: "#16a34a", title: "hayame: 動作中" };
  }
};
