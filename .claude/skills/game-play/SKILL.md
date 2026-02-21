---
name: game-play
description: "Backcast ゲームを実際にプレイし、全操作のログとスクリーンショットを記録する"
allowed-tools:
  - Bash(cd d:/Documents/marimo/frontend && npx playwright test*)
  - Bash(cd d:/Documents/marimo/frontend && pnpm turbo build*)
  - Bash(cp -R d:/Documents/marimo/frontend/dist/* d:/Documents/marimo/marimo/_static/*)
  - Bash(taskkill*)
  - Bash(mkdir*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# ゲーム実プレイ

## 役割

Backcast ゲームを実際にプレイし、全操作のログとスクリーンショットを記録する。
game-setup スキルで環境が READY になった後に実行する。

## 参照ドキュメント

**最初に必ず読むこと**: `development_docs/game/game-e2e-review-system.md`

## 実行方法の選択

### 方法A: E2E テスト経由（推奨）

**事前確認**: game-setup が完了し、port 2724 も起動済みであることを確認すること（未起動だと `Timed out waiting 30000ms from config.webServer` で即失敗）。

`/game-e2e` スキルを使って自動プレイ:

```bash
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/sandbox.spec.ts --headed
```

全スイート実行（**所要時間: 約1.2時間**）:

```bash
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/ --headed
```

> **既知の失敗**: 以下の spec ファイルは `waitForLoadState("networkidle")` を使用しており、marimo の持続的 WebSocket 接続により `networkidle` に到達しないため常に失敗する（知見35a）。これらの失敗はカウントから除外して構わない:
> - `bridge.spec.ts`
> - `ui.spec.ts`
> - `integration.spec.ts`
> - `persistence.spec.ts`
> - `z-python-e2e.spec.ts`
>
> また `data.spec.ts` はカーネル切断により長時間実行後に失敗するケースがある（既知 Issue: `disconnected-kernel-cross-spec-contamination.md`）。

### 方法B: Playwright 手動操作

ブラウザを起動し、以下の順序でコマンドを実行する。

#### サンドボックスモード（SANDBOX_001〜006）

| 順序 | スキルID | 操作 | 期待結果 |
|------|---------|------|---------|
| 1 | SANDBOX_001 | `bt.chart("7203")` | チャート表示 + スキル発火 |
| 2 | SANDBOX_002 | `bt.buy()` | 株購入 + スキル発火 |
| 3 | SANDBOX_003 | `bt.trades()` | 保有株一覧 + スキル発火 |
| 4 | SANDBOX_004 | `bt.sell()` | 株売却 + スキル発火 |
| 5 | SANDBOX_005 | `bt.chart("7203")` (2回目) | チャート再表示 + スキル発火 |
| 6 | SANDBOX_006 | (自動発火) | サンドボックス完了 |

#### ブリッジモード（BRIDGE_001〜003）

| 順序 | スキルID | 操作 | 期待結果 |
|------|---------|------|---------|
| 7 | BRIDGE_001 | `bt.reveal_data()` | データ詳細表示 + スキル発火 |
| 8 | BRIDGE_002 | `bt.get_stock_daily("7203")` | 株価データ取得 + スキル発火 |
| 9 | BRIDGE_003 | (自動発火) | ブリッジ完了 |

### Playwright セル実行（Grid レイアウト用）

```typescript
async function runCode(page: Page, code: string) {
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.waitForTimeout(1000);
  const cmContent = page.locator('.cm-content').last();
  await cmContent.click({ force: true });
  await cmContent.fill(code);
  await page.getByTestId('run-button').locator(':visible').last().click({ force: true });
  await page.waitForTimeout(2000);
}
```

## 出力

レポートを `development_docs/game-play-reports/play-log-YYYY-MM-DD.md` に作成:

```markdown
# プレイログ YYYY-MM-DD

## 実行方法
E2E テスト / Playwright 手動 / ブラウザ手動

## テスト結果サマリー
- 合計: XX passed / XX failed / XX skipped
- 実行時間: X.Xm

## スキル発火記録

| スキルID | 操作 | 結果 | 備考 |
|---------|------|------|------|
| SANDBOX_001 | `bt.chart("7203")` | OK / NG | |
| ... | | | |

## 最終ステータス
- 取得スキル数: X/59
- Equity: ¥XXX,XXX

## エラー・異常（あれば）
- ...

## スクリーンショット
- game-play-skill-tree.png
```

## 注意事項

- `auto_instantiate = true` のため、ファイルを開いた瞬間にセルが自動実行される場合がある
- `waitForLoadState("load")` を使う（`"networkidle"` は永遠に到達しない・知見35a）
- トースト通知がUIを遮る → `{ force: true }` オプション
- Grid Layout では `create-cell-button` が存在しない → ツールバーの「Python」ボタンでセル作成
- `page.reload()` は使わない（WebSocket 切断が起きる）
- Python の `_triggered_skills`（モジュールレベルの `set`）はテストリセット後も残る。`window.__testResetProgress` はフロントエンド（Jotai atom）のみリセットし Python 側は残るため、同一スキルを同一プロセス内で再発火させることはできない
- 全スイート実行後にカーネル切断が発生した場合、後続の spec ファイルのテストが連鎖的に失敗することがある

## スキル発火タイミング

- `chart()` 2回目実行時に SANDBOX_003 と SANDBOX_004 が完了していれば SANDBOX_005 発火
- サンドボックス5個完了で自動的に SANDBOX_006 発火
- BRIDGE_002 完了で自動的に BRIDGE_003 発火
