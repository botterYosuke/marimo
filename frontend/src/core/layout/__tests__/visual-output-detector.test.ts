/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import type { OutputMessage } from "@/core/kernel/messages";
import {
  isVisualHtml,
  isVisualMimetype,
  isVisualOutput,
  VISUAL_MIMETYPES,
} from "../visual-output-detector";

describe("VISUAL_MIMETYPES", () => {
  it("should contain all expected image types", () => {
    expect(VISUAL_MIMETYPES.has("image/png")).toBe(true);
    expect(VISUAL_MIMETYPES.has("image/jpeg")).toBe(true);
    expect(VISUAL_MIMETYPES.has("image/svg+xml")).toBe(true);
    expect(VISUAL_MIMETYPES.has("image/gif")).toBe(true);
  });

  it("should contain video types", () => {
    expect(VISUAL_MIMETYPES.has("video/mp4")).toBe(true);
    expect(VISUAL_MIMETYPES.has("video/mpeg")).toBe(true);
  });

  it("should contain vega chart types", () => {
    expect(VISUAL_MIMETYPES.has("application/vnd.vegalite.v5+json")).toBe(true);
    expect(VISUAL_MIMETYPES.has("application/vnd.vega.v5+json")).toBe(true);
    expect(VISUAL_MIMETYPES.has("application/vnd.vegalite.v6+json")).toBe(true);
    expect(VISUAL_MIMETYPES.has("application/vnd.vega.v6+json")).toBe(true);
  });
});

describe("isVisualMimetype", () => {
  it("should return true for image MIME types", () => {
    expect(isVisualMimetype("image/png")).toBe(true);
    expect(isVisualMimetype("image/jpeg")).toBe(true);
    expect(isVisualMimetype("image/svg+xml")).toBe(true);
  });

  it("should return true for video MIME types", () => {
    expect(isVisualMimetype("video/mp4")).toBe(true);
  });

  it("should return true for vega chart MIME types", () => {
    expect(isVisualMimetype("application/vnd.vegalite.v5+json")).toBe(true);
  });

  it("should return false for non-visual MIME types", () => {
    expect(isVisualMimetype("text/plain")).toBe(false);
    expect(isVisualMimetype("text/html")).toBe(false);
    expect(isVisualMimetype("application/json")).toBe(false);
  });
});

describe("isVisualHtml", () => {
  it("should detect plotly charts", () => {
    expect(isVisualHtml('<div class="plotly-graph-div"></div>')).toBe(true);
    expect(isVisualHtml('<div id="plotly-graph-div-1"></div>')).toBe(true);
  });

  it("should detect bokeh charts", () => {
    expect(isVisualHtml('<script src="bokeh-2.4.js"></script>')).toBe(true);
  });

  it("should detect SVG content", () => {
    expect(isVisualHtml("<svg><circle cx=50></circle></svg>")).toBe(true);
  });

  it("should detect canvas elements", () => {
    expect(isVisualHtml('<canvas id="chart"></canvas>')).toBe(true);
  });

  it("should detect inline images", () => {
    expect(isVisualHtml('<img src="data:image/png;base64,...">')).toBe(true);
  });

  it("should detect lightweight-charts", () => {
    expect(isVisualHtml('<div id="lightweight-charts"></div>')).toBe(true);
  });

  it("should return false for regular HTML", () => {
    expect(isVisualHtml("<div>Hello World</div>")).toBe(false);
    expect(isVisualHtml("<p>Some text</p>")).toBe(false);
  });

  it("should handle non-string input gracefully", () => {
    expect(isVisualHtml(null as unknown as string)).toBe(false);
    expect(isVisualHtml(undefined as unknown as string)).toBe(false);
    expect(isVisualHtml(123 as unknown as string)).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isVisualHtml('<DIV class="PLOTLY-GRAPH-DIV"></DIV>')).toBe(true);
    expect(isVisualHtml("<SVG></SVG>")).toBe(true);
  });
});

describe("isVisualOutput", () => {
  const createOutput = (
    mimetype: string,
    data: unknown,
  ): OutputMessage | null => {
    return {
      mimetype,
      data,
      channel: "output",
      timestamp: 0,
    } as OutputMessage;
  };

  it("should return false for null output", () => {
    expect(isVisualOutput(null)).toBe(false);
  });

  it("should return false for empty data", () => {
    expect(isVisualOutput(createOutput("image/png", ""))).toBe(false);
    expect(isVisualOutput(createOutput("image/png", null))).toBe(false);
  });

  it("should return true for image outputs", () => {
    expect(isVisualOutput(createOutput("image/png", "base64data"))).toBe(true);
    expect(isVisualOutput(createOutput("image/jpeg", "base64data"))).toBe(true);
    expect(isVisualOutput(createOutput("image/svg+xml", "<svg></svg>"))).toBe(
      true,
    );
  });

  it("should return true for video outputs", () => {
    expect(isVisualOutput(createOutput("video/mp4", "base64data"))).toBe(true);
  });

  it("should return true for vega chart outputs", () => {
    expect(
      isVisualOutput(
        createOutput("application/vnd.vegalite.v5+json", '{"$schema":"..."}'),
      ),
    ).toBe(true);
  });

  it("should return true for HTML with chart signatures", () => {
    expect(
      isVisualOutput(
        createOutput("text/html", '<div class="plotly-graph-div"></div>'),
      ),
    ).toBe(true);
  });

  it("should return true for HTML with marimo-anywidget (e.g., Lightweight Charts)", () => {
    expect(
      isVisualOutput(
        createOutput(
          "text/html",
          '<marimo-anywidget data-initial-value="..."></marimo-anywidget>',
        ),
      ),
    ).toBe(true);
  });

  it("should return false for HTML without chart signatures", () => {
    expect(
      isVisualOutput(createOutput("text/html", "<div>Hello World</div>")),
    ).toBe(false);
  });

  it("should return true for mimebundle with visual types", () => {
    const mimebundle = JSON.stringify({
      "image/png": "base64data",
      "text/plain": "fallback",
    });
    expect(
      isVisualOutput(
        createOutput("application/vnd.marimo+mimebundle", mimebundle),
      ),
    ).toBe(true);
  });

  it("should return false for mimebundle without visual types", () => {
    const mimebundle = JSON.stringify({
      "text/plain": "just text",
      "text/html": "<p>paragraph</p>",
    });
    expect(
      isVisualOutput(
        createOutput("application/vnd.marimo+mimebundle", mimebundle),
      ),
    ).toBe(false);
  });

  it("should handle mimebundle as object", () => {
    const mimebundle = {
      "image/png": "base64data",
    };
    expect(
      isVisualOutput(
        createOutput("application/vnd.marimo+mimebundle", mimebundle),
      ),
    ).toBe(true);
  });

  it("should return false for invalid mimebundle JSON", () => {
    expect(
      isVisualOutput(
        createOutput("application/vnd.marimo+mimebundle", "not json"),
      ),
    ).toBe(false);
  });

  it("should return false for non-visual MIME types", () => {
    expect(isVisualOutput(createOutput("text/plain", "hello"))).toBe(false);
    expect(isVisualOutput(createOutput("application/json", '{"a":1}'))).toBe(
      false,
    );
  });
});
