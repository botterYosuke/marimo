/* Copyright 2026 Marimo. All rights reserved. */

import { execSync } from "node:child_process";
import { codecovVitePlugin } from "@codecov/vite-plugin";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { defineConfig, type Plugin } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const SERVER_PORT = process.env.SERVER_PORT || 2718;
const HOST = process.env.HOST || "127.0.0.1";
const TARGET = `http://${HOST}:${SERVER_PORT}`;
const isDev = process.env.NODE_ENV === "development";
const isStorybook = process.env.npm_lifecycle_script?.includes("storybook");
const isPyodide = process.env.PYODIDE === "true";

console.log("Building environment:", process.env.NODE_ENV);

const htmlDevPlugin = (): Plugin => {
  return {
    // Pyodide production build also needs HTML template replacement
    apply: isPyodide ? undefined : "serve",
    name: "html-transform",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === "GET" && req.url?.startsWith("/.well-known/")) {
          res.statusCode = 404;
          res.end("Not Found");
          return;
        }
        next();
      });
    },
    transformIndexHtml: async (html, ctx) => {
      if (isStorybook) {
        return html;
      }

      // Add react-scan in dev mode
      if (isDev) {
        html = html.replace(
          "<head>",
          '<head>\n<script src="https://unpkg.com/react-scan/dist/auto.global.js"></script>',
        );
      }

      if (isPyodide) {
        const marimoVersion = execSync("uv run marimo --version")
          .toString()
          .trim();
        const modeFromUrl = ctx.originalUrl?.includes("mode=read")
          ? "read"
          : "edit";
        html = html.replace("{{ base_url }}", "");
        html = html.replace("{{ title }}", "marimo");
        html = html.replace(
          "'{{ mount_config }}'",
          JSON.stringify({
            filename: "notebook.py",
            mode: modeFromUrl,
            // If VITE_MARIMO_VERSION is defined, pull the local version of marimo
            // Otherwise, pull the latest version of marimo from PyPI
            version: process.env.VITE_MARIMO_VERSION ?? marimoVersion,
            config: {
              // Add/remove user config here while developing
              // runtime: {
              //   auto_instantiate: false,
              // },
            },
            configOverrides: {},
            appConfig: {},
            serverToken: "",
          }),
        );
        html = html.replace(/<\/head>/, "<marimo-wasm></marimo-wasm></head>");
        return html;
      }

      // fetch html from server
      let serverHtml: string;
      try {
        const serverHtmlResponse = await fetch(TARGET + ctx.originalUrl);
        if (!serverHtmlResponse.ok) {
          throw new Error("Failed to fetch");
        }
        serverHtml = await serverHtmlResponse.text();
      } catch {
        console.error(
          `Failed to connect to a marimo server at ${TARGET + ctx.originalUrl}`,
        );
        console.log(`
A marimo server may not be running.
Run \x1b[32mmarimo edit --no-token --headless\x1b[0m in another terminal to start the server.

If the server is already running, make sure it is using port ${SERVER_PORT} with \x1b[1m--port=${SERVER_PORT}\x1b[0m.
        `);
        return `
        <html>
          <body style="padding: 2rem; font-family: system-ui, sans-serif; line-height: 1.5;">
            <div style="max-width: 500px; margin: 0 auto;">
              <h2 style="color: #e53e3e">Server Connection Error</h2>

              <p>
                Could not connect to marimo server at:<br/>
                <code style="background: #f7f7f7; padding: 0.2rem 0.4rem; border-radius: 4px;">
                  ${TARGET + ctx.originalUrl}
                </code>
              </p>

              <div style="background: #f7f7f7; padding: 1.5rem; border-radius: 8px;">
                <div>To start the server, run:</div>
                <code style="color: #32CD32; font-weight: 600;">
                  marimo edit --no-token --headless
                </code>
              </div>

              <p>
                If the server is already running, make sure it is using port
                <code style="font-weight: 600;">${SERVER_PORT}</code>
                with the flag
                <code style="font-weight: 600;">--port=${SERVER_PORT}</code>
              </p>
            </div>
          </body>
        </html>
        `;
      }

      const serverDoc = new JSDOM(serverHtml).window.document;
      const devDoc = new JSDOM(html).window.document;

      if (ctx.originalUrl?.startsWith("/health")) {
        return serverHtml;
      }

      // Login page
      if (!serverHtml.includes("marimo-mode") && serverHtml.includes("login")) {
        return `
        <html>
          <body style="padding: 2rem; font-family: system-ui, sans-serif; line-height: 1.5;">
            <div style="max-width: 500px; margin: 0 auto;">
              <h2 style="color: #e53e3e">Authentication Not Supported</h2>

              <p>
                In development mode, please run the server without authentication:
              </p>

              <div style="background: #f7f7f7; padding: 1.5rem; border-radius: 8px;">
                <code style="color: #32CD32; font-weight: 600;">
                  marimo edit --no-token
                </code>
              </div>
            </div>
          </body>
        </html>
        `;
      }

      // copies these elements from server to dev
      const copyElements = ["title", "marimo-filename"];

      // remove from dev
      copyElements.forEach((id) => {
        const element = devDoc.querySelector(id);
        if (!element) {
          console.warn(`Element ${id} not found.`);
          return;
        }
        element.remove();
      });
      // Remove script that contains __MARIMO_MOUNT_CONFIG__
      const scriptsDev = devDoc.querySelectorAll("script");
      scriptsDev.forEach((script) => {
        if (script.innerHTML.includes("__MARIMO_MOUNT_CONFIG__")) {
          script.remove();
        }
      });

      // copy from server
      copyElements.forEach((id) => {
        const element = serverDoc.querySelector(id);
        if (!element) {
          console.warn(`Element ${id} not found.`);
          return;
        }
        devDoc.head.append(element);
      });

      // Copy styles
      const styles = serverDoc.querySelectorAll("style");
      styles.forEach((style) => {
        devDoc.head.append(style);
      });

      // Copy scripts
      const scripts = serverDoc.querySelectorAll("script");
      scripts.forEach((script) => {
        const src = script.getAttribute("src");

        if (src?.startsWith("./assets/")) {
          return;
        }

        devDoc.head.append(script);
      });

      return `<!DOCTYPE html>\n${devDoc.documentElement.outerHTML}`;
    },
  };
};

