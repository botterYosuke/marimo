# 作業依頼：marimoゲーム（Backcast）を実際にプレイしてください

## 🎯 依頼内容

marimoアプリはゲームです。実際にプレイして、ゲームの動作とスキルツリーシステムを検証してください。

**ゲームデータ**: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`

## 📋 実行方法

**game-e2eスキルを使用してください**（推奨）:

```bash
/game-e2e

```

このスキルは以下を自動実行します：

* marimoサーバーの起動
* Playwrightによるブラウザ操作
* サンドボックスモードのテスト実行
* 失敗時の自動修正

## 📚 参照ドキュメント

作業前に以下を確認してください：

* `.claude/plans/backcast-game-play.md` - 実行計画書（環境準備、トラブルシューティング含む）
* `docs/game-guide.md` - ゲームガイド
* `docs/skill-tree-guide.md` - スキルツリーガイド
* `development_docs/game-e2e-review-system.md` - E2Eテストシステム

## 📝 進捗報告

**重要**: 作業中は`.claude/plans/backcast-game-play.md`に以下を記録してください：

1. **進捗状況**: 完了した作業項目に✅を付ける
2. **新たな知見**: 発見したバグ、改善点など
3. **設計思想と背景**: なぜその実装になっているか
4. **Tips**: 他の作業者に役立つ情報

**記録例**:

```markdown
### 実行ログ

#### ✅ game-e2eスキル実行完了
- 実行時刻: 2026-02-20 14:30
- 結果: 全テスト成功（9スキル獲得）
- 知見: Reconnectedバナーが遅延表示されるケースがあった
  → dismissReconnectedBanner()で対処済み

```

## 🎯 期待される成果

* [ ] ゲームプレイ完了（最低9スキル獲得：SANDBOX 6個 + BRIDGE 3個）
* [ ] スクリーンショット（スキルツリー完了状態）
* [ ] 計画書への進捗・知見の記録
* [ ] 問題があれば報告

---

**質問や問題があれば、計画書に記録するか、直接報告してください。**
