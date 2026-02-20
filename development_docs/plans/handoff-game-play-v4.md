# 作業依頼: ゲームE2Eテストを全トラックに拡張してください

**作成日**: 2026-02-20（v5 — sandbox.spec.ts 10/10 確認済み・次フェーズへ）

> **v4 からの主な変更**
> - sandbox.spec.ts（10件）の全テスト合格を確認済み（3.4分）
> - 全7スイート（53 passed / 3 fixme）が知見ドキュメントに記録済み
> - 次の目標: SETUP/DATA/SET/TRADE トラックのE2Eテストを新規作成
> - SKILL.md も最新化済み（知見1〜35、テストスイート一覧追加）

---

## 🎯 目的

現在 9/59 スキル（SANDBOX_001〜006 + BRIDGE_001〜003）まで動作確認済み。
残り50スキル（SETUP, DATA, SET, TRADE, CHART, IND, RISK, FAIL トラック）について
E2Eテストを新規作成し、スキル発火・前提条件チェーン・報酬を検証する。

**最初の目標**: 10スキルマイルストーン（SETUP_001 追加で +50,000円「見習い投資家」）

---

## 📋 作業手順

### ステップ1: レポートファイルの作成

`D:\Documents\marimo\.claude\plans\my-game-play-report4.md` を作成してください。

---

### ステップ2: 既存テスト全スイートの確認

全7スイートを実行してベースラインを確認します。

```bash
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/ --headed
```

**期待結果**: 53 passed / 3 fixme / 0 failed

失敗した場合は `development_docs/game-e2e-review-system.md` の知見1〜35を参照して修正してください。

---

### ステップ3: スキルツリーの全体構造の把握

`frontend/src/components/skill-tree/skill-data.ts` を読んで前提条件グラフを確認してください（すでに本ドキュメント末尾にサマリーあり）。

---

### ステップ4: 新規テストスイートの作成

#### 4.1 SETUP トラック（`setup.spec.ts`）

**ファイル**: `frontend/e2e-tests/game/setup.spec.ts`

| スキルID | タイトル | 前提条件 |
|---------|---------|---------|
| SETUP_001 | marimoを起動する | BRIDGE_003 |
| SETUP_002 | BackcastProをインポート | SETUP_001 |
| SETUP_003 | Backtestを初期化する | SETUP_002 |
| SETUP_004 | 初期資金を設定する | SETUP_003 |
| SETUP_005 | 手数料を設定する | SETUP_003 |

**テストケース方針**:
- `sandbox.spec.ts` と同じパターンを踏襲
- `emitSkillEvent(page, "SETUP_001")` でスキルを発火（`__testCompleteSkill` フック経由）
- SETUP_004・SETUP_005 は SETUP_003 から分岐（並列解放を確認）

```typescript
// setup.spec.ts の骨格（sandbox.spec.ts を参考に作成）
import { test, expect } from "@playwright/test";
import {
  emitSkillEvent,
  getSkillStatus,
  waitForSkillStatus,
  openSkillTreePanel,
  resetGameProgress,
  ensureConnected,
  getAppUrl,
} from "./helpers";
import { SETUP_SKILL_IDS } from "./constants"; // 要追加

const APP = "game_test.py";

test.describe("セットアップトラック", () => {
  test.beforeEach(async ({ page }, info) => {
    const needsNavigation = !page.url().includes("game_test.py") || info.retry;
    if (needsNavigation) {
      await page.goto(getAppUrl(APP));
      await page.waitForLoadState("load");  // "networkidle" は使わない（知見35a）
    }
    await ensureConnected(page);
    await openSkillTreePanel(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  test("初期状態: SETUP_001 は locked（BRIDGE_003 未完了）", async ({ page }) => {
    expect(await getSkillStatus(page, "SETUP_001")).toBe("locked");
  });

  test("BRIDGE_003 完了後、SETUP_001 が unlocked になる", async ({ page }) => {
    await emitSkillEvent(page, "BRIDGE_003");
    await waitForSkillStatus(page, "SETUP_001", "unlocked");
    expect(await getSkillStatus(page, "SETUP_001")).toBe("unlocked");
  });

  test("SETUP_001〜003 チェーン完了", async ({ page }) => {
    for (const id of ["BRIDGE_003", "SETUP_001", "SETUP_002", "SETUP_003"]) {
      await emitSkillEvent(page, id);
    }
    await waitForSkillStatus(page, "SETUP_003", "completed");
    // SETUP_004・SETUP_005 が並列解放される
    await waitForSkillStatus(page, "SETUP_004", "unlocked");
    await waitForSkillStatus(page, "SETUP_005", "unlocked");
  });

  // ... 他のテストケース
});
```

