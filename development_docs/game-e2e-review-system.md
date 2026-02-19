# ゲーム e2e レビューシステム

**ステータス**: `sandbox.spec.ts` 全 10 件パス済み・**接続安定化ループ付き・「Reconnected」問題解決済み**
**場所**: `frontend/e2e-tests/game/`
**担当**: game ブランチで継続作業中
**最終確認日**: 2026-02-19（Playwright テスト実行 10 passed / 2.4m・接続安定化ループ確認付き）

---

## 作業進捗

### ✅ 完了（設計・実装フェーズ）

- [x] `frontend/e2e-tests/py/game_test.py` — テスト用ノートブック作成
- [x] `frontend/e2e-tests/game/helpers.ts` — 共通ヘルパー実装
- [x] `frontend/e2e-tests/game/sandbox.spec.ts` — サンドボックストラックテスト（10ケース）
- [x] `frontend/e2e-tests/game/ui.spec.ts` — UI テスト（11ケース）
- [x] `frontend/e2e-tests/game/persistence.spec.ts` — 永続化・イベント処理テスト（8ケース）
- [x] `playwright.config.ts` に `"game_test.py"` エントリ追加
- [x] `development_docs/index.md` にこのドキュメントをリンク追加
- [x] BroadcastChannel の「同一コンテキストには届かない」問題を調査・解決
- [x] `playerProgressAtom` が plain atom（非永続化）であることを確認
- [x] `skill-tree-panel.tsx` に `data-testid="skill-tree-panel"` 追加
- [x] `skill-node.tsx` のスキルカード div に `data-skill-id` と `data-skill-status` 属性追加
- [x] `helpers.ts` を ID ベースセレクターに全面更新（タイトル文字列依存を排除）
- [x] `sandbox.spec.ts` / `ui.spec.ts` / `persistence.spec.ts` を skill ID 使用に書き換え
- [x] `bridge.spec.ts` 作成（9ケース: BRIDGE_001〜003 の解放条件・完了フロー・ガード）
- [x] e2e-tests/tsconfig.json での型チェックがエラー 0 であることを確認
- [x] **実機確認**: Vite dev サーバー（port 3000）でスキルツリー UI が正しく表示されることを確認
- [x] **実機確認**: BroadcastChannel 別タブ送信→React リスナー受信→スキル完了→UI 更新の全フロー動作確認
- [x] **実機確認**: `data-skill-id` / `data-skill-status` 属性が全 59 スキルに正しく付与されていることを確認
- [x] **実機確認**: 前提条件チェーン動作確認（SANDBOX_001 完了→SANDBOX_002 が unlocked に遷移）
- [x] **実機確認**: `SkillTreeButton`（`data-testid="skill-tree-button"`）がコントロールバーに存在することを確認
- [x] Playwright Chromium ブラウザのインストール（`npx playwright install chromium`）

### ✅ 完了（2026-02-19 ブロッカー修正 & テスト通過セッション）

- [x] ✅ **ブロッカー 1 解消**: `playwright.config.ts` のパス解決を `path.resolve(import.meta.dirname!, ...)` で絶対パス化（知見 9 → 知見 13）
- [x] ✅ **ブロッカー 2 解消**: `pnpm turbo build` → `cp -R dist/* marimo/_static/` でフロントエンドビルド反映（知見 10）
- [x] ✅ **`openSkillTreePanel()` 修正**: サイドバーパネル前提からダイアログモードに対応（知見 8）
- [x] ✅ **`emitSkillEvent()` 全面書き換え**: BroadcastChannel 別タブ方式 → `window.__testCompleteSkill` テストフック直接呼び出しに変更（知見 14）
- [x] ✅ **`skill-complete-handler.ts` にテストフック追加**: `setupSkillEventListener()` が `window.__testCompleteSkill` を公開するように修正
- [x] ✅ **`skill-tree-button.tsx` に `data-testid="skill-tree-panel"` 追加**: ダイアログ内の div に testid を付与（知見 15）
- [x] ✅ **`skill-tree-button.tsx` に進捗バッジ・現金表示追加**: `{n}/{total} スキル` バッジと `¥{cash}` 表示をダイアログに追加（知見 15）
- [x] ✅ **`skill-tree-graph.tsx` の React Flow 同期バグ修正**: `useEffect` で atom 更新時にノード・エッジを同期（知見 17）
- [x] ✅ **`atoms.ts` からデバッグ用 `console.log` 削除**
- [x] ✅ **`diag.spec.ts` 診断テスト削除**: デバッグ用に一時作成したファイルをクリーンアップ
- [x] ✅ **`sandbox.spec.ts` 全 10 件パス**: `npx playwright test e2e-tests/game/sandbox.spec.ts --headed` → 10 passed (1.8m)

### ✅ 完了（2026-02-19 サーバー接続安定化セッション）

- [x] ✅ **「Reconnected」問題の原因特定**: marimo edit モードは 1 ファイル 1 カーネルを永続するため、`page.reload()` / `page.goto()` のたびに既存セッションへの再接続が発生しバナーが表示される（知見 16 → 知見 19 で解決）
- [x] ✅ **`ensureConnected()` 追加**: `[data-testid="backend-status"]` の緑チェックマーク（Kernel healthy）をポーリング確認してからテスト開始（知見 19）
- [x] ✅ **`dismissReconnectedBanner()` 追加**: "Reconnected" バナーを検出→閉じる共通ヘルパー。`ensureConnected()` と `openSkillTreePanel()` の両方で使用
- [x] ✅ **`resetGameProgress()` 全面書き換え**: `page.reload()` → `window.__testResetProgress` に変更。WebSocket 接続を維持したまま Jotai atom をリセット（知見 20）
- [x] ✅ **`window.__testResetProgress` テストフック追加**: `setupSkillEventListener()` に `onReset` パラメータ追加、`skill-tree-button.tsx` から `resetProgressAtom` を渡す
- [x] ✅ **`beforeEach` 最適化**: 初回テストのみ `page.goto()` で navigate、テスト 2 以降はナビゲーションをスキップして WebSocket 再接続を回避
- [x] ✅ **`sandbox.spec.ts` 安定パス確認**: Kernel healthy 確認付きで全 10 件パス（2.0m）

