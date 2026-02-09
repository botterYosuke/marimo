# Python Sandbox セキュリティ対策案

> **ステータス: 未実装**
>
> 本ドキュメントは調査・設計段階の対策案です。実装は完了していません。

## 背景

BackcastProはPyInstaller + Electronでパッケージ化したmarimoベースのゲームです。Steam配布にあたり、悪意あるプレイヤーがPython実行環境を悪用してシステムを破壊できる問題への対策が必要です。

## 現状分析

marimoの現在のセキュリティ状況：

| 項目 | 状態 |
|------|------|
| プロセス分離（venv/subprocess） | 存在するがパッケージ化後は無効 |
| Python実行制限 | **なし**（全builtinsが利用可能） |
| RestrictedPython | 未使用 |
| 危険な操作 | `open()`, `exec()`, `eval()`, `os`, `subprocess` 等が全て利用可能 |

## 多層防御アーキテクチャ（提案）

```
┌─────────────────────────────────────────┐
│  Layer 1: Electron Sandbox              │  ← プロセス分離
├─────────────────────────────────────────┤
│  Layer 2: Python Import Hooks           │  ← モジュール制限
├─────────────────────────────────────────┤
│  Layer 3: Builtins Restriction          │  ← 関数制限
├─────────────────────────────────────────┤
│  Layer 4: Network Whitelist             │  ← ネットワーク制限
├─────────────────────────────────────────┤
│  Layer 5: Virtual File System           │  ← ファイルアクセス制限
└─────────────────────────────────────────┘
```

---

## 実装計画

### Phase 1: セキュリティモジュール作成【未実装】

**新規ファイル**: `marimo/_security/` パッケージ

#### 1.1 Import Hook (`marimo/_security/import_hook.py`)

```python
# 未実装 - 設計案
from importlib.abc import MetaPathFinder
import sys

BLOCKED_MODULES = {
    # プロセス生成
    "subprocess", "multiprocessing", "concurrent.futures",
    "_thread", "threading",
    # ネットワーク（requestsは別途ホワイトリスト制御）
    "socket", "ssl", "http.client", "urllib.request",
    "ftplib", "smtplib", "telnetlib",
    # 低レベルアクセス
    "ctypes", "cffi", "_ctypes",
    "os",  # os.systemなどを含む
    "shutil",
    "posix", "nt", "_winapi",
    # コード操作
    "code", "codeop", "ast", "dis", "inspect",
    # デバッグ
    "pdb", "bdb", "trace",
    # シリアライズ（コード実行可能）
    "pickle", "cPickle", "_pickle",
    # Import機構（サンドボックス回避）
    "importlib", "pkgutil", "zipimport",
}

ALLOWED_MODULES = {
    # ゲーム専用
    "BackcastPro",
    # marimo
    "marimo",
    # データ処理
    "numpy", "pandas", "scipy", "duckdb",
    # 可視化
    "matplotlib", "matplotlib.pyplot", "plotly", "plotly.express",
    # 標準ライブラリ（安全）
    "math", "cmath", "decimal", "fractions", "statistics", "random",
    "datetime", "calendar", "time",
    "collections", "collections.abc",
    "itertools", "functools", "operator",
    "string", "re", "textwrap",
    "json",
    "typing", "dataclasses", "enum",
    "copy", "pprint",
    "bisect", "heapq",
    "abc",
}

class SecurityImportFinder(MetaPathFinder):
    """危険なモジュールのインポートをブロックする"""

    def find_spec(self, fullname, path, target=None):
        root_module = fullname.split('.')[0]
        if root_module in BLOCKED_MODULES or fullname in BLOCKED_MODULES:
            raise ImportError(
                f"セキュリティ上の理由により '{fullname}' は使用できません"
            )
        return None

def install_import_hooks():
    """Import hookをインストールする"""
    sys.meta_path.insert(0, SecurityImportFinder())
```

#### 1.2 Builtins制限 (`marimo/_security/builtins.py`)

