# マニュアル正確性レビュー

**レビュー日**: 2026-02-21
**対象ドキュメント**:
- `development_docs/plans/backcast-game-play.md`
- `development_docs/game/game-e2e-review-system.md`
- `.claude/skills/game-setup/SKILL.md`
- `.claude/skills/game-play/SKILL.md`

**照合ソースコード**:
- `frontend/e2e-tests/game/helpers.ts`
- `frontend/src/components/skill-tree/skill-data.ts`
- `src-tauri/sample-notebooks/game_setup.py`
- `src-tauri/sample-notebooks/skill_events.py`
- `frontend/e2e-tests/game/guard-validation.spec.ts`（今回追加されたファイル）

**参照プレイログ**: `development_docs/game-play-reports/play-log-2026-02-21.md`

---

## 発見した誤り

### 誤り 1: `development_docs/game/game-e2e-review-system.md` — テスト分離戦略コードスニペットの `waitForLoadState("networkidle")`

- **記載内容**（設計思想セクション「テスト分離戦略」329行目）:
  ```typescript
  await page.goto(getAppUrl(APP));
  await page.waitForLoadState("networkidle");
  ```
- **実際の動作**: 同文書の知見 35a（992〜1008行目）で「marimo は WebSocket を常時接続するため `networkidle` には永遠に到達しない。`"load"` に変更」と明記されている。つまり同一文書内でベストプラクティスとして否定されている `"networkidle"` が、設計思想セクションのサンプルコードにそのまま残っている。これを参考に実装したテストはタイムアウトする。
- **証拠**: `sandbox.spec.ts`、`setup.spec.ts`、`backcast-integration.spec.ts`、`data.spec.ts` は修正済みで `"load"` を使用しているが、`bridge.spec.ts:60`、`guard-validation.spec.ts:36`、`integration.spec.ts:36`、`persistence.spec.ts:41,86,145`、`ui.spec.ts:37`、`z-python-e2e.spec.ts:65` では未修正の `"networkidle"` が残存している。実際に今回のフルラン（2026-02-21）でカテゴリA失敗9件の原因になっている。
- **修正案**: コードスニペット内の `await page.waitForLoadState("networkidle")` を `await page.waitForLoadState("load")` に変更する。また、知見35aを参照しつつ「`"networkidle"` は marimo では使用不可」という警告を `beforeEach` テンプレートに追記する。

### 誤り 2: `development_docs/game/game-e2e-review-system.md` — ヘッダーのステータス行（ベースライン vs 実際の状態）

- **記載内容**（ファイル冒頭 3〜6行目）:
  ```
  ステータス: 全 9 スイート パス済み（75 passed / 5 skipped / 0 failed）
  最終確認日: 2026-02-21（backcast-integration.spec.ts 追加・全 80 テスト実行確認）
  ```
- **実際の動作**: 2026-02-21 のフルラン（プレイログ 148〜165行目）では 10 スイート（`guard-validation.spec.ts` 追加）で **53 passed / 25 failed / 5 skipped（83 テスト）** という結果。「75 passed / 0 failed」という記述は現状と大きく乖離している。また「最終確認日: 2026-02-21」という記述が、実際には失敗が多数ある 2026-02-21 の実行を指すのか、以前の安定通過を指すのか曖昧。
- **乖離の主因**: `guard-validation.spec.ts`（3件）が新規追加されたが対応するドキュメント記録がない。また `"networkidle"` 未修正スイート（bridge, integration, persistence, ui, z-python-e2e）が 9 件失敗、カーネル disconnected 9 件、状態汚染 3 件が累積した。
- **修正案**: ヘッダーを以下のように分割して更新する:
  ```
  ステータス: 53 passed / 25 failed / 5 skipped（83 テスト、2026-02-21 フルラン）
  最終全パス確認日: 2026-02-20（75 passed / 5 skipped / 0 failed、guard-validation.spec.ts 追加前）
  最終実行日: 2026-02-21（guard-validation.spec.ts 追加後・networkidle 未修正スイート含む）
  ```