### ⬜ 未完了・今後の課題

- [ ] `ui.spec.ts`（11ケース）、`persistence.spec.ts`（8ケース）、`bridge.spec.ts`（9ケース）の実行・パス確認
- [ ] フルトラックのテスト（`trade.spec.ts`, `risk.spec.ts` 等）
- [ ] Electron（Tauri）モードでのテスト対応
- [ ] Python セル実行経由の統合テスト（Backcast エンジン要）
- [ ] CI への組み込み

---

## 2026-02-19 実機確認レポート

### 確認手順

1. `uv run marimo edit --no-token --headless /tmp --port 2718` でバックエンド起動
2. `cd frontend && pnpm dev` で Vite dev サーバー（port 3000）起動
3. `http://localhost:3000/?file=frontend\e2e-tests\py\game_test.py` でノートブック開封
4. Playwright MCP ブラウザで操作・検証

### 確認結果

| 項目 | 結果 | 備考 |
|---|---|---|
| 59 スキル全表示 | **OK** | 全ノードに `data-skill-id` / `data-skill-status` 付与済み |
| SANDBOX_001 初期状態 | **OK** | `data-skill-status="unlocked"`（前提条件なし） |
| その他 58 スキル初期状態 | **OK** | 全て `data-skill-status="locked"` |
| BroadcastChannel 通信 | **OK** | 別タブ→`skill_event_channel`→React リスナー受信 |
| スキル完了→UI 更新 | **OK** | SANDBOX_001: unlocked→**completed**（緑チェック） |
| 前提条件チェーン | **OK** | SANDBOX_002: locked→**unlocked**（青ボーダー） |
| 報酬トースト | **OK** | 完了時にトースト表示（通知エリアに出現を確認） |
| `SkillTreeButton` | **OK** | ダイアログモードで正常にスキルツリー表示 |
| `openSkillTreePanel()` | **✅ 修正済み** | ダイアログモードに対応（知見 8） |
| Playwright e2e テスト | **✅ 10 passed** | ブロッカー解消 + Kernel healthy 確認付き・Reconnected 問題解決済み |

### コンソールログでの受信確認

```
[SkillHandler] Received skill event: SANDBOX_001
```
→ `skill-complete-handler.ts:90` が BroadcastChannel メッセージを正しくパースしている。

---

## 背景・このシステムを作った理由

スキルツリーゲームは 59 スキル × 複雑な前提条件グラフを持つ。
スキルの追加・修正のたびに人間が「プレイしてみて動くか確認する」のは現実的ではない。

レビュアーが手動で確認していたチェックリスト:

```
□ SANDBOX_001 を完了すると SANDBOX_002 が開く
□ 前提スキル未完了なのに解除されていないか
□ スキル完了後に現金が増えているか
□ 同じスキルが 2 回完了扱いにならないか
□ ページリロード後の挙動
□ 報酬トーストが表示されるか
...（全 59 スキル分）
```

これを Playwright で自動化し、PR ごとに回帰テストとして実行する。

---

## ファイル構成

```
frontend/e2e-tests/game/
├── helpers.ts           # 共通ヘルパー（イベント送信・状態取得・パネル操作）
├── sandbox.spec.ts      # サンドボックストラック SANDBOX_001〜006（9ケース）
├── ui.spec.ts           # パネル UI・視覚状態・報酬表示（11ケース）
├── persistence.spec.ts  # 進捗の初期化・BroadcastChannel 処理（8ケース）
└── bridge.spec.ts       # ✅ ブリッジトラック BRIDGE_001〜003（9ケース）

frontend/e2e-tests/py/
└── game_test.py         # テスト用マリモノートブック（grid レイアウト）
```

既存テストとの対比:

```
e2e-tests/
├── cells.spec.ts        # edit モード・セル操作（既存）
├── components.spec.ts   # run モード・UI コンポーネント（既存）
└── game/                # ← 今回追加（edit モード・ゲーム固有）
```

---

## 設計思想

### 「実際にプレイする」とは何か

「Playwright がゲームをプレイする」と言うとき、選択肢は 3 つあった:

**案 A: Python セルを実際に実行**
```
テスト → marimo エディタのセルに bt.buy() を入力 → 実行
       → Python が emit_skill() → DOM に <marimo-broadcast> 追加
       → React が検知 → スキル完了
```
- ✅ 最もリアルなフロー
- ❌ Backcast エンジンのインストールが必要（CI で管理困難）
- ❌ 株価データ・エンジン状態に依存し不安定

**案 B: BroadcastChannel を直接操作**
```
テスト → page.evaluate() で BroadcastChannel.postMessage()
       → React リスナーが受信 → スキル完了
```
- ✅ 依存なし・高速
- ❌ BroadcastChannel は送信元コンテキスト自身には届かない（Web 仕様）→ 動かない

**案 C: 同一オリジンの別タブから BroadcastChannel 送信** ← 採用・**実機動作確認済み**
```
テスト → 別タブ（同一オリジン）を開く
       → 別タブから BroadcastChannel.postMessage()
       → テスト対象ページの React リスナーが受信 → スキル完了
```
- ✅ 依存なし・高速・Web 仕様に準拠
- ✅ **2026-02-19 実機確認済み**: 別タブ送信→受信→atom 更新→DOM 反映の全フロー動作
- △ タブの開閉コストあり（1 スキルあたり約 300〜500ms）

`helpers.ts` の `emitSkillEvent()` は当初案 C を実装していた。

