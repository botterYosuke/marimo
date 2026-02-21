# Issue: BRIDGE_003 卒業チェックに BRIDGE_001 の確認が欠落

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: Game / Skill System
**ステータス**: ✅ 修正済み（2026-02-21 実装確認）

---

## 概要

`skill_events.py` の `_check_graduations()` 関数が、ブリッジトラック卒業（BRIDGE_003）を判定する際に `BRIDGE_002` の完了のみを確認し、`BRIDGE_001` の完了を確認していない。

設計意図では `BRIDGE_001 → BRIDGE_002 → BRIDGE_003` の順序でスキルを達成する必要があるが、ユーザーが `reveal_data()`（BRIDGE_001）を呼ばずに `get_stock_daily()`（BRIDGE_002）を直接呼び出した場合でも、BRIDGE_003 が自動的に発火してしまう。

## 再現手順

1. ゲームを開始し、`bt.chart("7203")` → `bt.buy()` などで SANDBOX トラックを完了させる
2. SANDBOX_006（サンドボックス卒業）を達成する
3. `bt.reveal_data()` を呼ばずに（BRIDGE_001 未達成のまま）`bt.get_stock_daily("7203")` を直接呼ぶ
4. `_triggered_skills` に BRIDGE_002 が追加された時点で `_check_graduations()` が呼ばれる
5. BRIDGE_001 の確認なしに BRIDGE_003 が発火する

## 根本原因

`skill_events.py` の `_check_graduations()` のブリッジ卒業チェック：

```python
def _check_graduations() -> None:
    """トラック卒業の自動チェック"""
    s = _triggered_skills
    # サンドボックス卒業
    if all(f"SANDBOX_{i:03d}" in s for i in range(1, 6)):
        emit_skill("SANDBOX_006")
    # ブリッジ卒業  ← バグ: BRIDGE_001 の確認が欠落している
    if "BRIDGE_002" in s:
        emit_skill("BRIDGE_003")
```

設計ドキュメント（`handoff-game-play-v4.md`）では以下のスキル依存チェーンが定義されている：

```
SANDBOX_006 → BRIDGE_001 → BRIDGE_002 → BRIDGE_003
```

SANDBOX の卒業チェックでは SANDBOX_001 〜 SANDBOX_005 の全完了を確認している（`range(1, 6)`）が、ブリッジの卒業チェックでは BRIDGE_001 の確認が省略されている。

## 影響範囲

- ユーザーが `reveal_data()`（BRIDGE_001 のトリガー）を呼ばずにブリッジトラックを「卒業」できてしまう
- Python 側の `_triggered_skills` と `progress.json` に BRIDGE_001 なしで BRIDGE_003 が記録される
- フロントエンド側では `skill-data.ts` の prerequisite チェーン（BRIDGE_002 requires BRIDGE_001）により BRIDGE_003 の表示は正しく保留されるが、Python 側の状態と不整合が生じる
- 進捗ファイル（`.backcast.progress.json`）に BRIDGE_001 未達成のまま BRIDGE_003 が保存され、次回セッション再開時に矛盾した状態になる可能性がある

## 修正案

`_check_graduations()` のブリッジ卒業チェックに BRIDGE_001 の確認を追加する：

```python
def _check_graduations() -> None:
    """トラック卒業の自動チェック"""
    s = _triggered_skills
    # サンドボックス卒業
    if all(f"SANDBOX_{i:03d}" in s for i in range(1, 6)):
        emit_skill("SANDBOX_006")
    # ブリッジ卒業: BRIDGE_001 と BRIDGE_002 の両方が必要
    if "BRIDGE_001" in s and "BRIDGE_002" in s:
        emit_skill("BRIDGE_003")
```

## 修正確認（2026-02-21）

`skill_events.py:62` が修正案のとおり実装済みであることを確認:

```python
if "BRIDGE_001" in s and "BRIDGE_002" in s:
    emit_skill("BRIDGE_003")
```

BRIDGE_001 と BRIDGE_002 の両方が必要になっており、Issue に記載の旧コード（`if "BRIDGE_002" in s:` のみ）は現在の実装では存在しない。

## 関連ファイル

| ファイル | 関連箇所 |
|---|---|
| `src-tauri/sample-notebooks/skill_events.py` | `_check_graduations()` 62-63行目 — 修正対象 |
| `development_docs/plans/handoff-game-play-v4.md` | スキル依存チェーンの設計定義 |
| `frontend/src/components/skill-tree/skill-data.ts` | BRIDGE_003 の prerequisites（"BRIDGE_002"）— フロントエンドは一致している |
