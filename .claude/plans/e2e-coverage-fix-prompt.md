# ゲーム E2E テスト改善 — 作業依頼

## 目的

ゲーム E2E テストが本番パイプラインを実際に通すようにし、弱いアサーションを修正する。

## 計画書

`.claude/plans/refactored-discovering-map.md` に全 6 Step の詳細計画がある。**必ず先に読んでから作業を開始すること。**

## 現在の進捗

- **Step 1: 完了済み** — `frontend/src/components/skill-tree/skill-complete-handler.ts` に `__testInjectBroadcastHTML` フックを追加済み。`extractAndSendBroadcastMessages` の import と、`setupSkillEventListener()` 内へのフック登録・cleanup 追加が完了している。
- **Step 2〜6: 未着手**

## 未解決の問題

Step 1 追加後にユニットテスト `skill-complete-handler.test.ts` で 3 件失敗した（8 passed / 3 failed）。BroadcastChannel モック関連のテストがタイムアウトしている。新しい import (`extractAndSendBroadcastMessages from "@/core/kernel/handlers"`) がモジュールリセット（`vi.resetModules()` + 動的 `import()`）と干渉している可能性がある。**この問題を最優先で調査・修正してから Step 2 に進むこと。**

## 作業手順

1. 上記のユニットテスト失敗を修正する
2. 計画書の Step 2〜6 を順に実施する
3. 各 Step 完了後に Playwright テストを実行して動作確認する
4. **Step 3 の `integration.spec.ts` で BroadcastChannel の同一コンテキスト配信が動作するか検証する。動作しない場合は計画書のフォールバック案を適用する**

## テスト実行コマンド

```bash
# ユニットテスト
cd frontend && pnpm test src/components/skill-tree/__tests__/skill-complete-handler.test.ts

# E2E テスト（ゲーム全スイート）
cd frontend && npx playwright test e2e-tests/game/

# E2E テスト（特定スイート）
cd frontend && npx playwright test e2e-tests/game/integration.spec.ts --headed
```

## 重要ルール

- 進捗があり次第、計画書 `.claude/plans/refactored-discovering-map.md` に状況、新たな知見、設計思想と背景、Tips など他の作業者に必要な情報を書き込んでください。完了した作業項目には ✅ を付けて進捗を共有してください。
- E2E テストは `/game-e2e` スキルで実行できる（`sandbox.spec.ts` を実行し、失敗時は知見ドキュメントを参照して自動修正）
- 既存の知見ドキュメント `development_docs/game-e2e-review-system.md` に 22 件の知見が蓄積されている。テスト実行で問題が起きたら参照すること
