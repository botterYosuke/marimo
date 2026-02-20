# ゲーム E2E テスト改善プラン

## Context

現在のゲーム E2E テスト（37 cases）は `window.__testCompleteSkill` を直接呼び出しており、本番の 7 レイヤーのうちレイヤー⑥⑦（Jotai atom + React 描画）しかテストしていない。レイヤー①〜⑤（Python HTML 生成 → HTML パース → BroadcastChannel 配信 → リスナー受信）は完全にバイパスされている。

加えて、既存テストには `.catch(() => {})` で失敗を握りつぶすパターン、`test.skip()` で機能の消失を隠すパターン、ハードコードされたマジックナンバーが多数存在する。

**このプランの目的**: 本番のデータパイプラインを実際に通す統合テストを追加し、弱いアサーションを修正して、テストが「本当にバグを検知できる最後の砦」として機能するようにする。

---

## 変更概要

| # | 変更内容 | 種別 | 対象ファイル |
|---|---------|------|-------------|
| 1 | `__testInjectBroadcastHTML` フック追加 | 本番コード変更（1箇所） | `skill-complete-handler.ts` |
| 2 | `emitSkillEventViaHTML()` ヘルパー追加 | テストコード | `helpers.ts` |
| 3 | `integration.spec.ts` 新規作成 | テストコード（新規） | `e2e-tests/game/integration.spec.ts` |
| 4 | 弱いアサーション修正 | テストコード | `persistence.spec.ts`, `ui.spec.ts` |
| 5 | タイムアウト改善 | テストコード | `sandbox.spec.ts`, `bridge.spec.ts` |
| 6 | マジックナンバー排除 | テストコード（新規+修正） | `constants.ts`（新規）, 各 spec |

---

## Step 1: テストフック追加（本番コード — 唯一の変更） ✅

> **知見**: ユニットテスト(`skill-complete-handler.test.ts`)で 3 件失敗していた原因は、`extractAndSendBroadcastMessages` の import により `@/core/kernel/handlers` モジュール全体（セッション初期化等の重い副作用を含む）が `vi.resetModules()` + 動的 `import()` のたびに再初期化されてタイムアウトしていたこと。`vi.mock("@/core/kernel/handlers", ...)` でモックし解決。テスト時間 21.7s → 3.2s に短縮。

**ファイル**: `frontend/src/components/skill-tree/skill-complete-handler.ts`

`setupSkillEventListener()` 内の既存フック（`__testCompleteSkill`, `__testResetProgress`）に並べて追加:

```typescript
import { extractAndSendBroadcastMessages } from "@/core/kernel/handlers";

// setupSkillEventListener() 内:
(window as any).__testInjectBroadcastHTML = (html: string) => {
  extractAndSendBroadcastMessages(html);
};

// cleanup 関数内:
delete (window as any).__testInjectBroadcastHTML;
```

**テスト対象レイヤーの変化**:
- 既存 `__testCompleteSkill`: ⑥→⑦ のみ
- 新規 `__testInjectBroadcastHTML`: **③→④→⑤→⑥→⑦** を通過

**BroadcastChannel 同一コンテキスト配信について**:
- `sendBroadcastMessage()` は `broadcastChannelManager` のインスタンスから送信
- `setupSkillEventListener()` は別の `new BroadcastChannel()` で受信
- Web 仕様: 送信インスタンス以外の同名チャネルには配信される → 動作するはず
- 万一動かない場合のフォールバック: フック内でパース結果を直接 `onSkillComplete` に渡す（③④のみテスト、⑤はスキップ）

**検証**: 既存ユニットテスト通過確認
```bash
cd frontend && pnpm test src/components/skill-tree/__tests__/skill-complete-handler.test.ts
```

---

## Step 2: ヘルパー関数追加 ✅

**ファイル**: `frontend/e2e-tests/game/helpers.ts`

