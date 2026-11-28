// ==========================================
// 📌 設定の読み込み（環境変数）
// ==========================================
// 📝 .env は node --env-file=.env で読み込まれる前提（npm start / npm run deploy）。
export interface Config {
  token: string;
  clientId: string;
  // 設定するとそのサーバーだけにコマンドを登録する（即時反映）。
  // 未設定ならグローバル登録（反映に最大1時間）。
  guildId: string | null;
}

export function loadConfig(): Config {
  const token = process.env.DISCORD_TOKEN?.trim();
  const clientId = process.env.CLIENT_ID?.trim();
  if (!token) {
    throw new Error("DISCORD_TOKEN が未設定です。.env を確認してください (README のセットアップ手順参照)。");
  }
  if (!clientId) {
    throw new Error("CLIENT_ID が未設定です。.env を確認してください (README のセットアップ手順参照)。");
  }
  const guildId = process.env.GUILD_ID?.trim();
  return { token, clientId, guildId: guildId ? guildId : null };
}
