---
hide:
  - navigation
---

## marimoを選ぶ理由

<a name="faq-jupyter"></a>

### marimoはJupyterとどう違いますか？

marimoは、スクリプトとして実行したり、インタラクティブなWebアプリとしてデプロイしたりできる、再現可能でインタラクティブで共有可能なPythonプログラムとして、Pythonノートブックを再発明したものです。

**一貫した状態。** marimoでは、ノートブックコード、出力、プログラム状態が一貫していることが保証されています。セルを実行すると、marimoはその変数を参照するセルを自動的に実行することで反応します。セルを削除すると、marimoはその変数をプログラムメモリから削除し、隠れた状態を排除します。

**組み込みのインタラクティビティ。** marimoには、スライダー、データフレーム変換器、インタラクティブなプロットなどの[UI要素](guides/interactivity.md)も含まれており、これらはPythonと自動的に同期されます。要素と対話すると、それを使用するセルが最新の値で自動的に再実行されます。

**純粋なPythonプログラム。** Jupyterノートブックとは異なり、marimoノートブックは純粋なPythonファイルとして保存されるため、スクリプトとして実行したり、インタラクティブなWebアプリとしてデプロイしたり、Gitで簡単にバージョン管理したりできます。

<a name="faq-problems"></a>

### marimoはどのような問題を解決しますか？

marimoは、ノートブックの再現性、保守性、インタラクティビティ、再利用性、共有可能性に関する問題を解決します。

