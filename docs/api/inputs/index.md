# 入力

Backcastには、強力なノートブックやアプリを構築するために使用できるインタラクティブなUI要素がパッケージ化されています。これらの要素はバックエンドAPI（`marimo.ui`）で利用できます。

| 要素 | 説明 |
|---------|-------------|
| [`marimo.ui.array`][marimo.ui.array] | 配列入力を作成 |
| [`marimo.ui.batch`][marimo.ui.batch] | バッチ操作 |
| [`marimo.ui.button`][marimo.ui.button] | ボタンを作成 |
| [`marimo.ui.chat`][marimo.ui.chat] | チャットインターフェースを作成 |
| [`marimo.ui.checkbox`][marimo.ui.checkbox] | チェックボックスを作成 |
| [`marimo.ui.code_editor`][marimo.ui.code_editor] | コードエディタを作成 |
| [`marimo.ui.dataframe`][marimo.ui.dataframe] | インタラクティブなデータフレーム |
| [`marimo.ui.data_explorer`][marimo.ui.data_explorer] | データを探索 |
| [`marimo.ui.date`][marimo.ui.date] | 日付ピッカー |
| [`marimo.ui.datetime`][marimo.ui.datetime] | 日時ピッカー |
| [`marimo.ui.date_range`][marimo.ui.date_range] | 日付範囲ピッカー |
| [`marimo.ui.dictionary`][marimo.ui.dictionary] | 辞書入力 |
| [`marimo.ui.dropdown`][marimo.ui.dropdown] | ドロップダウンを作成 |
| [`marimo.ui.file`][marimo.ui.file] | ファイルアップロード |
| [`marimo.ui.file_browser`][marimo.ui.file_browser] | ファイルを閲覧 |
| [`marimo.ui.form`][marimo.ui.form] | フォームを作成 |
| [`marimo.ui.microphone`][marimo.ui.microphone] | オーディオを録音 |
| [`marimo.ui.multiselect`][marimo.ui.multiselect] | 複数選択 |
| [`marimo.ui.number`][marimo.ui.number] | 数値入力 |
| [`marimo.ui.radio`][marimo.ui.radio] | ラジオボタン |
| [`marimo.ui.range_slider`][marimo.ui.range_slider] | 範囲スライダー |
| [`marimo.ui.refresh`][marimo.ui.refresh] | リフレッシュボタン |
| [`marimo.ui.run_button`][marimo.ui.run_button] | 実行ボタン |
| [`marimo.ui.slider`][marimo.ui.slider] | スライダーを作成 |
| [`marimo.ui.switch`][marimo.ui.switch] | トグルスイッチ |
| [`marimo.ui.tabs`][marimo.ui.tabs] | タブインターフェース |
| [`marimo.ui.table`][marimo.ui.table] | インタラクティブなテーブル |
| [`marimo.ui.text`][marimo.ui.text] | テキスト入力 |
| [`marimo.ui.text_area`][marimo.ui.text_area] | 複数行テキスト入力 |

UI要素を使用するには、グローバル変数に割り当て、セルで出力します。
フロントエンド要素と対話すると、Pythonオブジェクトの`value`属性が自動的に更新され、そのオブジェクトを参照するすべてのセルが要素の最新の値で自動的に実行されます。

## 統合

| 統合 | 説明 |
|-------------|-------------|
| [`marimo.ui.altair_chart`][marimo.ui.altair_chart] | インタラクティブなAltairチャート |
| [`marimo.ui.plotly`][marimo.ui.plotly] | インタラクティブなPlotlyチャート |
| [`marimo.mpl.interactive`][marimo.mpl.interactive] | インタラクティブなMatplotlibプロット |
| [`marimo.ui.anywidget`][marimo.ui.anywidget] | カスタムウィジェット |