#### 4.2 constants.ts への SETUP 定数追加

`frontend/e2e-tests/game/constants.ts` に以下を追加:

```typescript
export const SETUP_SKILL_IDS = [
  "SETUP_001", "SETUP_002", "SETUP_003", "SETUP_004", "SETUP_005",
] as const;

export const DATA_SKILL_IDS = [
  "DATA_001", "DATA_002", "DATA_003", "DATA_004", "DATA_005", "DATA_006",
] as const;

export const SET_SKILL_IDS = ["SET_001", "SET_002", "SET_003"] as const;

export const TRADE_SKILL_IDS = [
  "TRADE_001", "TRADE_002", "TRADE_003", "TRADE_004", "TRADE_005",
  "TRADE_006", "TRADE_007", "TRADE_008", "TRADE_009", "TRADE_010",
] as const;
```

#### 4.3 DATA トラック（`data.spec.ts`）

| スキルID | タイトル | 前提条件 |
|---------|---------|---------|
| DATA_001 | get_stock_dailyを使う | SETUP_002 |
| DATA_002 | 株価データを確認する | DATA_001 |
| DATA_003 | OHLCV列を理解する | DATA_002 |
| DATA_004 | 別の銘柄を取得する | DATA_001 |
| DATA_005 | 複数銘柄を取得する | DATA_004 |
| DATA_006 | 日付範囲を指定する | DATA_001 |

**注意**: DATA_002・DATA_004・DATA_006 は DATA_001 から分岐（3方向並列解放を確認）

#### 4.4 10スキルマイルストーンの確認テスト

`ui.spec.ts` 等に以下のテストを追加または新規ファイルとして作成:

```typescript
test("10スキルマイルストーンで「見習い投資家」称号とボーナス", async ({ page }) => {
  // SANDBOX_001〜006 + BRIDGE_001〜003 + SETUP_001 の順で発火
  const chain = [
    "SANDBOX_001", "SANDBOX_002", "SANDBOX_003", "SANDBOX_004",
    "SANDBOX_005", "SANDBOX_006",
    "BRIDGE_001", "BRIDGE_002", "BRIDGE_003",
    "SETUP_001",
  ];
  for (const id of chain) {
    await emitSkillEvent(page, id);
  }
  // バッジが 10/59 になっていることを確認
  const panel = page.locator('[data-testid="skill-tree-panel"]');
  await expect(panel).toContainText("10/59 スキル");
  // 現金が増えていることを確認（310,000 + 10,000 + 50,000マイルストーン = 370,000）
  await expect(panel).toContainText(/¥[3-9][0-9,]{4,}/);
});
```

---

### ステップ5: ビルドと全スイート再実行

ソースを変更した場合は必ずビルド:

```bash
cd d:/Documents/marimo/frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/ --headed
```

---

### ステップ6: 知見ドキュメントと SKILL.md の更新

新たな知見があれば追記:
- `development_docs/game-e2e-review-system.md`（知見36以降）
- `D:\Documents\marimo\.claude\skills\game-e2e\SKILL.md`

---

## ✅ 期待される成果物

1. **`D:\Documents\marimo\.claude\plans\my-game-play-report4.md`**
   - 全スイート実行ログ（ベースライン確認）
   - 新規作成したテストの結果

2. **新規テストファイル**
   - `frontend/e2e-tests/game/setup.spec.ts`（SETUP_001〜005）
   - `frontend/e2e-tests/game/data.spec.ts`（DATA_001〜006）※余力があれば

3. **`frontend/e2e-tests/game/constants.ts` の更新**
   - SETUP_SKILL_IDS, DATA_SKILL_IDS, SET_SKILL_IDS, TRADE_SKILL_IDS 追加

4. **スキル獲得確認**
   - 目標: 10スキルマイルストーン突破（「見習い投資家」）
   - 余力があれば 20スキル（「新進トレーダー」）まで

---

## 📚 スキルツリー 前提条件チェーン サマリー

