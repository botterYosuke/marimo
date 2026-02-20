# Issue: "Cell ID null cannot be found" 警告がコンソールに出力される

**作成日**: 2026-02-20
**重要度**: Low
**カテゴリ**: Frontend / Grid Layout
**ステータス**: ✅ 修正完了（E2E 実動作検証は未実施）

---

## 進捗

| 作業項目 | ステータス |
|---|---|
| 警告の発生元特定 | ✅ 完了 |
| 原因の根本解析（DOM 構造差異） | ✅ 完了 |
| `registerReactComponent.tsx` のコード修正 | ✅ 完了 |
| 通常レイアウトへの影響なし確認（コードレビュー） | ✅ 完了 |
| E2E テストでの実動作検証 | 未実施 |

---

## 概要

grid レイアウトのノートブック（`marimo.App(width="grid")`）でセルを実行すると、ブラウザコンソールに `Cell ID null cannot be found` 警告が複数回出力される。

**現象**:
```
[WARNING] Cell ID null cannot be found @ http://localhost:2718/assets/hotkeys-BHHWjLlp.js:0
[WARNING] Cell ID null cannot be found @ http://localhost:2718/assets/hotkeys-BHHWjLlp.js:0
```

---

## 観察した状況

- **発生条件**: grid レイアウト（`marimo.App(width="grid")`）でセルを `Ctrl+Enter` で実行したとき
- **発生タイミング**: セルの実行完了後（出力が更新されるタイミング）
- **発生回数**: セル実行のたびに2回（一貫して2連続）
- **ゲームへの影響**: スキル発火やセル実行には影響なし（警告のみ）

```
// 観察されたコンソールログパターン（セル実行後）
[LOG] [autoPlace] Cell GuPS: isVisual=false, ...
[LOG] [SkillHandler] Received skill event: SANDBOX_002
[LOG] [autoPlace] Cell GuPS: isVisual=false, ...
[WARNING] Cell ID null cannot be found  ← 2回
[WARNING] Cell ID null cannot be found  ← 2回目
```

---

## 根本原因（確定）

### 警告の発生元

**`frontend/src/plugins/core/registerReactComponent.tsx:217`**（修正前の行番号）

プラグイン関数（`methods[key]`）が呼び出される際、セルの初期化チェックのために `HTMLCellId.findElementThroughShadowDOMs(hostElement)` でセルIDを解決するが、grid レイアウトでは `null` が返り `Logger.warn` が発火していた。

> **注**: 当初 `hotkeys-*.js` が原因と推測されていたが、ビルド済みJSのスタックトレースに `hotkeys` と表示されていたのはバンドラー（Vite/Rollup）のチャンク分割による誤解であった。

### DOM 構造の違い

`HTMLCellId.findElement()`（`ids.ts:65`）は `element.closest('div[id^="cell-"]')` で祖先を探索する。

| レイアウト | DOM 構造 | `findElement()` の結果 |
|---|---|---|
| 通常 | `<div id="cell-{cellId}">` > ... > `<marimo-{plugin}>` | `div[id^="cell-"]` を発見 → cellId 取得 |
| grid | `<div class="react-flow__node rf__node-{id}">` > ... > `<marimo-{plugin}>` | `cell-` プレフィックスの要素が不在 → `null` |

### なぜ2回出力されるか

セル実行完了時にプラグインの出力が再レンダリングされ、プラグイン内の関数（例: チャートの更新関数）が複数回呼ばれるため。呼び出し回数はプラグインの種類と構成に依存する。

---

## 実施した修正

### 対象ファイル

`frontend/src/plugins/core/registerReactComponent.tsx`（216-220行目）

### 変更前

```typescript
if (cellId && !isStatic) {
  // ... cell initialization check ...
} else {
  Logger.warn(`Cell ID ${cellId} cannot be found`);  // 全てのフォールスルーで WARNING
}
```

### 変更後

```typescript
if (cellId && !isStatic) {
  // ... cell initialization check ...
} else if (!cellId) {
  // Grid layout: cell ID resolution via div[id^="cell-"] doesn't work
  // with react-flow nodes. This is expected and not an error.
  Logger.debug(`Cell ID could not be resolved (grid layout or static)`);
}
```

