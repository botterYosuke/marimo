---
name: skills-improve
description: "スキル改善実装: game-master-orchestrate の実行結果を分析し、P1改善項目を自動的に各スキルに適用する"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

# Skills Improvement Implementation

## 役割

`game-master-orchestrate` の実行結果を多角的に分析し、各スキル自体の改善機会を P1/P2/P3 で優先度付けして**実装する**。

スキル自体をコード成果物として扱い、実行パターンを分析 → 改善提案 → **自動実装** → 検証のフィードバックループを作る。

## 実行フロー

### Phase 1: メトリクス収集

#### Step 1: metrics-collector-agent

`agents/metrics-collector-agent.md` の指示に従ってメトリクスを収集:

1. 各スキルの実行時間を抽出（タイムラインから）
2. 成功率・リトライ回数を計算
3. 生成ドキュメント数を集計
4. テスト結果を集計

**Input Sources**:
- `development_docs/game-master-orchestrate/execution-timeline-*.md` — 実行時間
- `development_docs/bug-fix-orchestrate-summary.md` — バグ修正結果
- `development_docs/game-improvements/game-improve-orchestrate-summary-*.md` — 改善結果
- `development_docs/issues/` — Issue ファイル（✅ vs 未解決の比率）

**Output**: `development_docs/skills-improvements/metrics-YYYY-MM-DD.json`

**検証ゲート**:
- [ ] metrics JSON ファイルが生成
- [ ] 全7スキルのメトリクスを含む

---

### Phase 2: パターン分析

#### Step 2: pattern-analyzer-agent

`agents/pattern-analyzer-agent.md` の指示に従ってパターンを分析:

1. リトライが多いエージェントを特定
2. ブロックされた項目の共通原因を特定
3. 実行時間のボトルネックを特定
4. ドキュメント品質の傾向を分析

**Input Sources**:
- `development_docs/skills-improvements/metrics-YYYY-MM-DD.json` — Phase 1 の結果
- `development_docs/plans/fix-*.md` — バグ修正プランの品質チェック
- `development_docs/reviews/fix-*.md` — レビュー結果の観点分析
- `development_docs/game-improvements/improve-*-design.md` — デザインプランの品質

**Output**: `development_docs/skills-improvements/patterns-YYYY-MM-DD.md`

**検証ゲート**:
- [ ] patterns markdown ファイルが生成
- [ ] ボトルネック特定（上位3項目）
- [ ] 失敗パターン特定（上位3パターン）

---

### Phase 3: 改善提案生成

#### Step 3: recommendation-agent

`agents/recommendation-agent.md` の指示に従って提案を生成:

1. 各スキルごとに改善機会をリストアップ
2. 優先度を P1/P2/P3 で分類
3. 具体的な実装推奨を記述
4. クロススキル観点の改善を提案

**Input Sources**:
- `development_docs/skills-improvements/metrics-YYYY-MM-DD.json` — Phase 1 の結果
- `development_docs/skills-improvements/patterns-YYYY-MM-DD.md` — Phase 2 の結果

**Output**: `development_docs/skills-improvements/skills-improve-summary-YYYY-MM-DD.md`

**検証ゲート**:
- [ ] summary markdown ファイルが生成
- [ ] 各スキル（7個）の改善機会を含む
- [ ] P1 改善項目 1件以上

---

### Phase 4: P1 改善実装（自動）

#### Step 4: 各 P1 改善項目を自動実装

recommendation-agent が生成した P1 改善項目（Critical 優先度）を自動的に実装する。

**実装対象**: P1 改善項目のみ（P2/P3 は次回スプリントで手動実装）

**実装手順**:

1. **P1 改善項目リストを抽出**
   ```bash
   grep -A 5 "### P1 - Critical" development_docs/skills-improvements/skills-improve-summary-*.md
   ```

