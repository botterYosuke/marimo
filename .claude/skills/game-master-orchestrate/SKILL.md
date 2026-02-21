---
name: game-master-orchestrate
description: "メタオーケストレーション: game-orchestrate → game-e2e-add-coverage → bug-fix-orchestrate → game-e2e → game-improve-orchestrate → game-e2e → skills-improve を順次実行"
allowed-tools:
  - Skill
  - Read
  - Write
  - Glob
  - Bash
---

# Game Master Orchestration

## 役割

ゲーム開発ワークフロー全体を統合管理する最上位オーケストレーター。
7つのステップを順次実行し、各ステップ間で検証ゲートを設けることで、品質を担保しながら以下のサイクルを完走する:

1. ゲームプレイ & 初期分析
2. テストカバレッジ追加 & バグ修正
3. ゲーム改善 & 最終検証
4. スキル自体のメタ分析

## 実行フロー

### Phase 1: ゲームプレイ & 初期分析

#### Step 1: /game-orchestrate

```
/game-orchestrate
```

**目的**: ゲーム全体をプレイし、バグ・マニュアル誤り・面白さの3観点で分析する。

**成果物**:
- `development_docs/game-play-reports/play-log-YYYY-MM-DD.md` — プレイログ
- `development_docs/game-play-reports/fun-review-YYYY-MM-DD.md` — 面白さ評価
- `development_docs/game-play-reports/manual-review-YYYY-MM-DD.md` — マニュアルレビュー
- `development_docs/issues/` に新規 Issue（バグがあった場合）

**検証ゲート**:
- [ ] play-log-YYYY-MM-DD.md が存在
- [ ] fun-review-YYYY-MM-DD.md が存在
- [ ] manual-review-YYYY-MM-DD.md が存在
- [ ] issues/ に新規 Issue が追加（0件以上）

検証方法:
```bash
ls development_docs/game-play-reports/play-log-*.md | tail -1
ls development_docs/game-play-reports/fun-review-*.md | tail -1
ls development_docs/game-play-reports/manual-review-*.md | tail -1
```

**失敗時のアクション**: Critical Failure → オーケストレーション全体を中断
- エラーレポートを生成
- トラブルシューティングガイドを表示

---

### Phase 2: テストカバレッジ追加 & バグ修正

#### Step 2: /game-e2e-add-coverage

```
/game-e2e-add-coverage
```

**目的**: `development_docs/issues/` の未カバー Issue に対応する E2E テストを実装・実行する。

**成果物**:
- `frontend/e2e-tests/game/*.spec.ts` に新規テスト追加
- `development_docs/issues/✅*.md` — Issue ファイル名に ✅ プレフィックス付与

**検証ゲート**:
- [ ] 未カバー Issue に ✅ プレフィックス付与（1件以上）
- [ ] 新規テスト追加（1件以上）

検証方法:
```bash
# ✅プレフィックスが追加されたIssue数を確認
ls development_docs/issues/✅*.md | wc -l
```

**失敗時のアクション**: Warning → 継続
- Per-Item Fault Isolation: 一部テスト追加が失敗しても次のステップへ
- 失敗内容をサマリーに記録

---

#### Step 3: /bug-fix-orchestrate

```
/bug-fix-orchestrate
```

**目的**: `development_docs/issues/` の未解決バグを優先度順に修正する。

**成果物**:
- `development_docs/plans/fix-*.md` — バグ修正プラン
- `development_docs/reviews/fix-*.md` — コードレビュー
- `development_docs/testplay/fix-*.md` — テストプレイレポート（High以上）
- `development_docs/bug-fix-orchestrate-summary.md` — 最終サマリー
- `development_docs/issues/✅*.md` — 修正済みバグ

**検証ゲート**:
- [ ] bug-fix-orchestrate-summary.md が生成
- [ ] 修正完了バグ 1件以上

検証方法:
```bash
# サマリーファイル存在確認
test -f development_docs/bug-fix-orchestrate-summary.md && echo "PASS" || echo "FAIL"

# 修正完了バグ数を確認
grep "✅ 修正済み" development_docs/bug-fix-orchestrate-summary.md | wc -l
```

**失敗時のアクション**: Warning → 継続
- Per-Bug Fault Isolation: 一部バグ修正が失敗しても次のステップへ
- 失敗内容をサマリーに記録

---

#### Step 4: /game-e2e (validation checkpoint)

```
/game-e2e
```

**引数**: なし（フルスイート実行）

**目的**: バグ修正後の E2E テストを実行し、リグレッションがないことを確認する。

