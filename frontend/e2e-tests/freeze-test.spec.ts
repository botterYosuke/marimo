/* Copyright 2026 Marimo. All rights reserved. */
/**
 * フロントエンドフリーズ耐久テスト
 */

import { test, expect } from "@playwright/test";

const ACCESS_TOKEN = "c6UjDPHPKiEDCGnprMpYlQ";
const BASE_URL = "http://127.0.0.1:2718";
const TEST_DURATION_MS = 5 * 60 * 1000; // 5分
const CHECK_INTERVAL_MS = 10 * 1000;

interface Metrics {
  timestamp: number;
  elapsed: number;
  jsHeapSizeMB: number;
  domNodes: number;
  jsEventListeners: number;
  layoutCount: number;
  isResponsive: boolean;
  responseTimeMs: number;
}

test.describe("Frontend Freeze Investigation", () => {
  test.setTimeout(TEST_DURATION_MS + 60000);

  test("Monitor notebook for freeze over time", async ({ page }) => {
    const metrics: Metrics[] = [];

    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");

    console.log(`[START] Opening ${BASE_URL}?access_token=${ACCESS_TOKEN}`);
    await page.goto(`${BASE_URL}?access_token=${ACCESS_TOKEN}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    console.log("[INFO] Waiting for notebook to load...");
    await page.waitForTimeout(5000);

    let initialMetrics: Metrics | null = null;
    const startTime = Date.now();
    let freezeDetected = false;
    let freezeTime: number | null = null;

    const collectMetrics = async (): Promise<Metrics> => {
      const result = await client.send("Performance.getMetrics");
      const metricsMap: Record<string, number> = {};
      for (const metric of result.metrics) {
        metricsMap[metric.name] = metric.value;
      }

      const responseStart = Date.now();
      let isResponsive = true;
      try {
        await Promise.race([
          page.evaluate(() => document.body.getBoundingClientRect()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 5000)
          ),
        ]);
      } catch {
        isResponsive = false;
      }
      const responseTime = Date.now() - responseStart;

      return {
        timestamp: Date.now(),
        elapsed: Math.round((Date.now() - startTime) / 1000),
        jsHeapSizeMB: Math.round(metricsMap["JSHeapUsedSize"] / 1024 / 1024),
        domNodes: metricsMap["Nodes"] || 0,
        jsEventListeners: metricsMap["JSEventListeners"] || 0,
        layoutCount: metricsMap["LayoutCount"] || 0,
        isResponsive,
        responseTimeMs: responseTime,
      };
    };

    console.log(`[INFO] Starting monitoring for ${TEST_DURATION_MS / 1000} seconds...`);

    while (Date.now() - startTime < TEST_DURATION_MS) {
      const currentMetrics = await collectMetrics();

      if (!initialMetrics) {
        initialMetrics = { ...currentMetrics };
        console.log("[INITIAL]", JSON.stringify(initialMetrics, null, 2));
      }

      metrics.push(currentMetrics);

      console.log(
        `[${currentMetrics.elapsed}s] ` +
          `Heap: ${currentMetrics.jsHeapSizeMB}MB, ` +
          `DOM: ${currentMetrics.domNodes}, ` +
          `Listeners: ${currentMetrics.jsEventListeners}, ` +
          `Response: ${currentMetrics.responseTimeMs}ms`
      );

      if (currentMetrics.jsHeapSizeMB > initialMetrics.jsHeapSizeMB * 2) {
        console.log(`[WARNING] Memory doubled! ${initialMetrics.jsHeapSizeMB}MB -> ${currentMetrics.jsHeapSizeMB}MB`);
      }

      if (currentMetrics.jsEventListeners > initialMetrics.jsEventListeners * 1.5) {
        console.log(`[WARNING] Listeners +50%! ${initialMetrics.jsEventListeners} -> ${currentMetrics.jsEventListeners}`);
      }

      if (!currentMetrics.isResponsive && !freezeDetected) {
        freezeDetected = true;
        freezeTime = Date.now() - startTime;
        console.log(`[FREEZE] *** FREEZE DETECTED at ${freezeTime / 1000}s ***`);
      }

      await page.waitForTimeout(CHECK_INTERVAL_MS);
    }

    console.log("");
    console.log("========== FINAL REPORT ==========");
    console.log(`Test Duration: ${TEST_DURATION_MS / 1000}s`);
    console.log(`Freeze Detected: ${freezeDetected}`);
    if (freezeTime) console.log(`Freeze Time: ${freezeTime / 1000}s`);
    if (initialMetrics && metrics.length > 0) {
      const finalMetrics = metrics[metrics.length - 1];
      console.log(`Initial Heap: ${initialMetrics.jsHeapSizeMB}MB`);
      console.log(`Final Heap: ${finalMetrics.jsHeapSizeMB}MB`);
      console.log(`Heap Growth: ${finalMetrics.jsHeapSizeMB - initialMetrics.jsHeapSizeMB}MB`);
      console.log(`Initial Listeners: ${initialMetrics.jsEventListeners}`);
      console.log(`Final Listeners: ${finalMetrics.jsEventListeners}`);
      console.log(`Listener Growth: ${finalMetrics.jsEventListeners - initialMetrics.jsEventListeners}`);
    }
    console.log("===================================");

    expect(freezeDetected).toBe(false);
  });
});
