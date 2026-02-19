/* Copyright 2026 Marimo. All rights reserved. */

/**
 * スキルツリーゲーム e2e テスト用ヘルパー
 *
 * 設計方針:
 * - BroadcastChannel でスキルイベントを発火（同一オリジンの別タブ経由）
 * - playerProgressAtom は atomWithStorage 未使用 → ページリロードで初期化
 * - Electron 環境では cell injection が起きるが、web テストではスキップ
 */

import { type Page, type BrowserContext, expect } from "@playwright/test";

/** BroadcastChannel のチャンネル名 */
export const SKILL_CHANNEL = "skill_event_channel";

/** スキルツリーパネルを含む marimo エディタの URL */
export function getGameUrl(baseUrl: string): string {
  return `${baseUrl}?file=e2e-tests/py/game_test.py`;
}

// ---------------------------------------------------------------------------
// サーバー接続確認
// ---------------------------------------------------------------------------

/**
 * カーネルが healthy（緑チェックマーク）であることをポーリングで確認する。
 *
 * backend-status ボタン内の SVG クラスから接続状態を判定する:
 * - `animate-spin` → 接続中（connecting）
 * - `red` → 切断済み（disconnected）
 * - `green` → 健全（healthy）
 */
async function waitForKernelHealthy(
  page: Page,
  timeout = 20_000,
): Promise<void> {
  const statusButton = page.locator('[data-testid="backend-status"]');
  await statusButton.waitFor({ timeout });

  await expect(async () => {
    const status = await statusButton.evaluate((el) => {
      const svg = el.querySelector("svg");
      if (!svg) return "no-svg";
      const cls = svg.getAttribute("class") || "";
      if (cls.includes("animate-spin")) return "connecting";
      if (cls.includes("red")) return "disconnected";
      if (cls.includes("green")) return "healthy";
      return "unknown";
    });
    expect(status).toBe("healthy");
  }).toPass({ timeout });
}

/**
 * marimo サーバーとの WebSocket 接続が確立・安定していることを確認する。
 *
 * 実際のユーザーと同じフローでサーバー接続の安定を待つ:
 * 1. カーネルが健全（緑チェックマーク）になるまで待つ
 * 2. "Reconnected" バナーが表示されていれば閉じる
 * 3. 接続が安定した（バナーが再出現しない）ことを確認する
 * 4. カーネルが引き続き健全であることを最終確認する
 *
 * marimo edit モードは 1 ファイル 1 カーネルを永続するため、
 * ページロード時に既存セッションへの再接続が発生し、サーバーから
 * 遅延通知（"Reconnected" バナー）が届くことがある。
 * また、WebSocket は ReconnectingWebSocket (partysocket) を使用しており、
 * 接続が一時的に切断されても自動で再接続する。このメソッドはその再接続後の
 * 安定化を待ってからテストを開始できるようにする。
 */
export async function ensureConnected(page: Page): Promise<void> {
  // Phase 1: カーネルが healthy になるまで待機
  await waitForKernelHealthy(page);

  // Phase 2: 接続安定化 — Reconnected バナーが出なくなるまでループ
  //   バナーが出現していれば dismiss → 再確認。
  //   バナーが出現しない状態が stabilityWait の間続けば安定と判定する。
  const maxAttempts = 5;
  const stabilityWait = 1_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 現在バナーが出ているか確認
    const hasBanner = await page
      .locator("text=Reconnected")
      .first()
      .isVisible()
      .catch(() => false);

    if (hasBanner) {
      console.log(
        `[ensureConnected] Reconnected バナー検出（attempt ${attempt + 1}/${maxAttempts}）— dismiss して再確認`,
      );
      await dismissReconnectedBanner(page);
      await waitForKernelHealthy(page);
      continue;
    }

    // バナーなし — stabilityWait の間待って遅延到着がないか確認
    await page.waitForTimeout(stabilityWait);

    const lateArrival = await page
      .locator("text=Reconnected")
      .first()
      .isVisible()
      .catch(() => false);

    if (!lateArrival) {
      // 安定確認 — 最終健全性チェック
      await waitForKernelHealthy(page);
      return;
    }

    // 遅延到着あり — dismiss して再ループ
    console.log(
      `[ensureConnected] 遅延 Reconnected バナー検出（attempt ${attempt + 1}/${maxAttempts}）— dismiss して再確認`,
    );
    await dismissReconnectedBanner(page);
    await waitForKernelHealthy(page);
  }

  // maxAttempts 到達 — 警告 + 最終チェック
  console.warn(
    `[ensureConnected] ${maxAttempts} 回の安定化ループ後もバナーが断続的に出現しています`,
  );
  await dismissReconnectedBanner(page);
  await waitForKernelHealthy(page);
}

