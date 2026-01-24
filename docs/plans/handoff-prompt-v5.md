# anywidget チャート問題 - 引き継ぎプロンプト

## 状況

marimoノートブックでanywidget（lightweight-charts）を100msごとに更新すると、以下の問題が発生：

1. ~~チカチカする~~ → 解決済み
2. **チャートが更新されない** → 再発（今回の修正で壊れた）
3. ~~コンソールエラー~~ → 解決したが、2を壊した

## 直前の修正（これが原因）

`disposed`フラグとDOM存在チェックを追加したら、エラーは消えたがチャート更新も止まった。

**変更ファイル:**
- `frontend/src/plugins/impl/anywidget/model.ts` - `disposed`フラグ追加
- `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` - `document.contains()`チェック追加

## 参照ドキュメント

以下のファイルに詳細な調査結果・試行錯誤の記録あり：
- `docs/plans/chart-flickering-handoff-v4.md` - 最新の状況
- `docs/plans/chart-flickering-handoff-v3.md`
- `docs/plans/chart-flickering-handoff-v2.md`
- `docs/plans/chart-flickering-handoff.md`

## 課題

**両立が必要:**
1. チャートが正常に更新される（データ変更時にsetDataが呼ばれる）
2. "Object is disposed"エラーが出ない（アンマウント後のsetData呼び出しを防ぐ）

## 検証方法

```bash
# サーバー起動
marimo edit fintech1.py

# ブラウザで http://localhost:3000/?file=fintech1.py を開く
# チャートが100msごとに更新されることを確認
# コンソールにエラーが出ないことを確認
```

## ヒント

- `disposed`フラグや`document.contains()`チェックが厳しすぎる可能性
- 正常な更新時にも早期リターンしてしまっている
- lightweight-chartsの`requestAnimationFrame`タイミングとReactのアンマウントタイミングの競合
