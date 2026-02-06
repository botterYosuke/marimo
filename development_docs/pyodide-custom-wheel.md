# Pyodide カスタム wheel 開発

## 概要

Pyodide版marimoで`#code/`ハッシュURLを使用してノートブックを開く際の問題を解決するための、カスタムwheelの開発方法。

---

## 問題の背景

```
msgspec.ValidationError: Invalid enum value 'grid' - at `$.app_config.width`
```

### 原因

1. **lockファイルによるキャッシュ:** Pyodideは`https://wasm.marimo.app/pyodide-lock.json`からパッケージ情報を取得
2. **古いmarimoバージョン:** lockファイルに含まれるmarimoは`"grid"`を認識しない古いバージョン
3. **ローカルwheelが無視される:** lockファイルの情報が優先される

---

## 解決策

lockファイルに依存せず、カスタムwheelを`micropip`で後からインストールする。

```
loadPyodide (marimoなし) → micropip.install(customWheel, deps=False)
```

### 対応環境

| 環境 | トリガー | wheel取得元 |
|------|---------|-------------|
| ローカル開発 | `import.meta.env.DEV` + `localhost` URL | `http://localhost:8000/dist/` |
| GitHub Pages | `VITE_USE_CUSTOM_WHEEL=true` | `/wheels/` ディレクトリ |
| 本番 (wasm.marimo.app) | なし | lockファイル（従来通り） |

---

## ローカル開発モード

### 開発手順

#### 1. wheelの再ビルド
```bash
uvx hatch build
```

#### 2. wheelファイル名の調整
```bash
cp dist/marimo-<新バージョン>-py3-none-any.whl dist/marimo-0.19.2-py3-none-any.whl
```

#### 3. サーバー起動
```bash
pnpm dev:pyodide
```

#### 4. 動作確認
- http://localhost:3000/ でフロントエンド
- http://localhost:8000/ でwheelサーバー
- `#code/<lz-string圧縮データ>`形式のURLでノートブックを開く

---

## GitHub Pages 本番モード

### ワークフローの変更 (.github/workflows/deploy-pages.yml)

```yaml
- name: Build marimo wheel
  run: |
    pip install hatch
    hatch build -t wheel

- name: Build Pyodide frontend
  working-directory: ./frontend
  env:
    NODE_ENV: production
    PYODIDE: "true"
    VITE_MARIMO_VERSION: "0.19.2"
    VITE_USE_CUSTOM_WHEEL: "true"
  run: pnpm build

- name: Copy wheel to dist
  run: |
    mkdir -p frontend/dist/wheels
    cp dist/marimo-*.whl frontend/dist/wheels/
```

### デプロイ後のディレクトリ構造

```
frontend/dist/
├── index.html
├── assets/
└── wheels/
    ├── marimo-0.12.0-py3-none-any.whl
    └── latest.txt
```

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/src/core/wasm/worker/bootstrap.ts` | Pyodide初期化、wheel選択ロジック |
| `frontend/src/core/wasm/worker/getMarimoWheel.ts` | wheel URL取得、カスタムwheel判定 |
| `.github/workflows/deploy-pages.yml` | GitHub Pagesデプロイ、wheelビルド |
| `pyodide/build_and_serve.py` | 開発用wheelサーバー |

---

## 注意事項

- `deps=False`により、wheelの依存関係が不一致でもエラーにならない
- 新しい依存関係を追加した場合は別途対応が必要
- lockファイルは他のパッケージの解決に引き続き使用