### 誤り 3: `development_docs/game/game-e2e-review-system.md` — ファイル構成リストに `guard-validation.spec.ts` が未記載

- **記載内容**（ファイル構成セクション 184〜195行目）:
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
- **実際の状態**: `frontend/e2e-tests/game/guard-validation.spec.ts` が追加されており、今回のフルランにも含まれている（3件すべて FAILED）。またファイル構成には `backcast-integration.spec.ts`、`data.spec.ts`、`setup.spec.ts` も記載されていない（これらは後から追加されたと推測）。
- **修正案**: ファイル構成リストに不足している spec ファイルを追記する:
  ```
  frontend/e2e-tests/game/
  ├── helpers.ts
  ├── constants.ts
  ├── sandbox.spec.ts
  ├── ui.spec.ts
  ├── persistence.spec.ts
  ├── bridge.spec.ts
  ├── integration.spec.ts
  ├── z-python-e2e.spec.ts
  ├── backcast-integration.spec.ts  # ← 追加
  ├── data.spec.ts                  # ← 追加
  ├── setup.spec.ts                 # ← 追加
  └── guard-validation.spec.ts      # ← 追加（2026-02-21）
  ```

### 誤り 4: `development_docs/plans/backcast-game-play.md` — スキルツリー前提条件チェーンの FAIL_001/FAIL_002 ノード接続が不正確

- **記載内容**（140〜156行目）:
  ```
  SANDBOX_002 → SANDBOX_003 ─┐
             → SANDBOX_004 ─┤→ SANDBOX_005 → SANDBOX_006
                             └─ FAIL_001
                                FAIL_002（SANDBOX_004 + FAIL_001）
  ```
- **実際の動作**: `game_setup.py` を確認すると:
  - FAIL_001 は `bt.trades()` 呼び出し時（SANDBOX_002完了後）`t.pl < 0` のポジションがあれば発火（170-173行目）か、`bt.step()` 時の `_check_unrealized_loss()` 呼び出し（182-185行目）でも発火する。
  - FAIL_002 は `bt.step()` 後に **決済された**（closed）トレードに損失がある場合に発火する（136-139行目）。「SANDBOX_004 + FAIL_001」という前提条件表記はソースコードに対応しない（skill_events.pyにそのような条件分岐はない）。
  - FAIL_003 は `bt.step()` で `BankruptError` 発生時（131行目）。
- **修正案**: FAIL 系スキルの発火条件をソースコードから正確に記述する:
  ```
  FAIL_001: bt.trades() または bt.step() 実行時に含み損ポジションあり（SANDBOX_002完了後）
  FAIL_002: bt.step() 後に損失で決済されたトレードあり
  FAIL_003: bt.step() で BankruptError 発生（資金0）
  ```

### 誤り 5: `.claude/skills/game-play/SKILL.md` — `runCode` 関数スニペット（関数名が実装と不一致）

- **記載内容**: SKILL.md に `runCode(page, code)` という関数を使用するスニペットが記載されている。
- **実際の動作**: `helpers.ts` にこの名前の関数は存在しない。実際の関数名は `runNewCellInGrid(page, code)` であり、実装はトースト通知の while ループ除去、ダイアログのクローズ処理、`waitFor({ state: "detached" })` によるセル完了待機など大幅に複雑な処理を含む（`helpers.ts:409-474`）。スニペットは実装と乖離した疑似コードになっている。
- **修正案**: 関数名を `runNewCellInGrid` に変更し、「詳細は `frontend/e2e-tests/game/helpers.ts` の `runNewCellInGrid()` を参照」と注記する。

### 誤り 6: `development_docs/game/game-e2e-review-system.md` — 知見35a の修正が「完了済み」と記述されているが実際は未完了

- **記載内容**（100〜104行目）:
  ```
  ✅ 完了（2026-02-20 sandbox.spec.ts 再接続汚染バグ修正セッション）
  - [x] ✅ waitForLoadState("networkidle") タイムアウト修正: marimo は WebSocket を常時接続するため
        networkidle には永遠に到達しない。"load" に変更（知見 35a）
  ```
