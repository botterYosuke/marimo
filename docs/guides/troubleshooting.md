# トラブルシューティング

marimoは、セルが定義および参照する変数に基づいてセル間の関係を理解します。期待通りに動作しない場合、marimoは、marimoのノートブックの解釈と問題のデバッグの両方を理解するのに役立つ[いくつかのツール](editor_features/dataflow.md)を提供します。

このガイドでは、遭遇する可能性のある一般的な問題と予期しない動作、およびそれらをデバッグして解決する方法について説明します。インタラクティブなデバッグ手法については、[デバッグガイド](debugging.md)をご覧ください。ここで問題がカバーされていない場合は、[FAQ](../faq.md)を確認してください。

## セルが実行されないのはなぜですか？

他のセルの変更に応答してセルが実行されることを期待しているが、実行されない場合、以下を確認してください：

### 変更を確認する

marimoはオブジェクトへの変更を追跡しません。1つのセルでオブジェクトを変更し、別のセルが反応することを期待している場合、これは期待通りに動作しません。

セル間でオブジェクトを変更する代わりに、新しいオブジェクトを作成するか、同じセル内で変更をすべて実行してください。

[リアクティビティについて詳しく読む](../guides/reactivity.md)。

### セル接続を確認する

marimoの[データフローツール](editor_features/dataflow.md)を使用して、セルが実際に期待通りに接続されているか確認します。

