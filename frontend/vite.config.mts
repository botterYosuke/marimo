/* Copyright 2026 Marimo. All rights reserved. */

import { codecovVitePlugin } from "@codecov/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_PORT = process.env.SERVER_PORT || 2718;
const HOST = process.env.HOST || "127.0.0.1";
const TARGET = `http://${HOST}:${SERVER_PORT}`;
const isDev = process.env.NODE_ENV === "development";
const isStorybook = process.env.npm_lifecycle_script?.includes("storybook");
const isPyodide = process.env.PYODIDE === "true";

console.log("Building environment:", process.env.NODE_ENV);

const devHtmlPlugin = (): Plugin => {
  return {
    name: "dev-html-plugin",
    transformIndexHtml(html) {
      // Add react-scan in dev mode (excluding Storybook)
      if (isDev && !isStorybook) {
        html = html.replace(
          "<head>",
          '<head>\n<script src="https://unpkg.com/react-scan/dist/auto.global.js"></script>',
        );
      }
      // Pyodide mode support (if needed)
      if (isPyodide) {
        html = html.replace(
          /(<marimo-server-token[^>]*>)/,
          `$1\n    <marimo-wasm hidden></marimo-wasm>`,
        );
      }
      return html;
    },
  };
};

// react-dnd解決プラグイン
const reactDndResolvePlugin = (): Plugin => {
  const require = createRequire(import.meta.url);
  const nodeModulesPath = path.resolve(__dirname, "../node_modules");

  // react-dnd関連パッケージのリスト
  const reactDndPackages = ["react-dnd", "react-dnd-html5-backend", "dnd-core"];

  return {
    name: "react-dnd-resolve",
    enforce: "pre", // 他のプラグインより先に実行
    resolveId(id, importer) {
      // react-dnd関連パッケージを明示的に解決
      if (reactDndPackages.includes(id)) {
        try {
          // pnpmのワークスペースでは、node_modulesから解決を試みる
          // 実際のパスは、node_modules内のシンボリックリンクを解決することで取得できる
          const resolved = require.resolve(id, {
            paths: [nodeModulesPath, __dirname],
          });
          return resolved;
        } catch (error) {
          // 解決に失敗した場合は、node_modules内のパスを直接構築
          const packagePath = path.resolve(nodeModulesPath, id);
          if (existsSync(packagePath)) {
            // package.jsonからエントリーポイントを取得
            const packageJsonPath = path.resolve(packagePath, "package.json");
            if (existsSync(packageJsonPath)) {
              const packageJson = require(packageJsonPath);
              const entryPoint = packageJson.module || packageJson.main || "index.js";
              return path.resolve(packagePath, entryPoint);
            }
            return packagePath;
          }
          // 解決に失敗した場合は、標準の解決プロセスに委譲
          return null;
        }
      }
      return null; // 他のモジュールは標準の解決プロセスを使用
    },
  };
};

const ReactCompilerConfig = {
  target: "19",
};

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  // This allows for a dynamic <base> tag in index.html
  base: "./",
  server: {
    host: "localhost",
    port: 3000,
    proxy: {
      "/api": {
        target: TARGET,
        changeOrigin: true,
      },
      "/auth": {
        target: TARGET,
        changeOrigin: true,
      },
      "/@file": {
        target: TARGET,
        changeOrigin: true,
      },
      "/custom.css": {
        target: TARGET,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://${HOST}:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
        headers: {
          origin: TARGET,
        },
      },
      "/ws_sync": {
        target: `ws://${HOST}:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
        headers: {
          origin: TARGET,
        },
      },
      "/lsp": {
        target: `ws://${HOST}:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
        headers: {
          origin: TARGET,
        },
      },
      "/terminal/ws": {
        target: `ws://${HOST}:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
        headers: {
          origin: TARGET,
        },
      },
    },
    headers: isPyodide
      ? {
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
        }
      : {},
  },
  define: {
    "import.meta.env.VITE_MARIMO_VERSION": process.env.VITE_MARIMO_VERSION
      ? JSON.stringify(process.env.VITE_MARIMO_VERSION)
      : JSON.stringify("latest"),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },
  build: {
    outDir: "../dist",
    minify: isDev ? false : "esbuild", // Changed from "oxc" to "esbuild" to fix Worker function reference issues
    sourcemap: isDev,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split react-grid-layout into a separate chunk to avoid import resolution issues
          if (id.includes("react-grid-layout")) {
            return "react-grid-layout";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@marimo-team/llm-info/icons": path.resolve(__dirname, "../packages/llm-info/icons"),
      "@marimo-team/llm-info/models.json": path.resolve(
        __dirname,
        "../packages/llm-info/data/generated/models.json",
      ),
      "@marimo-team/llm-info/providers.json": path.resolve(
        __dirname,
        "../packages/llm-info/data/generated/providers.json",
      ),
    },
    tsconfigPaths: true,
    preserveSymlinks: false, // pnpmのシンボリックリンクを正しく解決
    conditions: ["import", "module", "browser", "default"],
    dedupe: [
      "react",
      "react-dom",
      "@emotion/react",
      "@emotion/cache",
      "@codemirror/view",
      "@codemirror/state",
      // Dedupe react-dnd to prevent "Cannot have two HTML5 backends" errors
      "react-dnd",
      "react-dnd-html5-backend",
      "dnd-core",
    ],
  },
  experimental: {
    enableNativePlugin: true,
  },
  worker: {
    format: "es",
  },
  plugins: [
    devHtmlPlugin(),
    reactDndResolvePlugin(),
    react({
      babel: {
        presets: ["@babel/preset-typescript"],
        plugins: [
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["babel-plugin-react-compiler", ReactCompilerConfig],
        ],
      },
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "marimo",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
    wasm(),
    topLevelAwait(),
  ],
});
