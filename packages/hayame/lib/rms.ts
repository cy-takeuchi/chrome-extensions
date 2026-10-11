/** 完全な無音（すべて 0）の RMS は -Infinity になるので、この値で止める */
export const MIN_DB = -100;

/** 波形（-1〜1）の RMS を dBFS で返す */
export const rmsDb = (samples: Float32Array): number => {
  if (samples.length === 0) return MIN_DB;
  let sum = 0;
  for (const s of samples) sum += s * s;
  const rms = Math.sqrt(sum / samples.length);
  return Math.max(MIN_DB, 20 * Math.log10(rms));
};