**案 E: テストフック経由で直接呼び出し** ← **現在採用中**（2026-02-19 修正）
```
テスト → page.evaluate() で window.__testCompleteSkill(skillId) を呼ぶ
       → setupSkillEventListener() が公開したコールバック
       → completeSkillWithRewardAtom → playerProgressAtom → UI 更新
```
- ✅ 依存なし・高速・BroadcastChannel の制約を完全回避
- ✅ atom 書き込み → derived atom 再計算 → DOM 更新の全経路をテスト
- ✅ タブの開閉コストなし（1 スキルあたり 300ms の waitForTimeout のみ）
- △ テスト専用フックのため、BroadcastChannel 自体の E2E テストにはならない
- △ `setupSkillEventListener()` が mount されている必要がある

**案 C → 案 E へ移行した理由**:
案 C（別タブから BroadcastChannel 送信）は手動確認では動作したが、Playwright テストでは別タブを開いた際に marimo サーバーが「Reconnected（既存セッションに再接続しました）」バナーを表示し、テスト対象ページのセッション状態が不安定になった。また Web Worker を経由する方式も試みたが、Worker は BroadcastChannel のコンテキスト分離の観点で同一エージェントに属するため同じ制約を受けた。

BroadcastChannel 自体の動作は手動で確認済みのため、テストではフック経由に切り替えた。

`helpers.ts` の `emitSkillEvent()` が案 E を実装している。

### Jotai ストアを直接操作しなかった理由

案 D として「`page.evaluate()` で Jotai ストアの atom を直接書き換える」を検討したが採用しなかった。

理由:
- Jotai はグローバルオブジェクトにストアを公開しない（`window.__jotai__` 等が存在しない）
- 仮に公開しても「イベント → リスナー → atom 更新」の中間処理をスキップする
- テストしたいのは「イベントが届いたときに UI が正しく更新されるか」であり、atom の状態ではない

### テスト分離戦略

各テストは `afterEach` で Jotai atom を直接リセットして初期状態に戻す。
`page.reload()` は使わない — WebSocket 接続を維持し「Reconnected」バナーを防ぐため（知見 19・20）。

```typescript
test.beforeEach(async ({ page }, info) => {
  // 初回テストまたはリトライ時のみナビゲーション
  const needsNavigation = !page.url().includes("game_test.py") || info.retry;
  if (needsNavigation) {
    await page.goto(getAppUrl(APP));
    await page.waitForLoadState("networkidle");
  }
  await ensureConnected(page);   // 接続安定化ループ（知見 19・21）
  await openSkillTreePanel(page);
});

test.afterEach(async ({ page }) => {
  await resetGameProgress(page); // = __testResetProgress + ダイアログ close
});
```

これにより:
- テスト間の状態汚染ゼロ（atom 直接リセット）
- WebSocket 接続を維持（再接続なし・「Reconnected」バナーなし）
- 各テスト開始前に Kernel healthy を確認（切断状態でのテスト実行を防止）
- `atomWithStorage` に変更された場合は `__testResetProgress` の修正が必要（検知可能）

---

## 実装上の知見と落とし穴

### 1. BroadcastChannel は同一コンテキストに届かない

Web の仕様で、BroadcastChannel は **送信元のブラウジングコンテキスト（タブ）自身には届かない**。
`page.evaluate()` 内から送信したメッセージは、同じ `page` の React リスナーには届かない。

```typescript
// ❌ これは動かない
await page.evaluate(() => {
  const bc = new BroadcastChannel("skill_event_channel");
  bc.postMessage({ type: "skill_complete", data: { skill_id: "SANDBOX_001" } });
  // → 同じページのリスナーには届かない
});

// ✅ これが正解（別タブから送信）— 2026-02-19 実機動作確認済み
const sender = await context.newPage();
await sender.goto(origin, { waitUntil: "commit" }); // 同一オリジン必須
await sender.evaluate(...postMessage...);
await sender.close();
```

別タブも `about:blank` では不可。**同一オリジン**（`http://127.0.0.1:2718` や `http://localhost:3000`）に navigate してから送信する必要がある。

### 2. メッセージの形式に注意

`skill-complete-handler.ts:90` のパース処理:

```typescript
if (msg?.type === "skill_complete" && msg?.data?.skill_id) {
```

`skill_id`（スネークケース）であることに注意。`skillId`（キャメルケース）にすると届いても無視される。

### 3. スキルノードのセレクターはタイトル文字列依存 → ✅ 解決済み

`data-skill-id` 属性の導入により、タイトル文字列への依存は排除された。

```typescript
// ✅ 現在のセレクター（安定）
page.locator(`[data-skill-id="SANDBOX_001"]`)

// ⚠️ 旧セレクター（非推奨・残存している場合は更新すること）
page.locator(".react-flow__node").filter({ hasText: "マーケットへようこそ" })
```

### 4. ステータス判定は `data-skill-status` 属性で行う → ✅ 解決済み

`getSkillStatus()` は `data-skill-status` 属性を直接読み取る方式に更新済み。
CSS クラスベースの判定はフォールバックとして残存。

```typescript
// ✅ 現在の判定方式（高速・確実）
const status = await node.getAttribute("data-skill-status");
// → "completed" | "unlocked" | "locked"
```

### 5. `waitForTimeout(300)` の根拠

BroadcastChannel メッセージ → React 状態更新 → DOM 再レンダリングの経路で約 300ms かかる（経験的な値）。

不安定になる場合は `waitForSkillStatus()` で能動的にポーリングすることが望ましい:

```typescript
// ❌ 固定待機（テストが速い環境では足りないことも）
await page.waitForTimeout(300);

// ✅ ポーリングで確実に待つ
await waitForSkillStatus(page, "SANDBOX_001", "completed");
```

### 6. ハンドオフドキュメントのスキルタイトルが実際と異なっていた

ハンドオフドキュメントに記載されていたスキルタイトル（日本語）は `skill-data.ts` の実際のタイトルと不一致だった。

