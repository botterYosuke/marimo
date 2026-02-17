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
// スキルイベント送信
// ---------------------------------------------------------------------------

/**
 * BroadcastChannel 経由でスキル完了イベントを送信する。
 *
 * BroadcastChannel は「同一オリジンの他のコンテキスト」へ届くため、
 * 別タブを開いて送信し、すぐ閉じる。
 *
 * @param context - Playwright の BrowserContext
 * @param page    - イベントを受信させたいページ
 * @param skillId - 送信するスキル ID（例: "SANDBOX_002"）
 */
export async function emitSkillEvent(
  context: BrowserContext,
  page: Page,
  skillId: string,
): Promise<void> {
  const origin = new URL(page.url()).origin;

  // 同一オリジンの別タブから送信（BroadcastChannel 仕様による）
  const sender = await context.newPage();
  try {
    // commit まで待つ（ネットワーク完了は不要）
    await sender.goto(origin, { waitUntil: "commit" });
    await sender.evaluate(
      ({ channel, id }) => {
        const bc = new BroadcastChannel(channel);
        bc.postMessage({ type: "skill_complete", data: { skill_id: id } });
        bc.close();
      },
      { channel: SKILL_CHANNEL, id: skillId },
    );
    // メッセージが React 側で処理されるのを待つ
    await page.waitForTimeout(300);
  } finally {
    await sender.close();
  }
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
 * パネルが折り畳まれている場合はトリガーをクリックして開く。
 */
export async function openSkillTreePanel(page: Page): Promise<void> {
  // パネルがすでに見えている場合はそのまま返す
  const panel = page.locator('[data-testid="skill-tree-panel"]');
  if (await panel.isVisible().catch(() => false)) {
    return;
  }

  // パネルタブ or トリガーボタンを探す（トロフィーアイコン / "スキルツリー" テキスト）
  const trigger = page
    .getByRole("button")
    .filter({ hasText: /スキルツリー|skill.?tree/i })
    .first();

  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
    return;
  }

  // フォールバック: パネルエリアの Trophy アイコンを探す
  const trophyBtn = page
    .locator(".chrome-panel, [class*='panel']")
    .getByRole("button")
    .first();

  if (await trophyBtn.isVisible().catch(() => false)) {
    await trophyBtn.click();
  }
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
 * ページをリロードしてゲーム進捗を初期状態に戻す。
 * playerProgressAtom は plain atom のためリロードで初期化される。
 */
export async function resetGameProgress(page: Page): Promise<void> {
  await page.reload();
  await page.waitForLoadState("networkidle");
}
