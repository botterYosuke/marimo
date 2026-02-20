# Python セル実行 E2E テスト — 作業依頼

## 目的

レイヤー①→⑦（Python → WebSocket → HTML パース → BroadcastChannel → リスナー → atom → UI）の**全経路**を通す E2E テストを追加する。フロントエンド側のフック（`__testCompleteSkill`, `__testInjectBroadcastHTML`）を一切使わず、**実際に Python セルを実行して `mo.output.append()` 経由で HTML をフロントエンドに届ける**。

## 前提知識

### 現在のテスト方式（既に完了済み・変更不要）

| 方式 | フック | テスト範囲 | ファイル |
|------|--------|-----------|---------|
| 案 E | `__testCompleteSkill` | ⑥→⑦ | sandbox/ui/persistence/bridge.spec.ts |
| 案 F | `__testInjectBroadcastHTML` | ③→⑦ | integration.spec.ts |
| **案 G（今回）** | **なし（Python セル実行）** | **①→⑦** | **python-e2e.spec.ts（新規）** |

### 参照ドキュメント

- `development_docs/game-e2e-review-system.md` — 知見 1〜29、セレクター早見表、テスト実行方法
- `.claude/plans/refactored-discovering-map.md` — 前回の改善計画（Step 1〜6 全完了）

## 核心的な課題: `skill_events.py` の依存

`skill_events.py` は以下を import している:
```python
from progress_manager import load_progress, add_completed_skill
```

`progress_manager.py` は `marimo._runtime.context.get_context()` を呼び、ノートブックのファイルパスから進捗ファイルのパスを導出する。**テスト用ノートブック `game_test.py` にはこれらのファイルが Python パスに入っていない。**

### 解決策: インライン版 emit_skill

`skill_events.py` を import する代わりに、`progress_manager` 依存を除いた **最小限の emit_skill ロジックをセルに直接書く**:

```python
import base64, json, time, marimo as mo
from marimo._output.hypertext import Html

def _emit(skill_id):
    event = {"skill_id": skill_id, "context": {}, "timestamp": int(time.time() * 1000)}
    b64 = base64.b64encode(json.dumps(event).encode()).decode()
    html = f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{b64}" style="display:none;"></marimo-broadcast>'
    mo.output.append(Html(html))

_emit("SANDBOX_001")
```

これで `progress_manager` なしで ①（HTML 生成）→ ②（WebSocket 転送）→ ③以降 の全経路をテストできる。

**ただし本番の `emit_skill()` との差異に注意:**
- 重複防止（`_triggered_skills`）なし → テストごとにセルを新規作成するので問題ない
- `add_completed_skill()`（ファイル永続化）なし → フロントエンド側のテストなので不要
- `_check_graduations()`（卒業自動チェック）なし → フロントエンドの前提条件ロジックが担当

## 実装方針

### 新規ファイル: `frontend/e2e-tests/game/python-e2e.spec.ts`

`helpers.ts` の `runNewCell(page, code)` を使って Python セルを実行し、スキルツリー UI の変化を確認する。

### テストケース案（3〜5件で十分）

| # | テスト名 | 内容 |
|---|---------|------|
| 1 | Python セル実行で SANDBOX_001 が完了する | `runNewCell` → `_emit("SANDBOX_001")` → `waitForSkillStatus("completed")` |
| 2 | 2 つのセルで前提条件チェーンが動作する | セル 1: `_emit("SANDBOX_001")` → セル 2: `_emit("SANDBOX_002")` → 両方 completed |
| 3 | 不正な payload でも UI がクラッシュしない | `mo.output.append(Html('<marimo-broadcast ...invalid...>'))` → UI 正常 |
| 4 | 進捗バッジが Python 経由でも更新される | セル実行後に `getCompletedCount()` が増加 |

### 重要な注意点

1. **セル実行は遅い**: `runNewCell` はセル追加 → コード入力 → 実行 → 完了待機で 5〜10 秒かかる。テストケースは最小限にする
2. **セルの蓄積**: テストごとにセルが増える。`afterEach` で追加したセルを削除するか、テスト間で `page.reload()` を使う（WebSocket 再接続のコストあり — 知見 16, 19, 20 参照）
3. **`runNewCell` の `.catch()`**: L398 に `waitFor('detached').catch(() => {})` がある。セル実行完了の検知が弱い。Python 実行後に `waitForSkillStatus()` で UI 変化を待つ方が確実
4. **`_emit` 関数の定義**: 毎セルに `import` と `def _emit` を含める必要がある。ヘルパーでテンプレートを用意すると良い

### ヘルパー追加案

`helpers.ts` に `emitSkillViaPython(page, skillId)` を追加:

```typescript
export async function emitSkillViaPython(page: Page, skillId: string): Promise<void> {
  const code = `
import base64, json, time, marimo as mo
from marimo._output.hypertext import Html
_ev = {"skill_id": "${skillId}", "context": {}, "timestamp": int(time.time() * 1000)}
_b64 = base64.b64encode(json.dumps(_ev).encode()).decode()
mo.output.append(Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b64}" style="display:none;"></marimo-broadcast>'))
`.trim();
  await runNewCell(page, code);
}
```

## テスト実行コマンド

```bash
# ビルド反映（本番コード変更がある場合のみ — 今回は不要のはず）
cd frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/

# Python E2E テストのみ
cd frontend && npx playwright test e2e-tests/game/python-e2e.spec.ts --headed

# 全ゲームテスト
cd frontend && npx playwright test e2e-tests/game/

# 既存ユニットテスト（壊れていないことを確認）
cd frontend && pnpm test src/components/skill-tree/__tests__/skill-complete-handler.test.ts
```

## 重要ルール

- 進捗があり次第、`development_docs/game-e2e-review-system.md` に状況、新たな知見、設計思想と背景、Tips など他の作業者に必要な情報を書き込んでください。完了した作業項目には ✅ を付けて進捗を共有してください
- 既存の知見ドキュメントに 29 件の知見が蓄積されている。テスト実行で問題が起きたら参照すること
- **既存テスト（sandbox/ui/persistence/bridge/integration.spec.ts）は変更しないこと**。新規ファイルのみ追加する
- テストケースは 3〜5 件で十分。目的は「①→⑦の全経路が通ること」の証明であり、網羅的な回帰テストは既存テストが担当している
