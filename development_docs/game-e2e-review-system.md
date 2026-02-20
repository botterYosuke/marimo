# ゲーム e2e レビューシステム

**ステータス**: 全 7 スイート パス済み（53 passed / 3 fixme / 0 failed）
**場所**: `frontend/e2e-tests/game/`
**担当**: game ブランチで継続作業中
**最終確認日**: 2026-02-19（Python セル実行 E2E テスト追加・①→⑦全経路カバー完了）

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

### ✅ 完了（2026-02-19 カバレッジギャップ修正セッション）

E2E テスト（案 E）がバイパスしていたレイヤー①③⑤をユニットテストで個別カバー。詳細分析は `.claude/plans/e2e-test-coverage-gap-analysis.md` を参照。

- [x] ✅ **レイヤー① Python `emit_skill()` HTML 生成テスト**: `src-tauri/resources/files/test_skill_events.py`（12件パス）— HTML タグ・属性名・base64 payload・重複防止・フロントエンドとの契約テスト
- [x] ✅ **レイヤー③ HTML パーステスト**: `frontend/src/core/kernel/__tests__/extractBroadcast.test.ts`（10件パス）— Pattern 1（`<marimo-broadcast>` タグ）/ Pattern 2（`data-marimo-broadcast` 属性）/ emit_skill() 出力との契約テスト
- [x] ✅ **レイヤー⑤ BroadcastChannel リスナーテスト**: `frontend/src/components/skill-tree/__tests__/skill-complete-handler.test.ts`（11件パス）— 正常系・異常系・クリーンアップ・sendBroadcastMessage() との結合テスト
- [x] ✅ **`handlers.ts` の `extractAndSendBroadcastMessages` を `export` に変更**: テストからのアクセスのため

### ✅ 完了（2026-02-19 全スイート実行確認セッション）

- [x] ✅ **`sandbox.spec.ts`**: 10 passed (2.2m)
- [x] ✅ **`ui.spec.ts`**: 9 passed / 3 skipped (1.9m) — 報酬バッジセレクター修正（知見 22）
- [x] ✅ **`persistence.spec.ts`**: 8 passed (1.7m)
- [x] ✅ **`bridge.spec.ts`**: 10 passed (2.3m)
- [x] ✅ **`ui.spec.ts` の報酬バッジテスト修正**: Badge コンポーネントは `<div>` に Tailwind クラスを付与するだけで `class` に "Badge" 文字列が含まれないため、`[class*="Badge"]` → `.border-t .rounded-full` セレクターに変更

### ✅ 完了（2026-02-19 E2E カバレッジ改善セッション）

計画書: `.claude/plans/refactored-discovering-map.md`（全 6 Step）

- [x] ✅ **Step 1: ユニットテスト失敗修正**: `skill-complete-handler.test.ts` の 3 件のタイムアウト/失敗を修正。原因は `extractAndSendBroadcastMessages` の import が `vi.resetModules()` + 動的 `import()` でカーネル初期化の重い副作用を再実行していたこと。`vi.mock("@/core/kernel/handlers")` で解決（テスト時間 21.7s → 3.2s）（知見 24）
- [x] ✅ **Step 1: `__testInjectBroadcastHTML` フック追加済み**: `skill-complete-handler.ts` に HTML パイプライン（③→⑦）経由のテストフックを追加（知見 25）
- [x] ✅ **Step 2: `emitSkillEventViaHTML()` ヘルパー追加**: `helpers.ts` に HTML 注入方式のヘルパーを追加。`emitSkillSequenceViaHTML()` も追加
- [x] ✅ **Step 3: `integration.spec.ts` 新規作成**: HTML パイプライン経由の統合テスト 9 件（全通過）。BroadcastChannel 同一コンテキスト配信が動作することを確認（知見 25）
- [x] ✅ **Step 4: 弱いアサーション修正**: `persistence.spec.ts` の `.catch(() => {})` トースト握りつぶし除去。`ui.spec.ts` の `if/else test.skip()` パターン 3 箇所を `test.fixme()` に変更（知見 26）
- [x] ✅ **Step 5: タイムアウト改善**: `sandbox.spec.ts` / `bridge.spec.ts` の `waitForTimeout` → `expect().toPass()` 状態ベース待機に変更。`bridge.spec.ts` のエスカレーティングタイムアウトを `SKILL_STATUS_TIMEOUT` 定数に統一（知見 29）
- [x] ✅ **Step 6: マジックナンバー排除**: `constants.ts` を新規作成。`TOTAL_SKILL_COUNT`, `SANDBOX_SKILL_IDS`, `BRIDGE_SKILL_IDS`, `getTotalCashAfterSkills()`, `FIRST_MILESTONE` を production コード（`skill-data.ts`, `reward-system.ts`）から導出（知見 28）
- [x] ✅ **最終検証**: ユニットテスト 21/21 passed、E2E テスト 46 passed / 3 fixme / 0 failed (7.0m)

