# UX プレイテストレポート — 離脱ポイント分析

**作成日**: 2026-02-20
**対象**: `src-tauri/sample-notebooks/backcast.py`（サンドボックスモード）
**環境**: marimo edit (port 2718) + Vite dev server (port 3000)、Playwright MCP によるブラウザ自動操作
**ステータス**: 未対応（提案段階）

---

## 背景・目的

スキルツリーのE2Eテスト（`game-e2e-review-system.md` の53テスト）は **技術的な正しさ** を検証している。
一方で「初めてのユーザーがゲームを起動して、最初の10分で離脱しないか」という **UX 観点の検証** は未実施だった。

本レポートは、Playwright MCP で実際に backcast.py を起動し、チュートリアルの手順（`bt.buy()` → `bt.step()` → スキルツリー確認）を初心者視点で追体験した結果である。

---

## 実施手順

```
1. taskkill //F //IM marimo.exe  （既存プロセス終了）
2. cd src-tauri/sample-notebooks
3. uv run --project ... marimo edit --no-token --headless backcast.py --port 2718
4. cd frontend && pnpm dev  （Vite dev server port 3000）
5. Playwright で http://localhost:3000/ を開く
6. bt.buy() → bt.step() → スキルツリー確認
```

### 起動時の注意点（知見）

- `pyproject.toml` の `BackcastPro>=0.6.4` が PyPI に存在しない場合、`uv run` が全 extras を解決しようとして失敗する。一時的に `>=0.6.3` に変更するか、marimo.exe が既にインストール済みならそのまま使う
- `marimo.exe` が既に起動中だとロックエラーが出る。`taskkill //F //IM marimo.exe` で全プロセス終了が必要
- Vite dev server → marimo backend の接続は **同一カーネルへの再接続** になるため「Reconnected」バナーが表示される

---

## 離脱ポイント一覧

### P1 🔴 致命的: スキル進捗が反映されない

**現象**: `bt.chart("7203")` → `bt.buy()` → `bt.step()` を実行後にスキルツリーを開くと **0/59 スキル** のまま。SANDBOX_001 すら完了していない。

**根本原因**:
- `game_setup.py` の各関数（`chart()`, `buy()` 等）は `emit_skill()` を呼び出す
- `emit_skill()` は Python 側で BroadcastChannel 用の HTML を生成し `mo.output.append()` でフロントエンドに送信
- しかし **セッション再接続時** には、既に実行済みセルの出力が再送されるタイミングとフロントエンドのスキルリスナー起動タイミングにずれが生じる
- BroadcastChannel はリアルタイム送信のみで **過去のイベントを再生する仕組みがない**

**影響**: ユーザーが操作しても何も起きない → 「ゲームが壊れている」と判断して離脱

**改善方向**:
1. ページロード時に Python カーネルから `get_triggered_skills()` の現在状態を取得し、フロントエンドのスキルツリーと同期する API を追加
2. `progress-persistence.md` の `.backcast.progress.json` を読み込んでフロントエンド初期状態に反映
3. セル再実行時にスキルイベントを再発火する仕組み

---

### P2 🔴 高: `bt.buy()` の出力が生のPythonオブジェクト

**現象**: Outputs パネルに以下が表示される:
```
<BackcastPro.order.Order object at 0x000001D007657CB0>
```

**問題**: 初心者には完全に意味不明。「買えたの？ エラー？」と混乱する。

**改善方向**:
- `BackcastPro.order.Order.__repr__()` をオーバーライドして人間向けメッセージにする
- `game_setup.py` の `buy()` で `mo.callout()` によるフィードバックを追加:
  ```python
  mo.output.append(mo.callout(
      mo.md(f"**買い注文** トヨタ(7203) @ ¥{price:,.0f}"),
      kind="success",
  ))
  ```

---

### P3 🔴 高: `bt.step()` の出力が `True` のみ

**現象**: Outputs に `True` とだけ表示。何日に進んだか、株価はいくらか、注文は約定したか — 一切不明。

**改善方向**:
- `step()` の戻り値を情報豊富なオブジェクトにする（または `mo.output.append()` で状況報告）
- 例: `📅 2025-06-15 | 株価: ¥3,720 (+1.2%) | 買い注文が約定しました！`

---

### P4 🟠 中: Grid レイアウトでセルが重なる

**現象**: 起動直後の画面で cell-1（説明）、cell-2（チャートコード）、cell-3（入力）、cell-4（AI生成の空セル）が重なり合い、どれがどれか判別困難。

**関連**: `game/grid-layout-auto-placement.md` の auto-placement ロジック

**改善方向**:
- `backcast.py` の `grid.json` レイアウトファイルで初期配置を明確に定義
- チャート = 上部全幅、説明 = 左下、入力 = 右下 のような固定レイアウト

---

### P5 🟠 中: AI Fix 提案バナーが全セルに表示

**現象**: 全てのコードセルに「Fix generated / Showing fix / Accept / Reject」が表示される。ゲームと無関係。

**原因推定**: AI code fix 機能がデフォルトで有効になっている。

**改善方向**:
- ゲームテンプレート（`backcast.py`）では AI Fix を自動無効化
- `app = marimo.App(width="grid", ai_fix=False)` のような設定、または backcast モード判定で非表示

---

### P6 🟠 中: 入力セルがどれかわからない

**現象**: 説明に「黒いウィンドウに `bt.buy()` と入力して実行」とあるが、ダークテーマのコードセルが複数あり（cell-3, cell-4）、どれが「正しい入力場所」か判断できない。

