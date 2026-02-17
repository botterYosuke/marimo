# Skill Tree System v4 — 実装リファレンス

**ステータス**: 実装完了（Phase 6一部・Phase 8スキップ）
**ユーザー向け仕様**: [docs/guides/skill_tree.md](../docs/guides/skill_tree.md)

---

## アーキテクチャ概要

### 設計思想

**旧設計（v3以前）**: 3つの別々のノートブック（sandbox.py, bridge.py, full_mode.py）を切り替え
- 問題: プレイヤーが書いたコードがモード移行時にリセットされる

**新設計（v4）**: 単一のノートブック（backcast.py）を「セーブデータ」として扱う
- スキル解放時にシステムが新しいセル/関数を既存ノートブックに**注入**
- プレイヤーのコードは保持される

### セル注入フロー

```
スキル完了 → Frontend検知 → Electron IPC → ノートブック編集 → marimo reload
       ↓
   _emit_skill()    →    BroadcastChannel    →    injectCells()
```

### 技術スタック

- **Frontend**: React 19, TypeScript, Vite
- **状態管理**: Jotai
- **グラフ**: ReactFlow + Dagre
- **UI**: Radix UI + Tailwind CSS
- **通信**: BroadcastChannel（`<marimo-broadcast>` 要素）
- **セル注入**: Electron IPC + notebook-injector.js

---

## フェーズ一覧

| Phase | タイトル | ステータス |
|-------|---------|-----------|
| 0-A | Electron拡張（セル注入IPC） | ✅完了 |
| 1 | データモデル（型定義・状態管理） | ✅完了 |
| 2 | トリガーシステム（BroadcastChannel・セル注入） | ✅完了 |
| 3 | UI強化（ノード・グラフ・詳細パネル） | ✅完了 |
| 4 | サンドボックスモード（初期セル） | ✅完了 |
| 5 | ブリッジモード（セル注入） | ✅完了 |
| 6 | フルモード（49スキルの注入テンプレート） | ⚠️部分完了 |
| 7 | 報酬システム（報酬計算・マイルストーン） | ✅完了 |
| 8 | ソーシャル機能（ランク・バッジ・リーダーボード） | ⏭️スキップ |
| 9 | 統合テスト・ドキュメント | ✅完了 |

### 依存関係

```
Phase 0-A (Electron: セル注入IPC)
    │
Phase 1 (データモデル)
    ├── Phase 2 (トリガー + 注入ハンドラー)
    │       └── Phase 4 (サンドボックス初期セル)
    │               └── Phase 5 (ブリッジセル注入)
    │                       └── Phase 6 (フルモードセル注入)
    │                               └── Phase 7 (報酬)
    │                                       └── Phase 8 (ソーシャル)
    └── Phase 3 (UI)
            └── Phase 4 (サンドボックス)

Phase 9 (統合) ← 全フェーズ完了後
```

---

## Phase 0-A: Electron拡張

| ファイル | 機能 |
|---------|------|
| `electron/main.js` | `notebook:inject-cells`, `notebook:read-progress`, `notebook:update-setup` IPC |
| `electron/preload.js` | `injectCells()`, `readProgress()`, `updateSetupBlock()` API |
| `electron/utils/notebook-injector.js` | セル注入・進捗読み取り・setup節更新 |

v4で削除された機能:
- ~~`switchNotebook()`~~ → 削除（単一ノートブック方式に変更）
- ~~`getNotebookMode()`~~ → 削除（`_GAME_PROGRESS["current_mode"]`で管理）
- ~~3ノートブックテンプレートのコピー処理~~ → 削除

---

## Phase 1: データモデル

### 型定義 (`types.ts`)

- `SkillCategory`: 10カテゴリ（sandbox, bridge, fail, setup, data, set, trade, chart, indicator, risk）
- `SkillTrack`: 3トラック（sandbox, bridge, full）
- `Skill`: id, title, description, status, category, track, reward[], prerequisites, difficulty, helpContent
- `PlayerProgress`: completedSkills, currentCash, earnedTitles, rank, stats, sandboxCompleted, bridgeCompleted
- `Milestone`: skillCount, bonus, title, item, unlock

### 状態管理 (`atoms.ts`)

| Atom | 役割 |
|------|------|
| `playerProgressAtom` | プレイヤー進捗（ファイルベース永続化） |
| `skillDefinitionsAtom` | 全59スキルの定義（読み取り専用） |
| `skillsWithStatusAtom` | 進捗を反映したスキル配列（computed） |
| `completeSkillAtom` | スキル完了アクション |
| `completeSkillWithRewardAtom` | スキル完了 + 報酬通知 |
| `currentTrackAtom` | 現在のトラック（sandbox/bridge/full） |
| `resetProgressAtom` | 進捗リセット（デバッグ用） |

### スキルデータ (`skill-data.ts`)

全59スキル + 5マイルストーンを定義。

**知見**:
- 企画書では58スキルだが実際は59（カウント誤差）
- `atomWithStorage` の `{ getOnInit: true }` は `T | Promise<T>` 型問題を引き起こす → 削除
- `prerequisites.length === 0` の場合もunlock条件に含める必要がある

