# Issue: "Cell ID null cannot be found" 警告がコンソールに出力される

**作成日**: 2026-02-20
**重要度**: Low
**カテゴリ**: Frontend / Grid Layout
**ステータス**: Open

---

## 📝 概要

grid レイアウトのノートブック（`marimo.App(width="grid")`）でセルを実行すると、ブラウザコンソールに `Cell ID null cannot be found` 警告が複数回出力される。

**現象**:
```
[WARNING] Cell ID null cannot be found @ http://localhost:2718/assets/hotkeys-BHHWjLlp.js:0
[WARNING] Cell ID null cannot be found @ http://localhost:2718/assets/hotkeys-BHHWjLlp.js:0
```

---

## 🔍 観察した状況

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

## 🔍 仮説

`hotkeys-BHHWjLlp.js` はキーボードショートカットハンドラーであることから、`Ctrl+Enter` の keyup/keydown イベントが処理される際に、セルIDの解決に失敗している可能性がある。

考えられる原因：

1. **grid レイアウト固有の問題**: 通常レイアウトでは `[data-testid="cell"]` を使ってセルを特定するが、grid レイアウトでは react-flow ノード（`rf__node-{id}`）で管理されるため、ID解決のロジックが対応していない

2. **Ctrl+Enter 後のフォーカス喪失**: `Ctrl+Enter` でセルを実行した後にフォーカスがどこにも当たっていない状態で、ショートカットハンドラーが「現在フォーカスのあるセル」を `null` と判定している

3. **新規追加セルのID登録タイミング**: `Python` ボタンで追加した直後のセルがIDマップに登録される前に、キーイベントハンドラーが呼ばれている

---

## 🔎 調査方法

```javascript
// ブラウザコンソールで hotkeys.js の警告発生箇所を特定
// ソースマップが利用可能な場合
debugger; // hotkeys-BHHWjLlp.js の警告行にブレークポイント設定
```

関連ファイルの候補：

- `frontend/src/hooks/` — キーボードショートカット関連フック
- `frontend/src/core/cells/` — セルID管理
- `frontend/src/components/editor/grid-layout/` — grid レイアウト固有のセル管理

---

## 💡 修正提案

### オプション A: 警告を `null` チェックで抑制

セルIDが `null` の場合は早期リターンし、警告を出さない（または debug レベルに落とす）。

### オプション B: フォーカス追跡の修正

grid レイアウトでの `Ctrl+Enter` 後にフォーカスを適切なセルに戻す処理を追加し、ショートカットハンドラーがセルを見つけられるようにする。

### オプション C: grid レイアウト対応のセルID解決

`hotkeys.js` のセルID解決ロジックを grid レイアウト（react-flow ノード）に対応させる。

---

## 📎 関連ファイル

| ファイル | 役割 |
|---|---|
| `frontend/src/assets/hotkeys-*.js`（ビルド済み） | キーボードショートカットハンドラー |
| `frontend/src/core/cells/` | セルID管理 |
| `src-tauri/sample-notebooks/backcast.py` | `marimo.App(width="grid")` を使用するノートブック |

---

## 📝 補足情報

### ゲームへの実害

- スキル発火・セル実行・UI表示には影響なし
- 開発者がコンソールを監視する際にノイズとなる
- e2e テストの `browser_console_messages` でエラーとして検出される可能性があるため、テストの安定性に影響する可能性がある

### 再現環境

- marimo dev server（`pnpm dev`）
- `marimo.App(width="grid")` レイアウト
- `Ctrl+Enter` でのセル実行
- Windows 11 / Chromium ベースのブラウザ
