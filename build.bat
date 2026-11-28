@echo off
rem fake-tweet-bot の一括ビルド: 依存解決 → ビルド → テスト
setlocal
cd /d %~dp0
call npm install || exit /b 1
call npm test || exit /b 1
echo ビルドとテストが完了しました。起動には .env を用意して npm start を実行してください。
