---
name: game-improve-orchestrate
description: "ゲーミフィケーション改善オーケストレーション: fun-review レポートから改善項目を抽出し、優先度順に実装・テスト・レビューを自動実行"
allowed-tools:
  - Skill
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

# ゲーミフィケーション改善オーケストレーション

## 役割

`development_docs/game-play-reports/` の fun-review レポートから改善項目を抽出し、優先度順にゲーミフィケーションを改善する総合オーケストレーター。

7つのエージェント（環境構築→起動→デザイン分析→実装→レビュー→テスト→テストプレイ）を段階的に実行し、各改善の完了を確認する。

## bug-fix-orchestrate との違い

- **bug-fix-orchestrate**: 機能的なバグ修正（テスト失敗、クラッシュ）
- **game-improve-orchestrate**: 体験的な改善（UX問題、デザインギャップ、エンゲージメント最適化）

## 実行フロー

### Phase 1: 環境準備（Sequential）

#### Step 1.1: 環境構築エージェント

`D:\Documents\marimo\.claude\skills\bug-fix-orchestrate\agents\env-agent.md` の指示に従って環境を整備:

1. `/game-setup` スキルを実行して開発環境を整備
2. 必要な依存関係を確認（playwright, pixi, pnpm）
3. ビルドチェック実行（`pnpm fe-check`, `make py-check`）

**検証ゲート**: 出力が `READY` であることを確認。`FAILED` の場合はオーケストレーション全体を中断してエラーを報告。

#### Step 1.2: アプリ起動エージェント

`D:\Documents\marimo\.claude\skills\bug-fix-orchestrate\agents\app-agent.md` の指示に従ってサーバーを起動:

1. 既存プロセスをクリーンアップ
2. marimo サーバーを起動（port 2718, 3000）
3. E2E テストサーバーを起動（port 2724）
4. 接続確認

**検証ゲート**: 全サーバーが起動していることを確認。失敗時は手動介入を促して中断。

---

### Phase 2: レポート分析（Sequential）

#### Step 2.1: ゲームデザイナーエージェント - レポート解析

`agents/game-designer-agent.md` の指示に従ってレポートを解析:

1. 最新の fun-review レポート（`development_docs/game-play-reports/fun-review-*.md`）を読む
2. 改善提案を優先度別に抽出（P1: Critical / P2: High / P3: Polish）
3. `development_docs/issues/` と照合してゲーム関連バグを確認
4. 優先度リストを `development_docs/game-improvements/priority-list-YYYY-MM-DD.md` に出力

**検証ゲート**: 優先度リストが以下を含むことを確認
- [ ] fun-review の全P1-P2項目がリストに含まれている
- [ ] 各項目にカテゴリ（Bug/UX/Design/Content）が設定されている

検証失敗時は game-designer-agent を再実行（最大2回）。

---

### Phase 3: 改善ループ（各改善項目ごとに実行）

優先度リストの各項目を **優先度順**（P1 → P2 → P3）に処理:

#### Step 3.1: ゲームデザイナーエージェント - デザインプラン作成

`agents/game-designer-agent.md` の指示に従ってデザインプランを策定:

1. 優先度リストの項目を読む
2. 関連ファイルを調査（skill-data.ts, game_setup.py 等）
3. 現状分析と理想状態を明確化
4. 実装アプローチを検討（選択肢と推奨案）
5. 成功基準を定義
6. デザインプランを `development_docs/game-improvements/improve-<slug>-design.md` に出力

**検証ゲート**: プランが以下を含むことを確認
- [ ] 現状（Current State）と理想状態（Desired State）の明確な記述
- [ ] デザイン理由（fun/engagement への影響）の説明
- [ ] 具体的な実装アプローチ（曖昧でない）
- [ ] 測定可能な成功基準

検証失敗時は game-designer-agent を再実行（最大2回）。

---

#### Step 3.2: ゲームプログラマーエージェント - 実装

`agents/game-programmer-agent.md` の指示に従って実装:

