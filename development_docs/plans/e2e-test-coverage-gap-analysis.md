# E2E テストカバレッジギャップ分析

**作成日**: 2026-02-19
**対象**: `frontend/e2e-tests/game/sandbox.spec.ts` および案 E（テストフック方式）
**結論**: 現在の案 E は「ユーザーの行動の再現」ではなく「フロントエンド状態管理の回帰テスト」である

---

## 問題提起

`game-e2e-review-system.md` には以下の記述がある:

> テストしたいのは「イベントが届いたときに UI が正しく更新されるか」であり、atom の状態ではない

しかし案 E（`window.__testCompleteSkill` 直接呼び出し）が実際にテストしているのは「`onSkillComplete` コールバックが呼ばれたときに UI が正しく更新されるか」であり、「イベントが届いたとき」ではない。イベントが届く経路そのものがテストから除外されている。

---

## 本番フローの全体像（7 レイヤー）

```
① Python emit_skill("SANDBOX_001")
    ↓ HTML <marimo-broadcast> 要素を生成 + base64 エンコード
② WebSocket でフロントエンドに転送
    ↓ marimo カーネルのセル出力として送信
③ handlers.ts extractAndSendBroadcastMessages() が HTML を正規表現でパース
    ↓ base64 デコード → JSON
④ BroadcastChannel.postMessage() で送信
    ↓ クロスコンテキスト通信
⑤ skill-complete-handler.ts の BroadcastChannel リスナーが受信
    ↓ msg.type === "skill_complete" && msg.data.skill_id を検証
⑥ completeSkillWithRewardAtom（Jotai atom 更新）
    ↓ 前提条件チェック → 報酬計算 → 進捗更新
⑦ React 再レンダリング → DOM 更新 → UI 反映
```

## 案 E がテストする範囲

| レイヤー | 内容 | テストされる？ | 所在ファイル |
|---|---|---|---|
| ① Python `emit_skill()` | HTML 生成・base64 エンコード | **スキップ** | `src-tauri/resources/files/skill_events.py` |
| ② WebSocket 転送 | Python → Frontend の通信 | **スキップ** | marimo コア (`_server/`) |
| ③ HTML パース | 正規表現で `<marimo-broadcast>` を抽出 | **スキップ** | `frontend/src/core/kernel/handlers.ts` |
| ④ BroadcastChannel 送信 | `postMessage()` + クロスタブ通信 | **スキップ** | `frontend/src/core/kernel/broadcastChannel.ts` |
| ⑤ リスナー受信・メッセージ検証 | `type`/`skill_id` の検証ロジック | **スキップ** | `skill-complete-handler.ts` |
| ⑥ Jotai atom 更新 | 前提条件・報酬計算・進捗管理 | **テストされる** | `atoms.ts` |
| ⑦ React UI 反映 | ノード状態・バッジ・現金表示 | **テストされる** | `skill-node.tsx`, `skill-tree-button.tsx` |

**テストフックと BroadcastChannel リスナーは同じ `onSkillComplete` コールバックを共有**しているため、⑥⑦は確実にテストされる。しかし①〜⑤は完全にバイパスされる。

---

## 案 E が検出できないバグの具体例

### 1. Python 側の条件分岐ロジックの誤り

`game_setup.py` では `emit_skill()` が条件付きで呼ばれている:

```python
# 例: 含み損発生時に FAIL_001 を発火
emit_skill("FAIL_001")

# 例: チャート表示後に SANDBOX_005 を発火
emit_skill("SANDBOX_005")
```

「ユーザーが特定の操作をしたときに正しいスキルイベントが発火されるか」という判定ロジック自体がテスト範囲外。

### 2. HTML 生成・パースの不一致

`skill_events.py` の `emit_skill()` が生成する `<marimo-broadcast>` の attribute 名と、`handlers.ts` の正規表現パーサーが期待する attribute 名が乖離した場合、案 E では検出不可。

### 3. BroadcastChannel メッセージ形式の不一致

`skill_events.py` が `skill_id`（snake_case）で送信し、`skill-complete-handler.ts` が `msg.data.skill_id` で検証する。どちらかが `skillId`（camelCase）に変更された場合、⑤のリスナーで無視されるが、案 E は⑤を通らないので気づけない。

