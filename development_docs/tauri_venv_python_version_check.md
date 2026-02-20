# Tauri: venv の Python バージョン検証と自動再作成

## 概要

marimo デスクトップアプリ（`src-tauri/`）の起動時、既存の venv が古い Python（< 3.10）で作られていた場合、自動的に削除して Python 3.13 で再作成する。

**修正コミット対象バグ:** Intel Mac 等で一度 system Python 3.9.6 により venv が作られると、以降の起動で常に `marimo==x.x.x cannot be used (requires Python>=3.10)` エラーが発生し起動不能になる。

---

## 根本原因

`ensure_environment()` 内の venv 存在チェックが、Python バイナリの有無のみを確認しておりバージョン検証がなかった。

```rust
// 修正前（問題のあったコード）
let venv_exists = venv_python.exists();  // 存在だけチェック
if !venv_exists {
    // 作成
} else {
    // 古い venv でもそのまま使い続けてしまう
}
```

---

## 仕様

- 起動時に `ensure_environment()` が venv の Python バージョンを確認する
- venv の `python --version` が `3.10` 未満の場合、venv ディレクトリを削除して再作成する
- バージョンの取得に失敗した場合（venv が壊れているなど）も再作成する
- 正常（`>= 3.10`）であればスキップ（従来通り）

---

## 実装

### 変更ファイル

- `src-tauri/src/environment/bootstrap.rs`

### 追加関数

```rust
fn get_venv_python_version(venv_python: &Path) -> Option<(u32, u32)>
```

venv の Python バイナリを直接実行して `python --version` の出力からバージョンを取得する。`(major, minor)` のタプルを返す。

### 変更箇所: venv 作成判定ロジック

```rust
let should_create_venv = if !venv_python.exists() {
    true
} else {
    match get_venv_python_version(&venv_python) {
        Some((major, minor)) if (major, minor) >= (3, 10) => false, // OK
        Some((major, minor)) => true,  // 古い → 再作成
        None => true,                  // 不明 → 再作成
    }
};

if should_create_venv {
    if env_dir.exists() {
        fs::remove_dir_all(env_dir)?;  // 既存 venv を削除
    }
    // uv venv --seed --python <python_3.13_path> <env_dir> で再作成
}
```

### バージョン比較

`(major, minor) >= (3, 10)` のタプル比較を使用することで、Python 4.x 等の将来バージョンを正しく `>= 3.10` と判定できる。

---

## 動作フロー（修正後）

```
起動
 │
 ├─ venv の Python バイナリが存在しない → 作成
 │
 ├─ python --version が 3.9.x → venv を削除 → Python 3.13 で再作成
 │
 └─ python --version が 3.10 以上 → スキップ（正常）
```

---

## 背景

`uv python find` に `UV_PYTHON_PREFERENCE=only-managed` を設定しているが、古いバージョンの uv やシステム設定によっては system Python を返すことがあった。venv 作成後のバージョン検証によりこの問題を根本的に解決する。
