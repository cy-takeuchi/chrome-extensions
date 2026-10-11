/**
 * scripting.executeScript で各フレームに注入する関数。注入されるので、外の変数や import は使えない。
 */

export type PipProbe = {
  /** このフレームの動画が PiP 中 */
  active: boolean;
  /** 再生中の動画のうち最大の表示面積。無ければ 0 */
  area: number;
};

/** フレームの状態を調べる */
export function probePictureInPicture(): PipProbe {
  const areas = [...document.querySelectorAll("video")]
    .filter((v) => !v.paused && !v.ended && !v.disablePictureInPicture)
    .map((v) => {
      const { width, height } = v.getBoundingClientRect();
      return width * height;
    });
  return { active: document.pictureInPictureElement !== null, area: Math.max(0, ...areas) };
}

/** PiP を開く／閉じる。失敗したら理由を返す */
export async function togglePictureInPicture(): Promise<string | null> {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return null;
    }
    const area = (v: HTMLVideoElement) => {
      const { width, height } = v.getBoundingClientRect();
      return width * height;
    };
    const video = [...document.querySelectorAll("video")]
      .filter((v) => !v.paused && !v.ended && !v.disablePictureInPicture)
      .sort((a, b) => area(b) - area(a))[0];
    if (!video) return "再生中の動画がありません";
    await video.requestPictureInPicture();
    return null;
  } catch (e) {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
}