- **実際の状態**: `sandbox.spec.ts` のみ修正済み（`"load"` を使用）だが、以下のファイルは未修正のまま `"networkidle"` を使用している:
  - `bridge.spec.ts:60`
  - `guard-validation.spec.ts:36`（新規ファイルで最初から `"networkidle"`）
  - `integration.spec.ts:36`
  - `persistence.spec.ts:41,86,145`
  - `ui.spec.ts:37`
  - `z-python-e2e.spec.ts:65`
- **修正案**: 完了チェックを「一部完了（sandbox.spec.ts のみ修正済み）」に変更し、未修正ファイルを列挙した TODO を「未完了・今後の課題」セクションに追記する。

---

## 曖昧・不足している記述

### 不足 1: `development_docs/game/game-e2e-review-system.md` — `guard-validation.spec.ts` に対応するドキュメント記録がない

- **現状**: `guard-validation.spec.ts` が `frontend/e2e-tests/game/` に追加されているが、`game-e2e-review-system.md` の「作業進捗」セクションにも「ファイル構成」セクションにも記載がない。3件すべてが今回フルランで FAILED しており、失敗原因（`waitForLoadState("networkidle")` + `まず.*bt.chart` テキスト不一致）も記録されていない。
- **追記案**: 「未完了・今後の課題」セクションに以下を追記:
  ```
  - [ ] guard-validation.spec.ts の 3 件失敗修正:
    - beforeEach の waitForLoadState("networkidle") → "load" に変更
    - テスト 1 (line 68): page.locator("text=/まず.*bt.chart/") → 実際のガード文言は
      "まず `bt.chart('7203')` でチャートを表示してください"（game_setup.py:87）
      → テキストマッチを "bt.chart" に絞り込むか完全文字列に変更する
    - テスト 3 (line 144): page.locator("text=/保有中の株がありません/") → 実際のガード文言は
      "保有中の株がありません。まず `bt.buy()` で株を購入してください"（game_setup.py:111）
      → テキストマッチは部分一致のはずだが、networkidle タイムアウトで到達しない可能性あり
  ```

### 不足 2: `development_docs/plans/backcast-game-play.md` — スキル総数と各カテゴリの内訳が記載されていない

- **現状**: 「59 スキル」という数字が play-log に登場するが、`backcast-game-play.md` の前提条件チェーン図ではすべてのスキルIDが記載されているわけではない（IND, RISK カテゴリ等）。
- **追記案**: マイルストーン表の下に「全スキル数: 59（SANDBOX×6 + BRIDGE×3 + FAIL×3 + SETUP×5 + DATA×6 + SET×3 + TRADE×10 + CHART×4 + IND×9 + RISK×10 = 59）。マイルストーン最大が 58スキルであり、残り 1 スキルは完走で自動取得の特殊条件スキルとして扱う」と補足する。

### 不足 3: `development_docs/game/game-e2e-review-system.md` — カーネル disconnected 失敗パターン（カテゴリB）の知見が未記録

- **現状**: 知見 35b は「再接続時のスキル再発火」汚染パターンを説明しているが、テスト間のカーネル回復待ち不足（カテゴリB: `data.spec.ts:94`、`integration.spec.ts:51,131,154,177` 等 9件）については知見として未記録。
- **追記案**: 知見 36 以降に以下を追記:
  ```
  ### カーネル disconnected 連鎖失敗（2026-02-21 フルラン観察）
  症状: あるスイートがカーネルを消耗させると、次スイートの接続確認で
        "disconnected" 状態が継続しテストが失敗する。
  対策: スイート間に十分な回復待機を設けるか、各スイートの afterAll で
        カーネルの健全性を確認する。
  ```

### 不足 4: `development_docs/plans/backcast-game-play.md` — FAIL スキルのトリガー操作手順が記載されていない