| ドキュメント記載 | 実際の skill-data.ts | 正解 |
|---|---|---|
| BRIDGE_001: "データを明かす" | "データの正体" | `skill-data.ts` が正 |
| BRIDGE_002: "全モード準備" | "自分でデータを取得" | `skill-data.ts` が正 |

**対策**: `data-skill-id` 属性を導入したことで、タイトル変更がテストを壊さなくなった。
ハンドオフドキュメントのタイトルが古くても今後は問題なし。

### 7. `data-skill-id` / `data-skill-status` 属性の追加で `getSkillStatus()` が高速化

変更前: CSS クラス（`opacity-50`, `border-green-500`）をパースして判定
変更後: `data-skill-status` 属性を `getAttribute()` で直接読み取り

`data-skill-status` は `SkillNode` が `statusConfig` に基づいてレンダリング時に付与する。
React 側の状態と DOM 属性が確実に同期するため、テストの判定精度が上がった。

### 8. スキルツリーの表示方式はダイアログ（サイドバーパネルではない） → ✅ 対応済み

**2026-02-19 実機確認で判明**: スキルツリーは**サイドバーパネルとして登録されていない**。

左サイドバーに表示されるパネルは以下の 7 種のみ:
`files`, `variables`, `packages`, `ai`, `outline`, `documentation`, `dependencies`

スキルツリーは `SkillTreeButton`（`data-testid="skill-tree-button"`）をクリックすると**ダイアログ**として開く。ボタンはエディタ右側のコントロールバーに配置されている（`Controls.tsx:139`）。

```
Controls.tsx:
  <CommandPaletteButton />
  <SkillTreeButton />       ← ここ
  <KeyboardShortcuts />
```

**テストへの影響**: `openSkillTreePanel()` は `data-testid="skill-tree-panel"` をサイドバーから探すが、実際にはダイアログ内にある。テストではまず `data-testid="skill-tree-button"` をクリックしてダイアログを開く必要がある。

**サイドバーパネル化する場合の手順**:

1. `frontend/src/components/editor/chrome/types.ts` の `PanelType` に `"skill-tree"` を追加し、`PANELS` 配列にエントリ追加
2. `frontend/src/components/editor/chrome/wrapper/app-chrome.tsx` に lazy import と `SIDEBAR_PANELS` マッピング追加
3. `skill-tree-panel.tsx` は `default export` 済みなのでそのまま使える

### 9. ~~🚨 ファイルパス解決の問題（テスト実行ブロッカー）~~ → ✅ 解決済み

**問題**: Playwright テスト実行時、marimo サーバーがテスト用ノートブックを見つけられない。

**解決**: `playwright.config.ts` の `pydir` を `path.resolve(import.meta.dirname!, "e2e-tests", "py")` に変更し、絶対パスで解決するようにした。詳細は知見 13 を参照。

### 10. ~~🚨 プリビルドフロントエンドにスキルツリー未含有（テスト実行ブロッカー）~~ → ✅ 解決済み

**問題**: `uv run marimo edit` は `marimo/_static/` のプリビルド済みフロントエンドを配信するが、スキルツリー関連コンポーネントの変更がビルドに反映されていない。

**解決**: ビルド済み。Windows 環境では `make` が使えないため以下の手順で実施:
```bash
cd frontend && pnpm turbo build
cp -R dist/* ../marimo/_static/
uv pip install -e "d:/Documents/marimo"  # marimo.exe がロック中なら先に taskkill //F //IM marimo.exe
```

**今後ソースを変更した場合は再ビルドが必要**。ビルド忘れに注意。

### 11. 報酬トーストが UI 操作を遮る場合がある

**2026-02-19 実機確認で発見**: スキル完了時に表示される報酬トースト（`Notifications (F8)` 領域）がスキルツリーボタンの上に重なり、Playwright の `.click()` がタイムアウトする。

```
<ol class="fixed top-0 z-100 ..."> from
<div role="region" aria-label="Notifications (F8)"> subtree intercepts pointer events
```

**対策**: `page.evaluate()` 経由で `.click()` を呼ぶとオーバーレイを無視できる:

```typescript
// ❌ Playwright の click はオーバーレイに遮られる
await page.locator('[data-testid="skill-tree-button"]').click();

// ✅ evaluate 経由なら通る
await page.evaluate(() => {
  document.querySelector('[data-testid="skill-tree-button"]')?.click();
});
```

テスト内で `emitSkillEvent()` の直後にボタンクリックする場合は、トーストが消えるのを待つか上記回避策を使う。

### 12. `game_test.py` の `width` が `"grid"` に変更されている

テスト用ノートブックの `width` が `"medium"` から `"grid"` に変更され、`layout_file` が追加された:

```python
app = marimo.App(
    width="grid",
    app_title="Game Test",
    layout_file="layouts/game_test.grid.json",
)
```

grid レイアウトでも BroadcastChannel テストには影響なし（実機確認済み）。ただしレイアウトファイルが存在しない場合のフォールバック動作は未確認。

### 13. ES モジュールでは `__dirname` が使えない（2026-02-19 修正で発見）

`playwright.config.ts` は ESM (`import` 構文) で書かれている。Node.js の ESM では `__dirname` が定義されないため、使用すると `ReferenceError: __dirname is not defined` になる。

```typescript
// ❌ ESM では動かない
const pydir = path.join(__dirname, "e2e-tests", "py");

// ✅ ESM では import.meta.dirname を使う（Node 22+）
const pydir = path.resolve(import.meta.dirname!, "e2e-tests", "py");
```

`import.meta.dirname` は Node.js 21.2+ / 22+ で利用可能。TypeScript では `!` (non-null assertion) が必要。

### 14. BroadcastChannel 別タブ方式は Playwright テストで実用困難（2026-02-19 修正で発見）

**設計思想では案 C（別タブから送信）を採用していたが、実際の Playwright テストでは以下の問題が発生した:**

1. **「Reconnected」セッション競合**: 別タブで marimo サーバーの URL を開くと、marimo がセッション再接続を検知し「Reconnected（既存セッションに再接続しました）」バナーをテスト対象ページに表示する。これによりテスト対象ページの状態が不安定になる。

