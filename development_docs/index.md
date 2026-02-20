# marimo Developer Documentation

Internal documentation for marimo developers.

---

## Guides — 開発ガイド・リファレンス

| Doc | 概要 |
|-----|------|
| [Testing](testing.md) | テスト構造（スナップショット/フィクスチャ）、カーネルフィクスチャ、実行コマンド |
| [Traces](traces.md) | OpenTelemetry トレース、Jaeger/Zipkin 分析、snakeviz プロファイリング |
| [Prompts](prompts.md) | Prompter クラスによる AI システムプロンプト管理とスナップショットテスト |
| [OpenAPI](openapi.md) | OpenAPI スキーマ生成・バリデーション・クライアントコード生成 |
| [Adding Lint Rules](adding_lint_rules.md) | リントルール（MB/MR/MF コード）の追加手順 |
| [Adding Backend & MCP Tools](adding_backend_and_mcp_tools.md) | バックエンド + MCP サーバー両対応ツールの作成手順 |
| [Frontend Build](frontend_build.md) | Windows でのフロントエンドクリーンリビルド手順 |

## Desktop — Tauri / Electron / Steam

| Doc | 概要 |
|-----|------|
| [Tauri: Auto Open Recent File](tauri_auto_open_recent_file.md) | 起動時に最新ファイルを自動オープン（recent_files.toml） |
| [Tauri: Seed Notebooks](desktop/tauri_seed_notebooks.md) | サンプル Python ファイルの自動コピー |
| [Steam Single Folder](desktop/steam-single-folder.md) | NSIS → ポータブルランチャーへの移行戦略 |

## Game — ゲーム / Backcast システム

| Doc | 概要 |
|-----|------|
| [Skill Tree Implementation](game/skill-tree-implementation.md) | スキルツリーシステム v4 アーキテクチャ（Jotai / ReactFlow / BroadcastChannel） |
| [Skill Tree Panel](game/skill-tree-panel.md) | フローティングボタン + ダイアログ UI |
| [Skill Event Wiring](game/skill-event-wiring.md) | Python emit_skill() → フロントエンド BroadcastChannel 接続の修正 |
| [Broadcast Channel HUD](game/broadcast-channel-hud.md) | ヘッダー表示のバックテスト状態 HUD |
| [Progress Persistence](game/progress-persistence.md) | ファイルベースのプレイヤー進捗管理（completed_skills JSON） |
| [Money Missile Homing](game/money-missile-homing.md) | BUY/SELL イベントのマネーパーティクルホーミング |
| [Game E2E Review System](game/game-e2e-review-system.md) | ゲーム E2E テストスイート（53テスト、Playwright + TypeScript） |
| [Grid Layout Auto Placement](game/grid-layout-auto-placement.md) | ビジュアル出力のグリッドレイアウト自動配置 |
| [UX Playtest Report](game/ux-playtest-report.md) | 初心者視点のプレイテスト — 10件の離脱ポイント分析・改善提案 |

## Charts — チャート・ウィジェット

| Doc | 概要 |
|-----|------|
| [Chart ACK Sync](charts/chart-ack-sync.md) | ACK ベース同期で JS 処理バックログ防止 |
| [Chart Loop Freeze Fix](charts/chart-loop-freeze-fix.md) | bt.step() 200回以上ループ時の更新ロジック修正 |
| [Chart Widget Caching Fix](charts/chart-widget-caching-fix.md) | bt.chart() → bt.step() 順序時の空チャート問題修正 |
| [Chart Theme](charts/chart-theme.md) | color_theme パラメータ未適用のデバッグ |
| [AnyWidget Performance](charts/anywidget-performance.md) | Plotly → Lightweight Charts 移行（LCP 58% 改善） |
| [AnyWidget Backend Sync](charts/anywidget-backend-sync.md) | mo.Thread からの trait 更新がフロントに反映されない調査 |

## Frontend — フロントエンド

