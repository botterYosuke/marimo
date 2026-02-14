# Tauri E2E Tests

Tauri デスクトップアプリの E2E テスト。Playwright の CDP (Chrome DevTools Protocol) 接続を使い、WebView2 内の DOM 操作・クリック・検証を行う。

## テスト一覧

| テストファイル | 検証内容 | 状態 |
|---|---|---|
| `new-notebook.spec.ts` | 「Create a new notebook」クリックで新しい Tauri ウィンドウが開き、ノートブックエディタが表示されること | PASS |

## 実行方法

### 1. 前提条件

3 つのプロセスを別々のターミナルで起動する必要がある。

```powershell
# Terminal 1: marimo サーバー
uv run marimo edit --no-token --headless /tmp --port 2718

# Terminal 2: Tauri アプリ（CDP 有効）
$env:CARGO_TARGET_DIR = "C:\Users\sasai\cargo-target-marimo"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
cargo tauri dev
```

Tauri ウィンドウが表示されてホームページが読み込まれるまで待つ。

### 2. テスト実行

```powershell
# Terminal 3: テスト実行
cd frontend
npx playwright test --config=playwright-tauri.config.ts
```

特定のテストのみ実行:

```powershell
npx playwright test --config=playwright-tauri.config.ts e2e-tests/tauri/new-notebook.spec.ts
```

## アーキテクチャ

### 通常の E2E テストとの違い

| | 通常の E2E テスト (`playwright.config.ts`) | Tauri E2E テスト (`playwright-tauri.config.ts`) |
|---|---|---|
| ブラウザ | Playwright が Chromium を起動 | Tauri の WebView2 に CDP で接続 |
| サーバー | `webServer` 設定で自動起動 | 手動で事前起動 |
| テスト対象 | Web ブラウザ上の marimo | Tauri ウィンドウ内の marimo |
| globalSetup/Teardown | あり（プロセス管理） | なし（手動管理） |
| 検証できること | Web UI の動作 | Tauri 固有の挙動（マルチウィンドウ、IPC、リンクインターセプト等） |

### CDP 接続の仕組み

```
Tauri (WebView2 / Chromium ベース)
  ↓ WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
  ↓
CDP エンドポイント (http://localhost:9222)
  ↓ chromium.connectOverCDP()
  ↓
Playwright
  ├── context.pages()[0]  → ホームページ (http://localhost:2718/)
  ├── context.pages()[1]  → ノートブック (http://localhost:2718/?file=xxx)
  └── ...                 → 新しい Tauri ウィンドウ = 新しい Page
```

- WebView2 は Chromium ベースのため、CDP プロトコルをそのまま利用可能
- 各 Tauri ウィンドウ (WebviewWindow) は CDP 上では別々の `Page` として認識される
- `context.waitForEvent("page")` や `context.pages()` で新しいウィンドウの出現を検知できる

### Tauri ウィンドウ作成のフロー

```
User clicks "Create a new notebook" (<a target="_blank">)
  ↓ capture phase (document)
LINK_INTERCEPT_JS が発火
  ↓ e.preventDefault() + e.stopPropagation()
  ↓ window.__TAURI_INTERNALS__.invoke('window_open_notebook', { filePath })
  ↓
commands.rs: window_open_notebook() [async]
  ↓ app.run_on_main_thread()
  ↓
manager.rs: open_window()
  ↓ WebviewWindowBuilder::new().build()
  ↓
新しい Tauri ウィンドウが作成される
  ↓
CDP: 新しい Page として認識
  ↓
Playwright: context.pages() に追加される
```

## 設計上の注意点と Tips

### Tip 1: `context.waitForEvent("page")` は不安定

Tauri の新しいウィンドウ作成は CDP の `page` イベントとしてすぐに発火しない場合がある。
`about:blank` の段階でイベントが発火し、実際のナビゲーションが完了する前に検証が走る。

**推奨パターン**: `expect.poll()` でページ数をポーリングする。

```typescript
// BAD: タイミング問題あり
const [newPage] = await Promise.all([
  context.waitForEvent("page", { timeout: 15_000 }),
  homePage.click("..."),
]);

// GOOD: 安定動作
await homePage.click("...");
await expect
  .poll(() => context.pages().length, { timeout: 15_000 })
  .toBeGreaterThan(pageCountBefore);
const newPage = context.pages().find((p) => p.url().includes("__new__"));
```

### Tip 2: ホームページの特定

CDP 接続時に複数のページ (about:blank, Service Worker 等) が存在する場合がある。
ホームページは URL に `localhost` を含み、`file=` パラメータを含まないページ。
フォールバックとして `getByText("Create a new notebook")` でコンテンツベースの検索も行う。

### Tip 3: `window_open_notebook` は async + `run_on_main_thread` 必須