1. デザインプラン（`development_docs/game-improvements/improve-<slug>-design.md`）を読む
2. Edit ツールで各ファイルを修正:
   - スキルツリー修正（skill-data.ts, 前提条件, 報酬）
   - 報酬システム変更（マイルストーン, 通貨）
   - ヘルプコンテンツ追加（helpContent フィールド）
   - HUD 更新（ステータス表示, 進捗インジケーター）
   - アニメーション/ポリッシュ（トースト通知, 実績画面）
3. ゲーム整合性チェック:
   - スキル前提条件が有効なDAG（循環なし）
   - 報酬の計算が正しい
   - helpContent が正しいAPI例を使用
   - トーストメッセージがプレイヤーフレンドリー
4. コンパイルエラーチェック（`pnpm fe-check`, `make py-check`）
5. スキルデータ検証（skill-data.ts が59スキル、重複IDなし）
6. 実装レポートを `development_docs/game-improvements/improve-<slug>-implementation.md` に出力

**検証ゲート**: 以下を確認
- [ ] デザインプラン記載の全ファイルを修正済み
- [ ] ゲーム整合性チェックが全て通過（DAG, 報酬計算, スキル数）
- [ ] コンパイルエラーなし

検証失敗時は game-programmer-agent を再実行（最大3回）。3回失敗後は「修正試行中（ブロッカー: <理由>）」として次の改善項目へ。

---

#### Step 3.3: コードレビュー

`D:\Documents\marimo\.claude\skills\bug-fix-orchestrate\agents\review-agent.md` の指示に従ってレビュー:

1. デザインプランと修正後のコードを読む
2. 以下の観点でレビュー:
   - プラン整合性
   - 型安全性
   - エラーハンドリング
   - パフォーマンス
   - 可読性・保守性
3. **ゲームUX観点**でレビュー:
   - [ ] プレイヤー向けテキストが励ます内容（否定的でない）
   - [ ] 実績が報酬的に感じられる
   - [ ] ヘルプコンテンツに具体例がある
   - [ ] エラーメッセージがフレンドリー
   - [ ] 視覚的フィードバックが明確
4. レビュー結果を `development_docs/game-improvements/improve-<slug>-review.md` に出力

**検証ゲート**: レビュー結果が `APPROVED` であることを確認

- `APPROVED`: Step 3.4 へ進む
- `CHANGES_REQUESTED`: Step 3.2 に戻る（最大3ループ）

3ループ後も `CHANGES_REQUESTED` の場合は「修正試行中（ブロッカー: レビュー不合格）」として次の改善項目へ。

---

#### Step 3.4: テスト実行

`D:\Documents\marimo\.claude\skills\bug-fix-orchestrate\agents\test-agent.md` の指示に従ってテスト:

1. 単体テスト実行（影響を受けるファイル）
2. E2E テスト実行（game/ スイート全体）
3. リグレッションチェック
4. テスト結果レポート出力

**検証ゲート**: 全テスト通過を確認
- [ ] 単体テスト通過
- [ ] E2E テスト通過（game/ スイート）
- [ ] リグレッションなし

テスト失敗時:
- エラー内容を game-programmer-agent にフィードバック
- Step 3.2 に戻る（最大3回）
- 3回失敗後は「修正試行中（ブロッカー: テスト失敗）」として次の改善項目へ

---

#### Step 3.5: テストプレイ（P1-P2のみ）

改善項目の優先度が P1 または P2 の場合のみ実行:

`D:\Documents\marimo\.claude\skills\bug-fix-orchestrate\agents\testplay-agent.md` の指示に従って手動検証:

1. デザインプランの「テストプラン」に記載されたシナリオを実行
2. 修正前の問題が発生しないことを確認
3. 関連するゲームフローをプレイ
4. スクリーンショット撮影
5. テストプレイレポートを `development_docs/game-improvements/improve-<slug>-testplay.md` に出力

**検証ゲート** (任意):
- [ ] デザインプランの成功基準が満たされている
- [ ] ユーザー体験が改善されている

