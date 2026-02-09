# Steamセキュリティ要件に対する見解

## 概要

本ドキュメントは、BackcastPro（marimoベースのElectronゲーム）をSteamで配布する際の、Steamセキュリティ要件に対する我々の見解をまとめたものです。

## Steamのセキュリティ要件

### 禁止事項（Steam Distribution Agreement より）

1. **マルウェア・有害コードの禁止**
   - 予期しない、または有害な方法でユーザーのコンピュータを変更するアプリケーション
   - マルウェア、ウイルス、トロイの木馬を含むソフトウェア
   - Steam認証情報や金融データを不正に収集しようとするアプリ

2. **ユーザーへの攻撃の禁止**（Steam Online Conduct）
   - 他のユーザーのコンピュータを破壊・妨害すること
   - マルウェアのアップロードやリンク

3. **開示義務**
   - カーネルレベルのアンチチートを使用する場合は開示が必須
   - Live-Generated AI使用時はガードレールの開示が必要

## 我々の見解

### 1. Python実行環境の提供について

BackcastProはmarimoノートブック環境を内蔵しており、ユーザーがPythonコードを実行できます。

**Steamルールとの関係:**

| 状況 | Steamルール違反か | 我々の見解 |
|------|------------------|-----------|
| ゲームがユーザーのシステムを破壊 | **違反** | 我々のコードではこれを行わない |
| ユーザー自身がPythonで自分のシステムを操作 | 違反ではない | ユーザーの自己責任だが保護策を講じる |
| 悪意あるコードを他プレイヤーに送信 | **違反** | マルチプレイ機能では送受信データを検証する |

### 2. 我々の責任範囲

**我々が責任を負う領域:**
- ゲーム自体がマルウェア的動作をしないこと
- 既知の危険な操作をデフォルトでブロックすること
- ユーザーに対してPython実行のリスクを明示すること

**ユーザーの自己責任となる領域:**
- サンドボックスを意図的に回避した場合の結果
- 自身で書いたコードによるシステムへの影響

### 3. リスク開示方針

Steamストアページおよびゲーム内で以下を明示します：

```
本ゲームにはPython実行環境が含まれています。
- 悪意あるコードを実行した場合、システムに影響を与える可能性があります
- 信頼できないコードの実行は避けてください
- 本ゲームはセキュリティ制限を実装していますが、完全ではありません
```

### 4. セキュリティ対策の方針

Steamの要件を満たしつつ、ユーザー保護のため以下の対策を実装予定：

1. **Python-levelサンドボックス**
   - 危険なモジュール（subprocess, os, socket等）のブロック
   - 危険なBuiltins（eval, exec, compile等）の制限
   - ファイルシステムアクセスの制限

2. **ネットワーク制限**
   - 許可されたサーバーのみへのアクセス（ホワイトリスト方式）

3. **Electron側の保護**
   - contextIsolation有効化
   - nodeIntegration無効化

## 結論

Steamのセキュリティ要件は主に「**ゲーム開発者がユーザーに害を与えること**」を禁止しています。我々のゲームは：

1. ゲーム自体はマルウェア的動作を行わない ✓
2. Python実行環境の存在とリスクを開示する ✓
3. 可能な範囲でセキュリティ制限を実装する ✓

これにより、Steamの配布要件を満たすと判断します。

## 参考リンク

- [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/)
- [Steam Online Conduct](https://store.steampowered.com/online_conduct/)
- [Steamworks Anti-cheat Documentation](https://partner.steamgames.com/doc/features/anticheat)
- [Steamworks Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding)