```python
# 未実装 - 設計案
import builtins
from typing import Final

BLOCKED_BUILTINS: Final[set[str]] = {
    "eval",
    "exec",
    "compile",
    "__import__",
    "open",  # 制限版で置換
    "breakpoint",
    "help",  # 情報漏洩の可能性
    "input",  # marimo版で置換
}

SAFE_BUILTINS: Final[set[str]] = {
    # 型コンストラクタ
    "bool", "int", "float", "complex", "str", "bytes", "bytearray",
    "list", "tuple", "dict", "set", "frozenset",
    # イテレーション
    "range", "enumerate", "zip", "map", "filter", "reversed", "sorted",
    # イントロスペクション（限定）
    "len", "type", "isinstance", "issubclass", "hasattr", "getattr",
    "callable", "dir",
    # 数学
    "abs", "min", "max", "sum", "pow", "round", "divmod",
    # 文字列/repr
    "repr", "ascii", "chr", "ord", "format", "print",
    # イテレータ
    "all", "any", "iter", "next", "slice",
    # その他
    "id", "hash", "vars", "globals", "locals",
    # クラス
    "object", "property", "staticmethod", "classmethod", "super",
    # 例外（エラー処理に必要）
    "BaseException", "Exception", "TypeError", "ValueError",
    "RuntimeError", "StopIteration", "KeyError", "IndexError",
    "AttributeError", "NameError", "ImportError",
}

def create_restricted_builtins() -> dict:
    """制限されたbuiltins辞書を作成する"""
    restricted = {}
    for name in SAFE_BUILTINS:
        if hasattr(builtins, name):
            restricted[name] = getattr(builtins, name)
    return restricted
```

#### 1.3 ネットワーク制限 (`marimo/_security/network.py`)

```python
# 未実装 - 設計案
from urllib.parse import urlparse
from typing import Final

ALLOWED_HOSTS: Final[set[str]] = {
    "api.backcastpro.com",  # ゲームサーバー
    # 必要に応じて追加
}

def patch_requests():
    """requestsをラップして許可されたホストのみアクセス可能にする"""
    try:
        import requests
    except ImportError:
        return

    original_request = requests.Session.request

    def restricted_request(self, method, url, **kwargs):
        host = urlparse(url).netloc
        if host not in ALLOWED_HOSTS:
            raise PermissionError(
                f"セキュリティ上の理由により '{host}' へのアクセスはブロックされました"
            )
        return original_request(self, method, url, **kwargs)

    requests.Session.request = restricted_request
```

#### 1.4 ファイルシステム制限 (`marimo/_security/filesystem.py`)

```python
# 未実装 - 設計案
from pathlib import Path
from typing import Final

class RestrictedFileSystem:
    """ファイルシステムアクセスを制限する"""

    def __init__(self, game_root: Path, save_dir: Path):
        self.game_root = game_root.resolve()
        self.save_dir = save_dir.resolve()

    def is_path_allowed(self, path: Path, write: bool = False) -> bool:
        """パスがアクセス許可されているか確認"""
        resolved = path.resolve()

        # 書き込みはセーブディレクトリのみ
        if write:
            try:
                resolved.relative_to(self.save_dir)
                return True
            except ValueError:
                return False

        # 読み取りはゲームディレクトリ内
        for allowed in [self.game_root, self.save_dir]:
            try:
                resolved.relative_to(allowed)
                return True
            except ValueError:
                continue
        return False

    def open(self, path: str, mode: str = "r", **kwargs):
        """制限付きopen()"""
        p = Path(path)
        write_mode = any(c in mode for c in "wa+")

        if not self.is_path_allowed(p, write=write_mode):
            raise PermissionError(
                f"アクセス拒否: {path}"
            )

        return open(path, mode, **kwargs)
```

### Phase 2: Executor修正【未実装】

**修正対象**: `marimo/_runtime/executor.py`

```python
# 未実装 - 設計案
class SecureExecutor(Executor):
    """セキュリティチェック付きExecutor"""

    def __init__(self, base: Executor):
        self.base = base

    def execute_cell(self, cell, glbls, graph):
        # builtinsが改ざんされていないか確認
        self._verify_sandbox_integrity(glbls)

        # 実行前の静的チェック
        self._check_code_safety(cell.body)

        return self.base.execute_cell(cell, glbls, graph)

    def _check_code_safety(self, code: str):
        """危険なパターンの静的解析"""
        dangerous_patterns = [
            "__class__.__mro__",
            "__subclasses__",
            "__globals__",
            "__code__",
            "__builtins__",
        ]
        for pattern in dangerous_patterns:
            if pattern in code:
                raise SecurityError(
                    f"セキュリティ上の理由により '{pattern}' は使用できません"
                )
```

