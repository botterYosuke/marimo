# Backcast ゲームプレイ — Skill Orchestration マニュアル

**作成日**: 2026-02-20
**更新日**: 2026-02-21
**目的**: 5つの Claude Code Skill を順序制御しながら実行し、ゲームの品質・面白さ・ドキュメント正確性を多角的に評価する

---

## アーキテクチャ

```
┌──────────────────────────────────────────────────────┐
│                 Orchestrator（人間）                    │
│                                                       │
│  Step 1:  /game-setup          → 環境 Ready            │
│  Step 2:  /game-play           → プレイログ生成          │
│  Step 3:  /game-bug-hunt       ┐                       │
│           /game-manual-review  ├ 並列実行               │
│           /game-fun-review     ┘                       │
│  Step 4:  成果物確認                                    │
└──────────────────────────────────────────────────────┘
```

### 依存関係

```
/game-setup ──→ /game-play ──┬──→ /game-bug-hunt
                             ├──→ /game-manual-review
                             └──→ /game-fun-review
```

---

## Skill 一覧

### オーケストレーター

| Skill | 説明 |
|-------|------|
| `/game-orchestrate` | **全自動**: Step 1〜3 を順序実行（環境整備 → プレイ → 分析） |

### 個別 Skill

| # | Skill | 説明 | 入力 | 出力先 |
|---|-------|------|------|--------|
| 1 | `/game-setup` | 環境整備・起動・リセット | なし | (口頭: READY/FAILED) |
| 2 | `/game-play` | ゲーム実プレイ・ログ記録 | setup READY | `game-play-reports/play-log-*.md` |
| 3 | `/game-bug-hunt` | バグ発見・Issue 記録 | プレイログ | `development_docs/issues/<slug>.md` |
| 4 | `/game-manual-review` | マニュアル正確性検証 | プレイログ | `game-play-reports/manual-review-*.md` |
| 5 | `/game-fun-review` | 面白さ評価・改善提案 | プレイログ | `game-play-reports/fun-review-*.md` |

Skill 定義ファイル: `.claude/skills/game-*/SKILL.md`

---

## クイックスタート（推奨）

**全ステップを一気に実行**:

```
/game-orchestrate
```

このコマンドで Step 1〜3（環境整備 → プレイ → 分析）を自動実行します。

詳細な手動実行手順は以下のセクションを参照してください。

---

## 実行手順（手動実行の場合）

### Step 1: 環境整備

```
/game-setup
```

サーバー起動・ファイル配置・接続確認を行う。
出力が `READY` になったら Step 2 へ進む。

### Step 2: ゲームプレイ

```
/game-play
```

Sandbox モード → Bridge モードの順にプレイし、ログとスクリーンショットを記録。
レポートが `development_docs/game-play-reports/play-log-YYYY-MM-DD.md` に生成される。

### Step 3: 分析（並列実行可）

以下の3つは互いに独立しているため、**並列実行**が可能。

```
/game-bug-hunt
/game-manual-review
/game-fun-review
```

各スキルは Step 2 で生成されたプレイログを入力として使用する。

### Step 4: 成果物確認

全スキルの完了後、`development_docs/game-play-reports/` に以下が揃っていることを確認:

- [ ] `play-log-YYYY-MM-DD.md` — プレイログ
- [ ] `manual-review-YYYY-MM-DD.md` — マニュアルレビュー
- [ ] `fun-review-YYYY-MM-DD.md` — 面白さ評価
- [ ] `development_docs/issues/` に新規 Issue（バグがあった場合）

---

## 共通情報

### ゲーム概要

**Backcast** = トヨタ自動車（7203）の株価を使った投資シミュレーション（marimo ノートブック上で動作）

### ゲームファイル

| 種別 | パス |
|------|------|
| プレイファイル | `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py` |
| ゲームロジック | `src-tauri/sample-notebooks/game_setup.py` |
| スキル発火 | `src-tauri/sample-notebooks/skill_events.py` |
| スキル定義 | `frontend/src/components/skill-tree/skill-data.ts` |

### 操作コマンド

| コマンド | 説明 |
|---------|------|
| `bt.chart(code)` | 銘柄チャート表示 |
| `bt.buy()` | 株購入 |
| `bt.sell()` | 株売却 |
| `bt.step()` | 次の日に進む |
| `bt.trades()` | 保有株確認 |
| `bt.reveal_data()` | データの正体確認 |
| `bt.get_stock_daily(code)` | 株価データ取得 |

### スキルツリー前提条件チェーン

```
SANDBOX_001 → SANDBOX_002 → SANDBOX_003 ─┐
                           → SANDBOX_004 ─┤→ SANDBOX_005 → SANDBOX_006
                                          └─ FAIL_001
                                             FAIL_002（SANDBOX_004 + FAIL_001）

SANDBOX_006 → BRIDGE_001 → BRIDGE_002 → BRIDGE_003
                                            ↓
BRIDGE_003 → SETUP_001 → SETUP_002 ─→ SETUP_003 → SETUP_004
                       └→ DATA_001 ─┘              → SETUP_005
                            ↓
                  DATA_002 → DATA_003
                  DATA_004 → DATA_005
                  DATA_006

SETUP_003 + DATA_001 → SET_001 → SET_002
                SET_001 + DATA_005 → SET_003

SET_001 → TRADE_001 → TRADE_002
                    → TRADE_003 → TRADE_004
                               → TRADE_007 → TRADE_008
                                           → RISK_005 → RISK_006 → RISK_007 → RISK_008
                                                                  → RISK_010
                    → TRADE_006
                    → RISK_001 → RISK_002 → RISK_003 → RISK_004
                    → RISK_009
SET_001 → TRADE_009 → TRADE_010
SET_001 → CHART_001 → CHART_002（+ TRADE_003）
                    → CHART_003（+ IND_001）→ CHART_004

DATA_002 → IND_001 → IND_002 → IND_003 → IND_004
                             → IND_003 + IND_005 → IND_008
                    → IND_005 → IND_006
                    → IND_007
                    → IND_009

TRADE_001 → FAIL_003（資金0で発火）
```

### マイルストーン

| スキル数 | ボーナス | 称号/アイテム |
|---------|---------|-------------|
| 10 | +50,000円 | 「見習い投資家」 |
| 20 | +100,000円 | 「新進トレーダー」 |
| 35 | +200,000円 | 米国株ETF |
| 50 | +400,000円 | 「Backcastエキスパート」 |
| 58 | +600,000円 | 「マスター投資家」 |

### 参照ドキュメント

| ドキュメント | 用途 |
|-------------|------|
| `development_docs/game/game-e2e-review-system.md` | E2E テスト知見集（知見 1〜35） |
| `frontend/e2e-tests/game/helpers.ts` | 共通ヘルパー関数 |
| `frontend/e2e-tests/game/constants.ts` | テスト定数 |
| `frontend/e2e-tests/game/sandbox.spec.ts` | テスト構造のリファレンス |
| `development_docs/issues/` | 既知バグ一覧 |
