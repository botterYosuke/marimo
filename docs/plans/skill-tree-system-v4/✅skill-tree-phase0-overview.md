# スキルツリー実装計画 概要

**作成日**: 2026-02-02
**更新日**: 2026-02-04（✅実装完了 - Phase 6一部・Phase 8スキップ）
**企画書**: [✅skill-tree-design-v4.md](./✅skill-tree-design-v4.md)
**アーキテクチャ**: [skill-tree-notebook-savedata.md](./skill-tree-notebook-savedata.md)

---

## 実装範囲

- **スキル総数**: 58スキル（10カテゴリ）
- **3トラック**: サンドボックス → ブリッジ → フルモード
- **報酬システム**: 現金、アイテム、アンロック、称号
- **ソーシャル機能**: ランク、リーダーボード、バッジ

---

## アーキテクチャ（v4: ノートブック＝セーブデータ）

### 設計思想

**旧設計（v3以前）**: 3つの別々のノートブック（sandbox.py, bridge.py, full_mode.py）を切り替え
- 問題: プレイヤーが書いたコードがモード移行時にリセットされる

**新設計（v4）**: 単一のノートブック（backcast.py）を「セーブデータ」として扱う
- スキル解放時にシステムが新しいセル/関数を既存ノートブックに**注入**
- プレイヤーのコードは保持される

### ノートブック構造

```python
# backcast.py (プレイヤーのセーブデータ)

import marimo
app = marimo.App()

# ========================================
# システムコード: with app.setup: 節に配置
# プレイヤーには完全に非表示
# ========================================
with app.setup:
    from BackcastPro import Backtest, get_stock_daily

    # 進捗データ（セーブデータ）
    _GAME_PROGRESS = {
        "version": 1,
        "completed_skills": [],
        "current_mode": "sandbox",
        "cash": 0,
        "titles": [],
    }

    # スキルイベント発行
    _triggered_skills = set()
    def _emit_skill(skill_id, context=None): ...

# ========================================
# ユーザーセル: プレイヤーが見える・編集できる
# ========================================
@app.cell
def _chart(bt, mo):
    return bt.chart()

@app.cell
def _playground(bt, mo):
    """ここにコードを書いてみましょう！"""
    pass

# [スキル解放時に追加されるセル...]
```

### セル注入フロー

```
スキル完了 → Frontend検知 → Electron IPC → ノートブック編集 → marimo reload
       ↓
   _emit_skill()    →    BroadcastChannel    →    injectCells()
```

---

## フェーズ一覧

| Phase | タイトル | 概要 | 想定日数 | 優先度 | ステータス |
|-------|---------|------|---------|--------|-----------|
| **0-A** | **Electron拡張** | **セル注入IPC（main.js, preload.js）** | **1-2日** | **P0** | **完了** |
| 1 | [✅データモデル](./✅skill-tree-phase1-data-models.md) | 型定義、状態管理、スキルデータ | 3-5日 | P0 | ✅完了 |
| 2 | [✅トリガーシステム](./✅skill-tree-phase2-trigger-system.md) | スキル検出、セル注入トリガー | 2-3日 | P0 | ✅完了 |
| 3 | [✅UI強化](./✅skill-tree-phase3-ui-enhancement.md) | ノード、グラフ、詳細パネル | 4-5日 | P0 | ✅完了 |
| 4 | [✅サンドボックス](./✅skill-tree-phase4-sandbox-mode.md) | サンドボックスモード（初期セル） | 2-3日 | P1 | ✅完了 |
| 5 | [✅ブリッジ](./✅skill-tree-phase5-bridge-mode.md) | ブリッジモード（セル注入） | 2-3日 | P1 | ✅完了 |
| 6 | [フルモード](./skill-tree-phase6-full-mode.md) | 49スキルの注入テンプレート | 5-7日 | P1 | ⚠️部分完了 |
| 7 | [✅報酬システム](./✅skill-tree-phase7-reward-system.md) | 報酬計算、マイルストーン | 3-4日 | P2 | ✅完了 |
| 8 | [ソーシャル](./skill-tree-phase8-social-features.md) | ランク、リーダーボード、バッジ | 5-6日 | P2 | ⏭️スキップ |
| 9 | [✅統合テスト](./✅skill-tree-phase9-integration.md) | E2Eテスト、ドキュメント | 5-7日 | P0 | ✅完了 |

**合計想定日数**: 35-45日

---

## 依存関係図

```
Phase 0-A (Electron: セル注入IPC) ← 完了 ✓
    │
Phase 1 (データモデル) ← 完了 ✓
    ├── Phase 2 (トリガー + 注入ハンドラー) ← 完了 ✓
    │       └── Phase 4 (サンドボックス初期セル) ← 完了 ✓
    │               └── Phase 5 (ブリッジセル注入) ← 完了 ✓
    │                       └── Phase 6 (フルモードセル注入) ← 部分完了
    │                               └── Phase 7 (報酬) ← 完了 ✓
    │                                       └── Phase 8 (ソーシャル)
    └── Phase 3 (UI) ← 完了 ✓
            └── Phase 4 (サンドボックス) ← 完了 ✓

Phase 9 (統合) ← 全フェーズ完了後
```

---

## 既存実装の状況

### Electron側（Phase 0-A 完了）

