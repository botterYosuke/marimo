<p align="center">
  <strong>Backcast</strong>
</p>

<p align="center">
  <em>Gridモードと3Dモードを切り替え可能な、リアクティブな Python ノートブック環境。marimoベースのElectronアプリケーション。</em>
</p>

<p align="center">
  <a href="docs/project_specification.md" target="_blank"><strong>プロジェクト仕様書</strong></a> ·
  <a href="docs/getting_started/index.md" target="_blank"><strong>はじめに</strong></a> ·
  <a href="docs/faq.md" target="_blank"><strong>FAQ</strong></a>
</p>

**Backcast** は、[marimo](https://marimo.io)のフロントエンドを切り出したElectronアプリケーションです。marimoのApp ViewのGridモードに、インタラクティブなフィードバックを得られる**3Dモード**を新設し、Pythonコードの出力を**Dashboard状**に出力することで、Jupyterと同様にユーザーの検証・作業をサポートするツールです。

**Highlights（主な特徴）**

- 🎨 **3DモードとGridモード**: セルを3D空間に配置してインタラクティブに操作できる3Dモードと、従来のグリッドレイアウトのGridモードをシームレスに切り替え可能
- ⚡️ **reactive:** セルを実行すると Backcast はリアクティブに[すべての依存セルを実行](docs/guides/reactivity.md)するか、影響を受けるセルを古いものとしてマークします。
- 🖐️ **interactive:** [スライダー、テーブル、プロットなど](docs/guides/interactivity.md)を Python にバインドできます（コールバック不要）。
- 🐍 **git-friendly:** ノートブックは `.py` ファイルとして保存されます。
- 🛢️ **designed for data:** データフレーム、データベース、ウェアハウス、レイクハウスを [SQL でクエリ](https://docs.marimo.io/guides/working_with_data/sql.html)したり、[データフレームをフィルタ・検索](https://docs.marimo.io/guides/working_with_data/dataframes.html)できます。
- 🤖 **AI-native:** データ作業に特化した AI でセルを[生成](https://docs.marimo.io/guides/generate_with_ai/)できます。
- 🔬 **reproducible:** [隠れた状態なし](docs/guides/reactivity.md#no-hidden-state)、決定論的な実行、[組み込みパッケージ管理](https://docs.marimo.io/guides/package_management/)を備えています。
- 🏃 **executable:** ノートブックを [Python スクリプトとして実行](https://docs.marimo.io/guides/scripts.html)でき、CLI 引数でパラメータ化できます。
- 🛜 **shareable:** インタラクティブな Web アプリとしてデプロイしたり、[スライド](https://docs.marimo.io/guides/apps.html#slides-layout)に変換したり、[WASM でブラウザ実行](https://docs.marimo.io/guides/wasm.html)できます。
- 🧩 **reusable:** ノートブック間で関数やクラスを[インポートして再利用](https://docs.marimo.io/guides/reusing_functions/)できます。
- 🧪 **testable:** ノートブックに対して [pytest を実行](https://docs.marimo.io/guides/testing/)できます。
- ⌨️ **a modern editor:** GitHub Copilot、AI アシスタント、Ruff によるコード整形、高速補完などのエディタ機能を備えています。

## クイックスタート

**開発環境セットアップ**

```powershell
# 依存関係のインストール
pnpm install

# 開発サーバーの起動（フロントエンド + バックエンド）
pnpm dev

# Electronアプリとして起動（開発モード）
pnpm start
```

詳細は[インストールガイド](docs/getting_started/installation.md)を参照してください。

## 3DモードとGridモード

Backcastの特徴的な機能として、**3Dモード**と**Gridモード**の切り替えが可能です。

- **Gridモード（vertical）**: セルをグリッドレイアウトで配置・編集する従来の表示モード
- **3Dモード（3d）**: セルを3D空間に配置し、インタラクティブに操作可能な新しい表示モード
- **デフォルトモード**: デフォルトは3Dモードです
- **モード切り替え**: ツールバーの`EditViewModeSelect`コンポーネントで、ドロップダウンから"vertical"（Gridモード）と"3d"（3Dモード）を選択して切り替えられます

3Dモードでは、セルを3D空間に配置してドラッグ&ドロップで移動でき、カメラ操作（ズーム、回転、パン）でインタラクティブに探索できます。

詳細は[エディタ機能の概要](docs/guides/editor_features/overview.md)を参照してください。

## A reactive programming environment

Backcast はノートブックのコード、出力、プログラム状態の一貫性を保証します。これにより Jupyter のような従来のノートブックに関連する多くの問題が解決されます（詳細は [FAQ](docs/faq.md#faq-problems) を参照）。

**A reactive programming environment.**
セルを実行すると Backcast は _反応_ し、その変数を参照するセルを自動的に再実行することで、手動でセルを再実行することに起因するミスを防ぎます。セルを削除すると、Backcast はその変数をメモリから削除し、隠れた状態を排除します。

<img src="https://raw.githubusercontent.com/marimo-team/marimo/main/docs/_static/reactive.gif" width="700px" />

**Compatible with expensive notebooks.** Backcast はランタイムを遅延評価に設定でき、影響を受けるセルを自動実行する代わりに古いものとしてマークできます。これにより、高コストなセルの誤実行を防ぎつつプログラム状態の保証を提供します。

**Synchronized UI elements.** [スライダーやドロップダウン、データフレーム変換、チャットインターフェースなどの UI 要素](docs/guides/interactivity.md)を操作すると、それらを使うセルが自動的に最新の値で再実行されます。

<img src="https://raw.githubusercontent.com/marimo-team/marimo/main/docs/_static/readme-ui.gif" width="700px" />

**Interactive dataframes.** 数百万行のデータをコード不要でページング、検索、フィルタ、ソートできます。

<img src="https://raw.githubusercontent.com/marimo-team/marimo/main/docs/_static/docs-df.gif" width="700px" />

**Generate cells with data-aware AI.** データに文脈を持った AI アシスタントでコードを生成したり、ノートブック全体をゼロショットで生成できます。システムプロンプトのカスタマイズや独自 API キーの利用、ローカルモデルの使用にも対応します。

<img src="https://raw.githubusercontent.com/marimo-team/marimo/main/docs/_static/readme-generate-with-ai.gif" width="700px" />

**Query data with SQL.** Python 値に依存する SQL クエリを組み立て、データフレーム、データベース、CSV、Google Sheets などに対して実行できます。組み込みの SQL エンジンは結果を Python のデータフレームとして返します。

<img src="https://raw.githubusercontent.com/marimo-team/marimo/main/docs/_static/readme-sql-cell.png" width="700px" />

ノートブックは SQL を使っていても純粋な Python のままです。

**Dynamic markdown.** Python 変数でパラメタライズされた Markdown を使って動的なストーリーを作成できます。

**Built-in package management.** Backcast は主要なパッケージマネージャをサポートし、インポート時にパッケージをインストールしたり、ノートブック内に依存関係を埋め込んで再現可能な環境を構築できます。

**Deterministic execution order.** ノートブックの実行順序はセルのページ上の位置ではなく、変数参照に基づいて決定されます。

**Performant runtime.** 静的解析により、実行が必要なセルのみを効率的に実行します。

**Batteries-included.** GitHub Copilot、AI アシスタント、Ruff による整形、HTML 出力、インタラクティブなデータフレームビューアなど、多数の便利機能が含まれています。

## Questions?

詳細はドキュメントの [FAQ](docs/faq.md) を参照してください。

## Learn more

Backcast は導入が簡単で、パワーユーザーにも多くの機能を提供します。

詳細は [プロジェクト仕様書](docs/project_specification.md)、[はじめに](docs/getting_started/index.md) や [ガイド](docs/guides/) をご覧ください。

## Contributing

貢献を歓迎します。詳しい開始方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## インスピレーション ✨

Backcast は、[marimo](https://marimo.io)のフロントエンドを切り出し、3Dモードを追加したElectronアプリケーションです。

marimo は、エラーが発生しやすい JSON のスクラッチパッドではなく、再現性が高く、インタラクティブで、共有可能な Python プログラムとしての Python ノートブックの**再発明**です。

私たちのインスピレーションは多くの場所やプロジェクトから来ています。特に [Pluto.jl](https://github.com/fonsp/Pluto.jl)、[ObservableHQ](https://observablehq.com/tutorials)、および [Bret Victor のエッセイ](http://worrydream.com/) から多くを学びました。Backcast はリアクティブなデータフロープログラミングへの大きなムーブメントの一部です。IPyflow、streamlit、TensorFlow、PyTorch、JAX、React といったプロジェクトから、関数型・宣言型・リアクティブプログラミングの考え方が多くのツールをより良く変えているのを見ています。
