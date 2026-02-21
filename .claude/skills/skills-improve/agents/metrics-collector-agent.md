# Metrics Collector Agent

## 役割

`game-master-orchestrate` の実行結果から定量的メトリクスを収集し、JSON 形式で出力する。

## 収集対象

### 1. 実行時間

**Input Source**: `development_docs/game-master-orchestrate/execution-timeline-*.md`

抽出する情報:
- 各スキルの開始時刻 (HH:MM)
- 各スキルの終了時刻 (HH:MM)
- 各スキルの実行時間 (Xh Ym または Xm)

パースロジック:
```bash
# 最新のタイムラインファイルを取得
TIMELINE=$(ls development_docs/game-master-orchestrate/execution-timeline-*.md | tail -1)

# Grep でテーブル行を抽出
grep "| [0-9]" "$TIMELINE"
```

### 2. 成功率

**Input Sources**:
- `development_docs/game-master-orchestrate/validation-report-*.md` — 各ステップの検証結果
- `development_docs/bug-fix-orchestrate-summary.md` — バグ修正結果
- `development_docs/game-improvements/game-improve-orchestrate-summary-*.md` — 改善結果

抽出する情報:
- 各スキルのステータス (✅ 完了 / ⚠️ 部分完了 / ❌ 失敗)
- bug-fix-orchestrate: 修正完了バグ数 / 処理バグ数
- game-improve-orchestrate: 完了改善項目数 / 処理項目数

### 3. リトライ回数

**Input Sources**:
- `development_docs/bug-fix-orchestrate-summary.md` — エージェント別リトライ回数
- `development_docs/game-improvements/game-improve-orchestrate-summary-*.md` — エージェント別リトライ回数

抽出する情報:
- fix-agent の平均リトライ回数
- review-agent の平均リトライ回数
- game-programmer-agent の平均リトライ回数

パースロジック:
```bash
# サマリーファイルから「平均リトライ」を抽出
grep -oP "平均リトライ: \K[0-9.]+" development_docs/bug-fix-orchestrate-summary.md
```

### 4. 生成ドキュメント数

**Input Sources**:
- `development_docs/game-play-reports/` — play-log, fun-review, manual-review
- `development_docs/plans/` — fix-*.md
- `development_docs/reviews/` — fix-*.md, improve-*.md
- `development_docs/testplay/` — fix-*.md, improve-*.md
- `development_docs/game-improvements/` — improve-*.md, priority-list

カウントロジック:
```bash
# 各ディレクトリのファイル数をカウント
ls development_docs/game-play-reports/*.md | wc -l
ls development_docs/plans/fix-*.md | wc -l
ls development_docs/reviews/fix-*.md | wc -l
ls development_docs/testplay/fix-*.md | wc -l
ls development_docs/game-improvements/improve-*.md | wc -l
```

### 5. テスト結果

**Input Source**: `development_docs/game-master-orchestrate/validation-report-*.md`

抽出する情報:
- Step 4 (game-e2e validation): X/Y passed
- Step 6 (game-e2e final): X/Y passed
- リグレッション有無 (+/-Z vs Step 4)

パースロジック:
```markdown
## Step 4: game-e2e (validation)
- [ ] 75+ tests passed — ✅ PASS (76/80 passed) / ❌ FAIL
```

から `76` と `80` を抽出。

### 6. Issue 統計

**Input Source**: `development_docs/issues/`

カウントロジック:
```bash
# ✅ プレフィックスのある Issue 数（修正済み）
ls development_docs/issues/✅*.md | wc -l

# ✅ プレフィックスのない Issue 数（未解決）
ls development_docs/issues/*.md | grep -v "^✅" | wc -l
```

---

## Output Format

### metrics-YYYY-MM-DD.json

