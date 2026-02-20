# ゲームプレイレポート v5

**作成日**: 2026-02-20
**セッション**: backcast.py 汚染防止・backup/restore 追加・知見41

---

## 作業ステータス

| ステップ | 状態 | メモ |
|---------|------|------|
| ✅ 前セッション確認（my-game-play-report4.md） | 完了 | 知見40追加・全10スイート通過後に backcast-integration test 3 が 2 回目で失敗 |
| ✅ 根本原因特定 | 完了 | backcast.py に 8+ 個の汚染セルが蓄積 → auto_instantiate でトーストが積み上がり Python ボタン遮蔽 |
| ✅ `backcast.py` クリーンアップ | 完了 | 321 行→50 行（bt.buy/bt.chart/BRIDGE_001 emit セル ×8 以上を削除） |
| ✅ `global-setup.ts` backup 追加 | 完了 | テスト前に backcast.py をバックアップ（stale backup 対応も実装） |
| ✅ `global-teardown.ts` restore 追加 | 完了 | テスト後にバックアップから復元・削除 |
| ✅ `helpers.ts` Python ボタン安定化 | 完了 | for → while ループ + タイムアウト 5s → 10s |
| ✅ 1 回目実行確認 | 完了 | 4 passed / 2 skipped / 0 failed |
| ✅ 2 回目実行確認 | 完了 | **4 passed / 2 skipped / 0 failed** ✅ （汚染なしを確認） |
| ✅ 知見ドキュメント更新 | 完了 | 知見41追加・game-e2e-review-system.md・skill.md 更新 |
| ✅ コミット | 完了 | `19a4cbdad feat(game-e2e): backcast.py 汚染防止...` |

---

## 問題の詳細

### 症状

前セッション（v4）でコミット後、2 回目の連続テスト実行で:
```
backcast-integration.spec.ts:301 › BRIDGE_001 がフロントエンドで正常にカウントされる
Error: locator.click: Timeout 5000ms exceeded
- waiting for getByRole('button', { name: 'Python', exact: true })
at helpers.ts:423 (runNewCellInGrid)
at emitSkillViaPython (helpers.ts:497)
```

結果: 74 passed / 5 skipped / **1 failed**

### 根本原因

```
backcast.py 汚染チェーン:
  Test 3 (run 1): emitSkillViaPython() → BRIDGE_001 emit セルを backcast.py に追加
  Test 4 (run 1): runNewCellInGrid("bt.buy()") → bt.buy() セルを backcast.py に追加
  Test 5 (run 1): runNewCellInGrid('bt.chart("7203")') → bt.chart セルを backcast.py に追加
  ↓ global-teardown.ts は game_test.py は復元するが backcast.py は復元しない
  ↓ 8+ 回の実行で 8+ 個の汚染セルが蓄積（321 行！）

Run 2:
  beforeEach → backcast.py ナビゲーション → auto_instantiate が 8+ セルを実行
  → 多数の BRIDGE_001 emit → 多数の報酬トースト
  → トーストが下部ツールバーを遮蔽
  → Python ボタンが 5s 以内に clickable にならない → タイムアウト
```

### バックアップ確認

`tail -100 backcast.py` の出力（修正前）:
- 8 組 × (bt.buy + bt.chart("7203") + BRIDGE_001 emit) = 24 汚染セル
- 321 行（本来 50 行のはずが 6 倍以上）

---

## 修正内容

### 1. backcast.py クリーンアップ（即時対応）

```python
# 修正後の構成（50 行）:
# - 1. welcome cell (mo.md)
# - 2. bt.chart("7203") (original game cell)
# - 3. comment cell (ユーザーが書くスペース)
```

### 2. global-setup.ts バックアップ追加

```typescript
const BACKCAST_PATH = "C:\\Users\\sasac\\AppData\\Roaming\\marimo\\notebooks\\backcast.py";
const BACKCAST_BACKUP_PATH = BACKCAST_PATH + ".test-backup";

// stale backup 対応（前回クラッシュ時の残骸）
try {
  await access(BACKCAST_BACKUP_PATH);
  await copyFile(BACKCAST_BACKUP_PATH, BACKCAST_PATH); // stale → 復元
  await unlink(BACKCAST_BACKUP_PATH);
} catch { /* stale なし → 正常 */ }

// バックアップ作成
await copyFile(BACKCAST_PATH, BACKCAST_BACKUP_PATH);
```

### 3. global-teardown.ts 復元追加

```typescript
const BACKCAST_BACKUP_PATH =
  "C:\\Users\\sasac\\AppData\\Roaming\\marimo\\notebooks\\backcast.py.test-backup";

await copyFile(BACKCAST_BACKUP_PATH, backcastPath); // 復元
await unlink(BACKCAST_BACKUP_PATH);                  // バックアップ削除
```

### 4. helpers.ts Python ボタン安定化

```typescript
// Before: for ループ（固定カウント）
const preToastCount = await toastCloseButtonsPre.count().catch(() => 0);
for (let i = 0; i < preToastCount; i++) { ... }
await page.getByRole("button", { name: "Python", exact: true }).click();

// After: while ループ（新着トーストも除去）+ タイムアウト延長
let preToastCount = await toastCloseButtonsPre.count().catch(() => 0);
while (preToastCount > 0) {
  await toastCloseButtonsPre.first().click().catch(() => {});
  await page.waitForTimeout(200);
  preToastCount = await toastCloseButtonsPre.count().catch(() => 0);
}
await page
  .getByRole("button", { name: "Python", exact: true })
  .click({ timeout: 10_000 });
```

---

## テスト結果

### 1 回目実行（クリーンアップ後）

```
backcast-integration.spec.ts を実行
結果: 4 passed / 2 skipped / 0 failed (1.6m)
backup/restore: ✅ 正常動作
```

### 2 回目実行（汚染防止確認）

```
backcast-integration.spec.ts を再実行
結果: 4 passed / 2 skipped / 0 failed (1.6m)  ← 汚染なし！
backup/restore: ✅ 正常動作
```

---

## 発見した知見

### 🐛 知見41: backcast.py のセル汚染と backup/restore による防止（2026-02-20）

- `backcast-integration.spec.ts` の `runNewCellInGrid()`/`emitSkillViaPython()` が実行のたびに `backcast.py` にセルを追加
- `backcast.py` は git 管理外のため `git restore` では復元不可
- `global-setup.ts` でバックアップ、`global-teardown.ts` で復元する backup/restore パターンで解消
- stale バックアップ（前回クラッシュ時の残骸）の検出・処理も実装
- 詳細: `development_docs/game-e2e-review-system.md` 知見41

---

## 前セッション（v4）との差分

| 項目 | v4（前回） | v5（今回） |
|-----|---------|---------|
| backcast.py 汚染 | なし（未対策） | **backup/restore で防止**（知見41） |
| helpers.ts toast clearing | for ループ（固定カウント） | **while ループ + 10s タイムアウト** |
| 連続実行 2 回目 | FAIL（Python ボタンタイムアウト） | **PASS** ✅ |

---

## 結論

`backcast.py`（git 管理外）へのセル汚染が根本原因。
`game_test.py`（git 管理下）は `git restore` で復元できるが、
`backcast.py` は backup/restore パターンが必要。

`global-setup.ts` でテスト前バックアップ、`global-teardown.ts` でテスト後復元を実装し、
2 連続実行で 4 passed / 2 skipped / 0 failed を確認。
