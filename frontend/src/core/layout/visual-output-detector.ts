/* Copyright 2026 Marimo. All rights reserved. */

import type { OutputMessage } from "@/core/kernel/messages";

/**
 * MIME types that are considered "visual" outputs
 * These should be auto-placed in grid layout
 */
export const VISUAL_MIMETYPES = new Set([
  // Images
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/gif",
  "image/tiff",
  "image/avif",
  "image/bmp",
  // Videos
  "video/mp4",
  "video/mpeg",
  // Charts (Vega-based)
  "application/vnd.vegalite.v5+json",
  "application/vnd.vega.v5+json",
  "application/vnd.vegalite.v6+json",
  "application/vnd.vega.v6+json",
]);

/**
 * Signatures in HTML content that indicate a visual/chart output
 */
const HTML_VISUAL_SIGNATURES = [
  "plotly-graph-div", // Plotly
  "bokeh", // Bokeh
  "altair-viz", // Altair fallback
  "<svg", // SVG embedded in HTML
  "<canvas", // Canvas-based charts
  "data:image/", // Inline images
  "echarts", // ECharts
  "lightweight-charts", // Lightweight Charts (TradingView)
  "marimo-anywidget", // AnyWidget-based visualizations
];

/**
 * Check if a MIME type is considered visual
 */
export function isVisualMimetype(mimetype: string): boolean {
  return VISUAL_MIMETYPES.has(mimetype);
}

/**
 * Check if HTML content contains visual/chart signatures
 */
export function isVisualHtml(htmlContent: string): boolean {
  if (typeof htmlContent !== "string") {
    return false;
  }
  const lowerContent = htmlContent.toLowerCase();
  return HTML_VISUAL_SIGNATURES.some((sig) =>
    lowerContent.includes(sig.toLowerCase()),
  );
}

/**
 * Check if an output message represents a visual output
 * that should be auto-placed in grid layout
 */
export function isVisualOutput(output: OutputMessage | null): boolean {
  if (output === null || output.data === null || output.data === "") {
    return false;
  }

  const { mimetype, data } = output;

  // Direct visual MIME types
  if (isVisualMimetype(mimetype)) {
    return true;
  }

  // Check HTML content for chart signatures
  if (mimetype === "text/html" && typeof data === "string") {
    return isVisualHtml(data);
  }

  // Check mimebundle for visual types
  if (mimetype === "application/vnd.marimo+mimebundle") {
    try {
      const bundle: Record<string, unknown> =
        typeof data === "string"
          ? (JSON.parse(data) as Record<string, unknown>)
          : (data as Record<string, unknown>);
      return Object.keys(bundle).some(
        (mime) => mime !== "__metadata__" && isVisualMimetype(mime),
      );
    } catch {
      return false;
    }
  }

  return false;
}
