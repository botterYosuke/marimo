---
name: game-bug-hunt
description: "game-play のプレイログを分析してバグを発見し、development_docs/issues/ に Issue を記録する"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# バグ発見・Issue 記録

## 役割

game-play スキルのプレイログとスクリーンショットを分析し、ゲーム内のバグを発見して `development_docs/issues/` に記録する。

## 入力

- `development_docs/game-play-reports/play-log-*.md` — 最新のプレイログ
- `development_docs/issues/` — 既存 Issue 一覧（重複登録を避ける）
- `frontend/e2e-tests/game/` — テスト結果のエラー出力

## チェック観点

### スキル発火系
- コマンド実行後にスキルが発火しない
- スキルが重複発火する（同じスキルが2回以上トリガー）
- 前提条件を満たしていないのにスキルが解放される
- 前提条件を満たしているのにスキルが locked のまま

### UI/表示系
- チャートが正しく描画されない
- HUD（ステータスバー）の値が不正（`[object Object]` 等）
- スキルツリーパネルのノード表示がおかしい
- 報酬トーストが表示されない / 消えない
- Grid レイアウトが崩れる

### データ系
- `bt.trades()` の戻り値が不正
- Equity/Cash の計算が合わない
- 進捗データが保存されない / 読み込めない

### 接続・安定性系
- WebSocket 切断が発生する
- Reconnected バナーが消えない
- セル実行がハングする

## 実行手順

1. 最新のプレイログを読む
2. 既存 Issue 一覧を読む（重複チェック）
3. プレイログからエラー・異常を抽出
4. 各異常について根本原因を調査（関連ソースコードを読む）
5. 新規バグを Issue ファイルとして記録

## 調査時に読むべきソースコード

| 対象 | ファイル |
|------|---------|
| スキル定義・前提条件 | `frontend/src/components/skill-tree/skill-data.ts` |
| スキル発火ハンドラ | `frontend/src/components/skill-tree/skill-complete-handler.ts` |
| HUD 表示 | `frontend/src/components/editor/controls/backtest-hud.tsx` |
| BroadcastChannel | `frontend/src/hooks/useBroadcastChannel.ts` |
| Python 側ゲームロジック | `src-tauri/sample-notebooks/game_setup.py` |
| Python 側スキル発火 | `src-tauri/sample-notebooks/skill_events.py` |
| Python 側状態送信 | `src-tauri/sample-notebooks/headless_broadcast.py` |

## 出力フォーマット

各バグを `development_docs/issues/<slug>.md` に記録:

```markdown
# Issue: <タイトル>

**作成日**: YYYY-MM-DD
**重要度**: Critical / High / Medium / Low
**カテゴリ**: スキル発火 / UI / データ / 接続
**ステータス**: Open

---

## 概要

<現象の説明（1〜2文）>

## 再現手順

1. <ステップ>
2. <ステップ>
3. <ステップ>

## 期待される動作

<正しくはこうなるべき>

## 実際の動作

<実際に起こったこと>

## スクリーンショット

（あれば添付）

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `path/to/file` | 説明 |

## 調査メモ

<根本原因の仮説、調査した内容>
```

## 既知 Issue の確認（重複登録・ステータス更新）

実行前に必ず `development_docs/issues/` ディレクトリを確認して全ファイルをリストアップすること（ハードコードリストは陳腐化するため信頼しない）:

```bash
ls development_docs/issues/
```

確認すべき点:
1. **重複登録を避ける**: 同一現象が既に Issue 化されていれば新規作成しない
2. **ステータス更新**: `**ステータス**: 未修正` と記載されている Issue について、最新のプレイログで現象が再現しなかった場合は `✅ 修正済み（YYYY-MM-DD 実装確認）` に更新する
3. **悪化の記録**: 既知 Issue でも「以前より悪化している」場合は Issue 内の調査メモに追記する

## 結果サマリー

最後に以下の形式でサマリーを出力:

```
## game-bug-hunt 結果
- 新規バグ: X 件
- 既知バグの再確認: X 件
- 記録ファイル: development_docs/issues/<slug>.md
```
