# ゲーム e2e レビューシステム

**ステータス**: 初期実装完了・未実行（セレクター要調整）
**場所**: `frontend/e2e-tests/game/`
**担当**: sasa/ico ブランチで作業

---

## 作業進捗

### ✅ 完了

- [x] `frontend/e2e-tests/py/game_test.py` — テスト用最小ノートブック作成
- [x] `frontend/e2e-tests/game/helpers.ts` — 共通ヘルパー実装
- [x] `frontend/e2e-tests/game/sandbox.spec.ts` — サンドボックストラックテスト（9ケース）
- [x] `frontend/e2e-tests/game/ui.spec.ts` — UI テスト（11ケース）
- [x] `frontend/e2e-tests/game/persistence.spec.ts` — 永続化・イベント処理テスト（8ケース）
- [x] `playwright.config.ts` に `"game_test.py"` エントリ追加
- [x] `development_docs/index.md` にこのドキュメントをリンク追加
- [x] BroadcastChannel の「同一コンテキストには届かない」問題を調査・解決
- [x] `playerProgressAtom` が plain atom（非永続化）であることを確認

### ⬜ 未完了・今後の課題

- [ ] ブリッジトラックのテスト（`bridge.spec.ts`）
- [ ] フルトラックのテスト（`trade.spec.ts`, `risk.spec.ts` 等）
- [ ] スキルツリーパネルに `data-testid="skill-tree-panel"` を追加（セレクター安定化）
- [ ] スキルノードに `data-skill-id` 属性を追加（ID での直接選択を可能に）
- [ ] テストの実際の実行確認とセレクター修正
- [ ] Electron（Tauri）モードでのテスト対応
- [ ] Python セル実行経由の統合テスト（Backcast エンジン要）
- [ ] CI への組み込み

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
└── persistence.spec.ts  # 進捗の初期化・BroadcastChannel 処理（8ケース）

frontend/e2e-tests/py/
└── game_test.py         # テスト用マリモノートブック（最小構成）
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

**案 C: 同一オリジンの別タブから BroadcastChannel 送信** ← 採用
```
テスト → 別タブ（同一オリジン）を開く
       → 別タブから BroadcastChannel.postMessage()
       → テスト対象ページの React リスナーが受信 → スキル完了
```
- ✅ 依存なし・高速・Web 仕様に準拠
- △ タブの開閉コストあり（1 スキルあたり約 300〜500ms）

`helpers.ts` の `emitSkillEvent()` が案 C を実装している。

### Jotai ストアを直接操作しなかった理由

案 D として「`page.evaluate()` で Jotai ストアの atom を直接書き換える」を検討したが採用しなかった。

理由:
- Jotai はグローバルオブジェクトにストアを公開しない（`window.__jotai__` 等が存在しない）
- 仮に公開しても「イベント → リスナー → atom 更新」の中間処理をスキップする
- テストしたいのは「イベントが届いたときに UI が正しく更新されるか」であり、atom の状態ではない

### テスト分離戦略

各テストは `afterEach` でページをリロードして初期状態に戻す。
`playerProgressAtom` は `atomWithStorage` を使わない plain atom のため、リロードで自動的にリセットされる。

```typescript
test.afterEach(async ({ page }) => {
  await resetGameProgress(page); // = page.reload() + waitForLoadState
});
```

これにより:
- テスト間の状態汚染ゼロ
- `localStorage` の手動クリア不要
- `atomWithStorage` に変更された場合にテストが自然に失敗（検知できる）

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

// ✅ これが正解（別タブから送信）
const sender = await context.newPage();
await sender.goto(origin, { waitUntil: "commit" }); // 同一オリジン必須
await sender.evaluate(...postMessage...);
await sender.close();
```

別タブも `about:blank` では不可。**同一オリジン**（`http://127.0.0.1:2718`）に navigate してから送信する必要がある。

### 2. メッセージの形式に注意

`skill-complete-handler.ts:131` のパース処理:

