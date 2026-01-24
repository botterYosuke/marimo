# チャート・チカチカ問題 - 作業引継ぎ v2

## 問題
marimoノートブックで100msごとにセルが再実行されると、anywidgetチャートがチカチカする。

## 現状
- **チカチカは解消** ✅
- **チャートが更新されない** ❌

## 実施済みの修正

### Python側
1. `marimo/_plugins/ui/_core/ui_element.py:213` - `_random_id`の事前設定を許可
2. `marimo/_plugins/ui/_impl/from_anywidget.py:234` - `js_hash`を`_random_id`として使用

### Frontend側
1. `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx:312` - useEffect依存を`jsUrl`から`jsHash`に変更
2. 値変更時に`render()`を再呼び出し（`clearElement=false`）

## 現在の問題

ログ（`browser.devtool.log`）より：
- モデルは`change:options/data/markers`イベントを発火している
- `render()`は`clearElement=false`で呼ばれている
- しかしチャートが更新されない

**推測**: ウィジェットの`render()`が空でない要素に対して何も描画しない、または追記している可能性。

## 次のステップ候補

1. **ウィジェット固有の更新メカニズム調査**
   - 使用ウィジェット（おそらくlightweight-charts系）のソースを確認
   - `render()`が空要素を期待しているか確認

2. **要素の子要素だけクリア**
   ```typescript
   // 完全クリアではなく、特定の子要素のみ操作
   el.replaceChildren(); // または el.firstChild?.remove()
   ```

3. **ウィジェットのupdate/refreshメソッド呼び出し**
   - anywidgetに`update`や`refresh`メソッドがあれば呼び出す

## テスト用ファイル
- `C:\Users\sasai\AppData\Local\Temp\fintech1.py`

## 参照ドキュメント
- `chart-flickering-analysis.md` - 根本原因分析
- `chart-flickering-fix-plan.md` - 修正プラン一覧
- `chart-flickering-handoff.md` - 前回の引継ぎ