### 4. WebSocket シリアライズの問題

セル出力に `<marimo-broadcast>` が含まれなくなった場合（例: marimo コアの出力フォーマット変更）、案 E では検出不可。

---

## 現状の評価

### 案 E の強み（現実的な価値）

- ①〜④は Web 標準 API + marimo コア機能であり、ゲーム固有のロジックではない
- 最もバグが混入しやすい⑥（前提条件ロジック、報酬計算）と⑦（UI 反映）はカバーされている
- 59 スキル × 複雑な前提条件グラフの回帰テストとして十分に実用的
- Backcast エンジンや統合テスト環境なしで CI 実行可能

### 案 E の限界（正直な評価）

- 「ユーザーの行動を再現する E2E テスト」ではなく「フロントエンド状態管理の回帰テスト」
- Python → WebSocket → HTML パース → BroadcastChannel の経路は未テスト
- `emit_skill()` の発火条件ロジックは完全にテスト範囲外

---

## カバレッジを拡大するための選択肢

### 選択肢 1: ①〜⑤をユニットテストで個別にカバー

案 E はそのまま維持し、スキップしているレイヤーを個別にテストする。

| レイヤー | テスト方法 | コスト |
|---|---|---|
| ① `emit_skill()` | Python ユニットテスト: 出力 HTML が正しい形式か検証 | 低 |
| ③ HTML パース | TypeScript ユニットテスト: `extractAndSendBroadcastMessages()` に固定 HTML を渡してパース結果を検証 | 低 |
| ⑤ メッセージ検証 | TypeScript ユニットテスト: `setupSkillEventListener` のコールバックが正しい形式のメッセージで発火されるか検証 | 低 |
| ②④ WebSocket / BroadcastChannel | Web 標準 API なのでテスト不要 | — |

**メリット**: 案 E の高速さを維持しつつ、各レイヤーの契約を個別に保証できる
**デメリット**: レイヤー間の結合テストにはならない

### 選択肢 2: 案 A（Python セル実行）を限定的に追加

Backcast エンジン環境でのみ実行する統合テストを別 describe で追加:

```typescript
test.describe("統合テスト（Backcast 環境必須）", () => {
  test.skip(!process.env.BACKCAST_INSTALLED, "Backcast が必要");
  // Python セルを実行 → emit_skill() → WebSocket → UI 更新の全経路をテスト
});
```

**メリット**: ①〜⑦の全経路をテスト（真の E2E）
**デメリット**: CI 環境構築が重い、Backcast エンジン依存

### 選択肢 3: ③〜⑦をカバーする中間案

Python セルの代わりに、テストから直接 `<marimo-broadcast>` HTML をセル出力に注入し、③以降の経路をテスト:

```typescript
// page.evaluate() でセル出力領域に <marimo-broadcast> を挿入
// → handlers.ts がパース → BroadcastChannel → リスナー → atom → UI
```

**メリット**: Python/Backcast 不要で③〜⑦をカバー
**デメリット**: `handlers.ts` の呼び出し方法の調査が必要

---

## 推奨アクション

1. **ドキュメントの表現を修正**: 「ユーザーの行動を再現する」→「フロントエンド状態管理の回帰テスト」と明記
2. ✅ **選択肢 1 を優先実施**: コスト最小でカバレッジギャップを埋められる → **完了（2026-02-19）**
3. **選択肢 3 を検討**: ③〜⑦の結合テストとして実現可能性を調査
4. **選択肢 2 は後回し**: Backcast 環境の CI 構築後に検討

---

## 選択肢 1 実施記録（2026-02-19）

### 作成したテストファイル

| レイヤー | テストファイル | テスト数 | 結果 |
|---|---|---|---|
| ① `emit_skill()` | `src-tauri/resources/files/test_skill_events.py` | 12 | ✅ All passed |
| ③ HTML パース | `frontend/src/core/kernel/__tests__/extractBroadcast.test.ts` | 10 | ✅ All passed |
| ⑤ メッセージ検証 | `frontend/src/components/skill-tree/__tests__/skill-complete-handler.test.ts` | 11 | ✅ All passed |

