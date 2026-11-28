// ==========================================
// 🧪 テスト: 表示フォーマット
// ==========================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCount, formatTweetTimestamp } from "../src/tweet/format.js";

test("formatCount: 1万未満はカンマ区切り", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(1234), "1,234");
  assert.equal(formatCount(9999), "9,999");
});

test("formatCount: 1万以上は「万」で丸める", () => {
  assert.equal(formatCount(10_000), "1万");
  assert.equal(formatCount(12_345), "1.2万");
  assert.equal(formatCount(54_321), "5.4万");
  assert.equal(formatCount(123_456), "12万");
  assert.equal(formatCount(1_234_567), "123万");
});

test("formatCount: 1億以上は「億」、負数や NaN は 0", () => {
  assert.equal(formatCount(100_000_000), "1億");
  assert.equal(formatCount(123_456_789), "1.2億");
  assert.equal(formatCount(-5), "0");
  assert.equal(formatCount(Number.NaN), "0");
});

test("formatTweetTimestamp: 午前/午後つきの日本語表記になる", () => {
  // 入力は +09:00 で固定し、実行環境のタイムゾーンに依存しないようにする
  assert.equal(formatTweetTimestamp(new Date("2026-11-19T09:41:00+09:00")), "午前9:41 · 2026年11月19日");
  assert.equal(formatTweetTimestamp(new Date("2026-11-19T14:05:00+09:00")), "午後2:05 · 2026年11月19日");
  // 深夜0時台は Intl の日本語表記どおり「午前0:」になる
  assert.equal(formatTweetTimestamp(new Date("2026-01-03T00:07:00+09:00")), "午前0:07 · 2026年1月3日");
});
