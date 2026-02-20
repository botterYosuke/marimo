# 作業依頼：Code URL Embedding 機能のテスト

## 概要

`D:\Documents\marimo` プロジェクトには、Pythonファイルをブラウザ上で直接開けるURLに変換する機能がある。

仕様の詳細: [`development_docs/code_url_embedding.md`](file:///D:/Documents/marimo/development_docs/code_url_embedding.md)

---

## 依頼内容

以下の手順でテストを実施し、結果を報告してください。

### 1. URL生成

`D:\Documents\marimo` をカレントディレクトリにして、以下を実行する：

```powershell
node -e "const lzString = require('lz-string'); const fs = require('fs'); const code = fs.readFileSync('examples/markdown/emoji.py', 'utf8'); const compressed = lzString.compressToEncodedURIComponent(code); console.log('http://localhost:3000/#code/' + compressed);"
```

### 2. 動作確認

1. `pnpm dev` が `D:\Documents\marimo` で起動していることを確認
2. 生成したURLをブラウザで開く
3. marimoエディタが開き、`emoji.py` の内容が表示されることを確認

### 期待する結果

- `:rocket: :smile:` を含むセルが表示される
- エラーなくノートブックが読み込まれる

### 報告内容

- 成功 / 失敗
- 失敗の場合はエラーメッセージ・スクリーンショット