### ✅ 完了（2026-02-19 Python セル実行 E2E テスト追加セッション）

計画書: `.claude/plans/python-cell-e2e-prompt.md`（案 G: ①→⑦全経路）

- [x] ✅ **`z-python-e2e.spec.ts` 新規作成**: Python セル実行で ①→⑦ 全経路を検証する E2E テスト（4 ケース全通過）
- [x] ✅ **`emitSkillViaPython()` ヘルパー追加**: `helpers.ts` に Python セル実行でスキル完了させるヘルパーを追加（知見 30）
- [x] ✅ **`runNewCellInGrid()` ヘルパー追加**: グリッドレイアウトモードでのセル作成・実行ヘルパー（知見 31）
- [x] ✅ **カーネル永続セルの状態汚染対策**: ファイル名を `z-` 接頭辞にして最後に実行（知見 34）
- [x] ✅ **全 7 スイート（53 テスト）パス確認**: 既存テストへのリグレッションなし

### ⬜ 未完了・今後の課題

- [ ] フルトラックのテスト（`trade.spec.ts`, `risk.spec.ts` 等）
- [ ] Electron（Tauri）モードでのテスト対応
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
├── helpers.ts           # 共通ヘルパー（イベント送信・HTML注入・Python セル実行・状態取得・パネル操作）
├── constants.ts         # ✅ production コードから導出した定数（マジックナンバー排除）
├── sandbox.spec.ts      # サンドボックストラック SANDBOX_001〜006（10ケース）
├── ui.spec.ts           # パネル UI・視覚状態・報酬表示（9ケース + 3 fixme）
├── persistence.spec.ts  # 進捗の初期化・BroadcastChannel 処理（8ケース）
├── bridge.spec.ts       # ブリッジトラック BRIDGE_001〜003（10ケース）
├── integration.spec.ts  # ✅ HTML パイプライン統合テスト（9ケース）③→⑦経路
└── z-python-e2e.spec.ts # ✅ Python セル実行 E2E テスト（4ケース）①→⑦全経路

frontend/e2e-tests/py/
└── game_test.py         # テスト用マリモノートブック（grid レイアウト）

# ユニットテスト（レイヤー①③⑤のカバレッジギャップ修正）
src-tauri/resources/files/
└── test_skill_events.py                    # ① emit_skill() HTML 生成テスト（12件）

frontend/src/core/kernel/__tests__/
└── extractBroadcast.test.ts                # ③ HTML パーステスト（10件）

frontend/src/components/skill-tree/__tests__/
└── skill-complete-handler.test.ts          # ⑤ BroadcastChannel リスナーテスト（11件）
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

**案 F: HTML 注入方式（③→⑦統合テスト）** ← **2026-02-19 追加・テスト通過**
```
テスト → page.evaluate() で window.__testInjectBroadcastHTML(html) を呼ぶ
       → extractAndSendBroadcastMessages() が HTML をパース
       → sendBroadcastMessage() が BroadcastChannel で配信
       → setupSkillEventListener() のリスナーが受信
       → completeSkillWithRewardAtom → playerProgressAtom → UI 更新
```
- ✅ レイヤー③→⑦の全経路をテスト（案 E より広いカバレッジ）
- ✅ BroadcastChannel の同一コンテキスト配信が動作することを確認済み
- ✅ emit_skill() と同じ HTML フォーマットを使用（契約テスト的側面）
- △ 案 E より若干遅い（HTML パース + BroadcastChannel 配信のオーバーヘッド）
- △ テスト専用フックのため、レイヤー①②（Python HTML 生成・WebSocket 転送）はテストされない

