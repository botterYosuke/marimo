# データフローの理解

従来のノートブックとは異なり、Backcastはセル間の関係を理解し、この情報を使用してコードと出力を一貫性のある状態に保ちます。これらの関係は**データフローグラフ**として表現され、変数が1つのセルから別のセルにどのように流れるかをエンコードします。

データフローグラフは、変数の定義と参照から静的に推論され、セルを正しい順序で自動的に実行（または古いものとしてマーク）するために使用されます。また、セルがページ上で「順序外」で配置できる、または列間で配置できる理由でもあります。

Backcastは、セル間で識別する関係を視覚化して理解するのに役立つツールをいくつか提供しています。Gridモードと3Dモードの両方で、データフローを視覚化できます。

## 変数エクスプローラー

**変数エクスプローラーパネル**は、Backcastのノートブック内の変数の理解を1つの検索可能なリストにまとめます。

<div align="center">
<picture>
  <source srcset="../../_static/docs-variables-panel.webp" type="image/webp">
  <img src="../../_static/docs-variables-panel.jpg" alt="変数の関係を示す変数パネル" style="max-width: 700px; width: 100%;" />
</picture>
</div>

パネルを開くには、**左サイドバーパネル**の**変数アイコン**をクリックします。変数エクスプローラーは、各変数の名前、型、値、定義場所、使用場所を表示します。

## 依存関係エクスプローラー

**依存関係エクスプローラーパネル**は、ノートブックのデータフローの_鳥瞰図_を提供し、すべてのセルをインタラクティブなグラフとして表示します。高レベルのパターン、全体的な接続性、ノートブックのより広範な構造を理解するのに役立ちます。

<div align="center">
<picture>
  <source srcset="../../_static/docs-dependency-explorer.webp" type="image/webp">
  <img src="../../_static/docs-dependency-explorer.jpg" alt="セル接続のグラフビューを示す依存関係エクスプローラー" style="max-width: 700px; width: 100%;" />
</picture>
</div>

依存関係エクスプローラーを開くには、**左サイドバーパネル**の**グラフアイコン**をクリックします。垂直または水平のレイアウトを選択できます。

## ミニマップ

<a name="minimap"></a>

**ミニマップ**は、ノートブックのデータフローの_焦点を絞ったスライス_を提供し、特定のセルのリアクティブコンテキストを理解し、関連するセルをナビゲートするのに役立ちます。ミニマップは_ホットキー_（`Cmd/Ctrl-Shift-i`）でトグルするか、**フッターツールバー**から**マップアイコン**を選択できます。

ミニマップ内のセルをクリックしてジャンプします：

<div align="center">
<video autoplay muted loop playsinline style="max-width: 700px; width: 100%;">
  <source src="../../_static/docs-minimap.webm" type="video/webm">
  <source src="../../_static/docs-minimap.mp4" type="video/mp4">
</video>
</div>

接続は**左から右**に読み取られます：

- **左側**への接続は_直接入力_—現在のセルが読み取るセル
- **右側**への接続は_直接出力_—現在のセルから読み取るセル
- 左または右に配置されているが直接接続されていないセルは_推移的依存関係_—現在のセルに影響を与える、または影響を受けるセルですが、1つ以上の中間セルを介してのみ

ミニマップには慣れる必要がありますが、現在のセル周辺のデータフローを理解するための効果的な表現です。デバッグ、関係のトレース、複雑なノートブックのナビゲートに役立つ_十分な_ローカルコンテキストを表示することを目的としています。高レベルの概要については、[依存関係エクスプローラー](#dependency-explorer)を使用してください。

### セルシンボル

ミニマップは、各セルのステータスと接続性を示す視覚的インジケーターを使用します：

<table tabindex="0">
  <thead>
    <tr>
      <th>シンボル</th>
      <th>意味</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <svg viewBox="-8 -8 16 16" width="16">
          <circle r="3"></circle>
          <path d="M 0 0 H -6" stroke-width="2" stroke="black">
          </path>
        </svg>
      </td>
      <td>セルは他のセルから変数を使用します</td>
    </tr>
    <tr>
      <td>
        <svg viewBox="-8 -8 16 16" width="16">
          <circle r="3"></circle>
          <path d="M 0 0 H 6" stroke-width="2" stroke="black">
          </path>
        </svg>
      </td>
      <td>セルは他のセルで使用される変数を定義します</td>
    </tr>
    <tr>
      <td>
        <svg viewBox="-8 -8 16 16" width="16">
          <circle r="3"></circle>
          <path d="M 0 0 H -6" stroke-width="2" stroke="black">
          </path>
          <path d="M 0 0 H 6" stroke-width="2" stroke="black">
          </path>
        </svg>
      </td>
      <td>
        セルは変数を使用し、かつ他のセルで使用される変数を定義します
      </td>
    </tr>
    <tr>
      <td>
        <svg viewBox="-8 -8 16 16" width="16">
          <circle r="3"></circle>
        </svg>
      </td>
      <td>
        セルは変数を定義しますが、何にも接続されていません（安全に削除可能）
      </td>
    </tr>
    <tr>
      <td>
        <svg viewBox="-8 -8 16 16" width="16">
          <circle r="1.5" fill="#c4c4c4"></circle>
        </svg>
      </td>
      <td>
        セルは他のセルから変数を定義または使用しません（多くの場合markdown）
      </td>
    </tr>
    <tr>
      <td>
        <svg viewBox="-8 -8 16 16" width="16">
          <circle r="3" fill="#ff6565"></circle>
        </svg>
      </td>
      <td>セルにエラーがあります</td>
    </tr>
  </tbody>
</table>


### セル接続の読み取り

セルを選択すると、ミニマップはデータがセル間でどのように流れるかを示す線を描画します。Backcastセルは複数の変数を定義できるため、下流の接続は、選択したセルからの任意の変数を参照するすべてのセルを表示します。Gridモードと3Dモードの両方で、データフローを視覚化できます。

## リアクティブ参照ハイライト

<a name="reactive-reference-highlighting"></a>

Backcastの**リアクティブ参照ハイライト**は、他のセルによって定義された変数が現在のセルで使用されている場合に_エディタ内_インジケーターを提供します。これらの「リアクティブ参照」は下線と軽く太字のテキストで強調表示されます：

<div align="center" style="margin-top: 20px">
<picture>
  <source srcset="../../_static/docs-reactive-reference-highlighting.webp" type="image/webp">
  <img src="../../_static/docs-reactive-reference-highlighting.jpg" alt="セル間の変数使用を示すリアクティブ参照ハイライト" style="max-width: 500px; width: 100%;" />
</picture>
</div>

下線付きの変数にホバーして`Cmd/Ctrl-Click`して定義にジャンプします。

この機能は現在**オプトイン**であり、*設定* > *ユーザー設定* > *表示* > *参照ハイライト*で有効にするか、コマンドパレット（`Cmd/Ctrl-K` > *参照ハイライト*）でトグルする必要があります。

