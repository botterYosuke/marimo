# Steam GitHub Actions デプロイ - 実装完了

## 概要

`.github/workflows/release-steam.yml` で Windows/macOS/Linux の Electron アプリをビルドし、Steam へ自動デプロイするワークフロー。

## 現状

| 項目 | 状態 |
|------|------|
| Windows ビルド | ✅ 動作中 |
| macOS ビルド | ✅ 動作中 |
| Linux ビルド | ✅ 動作中 |
| VDF ファイル | ✅ 自動生成 (`steam/vdf/` を動的作成) |
| GitHub Secrets | ✅ 設定済み |
| Steam へのデプロイ | ✅ 動作中 |

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

## ビルドジョブの流れ

各 OS のビルドジョブは以下のステップを実行:

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

## デプロイジョブ

```yaml
deploy_steam:
  name: 🚂 Deploy to Steam
  needs: [build_windows, build_macos, build_linux]
  runs-on: ubuntu-latest

  steps:
    - name: ⬇️ Checkout repo
      uses: actions/checkout@v4

    - name: Install uv
      uses: astral-sh/setup-uv@v7

    - name: 🔨 Get version
      id: get_version
      run: |
        version=$(uv version --short)
        echo "marimo_version=$version" >> $GITHUB_OUTPUT

    - name: 📥 Download Windows build
      uses: actions/download-artifact@v4
      with:
        name: steam-windows-${{ steps.get_version.outputs.marimo_version }}
        path: dist-electron/win-unpacked/

    - name: 📥 Download macOS build
      uses: actions/download-artifact@v4
      with:
        name: steam-macos-${{ steps.get_version.outputs.marimo_version }}
        path: dist-electron/mac/

    - name: 📥 Download Linux build
      uses: actions/download-artifact@v4
      with:
        name: steam-linux-${{ steps.get_version.outputs.marimo_version }}
        path: dist-electron/linux-unpacked/

    - name: 📁 Create Steam VDF directory
      run: mkdir -p steam/vdf

    - name: 🚂 Deploy to Steam
      uses: game-ci/steam-deploy@v3
      with:
        username: ${{ secrets.STEAM_USERNAME }}
        configVdf: ${{ secrets.STEAM_CONFIG_VDF }}
        appId: 4228740
        buildDescription: "v${{ steps.get_version.outputs.marimo_version }}"
        rootPath: steam/vdf
        depot1Path: ../../dist-electron/win-unpacked
        depot2Path: ../../dist-electron/mac
        depot3Path: ../../dist-electron/linux-unpacked
```

## GitHub Secrets

| Secret 名 | 説明 |
|-----------|------|
| `STEAM_USERNAME` | Steam ビルダーアカウントのユーザー名 |
| `STEAM_CONFIG_VDF` | Base64 エンコードされた config.vdf |
| `TURBO_TOKEN` | Turborepo キャッシュトークン |
| `CODECOV_TOKEN` | Codecov トークン |

## VDF ファイル構成

`game-ci/steam-deploy@v3` がデプロイ時に以下の VDF マニフェストを自動生成する（事前作成不要）:

```
steam/vdf/                     # ワークフロー内で動的に作成
├── manifest.vdf               # メインアプリビルド設定 (自動生成)
├── depot4228741.vdf           # Windows デポ (自動生成)
├── depot4228742.vdf           # macOS デポ (自動生成)
└── depot4228743.vdf           # Linux デポ (自動生成)
```

## 解決済みの問題

### キャッシュパスエラー (2025-01-29)

**問題:** macOS/Linux ビルドで以下のエラーが発生
```
Error: Path Validation Error: Path(s) specified in the action for caching do(es) not exist
```

**原因:** メインワークフローと `build-frontend` アクションの両方で `setup-node` with `cache: pnpm` が実行され、キャッシュ競合が発生

**解決策:**
1. `setup-node` から `cache: pnpm` を削除
2. `build-frontend` アクションの代わりに直接 `make fe` を実行

詳細: [memoized-hugging-lightning.md](memoized-hugging-lightning.md)

### steam/vdf ディレクトリ不在エラー (2026-01-29)

**問題:** `deploy_steam` ジョブで以下のエラーが発生
```
ERROR! Content root folder does not exist: /github/workspace/steam/vdf.
```

**原因:** `game-ci/steam-deploy@v3` の `rootPath: steam/vdf` で指定されたディレクトリがリポジトリに存在しない

**解決策:** アーティファクトダウンロード後、Steam デプロイ前にディレクトリを動的に作成するステップを追加
```yaml
- name: 📁 Create Steam VDF directory
  run: mkdir -p steam/vdf
```

**備考:** `game-ci/steam-deploy` アクションは VDF マニフェストファイルを自動生成するため、事前にファイルを配置する必要はない。`rootPath` はマニフェスト生成先のディレクトリとして使用される。

## 参考リンク

- [game-ci/steam-deploy](https://github.com/game-ci/steam-deploy)
- [GameCI Steam Deploy ドキュメント](https://game.ci/docs/github/deployment/steam/)
- [Steam Partner サイト](https://partner.steamgames.com/)
