/* Copyright 2026 Marimo. All rights reserved. */
// Placeholder WASM controller module.
// The actual controller is BackcastProWasmController in backcastpro-loader.ts.
// If that fails to load, DefaultWasmController is used as fallback.
// This file must exist so Firebase Hosting serves it with the correct JS MIME type
// instead of falling through to the index.html rewrite rule.

export {};
