# Phase 9: 統合テストとドキュメント

**想定日数**: 5-7日
**優先度**: P0
**依存**: 全フェーズ完了後

---

## 1. ゴール

- E2Eテストの作成
- パフォーマンス最適化
- ユーザードキュメント
- バグ修正とポリッシュ

---

## 2. E2Eテストシナリオ

### 2.1 サンドボックスフロー

```typescript
// tests/e2e/sandbox-flow.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Sandbox Flow", () => {
  test("should complete sandbox from start to finish", async ({ page }) => {
    // 1. サンドボックス起動
    await page.goto("/sandbox");

    // 2. SANDBOX_001: ゲーム起動確認
    await expect(
      page.locator("[data-skill='SANDBOX_001']")
    ).toHaveAttribute("data-status", "completed");

    // 3. チャートが表示されている
    await expect(page.locator(".chart-container")).toBeVisible();

    // 4. bt.buy()を実行
    await page.evaluate(() => bt.buy());

    // 5. SANDBOX_002: 購入完了
    await expect(
      page.locator("[data-skill='SANDBOX_002']")
    ).toHaveAttribute("data-status", "completed");

    // 6. 保有株を確認
    await page.evaluate(() => {
      for (const trade of bt.trades) {
        console.log(trade.entry_price);
      }
    });

    // 7. SANDBOX_003: 買値確認
    await expect(
      page.locator("[data-skill='SANDBOX_003']")
    ).toHaveAttribute("data-status", "completed");

    // 8. 時間を進めて売却
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) bt.step();
      for (const trade of bt.trades) trade.close();
    });

    // 9. SANDBOX_004: 売却完了
    await expect(
      page.locator("[data-skill='SANDBOX_004']")
    ).toHaveAttribute("data-status", "completed");

    // 10. チャートで確認
    await page.evaluate(() => bt.chart());

    // 11. SANDBOX_005: チャート確認
    await expect(
      page.locator("[data-skill='SANDBOX_005']")
    ).toHaveAttribute("data-status", "completed");

    // 12. 卒業ボタンをクリック
    await page.click("[data-testid='sandbox-graduate']");

    // 13. SANDBOX_006: 卒業
    await expect(
      page.locator("[data-skill='SANDBOX_006']")
    ).toHaveAttribute("data-status", "completed");

    // 14. ブリッジモードがアンロック
    await expect(page.locator(".bridge-indicator")).toBeVisible();
  });
});
```

### 2.2 ブリッジ→フルモード遷移

```typescript
test("should transition from bridge to full mode", async ({ page }) => {
  // 事前条件: サンドボックス完了状態から開始
  await page.goto("/bridge");

  // BRIDGE_001: データソース確認
  await page.evaluate(() => bt.reveal_setup_code());
  await expect(
    page.locator("[data-skill='BRIDGE_001']")
  ).toHaveAttribute("data-status", "completed");

  // BRIDGE_002: get_stock_daily実行
  await page.evaluate(() => get_stock_daily("6758"));
  await expect(
    page.locator("[data-skill='BRIDGE_002']")
  ).toHaveAttribute("data-status", "completed");

  // BRIDGE_003: フルセットアップ
  await page.goto("/notebook/new");
  await page.evaluate(() => {
    const bt = new Backtest({ cash: 1_000_000 });
    const df = get_stock_daily("7203");
    bt.set_data({ "7203": df });
    bt.start();
    bt.buy();
  });

  await expect(
    page.locator("[data-skill='BRIDGE_003']")
  ).toHaveAttribute("data-status", "completed");

  // フルモードがアンロック
  await expect(page.locator("[data-track='full']")).toBeVisible();
});
```

### 2.3 報酬システム

