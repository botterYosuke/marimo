# Backcast ゲーム Skills システム — 完全ガイド

**作成日**: 2026-02-21
**対象読者**: marimo プロジェクトの開発者・QA担当者・新規参加者

---

## 📚 目次

1. [概要](#概要)
2. [なぜこのシステムを作ったのか](#なぜこのシステムを作ったのか)
3. [アーキテクチャ](#アーキテクチャ)
4. [使い方](#使い方)
5. [Skill の作り方](#skill-の作り方)
6. [よくある質問](#よくある質問)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### これは何？

**Backcast ゲーム Skills システム** = Claude Code の Skill 機能を使って、Backcast ゲームのテスト・評価を自動化・体系化するためのオーケストレーションシステムです。

### 何ができるの？

たった **1つのコマンド** (`/game-orchestrate`) で、以下のすべてを自動実行できます:

```
1. 環境整備（サーバー起動、ファイル配置、リセット）
   ↓
2. ゲームプレイ（Sandbox + Bridge モードを実プレイ）
   ↓
3. 分析（バグ発見 + マニュアル検証 + 面白さ評価）を並列実行
   ↓
4. レポート生成（プレイログ、Issue、改善提案）
```

### 誰のため？

- **開発者**: ゲーム機能を変更した後の動作確認・リグレッションテスト
- **QA担当者**: 体系的なバグ発見・品質評価
- **プロダクトマネージャー**: ゲーム体験の改善提案を得る
- **新規参加者**: Backcast ゲームの全体像を素早く把握

---

## なぜこのシステムを作ったのか

### 背景: 従来の問題点

Backcast ゲームの開発・テストには以下の課題がありました:

#### 問題1: 手動テストの負担

```
❌ 従来の手順:
1. ターミナルで `pnpm dev` 起動
2. ブラウザで backcast.py を開く
3. セルを1つずつ手動で入力・実行
4. スキルツリーパネルを開いて確認
5. スクリーンショット撮影
6. 結果を手動で記録
7. バグを発見したら Issue を手動で作成
8. マニュアルの記述が正しいか手動でチェック
9. 面白さを主観で評価

→ **1回のテストに30分〜1時間**
```

#### 問題2: 評価の偏り

- **バグ発見**のみに注力し、UX 評価やドキュメント品質がおろそかになる
- 同じ人が連続テストすると視点が固定化される

#### 問題3: 再現性の欠如

- 手動テストは毎回微妙に操作が変わる
- バグの再現手順が不明確
- 「自分の環境では動く」問題が多発

#### 問題4: 知見の散逸

- テスト結果がSlack・メモ帳・頭の中に分散
- 「前回どこまで確認したか」が不明
- 新規参加者が過去の問題を再発見

### 解決策: 5-Agent Orchestration

上記の問題を解決するため、**役割分担 + 自動化 + 再現性** を実現する Skills システムを設計しました。

```
┌────────────────────────────────────────────────────┐
│         /game-orchestrate（1コマンド）                │
└────────────────────────────────────────────────────┘
                      ↓
   ┌──────────────┬──────────────┬──────────────┐
   │ Agent 1      │ Agent 2      │ Agent 3〜5    │
   │ 環境整備      │ プレイ        │ 分析（並列）   │
   │ 自動化       │ E2E自動化     │ 多角的評価     │
   └──────────────┴──────────────┴──────────────┘
                      ↓
              成果物が自動生成
   （プレイログ、Issue、レビュー、改善提案）
```

**メリット**:
- ⏱️ **時間短縮**: 1時間 → 5分（自動化による12倍速）
- 🔄 **再現性**: 毎回同じ手順でテスト
- 📊 **多角的評価**: バグ・マニュアル・UX を同時評価
- 📝 **知見の蓄積**: Issue・レポートがすべて `development_docs/` に記録
- 🆕 **オンボーディング**: 新規参加者も `/game-orchestrate` だけで全体像を把握

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────┐
│              .claude/skills/（Skills定義）                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  game-orchestrate/   ← オーケストレーター（全体制御）        │
│      SKILL.md                                            │
│                                                          │
│  game-setup/         ← Agent 1: 環境整備                 │
│      SKILL.md                                            │
│                                                          │
│  game-play/          ← Agent 2: ゲームプレイ              │
│      SKILL.md                                            │
│                                                          │
│  game-bug-hunt/      ← Agent 3: バグ発見                 │
│      SKILL.md                                            │
│                                                          │
│  game-manual-review/ ← Agent 4: マニュアル検証            │
│      SKILL.md                                            │
│                                                          │
│  game-fun-review/    ← Agent 5: 面白さ評価               │
│      SKILL.md                                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           development_docs/（成果物の出力先）              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  game-play-reports/  ← レポート類                         │
│    - play-log-YYYY-MM-DD.md                              │
│    - manual-review-YYYY-MM-DD.md                         │
│    - fun-review-YYYY-MM-DD.md                            │
│                                                          │
│  issues/             ← バグ Issue                         │
│    - <slug>.md                                           │
│                                                          │
│  game/               ← 既存ドキュメント                    │
│    - game-e2e-review-system.md（E2E テスト知見集）         │
│                                                          │
│  plans/              ← マニュアル                         │
│    - backcast-game-play.md（本マニュアル）                 │
│                                                          │
│  game-skills-system.md ← 本ドキュメント                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 実行フロー

```
ユーザー: /game-orchestrate を実行
   ↓
┌────────────────────────────────────┐
│ Step 1: /game-setup                 │
│ - marimo サーバー起動                │
│ - backcast.py 配置確認              │
│ - 進捗データリセット                  │
│ → 出力: READY/FAILED                │
└────────────────────────────────────┘
   ↓（READY の場合のみ）
┌────────────────────────────────────┐
│ Step 2: /game-play                  │
│ - E2E テストで自動プレイ              │
│ - SANDBOX_001〜006 実行             │
│ - BRIDGE_001〜003 実行              │
│ - スクリーンショット撮影              │
│ → 出力: play-log-*.md               │
└────────────────────────────────────┘
   ↓（play-log 生成後）
┌────────────────────────────────────┐
│ Step 3a: /game-bug-hunt（並列）      │
│ - プレイログ分析                      │
│ - エラー抽出                         │
│ - ソースコード調査                    │
│ → 出力: issues/<slug>.md（新規バグ） │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ Step 3b: /game-manual-review（並列） │
│ - マニュアル vs 実際の動作を突合       │
│ - コマンド・パス・手順の正確性チェック  │
│ → 出力: manual-review-*.md          │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ Step 3c: /game-fun-review（並列）    │
│ - ゲームデザイン評価                  │
│ - UX 分析                           │
│ - 改善提案作成                       │
│ → 出力: fun-review-*.md             │
└────────────────────────────────────┘
   ↓
┌────────────────────────────────────┐
│ 完了サマリー                          │
│ - 全成果物へのリンク                  │
│ - 各 Step の成功/失敗                │
│ - 新規バグ数・改善提案数              │
└────────────────────────────────────┘
```

### Agent 役割分担

| Agent | 役割 | 専門性 | 成果物 |
|-------|------|--------|--------|
| **Agent 1** (setup) | 環境整備・起動・リセット | インフラ・DevOps | 口頭報告 (READY/FAILED) |
| **Agent 2** (play) | ゲーム実プレイ | E2E テスト・Playwright | プレイログ + スクリーンショット |
| **Agent 3** (bug-hunt) | バグ発見・根本原因調査 | デバッグ・ソースコード解析 | Issue ドキュメント（既存フォーマット準拠） |
| **Agent 4** (manual-review) | ドキュメント品質保証 | テクニカルライティング | マニュアルレビューレポート |
| **Agent 5** (fun-review) | ゲーム体験評価 | ゲームデザイン・UX | 面白さ評価 + 改善提案 |

### なぜ並列実行？

Step 3 の3つの Agent（bug-hunt / manual-review / fun-review）は**入力が共通**（`play-log-*.md`）で、**互いに独立**しています。

```
play-log-*.md ─┬─→ game-bug-hunt      ← バグに注目
               ├─→ game-manual-review ← ドキュメントに注目
               └─→ game-fun-review    ← 楽しさに注目
```

並列実行のメリット:
- ⚡ **高速化**: 3つの分析を同時実行（3分 → 1分）
- 🧠 **視点の独立性**: 各 Agent が専門性を発揮
- 🔄 **スケーラビリティ**: 将来的に Agent を追加しやすい

---

## 使い方

### 最も簡単な使い方（推奨）

```bash
/game-orchestrate
```

これだけで全プロセスが自動実行され、以下が生成されます:

- ✅ `development_docs/game-play-reports/play-log-2026-02-21.md`
- ✅ `development_docs/game-play-reports/manual-review-2026-02-21.md`
- ✅ `development_docs/game-play-reports/fun-review-2026-02-21.md`
- ✅ `development_docs/issues/<新規バグ>.md`（バグがあれば）

### 手動で段階実行（デバッグ時）

各 Step を個別に実行することも可能:

```bash
# Step 1: 環境整備
/game-setup
# → 出力が "READY" になることを確認

# Step 2: ゲームプレイ
/game-play
# → play-log-*.md が生成されることを確認

# Step 3: 分析（好きな順序・組み合わせで実行可能）
/game-bug-hunt
/game-manual-review
/game-fun-review
```

### 特定の分析だけ実行

例: バグ発見だけやりたい場合

```bash
/game-setup
/game-play
/game-bug-hunt  # これだけ実行
```

例: マニュアルレビューだけやりたい場合

```bash
# play-log-*.md が既にある場合は setup/play をスキップ可能
/game-manual-review
```

### 成果物の確認

実行後、以下のディレクトリを確認:

```bash
# レポート類
ls development_docs/game-play-reports/

# 新規 Issue
ls development_docs/issues/
```

---

## Skill の作り方

### Skill とは？

Claude Code の **Skill** = 特定のタスクを実行するための命令書（SKILL.md）です。

### Skill の基本構造

```markdown
---
name: my-skill
description: "このスキルの簡潔な説明"
allowed-tools:
  - Bash(cd /path && command*)
  - Read
  - Write
  - Glob
  - Grep
---

# スキルタイトル

## 役割

このスキルが何をするのか

## 実行手順

1. ステップ1
2. ステップ2
3. ...

## 出力

成果物の形式・保存先
```

### 作成手順

#### 1. スキル定義ファイルを作成

```bash
mkdir -p .claude/skills/my-skill
touch .claude/skills/my-skill/SKILL.md
```

#### 2. SKILL.md に内容を記述

```markdown
---
name: my-skill
description: "簡潔な説明（1行）"
allowed-tools:
  - Bash(特定のコマンド*)
  - Read
  - Write
---

# スキルタイトル

## 役割

何をするスキルか

## 実行手順

具体的な手順

## 出力

成果物
```

#### 3. 自動登録の確認

Claude Code は `.claude/skills/` 配下のスキルを自動認識します。

確認方法:
```
Claude Code を起動 → スキルリストに表示される
```

### allowed-tools の設定

**重要**: セキュリティのため、スキルが使用するツールを明示的に許可する必要があります。

#### 基本的なツール

```yaml
allowed-tools:
  - Read              # ファイル読み取り
  - Write             # ファイル書き込み
  - Edit              # ファイル編集
  - Glob              # ファイル検索
  - Grep              # コンテンツ検索
  - Bash(ls*)         # ls コマンド（ワイルドカード付き）
  - Skill             # 他のスキルを呼び出す（オーケストレーター用）
  - Task              # Agent を起動
```

#### Bash の制限パターン

セキュリティのため、特定のコマンドのみ許可:

```yaml
allowed-tools:
  - Bash(cd /d/Documents/marimo && pnpm dev*)  # pnpm dev のみ
  - Bash(npx playwright test*)                 # playwright test のみ
  - Bash(ls*)                                  # ls のみ
  - Bash(mkdir*)                               # mkdir のみ
  - Bash(rm -f /specific/path/*)               # 特定パスの削除のみ
```

❌ 危険な例（許可しない）:
```yaml
allowed-tools:
  - Bash(*)  # すべてのコマンドを許可（危険）
```

### 良い Skill の条件

#### ✅ 良い例

- **単一責任**: 1つのスキルが1つの明確な役割を持つ
- **再利用可能**: 他のプロジェクトでも使える汎用性
- **明確な入出力**: 何が必要で何が生成されるか明記
- **エラーハンドリング**: 失敗時の挙動を定義

#### ❌ 悪い例

- 1つのスキルがあれもこれもやる（「何でも屋」スキル）
- 前提条件が不明確（「環境が整っていれば動く」）
- 出力がランダム（実行するたびに違う形式）

### 命名規則

#### スキル名（`name:`）

- **小文字 + ハイフン**: `game-setup`（○）、`GameSetup`（×）
- **動詞を含む**: `game-play`（○）、`game`（×）
- **プロジェクト接頭辞**: `game-xxx` で統一

#### ファイル構成

```
.claude/skills/
  game-setup/
    SKILL.md
  game-play/
    SKILL.md
  game-bug-hunt/
    SKILL.md
```

---

## よくある質問

### Q1: Skill と Task tool の違いは？

| 項目 | Skill | Task tool |
|------|-------|-----------|
| 用途 | **定型作業**の自動化 | **一時的な探索**・調査 |
| 再利用性 | 高い（何度も実行） | 低い（1回限り） |
| 定義場所 | `.claude/skills/` に永続化 | その場で Agent に指示 |
| 例 | `/game-setup`（毎回同じ） | 「この関数がどこで使われてるか調べて」 |

**使い分け**:
- **定型作業** → Skill
- **探索・調査** → Task tool

### Q2: 既存の Skill を修正したらどうなる？

SKILL.md を編集 → **即座に反映**（Claude Code 再起動不要）

### Q3: Skill が認識されない場合は？

チェックリスト:
- [ ] `.claude/skills/<skill-name>/SKILL.md` にファイルが存在するか
- [ ] frontmatter（`---`で囲まれた部分）が正しいか
- [ ] `name:` が定義されているか
- [ ] `.claude/settings.local.json` の `additionalDirectories` に `.claude/skills` が含まれているか

### Q4: 並列実行はどうやって制御する？

**方法1: Skill ツールを複数回呼び出す**（オーケストレーター内）

```markdown
## Step 3: 分析

以下の3スキルを並列に実行:

```
/game-bug-hunt
/game-manual-review
/game-fun-review
```
```

Claude Code が自動的に並列実行します。

**方法2: Task ツールで Agent を起動**

```typescript
// オーケストレーター Skill 内で
Task({ subagent_type: "general-purpose", prompt: "/game-bug-hunt を実行" })
Task({ subagent_type: "general-purpose", prompt: "/game-manual-review を実行" })
Task({ subagent_type: "general-purpose", prompt: "/game-fun-review を実行" })
```

### Q5: Skill から別の Skill を呼び出せる？

**Yes**（オーケストレーター Skill の場合のみ）

```yaml
allowed-tools:
  - Skill  # これを許可
```

```markdown
## 実行手順

1. `/game-setup` を実行
2. `/game-play` を実行
3. `/game-bug-hunt` を実行
```

### Q6: プレイログが古い状態で分析スキルを実行したら？

**古いプレイログを元に分析されます**。最新の状態で分析したい場合は:

```bash
/game-play         # 最新のプレイログを生成
/game-bug-hunt     # 最新ログで分析
```

または:

```bash
/game-orchestrate  # すべて最新状態で実行
```

---

## トラブルシューティング

### 問題1: `/game-setup` が FAILED になる

#### 症状

```
## game-setup 結果
- ステータス: FAILED
- 失敗理由: Port 2718 is already in use
```

#### 原因

既存の marimo サーバーがポート 2718 を占有している

#### 解決策

```bash
# Windows
taskkill /F /IM marimo.exe

# 確認
netstat -ano | findstr :2718
```

---

### 問題2: `/game-play` でテストが失敗する

#### 症状

```
Error: Timeout 30000ms exceeded
```

#### 原因

- marimo サーバーが起動していない
- `waitForLoadState("networkidle")` を使っている（marimo では永遠に到達しない）

#### 解決策

1. `/game-setup` を先に実行したか確認
2. `development_docs/game/game-e2e-review-system.md` の知見35a を参照
3. `waitForLoadState("load")` に変更

---

### 問題3: バグが Issue として記録されない

#### 症状

`/game-bug-hunt` が完了したが、`development_docs/issues/` に何も追加されていない

#### 原因

プレイログにエラー・異常が検出されなかった（= バグなし）

#### 確認方法

```bash
# プレイログを確認
cat development_docs/game-play-reports/play-log-*.md
```

「エラー・異常」セクションが空 → バグなし（正常）

---

### 問題4: オーケストレーターが途中で止まる

#### 症状

`/game-orchestrate` を実行したが、Step 2 で止まった

#### 原因

Step 1 が `FAILED` だった（依存関係により後続がスキップされる）

#### 解決策

1. オーケストレーターの出力を確認
2. Step 1 のエラー内容を確認
3. `/game-setup` を個別に実行してデバッグ

---

### 問題5: スクリーンショットが撮影されない

#### 症状

プレイログに「スクリーンショット: なし」と記載される

#### 原因

- Playwright が headless モードで実行されている
- `--headed` フラグが欠落

#### 解決策

`game-play/SKILL.md` を確認:

```bash
npx playwright test e2e-tests/game/sandbox.spec.ts --headed
```

`--headed` が含まれているか確認。

---

## 設計上のポイント（開発者向け）

### なぜオーケストレーションなのか？

従来の「1つの巨大なテストスクリプト」ではなく、「小さなスキルの組み合わせ」にした理由:

#### メリット

1. **保守性**: 各スキルが独立 → 修正が局所化
2. **再利用性**: `game-setup` は他のゲームテストでも使える
3. **テスト容易性**: 各スキルを個別にテスト可能
4. **拡張性**: 新しい分析（Agent 6）を追加しやすい

#### デメリット

- 初期構築コストが高い（設計・ドキュメント作成）
- オーケストレーション層が必要

→ ただし、長期的には **メリット >> デメリット**

### なぜ5つの Agent？

**Single Responsibility Principle**（単一責任の原則）に基づいています。

| Agent | 専門性 | なぜ分離？ |
|-------|--------|----------|
| setup | インフラ | 環境問題とゲームロジックを切り離す |
| play | テスト実行 | プレイと分析を切り離す |
| bug-hunt | デバッグ | バグと UX を切り離す |
| manual-review | ドキュメント | 技術的正確性と面白さを切り離す |
| fun-review | ゲームデザイン | 主観評価を独立させる |

もし1つの巨大 Agent にすると:
- バグ発見に集中しすぎて UX 評価がおろそかになる
- ドキュメントレビューが抜け落ちる
- 視点が固定化される

### 成果物のフォーマット統一

すべての成果物は **Markdown** で統一:

- プレイログ: `play-log-YYYY-MM-DD.md`
- Issue: `<slug>.md`（既存フォーマット準拠）
- レビュー: `manual-review-YYYY-MM-DD.md`
- 評価: `fun-review-YYYY-MM-DD.md`

**理由**:
- Git で差分管理しやすい
- GitHub/GitLab でそのまま閲覧可能
- 検索・加工が容易
- AI（Claude Code）が読みやすい

### 日付ベースのファイル名

`play-log-YYYY-MM-DD.md` のように日付を含める理由:

- 履歴が残る（上書きされない）
- 時系列で並ぶ
- 「いつのテストか」が一目瞭然

---

## まとめ

### このシステムで何が変わったか

| 項目 | Before | After |
|------|--------|-------|
| テスト時間 | 30分〜1時間 | 5分（自動化） |
| バグ発見率 | 主観的・ランダム | 体系的・再現可能 |
| ドキュメント品質 | チェックなし | 自動検証 |
| UX 評価 | たまに実施 | 毎回実施 |
| 知見の蓄積 | Slack・メモに散在 | `development_docs/` に集約 |

### 次のステップ

1. **実際に使ってみる**:
   ```
   /game-orchestrate
   ```

2. **成果物を確認**:
   ```
   development_docs/game-play-reports/
   development_docs/issues/
   ```

3. **フィードバック**:
   - バグ・改善提案を Issue に記録
   - このドキュメントを改善

---

## 関連ドキュメント

| ドキュメント | 用途 |
|-------------|------|
| [backcast-game-play.md](plans/backcast-game-play.md) | オーケストレーション実行マニュアル |
| [game-e2e-review-system.md](game/game-e2e-review-system.md) | E2E テスト知見集 |
| `.claude/skills/game-*/SKILL.md` | 各スキルの詳細定義 |
| `development_docs/issues/` | 既知バグ一覧 |

---

**作成者**: Claude Code
**更新履歴**:
- 2026-02-21: 初版作成
