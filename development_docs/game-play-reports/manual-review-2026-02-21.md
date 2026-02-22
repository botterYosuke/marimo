# マニュアルレビュー 2026-02-21

**レビュー日**: 2026-02-21
**レビュアー**: game-manual-review エージェント
**入力**: `development_docs/game-play-reports/play-log-2026-02-21.md`

## 検証対象ドキュメント

| # | ファイル | 概要 |
|---|---------|------|
| 1 | `development_docs/game/game-e2e-review-system.md` | E2E レビューシステム全体ドキュメント（知見 1-40、設計思想、セレクター早見表） |
| 2 | `.claude/skills/game-play/SKILL.md` | ゲームプレイスキル定義（実行方法・期待結果・注意事項） |
| 3 | `.claude/skills/game-setup/SKILL.md` | ゲーム環境整備スキル定義（ファイル配置・サーバー起動手順） |
| 4 | `development_docs/plans/backcast-game-play.md` | Skill Orchestration マニュアル（全体アーキテクチャ・共通情報） |

---

## 発見事項

### 1. game-e2e-review-system.md ヘッダーのテスト数・スイート数が古い

- **ファイル**: `development_docs/game/game-e2e-review-system.md` 行 3
- **該当箇所**: `**ステータス**: 全 9 スイート パス済み（75 passed / 5 skipped / 0 failed）`
- **問題**: プレイログの結果は **10 スイート**（backcast-integration, bridge, data, guard-validation, integration, persistence, sandbox, setup, ui, z-python-e2e）で **69 passed / 9 failed / 5 skipped**（合計 83 テスト）。ヘッダーの「9 スイート」「75 passed」「0 failed」はいずれも古い。新規追加された `data.spec.ts`（11 テスト）、`guard-validation.spec.ts`（3 テスト）、`setup.spec.ts`（10 テスト）が反映されていない。
- **推奨修正**: ヘッダーを `全 10 スイート（69 passed / 9 failed / 5 skipped — guard-validation 3件・integration 5件・bridge/persistence 各1件が既知失敗）` に更新する。安定通過時は `75 passed / 5 skipped` ではなく最新のテスト総数に基づく値を記載する。
- **重要度**: High

### 2. game-e2e-review-system.md ファイル構成リストに新規スペック 4 件が未記載

- **ファイル**: `development_docs/game/game-e2e-review-system.md` 行 190-198
- **該当箇所**:
  ```
  frontend/e2e-tests/game/
  ├── helpers.ts
  ├── constants.ts
  ├── sandbox.spec.ts
  ├── ui.spec.ts
  ├── persistence.spec.ts
  ├── bridge.spec.ts
  ├── integration.spec.ts
  └── z-python-e2e.spec.ts
  ```
- **問題**: 実際には `backcast-integration.spec.ts`、`data.spec.ts`、`guard-validation.spec.ts`、`setup.spec.ts` の 4 ファイルも存在し、プレイログで全てテスト結果が記録されている。ファイル構成リストが 6 spec + 2 support のみで不完全。
- **推奨修正**: 以下を追記する:
  ```
  ├── backcast-integration.spec.ts  # backcast.py 統合テスト（6ケース）
  ├── data.spec.ts                  # データ取得トラック DATA_001〜006（11ケース）
  ├── guard-validation.spec.ts      # buy()/sell() ガード処理テスト（3ケース）
  ├── setup.spec.ts                 # セットアップトラック SETUP_001〜005（10ケース）
  ```
- **重要度**: High

### 3. game-e2e-review-system.md 知見番号 42・43 の参照が本文に未存在

- **ファイル**: `development_docs/game/game-e2e-review-system.md` 行 108, 110, 116
- **該当箇所**:
  - `（知見 42）` — backcast.py ファイル不在バグ修正セッション内で 2 回参照
  - `（知見 43）` — SKILL.md パスバグ修正セッション内で 1 回参照
- **問題**: 知見の本文は `### 38.`（backcast.py 不在）、`### 39.`（layouts 不在）、`### 40.`（SKILL.md パスバグ）までしか存在しない。知見 41/42/43 の見出しは存在しない。完了セクションの「知見 42」は実際には知見 38/39 に、「知見 43」は知見 40 に対応すると推定される。番号の不整合がある。
- **推奨修正**: 完了セクションの `（知見 42）` を `（知見 38・39）` に、`（知見 43）` を `（知見 40）` に修正する。または知見 41-43 を新たに追記して番号を一致させる。
- **重要度**: Medium

### 4. game-e2e-review-system.md 知見の掲載順序が入れ替わっている（34 と 35）

- **ファイル**: `development_docs/game/game-e2e-review-system.md` 行 998, 1044
- **該当箇所**: `### 35.`（行 998）の後に `### 34.`（行 1044）が掲載されている
- **問題**: 知見 35 が知見 34 より先に掲載されており、番号順になっていない。読者が知見番号で検索した際に混乱する。
- **推奨修正**: 知見 34 と 35 の掲載順序を入れ替え、番号昇順に統一する。
- **重要度**: Low