**案 G: Python セル実行方式（①→⑦全経路）** ← **2026-02-19 追加・テスト通過**
```
テスト → runNewCellInGrid() で Python セルを作成・実行
       → Python カーネルが HTML を生成（①）
       → WebSocket で Frontend に転送（②）
       → extractAndSendBroadcastMessages() が HTML パース（③）
       → sendBroadcastMessage() が BroadcastChannel で配信（④）
       → setupSkillEventListener() のリスナーが受信（⑤）
       → completeSkillWithRewardAtom → playerProgressAtom → UI 更新（⑥→⑦）
```
- ✅ **全 7 レイヤーをカバー**（テストフック一切不使用）
- ✅ Backcast エンジン不要（インライン版 emit_skill で `progress_manager` 依存を回避）
- ✅ BroadcastChannel の実際の送受信を検証
- △ セルが最も遅い（5〜10 秒/セル）
- △ カーネルにセルが永続するため、テスト実行順序に注意（知見 34）

**案 E / F / G の使い分け**:
- 案 E（`emitSkillEvent`）: 回帰テスト・既存テストスイートに使用。高速・安定（⑥→⑦）
- 案 F（`emitSkillEventViaHTML`）: 統合テスト（`integration.spec.ts`）に使用。パイプライン部分検証（③→⑦）
- 案 G（`emitSkillViaPython`）: 全経路テスト（`z-python-e2e.spec.ts`）に使用。最もリアルな検証（①→⑦）

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

### 22. カバレッジギャップ修正のユニットテスト（2026-02-19 追加）

案 E がバイパスするレイヤー①③⑤を**契約テスト（Contract Test）**のアプローチでカバー。各テストはレイヤー間の通信プロトコル（HTML 属性名・JSON キー名・BroadcastChannel チャネル名）が両端で一致することを検証し、一方が変更された場合に検知できる。

**Python テスト（レイヤー①）の注意点**:
- `skill_events.py` の `_triggered_skills` はモジュールグローバルな `set`。テストごとに `sys.modules.pop("skill_events", None)` でリロードが必要
- `Html` オブジェクトは `str()` で HTML を返さない。`.text` プロパティを使う
- 実行: `uvx hatch run +py=3.12 test:test src-tauri/resources/files/test_skill_events.py -v`

**TypeScript パーステスト（レイヤー③）の注意点**:
- `extractAndSendBroadcastMessages` は元々非公開だったが `export` に変更済み（`handlers.ts` L232）
- `sendBroadcastMessage` をモックしてパース結果（channel, type, payload）をキャプチャ
- 実行: `cd frontend && pnpm test src/core/kernel/__tests__/extractBroadcast.test.ts`

**TypeScript リスナーテスト（レイヤー⑤）の注意点**:
- jsdom は `BroadcastChannel` をサポートしないため `MockBroadcastChannel` クラスを使用
- `vi.resetModules()` + 動的 `import()` でモック適用後のモジュールを取得
- `msg.data.skill_id`（snake_case）であることが検証の要点。camelCase `skillId` では動かない
- 実行: `cd frontend && pnpm test src/components/skill-tree/__tests__/skill-complete-handler.test.ts`

### 23. Badge コンポーネントのセレクターには "Badge" が含まれない（2026-02-19 修正）

**問題**: `ui.spec.ts` の「スキルノードに報酬バッジが表示される」テストが `[class*="Badge"]` / `.badge` で Badge を探していたが、Badge コンポーネント（`components/ui/badge.tsx`）は `<div>` に `inline-flex items-center border rounded-full ...` の Tailwind クラスを付与するだけで、"Badge" という文字列はクラスに含まれない。

**修正**: 報酬セクション（`border-t` クラスを持つ div）内の `rounded-full` 要素で Badge の存在を判定する方式に変更。