```typescript
if (msg?.type === "skill_complete" && msg?.data?.skill_id) {
```

`skill_id`（スネークケース）であることに注意。`skillId`（キャメルケース）にすると届いても無視される。

### 3. スキルノードのセレクターはタイトル文字列依存

現状、スキルノードを特定するには `.react-flow__node` 内のテキスト（スキルタイトル）で絞り込む。

```typescript
page.locator(".react-flow__node").filter({ hasText: "マーケットへようこそ" })
```

**問題**: スキルタイトルを変更するとテストが壊れる。
**根本対策**: `skill-node.tsx` のルート要素に `data-skill-id={skill.id}` を追加すれば ID で選択可能になる。

```typescript
// 理想のセレクター（実装後）
page.locator(`[data-skill-id="SANDBOX_001"]`)
```

### 4. ステータス判定は CSS クラスのみで行う

`getSkillStatus()` は DOM の CSS クラスを評価して状態を判定する。

```typescript
// completed 判定
el.className.includes("border-green-500") || el.innerHTML.includes("text-green-500")

// locked 判定
el.className.includes("opacity-50")
```

`SkillNode` の `statusConfig` オブジェクト（`skill-node.tsx:56-75`）がクラスの正式定義。
クラスを変更したらここも更新が必要。

### 5. `waitForTimeout(300)` の根拠

BroadcastChannel メッセージ → React 状態更新 → DOM 再レンダリングの経路で約 300ms かかる（経験的な値）。

不安定になる場合は `waitForSkillStatus()` で能動的にポーリングすることが望ましい:

```typescript
// ❌ 固定待機（テストが速い環境では足りないことも）
await page.waitForTimeout(300);
const status = await getSkillStatus(page, "マーケットへようこそ");

// ✅ ポーリングで確実に待つ
await waitForSkillStatus(page, "マーケットへようこそ", "completed");
```

### 6. `openSkillTreePanel()` のセレクターは未確定

スキルツリーパネルへのアクセス方法はエディタの Chrome レイアウトに依存する。
現状は複数のセレクターを試すフォールバック実装になっているが、**実際に動くかはアプリを起動して確認が必要**。

最も確実な対策: `SkillTreePanel` のルート要素または開閉ボタンに `data-testid` を追加する。

```tsx
// skill-tree-panel.tsx に追加
<div data-testid="skill-tree-panel" className="...">
```

---

## セレクター早見表

| 目的 | セレクター | 備考 |
|---|---|---|
| スキルツリーパネル全体 | `[data-testid="skill-tree-panel"]` | 要追加（現状未実装） |
| スキルノード（タイトル指定） | `.react-flow__node:has-text("タイトル")` | タイトル変更で壊れる |
| スキルノード（ID 指定） | `[data-skill-id="SANDBOX_001"]` | 要追加（現状未実装） |
| 進捗バッジ | `text=/\d+\/\d+ スキル/` | パネル内 Badge コンポーネント |
| 現金表示 | `text=/¥[0-9,]+/` | フッターの CoinsIcon 隣 |
| 報酬トースト | `[role='status']` | 一時表示のため要タイミング調整 |
| セル追加ボタン | `[data-testid="create-cell-button"]:visible` | 既存テストと共通 |
| 実行ボタン | `[data-testid="run-button"]:visible` | 既存テストと共通 |

---

## `openSkillTreePanel()` の調整方法

実際にアプリを起動してスキルツリーパネルのトリガーを特定する手順:

```bash
# 1. marimo をデバッグモードで起動
uv run marimo edit frontend/e2e-tests/py/game_test.py -p 2718

# 2. ブラウザで開いてスキルツリーパネルを開く
# 3. DevTools で要素を調べてトリガーの class / role / text を確認
# 4. helpers.ts の openSkillTreePanel() を更新
```

確認後、`data-testid` を追加して長期安定させることを推奨。

---

## テスト実行方法

