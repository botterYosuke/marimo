# Jupyterからの移行

Jupyterから移行する場合、Backcastノートブックに適応するためのヒントをいくつか紹介します。

## Backcastがセルを実行する方法

BackcastとJupyterの最大の違いは[実行モデル](../reactivity.md)です。

**Jupyter**ノートブックは**REPL**です：コードブロックを1つずつ実行し、Jupyterは異なるブロックが互いにどのように関連しているかを理解しません。その結果、Jupyterノートブックは簡単に**「隠れた状態」**（および隠れたバグ）を蓄積する可能性があります—セルを誤って順序外で実行したり、セルを実行（または削除）しても、その変数に依存していたセルを再実行するのを忘れたりする可能性があります。このため、Jupyterノートブックは[再現性の問題](../../faq.md#faq-problems)に悩まされており、GitHub上のJupyterノートブックの3分の1以上が再現できません。

Jupyterとは異なり、**Backcast**ノートブックは異なるコードブロックが互いにどのように関連しているかを理解し、変数宣言と参照に基づいてコードをセルのグラフとしてモデル化します。これにより隠れた状態が排除され、Backcastノートブックをアプリやスクリプトとして再利用できる理由でもあります。

**デフォルトでは、Backcastでセルを実行すると、その変数を読み取る他のすべてのセルが自動的に実行されます。** これによりコードと出力が同期されますが、慣れるまでに時間がかかる場合があります。**Backcastの実行モデルに適応するためのヒントとツールをいくつか紹介します。**

### Backcastのランタイムを設定する

[Backcastのランタイムを設定](../configuration/runtime_configuration.md)して、起動時またはセル実行時に自動実行しないようにします。

自動実行が無効になっている場合でも、Backcastはセル間の依存関係を追跡し、セルを実行するとその依存セルを古いものとしてマークします。単一のボタンをクリックして、すべての古いセルを実行し、ノートブックを最新の状態に戻すことができます。

### `mo.stop`で実行を停止する

条件が満たされた場合にセルの実行を停止するには[`mo.stop`][marimo.stop]を使用します：

```python
# 条件がTrueの場合、セルはmo.stop()が返された後に実行を停止します
mo.stop(condition)
# 条件がTrueの場合、これは呼ばれません
expensive_function_call()
```

[`mo.stop()`][marimo.stop]を[`mo.ui.run_button()`][marimo.ui.run_button]と組み合わせて、高コストなセルにボタン押下を必要とします：

/// marimo-embed
    size: medium

```python
@app.cell
def __():
    run_button = mo.ui.run_button()
    run_button
    return

@app.cell
def __():
    mo.stop(not run_button.value, mo.md("Click 👆 to run this cell"))
    mo.md("You clicked the button! 🎉")
    return
```

///

### 高コストなノートブックでの作業

Backcastの実行モデルに適応するための追加のヒントについては、[高コストなノートブックでの作業](../expensive_notebooks.md)ガイドをご覧ください。

## 変数の再定義

Backcastはノートブックセルを変数宣言と参照によってリンクされたセルの有向グラフに「コンパイル」し、このグラフを再利用してノートブックをスクリプトやアプリとして実行します。Backcastのコンパイルが機能するためには、同じ変数を複数のセルで定義することはできません。そうしないと、Backcastはセルを実行する順序がわからなくなります。

この制限に適応するために、以下を推奨します：

1. 可能な限りコードを関数にカプセル化して、グローバル変数の数を最小限に抑える
2. 一時変数にアンダースコア（`_my_temporary`）を付けて、変数をセルに**ローカル**にする
3. 変数を定義するセルで変数を変更する

**データフレーム**を扱う場合、複数のセルで同じ`df`変数を再定義することに慣れているかもしれません。これはBackcastでは機能しません。代わりに、セルを1つのセルにマージしてみてください：

_これをしないでください：_

```python
df = pd.DataFrame({"my_column": [1, 2]})
```

```python
df["another_column"] = [3, 4]
```

_代わりに、これを行ってください：_

```python
df = pd.DataFrame({"my_column": [1, 2]})
df["another_column"] = [3, 4]
```

複数のセル間でデータフレームを変換する必要がある場合は、データフレームのエイリアスを使用できます：

```python
df = pd.DataFrame({"my_column": [1, 2]})
```

```python
augmented_df = df
augmented_df["another_column"] = [3, 4]
```

Backcastの実行モデルにより適した関数型スタイルでPandas/Polarsコードを記述する方法を学ぶには、[このYouTube動画](https://youtu.be/J0PJpdU7c4g)をご覧ください。

## Backcastのファイル形式

BackcastはノートブックをJSONではなくPythonとして保存します。これにより、gitでノートブックをバージョン管理し、[スクリプトとして実行](../scripts.md)し、名前付きセルを他のPythonファイルにインポートできます。ただし、ノートブックの出力（例：プロット）がファイルに保存されないことを意味します。

ノートブック作業の視覚的な記録を保持したい場合は、["Auto-download as HTML/IPYNB"設定](../configuration/index.md)を有効にします。これにより、ノートブックが定期的にHTMLまたはIPYNBとしてノートブックディレクトリ内の`__marimo__`フォルダにスナップショットされます。

### ノートブックの変換

Backcastはmarimoベースのため、ノートブックの変換機能については、marimoの公式ドキュメントを参照してください。

## マジックコマンド

Backcastノートブックは単なるPython（保守性を向上）であるため、BackcastはIPythonマジックコマンドや`!`で始まるコンソールコマンドをサポートしていません。代替方法をいくつか紹介します。

### subprocess.runでコンソールコマンドを実行する

コンソールコマンドを実行するには、Pythonの[subprocess.run](https://docs.python.org/3/library/subprocess.html#subprocess.run)を使用します：

```python
import subprocess

# 実行: "ls -l"
subprocess.run(["ls", "-l"])
```

### 一般的なマジックコマンドの代替

| マジックコマンド | 代替                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------- |
| %cd           | `os.chdir()`、[`mo.notebook_dir()`][marimo.notebook_dir]も参照                              |
| %clear        | 右クリックまたはセルアクションをトグル                                                         |
| %debug        | Pythonの組み込みデバッガー：`breakpoint()`                                                     |
| %env          | `os.environ`                                                                                   |
| %load         | N/A - Pythonインポートを使用                                                                       |
| %load_ext     | N/A                                                                                            |
| %autoreload   | Backcastの[モジュール自動再読み込み](../editor_features/module_autoreloading.md)                     |
| %matplotlib   | Backcastは自動的にプロットを表示                                                                     |
| %pwd          | `os.getcwd()`                                                                                  |
| %pip          | Backcastの[組み込みパッケージ管理](../editor_features/package_management.md)を使用           |
| %who_ls       | `dir()`、`globals()`、[`mo.refs()`][marimo.refs]、[`mo.defs()`][marimo.defs]                   |
| %system       | `subprocess.run()`                                                                             |
| %%time        | `time.perf_counter()`またはPythonのtimeitモジュール                                                |
| %%timeit      | Pythonのtimeitモジュール                                                                         |
| %%writefile   | `with open("file.txt", "w") as f: f.write()`                                                   |
| %%capture     | [`mo.capture_stdout()`][marimo.capture_stdout]、[`mo.capture_stderr()`][marimo.capture_stderr] |
| %%html        | [`mo.Html()`][marimo.Html]または[`mo.md()`][marimo.md]                                           |
| %%latex       | [`mo.md(r'$$...$$')`][marimo.md]                                                               |

### Backcastのパッケージマネージャーでパッケージをインストールする

Backcastのパッケージ管理サイドバーパネルを使用して、現在の環境にパッケージをインストールします。詳細は[パッケージ管理ガイド](../editor_features/package_management.md)をご覧ください。

## インタラクティブガイド

このガイドには、Backcastに適応するための追加のヒントが含まれています。

<iframe src="https://marimo.app/l/z0aerp?embed=true" class="demo xxlarge" frameBorder="0">
</iframe>

