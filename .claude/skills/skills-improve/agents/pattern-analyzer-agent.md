# Pattern Analyzer Agent

## 役割

`metrics-collector-agent` が収集したメトリクスと、各スキルが生成したドキュメントを分析し、以下のパターンを特定する:

1. **ボトルネック**: 実行時間が長いスキル・エージェント
2. **失敗パターン**: リトライが多いエージェント、ブロックされる項目の共通原因
3. **ドキュメント品質**: プラン・レビューの品質傾向
4. **改善機会**: 自動化可能な手動作業、重複作業

## 分析対象

### 1. 実行時間ボトルネック

**Input Source**: `development_docs/skills-improvements/metrics-YYYY-MM-DD.json`

分析ロジック:
```javascript
// skills 配列を duration_minutes でソート
skills.sort((a, b) => b.duration_minutes - a.duration_minutes)

// 上位3つがボトルネック
top3_bottlenecks = skills.slice(0, 3)
```

**Output Example**:
```markdown
### 実行時間ボトルネック

1. **bug-fix-orchestrate** (198分, 37%)
   - 内訳: 20バグ × 平均9.9分/bug
   - 主要な時間消費: fix-agent リトライ (avg 2.3回)

2. **game-improve-orchestrate** (171分, 32%)
   - 内訳: 9改善項目 × 平均19分/item
   - 主要な時間消費: game-programmer-agent リトライ (avg 1.8回)

3. **game-orchestrate** (84分, 16%)
   - 内訳: Step 2 (game-play) が約72分
   - 最適化余地: なし（ゲームプレイ時間は固定）
```

---

### 2. リトライパターン

**Input Source**: `development_docs/skills-improvements/metrics-YYYY-MM-DD.json` の `agents` 配列

分析ロジック:
```javascript
// agents 配列を avg_retries でソート
agents.sort((a, b) => b.avg_retries - a.avg_retries)

// avg_retries > 1.5 のエージェントが問題
high_retry_agents = agents.filter(a => a.avg_retries > 1.5)
```

**Output Example**:
```markdown
### リトライが多いエージェント

1. **fix-agent** (avg 2.3回, 20回実行)
   - 原因候補: plan-agent のプランが具体的でない
   - 影響: bug-fix-orchestrate の実行時間が 23% 増加

2. **game-programmer-agent** (avg 1.8回, 9回実行)
   - 原因候補: デザインプランが DAG 制約を考慮していない
   - 影響: game-improve-orchestrate の実行時間が 18% 増加
```

---

### 3. ブロックされた項目の共通原因

**Input Sources**:
- `development_docs/bug-fix-orchestrate-summary.md` — ブロックされたバグの理由
- `development_docs/game-improvements/game-improve-orchestrate-summary-*.md` — ブロックされた改善項目の理由

分析ロジック:
```bash
# バグ修正サマリーから「ブロッカー:」を抽出
grep "ブロッカー:" development_docs/bug-fix-orchestrate-summary.md

# 改善サマリーから「ブロッカー:」を抽出
grep "ブロッカー:" development_docs/game-improvements/game-improve-orchestrate-summary-*.md

# 共通パターンを手動で特定（例: コンパイルエラー、テスト失敗、レビュー不合格）
```

**Output Example**:
```markdown
### ブロックされた項目の共通原因

**バグ修正 (3件ブロック)**:
1. コンパイルエラー (2件) — fix-agent が3回リトライ後も解決できず
2. テスト失敗 (1件) — E2E テストが不安定

**改善項目 (2件ブロック)**:
1. スコープクリープ (1件) — デザインプランが影響範囲を明示していない
2. DAG 制約違反 (1件) — ゲーム整合性チェックで失敗

**パターン**:
- プラン品質 → リトライ回数に直結
- デザイン段階での制約チェック不足 → 実装段階で失敗
```

---

### 4. ドキュメント品質分析

**Input Sources**:
- `development_docs/plans/fix-*.md` — バグ修正プランの品質
- `development_docs/reviews/fix-*.md` — レビュー結果の観点
- `development_docs/game-improvements/improve-*-design.md` — デザインプラン

