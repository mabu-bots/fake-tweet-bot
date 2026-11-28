// ==========================================
// 🔢 表示フォーマット（純ロジック）
// ==========================================
// 📝 カウントの省略表記と、ツイート風の時刻表示を組み立てる。
// canvas に依存しない純ロジックとして切り出してある。

// ==========================================
// 🔢 カウント表記
// ==========================================
// 📝 X の日本語表示に寄せた省略表記: 1万未満はカンマ区切り、
// 1万以上は「万」、1億以上は「億」で丸める。
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  const v = Math.floor(n);
  if (v < 10_000) return v.toLocaleString("ja-JP");
  if (v < 100_000_000) {
    const man = v / 10_000;
    // 10万以上は整数、未満は小数1桁（末尾の .0 は落とす）。Intl の compact 表記と同じ丸め
    const s =
      man >= 10 ? String(Math.round(man)) : (Math.round(man * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return `${s}万`;
  }
  const oku = v / 100_000_000;
  const s =
    oku >= 10 ? String(Math.round(oku)) : (Math.round(oku * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return `${s}億`;
}

// ==========================================
// 🕐 時刻表示
// ==========================================
// 📝 「午後2:34 · 2026年11月19日」形式。タイムゾーンは Asia/Tokyo に固定する。
export function formatTweetTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dayPeriod = get("dayPeriod"); // 午前 / 午後
  const hour = get("hour");
  const minute = get("minute");
  return `${dayPeriod}${hour}:${minute} · ${get("year")}年${get("month")}月${get("day")}日`;
}