**成果物**:
- テスト結果（stdout）
- `frontend/test-results/` — Playwright レポート

**検証ゲート**:
- [ ] 75+ tests passed

検証方法:
Playwright の出力から passed 数を抽出:
```
例: "80 passed (5 skipped)" → 80 ≥ 75 → PASS
```

**失敗時のアクション**: Critical Failure → オーケストレーション全体を中断
- リグレッション検出: バグ修正によって既存機能が壊れた
- エラーレポートを生成
- 手動デバッグを促す

---

### Phase 3: ゲーム改善 & 最終検証

#### Step 5: /game-improve-orchestrate

```
/game-improve-orchestrate
```

**目的**: fun-review レポートから改善項目を抽出し、優先度順に UX/デザイン改善を実装する。

**成果物**:
- `development_docs/game-improvements/priority-list-YYYY-MM-DD.md` — 優先度リスト
- `development_docs/game-improvements/improve-*-design.md` — デザインプラン
- `development_docs/game-improvements/improve-*-implementation.md` — 実装レポート
- `development_docs/game-improvements/improve-*-review.md` — レビュー
- `development_docs/game-improvements/improve-*-testplay.md` — テストプレイ（P1-P2のみ）
- `development_docs/game-improvements/game-improve-orchestrate-summary-YYYY-MM-DD.md` — 最終サマリー

**検証ゲート**:
- [ ] game-improve-orchestrate-summary-YYYY-MM-DD.md が生成
- [ ] 完了改善項目 1件以上

検証方法:
```bash
# 最新サマリー確認
ls development_docs/game-improvements/game-improve-orchestrate-summary-*.md | tail -1

# 完了項目数を確認
grep "✅ 完了" development_docs/game-improvements/priority-list-*.md | wc -l
```

**失敗時のアクション**: Warning → 継続
- Per-Improvement Fault Isolation: 一部改善が失敗しても次のステップへ
- 失敗内容をサマリーに記録

---

#### Step 6: /game-e2e (final validation)

```
/game-e2e
```

**引数**: なし（フルスイート実行）

**目的**: ゲーム改善後の E2E テストを実行し、リグレッションがないことを確認する。

**成果物**:
- テスト結果（stdout）
- `frontend/test-results/` — Playwright レポート

**検証ゲート**:
- [ ] 75+ tests passed
- [ ] リグレッションなし（Step 4 と比較して passed 数が減っていない）

検証方法:
1. Playwright の出力から passed 数を抽出
2. Step 4 の結果と比較:
   - Step 6 passed ≥ Step 4 passed → PASS
   - Step 6 passed < Step 4 passed → FAIL (regression detected)

**失敗時のアクション**: Critical Failure → オーケストレーション全体を中断
- リグレッション検出: ゲーム改善によって既存機能が壊れた
- エラーレポートを生成
- 手動デバッグを促す

---

### Phase 4: スキルメタ分析

#### Step 7: /skills-improve

```
/skills-improve
```

**目的**: 全ステップの実行結果を分析し、各スキル自体の改善機会を P1/P2/P3 で優先度付けして提案する。

**成果物**:
- `development_docs/skills-improvements/metrics-YYYY-MM-DD.json` — メトリクス
- `development_docs/skills-improvements/patterns-YYYY-MM-DD.md` — パターン分析
- `development_docs/skills-improvements/skills-improve-summary-YYYY-MM-DD.md` — 最終サマリー

**検証ゲート**:
- [ ] skills-improve-summary-YYYY-MM-DD.md が生成

検証方法:
```bash
# 最新サマリー確認
ls development_docs/skills-improvements/skills-improve-summary-*.md | tail -1
```

**失敗時のアクション**: Warning のみ → 継続
- メタ分析の失敗は許容（部分的な成果でも価値がある）
- 失敗内容をサマリーに記録

---

### Phase 5: 最終サマリー

全 7 ステップ完了後、最終サマリーを生成する。

#### 出力ファイル

**1. master-orchestrate-summary-YYYY-MM-DD.md**

