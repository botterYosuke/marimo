# Steam 公開 - 次のステップ

## 現状

| 項目 | 状態 |
|------|------|
| Steam SDK 統合 (steamworks.js) | ✅ 完了 |
| Steam Overlay 対応 | ✅ 完了 |
| asarUnpack 設定 | ✅ 完了 |
| App ID 環境変数化 | ✅ 完了 |
| Windows ビルド検証 | ✅ 完了 |
| **Steam Partner サイト設定** | ⏳ 次のステップ |
| **ContentBuilder VDF** | ⏳ Depot 作成後 |
| **Steam へのアップロード** | ⏳ 最後 |

---

## Step 1: Steam Partner サイトで Depot を作成 (ユーザー作業)

### 1.1 アプリ管理ページにアクセス

1. https://partner.steamgames.com/ にログイン
2. 左メニュー「**アプリとパッケージ**」→「**すべてのアプリケーション**」
3. アプリ「**marimo**」(App ID: 4228740) をクリック

### 1.2 Depot を作成

1. 左メニュー「**Steamworks 設定**」→「**SteamPipe**」→「**Depots**」
2. 「**Add New Depot**」ボタンをクリック
3. 以下の 3 つの Depot を作成:

| Depot 名 | OS | 説明 |
|----------|-------|------|
| `marimo Windows` | Windows | Windows 64-bit ビルド |
| `marimo macOS` | macOS | macOS ビルド |
| `marimo Linux` | Linux | Linux ビルド |

4. 各 Depot に対して:
   - **Name**: 上記の名前を入力
   - **OS**: 適切な OS を選択
   - **Save** をクリック

5. **作成された Depot ID をメモしてください** (例: 4228741, 4228742, 4228743)

### 1.3 変更を公開

1. ページ上部の「**Publish**」ボタンをクリック
2. 変更内容を確認して公開

---

## Step 2: SteamCMD をダウンロード (ユーザー作業)

### Windows の場合

1. https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip をダウンロード
2. 任意のフォルダに展開 (例: `C:\SteamCMD\`)
3. `steamcmd.exe` をダブルクリックして初期化 (初回は自動更新される)

### セットアップ確認

```cmd
cd C:\SteamCMD
steamcmd.exe +quit
```

エラーなく終了すれば OK。

---

## Step 3: Depot ID を教えてください

Step 1 完了後、作成された Depot ID を教えてください。
その情報をもとに:

1. VDF ファイルを作成
2. アップロードコマンドを提供
3. ビルドスクリプトを作成

---

## 参考: 全体フロー図

```
[現在地]
    ↓
Steam Partner サイトで Depot 作成
    ↓
SteamCMD ダウンロード
    ↓
Claude が VDF ファイル作成
    ↓
pnpm dist:electron でビルド
    ↓
SteamCMD でアップロード
    ↓
Steam Partner サイトでビルドを公開
    ↓
完了!
```

## Step 3: ビルド & アップロード
1. Windows ビルドを作成
```
cd c:\Users\sasai\Documents\marimo
pnpm dist:electron
```

2. Steam にアップロード
```
C:\Users\sasai\Documents\marimo\steam\steamcmd.exe +login sasaco1105 +run_app_build "c:\Users\sasai\Documents\marimo\steam\vdf\app_build_4228740.vdf" +quit
```
YOUR_STEAM_USERNAME を Steamworks パートナーアカウントのユーザー名に置き換えてください。

注意:

初回はパスワードと Steam Guard コードを求められます
アップロード後、Steam Partner サイトでビルドを公開する必要があります
