# Issue: 複数 WebSocket クライアント同時接続時に ValueError: list.remove でバックエンドクラッシュ

**報告日**: 2026-02-21
**重要度**: P2
**状態**: ✅ 修正済み

## 症状

複数の WebSocket クライアント（Playwright MCP ブラウザ + E2E テスト）が同時接続している状態で、以下のエラーが発生してマリモバックエンドがクラッシュする。

```
[backend] ValueError: list.remove(x): x not in list
```

カーネルの再起動が必要になり、ゲームセッションが切断される。

## 再現手順

1. `pnpm dev` および `marimo` バックエンドを起動する
2. E2E テスト (`npx playwright test e2e-tests/game/ --reporter=list`) をバックグラウンドで実行する
3. 別途 Playwright MCP ブラウザで `backcast.py` を手動操作する
4. `window.__testResetProgress()` を MCP ブラウザから呼び出す
5. バックエンドコンソールに `ValueError: list.remove(x): x not in list` が表示され、WebSocket 接続が切断される

## 原因分析

marimo バックエンドの WebSocket セッション管理において、クライアントの切断処理時に内部リストから要素を削除する際に、すでに削除済みの要素を再度削除しようとしている可能性がある。

具体的には以下のシナリオが考えられる:

- 複数クライアントが同時接続しており、一方のクライアントのセッション切断と他方のリセット操作が競合する
- `list.remove(x)` を呼び出す前にリスト内の存在チェックがされていない
- E2E テストによる並列 WebSocket 接続中に手動操作が加わることで、セッション管理のリストが不整合になる

関連する可能性のある marimo バックエンドのコード:
- `marimo/_server/sessions.py` のセッション管理
- WebSocket 接続/切断のハンドラー

## 影響範囲

- **開発者**: E2E テスト並列実行中に手動操作するセッション（開発時のデバッグ作業）で頻発する可能性
- **エンドユーザー**: 通常の単一クライアント使用では発生しにくいが、タブを複数開いた状態でリセット操作を行うと発生する可能性
- ゲームセッションが強制終了されるため、プレイ中のデータが失われる
- 再現条件が特定されていないため、影響範囲の特定が困難

## 対応案

1. **即時対応**: `list.remove(x)` の呼び出し前に `x in list` チェックを追加する
   ```python
   if x in some_list:
       some_list.remove(x)
   ```
2. **根本対応**: WebSocket クライアントリストの管理を `list` から `set` に変更し、`discard()` メソッドを使用することで存在チェックなしに安全な削除を実現する
3. **調査**: `marimo/_server/sessions.py` および WebSocket ハンドラーで `list.remove` を使用している箇所を特定し、競合状態が発生するかを確認する

## ログ

```
タイムスタンプ: 2026-02-21 10:59 頃
エラー: ValueError: list.remove(x): x not in list
状況: E2E テスト並列実行中、MCP ブラウザから window.__testResetProgress() 呼び出し後
```

## 修正内容

**修正日**: 2026-02-21
**コミット**: バグ修正オーケストレーション

`marimo/_server/rtc/doc.py` の `remove_client()` メソッドで、`self.loro_docs_clients[file_key].remove(update_queue)` の呼び出し前に `if update_queue in self.loro_docs_clients[file_key]:` チェックを追加。これにより同一 queue の二重削除による `ValueError` を防止。
