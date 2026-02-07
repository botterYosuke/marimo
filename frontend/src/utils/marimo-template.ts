/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Generate a marimo notebook template with the given version.
 * Used when creating new .py files from the file explorer.
 */
export function generateMarimoTemplate(version: string): string {
  return `import marimo

__generated_with = "${version}"
app = marimo.App()


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
`;
}
