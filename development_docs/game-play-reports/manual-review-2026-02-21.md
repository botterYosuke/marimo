# マニュアル正確性レビュー

**レビュー日**: 2026-02-21
**レビュアー**: game-manual-review エージェント

## 対象ドキュメント

- `development_docs/game-play-reports/play-log-2026-02-21.md`（プレイログ）
- `development_docs/plans/backcast-game-play.md`（オーケストレーションマニュアル）
- `development_docs/game/game-e2e-review-system.md`（E2E レビューシステム）
- `.claude/skills/game-setup/SKILL.md`
- `.claude/skills/game-play/SKILL.md`
- `frontend/e2e-tests/game/helpers.ts`（ソースコード）
- `frontend/src/components/skill-tree/skill-data.ts`（ソースコード）
- `src-tauri/sample-notebooks/game_setup.py`（ソースコード）
- `development_docs/issues/`（Issue ステータス）

---

## 発見した誤り

### 誤り 1: backcast-game-play.md — 参照ドキュメントセクション「知見番号範囲」

- **記載内容**: `| development_docs/game/game-e2e-review-system.md | E2E テスト知見集（知見 1〜35） |`
- **実際の動作**: `game-e2e-review-system.md` には知見 36〜40 が追加されており（知見 36: リセット後のイベント抑制、知見 37: UX プレイテストでのスキルイベント消失問題、知見 38: backcast.py 不在時の症状、知見 39: layouts/ 不在時の症状、知見 40: SKILL.md パスバグ）、最新の知見番号は 40 番まで存在する。さらに `game-e2e-review-system.md` の完了セクションには「知見 42」「知見 43」の参照記述があるが、対応する本文が存在しない（知見番号の最大は 40）。
- **修正案**: `| development_docs/game/game-e2e-review-system.md | E2E テスト知見集（知見 1〜40） |` に更新する。

---

### 誤り 2: game-play SKILL.md — 「注意事項」内の「知見35c」参照

- **記載内容**: `page.reload()` は通常使わない（WebSocket 切断が起きる）。ただし `ensureConnected()` 内部でカーネル disconnected 時のリカバリーとして、および `backcast-integration.spec.ts` の beforeEach で接続安定化のために使用する（知見35c）
- **実際の動作**: `game-e2e-review-system.md` に「知見 35c」という番号は存在しない。知見 35 は a（networkidle タイムアウト）と b（再接続スキル再発火）のサブ項目のみ。`page.reload()` のリカバリー利用に関する記述は知見 35 の本文内に含まれてはいるが、サブ番号「35c」は付与されていない。
- **修正案**: 「知見35c」を「知見35」に修正する。

---

### 誤り 3: game-play SKILL.md — 全スイート期待結果の注釈

- **記載内容**: `> **期待結果**: 全スイート実行時は 75 passed / 5 skipped（`backcast-integration.spec.ts` の 2 skipped 含む）を目安とする。`
- **実際の動作**: game-e2e-review-system.md の「完了（2026-02-21 backcast.py ファイル不在バグ修正セッション）」に「全 9 スイート（80 テスト）パス確認: 75 passed / 5 skipped / 0 failed」と記録されている。今回のフルランでは計 83 テストが実行されており総テスト数が増加している。また「`backcast-integration.spec.ts` の 2 skipped」という注釈は不正確で、実際の最新実行では skipped が 0（6 passed）となっている（プレイログ backcast-integration.spec.ts: 6 passed / 0 failed）。
- **修正案**: 注釈「`backcast-integration.spec.ts` の 2 skipped 含む」を削除し、「最新の詳細は `game-e2e-review-system.md` の実行確認レポートを参照」と記載する。

---

### 誤り 4: game-play SKILL.md — BRIDGE_002 操作コマンドの引数

- **記載内容**: `| 8 | BRIDGE_002 | bt.get_stock_daily("7203") | 株価データ取得 + スキル発火 |`
- **実際の動作**: `backcast-game-play.md` の操作コマンド一覧では `bt.get_stock_daily(code)` と表記されており、固定値ではない。`game_setup.py` の `get_stock_daily` 関数は `code: str` を受け取り任意の銘柄コードを受け付ける。また `skill-data.ts` の BRIDGE_002 の `helpContent` では `get_stock_daily("6758")` （ソニー）を例示しており、「別銘柄を自分で取得する」が BRIDGE_002 の趣旨。固定値 "7203" の記載はミスリーディング。
- **修正案**: `bt.get_stock_daily("7203")` を `bt.get_stock_daily(code)` に変更し、備考に「例: "7203" や "6758"（別銘柄推奨）」と追記する。

