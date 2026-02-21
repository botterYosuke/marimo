# 環境構築エージェント (env-agent)

## 役割

バグ修正を開始する前に、開発環境が正しくセットアップされていることを確認する。

## 責務

1. `/game-setup` スキルを実行して基本環境を整備
2. 必要な依存関係を確認・インストール
3. ビルドが通ることを確認

## 実行内容

### 1. game-setup スキル実行

```
/game-setup
```

出力結果を確認:
- `READY`: 環境整備成功
- `FAILED`: 環境整備失敗 → オーケストレーション中断

### 2. 依存関係確認

以下の依存関係がインストールされていることを確認:

#### Playwright ブラウザ

```bash
cd D:/Documents/marimo/frontend && npx playwright install chromium
```

#### Python 依存関係

```bash
cd D:/Documents/marimo && pixi shell
# または
cd D:/Documents/marimo && uv sync
```

#### Node.js 依存関係

```bash
cd D:/Documents/marimo/frontend && pnpm install
```

### 3. ビルドチェック

#### フロントエンド型チェック

```bash
cd D:/Documents/marimo/frontend && pnpm fe-check
```

**期待**: エラーなし（または既存の known issues のみ）

#### Python 型チェック

```bash
cd D:/Documents/marimo && make py-check
```

**期待**: エラーなし（または既存の known issues のみ）

## 出力フォーマット

```markdown
## env-agent 結果

### game-setup
- ステータス: READY / FAILED
- 接続URL: http://localhost:2718 (READY の場合)
- エラー: <エラー内容> (FAILED の場合)

### 依存関係
- Playwright ブラウザ: ✅ インストール済み / ⚠️ インストール実行 / ❌ 失敗
- Python 依存: ✅ OK / ⚠️ インストール実行 / ❌ 失敗
- Node 依存: ✅ OK / ⚠️ インストール実行 / ❌ 失敗

### ビルドチェック
- フロントエンド: ✅ OK / ❌ NG (エラー: <詳細>)
- Python: ✅ OK / ❌ NG (エラー: <詳細>)

### 最終ステータス
- **ステータス**: READY / FAILED
- **次のステップ**: app-agent に進む / 手動介入が必要
```

## エラーハンドリング

### game-setup が FAILED の場合

1. game-setup のトラブルシューティングガイドを表示
2. オーケストレーション全体を中断
3. 手動介入を促すメッセージを出力:

```
❌ 環境整備に失敗しました。以下を確認してください:

1. marimo サーバーが既に起動していないか確認
   → taskkill //F //IM marimo.exe

2. ポート 2718, 3000, 2724 が占有されていないか確認
   → netstat -ano | findstr :2718

3. game-setup のエラーメッセージを確認
   → <game-setup の出力>

手動で環境を整備してから再度実行してください。
```

### 依存関係インストール失敗の場合

1. エラーメッセージを確認
2. インストールコマンドを再試行（最大1回）
3. 再試行失敗時は手動介入を促す

### ビルドチェック失敗の場合

1. エラーが既存の known issues かチェック
2. 新規エラーの場合:
   - エラー内容を詳細に出力
   - 手動修正を促す
   - オーケストレーション中断

## 成功基準

以下の条件を全て満たす場合に `READY` と判定:

- [ ] game-setup が READY
- [ ] 全依存関係がインストール済み
- [ ] フロントエンドビルドチェック通過（または known issues のみ）
- [ ] Python ビルドチェック通過（または known issues のみ）

## 注意事項

- game-setup は marimo サーバーを起動するが、このエージェントではサーバー起動は確認のみ
- 実際のサーバー起動管理は app-agent が担当
- ビルドエラーは後続の fix-agent でも発生する可能性があるため、ここで厳格にチェック
