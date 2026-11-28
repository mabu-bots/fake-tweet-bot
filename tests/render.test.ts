// ==========================================
// 🧪 テスト: レンダラ
// ==========================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { IMAGE_WIDTH, fallbackAvatar, renderTweetImage } from "../src/tweet/renderer.js";

function solidAvatar() {
  const c = createCanvas(400, 400);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3d5a80";
  ctx.fillRect(0, 0, 400, 400);
  return c;
}

const baseInput = {
  displayName: "テスト太郎",
  username: "test_taro",
  date: new Date("2026-11-19T09:41:00+09:00"),
  avatar: solidAvatar(),
};

test("PNG が生成され、幅が 1200 である", async () => {
  const png = await renderTweetImage({ ...baseInput, text: "テストのツイートです" });
  // PNG シグネチャ
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  // IHDR の幅・高さ（ビッグエンディアン）
  assert.equal(png.readUInt32BE(16), IMAGE_WIDTH);
  const height = png.readUInt32BE(20);
  assert.ok(height > 300 && height < 800, `短文の高さが妥当な範囲であること (実際: ${height})`);
  assert.ok(png.length > 5_000, "画像が極端に小さくないこと");
});

test("本文が長いほど画像が高くなる (可変高さ)", async () => {
  const short = await renderTweetImage({ ...baseInput, text: "短い" });
  const long = await renderTweetImage({
    ...baseInput,
    text: "これは長いツイート本文のテストです。折り返しによって複数行になることを確認します。".repeat(4),
  });
  assert.ok(long.readUInt32BE(20) > short.readUInt32BE(20));
});

test("最大300文字でも生成でき、高さが上限内に収まる", async () => {
  const png = await renderTweetImage({ ...baseInput, text: "あ".repeat(300) });
  assert.equal(png.readUInt32BE(16), IMAGE_WIDTH);
  assert.ok(png.readUInt32BE(20) < 1600, "行数キャップで高さが暴走しないこと");
});

test("カウントを指定しても生成できる", async () => {
  const png = await renderTweetImage({
    ...baseInput,
    text: "バズったことにしたいツイート",
    counts: { replies: 999, retweets: 12_345, likes: 98_765, views: 1_234_567 },
  });
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test("絵文字だけの長文と長い絵文字の表示名でも生成できる (切り捨てで壊れない)", async () => {
  const png = await renderTweetImage({
    ...baseInput,
    displayName: "😀".repeat(40),
    text: "😀".repeat(400),
  });
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(png.readUInt32BE(16), IMAGE_WIDTH);
  assert.ok(png.readUInt32BE(20) < 1600, "行数キャップで高さが暴走しないこと");
});

test("fallbackAvatar は 630x630 の Canvas を返す", () => {
  const c = fallbackAvatar("まぶ");
  assert.equal(c.width, 630);
  assert.equal(c.height, 630);
});