```json
{
  "execution_date": "2026-02-21",
  "total_duration_minutes": 529,
  "skills": [
    {
      "name": "game-orchestrate",
      "duration_minutes": 84,
      "status": "completed",
      "outputs": 4,
      "success_rate": 1.0
    },
    {
      "name": "game-e2e-add-coverage",
      "duration_minutes": 42,
      "status": "partial",
      "outputs": 4,
      "success_rate": 1.0,
      "tests_added": 4,
      "tests_blocked": 0
    },
    {
      "name": "bug-fix-orchestrate",
      "duration_minutes": 198,
      "status": "partial",
      "outputs": 57,
      "success_rate": 0.85,
      "bugs_fixed": 17,
      "bugs_total": 20,
      "bugs_blocked": 3
    },
    {
      "name": "game-e2e (Step 4)",
      "duration_minutes": 8,
      "status": "completed",
      "success_rate": 0.95,
      "tests_passed": 76,
      "tests_total": 80,
      "tests_failed": 0,
      "tests_skipped": 4
    },
    {
      "name": "game-improve-orchestrate",
      "duration_minutes": 171,
      "status": "partial",
      "outputs": 30,
      "success_rate": 0.78,
      "improvements_completed": 7,
      "improvements_total": 9,
      "improvements_blocked": 2
    },
    {
      "name": "game-e2e (Step 6)",
      "duration_minutes": 9,
      "status": "completed",
      "success_rate": 0.96,
      "tests_passed": 77,
      "tests_total": 80,
      "tests_failed": 0,
      "tests_skipped": 3,
      "regression": false,
      "delta_vs_step4": 1
    },
    {
      "name": "skills-improve",
      "duration_minutes": 18,
      "status": "completed",
      "outputs": 3,
      "success_rate": 1.0,
      "recommendations": 23
    }
  ],
  "agents": [
    {
      "skill": "bug-fix-orchestrate",
      "agent": "plan-agent",
      "avg_retries": 0.8,
      "total_invocations": 20
    },
    {
      "skill": "bug-fix-orchestrate",
      "agent": "fix-agent",
      "avg_retries": 2.3,
      "total_invocations": 20
    },
    {
      "skill": "bug-fix-orchestrate",
      "agent": "review-agent",
      "avg_retries": 1.1,
      "total_invocations": 20
    },
    {
      "skill": "bug-fix-orchestrate",
      "agent": "test-agent",
      "avg_retries": 0.9,
      "total_invocations": 20
    },
    {
      "skill": "game-improve-orchestrate",
      "agent": "game-designer-agent",
      "avg_retries": 0.4,
      "total_invocations": 9
    },
    {
      "skill": "game-improve-orchestrate",
      "agent": "game-programmer-agent",
      "avg_retries": 1.8,
      "total_invocations": 9
    },
    {
      "skill": "game-improve-orchestrate",
      "agent": "review-agent",
      "avg_retries": 0.6,
      "total_invocations": 9
    }
  ],
  "tests": {
    "step4_passed": 76,
    "step4_failed": 0,
    "step4_skipped": 4,
    "step4_total": 80,
    "step6_passed": 77,
    "step6_failed": 0,
    "step6_skipped": 3,
    "step6_total": 80,
    "regression": false,
    "delta": 1
  },
  "issues": {
    "total": 23,
    "resolved": 17,
    "blocked": 3,
    "unresolved": 3
  },
  "documents": {
    "game_play_reports": 4,
    "plans": 20,
    "reviews": 27,
    "testplay": 14,
    "game_improvements": 30
  }
}
```

---

## 実装手順

### Step 1: タイムライン読み込み

```bash
TIMELINE=$(ls development_docs/game-master-orchestrate/execution-timeline-*.md | tail -1)

if [ ! -f "$TIMELINE" ]; then
  echo "ERROR: Timeline file not found"
  exit 1
fi

# 各スキルの実行時間を抽出
# 例: "| 1 | game-orchestrate | 10:00 | 11:24 | 1h 24m | ✅ |"
# → duration_minutes: 84
```

### Step 2: 検証レポート読み込み

```bash
VALIDATION=$(ls development_docs/game-master-orchestrate/validation-report-*.md | tail -1)

if [ ! -f "$VALIDATION" ]; then
  echo "WARNING: Validation report not found, using default values"
fi

# Step 4, Step 6 の tests_passed / tests_total を抽出
```

### Step 3: バグ修正サマリー読み込み

```bash
BUG_SUMMARY="development_docs/bug-fix-orchestrate-summary.md"

if [ -f "$BUG_SUMMARY" ]; then
  # 修正完了バグ数を抽出
  # 平均リトライ回数を抽出
fi
```

