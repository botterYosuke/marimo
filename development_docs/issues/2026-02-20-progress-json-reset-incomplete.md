# Issue: ゲームリセット時に .backcast.progress.json が残りスキル再発火を阻害

**作成日**: 2026-02-20
**重要度**: Medium
**カテゴリ**: Game / Developer Experience
**ステータス**: Open

---

## 📝 概要

`src-tauri/sample-notebooks/` を `notebooks/` にコピーしてゲームをリセットしても、`.backcast.progress.json` が残存するため `_triggered_skills` が前回の完了スキルで初期化され、スキルが再発火しない。

**現象**:
1. `backcast.py` を含むサンプルファイルを notebooks にコピーしてリセット
2. ページを開いてセルを実行してもスキルのトースト通知が表示されない
3. ブラウザコンソールに `[SkillHandler]` メッセージが出ない
4. ステータスバーは `Progress: 0.0%` のままで Equity も増えない

---

## 🔍 根本原因

`skill_events.py` のモジュールロード時に `progress_manager.load_progress()` で進捗ファイルを読み込み、`_triggered_skills` を初期化している。

```python
# skill_events.py — モジュールロード時に実行される
_triggered_skills: set[str] = set(load_progress().get("completed_skills", []))
```

```python
# progress_manager.py
def load_progress() -> dict:
    path = NOTEBOOKS_DIR / ".backcast.progress.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"version": 1, "completed_skills": []}
```

ゲームリセットでノートブックファイルだけをコピーしても `.backcast.progress.json` は `NOTEBOOKS_DIR`（`C:\Users\sasac\AppData\Roaming\marimo\notebooks\`）に残存する。カーネルが既存プロセスを使い回す場合はメモリ上の `_triggered_skills` も残存する。

**スキルが発火しない仕組み**:

```
ゲームリセット（ファイルコピー）
  → .backcast.progress.json は削除されない
  → 旧カーネル or ページリロード後の新カーネルが skill_events.py をロード
  → _triggered_skills = {"SANDBOX_001", "SANDBOX_002", ..., "BRIDGE_003"}  ← 前回の完了スキルが埋まっている
  → bt.chart() → emit_skill("SANDBOX_001") → _triggered_skills に含まれるためスキップ
  → フロントエンドへのイベント送信なし → スキル完了なし
```

---

## 🐛 再現手順

1. Backcast ゲームを一通りプレイしてスキルを獲得（例: 9/59）
2. `src-tauri/sample-notebooks/*.py` を `notebooks/` にコピー
3. 既存のページをリロード（またはブラウザで再度開く）
4. セルを実行してもスキルが発火しない

---

## ✅ 対処法（暫定）

ゲームリセット時に以下を実施：

```bash
# 1. 進捗ファイルを削除
del "C:\Users\sasac\AppData\Roaming\marimo\notebooks\.backcast.progress.json"

# 2. ページリロード後、"Reconnected" バナーの "Restart" → "Confirm Restart" でカーネル再起動
```

または Python で：

```python
import os
progress_file = r"C:\Users\sasac\AppData\Roaming\marimo\notebooks\.backcast.progress.json"
if os.path.exists(progress_file):
    os.remove(progress_file)
```

---

## 💡 修正提案

### オプション A: ゲームリセットスクリプトを作成

`game_setup.py` または `backcast.py` に `bt.reset()` 関数を追加し、進捗ファイルの削除と `_triggered_skills` のクリアをまとめて行う。

```python
# game_setup.py に追加
def reset():
    """ゲーム状態をリセットする"""
    from skill_events import _triggered_skills
    _triggered_skills.clear()
    from progress_manager import NOTEBOOKS_DIR
    progress_file = NOTEBOOKS_DIR / ".backcast.progress.json"
    if progress_file.exists():
        progress_file.unlink()
    mo.output.append(mo.md("ゲームをリセットしました。ページをリロードしてください。"))
```

### オプション B: `.backcast.progress.json` を `.gitignore` / コピー除外リストに追加

ゲームリセット手順にファイル削除を明示し、スクリプト化する。

### オプション C: ゲームリセット専用 UI ボタン

フロントエンドに「ゲームをリセット」ボタンを追加し、バックエンドの進捗ファイル削除と `_triggered_skills` クリアを自動化する。

---

## 📎 関連ファイル

| ファイル | 役割 |
|---|---|
| `skill_events.py` | `_triggered_skills` の初期化（モジュールロード時） |
| `progress_manager.py` | `.backcast.progress.json` の読み書き |
| `.backcast.progress.json` | 完了スキルの永続化ファイル（ゲームリセット時に削除が必要） |
| `src-tauri/sample-notebooks/` | リセット用ソースファイル |

---

## 📝 補足情報

### 発見経緯

前回のセッション（Session 1）で e2e テストによりセルが多数追加された状態をリセットするため、ユーザーがサンプルノートブックのコピーでリセットを指示。コピー後にページを開いてもスキルが発火せず、原因を調査して発見。

### 影響範囲

- 開発者がゲームを繰り返しテストする際に毎回この問題に直面する
- `.backcast.progress.json` を削除しカーネル再起動すれば回避できるが、手順として直感的でない
- e2e テスト（`backcast-integration.spec.ts`）でも同様の問題が起きる可能性がある