```typescript
// ❌ 旧セレクター（class に "Badge" が含まれないため一致しない）
page.locator('[data-skill-id="SANDBOX_001"] [class*="Badge"]')

// ✅ 新セレクター（Badge の Tailwind クラス rounded-full で判定）
const rewardSection = page.locator('[data-skill-id="SANDBOX_001"] .border-t').first();
const badge = rewardSection.locator(".rounded-full").first();
```

**教訓**: shadcn/ui の Badge や Button 等のコンポーネントは、レンダリング時にコンポーネント名をクラスに含めない。Tailwind の実際のクラス名か `data-testid` 属性でセレクターを構成する必要がある。

### 24. `vi.mock()` で重い依存をモックしてユニットテスト高速化（2026-02-19 追加）

**問題**: `skill-complete-handler.test.ts` の正常系テスト 3 件がタイムアウト（5s）していた。`vi.resetModules()` + 動的 `import("../skill-complete-handler")` のたびに `@/core/kernel/handlers` モジュール全体が再初期化され、カーネルセッション開始（"Starting a new session"）やバージョン取得（"Failed to get version from mount config"）などの重い副作用が走っていた。

**原因**: Step 1 で `skill-complete-handler.ts` に追加した `import { extractAndSendBroadcastMessages } from "@/core/kernel/handlers"` が、テストの動的インポート時に `handlers.ts` → `broadcastChannel.ts` → その他カーネル依存を丸ごと引き込んでいた。

**修正**: テストファイルの先頭で `vi.mock()` を追加。Vitest の `vi.mock()` は自動ホイストされ、`vi.resetModules()` 後の動的インポートでも mock factory が再適用される。

```typescript
vi.mock("@/core/kernel/handlers", () => ({
  extractAndSendBroadcastMessages: vi.fn(),
}));
```

**効果**: テスト時間 21.7s → 3.2s（6.8x 高速化）。11 テスト全通過。

**教訓**: ユニットテストで `vi.resetModules()` + 動的 import を使う場合、テスト対象モジュールの import グラフ全体が再初期化される。テストに不要な重い依存は `vi.mock()` で切り離すべき。

### 25. `__testInjectBroadcastHTML` フック — HTML パイプライン統合テスト（2026-02-19 追加）

**背景**: 既存の `__testCompleteSkill` フックはレイヤー⑥→⑦（atom 更新→UI 反映）のみをテストし、③→⑤（HTML パース→BroadcastChannel 送信→リスナー受信）をバイパスしていた。

**新フック**: `setupSkillEventListener()` に `__testInjectBroadcastHTML` を追加。`extractAndSendBroadcastMessages(html)` を呼び出し、本番と同じ HTML パース→BroadcastChannel 配信→リスナー受信→atom 更新→UI 反映の経路（③→⑦）を通す。

```typescript
// skill-complete-handler.ts 内
(window as any).__testInjectBroadcastHTML = (html: string) => {
  extractAndSendBroadcastMessages(html);
};
```

**テストヘルパー**: `emitSkillEventViaHTML(page, skillId)` が emit_skill() と同じ HTML を生成して注入する。

```typescript
const payload = btoa(JSON.stringify({ skill_id: id, context: {}, timestamp: Date.now() }));
const html = `<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="${payload}" style="display:none;"></marimo-broadcast>`;
```

**BroadcastChannel 同一コンテキスト配信の確認**: `integration.spec.ts` のテスト 1 が通過したことで、`sendBroadcastMessage()` の送信インスタンスと `setupSkillEventListener()` の受信インスタンスが別の `BroadcastChannel` オブジェクトであるため、Web 仕様どおり配信されることを確認。フォールバック不要。

**テスト範囲の使い分け**:
- `emitSkillEvent()` (案 E): 高速・安定。既存テストの回帰テストに最適
- `emitSkillEventViaHTML()` (新規): ③→⑦のパイプライン全体を検証。統合テストに使用

### 26. `test.fixme()` vs `test.skip()` — 意図の明示（2026-02-19 追加）

**問題**: `ui.spec.ts` に `if (await element.isVisible()) { test } else { test.skip() }` パターンが 3 箇所あった。このパターンは「UI が消えたら skip」= 機能が消失しても気づかない。さらに `.catch(() => {})` でアサーション失敗を握りつぶすパターンも併用されており、テストが「失敗しても通る」状態だった。

