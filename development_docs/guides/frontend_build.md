# フロントエンドのリビルド手順

Marimoのフロントエンド開発環境において、クリーンビルドを行うための手順を説明します。
ビルドエラーが発生した場合や、依存関係を完全にリセットしたい場合に有効です。

## 手順

以下の手順で、一度既存のアーティファクトを削除してから再構築を行います。

> [!WARNING]
> ルートディレクトリでの `pnpm clean` コマンドは実行しないでください。ビルド環境が破損する報告があります。
> 必ず以下の手順でフロントエンドのみをクリーンにしてください。

### 1. アーティファクトの削除

`frontend` ディレクトリ内の生成物を削除します。

Windows (PowerShell):
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules, dist, .turbo -ErrorAction SilentlyContinue
cd ..
```

### 2. 依存関係のインストール

ルートディレクトリで `pnpm install` を実行し、依存関係を再インストールします。
Marimoはモノレポ構成のため、ルートでのインストールが推奨されます。

```powershell
pnpm install
```

### 3. ビルドの実行

`frontend` ディレクトリに移動し、ビルドコマンドを実行します。

```powershell
cd frontend
pnpm build
```

## ワンライナー (PowerShell)

以下のコマンドをコピーして実行することで、上記の手順を一括で行えます。

```powershell
cd frontend; Remove-Item -Recurse -Force node_modules, dist, .turbo -ErrorAction SilentlyContinue; cd ..; pnpm install; cd frontend; pnpm build
```

## Tips

### `frontend/node_modules` について

`frontend/node_modules` ディレクトリは Git 管理外であり、リポジトリには含まれていません。
ルートディレクトリで `pnpm install` を実行したタイミングで、モノレポ全体の依存関係解決の一環としてインストール（生成）されます。

### クリーン時の注意点

ルートの `pnpm clean` コマンドから `frontend/node_modules` の削除を除外した理由は、**「フロントエンドだけ依存関係を削除し、ルートの `node_modules` を残した状態」で再インストールを行うと、依存関係の整合性が取れずにビルドエラーが発生する場合があるため**です。

もし依存関係を完全にリセットしたい場合は、ルートとフロントエンドの両方の `node_modules` を削除してから再インストールしてください。

```powershell
# 完全リセットの手順
Remove-Item -Recurse -Force node_modules, frontend/node_modules
pnpm install
```