### 5. game-e2e-review-system.md テスト分離戦略のサンプルコードに `"networkidle"` が残存

- **ファイル**: `development_docs/game/game-e2e-review-system.md` 行 335-336
- **該当箇所**:
  ```typescript
  await page.waitForLoadState("networkidle");
  ```
- **問題**: 知見 35a で「`waitForLoadState("networkidle")` は marimo の WebSocket 常時接続のため永遠に到達しない」と明記されている。しかし同ドキュメント内の「テスト分離戦略」セクションのサンプルコードには `"networkidle"` がそのまま残っている。実際の全 spec ファイルでは `"load"` が使用されており、サンプルコードが実態と矛盾している。
- **推奨修正**: `await page.waitForLoadState("networkidle");` を `await page.waitForLoadState("load");` に修正する。
- **重要度**: Medium

### 6. game-play SKILL.md の全スイート所要時間が大幅に過大

- **ファイル**: `.claude/skills/game-play/SKILL.md` 行 40
- **該当箇所**: `全スイート実行（**所要時間: 約1.2時間**）`
- **問題**: プレイログの実行時間は **18.1 分**。game-e2e-review-system.md の過去実績でも最大 16.4 分。「約 1.2 時間」は実態の約 4 倍であり、スキル実行者に不要な待機を強いるか、タイムアウト設定を過大にする原因になる。
- **推奨修正**: `**所要時間: 約20分**` に修正する（マシン性能によるばらつきを考慮し余裕を持たせた値）。
- **重要度**: Medium

### 7. game-play SKILL.md の期待結果「75 passed / 5 skipped」が現状と不一致

- **ファイル**: `.claude/skills/game-play/SKILL.md` 行 46
- **該当箇所**: `> **期待結果**: 全スイート実行時は 75 passed / 5 skipped（`backcast-integration.spec.ts` の 2 skipped 含む）を目安とする。`
- **問題**:
  1. 現在のテスト総数は **83**（regular 78 + fixme 5）で、75 は古い値。
  2. `backcast-integration.spec.ts の 2 skipped` という注釈は、プレイログでは backcast-integration が 6 passed / 0 skipped と記録されている。`test.fixme()` 2 件は Playwright で "skipped" と表示されるはずだが、プレイログの記載と一致しない。
  3. 現状 9 件が failed（guard-validation 2件、integration 5件、bridge 1件、persistence 1件）であり「0 failed」は期待できない状態。
- **推奨修正**: 期待結果を「全スイート実行時はテスト総数約 83 件。既知の不安定テスト（integration.spec.ts 5件、guard-validation.spec.ts 2件等）を除き 69+ passed を目安とする。最新の詳細は `game-e2e-review-system.md` を参照」に更新する。
- **重要度**: High

### 8. backcast-game-play.md の知見番号範囲が古い

- **ファイル**: `development_docs/plans/backcast-game-play.md` 行 195
- **該当箇所**: `| development_docs/game/game-e2e-review-system.md | E2E テスト知見集（知見 1〜35） |`
- **問題**: 実際の知見は 1-40 まで存在する。知見 36（BroadcastChannel イベント抑制）、37（UX プレイテスト問題）、38-39（backcast.py/layouts 不在症状）、40（SKILL.md パスバグ）が含まれていない。
- **推奨修正**: `（知見 1〜40）` に更新する。
- **重要度**: Medium

### 9. game-play SKILL.md の知見 35c 参照が存在しない

- **ファイル**: `.claude/skills/game-play/SKILL.md` 行 123
- **該当箇所**: `page.reload()` は通常使わない（WebSocket 切断が起きる）。ただし ... 接続安定化のために使用する（知見35c）
- **問題**: `game-e2e-review-system.md` の知見 35 にはサブ項目 a（networkidle タイムアウト）と b（再接続スキル再発火）のみが存在し、「35c」は付番されていない。`page.reload()` のリカバリー利用に関する記述は知見 35 の本文に含まれるが、明示的なサブ番号は付与されていない。
- **推奨修正**: `（知見35c）` を `（知見35）` に修正する。
- **重要度**: Low

### 10. game-play SKILL.md の BRIDGE_002 操作コマンド引数が固定値

- **ファイル**: `.claude/skills/game-play/SKILL.md` 行 68
- **該当箇所**: `| 8 | BRIDGE_002 | bt.get_stock_daily("7203") | 株価データ取得 + スキル発火 |`
- **問題**: `skill-data.ts` の BRIDGE_002 の `helpContent` では `get_stock_daily("6758")` （ソニー）を例示しており、「別銘柄を自分で取得する」が BRIDGE_002 の趣旨。トヨタ（7203）を固定値で記載するのはスキルの教育目的と矛盾する。
- **推奨修正**: `bt.get_stock_daily("7203")` を `bt.get_stock_daily(code)` に変更し、備考に「例: "6758" など SANDBOX で使った銘柄以外を推奨」と追記する。
- **重要度**: Low