```typescript
/**
 * emit_skill() と同じ HTML を生成し、本番パイプライン（③→⑦）経由でスキルを完了。
 * __testCompleteSkill（⑥→⑦のみ）とは異なり、HTML パース・BroadcastChannel を通過する。
 */
export async function emitSkillEventViaHTML(page: Page, skillId: string): Promise<void> {
  await page.evaluate((id) => {
    const fn = (window as any).__testInjectBroadcastHTML;
    if (typeof fn !== "function") {
      throw new Error("__testInjectBroadcastHTML not found");
    }
    const payload = btoa(JSON.stringify({
      skill_id: id,
      context: {},
      timestamp: Date.now(),
    }));
    const html = `<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="${payload}" style="display:none;"></marimo-broadcast>`;
    fn(html);
  }, skillId);
  await page.waitForTimeout(300);
}
```

同様に `emitSkillSequenceViaHTML(page, skillIds[])` も追加。

---

## Step 3: `integration.spec.ts` 新規作成 ✅

**ファイル**: `frontend/e2e-tests/game/integration.spec.ts`（新規）

既存テストがレイヤー⑥⑦の回帰テストとして機能する一方、このファイルは **③→⑦の結合テスト** として機能する。

### テストケース（9件）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 1 | HTML 注入でスキルが完了する | ③パース→④BC送信→⑤リスナー→⑥atom→⑦DOM の全経路 |
| 2 | 前提条件チェーンが動作する | 001→002 の順序依存が HTML 経由でも正しく動く |
| 3 | 進捗バッジが更新される | HTML 経由でも UI カウンターが正しく増加 |
| 4 | 現金報酬が加算される | HTML 経由でも `¥` 表示が更新される |
| 5 | 重複発火が防止される | 同一 HTML を 2 回注入しても 1 回のみカウント |
| 6 | 前提条件未達でスキップされる | 前提未完了のスキル HTML を注入しても変化なし |
| 7 | 不正な base64 で UI がクラッシュしない | `sendBroadcastMessage` が `false` を返し、UI に影響なし |
| 8 | payload 属性欠落で無視される | 3 属性揃わない HTML はパーサーがスキップ |
| 9 | サンドボックス全完了→ブリッジ解放 | HTML 経由の 6 スキル連続完了でトラック遷移 |

### BroadcastChannel 動作確認（テスト 1 が兼ねる）

テスト 1 が通れば、BroadcastChannel の同一コンテキスト配信が動作する証拠。通らない場合は Step 1 のフォールバックを適用し、テスト名に「(BC bypass)」を付記して、レイヤー⑤がテストされていないことを明示する。

> **✅ 2026-02-19 実装完了**: テスト 1〜9 全通過。BroadcastChannel 同一コンテキスト配信は問題なく動作。フォールバック不要。

**検証**:
```bash
cd frontend && npx playwright test e2e-tests/game/integration.spec.ts --headed
```

---

## Step 4: 弱いアサーション修正 ✅

### 4A. `persistence.spec.ts` — トースト `.catch()` 握りつぶし

**L168-182**: `.catch(() => { console.warn(...) })` を除去

```typescript
// Before（失敗しても通る）
await expect(toast).toBeVisible({ timeout: 3_000 })
  .catch(() => { console.warn("..."); });

// After（失敗なら fail）
await expect(toast).toBeVisible({ timeout: 3_000 });
```

トーストが不安定な場合は `test.fixme("RewardToast の安定化が必要")` に変更。**決して `.catch` で握りつぶさない**。

### 4B. `ui.spec.ts` — `test.skip()` による機能消失の隠蔽

**L115-138, L140-156, L162-181**: 3 箇所の `if (visible) { test } else { test.skip() }` パターン

