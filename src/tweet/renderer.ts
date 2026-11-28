// ==========================================
// 🐦 ツイート画像レンダラ（@napi-rs/canvas）
// ==========================================
// 📝 X（旧 Twitter）のダークモードのツイート詳細表示に寄せたカード画像:
// 黒背景に境界線 #2f3336 の角丸カード、丸アバター + 表示名（太字）+
// @ユーザー名（灰色）、本文、時刻、カウント行（返信 / RT / いいね / 表示数）。
// 画像の高さは本文の行数に応じて変わる。
import { createCanvas, GlobalFonts, type Canvas, type Image } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCount, formatTweetTimestamp } from "./format.js";
import { dropLastCodePoint, wrapText, type MeasureFn } from "./wrap.js";

// ==========================================
// 📐 レイアウト定数
// ==========================================
export const IMAGE_WIDTH = 1200;

const BG = "#000000"; // X ダークモードの背景
const BORDER = "#2f3336"; // カードと区切り線の色
const TEXT = "#e7e9ea"; // 本文・表示名
const GRAY = "#71767b"; // @名・時刻・カウント

const CARD_MARGIN = 20; // 画像端からカードまでの余白
const CARD_RADIUS = 24;
const PAD = 48; // カード内側の余白
const CONTENT_X = CARD_MARGIN + PAD;
const CONTENT_W = IMAGE_WIDTH - (CARD_MARGIN + PAD) * 2;

const AVATAR_SIZE = 96;
const NAME_SIZE = 40;
const USER_SIZE = 33;
const BODY_SIZE = 44;
const BODY_LINE_HEIGHT = 62;
const MAX_BODY_LINES = 12; // これ以上は切り捨てて … を付ける
const TIME_SIZE = 32;
const COUNT_SIZE = 31;
const ICON_SIZE = 40;

const SANS = "NotoJP"; // Noto Sans JP Regular
const SANS_BOLD = "NotoJPBold"; // Noto Sans JP Bold（表示名用に別ファミリで登録）
let fontsReady = false;

