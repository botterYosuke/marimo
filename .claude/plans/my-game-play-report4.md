# ゲームプレイレポート v4

**作成日**: 2026-02-20
**セッション**: backcast.py 完全プレイフロー E2E テスト修正・progress_channel 抑制バグ修正

---

## 作業ステータス

| ステップ | 状態 | メモ |
|---------|------|------|
| ✅ 前セッション確認（handoff-game-play-v4.md） | 完了 | test 1 が BRIDGE_003 "locked" で失敗中 |
| ✅ 知見ドキュメント確認 | 完了 | `development_docs/game-e2e-review-system.md` 読了（知見1〜37b） |
| ✅ 診断コード追加・原因特定 | 完了 | DOM ステータスを emit 前後で記録 → SANDBOX_005 が完了後に locked に戻ることを発見 |
| ✅ 根本原因特定 | 完了 | `useProgressSync.ts` が `progress_channel` から `progress_init` を受信して `playerProgressAtom` をリセット |
| ✅ `useProgressSync.ts` 修正 | 完了 | `__testSuppressProgressSync` ガード追加 |
| ✅ `skill-complete-handler.ts` 修正 | 完了 | `__testResetProgress` に `__testSuppressProgressSync = true` 設定を追加 |
| ✅ フロントエンドビルド & デプロイ | 完了 | `pnpm turbo build` + `cp -R dist/* ../marimo/_static/` |
| ✅ 全スイート実行・全通過確認 | 完了 | **75 passed / 5 skipped / 0 failed (14.6m)** |
| ✅ 知見ドキュメント更新 | 完了 | 知見38・知見39・完了セクション・ステータス更新 |
| ✅ レポートファイル作成 | 完了 | このファイル |

---

## 実行ログ

### 初期状態確認

前セッション（handoff-game-play-v4.md）からの引き継ぎ:
- `backcast-integration.spec.ts` Test 1「backcast.py 完全プレイフロー」が BRIDGE_003 "locked" で失敗
- または SANDBOX_003 "Expected completed, Received unlocked" で失敗

### 診断フェーズ

#### DOM ステータス記録による問題特定

テスト 1 に診断コードを追加して emit 前後の DOM ステータスを記録した結果:

```
SANDBOX_001 before: unlocked
SANDBOX_001 after (300ms): completed ✓
...
SANDBOX_005 before: unlocked
SANDBOX_005 after (300ms): completed ✓
→ waitForSkillStatus("SANDBOX_005", "completed", 8000) FAIL
  Expected "completed", Received "locked"  (7秒後)
```

**発見**: SANDBOX_005 は emit の 300ms 後に "completed" になるが、7〜8 秒後に "locked" に戻る。

#### 根本原因: `useProgressSync.ts` の `progress_channel` 受信

```
backcast.py auto_instantiate:
  bt.chart() / bt.buy() セルが実行される（約 5〜8 秒後）
  → game_setup.py の broadcast_progress() が呼ばれる
  → BroadcastChannel "progress_channel" に送信
    {"type": "progress_init", "data": {"completed_skills": []}}
  → useProgressSync.ts の onmessage が受信
  → initProgress([]) → playerProgressAtom がリセット
  → SANDBOX_001〜005 が locked に戻る
```

**重要**: `suppressBroadcast` フラグは `skill_event_channel` のみを対象としており、`progress_channel` は対象外だった。

### 修正実装

#### 1. `useProgressSync.ts` — `__testSuppressProgressSync` ガード追加

```typescript
channel.onmessage = (event: MessageEvent) => {
  // テスト中の suppressProgressSync フラグが立っていれば progress_channel を無視（知見 39）
  if (
    (window as unknown as Record<string, unknown>).__testSuppressProgressSync
  ) {
    return;
  }
  try {
    const msg = event.data;
    if (msg?.type !== "progress_init" || !msg?.data) {
      return;
    }
    const completedSkills: string[] = msg.data.completed_skills ?? [];
    initProgress(completedSkills);
  } catch {
    // Silently ignore parse errors
  }
};
```

#### 2. `skill-complete-handler.ts` — `__testResetProgress` にフラグ設定追加

