/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Stub for loro-crdt used in Pyodide (WASM) builds.
 *
 * Root cause of "na is not a function" errors:
 *   loro-crdt/bundler/loro_wasm.js uses Top-Level Await (TLA) for WASM
 *   initialization. TLA propagates across the chunk graph:
 *     loro_wasm.js → cells.js → layout.js (exports Ct as _/__tla)
 *   panels.js imports `_ as na` from layout.js but rolldown-vite 7.3.1
 *   fails to add the __tla chain to panels.js (bug in both JS plugin and
 *   native plugin modes). Result: na (= Ct) is undefined → TypeError.
 *
 * Fix: alias "loro-crdt" to this stub in Pyodide builds (vite.config.mts).
 *   The stub has no WASM and no TLA, eliminating TLA from the dependency
 *   graph entirely. The loro_wasm_bg.{js,wasm} files are also excluded
 *   from the Pyodide bundle (saving ~3 MB of WASM).
 *
 * Safety: In Pyodide, isWasm() returns true, so realTimeCollaboration()
 *   returns early with { extension: [], code: initialCode } before any
 *   loro-crdt API is called. The module-level initialization in
 *   rtc/extension.ts (new LoroDoc(), new Awareness(...), etc.) still runs,
 *   but only registers callbacks that are never fired in Pyodide mode.
 *
 * Scope: Pyodide builds only (PYODIDE=true). Normal web builds continue
 *   to use the real loro-crdt package with WASM.
 */

// biome-ignore lint: stub intentionally uses any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noop = (..._args: any[]): any => {};

export class LoroDoc {
  readonly peerIdStr: string = "pyodide-stub";
  subscribeLocalUpdates = noop;
  import = noop;
  getMap = () => new LoroMap();
  getByPath = () => undefined;
  subscribe = () => noop;
  toJSON = () => ({});
  commit = noop;
  getCursorPos = () => undefined;
}

export class LoroMap {
  getOrCreateContainer = (_key: string, container: unknown) => container;
  set = noop;
  toJSON = () => ({});
  clear = noop;
}

export class LoroText {
  insert = noop;
  delete = noop;
  toString = () => "";
  get length() {
    return 0;
  }
  getCursor = () => undefined;
}

export class Awareness {
  constructor(_peerIdStr: string) {}
  apply = noop;
  encode = (): Uint8Array => new Uint8Array();
  addListener = noop;
}

export class Cursor {
  static decode = (): Cursor => new Cursor();
}