**改善方向**:
- cell-3 のプレースホルダーを `# ここにコードを入力 → bt.buy()` のように具体的に
- AI が自動生成する空セル（cell-4）を抑制
- 入力セルにフォーカスハイライトやパルスアニメーション

---

### P7 🟡 低〜中: チャートが step() 後に表示崩れ

**現象**: `bt.step()` 実行後、TradingView チャートがローソク足1本だけの極端にズームされた状態になり、全体像が見えない。

**関連**: `charts/chart-loop-freeze-fix.md` の更新ロジック

**改善方向**:
- チャート更新時に直近N日分のビューポートを維持するロジック

---

### P8 🟡 低〜中: 「Reconnected」バナー

**現象**: Vite dev server 経由で接続すると「Reconnected: You have reconnected to an existing session.」バナーが表示される。

**関連**: `game-e2e-review-system.md` 知見 16, 19, 20

**補足**: ビルド済みフロントエンド（port 2718 直接）では発生しない。開発環境固有の問題。ただしデスクトップアプリ版でも類似の再接続シナリオが発生しうる。

---

### P9 🟡 低: ステータスバーが Progress: 0.0% のまま

**現象**: `bt.buy()` / `bt.step()` 実行後もステータスバーの `Progress: 0.0%` と `Time: -` が変わらない。

**原因推定**: ステータスバーは `publish_state_headless()` で更新されるが、再接続後の初回表示では最新値が反映されていない可能性。

---

### P10 🟡 低: スキルツリーボタンが発見困難

**現象**: スキルツリーボタン（`data-testid="skill-tree-button"`）は右サイドバーの小さなアイコンボタンで、ラベルなし。ゲームの核心機能なのに見つけにくい。

**関連**: `game/skill-tree-panel.md`

**改善方向**:
- 初回プレイ時にツールチップ or チュートリアルオーバーレイで案内
- スキル完了時にボタンのパルスアニメーション
- または初回起動時に自動でスキルツリーダイアログを表示

---

## 設計思想と背景

### なぜ E2E テストだけでは不十分か

E2E テスト（`game-e2e-review-system.md` の 53 テスト）は `window.__testCompleteSkill` テストフックで直接 Jotai atom を操作するため、**BroadcastChannel 経路の問題を検出できない**。特に:

- セッション再接続時のイベント消失（P1）
- `emit_skill()` → HTML 生成 → BroadcastChannel → リスナー の全経路での遅延やタイミング問題
- ユーザーの実際の操作フロー（どのセルに入力するか、出力をどう解釈するか）

`z-python-e2e.spec.ts`（案G）は①→⑦全経路をカバーするが、再接続シナリオはテストしていない。

### プレイテストと E2E テストの使い分け

| 検証項目 | E2E テスト | プレイテスト |
|---------|-----------|------------|
| スキル前提条件チェーン | ✅ | - |
| 報酬計算 | ✅ | - |
| UI 状態遷移 | ✅ | - |
| 再接続時のスキル同期 | ❌ | ✅ P1 |
| 出力メッセージの可読性 | ❌ | ✅ P2, P3 |
| レイアウトの視認性 | ❌ | ✅ P4, P6 |
| 全体的なユーザーフロー | ❌ | ✅ 全体 |

---

## Tips: プレイテストの実施手順

### 前提条件

1. **BackcastPro がインストール済み**であること（`uv pip install BackcastPro`）
2. **marimo がビルド済み**であること（`cd frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/`）
3. または **Vite dev server** を使う場合はビルド不要だが Reconnected 問題が発生する

### 推奨手順（ビルド済みフロントエンド使用）

```bash
# 1. 既存プロセス終了
taskkill //F //IM marimo.exe

# 2. サーバー起動（sample-notebooks ディレクトリから）
cd src-tauri/sample-notebooks
uv run --project ../../ marimo edit --no-token --headless backcast.py --port 2718

# 3. ブラウザで開く
# http://localhost:2718/
```

### 推奨手順（Vite dev server 使用 — スキルツリー等の最新UIを確認する場合）

```bash
# 1. バックエンド起動（上記と同じ）

# 2. フロントエンド dev server 起動
cd frontend && pnpm dev

# 3. ブラウザで開く（Reconnected バナーが出るので dismiss する）
# http://localhost:3000/
```

### チェックリスト

```
□ チャートが正常に表示されるか
□ bt.buy() の出力が理解可能か
□ bt.step() 後にチャートが更新されるか
□ bt.step() 後にステータスバーが更新されるか
□ スキルツリーにスキル完了が反映されるか
□ 次に何をすべきかがわかるか
□ セルのレイアウトが見やすいか
□ AI Fix バナーが邪魔していないか
```

---

## 関連ドキュメント

- [Game E2E Review System](game-e2e-review-system.md) — E2E テストの設計・知見・全テスト一覧
- [Skill Tree Implementation](skill-tree-implementation.md) — スキルツリーシステム v4 アーキテクチャ
- [Skill Event Wiring](skill-event-wiring.md) — Python → フロントエンド BroadcastChannel 接続
- [Progress Persistence](progress-persistence.md) — `.backcast.progress.json` によるスキル状態永続化
- [Grid Layout Auto Placement](grid-layout-auto-placement.md) — グリッドレイアウトの自動配置ロジック
- [Chart Loop Freeze Fix](../charts/chart-loop-freeze-fix.md) — チャート更新ロジックの修正