失敗時は警告を出すが次のステップへ進む（手動テストは参考情報）。

---

#### Step 3.6: 改善項目ステータス更新

優先度リストファイルを更新:

```markdown
### X. <改善項目タイトル> ✅ COMPLETE
- **ステータス**: 実装完了（YYYY-MM-DD）
- **デザインプラン**: improve-<slug>-design.md
- **実装レポート**: improve-<slug>-implementation.md
- **レビュー**: APPROVED
- **テスト**: ✅ All pass
```

---

### Phase 4: 最終検証（全改善項目完了後）

全改善項目の処理が完了（または「修正試行中」でスキップ）したら、最終検証を実行:

#### 4.1: フル E2E スイート実行

```bash
cd D:/Documents/marimo/frontend && npx playwright test e2e-tests/game/ --reporter=line
```

**期待結果**: 全テスト通過（または既知のスキップのみ）

#### 4.2: 完全ゲームプレイテストプレイ

testplay-agent を「全59スキル完全プレイスルー」シナリオで実行:

- 全改善項目がゲームプレイで確認できることを検証
- 主要改善項目のスクリーンショット撮影

#### 4.3: 最終サマリー出力

`development_docs/game-improvements/game-improve-orchestrate-summary-YYYY-MM-DD.md` を生成:

```markdown
# ゲーミフィケーション改善オーケストレーション完了

**実行日**: YYYY-MM-DD
**ソース**: fun-review-YYYY-MM-DD.md
**処理項目数**: X 件
**完了項目数**: Y 件
**進行中項目数**: Z 件

## 完了した改善項目

| 優先度 | 項目 | Fun影響 | ステータス | 備考 |
|--------|------|---------|-----------|------|
| P1 | reconnect-skill-event-lost | ★3→★4 | ✅ 完了 | |
| P1 | skill-reward-negative-display | 混乱→明確 | ✅ 完了 | |
... (続く)

## 進行中の改善項目（ブロック中）

| 項目 | ブロッカー | 次のステップ |
|------|-----------|-------------|
| ai-fix-banner-in-game | ゲームモード検出が必要 | 手動実装が必要 |

## テスト結果

- **E2E テスト**: X passed / Y failed / Z skipped
- **単体テスト**: All pass
- **完全ゲームプレイ**: 全59スキル取得可能 ✅

## Fun-Review スコア予測

- **改善前**: ★★★☆☆ (3/5)
- **改善後**: ★★★★☆ (4/5) — P1-P2修正による推定

## 成果物

- **デザインプラン**: X ファイル（development_docs/game-improvements/）
- **実装レポート**: Y ファイル
- **レビュー**: Y ファイル
- **テストプレイレポート**: Z ファイル（P1-P2のみ）

## 推奨事項

1. 次回 fun-review セッションをスケジュールして改善を検証
2. P3 ポリッシュ項目を将来のスプリントで検討
3. 再接続シナリオのリグレッションテストを追加
```

---

## エラーハンドリング

### Per-Improvement Fault Isolation

各改善項目は独立して実行。失敗しても次の項目に進む:

```
try:
  Step 3.1: game-designer-agent (max 2 retries)
  Step 3.2: game-programmer-agent (max 3 retries)
  Step 3.3: review-agent (max 3 loops back to game-programmer-agent)
  Step 3.4: test-agent (max 3 retries with feedback to game-programmer-agent)
  Step 3.5: testplay-agent (if P1-P2, failure は警告のみ)
  Step 3.6: Update status to ✅
except MaxRetriesExceeded:
  Update status to "修正試行中（ブロッカー: <reason>）"
  Continue to next improvement
```

### Critical Failures (Stop Orchestration)

以下の場合はオーケストレーション全体を中断:

1. **env-agent FAILED**: 環境が整わないと全改善が不可能
   - トラブルシューティングガイドを表示
   - 手動介入を促す

2. **app-agent FAILED**: サーバーが起動しないとテストができない
   - サーバーログを確認
   - 手動起動を促す