---

### 誤り 5: game-e2e-review-system.md — 知見番号 42・43 の参照が本文に未存在

- **記載内容**: 完了セクションに「（知見 42）」「（知見 43）」として参照されている。またタイトルセクションで「SKILL.md を修正: 知見番号の範囲も "1〜35" → "1〜42" に更新」と記載されている。
- **実際の動作**: `game-e2e-review-system.md` の「実装上の知見と落とし穴」セクションに「### 41.」「### 42.」「### 43.」は存在せず、最大は「### 40.」。「（知見 42）」と参照されている backcast.py 不在バグ修正の知見本文は「### 38.」「### 39.」として記録されており、番号が一致しない。
- **修正案**: 完了セクションの「（知見 42）」「（知見 43）」という参照を「（知見 38・39）」「（知見 40）」に修正する。または知見 41〜43 の本文を実際に追記する。「知見番号の範囲も "1〜35" → "1〜42" に更新」という記述は「"1〜35" → "1〜40" に更新」に訂正する。

---

### 誤り 6: game-e2e-review-system.md — テスト分離戦略サンプルコードの `waitForLoadState`

- **記載内容**（「テスト分離戦略」コードスニペット内）:
  ```typescript
  if (needsNavigation) {
    await page.goto(getAppUrl(APP));
    await page.waitForLoadState("networkidle");
  }
  ```
- **実際の動作**: 知見 35a で「`waitForLoadState("networkidle")` は marimo WebSocket 常時接続のため永遠に到達しない」と明記されているが、同ドキュメント内の設計思想セクションのサンプルコードには `"networkidle"` がそのまま残っている。実際の `helpers.ts` では `"networkidle"` は一切使用されず `"load"` を使用している。
- **修正案**: サンプルコード内の `waitForLoadState("networkidle")` を `waitForLoadState("load")` に修正する（知見 35a との整合性確保）。

---

## 曖昧・不足している記述

### 不足 1: game-setup SKILL.md — port 2719〜2723 の起動要否

- **記載内容**: 手順 5 で「port 2718 に加えて 2719〜2724 のサーバーも使用する」「port 2724 だけは手動起動が必要なことが多い」と記載。
- **問題点**: port 2719〜2723 を手動起動すべきかどうかの判断基準が不明確。`playwright.config.ts` の `webServer` に自動起動設定があるのか手動が必要なのかの区別が書かれていない。
- **修正案**: 「2719〜2723 は Playwright が自動起動するため手動操作不要」または「2719〜2723 も確認が必要な場合は `playwright.config.ts` の `webServer` 設定を参照」と明記する。

### 不足 2: game-play SKILL.md — SANDBOX_003 の発火条件

- **記載内容**: 「スキル発火タイミング」セクションに SANDBOX_003 の条件記載なし。
- **実際の実装** (`game_setup.py` の `trades()` 関数):
  ```python
  if "SANDBOX_002" in s:
      emit_skill("SANDBOX_003")
  ```
  `bt.buy()` による SANDBOX_002 完了後に `bt.trades()` を呼ぶことが必須。
- **修正案**: 「SANDBOX_003 は `bt.trades()` 実行かつ SANDBOX_002 完了済みで発火（`bt.buy()` 後に呼ぶこと）」を追記する。

### 不足 3: game-play SKILL.md — guard-validation テストスペックの存在

- **記載内容**: 注意事項に `auto_instantiate = true` や接続関連の知見が記載されているが `guard-validation.spec.ts` への言及がない。
- **問題点**: プレイログで `guard-validation.spec.ts` 全 3 件が失敗しており、ガード機能（`buy()` / `sell()` の警告 callout）の期待動作がテストされているが SKILL.md には未記載。
- **修正案**: 注意事項に「`guard-validation.spec.ts` はガード警告メッセージ（`callout`）のテキスト一致を検証する。テキストが変更された場合はテストも更新が必要」を追記する。

### 不足 4: game-e2e-review-system.md — ファイル構成に新規スペック未記載

- **記載内容**: `frontend/e2e-tests/game/` のファイルリストに `data.spec.ts`、`guard-validation.spec.ts`、`backcast-integration.spec.ts` が含まれていない。
- **実際の状態**: プレイログによれば上記 3 ファイルが存在しテストが実行されている。
- **修正案**: ファイル構成リストに 3 ファイルを追加する（用途の説明も含めて）。

### 不足 5: backcast-game-play.md — 最新テスト結果の期待値が旧状態