### Step 4: 改善サマリー読み込み

```bash
IMPROVE_SUMMARY=$(ls development_docs/game-improvements/game-improve-orchestrate-summary-*.md | tail -1)

if [ -f "$IMPROVE_SUMMARY" ]; then
  # 完了改善項目数を抽出
  # 平均リトライ回数を抽出
fi
```

### Step 5: ファイル数カウント

```bash
GAME_PLAY_REPORTS=$(ls development_docs/game-play-reports/*.md 2>/dev/null | wc -l)
PLANS=$(ls development_docs/plans/fix-*.md 2>/dev/null | wc -l)
REVIEWS=$(ls development_docs/reviews/*.md 2>/dev/null | wc -l)
TESTPLAY=$(ls development_docs/testplay/*.md 2>/dev/null | wc -l)
GAME_IMPROVEMENTS=$(ls development_docs/game-improvements/improve-*.md 2>/dev/null | wc -l)
```

### Step 6: Issue カウント

```bash
TOTAL_ISSUES=$(ls development_docs/issues/*.md 2>/dev/null | wc -l)
RESOLVED_ISSUES=$(ls development_docs/issues/✅*.md 2>/dev/null | wc -l)
UNRESOLVED_ISSUES=$((TOTAL_ISSUES - RESOLVED_ISSUES))
```

### Step 7: JSON 生成

Write ツールで JSON ファイルを生成:

```json
{
  "execution_date": "YYYY-MM-DD",
  "total_duration_minutes": <合計>,
  "skills": [<配列>],
  "agents": [<配列>],
  "tests": {<オブジェクト>},
  "issues": {<オブジェクト>},
  "documents": {<オブジェクト>}
}
```

ファイルパス: `development_docs/skills-improvements/metrics-YYYY-MM-DD.json`

---

## エラーハンドリング

### ファイルが存在しない場合

- タイムラインファイル: ERROR → エージェント失敗
- 検証レポート: WARNING → デフォルト値を使用
- バグ修正サマリー: WARNING → スキップ（bug-fix-orchestrate 未実行と判断）
- 改善サマリー: WARNING → スキップ（game-improve-orchestrate 未実行と判断）

### パースエラーの場合

- 数値抽出失敗: デフォルト値 (0 または null) を使用
- JSON 生成失敗: 部分的な JSON でも出力を試みる

---

## 成功基準

1. ✅ metrics-YYYY-MM-DD.json が生成
2. ✅ 全7スキルのメトリクスを含む
3. ✅ JSON が valid（パースエラーなし）
4. ✅ 実行時間の合計が妥当（4〜10時間程度）

---

## 実行例

```
# エージェント実行
→ metrics-collector-agent: Collecting metrics...

→ Reading timeline: execution-timeline-2026-02-21.md ✅
  - game-orchestrate: 84 minutes
  - game-e2e-add-coverage: 42 minutes
  - bug-fix-orchestrate: 198 minutes
  - game-e2e (Step 4): 8 minutes
  - game-improve-orchestrate: 171 minutes
  - game-e2e (Step 6): 9 minutes
  - skills-improve: 18 minutes
  - Total: 529 minutes (8h 49m) ✅

→ Reading validation report: validation-report-2026-02-21.md ✅
  - Step 4: 76/80 passed (95%)
  - Step 6: 77/80 passed (96%), +1 vs Step 4
  - Regression: false ✅

→ Reading bug-fix summary: bug-fix-orchestrate-summary.md ✅
  - Bugs fixed: 17/20 (85%)
  - Avg retries: fix-agent 2.3, review-agent 1.1 ✅

→ Reading improvement summary: game-improve-orchestrate-summary-2026-02-21.md ✅
  - Improvements completed: 7/9 (78%)
  - Avg retries: game-programmer-agent 1.8 ✅

→ Counting documents...
  - game-play-reports: 4 files
  - plans: 20 files
  - reviews: 27 files
  - testplay: 14 files
  - game-improvements: 30 files ✅

→ Counting issues...
  - Total: 23 issues
  - Resolved (✅): 17 issues
  - Unresolved: 3 issues
  - Blocked: 3 issues ✅

→ Generating JSON: metrics-2026-02-21.json ✅

✅ Metrics collection completed!
```