```markdown
# Game Master Orchestration Summary - YYYY-MM-DD

**開始**: YYYY-MM-DD HH:MM
**完了**: YYYY-MM-DD HH:MM
**総実行時間**: X時間Y分

## 実行結果サマリー

| Step | Skill | ステータス | 実行時間 | 成果物 | 備考 |
|------|-------|----------|---------|--------|------|
| 1 | game-orchestrate | ✅ 完了 / ❌ 失敗 | Xh Ym | 4 files | 全スキル取得: X/59 |
| 2 | game-e2e-add-coverage | ✅ 完了 / ⚠️ 部分完了 | Xm | X tests added | X blocked |
| 3 | bug-fix-orchestrate | ✅ 完了 / ⚠️ 部分完了 | Xh Ym | X/Y fixed | Y blocked |
| 4 | game-e2e (validation) | ✅ 完了 / ❌ 失敗 | Xm | X/Y passed | |
| 5 | game-improve-orchestrate | ✅ 完了 / ⚠️ 部分完了 | Xh Ym | X/Y completed | Y blocked |
| 6 | game-e2e (final) | ✅ 完了 / ❌ 失敗 | Xm | X/Y passed | +/- Z vs Step 4 |
| 7 | skills-improve | ✅ 完了 / ⚠️ 失敗 | Xm | 1 report | X recommendations |

## 成果物一覧

### game-play-reports/
- play-log-YYYY-MM-DD.md
- fun-review-YYYY-MM-DD.md
- manual-review-YYYY-MM-DD.md

### issues/
- ✅ X bugs fixed
- ⬜ Y bugs blocked
- ✅ Z test coverage added

### plans/ & reviews/ & testplay/
- X fix plans
- X reviews
- X testplay reports (High以上)

### game-improvements/
- priority-list-YYYY-MM-DD.md
- X design plans
- X implementation reports
- X reviews
- game-improve-orchestrate-summary-YYYY-MM-DD.md

### skills-improvements/
- skills-improve-summary-YYYY-MM-DD.md

## 検証ゲート結果

| Gate | 基準 | 実績 | ステータス |
|------|------|------|----------|
| Step 1 完了 | play-log + 3 reports | ✅ 4 files | PASS / FAIL |
| Step 2 完了 | Issue 更新 + テスト追加 | ✅ X/X | PASS |
| Step 3 完了 | バグ修正完了 | ⚠️ X/Y | PASS (X%) |
| Step 4 検証 | 75+ tests passed | ✅ X/Y | PASS / FAIL |
| Step 5 完了 | 改善完了 | ⚠️ X/Y | PASS (X%) |
| Step 6 検証 | リグレッションなし | ✅ X/Y (+/-Z) | PASS / FAIL |
| Step 7 完了 | 改善レポート生成 | ✅ X items | PASS |

## ブロックされた項目

### Bugs (Y件)
（該当があれば記載）
1. <slug>: ブロッカー: <理由>
2. <slug>: ブロッカー: <理由>

### Improvements (Y件)
（該当があれば記載）
1. <slug>: ブロッカー: <理由>
2. <slug>: ブロッカー: <理由>

## 推奨次のアクション

1. skills-improve の P1 改善項目を Issue 化
2. ブロックされた X 項目を手動で対処
3. 次回 game-master-orchestrate 実行時に改善効果を測定

## Fun-Review スコア変化（予測）

- **改善前**: ★★★☆☆ (X/5) — Step 1 fun-review より
- **改善後**: ★★★★☆ (X/5) — 予測値

**理由**: P1-P2 改善項目 X 件完了により、UX問題・デザインギャップが大幅解消
```

ファイルパス: `development_docs/game-master-orchestrate/master-orchestrate-summary-YYYY-MM-DD.md`

**2. execution-timeline-YYYY-MM-DD.md**

```markdown
# Game Master Orchestration Timeline - YYYY-MM-DD

| Step | Skill | 開始 | 終了 | 実行時間 | ステータス |
|------|-------|------|------|---------|----------|
| 1 | game-orchestrate | HH:MM | HH:MM | Xh Ym | ✅ / ❌ |
| 2 | game-e2e-add-coverage | HH:MM | HH:MM | Xm | ✅ / ⚠️ |
| 3 | bug-fix-orchestrate | HH:MM | HH:MM | Xh Ym | ✅ / ⚠️ |
| 4 | game-e2e (validation) | HH:MM | HH:MM | Xm | ✅ / ❌ |
| 5 | game-improve-orchestrate | HH:MM | HH:MM | Xh Ym | ✅ / ⚠️ |
| 6 | game-e2e (final) | HH:MM | HH:MM | Xm | ✅ / ❌ |
| 7 | skills-improve | HH:MM | HH:MM | Xm | ✅ / ⚠️ |

**総実行時間**: X時間Y分
```

ファイルパス: `development_docs/game-master-orchestrate/execution-timeline-YYYY-MM-DD.md`

**3. validation-report-YYYY-MM-DD.md**