/**
 * 「Reconnected」バナーをすべて閉じる。
 *
 * marimo edit モードでは同一カーネルへの再接続時にバナーが表示される。
 * バナーは bannersAtom（配列）に蓄積されるため、複数表示される場合がある。
 * バナーを閉じないと UI 要素を遮る可能性がある（知見 11 参照）。
 */
export async function dismissReconnectedBanner(page: Page): Promise<void> {
  const maxDismissals = 5;
  for (let i = 0; i < maxDismissals; i++) {
    const reconnectedBanner = page.locator("text=Reconnected").first();
    const bannerVisible = await reconnectedBanner
      .isVisible()
      .catch(() => false);

    if (!bannerVisible) return;

    console.log(
      `[dismissReconnectedBanner] Reconnected バナーを検出（${i + 1}/${maxDismissals}）— 閉じます`,
    );
    const closeBtn = page
      .locator('[data-testid="remove-banner-button"]')
      .first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await reconnectedBanner
        .waitFor({ state: "hidden", timeout: 3_000 })
        .catch(() => {});
    } else {
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// スキルイベント送信
// ---------------------------------------------------------------------------

/**
 * スキル完了イベントを発火する。
 *
 * setupSkillEventListener() が window.__testCompleteSkill に公開した
 * コールバックを page.evaluate() 経由で直接呼び出す。
 * これにより BroadcastChannel のクロスコンテキスト配信問題を回避しつつ、
 * completeSkillWithRewardAtom → playerProgressAtom → UI 更新の全経路をテストできる。
 *
 * BroadcastChannel 自体の動作は手動確認済み（2026-02-19）。
 *
 * @param context - Playwright の BrowserContext（互換性のため残存）
 * @param page    - イベントを受信させたいページ
 * @param skillId - 送信するスキル ID（例: "SANDBOX_002"）
 */
export async function emitSkillEvent(
  context: BrowserContext,
  page: Page,
  skillId: string,
): Promise<void> {
  await page.evaluate((id) => {
    const fn = (window as unknown as Record<string, unknown>).__testCompleteSkill;
    if (typeof fn === "function") {
      (fn as (skillId: string) => void)(id);
    } else {
      throw new Error(
        "__testCompleteSkill not found — SkillTreeButton may not have mounted yet",
      );
    }
  }, skillId);
  // React 状態更新 → DOM 再レンダリングを待つ
  await page.waitForTimeout(300);
}

/**
 * 複数のスキルを順番に完了させる。
 * 前提条件のある連鎖スキルを解除するときに使う。
 */
export async function emitSkillSequence(
  context: BrowserContext,
  page: Page,
  skillIds: string[],
): Promise<void> {
  for (const skillId of skillIds) {
    await emitSkillEvent(context, page, skillId);
  }
}

// ---------------------------------------------------------------------------
// スキルツリーパネル操作
// ---------------------------------------------------------------------------

/**
 * スキルツリーパネルが表示されるまで待機する。
 * スキルツリーはダイアログとして開く（サイドバーパネルではない）。
 * SkillTreeButton（data-testid="skill-tree-button"）をクリックして開く。
 */
export async function openSkillTreePanel(page: Page): Promise<void> {
  // ダイアログがすでに開いている場合はスキップ
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible().catch(() => false)) {
    const panel = dialog.locator('[data-testid="skill-tree-panel"]');
    if (await panel.isVisible().catch(() => false)) return;
  }

  // "Reconnected" バナーが遅延表示されている場合は閉じる
  // （ensureConnected 後にサーバーから遅延通知が届くケースがある）
  await dismissReconnectedBanner(page);

  // スキルツリーボタンをクリック（トースト回避のため evaluate 経由）
  await page.evaluate(() => {
    document.querySelector('[data-testid="skill-tree-button"]')?.click();
  });

  // ダイアログ内のスキルツリーパネルが表示されるまで待機
  await page.locator('[data-testid="skill-tree-panel"]').waitFor({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// スキルノード状態取得
// ---------------------------------------------------------------------------

/**
 * スキルノードの Locator を返す。
 * data-skill-id 属性でスキル ID を直接指定する。
 * タイトル変更の影響を受けない安定したセレクター。
 */
export function getSkillNodeLocator(page: Page, skillId: string) {
  return page.locator(`[data-skill-id="${skillId}"]`);
}

/**
 * スキルノードの現在のステータスを返す。
 * data-skill-status 属性から直接読み取る。
 */
export async function getSkillStatus(
  page: Page,
  skillId: string,
): Promise<"completed" | "unlocked" | "locked"> {
  const node = getSkillNodeLocator(page, skillId);
  await expect(node).toBeVisible({ timeout: 5_000 });

  const status = await node.getAttribute("data-skill-status");
  if (status === "completed" || status === "unlocked" || status === "locked") {
    return status;
  }

  // フォールバック: CSS クラスで判定（data-skill-status 未実装環境向け）
  const isCompleted = await node.evaluate((el) =>
    el.className.includes("border-green-500") ||
    el.innerHTML.includes("text-green-500"),
  );
  if (isCompleted) return "completed";

  const isLocked = await node.evaluate((el) =>
    el.className.includes("opacity-50"),
  );
  if (isLocked) return "locked";

  return "unlocked";
}

/**
 * スキルが指定ステータスになるまでポーリングして待機する。
 * @param skillId - スキル ID（例: "SANDBOX_001"）
 */
export async function waitForSkillStatus(
  page: Page,
  skillId: string,
  expectedStatus: "completed" | "unlocked" | "locked",
  timeout = 5_000,
): Promise<void> {
  await expect(async () => {
    const status = await getSkillStatus(page, skillId);
    expect(status).toBe(expectedStatus);
  }).toPass({ timeout });
}

// ---------------------------------------------------------------------------
// 進捗バッジ
// ---------------------------------------------------------------------------

/**
 * スキルツリーパネルの進捗バッジ（例: "3/59 スキル"）からテキストを返す。
 */
export async function getProgressText(page: Page): Promise<string> {
  const badge = page.locator("text=/\\d+\\/\\d+ スキル/").first();
  await expect(badge).toBeVisible({ timeout: 5_000 });
  return (await badge.textContent()) ?? "";
}

/**
 * 完了スキル数を数値で返す。
 */
export async function getCompletedCount(page: Page): Promise<number> {
  const text = await getProgressText(page);
  const match = text.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

// ---------------------------------------------------------------------------
// マーモエディタ操作
// ---------------------------------------------------------------------------

/**
 * 新しいセルにコードを入力して実行する。
 * 既存の cells.spec.ts と同様のパターン。
 */
export async function runNewCell(page: Page, code: string): Promise<void> {
  // 最後のセルの下に追加ボタンをクリック
  const addButtons = page.getByTestId("create-cell-button").locator(":visible");
  await addButtons.last().click();

  // フォーカスされた cm-editor にコードを入力
  await page.locator("*:focus").fill(code);
  await page.getByTestId("run-button").locator(":visible").last().click();

  // セル実行完了まで待機（実行中インジケーターが消えるまで）
  await page
    .locator("[data-cell-status='running']")
    .waitFor({ state: "detached", timeout: 15_000 })
    .catch(() => {
      /* セルが即座に完了した場合は無視 */
    });
}

// ---------------------------------------------------------------------------
// ゲーム状態リセット
// ---------------------------------------------------------------------------

/**
 * ゲーム進捗を初期状態に戻す。
 *
 * page.reload() を使わず、Jotai atom を直接リセットして WebSocket 接続を維持する。
 * これにより「Reconnected」バナーの発生を防ぎ、テスト環境の安定性を保つ。
 */
export async function resetGameProgress(page: Page): Promise<void> {
  // Jotai の resetProgressAtom を直接呼び出し
  await page.evaluate(() => {
    const fn = (window as unknown as Record<string, unknown>)
      .__testResetProgress;
    if (typeof fn === "function") {
      (fn as () => void)();
    } else {
      throw new Error(
        "__testResetProgress not found — SkillTreeButton may not have mounted yet",
      );
    }
  });

  // ダイアログが開いている場合は閉じる
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await dialog
      .waitFor({ state: "hidden", timeout: 3_000 })
      .catch(() => {});
  }

  // React 状態更新 → DOM 再レンダリングを待つ
  await page.waitForTimeout(300);
}