| ファイル | 状態 | 役割 |
|---------|------|------|
| `electron/main.js` | ✓ 実装済み | `injectCells`, `readProgress`, `updateSetup` IPC |
| `electron/preload.js` | ✓ 実装済み | API公開 |
| `electron/utils/notebook-injector.js` | ✓ 新規作成 | セル注入ロジック |

### Frontend側（Phase 2-6 完了）

| ファイル | 状態 | 役割 |
|---------|------|------|
| `skill-tree/injection-templates.ts` | ✓ 新規作成 | スキル別注入テンプレート |
| `skill-tree/skill-complete-handler.ts` | ✓ 新規作成 | スキル完了→注入トリガー |
| `skill-tree/types.ts` | ✓ 更新済み | `GameProgress` 型追加 |
| `skill-tree/sandbox-indicator.tsx` | ✓ 新規作成 | サンドボックス進捗表示 |
| `skill-tree/bridge-indicator.tsx` | ✓ 新規作成 | ブリッジ進捗表示 |
| `skill-tree/track-switcher.tsx` | ✓ 新規作成 | トラック選択タブ |
| `skill-tree/track-header.tsx` | ✓ 新規作成 | トラックヘッダー |
| `skill-tree/skill-detail-panel.tsx` | ✓ 新規作成 | スキル詳細パネル |
| `skill-tree/rewards/reward-system.ts` | ✓ 新規作成 | 報酬計算ロジック |
| `skill-tree/rewards/reward-notification.tsx` | ✓ 新規作成 | 報酬通知コンポーネント |
| `skill-tree/rewards/reward-summary.tsx` | ✓ 新規作成 | 報酬サマリーコンポーネント |

### ノートブックテンプレート

| ファイル | 状態 | 役割 |
|---------|------|------|
| `frontend/public/files/backcast.py` | ✓ 更新済み | 統一ノートブック |
| `frontend/public/files/sandbox.py` | 廃止予定 | 旧サンドボックス |
| `frontend/public/files/bridge.py` | 廃止予定 | 旧ブリッジ |
| `frontend/public/files/full_mode.py` | 廃止予定 | 旧フルモード |

### BackcastPro

| 機能 | 状態 | 備考 |
|------|------|------|
| `Backtest` クラス | 実装済み | **変更なし** |
| `add_trade_callback()` | 実装済み | marimo側で活用 |
| `get_state_snapshot()` | 実装済み | marimo側で活用 |

---

## 技術スタック

- **Frontend**: React 19, TypeScript, Vite
- **状態管理**: Jotai (atomWithStorage)
- **グラフ**: ReactFlow + Dagre
- **UI**: Radix UI + Tailwind CSS
- **通信**: BroadcastChannel（`<marimo-broadcast>` 要素）
- **セル注入**: Electron IPC + notebook-injector.js

---

## Phase 0-A: Electron拡張（完了）

### 実装済み機能

| ファイル | 機能 |
|---------|------|
| `electron/main.js` | `notebook:inject-cells` IPC ハンドラー |
| `electron/main.js` | `notebook:read-progress` IPC ハンドラー |
| `electron/main.js` | `notebook:update-setup` IPC ハンドラー |
| `electron/main.js` | `DEFAULT_NOTEBOOK = "backcast.py"` に変更 |
| `electron/preload.js` | `injectCells()`, `readProgress()`, `updateSetupBlock()` API |
| `electron/utils/notebook-injector.js` | `injectCells()`, `readProgress()`, `updateSetupBlock()` |

### v4で削除/変更された機能

- ~~`switchNotebook()` - ノートブック切り替え~~ → **削除**（単一ノートブック方式に変更）
- ~~`getNotebookMode()` - モード取得~~ → **削除**（`_GAME_PROGRESS["current_mode"]`で管理）
- ~~3ノートブックテンプレートのコピー処理~~ → **削除**（`backcast.py`のみ使用）
- ~~`GameBacktest`, `SandboxBacktest`等の継承クラス~~ → **削除**（`with app.setup:`内で直接実装）

---

## クリティカルパス

1. **Phase 0-A + 1 + 2 完了** ✓ → 他の全フェーズの前提
2. **Phase 3 完了** ✓ → Phase 4開始可能
3. **Phase 4 → 5 → 6 完了** ✓ → 基本注入テンプレート作成済み
4. **Phase 7 完了** ✓ → 報酬システム実装済み
5. **Phase 8** → ソーシャル機能
6. **Phase 9** → 全フェーズ完了後

---

## 次のステップ

1. ~~Phase 0-Aの詳細計画を確認~~ ✓
2. ~~Phase 2のセル注入ハンドラー実装~~ ✓
3. ~~Phase 3のUI強化~~ ✓
4. ~~Phase 4 サンドボックスモード実装~~ ✓
5. ~~Phase 5 ブリッジモード実装~~ ✓
6. ~~Phase 6 フルモード基本実装~~ ✓（主要テンプレート完了）
7. Phase 6 追加テンプレート（任意）
8. ~~Phase 7 報酬システム~~ ✓
9. ~~Phase 8 ソーシャル機能~~ スキップ
10. ~~Phase 9 統合テスト~~ ✓（2026-02-04完了）

### Phase 9 実装内容（2026-02-04）
- E2Eテスト作成: `e2e-tests/skill-tree-flow.spec.ts`
- ユニットテスト追加: 345テスト全パス
- パフォーマンス最適化: memo, useCallback適用
- ドキュメント作成: `docs/skill-tree-guide.md`, `docs/skill-api.md`