```typescript
test("should display reward notifications", async ({ page }) => {
  await page.goto("/sandbox");

  // 初期報酬を確認
  await expect(page.locator(".reward-notification")).toBeVisible();
  await expect(page.locator(".reward-notification")).toContainText("30,000円");

  // 報酬が消えるまで待機
  await expect(page.locator(".reward-notification")).not.toBeVisible({
    timeout: 5000,
  });
});

test("should trigger milestone at 10 skills", async ({ page }) => {
  // 10スキル完了状態をシミュレート
  await page.evaluate(() => {
    // スキル10個を完了
    for (let i = 0; i < 10; i++) {
      completeSkill(`SKILL_${i}`);
    }
  });

  // マイルストーン通知
  await expect(page.locator(".milestone-notification")).toBeVisible();
  await expect(page.locator(".milestone-notification")).toContainText(
    "50,000円"
  );
});
```

### 2.4 状態永続化

```typescript
test("should persist progress across page reload", async ({ page }) => {
  await page.goto("/sandbox");

  // スキルを完了
  await page.evaluate(() => bt.buy());

  // 完了を確認
  await expect(
    page.locator("[data-skill='SANDBOX_002']")
  ).toHaveAttribute("data-status", "completed");

  // ページリロード
  await page.reload();

  // 状態が保持されている
  await expect(
    page.locator("[data-skill='SANDBOX_002']")
  ).toHaveAttribute("data-status", "completed");
});
```

---

## 3. パフォーマンス最適化

### 3.1 メモ化

```typescript
// 重い計算のメモ化
const skillsWithStatus = useMemo(() => {
  return definitions.map((skill) => {
    const status = calculateStatus(skill, progress);
    return { ...skill, status };
  });
}, [definitions, progress.completedSkills]);

// ノードのメモ化
export const SkillNode = memo((props: SkillNodeProps) => {
  // ...
});
```

### 3.2 遅延読み込み

```typescript
// スキルツリーパネルの遅延読み込み
const SkillTreePanel = lazy(() => import("./skill-tree-panel"));

// Suspenseでラップ
<Suspense fallback={<LoadingSpinner />}>
  <SkillTreePanel />
</Suspense>
```

### 3.3 BroadcastChannel最適化

```python
# デバウンス付きイベント発信
class SkillEventPublisher:
    def __init__(self):
        self._pending_events = []
        self._debounce_timer = None

    def emit_skill(self, skill_id, context=None):
        self._pending_events.append((skill_id, context))
        self._schedule_flush()

    def _schedule_flush(self):
        if self._debounce_timer:
            return
        self._debounce_timer = Timer(0.1, self._flush)
        self._debounce_timer.start()

    def _flush(self):
        events = self._pending_events
        self._pending_events = []
        self._debounce_timer = None

        for skill_id, context in events:
            self._emit_now(skill_id, context)
```

---

## 4. ドキュメント

### 4.1 ユーザーガイド

**ファイル**: `D:\Documents\BackcastPro\docs\skill-tree-guide.md`

```markdown
# Backcast スキルツリーガイド

## はじめに

Backcastでは、スキルツリーシステムを通じてトレーディングを学びます。
58のスキルを達成しながら、バックテストの技術を習得していきましょう。

## 3つのモード

### 1. サンドボックスモード

最初に始めるモードです。すぐに株を買って売る体験ができます。

- `bt.buy()` - 株を買う
- `bt.step()` - 時間を進める
- `trade.close()` - 株を売る

### 2. ブリッジモード

サンドボックスの「裏側」を学びます。

### 3. フルモード

本格的なバックテストを行います。

## スキルカテゴリ

| カテゴリ | スキル数 | 報酬合計 |
|---------|---------|---------|
| サンドボックス | 6 | 150,000円 |
| ブリッジ | 3 | 60,000円 |
| ... | ... | ... |

## マイルストーン

10, 20, 35, 50, 58スキルでボーナス報酬！

## ランクシステム

ブロンズ → シルバー → ゴールド → プラチナ → マスター
```

### 4.2 API リファレンス

**ファイル**: `D:\Documents\BackcastPro\docs\skill-api.md`

```markdown
# スキルシステム API リファレンス

## Python API

### SkillEventPublisher

```python
from BackcastPro.api import SkillEventPublisher

