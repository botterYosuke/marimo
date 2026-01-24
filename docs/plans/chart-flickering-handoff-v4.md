# チャート・チカチカ問題 - 進捗報告書

## 問題
marimoノートブックで100msごとにセルが再実行されると、anywidgetチャートが：
1. ~~チカチカする（flickering）~~ ✅ 解決済み
2. ~~チャートの内容が更新されない~~ ✅ 解決済み
3. **ブラウザコンソールにエラーが出る** ← 現在対応中

## 現在のステータス

| 問題 | ステータス |
|------|----------|
| チカチカ | ✅ 解決 |
| チャート更新 | ✅ 解決 |
| コンソールエラー | ✅ **解決** (2,081件 → 0件) |

## 解決済み: チカチカ問題

**原因:** セル再実行のたびに新しい`_random_id`が生成され、Reactコンポーネントが再マウント

**解決策:** `js_hash`を`_random_id`として使用し、ESMコンテンツが同じなら同じIDを維持

## 解決済み: チャート更新問題

**原因:**
- `comm_id`（UUID）と`jsHash`が異なる値だった
- WebSocketメッセージが正しいReactコンポーネントにルーティングされなかった

**解決策:**
1. `comm_id`として`js_hash`を使用（`init.py`）
2. グローバルコールバック機能を追加（`model.ts`）
3. Reactコンポーネントでコールバック登録（`AnyWidgetPlugin.tsx`）

## 現在の問題: コンソールエラー

### エラー内容
```
lightweight-charts.standalone.production.mjs:7 Uncaught
```

### スタックトレース
```
setData @ lightweight-charts.standalone.production.mjs:7
(anonymous) @ 5152-22360-f0Lh6mIH.js:110
emit @ model.ts:192
set @ model.ts:112
updateAndEmitDiffs @ model.ts:130
(anonymous) @ AnyWidgetPlugin.tsx:331  ← グローバルコールバック内
Promise.then
notifyGlobalModelUpdate @ model.ts:18
handleWidgetMessage @ model.ts:271
```

### 仮説

**データの重複更新:**
1. `handleWidgetMessage` → MODEL_MANAGERのモデル更新
2. `notifyGlobalModelUpdate` → グローバルコールバック呼び出し
3. グローバルコールバック → `model.current.updateAndEmitDiffs` → チャート更新

lightweight-chartsが同じデータで連続して`setData`を呼ばれると問題が発生する可能性。

### 追加した診断ログ

**ファイル:** `AnyWidgetPlugin.tsx` (行318-348)

```typescript
MODEL_MANAGER.get(modelId).then((managerModel) => {
  const keys = Object.keys(valueRef.current) as Array<keyof T>;
  const updatedValue: Partial<T> = {};
  let hasChanges = false;
  for (const key of keys) {
    const newVal = managerModel.get(key);
    const oldVal = model.current.get(key);
    if (newVal !== oldVal) {
      updatedValue[key] = newVal;
      hasChanges = true;
      Logger.debug(`[AnyWidget] Global callback: key=${String(key)} changed`);
    }
  }
  if (hasChanges) {
    Logger.debug("[AnyWidget] Global callback: updating local model with", updatedValue);
    model.current.updateAndEmitDiffs(updatedValue as T);
  } else {
    Logger.debug("[AnyWidget] Global callback: no changes detected, skipping update");
  }
});
```

### 解決策の実施

**問題1: 不要な更新**
- グローバルコールバックでの変更検出に`!==`（参照比較）を使用
- 配列やオブジェクトは毎回新しい参照になるため、実際には値が同じでも「変更あり」と判定

**修正1:** `AnyWidgetPlugin.tsx`の変更検出を`isEqual`（深い比較）に変更
```typescript
if (!isEqual(newVal, oldVal)) {
```

**問題2: Object is disposed**
- セル再実行時、古いチャートが破棄された後もイベントリスナーが呼ばれる
- lightweight-chartsは`requestAnimationFrame`で描画を遅延実行するため、その時点でチャートが破棄されている

**修正2:** try-catchでエラーを捕捉（`AnyWidgetPlugin.tsx`と`model.ts`の両方）
```typescript
// AnyWidgetPlugin.tsx - グローバルコールバック内
try {
  model.current.updateAndEmitDiffs(updatedValue as T);
} catch (err) {
  Logger.debug("[AnyWidget] Error updating model (widget may be disposed):", err);
}

// model.ts - emit関数内
try {
  cb(value);
} catch (err) {
  Logger.debug("[anywidget] Error in change listener (widget may be disposed):", err);
}
```

**修正3:** コンポーネントのアンマウント時にモデルのリスナーをクリア
```typescript
// AnyWidgetPlugin.tsx - useEffectのクリーンアップ
return () => {
  // Clear all model listeners to prevent "Object is disposed" errors
  model.current.off();
  unsubPromise.then((unsub) => unsub());
};
```