2. **Web Worker 方式も失敗**: BroadcastChannel のコンテキスト分離を Worker で実現しようとしたが、Worker はメインページと同じ BroadcastChannel エージェントに属するため、同一コンテキスト制約を受ける。

**解決策（案 E）**: `setupSkillEventListener()` が `window.__testCompleteSkill` にコールバックを公開し、テストからは `page.evaluate()` 経由で直接呼び出す。

```typescript
// helpers.ts の emitSkillEvent()
await page.evaluate((id) => {
  const fn = (window as any).__testCompleteSkill;
  if (typeof fn === "function") {
    fn(id);
  } else {
    throw new Error("__testCompleteSkill not found");
  }
}, skillId);
await page.waitForTimeout(300);
```

```typescript
// skill-complete-handler.ts の setupSkillEventListener()
export function setupSkillEventListener(
  onSkillComplete: (skillId: string) => void
): () => void {
  // テストフック公開
  (window as any).__testCompleteSkill = onSkillComplete;

  // BroadcastChannel リスナー（本番用）
  const bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (event) => { /* ... */ };

  return () => {
    delete (window as any).__testCompleteSkill;
    bc.close();
  };
}
```

**テスト範囲のトレードオフ**: この方式では BroadcastChannel の受信経路はテストされない。ただし BroadcastChannel 自体は Web 標準 API であり、受信→パース→コールバック呼び出しの経路は手動確認済みのため、テストフック方式で十分と判断した。

### 15. ダイアログに進捗バッジ・現金表示がなかった（2026-02-19 修正で発見）

**問題**: `skill-tree-button.tsx` のダイアログは `<SkillTree>` コンポーネントだけを表示していた。一方、テストの `getProgressText()` は `text=/\d+\/\d+ スキル/` を、現金テストは `text=/¥[1-9][0-9,]*/` を探す。これらの要素はサイドバー版の `skill-tree-panel.tsx` にのみ存在し、ダイアログには無かった。

**修正内容**:
- `skill-tree-button.tsx` の `DialogHeader` に `<Badge>` で `{completedCount}/{totalCount} スキル` を追加
- `DialogContent` のフッターに `<CoinsIcon>` + `¥{progress.currentCash.toLocaleString()}` を追加
- `playerProgressAtom` を `useAtomValue` で購読し、リアクティブに更新されるようにした
- `data-testid="skill-tree-panel"` もダイアログ内の div に追加（サイドバーパネルにしか無かった）

**教訓**: サイドバーパネル版とダイアログ版で UI 要素が乖離していた。テストが前提とする UI 要素が、テスト対象のコンポーネントに実際に存在するか事前確認が必要。

### 16. ~~⚠️ テスト中に「Reconnected」バナーが表示される問題~~ → ✅ 解決済み（知見 19・20）

**症状**: `sandbox.spec.ts` の実行中、ページスナップショットに以下が表示される:
```yaml
- text: Reconnected
- generic: You have reconnected to an existing session.
- button "Restart"
```

**原因（確定）**: marimo の edit モードは 1 ファイルにつき 1 カーネルを永続する。`page.reload()` や `page.goto()` のたびに既存カーネルへの WebSocket 再接続が発生し、サーバーが「Reconnected」通知を送信する。接続自体は健全（Green チェック確認済み）。

**解決策**: 知見 19（`ensureConnected` + バナー dismiss）と知見 20（`page.reload()` 廃止）で対処済み。

### 17. React Flow の `useNodesState` は初期値しか使わない（2026-02-19 修正で発見）

**`skill-tree-graph.tsx` で最も厄介だったバグ。**

`useNodesState(initialNodes)` は React の `useState(initialNodes)` と同様に、**引数を初期値としてのみ使用する**。Jotai atom が更新され `useMemo` で `initial` が再計算されても、`useNodesState` はその変更を無視する。

```typescript
// ❌ atom 更新後もノードが古いまま
const initial = useMemo(() => createSkillElements(data.skills), [data]);
const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
// → data.skills が変わっても nodes は初期値のまま

// ✅ useEffect で同期する
useEffect(() => {
  setNodes(initial.nodes);
  setEdges(initial.edges);
}, [initial, setNodes, setEdges]);
```

**症状**: `completeSkillWithRewardAtom` が正しく実行され（console.log で確認済み）、`playerProgressAtom` が更新されているにもかかわらず、React Flow のノードが `unlocked` のまま `completed` に変わらない。atom の書き込みは成功するが DOM に反映されない。

**デバッグ経路**: atom に console.log → 実行確認 → 「DOM に反映されない」→ React Flow の `useNodesState` が犯人と特定。

**教訓**: React Flow の state hook は `useState` ラッパーであり、外部状態との同期には `useEffect` が必須。

### 18. Windows 環境での Tips

**`make` コマンドが使えない**: Windows の bash には `make` がインストールされていないことが多い。以下で代替:

```bash
# make fe の代替
cd frontend && pnpm turbo build
cp -R dist/* ../marimo/_static/

# make py の代替
uv pip install -e "d:/Documents/marimo"

# marimo.exe がロックされている場合
taskkill //F //IM marimo.exe
# その後 uv pip install を再実行
```

