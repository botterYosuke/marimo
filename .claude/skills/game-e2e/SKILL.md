---
name: game-e2e
description: "ゲーム e2e テスト（sandbox.spec.ts）を実行し、失敗時は知見ドキュメントを参照して自動修正を試みる"
allowed-tools:
  - Bash(cd d:/Documents/marimo/frontend && npx playwright test*)
  - Bash(cd d:/Documents/marimo/frontend && pnpm turbo build*)
  - Bash(cp -R d:/Documents/marimo/frontend/dist/* d:/Documents/marimo/marimo/_static/*)
  - Bash(taskkill*)
  - Read
  - Edit
  - Grep
  - Glob
---

# ゲーム e2e テスト実行 & デバッグ

## 参照ドキュメント

**最初に必ず読むこと**: `development_docs/game-e2e-review-system.md`
知見 1〜21、セレクター早見表、設計思想がすべて記載されている。

## 実行手順

### 1. 事前チェック

```bash
taskkill //F //IM marimo.exe 2>/dev/null; echo "cleanup done"
```

### 2. テスト実行

引数なしの場合は sandbox.spec.ts を実行:

```bash
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/sandbox.spec.ts --headed
```

引数 `$ARGUMENTS` が指定された場合はそのファイルを実行:

```bash
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/$ARGUMENTS --headed
```

### 3. 失敗時のデバッグフロー

テストが失敗した場合は以下の順に対処:

1. **エラーメッセージを読む** — Playwright のエラー出力からどのアサーションが失敗したか特定
2. **知見ドキュメントを確認** — `development_docs/game-e2e-review-system.md` の知見 1〜21 に同じ問題がないか検索
3. **ページスナップショットを確認** — `frontend/test-results/` 内のエラーコンテキストを読む
4. **原因別の対処**:

| 症状 | 参照 | 対処 |
|---|---|---|
| `skill-tree-panel` not found | 知見 8, 15 | `skill-tree-button.tsx` のダイアログ構造を確認 |
| `__testCompleteSkill` not found | 知見 14 | `skill-complete-handler.ts` のフック公開を確認 |
| ノードが completed にならない | 知見 17 | `skill-tree-graph.tsx` の `useEffect` 同期を確認 |
| `Reconnected` バナー検出 | 知見 16, 19, 20, 21 | `ensureConnected()` の安定化ループが自動 dismiss する。消えない場合は marimo プロセス残存を確認 |
| Kernel healthy にならない | 知見 19 | `[data-testid="backend-status"]` の SVG クラスを確認。サーバー起動失敗の可能性 |
| バナーが毎テスト出現する | 知見 21 | 正常動作。接続安定化ループが dismiss→1秒待機→再確認で対処する |
| `__testResetProgress` not found | 知見 20 | `skill-complete-handler.ts` のフック公開 + `skill-tree-button.tsx` の `resetProgressAtom` 渡しを確認 |
| 進捗バッジ/現金が見つからない | 知見 15 | `skill-tree-button.tsx` の Badge / CoinsIcon を確認 |
| ファイルが見つからない | 知見 9, 13 | `playwright.config.ts` の `import.meta.dirname` パス解決を確認 |
| ビルドが古い | 知見 10, 18 | `pnpm turbo build` → `cp -R dist/* ../marimo/_static/` |

5. **修正 → 再ビルド → 再テスト**: ソースを修正したら必ずビルドしてから再テスト

```bash
cd d:/Documents/marimo/frontend && pnpm turbo build && cp -R dist/* ../marimo/_static/
cd d:/Documents/marimo/frontend && npx playwright test e2e-tests/game/sandbox.spec.ts --headed
```

6. **知見ドキュメントを更新** — 新たな知見が得られたら `development_docs/game-e2e-review-system.md` に追記

## 重要な制約

- Windows 環境: `make` は使えない。`pnpm turbo build` + `cp -R` で代替（知見 18）
- ESM 環境: `__dirname` は使えない。`import.meta.dirname!` を使う（知見 13）
- React Flow: `useNodesState` は初期値のみ。外部状態同期には `useEffect` 必須（知見 17）
- テストフック: `window.__testCompleteSkill` / `window.__testResetProgress` は `setupSkillEventListener()` が mount 済みの場合のみ使用可能
- テスト間リセット: `page.reload()` は使わない。`__testResetProgress` で atom を直接リセットし WebSocket 接続を維持する（知見 20）
- 接続安定化: `ensureConnected(page)` が各テスト前に Kernel healthy 確認 → バナー dismiss → 1秒安定化待機 → 再確認の安定化ループを実行する（知見 19・21）
