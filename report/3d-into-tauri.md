# Edit モード Grid レイアウト（3Dモード）追加計画

## 概要
`main` ブランチ（`D:\Documents\marimo - m`、Electron版）の edit モード grid レイアウト（3Dモード）を `sasa/tauri` ブランチ（`D:\Documents\marimo`、Tauri版）に追加する。

## 主な機能
- `appConfig.width === "grid"` 時に3Dモードを有効化
- Three.js + ReactFlow でセルをフローティングウィンドウとして3D空間に配置
- セルのドラッグ＆ドロップ移動
- セル間の依存関係をエッジとして表示
- カメラ位置・セル位置の永続化（localStorage）

---

## 変更ファイル一覧

### 1. 新規ファイル（コピー）

| ファイル | 説明 |
|---------|------|
| `frontend/src/core/three/cell-3d-positions.ts` | セルの3D位置管理atom |
| `frontend/src/core/three/cell-3d-view.ts` | カメラ視点管理atom |
| `frontend/src/core/three/grid-css2d-service.ts` | CSS2Dレンダラー管理 |
| `frontend/src/core/three/scene-manager.ts` | Three.jsシーン管理 |
| `frontend/src/core/three/viewport-sync.ts` | RF viewport ↔ Three.js変換 |
| `frontend/src/components/editor/renderers/grid-3d-renderer.tsx` | Grid 3Dレンダラー |
| `frontend/src/components/editor/renderers/cell-3d-renderer.tsx` | セル 3Dレンダラー (ReactFlow) |
| `frontend/src/components/editor/renderers/cell-flow-node.tsx` | ReactFlowノードコンポーネント |
| `frontend/src/components/editor/renderers/cell-3d-wrapper.css` | 3Dモード用スタイル |
| `frontend/src/components/editor/renderers/grid-layout/edit-grid-layout.tsx` | Editモード用グリッドレイアウト |

### 2. 修正ファイル

| ファイル | 変更内容 |
|---------|----------|
| `frontend/src/core/config/widths.ts` | `"grid"` を追加 |
| `frontend/src/core/mode.ts` | `is3DModeAtom` を追加 |
| `frontend/src/core/edit-app.tsx` | 3Dモード統合ロジック追加 |
| `frontend/src/components/editor/renderers/cell-array.tsx` | `AddCellButtons` をexport |
| `frontend/src/components/editor/renderers/grid-layout/types.ts` | `position3D` フィールド追加 |
| `frontend/src/components/editor/renderers/grid-layout/plugin.tsx` | `position3D` バリデーター追加 |
| `frontend/package.json` | `three`, `@types/three` 依存関係追加 |

---

## 実装手順

### Step 1: 依存関係の追加
```bash
cd D:\Documents\marimo\frontend
pnpm add three
pnpm add -D @types/three
```

### Step 2: 新規ファイルのコピー
`D:\Documents\marimo - m` から `D:\Documents\marimo` へコピー：

```
frontend/src/core/three/              （フォルダ全体）
  ├── cell-3d-positions.ts
  ├── cell-3d-view.ts
  ├── grid-css2d-service.ts
  ├── scene-manager.ts
  └── viewport-sync.ts

frontend/src/components/editor/renderers/
  ├── grid-3d-renderer.tsx
  ├── cell-3d-renderer.tsx
  ├── cell-flow-node.tsx
  ├── cell-3d-wrapper.css
  └── grid-layout/edit-grid-layout.tsx
```

### Step 3: widths.ts の修正
```typescript
// frontend/src/core/config/widths.ts
export function getAppWidths() {
  return ["compact", "medium", "full", "columns", "grid"] as const;
}
```

### Step 4: mode.ts の修正
`is3DModeAtom` を追加：
```typescript
export const is3DModeAtom = atom<boolean>(true);

function setIs3DMode(value: boolean) {
  store.set(is3DModeAtom, value);
}
repl(setIs3DMode, "setIs3DMode");
```

### Step 5: types.ts の修正
`SerializedGridLayoutCell` に `position3D` フィールド追加：
```typescript
export interface SerializedGridLayoutCell {
  // ... 既存フィールド

  /**
   * The cell's 3D position for 3D mode.
   */
  position3D?: { x: number; y: number; z: number };
}
```

### Step 6: plugin.tsx の修正
validator に `position3D` を追加：
```typescript
cells: z.array(
  z.object({
    position: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
    scrollable: z.boolean().optional(),
    alignment: z.enum(["top", "bottom", "left", "right"]).optional(),
    position3D: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),  // 追加
  }),
),
```

### Step 7: cell-array.tsx の修正
`AddCellButtons` を export する：
```typescript
// 変更前
const AddCellButtons: React.FC<{

// 変更後
export const AddCellButtons: React.FC<{
```

### Step 8: edit-app.tsx の修正
main ブランチの実装を参考に：
- Three.js関連のインポート追加
- 3Dモード状態管理追加（`is3DModeAtom`, `threeDContainerRef`, `sceneManagerRef`, `css2DServiceRef`）
- SceneManager/GridCSS2DService の初期化
- Grid3DRenderer/Cell3DRenderer の描画
- appConfig.width === "grid" による自動切り替え

---

## 検証手順

1. **ビルド確認**
   ```bash
   cd D:\Documents\marimo\frontend && pnpm build
   ```

2. **型チェック**
   ```bash
   pnpm typecheck
   ```

3. **開発サーバー起動**
   ```bash
   pnpm dev
   ```

4. **動作確認**
   - Notebookを開き、App Configで `width: "grid"` を選択
   - セルが3Dフローティングウィンドウとして表示されることを確認
   - セルをドラッグして移動できることを確認
   - セル間の依存関係エッジが表示されることを確認
   - パン/ズーム操作が動作することを確認
   - ページリロード後に位置が復元されることを確認

---

## 注意事項
- `reactflow` は既にインストール済み
- `react-grid-layout` も既にインストール済み
- 3Dモードは edit モードでのみ有効（present/read モードでは無効）
- **Tauri と Electron の差異に注意**（ファイルシステムアクセス等）