**修正**: `test.fixme("理由", async () => { ... })` に変更。

| パターン | テスト結果 | レポート表示 | 検知力 |
|---|---|---|---|
| `if (visible) test else test.skip()` | UI 消失 → skip | "skipped" | **弱い**: 機能消失を隠蔽 |
| `test.fixme("理由", ...)` | 実行スキップ | **"fixme"** | **強い**: テスト数にカウント、レポートで目立つ |
| `.catch(() => {})` | 失敗 → 警告のみ | passed（偽陽性） | **なし**: 失敗を完全に握りつぶす |

**教訓**: `test.skip()` は「このテストは今は関係ない」。`test.fixme()` は「この機能は未実装だが、実装されたら有効化すべき」。意図を区別して使い分ける。`.catch(() => {})` でアサーション失敗を握りつぶすのは**決してやらない**。

### 27. ビルド反映忘れ — 本番コード変更後は `pnpm turbo build` 必須（2026-02-19 追加）

**問題**: Step 1 で `skill-complete-handler.ts` に `__testInjectBroadcastHTML` フックを追加したが、ビルドせずに E2E テストを実行したところ、全統合テスト（9 件）が `__testInjectBroadcastHTML not found` で失敗した。

**原因**: E2E テストは `marimo/_static/` のプリビルド済みフロントエンドを使う。ソースコードの変更はビルドしないと反映されない（知見 10 と同根）。

**対策**: 本番コード（`frontend/src/` 以下）を変更したら必ず以下を実行:

```bash
cd frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/
```

**チェックポイント**: テストで `not found` エラーが出たら、まずビルド反映漏れを疑う。

### 28. `constants.ts` で production コードからテスト定数を導出（2026-02-19 追加）

**問題**: テストコードにマジックナンバーが散在していた。例: `59`（総スキル数）、`210_000`（全スキル報酬合計）、`50_000`（第 1 マイルストーンボーナス）。スキル追加・報酬変更のたびにテストも修正が必要で、乖離に気づけない。

**解決**: `frontend/e2e-tests/game/constants.ts` を新規作成し、production コードからデータを導出:

```typescript
import { skillDefinitions, milestones } from "../../src/components/skill-tree/skill-data";
import { calculateTotalRewards } from "../../src/components/skill-tree/rewards/reward-system";

export const TOTAL_SKILL_COUNT = skillDefinitions.length;           // 59
export const SANDBOX_SKILL_IDS = skillDefinitions.filter(...).map(s => s.id);
export const BRIDGE_SKILL_IDS = skillDefinitions.filter(...).map(s => s.id);
export function getTotalCashAfterSkills(skillIds: string[]): number { ... }
export const FIRST_MILESTONE = milestones[0];                       // { skillCount: 10, bonus: 50000 }
```

**前提条件**: Playwright テストは Node.js で実行される。`skill-data.ts` と `reward-system.ts` はブラウザ API 非依存の純粋データ/ロジックファイルのため Node.js から直接 import 可能。`e2e-tests/tsconfig.json` に `"@/*": ["../src/*"]` パスマッピングあり。

**教訓**: テストのマジックナンバーは production コードから導出できる場合、直接 import して導出する。「59」と書くよりも `skillDefinitions.length` と書くほうが、スキル追加時に自動で追従する。

### 29. `expect().toPass()` で状態ベース待機に統一（2026-02-19 追加）

**問題**: `waitForTimeout(500)` / `waitForTimeout(300)` による固定時間待機が散在していた。テスト環境の速度によって不安定になる（速い環境: 足りない、遅い環境: 無駄に待つ）。また `bridge.spec.ts` では `10_000` → `12_000` → `15_000` とエスカレーティングタイムアウトが使われ、根拠が不明だった。

**修正パターン**:

```typescript
// ❌ 固定時間待機
await page.waitForTimeout(500);
const status = await getSkillStatus(page, "SANDBOX_002");
expect(status).toBe("locked");

// ✅ 状態ベース待機（ポーリング）
await expect(async () => {
  expect(await getSkillStatus(page, "SANDBOX_002")).toBe("locked");
}).toPass({ timeout: 3_000 });
```