[ミニマップ](editor_features/dataflow.md#minimap)をトグルして、現在のセルの接続を確認します。左側に入力として期待するセルへの接続が表示され、右側に他のセルへの出力接続が表示されるはずです。ここでは、`f`を定義するセルが上の2つのセルに依存し、下のセルに`print(f)`で接続されています。

<div align="center">
  <video autoplay muted loop playsinline style="max-width: 450px; width: 100%;">
   <source src="../_static/docs-debugging-minimap.webm" type="video/webm">
   <source src="../_static/docs-debugging-minimap.mp4" type="video/mp4">
  </video>
</div>


または、左サイドバーで[依存関係エクスプローラー](editor_features/dataflow.md#dependency-explorer)または[変数エクスプローラー](editor_features/dataflow.md#variables-explorer)を開くことができます。

<div align="center">
  <figure>
    <img width="650" src="../_static/docs-dependency-graph.png"/>
    <figcaption>
    セル接続を示す依存グラフ。
    </figcaption>
  </figure>
</div>

接続が欠落している場合は、変数の使用を確認して、セルが適切に相互参照していることを確認してください。

## セルが予期せず実行されるのはなぜですか？

セルが予想以上に頻繁に実行される場合：

### セルの依存関係を確認する

marimoの[データフローツール](editor_features/dataflow.md)を使用して、セルをトリガーしているものを確認します：

1. [ミニマップ](editor_features/dataflow.md#minimap)をトグルします（[上記](#verify-cell-connections)を参照）- 左側のセルは、実行時にセルをトリガーする入力です。
2. [変数エクスプローラー](editor_features/dataflow.md#variables-explorer)を確認して、セルが使用する変数とそれらが定義されている場所を確認します。
3. セルの実行を引き起こしている予期しない依存関係が見つかる可能性があります。

### グローバル変数とローカル変数と関数引数を理解する

ローカル変数や関数引数を使用するつもりなのに、誤ってグローバル変数を使用していないことを確認してください：

1. セル内で使用されているが、そのセル内で定義されていない変数を確認します。
2. 他のセルによって消費されるべきでない値については、ローカル変数（`_`で始まる）を使用することを検討してください。

## UI要素の値がリセットされるのはなぜですか？

UI要素の値がリセットされ続ける場合：

### UI要素を定義するセルが再実行されていないことを確認する

UI要素を定義するセルが再実行されると、要素の値が初期の`value`引数にリセットされます。UI要素の定義を別のセルに分割することで、これを回避できる場合があります。

### 永続化のためにstateを使用する

セル実行をまたいでUI要素の値を維持する必要がある場合、`mo.state`の使用を検討してください：

```python
# 別のセルでstateを宣言
get_value, set_value = mo.state(initial_value)
```

```python
element = mo.ui.slider(0, 10, value=get_value(), on_change=set_value)
```

この方法で、要素を定義するセルが再実行されても値が永続化されます。

## 1つのセルを別のセルの後に強制的に実行するにはどうすればよいですか？

特定の実行順序を確保する必要がある場合：

### 明示的な依存関係を使用する

最初のセルの変数を2番目のセルで使用して、明示的な依存関係を作成します：

```python
# セル1
result = some_computation()
```

```python
# セル2
_ = result  # これによりセル1への依存関係が作成されます
further_computation()
```

### リファクタリングを検討する

実行順序を強制する必要が頻繁にある場合、ノートブック構造を改善できる兆候かもしれません：

1. 自然なデータフローが希望の順序を作成するように、セルを整理してみてください。
2. 適切な場合は、関連する操作を単一のセルに結合することを検討してください。

## 一般的なデバッグのヒント

### リンターで一般的な問題を確認する

手動デバッグに深く入る前に、marimoの組み込みリンターを実行して、一般的な問題をキャッチしてみてください：

```bash
marimo check my_notebook.py
```

リンターは、次のような問題を特定できます：
- セル間での複数の変数定義
- セル間の循環依存関係
- 実行を妨げる解析不可能なコード
- その他のコード品質の問題

完全なチェックリストについては、[リントラールガイド](lint_rules/index.md)をご覧ください。

### 依存関係を理解する

- 変数パネルを使用して変数値を検査し、それらが定義および使用されている場所を確認します。
- セル出力にデバッグ情報を出力するために、printステートメントを追加するか、`mo.md()`を使用します。
- 問題を分離するために、一時的にセルを無効にします。
- 「Lazy」ランタイム設定を使用して、自動的に実行することなく、どのセルが古いものとしてマークされているかを確認します。

marimoのリアクティビティはグローバル変数の定義と参照に基づいており、オブジェクトへの変更は追跡されないことを覚えておいてください。これを念頭に置くことで、ノートブックでの予期しない動作を理解し、デバッグするのに役立ちます。

## marimoによって行われるパッチ

### ローカルライブラリをインポートできないのはなぜですか？

`marimo edit path/to/notebook.py`または`marimo run path/to/notebook.py`を使用する場合、marimoは`sys.path`を`python path/to/notebook.py`で取得できるものと一致するように設定します。特に、ノートブックディレクトリに`sys.path[0]`を設定します：

```
sys.path[0] == 'path/to/'
```

pyproject.tomlの[ランタイム設定](../guides/configuration/runtime_configuration.md)で`sys.path`にエントリを追加できます。

### その他のパッチ

ノートブックとして実行する場合、marimoは変数に対して次の変更を行います：

- marimoは`pdb.Pdb`をカスタムクラスでパッチして、`breakpoint()`関数を使用したインタラクティブデバッグを有効にします
- marimoは、[スクリプトとして実行](../guides/scripts.md)する場合と一致するように、ノートブックとして実行する際に`sys.argv`をパッチします
- ローカル変数は現在、名前がマングリングされているため、ローカル変数を使用するソースコードイントロスペクションが機能しない場合があります。この動作は将来的に変更される可能性があります。

## ノートブックがWebアセットで404を返すのはなぜですか？

JSやCSSファイルなどのWebアセットで404エラーが表示される場合、シンボリックリンク設定やプロキシ設定が原因である可能性があります。

### シンボリックリンク設定を確認する

`bazel`や`uv`の[**link-mode: symlink**](https://docs.astral.sh/uv/reference/settings/#link-mode)を使用している場合、Webアセットが正しく見つかるようにシンボリックリンク設定を調整する必要がある場合があります。デフォルトでは、marimoはシンボリックリンクをフォローしないため、この設定をオンにする必要がある場合があります。

`marimo config show`で`marimo.toml`設定ファイルを探し、`follow_symlink`フラグを編集します：

```toml title="marimo.toml"
[server]
follow_symlink = true
```

### プロキシ設定を確認する

プロキシサーバーを使用している場合、marimoを実行する際に`--proxy`フラグを含める必要があります。ポートが指定されていない場合、プロキシはデフォルトでポート80を使用します。例えば、プロキシが`example.com`で、ポート8080を使用する場合、次のように実行します：

```bash
marimo edit --proxy example.com:8080
# または
marimo run --proxy example.com:8080
```

### ログを読む

marimoはログを`$XDG_CACHE_HOME/marimo/logs/*`に出力します。ログを表示するには、次を実行します：

```bash
cat $XDG_CACHE_HOME/marimo/logs/github-copilot-lsp.log
```

利用可能なログは：

- `github-copilot-lsp.log`
- `pylsp.log`