---

## Phase 2: トリガーシステム

### アーキテクチャ

```
┌─────────────────┐     <marimo-broadcast>      ┌─────────────────┐
│  backcast.py     │  ─────────────────────→    │  marimo frontend │
│  (with app.setup)│   skill_event_channel       │                  │
│ ┌──────────────┐ │                            │ ┌──────────────┐ │
│ │ _emit_skill()│ │                            │ │ skill-tree   │ │
│ │ (関数)       │ │                            │ │ handler.ts   │ │
│ └──────────────┘ │                            │ └──────────────┘ │
│                  │    Electron IPC            │         │        │
│                  │ ←─────────────────────────  │ injectCells()   │
│                  │   セル注入 + 進捗更新       │                  │
└─────────────────┘                             └─────────────────┘
```

### 実装ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/public/files/backcast.py` | `_emit_skill()` 関数（with app.setup:内） |
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | BroadcastChannel監視 + Electron IPC |
| `electron/utils/notebook-injector.js` | ノートブックファイル編集 |
| `frontend/src/components/skill-tree/injection-templates.ts` | スキル別注入テンプレート |

### `_emit_skill()` の仕組み

1. `_triggered_skills` set で重複防止
2. JSON → Base64エンコード
3. `<marimo-broadcast>` DOM要素を `mo.output.append()` で出力
4. Frontend の BroadcastChannel / MutationObserver が検知

---

## Phase 3: UIデザイン

### カテゴリカラー

```typescript
const categoryColors: Record<SkillCategory, string> = {
  sandbox: "#4ade80",   // green-400
  bridge: "#60a5fa",    // blue-400
  fail: "#f87171",      // red-400
  setup: "#a78bfa",     // violet-400
  data: "#fbbf24",      // amber-400
  set: "#fb923c",       // orange-400
  trade: "#22d3ee",     // cyan-400
  chart: "#e879f9",     // fuchsia-400
  indicator: "#818cf8", // indigo-400
  risk: "#f472b6",      // pink-400
};
```

### レイアウト

- **ノードサイズ**: 200x100px（計画: 220x120、実装で調整）
- **トラックオフセット**: sandbox: 0, bridge: 800, full: 1600（計画の600間隔から拡大）
- **Dagre**: 各トラックを個別にレイアウトし、クロストラックエッジは `strokeDasharray: "8,4"` で強調

### コンポーネント

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| `SkillNode` | `skill-node.tsx` | カテゴリ色、難易度★、報酬バッジ |
| `SkillDetailPanel` | `skill-detail-panel.tsx` | 報酬・ヘルプ・前提条件表示 |
| `TrackHeader` | `track-header.tsx` | トラック進捗バー |

### 知見