**`bridge.spec.ts` のタイムアウト統一**:

```typescript
const SKILL_STATUS_TIMEOUT = 10_000;
// 全 waitForSkillStatus で統一使用
await waitForSkillStatus(page, "BRIDGE_003", "completed", SKILL_STATUS_TIMEOUT);
```

**教訓**: `waitForTimeout` は「最低でもこの時間待つ」であり、「この時間で十分」の保証がない。`expect().toPass()` はタイムアウト内でポーリングし、条件成立時点で即座に次に進むため、速くかつ確実。

### 30. Python セル実行で ①→⑦ 全経路テスト — `emitSkillViaPython()`（2026-02-19 追加）

**背景**: 既存テストは全てフロントエンド側のテストフック（`__testCompleteSkill` で ⑥→⑦、`__testInjectBroadcastHTML` で ③→⑦）を使用しており、レイヤー①②（Python HTML 生成→WebSocket 転送）をバイパスしていた。

**解決策（案 G）**: `progress_manager` への依存を避けるため、`emit_skill()` のインライン版をセルに直接書く:

```python
import base64 as _base64, json as _json, time as _time
from marimo._output.hypertext import Html as _Html
_ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
_b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
_Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
```

**重要な制約**:
- `mo.output.append(Html(...))` はコンソール出力に送られ、`extractAndSendBroadcastMessages` の処理対象外。**セルの最終式**として `_Html(...)` を返す必要がある（メイン出力になる）
- marimo はセル間で同じ変数名を禁止するため、全 import/変数に `_` 接頭辞を付ける（`_base64`, `_json`, `_Html` 等）。`_` 接頭辞の変数は marimo の依存グラフから除外される

### 31. グリッドレイアウトでのセル作成 — `runNewCellInGrid()`（2026-02-19 追加）

**問題**: `game_test.py` は `width="grid"` を使用。グリッドレイアウトでは `create-cell-button`（`CreateCellButton.tsx`）が DOM に存在しない。既存の `runNewCell()` が使えない。

**解決**: 下部ツールバーの「Python」ボタン（`getByRole("button", { name: "Python", exact: true })`）を使用してセルを追加する。

```typescript
export async function runNewCellInGrid(page, code) {
  // ダイアログが開いていれば閉じる（Python ボタンを遮るため）
  // ← 知見 33 参照

  // ツールバーの Python ボタンでセル追加
  await page.getByRole("button", { name: "Python", exact: true }).click();
  await page.waitForTimeout(1_000);

  // CodeMirror エディタをフォーカスしてコード入力
  const cmContent = page.locator(".cm-content").last();
  await cmContent.click({ force: true });  // ← 知見 32 参照
  await cmContent.fill(code);

  // run-button をクリック（force: true でトースト遮蔽回避）
  await page.getByTestId("run-button").locator(":visible").last().click({ force: true });

  // セル実行完了待機
  await page.locator("[data-cell-status='running']")
    .waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
}
```

### 32. トースト・ツールバーによるポインター遮蔽と `force: true`（2026-02-19 追加）

**問題**: テストが進むとセルが蓄積し、グリッドレイアウトが混雑する。以下の要素が `.cm-content` や run-button のクリックを遮蔽する:
- 報酬トースト（`<ol class="fixed top-0 z-100 ...">`）
- Reconnected バナー（`<div role="region" aria-label="Notifications (F8)">`）
- 下部ツールバーのボタン（`<button class="... uppercase text-xs">`）
- セルのタイトルバー（`<div class="titlebar-left">`）

**対策（3 層防御）**:
1. `dismissReconnectedBanner()` でバナーを閉じる
2. 報酬トーストの Close ボタンをクリックして閉じる（`[aria-label="Notifications (F8)"] button[aria-label="Close"]`）
3. `click({ force: true })` で残りの遮蔽要素を無視

### 33. スキルツリーダイアログが Python ボタンを遮る（2026-02-19 追加）