```typescript
(window as unknown as Record<string, unknown>).__testResetProgress = () => {
  onReset();
  suppressBroadcast = true;
  if (suppressTimer) clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => {
    suppressBroadcast = false;
    suppressTimer = null;
  }, 1_000);
  // progress_channel も抑制する（知見 39）
  (window as unknown as Record<string, unknown>).__testSuppressProgressSync = true;
};
```

クリーンアップ関数にも削除処理を追加:
```typescript
delete (window as unknown as Record<string, unknown>).__testSuppressProgressSync;
```

#### 3. `toast.tsx` — `ToastClose` stopPropagation（知見 38）

```tsx
onClick={(e) => {
  // クリックイベントが Toast ルートの onClick（スキルツリーを開く）に
  // バブルアップしないようにする（知見 38）
  e.stopPropagation();
  onClick?.(e);
}}
```

### ビルド & テスト実行

```bash
cd d:/Documents/marimo/frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/ --headed
```

---

## 最終テスト結果

### 全 8 スイート（75 passed / 5 skipped / 0 failed）

```
実行コマンド: npx playwright test e2e-tests/game/ --headed
実行時間: 14.6m
結果: 75 passed / 5 skipped / 0 failed
```

#### スイート別結果

| ファイル | テスト数 | 結果 |
|---------|---------|------|
| `sandbox.spec.ts` | 10 | ✅ 10 passed |
| `ui.spec.ts` | 9 passed / 3 skipped | ✅ 9 passed / 3 skipped |
| `persistence.spec.ts` | 8 | ✅ 8 passed |
| `bridge.spec.ts` | 10 | ✅ 10 passed |
| `integration.spec.ts` | 9 | ✅ 9 passed |
| `backcast-integration.spec.ts` | 5 passed / 2 skipped | ✅ 5 passed / 2 skipped |
| `z-python-e2e.spec.ts` | 4 | ✅ 4 passed |
| **合計** | **75 passed / 5 skipped** | **0 failed** |

---

## 発見したバグ・知見

### 🐛 知見38: ToastClose の onClick stopPropagation が必要（2026-02-20）

- `Toast` ルートに `onClick` ハンドラー（スキルツリーを開く）が設定されている場合、`ToastClose`（X ボタン）の `onClick` が Toast ルートにバブルアップしてスキルツリーが再オープンする
- `e.stopPropagation()` で解消
- 詳細: `development_docs/game-e2e-review-system.md` 知見38

### 🐛 知見39: useProgressSync の progress_channel は suppressBroadcast の対象外（2026-02-20）

- `suppressBroadcast` フラグは `skill_event_channel` BroadcastChannel のみを抑制
- `progress_channel` の `progress_init` メッセージは抑制されず、`playerProgressAtom` が Python バックエンドの状態（空）で上書きされていた
- `backcast.py` の auto_instantiate（bt.chart/bt.buy）が `broadcast_progress()` を呼び出し、テスト中のフロントエンド状態をリセットしていた
- `window.__testSuppressProgressSync` フラグを `useProgressSync.ts` に追加して解消
- 詳細: `development_docs/game-e2e-review-system.md` 知見39

---

## 前セッション（v3）との差分

| 項目 | v3（前回） | v4（今回） |
|-----|---------|------|
| テストスイート数 | 7 | **8**（backcast-integration 追加） |
| テスト合計 | 53 passed / 3 fixme / 0 failed | **75 passed / 5 skipped / 0 failed** ✅ |
| `backcast-integration.spec.ts` Test 1 | FAIL（BRIDGE_003 locked） | **PASS** ✅ |
| progress_channel 抑制 | なし | **実装済み**（知見39） |
| ToastClose stopPropagation | なし | **実装済み**（知見38） |

---

## 結論

`backcast-integration.spec.ts` の全テストが正常通過（一部は意図的 skip）。

根本原因は `useProgressSync.ts` が `progress_channel` BroadcastChannel を通じて Python バックエンドの空の進捗データでフロントエンド状態を上書きしていたこと。`suppressBroadcast` フラグの対象が `skill_event_channel` のみだったため、別チャネルの `progress_channel` は抑制されていなかった。

`window.__testSuppressProgressSync` フラグを追加して `progress_channel` も抑制することで解消。全 8 スイート 75 テストがパスした。
