---
name: bug-fix-orchestrate
description: "バグ修正オーケストレーション: development_docs/issues/ の未解決バグを優先度順に修正し、テスト・レビューを自動実行"
allowed-tools:
  - Skill
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

# バグ修正オーケストレーション

## 役割

`development_docs/issues/` の未解決バグを優先度順に修正する総合オーケストレーター。
7つのエージェント（環境構築→起動→計画→実装→レビュー→テスト→テストプレイ）を段階的に実行し、
各バグの修正完了を確認する。

## 実行フロー

### Phase 1: 環境準備（Sequential）

#### Step 1.1: 環境構築エージェント

`agents/env-agent.md` の指示に従って環境を整備:

1. `/game-setup` スキルを実行して開発環境を整備
2. 必要な依存関係を確認（playwright, pixi, pnpm）
3. ビルドチェック実行（`pnpm fe-check`, `make py-check`）

**検証ゲート**: 出力が `READY` であることを確認。`FAILED` の場合はオーケストレーション全体を中断してエラーを報告。

#### Step 1.2: アプリ起動エージェント

`agents/app-agent.md` の指示に従ってサーバーを起動:

1. 既存プロセスをクリーンアップ
2. marimo サーバーを起動（port 2718, 3000）
3. E2E テストサーバーを起動（port 2724）
4. 接続確認

**検証ゲート**: 全サーバーが起動していることを確認。失敗時は手動介入を促して中断。

---

### Phase 2: バグ修正ループ（各バグごとに実行）

以下のバグを**優先度順**に処理:

#### Critical (5) - 最優先
1. `networkidle-timeout-websocket-persistent.md`
2. `disconnected-kernel-cross-spec-contamination.md`
3. `beforeeach-timeout-after-multiple-tests.md`
4. `guard-validation-warning-not-visible.md`
5. `reconnect-skill-event-lost.md`

#### High (4)
6. `bridge001-python-dedup-blocks-e2e-test.md`
7. `state-contamination-auto-instantiate-skill-leak.md`
8. `bug-260221-cell-accumulation-in-notebook.md`
9. `bug-260221-skill-reward-negative-display.md`

#### Medium (1)
10. `bug-260221-backend-list-remove-crash.md`

#### Low (1)
11. `trades-duplicate-sandbox002-check.md`

---

### 各バグの修正ワークフロー

各バグについて以下のステップを順次実行:

#### Step 2.1: バグ修正プラン策定

`agents/plan-agent.md` の指示に従ってプランを策定:

1. Issue ファイル（`development_docs/issues/<slug>.md`）を読む
2. 関連ファイルを調査（Glob, Grep, Read）
3. 根本原因を特定（Issue の「調査メモ」参照）
4. 修正方針を決定（Issue の「修正方針」参照）
5. プランを `development_docs/plans/fix-<slug>-plan.md` に出力

**検証ゲート**: プランが以下を含むことを確認
- [ ] 根本原因の特定
- [ ] 修正対象ファイルのリスト
- [ ] 修正内容の具体的な説明（変更前/変更後のコード例）
- [ ] テスト戦略

検証失敗時は plan-agent を再実行（最大3回）。

---

#### Step 2.2: バグ修正実装

`agents/fix-agent.md` の指示に従って実装:

1. プラン（`development_docs/plans/fix-<slug>-plan.md`）を読む
2. Edit ツールで各ファイルを修正
3. コンパイルエラーチェック（`pnpm fe-check`, `make py-check`）
4. 修正完了レポートを出力

**検証ゲート**: 以下を確認
- [ ] プラン記載の全ファイルを修正済み
- [ ] コンパイルエラーなし

検証失敗時は fix-agent を再実行（最大3回）。3回失敗後は「修正試行中（ブロッカー: <理由>）」として次のバグへ。

---

#### Step 2.3: コードレビュー

`agents/review-agent.md` の指示に従ってレビュー:

1. プランと修正後のコードを読む
2. 以下の観点でレビュー:
   - プラン整合性
   - 型安全性
   - エラーハンドリング
   - パフォーマンス
   - 可読性・保守性
3. レビュー結果を `development_docs/reviews/fix-<slug>-review.md` に出力

**検証ゲート**: レビュー結果が `APPROVED` であることを確認

- `APPROVED`: Step 2.4 へ進む
- `CHANGES_REQUESTED`: Step 2.2 に戻る（最大3ループ）