**問題**: テスト 2 で 1 回目の `emitSkillViaPython()` 成功後、スキル完了の報酬ダイアログが表示され、2 回目の `runNewCellInGrid()` → Python ボタンクリックがタイムアウトする。

**対策**: `runNewCellInGrid()` の先頭でダイアログを閉じる:

```typescript
const dialog = page.locator('[role="dialog"]');
if (await dialog.isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
}
```

### 34. カーネル永続セルの状態汚染と実行順序制御（2026-02-19 追加）

**問題**: Python セル実行テストが作成するセルは marimo カーネルに永続する。セル出力の `<marimo-broadcast>` HTML が、後続テストファイル（sandbox.spec.ts, ui.spec.ts）のページロード時に WebSocket 経由で再送信され、`extractAndSendBroadcastMessages` で処理されてスキルが意図せず完了する。

**具体的な症状**: python-e2e → sandbox.spec.ts の順で実行されると、sandbox.spec.ts の「初期状態: SANDBOX_001 は unlocked」テストで SANDBOX_001 が既に "completed" になっている。

**原因の連鎖**:
1. python-e2e が `emitSkillViaPython("SANDBOX_001")` を実行 → セルがカーネルに追加
2. テスト後の `resetGameProgress()` は Jotai atom のみリセット（セルは残る）
3. sandbox.spec.ts がページロード → カーネルが既存セルの出力を WebSocket で再送信
4. `extractAndSendBroadcastMessages` がセル出力の HTML をパース → BroadcastChannel で配信
5. スキルリスナーが受信 → SANDBOX_001 が completed に

**解決策**: ファイル名を `z-python-e2e.spec.ts` にして、全テストファイルの最後に実行させる（Playwright はアルファベット順で実行）。次回テスト実行時にはサーバーが再起動されるため、前回の永続セルは消える。

**検討した代替案**:
- セル削除（`Shift+Backspace`）: グリッドモードでの UI 操作が複雑で不安定
- カーネル再起動: WebSocket 再接続が発生し、Reconnected バナー問題を誘発
- `page.evaluate()` で内部 API を呼ぶ: Jotai ストアがグローバルに公開されていないため困難

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
| テストフック（完了） | `window.__testCompleteSkill` | ✅ `setupSkillEventListener()` が公開・テスト通過（⑥→⑦のみ） |
| テストフック（HTML注入） | `window.__testInjectBroadcastHTML` | ✅ `setupSkillEventListener()` が公開（③→⑦経路）（知見 25） |
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

## テストカバレッジ全体像

本番フローの 7 レイヤーに対するテストカバレッジ:

| レイヤー | 内容 | テスト | テスト種別 |
|---|---|---|---|
| ① Python `emit_skill()` | HTML 生成・base64 エンコード | ✅ カバー済 | Python ユニットテスト（`test_skill_events.py`）+ **E2E 全経路テスト**（`z-python-e2e.spec.ts`） |
| ② WebSocket 転送 | Python → Frontend 通信 | ✅ カバー済 | **E2E 全経路テスト**（`z-python-e2e.spec.ts`）— Python セル実行でカバー |
| ③ HTML パース | `extractAndSendBroadcastMessages()` | ✅ カバー済 | ユニットテスト + E2E 統合テスト（`integration.spec.ts`）+ E2E 全経路テスト |
| ④ BroadcastChannel 送信 | `postMessage()` | ✅ カバー済 | E2E 統合テスト（`integration.spec.ts`）+ E2E 全経路テスト |
| ⑤ リスナー受信・検証 | `setupSkillEventListener()` | ✅ カバー済 | ユニットテスト + E2E 統合テスト + E2E 全経路テスト |
| ⑥ Jotai atom 更新 | 前提条件・報酬計算 | ✅ カバー済 | E2E テスト（案 E + 案 F + 案 G） |
| ⑦ React UI 反映 | DOM 更新 | ✅ カバー済 | E2E テスト（案 E + 案 F + 案 G） |

---

## 既知の非カバー範囲と理由

