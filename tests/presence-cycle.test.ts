// ==========================================
// 🧪 テスト: プレゼンス・サイクル
// ==========================================
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRESENCE_SEND_LEAD_MS,
  formatElapsedMinutes,
  nextPresenceSend,
  presenceCycleText,
} from "../src/presence-cycle.js";

test("formatElapsedMinutes: 分粒度で整形する", () => {
  assert.equal(formatElapsedMinutes(0), "0分");
  assert.equal(formatElapsedMinutes(26 * 60_000), "26分");
  assert.equal(formatElapsedMinutes(86 * 60_000), "1時間26分");
  assert.equal(formatElapsedMinutes(125 * 60_000), "2時間05分");
  assert.equal(formatElapsedMinutes(-5_000), "0分");
});

test("presenceCycleText: Unix 分の偶数位相は経過時間、奇数位相は現在時刻", () => {
  const startedAt = Date.parse("2026-11-27T10:00:00Z");
  // 2026-11-27T11:26:00Z は Unix 分で偶数位相 → 経過時間（1時間26分）
  const even = new Date("2026-11-27T11:26:00Z");
  assert.equal(Math.floor(even.getTime() / 60_000) % 2, 0);
  assert.equal(presenceCycleText("FakeTweetBot", startedAt, even), "FakeTweetBot | 起動して 1時間26分");
  // その1分後は奇数位相 → 現在時刻（JST 20:27）
  const odd = new Date("2026-11-27T11:27:00Z");
  assert.equal(Math.floor(odd.getTime() / 60_000) % 2, 1);
  assert.equal(presenceCycleText("FakeTweetBot", startedAt, odd), "FakeTweetBot | 現在時刻 20:27 JST");
});

test("nextPresenceSend: 次の分の境界の 200ms 前を返す", () => {
  const now = Date.parse("2026-11-27T11:26:30.000Z");
  const { sendAt, boundary } = nextPresenceSend(now);
  assert.equal(boundary, Date.parse("2026-11-27T11:27:00.000Z"));
  assert.equal(sendAt, boundary - PRESENCE_SEND_LEAD_MS);
});

test("nextPresenceSend: 送信予定時刻を過ぎていたら翌分へ前進する", () => {
  const now = Date.parse("2026-11-27T11:26:59.900Z");
  const { sendAt, boundary } = nextPresenceSend(now);
  assert.equal(boundary, Date.parse("2026-11-27T11:28:00.000Z"));
  assert.ok(sendAt > now);
});