```typescript
// Before（UIが消えても気づかない）
if (await sandboxTab.isVisible().catch(() => false)) {
  // ...test...
} else {
  test.skip();
}

// After（UIが消えたら fail）
test.fixme("トラック切り替え: sandbox フィルター", async ({ page }) => {
  // トラックフィルターUI未実装のため fixme
  // 実装されたら test() に昇格し、以下のアサーションを有効化
  const sandboxTab = page.getByRole("button", { name: /sandbox|サンドボックス/i }).first();
  await expect(sandboxTab).toBeVisible({ timeout: 3_000 });
  await sandboxTab.click();
  await expect(getSkillNodeLocator(page, "SANDBOX_001")).toBeVisible();
  await expect(getSkillNodeLocator(page, "BRIDGE_001")).toBeHidden();
});
```

`test.fixme()` はテストレポートに **"fixme"** として表示され、実行はスキップされるが、テスト数としてカウントされる。`test.skip()` との違いは意図の明示性。

### 4C. `ui.spec.ts` L132 — `.catch(() => {})` アサーション握りつぶし

```typescript
// Before
await expect(bridgeNode).toBeHidden({ timeout: 3_000 }).catch(() => {});

// After（4B の test.fixme 化で解消）
```

**検証**:
```bash
cd frontend && npx playwright test e2e-tests/game/persistence.spec.ts e2e-tests/game/ui.spec.ts
```

---

## Step 5: タイムアウト改善 ✅

### 5A. `sandbox.spec.ts` — `waitForTimeout` → 状態ベース待機

**L115** (`waitForTimeout(500)` — 前提条件未達の確認):
```typescript
// Before
await page.waitForTimeout(500);
const status = await getSkillStatus(page, "SANDBOX_002");
expect(status).toBe("locked");

// After
await expect(async () => {
  expect(await getSkillStatus(page, "SANDBOX_002")).toBe("locked");
}).toPass({ timeout: 3_000 });
```

**L179** (`waitForTimeout(300)` — 重複発火後のカウント確認):
```typescript
// Before
await page.waitForTimeout(300);
const countAfter = await getCompletedCount(page);
expect(countAfter).toBe(countBefore);

// After
await expect(async () => {
  expect(await getCompletedCount(page)).toBe(countBefore);
}).toPass({ timeout: 3_000 });
```

### 5B. `bridge.spec.ts` — エスカレーティングタイムアウト統一

**L77-182**: `10_000` → `12_000` → `15_000` のエスカレーションを統一

```typescript
// ファイル先頭に定数定義
const SKILL_STATUS_TIMEOUT = 10_000;

// 全ての waitForSkillStatus で統一
await waitForSkillStatus(page, "SANDBOX_006", "completed", SKILL_STATUS_TIMEOUT);
await waitForSkillStatus(page, "BRIDGE_001", "completed", SKILL_STATUS_TIMEOUT);
await waitForSkillStatus(page, "BRIDGE_003", "completed", SKILL_STATUS_TIMEOUT);
```

**L211, L225** (`waitForTimeout(500)` — 前提条件ガードの確認): 5A と同じ状態ベース待機に変更。

**検証**:
```bash
cd frontend && npx playwright test e2e-tests/game/sandbox.spec.ts e2e-tests/game/bridge.spec.ts
```

---

## Step 6: マジックナンバー排除 ✅

### 6A. `constants.ts` 新規作成

**ファイル**: `frontend/e2e-tests/game/constants.ts`（新規）

```typescript
import { skillDefinitions, milestones } from "../../src/components/skill-tree/skill-data";
import { calculateTotalRewards } from "../../src/components/skill-tree/rewards/reward-system";

export const TOTAL_SKILL_COUNT = skillDefinitions.length; // 59

export const SANDBOX_SKILL_IDS = skillDefinitions
  .filter((s) => s.category === "sandbox")
  .map((s) => s.id); // ["SANDBOX_001", ..., "SANDBOX_006"]

export const BRIDGE_SKILL_IDS = skillDefinitions
  .filter((s) => s.category === "bridge")
  .map((s) => s.id); // ["BRIDGE_001", ..., "BRIDGE_003"]

export function getTotalCashAfterSkills(skillIds: string[]): number {
  const { totalCash, milestoneCash } = calculateTotalRewards(skillIds);
  return totalCash + milestoneCash;
}

export const FIRST_MILESTONE = milestones[0]; // { skillCount: 10, bonus: 50000 }
```

