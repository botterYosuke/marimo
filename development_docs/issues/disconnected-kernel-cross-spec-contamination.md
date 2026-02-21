# Issue: フルラン実行時に複数スペックでカーネルが "disconnected" 状態になりテストが失敗する

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: 接続 / テスト
**ステータス**: Open

---

## 概要

全スイートをまとめて実行すると、前のテストスペックがカーネルを消耗させた後、次のスペックの `beforeEach` でカーネルが "disconnected" 状態になりテストが失敗する。単体スペックの実行では再現しない。

## 再現手順

1. `npx playwright test e2e-tests/game/ --headed --reporter=line` で全スイートを実行する
2. 以下のテストがカーネル "disconnected" エラーで失敗する:
   - `data.spec.ts:94`
   - `integration.spec.ts:51,131,154,177`
   - `sandbox.spec.ts:78`
   - `setup.spec.ts:247,281`
   - `z-python-e2e.spec.ts:136`
3. エラーメッセージに "disconnected" が含まれる（WebSocket 接続喪失）

## 2026-02-21 E2E テスト実行結果（最新: 再発・悪化確認）

83テスト実行、50 passed / 28 failed / 5 skipped（1.2h）。以下の disconnected 関連失敗を確認：

| スペック | 失敗行 | 前回記録との差 |
|---|---|---|
| `backcast-integration.spec.ts` | :348（Position表示テスト） | **新規** — 前回未記録 |
| `data.spec.ts` | :83, :94, :111, :204 | **悪化** — 前回は :94 のみ |
| `z-python-e2e.spec.ts` | :80, :112 | **悪化** — 前回は :136 のみ |

`z-python-e2e.spec.ts:112` は "browserContext エラー" として報告されており、Playwright のブラウザコンテキストが無効化された（カーネル切断後にブラウザコンテキストが解放された可能性）。

**影響範囲の拡大**: 以前は同一スペック内の後半テストのみ影響を受けていたが、2026-02-21 実行では `data.spec.ts` の最初のテスト（:83）からも失敗しており、前スペックの実行によるカーネル汚染が広がっている。

## 期待される動作

各スペックが独立した状態で実行され、前のスペックのカーネル状態に影響されない。

## 実際の動作

前のスペック（または並列実行されるスペック）がカーネルを消耗させると、後続スペックの `ensureConnected()` や `waitForKernelHealthy()` でカーネルが "disconnected"（赤いステータス）のまま回復せず、テストが失敗する。

フルランで 25 件の失敗のうち 9 件がこのカテゴリ（カテゴリ B）に分類された（初回記録時）。2026-02-21 実行では 28 件の失敗のうち disconnected 関連が最低 7 件確認された。

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/data.spec.ts` | 94行目 — disconnected エラー |
| `frontend/e2e-tests/game/integration.spec.ts` | 51, 131, 154, 177行目 |
| `frontend/e2e-tests/game/sandbox.spec.ts` | 78行目 |
| `frontend/e2e-tests/game/setup.spec.ts` | 247, 281行目 |
| `frontend/e2e-tests/game/z-python-e2e.spec.ts` | 136行目 |
| `frontend/e2e-tests/game/helpers.ts` | `waitForKernelHealthy()` — disconnected 判定ロジック（43-52行目） |

## 調査メモ

### 原因

marimo edit モードでは 1 ファイルにつき 1 つのカーネルが共有される。全スイートを順次実行すると:

1. 前のスペックが `runNewCellInGrid()` でセルを追加し、カーネルに負荷をかける
2. セルの auto_instantiate やノートブック書き込みがカーネルを不安定にする
3. 次のスペックの `beforeEach` 実行時にカーネルが "disconnected" 状態になっている
4. `waitForKernelHealthy()` は "disconnected" を検出するが、カーネルが自律的に回復するまで待機する仕組みがない

### 既存 Issue との関係

`beforeeach-timeout-after-multiple-tests.md` は `backcast-integration.spec.ts` 固有の問題として記録されているが、本 Issue は `game_test.py` を使用する複数スペック（integration, data, sandbox, setup, z-python-e2e）でも同じパターンが発生していることを示す。スペックが異なっても同一カーネル（`game_test.py`）を共有するため影響が波及する。

### `helpers.ts` の disconnected 判定

```typescript
async function waitForKernelHealthy(page: Page, timeout = 20_000): Promise<void> {
  // ...
  await expect(async () => {
    const status = await statusButton.evaluate((el) => {
      // ...
      if (cls.includes("red")) return "disconnected";
      if (cls.includes("green")) return "healthy";
      // ...
    });
    expect(status).toBe("healthy");
  }).toPass({ timeout });
}
```

`"disconnected"` 状態では `toPass()` が timeout（20 秒）まで失敗し続け、その後 `beforeEach` タイムアウトに到達する。

### カーネルが disconnected になるパターン

1. `z-python-e2e.spec.ts` が `runNewCellInGrid()` を多用し、Python コードを実行する → セル蓄積でカーネルが不安定化
2. 前スペックで `page.waitForLoadState("networkidle")` タイムアウトが発生 → リソース消耗
3. `integration.spec.ts` の `emitSkillViaPython()` が Python セルを実行 → カーネル負荷

### 修正方針

1. **短期**: 各スペックの `beforeEach` にカーネル回復待ち（最大 30 秒）を追加する
   ```typescript
   // カーネルが disconnected の場合はページをリロードして再接続を試みる
   const status = await getKernelStatus(page);
   if (status === "disconnected") {
     await page.reload();
     await page.waitForLoadState("load");
   }
   await ensureConnected(page);
   ```
2. **根本**: スペック実行順序を制御し、セルを大量追加するスペック（z-python-e2e）を最後に実行する
3. **根本**: `afterEach` でカーネルの状態をリセット（セル削除、カーネル再起動コマンドの実行）する
4. 単一カーネルを共有せず、スペックごとに独立したカーネルを使用できるかを検討する（Playwright の `--workers=1` と合わせて評価）