- **現状**: FAIL_001〜FAIL_003 は前提条件チェーン図に登場するが、どの操作で発火するかの説明がない。ゲームプレイ中にどうすれば FAIL スキルを意図的にトリガーできるかが不明。
- **追記案**: 操作コマンド表の下に FAIL 系スキルの発火手順を追記:
  ```
  | FAIL_001 | bt.trades() または bt.step() 時に含み損（bt.buy() 後に株価下落して step/trades 実行） |
  | FAIL_002 | bt.step() 後に損失決済（sell 後 step で損失トレード確定） |
  | FAIL_003 | bt.step() で破産（資金ゼロ以下でポジションがあり step を実行） |
  ```

### 不足 5: `development_docs/game/game-e2e-review-system.md` — BUG-NEW-1（ValueError: list.remove）の記録がない

- **現状**: プレイログで「BUG-NEW-1: バックエンドクラッシュ（ValueError: list.remove）」が発見されているが、game-e2e-review-system.md には記録されていない。
- **追記案**: 「未完了・今後の課題」セクションに追記:
  ```
  - [ ] BUG-NEW-1: 複数 WebSocket クライアント同時接続時に ValueError: list.remove(x): x not in list
        でマリモバックエンドがクラッシュする（2026-02-21 観察）。
        再現条件: E2E テスト並列実行中に別クライアントから __testResetProgress() を呼んだ際。
  ```

### 不足 6: `development_docs/plans/backcast-game-play.md` — SANDBOX_001 初期報酬の「報酬表示マイナス問題」が未記録

- **現状**: プレイログで「-30,000円」と表示されるが実際は報酬（正の値）というバグが観察されている。ソースコード（`skill-data.ts:17`）では `description: "+30,000円"` と正しく定義されているが、フロントエンドのレンダリングで符号が反転している。このバグはどのドキュメントにも記録されていない。
- **追記案**: `game-e2e-review-system.md` の「未完了・今後の課題」に「P2: スキルカード内の報酬金額表示が "+30,000円" ではなく "-30,000円" と表示されるレンダリングバグ」を追記する。

---

## 正確であることを確認した項目

