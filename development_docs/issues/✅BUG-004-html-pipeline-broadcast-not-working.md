# BUG-004: HTML パイプライン経由のスキル完了が反映されない（integration.spec.ts 全面失敗）

**優先度**: Critical
**発見元**: play-log-2026-02-21.md
**テスト**: frontend/e2e-tests/game/integration.spec.ts (5件失敗)
**ステータス**: ✅ 修正済み

## 再現手順
1. `npx playwright test e2e-tests/game/integration.spec.ts --headed` を実行する
2. 以下の 5 テストが全て失敗する:
   - L54: "HTML 注入でスキルが完了する"
   - L63: "前提条件チェーンが HTML 経由でも動作する"
   - L75: "進捗バッジが HTML 経由でも更新される"
   - L104: "重複発火が防止される"
   - L180: "HTML 経由の 6 スキル連続完了でブリッジトラックが解放される"

## 期待動作
- `__testInjectBroadcastHTML` フック経由で HTML を注入すると、以下の経路でスキルが完了する:
  - HTML パース (`extractAndSendBroadcastMessages`) -> BroadcastChannel 送信 (`sendBroadcastMessage`) -> リスナー受信 -> atom 更新 -> UI 反映
- `waitForSkillStatus(page, "SANDBOX_001", "completed")` が成功する

## 実際の動作
- 全テストで `Expected "completed" but received "unlocked"`
- HTML 注入後もスキルのステータスが `"unlocked"` のまま変化しない
- レイヤー 3→7 の経路のどこかでイベントが途絶えている

## 原因推定

### 仮説 1: `__testInjectBroadcastHTML` フックが未登録または変更された
`SkillTreeButton` コンポーネントのマウント時に `window.__testInjectBroadcastHTML` が登録されるはずだが、コンポーネントの構造変更やマウントタイミングの変更で登録されていない可能性。ただし、フックが見つからない場合は `throw new Error("__testInjectBroadcastHTML not found")` で即座にエラーになるため、フック自体は存在している可能性が高い。

### 仮説 2: `extractAndSendBroadcastMessages` のパース処理の変更
HTML 内の `<marimo-broadcast>` タグのパース処理が変更され、`channel`, `type`, `payload` 属性の読み取りに失敗している可能性。

### 仮説 3: BroadcastChannel のコンテキスト不一致
テストページと BroadcastChannel リスナーが異なるコンテキスト（iframe, worker 等）で動作しており、メッセージが配信されない。`sandbox.spec.ts` の `__testCompleteSkill`（レイヤー 6→7 のみ）は正常に動作しているため、問題はレイヤー 3→5（HTML パース → BroadcastChannel 送信 → リスナー受信）にある。

### 仮説 4: `resetGameProgress` の影響
`beforeEach` で `resetGameProgress` を実行した後、BroadcastChannel リスナーが再登録されていない可能性。

## 影響範囲
- integration.spec.ts の 9 テスト中 5 テストが失敗（通過しているのは「不正 base64 でクラッシュしない」等のネガティブテスト）
- HTML パイプラインはカーネルからのセル出力をフロントエンドで受信する主要経路であり、この経路が壊れるとリアルタイムのスキル完了通知が機能しない
- `sandbox.spec.ts`（`__testCompleteSkill` 経由）は全テスト通過のため、atom → UI の経路は正常

## 調査手順
1. ブラウザコンソールで `__testInjectBroadcastHTML` 呼び出し後のログを確認する
2. `extractAndSendBroadcastMessages` が呼ばれているか、パースが成功しているか確認する
3. BroadcastChannel にメッセージが送信されているか `postMessage` の呼び出しを確認する
4. BroadcastChannel リスナー側でメッセージを受信しているか確認する
5. `sandbox.spec.ts` の `__testCompleteSkill` と比較して、経路の違いを特定する

## 関連ファイル
| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/integration.spec.ts` | 全体 — 5 テスト失敗 |
| `frontend/e2e-tests/game/helpers.ts` | `emitSkillEventViaHTML` L237-261 — HTML 注入ヘルパー |
| フロントエンドの SkillTreeButton | `__testInjectBroadcastHTML` フック登録 |
| フロントエンドの broadcast 処理 | `extractAndSendBroadcastMessages` — HTML パース |
| フロントエンドの broadcast 処理 | `sendBroadcastMessage` — BroadcastChannel 送信 |
| フロントエンドのスキルイベントリスナー | BroadcastChannel 受信 → atom 更新 |
