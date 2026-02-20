# 進捗保存システムの仕様

このドキュメントでは、marimoアプリケーションにおけるゲーム進捗（スキルアンロック、報酬など）の保存・管理の仕組みについて解説します。

## 概要

本アプリケーションの進捗管理システムは、**「File-Based Single Source of Truth」** という設計思想に基づいています。
すべての永続的な進捗情報は、ノートブックファイルと対になる隠しJSONファイルに保存され、Backend (Python) がその正本を管理します。Frontend (React) は、Backendから通知された情報に基づいて表示を行います。

## データ保存場所と形式

### 保存場所と命名規則

進捗情報は、実行中の `.py` ノートブックと同じディレクトリに、以下の命名規則で保存されます。

- **ルール**: `.[ノートブック名].progress.json`
- **例**: `sandbox.py` を実行中の場合 → `.sandbox.progress.json`
- **属性**: ドット `.` で始まるファイル名（Unix系OSでの隠しファイル慣習を採用）

> **Note**: Windows環境でもファイルエクスプローラーの設定によっては隠しファイルとして扱われない場合がありますが、アプリケーションロジック上は設定ファイルとして扱われます。

### データフォーマット (JSON Schema)

保存されるJSONファイルは以下の単純な構造を持ちます。

```json
{
  "version": 1,
  "completed_skills": [
    "SANDBOX_001",
    "SANDBOX_002",
    "BRIDGE_001"
  ]
}
```

| キー | 型 | 説明 |
|------|----|------|
| `version` | number | データ形式のバージョン番号（現在は `1` 固定） |
| `completed_skills` | string[] | 完了したスキルのIDリスト |

**重要なポイント**:
- **所持金 (Cash) や称号 (Titles) は直接保存されません。**
- これらは、保存された `completed_skills` リストをもとに、アプリケーション起動時に再計算されます。

## 計算ロジック

ユーザーの現在のステータス（所持金など）は、以下の要素から導出されます。

### 1. 基本資金 (Initial Cash)
実行中のノートブック内で `Backtest` クラスが初期化される際に設定される金額です。

```python
# 例: sandbox.py
bt = Backtest(
    cash=100_000,  # ← これが基本資金
    # ...
)
```

この値は `BacktestHud` などのコンポーネントで参照される `state.cash` のベースとなります。

### 2. 獲得報酬 (Earned Rewards)
保存された `completed_skills` リストに基づき、フロントエンドで報酬総額が再計算されます。
計算ロジックは `frontend/src/components/skill-tree/rewards/reward-system.ts` に実装されています。

**計算式**:
```typescript
現在の所持金(Display) = 基本資金(Backtest.cash) + スキル報酬合計(TotalSkillRewards)
```

- **スキル報酬**: 各スキルに設定された `cash` 報酬の合計
- **マイルストーンボーナス**: 完了スキル数が一定に達するごとのボーナス（例: 5個完了で+¥10,000）

この合算値が、画面右上のHUD（`BacktestHud`）の `Equity` や `Cash` として表示されます。

## データフローとアーキテクチャ

### 1. アプリケーション起動時 (Initialization)

1. **Python (Backend)**:
   - `progress_manager.py` が `.progress.json` を読み込む。
   - BroadcastChannel `progress_channel` を通じて `completed_skills` を送信。
   - `mo.output.append` を使用してHTMLとして埋め込むことで、確実にフロントエンドに伝達。

2. **Frontend**:
   - `useProgressSync.ts` が `progress_channel` をリッスン。
   - 受信した `completed_skills` を `initProgressFromFileAtom` (Jotai) に渡す。
   - `deriveProgressFromSkills` 関数が報酬総額を再計算し、`playerProgressAtom` を更新。

### 2. スキル獲得時 (Skill Completion)

1. **Frontend**:
   - ユーザーアクションなどでスキル条件を達成。
   - Python側にイベント送信（`mo.emit_skill(skill_id)` 相当の処理）。

2. **Python (Backend)**:
   - `progress_manager.add_completed_skill(skill_id)` が呼び出される。
   - `.progress.json` に新しいスキルIDを追加して上書き保存。
   - 最新の状態を再度 `progress_channel` でブロードキャスト。

3. **Frontend**:
   - 更新通知を受け取り、UI（ロック解除、トースト通知、所持金表示）を更新。

## コンポーネント詳細

### Backend (Python)
- **`src-tauri/sample-notebooks/progress_manager.py`**
  - ファイルI/Oを管轄。
  - `load_progress()`: ファイル読み込み（存在しない場合はデフォルト値を返す）。
  - `save_progress()`: ファイル書き込み。
  - `broadcast_progress()`: フロントエンドへの通知。

### Frontend (TypeScript/React)
- **`frontend/src/components/skill-tree/atoms.ts`**
  - 状態管理 (Jotai Atoms)。
  - `playerProgressAtom`: アプリケーション内の進捗情報の正本。
  - `deriveProgressFromSkills()`: スキルリストから全ステータス（Cash, Rank等）を復元する純粋関数。

- **`frontend/src/components/skill-tree/rewards/reward-system.ts`**
  - 報酬計算のビジネスロジック。
  - `calculateTotalRewards()`: 累積報酬の計算。

- **`frontend/src/hooks/useProgressSync.ts`**
  - Backendとの通信ブリッジ。

## トラブルシューティング

### Q. 進捗をリセットしたい場合は？
対象のノートブックに対応する `.json` ファイル（例: `.sandbox.progress.json`）を削除してから、アプリケーション（marimoカーネル）を再起動してください。

### Q. BacktestHudの金額と実際の残高が合わない
Backtestのシミュレーション上の残高（トレード損益込み）と、スキルツリーシステム上の所持金（スキル報酬）は、UI上で合算して表示される場合がありますが、内部管理は別々です。
- `state.equity`: トレード結果による現在の資産評価額
- `rewardCash`: アンロックしたスキルから得られた固定報酬額

HUD表示: `FormatYen(state.equity + rewardCash)`

---

**Revision History**:
- 2026-02-18: ドキュメントの全面改訂。仕様の詳細化と現状の実装との整合性確保。