const ReactCompilerConfig = {
  target: "19",
};

// https://vitejs.dev/config/
export default defineConfig({
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
      "/mpl": {
        target: TARGET,
        ws: true,
        changeOrigin: true,
        headers: {
          origin: TARGET,
        },
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
    "process.env.DEBUG": JSON.stringify(process.env.DEBUG ?? ""),
  },
  build: {
    // Pyodide requires topLevelAwait plugin to transform top-level await;
    // esnext target would output it natively and break Pyodide environments.
    ...(isPyodide ? {} : { target: "esnext" }),
    minify: isDev ? false : "oxc", // default is "oxc"
    sourcemap: isDev,
  },
  resolve: {
    tsconfigPaths: true,
    // Fix for rolldown-vite 7.3.1 type-only import resolution.
    // Not applied in Pyodide builds: these aliases break the module graph and cause TLA issues.
    alias: isPyodide ? {} : {
      // vega-lite exports types via ./types_unstable/* -> ./build/*
      // but only .d.ts files exist, not .js files
      'vega-lite/types_unstable/channeldef.js': 'vega-lite/build/channeldef.d.ts',
      'vega-lite/types_unstable/encoding.js': 'vega-lite/build/encoding.d.ts',
      'vega-lite/types_unstable/spec/unit.js': 'vega-lite/build/spec/unit.d.ts',
      'vega-lite/types_unstable/channel.js': 'vega-lite/build/channel.d.ts',
      'vega-lite/types_unstable/compositemark/index.js': 'vega-lite/build/compositemark/index.d.ts',
      'vega-lite/types_unstable/data.js': 'vega-lite/build/data.d.ts',
      'vega-lite/types_unstable/mark.js': 'vega-lite/build/mark.d.ts',
      'vega-lite/types_unstable/selection.js': 'vega-lite/build/selection.d.ts',
      'vega-lite/types_unstable/spec/facet.js': 'vega-lite/build/spec/facet.d.ts',
      'vega-lite/types_unstable/spec/layer.js': 'vega-lite/build/spec/layer.d.ts',
      'vega-lite/types_unstable/spec/index.js': 'vega-lite/build/spec/index.d.ts',
      'vega-lite/types_unstable/spec/toplevel.js': 'vega-lite/build/spec/toplevel.d.ts',
      'vega-lite/types_unstable/type.js': 'vega-lite/build/type.d.ts',
      'vega-lite/types_unstable/aggregate.js': 'vega-lite/build/aggregate.d.ts',
      'vega-lite/types_unstable/bin.js': 'vega-lite/build/bin.d.ts',
      'vega-lite/types_unstable/scale.js': 'vega-lite/build/scale.d.ts',
      'vega-lite/types_unstable/resolve.js': 'vega-lite/build/resolve.d.ts',
    },
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
    // 'resolver' is required for vite-plugin-top-level-await to propagate TLA correctly.
    // enableNativePlugin: true breaks JS transform plugins in Pyodide builds.
    enableNativePlugin: 'resolver',
  },
  worker: {
    format: "es",
  },
  plugins: [
    htmlDevPlugin(),
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
    ...(isPyodide ? [topLevelAwait()] : []),
  ],
});
