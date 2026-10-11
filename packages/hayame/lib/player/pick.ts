const area = (video: HTMLVideoElement) => {
  const { width, height } = video.getBoundingClientRect();
  return width * height;
};

const largest = (videos: HTMLVideoElement[]) =>
  videos.reduce<HTMLVideoElement | null>((a, b) => (a && area(a) >= area(b) ? a : b), null);

/**
 * 解析する <video> を選ぶ。再生中のものがあれば表示面積が最大のもの。
 * 無ければ、いま解析しているものを使い続け、それも無ければ面積が最大のもの
 */
export const pickVideo = (doc: Document, current: HTMLVideoElement | null) => {
  const videos = [...doc.querySelectorAll("video")];
  const playing = videos.filter((v) => !v.paused && !v.ended);
  if (playing.length > 0) return largest(playing);
  if (current?.isConnected) return current;
  return largest(videos.filter((v) => area(v) > 0));
};
