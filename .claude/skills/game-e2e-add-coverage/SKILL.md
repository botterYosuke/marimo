---
name: game-e2e-add-coverage
description: "E2E カバレッジ追加: development_docs/issues/ の未カバー Issue を発見し、E2E テストを実装・実行する"
allowed-tools:
  - Bash(cd d:/Documents/marimo/frontend && npx playwright test*)
  - Bash(cd d:/Documents/marimo/frontend && pnpm turbo build*)
  - Bash(cp -R d:/Documents/marimo/frontend/dist/* d:/Documents/marimo/marimo/_static/*)
  - Bash(taskkill*)
  - Bash(ls*)
  - Bash(git*)
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Task
---

# E2E カバレッジ追加スキル

## 役割

`development_docs/issues/` の未解決 Issue のうち、E2E テストでカバーされていないものを特定し、
テストケースを実装・実行・検証する。

---

## 参照ドキュメント（最初に必ず読むこと）

- `development_docs/game/game-e2e-review-system.md` — 知見 1〜43、制約、セレクター一覧
- `frontend/e2e-tests/game/helpers.ts` — 共通ヘルパー関数
- `frontend/e2e-tests/game/constants.ts` — 共通定数

---

## 実行フロー

### Phase 1: 未カバー Issue の特定

#### Step 1.1: 未解決 Issue をリストアップ

```bash
ls development_docs/issues/ | grep -v "^✅"
```

`✅` なし = 未解決（修正済みでない）Issue。各ファイルの内容を Read で確認し、
以下を抽出する:

- **ファイル名**
- **重要度**（Critical / High / Medium / Low）
- **カテゴリ**（`テストカバレッジ` を含むものを優先）
- **概要**（何が未カバーか）

#### Step 1.2: 既存 E2E テストのカバレッジ確認

以下のスペックファイルの describe/test 名を確認し、Issue の内容に対応するテストが存在するか確認する:

```bash
ls frontend/e2e-tests/game/*.spec.ts
```

各スペックの test 名を Grep で抽出:

```bash
grep -n "test(" frontend/e2e-tests/game/*.spec.ts | grep -v "test.describe"
```

#### Step 1.3: 未カバーリストの確定

以下の基準で「未カバー」と判定する:

- Issue の「再現シナリオ」や「期待される動作」に対応する test ケースが存在しない
- Issue の「対象ファイル」が実装されているが、その挙動を検証するテストがない
- `e2e-test-missing-` プレフィックスの Issue ファイルは原則すべて未カバー

---

### Phase 2: テスト実装

#### Step 2.1: 知見ドキュメントと既存テストパターンの確認

実装前に必ず以下を読む:

1. `development_docs/game/game-e2e-review-system.md`（制約・知見）
2. 最も類似した既存スペック（例: `sandbox.spec.ts`、`persistence.spec.ts`）
3. `frontend/e2e-tests/game/helpers.ts`（利用可能なヘルパー）

重要制約のチェックリスト（実装前に確認）:

- [ ] `waitForLoadState("networkidle")` を使っていない → `"load"` を使う（知見 35a）
- [ ] `waitForTimeout` の乱用がない → `expect().toPass()` 状態ベース待機を使う（知見 29）
- [ ] `beforeEach` で `ensureConnected()` + `resetGameProgress()` を呼ぶ（知見 19・35b）
- [ ] `page.reload()` を通常テストで使っていない（知見 35c）
- [ ] スキル完了後の `__testSuppressProgressSync` 設定を確認（知見 39）

#### Step 2.2: テストケースの実装

各 Issue に対して以下を判断する:

**追加先スペックの選定基準**:

| Issue の性質 | 追加先スペック |
|---|---|
| スキル発火・前提条件チェーン | `sandbox.spec.ts` または対象スキルのスペック |
| Python セル実行経由のスキル | `z-python-e2e.spec.ts` |
| UI 表示・ラベル・バッジ | `ui.spec.ts` または `backcast-integration.spec.ts` |
| 進捗リセット・BroadcastChannel | `persistence.spec.ts` |
| ゲームプレイフロー（buy/sell/step） | `backcast-integration.spec.ts` |
| 新規スキルトラック | 新規スペックファイル作成 |

**テストケースのテンプレート**:

```typescript
test("<Issue の期待される動作を説明する名前>", async ({ page }) => {
  // Arrange: 前提条件をセットアップ
  // （必要なスキルを完了させる等）

  // Act: 対象の操作を実行

  // Assert: 期待される結果を確認
  // waitForSkillStatus / expect().toPass() を使う
});
```

#### Step 2.3: ビルドとテスト実行

テストを追加したら必ずビルドして反映させる:

```bash
cd d:/Documents/marimo/frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/
```

次に、追加したテストを含むスペックを実行:

```bash
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/<spec-file>.spec.ts --headed
```

#### Step 2.4: 失敗時のデバッグ

テストが失敗した場合:

1. エラーメッセージを読む
2. `development_docs/game/game-e2e-review-system.md` の知見と照合
3. `frontend/test-results/` のスナップショットを確認
4. 修正 → ビルド → 再テストを最大 3 回繰り返す
5. 3 回失敗後は Issue に「実装試行中（ブロッカー: <理由>）」を追記して次へ

---

### Phase 3: Issue ステータス更新

テストが通過したら Issue ファイルを更新する:

#### テストが通過した場合

Issue ファイルに以下を追記:

```markdown
## E2E テスト追加

**追加日**: YYYY-MM-DD
**追加先**: `frontend/e2e-tests/game/<spec-file>.spec.ts`
**テスト名**: "<追加したテスト名>"
**テスト結果**: ✅ passed

<追加したテストの説明>
```

Issue のステータスを `⬜ 未対応` → `✅ テスト追加済み` に変更する。

ファイル名の先頭に `✅` を付けてリネーム:

```bash
# 例
mv development_docs/issues/e2e-test-missing-fail002-skill.md \
   "development_docs/issues/✅e2e-test-missing-fail002-skill.md"
```

#### テストが失敗した場合（ブロッカー）

Issue ファイルに以下を追記:

```markdown
## 実装試行記録

**試行日**: YYYY-MM-DD
**ブロッカー**: <理由>
**試行内容**: <何を試みたか>
**推奨**: <次のアクション>
```

ステータスは `⬜ 未対応` のままにする。

---

### Phase 4: サマリー出力

全 Issue の処理が完了したらサマリーを出力:

```markdown
# E2E カバレッジ追加 完了レポート

**実行日**: YYYY-MM-DD

## 処理結果

| Issue | 重要度 | 結果 | 追加先スペック | テスト名 |
|-------|--------|------|--------------|---------|
| e2e-test-missing-fail002-skill | High | ✅ 追加済み | z-python-e2e.spec.ts | FAIL_002: step() で損切り判定が発火する |
| e2e-test-missing-step-end-hud-status | Medium | ✅ 追加済み | backcast-integration.spec.ts | ゲーム終了後に HUD ステータスが Finished になる |
| ... | | | | |

## テスト実行結果

<追加後のテスト実行結果を貼り付ける>

## 残課題

（テスト追加できなかった Issue があれば記載）
```

---

## 重要な制約（実装時に必ず守ること）

- `waitForLoadState("networkidle")` は使わない → `"load"` を使う（知見 35a）
- `waitForTimeout` は最小限に → `expect().toPass()` を使う（知見 29）
- 通常テストで `page.reload()` を使わない（知見 35c）
- `ensureConnected()` の後は必ず `resetGameProgress()` を呼ぶ（知見 35b）
- `__testSuppressProgressSync` フラグを確認する（知見 39）
- `z-python-e2e.spec.ts` の前提条件チェーンには中間確認が必須（知見 40）
- `game_test.py` への Python セル追加は `global-teardown.ts` が復元する（知見 40）
- Windows 環境: `make` は使えない。`pnpm turbo build` + `cp -R` で代替（知見 18）

---

## Tips

### `e2e-test-missing-` プレフィックス Issue の扱い

`e2e-test-missing-*.md` という名前の Issue はすべて「E2E テストが存在しない」という Issue。
これらを最優先で処理する。

### data-testid が存在しない場合

Issue の「実装案」にある `data-testid` がソースに存在しない場合は、
先に該当コンポーネントに `data-testid` を追加してからビルドする。
変更ファイルは Edit ツールで修正し、ビルドして反映させる。

### 新規スペックファイルの作成

既存スペックのどれにも適さない場合は新規作成する。
ファイル名は `<track>.spec.ts` の形式（例: `fail.spec.ts`）。
ファイルの冒頭は必ず以下のパターンで始める:

```typescript
import { test, expect } from "@playwright/test";
import {
  ensureConnected,
  resetGameProgress,
  openSkillTreePanel,
  waitForSkillStatus,
} from "./helpers";

test.describe("<トラック名>", () => {
  test.beforeEach(async ({ page }) => {
    await ensureConnected(page);
    await resetGameProgress(page);
  });
  // ...
});
```