2. **各 P1 項目について順次実装**

   例: "bug-fix-orchestrate: plan-agent に「コード例必須」追加"

   **Step 4.1**: 対象ファイルを読み込み
   ```bash
   # Read ツール
   .claude/skills/bug-fix-orchestrate/agents/plan-agent.md
   ```

   **Step 4.2**: Edit ツールで修正
   - 検証ゲートセクションに新しいチェック項目を追加
   - または、新しいセクションを追加

   **Step 4.3**: 変更内容を記録
   - `development_docs/skills-improvements/implementation-log-YYYY-MM-DD.md` に記録

3. **全 P1 項目完了後、検証**

   各修正したスキルファイルを Read して変更が反映されていることを確認。

**検証ゲート**:
- [ ] 全 P1 改善項目が実装済み
- [ ] implementation-log が生成
- [ ] 各スキル SKILL.md / agent.md が更新済み

**失敗時のアクション**: Warning → 実装できなかった項目を記録し、継続

---

### Phase 5: 最終サマリー & 次回への引き継ぎ

**Output**: `development_docs/skills-improvements/implementation-log-YYYY-MM-DD.md`

```markdown
# Skills Improvement Implementation Log - YYYY-MM-DD

## P1 改善項目実装結果

| # | 改善項目 | 対象ファイル | ステータス | 備考 |
|---|---------|------------|----------|------|
| 1 | plan-agent に「コード例必須」追加 | bug-fix-orchestrate/agents/plan-agent.md | ✅ 実装済み | 検証ゲートに追加 |
| 2 | review-agent に「Suggested Fix」追加 | bug-fix-orchestrate/agents/review-agent.md | ✅ 実装済み | 新セクション追加 |
| 3 | game-designer-agent に「Scope Boundary」追加 | game-improve-orchestrate/agents/game-designer-agent.md | ✅ 実装済み | デザインプランに必須化 |
| 4 | spec-selector-agent を追加 | game-e2e-add-coverage/agents/spec-selector-agent.md | ⚠️ スキップ | 新規ファイル作成は手動推奨 |

## 実装完了: 3/4 (75%)

## P2/P3 改善項目（次回スプリント）

（skills-improve-summary から自動コピー）

## 次のアクション

1. ✅ P1 改善項目を実装（自動完了）
2. ⬜ 次回 game-master-orchestrate 実行時に改善効果を測定
3. ⬜ P2 改善項目を手動で実装（優先度順）
```

**成果物更新**: skills-improve-summary-YYYY-MM-DD.md にも実装結果を追記

```markdown
## 次のアクション

1. ✅ P1 改善項目を自動実装（3/4 完了）— implementation-log-YYYY-MM-DD.md 参照
2. ⬜ 次回 game-master-orchestrate 実行時に改善効果を測定
3. ⬜ P2 改善項目を手動で実装
```

---

## Output Format

### skills-improve-summary-YYYY-MM-DD.md