- [x] **SANDBOX_001 トリガー**: `bt.chart("7203")` で `emit_skill("SANDBOX_001")` が発火する（`game_setup.py:74`）— ドキュメント記載と一致
- [x] **SANDBOX_002 トリガー**: `bt.buy()` で `emit_skill("SANDBOX_002")` が発火する（`game_setup.py:99`）— ドキュメント記載と一致
- [x] **SANDBOX_003 トリガー**: `bt.trades()` で `emit_skill("SANDBOX_003")` が発火する（SANDBOX_002完了後、`game_setup.py:171`）— ドキュメント記載と一致
- [x] **SANDBOX_004 トリガー**: `bt.sell()` で `emit_skill("SANDBOX_004")` が発火する（`game_setup.py:117`）— ドキュメント記載と一致
- [x] **SANDBOX_005 発火条件**: `chart()` 呼び出し時に SANDBOX_003 AND SANDBOX_004 が完了済みで SANDBOX_005 未完了の場合に自動発火（`game_setup.py:75-76`）— `skill-data.ts` の prerequisites と一致
- [x] **BRIDGE_001 トリガー**: `bt.reveal_data()` で `emit_skill("BRIDGE_001")` が発火する（`game_setup.py:162`）— ドキュメント記載と一致
- [x] **BRIDGE_002 トリガー**: `bt.get_stock_daily(code)` で `emit_skill("BRIDGE_002")` が発火する（`game_setup.py:237`）— ドキュメント記載と一致
- [x] **操作コマンド一覧の正確性**: `backcast-game-play.md` に記載の 7 コマンド（`bt.chart`, `bt.buy`, `bt.sell`, `bt.step`, `bt.trades`, `bt.reveal_data`, `bt.get_stock_daily`）がすべて `game_setup.py` に実装されている
- [x] **初期資産**: サンドボックスモードは ¥100,000 で開始（`game_setup.py:25`）— プレイログ観察（¥100,000）と一致
- [x] **マイルストーン定義**: `backcast-game-play.md` のマイルストーン表（10/20/35/50/58スキル、称号・ボーナス）が `skill-data.ts` の Milestone 定義と一致している
- [x] **スキル重複発火防止（dedup）**: `emit_skill()` 内で `_triggered_skills` セットをチェックし重複発行を防ぐ（`skill_events.py:29-31`）
- [x] **SANDBOX_006 自動発火**: SANDBOX_001〜005 全完了で `_check_graduations()` が SANDBOX_006 を自動発火する
- [x] **`emitSkillEvent` 関数シグネチャ**: `helpers.ts` の `emitSkillEvent(context, page, skillId)` の引数順序が正しい
- [x] **`openSkillTreePanel` 実装方式**: ダイアログモードに対応（`data-testid="skill-tree-button"` クリック後 `data-testid="skill-tree-panel"` 確認、`helpers.ts:274-293`）
- [x] **`bt.buy()` 売却ガード**: 株保有中に `bt.buy()` がガードして None を返す（`game_setup.py:90-95`）— guard-validation.spec.ts のテスト 2 が検証
- [x] **`bt.sell()` 保有ガード**: 株未保有時に `bt.sell()` がガードして None を返す（`game_setup.py:109-114`）— guard-validation.spec.ts のテスト 3 が検証
- [x] **`bt.buy()` データなしガード**: bt._data が空の場合に `bt.buy()` がガードして callout を表示する（`game_setup.py:85-89`）— guard-validation.spec.ts のテスト 1 が検証
- [x] **SKILL_CHANNEL 定数の一致**: `helpers.ts:15` の `SKILL_CHANNEL = "skill_event_channel"` と `skill_events.py` の `channel="skill_event_channel"` が一致している
- [x] **`skill-data.ts` スキル総数**: `skillDefinitions` 配列に 59 スキルが定義されている — プレイログ観察（0/59 スキル）と一致
- [x] **`resetGameProgress` の実装**: `window.__testResetProgress()` + ダイアログ close + waitForTimeout(300) の構成が `helpers.ts:523-548` に正しく実装されている
- [x] **知見35a の内容（修正方向性）**: `"networkidle"` → `"load"` 変更という方向性は正しく、知見として正確に記録されている（記録は正確だが適用が未完了という別問題がある）
- [x] **`backcast-integration.spec.ts` 全 6 テスト PASS**: 完全プレイフロー（SANDBOX_001〜006 + BRIDGE_001〜003）の検証が 2026-02-21 フルランで確認されている

---

## 補足: 今回の E2E テスト失敗と「前回ベースライン 75 passed」乖離について

### 75 passed → 53 passed の乖離原因

今回のフルランで 25 件の失敗が生じた主因は以下の 3 点:

| 原因 | 件数 | 詳細 |
|------|------|------|
| `"networkidle"` 未修正スイート | 9件 | bridge/guard-validation/integration/persistence/ui/z-python-e2e で修正が適用されていない |
| カーネル disconnected（テスト間回復待ち不足） | 9件 | data/integration/persistence/sandbox/setup/z-python-e2e |
| 状態汚染（auto_instantiate によるスキルリーク） | 3件 | integration/persistence |
| ガード機能テスト失敗（guard-validation） | 3件 | networkidle + 可能性として文言不一致 |
| UI 現金表示の初期値問題 | 1件 | ui.spec.ts |

**「前回ベースライン 75 passed」はスイート数が 9（guard-validation.spec.ts 追加前）であり、今回の 10 スイート（83テスト）とは異なる条件の実行である**。同じ条件で比較可能なのは backcast-integration.spec.ts を含む 80テスト構成で、そこから guard-validation.spec.ts の 3 件を加えた 83 テスト構成が今回の実行。ベースラインと今回で networkidle 問題が「修正済み」と記録されていながら未適用のスイートが多数残っていることが最大の乖離要因。

---

## サマリー

| 分類 | 件数 |
|------|------|
| 誤り（修正必要） | 6件 |
| 不足・曖昧（追記推奨） | 6件 |
| 正確であることを確認した項目 | 22件 |