### Phase 3: Electron設定【未実装】

```javascript
// 未実装 - 設計案
// main.js または類似ファイル
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  }
});
```

---

## ブロックリスト詳細

### 危険なBuiltins

| Builtin | 理由 | 対応 |
|---------|------|------|
| `eval`, `exec`, `compile` | 任意コード実行 | ブロック |
| `__import__` | モジュール制限回避 | ブロック |
| `open` | ファイルアクセス | 制限版で置換 |
| `breakpoint` | デバッガ起動 | ブロック |
| `input` | 標準入力 | marimo版で置換 |

### 危険なモジュール

| カテゴリ | モジュール |
|----------|-----------|
| プロセス生成 | `subprocess`, `multiprocessing`, `os.system` |
| ネットワーク | `socket`, `urllib`, `http.client` |
| 低レベルアクセス | `ctypes`, `cffi`, `_winapi` |
| コード操作 | `ast`, `dis`, `inspect`, `code` |
| シリアライズ | `pickle`（コード実行可能） |

### 許可するモジュール

| カテゴリ | モジュール |
|----------|-----------|
| ゲーム専用 | `BackcastPro` |
| marimo | `marimo` |
| データ処理 | `numpy`, `pandas`, `scipy`, `duckdb` |
| 可視化 | `matplotlib`, `plotly` |
| ネットワーク | `requests`（ホワイトリスト経由のみ） |
| 標準ライブラリ | `math`, `datetime`, `json`, `collections`, `itertools` 等 |

---

## 修正対象ファイル

| ファイル | 変更内容 | 状態 |
|----------|----------|------|
| `marimo/_security/__init__.py` | 新規: セキュリティパッケージ | 未実装 |
| `marimo/_security/import_hook.py` | 新規: Import制限 | 未実装 |
| `marimo/_security/builtins.py` | 新規: Builtins制限 | 未実装 |
| `marimo/_security/network.py` | 新規: ネットワーク制限 | 未実装 |
| `marimo/_security/filesystem.py` | 新規: ファイルアクセス制限 | 未実装 |
| `marimo/_runtime/executor.py` | 修正: SecureExecutor追加 | 未実装 |
| `marimo/_runtime/patches.py` | 修正: 制限付きbuiltins | 未実装 |
| `marimo/_runtime/runtime.py` | 修正: セキュリティモード初期化 | 未実装 |

---

## 検証方法（実装後）

1. **Sandbox Escapeテスト**
   - `().__class__.__bases__[0].__subclasses__()` パターン
   - `__builtins__`への直接アクセス
   - モジュールのリロードによる回避

2. **ファイルシステムテスト**
   - ゲーム外ディレクトリへのアクセス試行
   - パス・トラバーサル攻撃（`../../../etc/passwd`等）

3. **ネットワークテスト**
   - ホワイトリスト外へのアクセス試行
   - DNS rebinding攻撃

4. **機能テスト**
   - 正規のゲーム機能が動作すること
   - データ可視化が正常に動作すること

---

## 注意事項

### Python-levelサンドボックスの限界

Pythonのイントロスペクション機能により、**完全なサンドボックスは困難**です。

**既知の回避手法:**
- `__class__.__mro__`を使った型階層探索
- `__subclasses__()`を使ったクラス検出
- `__globals__`/`__code__`への直接アクセス
- `gc.get_objects()`を使ったオブジェクト探索

これらは静的解析 + 動的チェックで対策可能ですが、完全ではありません。

### 将来的な強化オプション

より強力なセキュリティが必要な場合：

1. **OS-level Sandbox（Windows AppContainer）**
   - MSIXパッケージ化が必要
   - ファイルシステム仮想化
   - 最も強力だが実装コストが高い

2. **RestrictedPython**
   - Zopeプロジェクトのライブラリ
   - AST変換による制限
   - 一部の機能が使えなくなる可能性

---

## 参考資料

- [RestrictedPython Documentation](https://restrictedpython.readthedocs.io/)
- [Python Wiki: SandboxedPython](https://wiki.python.org/moin/SandboxedPython)
- [Windows AppContainer Isolation](https://docs.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
