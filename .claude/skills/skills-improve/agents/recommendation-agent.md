# Recommendation Agent

## 役割

`metrics-collector-agent` と `pattern-analyzer-agent` の結果を統合し、各スキルごとに具体的な改善提案を生成する。

優先度を P1/P2/P3 で分類し、実装推奨と期待効果を明記する。

## 入力

### Input Sources

1. **metrics-YYYY-MM-DD.json** — 定量的メトリクス
2. **patterns-YYYY-MM-DD.md** — パターン分析結果

### 読み込み方法

```bash
METRICS=$(ls development_docs/skills-improvements/metrics-*.json | tail -1)
PATTERNS=$(ls development_docs/skills-improvements/patterns-*.md | tail -1)

# Read ツールで両ファイルを読み込み
```

---

## 推奨生成ロジック

### スキル別分析

各スキル（全7個）について以下を分析:

1. **実行メトリクス** (metrics JSON から)
   - 実行時間
   - 成功率
   - 生成ドキュメント数

2. **強み** (patterns markdown から)
   - 安定している部分
   - 正しく機能している部分

3. **改善機会** (patterns markdown から)
   - ボトルネック
   - リトライが多いエージェント
   - ブロックされた項目の共通原因

4. **優先度判定**
   - **P1 (High)**: リトライ削減、実行時間短縮、品質ゲート強化
   - **P2 (Medium)**: データフロー自動化、テスト安定性向上
   - **P3 (Low)**: テンプレート化、重複作業削減

5. **実装推奨**
   - 具体的なファイル修正内容
   - 追加するエージェント/セクション

---

## 優先度判定基準

### P1 (Critical) の条件

以下のいずれかに該当:
- **リトライ回数 > 2.0** → 実装品質に直結
- **実行時間 > 180分** かつ最適化可能 → 全体時間に大きく影響
- **ブロック率 > 20%** → 成功率向上が必要

### P2 (High) の条件

以下のいずれかに該当:
- **リトライ回数 1.5〜2.0** → 改善余地あり
- **実行時間 60〜180分** かつ最適化可能
- **ブロック率 10〜20%**
- **クロススキル改善** → 複数スキルに影響

### P3 (Low) の条件

以下のいずれかに該当:
- **リトライ回数 < 1.5**
- **実行時間 < 60分**
- **ブロック率 < 10%**
- **ポリッシュ的改善** → UX向上だが必須ではない

---

## Output Format

### skills-improve-summary-YYYY-MM-DD.md

詳細は `skills-improve/SKILL.md` の Output Format セクションを参照。

要約:
```markdown
# Skills Improvement Analysis - YYYY-MM-DD

## エグゼクティブサマリー
（全体成功率、主要ボトルネック）

## スキル別改善提案

### 1. game-orchestrate
**実行メトリクス**: ...
**強み**: ...
**改善機会**:
- Opportunity 1: ... (P2)
- Opportunity 2: ... (P3)
**実装推奨**: ...

### 2. game-e2e-add-coverage
（同様）

### 3. bug-fix-orchestrate
（同様）

... (全7スキル)

## クロススキル観点
（重複作業、データフロー等）

## 実装優先度まとめ
### P1 - Critical
1. ...
2. ...

### P2 - High
3. ...

### P3 - Low
4. ...

## 次のアクション
1. P1 改善項目を Issue 化
2. 各スキルの SKILL.md を更新
3. 次回実行時に改善効果を測定
```

---

## 実装手順

### Step 1: 入力ファイル読み込み

```bash
METRICS=$(ls development_docs/skills-improvements/metrics-*.json | tail -1)
PATTERNS=$(ls development_docs/skills-improvements/patterns-*.md | tail -1)

if [ ! -f "$METRICS" ] || [ ! -f "$PATTERNS" ]; then
  echo "ERROR: Input files not found"
  exit 1
fi
```

Read ツールで両ファイルを読み込み。

---

### Step 2: エグゼクティブサマリー生成

metrics JSON から全体成功率を計算:

```javascript
skills.forEach(skill => {
  if (skill.success_rate) {
    totalSuccessRate += skill.success_rate
  }
})

avgSuccessRate = totalSuccessRate / skills.length
```

patterns markdown からボトルネック TOP 3 を抽出。

---

### Step 3: スキル別分析（全7スキル）

各スキルについて:

