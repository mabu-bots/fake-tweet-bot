// ==========================================
// 📏 テキスト折り返し（純ロジック）
// ==========================================
// 📝 描画幅の計測は関数として注入する形にし、canvas に依存させない。
// これにより単体テストでは決定的なモック計測で検証できる。
// あわせて日本語の禁則処理（行頭禁則・行末禁則）の簡易版を担う。

// 🚫 行頭に置けない文字（句読点・閉じ括弧・長音・小書き文字など）
const NO_LINE_START =
  "、。，．！？：；）」』】〉》ー〜…‥・ゝゞ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ";

// 🚫 行末に残せない文字（開き括弧）
const NO_LINE_END = "（「『【〈《";

// 📐 文字列の描画幅を返す関数（measureText の薄いラッパを想定）
export type MeasureFn = (text: string) => number;

// ==========================================
// 🔤 コードポイント単位の文字列ヘルパ
// ==========================================
// 📝 絵文字などは UTF-16 のサロゲートペア（2コードユニット）で表される。
// length や slice(0, -1) のようなコードユニット単位の末尾操作で切ると
// 片方だけが残って描画が壊れるため、末尾操作はここに統一する。
export function lastCodePoint(text: string): string | undefined {
  return [...text].at(-1);
}

export function dropLastCodePoint(text: string): string {
  const chars = [...text];
  chars.pop();
  return chars.join("");
}

export function codePointLength(text: string): number {
  return [...text].length;
}

// ==========================================
// 📏 折り返し本体
// ==========================================
// 📝 text を maxWidth に収まる行の配列へ分割する。改行は段落区切りとして尊重する。
export function wrapText(text: string, maxWidth: number, measure: MeasureFn): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const ch of paragraph) {
      if (line === "") {
        // 行頭の空白は捨てる
        if (ch === " " || ch === "　") continue;
        line = ch;
        continue;
      }
      if (measure(line + ch) <= maxWidth) {
        line += ch;
        continue;
      }
      // ここで折り返しが発生する
      if (NO_LINE_START.includes(ch)) {
        // 行頭禁則: その文字は前の行に追い込む（多少はみ出しても崩さない）
        line += ch;
        continue;
      }
      const last = lastCodePoint(line);
      if (last !== undefined && NO_LINE_END.includes(last) && codePointLength(line) >= 2) {
        // 行末禁則: 開き括弧は次の行へ送る
        lines.push(dropLastCodePoint(line));
        line = last + ch;
        continue;
      }
      lines.push(line);
      line = ch === " " || ch === "　" ? "" : ch;
    }
    if (line !== "" || lines.length === 0) lines.push(line);
  }
  return lines;
}

// ==========================================
// 🔍 サイズ自動調整（収まるフォントサイズの探索）
// ==========================================
export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  // 大きい順に試すフォントサイズ
  sizes: number[];
  // 行高（フォントサイズに対する倍率）
  lineHeightRatio: number;
  // size ごとの計測関数を作るファクトリ
  measureAt: (fontSize: number) => MeasureFn;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
  lineHeight: number;
}

// 📝 maxWidth × maxHeight に収まる最大のフォントサイズと折り返し結果を返す。
// 最小サイズでも収まらない場合は、入る行数までで切り捨てて末尾に … を付ける。
export function fitQuoteText(text: string, opts: FitOptions): FitResult {
  const sizes = [...opts.sizes].sort((a, b) => b - a);
  for (const size of sizes) {
    const lines = wrapText(text, opts.maxWidth, opts.measureAt(size));
    const lineHeight = Math.round(size * opts.lineHeightRatio);
    if (lines.length * lineHeight <= opts.maxHeight) {
      return { fontSize: size, lines, lineHeight };
    }
  }
  const size = sizes[sizes.length - 1];
  const lineHeight = Math.round(size * opts.lineHeightRatio);
  const maxLines = Math.max(1, Math.floor(opts.maxHeight / lineHeight));
  const measure = opts.measureAt(size);
  const lines = wrapText(text, opts.maxWidth, measure).slice(0, maxLines);
  // 最終行に … を付ける（幅に収まるまで末尾を削る）
  let last = lines[lines.length - 1];
  while (last.length > 0 && measure(last + "…") > opts.maxWidth) {
    last = dropLastCodePoint(last);
  }
  lines[lines.length - 1] = last + "…";
  return { fontSize: size, lines, lineHeight };
}
