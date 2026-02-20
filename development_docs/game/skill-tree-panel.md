# スキルツリーパネル

> **ステータス:** 実装完了 (2026-01-31)

## 概要

marimoの右フローティングボタン群に新しいボタンを追加し、クリックでダイアログを表示する機能。将来的にはゲームのようなスキルツリーUIとなり、実績解除でキャッシュや銘柄が増える仕組みを想定。

---

## 設計変更: サイドバーパネル → フローティングボタン＋ダイアログ

**変更理由:** スキルツリーは常時表示するパネルではなく、必要なときにだけ開くダイアログとして実装する方が適切。

| 方式 | 説明 |
|------|------|
| 変更前（左サイドバーパネル） | Files, Variables等と同じ左サイドバーに配置 |
| 変更後（フローティングボタン） | Save, Command palette等と同じ右下フローティングボタン群に配置 |

---

## 変更されたファイル

| ファイル | 操作 |
|---------|------|
| `frontend/src/components/editor/chrome/types.ts` | 編集（削除） |
| `frontend/src/components/editor/chrome/wrapper/app-chrome.tsx` | 編集（削除） |
| `frontend/src/components/editor/controls/skill-tree-button.tsx` | 新規作成 |
| `frontend/src/components/editor/controls/Controls.tsx` | 編集（追加） |
| `frontend/src/components/editor/chrome/panels/skill-tree-panel.tsx` | 維持 |

---

## 実装パターン

### CommandPaletteButtonパターン
右フローティングボタンの実装パターン:
- jotai atomで開閉状態を管理
- `Tooltip`でホバー説明
- `Button`（shape="rectangle", color="hint-green"）
- アイコンは`strokeWidth={1.5} size={18}`

### ダイアログパターン
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```
shadcn/ui Dialogを使用。`onOpenChange`で閉じる処理も自動化。

### 配置場所
`Controls.tsx`の`bottomRightControls`内、`CommandPaletteButton`と`KeyboardShortcuts`の間。

---

## 検証方法

```bash
cd D:\Documents\marimo\frontend
pnpm dev
```

1. ブラウザで http://localhost:2718 を開く
2. 右下のフローティングボタン群にTreePineアイコンが表示される
3. クリックでダイアログが開く

---

## 新たな知見・Tips

1. **アイコン名の規則:** lucide-react では `TreePineIcon` ではなく `TreePine` が正しい命名
2. **SIDEBAR_PANELS の型:** `Record<PanelType, React.ReactNode>` であり、JSX 要素として登録
3. **export 形式:** Linter が `export const` を `export default` に自動変換
4. **パネル順序:** `PANELS` 配列の順序が初期表示順に影響

---

## 今後の拡張

### Phase 2: スキルツリーUI実装
- React Flowまたは自作SVGでツリービジュアライゼーション
- ノードの状態管理（locked/unlocked/in-progress）
- プログレスバーとアニメーション

### Phase 3: BackcastPro連携
- BroadcastChannel APIで実績データ受信
- スキルアンロック時に報酬を送信
