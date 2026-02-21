# Issue: backcast.py の auto_instantiate が _triggered_skills を汚染し BRIDGE_001 Python pipeline テストが常に失敗する

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: スキル発火 / テスト信頼性
**ステータス**: Open

---

## 概要

`backcast-integration.spec.ts` の test 3（「BRIDGE_001 がフロントエンドで正常にカウントされる」）において、`emitSkillViaPython("BRIDGE_001")` 呼び出し後も BRIDGE_001 のステータスが "unlocked" のまま変化しない。

原因は `backcast.py` の auto_instantiate（マリモ起動時の全セル自動実行）により、Python 側の `_triggered_skills` セットに BRIDGE_001 が既に登録されているため、`emitSkillViaPython()` が生成する `emit_skill("BRIDGE_001")` 相当のコードが dedup により no-op になること。

## 再現手順

1. `backcast.py` を marimo で開く（auto_instantiate が実行される）
2. backcast.py に `bt.reveal_data()` セルが残留している場合、auto_instantiate で `emit_skill("BRIDGE_001")` が実行され `_triggered_skills` に BRIDGE_001 が追加される
3. `backcast-integration.spec.ts` の test 3 を実行する
4. `beforeEach` の `resetGameProgress()` でフロントエンドの Jotai atom はリセットされるが、Python 側の `_triggered_skills` はリセットされない
5. `emitSkillViaPython("BRIDGE_001")` が実行される → Python カーネルで `emit_skill("BRIDGE_001")` が呼ばれる
6. `skill_events.py` の dedup チェック（`if skill_id in _triggered_skills: return`）により no-op になる
7. フロントエンドに `<marimo-broadcast>` HTML が届かないため BRIDGE_001 の status が "unlocked" のまま
8. `expect(bridge001Status).toBe("completed")` が失敗する

## 期待される動作

`emitSkillViaPython("BRIDGE_001")` を呼ぶと、フロントエンドの BRIDGE_001 ステータスが "completed" に遷移する。

## 実際の動作

```
Expected: "completed"
Received: "unlocked"
```

`emitSkillViaPython()` で生成された Python コードは `_triggered_skills` の dedup によって no-op となり、`<marimo-broadcast>` HTML が送信されない。

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `src-tauri/sample-notebooks/skill_events.py` | `emit_skill()` の dedup チェック（29行目）— `_triggered_skills` がカーネルライフタイムで持続 |
| `frontend/e2e-tests/game/helpers.ts` | `emitSkillViaPython()` — Python セル実行経由でスキルを送信 |
| `frontend/e2e-tests/game/helpers.ts` | `resetGameProgress()` — Jotai atom のみリセット、Python 側は非リセット |
| `frontend/e2e-tests/game/backcast-integration.spec.ts` | test 3（BRIDGE_001 テスト）— 失敗テスト |

## 調査メモ

### 根本原因

`skill_events.py` の `_triggered_skills` はモジュールレベルのグローバル変数（set）で、Python カーネルが生きている限り持続する。

```python
# skill_events.py
_triggered_skills: set[str] = set(load_progress().get("completed_skills", []))

def emit_skill(skill_id: str, context: dict | None = None) -> None:
    if skill_id in _triggered_skills:  # ← カーネルライフタイムで持続する dedup
        return
    _triggered_skills.add(skill_id)
    ...
```

`resetGameProgress()` は `window.__testResetProgress()` を呼び、Jotai の `resetProgressAtom` をリセットするが、Python カーネルの `_triggered_skills` には触れない。

### 問題の構造

```
[テスト開始]
  → auto_instantiate: backcast.py のセルが自動実行
      → emit_skill("BRIDGE_001") が実行される（backcast.py に reveal_data セルが残留している場合）
      → _triggered_skills = {"BRIDGE_001", ...}
  → beforeEach: resetGameProgress() → Jotai atom のみリセット
      → _triggered_skills は {"BRIDGE_001", ...} のまま
  → test 3: emitSkillViaPython("BRIDGE_001")
      → Python カーネルで emit_skill("BRIDGE_001") 実行
      → if "BRIDGE_001" in _triggered_skills: return  ← NO-OP
      → フロントエンドに HTML が届かない
      → BRIDGE_001 status = "unlocked" のまま
  → expect(bridge001Status).toBe("completed") → ❌ FAIL
```

### なぜ test 1（完全プレイフロー）は成功するか

test 1 では `emitSkillEvent()`（`window.__testCompleteSkill()` 経由）を使用しており、Python カーネルを経由しない。フロントエンドの Jotai atom を直接操作するため `_triggered_skills` の状態に依存しない。

### 修正方向性（3案）

#### 案1: Python 側に `reset_triggered_skills()` 関数を追加し、beforeEach で呼ぶ

```python
# skill_events.py に追加
def reset_triggered_skills() -> None:
    """テスト用: _triggered_skills をクリアする"""
    _triggered_skills.clear()
```

`resetGameProgress()` 内または専用のリセット関数から呼び出す。ただし、`progress.json` との整合性維持が必要。

#### 案2: `emitSkillViaPython()` が no-op にならないよう `_triggered_skills` をバイパスするオプションを追加

```python
# skill_events.py の emit_skill() に force オプションを追加
def emit_skill(skill_id: str, context: dict | None = None, force: bool = False) -> None:
    if not force and skill_id in _triggered_skills:
        return
    ...
```

テスト時のみ `force=True` で呼び出す。本番コードへの影響が最小限。

#### 案3: テスト 3 の `emitSkillViaPython()` を `emitSkillEventViaHTML()` に変更する

`emitSkillViaPython()` は Python カーネルを経由するため dedup の影響を受ける。`emitSkillEventViaHTML()` は `__testInjectBroadcastHTML` 経由でフロントエンドに直接注入するため dedup を受けない。

ただしこれはテスト経路の変更であり、「Python pipeline 全体を通したテスト」という test 3 の本来の目的が失われる。

#### 推奨: 案1（Python 側リセット関数の追加）

`window.__testResetProgress()` 拡張として Python 側の `_triggered_skills` もリセットする。フロントエンドからの RPC または新規 marimo セル実行で実現可能。最も根本的な解決策。

### セル蓄積との関係

この問題は `bug-260221-cell-accumulation-in-notebook.md` で記録されたセル蓄積問題と複合している。backcast.py に不要なセル（`bt.reveal_data()` など）が残留していると auto_instantiate により `_triggered_skills` が不正な初期状態になる。

セル蓄積問題を解決（ノートブックのリセット機能追加）することで、この問題の発生頻度は下がる可能性があるが、根本的には Python 側 `_triggered_skills` のリセット機能が必要。
