/* Copyright 2026 Marimo. All rights reserved. */
import { describe, expect, it } from "vitest";
import { generateMarimoTemplate } from "../marimo-template";

describe("generateMarimoTemplate", () => {
  it("generates a valid marimo notebook template", () => {
    const template = generateMarimoTemplate("0.19.9");

    expect(template).toContain("import marimo");
    expect(template).toContain('__generated_with = "0.19.9"');
    expect(template).toContain("app = marimo.App()");
    expect(template).toContain("@app.cell");
    expect(template).toContain("def _():");
    expect(template).toContain('if __name__ == "__main__":');
    expect(template).toContain("app.run()");
  });

  it("includes the correct version in the template", () => {
    const version = "1.2.3";
    const template = generateMarimoTemplate(version);

    expect(template).toContain(`__generated_with = "${version}"`);
  });

  it("handles different version formats", () => {
    expect(generateMarimoTemplate("0.1.0")).toContain(
      '__generated_with = "0.1.0"',
    );
    expect(generateMarimoTemplate("10.20.30")).toContain(
      '__generated_with = "10.20.30"',
    );
    expect(generateMarimoTemplate("unknown")).toContain(
      '__generated_with = "unknown"',
    );
  });

  it("produces a template that can be recognized as a marimo file", () => {
    const template = generateMarimoTemplate("0.19.9");

    // The key pattern that _is_marimo_file() checks for
    expect(template).toMatch(/app\s*=\s*marimo\.App\(/);
  });
});