```markdown
# Validation Report - YYYY-MM-DD

## Step 1: game-orchestrate

**検証項目**:
- [ ] play-log-YYYY-MM-DD.md 存在 — ✅ PASS / ❌ FAIL
- [ ] fun-review-YYYY-MM-DD.md 存在 — ✅ PASS / ❌ FAIL
- [ ] manual-review-YYYY-MM-DD.md 存在 — ✅ PASS / ❌ FAIL
- [ ] issues/ に新規 Issue 追加 — ✅ PASS (X 件)

**判定**: ✅ PASS / ❌ FAIL

---

## Step 2: game-e2e-add-coverage

**検証項目**:
- [ ] 未カバー Issue に ✅ プレフィックス付与 — ✅ PASS (X 件)
- [ ] 新規テスト追加 — ✅ PASS (X tests)

**判定**: ✅ PASS / ⚠️ PARTIAL

---

## Step 3: bug-fix-orchestrate

**検証項目**:
- [ ] bug-fix-orchestrate-summary.md 生成 — ✅ PASS / ❌ FAIL
- [ ] 修正完了バグ 1件以上 — ✅ PASS (X bugs)

**判定**: ✅ PASS / ⚠️ PARTIAL

---

## Step 4: game-e2e (validation)

**検証項目**:
- [ ] 75+ tests passed — ✅ PASS (X/Y passed) / ❌ FAIL

**判定**: ✅ PASS / ❌ FAIL (Critical)

---

## Step 5: game-improve-orchestrate

**検証項目**:
- [ ] game-improve-orchestrate-summary-YYYY-MM-DD.md 生成 — ✅ PASS / ❌ FAIL
- [ ] 完了改善項目 1件以上 — ✅ PASS (X items)

**判定**: ✅ PASS / ⚠️ PARTIAL

---

## Step 6: game-e2e (final)

**検証項目**:
- [ ] 75+ tests passed — ✅ PASS (X/Y passed) / ❌ FAIL
- [ ] リグレッションなし — ✅ PASS (+/-Z vs Step 4) / ❌ FAIL

**判定**: ✅ PASS / ❌ FAIL (Critical)

---

## Step 7: skills-improve

**検証項目**:
- [ ] skills-improve-summary-YYYY-MM-DD.md 生成 — ✅ PASS / ❌ FAIL

**判定**: ✅ PASS / ⚠️ FAIL

---

## 総合判定

**Critical Gates**: 3/3 PASS / X/3 FAIL
**Non-Critical Gates**: 4/4 PASS / X/4 PARTIAL

**オーケストレーション結果**: ✅ SUCCESS / ⚠️ PARTIAL SUCCESS / ❌ FAILED
```

ファイルパス: `development_docs/game-master-orchestrate/validation-report-YYYY-MM-DD.md`

---

## エラーハンドリング

### Critical Failures（オーケストレーション全体を中断）

以下の場合、オーケストレーション全体を中断し、エラーレポートを生成する:

1. **Step 1 (game-orchestrate) FAILED**
   - 原因: サーバー起動失敗、E2E テスト環境エラー
   - 影響: プレイログがないと後続ステップが全て意味をなさない
   - アクション: 部分的なサマリーを生成し、FAILED マークを付ける

2. **Step 4 (game-e2e) < 70 tests passed**
   - 原因: バグ修正によるリグレッション
   - 影響: 既存機能が壊れており、改善を進めても無意味
   - アクション: 部分的なサマリーを生成し、デバッグガイドを提示

3. **Step 6 (game-e2e) regression detected**
   - 原因: ゲーム改善によるリグレッション
   - 影響: Step 4 で通過したテストが失敗している
   - アクション: 部分的なサマリーを生成し、改善内容のロールバックを提案

### Non-Critical Failures（継続）

以下の場合、警告を記録して次のステップへ進む:

1. **Step 2 (game-e2e-add-coverage) 部分完了**
   - 原因: 一部テストの実装が困難（手動介入必要）
   - アクション: 成功したテスト数をサマリーに記録、ブロックされた Issue をリスト化

2. **Step 3 (bug-fix-orchestrate) 部分完了**
   - 原因: 一部バグ修正が失敗（コンパイルエラー、レビュー不合格等）
   - アクション: 修正完了バグ数をサマリーに記録、ブロックされたバグをリスト化

3. **Step 5 (game-improve-orchestrate) 部分完了**
   - 原因: 一部改善項目が失敗（デザイン問題、実装困難等）
   - アクション: 完了改善項目数をサマリーに記録、ブロックされた項目をリスト化

4. **Step 7 (skills-improve) 失敗**
   - 原因: メトリクス収集エラー、分析ロジックエラー
   - アクション: 警告のみ出力（メタ分析は必須ではない）

### Retry Strategy

