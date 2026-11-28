// ==========================================
// 🚦 実行制限（クールダウン・同時実行数）
// ==========================================
// 📝 1回の画像生成ではメンバー取得 + アバター取得（最大10秒）+ Canvas 描画が
// 走るため、連打や同時多発でメモリ逼迫した共用サーバーを圧迫しないよう、
// 入口で簡易に絞る。純ロジックとして切り出し、単体テストで検証する。

// ユーザー単位のクールダウン（ミリ秒）
export const USER_COOLDOWN_MS = 10_000;

// 同時に実行できる画像生成の上限
export const MAX_CONCURRENT_RENDERS = 2;

export type GateResult =
  | { ok: true }
  | { ok: false; reason: "cooldown"; retryAfterMs: number }
  | { ok: false; reason: "busy" };

export class ExecutionGate {
  private readonly lastStartedAt = new Map<string, number>();
  private active = 0;

  constructor(
    private readonly cooldownMs: number = USER_COOLDOWN_MS,
    private readonly maxConcurrent: number = MAX_CONCURRENT_RENDERS,
  ) {}

  // 🚪 実行を開始できるか判定し、開始できる場合は記録する。
  // 混雑（busy）で弾いた場合はクールダウンを消費しない。
  // 開始した側は処理完了後に必ず release() を呼ぶこと。
  acquire(userId: string, now: number = Date.now()): GateResult {
    // 期限切れの記録を掃除する（Map がユーザー数分だけ際限なく育たないように）
    for (const [id, at] of this.lastStartedAt) {
      if (now - at >= this.cooldownMs) this.lastStartedAt.delete(id);
    }
    const last = this.lastStartedAt.get(userId);
    if (last !== undefined) {
      return { ok: false, reason: "cooldown", retryAfterMs: this.cooldownMs - (now - last) };
    }
    if (this.active >= this.maxConcurrent) {
      return { ok: false, reason: "busy" };
    }
    this.lastStartedAt.set(userId, now);
    this.active += 1;
    return { ok: true };
  }

  release(): void {
    if (this.active > 0) this.active -= 1;
  }

  get activeCount(): number {
    return this.active;
  }
}