### 修正のポイント

1. **`else` → `else if (!cellId)`**: `cellId` が null の場合のみ分岐に入るよう限定
2. **`Logger.warn` → `Logger.debug`**: grid レイアウトでは正常な状態なので debug レベルに降格
3. **第3ケースの暗黙通過**: `cellId` あり + `isStatic` = true の場合はログ不要でそのまま通過

---

## 設計思想と背景

### プラグイン関数の実行パスにおける cellId の役割

プラグイン関数の実行は2つの独立したID体系に依存する:

```
hostElement → getUIElementObjectId() → objectId  ← FUNCTIONS_REGISTRY で関数を特定・実行（常に取得可能）
hostElement → findElementThroughShadowDOMs() → cellId  ← 初期化チェックにのみ使用（grid では取得不可）
```

`cellId` は「セルが未初期化（未実行）の状態でプラグイン操作をブロックする」ためだけに使われる。関数の実行自体は `objectId` をキーとする `FUNCTIONS_REGISTRY.request()` が担当するため、`cellId` が null でもプラグインは正常に動作する。

### 条件分岐の全パターン

| cellId | isStatic | 動作 | 説明 |
|---|---|---|---|
| あり | false | セル初期化チェック実行 | 通常レイアウト・通常実行 |
| あり | true | チェックスキップ、通過 | 静的ノートブック（エクスポート時等） |
| null | - | `Logger.debug` のみ | grid レイアウト（正常） |

### grid レイアウトで初期化チェックがスキップされる影響

grid レイアウトでは `cellId` が取得できないためセル初期化チェックがバイパスされるが、実用上の問題はない。grid レイアウトのセルは react-flow で管理され、UIが表示される時点でバックエンドの実行は完了しているため、未初期化状態でプラグインが操作される状況は発生しない。

### 当初の仮説の棄却

| 仮説 | 結果 |
|---|---|
| hotkeys.js（キーボードショートカット）が原因 | ❌ バンドラーのチャンク名による誤解 |
| `Ctrl+Enter` 後のフォーカス喪失 | ❌ フォーカスではなく DOM 構造の問題 |
| 新規セルのID登録タイミング | ❌ セル追加時ではなくプラグイン関数呼び出し時に発生 |

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `frontend/src/plugins/core/registerReactComponent.tsx:216-220` | ✅ **修正箇所** — プラグイン関数の cellId チェック |
| `frontend/src/core/cells/ids.ts:64-86` | `HTMLCellId.findElement()` / `findElementThroughShadowDOMs()` — DOM からセルIDを解決 |
| `development_docs/issues/prompt-fix-cell-id-null-warning.md` | 修正依頼プロンプト（修正完了済み） |
| `src-tauri/sample-notebooks/backcast.py` | `marimo.App(width="grid")` を使用するサンプルノートブック |

---

## Tips

- **Logger レベルの挙動**: marimo frontend では `Logger.debug` はデフォルトでコンソールに出力されない。開発時に確認したい場合はブラウザのコンソールフィルタを "Verbose" に変更する
- **E2E テストへの影響**: WARNING レベルのログはコンソール監視系の E2E テストで false positive を引き起こす可能性があった。debug レベルにすることでテストの安定性が向上する
- **バンドル後のスタックトレースに注意**: Vite/Rollup のチャンク分割により、スタックトレースに表示されるファイル名（`hotkeys-*.js`）と実際のソースファイルが一致しないことがある。ソースマップ or 開発ビルド（`pnpm dev`）で確認すること
- **`findElementThroughShadowDOMs` の限界**: Shadow DOM を跨いで `div[id^="cell-"]` を探す仕組みだが、grid レイアウトの react-flow ノードには構造的に対応できない。grid 対応が必要な場合は別のID解決パスが必要になる

---

## 完了条件

- ✅ grid レイアウトで `[WARNING] Cell ID null cannot be found` がコンソールに出なくなること
- ✅ 通常レイアウトの既存動作に影響がないこと（コードレビューで確認）
- ✅ プラグイン関数の呼び出しが引き続き正常に動作すること（`objectId` ベースの動作は変更なし）
- E2E テストでの実動作確認は未実施