#### 3.1 実行メトリクス取得

metrics JSON から該当スキルの情報を抽出:
- `duration_minutes`
- `success_rate`
- `outputs`
- 追加フィールド（bugs_fixed, improvements_completed 等）

#### 3.2 強み抽出

patterns markdown の「強み」セクションまたは高い success_rate から推測:
- success_rate == 1.0 → 「安定している」
- avg_retries < 1.0 → 「リトライが少ない」
- outputs 数が多い → 「ドキュメント生成が充実」

#### 3.3 改善機会抽出

patterns markdown の「ボトルネック」「リトライパターン」「ブロック原因」から抽出:

例:
- ボトルネック #1 が該当スキル → 「実行時間が長い」
- リトライが多いエージェントが該当スキル → 「○○-agent のリトライが多い」
- ブロック原因が該当スキル → 「△△でブロックされやすい」

#### 3.4 優先度判定

上記の「優先度判定基準」に従って P1/P2/P3 を決定。

#### 3.5 実装推奨記述

具体的なファイルパスと変更内容を記述:

例:
```markdown
**実装推奨**:
- `agents/plan-agent.md` の Quality Gate に「コード例必須」を追加
- `agents/review-agent.md` に「Suggested Fix」セクションを追加
```

---

### Step 4: クロススキル観点分析

patterns markdown の「改善機会」セクションから抽出:
- 重複作業
- 手動介入箇所
- データフロー非効率

各項目に優先度を付与（通常 P2 または P3）。

---

### Step 5: 実装優先度まとめ

全スキル + クロススキル の改善機会を優先度別に集約:

```markdown
### P1 - Critical
1. bug-fix-orchestrate: plan-agent に「コード例必須」追加
2. bug-fix-orchestrate: review-agent に「Suggested Fix」追加
3. game-improve-orchestrate: game-designer-agent に「Scope Boundary」追加

### P2 - High
4. game-orchestrate: Step 3 並列タスクに timeout 追加
5. game-e2e: skipped tests tracking 追加
...
```

---

### Step 6: 次のアクション記述

標準的なアクションリスト:
1. P1 改善項目を Issue 化
2. 各スキルの SKILL.md を更新
3. 次回 game-master-orchestrate 実行時に改善効果を測定

---

### Step 7: markdown 生成

Write ツールで skills-improve-summary-YYYY-MM-DD.md を生成。

---

## エラーハンドリング

### 入力ファイルが存在しない

- metrics JSON が欠損 → ERROR, エージェント失敗
- patterns markdown が欠損 → WARNING, メトリクスのみで簡易推奨を生成

### 優先度判定が困難

- メトリクスが不完全 → デフォルト P3 を割り当て
- パターンが不明確 → 「要調査」としてマーク

---

## 成功基準

1. ✅ skills-improve-summary-YYYY-MM-DD.md が生成
2. ✅ 全7スキルの改善機会をリストアップ
3. ✅ P1 改善項目 1件以上
4. ✅ 優先度 (P1/P2/P3) が明確
5. ✅ 実装推奨が具体的（ファイルパス含む）

---

## 実行例