```bash
# ゲームテストのみ
pnpm playwright test e2e-tests/game/

# 目視確認（ヘッドあり）
pnpm playwright test e2e-tests/game/sandbox.spec.ts --headed

# 特定のテストケースのみ
pnpm playwright test e2e-tests/game/ -g "SANDBOX_006"

# 失敗時のトレース付き
pnpm playwright test e2e-tests/game/ --trace on

# HTML レポートを開く
pnpm playwright show-report
```

### 初回実行前に確認すること

1. `openSkillTreePanel()` がパネルを正しく開けるか確認（`--headed` モードで目視）
2. スキルタイトル文字列がアプリと一致しているか確認（`skill-data.ts` で照合）
3. `emitSkillEvent()` がメッセージを届けられているか確認（ブラウザ DevTools の BroadcastChannel を監視）

---

## 既知の非カバー範囲と理由

| 非カバー範囲 | 理由 | 対策案 |
|---|---|---|
| Electron の cell injection | Tauri 環境が必要 | `tauri/` サブフォルダに別テスト作成 |
| `progress_manager.py` のファイル永続化 | Python バックエンドの統合が必要 | Python 側のユニットテストで担保 |
| Python `emit_skill()` → DOM 経路 | Backcast エンジン依存 | 別途統合テスト環境を用意 |
| `SkillRewardToast` の表示 | タイムアウトが短く不安定 | `waitFor` タイムアウトを調整して有効化 |
| ブリッジ・フルトラック | 未実装（スキルファイルは準備済み） | `bridge.spec.ts` 等を追加 |

---

## 今後のテスト拡張ガイド

### ブリッジトラックのテストを追加する

```typescript
// bridge.spec.ts の骨格
test("BRIDGE_001 完了でデータが開示される", async ({ page }) => {
  // 前提: サンドボックス全スキルを完了（前提条件チェーン）
  const sandboxSkills = ["SANDBOX_001", ..., "SANDBOX_006"];
  await emitSkillSequence(context, page, sandboxSkills);

  // BRIDGE_001 を完了
  await emitSkillEvent(context, page, "BRIDGE_001");
  await waitForSkillStatus(page, "データを明かす", "completed");
});
```

### セル実行経由の統合テストを追加する

Backcast エンジン環境専用として別 describe にまとめる:

```typescript
test.describe("統合テスト（Backcast 環境必須）", () => {
  test.skip(!process.env.BACKCAST_INSTALLED, "Backcast が必要");

  test("bt.buy() 実行で SANDBOX_002 が完了する", async ({ page }) => {
    await runNewCell(page, "bt.buy()");
    await waitForSkillStatus(page, "初めての購入", "completed");
  });
});
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [skill-tree-implementation.md](skill-tree-implementation.md) | スキルツリーシステム全体のアーキテクチャ |
| [skill-event-wiring.md](skill-event-wiring.md) | BroadcastChannel リスナーの接続バグと修正 |
| [testing.md](testing.md) | Python 側のテスト規約 |
| [progress-persistence.md](progress-persistence.md) | 進捗の永続化（Electron / Web の差異） |

## 関連ソースファイル

| ファイル | 役割 | テストへの影響 |
|---|---|---|
| `frontend/e2e-tests/game/helpers.ts` | BroadcastChannel 送信・ノード状態取得 | セレクター変更時ここを修正 |
| `frontend/src/components/skill-tree/skill-complete-handler.ts:131` | メッセージ形式の定義 | `skill_id` キー名が変わると破綻 |
| `frontend/src/components/skill-tree/atoms.ts` | prerequisites チェック・atom 更新 | ガードロジックの変更を検知 |
| `frontend/src/components/skill-tree/skill-node.tsx:56-75` | statusConfig（CSS クラス定義） | クラス変更時にセレクターも更新 |
| `frontend/src/components/skill-tree/skill-data.ts` | 全 59 スキルのタイトル・前提条件 | タイトル変更時にテストが壊れる |
| `frontend/playwright.config.ts` | `game_test.py` エントリ登録済み | — |
