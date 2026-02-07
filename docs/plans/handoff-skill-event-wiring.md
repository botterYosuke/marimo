# 引継ぎ: スキルイベントのフロントエンド接続

## バグ

`bt.buy()` を実行してもスキルツリーの「初めての購入」(SANDBOX_002) が解除されない。

## 根本原因

Python 側の `emit_skill()` は `<marimo-broadcast>` DOM 要素を正しく生成するが、
フロントエンド側のリスナーが **どのコンポーネントにもマウントされていない**。

- `setupSkillEventListener()` — BroadcastChannel リスナー
- `setupMarimoBroadcastObserver()` — MutationObserver フォールバック

両方とも `skill-complete-handler.ts` で定義・エクスポート済みだが、
アプリケーション内のどの React コンポーネントからも呼ばれていない。

## やること

1. 適切な React コンポーネント（例: `SkillTree` や アプリのルート付近）で
   `useEffect` を使い `setupSkillEventListener` + `setupMarimoBroadcastObserver` を起動する
2. コールバック `onSkillComplete` 内で `store.set(completeSkillWithRewardAtom, skillId)` を呼ぶ
3. クリーンアップ関数で両リスナーを解除する
4. 実際にノートブック上で `bt.buy()` → SANDBOX_002 解除を確認する

## 参照ドキュメント

- `docs/plans/skill-tree-v4-improvement.md` — 全体設計とスキルトリガーマップ
- `docs/plans/tidy-toasting-sunset.md` — Python 側テスト計画（32件 PASS 済み）

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | リスナー定義（未接続） |
| `frontend/src/components/skill-tree/atoms.ts` | `completeSkillWithRewardAtom` |
| `frontend/src/components/skill-tree/skill-tree.tsx` | SkillTree コンポーネント（マウント候補） |
| `frontend/public/files/skill_events.py` | Python 側 `emit_skill()` |
| `frontend/public/files/game_setup.py` | `buy()` 等のトリガー関数 |

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

## テスト

```bash
# Python 側トリガーテスト（32件 PASS 済み）
.venv/Scripts/python.exe -m pytest tests/gamification/ -v

# フロントエンド既存テスト（365件 PASS 済み）
cd frontend && pnpm test src/components/skill-tree/
```