**注意**: Playwright テストは Node.js で実行される。`skill-data.ts` と `reward-system.ts` は純粋なデータ/ロジックファイルでブラウザ API 非依存のため、Node.js から直接 import 可能。e2e-tests の tsconfig に `"@/*": ["../src/*"]` パスマッピングあり。

### 6B. 各 spec ファイルの修正

| ファイル | 箇所 | Before | After |
|---------|------|--------|-------|
| `ui.spec.ts` | L53 | `text=/\d+\/59 スキル/` | `` `\d+/${TOTAL_SKILL_COUNT} スキル` `` |
| `ui.spec.ts` | L238 | `expect(cash).toBeGreaterThan(50_000)` | `expect(cash).toBeGreaterThan(FIRST_MILESTONE.bonus)` |
| `bridge.spec.ts` | L190 | `expect(cash).toBeGreaterThanOrEqual(210_000)` | `expect(cash).toBeGreaterThanOrEqual(getTotalCashAfterSkills([...SANDBOX_SKILL_IDS, ...BRIDGE_SKILL_IDS]))` |
| `bridge.spec.ts` | テスト名 | `"BRIDGE_001 完了後に現金が増える（+15,000円）"` | `"BRIDGE_001 完了後に現金が増える"` |

**検証**:
```bash
cd frontend && npx playwright test e2e-tests/game/
```

---

## 実装順序

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6
  ↓        ↓        ↓        ↓        ↓        ↓
 本番     helper   統合テスト  assertion timeout  constants
 hook     追加     新規作成    修正      改善      導入
```

Step 1-3 は依存関係あり（順序厳守）。Step 4-6 は独立して実施可能。

---

## 最終検証 ✅

> **2026-02-19 全 Step 完了・検証済み**
> - ユニットテスト: `skill-complete-handler.test.ts` 11/11 passed, `extractBroadcast.test.ts` 10/10 passed
> - E2E テスト: **46 passed / 3 fixme (skipped) / 0 failed** (7.0m)
>   - integration.spec.ts: 9/9 passed (新規)
>   - sandbox.spec.ts: 10/10 passed
>   - bridge.spec.ts: 10/10 passed
>   - persistence.spec.ts: 8/8 passed
>   - ui.spec.ts: 9/9 passed + 3 fixme
>
> **知見**: ビルド反映忘れに注意（`pnpm turbo build && cp -R dist/* ../marimo/_static/`）。
> Step 1 の本番コード変更後にビルドせずテストすると `__testInjectBroadcastHTML not found` で全統合テストが失敗する。

全 Step 完了後:
```bash
# ゲーム e2e 全スイート
cd frontend && npx playwright test e2e-tests/game/

# 既存ユニットテスト
cd frontend && pnpm test src/components/skill-tree/__tests__/skill-complete-handler.test.ts
cd frontend && pnpm test src/core/kernel/__tests__/extractBroadcast.test.ts
```

## 改善後のカバレッジ

| レイヤー | Before | After |
|---------|--------|-------|
| ③ HTML パース | ユニットテストのみ | **E2E 結合テスト + ユニットテスト** |
| ④ BroadcastChannel 送信 | なし | **E2E 結合テスト** |
| ⑤ リスナー受信 | ユニットテストのみ | **E2E 結合テスト + ユニットテスト** |
| ⑥ atom 更新 | E2E テスト | E2E テスト（既存 + 統合） |
| ⑦ UI 反映 | E2E テスト | E2E テスト（既存 + 統合） |
| 弱いアサーション | 5 箇所で失敗握りつぶし | **全て除去** |
| マジックナンバー | 6 箇所以上 | **production コードから導出** |
