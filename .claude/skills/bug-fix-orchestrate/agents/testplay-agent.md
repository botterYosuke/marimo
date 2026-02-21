# テストプレイエージェント (testplay-agent)

## 役割

実際に marimo でゲームをプレイして、修正効果をユーザー視点で確認する。

## 責務

1. Issue の「再現手順」を実行
2. 修正前の現象が発生しないことを確認
3. 関連するゲームフローをプレイ
4. スクリーンショット撮影
5. テストプレイレポートを出力

## 対象バグ

**High 以上の重要度のバグのみ実施**

- Critical: 全て実施
- High: 全て実施
- Medium: スキップ
- Low: スキップ

## 入力

- `development_docs/issues/<slug>.md` (Issue ファイル)
- 修正後の marimo アプリケーション

## 実行内容

### 1. Issue 読み込み

`development_docs/issues/<slug>.md` を読む。

抽出する情報:
- 再現手順
- 期待される動作 vs 実際の動作
- 関連ファイル（プレイに必要なノートブック）

### 2. marimo アプリケーション起動

#### 既に起動している場合

app-agent で起動済みなので、ブラウザで接続:

```
http://localhost:2718
```

#### 起動していない場合

```bash
cd D:/Documents/marimo && pnpm dev
```

待機してから `http://localhost:2718` を開く。

### 3. ノートブック準備

関連ノートブックを開く:

- **backcast.py**: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`
- Grid レイアウト: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\layouts\backcast.grid.json`

ブラウザで以下の URL を開く:

```
http://localhost:2718/?file=C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py
```

### 4. 再現テスト

Issue の「再現手順」を順次実行:

#### 手順例（networkidle-timeout の場合）

1. `npx playwright test e2e-tests/game/bridge.spec.ts --headed --reporter=line` を実行
2. テストが `beforeEach` でタイムアウトせずに通過することを確認
3. 結果を記録

#### 手順例（bridge001-dedup の場合）

1. backcast.py を開く
2. `resetGameProgress()` を実行（開発者コンソールで `window.__testResetProgress()`）
3. Python セルで `emit_skill("BRIDGE_001")` を実行
4. スキルツリーで BRIDGE_001 のステータスが "completed" になることを確認
5. スクリーンショット撮影

### 5. 修正効果確認

修正前の現象（Issue の「実際の動作」）が発生しないことを確認:

- **修正前**: タイムアウトエラー
- **修正後**: テスト通過

→ ✅ 修正効果あり

### 6. 関連フロー確認（ゲームバグの場合）

ゲーム関連のバグの場合、関連するゲームフローをプレイ:

#### SANDBOX モード（基礎スキル）

以下のスキルを順次取得:

1. SANDBOX_001: backtest.run() を実行
2. SANDBOX_002: trades() を使用
3. SANDBOX_003: position() を使用
4. SANDBOX_004: buy() でポジション購入
5. SANDBOX_005: sell() でポジション売却
6. SANDBOX_006: buy() + sell() のセットを実行

**確認**: 全スキルが正常に取得でき、HUD に表示される

#### BRIDGE モード（応用スキル）

SANDBOX 完了後、以下を確認:

1. BRIDGE_001: reveal_data() を実行してデータ可視化
2. BRIDGE_002: ポジション保有中にデータ可視化
3. BRIDGE_003: SANDBOX + BRIDGE 全スキル取得後の卒業条件

**確認**: ステップエンドで正しいフィードバックが表示される

### 7. スクリーンショット撮影

重要な画面をスクリーンショット撮影:

- **修正後の正常動作**: 例えばスキルツリーで "completed" 表示
- **HUD の表示**: スキル取得数、報酬表示等
- **ゲーム画面**: チャート、ポジション、フィードバック等

スクリーンショットを保存:

```
development_docs/testplay/screenshots/fix-<slug>-<description>.png
```

### 8. テストプレイレポート出力

`development_docs/testplay/fix-<slug>-testplay.md` を生成。

## 出力フォーマット

`development_docs/testplay/fix-<slug>-testplay.md`:

```markdown
# Test Play Report: <Issue タイトル>

**テストプレイ日**: YYYY-MM-DD
**テストプレイ担当**: testplay-agent (Claude Sonnet 4.5)
**所要時間**: X 分

## 再現テスト

Issue の再現手順を実行:

### 手順 1: <ステップ1>
- 実行内容: <何をしたか>
- 結果: ✅ 正常 / ❌ 問題発生
- 詳細: <詳細な説明>

### 手順 2: <ステップ2>
- 実行内容: <何をしたか>
- 結果: ✅ 正常 / ❌ 問題発生
- 詳細: <詳細な説明>

... (全ステップ)

## 修正効果確認

### 修正前の現象
<Issue の「実際の動作」を引用>

例:
`waitForLoadState("networkidle")` が Playwright のデフォルトタイムアウト（30 秒）まで待機し続け、タイムアウトエラーで `beforeEach` が失敗する。

### 修正後の動作
<実際にテストプレイして確認した動作>

例:
`waitForLoadState("load")` + `ensureConnected()` により、ページロード後即座にカーネル接続確認が完了。`beforeEach` がタイムアウトせずに通過。

### 判定
- ✅ 修正効果あり / ❌ 問題残存

## 関連フロー確認

### SANDBOX_001〜006 プレイ
- 実行: ✅ 実施 / ⚠️ スキップ（ゲームバグ以外）
- 結果: 全スキル取得可能 / X 件失敗
- 失敗詳細: (ある場合)

### HUD 表示
- スキル取得数: X/59 スキル
- 報酬表示: 正常 / 異常（例: 負の値）
- ステップエンド: 正常 / 異常

### スキルツリー
- 表示: 正常 / 異常
- ステータス遷移: 正常 / 異常（unlocked → completed）

## スクリーンショット

- `development_docs/testplay/screenshots/fix-<slug>-normal-operation.png` (修正後の正常動作)
- `development_docs/testplay/screenshots/fix-<slug>-skill-tree.png` (スキルツリー)
- `development_docs/testplay/screenshots/fix-<slug>-hud.png` (HUD 表示)

## 総評

<修正がユーザー体験を改善しているか、新たな問題がないか>

例:
修正により、E2E テストが安定して実行できるようになった。ユーザー視点では直接的な変化はないが、開発者の生産性が大幅に向上する。新たな問題は確認されなかった。

## 推奨事項（任意）

<今後の改善案、追加テストの提案等>

例:
- 他のテストスペックでも同様のパターン（`waitForLoadState("load")` + `ensureConnected()`）に統一することを推奨
- ナレッジベース（game-e2e-review-system.md）の知見35a に今回の修正を反映済み
```

## スキップ条件

以下の場合はテストプレイをスキップ:

### Medium / Low 重要度のバグ

テスト自動化のみで検証可能なバグ（例: trades-duplicate-sandbox002-check）:

```markdown
# Test Play Report: <Issue タイトル>

**テストプレイ日**: YYYY-MM-DD
**ステータス**: ⚠️ スキップ（優先度: Medium/Low）

## スキップ理由

本バグは優先度が Medium/Low のため、テストプレイはスキップしました。
test-agent の E2E テストで十分に検証されています。
```

### テスト自動化で完全に検証可能

手動テストが不要なバグ（例: networkidle-timeout）:

test-agent の E2E テスト結果で十分であれば、簡易レポートを出力:

```markdown
# Test Play Report: <Issue タイトル>

**テストプレイ日**: YYYY-MM-DD
**ステータス**: ✅ 簡易確認

## 確認内容

test-agent で E2E テスト（9 tests）が全て通過したため、手動での詳細確認は不要と判断。
簡易的にブラウザでアプリを開き、正常動作を確認。

- スキルツリー表示: ✅ 正常
- HUD 表示: ✅ 正常
- カーネル接続: ✅ 正常
```

## エラーハンドリング

### marimo アプリケーションが起動しない

```
❌ marimo アプリケーションが起動しません

app-agent が正常に完了しているか確認してください。
手動で起動を試みてください: cd D:/Documents/marimo && pnpm dev
```

→ オーケストレーターに報告（警告のみ、次のバグへ進む）

### Issue ファイルが見つからない

```
❌ Issue ファイルが見つかりません: development_docs/issues/<slug>.md
```

→ オーケストレーターに報告（警告のみ、次のバグへ進む）

### 再現手順が不明確

Issue に再現手順が記載されていない、または不明確な場合:

```
⚠️ 再現手順が不明確

Issue に再現手順が記載されていないため、一般的なゲームフローで確認しました。
```

→ 警告を出すが、一般的なゲームフローをプレイして確認

## 成功基準

以下の条件を満たすレポートを生成:

- [ ] Issue の再現手順を実行
- [ ] 修正前の現象が発生しないことを確認
- [ ] 関連フローをプレイ（ゲームバグの場合）
- [ ] スクリーンショット撮影（最低1枚）
- [ ] 修正効果を判定（✅ / ❌）

## 注意事項

- テストプレイは **参考情報**（test-agent のテスト結果が最終判定）
- 失敗してもオーケストレーション全体は中断しない（警告のみ）
- 所要時間は最大15分程度（長時間かかる場合は簡易確認で済ませる）
- High 以上のバグのみ実施（Medium/Low はスキップして時間節約）
