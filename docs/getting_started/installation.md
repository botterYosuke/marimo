# インストール

BackcastはElectronアプリケーションとして動作します。開発環境をセットアップするには、以下の手順に従ってください。

## 前提条件

- **Node.js 20+**: ランタイム環境
- **pnpm 9+**: パッケージマネージャー
- **Python 3.8+**: バックエンドサーバー用（marimoベース）

## 開発環境セットアップ

### 1. リポジトリのクローン

```powershell
# 注意: 以下のリポジトリURLは例です。実際のBackcastリポジトリのURLに置き換えてください
git clone <repository-url>
cd backcast
```

### 2. 依存関係のインストール

```powershell
pnpm install
```

### 3. 開発サーバーの起動

```powershell
# フロントエンド + バックエンドサーバーを起動
pnpm dev
```

これにより、フロントエンド（Vite）とバックエンド（Pythonサーバー）が同時に起動します。

### 4. Electronアプリとして起動（開発モード）

```powershell
# 開発サーバーが起動した後、Electronアプリを起動
pnpm start
```

または、`pnpm dev`と`pnpm start`を同時に実行：

```powershell
pnpm start
```

（内部的に`pnpm dev`と`pnpm start:electron`が同時に実行されます）

## バックエンドのPython環境

Backcastはmarimoベースのバックエンドサーバーを使用します。Pythonの仮想環境を作成してアクティブにすることをお勧めします。

??? note "仮想環境の設定"

    Pythonは、パッケージ間の競合を最小限に抑えるために仮想環境を使用します。
    以下は`pip`ユーザー向けのクイックスタートです。`conda`を使用する場合は、[`conda`環境](https://conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html#creating-an-environment-with-commands)を使用してください。

    ターミナルで以下を実行します：

    - `python -m venv venv`で環境を作成
    - 環境をアクティブ化：
      - macOS/Unix: `source venv/bin/activate`
      - Windows: `venv\Scripts\activate`

    _Backcastのバックエンドサーバーを使用する際は、環境がアクティブになっていることを確認してください。_ この環境で、numpy、pandas、matplotlib、altairなどの必要な他のパッケージをインストールします。作業が終わったら、ターミナルで`deactivate`を実行して環境を非アクティブ化します。

    詳細は[公式Pythonチュートリアル](https://docs.python.org/3/tutorial/venv.html#creating-virtual-environments)をご覧ください。

/// admonition | インストールの問題？
    type: note

インストールに問題がありますか？プロジェクトのGitHub Issuesでお問い合わせください。
///

## ビルド済みアプリ（将来の機能）

将来的には、ビルド済みのElectronアプリを配布する予定です。現時点では、開発環境セットアップに焦点を当てています。
