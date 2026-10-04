const pad = (n: number) => String(n).padStart(2, "0");

/** ISO 8601（UTC）を利用者のタイムゾーンの `YYYY-MM-DD HH:mm` にする */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
