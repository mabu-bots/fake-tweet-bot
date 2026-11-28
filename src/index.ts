// ==========================================
// 🤖 Bot 本体
// ==========================================
// 📝 起動時にコマンドを自動登録し、2つの入口（メッセージの右クリック /
// /tweet）からツイート風画像を生成して返す。特権 Intent は使わない。
import {
  AttachmentBuilder,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type User,
} from "discord.js";
import { loadConfig } from "./config.js";
import { ExecutionGate } from "./gate.js";
import { registerCommands, TWEET_MESSAGE_COMMAND, TWEET_SLASH_COMMAND } from "./commands.js";
import { logExecution, type CommandRoute } from "./execution-log.js";
import { archiveDir, archiveEnabled, saveProductArchive } from "./product-archive.js";
import { avatarOrFallback } from "./tweet/avatar.js";
import { DEFAULT_COUNTS, renderTweetImage, type TweetCounts } from "./tweet/renderer.js";
import { attachReadyWatchdog } from "./watchdog.js";
import { startPresenceCycle } from "./presence-cycle.js";

const config = loadConfig();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 🐕 Gateway 安全構造: READY が来ないサイレント停滞を検知して終了する（watchdog.ts）
attachReadyWatchdog(client);

// Client の error 系イベントの受け皿（無いと未処理のまま握りつぶされる）
client.on(Events.Error, (error) => {
  console.error("Discord クライアントでエラーが発生しました:", error);
});
client.on(Events.ShardError, (error) => {
  console.error("Discord シャードでエラーが発生しました:", error);
});

// 🚦 ユーザー単位クールダウン + 同時実行数上限
const gate = new ExecutionGate();

// 🏷️ サーバー内での表示名（ニックネーム優先）。取れなければ全体表示名→ユーザー名。
async function displayNameOf(
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
  user: User,
): Promise<string> {
  if (interaction.guild) {
    try {
      const member = await interaction.guild.members.fetch(user.id);
      return member.displayName;
    } catch {
      // メンバーでない（既に退出など）場合は下のフォールバックへ
    }
  }
  return user.displayName ?? user.username;
}

// 🖼️ 画像を生成して interaction に返す共通処理
async function replyWithTweet(
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
  args: { text: string; user: User; date: Date; counts: TweetCounts; route: "slash" | "context" },
): Promise<void> {
  const displayName = await displayNameOf(interaction, args.user);
  const avatar = await avatarOrFallback(
    args.user.displayAvatarURL({ extension: "png", size: 512 }),
    displayName,
  );
  const png = await renderTweetImage({
    text: args.text,
    displayName,
    username: args.user.username,
    date: args.date,
    counts: args.counts,
    avatar,
  });
  const message = await interaction.editReply({
    files: [new AttachmentBuilder(png, { name: "tweet.png" })],
  });
  // 🗄️ 不適切利用の確認用に、生成画像をサーバーへ保存する（product-archive.ts）。
  // 保存に失敗しても生成自体は成功扱いのままにする。
  if (archiveEnabled()) {
    try {
      await saveProductArchive(
        archiveDir(),
        {
          route: args.route,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          messageId: message.id,
          requesterId: interaction.user.id,
          targetUserId: args.user.id,
          text: args.text,
        },
        png,
      );
    } catch (e) {
      console.error("生成画像のアーカイブ保存に失敗しました:", e);
    }
  }
}

// ==========================================
// 🖱️ メッセージの右クリック: 実発言をツイート風画像にする
// ==========================================
async function handleTweetMessage(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const message = interaction.targetMessage;
  const text = message.content.trim();
  if (!text) {
    await interaction.reply({
      content: "テキストのないメッセージ (画像・埋め込みのみ) からはツイート画像を作れません。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply();
  await replyWithTweet(interaction, {
    text,
    user: message.author,
    date: message.createdAt,
    counts: DEFAULT_COUNTS,
    route: "context",
  });
}

// ==========================================
// ⌨️ /tweet: 任意のテキストを捏造する
// ==========================================
async function handleTweetSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.options.getUser("user", true);
  const text = interaction.options.getString("text", true).trim();
  if (!text) {
    await interaction.reply({
      content: "テキストが空です。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const likes = interaction.options.getInteger("likes");
  const retweets = interaction.options.getInteger("retweets");
  await interaction.deferReply();
  await replyWithTweet(interaction, {
    text,
    user,
    date: new Date(),
    counts: {
      ...DEFAULT_COUNTS,
      ...(likes !== null ? { likes } : {}),
      ...(retweets !== null ? { retweets } : {}),
    },
    route: "slash",
  });
}

// ==========================================
// 🚀 起動とイベント配線
// ==========================================
client.once(Events.ClientReady, async (ready) => {
  // 🎮 プレゼンスは全 Bot 共通のサイクル表示（presence-cycle.ts）
  startPresenceCycle(client);
  try {
    await registerCommands(config.token, config.clientId, config.guildId);
    console.log(`ログイン完了: ${ready.user.tag} (コマンド登録済み)`);
  } catch (e) {
    console.error("コマンド登録に失敗しました:", e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  const isTweetCommand =
    (interaction.isMessageContextMenuCommand() && interaction.commandName === TWEET_MESSAGE_COMMAND) ||
    (interaction.isChatInputCommand() && interaction.commandName === TWEET_SLASH_COMMAND);
  if (!isTweetCommand) return;

  // 📜 実行ログ用のメタ情報（入力テキストは残さない）
  const meta = {
    cmd: "tweet",
    route: (interaction.isMessageContextMenuCommand() ? "context" : "slash") as CommandRoute,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
  };

  // 🚦 連打・同時多発を入口で弾く（弾いた場合は本人にだけ見える形で返す）
  const gateResult = gate.acquire(interaction.user.id);
  if (!gateResult.ok) {
    try {
      await interaction.reply({
        content:
          gateResult.reason === "cooldown"
            ? `短時間に連続して実行できません。あと ${Math.ceil(gateResult.retryAfterMs / 1000)} 秒ほど待ってからもう一度お試しください。`
            : "現在ほかの画像を生成中です。少し待ってからもう一度お試しください。",
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      // 応答自体が失敗した場合はログのみ
    }
    logExecution({ ...meta, ok: true });
    return;
  }

  try {
    if (interaction.isMessageContextMenuCommand()) {
      await handleTweetMessage(interaction);
    } else if (interaction.isChatInputCommand()) {
      await handleTweetSlash(interaction);
    }
    logExecution({ ...meta, ok: true });
  } catch (e) {
    logExecution({ ...meta, ok: false, error: e });
    console.error("画像生成に失敗しました:", e);
    const msg = { content: "画像の生成に失敗しました。時間をおいてもう一度お試しください。" };
    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(msg);
        } else {
          await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
        }
      }
    } catch {
      // 応答自体が失敗した場合はログのみ
    }
  } finally {
    gate.release();
  }
});

// ログイン失敗（トークン無効・ネットワーク障害など）は未処理 rejection に
// せず、原因をログに残して異常終了する
try {
  await client.login(config.token);
} catch (e) {
  console.error("ログインに失敗しました。DISCORD_TOKEN とネットワークを確認してください:", e);
  process.exitCode = 1;
}