```
SANDBOX_001 → SANDBOX_002 → SANDBOX_003 ─┐
                           → SANDBOX_004 ─┤→ SANDBOX_005 → SANDBOX_006
                                          └─ FAIL_001
                                             FAIL_002（SANDBOX_004 + FAIL_001）

SANDBOX_006 → BRIDGE_001 → BRIDGE_002 → BRIDGE_003
                                            ↓
BRIDGE_003 → SETUP_001 → SETUP_002 ─→ SETUP_003 → SETUP_004
                       └→ DATA_001 ─┘              → SETUP_005
                            ↓
                  DATA_002 → DATA_003
                  DATA_004 → DATA_005
                  DATA_006

SETUP_003 + DATA_001 → SET_001 → SET_002
                SET_001 + DATA_005 → SET_003

SET_001 → TRADE_001 → TRADE_002
                    → TRADE_003 → TRADE_004
                               → TRADE_007 → TRADE_008
                                           → RISK_005 → RISK_006 → RISK_007 → RISK_008
                                                                  → RISK_010
                    → TRADE_006
                    → RISK_001 → RISK_002 → RISK_003 → RISK_004
                    → RISK_009
SET_001 → TRADE_009 → TRADE_010
SET_001 → CHART_001 → CHART_002（+ TRADE_003）
                    → CHART_003（+ IND_001）→ CHART_004

DATA_002 → IND_001 → IND_002 → IND_003 → IND_004
                             → IND_003 + IND_005 → IND_008
                    → IND_005 → IND_006
                    → IND_007
                    → IND_009

TRADE_001 → FAIL_003（資金0で発火）
```

## マイルストーン一覧

| スキル数 | ボーナス | 称号/アイテム |
|---------|---------|-------------|
| 10 | +50,000円 | 「見習い投資家」 |
| 20 | +100,000円 | 「新進トレーダー」 |
| 35 | +200,000円 | 米国株ETF |
| 50 | +400,000円 | 「Backcastエキスパート」 |
| 58 | +600,000円 | 「マスター投資家」 |

## 現在の到達スコア

- **取得済みスキル**: 9/59（SANDBOX_001〜006 + BRIDGE_001〜003）
- **現在のEquity**: ¥310,000
  - SANDBOX_001: +30,000 / SANDBOX_002: +20,000 / SANDBOX_003: +10,000
  - SANDBOX_004: +20,000 / SANDBOX_005: +20,000 / SANDBOX_006: +50,000
  - BRIDGE_001: +15,000 / BRIDGE_002: +20,000 / BRIDGE_003: +25,000

---

## ⚠️ 重要な制約・注意事項

### テスト作成時の必須事項

- `page.waitForLoadState("load")` を使う（`"networkidle"` は永遠に到達しない・知見35a）
- `ensureConnected()` 後に `openSkillTreePanel()` を呼ぶ（順序重要）
- `afterEach` で必ず `resetGameProgress()` を呼ぶ（知見20）
- Reconnected バナーが毎テスト出るのは**正常**（知見21・ensureConnected が自動 dismiss）
- `page.reload()` は使わない（WebSocket 切断が起きる）

### スキル発火メカニズム

- E2Eテストでは `window.__testCompleteSkill(skillId)` = `emitSkillEvent(page, skillId)` でスキルを発火
- フルモードの Python 関数（`bt.buy()` 等）は `game_setup.py` にのみ存在し、SETUP/DATA/TRADE等のフルトラックは Python 関数がない → テストは全て `emitSkillEvent` で完結
- 前提条件チェックは `completeSkillWithRewardAtom` が行う（未完了の前提があれば completed にならない）

### 参照ドキュメント

1. **`development_docs/game-e2e-review-system.md`** — 知見1〜35、テスト設計思想
2. **`frontend/e2e-tests/game/helpers.ts`** — 共通ヘルパー（`emitSkillEvent`・`waitForSkillStatus`・`runNewCellInGrid` 等）
3. **`frontend/e2e-tests/game/constants.ts`** — 定数（`TOTAL_SKILL_COUNT`, `SANDBOX_SKILL_IDS` 等）
4. **`frontend/e2e-tests/game/sandbox.spec.ts`** — テスト構造のリファレンス（10件・全通過確認済み）
5. **`frontend/src/components/skill-tree/skill-data.ts`** — 全59スキルの定義・前提条件