### 11. プレイログのテストスイート数が実際と不一致

- **ファイル**: `development_docs/game-play-reports/play-log-2026-02-21.md` 行 9
- **該当箇所**: `テストスイート数: 11`
- **問題**: プレイログのスイート別結果テーブルには **10 行**しかない（backcast-integration, bridge, data, guard-validation, integration, persistence, sandbox, setup, ui, z-python-e2e）。実際の spec ファイル数も 10。「11」はカウントミス。
- **推奨修正**: `テストスイート数: 10` に修正する。
- **重要度**: Medium

### 12. プレイログ ui.spec.ts の skipped 数がテーブルとサマリーで不整合の可能性

- **ファイル**: `development_docs/game-play-reports/play-log-2026-02-21.md` 行 7, 23
- **該当箇所**: サマリー `5 skipped`、ui.spec.ts `skipped: 3`
- **問題**: テーブルで skipped が記載されているのは ui.spec.ts の 3 件のみ。合計が 5 になるには残り 2 件の skipped がどこかにあるはずだが、テーブル上の他スイートは全て skipped 0。backcast-integration.spec.ts には `test.fixme()` が 2 件あり、Playwright は fixme を skipped としてカウントするため、backcast-integration の行は「4 passed / 0 failed / 2 skipped」であるべき（テーブルの「6 passed / 0 failed / 0 skipped」は誤り）。
- **推奨修正**: backcast-integration.spec.ts の行を `passed: 4, failed: 0, skipped: 2` に修正する。これでサマリーの 5 skipped（ui 3 + backcast-integration 2）と整合する。
- **重要度**: Medium

---

## サマリー

- 検証ドキュメント数: 4（+ プレイログ自体の検証）
- 発見事項: **12 件**（High: 3, Medium: 6, Low: 3）

### High 事項（即時修正推奨）

| # | 対象 | 概要 |
|---|------|------|
| 1 | game-e2e-review-system.md ヘッダー | テスト数・スイート数が古い（9 スイート/75 passed → 10 スイート/83 テスト） |
| 2 | game-e2e-review-system.md ファイル構成 | 新規 spec 4 件（data, guard-validation, setup, backcast-integration）が未記載 |
| 7 | game-play SKILL.md 期待結果 | 「75 passed / 5 skipped」が現状と乖離。テスト総数 83、既知失敗 9 件あり |

### Medium 事項

| # | 対象 | 概要 |
|---|------|------|
| 3 | game-e2e-review-system.md 知見番号 | 完了セクションで「知見 42/43」を参照するが本文は知見 40 まで |
| 5 | game-e2e-review-system.md サンプルコード | テスト分離戦略の `"networkidle"` が知見 35a と矛盾 |
| 6 | game-play SKILL.md 所要時間 | 「約1.2時間」→ 実測 18 分。約 4 倍の過大見積もり |
| 8 | backcast-game-play.md 知見範囲 | 「知見 1-35」→ 実際は 1-40 |
| 11 | プレイログ スイート数 | 「11」→ 実際は 10 |
| 12 | プレイログ backcast-integration | passed/skipped カウントがテーブルとサマリーで不整合 |

### Low 事項

| # | 対象 | 概要 |
|---|------|------|
| 4 | game-e2e-review-system.md 知見順序 | 知見 34 と 35 の掲載順が入れ替わっている |
| 9 | game-play SKILL.md 知見参照 | 「知見35c」は存在しない。「知見35」が正しい |
| 10 | game-play SKILL.md BRIDGE_002 | 固定値 "7203" ではなく可変引数 `code` が教育目的に適切 |

---

## 正確であることを確認した項目

1. **game-setup SKILL.md のコピー手順**: backcast.py・関連モジュール・`layouts/backcast.grid.json` の全ファイルコピーコマンドが記載されており、game-e2e-review-system.md の完了セクション内容と一致。
2. **game-setup SKILL.md の `MSYS_NO_PATHCONV=1` 説明**: port 2724 起動コマンドの説明が正確。
3. **game-play SKILL.md のスキル発火順序（方法B: 手動操作）**: SANDBOX_001-006 → BRIDGE_001-003 の順序が `game_setup.py` 実装と一致。
4. **game-play SKILL.md の `waitForLoadState("load")` 記述**: 知見 35a と一致しており正確。全 spec ファイルでも `"load"` を使用。
5. **backcast-game-play.md のスキルツリー前提条件チェーン**: `skill-data.ts` の `prerequisites` 配列と一致。
6. **skill-data.ts のスキル総数 59**: プレイログ・SKILL.md・ドキュメント全体で統一されており正確。
7. **game-setup SKILL.md のトラブルシューティング表**: 6 項目全てが実際の環境・知見と一致。
8. **helpers.ts の主要ヘルパー関数名**: ドキュメント記載の全関数が実際に `helpers.ts` に定義されている。
9. **backcast-game-play.md のマイルストーン報酬表**: `skill-data.ts` の `milestones` 定義と一致。