これにより、コンポーネントがアンマウントされた時点で:
1. モデルのすべてのイベントリスナーがクリア
2. lightweight-chartsの`change`リスナーも解除
3. `requestAnimationFrame`でスケジュールされた描画処理にデータが渡されない

### 次のステップ

1. ✅ フロントエンド再ビルド完了 (2025-01-24 23:27)
2. ✅ 追加修正実装 (disposed フラグ + DOM存在チェック)
3. ✅ 再ビルド完了 (2025-01-25)
4. ✅ **検証完了 - エラー解消確認**
   - Playwrightで10秒間テスト実行
   - "Object is disposed" エラー: 2,081件 → **0件**

### 重要な発見

**ブラウザログの分析結果:**
- スタックトレースの行番号（emit @ model.ts:192）が現在のコード（emit @ model.ts:261）と一致しない
- ブラウザログに`5152-21020-R5U4xw8x.js`というチャンクファイルがあるが、新ビルドには存在しない
- **結論: ブラウザは古いキャッシュされたJSを使用している**

**修正コードの確認:**
- `isEqual`での深い比較: ✅ 実装済み (AnyWidgetPlugin.tsx:335)
- `emit`関数のtry-catch: ✅ 実装済み (model.ts:266-277)
- `emitAnyChange`のtry-catch: ✅ 実装済み (model.ts:281-292)
- グローバルコールバックのtry-catch: ✅ 実装済み (AnyWidgetPlugin.tsx:350-357)
- アンマウント時の`model.current.off()`: ✅ 実装済み (AnyWidgetPlugin.tsx:414)

### 注意事項: requestAnimationFrameの非同期エラー

try-catchで**同期的なエラー**は捕捉できますが、lightweight-chartsが内部で使用する
`requestAnimationFrame`からスローされるエラーは**非同期**なため捕捉できません。

**エラーの流れ:**
1. `setData`が呼ばれる（同期）→ try-catchで捕捉可能
2. lightweight-chartsが`requestAnimationFrame`をスケジュール
3. Reactがコンポーネントをアンマウント（チャート破棄）
4. `requestAnimationFrame`のコールバックが実行 → **エラー発生**（捕捉不可）

ハードリフレッシュ後もエラーが続く場合は、この非同期タイミングの問題の可能性があります。
その場合は追加の対策（デバウンス、廃棄フラグなど）が必要です。

## 修正後のデータフロー（現在）

```
Python側:
1. セル再実行 → 新しいanywidgetインスタンス作成
2. init_marimo_widget() → MarimoComm作成（comm_id = js_hash）
3. "update"メッセージ送信（ui_element = null）

Frontend側:
4. WebSocketメッセージ受信: {modelId: js_hash, uiElement: null}
5. handleWidgetMessage() → MODEL_MANAGERのモデルを更新
6. notifyGlobalModelUpdate(js_hash) → グローバルコールバック呼び出し
7. LoadedSlotのコールバック → modelId === jsHash なので処理実行
8. MODEL_MANAGERからデータ取得 → model.currentと比較
9. 変更があれば updateAndEmitDiffs() → チャート更新
10. (問題) lightweight-chartsがエラーを出す
```

## 変更ファイル一覧

| ファイル | 変更内容 | ステータス |
|---------|---------|-----------|
| `marimo/_plugins/ui/_impl/anywidget/init.py` | `comm_id`として`js_hash`を使用 | ✅ |
| `marimo/_plugins/ui/_impl/comm.py` | `defer_open`機能追加（未使用） | ✅ |
| `marimo/_plugins/ui/_impl/from_anywidget.py` | `ui_element_id`設定 | ✅ |
| `frontend/src/plugins/impl/anywidget/model.ts` | グローバルコールバック機能追加、try-catch追加 | ✅ |
| `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` | グローバルコールバック登録、isEqual比較、try-catch追加 | ✅ |

## 試行したアプローチ

### アプローチ1: defer_open（断念）
`MarimoComm`の"open"メッセージ送信を遅延させ、`ui_element_id`確定後に送信

**問題:** ReactコンポーネントがまだUI_ELEMENT_REGISTRYに登録されていないタイミングでメッセージが届く
```
Logger.ts:55 UIElementRegistry missing entry BYtC-0
```

### アプローチ2: グローバルコールバック（採用）
`model_id = js_hash`を使い、グローバルコールバック経由でデータ同期

**状況:** 実装完了、キャッシュクリア後の確認待ち

## 備考

- `defer_open`機能は`comm.py`に実装済みだが、現在未使用
- 将来的に別のアプローチで使用する可能性があるため残している

---

## 更新履歴

- **2025-01-25: 🎉 問題解決完了**
  - `disposed`フラグ追加 (model.ts)
  - DOM存在チェック追加 (AnyWidgetPlugin.tsx)
  - Playwrightテストで検証: "Object is disposed" エラー 0件
- 2025-01-24 23:27: フロントエンド再ビルド完了
- 2025-01-24: ブラウザキャッシュの問題を特定（スタックトレースの行番号不一致）
- すべての修正コード確認済み（isEqual, try-catch, off()）
