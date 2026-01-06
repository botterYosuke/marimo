# キーコンセプト

このページでは、marimoの主要な概念を説明します：

* marimoは、再現可能な**ノートブック環境**でPython、SQL、インタラクティブ要素を使用してデータを迅速に実験できます。
* Jupyterノートブックとは異なり、marimoノートブックは再利用可能なソフトウェア成果物です。marimoノートブックは**インタラクティブなWebアプリ**として共有したり、**Pythonスクリプト**として実行したりできます。

## ノートブックの編集

marimoノートブックは**リアクティブ**です：コードの変更やUI操作に自動的に反応し、ノートブックを最新の状態に保ちます。これはスプレッドシートと似ています。これにより、ノートブックが再現可能になり、[隠れた状態を排除](../faq.md#faq-problems)します。また、marimoノートブックをアプリやPythonスクリプトとしても使用できる理由でもあります。

!!! important "高コストなノートブックでの作業"

    セルが自動的に実行されないようにしたい場合、[ランタイムを設定](../guides/configuration/runtime_configuration.md)してレイジーにし、セルが実行されるように要求された場合にのみ実行し、影響を受けるセルを古いものとしてマークできます。**詳細は[高コストなノートブック](../guides/expensive_notebooks.md)のガイドをご覧ください。**

**最初のノートブックを作成する。** [marimoをインストール](../getting_started/installation.md)した後、コマンドラインで以下を実行して最初のノートブックを作成します：

```bash
marimo edit my_notebook.py
```

**marimoライブラリ**。
各marimoノートブックの最初のセルに、単一のコード行を含むセルを配置することをお勧めします：

```python3
import marimo as mo
```

marimoライブラリを使用すると、marimoノートブックでインタラクティブなUI要素、レイアウト要素、動的なmarkdownなどを使用できます。

### marimoがセルを実行する方法

marimoノートブックは、**セル**と呼ばれる小さなPythonコードブロックで構成されています。
_セルを実行すると、marimoはそのセルによって定義されたグローバル変数を読み取るすべてのセルを自動的に実行します。_ これがリアクティブ実行です。

<div align="center">
<figure>
<video autoplay muted loop playsinline width="600px" align="center">
    <source src="../_static/reactive.mp4" type="video/mp4">
    <source src="../_static/reactive.webm" type="video/webm">
</video>
</figure>
</div>

**実行順序**。
ページ上のセルの順序は、セルが実行される順序に影響しません：実行順序は、セルが定義する変数と読み取る変数によって決まります。

コードを整理し、ストーリーを伝える完全な自由度があります：ヘルパー関数やその他の「付録」をノートブックの下部に移動したり、重要な出力を含むセルを上部に配置したりできます。

**隠れた状態なし**。
marimoノートブックには隠れた状態がありません。これは、プログラム状態がコードの変更やUI操作に自動的に同期されるためです。また、セルを削除すると、marimoはそのセルの変数を自動的に削除し、従来のノートブックで発生する面倒なバグを防ぎます。

**マジカルな構文なし**。
リアクティビティにオプトインするためにマジカルな構文やAPIは必要ありません：セルはPythonであり、_Pythonのみ_です。バックグラウンドで、marimoは各セルのコードを1回だけ静的に解析し、各セルが定義および読み取るグローバル名に基づいて有向非巡回グラフ（DAG）を作成します。これがmarimoノートブックでのデータフローです。

!!! warning "変数の変更を最小限に抑える"

    marimoのコードの理解は変数の定義と参照に基づいています。marimoは実行時にオブジェクトへの変更を追跡しません。この理由から、変数を変更する必要がある場合（データフレームに新しい列を追加するなど）、その変数を定義するセルと同じセルで変更を実行する必要があります。

詳細は[リアクティビティガイド](../guides/reactivity.md#reactivity-mutations)をご覧ください。

リアクティブ実行の詳細については、データフローチュートリアルを開きます：

```bash
marimo tutorial dataflow
```

または、[リアクティビティガイド](../guides/reactivity.md)をお読みください。ノートブックでのデータフローを視覚化して理解するには、[データフローツール](../guides/editor_features/dataflow.md)をご確認ください。

### 出力の視覚化

marimoは各セルの最後の式をその**出力**として視覚化します。出力は、marimoライブラリで作成されたmarkdownやインタラクティブ要素（例：[`mo.md`][marimo.md]、[`mo.ui.slider`][marimo.ui.slider]）を含む、任意のPython値にすることができます。
Python値をmarkdown（`mo.md(f"...")`を使用）や他のmarimo要素に補間して、リッチな複合出力を構築することもできます：

<div align="center">
<figure>
<video autoplay muted loop playsinline width="600px" align="center">
    <source src="../_static/outputs.mp4" type="video/mp4">
    <source src="../_static/outputs.webm" type="video/webm">
</video>
</figure>
</div>

> リアクティブ実行により、セルを実行するとノートブック内の関連するすべての出力が更新されます。

marimoライブラリには、出力をレイアウトするための要素も含まれています。これには[`mo.hstack`][marimo.hstack]、[`mo.vstack`][marimo.vstack]、[`mo.accordion`][marimo.accordion]、[`mo.ui.tabs`][marimo.ui.tabs]、[`mo.sidebar`][marimo.sidebar]、[`mo.nav_menu`][marimo.nav_menu]、[`mo.ui.table`][marimo.ui.table]、[その他多数](../api/layouts/index.md)が含まれます。

出力の詳細については、以下のチュートリアルをお試しください：

```bash
marimo tutorial markdown
marimo tutorial plots
marimo tutorial layout
```

または、[出力の視覚化ガイド](../guides/outputs.md)をお読みください。

### インタラクティブ要素の作成

marimoライブラリには、[`marimo.ui`](../api/inputs/index.md)に多くのインタラクティブなステートフル要素が含まれています。これには、スライダー、ドロップダウン、テキストフィールド、ファイルアップロード領域などのシンプルな要素や、フォーム、配列、辞書などの他のUI要素をラップできる複合要素が含まれます。

<div align="center">
<figure>
<video autoplay muted loop playsinline width="600px" align="center" src="../_static/readme-ui.webm">
</video>
</figure>
</div>

**UI要素の使用**。
UI要素を使用するには、`mo.ui`で作成し、**グローバル変数に割り当てます**。ブラウザでUI要素と対話する場合（例：スライダーをスライド）、_marimoは新しい値をPythonに送信し、要素を使用するすべてのセルをリアクティブに実行します_。値は`value`属性でアクセスできます。

> **このインタラクティビティとリアクティビティの組み合わせは非常に強力です**：探索中にデータを触知可能にし、あらゆる種類のツールやアプリを構築するために使用してください。

_marimoはグローバル変数に割り当てられたUI要素のみを同期できます。_ UI要素のセットが実行時まで不明な場合は、[`mo.ui.array`][marimo.ui.array]や[`mo.ui.dictionary`][marimo.ui.dictionary]などの複合要素を使用してください。

!!! tip "ボタンを使用してセルを実行する"

    [`mo.ui.run_button`][marimo.ui.run_button]を使用して、クリック時に計算をトリガーするボタンを作成します。例については[レシピ](../recipes.md#create-a-button-that-triggers-computation-when-clicked)をご覧ください。

インタラクティブ要素の詳細については、UIチュートリアルを実行します：

```bash
marimo tutorial ui
```

または、[インタラクティビティガイド](../guides/interactivity.md)をお読みください。

### SQLでデータフレームとデータベースをクエリする

marimoにはSQLの組み込みサポートがあります：Pythonデータフレーム、データベース、CSV、Google Sheets、その他をクエリできます。クエリを実行した後、marimoは結果をデータフレームとして返すため、SQLとPythonの間を行き来するのがシームレスになります。

<div align="center">
  <figure>
    <img src="../_static/docs-sql-df.png"/>
    <figcaption>SQLを使用してデータフレームをクエリ！</figcaption>
  </figure>
</div>

SQLセルを作成するには、セル配列の下部に表示されるSQLボタンをクリックするか、セルの横にあるセル作成ボタンを右クリックします。現在、marimoのSQLは[duckdb](https://duckdb.org/docs/)を使用して実行されます。

詳細については、SQLチュートリアルを実行します：

```bash
marimo tutorial sql
```

または、[SQLガイド](../guides/working_with_data/sql.md)をお読みください。

## ノートブックをアプリケーションとして実行する

marimoは、Jupyterを使用する場合と同様に、ノートブックとして使用できます。

しかし、それ以上のこともできます：marimoノートブックはリアクティブでインタラクティブ要素を含むことができるため、ノートブックコードを非表示にすると、シンプルなWebアプリになります！

コマンドラインからノートブックを読み取り専用のWebアプリとして実行できます：

```bash
marimo run my_notebook.py
```

デフォルトのレンダラーは、ノートブックコードを非表示にして出力を垂直に連結するだけです。しかし、marimoは[スライドやグリッドなどの他のレイアウト](../guides/apps.md)もサポートしています。

## ノートブックをスクリプトとして実行する

marimoノートブックは純粋なPythonファイルとして保存されるため、各ノートブックはコマンドラインからスクリプトとして実行できます：

```python
python my_notebook.py
```

また、スクリプトに[コマンドライン引数を渡す](../guides/scripts.md)こともできます。

