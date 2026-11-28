# Contributing

このプロジェクトは、メンテナの全リポジトリで統一した開発手順
（aegis-app/aegis-bot で確立した方式）に従います。

## 開発手順

1. **まず Issue を作る。** すべての変更は Issue から始める（Issue テンプレート使用）。
   目的・作業内容・完了条件を書く。
2. **`main` からブランチを切る。** 名前は `<type>/<Issue番号>-<slug>` とする。
   例: `feat/12-test-command`、`fix/9-summary-resend`、`docs/3-readme`。
3. **実装とテスト。** ローカルでビルドとテストを実行し、両方通ることを確認する。
4. **Pull Request を作る。** PR テンプレートを埋め、本文に `Closes #<番号>` を入れる。
5. **「Rebase and merge」で取り込む。** `main` の履歴を直線に保ち、マージ後にブランチを削除する。

## コミットメッセージ

Conventional Commits + 英語の件名で書く。

```
feat: add master data counts display
fix: persist the posted date to stop re-sending after restarts
docs: update documentation for v1.1.1
```

使う type: `feat`、`fix`、`docs`、`test`、`chore`、`refactor`。

## リリース

リリースは `main` から行う: バージョンを上げ、タグ `vX.Y.Z` を打ち、
GitHub Release を公開する（ノートのみ、バイナリは添付しない）。

## 注意

- 秘密情報はコミットしない。設定は `.env`（`.env.example` 参照）に置き、`.env` は git 管理外とする。
- テストは `./build.sh`（Windows は `build.bat`）でも一括実行できる。