3ループ後も `CHANGES_REQUESTED` の場合は「修正試行中（ブロッカー: レビュー不合格）」として次のバグへ。

---

#### Step 2.4: テスト実行

`agents/test-agent.md` の指示に従ってテスト:

1. 単体テスト実行（影響を受けるファイル）
2. E2E テスト実行（該当スペック）
3. Critical bugs 修正後: フルスイート実行
4. テスト結果レポート出力

**検証ゲート**: 全テスト通過を確認
- [ ] 単体テスト通過
- [ ] E2E テスト通過（該当スペック）
- [ ] フルスイート通過（Critical bugs のみ）

テスト失敗時:
- エラー内容を fix-agent にフィードバック
- Step 2.2 に戻る（最大3回）
- 3回失敗後は「修正試行中（ブロッカー: テスト失敗）」として次のバグへ

---

#### Step 2.5: テストプレイ（High以上のバグのみ）

バグの重要度が High 以上の場合のみ実行:

`agents/testplay-agent.md` の指示に従って手動検証:

1. Issue の「再現手順」を実行
2. 修正前の現象が発生しないことを確認
3. 関連するゲームフローをプレイ（例: SANDBOX_001〜006）
4. スクリーンショット撮影
5. テストプレイレポートを `development_docs/testplay/fix-<slug>-testplay.md` に出力

**検証ゲート** (任意):
- [ ] 修正前の再現手順で問題が発生しない
- [ ] ユーザー体験が改善されている

失敗時は警告を出すが次のステップへ進む（手動テストは参考情報）。

---

#### Step 2.6: Issue ステータス更新

Issue ファイルを更新:

1. `**ステータス**: Open` → `**ステータス**: ✅ 修正済み` に変更
2. 修正内容と修正日をIssue に追記:

```markdown
## 修正内容

**修正日**: YYYY-MM-DD
**修正プラン**: development_docs/plans/fix-<slug>-plan.md
**レビュー**: development_docs/reviews/fix-<slug>-review.md

<修正内容の簡潔な説明>
```

---

### Phase 3: 最終検証（全バグ修正後）

全11バグの修正が完了（または「修正試行中」でスキップ）したら、最終検証を実行:

#### 3.1: フル E2E スイート実行

```bash
cd D:/Documents/marimo/frontend && npx playwright test e2e-tests/game/ --reporter=line
```

**期待結果**: 80 passed / 0 failed / 5 skipped

#### 3.2: 全単体テスト実行

```bash
cd D:/Documents/marimo/frontend && pnpm test
```

**期待結果**: All tests pass

#### 3.3: 手動フルゲームプレイ

marimo で backcast.py を開き、全59スキルを取得できることを確認。

---

### Phase 4: 最終サマリー出力

`development_docs/bug-fix-orchestrate-summary.md` を生成:

```markdown
# バグ修正オーケストレーション完了

**実行日**: YYYY-MM-DD
**処理バグ数**: 11 件

## 修正完了バグ一覧

| 優先度 | Issue | ステータス | テスト結果 | 備考 |
|--------|-------|-----------|-----------|------|
| Critical | networkidle-timeout | ✅ 修正済み | 9 tests now pass | |
| Critical | disconnected-kernel | ✅ 修正済み | 28 failures → pass | |
| Critical | beforeeach-timeout | ✅ 修正済み | 1 test fixed | |
| Critical | guard-validation | ✅ 修正済み | 3 tests fixed | |
| Critical | reconnect-skill-event | ✅ 修正済み | New test added | |
| High | bridge001-dedup | ✅ 修正済み | Test 3 now pass | |
| High | state-contamination | ✅ 修正済み | 3 failures → pass | |
| High | cell-accumulation | ✅ 修正済み | New reset feature | |
| High | skill-reward-negative | ✅ 修正済み | UI fixed | |
| Medium | backend-list-remove | ✅ 修正済み | Crash prevented | |
| Low | trades-duplicate | ✅ 修正済み | Code cleaned | |

## 成果物

- **修正プラン**: `development_docs/plans/fix-*.md` (11 files)
- **レビュー**: `development_docs/reviews/fix-*.md` (11 files)
- **テストプレイ**: `development_docs/testplay/fix-*.md` (6 files, High以上のみ)
- **更新された Issue**: `development_docs/issues/*.md` (11 files)

## 最終テスト結果

- **E2E テスト**: 80 passed / 0 failed / 5 skipped
- **単体テスト**: All pass
- **フルゲームプレイ**: 全59スキル取得可能 ✅

## 修正試行中のバグ（ブロック中）

（該当があれば記載）

- Issue: <slug>
- ブロッカー: <理由>
- 推奨: 手動対応が必要

## 推奨事項

1. 今後のバグ防止策
2. テストカバレッジ改善案
3. CI/CD への組み込み提案
```

---

## エラーハンドリング

### Per-Bug Fault Isolation

各バグ修正は独立して実行。失敗しても次のバグに進む:

```
try:
  Step 2.1: plan-agent (max 3 retries)
  Step 2.2: fix-agent (max 3 retries)
  Step 2.3: review-agent (max 3 loops back to fix-agent)
  Step 2.4: test-agent (max 3 retries with feedback to fix-agent)
  Step 2.5: testplay-agent (if High+, failure は警告のみ)
  Step 2.6: Update Issue status to ✅
except MaxRetriesExceeded:
  Update Issue status to "修正試行中（ブロッカー: <reason>）"
  Continue to next bug
```

### Critical Failures (Stop Orchestration)

以下の場合はオーケストレーション全体を中断:

1. **env-agent FAILED**: 環境が整わないと全バグ修正が不可能
   - トラブルシューティングガイドを表示
   - 手動介入を促す

2. **app-agent FAILED**: サーバーが起動しないとテストができない
   - サーバーログを確認
   - 手動起動を促す

### Retry Strategy

- **plan-agent**: 最大3回リトライ（プラン品質が不十分な場合）
- **fix-agent**: 最大3回リトライ（コンパイルエラー時）
- **review-agent → fix-agent loop**: 最大3ループ（レビュー不合格時）
- **test-agent → fix-agent loop**: 最大3ループ（テスト失敗時）
- **testplay-agent**: リトライなし（失敗は警告のみ）

---

## 既存インフラの活用

### /game-setup スキル
- env-agent と app-agent で使用
- サーバー起動・ファイル配置・リセットを自動化

### helpers.ts
- test-agent で使用
- `ensureConnected()`, `waitForKernelHealthy()`, `resetGameProgress()` 等の関数を活用

### game-e2e-review-system.md
- test-agent でナレッジベースとして参照
- 知見35a（networkidle禁止）等のルールを適用

### 既存 E2E テスト
- test-agent で実行
- 修正の影響範囲を検証

---

## 注意事項

- 各バグ修正は独立して実行（前のバグ修正が失敗しても次のバグに進む）
- Critical bugs を先に修正することで、後続の High bugs のテストが安定化する
- Step 2.4 のフルスイート実行は Critical bugs 修正後のみ（それ以前は不安定なため）
- テストプレイは High 以上の重要度のバグのみ（Low/Medium はスキップ）
- 部分的成功を許容（一部バグが修正できなくても全体として進捗させる）

---

## 成功基準

オーケストレーション完了時に以下を達成:

1. ✅ 全11 Issue ファイルが `✅ 修正済み` または「修正試行中」にマーク
2. ✅ フル E2E スイート通過（80 tests）
3. ✅ 全単体テスト通過
4. ✅ 手動フルゲームプレイで全59スキル取得可能
5. ✅ 最終サマリー生成（`development_docs/bug-fix-orchestrate-summary.md`）

---

## 実行例

```
# スキル実行
/bug-fix-orchestrate

# Phase 1: 環境準備
→ env-agent: READY ✅
→ app-agent: Servers started ✅

# Phase 2: Bug #1 (networkidle-timeout)
→ plan-agent: Plan created ✅
→ fix-agent: 4 files modified ✅
→ review-agent: APPROVED ✅
→ test-agent: 9 tests fixed ✅
→ Issue updated: ✅ 修正済み

# Phase 2: Bug #2 (disconnected-kernel)
→ plan-agent: Plan created ✅
→ fix-agent: 2 files modified ✅
→ review-agent: APPROVED ✅
→ test-agent: 28 failures → pass ✅
→ testplay-agent: Verified ✅
→ Issue updated: ✅ 修正済み

... (continued for all 11 bugs)

# Phase 3: Final validation
→ Full E2E suite: 80 passed ✅
→ Unit tests: All pass ✅
→ Full gameplay: 59 skills ✅

# Phase 4: Summary
→ Summary report: development_docs/bug-fix-orchestrate-summary.md ✅

🎉 All 11 bugs fixed successfully!
```