Tauri の IPC コマンドで `WebviewWindowBuilder::build()` を呼ぶ場合、同期コマンド (`fn`) だとメインスレッドでデッドロックする。必ず `async fn` + `app.run_on_main_thread()` を使う。

```rust
// BAD: デッドロックする
#[tauri::command]
pub fn window_open_notebook(app: tauri::AppHandle, ...) -> Result<(), AppError> {
    window::manager::open_window(&app, ...);  // メインスレッドが必要 → デッドロック
}

// GOOD: 動作する
#[tauri::command]
pub async fn window_open_notebook(app: tauri::AppHandle, ...) -> Result<(), AppError> {
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        window::manager::open_window(&app_clone, ...);
    })
}
```

**背景**: Tauri 2.0 の同期コマンドはメインスレッドで実行されるが、`WebviewWindowBuilder::build()` もメインスレッドへのアクセスを必要とする。結果として同一スレッドの再入が発生しデッドロックになる。`async` にすると Tokio ランタイム上で実行され、`run_on_main_thread()` で安全にメインスレッドにディスパッチできる。

### Tip 4: `stopPropagation()` は `LINK_INTERCEPT_JS` に必須

`tauri-plugin-shell` は初期化時に `<body>` の bubble phase に click handler を注入する。
このハンドラは `<a target="_blank">` を検出するとシステムブラウザで URL を開く。
`LINK_INTERCEPT_JS` は `document` の capture phase で先に発火するが、`stopPropagation()` を呼ばないと shell plugin のハンドラも発火してダブル処理になる。

```
Click イベント伝播:
  capture phase: document → LINK_INTERCEPT_JS 発火
    ↓ e.preventDefault() だけだと...
  bubble phase: body → tauri-plugin-shell の handler も発火（ダブル処理）

  capture phase: document → LINK_INTERCEPT_JS 発火
    ↓ e.preventDefault() + e.stopPropagation() なら...
  bubble phase に到達しない → shell plugin はスキップ（正常動作）
```

### Tip 5: `CARGO_TARGET_DIR` の設定

Windows で `Documents` フォルダ配下の `target/` ディレクトリを使うと、Windows Defender のリアルタイムスキャンによるファイルロック (`os error 5`) が発生する。`CARGO_TARGET_DIR` を OneDrive 管理外のディレクトリに設定すること。

```powershell
$env:CARGO_TARGET_DIR = "C:\Users\sasai\cargo-target-marimo"
```

### Tip 6: テスト間のウィンドウ残存

各テスト実行で新しいウィンドウが作成されるが、テスト終了後もウィンドウは閉じない（Tauri アプリを kill しない限り）。テスト連続実行時は前回のウィンドウが `context.pages()` に残るため、ページ検索ロジックでは URL パターンマッチを使って正しいページを特定する。

## トラブルシューティング

### `connect ECONNREFUSED ::1:9222`

CDP が有効になっていない。Tauri 起動前に環境変数を設定すること:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
```

### `No pages found in the Tauri browser context`

Tauri ウィンドウがまだ表示されていない。Tauri ビルド完了を待ってからテストを実行すること。

### テスト実行後に Tauri アプリが固まる

前回のテストで作成されたウィンドウが残っている可能性がある。Tauri を再起動する:

```powershell
Stop-Process -Name "marimo-desktop" -Force
# 再度 cargo tauri dev を実行
```

### `invoke` がハング（タイムアウト）する

`commands.rs` の IPC コマンドが同期 (`fn`) になっている可能性がある。`async fn` + `run_on_main_thread()` に修正すること。(Tip 3 参照)

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `frontend/playwright-tauri.config.ts` | Tauri テスト専用の Playwright 設定 |
| `frontend/e2e-tests/tauri/*.spec.ts` | Tauri E2E テストファイル |
| `src-tauri/src/window/manager.rs` | ウィンドウ作成 + `LINK_INTERCEPT_JS` |
| `src-tauri/src/commands.rs` | Tauri IPC コマンド（`window_open_notebook` 等） |
| `src-tauri/tauri.conf.json` | Tauri 設定（`devUrl`, CSP, `withGlobalTauri`） |
| `frontend/src/components/pages/home-page.tsx` | ホームページ UI（テスト対象） |

## 今後追加すべきテスト

- [ ] 既存ノートブックをクリックして新ウィンドウで開く
- [ ] 同じノートブックを 2 回開くと既存ウィンドウにフォーカスする（重複防止）
- [ ] 外部リンク (Documentation, GitHub 等) がシステムブラウザで開く
- [ ] 全ウィンドウを閉じるとアプリが終了する
- [ ] メニューの「New Notebook」「Open...」が動作する
- [ ] セル実行が動作する
- [ ] WebSocket 再接続（ウィンドウ最小化→復帰）