分析観点:
1. **プランの具体性**: コード例が含まれているか
2. **レビューのフィードバック**: 建設的か、修正案が含まれているか
3. **デザインプランのスコープ**: 影響範囲が明確か

サンプリング方法:
```bash
# ランダムに5つのプランファイルを読み込み
ls development_docs/plans/fix-*.md | shuf -n 5

# 各ファイルで「変更前/変更後」セクションの有無をチェック
grep -l "変更前\|変更後" <file>
```

**Output Example**:
```markdown
### ドキュメント品質分析

**バグ修正プラン (20件サンプリング: 5件)**:
- コード例含む: 2/5 (40%)
- 修正対象ファイルリスト含む: 5/5 (100%)
- テスト戦略明記: 3/5 (60%)

**観察**:
- コード例が不足 → fix-agent のリトライ増加
- テスト戦略が曖昧 → test-agent でエラー

**レビュー結果 (27件サンプリング: 5件)**:
- APPROVED: 4/5 (80%)
- CHANGES_REQUESTED: 1/5 (20%)
- 修正案 (Suggested Fix) 含む: 0/5 (0%)

**観察**:
- 修正案がない → fix-agent が同じエラーを繰り返す

**デザインプラン (9件全件)**:
- Scope Boundary 明記: 3/9 (33%)
- DAG Simulation 実行: 0/9 (0%)
- 成功基準明確: 8/9 (89%)

**観察**:
- Scope 未明記 → スコープクリープ発生
- DAG チェックなし → game-programmer-agent で失敗
```

---

### 5. 改善機会の特定

**分析観点**:
1. **重複作業**: 複数スキルが同じ処理を実行
2. **手動介入**: 自動化可能だが人間判断が必要な箇所
3. **データフロー非効率**: ファイル経由のデータ受け渡し

**Input Sources**:
- 全スキルの SKILL.md を読み込み
- サマリーファイルから「手動介入」「警告」を検索

**Output Example**:
```markdown
### 改善機会

#### 重複作業

1. **env-agent / app-agent の重複実行**
   - bug-fix-orchestrate と game-improve-orchestrate が両方とも実行
   - 提案: game-master-orchestrate が一度だけ起動し、全スキルで共有

2. **game-e2e の2回実行**
   - Step 4 と Step 6 で同じテストを実行
   - 提案: 差分実行（Step 4 で失敗したテストのみ Step 6 で再実行）

#### 手動介入が必要な箇所

1. **game-e2e-add-coverage: スペック選定**
   - テスト実装時に「どのスペックファイルに追加するか」を判断
   - 提案: decision tree で自動判定

2. **bug-fix-orchestrate: プラン品質チェック**
   - plan-agent の出力を人間が検証
   - 提案: 品質ゲートに「コード例必須」を追加して自動化

#### データフロー非効率

1. **fun-review → game-improve-orchestrate**
   - fun-review が markdown 生成 → game-improve-orchestrate が手動でパース
   - 提案: 構造化データ (JSON) で受け渡し

2. **タイムライン記録**
   - 各スキルが個別に実行時間を記録
   - 提案: game-master-orchestrate が一元管理
```

---

## Output Format

### patterns-YYYY-MM-DD.md

```markdown
# Pattern Analysis - YYYY-MM-DD

**分析対象**: game-master-orchestrate 全7ステップ
**入力**: metrics-2026-02-21.json

## 1. 実行時間ボトルネック

（上記の Output Example 参照）

## 2. リトライが多いエージェント

（上記の Output Example 参照）

## 3. ブロックされた項目の共通原因

（上記の Output Example 参照）

## 4. ドキュメント品質分析

（上記の Output Example 参照）

## 5. 改善機会

（上記の Output Example 参照）

---

## サマリー

### Top 3 Bottlenecks
1. bug-fix-orchestrate (198分, fix-agent リトライ多)
2. game-improve-orchestrate (171分, game-programmer-agent リトライ多)
3. game-orchestrate (84分, game-play が固定時間)

### Top 3 Failure Patterns
1. プラン品質不足 → fix-agent / game-programmer-agent リトライ
2. スコープ未明記 → スコープクリープ
3. DAG チェック不足 → ゲーム整合性エラー

### Top 3 Improvement Opportunities
1. plan-agent 品質ゲート強化 (P1)
2. デザインプラン Scope Boundary 追加 (P1)
3. env/app 共有化 (P3)
```