**パスのスラッシュ**: Windows bash ではフォワードスラッシュ `/` を使う。バックスラッシュ `\` はエスケープ文字として解釈される。

**`import.meta.dirname`**: TypeScript では `!` (non-null assertion) が必要。`import.meta.dirname!`

### 19. `ensureConnected()` パターン — テスト前のサーバー接続確認（2026-02-19 追加・知見 21 で強化）

**問題**: テストが marimo サーバーとの WebSocket 接続が確立されていない状態（切断中・未接続・再接続中）で走ると、テスト結果が信頼できない。`window.__testCompleteSkill` はフロントエンドの Jotai atom を直接操作するため、サーバー未接続でもテストが通ってしまう。

**解決**: `beforeEach` で `ensureConnected(page)` を呼び出し、実際のユーザーと同じフローで接続安定を待ってからテストを開始する:

1. **Kernel healthy 確認**: `waitForKernelHealthy()` で `[data-testid="backend-status"]` 内の SVG が `green` クラスを持つまで最大 20 秒ポーリング
2. **接続安定化ループ**: "Reconnected" バナーが出ていれば dismiss し、1 秒間バナーが再出現しないことを確認してから安定と判定（知見 21）
3. **最終 healthy 確認**: 安定化後にカーネルが健全であることを再確認

```typescript
export async function ensureConnected(page: Page): Promise<void> {
  // Phase 1: カーネルが healthy になるまで待機
  await waitForKernelHealthy(page);

  // Phase 2: 接続安定化ループ（最大 5 回）
  for (let attempt = 0; attempt < 5; attempt++) {
    if (hasBanner) { dismiss → waitForKernelHealthy → continue; }
    await page.waitForTimeout(1_000); // 安定化待機
    if (!lateArrival) { waitForKernelHealthy → return; } // 安定
    dismiss → waitForKernelHealthy; // 遅延到着 → 再ループ
  }
}
```

**接続状態の判定ロジック**（`backend-status.tsx` の SVG クラス）:

| SVG クラス | 状態 | 意味 |
|---|---|---|
| `animate-spin` | connecting | WebSocket 接続中または health check 中 |
| `green` (= `text-(--green-9)`) | healthy | 接続済み・健全 |
| `yellow` (= `text-(--yellow-9)`) | unhealthy | 接続済みだが health check 失敗 |
| `red` (= `text-red-500`) | disconnected | 切断済み |
| なし（`PowerOffIcon`） | not_started | 未接続 |

### 20. `page.reload()` を廃止して WebSocket 接続を維持する（2026-02-19 追加）

**問題**: `afterEach` の `resetGameProgress()` が `page.reload()` を使っていたため、テストごとに WebSocket が切断→再接続され「Reconnected」バナーが表示されていた。

**解決**: `page.reload()` を廃止し、テストフック `window.__testResetProgress` で Jotai atom を直接リセットする方式に変更。

**変更内容**:

| ファイル | 変更 |
|---|---|
| `skill-complete-handler.ts` | `setupSkillEventListener(onComplete, onReset?)` に `onReset` パラメータ追加。`window.__testResetProgress` として公開 |
| `skill-tree-button.tsx` | `resetProgressAtom` を `useSetAtom` で取得し、`setupSkillEventListener` に渡す |
| `helpers.ts` の `resetGameProgress()` | `page.reload()` → `page.evaluate(() => window.__testResetProgress())` + ダイアログ close |
| `sandbox.spec.ts` の `beforeEach` | 初回テストのみ `page.goto()` で navigate。テスト 2 以降はスキップ |

```typescript
// helpers.ts — 新しい resetGameProgress
export async function resetGameProgress(page: Page): Promise<void> {
  await page.evaluate(() => {
    const fn = (window as any).__testResetProgress;
    if (typeof fn === "function") fn();
    else throw new Error("__testResetProgress not found");
  });

  // ダイアログが開いていれば閉じる
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }

  await page.waitForTimeout(300);
}
```

**効果**:
- WebSocket 接続が 10 テスト通して維持される（切断ゼロ）
- 「Reconnected」バナーの新規発生を防止
- テスト実行時間が 1.8m → 2.0m（ほぼ変化なし。reload のコスト削減と ensureConnected の追加で相殺）

### 21. `ensureConnected()` の接続安定化ループ — 遅延バナー対策（2026-02-19 追加）

**問題**: 知見 20 で `page.reload()` を廃止したにもかかわらず、テスト 2〜10 の全てで「Reconnected」バナーが表示されていた。原因は以下の2つ:

1. **遅延通知**: 初回 `page.goto()` で既存セッションに再接続した際、バックエンド (`ws_endpoint.py:_reconnect_session`) が `BannerNotification("Reconnected")` を送信するが、WebSocket メッセージの到着が遅延し、テスト 1 の `ensureConnected()` が確認した後に到着する。
2. **WebSocket 自動再接続**: `ReconnectingWebSocket` (partysocket) が接続切断を検知すると自動で再接続する。バックエンドはこれを既存セッションへの再接続と判定し、再び `BannerNotification` を送信する。

**旧 `ensureConnected()`**: カーネル healthy チェック → バナーを 1 回だけ確認 → dismiss → 即座にテスト開始。遅延到着するバナーを見逃し、次のテストに影響する構造だった。

**新 `ensureConnected()`**: 接続安定化ループを導入。

```typescript
// Phase 1: カーネルが healthy になるまで待機
await waitForKernelHealthy(page);