| Doc | 概要 |
|-----|------|
| [Code URL Embedding](code_url_embedding.md) | lz-string 圧縮による URL フラグメントへのコード埋め込み |
| [Code URL Fix (Handoff)](handoff_code_url_fix.md) | `#code/` URL フラグメント優先処理の修正 |
| [Code URL Test (Handoff)](handoff_code_url_test.md) | コード URL 埋め込み機能の検証手順 |
| [Frontend Freeze Fix](frontend/frontend-freeze-fix.md) | Jotai サブスクリプションリークによるフリーズ調査 |
| [UI Switch State Fix](frontend/ui-switch-state-fix.md) | mo.ui.switch 状態同期の解決済み問題（アーカイブ） |

## Pyodide — WebAssembly

| Doc | 概要 |
|-----|------|
| [Pyodide](pyodide.md) | Pyodide デプロイ版のフロントエンド開発手順 |
| [Custom Wheel](pyodide/pyodide-custom-wheel.md) | ローカル Pyodide 開発用カスタムホイールのビルド |
| [「X is not a function」エラー](pyodide/pyodide-a-is-not-function.md) | loro-crdt Top-Level Await 起因エラーの修正 |

## Security — セキュリティ

| Doc | 概要 |
|-----|------|
| [Python Sandbox Security](security/python-sandbox-security.md) | 多層防御によるサンドボックスアーキテクチャ（提案） |

---

## Issues — 解決済みバグ

すべて 2026-02-20 に解決済み。

| Issue | 概要 |
|-------|------|
| [BRIDGE_001 スキル未カウント](issues/bridge001-skill-not-counted.md) | chart() が get_stock_daily() を呼びBRIDGE_002 が先に発火 |
| [Cell ID null 警告](issues/cell-id-null-warning.md) | グリッドレイアウトの DOM 構造差異 |
| [Position 表示バグ](issues/position-display-bug.md) | float vs dict 型不整合で "[object Object] shares" 表示 |
| [Progress JSON リセット不完全](issues/progress-json-reset-incomplete.md) | .backcast.progress.json 残存によるスキル状態の不整合 |
| [SANDBOX_003 トリガー条件](issues/sandbox003-skill-trigger-condition.md) | bt.trades() に bt.step() 決済が必要 |
| [SANDBOX_005 重複ブロードキャスト](issues/sandbox005-duplicate-broadcast.md) | chart() 内のスキル発火済みチェック漏れ |
| [bt.step() が buy 後に False 返却](issues/step-returns-false-after-buy.md) | iloc[-2] IndexError → BankruptError 例外処理で修正 |

## Plans — 計画・レポート・ハンドオフ

過去のセッション計画、ゲームプレイレポート、E2E テスト設計。

| Doc | 概要 |
|-------|------|
| [Backcast Game Play](plans/backcast-game-play.md) | Playwright によるゲーム手動検証プラン |
| [Server Error Redirect](plans/cosmic-sleeping-bachman.md) | Tauri で接続エラー時ホーム画面にリダイレクト |
| [E2E Coverage Fix Prompt](plans/e2e-coverage-fix-prompt.md) | E2E テストの弱いアサーション改善要求 |
| [E2E Coverage Gap Analysis](plans/e2e-test-coverage-gap-analysis.md) | 7層パイプラインのカバレッジギャップ分析 |
| [Backcast E2E Implementation](plans/handoff-backcast-e2e-implementation.md) | backcast-integration.spec.ts 作成ハンドオフ |
| [Game Play Handoff v1–v4](plans/handoff-game-play-v1.md) | ゲームプレイテストのハンドオフ（[v2](plans/handoff-game-play-v2.md) / [v3](plans/handoff-game-play-v3.md) / [v4](plans/handoff-game-play-v4.md)） |
| [Unnamed Notebook](plans/linear-jingling-sundae.md) | Unnamed Notebook 機能の実装計画 |
| [Game Play Report 1–4](plans/my-game-play-report.md) | ゲームプレイセッションレポート（[2](plans/my-game-play-report2.md) / [3](plans/my-game-play-report3.md) / [4](plans/my-game-play-report4.md)） |
| [Python Cell E2E Prompt](plans/python-cell-e2e-prompt.md) | Python セル実行 E2E テスト（案G）の要求 |
| [E2E Test Improvement Plan](plans/refactored-discovering-map.md) | テストフック追加・ヘルパー作成・6ステップ改善計画 |