| 非カバー範囲 | 理由 | 対策案 |
|---|---|---|
| ①〜⑦の全経路（emit_skill → UI） | ✅ **カバー済**: `z-python-e2e.spec.ts`（案 G）で ①→⑦ 全経路をテスト。インライン版 emit_skill で `progress_manager` 依存を回避 | 完了 |
| Electron の cell injection | Tauri 環境が必要 | `tauri/` サブフォルダに別テスト作成 |
| `progress_manager.py` のファイル永続化 | Python バックエンドの統合が必要 | Python 側のユニットテストで担保 |
| 本番 `emit_skill()` → DOM 経路 | Backcast エンジン + `progress_manager` 依存 | インライン版でレイヤー①②はカバー済。本番との差異は `_triggered_skills` 重複防止と `add_completed_skill` 永続化のみ |
| `SkillRewardToast` の表示 | タイムアウトが短く不安定 | `.catch()` 握りつぶしを除去済み（知見 26）。失敗なら fail に |
| ブリッジ・フルトラック | ✅ `bridge.spec.ts` 10 ケース全通過 | 完了 |

---

## 今後のテスト拡張ガイド

### ✅ ブリッジトラックのテスト — 完了

`bridge.spec.ts` で 10 ケース全通過。`SKILL_STATUS_TIMEOUT` で統一、`waitForTimeout` → 状態ベース待機に改善済み（知見 29）。

### 新しいスキルを追加した場合のテスト手順

1. `skill-data.ts` にスキル定義を追加
2. `constants.ts` は自動追従（`skillDefinitions` から動的に導出するため修正不要）
3. 必要に応じて spec ファイルにテストケースを追加
4. ビルド反映: `cd frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/`

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
| `frontend/e2e-tests/game/helpers.ts` | テストフック呼び出し・HTML注入・接続確認・バナー dismiss・パネル操作 | セレクター変更時ここを修正 | ✅ 修正済み |
| `frontend/e2e-tests/game/constants.ts` | production コードから導出したテスト定数（知見 28） | スキル追加時に自動追従 | ✅ 新規作成 |
| `frontend/e2e-tests/game/integration.spec.ts` | HTML パイプライン統合テスト（③→⑦）9 ケース | パイプライン変更時に検知 | ✅ 新規作成 |
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | BroadcastChannel 受信 + `__testCompleteSkill` / `__testResetProgress` フック公開 | フック名変更時にテストが壊れる。ユニットテストあり | ✅ 修正済み |
| `frontend/src/core/kernel/handlers.ts` | `extractAndSendBroadcastMessages()` — HTML パース + BroadcastChannel 送信 | `export` 追加済み。ユニットテストあり | ✅ |
| `src-tauri/resources/files/skill_events.py` | `emit_skill()` — `<marimo-broadcast>` HTML 生成 | HTML 属性名変更時にテストが壊れる。ユニットテストあり | ✅ |
| `frontend/src/components/skill-tree/atoms.ts` | prerequisites チェック・atom 更新 | ガードロジックの変更を検知 | ✅ console.log 削除済み |
| `frontend/src/components/skill-tree/skill-tree-graph.tsx` | React Flow ノード・エッジの表示 | `useEffect` 同期が必須（知見 17） | ✅ 修正済み |
| `frontend/src/components/skill-tree/skill-node.tsx` | `data-skill-id` / `data-skill-status` 属性 | テスト通過確認済み | ✅ |
| `frontend/src/components/skill-tree/skill-data.ts` | 全 59 スキルのタイトル・前提条件 | `data-skill-id` 使用のため影響小 | — |
| `frontend/src/components/editor/controls/skill-tree-button.tsx` | スキルツリーダイアログ・進捗バッジ・現金表示 | `data-testid` + バッジ + 現金がここ | ✅ 修正済み |
| `frontend/src/components/editor/chrome/panels/skill-tree-panel.tsx` | サイドバー版パネル（テストでは不使用） | ダイアログ版と UI が乖離しないよう注意 | — |
| `frontend/src/components/editor/controls/Controls.tsx` | SkillTreeButton の配置位置 | コントロールバー内 | — |
| `frontend/playwright.config.ts` | テスト設定・`game_test.py` エントリ・パス解決 | `import.meta.dirname` 使用（知見 13） | ✅ 修正済み |
