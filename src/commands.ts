// ==========================================
// 📌 コマンド定義と登録
// ==========================================
import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";

// メッセージの右クリック（アプリ）から実発言をツイート風画像にする
export const TWEET_MESSAGE_COMMAND = "Fake Tweet";

// 任意のユーザー × 任意のテキストでツイート風画像を捏造する
export const TWEET_SLASH_COMMAND = "tweet";

export function buildCommands(): RESTPostAPIApplicationCommandsJSONBody[] {
  const context = new ContextMenuCommandBuilder()
    .setName(TWEET_MESSAGE_COMMAND)
    .setType(ApplicationCommandType.Message);

  const slash = new SlashCommandBuilder()
    .setName(TWEET_SLASH_COMMAND)
    .setDescription("指定したユーザーの投稿として、ツイート風の画像を捏造します")
    .addUserOption((o) => o.setName("user").setDescription("投稿者にするユーザー").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("text")
        .setDescription("投稿したことにするテキスト (最大300文字)")
        .setRequired(true)
        .setMaxLength(300),
    )
    .addIntegerOption((o) =>
      o
        .setName("likes")
        .setDescription("いいね数 (省略時は控えめな固定値)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(999_999_999),
    )
    .addIntegerOption((o) =>
      o
        .setName("retweets")
        .setDescription("リツイート数 (省略時は控えめな固定値)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(999_999_999),
    );

  return [context.toJSON(), slash.toJSON()];
}

// 📝 コマンドを Discord に登録する。guildId があればギルド登録（即時）、
// 無ければグローバル登録（反映まで最大1時間）。
export async function registerCommands(
  token: string,
  clientId: string,
  guildId: string | null,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = buildCommands();
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
  }
}