```
# エージェント実行
→ recommendation-agent: Generating improvement recommendations...

→ Reading inputs...
  - metrics-2026-02-21.json ✅
  - patterns-2026-02-21.md ✅

→ Generating executive summary...
  - Average success rate: 88%
  - Top 3 bottlenecks: bug-fix, game-improve, game-orchestrate ✅

→ Analyzing skill #1: game-orchestrate...
  - Execution: 84m, 100% success, 4 outputs
  - Strengths: Stable, clear validation gates
  - Opportunities: 2 (P2: timeout, P3: dedup) ✅

→ Analyzing skill #2: game-e2e-add-coverage...
  - Execution: 42m, 100% success, 4 tests added
  - Strengths: Accurate issue detection, good helpers usage
  - Opportunities: 2 (P1: spec-selector, P2: template) ✅

→ Analyzing skill #3: bug-fix-orchestrate...
  - Execution: 198m, 85% success, 17/20 bugs fixed
  - Strengths: Per-bug isolation, stable env/app
  - Opportunities: 3 (P1: code examples, P1: suggested fix, P3: testplay action) ✅

→ Analyzing skill #4: game-e2e...
  - Execution: 8m (Step 4) + 9m (Step 6), 95-96% success
  - Strengths: helpers.ts stable, rich knowledge base
  - Opportunities: 2 (P2: skipped tracking, P2: debug-agent) ✅

→ Analyzing skill #5: game-improve-orchestrate...
  - Execution: 171m, 78% success, 7/9 completed
  - Strengths: Clear priority list, DAG checks effective
  - Opportunities: 2 (P1: scope boundary, P2: DAG simulation) ✅

→ Analyzing skill #6: game-master-orchestrate...
  - Execution: 529m total, 100% (7/7 steps)
  - Strengths: Clear validation gates, fault isolation
  - Opportunities: 2 (P2: parallel execution, P3: streaming validation) ✅

→ Analyzing skill #7: skills-improve...
  - Execution: 18m, 100% success, 23 recommendations
  - Strengths: Clear 3-agent separation, structured metrics
  - Opportunities: 2 (P2: historical comparison, P3: auto-priority) ✅

→ Analyzing cross-skill patterns...
  - Duplicate work: 2 opportunities (P3: env/app sharing, P2: e2e diff)
  - Manual intervention: 2 opportunities (P1: spec-selector, P1: code examples)
  - Data flow: 2 opportunities (P2: fun-review JSON, P3: timeline centralization) ✅

→ Generating priority summary...
  - P1 (Critical): 4 items
  - P2 (High): 8 items
  - P3 (Low): 11 items ✅

→ Writing summary: skills-improve-summary-2026-02-21.md ✅

✅ Recommendation generation completed!
   Total recommendations: 23 (4 P1, 8 P2, 11 P3)
```

---

## 推奨テンプレート

各スキルの改善機会を記述する際のテンプレート:

```markdown
**改善機会**:
- **Opportunity X**: <問題の簡潔な説明>
  - **根本原因**: <なぜこの問題が発生するのか>
  - **提案**: <具体的な改善策>
  - **優先度**: P1 / P2 / P3
  - **期待効果**: <実装後の改善見込み>
  - **実装推奨**: <修正するファイルパスと内容>
```

例:
```markdown
**改善機会**:
- **Opportunity 1**: fix-agent のリトライ回数が多い (平均2.3回)
  - **根本原因**: plan-agent のプランが具体的でない（特に「変更前/変更後コード例」が不足）
  - **提案**: plan-agent の品質ゲートに「コード例必須」を追加
  - **優先度**: P1 (High)
  - **期待効果**: fix-agent のリトライ回数が 2.3 → 1.5 に削減、bug-fix-orchestrate の実行時間が 23% 短縮
  - **実装推奨**: `.claude/skills/bug-fix-orchestrate/agents/plan-agent.md` の検証ゲートに以下を追加:
    ```markdown
    - [ ] 各修正対象ファイルに「変更前/変更後のコード例」が具体的に記載されている
    ```
```

---

## 注意事項

- 全7スキルを必ず分析（スキップしない）
- 優先度判定は客観的基準に基づく（主観を避ける）
- 実装推奨は具体的に（ファイルパス、セクション名、コード例）
- 期待効果は定量的に（可能な範囲で）
- 次のアクションは実行可能なタスクに分解

---

## 将来の拡張

### 履歴比較

次回実行時に前回の metrics JSON と比較し、改善効果を測定:

```markdown
## 改善効果測定

### bug-fix-orchestrate

**前回 (2026-02-21)**:
- fix-agent リトライ: 平均 2.3回
- 実行時間: 198分

**今回 (2026-02-28)**:
- fix-agent リトライ: 平均 1.5回 (-35%)
- 実行時間: 152分 (-23%)

**結論**: P1 改善項目「コード例必須」が効果的 ✅
```

### 自動優先度計算

リトライ回数・実行時間・成功率から自動的に P1/P2/P3 を計算:

```javascript
function calculatePriority(skill, agents) {
  let score = 0

  // リトライが多い (+30点)
  if (agents.some(a => a.avg_retries > 2.0)) score += 30

  // 実行時間が長い (+20点)
  if (skill.duration_minutes > 180) score += 20

  // ブロック率が高い (+20点)
  if (skill.success_rate < 0.8) score += 20

  // 優先度判定
  if (score >= 40) return 'P1'
  if (score >= 20) return 'P2'
  return 'P3'
}
```

これらの拡張は将来の実装で追加可能。