---

## マニュアルレビュー 2026-02-21（追記）

**レビュアー**: game-manual-review skill（Claude Sonnet 4.6）
**照合ソース**:
- `src-tauri/sample-notebooks/game_setup.py`（実装）
- `src-tauri/sample-notebooks/skill_events.py`（実装）
- `frontend/e2e-tests/game/guard-validation.spec.ts`（新規テスト）
- `development_docs/issues/sell-buy-no-guard-crash.md`
- `development_docs/issues/bridge001-python-dedup-blocks-e2e-test.md`
- `development_docs/issues/bridge003-graduation-missing-bridge001-check.md`
- `development_docs/issues/fail002-wrong-timing-in-sell.md`
- `development_docs/issues/step-end-status-label-wrong.md`
- `development_docs/plans/backcast-game-play.md`

---

### 確認結果

| 項目 | ドキュメント記載 | 実際の動作 | 一致/不一致 |
|------|----------------|-----------|-----------|
| `bt.buy()` データなし時の警告 | `sell-buy-no-guard-crash.md`: 「未修正」、クラッシュすると記述 | `game_setup.py:85-90` に callout ガードが実装済み。「まず `bt.chart('7203')` でチャートを表示してください」を表示して `return None` | **不一致（Issue が古い）** |
| `bt.buy()` 重複購入時の警告文言 | `sell-buy-no-guard-crash.md` 修正案: 「すでにポジションを保有しています。`bt.sell()` で売却してください」 | `game_setup.py:93`: 「すでに株を保有中です。`bt.sell()` で売却してから再度購入してください」 | **不一致（警告文言が異なる）** |
| `bt.sell()` ポジションなし時の警告文言 | `sell-buy-no-guard-crash.md` 修正案: 「保有中のポジションがありません。まず `bt.buy()` で株を購入してください」 | `game_setup.py:111`: 「保有中の株がありません。まず `bt.buy()` で株を購入してください」 | **不一致（「ポジション」→「株」）** |
| BRIDGE_003 卒業チェック（BRIDGE_001 確認） | `bridge003-graduation-missing-bridge001-check.md`: 「BRIDGE_002 のみ確認、BRIDGE_001 なしで BRIDGE_003 が発火する」 | `skill_events.py:62`: `"BRIDGE_001" in s and "BRIDGE_002" in s` で BRIDGE_001 も確認済み | **不一致（Issue が修正済みコードを参照していない）** |
| FAIL_002 発火タイミング | `fail002-wrong-timing-in-sell.md`: `sell()` 内で `bt.closed_trades` を参照しているためバグ | `game_setup.py:136-139`: FAIL_002 は `step()` 内で `new_closed` トレードをチェック（`sell()` ではない） | **不一致（Issue が古い実装を参照）** |
| `step()` ゲーム終了ステータス | `step-end-status-label-wrong.md`: 「ゲーム終了後も "Trading" のまま」 | `game_setup.py:141-145`: `if result: "Trading" else: "Finished"` で条件分岐済み | **不一致（Issue が修正済みコードを参照していない）** |
| BRIDGE_001 単独テスト失敗原因 | プレイログ BUG-1: 「BRIDGE_001 フロントエンドカウント未反映、原因不明」 | `bridge001-python-dedup-blocks-e2e-test.md`: Python 側 `_triggered_skills` の dedup が原因。`resetGameProgress()` は Jotai のみリセットし Python 側は非リセット | **記述が不十分（原因は特定済み）** |
| guard-validation テスト失敗の根本原因 | プレイログ カテゴリD: 「ガード警告メッセージのテキストが実装と一致しないか、機能自体が未実装」 | `game_setup.py` には実装済み。失敗原因は `parents[3]` パス解決エラー + `networkidle` タイムアウト（`guard-validation-warning-not-visible.md` 参照） | **不一致（機能未実装ではなくテストのセットアップコードのバグ）** |
| `backcast-game-play.md` スキル前提条件チェーン BRIDGE_003 | `BRIDGE_001 → BRIDGE_002 → BRIDGE_003` | `skill_events.py:62`: BRIDGE_003 は BRIDGE_001 AND BRIDGE_002 で自動発火（正しい）、`skill-data.ts` prerequisites も一致 | 一致 |
| SANDBOX_001〜006 完全フロー | `backcast-game-play.md` 記載の操作手順 | E2E `backcast-integration.spec.ts` で 6 テスト全 PASS | 一致 |