publisher = SkillEventPublisher()
publisher.emit_skill("SANDBOX_001", {"message": "Welcome!"})
```

### スキル追跡の有効化

```python
bt = Backtest(cash=100_000)
publisher = bt.enable_skill_tracking()
```

## フロントエンド API

### Atoms

- `playerProgressAtom` - プレイヤー進捗
- `skillsWithStatusAtom` - ステータス付きスキル
- `completeSkillAtom` - スキル完了アクション

### コンポーネント

- `<SkillTree />` - スキルツリー表示
- `<SkillDetailPanel />` - スキル詳細
- `<RewardNotification />` - 報酬通知
```

---

## 5. バグ修正チェックリスト

| 項目 | 確認内容 |
|------|---------|
| ダブルトリガー防止 | 同じスキルが2回トリガーされない |
| 状態整合性 | completedSkillsとUIの同期 |
| エッジケース | 空データ、ゼロ取引での動作 |
| リロード対応 | 状態がLocalStorageに保存される |
| エラーハンドリング | トリガー評価エラーでクラッシュしない |
| メモリリーク | BroadcastChannelのクリーンアップ |

---

## 6. タスク一覧

| # | タスク | ファイル | 詳細 | ステータス |
|---|-------|---------|------|----------|
| 9.1 | E2Eテスト作成 | `e2e-tests/skill-tree-flow.spec.ts` | UIテスト、永続化テスト | ✅ 完了 |
| 9.2 | ユニットテスト追加 | `__tests__/*.test.ts` | 345テスト全パス | ✅ 完了 |
| 9.3 | パフォーマンス最適化 | `skill-tree-panel.tsx` | memo, useCallback適用 | ✅ 完了 |
| 9.4 | ユーザーガイド | `docs/skill-tree-guide.md` | 使い方説明 | ✅ 完了 |
| 9.5 | APIリファレンス | `docs/skill-api.md` | API仕様 | ✅ 完了 |
| 9.6 | バグ修正 | 各ファイル | チェックリスト対応 | ✅ 完了 |
| 9.7 | 最終レビュー | - | コードレビュー | 保留 |

### 実装詳細（2026-02-04）

**9.1 E2Eテスト**
- ファイル: `D:\Documents\marimo\frontend\e2e-tests\skill-tree-flow.spec.ts`
- テスト内容:
  - スキルツリーボタン表示
  - ダイアログ開閉
  - スキルノード表示
  - LocalStorage永続化

**9.2 ユニットテスト追加**
- `atoms.test.ts` にエッジケーステスト追加（63テスト）
- `skill-complete-handler.test.ts` にエラーハンドリングテスト追加（29テスト）
- 全345テストがパス

**9.3 パフォーマンス最適化**
- `skill-tree-panel.tsx`: `memo()` でコンポーネントをメモ化
- `handleSkillClick`: `useCallback` で関数をメモ化
- `filteredSkills`: 既存の `useMemo` を維持

**9.4-9.5 ドキュメント**
- ユーザーガイド: `D:\Documents\BackcastPro\docs\skill-tree-guide.md`
- APIリファレンス: `D:\Documents\BackcastPro\docs\skill-api.md`

---

## 7. 完了条件

- [x] E2Eテストが作成済み
- [x] ユニットテスト345件全パス
- [x] パフォーマンス最適化完了（memo, useCallback）
- [x] ドキュメント完成
- [x] 主要バグ修正完了
- [ ] コードレビュー承認（保留）

---

## 8. リリースチェックリスト

```
□ 全テストがパス
□ ビルドが成功
□ ドキュメントが最新
□ CHANGELOGに記載
□ バージョン番号更新
□ リリースノート作成
```

---

## 9. 今後の拡張

### 9.1 Phase 10以降（将来）

- バックエンドリーダーボード
- ユーザー認証
- 戦略テンプレート共有
- コミュニティ機能
- 週次チャレンジ

### 9.2 技術的改善

- WebSocket通信（BroadcastChannel代替）
- サーバーサイドレンダリング対応
- モバイル対応
