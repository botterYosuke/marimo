# ゲームプレイレポート v3

**作成日**: 2026-02-20
**セッション**: v4ハンドオフ計画に基づく実プレイ（sandbox.spec.ts E2E テスト実行）

---

## 作業ステータス

| ステップ | 状態 | メモ |
|---------|------|------|
| ✅ レポートファイル作成 | 完了 | このファイル |
| ✅ 事前チェック（プロセスクリーンアップ） | 完了 | `taskkill //F //IM marimo.exe` 実行 |
| ✅ 知見ドキュメント確認 | 完了 | `development_docs/game-e2e-review-system.md` 読了（知見1〜36） |
| ✅ sandbox.spec.ts 実行（v3前セッション） | 完了 | **10/10 passed (3.4m)** |
| ✅ sandbox.spec.ts 実行（v3本セッション） | 完了 | **10/10 passed (2.1m)** ※障害対処後 |

---

## 実行ログ

### 1回目実行（障害発生）

#### WebServer 起動失敗

```
Error: Process from config.webServer was not able to start. Exit code: 1
× No solution found when resolving dependencies for split (markers:
│ python_full_version == '3.12.*' and sys_platform == 'linux'):
╰─▶ Because only backcastpro<=0.6.3 is available and marimo[game] depends
    on backcastpro>=0.6.4
```

**原因**: `pyproject.toml` が `BackcastPro>=0.6.4` を要求するが PyPI には `0.6.3` しかない

**対処**:
1. `d:\Documents\BackcastPro` を `git pull` → 0.6.4 に更新
2. `pyproject.toml` の `[tool.uv.sources]` に `BackcastPro = { path = "../BackcastPro", editable = true }` を追加
3. `uv lock` 実行 → `backcastpro v0.6.3 → v0.6.4` 更新完了

#### 2回目実行（テスト1失敗）

```
テスト1: 初期状態: SANDBOX_001 は unlocked
Expected: "unlocked"
Received: "completed"
→ 9 passed, 1 failed
```

**原因**: `game_test.py` が前セッションの `z-python-e2e.spec.ts` で追加された大量（約50個）のスキル発火セルで汚染されており、カーネルが再実行することで SANDBOX_001 が `completed` 状態になる

**対処**:
```bash
# clean バージョン（e60ce233b）に復元
git show e60ce233b:frontend/e2e-tests/py/game_test.py > frontend/e2e-tests/py/game_test.py
taskkill //F //IM marimo.exe
```

### 3回目実行（全通過）

```
実行コマンド: npx playwright test e2e-tests/game/sandbox.spec.ts --headed

結果: 10 passed (2.1m)
```

#### テストケース別結果

| # | テスト名 | 結果 | 備考 |
|---|---------|------|------|
| 1 | 初期状態: SANDBOX_001 は unlocked | ✅ PASS | game_test.py 復元後 |
| 2 | 初期状態: SANDBOX_002 は locked（SANDBOX_001 未完了） | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 3 | 初期状態: 進捗バッジが 0/59 スキルを表示 | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 4 | SANDBOX_001 完了後、SANDBOX_002 が unlocked になる | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 5 | SANDBOX_002 完了後、進捗バッジが 2 に増える | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 6 | SANDBOX_002 完了後、SANDBOX_002 ノードが completed になる | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 7 | 前提条件なしで SANDBOX_002 を単独発火しても completed にならない | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 8 | SANDBOX_006 完了でサンドボックス卒業フラグが立つ | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 9 | SANDBOX_006 完了後に現金残高が増えている | ✅ PASS | Reconnected バナーを dismiss して継続 |
| 10 | 同一スキルを 2 回発火しても completeSkills が重複しない | ✅ PASS | Reconnected バナーを dismiss して継続 |

#### 観察された挙動

- **Reconnected バナー**: テスト 2〜10 で毎回 dismiss（正常動作・知見21）
- **テスト実行時間**: 2.1分（前回 3.4分 より高速）
- **クリーンアップ**: テスト終了後に marimo processes を自動クリーンアップ

---

## 発見したバグ・知見

### 🐛 知見37a: BackcastPro ローカルソース依存問題

- `pyproject.toml` の `game` extras が `BackcastPro>=0.6.4` を要求するが PyPI には未公開
- `[tool.uv.sources]` にローカルパスを追加することで解消
- 詳細: `development_docs/game-e2e-review-system.md` 知見37a

### 🐛 知見37b: game_test.py セル汚染問題（セッション間持続）

- `z-python-e2e.spec.ts` がセルを追加し次セッションで SANDBOX_001 が `completed` になる
- `global-teardown.ts` がファイルをクリーンアップしていない
- **対処**: 毎セッション前に `git show e60ce233b:...game_test.py > game_test.py` で復元
- **TODO**: `global-teardown.ts` に自動クリーンアップを追加
- 詳細: `development_docs/game-e2e-review-system.md` 知見37b

### 📝 観察事項

1. **Reconnected バナーは毎テスト出現するが正常動作** - 知見21
2. **テスト実行時間**: 2.1分（前回 3.4分 より短縮）

---

## v3前セッションとの差分

| 項目 | v3前セッション | v3本セッション（今回） |
|-----|---------|--------------|
| sandbox.spec.ts | 10 passed (3.4m) | **10 passed (2.1m)** ✅ |
| BackcastPro 依存 | 問題なし | 知見37a で解消 |
| game_test.py 汚染 | 問題なし | 知見37b で復元・解消 |
| Reconnected バナー対処 | 安定動作 | 安定動作を確認 |

---

## 結論

`sandbox.spec.ts` の全10テストが正常通過（2.1m）。

2つの新規障害（BackcastPro 依存 / game_test.py セル汚染）を発見・対処し、
知見37a・37b としてドキュメント化。次セッションは `game_test.py` 復元を先に実施すること。
