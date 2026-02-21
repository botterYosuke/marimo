# Issue: 複数テスト連続実行後に ensureConnected() が 30 秒タイムアウトし beforeEach が失敗する

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: 接続・安定性 / テスト信頼性
**ステータス**: Open

---

## 概要

`backcast-integration.spec.ts` の test 5（「SANDBOX_005 が重複送信される」）において、`beforeEach` の `ensureConnected(page)` が 30 秒以内に完了せずタイムアウトする。

前のテスト（test 1〜4）の実行後にカーネルが不安定な状態になり、backcast.py のカーネルへの WebSocket 接続が正常に確立されない（または「Reconnected」バナーが断続的に出現し続ける）ことが原因と推定される。

## 再現手順

1. `npx playwright test e2e-tests/game/backcast-integration.spec.ts --reporter=line` を実行する
2. test 1（完全プレイフロー）、test 2（fixme、スキップ）、test 3（BRIDGE_001 テスト）、test 4（Position 表示）を順に実行する
3. test 5（SANDBOX_005 重複送信テスト）の `beforeEach` が実行される
4. `ensureConnected()` が `waitForKernelHealthy()` → Reconnected バナーループで 30 秒以上かかる
5. `beforeEach` がタイムアウト（デフォルト 30 秒）で失敗する

## 期待される動作

`beforeEach` の `ensureConnected()` が 30 秒以内に完了し、test 5 が実行される。

## 実際の動作

```
beforeEach タイムアウト（30s 超過）
  at ensureConnected (helpers.ts)
```

test 5 が実行されることなく失敗する。

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/helpers.ts` | `ensureConnected()` — 最大 5 回のバナー安定化ループ（79-127行目） |
| `frontend/e2e-tests/game/backcast-integration.spec.ts` | `beforeEach` — `ensureConnected()` + `resetGameProgress()` を実行（95-118行目） |
| `frontend/e2e-tests/game/backcast-integration.spec.ts` | test 5（378行目〜）— タイムアウト発生テスト |

## 調査メモ

### `ensureConnected()` の構造

```typescript
export async function ensureConnected(page: Page): Promise<void> {
  // Phase 1: カーネルが healthy になるまで待機（最大 20 秒）
  await waitForKernelHealthy(page);

  // Phase 2: Reconnected バナーが出なくなるまでループ（最大 5 回）
  const maxAttempts = 5;
  const stabilityWait = 1_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // バナー検出 → dismiss → 再確認のループ
    ...
    await page.waitForTimeout(stabilityWait);  // 毎回 1 秒待機
    ...
  }
  // maxAttempts 後は警告 + 最終チェック（タイムアウトなし）
}
```

理論上の最大待機時間：
- `waitForKernelHealthy()`: 最大 20 秒
- バナーループ: 5 回 × 1 秒 = 最大 5 秒
- 合計: 最大 25 秒

`beforeEach` のデフォルトタイムアウト 30 秒との差は 5 秒のみ。実際の環境では各操作に余分な時間がかかるため、容易に 30 秒を超過する。

### 問題の構造（推定）

```
[test 3 実行後]
  → emitSkillViaPython() が新しいセルを backcast.py に追加（runNewCellInGrid）
  → backcast.py にセルが蓄積する
  → カーネル状態が不安定になる可能性

[test 4 実行]
  → runNewCellInGrid(page, "bt.buy()") でセルをさらに追加
  → 各テスト後の cleanup なし（afterEach が存在しない）

[test 5 beforeEach 開始]
  → page.goto(BACKCAST_URL) は前回と同じ URL のため省略される（needsNavigation = false）
  → ensureConnected() 開始
  → カーネルが蓄積したセルを再処理中に不安定な状態
  → Reconnected バナーが断続的に出現し続ける
  → maxAttempts = 5 を超えても安定しない
  → waitForKernelHealthy() が 20 秒以上かかる
  → 合計 30 秒超過 → beforeEach タイムアウト
```

### セル蓄積との関係

test 1〜4 の実行で `runNewCellInGrid()` が複数回呼ばれ、backcast.py にセルが追加される。セル蓄積（`bug-260221-cell-accumulation-in-notebook.md`）が進むにつれ、カーネルの auto_instantiate 処理が重くなり、WebSocket 接続の安定化に時間がかかるようになる可能性がある。

### `afterEach` が存在しないことの問題

現在の `backcast-integration.spec.ts` には `afterEach` フックが存在しない（`beforeEach` のみ）。テスト間でのセルクリーンアップが行われないため、テストが進むにつれて状態が蓄積する。

### 修正方向性

#### 案1: `beforeEach` のタイムアウトを延長する

```typescript
test.beforeEach(async ({ page }, info) => {
  test.setTimeout(60_000);  // 60 秒に延長
  ...
});
```

根本対策ではないが、即時の回避策として有効。

#### 案2: `afterEach` でセルをクリーンアップする

各テスト後に追加されたセルを削除する `afterEach` を追加する。ただし、marimo のセル削除 API を E2E テストから呼び出す方法が複雑。

#### 案3: test 5 に `test.setTimeout()` を追加する

```typescript
test("SANDBOX_005 が重複送信される（バグ確認）", async ({ page }) => {
  test.setTimeout(120_000);  // 2 分に延長
  ...
});
```

test 5 のみタイムアウトを延長する。最も局所的な修正。

#### 案4: `needsNavigation` のロジックを変更し、常に再ナビゲーションする

```typescript
// 現在
const needsNavigation = !page.url().includes("backcast.py") || info.retry;

// 変更案
const needsNavigation = true;  // 常に再ナビゲーション
```

毎回 `page.goto()` することで WebSocket 接続をリセットし、安定した初期状態から開始する。ただしテスト速度が遅くなる。

#### 推奨: 案3（即時）+ 案4（根本）

短期的には test 5 の `test.setTimeout()` を延長し、長期的にはセル蓄積問題の解決と `afterEach` でのクリーンアップ追加を行う。

### `ensureConnected()` の改善案

現在の実装では `maxAttempts` 到達後も `waitForKernelHealthy()` を呼び続ける（タイムアウトは 20 秒）。明示的な上限タイムアウトを追加することで、`beforeEach` のタイムアウト内に制御が戻るようにできる：

```typescript
export async function ensureConnected(
  page: Page,
  timeout = 25_000  // beforeEach タイムアウトより短く設定
): Promise<void> {
  const deadline = Date.now() + timeout;
  // ... 既存の実装を deadline でガードする
}
```
