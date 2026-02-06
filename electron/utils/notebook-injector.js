/* Copyright 2026 Marimo. All rights reserved. */

import { readFileSync, writeFileSync } from "node:fs";
import { logInfo, logError } from "./logger.js";

/**
 * ノートブックファイルを解析し、セルを注入する
 *
 * marimo ノートブックの構造:
 * - import marimo + app = marimo.App() (ヘッダー)
 * - with app.setup: ... (セットアップブロック)
 * - @app.cell def ...() (セル定義)
 * - if __name__ == "__main__": app.run() (フッター)
 */

/**
 * ノートブックファイルからセルを抽出
 * @param {string} content - ノートブックの内容
 * @returns {{header: string, setup: string, cells: Array<{name: string, code: string, config: string}>, footer: string}}
 */
function parseNotebook(content) {
  const lines = content.split("\n");
  const result = {
    header: "",
    setup: "",
    cells: [],
    footer: "",
  };

  let currentSection = "header";
  let currentCell = null;
  let setupIndent = 0;
  let cellBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // with app.setup: の開始を検出
    if (line.trim().startsWith("with app.setup:")) {
      currentSection = "setup";
      result.header += line + "\n";
      // setup のインデントレベルを記録
      setupIndent = line.indexOf("with");
      continue;
    }

    // setup セクション内
    if (currentSection === "setup") {
      // setup ブロック終了（インデントが戻った）
      if (line.trim() && !line.startsWith(" ".repeat(setupIndent + 4)) && !line.startsWith("\t")) {
        if (line.trim().startsWith("@app.cell")) {
          currentSection = "cells";
          // この行はセルとして処理
        } else {
          result.setup += line + "\n";
          continue;
        }
      } else {
        result.setup += line + "\n";
        continue;
      }
    }

    // @app.cell デコレータを検出
    if (line.trim().startsWith("@app.cell")) {
      // 前のセルを保存
      if (currentCell) {
        result.cells.push({
          name: currentCell.name,
          code: cellBuffer.join("\n"),
          config: currentCell.config,
        });
        cellBuffer = [];
      }

      currentSection = "cells";
      // config を抽出 (例: @app.cell(hide_code=True))
      const configMatch = line.match(/@app\.cell\(([^)]*)\)/);
      currentCell = {
        name: null,
        config: configMatch ? configMatch[1] : "",
      };
      cellBuffer.push(line);
      continue;
    }

    // セルの関数定義を検出
    if (currentSection === "cells" && line.trim().startsWith("def ") && currentCell) {
      const nameMatch = line.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      if (nameMatch) {
        currentCell.name = nameMatch[1];
      }
      cellBuffer.push(line);
      continue;
    }

    // if __name__ == "__main__": を検出
    if (line.trim().startsWith('if __name__ == "__main__":') || line.trim().startsWith("if __name__ == '__main__':")) {
      // 前のセルを保存
      if (currentCell) {
        result.cells.push({
          name: currentCell.name,
          code: cellBuffer.join("\n"),
          config: currentCell.config,
        });
        cellBuffer = [];
        currentCell = null;
      }
      currentSection = "footer";
      result.footer += line + "\n";
      continue;
    }

    // 各セクションに追加
    switch (currentSection) {
      case "header":
        result.header += line + "\n";
        break;
      case "cells":
        if (currentCell) {
          cellBuffer.push(line);
        }
        break;
      case "footer":
        result.footer += line + "\n";
        break;
    }
  }

  // 最後のセルを保存
  if (currentCell && cellBuffer.length > 0) {
    result.cells.push({
      name: currentCell.name,
      code: cellBuffer.join("\n"),
      config: currentCell.config,
    });
  }

  return result;
}

/**
 * ノートブックを再構築
 * @param {{header: string, setup: string, cells: Array<{name: string, code: string, config: string}>, footer: string}} parsed
 * @returns {string}
 */
function serializeNotebook(parsed) {
  let content = parsed.header;

  if (parsed.setup) {
    content += parsed.setup;
  }

  // セルを追加
  for (const cell of parsed.cells) {
    content += "\n" + cell.code + "\n";
  }

  // フッターを追加
  if (parsed.footer) {
    content += "\n" + parsed.footer;
  }

  return content;
}

/**
 * セットアップブロック内の _GAME_PROGRESS を更新
 * @param {string} setup - setup ブロックの内容
 * @param {object} newProgress - 新しい進捗データ
 * @returns {string}
 */