- **テンプレートリテラルの罠**: `injection-templates.ts` でPythonコードブロック（\`\`\`python）を含めるとTypeScriptが誤認識 → 配列 `.join("\n")` で解決
- **Dagreレイアウト**: `layoutElements()` と `elements.ts` の二重適用を避け、`createSkillElements()` で一元化
- **React 17+**: `import React from "react"` は不要
- **JSON.parse**: strict モードでは `unknown` 型 → 型アサーション必要

---

## Phase 4: サンドボックスモード

`_GAME_PROGRESS["current_mode"] = "sandbox"` で初期化。プリロード済みデータ（トヨタ 7203）で即時起動。

### スキルフロー

| スキル | トリガー条件 |
|-------|-------------|
| SANDBOX_001 | ゲーム起動（自動） |
| SANDBOX_002 | `bt.buy()` 実行 |
| SANDBOX_003 | `bt.trades` アクセス |
| SANDBOX_004 | `trade.close()` 実行 |
| SANDBOX_005 | SANDBOX_003,004完了後 |
| SANDBOX_006 | 全完了 → `current_mode = "bridge"` に更新 |

`SandboxIndicator` コンポーネントで進捗表示。

---

## Phase 5: ブリッジモード

「魔法の種明かし」— サンドボックスの裏で動いていたコードを可視化。

### モード遷移

```
"sandbox" → SANDBOX_006完了 → "bridge" → BRIDGE_003完了 → "full"
```

### セル注入

| スキル | 注入セル | 内容 |
|-------|---------|------|
| BRIDGE_001 | `_reveal_setup_code` | setup節の解説 |
| BRIDGE_002 | `_hint_sony_data` | ソニーデータ取得サンプル |
| BRIDGE_003 | `_full_mode_template` | セットアップ手順テンプレート |

`BridgeIndicator` コンポーネントで進捗表示。

---

## Phase 6: フルモード

49スキル（SETUP, DATA, SET, TRADE, CHART, IND, RISK）。主要テンプレート（IND_001, RISK_001）は実装済み、追加は任意。

現在の実装: ユーザーが手動でスキル完了を確認。将来的にはPython側フック（`bt.buy()` 時に自動 `_emit_skill()`）を追加予定。

---

## Phase 7: 報酬システム

### 報酬計算 (`rewards/reward-system.ts`)

| 関数 | 役割 |
|------|------|
| `calculateSkillReward(skillId)` | スキル単体の報酬（cash, title, item, unlock） |
| `checkMilestone(completedCount, previousCount)` | マイルストーン到達検出 |
| `calculateTotalRewards(completedSkills)` | 累計報酬計算 |

### UI コンポーネント

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| `RewardNotification` | `rewards/reward-notification.tsx` | トースト風アニメーション通知 |
| `RewardSummary` | `rewards/reward-summary.tsx` | 累計報酬・次のマイルストーン |

### 知見

- **framer-motion不使用**: TailwindCSSのtransitionクラスでアニメーション実装
- **型名の重複**: atomsの型を`RewardNotificationData`にリネームして解決
- **追加関数**: `getNextMilestone()`, `getMilestoneProgress()` を計画外で追加

---

## Phase 8: ソーシャル機能（スキップ）

設計は完了しているが未実装。将来の実装用に設計を記録:

- **ランクシステム**: ブロンズ→シルバー→ゴールド→プラチナ→マスター（スキル数+パフォーマンス指標）
- **バッジ**: 7種類（スピードランナー、トレードマシン、パーフェクトウィーク、フェニックス、ワンショットワンダー、コンプリーティスト、隠しバッジ）
- **リーダーボード**: ローカルモック（総合、シャープ、スキル）
- **計画ファイル**: 詳細な型定義・条件判定ロジック・UIコンポーネントの設計あり

---

## Phase 9: 統合テスト

### テスト結果

- ユニットテスト: 345件全パス
- E2Eテスト: `e2e-tests/skill-tree-flow.spec.ts`

### パフォーマンス最適化

- `memo()` でコンポーネントをメモ化
- `useCallback` でイベントハンドラをメモ化
- `lazy()` + `Suspense` でスキルツリーパネルを遅延読み込み
- BroadcastChannel のデバウンス

---

## Tips & 学び

### TypeScript

- テンプレートリテラル内のバッククォートは配列 `.join("\n")` で回避
- `JSON.parse()` は strict モードで `unknown` 型 → 型アサーション必要
- `useAtom` vs `useAtomValue`: 読み取りのみなら `useAtomValue` を使用

### React

- React 17+の新JSX Transformでは `import React from "react"` は不要
- 型を使う場合は `import type { ReactNode } from "react"` で個別インポート

### Lightweight Charts

- 必ず `setData()` で初期化してから `update()` を使う
- シリーズにデータがない状態で `update()` を呼ぶとエラー

### Jotai

- `atomWithStorage` の `{ getOnInit: true }` は `T | Promise<T>` 型問題あり
- LocalStorage キーにバージョン番号を含める: `backcast:player-progress:v1`

### Pyodide / WASM

- Worker には Jotai store へのアクセスがない → filename は RPC 経由
- IndexedDB キャッシュにより再訪問時のファイルロードがスキップされる

---

## ファイルリファレンス

### 新規作成ファイル

| ファイル | Phase | 役割 |
|---------|-------|------|
| `electron/utils/notebook-injector.js` | 0-A | セル注入ロジック |
| `skill-tree/types.ts` | 1 | 型定義 |
| `skill-tree/atoms.ts` | 1 | Jotai状態管理 |
| `skill-tree/skill-data.ts` | 1 | 59スキル+マイルストーン定義 |
| `skill-tree/index.ts` | 1 | エクスポート |
| `skill-tree/skill-complete-handler.ts` | 2 | スキル完了ハンドラー |
| `skill-tree/injection-templates.ts` | 2 | 注入テンプレート |
| `skill-tree/skill-detail-panel.tsx` | 3 | スキル詳細パネル |
| `skill-tree/track-header.tsx` | 3 | トラックヘッダー |
| `skill-tree/track-switcher.tsx` | 3 | トラック選択タブ |
| `skill-tree/sandbox-indicator.tsx` | 4 | サンドボックス進捗表示 |
| `skill-tree/bridge-indicator.tsx` | 5 | ブリッジ進捗表示 |
| `skill-tree/rewards/reward-system.ts` | 7 | 報酬計算ロジック |
| `skill-tree/rewards/reward-notification.tsx` | 7 | 報酬通知UI |
| `skill-tree/rewards/reward-summary.tsx` | 7 | 報酬サマリー |

### 更新ファイル

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `electron/main.js` | 0-A | IPC ハンドラー追加 |
| `electron/preload.js` | 0-A | API公開 |
| `skill-tree/skill-node.tsx` | 1,3 | カテゴリ色、難易度、報酬配列対応 |
| `skill-tree/elements.ts` | 3 | トラック別Dagreレイアウト |
| `skill-tree/skill-tree.css` | 3 | アニメーション追加 |
| `skill-tree/skill-tree-graph.tsx` | 3 | layoutElements削除 |
| `frontend/public/files/backcast.py` | 2,4 | _emit_skill(), サンドボックス初期化 |
| `skill-tree-panel.tsx` | 4,5,7 | Indicator統合、報酬UI統合 |

全ファイルパスのプレフィックス: `frontend/src/components/` （ノートブックテンプレートは `frontend/public/files/`）
