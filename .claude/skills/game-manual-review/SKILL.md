---
name: game-manual-review
description: "game-play のプレイログと実際の動作を比較し、マニュアル・ドキュメントの誤りを検出・報告する"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# マニュアル正確性検証

## 役割

Backcast 関連ドキュメントの記述が実際の動作と一致するかを検証し、誤りを報告する。

## 入力

- `development_docs/game-play-reports/play-log-*.md` — 最新のプレイログ（実際の動作記録）
- 検証対象ドキュメント:
  - `development_docs/plans/backcast-game-play.md` — オーケストレーションマニュアル
  - `development_docs/game/game-e2e-review-system.md` — E2E テスト知見集
  - `.claude/skills/game-setup/SKILL.md` — 環境セットアップスキル
  - `.claude/skills/game-play/SKILL.md` — プレイスキル
- ソースコード（実装の真実）:
  - `frontend/e2e-tests/game/helpers.ts` — ヘルパー関数
  - `frontend/src/components/skill-tree/skill-data.ts` — スキル定義
  - `src-tauri/sample-notebooks/game_setup.py` — ゲームロジック

## チェック観点

### コマンド正確性
- 操作コマンド一覧の各コマンドが実際に動作するか
- コマンドの引数（銘柄コード等）が正しいか
- 戻り値の説明が正しいか

### スキル発火順序
- マニュアル記載のスキル発火順序が実際と一致するか
- 自動発火の条件記述が正しいか
- 前提条件チェーンの記述が正しいか（`skill-data.ts` と突合）

### 環境構築手順
- セットアップコマンドが実際に動作するか
- ファイルパスが正しいか
- トラブルシューティングの解決策が有効か

### 技術的記述
- スキル発火の仕組み図が実装と一致するか
- E2E テストヘルパーの関数名・引数が正しいか
- 知見番号の参照が正しいか

### Issue ファイルのステータス正確性
- `development_docs/issues/` 内の Issue で `**ステータス**: 未修正` と記載されているものが、実際には実装済みになっていないか
- 実装確認済みの場合は `✅ 修正済み（YYYY-MM-DD 実装確認）` に更新し、根拠（ソースコードの行番号等）をコメントとして追記する

## 実行手順

1. 最新のプレイログを読む
2. 各検証対象ドキュメントを読む
3. ソースコードと突合してファクトチェック
4. `development_docs/issues/` のステータスを確認し、修正済みのものを更新（Edit ツール使用）
5. 誤り・不足をレポートに記録

## 出力フォーマット

`development_docs/game-play-reports/manual-review-YYYY-MM-DD.md` に記録:

```markdown
# マニュアル正確性レビュー

**レビュー日**: YYYY-MM-DD
**対象ドキュメント**: (列挙)

## 発見した誤り

### 誤り 1: <ファイル名> — <セクション名>
- **記載内容**: <マニュアルの記述>
- **実際の動作**: <実際はこうだった>
- **修正案**: <こう書き換えるべき>

### 誤り 2: ...

## 曖昧・不足している記述

### 不足 1: <内容>
- **現状**: <記載がない or 曖昧>
- **追記案**: <追加すべき内容>

## 正確であることを確認した項目

- [x] <確認済み項目>
- [x] ...
```

## 結果サマリー

最後に以下の形式でサマリーを出力:

```
## game-manual-review 結果
- 誤り: X 件
- 不足: X 件
- 確認済み: X 件
- レポート: development_docs/game-play-reports/manual-review-YYYY-MM-DD.md
```