function updateProgressInSetup(setup, newProgress) {
  // _GAME_PROGRESS = {...} を探して置換
  const progressRegex = /_GAME_PROGRESS\s*=\s*\{[^}]+\}/s;
  const progressMatch = setup.match(progressRegex);

  if (!progressMatch) {
    logError("_GAME_PROGRESS not found in setup block");
    return setup;
  }

  // 新しい進捗データを整形
  const progressStr = `_GAME_PROGRESS = ${JSON.stringify(newProgress, null, 8).replace(/^/gm, "    ").trim()}`;

  return setup.replace(progressRegex, progressStr);
}

/**
 * 新しいセルをノートブックに注入
 * @param {string} notebookPath - ノートブックファイルのパス
 * @param {object} options - 注入オプション
 * @param {string} options.skillId - 完了したスキルID
 * @param {Array<{name: string, code: string, config?: string, afterCell?: string}>} options.cells - 追加するセル
 * @param {object} options.progressUpdate - 進捗の更新内容
 * @returns {{success: boolean, error?: string}}
 */
export function injectCells(notebookPath, options) {
  try {
    logInfo(`Injecting cells for skill: ${options.skillId}`);

    // ノートブックを読み込み
    const content = readFileSync(notebookPath, "utf-8");
    const parsed = parseNotebook(content);

    // 進捗を更新
    if (options.progressUpdate) {
      parsed.setup = updateProgressInSetup(parsed.setup, options.progressUpdate);
    }

    // 新しいセルを追加
    if (options.cells && options.cells.length > 0) {
      for (const newCell of options.cells) {
        // 挿入位置を決定
        let insertIndex = parsed.cells.length; // デフォルトは末尾

        if (newCell.afterCell) {
          const afterIndex = parsed.cells.findIndex((c) => c.name === newCell.afterCell);
          if (afterIndex !== -1) {
            insertIndex = afterIndex + 1;
          }
        }

        // セルコードを整形
        const config = newCell.config ? `@app.cell(${newCell.config})` : "@app.cell";
        const cellCode = `${config}\ndef ${newCell.name}():\n${newCell.code.split('\n').map(l => '    ' + l).join('\n')}`;

        // セルを挿入
        parsed.cells.splice(insertIndex, 0, {
          name: newCell.name,
          code: cellCode,
          config: newCell.config || "",
        });

        logInfo(`Injected cell: ${newCell.name} at position ${insertIndex}`);
      }
    }

    // ノートブックを再構築して保存
    const newContent = serializeNotebook(parsed);
    writeFileSync(notebookPath, newContent, "utf-8");

    logInfo(`Notebook updated: ${notebookPath}`);
    return { success: true };
  } catch (error) {
    logError("Failed to inject cells", error);
    return { success: false, error: error.message };
  }
}

/**
 * ノートブックから進捗データを読み取り
 * @param {string} notebookPath - ノートブックファイルのパス
 * @returns {{success: boolean, progress?: object, error?: string}}
 */
export function readProgress(notebookPath) {
  try {
    const content = readFileSync(notebookPath, "utf-8");

    // _GAME_PROGRESS = {...} を抽出
    const progressMatch = content.match(/_GAME_PROGRESS\s*=\s*(\{[^}]+\})/s);
    if (!progressMatch) {
      return { success: false, error: "_GAME_PROGRESS not found" };
    }

    // JSON として解析（Python dict を JSON に変換）
    let progressStr = progressMatch[1]
      .replace(/'/g, '"') // シングルクォートをダブルクォートに
      .replace(/True/g, "true")
      .replace(/False/g, "false")
      .replace(/None/g, "null");

    const progress = JSON.parse(progressStr);
    return { success: true, progress };
  } catch (error) {
    logError("Failed to read progress", error);
    return { success: false, error: error.message };
  }
}

/**
 * セットアップブロックを更新（モード変更など）
 * @param {string} notebookPath - ノートブックファイルのパス
 * @param {string} newSetupContent - 新しいセットアップブロックの内容
 * @returns {{success: boolean, error?: string}}
 */
export function updateSetupBlock(notebookPath, newSetupContent) {
  try {
    const content = readFileSync(notebookPath, "utf-8");
    const parsed = parseNotebook(content);

    parsed.setup = newSetupContent;

    const newContent = serializeNotebook(parsed);
    writeFileSync(notebookPath, newContent, "utf-8");

    logInfo(`Setup block updated: ${notebookPath}`);
    return { success: true };
  } catch (error) {
    logError("Failed to update setup block", error);
    return { success: false, error: error.message };
  }
}
