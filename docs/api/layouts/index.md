# レイアウト

marimoには、出力を行、列、テーブル、タブなどで配置するために使用できる高階レイアウト関数があります。

## ステートレス

`marimo.ui`の要素とは異なり、これらには関連する値がなく、子要素を特定の方法でレンダリングするだけです。

| 関数 | 説明 |
|----------|-------------|
| [`marimo.accordion`][marimo.accordion] | 折りたたみ可能なセクションを作成 |
| [`marimo.carousel`][marimo.carousel] | スライドショーを作成 |
| [`marimo.callout`][marimo.callout] | 強調表示されたセクションを作成 |
| [`marimo.center`][marimo.center] | コンテンツを中央揃え |
| [`marimo.hstack`][marimo.hstack] | 要素を水平にスタック |
| [`marimo.lazy`][marimo.lazy] | コンテンツをレイジーロード |
| [`marimo.left`][marimo.left] | コンテンツを左揃え |
| [`marimo.nav_menu`][marimo.nav_menu] | ナビゲーションメニューを作成 |
| [`marimo.outline`][marimo.outline] | 目次のアウトラインを表示 |
| [`marimo.plain`][marimo.plain] | スタイルなしでコンテンツを表示 |
| [`marimo.right`][marimo.right] | コンテンツを右揃え |
| [`marimo.routes`][marimo.routes] | ページルーティングを作成 |
| [`marimo.stat`][marimo.stat] | 統計を表示 |
| [`marimo.sidebar`][marimo.sidebar] | サイドバーを作成 |
| [`marimo.tree`][marimo.tree] | ツリー構造を作成 |
| [`marimo.json`][marimo.json] | JSON構造を作成 |
| [`marimo.vstack`][marimo.vstack] | 要素を垂直にスタック |

## ステートフル

`marimo.ui`の一部の要素もレイアウトに役立ちます。これらの要素には関連する値があります：例えば、`tabs`は選択されたタブ名を追跡し、`table`は選択された行を追跡します。

| 関数 | 説明 |
|----------|-------------|
| [`marimo.ui.tabs`][marimo.ui.tabs] | タブインターフェースを作成 |
| [`marimo.ui.table`][marimo.ui.table] | インタラクティブなテーブルを作成 |

