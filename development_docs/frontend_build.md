# フロントエンドのリビルド手順

Marimoのフロントエンド開発環境において、クリーンビルドを行うための手順を説明します。
ビルドエラーが発生した場合や、依存関係を完全にリセットしたい場合に有効です。

## 手順

以下の手順で、一度既存のアーティファクトを削除してから再構築を行います。

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