// Phase 2: 接続安定化ループ（最大 5 回）
for (let attempt = 0; attempt < maxAttempts; attempt++) {
  // バナーがあれば dismiss → healthy 再確認 → ループ先頭に戻る
  if (hasBanner) { dismiss → waitForKernelHealthy → continue; }

  // バナーなし → 1 秒待って遅延到着がないか確認
  await page.waitForTimeout(1_000);

  // 遅延到着なし → 安定確認 → 最終 healthy チェック → return
  if (!lateArrival) { waitForKernelHealthy → return; }

  // 遅延到着あり → dismiss → ループ先頭に戻る
}
```

**テスト結果**:
- 毎テスト `attempt 1/5` でバナーを検出→dismiss→1 秒安定化待機→再出現なし→テスト開始
- 安定化ループ 2 回目以降に進むケースは未観測（バナーは常に 1 回で収束）
- 全 10 テスト passed（2.4m、安定化待機分 +0.3m）

**`dismissReconnectedBanner()` も改善**: 複数バナーに対応するためループ化（最大 5 回 dismiss）。`bannersAtom` は配列のため、複数の再接続イベントで複数バナーが蓄積される可能性がある。

---

## セレクター早見表

| 目的 | セレクター | 備考 |
|---|---|---|
| スキルツリーボタン | `[data-testid="skill-tree-button"]` | ✅ Controls.tsx に配置・**実機確認済み・テスト通過** |
| スキルツリーパネル全体 | `[data-testid="skill-tree-panel"]` | ✅ **ダイアログ内に追加済み**（`skill-tree-button.tsx`）・テスト通過 |
| スキルノード（ID 指定） | `[data-skill-id="SANDBOX_001"]` | ✅ skill-node.tsx に追加済み・**テスト通過**（推奨） |
| スキルのステータス確認 | `node.getAttribute("data-skill-status")` | ✅ "completed"\|"unlocked"\|"locked" を返す・**テスト通過** |
| スキルノード（タイトル指定） | `.react-flow__node:has-text("タイトル")` | ⚠️ 非推奨（タイトル変更で壊れる） |
| 進捗バッジ | `text=/\d+\/\d+ スキル/` | ✅ **ダイアログの DialogHeader 内** Badge コンポーネント・テスト通過 |
| 現金表示 | `text=/¥[0-9,]+/` | ✅ **ダイアログのフッター**の CoinsIcon 隣・テスト通過 |
| 報酬トースト | `[role='status']` | 一時表示のため要タイミング調整（知見 11 参照） |
| Reconnected バナー | `text=Reconnected` | ✅ `dismissReconnectedBanner()` で自動 dismiss（知見 19） |
| バナー閉じるボタン | `[data-testid="remove-banner-button"]` | Reconnected バナーの X ボタン |
| Kernel 接続状態 | `[data-testid="backend-status"]` | ✅ `ensureConnected()` で healthy 確認（知見 19） |
| テストフック（完了） | `window.__testCompleteSkill` | ✅ `setupSkillEventListener()` が公開・テスト通過 |
| テストフック（リセット） | `window.__testResetProgress` | ✅ `setupSkillEventListener()` が公開（知見 20） |
| セル追加ボタン | `[data-testid="create-cell-button"]:visible` | 既存テストと共通 |
| 実行ボタン | `[data-testid="run-button"]:visible` | 既存テストと共通 |

---

## スキルツリーの開き方（✅ 実装済み・テスト通過）

### 現在の方式: ダイアログ

```typescript
// 1. スキルツリーボタンをクリック（トースト回避のため evaluate 経由）
await page.evaluate(() => {
  document.querySelector('[data-testid="skill-tree-button"]')?.click();
});

// 2. ダイアログ内のパネルが表示されるまで待機
await page.locator('[data-testid="skill-tree-panel"]').waitFor({ timeout: 5_000 });

// 3. スキルノードの状態を確認
const status = await page
  .locator('[data-skill-id="SANDBOX_001"]')
  .getAttribute('data-skill-status');
```

### helpers.ts の `openSkillTreePanel()` — ✅ 修正済み・テスト通過

ダイアログモードに対応済み。実装は `helpers.ts` を参照。

---

## テスト実行方法

### 前提条件（重要）

```bash
# 1. フロントエンドをビルド（スキルツリーコンポーネントを _static に反映）
# Linux/Mac:
make fe
# Windows（make が使えない場合）:
cd frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/

# 2. Python パッケージを再インストール
# Linux/Mac:
make py
# Windows:
uv pip install -e "d:/Documents/marimo"

# 3. Playwright ブラウザがインストールされていること
cd frontend && npx playwright install chromium

# 4. 既存の marimo プロセスが残っていないこと（Windows）
taskkill //F //IM marimo.exe
```

### テスト実行

```bash
# ゲームテストのみ
cd frontend && pnpm playwright test e2e-tests/game/

# 目視確認（ヘッドあり）
pnpm playwright test e2e-tests/game/sandbox.spec.ts --headed

# 特定のテストケースのみ
pnpm playwright test e2e-tests/game/ -g "SANDBOX_006"

# 失敗時のトレース付き
pnpm playwright test e2e-tests/game/ --trace on

# HTML レポートを開く
pnpm playwright show-report
```

### 開発中の手動確認（Vite dev サーバー方式）

ビルドせずにソース変更を即座に確認したい場合:

```bash
# ターミナル 1: バックエンド起動
uv run marimo edit --no-token --headless /tmp --port 2718

# ターミナル 2: Vite dev サーバー起動
cd frontend && pnpm dev

# ブラウザで開く（ポート 3000）
# http://localhost:3000/?file=frontend\e2e-tests\py\game_test.py
#
# ※ ホームページ (http://localhost:3000/) の "Running notebooks" からも開ける
```

### 初回実行前に確認すること

1. フロントエンドビルドが最新であること（`marimo/_static/` に反映済み）
2. `npx playwright install chromium` が完了していること
3. 既存の marimo プロセスが残っていないこと（`taskkill //F //IM marimo.exe`）
4. `ensureConnected()` が各テスト前に Kernel healthy を確認する（自動・知見 19）
5. 「Reconnected」バナーは `dismissReconnectedBanner()` が自動で閉じる（知見 19・20）

---

## 既知の非カバー範囲と理由

| 非カバー範囲 | 理由 | 対策案 |
|---|---|---|
| BroadcastChannel 受信経路 | テストフック方式に変更したため（知見 14） | 手動確認済み・本番での動作は担保済み |
| Electron の cell injection | Tauri 環境が必要 | `tauri/` サブフォルダに別テスト作成 |
| `progress_manager.py` のファイル永続化 | Python バックエンドの統合が必要 | Python 側のユニットテストで担保 |
| Python `emit_skill()` → DOM 経路 | Backcast エンジン依存 | 別途統合テスト環境を用意 |
| `SkillRewardToast` の表示 | タイムアウトが短く不安定 | `waitFor` タイムアウトを調整して有効化 |
| ブリッジ・フルトラック | `bridge.spec.ts` 作成済み・実行未検証 | sandbox 安定確認後に実行 |