- **オーケストレーションレベル**: リトライなし（各スキルが内部でリトライを実装済み）
- **Step 4 & 6 (game-e2e)**: Playwright の `--retries=1` フラグを使用してフレークテスト対策

---

## 実装の詳細

### 現在の日付取得

```bash
date +%Y-%m-%d
```

### 出力ディレクトリ作成

スキル実行前に必要なディレクトリを作成:

```bash
mkdir -p development_docs/game-master-orchestrate
mkdir -p development_docs/skills-improvements
```

### 実行時間計測

各ステップの開始時・終了時に時刻を記録:

```bash
# 開始時
START_TIME=$(date +%H:%M)

# 終了時
END_TIME=$(date +%H:%M)
```

### Step 4 と Step 6 の比較

Step 4 の結果を変数に保存し、Step 6 で比較:

```bash
# Step 4 実行後
STEP4_PASSED=$(grep -oP '\d+(?= passed)' <<< "$STEP4_OUTPUT")

# Step 6 実行後
STEP6_PASSED=$(grep -oP '\d+(?= passed)' <<< "$STEP6_OUTPUT")

# リグレッション判定
if [ "$STEP6_PASSED" -lt "$STEP4_PASSED" ]; then
  echo "❌ REGRESSION DETECTED: Step 4 had $STEP4_PASSED passed, Step 6 has $STEP6_PASSED"
  # Critical Failure
fi
```

---

## 注意事項

- 各ステップは前のステップの成果物に依存するため、順序は固定
- Critical Failure が発生した場合でも、部分的なサマリーは生成される（デバッグ情報として有用）
- Step 7 (skills-improve) は他のステップに依存しないため、失敗しても全体の成否に影響しない
- サマリーファイルにはタイムスタンプを含めることで、複数回実行時の履歴追跡が可能
- オーケストレーション全体の実行時間は 4〜8 時間程度を想定（game-orchestrate の play が約1.2時間、bug-fix-orchestrate が 2〜4時間等）

---

## 成功基準

オーケストレーション完了時に以下を達成:

1. ✅ 全 7 ステップが完了（または部分完了）
2. ✅ Critical Gates が全て PASS（Step 1, 4, 6）
3. ✅ master-orchestrate-summary-YYYY-MM-DD.md が生成
4. ✅ execution-timeline-YYYY-MM-DD.md が生成
5. ✅ validation-report-YYYY-MM-DD.md が生成
6. ✅ skills-improve-summary-YYYY-MM-DD.md が生成（Step 7 成功の場合）

---

## 実行例

```
# スキル実行
/game-master-orchestrate

# Phase 1: ゲームプレイ & 初期分析
→ Step 1: /game-orchestrate
  → 開始: 10:00
  → 完了: 11:24 (1h 24m)
  → ステータス: ✅ 完了
  → 成果物: play-log + 3 reports ✅

# Phase 2: テストカバレッジ追加 & バグ修正
→ Step 2: /game-e2e-add-coverage
  → 開始: 11:24
  → 完了: 12:06 (42m)
  → ステータス: ⚠️ 部分完了 (4/4 tests added, 0 blocked)

→ Step 3: /bug-fix-orchestrate
  → 開始: 12:06
  → 完了: 15:24 (3h 18m)
  → ステータス: ⚠️ 部分完了 (17/20 fixed, 3 blocked)

→ Step 4: /game-e2e (validation)
  → 開始: 15:24
  → 完了: 15:32 (8m)
  → ステータス: ✅ 完了 (76/80 passed)

# Phase 3: ゲーム改善 & 最終検証
→ Step 5: /game-improve-orchestrate
  → 開始: 15:32
  → 完了: 18:23 (2h 51m)
  → ステータス: ⚠️ 部分完了 (7/9 completed, 2 blocked)

→ Step 6: /game-e2e (final)
  → 開始: 18:23
  → 完了: 18:31 (8m)
  → ステータス: ✅ 完了 (77/80 passed, +1 vs Step 4)

# Phase 4: スキルメタ分析
→ Step 7: /skills-improve
  → 開始: 18:31
  → 完了: 18:49 (18m)
  → ステータス: ✅ 完了 (23 recommendations)

# Phase 5: 最終サマリー
→ サマリー生成: development_docs/game-master-orchestrate/master-orchestrate-summary-2026-02-21.md ✅
→ タイムライン生成: development_docs/game-master-orchestrate/execution-timeline-2026-02-21.md ✅
→ 検証レポート生成: development_docs/game-master-orchestrate/validation-report-2026-02-21.md ✅

🎉 Game Master Orchestration Completed! (8h 49m)
```