---

## 実装手順

### Step 1: metrics JSON 読み込み

```bash
METRICS=$(ls development_docs/skills-improvements/metrics-*.json | tail -1)

if [ ! -f "$METRICS" ]; then
  echo "ERROR: Metrics file not found"
  exit 1
fi
```

Read ツールで JSON を読み込み、内容を解析。

### Step 2: ボトルネック特定

skills 配列を duration_minutes でソート → 上位3つを抽出。

### Step 3: リトライパターン特定

agents 配列を avg_retries でソート → avg_retries > 1.5 のエージェントを抽出。

### Step 4: ブロックされた項目の原因分析

```bash
# バグ修正サマリー読み込み
BUG_SUMMARY="development_docs/bug-fix-orchestrate-summary.md"
grep "ブロッカー:" "$BUG_SUMMARY"

# 改善サマリー読み込み
IMPROVE_SUMMARY=$(ls development_docs/game-improvements/game-improve-orchestrate-summary-*.md | tail -1)
grep "ブロッカー:" "$IMPROVE_SUMMARY"
```

### Step 5: ドキュメント品質分析

```bash
# ランダムサンプリング
PLAN_SAMPLES=$(ls development_docs/plans/fix-*.md | shuf -n 5)

# 各ファイルで「変更前/変更後」をチェック
for file in $PLAN_SAMPLES; do
  if grep -q "変更前\|変更後" "$file"; then
    echo "✅ $file contains code examples"
  else
    echo "❌ $file lacks code examples"
  fi
done
```

### Step 6: 改善機会特定

手動分析（LLM の推論能力を活用）:
- 重複作業の特定: SKILL.md を比較
- 手動介入箇所: サマリーから「手動」「警告」を検索
- データフロー: ファイル読み書きパターンを分析

### Step 7: markdown 生成

Write ツールで patterns-YYYY-MM-DD.md を生成。

---

## エラーハンドリング

### metrics JSON が存在しない

- ERROR → エージェント失敗
- Phase 1 (metrics-collector-agent) が失敗した可能性

### サマリーファイルが存在しない

- WARNING → 該当スキルが未実行と判断
- 部分的な分析で継続

### サンプリングでファイルが少ない

- 例: プランファイルが5件未満
- WARNING → 利用可能なファイル全てを使用

---

## 成功基準

1. ✅ patterns-YYYY-MM-DD.md が生成
2. ✅ ボトルネック特定（上位3項目）
3. ✅ 失敗パターン特定（上位3パターン）
4. ✅ 改善機会特定（5項目以上）

---

## 実行例

```
# エージェント実行
→ pattern-analyzer-agent: Analyzing execution patterns...

→ Reading metrics: metrics-2026-02-21.json ✅
  - Total skills: 7
  - Total agents: 7
  - Total duration: 529 minutes

→ Analyzing bottlenecks...
  - #1: bug-fix-orchestrate (198m, 37%)
  - #2: game-improve-orchestrate (171m, 32%)
  - #3: game-orchestrate (84m, 16%) ✅

→ Analyzing retry patterns...
  - fix-agent: avg 2.3 retries (HIGH)
  - game-programmer-agent: avg 1.8 retries (HIGH)
  - review-agent (bug-fix): avg 1.1 retries (MEDIUM) ✅

→ Analyzing blocked items...
  - Bugs blocked: 3 (コンパイルエラー 2, テスト失敗 1)
  - Improvements blocked: 2 (スコープクリープ 1, DAG制約 1) ✅

→ Analyzing document quality (sampling 5 files)...
  - Plans with code examples: 2/5 (40%)
  - Reviews with suggested fix: 0/5 (0%)
  - Design plans with scope boundary: 3/9 (33%) ✅

→ Identifying improvement opportunities...
  - Duplicate work: 2 opportunities
  - Manual intervention: 2 opportunities
  - Data flow inefficiency: 2 opportunities ✅

→ Generating patterns report: patterns-2026-02-21.md ✅

✅ Pattern analysis completed!
   - Top 3 bottlenecks identified
   - Top 3 failure patterns identified
   - 6 improvement opportunities identified
```