### 実装上の知見

#### Python テスト (`test_skill_events.py`)

- **モジュール隔離**: `emit_skill()` は `_triggered_skills` というモジュールレベルグローバル `set` で重複防止するため、テストごとに `sys.modules.pop("skill_events", None)` でリロードが必要
- **Html オブジェクト**: `marimo._output.hypertext.Html` は `str()` で HTML を返さない。`.text` プロパティを使う必要がある
- **契約テスト**: `handlers.ts` の正規表現パターン（`/<marimo-broadcast([^>]*)>/gi` + 各属性の `/"([^"]+)"/`）と同じパターンで Python 出力を検証し、両言語間の形式一致を保証
- **テスト実行**: `uvx hatch run +py=3.12 test:test src-tauri/resources/files/test_skill_events.py -v`

#### TypeScript パーステスト (`extractBroadcast.test.ts`)

- **export 変更**: `extractAndSendBroadcastMessages` は元々非公開関数だったが、テストのために `export` を追加（`handlers.ts` L232）
- **モック対象**: `@/utils/broadcastChannel` の `sendBroadcastMessage` をモックし、パース結果（channel, type, payload）をキャプチャ
- **Pattern 1 / Pattern 2**: `handlers.ts` は2つのパース戦略を持つ（`<marimo-broadcast>` タグ方式と `data-marimo-broadcast` 属性方式）。`emit_skill()` は Pattern 1 を使用
- **テスト実行**: `cd frontend && pnpm test src/core/kernel/__tests__/extractBroadcast.test.ts`

#### TypeScript リスナーテスト (`skill-complete-handler.test.ts`)

- **BroadcastChannel モック**: jsdom は `BroadcastChannel` を標準サポートしないため、`MockBroadcastChannel` クラスを作成。`_simulateMessage()` メソッドで `MessageEvent` を発火
- **動的インポート**: `vi.resetModules()` + `await import()` でモック適用後のモジュールを取得
- **メッセージ形式の検証ポイント**: `msg.type === "skill_complete"` と `msg.data.skill_id` の両方が必須。`skill_id` (snake_case) であることが重要（camelCase `skillId` では動かない）
- **テスト実行**: `cd frontend && pnpm test src/components/skill-tree/__tests__/skill-complete-handler.test.ts`

### 設計思想

各テストは**契約テスト（Contract Test）**のアプローチを採用している。レイヤー間の通信プロトコル（HTML 属性名、JSON キー名、BroadcastChannel チャネル名）が両端で一致することを検証する。これにより、一方のレイヤーでフォーマットが変更された場合にテストが失敗して検知できる。

### カバレッジ状況の更新

| レイヤー | 内容 | テストされる？ | テスト種別 |
|---|---|---|---|
| ① Python `emit_skill()` | HTML 生成・base64 エンコード | ✅ **テスト済** | Python ユニットテスト |
| ② WebSocket 転送 | Python → Frontend の通信 | スキップ（Web 標準 API） | — |
| ③ HTML パース | 正規表現で抽出 | ✅ **テスト済** | TypeScript ユニットテスト |
| ④ BroadcastChannel 送信 | `postMessage()` | スキップ（Web 標準 API） | — |
| ⑤ リスナー受信・検証 | `type`/`skill_id` の検証 | ✅ **テスト済** | TypeScript ユニットテスト |
| ⑥ Jotai atom 更新 | 前提条件・報酬計算 | ✅ テスト済 | E2E テスト（案 E: 全4スイート37件パス） |
| ⑦ React UI 反映 | DOM 更新 | ✅ テスト済 | E2E テスト（案 E: 全4スイート37件パス） |

### E2E テスト全スイート実行結果（2026-02-19）

| スイート | 結果 |
|---|---|
| `sandbox.spec.ts` | 10 passed (2.2m) |
| `ui.spec.ts` | 9 passed / 3 skipped (1.9m) |
| `persistence.spec.ts` | 8 passed (1.7m) |
| `bridge.spec.ts` | 10 passed (2.3m) |
