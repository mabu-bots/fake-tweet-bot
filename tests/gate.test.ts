// ==========================================
// 🧪 テスト: 実行制限（クールダウン・同時実行数）
// ==========================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { ExecutionGate } from "../src/gate.js";

test("初回は実行でき、クールダウン中は同じユーザーを弾く", () => {
  const gate = new ExecutionGate(10_000, 2);
  assert.deepEqual(gate.acquire("user1", 1_000), { ok: true });
  gate.release();
  const blocked = gate.acquire("user1", 5_000);
  assert.equal(blocked.ok, false);
  if (!blocked.ok && blocked.reason === "cooldown") {
    assert.equal(blocked.retryAfterMs, 6_000);
  } else {
    assert.fail("cooldown で弾かれること");
  }
});

test("クールダウンはユーザー単位で、経過後は再び実行できる", () => {
  const gate = new ExecutionGate(10_000, 2);
  assert.equal(gate.acquire("user1", 0).ok, true);
  gate.release();
  // 別ユーザーは影響を受けない
  assert.equal(gate.acquire("user2", 1_000).ok, true);
  gate.release();
  // クールダウン経過後は同じユーザーも実行できる
  assert.equal(gate.acquire("user1", 10_000).ok, true);
  gate.release();
});

test("同時実行数が上限に達したら busy で弾き、release で空く", () => {
  const gate = new ExecutionGate(10_000, 2);
  assert.equal(gate.acquire("user1", 0).ok, true);
  assert.equal(gate.acquire("user2", 0).ok, true);
  assert.equal(gate.activeCount, 2);
  const busy = gate.acquire("user3", 0);
  assert.deepEqual(busy, { ok: false, reason: "busy" });
  gate.release();
  assert.equal(gate.acquire("user3", 0).ok, true);
});

test("busy で弾かれた場合はクールダウンを消費しない", () => {
  const gate = new ExecutionGate(10_000, 1);
  assert.equal(gate.acquire("user1", 0).ok, true);
  assert.deepEqual(gate.acquire("user2", 100), { ok: false, reason: "busy" });
  gate.release();
  // user2 はクールダウンではなく即実行できる
  assert.equal(gate.acquire("user2", 200).ok, true);
  gate.release();
});
