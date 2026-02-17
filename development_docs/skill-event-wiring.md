# スキルイベントのフロントエンド接続

**ステータス**: 完了

## バグ

`bt.buy()` を実行してもスキルツリーの「初めての購入」(SANDBOX_002) が解除されない。

## 根本原因

Python 側の `emit_skill()` は `<marimo-broadcast>` DOM 要素を正しく生成するが、フロントエンド側のリスナーが **どのコンポーネントにもマウントされていない**。

- `setupSkillEventListener()` — BroadcastChannel リスナー
- `setupMarimoBroadcastObserver()` — MutationObserver フォールバック

両方とも `skill-complete-handler.ts` で定義・エクスポート済みだが、アプリケーション内のどの React コンポーネントからも呼ばれていない。

## 修正内容

1. 適切な React コンポーネント（例: `SkillTree` や アプリのルート付近）で `useEffect` を使い `setupSkillEventListener` + `setupMarimoBroadcastObserver` を起動
2. コールバック `onSkillComplete` 内で `store.set(completeSkillWithRewardAtom, skillId)` を呼ぶ
3. クリーンアップ関数で両リスナーを解除

## イベントフロー（期待動作）

```
Python: emit_skill("SANDBOX_002")
  → mo.output.append(<marimo-broadcast payload="..." />)
  → DOM に要素追加

Frontend: MutationObserver が <marimo-broadcast> を検出
  → Base64 デコード → JSON パース → skill_id 抽出
  → completeSkillWithRewardAtom(skillId) 呼び出し
  → playerProgressAtom 更新 → UI に反映
```

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | リスナー定義（未接続だった） |
| `frontend/src/components/skill-tree/atoms.ts` | `completeSkillWithRewardAtom` |
| `frontend/src/components/skill-tree/skill-tree.tsx` | SkillTree コンポーネント（マウント先） |
| `frontend/public/files/skill_events.py` | Python 側 `emit_skill()` |
| `frontend/public/files/game_setup.py` | `buy()` 等のトリガー関数 |
