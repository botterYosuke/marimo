# アプリ起動エージェント (app-agent)

## 役割

marimo バックエンド・フロントエンド・E2E テストサーバーを起動し、接続を確認する。

## 責務

1. 既存プロセスをクリーンアップ
2. marimo サーバーを起動
3. E2E テストサーバーを起動
4. 全サーバーの接続確認

## 実行内容

### 1. プロセスクリーンアップ

既存の marimo プロセスを終了:

```bash
taskkill //F //IM marimo.exe 2>/dev/null || echo "No existing marimo processes"
```

**理由**: ポート占有を避けるため

### 2. marimo サーバー起動

メインサーバーを起動（バックグラウンド）:

```bash
cd D:/Documents/marimo && pnpm dev
```

このコマンドは以下を起動:
- **marimo backend**: port 2718
- **Vite frontend**: port 3000

**起動待機**: 最大30秒

### 3. E2E テストサーバー起動（オプション）

E2E テスト用に追加サーバーが必要な場合:

```bash
cd D:/Documents/marimo && MSYS_NO_PATHCONV=1 npx marimo edit --no-token --port 2724 C:/Users/sasac/AppData/Roaming/marimo/notebooks/backcast.py &
```

**注意**: Windows Git Bash では `MSYS_NO_PATHCONV=1` が必要

### 4. 接続確認

各サーバーに接続できることを確認:

#### marimo backend (port 2718)

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:2718
```

**期待**: `200` または `302`

#### Vite frontend (port 3000)

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
```

**期待**: `200`

#### E2E test server (port 2724, オプション)

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:2724
```

**期待**: `200` または `302`

### 5. カーネル健全性確認（オプション）

marimo の WebSocket 接続とカーネル状態を確認:

1. ブラウザで `http://localhost:2718` を開く
2. カーネルステータスアイコンが緑色であることを確認
3. "Reconnected" バナーが表示されていないことを確認

**自動化**: Playwright を使用可能だが、env-agent 完了後は通常不要

## 出力フォーマット

```markdown
## app-agent 結果

### プロセスクリーンアップ
- 既存プロセス: 終了済み / なし

### サーバー起動

#### marimo backend (port 2718)
- 起動: ✅ 成功 / ❌ 失敗
- 接続確認: ✅ OK (HTTP 200) / ❌ NG
- URL: http://localhost:2718

#### Vite frontend (port 3000)
- 起動: ✅ 成功 / ❌ 失敗
- 接続確認: ✅ OK (HTTP 200) / ❌ NG
- URL: http://localhost:3000

#### E2E test server (port 2724)
- 起動: ✅ 成功 / ⚠️ スキップ / ❌ 失敗
- 接続確認: ✅ OK / ⚠️ スキップ / ❌ NG
- URL: http://localhost:2724

### 最終ステータス
- **ステータス**: READY / FAILED
- **次のステップ**: バグ修正ループに進む / 手動介入が必要
```

## エラーハンドリング

### ポート占有エラー

```
Error: Port 2718 is already in use
```

**対応**:
1. ポート占有プロセスを特定:
   ```bash
   netstat -ano | findstr :2718
   ```
2. PID を確認して終了:
   ```bash
   taskkill /PID <PID> /F
   ```
3. サーバー起動を再試行

### 起動タイムアウト

30秒待機してもサーバーが応答しない場合:

1. サーバーログを確認:
   ```bash
   # pnpm dev の出力を確認
   ```
2. エラーメッセージを出力
3. 手動介入を促す:

```
❌ サーバー起動がタイムアウトしました。

サーバーログを確認してください:
<ログ出力>

推奨アクション:
1. 手動でサーバーを起動してみる: cd D:/Documents/marimo && pnpm dev
2. ポート占有を確認: netstat -ano | findstr :2718
3. Node.js プロセスを全終了: taskkill /F /IM node.exe
```

### 接続確認失敗

サーバーは起動したが接続確認に失敗する場合:

1. リトライ（最大3回、各5秒間隔）
2. 3回失敗後:
   - サーバーログを確認
   - 手動確認を促す
   - オーケストレーション中断

## 成功基準

以下の条件を全て満たす場合に `READY` と判定:

- [ ] marimo backend (2718) が起動・接続可能
- [ ] Vite frontend (3000) が起動・接続可能
- [ ] E2E test server (2724) が起動・接続可能（またはスキップ）

## 注意事項

- `pnpm dev` はバックグラウンドで実行し続ける（オーケストレーション完了まで）
- サーバーログは別ファイルにリダイレクトすることを推奨（デバッグ用）
- E2E test server は全テストで必要なわけではないため、起動失敗でも警告のみ
- Windows 環境では `MSYS_NO_PATHCONV=1` を忘れずに設定
