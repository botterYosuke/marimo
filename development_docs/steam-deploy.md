# Steam GitHub Actions デプロイ

> **ステータス:** 実装完了

## 概要

`.github/workflows/release-steam.yml` で Windows/macOS/Linux の Electron アプリをビルドし、Steam へ自動デプロイするワークフロー。

---

## 現状

| 項目 | 状態 |
|------|------|
| Windows ビルド | 動作中 |
| macOS ビルド | 動作中 |
| Linux ビルド | 動作中 |
| VDF ファイル | 自動生成 |
| GitHub Secrets | 設定済み |
| Steam へのデプロイ | 動作中 |

---

## ワークフロー構成

### トリガー

```yaml
on:
  push:
    branches:
      - sasa/steam
  workflow_dispatch: {}
```

### ジョブ構成

```
build_windows (windows-latest)
build_macos (macos-latest)      → deploy_steam (ubuntu-latest)
build_linux (ubuntu-latest)
```

---

## ビルドジョブの流れ

1. **Checkout** - リポジトリをクローン
2. **Setup pnpm** - pnpm をセットアップ
3. **Setup Node.js** - Node.js 22 をセットアップ
4. **Install Node.js dependencies** - `pnpm install`
5. **Build frontend** - `make fe` でフロントエンドをビルド
6. **Setup uv** - Python パッケージマネージャをセットアップ
7. **Get version** - `uv version --short` でバージョン取得
8. **Create venv** - Python 仮想環境を作成
9. **Install Python dependencies** - `uv pip install -e ".[electron]"`
10. **Build Python executable** - PyInstaller で `marimo-server` をビルド
11. **Build Electron app** - `electron-builder --dir` で unpacked ビルド
12. **Upload artifacts** - GitHub Actions artifacts にアップロード

### アーティファクト

| OS | アーティファクト名 | パス |
|----|-------------------|------|
| Windows | `steam-windows-{version}` | `dist-electron/win-unpacked/` |
| macOS | `steam-macos-{version}` | `dist-electron/mac/` |
| Linux | `steam-linux-{version}` | `dist-electron/linux-unpacked/` |

---

## GitHub Secrets

| Secret 名 | 説明 |
|-----------|------|
| `STEAM_USERNAME` | Steam ビルダーアカウントのユーザー名 |
| `STEAM_CONFIG_VDF` | Base64 エンコードされた config.vdf |

---

## 解決済みの問題

### キャッシュパスエラー (2025-01-29)

**問題:** macOS/Linux ビルドでキャッシュ競合が発生

**解決策:**
1. `setup-node` から `cache: pnpm` を削除
2. `build-frontend` アクションの代わりに直接 `make fe` を実行

### steam/vdf ディレクトリ不在エラー (2026-01-29)

**問題:** `deploy_steam` ジョブでディレクトリが存在しない

**解決策:** アーティファクトダウンロード後にディレクトリを動的に作成
```yaml
- name: Create Steam VDF directory
  run: mkdir -p steam/vdf
```

---

## 参考リンク

- [game-ci/steam-deploy](https://github.com/game-ci/steam-deploy)
- [GameCI Steam Deploy ドキュメント](https://game.ci/docs/github/deployment/steam/)
- [Steam Partner サイト](https://partner.steamgames.com/)
