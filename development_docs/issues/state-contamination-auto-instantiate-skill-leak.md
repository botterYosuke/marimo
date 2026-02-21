# Issue: auto_instantiate によるスキル状態漏洩でテスト間に状態汚染が発生する

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: テスト / スキル発火 / データ
**ステータス**: Open

---

## 概要

全スイートをまとめて実行すると、前のテストで発火されたスキルイベントが `afterEach` の `resetGameProgress()` をすり抜けて次のテストに引き継がれる。これにより「初期状態」を前提とするテストが予期しないスキル完了状態や現金残高で開始し、失敗する。

## 再現手順

1. `npx playwright test e2e-tests/game/ --headed --reporter=line` で全スイートを実行する
2. 以下のテストが状態汚染により失敗する:
   - `persistence.spec.ts:58` — SANDBOX_001 が `"unlocked"` であるべきところ `"completed"` になっている
   - `persistence.spec.ts:69` — 完了スキル数が 0 のはずが 2 になっている
   - `integration.spec.ts:118` — 完了スキル数が 0 のはずが 2 になっている
3. 単体スペック実行では再現しない

## 期待される動作

- `persistence.spec.ts:58`: ページロード直後に `SANDBOX_001` のステータスが `"unlocked"` である
- `persistence.spec.ts:69`: ページロード直後の完了スキル数が 0 である
- `integration.spec.ts:118`: `beforeEach` 後の完了スキル数が 0 である

## 実際の動作

- `persistence.spec.ts:58`: `data-skill-status` が `"completed"` になっている（`Expected "unlocked", Received "completed"`）
- `persistence.spec.ts:69`: `getCompletedCount()` が 2 を返す（`Expected 0, Received 2`）
- `integration.spec.ts:118`: `getCompletedCount()` が 2 を返す（`Expected 0, Received 2`）

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/persistence.spec.ts` | 53行目 `beforeEach`、58行目 SANDBOX_001 ステータス確認、69行目 完了数確認 |
| `frontend/e2e-tests/game/integration.spec.ts` | 118行目 完了数確認 |
| `frontend/e2e-tests/game/helpers.ts` | `resetGameProgress()` — Jotai atom の直接リセット（523-548行目） |
| `src-tauri/sample-notebooks/game_setup.py` | モジュールレベルの `bt` インスタンス初期化 |

## 調査メモ

### `resetGameProgress()` の実装

```typescript
export async function resetGameProgress(page: Page): Promise<void> {
  await page.evaluate(() => {
    const fn = (window as unknown as Record<string, unknown>).__testResetProgress;
    if (typeof fn === "function") {
      (fn as () => void)();
    }
  });
  // React 状態更新 → DOM 再レンダリングを待つ
  await page.waitForTimeout(300);
}
```

`__testResetProgress` は Jotai の `playerProgressAtom`（フロントエンドのメモリ上の状態）をリセットする。しかしこの操作はフロントエンドのみに効き、以下の状態はリセットされない:

### リセットされない状態

1. **Python カーネル側の `skill_events.py` の内部状態**: `get_triggered_skills()` が返す「既に発火済みスキル一覧」はカーネルのメモリに残る。次のテストで同一カーネルに接続すると、前のテストで発火されたスキルが Python 側で「発火済み」として残っている
2. **marimo の `auto_instantiate`**: ページロード時にノートブックのセルが自動実行されるため、ロード直後に Python 側スキルが再発火し、フロントエンドの `resetGameProgress()` 直後でも `BroadcastChannel` 経由でスキルイベントが流れてくる可能性がある
3. **`persistence.spec.ts` の `beforeEach`**: `page.goto()` を毎回呼ぶためページはリロードされる。しかし同一カーネルへの再接続が発生し、カーネルの auto_instantiate でスキルが再発火する

### 状態汚染のフロー（推定）

```
[前スペック afterEach]
  → resetGameProgress(): フロントエンドの Jotai atom をリセット ✅
  → カーネル側の skill_events 状態はリセットされない ❌

[次スペック beforeEach]
  → page.goto(getAppUrl("game_test.py"))
  → marimo が同一カーネルに再接続
  → auto_instantiate でノートブックセルが実行される
  → game_setup.py モジュールレベルコードが実行され broadcast_progress() が呼ばれる
  → 前スペックで追加されたセル（runNewCellInGrid で追加されたもの）も実行される
  → SANDBOX_001 等が emit_skill() で再発火
  → フロントエンドが BroadcastChannel 経由でスキル完了を受け取る
  → SANDBOX_001 が "completed" になる（"unlocked" を期待していたがすでに completed）
```

### マイルストーン報酬による現金汚染

`ui.spec.ts:176` で `initialCash` が既に 50,000 になっていた事例も同じメカニズム。前スペックで 10 スキルのマイルストーン報酬が付与され、`resetGameProgress()` でフロントエンドの現金状態がリセットされなかった（または auto_instantiate でマイルストーン処理が再実行された）可能性がある。

### 修正方針

1. **カーネル側リセット**: `resetGameProgress()` 拡張として、Python 側の `skill_events` 内部状態をリセットする API を設ける。例: `window.__testResetPythonSkills()` が Python セルを実行して `skill_events` の状態をクリアする
2. **スペック間分離の強化**: `beforeEach` で毎回 `page.goto()` を呼び（needsNavigation ロジックを常時 true にする）、ページリロードで BroadcastChannel リスナーを含む全フロントエンド状態をリセットする。ただし auto_instantiate によるスキル再発火は防げない
3. **`game_test.py` の設計見直し**: ゲームテスト用ノートブックがスキルを自動発火しない設計にする（setup セルが `emit_skill()` を呼ばない）
4. **afterEach での待機時間増加**: 現在の 300ms 待機では BroadcastChannel メッセージの処理が完了する前に次のテストが開始する可能性がある。待機時間を 1 秒以上に延ばす
