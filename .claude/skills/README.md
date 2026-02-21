# Backcast Game Development Skills

このディレクトリには、Backcast ゲーム開発ワークフロー全体を自動化するスキルが含まれています。

## クイックスタート

### メタオーケストレーション全体を実行

```bash
/game-master-orchestrate
```

ゲームプレイ → テストカバレッジ追加 → バグ修正 → E2E検証 → ゲーム改善 → 最終検証 → スキル改善分析の全7ステップを自動実行します。

**実行時間**: 約4〜10時間（バグ・改善項目の数に依存）

**成果物**:
- `development_docs/game-master-orchestrate/master-orchestrate-summary-YYYY-MM-DD.md`
- `development_docs/skills-improvements/skills-improve-summary-YYYY-MM-DD.md`

---

## スキル一覧

### オーケストレーション系

#### 🎯 game-master-orchestrate
**メタオーケストレーション**: 全ワークフローを統合管理

```bash
/game-master-orchestrate
```

7ステップを順次実行し、各ステップ間で検証ゲートを設けて品質を担保します。

---

#### 🎮 game-orchestrate
**ゲーム全体オーケストレーション**: 環境整備 → プレイ → 分析（並列）

```bash
/game-orchestrate
```

**実行時間**: 約1.5時間

**成果物**:
- `development_docs/game-play-reports/play-log-YYYY-MM-DD.md`
- `development_docs/game-play-reports/fun-review-YYYY-MM-DD.md`
- `development_docs/game-play-reports/manual-review-YYYY-MM-DD.md`
- `development_docs/issues/*.md` (新規バグ)

---

#### 🐛 bug-fix-orchestrate
**バグ修正オーケストレーション**: 未解決バグを優先度順に修正

```bash
/bug-fix-orchestrate
```

**実行時間**: 約2〜4時間（バグ数に依存）

**成果物**:
- `development_docs/plans/fix-*.md`
- `development_docs/reviews/fix-*.md`
- `development_docs/testplay/fix-*.md`
- `development_docs/bug-fix-orchestrate-summary.md`

---

#### ✨ game-improve-orchestrate
**ゲーム改善オーケストレーション**: fun-review から改善項目を実装

```bash
/game-improve-orchestrate
```

**実行時間**: 約2〜3時間（改善項目数に依存）

**成果物**:
- `development_docs/game-improvements/priority-list-YYYY-MM-DD.md`
- `development_docs/game-improvements/improve-*-design.md`
- `development_docs/game-improvements/game-improve-orchestrate-summary-YYYY-MM-DD.md`

---

#### 📊 skills-improve
**スキル改善実装**: 各スキルの改善機会を分析し、P1 改善項目を自動実装

```bash
/skills-improve
```

**実行時間**: 約20〜30分

**成果物**:
- `development_docs/skills-improvements/metrics-YYYY-MM-DD.json`
- `development_docs/skills-improvements/patterns-YYYY-MM-DD.md`
- `development_docs/skills-improvements/skills-improve-summary-YYYY-MM-DD.md`
- `development_docs/skills-improvements/implementation-log-YYYY-MM-DD.md`

**実行内容**:
1. メトリクス収集（実行時間、リトライ回数、成功率）
2. パターン分析（ボトルネック、失敗パターン）
3. 改善提案生成（P1/P2/P3 優先度付け）
4. **P1 改善項目を自動実装**（各スキルの SKILL.md / agent.md を Edit）
5. 実装結果を記録

---

### 個別タスク系

#### 🏗️ game-setup
**環境整備**: サーバー起動・ファイル配置・リセット

```bash
/game-setup
```

**実行時間**: 約1〜2分

---

#### 🎲 game-play
**ゲームプレイ**: 全操作のログとスクリーンショットを記録

```bash
/game-play
```

**実行時間**: 約1.2時間

**成果物**:
- `development_docs/game-play-reports/play-log-YYYY-MM-DD.md`

---

#### 🧪 game-e2e
**E2E テスト実行**: 失敗時は知見ドキュメントを参照して自動修正

```bash
/game-e2e
```

**実行時間**: 約5〜10分

---

#### 📝 game-e2e-add-coverage
**E2E カバレッジ追加**: 未カバー Issue に対応するテストを実装

```bash
/game-e2e-add-coverage
```

**実行時間**: 約30〜60分（Issue 数に依存）

**成果物**:
- `frontend/e2e-tests/game/*.spec.ts` (新規テスト)
- `development_docs/issues/✅*.md` (Issue 更新)

---

#### 🔍 game-bug-hunt
**バグ発見**: プレイログを分析してバグを発見

```bash
/game-bug-hunt
```

**実行時間**: 約10〜15分

**成果物**:
- `development_docs/issues/*.md` (新規 Issue)

---

#### 🎨 game-fun-review
**面白さ評価**: ゲームデザインの観点から UX を評価

```bash
/game-fun-review
```

**実行時間**: 約10〜15分

**成果物**:
- `development_docs/game-play-reports/fun-review-YYYY-MM-DD.md`

---

#### 📚 game-manual-review
**マニュアルレビュー**: プレイログと実際の動作を比較