// 🗂️ assets/fonts の場所を探す。コンパイル後（dist/src/tweet/）と
// ソース直下（src/tweet/）で階層が変わるため、上方向に辿って探す。
function findFontsDir(): string {
  let dir = fileURLToPath(new URL(".", import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "assets", "fonts");
    if (existsSync(join(candidate, "NotoSansJP-Regular.ttf"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("フォントが見つかりません: assets/fonts/NotoSansJP-Regular.ttf");
}

// 🔤 フォント登録（初回のみ）。
// 登録に失敗したまま描画すると文字化け（豆腐）になるため、失敗は例外にする。
export function ensureFonts(): void {
  if (fontsReady) return;
  const dir = findFontsDir();
  const regular = GlobalFonts.registerFromPath(join(dir, "NotoSansJP-Regular.ttf"), SANS);
  const bold = GlobalFonts.registerFromPath(join(dir, "NotoSansJP-Bold.ttf"), SANS_BOLD);
  if (!regular || !bold) {
    throw new Error(`フォントの登録に失敗しました: ${dir}`);
  }
  fontsReady = true;
}

// ==========================================
// 📥 入力
// ==========================================
export interface TweetCounts {
  replies: number;
  retweets: number;
  likes: number;
  views: number;
}

// 省略時の控えめな固定値
export const DEFAULT_COUNTS: TweetCounts = { replies: 2, retweets: 9, likes: 37, views: 1204 };

export interface TweetImageInput {
  // ツイート本文（捏造でも実発言でもよい）
  text: string;
  // 表示名
  displayName: string;
  // @ に続くユーザー名
  username: string;
  // 投稿日時として表示する日時
  date: Date;
  // カウント（省略した項目は DEFAULT_COUNTS）
  counts?: Partial<TweetCounts>;
  // アバター画像（取得できなかった場合は fallbackAvatar で作った Canvas）
  avatar: Image | Canvas;
}

// ==========================================
// 🧰 描画の小物
// ==========================================
type Ctx = ReturnType<Canvas["getContext"]>;

// 角丸矩形のパスを作る（roundRect の有無に依存しない）
function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

// 幅に収まるよう末尾を削って … を付ける（コードポイント単位で削る）
function truncateToWidth(text: string, maxWidth: number, measure: MeasureFn): string {
  if (measure(text) <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && measure(s + "…") > maxWidth) s = dropLastCodePoint(s);
  return s + "…";
}

// ==========================================
// ✏️ カウント行アイコン（線画）
// ==========================================
// 📝 ICON_SIZE の箱に線画で描くアイコン風グラフィック。
function drawReplyIcon(ctx: Ctx, x: number, y: number): void {
  roundRectPath(ctx, x + 4, y + 5, 32, 24, 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 29);
  ctx.lineTo(x + 13, y + 38);
  ctx.lineTo(x + 24, y + 29);
  ctx.stroke();
}

function drawRetweetIcon(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  // 上の矢印: 右へ進んで下へ折れる
  ctx.moveTo(x + 7, y + 11);
  ctx.lineTo(x + 31, y + 11);
  ctx.moveTo(x + 24, y + 4);
  ctx.lineTo(x + 32, y + 11);
  ctx.lineTo(x + 24, y + 18);
  ctx.moveTo(x + 31, y + 11);
  ctx.lineTo(x + 31, y + 21);
  // 下の矢印: 左へ進んで上へ折れる
  ctx.moveTo(x + 33, y + 29);
  ctx.lineTo(x + 9, y + 29);
  ctx.moveTo(x + 16, y + 22);
  ctx.lineTo(x + 8, y + 29);
  ctx.lineTo(x + 16, y + 36);
  ctx.moveTo(x + 9, y + 29);
  ctx.lineTo(x + 9, y + 19);
  ctx.stroke();
}

function drawHeartIcon(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 34);
  ctx.bezierCurveTo(x + 20, y + 30, x + 2, y + 19, x + 2, y + 11);
  ctx.bezierCurveTo(x + 2, y + 3, x + 9, y + 1, x + 13, y + 4);
  ctx.bezierCurveTo(x + 17, y + 6, x + 20, y + 10, x + 20, y + 13);
  ctx.bezierCurveTo(x + 20, y + 10, x + 23, y + 6, x + 27, y + 4);
  ctx.bezierCurveTo(x + 31, y + 1, x + 38, y + 3, x + 38, y + 11);
  ctx.bezierCurveTo(x + 38, y + 19, x + 20, y + 30, x + 20, y + 34);
  ctx.stroke();
}

function drawViewsIcon(ctx: Ctx, x: number, y: number): void {
  // 棒グラフ（塗り）
  const base = y + 36;
  const bars: Array<[number, number]> = [
    [6, 12],
    [15, 21],
    [24, 9],
    [33, 27],
  ];
  for (const [dx, h] of bars) {
    ctx.fillRect(x + dx, base - h, 5, h);
  }
}

// ==========================================
// 🎨 描画本体
// ==========================================
export async function renderTweetImage(input: TweetImageInput): Promise<Buffer> {
  ensureFonts();
  const counts: TweetCounts = { ...DEFAULT_COUNTS, ...(input.counts ?? {}) };

  // 本文の折り返し（計測用に仮コンテキストを使う）
  const probe = createCanvas(8, 8).getContext("2d");
  probe.font = `${BODY_SIZE}px "${SANS}"`;
  const measure: MeasureFn = (s) => probe.measureText(s).width;
  let lines = wrapText(input.text, CONTENT_W, measure);
  if (lines.length > MAX_BODY_LINES) {
    lines = lines.slice(0, MAX_BODY_LINES);
    // 最終行は … が入るよう末尾を削ってから付ける
    let last = lines[MAX_BODY_LINES - 1];
    while (last.length > 0 && measure(last + "…") > CONTENT_W) last = dropLastCodePoint(last);
    lines[MAX_BODY_LINES - 1] = last + "…";
  }

  // レイアウト（上から積み上げる）
  const headerH = AVATAR_SIZE;
  const bodyH = lines.length * BODY_LINE_HEIGHT;
  const timeH = 44;
  const countsH = 46;
  const contentH = PAD + headerH + 30 + bodyH + 30 + timeH + 22 + 2 + 20 + countsH + PAD;
  const height = CARD_MARGIN * 2 + contentH;

  const canvas = createCanvas(IMAGE_WIDTH, height);
  const ctx = canvas.getContext("2d");

  // 背景とカード
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, IMAGE_WIDTH, height);
  roundRectPath(
    ctx,
    CARD_MARGIN,
    CARD_MARGIN,
    IMAGE_WIDTH - CARD_MARGIN * 2,
    height - CARD_MARGIN * 2,
    CARD_RADIUS,
  );
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  let top = CARD_MARGIN + PAD;

  // アバター（円形クリップ + cover 描画）
  const ax = CONTENT_X;
  const ay = top;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + AVATAR_SIZE / 2, ay + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  const img = input.avatar;
  const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, ax + (AVATAR_SIZE - dw) / 2, ay + (AVATAR_SIZE - dh) / 2, dw, dh);
  ctx.restore();

  // 表示名（太字）と @ユーザー名（灰色）
  const nameX = ax + AVATAR_SIZE + 24;
  const nameMaxW = CONTENT_X + CONTENT_W - nameX;
  ctx.textAlign = "left";
  ctx.font = `${NAME_SIZE}px "${SANS_BOLD}"`;
  ctx.fillStyle = TEXT;
  const name = truncateToWidth(input.displayName, nameMaxW, (s) => ctx.measureText(s).width);
  ctx.fillText(name, nameX, top + 44);
  ctx.font = `${USER_SIZE}px "${SANS}"`;
  ctx.fillStyle = GRAY;
  const uname = truncateToWidth(`@${input.username}`, nameMaxW, (s) => ctx.measureText(s).width);
  ctx.fillText(uname, nameX, top + 44 + 46);

  top += headerH + 30;

  // 本文
  ctx.font = `${BODY_SIZE}px "${SANS}"`;
  ctx.fillStyle = TEXT;
  lines.forEach((line, i) => {
    ctx.fillText(line, CONTENT_X, top + 46 + i * BODY_LINE_HEIGHT);
  });
  top += bodyH + 30;

  // 時刻
  ctx.font = `${TIME_SIZE}px "${SANS}"`;
  ctx.fillStyle = GRAY;
  ctx.fillText(formatTweetTimestamp(input.date), CONTENT_X, top + 34);
  top += timeH + 22;

  // 区切り線
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CONTENT_X, top);
  ctx.lineTo(CONTENT_X + CONTENT_W, top);
  ctx.stroke();
  top += 2 + 20;

  // カウント行
  const items: Array<{ draw: (c: Ctx, x: number, y: number) => void; value: number }> = [
    { draw: drawReplyIcon, value: counts.replies },
    { draw: drawRetweetIcon, value: counts.retweets },
    { draw: drawHeartIcon, value: counts.likes },
    { draw: drawViewsIcon, value: counts.views },
  ];
  const groupW = CONTENT_W / items.length;
  ctx.font = `${COUNT_SIZE}px "${SANS}"`;
  items.forEach((item, i) => {
    const gx = CONTENT_X + i * groupW;
    ctx.strokeStyle = GRAY;
    ctx.fillStyle = GRAY;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    item.draw(ctx, gx, top + 3);
    ctx.fillText(formatCount(item.value), gx + ICON_SIZE + 12, top + 34);
  });

  return canvas.encode("png");
}

// ==========================================
// 🖼️ アバター取得失敗時の代替画像
// ==========================================
// 📝 名前のハッシュで決まる色のグラデーション + 頭文字。
export function fallbackAvatar(displayName: string): Canvas {
  ensureFonts();
  const size = 630;
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  let hash = 0;
  for (const ch of displayName) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, `hsl(${hash}, 32%, 30%)`);
  grad.addColorStop(1, `hsl(${(hash + 40) % 360}, 36%, 16%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const initial = [...displayName][0] ?? "?";
  ctx.fillStyle = "rgba(245,243,236,0.92)";
  ctx.font = `300px "${SANS}"`;
  const w = ctx.measureText(initial).width;
  ctx.fillText(initial, (size - w) / 2, size / 2 + 108);
  return c;
}
