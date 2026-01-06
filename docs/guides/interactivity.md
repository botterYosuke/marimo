# インタラクティブ要素

Backcastの最も強力な機能の1つは、[`marimo.ui`](../api/inputs/index.md)を使用して作成されるインタラクティブなユーザーインターフェース（UI）要素、または「ウィジェット」のファーストクラスサポートです。**グローバル変数にバインドされたUI要素と対話すると、それを参照するすべてのセルが自動的に実行されます。**

<div align="center">
<figure>
<video autoplay muted loop playsinline width="100%" height="100%" align="center">
    <source src="../_static/readme-ui.mp4" type="video/mp4">
    <source src="../_static/readme-ui.webm" type="video/webm">
</video>
</figure>
</div>

!!! example "例"
    [APIリファレンス](../api/inputs/index.md)で、入力要素の使用例をご覧ください。

## 対話がセルを実行する方法

[`marimo.ui`](../api/inputs/index.md)を使用して作成するすべてのUI要素には、`value`属性でアクセスできる値があります。グローバル変数にバインドされたUI要素と対話すると、その値がPythonに送信されます。次の単一のルールが何が起こるかを決定します：

!!! important "対話ルール"
    グローバル変数に割り当てられたUI要素と対話すると、Backcastはその変数を参照する（ただし定義しない）すべてのセルを自動的に実行します。

このページの上部にあるクリップでは、2番目のセル内のスライダーと対話すると、3番目のセル（markdownを出力）が再実行されます。これは、スライダー変数`x`を参照するためです。2番目のセルは再実行されません。これは、そのセルが`x`を定義するためです。

**UI要素への対話が効果を持つには、要素をグローバル変数に割り当てる必要があります。**

## UI要素の表示

他のオブジェクトと同様に、最後の式に含めることで、セルの上の出力領域にUI要素を表示できます。Python f-stringを使用して、[markdown][marimo.md]に要素を埋め込むこともできます：

```python3
slider = mo.ui.slider(1, 10)
mo.md(f"値を選択: {slider}")
```

## 複合要素

複合要素は、他のUI要素からUI要素を構築できる高度な要素です。以下の複合要素が利用可能です：

- [`mo.ui.array`][marimo.ui.array]
- [`mo.ui.dictionary`][marimo.ui.dictionary]
- [`mo.ui.batch`][marimo.ui.batch]
- [`mo.ui.form`][marimo.ui.form]

**配列と辞書**。
[`mo.ui.array`][marimo.ui.array]と[`mo.ui.dictionary`][marimo.ui.dictionary]を使用して、関連する要素を論理的にグループ化します。これらの要素は、UI要素のセットが実行時まで不明な場合（各要素を個別にグローバル変数に割り当てることはできませんが、配列や辞書に割り当てることはできます）に特に有用です。

Pythonicな構文を使用して、配列や辞書に含まれる要素にアクセスし、これらの要素を他の出力に埋め込むことができます。コード例については、docstringをご覧ください。

**バッチとフォーム**。
これらの強力な要素を使用して、複数のUI要素をカスタムフォーマットの単一要素にグループ化し、フォーム送信時に要素の値の送信を制御します。

<div align="center">
<figure>
<video autoplay muted loop playsinline width="100%" height="100%" align="center" src="../_static/readme-ui-form.webm">
</video>
<figcaption>フォームを使用して、送信時に値の更新を制御します</figcaption>
</figure>
</div>

<div align="center">
<figure>
<img src="../_static/array.png" width="700px"/>
<figcaption>配列を使用して要素をグループ化するか、実行時に決定される要素のコレクションを作成します</figcaption>
</figure>
</div>

## プラグインAPIを使用してカスタムUI要素を構築する

[anywidget](https://github.com/manzt/anywidget)を使用して、独自のリアクティブでインタラクティブなUI要素を構築できます。詳細は[カスタムUI要素の構築に関するドキュメント](../guides/integrating_with_marimo/custom_ui_plugins.md)をご覧ください。