```bash
/game-manual-review
```

**実行時間**: 約10〜15分

**成果物**:
- `development_docs/game-play-reports/manual-review-YYYY-MM-DD.md`

---

## 推奨ワークフロー

### 完全な開発サイクル（週次）

```bash
# 週に1回、全ワークフローを実行
/game-master-orchestrate
```

**このコマンド1つで以下を自動実行**:
1. ゲームをプレイしてバグ・UX問題を発見
2. テストカバレッジを追加
3. バグを優先度順に修正
4. E2E テストで検証
5. ゲーム改善を実装
6. 最終検証
7. スキル自体の改善提案を生成

---

### 個別タスク実行（日次）

#### バグ修正のみ

```bash
/bug-fix-orchestrate
```

#### ゲーム改善のみ

```bash
/game-improve-orchestrate
```

#### テスト実行のみ

```bash
/game-e2e
```

---

## ディレクトリ構造

```
.claude/skills/
├── README.md (このファイル)
├── game-master-orchestrate/
│   └── SKILL.md
├── game-orchestrate/
│   └── SKILL.md
├── bug-fix-orchestrate/
│   ├── SKILL.md
│   └── agents/
│       ├── env-agent.md
│       ├── app-agent.md
│       ├── plan-agent.md
│       ├── fix-agent.md
│       ├── review-agent.md
│       ├── test-agent.md
│       └── testplay-agent.md
├── game-improve-orchestrate/
│   ├── SKILL.md
│   └── agents/
│       ├── game-designer-agent.md
│       └── game-programmer-agent.md
├── skills-improve/
│   ├── SKILL.md
│   └── agents/
│       ├── metrics-collector-agent.md
│       ├── pattern-analyzer-agent.md
│       └── recommendation-agent.md
├── game-setup/
│   └── SKILL.md
├── game-play/
│   └── SKILL.md
├── game-e2e/
│   └── SKILL.md
├── game-e2e-add-coverage/
│   └── SKILL.md
├── game-bug-hunt/
│   └── SKILL.md
├── game-fun-review/
│   └── SKILL.md
└── game-manual-review/
    └── SKILL.md
```

---

## 成果物の保存場所

```
development_docs/
├── game-master-orchestrate/
│   ├── master-orchestrate-summary-YYYY-MM-DD.md
│   ├── execution-timeline-YYYY-MM-DD.md
│   └── validation-report-YYYY-MM-DD.md
├── game-play-reports/
│   ├── play-log-YYYY-MM-DD.md
│   ├── fun-review-YYYY-MM-DD.md
│   └── manual-review-YYYY-MM-DD.md
├── issues/
│   ├── <slug>.md (未解決)
│   └── ✅<slug>.md (解決済み)
├── plans/
│   └── fix-<slug>-plan.md
├── reviews/
│   ├── fix-<slug>-review.md
│   └── improve-<slug>-review.md
├── testplay/
│   ├── fix-<slug>-testplay.md
│   └── improve-<slug>-testplay.md
├── game-improvements/
│   ├── priority-list-YYYY-MM-DD.md
│   ├── improve-<slug>-design.md
│   ├── improve-<slug>-implementation.md
│   └── game-improve-orchestrate-summary-YYYY-MM-DD.md
└── skills-improvements/
    ├── metrics-YYYY-MM-DD.json
    ├── patterns-YYYY-MM-DD.md
    └── skills-improve-summary-YYYY-MM-DD.md
```

---

## 注意事項

- **実行時間**: `game-master-orchestrate` は4〜10時間かかります（バックグラウンド実行推奨）
- **Critical Gates**: Step 1, 4, 6 が失敗すると全体が中断されます
- **部分的成功**: バグ修正・改善項目の一部が失敗しても全体は継続します
- **タイムスタンプ**: 全ての成果物に日付が含まれるため、履歴追跡が可能です

---

## トラブルシューティング

### game-master-orchestrate が Step 1 で失敗する

```bash
# 個別に環境整備を実行
/game-setup
```

出力が `READY` になることを確認してから再実行。

### game-e2e テストが失敗する

```bash
# 知見ドキュメントを参照
cat development_docs/game/game-e2e-review-system.md
```

または、`/game-e2e` スキルが自動修正を試みます。

### バグ修正・改善項目がブロックされる

`development_docs/bug-fix-orchestrate-summary.md` または `game-improve-orchestrate-summary-*.md` を確認し、ブロッカーの理由を特定。手動で対処が必要な場合があります。

---

## 次のステップ

1. P1 改善項目を Issue 化
2. 各スキルの SKILL.md を更新（skills-improve の提案を反映）
3. 次回 game-master-orchestrate 実行時に改善効果を測定

---

## 参考資料

- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体のガイドライン
- [AGENTS.md](../../AGENTS.md) - marimo 開発ガイドライン
- [development_docs/game-skills-system.md](../../development_docs/game-skills-system.md) - ゲームスキルシステム仕様
- [development_docs/game/game-e2e-review-system.md](../../development_docs/game/game-e2e-review-system.md) - E2E テスト知見集