```markdown
# Skills Improvement Analysis - YYYY-MM-DD

**実行対象**: game-master-orchestrate 全7ステップ
**分析期間**: YYYY-MM-DD HH:MM 〜 HH:MM (総実行時間: X時間Y分)

## エグゼクティブサマリー

### 全体成功率

| Skill | 成功率 | 実行時間 | 備考 |
|-------|--------|---------|------|
| game-orchestrate | 100% | 1h 24m | 全成果物生成 |
| game-e2e-add-coverage | 75% | 42m | 4/4 tests added, 0 blocked |
| bug-fix-orchestrate | 85% | 3h 18m | 17/20 fixed, 3 blocked |
| game-e2e (Step 4) | 95% | 8m 23s | 76/80 passed |
| game-improve-orchestrate | 78% | 2h 51m | 7/9 completed, 2 blocked |
| game-e2e (Step 6) | 96% | 8m 41s | 77/80 passed (+1 vs Step 4) |
| skills-improve | 100% | 18m | 23 recommendations |

### 主要ボトルネック

1. bug-fix-orchestrate の fix-agent リトライが多い (平均2.3回/bug)
2. game-e2e-add-coverage のテスト実装に設計判断が必要 (手動介入2回)
3. game-improve-orchestrate の P3 改善でスコープクリープ発生

## スキル別改善提案

### 1. game-orchestrate

**実行メトリクス**:
- 実行時間: 1h 24m
- 成功率: 100%
- 生成ドキュメント: 4 files

**強み**:
- Step 1-2-3 の順次実行が安定している
- /game-setup の READY/FAILED 判定が明確
- 並列分析 (Step 3) が Task ツールで正常動作

**改善機会**:
- **Opportunity 1**: Step 3 の並列分析完了を待つタイムアウトが固定 (現在: 無制限待機)
  - **提案**: 各並列タスクに timeout (30分) を設定し、超過時は警告
  - **優先度**: P2 (Medium)

- **Opportunity 2**: game-bug-hunt の出力が issues/ に直接書き込まれるが、重複チェックがない
  - **提案**: 既存 Issue との重複を事前にチェックして dedup
  - **優先度**: P3 (Low)

**実装推奨**:
- SKILL.md の Step 3 に timeout 追加
- agents/ に `dedup-agent.md` を追加 (optional)

---

### 2. game-e2e-add-coverage

**実行メトリクス**:
- 処理 Issue 数: 4
- テスト追加成功: 4
- ブロック: 0
- 実行時間: 42m

**強み**:
- Phase 1 の未カバーIssue特定ロジックが正確 (✅なしをフィルタ)
- 既存テストパターンを参照して実装する設計が良い
- helpers.ts の活用度が高い

**改善機会**:
- **Opportunity 1**: テスト実装時の「追加先スペック選定」に時間がかかる (10分/test)
  - **提案**: 選定基準を decision tree 形式にして、自動判定を優先
  - **優先度**: P1 (High)

- **Opportunity 2**: 新規スペック作成時のテンプレートが SKILL.md に埋め込まれているが、コピペしづらい
  - **提案**: `agents/test-template.ts` を作成して Read で参照
  - **優先度**: P2 (Medium)

**実装推奨**:
- agents/spec-selector-agent.md を追加 (decision tree)
- agents/test-template.ts を追加

---

### 3. bug-fix-orchestrate

**実行メトリクス**:
- 処理バグ数: 20
- 修正完了: 17 (85%)
- 修正試行中 (ブロック): 3 (15%)
- 平均リトライ: fix-agent 2.3回, review-agent 1.1回
- 実行時間: 3h 18m

**強み**:
- Per-Bug Fault Isolation が効果的 (1つ失敗しても次へ)
- env-agent + app-agent の環境整備が安定
- plan-agent → fix-agent → review-agent のループが自己修正的

**改善機会**:
- **Opportunity 1**: fix-agent のリトライ回数が多い (平均2.3回)
  - **根本原因**: plan-agent のプランが具体的でない (特に「変更前/変更後コード例」が不足)
  - **提案**: plan-agent の品質ゲートに「コード例必須」を追加
  - **優先度**: P1 (High)

- **Opportunity 2**: review-agent → fix-agent ループが3回上限だが、2回目以降の修正が同じエラーを繰り返す
  - **根本原因**: review-agent のフィードバックが「何が悪いか」のみで「どう直すか」が不明確
  - **提案**: review-agent に「修正案 (Suggested Fix)」セクションを追加
  - **優先度**: P1 (High)

- **Opportunity 3**: testplay-agent の手動検証が参考情報のみで、失敗時のアクションがない
  - **提案**: testplay-agent 失敗時に「手動検証推奨」フラグを立て、サマリーに明記
  - **優先度**: P3 (Low)

**実装推奨**:
- agents/plan-agent.md の Quality Gate に「コード例必須」を追加
- agents/review-agent.md に「Suggested Fix」セクションを追加
- testplay-agent.md の出力フォーマットに fail-action を追加

---

### 4. game-e2e

**実行メトリクス (Step 4)**:
- テスト実行: 80 tests
- 結果: 76 passed / 0 failed / 4 skipped
- 実行時間: 8m 23s

**実行メトリクス (Step 6)**:
- テスト実行: 80 tests
- 結果: 77 passed / 0 failed / 3 skipped
- 実行時間: 8m 41s
- リグレッション: なし (Step 4 → Step 6 で +1 passed)

**強み**:
- helpers.ts の ensureConnected() / resetGameProgress() が非常に安定
- 知見ドキュメント (game-e2e-review-system.md) が充実
- global-setup/teardown が backcast.py / game_test.py 汚染を自動復元

**改善機会**:
- **Opportunity 1**: Step 4 と Step 6 で skipped 数が変化 (4 → 3)
  - **根本原因**: 不明 (要調査)
  - **提案**: skipped テストのリストを出力して変化を追跡
  - **優先度**: P2 (Medium)

- **Opportunity 2**: SKILL.md に「失敗時のデバッグフロー」が詳細だが、自動化されていない
  - **提案**: agents/debug-agent.md を作成し、失敗時に自動診断
  - **優先度**: P2 (Medium)

**実装推奨**:
- SKILL.md に skipped tests tracking を追加
- agents/debug-agent.md を追加 (optional)

---

### 5. game-improve-orchestrate

**実行メトリクス**:
- 処理項目数: 9
- 完了: 7 (78%)
- 修正試行中 (ブロック): 2 (22%)
- 平均リトライ: game-programmer-agent 1.8回, review-agent 0.6回
- 実行時間: 2h 51m

**強み**:
- game-designer-agent の優先度リスト作成が明確
- デザインプラン (improve-*-design.md) がゲームデザイン観点で書かれている
- game-programmer-agent のゲーム整合性チェック (DAG, 報酬計算, スキル数) が効果的

**改善機会**:
- **Opportunity 1**: P3 改善で「スコープクリープ」が発生 (improve-priority-indicator → 複数UI変更に拡大)
  - **根本原因**: デザインプランの「影響範囲」が曖昧
  - **提案**: game-designer-agent に「Scope Boundary」セクションを追加し、明示的に範囲を限定
  - **優先度**: P1 (High)

- **Opportunity 2**: game-programmer-agent のリトライが実装ミスではなく「ゲーム整合性チェック失敗」で発生
  - **根本原因**: デザインプランが DAG 制約を考慮していない
  - **提案**: game-designer-agent のプラン作成時に DAG simulation を実行
  - **優先度**: P2 (Medium)

**実装推奨**:
- agents/game-designer-agent.md に「Scope Boundary」と「DAG Simulation」を追加
- game-programmer-agent.md の整合性チェックを強化

---

### 6. game-master-orchestrate

**実行メトリクス**:
- 総実行時間: 8h 49m
- ステップ完了: 7/7
- Critical Gates: 3/3 PASS

**強み**:
- 7ステップの順序実行が安定
- 検証ゲートが Critical vs Non-Critical を正しく区別
- 各ステップの成果物が全て生成されている

**改善機会**:
- **Opportunity 1**: 実行時間が長い (約9時間)
  - **提案**: Step 2 (game-e2e-add-coverage) と Step 3 (bug-fix-orchestrate) を並列実行できないか検討
  - **優先度**: P2 (Medium)
  - **課題**: 両者が issues/ を同時に書き換える可能性があり、競合リスクあり

- **Opportunity 2**: validation-report の生成タイミングが Phase 5 (最後)
  - **提案**: 各ステップ完了時にリアルタイムで validation-report を更新
  - **優先度**: P3 (Low)

**実装推奨**:
- 並列実行の可能性を調査（依存関係分析）
- validation-report をストリーミング更新

---

### 7. skills-improve

**実行メトリクス**:
- 実行時間: 18m
- 生成レポート: 1 file
- 推奨事項数: 23 items

**強み**:
- 3つのエージェント（metrics, pattern, recommendation）が明確に分離
- メトリクス JSON が構造化されており、再利用可能
- 優先度付け (P1/P2/P3) が明確

**改善機会**:
- **Opportunity 1**: このスキル自体が初回実行のため、履歴比較ができない
  - **提案**: 次回実行時に前回の metrics.json と比較し、改善効果を測定
  - **優先度**: P2 (Medium)

- **Opportunity 2**: recommendation-agent が手動で優先度を判定している
  - **提案**: リトライ回数・実行時間・成功率から自動的に P1/P2/P3 を計算するロジックを追加
  - **優先度**: P3 (Low)

**実装推奨**:
- metrics-collector-agent に「前回比較」機能を追加
- recommendation-agent に優先度計算ロジックを追加

---

## クロススキル観点

### データフロー効率

- **観察**: game-orchestrate の fun-review → game-improve-orchestrate の priority-list 抽出が手動
- **提案**: game-improve-orchestrate が fun-review を直接パースして自動優先度付け
- **優先度**: P2

### 重複作業の削減

- **観察**: bug-fix-orchestrate と game-improve-orchestrate が同じ env-agent / app-agent を実行
- **提案**: game-master-orchestrate が Phase 1 で一度だけ env/app を起動し、全スキルで共有
- **優先度**: P3

### テスト安定性

- **観察**: game-e2e が各スキル後に実行されるが、環境汚染の可能性
- **提案**: game-e2e 実行前に必ず `resetGameProgress()` + `git status` で状態確認
- **優先度**: P2

---

## 実装優先度まとめ

### P1 - Critical (即座に対応推奨)

1. **bug-fix-orchestrate**: plan-agent に「コード例必須」追加
2. **bug-fix-orchestrate**: review-agent に「Suggested Fix」追加
3. **game-improve-orchestrate**: game-designer-agent に「Scope Boundary」追加
4. **game-e2e-add-coverage**: spec-selector-agent を追加 (decision tree)

### P2 - High (次回スプリント)

5. **game-orchestrate**: Step 3 並列タスクに timeout 追加
6. **game-e2e**: skipped tests tracking 追加
7. **game-improve-orchestrate**: DAG simulation 追加
8. **クロススキル**: データフロー自動化

### P3 - Polish (将来検討)

9. **game-orchestrate**: dedup-agent 追加
10. **game-e2e-add-coverage**: test-template.ts 追加
11. **クロススキル**: env/app 共有化

---

## 次のアクション

1. ✅ このサマリーを `development_docs/skills-improvements/skills-improve-summary-YYYY-MM-DD.md` として保存
2. ⬜ P1 改善項目を新しい Issue として `development_docs/issues/` に追加
3. ⬜ 各スキルの SKILL.md を更新 (P1 改善を反映)
4. ⬜ 次回 game-master-orchestrate 実行時に改善効果を測定
```

