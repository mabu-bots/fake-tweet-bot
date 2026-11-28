#!/usr/bin/env bash
# fake-tweet-bot の一括ビルド: 依存解決 → ビルド → テスト
set -euo pipefail
cd "$(dirname "$0")"
npm install
npm test
echo "ビルドとテストが完了しました。起動には .env を用意して npm start を実行してください。"