---

### 誤り・不一致（5件）

#### [DR-001] `sell-buy-no-guard-crash.md` のステータスが「未修正」だが実装は修正済み

- **場所**: `development_docs/issues/sell-buy-no-guard-crash.md:7`
- **記載内容**: `**ステータス**: 未修正`、`buy()` と `sell()` に「ガードが一切ない」と記述されており、ガードのないコードスニペットが Root Cause として掲載されている
- **実際**: `src-tauri/sample-notebooks/game_setup.py` の `buy()`（85-95行目）と `sell()`（109-114行目）にはガード処理が既に実装されている。`bt._data` 空チェック・ポジション保有チェック・callout 表示・`return None` がすべて実装済み
- **修正案**: Issue ステータスを「修正済み」に更新し、修正されたコードスニペットを記録する

#### [DR-002] `sell-buy-no-guard-crash.md` 修正案の警告文言が実際の実装と異なる

- **場所**: `development_docs/issues/sell-buy-no-guard-crash.md:74-90`（修正案コードスニペット）
- **記載内容**:
  - `buy()` 二重購入ガード: 「すでにポジションを保有しています。`bt.sell()` で売却してください」
  - `sell()` 未保有ガード: 「保有中のポジションがありません。まず `bt.buy()` で株を購入してください」
- **実際**: `game_setup.py` の実装:
  - `buy()` 二重購入ガード（93行目）: 「すでに株を保有中です。`bt.sell()` で売却してから再度購入してください」
  - `sell()` 未保有ガード（111行目）: 「保有中の株がありません。まず `bt.buy()` で株を購入してください」
- **影響**: `guard-validation.spec.ts` のテスト 2 が `text=/すでに株を保有中/` ではなく `text=/すでに.*ポジション/` を期待するように書かれた場合、テストが誤ってパスまたは失敗する。今回のテストは `text=/すでに株を保有中/` を正しく使用しているため問題なし
- **修正案**: Issue 文書の修正案スニペット内の警告文言を実装と一致させる（「ポジション」→「株」、「再度購入してください」文言の追加）

#### [DR-003] `bridge003-graduation-missing-bridge001-check.md` が修正済みコードを参照せず「未修正」のまま

- **場所**: `development_docs/issues/bridge003-graduation-missing-bridge001-check.md:7` および `36-37行目`
- **記載内容**: ステータス「未修正」。Root Cause コードスニペットとして `if "BRIDGE_002" in s:` のみを示し、BRIDGE_001 の確認がないとしている
- **実際**: `skill_events.py:62` は既に `if "BRIDGE_001" in s and "BRIDGE_002" in s:` に修正済み。Issue に記載されていた修正案が実装されている
- **修正案**: Issue ステータスを「修正済み」に更新し、修正されたコード行を記録する

#### [DR-004] `fail002-wrong-timing-in-sell.md` が修正済みの実装を参照せず「未修正」のまま

- **場所**: `development_docs/issues/fail002-wrong-timing-in-sell.md:7` および `35-47行目`
- **記載内容**: ステータス「未修正」。`sell()` 内で `bt.closed_trades` を参照するコードを Root Cause として掲載
- **実際**: `game_setup.py` の `sell()` 関数には FAIL_002 の発火コードが存在しない（38行目、`emit_skill("SANDBOX_004")` のみ）。FAIL_002 は `step()` 内の `new_closed` チェック（136-139行目）で発火されており、「オプション A: `step()` 内でチェックする」という推奨修正案が既に実装済み
- **修正案**: Issue ステータスを「修正済み（オプション A で実装）」に更新する