- **記載内容**: 全スイート実行時の目安が「75 passed / 5 skipped」（backcast-integration.spec.ts 追加前の値）のみ。
- **問題点**: フルランで現在 83 テストが実行されること、`guard-validation.spec.ts` はガード機能が未実装のため 3 件が常時失敗する既知状態であることが記載されていない。
- **修正案**: 「既知の失敗テスト（guard-validation.spec.ts 3件：ガード機能未実装）を除いた期待値は最新の `game-e2e-review-system.md` を参照」という形式で最新実態を反映する。

---

## 正確であることを確認した項目

1. **game-setup SKILL.md のコピー手順**: backcast.py・関連モジュール・`layouts/backcast.grid.json` の全ファイルコピーコマンドが記載されており、game-e2e-review-system.md「完了（2026-02-21 backcast.py ファイル不在バグ修正セッション）」の内容と一致。

2. **game-setup SKILL.md の `MSYS_NO_PATHCONV=1` 説明**: port 2724 起動コマンドの `MSYS_NO_PATHCONV=1` フラグの説明（Git Bash が `/foo` を Windows パスに変換する問題）が正確で、プレイログ記載の知見と一致している。

3. **game-play SKILL.md のスキル発火順序（方法B: 手動操作）**: `SANDBOX_001 → 002 → 003 → 004 → 005 → 006 → BRIDGE_001 → 002 → 003` の順序は `game_setup.py` の実装と `backcast-integration.spec.ts` の完全プレイフロー（全 6 テスト PASS）と一致している。

4. **game-play SKILL.md の `openSkillTreePanel()` / `runNewCellInGrid()` ヘルパー名**: 実際の `helpers.ts` に同名の関数が存在し、説明と実装が一致している。

5. **game-setup SKILL.md のトラブルシューティング表**: `ModuleNotFoundError: BackcastPro` の解決策として `export PYTHONPATH="/d/Documents/BackcastPro:$PYTHONPATH"` が記載されており、プロジェクト構造（`d:\Documents\BackcastPro`）と一致している。

6. **skill-data.ts のスキル総数**: プレイログ・SKILL.md・ドキュメント全体で「59 スキル」と記載されており正確。

7. **game_setup.py のガードロジック実装**: `buy()` に「まず `bt.chart('7203')` でチャートを表示してください」callout、`sell()` に「保有中の株がありません」callout が実装済みであり、backcast-game-play.md の操作コマンド説明と対応している。ガード機能は実装済み。

8. **game-play SKILL.md の `waitForLoadState("load")` 記述**: 知見 35a と一致しており正確。

9. **backcast-game-play.md のスキルツリー前提条件チェーン**: SANDBOX_003・SANDBOX_004 はともに SANDBOX_002 を前提とし、SANDBOX_005 は SANDBOX_003・SANDBOX_004 の両方を前提とする記述が `skill-data.ts` の `prerequisites` 配列と一致。

10. **Issue ステータス（4件の未対応 Issue）**: `e2e-test-missing-fail002-skill.md`、`e2e-test-missing-fullrun-contamination.md`、`e2e-test-missing-reconnect-skill-event.md`、`e2e-test-missing-step-end-hud-status.md` はいずれも「⬜ 未対応」と記載されており、対応するテストコードが存在しないことを確認した。ステータス表記は正確で更新不要。

11. **game-setup SKILL.md の pnpm dev コマンド**: `cd /d/Documents/marimo && pnpm dev` でバックエンド port 2718・フロントエンド port 3000 という記述は、プレイログの実行環境と一致している。

12. **helpers.ts の主要ヘルパー関数名**: `ensureConnected`、`dismissReconnectedBanner`、`emitSkillEvent`、`emitSkillEventViaHTML`、`emitSkillViaPython`、`openSkillTreePanel`、`getSkillStatus`、`waitForSkillStatus`、`getProgressText`、`getCompletedCount`、`runNewCell`、`runNewCellInGrid`、`resetGameProgress` — いずれも実際に `helpers.ts` に定義されており、ドキュメントの参照と一致している。

---

## 補足: Issue ステータス更新要否

| ファイル | 現ステータス | 実装状況 | 要更新 |
|---------|------------|--------|-------|
| `e2e-test-missing-fail002-skill.md` | ⬜ 未対応 | 未実装 | 不要 |
| `e2e-test-missing-fullrun-contamination.md` | ⬜ 未対応 | 未実装 | 不要 |
| `e2e-test-missing-reconnect-skill-event.md` | ⬜ 未対応 | 未実装 | 不要 |
| `e2e-test-missing-step-end-hud-status.md` | ⬜ 未対応 | 未実装 | 不要 |

4 件すべての Issue は「未対応」と正しく記録されており、修正は不要。