**再現性。**
Jupyterノートブックでは、表示されるコードがページ上の出力やプログラム状態と一致するとは限りません。セルを削除すると、その変数はメモリに残り、他のセルが引き続き参照する可能性があります。ユーザーは任意の順序でセルを実行できます。これにより、広範な再現性の問題が発生します。[ある研究](https://blog.jetbrains.com/datalore/2020/12/17/we-downloaded-10-000-000-jupyter-notebooks-from-github-this-is-what-we-learned/#consistency-of-notebooks)では、1000万のJupyterノートブックを分析し、その36%が再現可能ではないことを発見しました。

対照的に、marimoはコード、出力、プログラム状態が一貫していることを保証し、隠れた状態を排除してノートブックを再現可能にします。marimoは、コードをインテリジェントに分析し、セル間の関係を理解し、必要に応じてセルを自動的に再実行することでこれを実現します。

さらに、marimoノートブックはパッケージ要件をインラインでシリアル化できます。marimoはこれらの「サンドボックス化された」ノートブックを一時的な仮想環境で実行し、[パッケージまで再現可能](guides/editor_features/package_management.md)にします。

**保守性。**
marimoノートブックは純粋なPythonプログラム（`.py`ファイル）として保存されます。これにより、Gitでバージョン管理できます。対照的に、JupyterノートブックはJSONとして保存され、バージョン管理には追加の手順が必要です。

**インタラクティビティ。**
marimoノートブックには、Pythonと自動的に同期される[UI要素](guides/interactivity.md)（スライダー、ドロップダウンなど）が含まれています。例えば、スライダーを操作すると、それを参照するすべてのセルが新しい値で自動的に再実行されます。これはJupyterノートブックで動作させるのが困難です。

**再利用性。**
marimoノートブックはコマンドラインからPythonスクリプトとして実行できます（`.py`ファイルとして保存されるため）。対照的に、Jupyterではコードをコピー＆ペーストしたり、外部フレームワークを使用したりするなど、追加の手順が必要です。また、marimoノートブックで定義されたシンボル（関数、クラス）を他のPythonプログラム/ノートブックにインポートすることもできます。これはJupyterでは簡単にはできません。

**共有可能性。**
すべてのmarimoノートブックは、UI要素を備えたインタラクティブなWebアプリとしても機能し、`marimo run`コマンドを使用して提供できます。これは、Jupyterでは大幅な追加作業なしには不可能です。

_従来のノートブックの問題について詳しく知りたい場合は、これらの参考文献をご覧ください
[[1]](https://austinhenley.com/pubs/Chattopadhyay2020CHI_NotebookPainpoints.pdf)
[[2]](https://www.youtube.com/watch?v=7jiPeIFXb6U&t=1s)。_

<a name="faq-widgets"></a>

### `marimo.ui`はJupyterウィジェットとどう違いますか？

Jupyterウィジェットとは異なり、marimoのインタラクティブ要素はPythonカーネルと自動的に同期されます：コールバックなし、オブザーバーなし、手動でのセル再実行なし。

<p align="center">
<video autoplay muted loop playsinline width="600px" align="center">
    <source src="_static/faq-marimo-ui.mp4" type="video/mp4">
    <source src="_static/faq-marimo-ui.webm" type="video/webm">
</video>
</p>

## marimoの使用

<a name="faq-notebook-or-library"></a>

### marimoはノートブックですか、それともライブラリですか？

marimoはノートブックとライブラリの両方です。

- `marimo edit`を実行するとブラウザで開くエディタで_marimoノートブック_を作成します。
- marimoノートブックで_marimoライブラリ_（`import marimo as mo`）を使用します。`mo.md(...)`でmarkdownを記述し、`mo.ui`（`mo.ui.slider(...)`）でステートフルなインタラクティブ要素を作成し、さらに多くのことができます。詳細は[APIリファレンス](./api/index.md)をご覧ください。

<a name="faq-notebook-app"></a>

### marimoノートブックとmarimoアプリの違いは何ですか？

marimoプログラムは、使用方法に応じてノートブック、アプリ、またはその両方です。

marimoプログラムと対話する方法は2つあります：

1. `marimo edit`で計算用_ノートブック_として開く
2. `marimo run`でインタラクティブな_アプリ_として実行する

すべてのmarimoプログラムは、`marimo edit`で作成されるため、ノートブックとして始まります。marimoノートブックはリアクティブで組み込みのインタラクティブ要素があるため、多くのノートブックは単純にノートブックコードを非表示にすることで、有用で美しいアプリに簡単に変換できます：これが`marimo run`が行うことです。

すべてのノートブックがアプリとして実行される必要があるわけではありません。marimoノートブック自体が、データを迅速に探索し、再現可能な科学を行うのに有用です。すべてのアプリがノートブックとの対話によって改善されるわけでもありません。共同研究、教育、技術プレゼンテーションなどの設定では、ノートブックビューとアプリビュー（`marimo edit`から行うことができます）を行き来することが有用な場合があります！

<a name="faq-reactivity"></a>

### marimoはどのセルを実行するかどうやって知りますか？

marimoは各セルを1回読み取り、定義するグローバル名と読み取るグローバル名を決定します。セルが実行されると、marimoはそのセルが定義するグローバル名のいずれかを読み取る他のすべてのセルを実行します。グローバル名は、変数、クラス、関数、またはインポートを参照できます。

言い換えると、marimoは_静的解析_を使用して、セルからデータフローグラフを作成します。各セルはグラフ内のノードで、グローバル変数が「流れる」ノードです。セルが実行されるたびに（コードを変更したか、読み取るUI要素と対話したため）、そのすべての子孫が順番に実行されます。

<a name="faq-overhead"></a>

### marimoはコードを遅くしますか？

いいえ、marimoはコードを遅くしません。marimoはコードを実行またはトレースするのではなく、コードを読み取ることでセル間の依存関係を決定するため、ランタイムオーバーヘッドはゼロです。

<a name="faq-expensive"></a>

### 高コストなセルの自動実行を防ぐにはどうすればよいですか？

リアクティブ（自動）実行により、コードと出力が常に同期され、隠れた状態と順序外実行を排除することで再現性が向上します。marimoは、ノートブックを最新の状態に保つために必要な最小限のセルセットのみを実行するように注意しています。しかし、一部のセルの実行に時間がかかる場合、自動実行が準備が整う前に高コストなセルを開始することについて懸念するのは理解できます。

_高コストなセルの誤った実行を避けるためのヒント：_

- [高コストなセルを無効化](guides/reactivity.md#disabling-cells)。セルが無効化されると、そのセルとその子孫の実行がブロックされます。
- UI要素を[フォーム][marimo.ui.form]でラップします。
- [`mo.stop`][marimo.stop]を使用して、セルとその子孫の実行を条件付きで停止します。
- 高コストな中間計算をキャッシュするために、marimoの[`mo.cache`][marimo.cache]で関数をデコレートします。
- [`mo.persistent_cache`][marimo.persistent_cache]を使用して変数をディスクにキャッシュします。再実行時、marimoはセルが古くない限り、再計算する代わりにディスクから値を読み取ります。
- [ランタイム設定](guides/configuration/runtime_configuration.md)で自動実行を無効にします。

<a name="faq-lazy"></a>

### 自動実行を無効にするにはどうすればよいですか？

ノートブックのランタイム設定から自動実行を無効にできます。詳細は[ランタイム設定ガイド](guides/configuration/runtime_configuration.md)をご覧ください。

自動実行が無効になっている場合でも、marimoはノートブック状態について保証を提供し、適切な場合にセルを自動的に古いものとしてマークします。

<a name="faq-interactivity"></a>

### スライダーやその他のインタラクティブ要素をどのように使用しますか？

スライダーのようなインタラクティブなUI要素は`marimo.ui`で利用できます。

- UI要素をグローバル変数に割り当てます（`slider = mo.ui.slider(0, 100)`）
- 表示するためにセルの最後の式に含めます（`slider`または`mo.md(f"値を選択: {slider}")`）
- 別のセルで`value`属性（`slider.value`）を介して現在の値を読み取ります

_グローバル変数にバインドされたUI要素と対話すると、グローバル変数を参照するすべてのセルが自動的に実行されます_。

多くのUI要素がある場合、または実行時まで作成する要素が不明な場合は、`marimo.ui.array`と`marimo.ui.dictionary`を使用して、他のUI要素をラップするUI要素を作成します（`sliders = mo.ui.array([slider(1, 100) for _ in range(n_sliders)])`）。

これらすべてとその他の詳細は、UIチュートリアルで説明されています。コマンドラインで実行します：

```bash
marimo tutorial ui
```

<a name="faq-form"></a>

### UI要素に送信ボタンを追加するにはどうすればよいですか？

`form`メソッドを使用してUI要素に送信ボタンを追加します。例えば：

```python
form = marimo.ui.text_area().form()
```

フォームでラップされたテキスト領域の値は、送信ボタンをクリックしたときにのみPythonに送信されます。`form.value`でテキスト領域の最後に送信された値にアクセスします。

<a name="faq-markdown"></a>

### markdownをどのように記述しますか？

ノートブックで`marimo`（`mo`として）をインポートし、`mo.md`関数を使用します。詳細は[出力ガイド](guides/outputs.md#markdown)をご覧ください。または`marimo tutorial markdown`を実行してください。

<a name="faq-plots"></a>

### プロットをどのように表示しますか？

他のすべての出力と同様に、セルの最後の式にプロットを含めて表示します。matplotlibを使用している場合、`Figure`オブジェクトを表示できます（`plt.gcf()`で現在の図を取得）。例については、プロットチュートリアルを実行します：

```bash
marimo tutorial plots
```

[プロットAPIリファレンス](api/plotting.md)もご覧ください。

<a name="faq-mpl-cutoff"></a>

### matplotlibプロットが切れないようにするにはどうすればよいですか？

凡例や軸ラベルが切れている場合は、プロットを出力する前に`plt.tight_layout()`を呼び出してみてください：

```python
import matplotlib.pyplot as plt

plt.plot([-8, 8])
plt.ylabel("my variable")
plt.tight_layout()
plt.gca()
```

<a name="faq-interactive-plots"></a>

### インタラクティブなmatplotlibプロットをどのように表示しますか？

[`marimo.mpl.interactive`][marimo.mpl.interactive]を使用します。

```bash
fig, ax = plt.subplots()
ax.plot([1, 2])
mo.mpl.interactive(ax)
```

<a name="faq-rows-columns"></a>

### オブジェクトを行と列で表示するにはどうすればよいですか？

`marimo.hstack`と`marimo.vstack`を使用します。詳細はレイアウトチュートリアルをご覧ください：

```bash
marimo tutorial layout
```

<a name="faq-show-code"></a>

### アプリビューでセルコードを表示するにはどうすればよいですか？

[`mo.show_code`][marimo.show_code]を使用します。

<a name="faq-dynamic-ui-elements"></a>

### 動的な数のUI要素を含む出力を作成するにはどうすればよいですか？

[`mo.ui.array`][marimo.ui.array]、[`mo.ui.dictionary`][marimo.ui.dictionary]、または[`mo.ui.batch`][marimo.ui.batch]を使用して、動的な数の他のUI要素をラップするUI要素を作成します。

カスタムフォーマットが必要な場合は[`mo.ui.batch`][marimo.ui.batch]を使用し、それ以外の場合は[`mo.ui.array`][marimo.ui.array]または[`mo.ui.dictionary`][marimo.ui.dictionary]を使用します。

使用例については、[UI要素をグループ化するレシピ](recipes.md#grouping-ui-elements-together)をご覧ください。

<a name="faq-restart"></a>

### ノートブックを再起動するにはどうすればよいですか？

すべてのプログラムメモリをクリアし、最初からノートブックを再起動するには、右上のノートブックメニューを開き、「Restart kernel」をクリックします。

<a name="faq-reload"></a>

### モジュールを再読み込みするにはどうすればよいですか？

marimoインストールのユーザー設定のランタイム設定から、モジュールの自動再読み込みを有効にします（marimoノートブックの右上の「歯車」アイコンをクリック）。

有効にすると、marimoはセルを実行する前に変更されたモジュールを自動的にホットリロードします。

<a name="faq-on-change-called"></a>

### `on_change`/`on_click`ハンドラーが呼ばれないのはなぜですか？

UI要素の`on_change`（またはボタンの場合、`on_click`）ハンドラーは、要素がグローバル変数にバインドされている場合にのみ呼ばれます。例えば、これは動作しません：

```python
mo.vstack([mo.ui.button(on_change=lambda _: print("I was called")) for _ in range(10)])
```

このような場合（動的な数のUI要素を出力したい場合）、[`mo.ui.array`][marimo.ui.array]、[`mo.ui.dictionary`][marimo.ui.dictionary]、または[`mo.ui.batch`][marimo.ui.batch]を使用する必要があります。

例のコードについては、[UI要素をグループ化するレシピ](recipes.md#grouping-ui-elements-together)をご覧ください。

<a name="faq-on-change-last"></a>

### 配列内の`on_change`ハンドラーがすべて最後の要素を参照しているのはなぜですか？

**これを行わないでください**：以下のスニペットでは、すべての`on_change`が`9`を出力します！

```python
array = mo.ui.array(
  [mo.ui.button(on_change=lambda value: print(i)) for i in range(10)
])
```

**代わりに、これを行ってください**：`i`を現在のループ値に明示的にバインドします：

```python
array = mo.ui.array(
    [mo.ui.button(on_change=lambda value, i=i: print(i)) for i in range(10)]
)
array
```

これは、[Pythonではクロージャが遅延バインディング](https://docs.python-guide.org/writing/gotchas/#late-binding-closures)であるために必要です。

<a name="faq-sql-brackets"></a>

### SQLのブラケットが動作しないのはなぜですか？

「SQL」セルは、ノートブックを純粋なPythonスクリプトとして保つために、実際には内部でPythonです。デフォルトでは、SQL文字列に`f-strings`を使用するため、`SELECT * from table where value < {min}`のようなパラメータ化されたSQLが可能です。

パラメータ化したくない実際の`{`/`}`をエスケープするには、二重`\{\{...\}\}`を使用します：

```sql
SELECT unnest([\{\{'a': 42, 'b': 84\}\}, \{\{'a': 100, 'b': NULL\}\}]);
```

<a name="faq-annotations"></a>

### marimoは型アノテーションをどのように扱いますか？

型アノテーションは、明示的に文字列として記述されていない限り、セルの参照として登録されます。これは、実行時に型アノテーションに依存するコード（例：Pydantic）の正確性を確保するのに役立ちますが、データフローグラフに影響を与えるアノテーションを省略する方法も提供します。

例えば、以下では：

```python
x: A = ...
```

`A`は参照として扱われ、データフローグラフの決定に使用されますが、以下では：

```python
x: "A" = ...
```

`A`は参照として扱われません。

Python 3.12+の場合、marimoは追加でアノテーションスコープを実装しています。

<a name="faq-dotenv"></a>

### dotenvをどのように使用しますか？

パッケージ`dotenv`の`loadenv()`関数は、marimoではそのまま動作しません。代わりに、`dotenv.load_dotenv(dotenv.find_dotenv(usecwd=True))`を使用してください。

<a name="faq-packages"></a>

### どのパッケージを使用できますか？

任意のPythonパッケージを使用できます。marimoセルは任意のPythonコードを実行します。

<a name="faq-remote"></a>

### リモートサーバーでmarimoをどのように使用しますか？

> リモートサーバーでmarimoを使用する方法に関するビデオチュートリアルを録画しました。[こちら](https://youtu.be/pam9Hw8rbaA)をご覧ください。

SSHポートフォワーディングを使用して、リモートサーバーでmarimoを実行し、ローカルマシンのブラウザから接続します。リモートでmarimoを起動する際は、`--headless`フラグを渡すことを確認してください。リモートマシンでは、marimoのデフォルトポート以外のポート（8080など）を使用することをお勧めします。

_リモートマシンで実行：_

```bash
marimo edit --headless --port 8080
```

または、カスタムホストを設定したい場合：

```bash
marimo edit --headless --host 0.0.0.0 --port 8080
```

_ローカルで実行：_

```
ssh -N -L 3718:127.0.0.1:8080 REMOTE_USER@REMOTE_HOST
```

その後、ブラウザで`localhost:3718`を開きます。

<a name="faq-interfaces"></a>

### marimoをすべてのネットワークインターフェースでアクセス可能にするにはどうすればよいですか？

`marimo edit`、`marimo run`、または`marimo tutorial`で`--host 0.0.0.0`を使用します：

```bash
marimo edit --host 0.0.0.0
```

<a name="faq-jupyter-hub"></a>

### JupyterHubの背後でmarimoをどのように使用しますか？

JupyterHubは、[`jupyter-marimo-proxy`パッケージ](https://github.com/jyio/jupyter-marimo-proxy)を使用してmarimoを起動するように設定できます。

<a name="faq-jupyter-book"></a>

### JupyterBookでmarimoをどのように使用しますか？

[JupyterBook](https://jupyterbook.org/en/stable/intro.html)は、markdownとJupyterノートブックで静的Webサイトを簡単に作成できます。

JupyterBookにmarimoノートブックを含めるには、ノートブックを`ipynb`ファイルにエクスポートするか、`HTML`にエクスポートできます：

1. ipynbにエクスポート：`marimo export ipynb my_notebook.py -o my_notebook.ipynb --include-outputs`
2. HTMLにエクスポート：`marimo export html my_notebook.py -o my_notebook.html`

<a name="faq-app-deploy"></a>

### アプリをどのようにデプロイしますか？

marimo CLIの`run`コマンドを使用して、ノートブックをアプリとして提供します：

```bash
marimo run notebook.py
```

Dockerコンテナ内でmarimoを実行している場合、別のホストとポートで実行したい場合があります：

```bash
marimo run notebook.py --host 0.0.0.0 --port 8080
```

<a name="faq-marimo-free"></a>

### marimoは無料ですか？

はい！