### Retry Strategy

- **game-designer-agent design plan**: 最大2回リトライ（プラン品質が不十分な場合）
- **game-programmer-agent**: 最大3回リトライ（コンパイルエラー/ゲーム整合性エラー時）
- **review-agent → game-programmer-agent loop**: 最大3ループ（レビュー不合格時）
- **test-agent → game-programmer-agent loop**: 最大3ループ（テスト失敗時）
- **testplay-agent**: リトライなし（失敗は警告のみ）

---

## 既存インフラの活用

### /game-setup スキル
- env-agent で使用
- サーバー起動・ファイル配置・リセットを自動化

### helpers.ts
- test-agent で使用
- `ensureConnected()`, `waitForKernelHealthy()`, `resetGameProgress()` 等の関数を活用

### game-e2e-review-system.md
- test-agent でナレッジベースとして参照
- 知見35a（networkidle禁止）等のルールを適用

### 既存 E2E テスト
- test-agent で実行
- 改善の影響範囲を検証

---

## 既存スキルとの関係

### game-fun-review との関係
- game-fun-review が fun-review-*.md レポートを **生成**
- game-improve-orchestrate がそれらのレポートを **消費**

### bug-fix-orchestrate との関係
- bug-fix-orchestrate: **機能的なバグ**を修正（クラッシュ、テスト失敗）
- game-improve-orchestrate: **体験的な改善**を実装（UX、デザイン）
- **重複の解決**: issues/ にあり、かつ fun-review に言及されている場合 → game-improve-orchestrate が優先

### game-e2e との関係
- game-improve-orchestrate が test-agent を通じて game-e2e を **使用**
- 改善後、フル E2E スイートを実行して検証

---

## 注意事項

- 各改善項目は独立して実行（前の項目が失敗しても次の項目に進む）
- P1 改善を先に修正することで、後続の P2 改善のテストが安定化する
- テストプレイは P1-P2 の重要度の改善項目のみ（P3 はスキップ）
- 部分的成功を許容（一部改善項目が実装できなくても全体として進捗させる）

---

## 成功基準

オーケストレーション完了時に以下を達成:

1. ✅ 全改善項目が `✅ 完了` または「修正試行中」にマーク
2. ✅ フル E2E スイート通過（game/ suite）
3. ✅ 完全ゲームプレイで全59スキル取得可能
4. ✅ 最終サマリー生成（`development_docs/game-improvements/game-improve-orchestrate-summary-YYYY-MM-DD.md`）
5. ✅ Fun-review スコアの改善見込み（★3/5 → ★4/5以上）

---

## 実行例

```
# スキル実行
/game-improve-orchestrate

# Phase 1: 環境準備
→ env-agent: READY ✅
→ app-agent: Servers started ✅

# Phase 2: レポート分析
→ game-designer-agent: Priority list created (9 items: P1=3, P2=4, P3=2) ✅

# Phase 3: 改善項目 #1 (reconnect-skill-event-lost, P1)
→ game-designer-agent: Design plan created ✅
→ game-programmer-agent: 2 files modified (localStorage persistence added) ✅
→ review-agent: APPROVED ✅
→ test-agent: All tests pass ✅
→ testplay-agent: Verified (progress persists after reload) ✅
→ Status updated: ✅ 完了

# Phase 3: 改善項目 #2 (skill-reward-negative-display, P1)
→ game-designer-agent: Design plan created ✅
→ game-programmer-agent: 1 file modified (reward display fix) ✅
→ review-agent: APPROVED ✅
→ test-agent: All tests pass ✅
→ testplay-agent: Verified ("+30,000円" displays correctly) ✅
→ Status updated: ✅ 完了

... (続く全9項目)

# Phase 4: 最終検証
→ Full E2E suite: 80 passed ✅
→ Full gameplay: 59 skills ✅
→ Summary report: game-improve-orchestrate-summary-2026-02-21.md ✅

🎉 7/9 improvements completed successfully! (2 blocked, manual intervention needed)
```
