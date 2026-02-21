---
name: game-orchestrate
description: "Backcast ゲーム全体オーケストレーション: Step 1 環境整備 → Step 2 プレイ → Step 3 分析（並列）を自動実行"
allowed-tools:
  - Skill
  - Read
  - Write
  - Glob
  - Task
---

# Backcast ゲーム全体オーケストレーション

## 役割

以下の3ステップを自動的に順序実行する:

1. **環境整備** (`/game-setup`) — サーバー起動・ファイル配置・リセット
2. **ゲームプレイ** (`/game-play`) — Sandbox + Bridge モードを実プレイ
3. **分析** (並列) — バグ発見・マニュアルレビュー・面白さ評価

## 実行手順

### Step 1: 環境整備

`/game-setup` スキルを実行:

```
/game-setup
```

**判定**: 出力が `READY` であることを確認。`FAILED` の場合は中断してエラーを報告。

---

### Step 2: ゲームプレイ

Step 1 が `READY` の場合のみ、`/game-play` スキルを実行:

```
/game-play
```

**出力**: `development_docs/game-play-reports/play-log-YYYY-MM-DD.md` が生成されることを確認。

> **所要時間**: 全スイート（`e2e-tests/game/`）実行は約1.2時間かかる。sandbox.spec.ts のみなら数分。

---

### Step 3: 分析（3つのスキルを並列実行）

Step 2 が完了したら、以下の3スキルを**並列**に実行:

**方法: Task ツールで3つの general-purpose エージェントをバックグラウンド起動する**（Skill ツールは非同期並列実行できないため）:

```
Task(game-bug-hunt, run_in_background=true)
Task(game-manual-review, run_in_background=true)
Task(game-fun-review, run_in_background=true)
```

3つのエージェントに渡すプロンプトには、それぞれのスキル (`/game-bug-hunt`, `/game-manual-review`, `/game-fun-review`) の SKILL.md の内容を要約して指示すること。エージェントは独立して動作し、最新のプレイログを参照して成果物を生成する。

---

### Step 4: 最終サマリー

全スキル完了後、以下を確認して報告:

#### 成果物チェックリスト

- [ ] `development_docs/game-play-reports/play-log-YYYY-MM-DD.md` — プレイログ
- [ ] `development_docs/game-play-reports/manual-review-YYYY-MM-DD.md` — マニュアルレビュー
- [ ] `development_docs/game-play-reports/fun-review-YYYY-MM-DD.md` — 面白さ評価
- [ ] `development_docs/issues/` に新規 Issue（バグがあった場合）

#### 実行サマリー

```markdown
# Backcast ゲーム オーケストレーション完了

**実行日**: YYYY-MM-DD

## 実行結果

| Step | Skill | ステータス | 備考 |
|------|-------|----------|------|
| 1 | game-setup | READY / FAILED | |
| 2 | game-play | 完了 / 失敗 | 取得スキル数: X/59 |
| 3a | game-bug-hunt | 完了 / 失敗 | 新規バグ: X 件 |
| 3b | game-manual-review | 完了 / 失敗 | 誤り: X 件 |
| 3c | game-fun-review | 完了 / 失敗 | スコア: ★X/5 |

## 成果物

- プレイログ: `development_docs/game-play-reports/play-log-YYYY-MM-DD.md`
- マニュアルレビュー: `development_docs/game-play-reports/manual-review-YYYY-MM-DD.md`
- 面白さ評価: `development_docs/game-play-reports/fun-review-YYYY-MM-DD.md`
- 新規 Issue: (あれば列挙)
```

---

## エラーハンドリング

### Step 1 が FAILED の場合

中断し、以下を報告:
- 失敗理由
- トラブルシューティング手順（`/game-setup` スキル内のトラブルシューティング参照）

### Step 2 が失敗した場合

以下を確認:
- E2E テストの出力
- `development_docs/game/game-e2e-review-system.md` の知見
- サーバー接続状態

### Step 3 の一部が失敗した場合

成功したスキルの成果物のみ報告し、失敗したスキルはエラー内容を記載。

---

## 注意事項

- 各 Step は前の Step が成功した場合のみ実行
- Step 3 の3スキルは互いに独立しているため、1つが失敗しても他は続行可能
- サーバーは Step 1 で起動され、全 Step 完了まで稼働し続ける