#### [DR-005] `step-end-status-label-wrong.md` が修正済みの実装を参照せず「未修正」のまま

- **場所**: `development_docs/issues/step-end-status-label-wrong.md:7` および `34-39行目`
- **記載内容**: ステータス「未修正」。`step()` 内で `result` に関わらず `status_label="Trading"` を送信する Root Cause コードを掲載
- **実際**: `game_setup.py:141-145` は以下の通り修正済み:
  ```python
  if result:
      publish_state_headless(bt, status_label="Trading", status_variant="default")
  else:
      publish_state_headless(bt, status_label="Finished", status_variant="secondary")
  ```
  Issue の修正案（`status_variant="success"`）とは `status_variant` の値が異なる（`"success"` ではなく `"secondary"`）が、ステータスラベルの条件分岐自体は実装済み
- **修正案**: Issue ステータスを「修正済み（`status_variant` は "secondary" で実装）」に更新する

---

### 追記が必要な不一致（2件）

#### [DR-006] `guard-validation.spec.ts` 失敗の根本原因がプレイログで「機能未実装」と誤診断されている

- **場所**: `development_docs/game-play-reports/play-log-2026-02-21.md:64` BUG-2
- **記載内容**: 「`backcast.py` にガードロジックが実装されていない可能性」
- **実際**: ガードロジックは `game_setup.py` に実装済み。失敗の根本原因は `guard-validation-warning-not-visible.md` で分析されており 2 つある:
  1. `beforeEach` の `waitForLoadState("networkidle")` がタイムアウト（知見 35a 違反）
  2. テスト注入コードが `Path(__file__).resolve().parents[3]` でパス解決するが、`game_test.py` の位置（`frontend/e2e-tests/py/game_test.py`）では `.parents[3]` がリポジトリルートより上を指し `ImportError` になる可能性がある
- **修正案**: プレイログ BUG-2 の原因を「機能未実装」から「テストのセットアップコードにおけるパス解決エラーおよび networkidle タイムアウト」に訂正する

#### [DR-007] プレイログ BRIDGE_001 BUG-1 の原因が「不明」のまま記録されている

- **場所**: `development_docs/game-play-reports/play-log-2026-02-21.md:56-58`（BUG-1）
- **記載内容**: 「完全プレイフローでは正常動作するが、単独テストでは失敗」とあるが原因の記録がない
- **実際**: `bridge001-python-dedup-blocks-e2e-test.md` で原因が特定済み。Python 側 `_triggered_skills` のモジュールライフタイム持続 + `resetGameProgress()` が Jotai atom のみリセットし Python 側をリセットしないため、`emit_skill("BRIDGE_001")` が dedup により no-op になる。完全フローが成功するのは `emitSkillEvent()`（`window.__testCompleteSkill()` 経由）を使用しており Python カーネルを経由しないため
- **修正案**: プレイログ BUG-1 に「原因: Python `_triggered_skills` の dedup。詳細は `issues/bridge001-python-dedup-blocks-e2e-test.md` 参照」を追記する

---

### 今回の追記サマリー

| 分類 | 件数 |
|------|------|
| 誤り・不一致（Issue ステータス誤記） | 5件（DR-001〜005） |
| プレイログの誤診断・情報不足 | 2件（DR-006〜007） |
| 確認した正確な項目 | BRIDGE_003 卒業チェック修正済み確認・guard 実装済み確認 |

**総括**: 今回の追記で明らかになった最重要事項は、`sell-buy-no-guard-crash.md`・`bridge003-graduation-missing-bridge001-check.md`・`fail002-wrong-timing-in-sell.md`・`step-end-status-label-wrong.md` の 4 件の Issue が「未修正」と記載されているにもかかわらず、実装はすでに修正済みである点。Issue ドキュメントの更新が実装に追いついていない。`guard-validation.spec.ts` の 3 件失敗は「機能未実装」ではなく「テストのセットアップコードのバグ」であり、修正は `game_setup.py` ではなくテストファイル側に必要。
