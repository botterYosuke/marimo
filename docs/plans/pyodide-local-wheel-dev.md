# Pyodideカスタムwheel使用について

## 問題の概要

Pyodide版marimoで`#code/`ハッシュURLを使用してノートブックを開く際、以下のエラーが発生していた：

```
msgspec.ValidationError: Invalid enum value 'grid' - at `$.app_config.width`
```

## 原因

1. **lockファイルによるキャッシュ**: Pyodideは`https://wasm.marimo.app/pyodide-lock.json`からパッケージ情報を取得している
2. **古いmarimoバージョン**: lockファイルに含まれるmarimoは`"grid"`を`WidthType`として認識しない古いバージョンだった
3. **ローカルwheelが無視される**: `getMarimoWheel()`でローカルURLを指定しても、lockファイルの情報が優先されていた

## 技術的詳細

### 影響を受けるファイル
- `frontend/src/core/wasm/worker/bootstrap.ts` - Pyodide初期化ロジック
- `frontend/src/core/wasm/worker/getMarimoWheel.ts` - wheel URL取得
- `marimo/_config/config.py` - `WidthType`の定義
- `marimo/_ast/app_config.py` - `_AppConfig`クラス

### WidthTypeの定義（Python側）
```python
# marimo/_config/config.py:122
WidthType = Literal["normal", "compact", "medium", "full", "columns", "grid"]
```

### 問題のフロー
1. `loadPyodide()`が`packages`配列でmarimoを指定
2. `lockFileURL`からパッケージ解決情報を取得
3. lockファイルのmarimoバージョンが優先される
4. 古いmarimoでは`"grid"`が無効な値としてmsgspecエラー

---

## 解決策

### 方針

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

## 1. ローカル開発モード

### bootstrap.tsの処理

```typescript
const marimoWheel = getMarimoWheel(opts.version);
const useLocalWheel = import.meta.env.DEV && marimoWheel.startsWith("http://localhost");

const pyodide = await loadPyodide({
  packages: [
    "micropip",
    "msgspec",
    ...(useLocalWheel ? [] : [marimoWheel]),  // DEVモードではmarimoを除外
    ...
  ],
  lockFileURL: `https://wasm.marimo.app/pyodide-lock.json`,
});

// DEVモードではmicropipで後からローカルwheelをインストール
if (useLocalWheel) {
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("${marimoWheel}", deps=False)
`);
}
```

### 開発手順

#### 1. wheelの再ビルド
```bash
uvx hatch build
```

#### 2. wheelファイル名の調整
`dev:pyodide`スクリプトは`VITE_MARIMO_VERSION=0.19.2`を使用するため、ビルドしたwheelをコピー：
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

## 2. GitHub Pages本番モード

GitHub Pagesにデプロイする際、自前でビルドしたwheelを配信する。

### ワークフローの変更 (.github/workflows/deploy-pages.yml)

```yaml
- name: Build marimo wheel
  run: |
    pip install hatch
    hatch build -t wheel
    echo "Built wheel:"
    ls -la dist/*.whl

- name: Build Pyodide frontend
  working-directory: ./frontend
  env:
    NODE_ENV: production
    PYODIDE: "true"
    VITE_MARIMO_VERSION: "0.19.2"
    VITE_USE_CUSTOM_WHEEL: "true"  # カスタムwheel使用を有効化
  run: pnpm build

- name: Copy wheel to dist
  run: |
    mkdir -p frontend/dist/wheels
    cp dist/marimo-*.whl frontend/dist/wheels/
    # バージョン情報ファイル作成
    WHEEL_FILE=$(ls dist/marimo-*.whl | head -1 | xargs basename)
    echo "$WHEEL_FILE" > frontend/dist/wheels/latest.txt
    echo "Copied wheel: $WHEEL_FILE"
```

### getMarimoWheel.tsの処理

```typescript
export function getMarimoWheel(_version: string) {
  if (import.meta.env.DEV) {
    return `http://localhost:8000/dist/marimo-${
      import.meta.env.VITE_MARIMO_VERSION
    }-py3-none-any.whl`;
  }

  // GitHub Pages用カスタムwheel
  if (import.meta.env.VITE_USE_CUSTOM_WHEEL) {
    return "custom-wheel";  // マーカーを返す
  }

  return "marimo-base";  // lockファイルから解決
}

// カスタムwheelのURLを動的に取得
export async function getCustomWheelUrl(): Promise<string> {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const latestUrl = `${baseUrl}wheels/latest.txt`;

  const response = await fetch(latestUrl);
  const wheelFilename = (await response.text()).trim();
  return `${baseUrl}wheels/${wheelFilename}`;
}
```

### bootstrap.tsの処理

```typescript
const marimoWheel = getMarimoWheel(opts.version);
const useLocalWheel = import.meta.env.DEV && marimoWheel.startsWith("http://localhost");
const useCustomWheel = marimoWheel === "custom-wheel";

const installViaMicropip = useLocalWheel || useCustomWheel;

const pyodide = await loadPyodide({
  packages: [
    "micropip",
    "msgspec",
    ...(installViaMicropip ? [] : [marimoWheel]),
    ...
  ],
  lockFileURL: `https://wasm.marimo.app/pyodide-lock.json`,
});

// カスタムwheelをインストール
if (useLocalWheel) {
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("${marimoWheel}", deps=False)
`);
} else if (useCustomWheel) {
  const customWheelUrl = await getCustomWheelUrl();
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("${customWheelUrl}", deps=False)
`);
}
```

### デプロイ後のディレクトリ構造

```
frontend/dist/
├── index.html
├── assets/
│   └── ...
└── wheels/
    ├── marimo-0.12.0-py3-none-any.whl  # ビルドされたwheel
    └── latest.txt                       # "marimo-0.12.0-py3-none-any.whl"
```

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/src/core/wasm/worker/bootstrap.ts` | Pyodide初期化、wheel選択ロジック |
| `frontend/src/core/wasm/worker/getMarimoWheel.ts` | wheel URL取得、カスタムwheel判定 |
| `frontend/src/core/wasm/store.ts` | URLハッシュからコード展開 |
| `frontend/src/core/wasm/router.ts` | `#code/`ハッシュのルーティング |
| `.github/workflows/deploy-pages.yml` | GitHub Pagesデプロイ、wheelビルド |
| `pyodide/build_and_serve.py` | 開発用wheelサーバー |

---

## 注意事項

- `deps=False`により、wheelの依存関係が不一致でもエラーにならない
- 新しい依存関係を追加した場合は別途対応が必要
- lockファイルは他のパッケージ（Markdown、narwhals等）の解決に引き続き使用
- GitHub Pagesではpushのたびにwheelが再ビルドされるため、常に最新のコードが反映される

---

## 参考

- lz-string: https://github.com/pieroxy/lz-string
- Pyodide micropip: https://pyodide.org/en/stable/usage/loading-packages.html
- Vite環境変数: https://vitejs.dev/guide/env-and-mode.html