---

## エラーハンドリング

### Phase 1 失敗

**症状**: metrics JSON が生成できない

**原因候補**:
- タイムラインファイルが存在しない
- サマリーファイルが存在しない
- JSON パースエラー

**アクション**: 警告のみ出力し、Phase 2 へ進む（部分的なメトリクスでも価値がある）

### Phase 2 失敗

**症状**: patterns markdown が生成できない

**原因候補**:
- metrics JSON が不完全
- プランファイルが存在しない
- パターン抽出ロジックエラー

**アクション**: 警告のみ出力し、Phase 3 へ進む（メトリクスのみでも recommendation 生成可能）

### Phase 3 失敗

**症状**: summary markdown が生成できない

**原因候補**:
- 入力ファイルが全て欠損
- recommendation ロジックエラー

**アクション**: 警告のみ出力し、部分的な summary を生成

### Phase 4 失敗

**症状**: P1 改善項目の実装が失敗

**原因候補**:
- 対象ファイルが存在しない
- Edit ツールでの修正箇所が特定できない
- 新規ファイル作成が必要（spec-selector-agent 等）

**アクション**:
- 失敗した項目を implementation-log に記録
- スキップして次の P1 項目へ進む
- 新規ファイル作成が必要な項目は「手動推奨」としてマーク

