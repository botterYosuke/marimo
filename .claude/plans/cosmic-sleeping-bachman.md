# Server Connection Error 時にホーム画面へリダイレクト

## Context

Tauri デスクトップアプリ (backcast) で、ノートブックのファイルが実行途中に削除されるなど予期せぬ事態が発生すると、「Server Connection Error」ページが表示されてしまう。ユーザーは、このようなケースでホーム画面（`/`）に自動的に戻りたい。

2つのシナリオがある:
1. **Vite dev proxy エラー**: バックエンドが不到達 → Vite が静的エラーHTML を返す（React 未ロード）
2. **WebSocket 致命的切断**: React アプリは動作中だが、セッション消失等で WebSocket が永久に閉じる（"kernel not found"）

## 方針

**`LINK_INTERCEPT_JS` のみ変更**（Tauri 固有コード内で完結、marimo 本体は変更なし）

## 変更ファイル

`src-tauri/src/window/manager.rs` — `LINK_INTERCEPT_JS` 定数に2ブロック追加

## 実装詳細

既存の IIFE 内（`window.open` オーバーライドの後、`})();` の前）に以下を追加:

### Block 1: Vite エラーページ検出（シナリオ1）

- `DOMContentLoaded` で `#App` div が存在しないことを確認
- `<h2>` 要素に "Server Connection Error" テキストがあるか検索
- 見つかったら `window.location.href = '/'` でリダイレクト
- `window.__TAURI_INTERNALS__` ガード付き

### Block 2: WebSocket 致命的切断検出（シナリオ2）

- `#App` div の `data-connection-state` 属性を MutationObserver で監視
- `data-connection-state="CLOSED"` かつ `.noise` 要素が存在する場合のみリダイレクト
  - `.noise` は `isClosed && !canTakeover` 時のみ描画される（`status.tsx:22`）
  - takeover シナリオ（MARIMO_ALREADY_CONNECTED）では `.noise` がないのでリダイレクトしない
  - 一時的な切断では状態が "CONNECTING" になるのでリダイレクトしない
- 1.5秒のデバウンス: 状態遷移中の誤検出を防止し、リダイレクト前に再確認
- React マウント前に init script が実行されるため、`#App` 出現をポーリングで待機（最大5秒）

### 判定マトリクス

| シナリオ | 動作 |
|----------|------|
| Vite エラーページ（バックエンド停止） | DOMContentLoaded で検出 → `/` へ |
| 致命的 WS 切断（ファイル削除、セッション消失等） | CLOSED + `.noise` → 1.5秒後に `/` へ |
| Takeover（MARIMO_ALREADY_CONNECTED） | CLOSED だが `.noise` なし → リダイレクトしない |
| 一時的切断（スリープ等） | CONNECTING 状態 → リダイレクトしない |
| 既にホーム画面 | `/` → `/` は無害 |
| Tauri 外（通常ブラウザ） | `__TAURI_INTERNALS__` なし → スキップ |

## 参照ファイル（変更なし）

- `frontend/src/components/editor/header/status.tsx:22` — `.noise` の描画条件
- `frontend/src/core/websocket/useMarimoKernelConnection.tsx:379-447` — 致命的/非致命的の切り分けロジック
- `frontend/src/components/editor/app-container.tsx:38` — `data-connection-state` 属性
- `frontend/vite.config.mts:105` — "Server Connection Error" テキスト

## 検証方法

1. `cargo tauri dev` でアプリ起動
2. ノートブックを開いた状態で marimo バックエンドを停止 → ホーム画面にリダイレクトされることを確認
3. ノートブックの .py ファイルを削除 → ホーム画面にリダイレクトされることを確認
4. 別タブで同じノートブックを開く（takeover シナリオ）→ リダイレクトされないことを確認
