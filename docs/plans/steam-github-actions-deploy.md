# Steam GitHub Actions デプロイ計画

## 概要

現在の `.github/workflows/release-steam.yml` を修正し、GitHub Releases の代わりに Steam へ自動デプロイするワークフローに変更する。

## 現状

| 項目 | 状態 |
|------|------|
| Windows/macOS/Linux ビルド | ✅ 動作中 |
| VDF ファイル | ✅ 作成済み (`steam/vdf/`) |
| GitHub Releases へのアップロード | ✅ 動作中 (変更対象) |
| Steam ビルダーアカウント | ✅ 作成済み |
| GitHub Secrets (STEAM_USERNAME, STEAM_CONFIG_VDF) | ✅ 設定済み |
| Steam へのアップロード (ワークフロー) | ⏳ 次のステップ |

## 使用するアクション

**[game-ci/steam-deploy](https://github.com/game-ci/steam-deploy)** v3.2.0
- GameCI が提供する公式 Steam デプロイアクション
- TOTP または config.vdf での認証をサポート

## 必要な GitHub Secrets

| Secret 名 | 説明 |
|-----------|------|
| `STEAM_USERNAME` | Steam ビルダーアカウントのユーザー名 |
| `STEAM_PASSWORD` | Steam ビルダーアカウントのパスワード |
| `STEAM_TOTP_SECRET` | Steam Guard TOTP のシークレット (推奨) |

### 代替: config.vdf 方式

| Secret 名 | 説明 |
|-----------|------|
| `STEAM_CONFIG_VDF` | Base64 エンコードされた config.vdf |

---

## ワークフロー変更内容

### 1. ビルドジョブの変更

各ビルドジョブ (Windows/macOS/Linux) で、unpacked ディレクトリもアーティファクトとしてアップロードするように変更。

**変更前** (Windows の例):
```yaml
- name: 📤 Upload Windows artifacts
  uses: actions/upload-artifact@v4
  with:
    name: electron-windows-${{ env.MARIMO_VERSION }}
    path: |
      dist-electron/*.exe
      dist-electron/*.blockmap
```

**変更後**:
```yaml
- name: 📤 Upload Windows artifacts (Steam)
  uses: actions/upload-artifact@v4
  with:
    name: steam-windows-${{ env.MARIMO_VERSION }}
    path: dist-electron/win-unpacked/
```

### 2. リリースジョブの置き換え

`create_release` ジョブを `deploy_steam` ジョブに置き換える。

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

    - name: 🚂 Deploy to Steam
      uses: game-ci/steam-deploy@v3
      with:
        username: ${{ secrets.STEAM_USERNAME }}
        configVdf: ${{ secrets.STEAM_CONFIG_VDF }}
        appId: 4228740
        buildDescription: "v${{ steps.get_version.outputs.marimo_version }}"
        rootPath: steam
        depot1Path: ../dist-electron/win-unpacked
        depot2Path: ../dist-electron/mac
        depot3Path: ../dist-electron/linux-unpacked
```

---

## VDF ファイルの調整

現在の VDF ファイルは `game-ci/steam-deploy` のディレクトリ構造に合わせて調整が必要。

### app_build_4228740.vdf

```vdf
"AppBuild"
{
    "AppID" "4228740"
    "Desc" "$STEAM_BUILD_DESCRIPTION"
    "ContentRoot" ""
    "BuildOutput" "output/"
    "Depots"
    {
        "4228742" "depot_build_4228742.vdf"
        "4228743" "depot_build_4228743.vdf"
        "4228744" "depot_build_4228744.vdf"
    }
}
```

### depot_build_4228742.vdf (Windows)

```vdf
"DepotBuild"
{
    "DepotID" "4228742"
    "ContentRoot" "../dist-electron/win-unpacked/"
    "FileMapping"
    {
        "LocalPath" "*"
        "DepotPath" "."
        "Recursive" "1"
    }
    "FileExclusion" "*.pdb"
}
```

---

## 実装手順

### Phase 1: Steam ビルダーアカウント設定 ✅ 完了

1. **Steam Partner サイトでビルダーアカウントを作成**
   - https://partner.steamgames.com/ → ユーザーとパーミッション
   - 新しいアカウントを作成 (ビルド専用)
   - 権限: 「Edit App Metadata」「Publish App Changes To Steam」のみ

2. **Steam Guard を設定**
   - TOTP (推奨): シークレットキーを取得
   - または: config.vdf を生成して Base64 エンコード

### Phase 2: GitHub Secrets 設定 ✅ 完了

```
Settings → Secrets and variables → Actions → New repository secret
```

- `STEAM_USERNAME`: ビルダーアカウント名
- `STEAM_CONFIG_VDF`: Base64 エンコードされた config.vdf

### Phase 3: ワークフロー修正 ⏳ 次のステップ

1. ビルドジョブのアーティファクト出力を unpacked ディレクトリに変更
2. `create_release` ジョブを `deploy_steam` ジョブに置き換え
3. VDF ファイルのパスを調整

### Phase 4: テスト

1. `workflow_dispatch` で手動実行
2. Steam Partner サイトでビルドを確認
3. 内部テストブランチにデプロイして動作確認

---

## ファイル変更一覧

| ファイル | 変更内容 |
|----------|----------|
| `.github/workflows/release-steam.yml` | GitHub Release → Steam deploy に変更 |
| `steam/vdf/app_build_4228740.vdf` | ContentRoot パス調整 |
| `steam/vdf/depot_build_4228742.vdf` | ContentRoot パス調整 |
| `steam/vdf/depot_build_4228743.vdf` | ContentRoot パス調整 |
| `steam/vdf/depot_build_4228744.vdf` | ContentRoot パス調整 |

---

## 次のアクション

### ✅ 完了: Steam ビルダーアカウント作成

### ✅ 完了: GitHub Secrets 設定

### ⏳ 次: ワークフロー修正

#### Step 1: config.vdf を取得

SteamCMD でログインして config.vdf を生成:

```cmd
cd C:\Users\sasai\Documents\marimo\steam
steamcmd.exe +login YOUR_BUILDER_USERNAME +quit
```

パスワードと Steam Guard コードを入力後、以下の場所に config.vdf が生成される:
- Windows: `C:\Users\sasai\Documents\marimo\steam\config\config.vdf`

#### Step 2: Base64 エンコード

PowerShell で config.vdf を Base64 エンコード:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\sasai\Documents\marimo\steam\config\config.vdf")) | Set-Clipboard
```

これでクリップボードに Base64 文字列がコピーされる。

#### Step 3: GitHub Secrets に追加

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. 以下の Secrets を追加:

| Name | Value |
|------|-------|
| `STEAM_USERNAME` | ビルダーアカウントのユーザー名 |
| `STEAM_CONFIG_VDF` | Step 2 でコピーした Base64 文字列 |

#### Step 4: Claude に報告

Secrets 設定完了後、教えてください。ワークフローを修正します。

---

### 待機中: ワークフロー修正 (Claude 作業)

---

## 参考リンク

- [game-ci/steam-deploy](https://github.com/game-ci/steam-deploy)
- [GameCI Steam Deploy ドキュメント](https://game.ci/docs/github/deployment/steam/)
- [Steam Partner サイト](https://partner.steamgames.com/)