---

## 注意事項

- このスキルは他のスキルに依存しないため、失敗しても game-master-orchestrate 全体の成否に影響しない
- メタ分析は「あると便利」だが「必須ではない」— 失敗は許容
- 初回実行時は履歴比較ができないため、次回以降に真価を発揮
- **P1 改善項目を自動実装**するため、次回 game-master-orchestrate 実行時に改善効果が自動測定される
- 新規ファイル作成（spec-selector-agent 等）は手動推奨（既存ファイルの修正のみ自動化）

---

## 成功基準

1. ✅ metrics-YYYY-MM-DD.json が生成
2. ✅ patterns-YYYY-MM-DD.md が生成
3. ✅ skills-improve-summary-YYYY-MM-DD.md が生成
4. ✅ 全7スキルの改善機会をリストアップ
5. ✅ P1 改善項目 1件以上
6. ✅ 優先度 (P1/P2/P3) が明確
7. ✅ **P1 改善項目の 70% 以上が自動実装済み** (implementation-log 参照)
8. ✅ implementation-log-YYYY-MM-DD.md が生成

---

## 実行例

```
# スキル実行
/skills-improve

# Phase 1: メトリクス収集
→ metrics-collector-agent: Collecting metrics from 7 skills...
  → タイムライン読み込み: execution-timeline-2026-02-21.md ✅
  → バグ修正サマリー読み込み: bug-fix-orchestrate-summary.md ✅
  → 改善サマリー読み込み: game-improve-orchestrate-summary-2026-02-21.md ✅
  → Issue カウント: 17 fixed, 3 blocked ✅
  → metrics-2026-02-21.json 生成 ✅

# Phase 2: パターン分析
→ pattern-analyzer-agent: Analyzing execution patterns...
  → ボトルネック特定: bug-fix-orchestrate (3h 18m), game-improve-orchestrate (2h 51m) ✅
  → リトライパターン: fix-agent (avg 2.3), game-programmer-agent (avg 1.8) ✅
  → 失敗パターン: スコープクリープ, プラン不足, DAG制約違反 ✅
  → patterns-2026-02-21.md 生成 ✅

# Phase 3: 改善提案生成
→ recommendation-agent: Generating improvement recommendations...
  → game-orchestrate: 2 opportunities (P2, P3) ✅
  → game-e2e-add-coverage: 2 opportunities (P1, P2) ✅
  → bug-fix-orchestrate: 3 opportunities (P1, P1, P3) ✅
  → game-e2e: 2 opportunities (P2, P2) ✅
  → game-improve-orchestrate: 2 opportunities (P1, P2) ✅
  → game-master-orchestrate: 2 opportunities (P2, P3) ✅
  → skills-improve: 2 opportunities (P2, P3) ✅
  → クロススキル観点: 3 opportunities (P2, P3, P2) ✅
  → skills-improve-summary-2026-02-21.md 生成 ✅

# Phase 4: P1 改善実装
→ Implementing P1 improvements automatically...
  → P1 #1: plan-agent に「コード例必須」追加
    → Read: .claude/skills/bug-fix-orchestrate/agents/plan-agent.md ✅
    → Edit: 検証ゲートに新項目追加 ✅
  → P1 #2: review-agent に「Suggested Fix」追加
    → Read: .claude/skills/bug-fix-orchestrate/agents/review-agent.md ✅
    → Edit: 新セクション「Suggested Fix」追加 ✅
  → P1 #3: game-designer-agent に「Scope Boundary」追加
    → Read: .claude/skills/game-improve-orchestrate/agents/game-designer-agent.md ✅
    → Edit: デザインプランに必須セクション追加 ✅
  → P1 #4: spec-selector-agent を追加
    → ⚠️ SKIP: 新規ファイル作成は手動推奨 ⚠️
  → implementation-log-2026-02-21.md 生成 ✅

# Phase 5: 最終サマリー更新
→ Updating skills-improve-summary with implementation results... ✅

🎉 Skills Improvement Implementation Completed! (28m)
   Analysis: 23 recommendations (4 P1, 8 P2, 11 P3)
   Implementation: 3/4 P1 items (75%) ✅
```