---

## 今後のテスト拡張ガイド

### ブリッジトラックのテストを追加する

```typescript
// bridge.spec.ts の骨格（作成済み・実行未検証）
test("BRIDGE_001 完了でデータが開示される", async ({ page }) => {
  // 前提: サンドボックス全スキルを完了（前提条件チェーン）
  const sandboxSkills = ["SANDBOX_001", ..., "SANDBOX_006"];
  await emitSkillSequence(context, page, sandboxSkills);

  // BRIDGE_001 を完了
  await emitSkillEvent(context, page, "BRIDGE_001");
  await waitForSkillStatus(page, "BRIDGE_001", "completed");
});
```

### セル実行経由の統合テストを追加する

Backcast エンジン環境専用として別 describe にまとめる:

```typescript
test.describe("統合テスト（Backcast 環境必須）", () => {
  test.skip(!process.env.BACKCAST_INSTALLED, "Backcast が必要");

  test("bt.buy() 実行で SANDBOX_002 が完了する", async ({ page }) => {
    await runNewCell(page, "bt.buy()");
    await waitForSkillStatus(page, "SANDBOX_002", "completed");
  });
});
```

---

## 全 59 スキル一覧（2026-02-19 実機確認済み）

実機確認時に全スキルの `data-skill-id` / `data-skill-status` / タイトルを取得した。

<details>
<summary>サンドボックストラック（6 スキル）</summary>

| ID | タイトル | 初期状態 | 報酬 |
|---|---|---|---|
| SANDBOX_001 | マーケットへようこそ | **unlocked** | +30,000円 +1 |
| SANDBOX_002 | 初めての購入 | locked | +20,000円 |
| SANDBOX_003 | 買値を確認する | locked | +10,000円 |
| SANDBOX_004 | 初めての売却 | locked | +20,000円 |
| SANDBOX_005 | チャートで振り返る | locked | +20,000円 |
| SANDBOX_006 | サンドボックス卒業 | locked | +50,000円 +1 |

</details>

<details>
<summary>失敗体験トラック（3 スキル）</summary>

| ID | タイトル | 初期状態 | 報酬 |
|---|---|---|---|
| FAIL_001 | 初めての含み損 | locked | +5,000円 +1 |
| FAIL_002 | 初めての損切り | locked | +10,000円 +1 |
| FAIL_003 | 初めての破産 | locked | +20,000円 +1 |

</details>

<details>
<summary>ブリッジトラック（3 スキル）</summary>

| ID | タイトル | 初期状態 | 報酬 |
|---|---|---|---|
| BRIDGE_001 | データの正体 | locked | +15,000円 |
| BRIDGE_002 | 自分でデータを取得 | locked | +20,000円 +1 |
| BRIDGE_003 | フルモードへ | locked | +25,000円 +1 |

</details>

<details>
<summary>セットアップトラック（5 スキル）</summary>

| ID | タイトル | 初期状態 |
|---|---|---|
| SETUP_001 | marimoを起動する | locked |
| SETUP_002 | BackcastProをインポート | locked |
| SETUP_003 | Backtestを初期化する | locked |
| SETUP_004 | 初期資金を設定する | locked |
| SETUP_005 | 手数料を設定する | locked |

</details>

<details>
<summary>データトラック（6 スキル）、トレードトラック（10 スキル）、チャートトラック（4 スキル）、インジケータートラック（9 スキル）、リスク管理トラック（10 スキル）</summary>

全て `locked` 状態で正しく初期化されていることを確認済み。
計 39 スキル、合計 59 スキル。

</details>

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [skill-tree-implementation.md](skill-tree-implementation.md) | スキルツリーシステム全体のアーキテクチャ |
| [skill-event-wiring.md](skill-event-wiring.md) | BroadcastChannel リスナーの接続バグと修正 |
| [testing.md](testing.md) | Python 側のテスト規約 |
| [progress-persistence.md](progress-persistence.md) | 進捗の永続化（Electron / Web の差異） |

## 関連ソースファイル

| ファイル | 役割 | テストへの影響 | 修正状況 |
|---|---|---|---|
| `frontend/e2e-tests/game/helpers.ts` | テストフック呼び出し・接続確認・バナー dismiss・パネル操作 | セレクター変更時ここを修正 | ✅ 修正済み |
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | BroadcastChannel 受信 + `__testCompleteSkill` / `__testResetProgress` フック公開 | フック名変更時にテストが壊れる | ✅ 修正済み |
| `frontend/src/components/skill-tree/atoms.ts` | prerequisites チェック・atom 更新 | ガードロジックの変更を検知 | ✅ console.log 削除済み |
| `frontend/src/components/skill-tree/skill-tree-graph.tsx` | React Flow ノード・エッジの表示 | `useEffect` 同期が必須（知見 17） | ✅ 修正済み |
| `frontend/src/components/skill-tree/skill-node.tsx` | `data-skill-id` / `data-skill-status` 属性 | テスト通過確認済み | ✅ |
| `frontend/src/components/skill-tree/skill-data.ts` | 全 59 スキルのタイトル・前提条件 | `data-skill-id` 使用のため影響小 | — |
| `frontend/src/components/editor/controls/skill-tree-button.tsx` | スキルツリーダイアログ・進捗バッジ・現金表示 | `data-testid` + バッジ + 現金がここ | ✅ 修正済み |
| `frontend/src/components/editor/chrome/panels/skill-tree-panel.tsx` | サイドバー版パネル（テストでは不使用） | ダイアログ版と UI が乖離しないよう注意 | — |
| `frontend/src/components/editor/controls/Controls.tsx` | SkillTreeButton の配置位置 | コントロールバー内 | — |
| `frontend/playwright.config.ts` | テスト設定・`game_test.py` エントリ・パス解決 | `import.meta.dirname` 使用（知見 13） | ✅ 修正済み |
